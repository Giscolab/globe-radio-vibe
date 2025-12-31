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
    ...state,
    play,
    pause,
    resume,
    stop,
    toggle,
    setVolume,
    toggleMute,
  };
}
