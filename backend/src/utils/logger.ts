/**
 * Structured logger utility.
 * Wraps console with timestamps and severity levels for production readability.
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

function formatMessage(level: LogLevel, context: string, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level}] [${context}] ${message}`;
  if (data !== undefined) {
    return `${base} ${JSON.stringify(data)}`;
  }
  return base;
}

export const logger = {
  info(context: string, message: string, data?: unknown): void {
    console.log(formatMessage('INFO', context, message, data));
  },

  warn(context: string, message: string, data?: unknown): void {
    console.warn(formatMessage('WARN', context, message, data));
  },

  error(context: string, message: string, data?: unknown): void {
    console.error(formatMessage('ERROR', context, message, data));
  },

  debug(context: string, message: string, data?: unknown): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('DEBUG', context, message, data));
    }
  },
};
