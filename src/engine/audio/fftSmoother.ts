// Engine - FFT Smoother: Smooth and downsample FFT data for performance

export interface SmoothedFFT {
  bands: Float32Array;    // Downsampled frequency bands (0-1)
  bass: number;           // Bass level (0-1)
  mid: number;            // Mid level (0-1)
  treble: number;         // Treble level (0-1)
  average: number;        // Overall average (0-1)
}

const DEFAULT_BANDS = 16;
const EMA_ALPHA = 0.3; // Exponential moving average factor (higher = faster response)

class FFTSmoother {
  private previousBands: Float32Array;
  private bandCount: number;

  constructor(bandCount: number = DEFAULT_BANDS) {
    this.bandCount = bandCount;
    this.previousBands = new Float32Array(bandCount);
  }

  /**
   * Process raw FFT data and return smoothed, downsampled bands
   */
  process(fftData: Uint8Array<ArrayBufferLike>): SmoothedFFT {
    const inputLength = fftData.length;
    const bandsPerGroup = Math.floor(inputLength / this.bandCount);
    const bands = new Float32Array(this.bandCount);

    // Downsample by averaging groups
    for (let i = 0; i < this.bandCount; i++) {
      const start = i * bandsPerGroup;
      const end = Math.min(start + bandsPerGroup, inputLength);
      
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += fftData[j];
      }
      
      const raw = (sum / (end - start)) / 255; // Normalize to 0-1
      
      // Apply EMA smoothing
      bands[i] = this.previousBands[i] * (1 - EMA_ALPHA) + raw * EMA_ALPHA;
    }

    // Store for next frame
    this.previousBands.set(bands);

    // Calculate frequency ranges
    const bassEnd = Math.floor(this.bandCount * 0.25);
    const midEnd = Math.floor(this.bandCount * 0.6);

    let bassSum = 0, midSum = 0, trebleSum = 0;
    
    for (let i = 0; i < bassEnd; i++) {
      bassSum += bands[i];
    }
    for (let i = bassEnd; i < midEnd; i++) {
      midSum += bands[i];
    }
    for (let i = midEnd; i < this.bandCount; i++) {
      trebleSum += bands[i];
    }

    const bass = bassSum / bassEnd;
    const mid = midSum / (midEnd - bassEnd);
    const treble = trebleSum / (this.bandCount - midEnd);
    
    let totalSum = 0;
    for (let i = 0; i < this.bandCount; i++) {
      totalSum += bands[i];
    }
    const average = totalSum / this.bandCount;

    return { bands, bass, mid, treble, average };
  }

  /**
   * Reset smoothing state
   */
  reset(): void {
    this.previousBands.fill(0);
  }

  /**
   * Change number of output bands
   */
  setBandCount(count: number): void {
    if (count !== this.bandCount) {
      this.bandCount = count;
      this.previousBands = new Float32Array(count);
    }
  }
}

// Singleton for global use
export const fftSmoother = new FFTSmoother();

// Factory for creating custom instances
export function createFFTSmoother(bandCount: number = DEFAULT_BANDS): FFTSmoother {
  return new FFTSmoother(bandCount);
}
