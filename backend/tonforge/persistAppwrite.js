// Сохранение демо-состояния TonForge в Appwrite Storage (единая платформа вместо локального файла).
'use strict';

const { Storage } = require('node-appwrite');
const { Input } = require('node-appwrite/file');
const { createServerClient } = require('../core/appwriteServer');
const {
  BUCKET_TONFORGE_STATE,
  TONFORGE_STATE_FILE_ID,
} = require('../core/constants');
const { logger } = require('../logger');

let _storage;

function storage() {
  if (!_storage) {
    _storage = new Storage(createServerClient());
  }
  return _storage;
}

async function loadTonForgeStateJson() {
  try {
    const buf = await storage().getFileDownload(BUCKET_TONFORGE_STATE, TONFORGE_STATE_FILE_ID);
    const raw = Buffer.from(buf).toString('utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 404) return null;
    logger.warn('TonForge: не удалось загрузить state из Storage', e.message);
    return null;
  }
}

async function saveTonForgeStateJson(state) {
  const payload = JSON.stringify(state);
  const input = Input.fromBuffer(Buffer.from(payload, 'utf8'));
  try {
    await storage().deleteFile(BUCKET_TONFORGE_STATE, TONFORGE_STATE_FILE_ID);
  } catch (e) {
    if (e.code !== 404) logger.warn('TonForge: deleteFile перед сохранением', e.message);
  }
  await storage().createFile(BUCKET_TONFORGE_STATE, TONFORGE_STATE_FILE_ID, input);
}

module.exports = {
  loadTonForgeStateJson,
  saveTonForgeStateJson,
};
