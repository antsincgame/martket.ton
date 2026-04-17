import { Address } from '@ton/core';
import type { PaymentVerification } from '../domain/types.js';
import { logger } from '../logger.js';

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

function resolveAddress(field: unknown): string {
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field !== null && 'address' in field) {
    return String((field as Record<string, unknown>).address);
  }
  return '';
}

interface TonApiMsg {
  destination?: unknown;
  destination_address?: string;
  dest?: unknown;
  source?: unknown;
  source_address?: string;
  src?: unknown;
  value?: string | number | bigint;
  decoded_body?: Record<string, unknown>;
  decodedBody?: Record<string, unknown>;
  msg_data?: { decoded?: Record<string, unknown> };
  message_content?: { decoded?: Record<string, unknown> };
}

interface TonApiTx {
  hash?: string;
  in_msg?: TonApiMsg;
  inMsg?: TonApiMsg;
}

function extractInMsg(tx: TonApiTx | null): TonApiMsg | null {
  if (!tx || typeof tx !== 'object') return null;
  return tx.in_msg || tx.inMsg || null;
}

function extractMsgDest(msg: TonApiMsg): string {
  return resolveAddress(msg.destination) || msg.destination_address || resolveAddress(msg.dest) || '';
}

function extractMsgSource(msg: TonApiMsg): string {
  return resolveAddress(msg.source) || msg.source_address || resolveAddress(msg.src) || '';
}

function extractComment(msg: TonApiMsg | null): string {
  if (!msg || typeof msg !== 'object') return '';
  const body = msg.decoded_body || msg.decodedBody || msg.msg_data?.decoded || {};
  if (typeof body === 'object' && body !== null) {
    if (body.type === 'text_comment' && typeof body.value === 'string') return body.value;
    if (typeof body.text === 'string') return body.text;
    if (typeof body.comment === 'string') return body.comment;
  }
  const mc = msg.message_content?.decoded;
  if (mc && typeof mc.text === 'string') return mc.text;
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

export interface TonApiOverrides {
  base?: string;
  key?: string;
}

function tonapiHeaders(overrides?: TonApiOverrides): Record<string, string> {
  const key = overrides?.key ?? process.env.TONAPI_KEY ?? '';
  const h: Record<string, string> = {};
  if (key) h.Authorization = `Bearer ${key}`;
  return h;
}

function tonapiBase(overrides?: TonApiOverrides): string {
  const raw = overrides?.base ?? process.env.TONAPI_BASE_URL ?? 'https://tonapi.io';
  return raw.replace(/\/+$/, '');
}

async function fetchTonTransaction(txHash: string): Promise<TonApiTx> {
  const url = `${tonapiBase()}/v2/blockchain/transactions/${encodeURIComponent(txHash)}`;
  const res = await fetch(url, { headers: tonapiHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TonAPI ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<TonApiTx>;
}

const MEMO_POLL_DELAYS_MS = [0, 5_000, 5_000, 10_000, 10_000];

async function findTransactionByMemo(
  accountAddr: string,
  memo: string,
  apiOverrides?: TonApiOverrides,
): Promise<TonApiTx | null> {
  const base = tonapiBase(apiOverrides);
  const headers = tonapiHeaders(apiOverrides);
  const memoNorm = memo.trim();

  for (let attempt = 0; attempt < MEMO_POLL_DELAYS_MS.length; attempt++) {
    const delay = MEMO_POLL_DELAYS_MS[attempt]!;
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));

    const url = `${base}/v2/blockchain/accounts/${encodeURIComponent(accountAddr)}/transactions?limit=30`;
    let res: Response;
    try {
      res = await fetch(url, { headers });
    } catch (err) {
      logger.warn(`[tonVerify] memo poll attempt ${attempt} network error:`, err instanceof Error ? err.message : err);
      continue;
    }
    if (!res.ok) {
      logger.warn(`[tonVerify] memo poll attempt ${attempt} status ${res.status}`);
      continue;
    }

    const body = (await res.json()) as { transactions?: TonApiTx[] };
    const txs = body.transactions || [];
    for (const tx of txs) {
      const msg = extractInMsg(tx);
      if (!msg) continue;
      const comment = extractComment(msg).trim();
      if (comment === memoNorm) return tx;
    }
  }
  return null;
}

interface VerifyParams {
  txHash: string;
  treasuryAddress: string;
  fromAddress: string;
  expectedAmountRaw: string;
  expectedMemo: string;
}

function verifyMsgFields(
  msg: TonApiMsg,
  treasuryAddress: string,
  fromAddress: string,
  expectedAmountRaw: string,
  expectedMemo: string,
): PaymentVerification {
  const dest = extractMsgDest(msg);
  const source = extractMsgSource(msg);
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

export async function verifyNativeTonTransfer(params: VerifyParams): Promise<PaymentVerification> {
  const { txHash, treasuryAddress, fromAddress, expectedAmountRaw, expectedMemo } = params;
  const tx = await fetchTonTransaction(txHash);
  const msg = extractInMsg(tx);
  if (!msg) return { ok: false, reason: 'NO_IN_MSG' };
  return verifyMsgFields(msg, treasuryAddress, fromAddress, expectedAmountRaw, expectedMemo);
}

export interface MemoVerificationResult extends PaymentVerification {
  txHash?: string;
}

export async function verifyPaymentByMemo(
  treasuryAddress: string,
  order: { buyerWallet: string; amountRaw: string; memo: string },
  apiOverrides?: TonApiOverrides,
): Promise<MemoVerificationResult> {
  const tx = await findTransactionByMemo(treasuryAddress, order.memo, apiOverrides);
  if (!tx) return { ok: false, reason: 'TX_NOT_FOUND_BY_MEMO' };

  const msg = extractInMsg(tx);
  if (!msg) return { ok: false, reason: 'NO_IN_MSG' };

  const result = verifyMsgFields(msg, treasuryAddress, order.buyerWallet, order.amountRaw, order.memo);
  if (!result.ok) return result;

  return { ok: true, txHash: tx.hash || '' };
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
