// Hook - useAudioAnalysis: Real-time audio analysis for visualizations
import { useState, useEffect, useRef, useCallback } from 'react';
import { audioAnalyzer, AudioAnalysis } from '@/engine/audio/audioAnalyzer';

interface UseAudioAnalysisOptions {
  enabled?: boolean;
  fps?: number; // Target frames per second for updates
}

const DEFAULT_ANALYSIS: AudioAnalysis = {
  fft: new Uint8Array(128),
  volume: 0,
  peak: false,
  silent: false,
  bassLevel: 0,
  trebleLevel: 0,
};

export function useAudioAnalysis(options: UseAudioAnalysisOptions = {}) {
  const { enabled = true, fps = 60 } = options;

  const [analysis, setAnalysis] = useState<AudioAnalysis>(DEFAULT_ANALYSIS);
  const [isSilent, setIsSilent] = useState(false);

  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);

  const frameInterval = 1000 / fps;

  const updateAnalysis = useCallback((timestamp: number) => {
    if (!enabled) return;

    const elapsed = timestamp - lastUpdateRef.current;
    if (elapsed < frameInterval) {
      animationRef.current = requestAnimationFrame(updateAnalysis);
      return;
    }

    lastUpdateRef.current = timestamp - (elapsed % frameInterval);

    if (audioAnalyzer.isConnected()) {
      const data = audioAnalyzer.getAnalysis();
      setAnalysis(data);
    }

    animationRef.current = requestAnimationFrame(updateAnalysis);
  }, [enabled, frameInterval]);

  useEffect(() => {
    if (!enabled) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    animationRef.current = requestAnimationFrame(updateAnalysis);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [enabled, updateAnalysis]);

  useEffect(() => {
    const unsubscribe = audioAnalyzer.onSilence(setIsSilent);
    return unsubscribe;
  }, []);

  return {
    ...analysis,
    isSilent,
    isConnected: audioAnalyzer.isConnected(),
    isCorsBlocked: audioAnalyzer.isCorsBlocked(),
  };
}

/**
 * Simplified hook that only returns volume and peak for performance
 * Uses refs to avoid rerenders - consumers should use useFrame or similar
 */
export function useAudioVolume(enabled: boolean = true) {
  const volumeRef = useRef(0);
  const peakRef = useRef(false);

  const [volume, setVolume] = useState(0);
  const [peak, setPeak] = useState(false);

  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);

  const FRAME_INTERVAL = 1000 / 30;

  useEffect(() => {
    if (!enabled) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      setVolume(0);
      setPeak(false);
      return;
    }

    const update = (timestamp: number) => {
      const elapsed = timestamp - lastUpdateRef.current;
      if (elapsed >= FRAME_INTERVAL && audioAnalyzer.isConnected()) {
        lastUpdateRef.current = timestamp - (elapsed % FRAME_INTERVAL);

        const data = audioAnalyzer.getAnalysis();
        volumeRef.current = data.volume;
        peakRef.current = data.peak;

        if (
          Math.abs(data.volume - volume) > 0.02 ||
          data.peak !== peak
        ) {
          setVolume(data.volume);
          setPeak(data.peak);
        }
      }

      animationRef.current = requestAnimationFrame(update);
    };

    animationRef.current = requestAnimationFrame(update);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [enabled, volume, peak, FRAME_INTERVAL]);

  return { volume, peak, volumeRef, peakRef };
}
