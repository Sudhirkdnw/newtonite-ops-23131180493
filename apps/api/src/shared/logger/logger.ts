export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'jwt',
  'secret',
  'authorization',
  'cookie',
  'set-cookie',
  'apikey',
  'creditcard',
  'cardnumber',
]);

function redactSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(redactSensitiveData);
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = redactSensitiveData(value);
      }
    }
    return sanitized;
  }

  return data;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = 'info') {
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  private write(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...(metadata ? (redactSensitiveData(metadata) as Record<string, unknown>) : {}),
    };

    const serialized = JSON.stringify(payload);

    if (level === 'error') {
      process.stderr.write(`${serialized}\n`);
    } else {
      process.stdout.write(`${serialized}\n`);
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.write('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.write('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.write('warn', message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.write('error', message, metadata);
  }
}

export const logger = new Logger((process.env.LOG_LEVEL as LogLevel) || 'info');
