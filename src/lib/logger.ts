/**
 * Единая точка логирования: в production без отладочного шума,
 * в development — вывод в консоль как раньше у вызывающих кода.
 */
const isDev = import.meta.env.DEV;

export const logger = {
  warn(message: string, ...args: unknown[]): void {
    if (!isDev) return;
    console.warn(message, ...args);
  },

  error(message: string, ...args: unknown[]): void {
    if (!isDev) return;
    console.error(message, ...args);
  },

  info(message: string, ...args: unknown[]): void {
    if (!isDev) return;
    console.info(message, ...args);
  },
};
