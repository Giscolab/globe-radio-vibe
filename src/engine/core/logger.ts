// Engine core - Logger module
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
  timestamp: Date;
}

class Logger {
  private level: LogLevel = 'info';
  private listeners: ((entry: LogEntry) => void)[] = [];

  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  addListener(listener: (entry: LogEntry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx > -1) this.listeners.splice(idx, 1);
    };
  }

  private log(level: LogLevel, module: string, message: string, data?: unknown): void {
    if (this.levelPriority[level] < this.levelPriority[this.level]) {
      return;
    }

    const entry: LogEntry = {
      level,
      module,
      message,
      data,
      timestamp: new Date(),
    };

    // Console output
    const prefix = `[${entry.timestamp.toISOString()}] [${level.toUpperCase()}] [${module}]`;
    switch (level) {
      case 'debug':
        console.debug(prefix, message, data ?? '');
        break;
      case 'info':
        console.info(prefix, message, data ?? '');
        break;
      case 'warn':
        console.warn(prefix, message, data ?? '');
        break;
      case 'error':
        console.error(prefix, message, data ?? '');
        break;
    }

    // Notify listeners
    this.listeners.forEach(l => l(entry));
  }

  createModuleLogger(module: string) {
    return {
      debug: (message: string, data?: unknown) => this.log('debug', module, message, data),
      info: (message: string, data?: unknown) => this.log('info', module, message, data),
      warn: (message: string, data?: unknown) => this.log('warn', module, message, data),
      error: (message: string, data?: unknown) => this.log('error', module, message, data),
    };
  }
}

export const logger = new Logger();
export const createLogger = (module: string) => logger.createModuleLogger(module);
