// Engine - Audio Analyzer: WebAudio FFT, volume, peak, silence detection
import { logger } from '../core/logger';

export interface AudioAnalysis {
  fft: Uint8Array;           // Frequency data 0-255
  volume: number;            // RMS volume 0-1
  peak: boolean;             // True if peak detected
  silent: boolean;           // True if silence detected
  bassLevel: number;         // Low frequency intensity 0-1
  trebleLevel: number;       // High frequency intensity 0-1
}

// Silence detection threshold
const SILENCE_THRESHOLD = 0.01;
const SILENCE_DURATION_MS = 3000;
const PEAK_MULTIPLIER = 1.3;
const PEAK_MIN_VOLUME = 0.15;
const FFT_SIZE = 256;

// Global caches - survive analyzer lifecycle to handle Web Audio API restrictions
// Once a MediaElementSourceNode is created, it cannot be recreated for the same element
const sourceNodeCache = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
// Track elements blocked by CORS to avoid repeated connection attempts
const corsBlockedElements = new WeakSet<HTMLMediaElement>();

class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private connectedElement: HTMLAudioElement | null = null;
  
  // Analysis data buffers
  private fftData: Uint8Array<ArrayBuffer>;
  private timeDomainData: Uint8Array<ArrayBuffer>;
  
  constructor() {
    // Pre-allocate typed arrays
    this.fftData = new Uint8Array(FFT_SIZE / 2);
    this.timeDomainData = new Uint8Array(FFT_SIZE / 2);
  }
  
  // Peak detection state
  private previousVolume = 0;
  private peakDecay = 0;
  
  // Silence detection state
  private silenceStartTime: number | null = null;
  private isSilent = false;
  
  // Listeners for silence events
  private silenceListeners: Set<(isSilent: boolean) => void> = new Set();

  /**
   * Connect to an HTMLAudioElement for analysis
   */
  connect(audioElement: HTMLAudioElement): boolean {
    try {
      // Skip CORS-blocked elements silently
      if (corsBlockedElements.has(audioElement)) {
        logger.debug('AudioAnalyzer', 'Skipping CORS-blocked element');
        return false;
      }
      
      // Don't reconnect to the same element
      if (this.connectedElement === audioElement && this.analyser) {
        return true;
      }
      
      // Disconnect graph but preserve source node cache
      this.disconnectGraph();
      
      // Create AudioContext lazily (requires user interaction)
      if (!this.audioContext) {
        const WebkitAudioContext = (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
        this.audioContext = new (window.AudioContext || WebkitAudioContext)();
      }
      
      // Resume if suspended
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      
      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = FFT_SIZE;
      this.analyser.smoothingTimeConstant = 0.8;
      
      // Check if we have a cached source node for this element
      const cachedSource = sourceNodeCache.get(audioElement);
      
      if (cachedSource) {
        // Reuse existing source node
        this.source = cachedSource;
        logger.debug('AudioAnalyzer', 'Reusing cached source node');
      } else {
        // Create new source and cache it
        try {
          this.source = this.audioContext.createMediaElementSource(audioElement);
          sourceNodeCache.set(audioElement, this.source);
        } catch (error: unknown) {
          if (error instanceof Error && error.name === 'InvalidStateError') {
            // Element was connected elsewhere - mark as unusable for this session
            logger.debug('AudioAnalyzer', 'Element already has a source node from another context');
            corsBlockedElements.add(audioElement);
            return false;
          }
          throw error;
        }
      }
      
      // Connect: source -> analyser -> destination
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      
      this.connectedElement = audioElement;
      
      // Initialize data arrays with explicit ArrayBuffer
      const binCount = this.analyser.frequencyBinCount;
      this.fftData = new Uint8Array(new ArrayBuffer(binCount));
      this.timeDomainData = new Uint8Array(new ArrayBuffer(binCount));
      
      logger.info('AudioAnalyzer', 'Connected to audio element');
      return true;
    } catch (error) {
      logger.error('AudioAnalyzer', `Failed to connect: ${error}`);
      return false;
    }
  }

  /**
   * Disconnect the audio graph but preserve source node (it cannot be recreated)
   */
  private disconnectGraph(): void {
    try {
      if (this.source) {
        this.source.disconnect();
        // Don't null out source - it's cached in sourceNodeCache
      }
      if (this.analyser) {
        this.analyser.disconnect();
        this.analyser = null;
      }
      this.source = null;
      this.connectedElement = null;
      this.silenceStartTime = null;
      this.isSilent = false;
      this.previousVolume = 0;
    } catch (error) {
      logger.debug('AudioAnalyzer', 'Disconnect error', error);
    }
  }

  /**
   * Disconnect from audio element
   */
  disconnect(): void {
    this.disconnectGraph();
    logger.info('AudioAnalyzer', 'Disconnected');
  }

  /**
   * Check if analyzer is connected
   */
  isConnected(): boolean {
    return this.analyser !== null && this.connectedElement !== null;
  }

  /**
   * Check if current element is CORS-blocked (visualization disabled but audio plays)
   */
  isCorsBlocked(): boolean {
    return this.connectedElement !== null && corsBlockedElements.has(this.connectedElement);
  }

  /**
   * Check if an element was marked as CORS-blocked
   */
  isElementCorsBlocked(element: HTMLMediaElement): boolean {
    return corsBlockedElements.has(element);
  }

  /**
   * Get current audio analysis data
   */
  getAnalysis(): AudioAnalysis {
    const emptyAnalysis: AudioAnalysis = {
      fft: this.fftData,
      volume: 0,
      peak: false,
      silent: true,
      bassLevel: 0,
      trebleLevel: 0,
    };
    
    if (!this.analyser) {
      return emptyAnalysis;
    }
    
    // Get frequency data - use any cast for WebAudio API compatibility
    this.analyser.getByteFrequencyData(this.fftData);
    this.analyser.getByteTimeDomainData(this.timeDomainData);
    
    // Calculate RMS volume from time domain data
    let sumSquares = 0;
    for (let i = 0; i < this.timeDomainData.length; i++) {
      const normalized = (this.timeDomainData[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / this.timeDomainData.length);
    const volume = Math.min(1, rms * 2); // Scale up for better visibility
    
    // Calculate bass level (first 1/4 of frequency bins)
    const bassEnd = Math.floor(this.fftData.length / 4);
    let bassSum = 0;
    for (let i = 0; i < bassEnd; i++) {
      bassSum += this.fftData[i];
    }
    const bassLevel = (bassSum / bassEnd) / 255;
    
    // Calculate treble level (last 1/4 of frequency bins)
    const trebleStart = Math.floor(this.fftData.length * 3 / 4);
    let trebleSum = 0;
    for (let i = trebleStart; i < this.fftData.length; i++) {
      trebleSum += this.fftData[i];
    }
    const trebleLevel = (trebleSum / (this.fftData.length - trebleStart)) / 255;
    
    // Peak detection
    const peak = volume > this.previousVolume * PEAK_MULTIPLIER && volume > PEAK_MIN_VOLUME;
    this.peakDecay = peak ? 1 : Math.max(0, this.peakDecay - 0.1);
    this.previousVolume = volume * 0.9 + this.previousVolume * 0.1; // Smooth
    
    // Silence detection
    const now = Date.now();
    if (volume < SILENCE_THRESHOLD) {
      if (this.silenceStartTime === null) {
        this.silenceStartTime = now;
      } else if (now - this.silenceStartTime > SILENCE_DURATION_MS) {
        if (!this.isSilent) {
          this.isSilent = true;
          this.notifySilenceListeners(true);
        }
      }
    } else {
      if (this.isSilent) {
        this.isSilent = false;
        this.notifySilenceListeners(false);
      }
      this.silenceStartTime = null;
    }
    
    return {
      fft: this.fftData,
      volume,
      peak,
      silent: this.isSilent,
      bassLevel,
      trebleLevel,
    };
  }

  /**
   * Subscribe to silence events
   */
  onSilence(listener: (isSilent: boolean) => void): () => void {
    this.silenceListeners.add(listener);
    return () => this.silenceListeners.delete(listener);
  }

  private notifySilenceListeners(isSilent: boolean): void {
    for (const listener of this.silenceListeners) {
      listener(isSilent);
    }
  }

  /**
   * Get the AudioContext (for advanced usage)
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }
}

// Singleton instance
export const audioAnalyzer = new AudioAnalyzer();
