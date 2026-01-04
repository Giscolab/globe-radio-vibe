import { useEffect, useState, useCallback, useRef } from 'react';
import { audioEngine, AudioEngineState } from '@/engine/player/audioEngine';
import { onStationPlay } from '@/engine/radio/stationService';
import { Station } from '@/engine/types/radio';

export function usePlayer() {
  const [state, setState] = useState<AudioEngineState>(audioEngine.getState());
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (subscribedRef.current) return;

    const unsubscribe = audioEngine.subscribe(setState);
    subscribedRef.current = true;

    return () => {
      unsubscribe();
      subscribedRef.current = false;
    };
  }, []);

  const play = useCallback(async (station: Station) => {
    try {
      await audioEngine.play(station);
      onStationPlay(station.id);
    } catch (err) {
      console.error('Play failed:', err);
    }
  }, []);

  const pause = useCallback(() => {
    audioEngine.pause();
  }, []);

  const resume = useCallback(() => {
    audioEngine.resume();
  }, []);

  const stop = useCallback(() => {
    audioEngine.stop();
  }, []);

  const toggle = useCallback(() => {
    audioEngine.toggle();
  }, []);

  const setVolume = useCallback((volume: number) => {
    audioEngine.setVolume(volume);
  }, []);

  const toggleMute = useCallback(() => {
    audioEngine.toggleMute();
  }, []);

  return {
    // State
    status: state.status,
    currentStation: state.currentStation,
    volume: state.volume,
    muted: state.muted,
    error: state.error,

    // Diagnostics
    currentUrl: state.currentUrl,
    urlType: state.urlType,
    candidateIndex: state.candidateIndex,
    totalCandidates: state.totalCandidates,

    // Controls
    play,
    pause,
    resume,
    stop,
    toggle,
    setVolume,
    toggleMute,
  };
}
