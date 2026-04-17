export interface Logger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

const IS_PROD = process.env.NODE_ENV === 'production';

function formatStructured(level: string, args: unknown[]): string {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg: args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
  };
  const firstErr = args.find((a): a is Error => a instanceof Error);
  if (firstErr?.stack) entry.stack = firstErr.stack;
  return JSON.stringify(entry);
}

export const logger: Logger = {
  info: (...args: unknown[]) => {
    if (IS_PROD) {
      process.stdout.write(formatStructured('info', args) + '\n');
    } else {
      console.info(`[${new Date().toISOString()}] [INFO]`, ...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (IS_PROD) {
      process.stdout.write(formatStructured('warn', args) + '\n');
    } else {
      console.warn(`[${new Date().toISOString()}] [WARN]`, ...args);
    }
  },
  error: (...args: unknown[]) => {
    if (IS_PROD) {
      process.stderr.write(formatStructured('error', args) + '\n');
    } else {
      console.error(`[${new Date().toISOString()}] [ERROR]`, ...args);
    }
  },
};
