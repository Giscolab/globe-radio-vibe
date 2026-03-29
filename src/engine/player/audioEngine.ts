// Engine - Audio Engine (Howler wrapper) with WebAudio integration, health checks, and auto-fallback
import Hls from 'hls.js';
import { Howl } from 'howler';
import { logger } from '../core/logger';
import { Station } from '../types/radio';
import { playerMetrics } from './metrics';
import { audioAnalyzer } from '../audio/audioAnalyzer';
import { healthHistory } from '../radio/health';
import { buildCandidateUrls, isHlsStream } from '../radio/utils/httpsUpgrade';
import { retryWithBackoff } from './retryPolicy';

// =======================
// CONFIG
// =======================

const PLAYBACK_START_TIMEOUT = 8000;

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
  urlType: 'direct' | 'hls' | null;
  candidateIndex: number;
  totalCandidates: number;
}

type StateListener = (state: AudioEngineState) => void;
type HowlerSound = { _node?: HTMLAudioElement | null };
type HowlerInternal = Howl & { _sounds?: HowlerSound[] };

// =======================
// AUDIO ENGINE
// =======================

class AudioEngine {
  private howl: Howl | null = null;
  private hls: Hls | null = null;
  private htmlAudio: HTMLAudioElement | null = null;

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

  /**
   * Détecte si la station est HLS en analysant les URLs BRUTES
   * (avant proxy), pas les URLs proxifiées qui masquent le format.
   */
  private detectStationUrlType(station: Station): 'direct' | 'hls' {
    const rawUrls = [station.urlResolved, station.url].filter(Boolean) as string[];
    return rawUrls.some(isHlsStream) ? 'hls' : 'direct';
  }

  // =======================
  // ANALYZER
  // =======================

  private connectAnalyzer(): void {
    if (safeAudioModeEnabled || this.analyzerConnected) return;

    try {
      const node = this.getAudioElement();
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

  private clearAnalyzerConnectTimeout() {
    if (this.analyzerConnectTimeoutId) {
      clearTimeout(this.analyzerConnectTimeoutId);
      this.analyzerConnectTimeoutId = null;
    }
  }

  private stopInternal(): void {
    this.clearPlaybackTimeout();
    this.clearAnalyzerConnectTimeout();
    this.recordPlayTime();
    this.disconnectAnalyzer();
    this.setState({ status: 'idle' });
  }

  private stopCore(): void {
    this.clearPlaybackTimeout();
    this.clearAnalyzerConnectTimeout();
    this.suppressReconnect = this.howl !== null || this.htmlAudio !== null;

    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    if (this.htmlAudio) {
      this.htmlAudio.pause();
      this.htmlAudio.src = '';
      this.htmlAudio = null;
    }

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

  /**
   * Tente de lire une URL.
   * @param url - URL (potentiellement proxifiée) à lire
   * @param station - Station en cours
   * @param urlType - Type détecté sur l'URL ORIGINALE ('hls' ou 'direct')
   */
  private async tryPlayUrl(
    url: string,
    station: Station,
    urlType: 'direct' | 'hls'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.clearPlaybackTimeout();

      // Cleanup précédent
      if (this.hls) {
        this.hls.destroy();
        this.hls = null;
      }
      if (this.htmlAudio) {
        this.htmlAudio.pause();
        this.htmlAudio.src = '';
        this.htmlAudio = null;
      }
      if (this.howl) {
        this.howl.unload();
        this.howl = null;
      }

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

      // === BRANCHE HLS (hls.js ou HLS natif) ===
      // La décision repose sur urlType détecté depuis l'URL ORIGINALE,
      // pas sur l'URL proxifiée qui masquerait le format .m3u8
      if (urlType === 'hls') {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.volume = this.state.muted ? 0 : this.state.volume;
        this.htmlAudio = audio;

        if (Hls.isSupported()) {
          const hls = new Hls();
          this.hls = hls;
          hls.loadSource(url);
          hls.attachMedia(audio);
        } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
          audio.src = url;
        } else {
          reject(new Error('HLS non supporté par ce navigateur'));
          return;
        }

        audio.addEventListener('play', () =>
          safeCallback('onplay(hls)', () => {
            this.clearPlaybackTimeout();
            this.playStartTime = Date.now();
            this.setState({ status: 'playing', error: null });

            playerMetrics.recordPlay(station.id);
            healthHistory.record({ stationId: station.id, ok: true, latency: 0 });

            this.clearAnalyzerConnectTimeout();
            this.analyzerConnectTimeoutId = setTimeout(() => this.connectAnalyzer(), 500);

            resolve();
          })
        );

        audio.addEventListener('pause', () =>
          safeCallback('onpause(hls)', () => this.setState({ status: 'paused' }))
        );

        audio.addEventListener('ended', () =>
          safeCallback('onend(hls)', () => this.handleStreamEnded('end'))
        );

        audio.addEventListener('error', () => {
          reject(new Error('Erreur de lecture HLS'));
        });

        this.playbackTimeoutId = setTimeout(() => {
          reject(new Error('Playback timeout (HLS)'));
        }, PLAYBACK_START_TIMEOUT);

        audio.play().catch((error) => {
          reject(error);
        });

        return;
      }

      // === BRANCHE NON-HLS (Howler) ===
      this.howl = new Howl({
        src: [url],
        html5: true,
        volume: this.state.muted ? 0 : this.state.volume,
        format: ['mp3', 'aac', 'ogg', 'opus'],

        onplay: () =>
          safeCallback('onplay', () => {
            this.clearPlaybackTimeout();
            this.playStartTime = Date.now();
            this.setState({ status: 'playing', error: null });

            playerMetrics.recordPlay(station.id);
            healthHistory.record({ stationId: station.id, ok: true, latency: 0 });

            this.clearAnalyzerConnectTimeout();
            this.analyzerConnectTimeoutId = setTimeout(() => this.connectAnalyzer(), 500);

            resolve();
          }),

        onpause: () =>
          safeCallback('onpause', () => this.setState({ status: 'paused' })),
        onstop: () =>
          safeCallback('onstop', () => this.handleStreamEnded('stop')),
        onend: () =>
          safeCallback('onend', () => this.handleStreamEnded('end')),

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
          this.setState({
            status: 'error',
            currentStation: station,
            error: 'Aucune URL valide',
            currentUrl: null,
            urlType: null,
            candidateIndex: 0,
            totalCandidates: 0,
          });
          return;
        }

        // Détecter le type HLS sur les URLs BRUTES de la station,
        // AVANT que buildCandidateUrls ne les enveloppe dans le proxy.
        // L'URL proxifiée (http://localhost:7070/?url=...) masque le .m3u8
        // donc isHlsStream() renverrait false à tort si on l'appelait dessus.
        const urlType = this.detectStationUrlType(station);

        this.setState({
          status: 'loading',
          currentStation: station,
          error: null,
          totalCandidates: candidates.length,
          urlType,
        });

        for (let i = 0; i < candidates.length; i++) {
          if (this.transitionToken !== transitionToken) return;
          this.setState({ candidateIndex: i });
          try {
            await this.tryPlayUrl(candidates[i], station, urlType);
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
    if (this.state.status === 'playing') {
      if (this.howl) this.howl.pause();
      if (this.htmlAudio) this.htmlAudio.pause();
    }
  }

  resume(): void {
    if (this.state.status === 'paused') {
      if (this.howl) this.howl.play();
      if (this.htmlAudio) this.htmlAudio.play().catch(() => {});
    }
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
    if (this.htmlAudio && !this.state.muted) this.htmlAudio.volume = v;
  }

  setMuted(muted: boolean): void {
    this.setState({ muted });
    if (this.howl) this.howl.volume(muted ? 0 : this.state.volume);
    if (this.htmlAudio) this.htmlAudio.volume = muted ? 0 : this.state.volume;
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
      if (this.htmlAudio) return this.htmlAudio;
      return (this.howl as HowlerInternal | null)?._sounds?.[0]?._node ?? null;
    } catch {
      return null;
    }
  }
}

export const audioEngine = new AudioEngine();