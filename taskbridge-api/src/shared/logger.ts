/**
 * Minimal structured logger. Never log secrets, tokens, or PII (including IP addresses).
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogRecord {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

function emit(record: LogRecord): void {
  // In production this would go to a log shipper; JSON keeps it structured and greppable.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ...record, timestamp: new Date().toISOString() }));
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>): void =>
    emit({ level: 'info', message, context }),
  warn: (message: string, context?: Record<string, unknown>): void =>
    emit({ level: 'warn', message, context }),
  error: (message: string, context?: Record<string, unknown>): void =>
    emit({ level: 'error', message, context }),
};
