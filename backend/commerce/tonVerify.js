'use strict';

const { Address } = require('@ton/core');

function normalizeAddr(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return Address.parse(raw);
  } catch {
    return null;
  }
}

function addressesEqual(a, b) {
  const pa = normalizeAddr(a);
  const pb = normalizeAddr(b);
  if (pa && pb) return pa.equals(pb);
  return String(a).trim() === String(b).trim();
}

function extractInMsg(tx) {
  if (!tx || typeof tx !== 'object') return null;
  return tx.in_msg || tx.inMsg || null;
}

function extractComment(msg) {
  if (!msg || typeof msg !== 'object') return '';
  const body = msg.decoded_body || msg.decodedBody || msg.msg_data?.decoded || {};
  if (typeof body.text === 'string') return body.text;
  if (typeof body.comment === 'string') return body.comment;
  if (typeof msg.message_content?.decoded?.text === 'string') return msg.message_content.decoded.text;
  return '';
}

function extractValueNano(msg) {
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

async function fetchTonTransaction(txHash) {
  const base = (process.env.TONAPI_BASE_URL || 'https://tonapi.io').replace(/\/$/, '');
  const key = process.env.TONAPI_KEY || '';
  const url = `${base}/v2/blockchain/transactions/${encodeURIComponent(txHash)}`;
  const headers = {};
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TonAPI ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Проверка нативного перевода TON на treasury.
 * @param {object} params
 * @param {string} params.txHash
 * @param {string} params.treasuryAddress
 * @param {string} params.fromAddress
 * @param {string} params.expectedAmountRaw nano string
 * @param {string} params.expectedMemo
 */
async function verifyNativeTonTransfer(params) {
  const { txHash, treasuryAddress, fromAddress, expectedAmountRaw, expectedMemo } = params;
  const tx = await fetchTonTransaction(txHash);
  const msg = extractInMsg(tx);
  if (!msg) return { ok: false, reason: 'NO_IN_MSG' };

  const dest = msg.destination || msg.destination_address || msg.dest;
  const source = msg.source || msg.source_address || msg.src;
  if (!addressesEqual(dest, treasuryAddress)) return { ok: false, reason: 'DEST_MISMATCH' };
  if (!addressesEqual(source, fromAddress)) return { ok: false, reason: 'SOURCE_MISMATCH' };

  const value = extractValueNano(msg);
  if (value === null) return { ok: false, reason: 'NO_VALUE' };
  const expected = BigInt(expectedAmountRaw);
  if (value < expected) return { ok: false, reason: 'AMOUNT_TOO_LOW', value: value.toString(), expected: expectedAmountRaw };

  const comment = extractComment(msg);
  const memo = String(expectedMemo || '').trim();
  if (memo && String(comment).trim() !== memo) return { ok: false, reason: 'MEMO_MISMATCH', comment, expected: memo };

  return { ok: true };
}

/**
 * Заготовка под jetton: после выпуска токена — разбор transfer из TonAPI по master.
 */
async function verifyJettonTransfer(params) {
  const master = (process.env.COMMERCE_JETTON_MASTER || '').trim();
  if (!master) {
    return { ok: false, reason: 'JETTON_MASTER_NOT_CONFIGURED' };
  }
  void params;
  return { ok: false, reason: 'JETTON_VERIFY_PENDING_IMPLEMENTATION' };
}

async function verifyPaymentForOrder(order, txHash, treasuryAddress) {
  const currency = order.currency || 'TON';
  if (currency === 'JETTON') {
    return verifyJettonTransfer({
      txHash,
      treasuryAddress,
      fromAddress: order.buyerWallet,
      expectedAmountRaw: order.amountRaw,
      expectedMemo: order.memo,
      jettonMaster: order.jettonMaster || '',
    });
  }
  return verifyNativeTonTransfer({
    txHash,
    treasuryAddress,
    fromAddress: order.buyerWallet,
    expectedAmountRaw: order.amountRaw,
    expectedMemo: order.memo,
  });
}

module.exports = {
  verifyNativeTonTransfer,
  verifyJettonTransfer,
  verifyPaymentForOrder,
  fetchTonTransaction,
  addressesEqual,
};
