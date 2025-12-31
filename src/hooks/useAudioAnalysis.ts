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
  
  // Frame interval for throttling
  const frameInterval = 1000 / fps;
  
  // Animation loop
  const updateAnalysis = useCallback((timestamp: number) => {
    if (!enabled) {
      animationRef.current = null;
      return;
    }
    
    // Throttle updates based on target FPS
    const elapsed = timestamp - lastUpdateRef.current;
    if (elapsed >= frameInterval) {
      lastUpdateRef.current = timestamp - (elapsed % frameInterval);
      
      if (audioAnalyzer.isConnected()) {
        const data = audioAnalyzer.getAnalysis();
        setAnalysis(data);
      }
    }
    
    animationRef.current = requestAnimationFrame(updateAnalysis);
  }, [enabled, frameInterval]);
  
  // Start/stop animation loop
  useEffect(() => {
    if (enabled) {
      animationRef.current = requestAnimationFrame(updateAnalysis);
    }
    
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [enabled, updateAnalysis]);
  
  // Subscribe to silence events
  useEffect(() => {
    const unsubscribe = audioAnalyzer.onSilence(setIsSilent);
    return unsubscribe;
  }, []);
  
  return {
    ...analysis,
    isSilent,
    isConnected: audioAnalyzer.isConnected(),
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
  
  // Throttle to 30 FPS for performance
  const FRAME_INTERVAL = 1000 / 30;
  
  useEffect(() => {
    if (!enabled) {
      volumeRef.current = 0;
      peakRef.current = false;
      setVolume(0);
      setPeak(false);
      return;
    }
    
    const update = (timestamp: number) => {
      const elapsed = timestamp - lastUpdateRef.current;
      
      if (elapsed >= FRAME_INTERVAL) {
        lastUpdateRef.current = timestamp - (elapsed % FRAME_INTERVAL);
        
        if (audioAnalyzer.isConnected()) {
          const data = audioAnalyzer.getAnalysis();
          volumeRef.current = data.volume;
          peakRef.current = data.peak;
          
          // Only update state if values changed significantly
          if (Math.abs(data.volume - volume) > 0.02 || data.peak !== peak) {
            setVolume(data.volume);
            setPeak(data.peak);
          }
        }
      }
      
      animationRef.current = requestAnimationFrame(update);
    };
    
    animationRef.current = requestAnimationFrame(update);
    
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled]);
  
  return { volume, peak, volumeRef, peakRef };
}
