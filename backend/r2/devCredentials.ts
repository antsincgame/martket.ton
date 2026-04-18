/**
 * Per-developer R2 credentials encryption (AES-256-GCM).
 *
 * Demiurges configure their own R2 (or S3-compatible) storage. We never store
 * their accessKeyId/secretAccessKey in plaintext — values are encrypted with
 * STORAGE_ENCRYPTION_KEY (32 bytes hex) before being persisted in Appwrite.
 *
 * Format:
 *   - iv:          12 bytes (random per encryption, hex-encoded for storage)
 *   - tag:         16 bytes (GCM auth tag, hex-encoded)
 *   - ciphertext:  hex-encoded
 *
 * Decryption automatically authenticates via the GCM tag — any tampering
 * with iv, tag, or ciphertext throws an error.
 */

import * as crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

export interface EncryptedRecord {
  iv: string;
  tag: string;
  ciphertext: string;
}

export interface DevR2Credentials {
  accessKeyId: string;
  secretAccessKey: string;
}

let _key: Buffer | null = null;

function loadKey(): Buffer {
  if (_key) return _key;
  const hex = (process.env.STORAGE_ENCRYPTION_KEY || '').trim();
  if (!hex) {
    throw new Error('STORAGE_ENCRYPTION_KEY is required (64 hex chars). Generate via `openssl rand -hex 32`.');
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('STORAGE_ENCRYPTION_KEY must be 64 hex characters (32 bytes).');
  }
  _key = Buffer.from(hex, 'hex');
  if (_key.length !== KEY_BYTES) {
    throw new Error('STORAGE_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  }
  return _key;
}

export function isStorageEncryptionConfigured(): boolean {
  const hex = (process.env.STORAGE_ENCRYPTION_KEY || '').trim();
  return /^[0-9a-fA-F]{64}$/.test(hex);
}

export function encryptCreds(creds: DevR2Credentials): EncryptedRecord {
  const key = loadKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const json = JSON.stringify({ a: creds.accessKeyId, s: creds.secretAccessKey });
  const ciphertext = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };
}

export function decryptCreds(record: EncryptedRecord): DevR2Credentials {
  const key = loadKey();
  if (!record.iv || !record.tag || !record.ciphertext) {
    throw new Error('Encrypted record incomplete (missing iv/tag/ciphertext)');
  }
  const iv = Buffer.from(record.iv, 'hex');
  const tag = Buffer.from(record.tag, 'hex');
  const ciphertext = Buffer.from(record.ciphertext, 'hex');
  if (iv.length !== IV_BYTES) throw new Error('Invalid IV length');
  if (tag.length !== 16) throw new Error('Invalid auth tag length');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  const parsed = JSON.parse(plain) as { a: string; s: string };
  if (typeof parsed.a !== 'string' || typeof parsed.s !== 'string') {
    throw new Error('Decrypted payload malformed');
  }
  return { accessKeyId: parsed.a, secretAccessKey: parsed.s };
}
