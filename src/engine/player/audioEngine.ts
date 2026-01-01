// Engine - Audio Engine (Howler wrapper) with WebAudio integration, health checks, and auto-fallback
import { Howl } from 'howler';
import { logger } from '../core/logger';
import { Station } from '../types/radio';
import { playerMetrics } from './metrics';
import { audioAnalyzer } from '../audio/audioAnalyzer';
import { healthHistory } from '../radio/health';
import { buildCandidateUrls, isHlsStream, browserSupportsHls } from '../radio/utils/httpsUpgrade';

// =======================
// CONFIG
// =======================

const PLAYBACK_START_TIMEOUT = 8000;
const PROXY_TO_DIRECT_SWITCH_DELAY = 6000;

// =======================
// SAFE MODE
// =======================

let safeAudioModeEnabled = true;

export function setSafeAudioMode(enabled: boolean): void {
  safeAudioModeEnabled = enabled;
  logger.info('AudioEngine', `Safe audio mode: ${enabled ? 'ON' : 'OFF'}`);
}

export function isSafeAudioModeEnabled(): boolean {
  return safeAudioModeEnabled;
}

// =======================
// TYPES
// =======================

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface AudioEngineState {
  status: PlayerStatus;
  currentStation: Station | null;
  volume: number;
  muted: boolean;
  error: string | null;
  currentUrl: string | null;
  urlType: 'direct' | 'proxy' | 'hls' | null;
  candidateIndex: number;
  totalCandidates: number;
}

type StateListener = (state: AudioEngineState) => void;

// =======================
// AUDIO ENGINE
// =======================

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

  private listeners = new Set<StateListener>();
  private playStartTime: number | null = null;
  private analyzerConnected = false;
  private playbackTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private proxySwitchTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // =======================
  // STATE MANAGEMENT
  // =======================

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) l(this.state);
  }

  private setState(partial: Partial<AudioEngineState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  getState(): AudioEngineState {
    return { ...this.state };
  }

  // =======================
  // HELPERS
  // =======================

  private getUrlType(url: string): 'direct' | 'proxy' | 'hls' {
    if (url.includes('audio-stream-proxy')) return 'proxy';
    if (isHlsStream(url)) return 'hls';
    return 'direct';
  }

  private getDirectUrl(station: Station): string | null {
    const urls = [station.urlResolved, station.url].filter(Boolean) as string[];
    return urls.find(u => !u.includes('audio-stream-proxy')) ?? null;
  }

  // =======================
  // ANALYZER
  // =======================

  private connectAnalyzer(): void {
    if (safeAudioModeEnabled || this.analyzerConnected || !this.howl) return;

    try {
      const node = (this.howl as any)._sounds?.[0]?._node as HTMLAudioElement;
      if (node && node.readyState >= 2) {
        this.analyzerConnected = audioAnalyzer.connect(node);
        logger.info('AudioEngine', 'WebAudio analyzer connected');
      }
    } catch {}
  }

  private disconnectAnalyzer(): void {
    if (this.analyzerConnected) {
      audioAnalyzer.disconnect();
      this.analyzerConnected = false;
    }
  }

  // =======================
  // CLEANUP
  // =======================

  private clearPlaybackTimeout() {
    if (this.playbackTimeoutId) {
      clearTimeout(this.playbackTimeoutId);
      this.playbackTimeoutId = null;
    }
  }

  private clearProxySwitchTimeout() {
    if (this.proxySwitchTimeoutId) {
      clearTimeout(this.proxySwitchTimeoutId);
      this.proxySwitchTimeoutId = null;
    }
  }

  private stopInternal(): void {
    this.clearPlaybackTimeout();
    this.clearProxySwitchTimeout();
    this.recordPlayTime();
    this.disconnectAnalyzer();
    this.setState({ status: 'idle' });
  }

  // =======================
  // PLAYBACK CORE
  // =======================

  private async tryPlayUrl(url: string, station: Station): Promise<void> {
    return new Promise((resolve, reject) => {
      this.clearPlaybackTimeout();
      this.clearProxySwitchTimeout();

      if (this.howl) {
        this.howl.unload();
        this.howl = null;
      }

      const urlType = this.getUrlType(url);
      this.setState({ currentUrl: url, urlType });

      logger.info('AudioEngine', `Trying ${urlType} URL: ${url}`);

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
          healthHistory.record({ stationId: station.id, ok: true, latency: 0 });

          setTimeout(() => this.connectAnalyzer(), 500);

          if (urlType === 'proxy') {
            this.scheduleProxySwitch(station);
          }

          resolve();
        },

        onpause: () => this.setState({ status: 'paused' }),
        onstop: () => this.stopInternal(),
        onend: () => this.stopInternal(),

        onloaderror: (_, err) => reject(new Error(`Load error: ${err}`)),
        onplayerror: (_, err) => reject(new Error(`Play error: ${err}`)),
      });

      this.playbackTimeoutId = setTimeout(() => {
        reject(new Error('Playback timeout'));
      }, PLAYBACK_START_TIMEOUT);

      this.howl.play();
    });
  }

  private scheduleProxySwitch(station: Station) {
    this.clearProxySwitchTimeout();

    this.proxySwitchTimeoutId = setTimeout(() => {
      if (
        this.state.status !== 'playing' ||
        this.state.urlType !== 'proxy' ||
        this.state.currentStation?.id !== station.id
      ) return;

      const direct = this.getDirectUrl(station);
      if (!direct) return;

      logger.info('AudioEngine', `Switching ${station.name} from proxy to direct`);
      this.tryPlayUrl(direct, station).catch(() => {});
    }, PROXY_TO_DIRECT_SWITCH_DELAY);
  }

  // =======================
  // PUBLIC API
  // =======================

  async play(station: Station): Promise<void> {
    this.stop();

    const candidates = buildCandidateUrls(station);

    if (!candidates.length) {
      const raw = [station.urlResolved, station.url].filter(Boolean);
      const hasHls = raw.some(isHlsStream);

      this.setState({
        status: 'error',
        currentStation: station,
        error: hasHls && !browserSupportsHls()
          ? 'Format HLS non supporté'
          : 'Aucune URL valide',
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

    for (let i = 0; i < candidates.length; i++) {
      this.setState({ candidateIndex: i });
      try {
        await this.tryPlayUrl(candidates[i], station);
        return;
      } catch {}
    }

    this.setState({
      status: 'error',
      error: 'Échec de lecture',
    });
  }

  stop(): void {
    this.clearPlaybackTimeout();
    this.clearProxySwitchTimeout();

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

  pause(): void {
    if (this.howl && this.state.status === 'playing') this.howl.pause();
  }

  resume(): void {
    if (this.howl && this.state.status === 'paused') this.howl.play();
  }

  toggle(): void {
    this.state.status === 'playing' ? this.pause() : this.resume();
  }

  setVolume(volume: number): void {
    const v = Math.max(0, Math.min(1, volume));
    this.setState({ volume: v });
    if (this.howl && !this.state.muted) this.howl.volume(v);
  }

  setMuted(muted: boolean): void {
    this.setState({ muted });
    if (this.howl) this.howl.volume(muted ? 0 : this.state.volume);
  }

  toggleMute(): void {
    this.setMuted(!this.state.muted);
  }

  private recordPlayTime(): void {
    if (this.playStartTime && this.state.currentStation) {
      playerMetrics.recordPlayTime(
        this.state.currentStation.id,
        Date.now() - this.playStartTime
      );
      this.playStartTime = null;
    }
  }

  isAnalyzerConnected(): boolean {
    return this.analyzerConnected;
  }

  getAudioElement(): HTMLAudioElement | null {
    try {
      return (this.howl as any)?._sounds?.[0]?._node ?? null;
    } catch {
      return null;
    }
  }
}

export const audioEngine = new AudioEngine();
