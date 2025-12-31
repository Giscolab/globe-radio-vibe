// Engine core - Custom error types

export class EngineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'EngineError';
  }
}

export class GeoError extends EngineError {
  constructor(message: string, details?: unknown) {
    super(message, 'GEO_ERROR', details);
    this.name = 'GeoError';
  }
}

export class RadioError extends EngineError {
  constructor(message: string, details?: unknown) {
    super(message, 'RADIO_ERROR', details);
    this.name = 'RadioError';
  }
}

export class StorageError extends EngineError {
  constructor(message: string, details?: unknown) {
    super(message, 'STORAGE_ERROR', details);
    this.name = 'StorageError';
  }
}

export class PlayerError extends EngineError {
  constructor(message: string, details?: unknown) {
    super(message, 'PLAYER_ERROR', details);
    this.name = 'PlayerError';
  }
}

export class NetworkError extends EngineError {
  constructor(message: string, details?: unknown) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends EngineError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}
