const logger = {
  info: (...args) => {
    const timestamp = new Date().toISOString();
    console.info(`[${timestamp}] [INFO]`, ...args);
  },
  warn: (...args) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN]`, ...args);
  },
  error: (...args) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR]`, ...args);
  },
};

module.exports = { logger };
