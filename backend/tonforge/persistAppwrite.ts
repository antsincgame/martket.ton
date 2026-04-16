import { Storage } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { createServerClient } from '../core/appwriteServer.js';
import { BUCKET_TONFORGE_STATE, TONFORGE_STATE_FILE_ID } from '../core/constants.js';
import { logger } from '../logger.js';
import type { TonForgeState } from '../domain/types.js';

let _storage: Storage | null = null;

function storage(): Storage {
  if (!_storage) {
    _storage = new Storage(createServerClient());
  }
  return _storage;
}

export async function loadTonForgeStateJson(): Promise<TonForgeState | null> {
  try {
    const buf = await storage().getFileDownload(BUCKET_TONFORGE_STATE, TONFORGE_STATE_FILE_ID);
    const raw = Buffer.from(buf).toString('utf8');
    return JSON.parse(raw) as TonForgeState;
  } catch (e: unknown) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code: number }).code : 0;
    if (code === 404) return null;
    const msg = e instanceof Error ? e.message : 'unknown';
    logger.warn('TonForge: не удалось загрузить state из Storage', msg);
    return null;
  }
}

export async function saveTonForgeStateJson(state: TonForgeState): Promise<void> {
  const payload = JSON.stringify(state);
  const input = InputFile.fromBuffer(Buffer.from(payload, 'utf8'), 'tonforge_state.json');
  try {
    await storage().deleteFile(BUCKET_TONFORGE_STATE, TONFORGE_STATE_FILE_ID);
  } catch (e: unknown) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code: number }).code : 0;
    if (code !== 404) {
      const msg = e instanceof Error ? e.message : 'unknown';
      logger.warn('TonForge: deleteFile перед сохранением', msg);
    }
  }
  await storage().createFile(BUCKET_TONFORGE_STATE, TONFORGE_STATE_FILE_ID, input);
}
