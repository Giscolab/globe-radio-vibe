// Engine - Audio Engine (Howler wrapper) with WebAudio integration, health checks, and auto-fallback
import { Howl } from 'howler';
import { logger } from '../core/logger';
import { Station } from '../types/radio';
import { playerMetrics } from './metrics';
import { audioAnalyzer } from '../audio/audioAnalyzer';
import { healthHistory } from '../radio/health';
import { buildCandidateUrls, isHlsStream, browserSupportsHls, needsProxy } from '../radio/utils/httpsUpgrade';
import { retryWithBackoff } from './retryPolicy';

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
type HowlerSound = { _node?: HTMLAudioElement | null };
type HowlerInternal = Howl & { _sounds?: HowlerSound[] };

// =======================
// AUDIO ENGINE
// =======================
// Invariants:
// 1) audioEngine is the single source of truth for playback state (stores only mirror).
// 2) Never drop a playing stream without a valid fallback (proxy <-> direct guarded).
// 3) Only one transition at a time (guarded by transitionToken / isTransitioning).

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
  private analyzerConnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private suppressReconnect = false;
  private reconnectInProgress = false;
  private reconnectToken = 0;
  private isTransitioning = false;
  private transitionToken = 0;
  private transitionQueue: Promise<void> = Promise.resolve();

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
      const node = (this.howl as HowlerInternal)?._sounds?.[0]?._node ?? null;
      if (node && node.readyState >= 2) {
        this.analyzerConnected = audioAnalyzer.connect(node);
        logger.debug('AudioEngine', 'WebAudio analyzer connected');
      }
    } catch (error) {
      logger.debug('AudioEngine', 'Analyzer connection failed', error);
    }
  }

  private disconnectAnalyzer(): void {
    if (this.analyzerConnected) {
      audioAnalyzer.disconnect();
      this.analyzerConnected = false;
    }
  }

  private beginTransition(): number {
    this.isTransitioning = true;
    this.transitionToken += 1;
    return this.transitionToken;
  }

  private endTransition(token: number): void {
    if (this.transitionToken === token) {
      this.isTransitioning = false;
    }
  }

  private runTransition(task: () => Promise<void> | void): Promise<void> {
    const run = this.transitionQueue.then(() => Promise.resolve(task()));
    this.transitionQueue = run.catch(() => {});
    return run;
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

  private clearAnalyzerConnectTimeout() {
    if (this.analyzerConnectTimeoutId) {
      clearTimeout(this.analyzerConnectTimeoutId);
      this.analyzerConnectTimeoutId = null;
    }
  }

  private stopInternal(): void {
    this.clearPlaybackTimeout();
    this.clearProxySwitchTimeout();
    this.clearAnalyzerConnectTimeout();
    this.recordPlayTime();
    this.disconnectAnalyzer();
    this.setState({ status: 'idle' });
  }

  private stopCore(): void {
    this.clearPlaybackTimeout();
    this.clearProxySwitchTimeout();
    this.clearAnalyzerConnectTimeout();
    this.suppressReconnect = this.howl !== null;

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

      logger.debug('AudioEngine', `Trying ${urlType} URL: ${url}`);

      const safeCallback = (label: string, callback: () => void | Promise<void>) => {
        try {
          const result = callback();
          if (result instanceof Promise) {
            result.catch((error) => {
              logger.error('AudioEngine', `Callback ${label} failed`, error);
            });
          }
        } catch (error) {
          logger.error('AudioEngine', `Callback ${label} failed`, error);
        }
      };

      this.howl = new Howl({
        src: [url],
        html5: true,
        volume: this.state.muted ? 0 : this.state.volume,
        format: ['mp3', 'aac', 'ogg', 'opus'],

        onplay: () => safeCallback('onplay', () => {
          this.clearPlaybackTimeout();
          this.playStartTime = Date.now();
          this.setState({ status: 'playing', error: null });

          playerMetrics.recordPlay(station.id);
          healthHistory.record({ stationId: station.id, ok: true, latency: 0 });

          this.clearAnalyzerConnectTimeout();
          this.analyzerConnectTimeoutId = setTimeout(() => this.connectAnalyzer(), 500);

          if (urlType === 'proxy') {
            this.scheduleProxySwitch(station);
          }

          resolve();
        }),

        onpause: () => safeCallback('onpause', () => this.setState({ status: 'paused' })),
        onstop: () => safeCallback('onstop', () => this.handleStreamEnded('stop')),
        onend: () => safeCallback('onend', () => this.handleStreamEnded('end')),

        onloaderror: (_, err) => reject(new Error(`Load error: ${err}`)),
        onplayerror: (_, err) => reject(new Error(`Play error: ${err}`)),
      });

      this.playbackTimeoutId = setTimeout(() => {
        reject(new Error('Playback timeout'));
      }, PLAYBACK_START_TIMEOUT);

      try {
        this.howl.play();
      } catch (error) {
        reject(error);
      }
    });
  }

  private async handleStreamEnded(reason: 'stop' | 'end'): Promise<void> {
    if (this.suppressReconnect) {
      this.suppressReconnect = false;
      this.stopInternal();
      return;
    }

    const station = this.state.currentStation;
    this.stopInternal();

    if (!station || this.reconnectInProgress) return;

    this.reconnectInProgress = true;
    const token = ++this.reconnectToken;

    try {
      await retryWithBackoff(async () => {
        if (this.reconnectToken !== token) return;
        if (this.state.currentStation && this.state.currentStation.id !== station.id) return;
        await this.play(station);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('AudioEngine', `Auto-reconnect failed after ${reason}: ${message}`);
      if (this.state.currentStation?.id === station.id) {
        this.setState({ status: 'error', error: 'Échec de reconnexion' });
      }
    } finally {
      if (this.reconnectToken === token) {
        this.reconnectInProgress = false;
      }
    }
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
      if (needsProxy(direct)) return;

      const currentProxyUrl = this.state.currentUrl;
      if (!currentProxyUrl) return;

      logger.debug('AudioEngine', `Switching ${station.name} from proxy to direct`);
      this.tryPlayUrl(direct, station).catch(() => {
        if (this.state.currentStation?.id !== station.id) return;
        this.tryPlayUrl(currentProxyUrl, station).catch(() => {});
      });
    }, PROXY_TO_DIRECT_SWITCH_DELAY);
  }

  // =======================
  // PUBLIC API
  // =======================

  async play(station: Station): Promise<void> {
    return this.runTransition(async () => {
      const transitionToken = this.beginTransition();

      try {
        this.reconnectToken++;
        this.reconnectInProgress = false;
        this.stopCore();

        const candidates = buildCandidateUrls(station);

        if (this.transitionToken !== transitionToken) return;

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
          if (this.transitionToken !== transitionToken) return;
          this.setState({ candidateIndex: i });
          try {
            await this.tryPlayUrl(candidates[i], station);
            return;
          } catch (error) {
            logger.debug('AudioEngine', 'Candidate URL failed', error);
          }
        }

        if (this.transitionToken !== transitionToken) return;

        this.setState({
          status: 'error',
          error: 'Échec de lecture',
        });
      } finally {
        this.endTransition(transitionToken);
      }
    });
  }

  stop(): void {
    this.runTransition(() => {
      this.stopCore();
    }).catch(() => {});
  }

  pause(): void {
    if (this.howl && this.state.status === 'playing') this.howl.pause();
  }

  resume(): void {
    if (this.howl && this.state.status === 'paused') this.howl.play();
  }

  toggle(): void {
    if (this.state.status === 'playing') {
      this.pause();
    } else {
      this.resume();
    }
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
      return (this.howl as HowlerInternal | null)?._sounds?.[0]?._node ?? null;
    } catch {
      return null;
    }
  }
}

export const audioEngine = new AudioEngine();
