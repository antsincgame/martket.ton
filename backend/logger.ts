export interface Logger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export const logger: Logger = {
  info: (...args: unknown[]) => {
    const timestamp = new Date().toISOString();
    console.info(`[${timestamp}] [INFO]`, ...args);
  },
  warn: (...args: unknown[]) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN]`, ...args);
  },
  error: (...args: unknown[]) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR]`, ...args);
  },
};
