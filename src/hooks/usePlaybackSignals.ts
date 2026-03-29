import { useEffect, useRef } from 'react';
import { audioEngine, type AudioEngineState } from '@/engine/player/audioEngine';
import { getSqliteRepository } from '@/engine/storage/sqlite/stationRepository';
import { aiEngine } from '@/engine/radio/ai';
import { useHistory } from './useHistory';

const SKIP_THRESHOLD_SECONDS = 15;

export function usePlaybackSignals() {
  const { recordPlay } = useHistory();
  const lastStateRef = useRef<AudioEngineState>(audioEngine.getState());
  const playStartRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = audioEngine.subscribe((state) => {
      const previous = lastStateRef.current;

      if (state.status === 'playing' && previous.status !== 'playing') {
        playStartRef.current = Date.now();
      }

      if (previous.status === 'playing' && state.status !== 'playing' && previous.currentStation) {
        const durationMs = playStartRef.current ? Date.now() - playStartRef.current : 0;
        const durationSeconds = Math.max(0, Math.round(durationMs / 1000));

        recordPlay(previous.currentStation, durationSeconds);

        if (durationSeconds > 0 && durationSeconds < SKIP_THRESHOLD_SECONDS) {
          void getSqliteRepository()
            .recordSignal('skip', previous.currentStation.id, { durationSeconds })
            .then(() => {
              aiEngine.invalidateCache();
            })
            .catch((error) => {
              console.warn('Failed to record skip signal:', error);
            });
        }
      }

      if (state.status === 'error' && previous.status !== 'error' && state.currentStation) {
        void getSqliteRepository()
          .recordSignal('error', state.currentStation.id, {
            details: state.error ?? 'Erreur de lecture',
          })
          .then(() => {
            aiEngine.invalidateCache();
          })
          .catch((error) => {
            console.warn('Failed to record error signal:', error);
          });
      }

      lastStateRef.current = state;
    });

    return unsubscribe;
  }, [recordPlay]);
}
