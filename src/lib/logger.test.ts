import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';

describe('logger', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports warn, error, info methods', () => {
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.info).toBe('function');
  });

  it('logger.warn calls console.warn in dev/test mode', () => {
    logger.warn('test warning', { detail: 1 });
    expect(warnSpy).toHaveBeenCalledWith('test warning', { detail: 1 });
  });

  it('logger.error calls console.error in dev/test mode', () => {
    logger.error('test error');
    expect(errorSpy).toHaveBeenCalledWith('test error');
  });

  it('logger.info calls console.info in dev/test mode', () => {
    logger.info('test info', 'extra');
    expect(infoSpy).toHaveBeenCalledWith('test info', 'extra');
  });

  it('logger.warn accepts multiple arguments', () => {
    logger.warn('msg', 1, 'two', { three: 3 });
    expect(warnSpy).toHaveBeenCalledWith('msg', 1, 'two', { three: 3 });
  });
});
