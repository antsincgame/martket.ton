// @vitest-environment node
// tweetnacl (via @ton/crypto) checks `instanceof Uint8Array`; under vitest's
// default DOM environment a Node Buffer fails that cross-realm check. Production
// runs in plain Node where Buffer IS a Uint8Array, so pin this spec to node.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { mnemonicNew, mnemonicToWalletKey, sign } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import {
  verifyTonProof,
  issueWalletChallenge,
  verifyWalletChallenge,
  type TonProof,
} from './tonProof.js';

const DOMAIN = 'tonforge.org';

function sha256(buf: Buffer): Buffer {
  return crypto.createHash('sha256').update(buf).digest();
}

/** Build + sign a valid ton_proof for a given wallet key/address. */
function buildSignedProof(opts: {
  secretKey: Buffer;
  address: { workChain: number; hash: Buffer };
  payload: string;
  domain?: string;
  timestamp?: number;
}): TonProof {
  const domain = opts.domain ?? DOMAIN;
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);

  const wc = Buffer.alloc(4);
  wc.writeInt32BE(opts.address.workChain);
  const domainBuf = Buffer.from(domain, 'utf8');
  const domainLen = Buffer.alloc(4);
  domainLen.writeUInt32LE(domainBuf.length);
  const ts = Buffer.alloc(8);
  ts.writeBigUInt64LE(BigInt(timestamp));

  const message = Buffer.concat([
    Buffer.from('ton-proof-item-v2/', 'utf8'),
    wc,
    opts.address.hash,
    domainLen,
    domainBuf,
    ts,
    Buffer.from(opts.payload, 'utf8'),
  ]);
  const fullMessage = Buffer.concat([
    Buffer.from([0xff, 0xff]),
    Buffer.from('ton-connect', 'utf8'),
    sha256(message),
  ]);
  const signature = sign(sha256(fullMessage), opts.secretKey);

  return {
    timestamp,
    domain: { lengthBytes: domainBuf.length, value: domain },
    signature: signature.toString('base64'),
    payload: opts.payload,
  };
}

describe('verifyTonProof', () => {
  it('accepts a correctly-signed fresh proof and binds key↔address', async () => {
    const key = await mnemonicToWalletKey(await mnemonicNew());
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
    const proof = buildSignedProof({
      secretKey: key.secretKey,
      address: { workChain: wallet.address.workChain, hash: wallet.address.hash },
      payload: 'nonce-123',
    });
    const res = verifyTonProof({
      address: wallet.address.toString(),
      publicKey: key.publicKey.toString('hex'),
      proof,
      allowedDomains: [DOMAIN],
    });
    expect(res.ok).toBe(true);
  });

  it('rejects a tampered payload (signature no longer matches)', async () => {
    const key = await mnemonicToWalletKey(await mnemonicNew());
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
    const proof = buildSignedProof({
      secretKey: key.secretKey,
      address: { workChain: wallet.address.workChain, hash: wallet.address.hash },
      payload: 'nonce-123',
    });
    proof.payload = 'nonce-456'; // tamper after signing
    const res = verifyTonProof({
      address: wallet.address.toString(),
      publicKey: key.publicKey.toString('hex'),
      proof,
      allowedDomains: [DOMAIN],
    });
    expect(res).toEqual({ ok: false, reason: 'BAD_SIGNATURE' });
  });

  it("rejects a proof signed by a different key than the address's owner", async () => {
    const victim = await mnemonicToWalletKey(await mnemonicNew());
    const attacker = await mnemonicToWalletKey(await mnemonicNew());
    const victimWallet = WalletContractV4.create({ workchain: 0, publicKey: victim.publicKey });
    // Attacker signs a proof for the victim's address with the attacker's key,
    // and presents the attacker's public key.
    const proof = buildSignedProof({
      secretKey: attacker.secretKey,
      address: { workChain: victimWallet.address.workChain, hash: victimWallet.address.hash },
      payload: 'n',
    });
    const res = verifyTonProof({
      address: victimWallet.address.toString(),
      publicKey: attacker.publicKey.toString('hex'),
      proof,
      allowedDomains: [DOMAIN],
    });
    expect(res).toEqual({ ok: false, reason: 'KEY_ADDRESS_MISMATCH' });
  });

  it('rejects a disallowed domain and a stale timestamp', async () => {
    const key = await mnemonicToWalletKey(await mnemonicNew());
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
    const addr = { workChain: wallet.address.workChain, hash: wallet.address.hash };

    const badDomain = buildSignedProof({ secretKey: key.secretKey, address: addr, payload: 'n', domain: 'evil.com' });
    expect(verifyTonProof({
      address: wallet.address.toString(), publicKey: key.publicKey.toString('hex'),
      proof: badDomain, allowedDomains: [DOMAIN],
    })).toEqual({ ok: false, reason: 'BAD_DOMAIN' });

    const stale = buildSignedProof({
      secretKey: key.secretKey, address: addr, payload: 'n',
      timestamp: Math.floor(Date.now() / 1000) - 3600,
    });
    expect(verifyTonProof({
      address: wallet.address.toString(), publicKey: key.publicKey.toString('hex'),
      proof: stale, allowedDomains: [DOMAIN],
    })).toEqual({ ok: false, reason: 'STALE_PROOF' });
  });
});

describe('wallet challenge nonce', () => {
  const prev = { ...process.env };
  beforeEach(() => { process.env.JWT_SECRET = 'test-secret-key'; });
  afterEach(() => { process.env = { ...prev }; });

  it('round-trips for the same user', () => {
    const nonce = issueWalletChallenge('user-1');
    expect(verifyWalletChallenge(nonce, 'user-1')).toBe(true);
  });

  it('rejects a nonce presented by a different user', () => {
    const nonce = issueWalletChallenge('user-1');
    expect(verifyWalletChallenge(nonce, 'user-2')).toBe(false);
  });

  it('rejects a tampered / malformed nonce', () => {
    expect(verifyWalletChallenge('garbage', 'user-1')).toBe(false);
    const nonce = issueWalletChallenge('user-1');
    expect(verifyWalletChallenge(nonce + 'x', 'user-1')).toBe(false);
  });
});
