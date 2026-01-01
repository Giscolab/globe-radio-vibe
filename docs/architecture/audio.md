# Audio architecture (invariants)

- `audioEngine` is the single source of truth for playback state.
- Stores mirror `audioEngine` state; they never drive playback.
- A stream is never interrupted without a valid fallback candidate.
- Proxy ➜ direct switch happens only when `needsProxy === false`.
- If a direct switch fails, we roll back to the last proxy URL.
- Only one playback transition can run at a time.
- Retries are allowed only inside the engine retry policy.
- UI components may call `play/pause/stop/toggle` only.
- UI must not call `tryPlayUrl` or mutate engine internals.
- AI can suggest stations but never trigger playback directly.
- History entries are written to DB first, then reflected in store/UI.
