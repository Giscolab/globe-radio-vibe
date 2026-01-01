// Engine - Audio Engine (Howler wrapper) with WebAudio integration, health checks, and auto-fallback
import { Howl } from 'howler';
import { logger } from '../core/logger';
import { Station } from '../types/radio';
import { retryWithBackoff, RetryConfig } from './retryPolicy';
import { playerMetrics } from './metrics';
import { audioAnalyzer } from '../audio/audioAnalyzer';
import { healthHistory } from '../radio/health';
import { buildCandidateUrls, isHlsStream, browserSupportsHls } from '../radio/utils/httpsUpgrade';

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface AudioEngineState {
  status: PlayerStatus;
  currentStation: Station | null;
  volume: number;
  muted: boolean;
  error: string | null;
  // Diagnostics
  currentUrl: string | null;
  urlType: 'direct' | 'proxy' | 'hls' | null;
  candidateIndex: number;
  totalCandidates: number;
}

type StateListener = (state: AudioEngineState) => void;

// Playback start timeout in ms - if audio doesn't start within this time, try next candidate
const PLAYBACK_START_TIMEOUT = 8000;

class AudioEngine {
  private howl: Howl | null = null;
  private state: AudioEngineState = {
    status: 'idle',
    currentStation: null,
    volume: 0.8,
    muted: false,
    error: null,
    currentUrl: null,
    urlType: null,
    candidateIndex: 0,
    totalCandidates: 0,
  };
  private listeners: Set<StateListener> = new Set();
  private playStartTime: number | null = null;
  private analyzerConnected = false;
  private playbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private setState(partial: Partial<AudioEngineState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  getState(): AudioEngineState {
    return { ...this.state };
  }

  /**
   * Determine URL type for diagnostics
   */
  private getUrlType(url: string): 'direct' | 'proxy' | 'hls' {
    if (url.includes('audio-stream-proxy')) return 'proxy';
    if (isHlsStream(url)) return 'hls';
    return 'direct';
  }

  /**
   * Connect WebAudio analyzer to current Howl audio element
   */
  private connectAnalyzer(): void {
    if (!this.howl || this.analyzerConnected) return;
    
    try {
      // Access Howler's internal audio node
      const sounds = (this.howl as any)._sounds;
      if (sounds && sounds.length > 0) {
        const audioNode = sounds[0]._node as HTMLAudioElement;
        if (audioNode && audioNode.readyState >= 2) {
          this.analyzerConnected = audioAnalyzer.connect(audioNode);
          if (this.analyzerConnected) {
            logger.info('AudioEngine', 'WebAudio analyzer connected');
          }
        }
      }
    } catch (error) {
      logger.warn('AudioEngine', `Failed to connect analyzer: ${error}`);
    }
  }

  /**
   * Disconnect WebAudio analyzer
   */
  private disconnectAnalyzer(): void {
    if (this.analyzerConnected) {
      audioAnalyzer.disconnect();
      this.analyzerConnected = false;
    }
  }

  /**
   * Clear playback timeout
   */
  private clearPlaybackTimeout(): void {
    if (this.playbackTimeoutId) {
      clearTimeout(this.playbackTimeoutId);
      this.playbackTimeoutId = null;
    }
  }

  /**
   * Try to play a specific URL, returns a promise that resolves on success or rejects on failure
   */
  private tryPlayUrl(url: string, station: Station): Promise<void> {
    return new Promise((resolve, reject) => {
      this.clearPlaybackTimeout();
      
      // Clean up previous howl if exists
      if (this.howl) {
        this.howl.unload();
        this.howl = null;
      }

      const urlType = this.getUrlType(url);
      logger.info('AudioEngine', `Trying ${urlType} URL: ${url}`);

      this.setState({
        currentUrl: url,
        urlType,
      });

      this.howl = new Howl({
        src: [url],
        html5: true,
        volume: this.state.muted ? 0 : this.state.volume,
        format: ['mp3', 'aac', 'ogg', 'opus'],
        onplay: () => {
          this.clearPlaybackTimeout();
          this.playStartTime = Date.now();
          this.setState({ status: 'playing', error: null });
          playerMetrics.recordPlay(station.id);
          healthHistory.record({
            stationId: station.id,
            ok: true,
            latency: 0,
          });
          
          // Connect WebAudio analyzer after playback starts with delay
          setTimeout(() => this.connectAnalyzer(), 500);
          
          resolve();
        },
        onpause: () => {
          this.setState({ status: 'paused' });
        },
        onstop: () => {
          this.clearPlaybackTimeout();
          this.recordPlayTime();
          this.disconnectAnalyzer();
          this.setState({ status: 'idle' });
        },
        onend: () => {
          this.clearPlaybackTimeout();
          this.recordPlayTime();
          this.disconnectAnalyzer();
          this.setState({ status: 'idle' });
        },
        onloaderror: (_, error) => {
          this.clearPlaybackTimeout();
          logger.warn('AudioEngine', `Load error for ${url}: ${error}`);
          this.disconnectAnalyzer();
          reject(new Error(`Load error: ${error}`));
        },
        onplayerror: (_, error) => {
          this.clearPlaybackTimeout();
          logger.warn('AudioEngine', `Play error for ${url}: ${error}`);
          this.disconnectAnalyzer();
          reject(new Error(`Play error: ${error}`));
        },
      });

      // Set a timeout for playback to start
      this.playbackTimeoutId = setTimeout(() => {
        logger.warn('AudioEngine', `Playback timeout for ${url}`);
        reject(new Error('Playback timeout - audio did not start'));
      }, PLAYBACK_START_TIMEOUT);

      this.howl.play();
    });
  }

  async play(station: Station): Promise<void> {
    // Stop current playback
    this.stop();

    // Build candidate URLs (direct + proxy fallbacks)
    const candidates = buildCandidateUrls(station);
    
    if (candidates.length === 0) {
      // Check if it's an HLS stream issue
      const rawUrls = [station.urlResolved, station.url].filter(Boolean) as string[];
      const hasHls = rawUrls.some(u => isHlsStream(u));
      
      if (hasHls && !browserSupportsHls()) {
        const error = 'Format HLS non supporté sur ce navigateur (utilisez Safari)';
        logger.error('AudioEngine', error);
        this.setState({
          status: 'error',
          currentStation: station,
          error,
          currentUrl: null,
          urlType: null,
          candidateIndex: 0,
          totalCandidates: 0,
        });
        return;
      }
      
      this.setState({
        status: 'error',
        currentStation: station,
        error: 'Aucune URL valide disponible',
        currentUrl: null,
        urlType: null,
        candidateIndex: 0,
        totalCandidates: 0,
      });
      return;
    }

    this.setState({
      status: 'loading',
      currentStation: station,
      error: null,
      totalCandidates: candidates.length,
    });

    logger.debug('AudioEngine', `Candidates for ${station.name}: ${candidates.join(', ')}`);

    // Try each candidate in order
    for (let i = 0; i < candidates.length; i++) {
      const url = candidates[i];
      this.setState({ candidateIndex: i });
      
      try {
        logger.info('AudioEngine', `Playing ${station.name} (candidate ${i + 1}/${candidates.length})`);
        await this.tryPlayUrl(url, station);
        // Success! Exit the loop
        logger.info('AudioEngine', `Successfully playing ${station.name} via ${this.getUrlType(url)}`);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.warn('AudioEngine', `Candidate ${i + 1} failed: ${message}`);
        playerMetrics.recordError(station.id);
        
        // If this was the last candidate, set error state
        if (i === candidates.length - 1) {
          logger.error('AudioEngine', `All candidates failed for ${station.name}`);
          this.disconnectAnalyzer();
          this.setState({
            status: 'error',
            error: `Échec de lecture: ${message}`,
          });
        }
        // Otherwise, continue to next candidate
      }
    }
  }

  private recordPlayTime(): void {
    if (this.playStartTime && this.state.currentStation) {
      const duration = Date.now() - this.playStartTime;
      playerMetrics.recordPlayTime(this.state.currentStation.id, duration);
      this.playStartTime = null;
    }
  }

  pause(): void {
    if (this.howl && this.state.status === 'playing') {
      this.howl.pause();
    }
  }

  resume(): void {
    if (this.howl && this.state.status === 'paused') {
      this.howl.play();
    }
  }

  stop(): void {
    this.clearPlaybackTimeout();
    if (this.howl) {
      this.recordPlayTime();
      this.disconnectAnalyzer();
      this.howl.unload();
      this.howl = null;
    }
    this.setState({
      status: 'idle',
      currentStation: null,
      error: null,
      currentUrl: null,
      urlType: null,
      candidateIndex: 0,
      totalCandidates: 0,
    });
  }

  toggle(): void {
    if (this.state.status === 'playing') {
      this.pause();
    } else if (this.state.status === 'paused') {
      this.resume();
    }
  }

  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.setState({ volume: clampedVolume });
    if (this.howl && !this.state.muted) {
      this.howl.volume(clampedVolume);
    }
  }

  setMuted(muted: boolean): void {
    this.setState({ muted });
    if (this.howl) {
      this.howl.volume(muted ? 0 : this.state.volume);
    }
  }

  toggleMute(): void {
    this.setMuted(!this.state.muted);
  }

  /**
   * Check if WebAudio analyzer is connected
   */
  isAnalyzerConnected(): boolean {
    return this.analyzerConnected;
  }

  /**
   * Get the underlying audio element for diagnostics
   */
  getAudioElement(): HTMLAudioElement | null {
    if (!this.howl) return null;
    try {
      const sounds = (this.howl as any)._sounds;
      if (sounds && sounds.length > 0) {
        return sounds[0]._node as HTMLAudioElement;
      }
    } catch {
      // Ignore
    }
    return null;
  }
}

// Singleton instance
export const audioEngine = new AudioEngine();
