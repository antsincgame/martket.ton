import { Address } from '@ton/core';
import type { PaymentVerification } from '../domain/types.js';

function normalizeAddr(raw: string | undefined | null): Address | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return Address.parse(raw);
  } catch {
    return null;
  }
}

export function addressesEqual(a: string | undefined, b: string | undefined): boolean {
  const pa = normalizeAddr(a);
  const pb = normalizeAddr(b);
  if (pa && pb) return pa.equals(pb);
  return String(a || '').trim() === String(b || '').trim();
}

interface TonApiMsg {
  destination?: string;
  destination_address?: string;
  dest?: string;
  source?: string;
  source_address?: string;
  src?: string;
  value?: string | number | bigint;
  decoded_body?: { text?: string; comment?: string };
  decodedBody?: { text?: string; comment?: string };
  msg_data?: { decoded?: { text?: string; comment?: string } };
  message_content?: { decoded?: { text?: string } };
}

interface TonApiTx {
  in_msg?: TonApiMsg;
  inMsg?: TonApiMsg;
}

function extractInMsg(tx: TonApiTx | null): TonApiMsg | null {
  if (!tx || typeof tx !== 'object') return null;
  return tx.in_msg || tx.inMsg || null;
}

function extractComment(msg: TonApiMsg | null): string {
  if (!msg || typeof msg !== 'object') return '';
  const body = msg.decoded_body || msg.decodedBody || msg.msg_data?.decoded || {};
  if (typeof body.text === 'string') return body.text;
  if (typeof body.comment === 'string') return body.comment;
  if (typeof msg.message_content?.decoded?.text === 'string') return msg.message_content.decoded.text;
  return '';
}

function extractValueNano(msg: TonApiMsg | null): bigint | null {
  if (!msg || typeof msg !== 'object') return null;
  const v = msg.value;
  if (v === undefined || v === null) return null;
  if (typeof v === 'bigint') return v;
  try {
    return BigInt(v);
  } catch {
    return null;
  }
}

async function fetchTonTransaction(txHash: string): Promise<TonApiTx> {
  const base = (process.env.TONAPI_BASE_URL || 'https://tonapi.io').replace(/\/$/, '');
  const key = process.env.TONAPI_KEY || '';
  const url = `${base}/v2/blockchain/transactions/${encodeURIComponent(txHash)}`;
  const headers: Record<string, string> = {};
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TonAPI ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<TonApiTx>;
}

interface VerifyParams {
  txHash: string;
  treasuryAddress: string;
  fromAddress: string;
  expectedAmountRaw: string;
  expectedMemo: string;
}

export async function verifyNativeTonTransfer(params: VerifyParams): Promise<PaymentVerification> {
  const { txHash, treasuryAddress, fromAddress, expectedAmountRaw, expectedMemo } = params;
  const tx = await fetchTonTransaction(txHash);
  const msg = extractInMsg(tx);
  if (!msg) return { ok: false, reason: 'NO_IN_MSG' };

  const dest = msg.destination || msg.destination_address || msg.dest || '';
  const source = msg.source || msg.source_address || msg.src || '';
  if (!addressesEqual(dest, treasuryAddress)) return { ok: false, reason: 'DEST_MISMATCH' };
  if (!addressesEqual(source, fromAddress)) return { ok: false, reason: 'SOURCE_MISMATCH' };

  const value = extractValueNano(msg);
  if (value === null) return { ok: false, reason: 'NO_VALUE' };
  const expected = BigInt(expectedAmountRaw);
  if (value < expected)
    return { ok: false, reason: 'AMOUNT_TOO_LOW', value: value.toString(), expected: expectedAmountRaw };

  const comment = extractComment(msg);
  const memo = String(expectedMemo || '').trim();
  if (memo && String(comment).trim() !== memo)
    return { ok: false, reason: 'MEMO_MISMATCH', comment, expected: memo };

  return { ok: true };
}

export async function verifyJettonTransfer(_params: VerifyParams): Promise<PaymentVerification> {
  const master = (process.env.COMMERCE_JETTON_MASTER || '').trim();
  if (!master) {
    return { ok: false, reason: 'JETTON_MASTER_NOT_CONFIGURED' };
  }
  return { ok: false, reason: 'JETTON_VERIFY_PENDING_IMPLEMENTATION' };
}

interface OrderLike {
  currency?: string;
  buyerWallet: string;
  amountRaw: string;
  memo: string;
  jettonMaster?: string;
}

export async function verifyPaymentForOrder(
  order: OrderLike,
  txHash: string,
  treasuryAddress: string,
): Promise<PaymentVerification> {
  const currency = order.currency || 'TON';
  const params: VerifyParams = {
    txHash,
    treasuryAddress,
    fromAddress: order.buyerWallet,
    expectedAmountRaw: order.amountRaw,
    expectedMemo: order.memo,
  };
  if (currency === 'JETTON') {
    return verifyJettonTransfer(params);
  }
  return verifyNativeTonTransfer(params);
}

export { fetchTonTransaction };
