// Engine - Audio Engine (Howler wrapper)
import { Howl } from 'howler';
import { logger } from '../core/logger';
import { Station } from '../types/radio';
import { retryWithBackoff, RetryConfig } from './retryPolicy';
import { playerMetrics } from './metrics';

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface AudioEngineState {
  status: PlayerStatus;
  currentStation: Station | null;
  volume: number;
  muted: boolean;
  error: string | null;
}

type StateListener = (state: AudioEngineState) => void;

class AudioEngine {
  private howl: Howl | null = null;
  private state: AudioEngineState = {
    status: 'idle',
    currentStation: null,
    volume: 0.8,
    muted: false,
    error: null,
  };
  private listeners: Set<StateListener> = new Set();
  private playStartTime: number | null = null;

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

  async play(station: Station): Promise<void> {
    // Stop current playback
    this.stop();

    this.setState({
      status: 'loading',
      currentStation: station,
      error: null,
    });

    const urls = [station.urlResolved, station.url].filter(Boolean) as string[];
    
    const config: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 5000,
    };

    try {
      await retryWithBackoff(async (attempt) => {
        const url = urls[attempt % urls.length];
        logger.info('AudioEngine', `Playing ${station.name} from ${url} (attempt ${attempt + 1})`);
        
        return new Promise<void>((resolve, reject) => {
          this.howl = new Howl({
            src: [url],
            html5: true,
            volume: this.state.muted ? 0 : this.state.volume,
            format: ['mp3', 'aac', 'ogg', 'opus'],
            onplay: () => {
              this.playStartTime = Date.now();
              this.setState({ status: 'playing', error: null });
              playerMetrics.recordPlay(station.id);
              resolve();
            },
            onpause: () => {
              this.setState({ status: 'paused' });
            },
            onstop: () => {
              this.recordPlayTime();
              this.setState({ status: 'idle' });
            },
            onend: () => {
              this.recordPlayTime();
              this.setState({ status: 'idle' });
            },
            onloaderror: (_, error) => {
              logger.error('AudioEngine', `Load error: ${error}`);
              playerMetrics.recordError(station.id);
              reject(new Error(`Failed to load: ${error}`));
            },
            onplayerror: (_, error) => {
              logger.error('AudioEngine', `Play error: ${error}`);
              playerMetrics.recordError(station.id);
              reject(new Error(`Failed to play: ${error}`));
            },
          });

          this.howl.play();
        });
      }, config);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('AudioEngine', `All attempts failed for ${station.name}: ${message}`);
      this.setState({
        status: 'error',
        error: message,
      });
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
    if (this.howl) {
      this.recordPlayTime();
      this.howl.unload();
      this.howl = null;
    }
    this.setState({
      status: 'idle',
      currentStation: null,
      error: null,
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
}

// Singleton instance
export const audioEngine = new AudioEngine();
