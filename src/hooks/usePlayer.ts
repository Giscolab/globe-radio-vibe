// Hook - usePlayer: manage audio playback state
import { useEffect, useState, useCallback } from 'react';
import { audioEngine, AudioEngineState } from '@/engine/player/audioEngine';
import { onStationPlay } from '@/engine/radio/stationService';
import { Station } from '@/engine/types/radio';

export function usePlayer() {
  const [state, setState] = useState<AudioEngineState>(audioEngine.getState());

  useEffect(() => {
    return audioEngine.subscribe(setState);
  }, []);

  const play = useCallback(async (station: Station) => {
    await audioEngine.play(station);
    onStationPlay(station.id);
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
    // Core state
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
    // Actions
    play,
    pause,
    resume,
    stop,
    toggle,
    setVolume,
    toggleMute,
  };
}
