/**
 * TON Connect `ton_proof` verification (H-8).
 *
 * Binding a wallet to an account previously trusted a bare `ton_address` string
 * in PATCH /session/profile — any logged-in user could claim a wallet they do
 * NOT control (as long as it wasn't already linked), then pass requireWalletOwner
 * for it: view that wallet's orders, and download goods its true owner bought.
 *
 * This module verifies a TON Connect ton_proof (the standard wallet-ownership
 * signature) so a wallet can only be linked by whoever holds its private key.
 *
 * Verification (ton-proof-item-v2):
 *   message      = "ton-proof-item-v2/" ‖ wc(int32 BE) ‖ addrHash(32) ‖
 *                  domainLen(uint32 LE) ‖ domain ‖ ts(uint64 LE) ‖ payload
 *   fullMessage  = 0xffff ‖ "ton-connect" ‖ sha256(message)
 *   verify ed25519(signature, sha256(fullMessage), publicKey)
 *
 * The public key is bound to the claimed address by reconstructing the standard
 * wallet addresses (v4r2 / v3r2 / v5r1) from the public key and requiring one to
 * equal the address — so a valid signature from an unrelated key is rejected.
 */

import crypto from 'crypto';
import { Address } from '@ton/core';
import { signVerify } from '@ton/crypto';
import { WalletContractV4, WalletContractV3R2, WalletContractV5R1 } from '@ton/ton';

export interface TonProof {
  timestamp: number; // unix seconds (wallet-reported)
  domain: { lengthBytes: number; value: string };
  signature: string; // base64
  payload: string; // our challenge nonce, echoed back by the wallet
}

export interface VerifyTonProofInput {
  address: string; // claimed wallet address (any format)
  publicKey: string; // hex, wallet-reported
  proof: TonProof;
  allowedDomains: string[]; // e.g. ['tonforge.org']
  /** Max age of the proof timestamp, seconds (default 15 min). */
  maxAgeSec?: number;
}

function sha256(buf: Buffer): Buffer {
  return crypto.createHash('sha256').update(buf).digest();
}

/** Reconstruct standard wallet addresses from a public key and check the claim. */
function publicKeyMatchesAddress(publicKeyHex: string, claimed: Address): boolean {
  let publicKey: Buffer;
  try {
    publicKey = Buffer.from(publicKeyHex, 'hex');
  } catch {
    return false;
  }
  if (publicKey.length !== 32) return false;
  const candidates = [
    WalletContractV4.create({ workchain: claimed.workChain, publicKey }),
    WalletContractV3R2.create({ workchain: claimed.workChain, publicKey }),
    WalletContractV5R1.create({ workchain: claimed.workChain, publicKey }),
  ];
  return candidates.some((w) => w.address.equals(claimed));
}

export function verifyTonProof(input: VerifyTonProofInput): { ok: true } | { ok: false; reason: string } {
  const maxAge = input.maxAgeSec ?? 15 * 60;

  let address: Address;
  try {
    address = Address.parse(input.address);
  } catch {
    return { ok: false, reason: 'BAD_ADDRESS' };
  }

  // 1. Freshness.
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(input.proof.timestamp) || Math.abs(now - input.proof.timestamp) > maxAge) {
    return { ok: false, reason: 'STALE_PROOF' };
  }

  // 2. Domain allow-list (prevents a proof minted for another site being replayed).
  if (!input.allowedDomains.includes(input.proof.domain.value)) {
    return { ok: false, reason: 'BAD_DOMAIN' };
  }

  // 3. Public key actually owns the claimed address.
  if (!publicKeyMatchesAddress(input.publicKey, address)) {
    return { ok: false, reason: 'KEY_ADDRESS_MISMATCH' };
  }

  // 4. Reconstruct the signed message and verify the ed25519 signature.
  const wc = Buffer.alloc(4);
  wc.writeInt32BE(address.workChain);

  const domainBuf = Buffer.from(input.proof.domain.value, 'utf8');
  const domainLen = Buffer.alloc(4);
  domainLen.writeUInt32LE(domainBuf.length);

  const ts = Buffer.alloc(8);
  ts.writeBigUInt64LE(BigInt(input.proof.timestamp));

  const message = Buffer.concat([
    Buffer.from('ton-proof-item-v2/', 'utf8'),
    wc,
    address.hash,
    domainLen,
    domainBuf,
    ts,
    Buffer.from(input.proof.payload, 'utf8'),
  ]);

  const fullMessage = Buffer.concat([
    Buffer.from([0xff, 0xff]),
    Buffer.from('ton-connect', 'utf8'),
    sha256(message),
  ]);
  const signedHash = sha256(fullMessage);

  let signature: Buffer;
  try {
    signature = Buffer.from(input.proof.signature, 'base64');
  } catch {
    return { ok: false, reason: 'BAD_SIGNATURE_ENCODING' };
  }

  const publicKey = Buffer.from(input.publicKey, 'hex');
  if (!signVerify(signedHash, signature, publicKey)) {
    return { ok: false, reason: 'BAD_SIGNATURE' };
  }
  return { ok: true };
}

// ─── Stateless challenge nonce ───────────────────────────────────────
//
// The wallet signs whatever `payload` we hand it. We issue a short-lived nonce
// bound to the authenticated user id and HMAC-signed, so it needs no server
// state and can't be forged or replayed after expiry / by another user.

const CHALLENGE_TTL_SEC = 10 * 60;

function challengeSecret(): string {
  // Reuse JWT_SECRET as the HMAC key (already required + high-entropy in prod).
  return (process.env.JWT_SECRET || '').trim();
}

export function issueWalletChallenge(userId: string): string {
  const secret = challengeSecret();
  if (!secret) throw new Error('JWT_SECRET not configured');
  const rand = crypto.randomBytes(16).toString('hex');
  const exp = Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SEC;
  const body = `${rand}.${exp}.${userId}`;
  const mac = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return `${rand}.${exp}.${mac}`;
}

export function verifyWalletChallenge(payload: string, userId: string): boolean {
  const secret = challengeSecret();
  if (!secret) return false;
  const parts = payload.split('.');
  if (parts.length !== 3) return false;
  const [rand, expStr, mac] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${rand}.${expStr}.${userId}`).digest('hex');
  // Compare the hex STRINGS (utf8 bytes) so a trailing junk char — which
  // Buffer.from(_, 'hex') would silently drop — still fails on a length mismatch.
  const a = Buffer.from(mac ?? '', 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
