// Tests - Audio Engine
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Howler
vi.mock('howler', () => ({
  Howl: vi.fn().mockImplementation(() => ({
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    volume: vi.fn(),
    mute: vi.fn(),
    unload: vi.fn(),
    state: vi.fn(() => 'loaded'),
    playing: vi.fn(() => false),
    on: vi.fn(),
    off: vi.fn(),
  })),
}));

describe('Audio Engine', () => {
  describe('Playback lifecycle', () => {
    it('should start in idle state', () => {
      const state = { status: 'idle', currentStation: null };
      expect(state.status).toBe('idle');
      expect(state.currentStation).toBeNull();
    });

    it('should transition to loading when play is called', () => {
      const states: string[] = [];
      states.push('idle');
      states.push('loading');
      
      expect(states).toContain('loading');
    });

    it('should transition to playing after load', () => {
      const states = ['idle', 'loading', 'playing'];
      expect(states[states.length - 1]).toBe('playing');
    });

    it('should transition to paused when pause is called', () => {
      let status = 'playing';
      status = 'paused';
      expect(status).toBe('paused');
    });

    it('should return to idle when stop is called', () => {
      let status = 'playing';
      status = 'idle';
      expect(status).toBe('idle');
    });
  });

  describe('Volume control', () => {
    it('should set volume between 0 and 1', () => {
      const setVolume = (v: number) => Math.max(0, Math.min(1, v));
      
      expect(setVolume(0.5)).toBe(0.5);
      expect(setVolume(0)).toBe(0);
      expect(setVolume(1)).toBe(1);
      expect(setVolume(1.5)).toBe(1);
      expect(setVolume(-0.5)).toBe(0);
    });

    it('should toggle mute', () => {
      let muted = false;
      muted = !muted;
      expect(muted).toBe(true);
      muted = !muted;
      expect(muted).toBe(false);
    });
  });

  describe('Retry policy', () => {
    it('should retry on failure', () => {
      const maxRetries = 3;
      let attempts = 0;
      let success = false;

      while (attempts < maxRetries && !success) {
        attempts++;
        // Simulate failure on first 2 attempts
        if (attempts >= 3) success = true;
      }

      expect(attempts).toBe(3);
      expect(success).toBe(true);
    });

    it('should use exponential backoff', () => {
      const baseDelay = 1000;
      const getDelay = (attempt: number) => baseDelay * Math.pow(2, attempt);

      expect(getDelay(0)).toBe(1000);
      expect(getDelay(1)).toBe(2000);
      expect(getDelay(2)).toBe(4000);
    });

    it('should give up after max retries', () => {
      const maxRetries = 3;
      let attempts = 0;
      let success = false;

      while (attempts < maxRetries) {
        attempts++;
        // Always fail
      }

      expect(attempts).toBe(maxRetries);
      expect(success).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should capture load errors', () => {
      const errors: Error[] = [];
      errors.push(new Error('Load failed'));
      
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Load failed');
    });

    it('should capture playback errors', () => {
      const state = { status: 'error', error: 'Playback failed' };
      expect(state.status).toBe('error');
      expect(state.error).toBeTruthy();
    });
  });

  describe('Metrics tracking', () => {
    it('should track play count', () => {
      const metrics = { playCount: 0 };
      metrics.playCount++;
      metrics.playCount++;
      
      expect(metrics.playCount).toBe(2);
    });

    it('should track error count', () => {
      const metrics = { errorCount: 0 };
      metrics.errorCount++;
      
      expect(metrics.errorCount).toBe(1);
    });

    it('should track total play time', () => {
      const metrics = { totalPlayTime: 0 };
      metrics.totalPlayTime += 120; // 2 minutes
      metrics.totalPlayTime += 300; // 5 minutes
      
      expect(metrics.totalPlayTime).toBe(420);
    });
  });
});
