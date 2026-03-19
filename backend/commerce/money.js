'use strict';

/** priceTonHuman: строка вида "15.5" → nanoTON BigInt строка */
function tonHumanToNanoRaw(human) {
  const s = String(human).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error('INVALID_PRICE');
  const [whole, frac = ''] = s.split('.');
  const frac9 = (frac + '000000000').slice(0, 9);
  const nano = BigInt(whole) * 1_000_000_000n + BigInt(frac9 || '0');
  return nano.toString();
}

function applyFeeBps(amountRawStr, bps) {
  const amount = BigInt(amountRawStr);
  const fee = Math.max(0, Math.min(10000, Number(bps)));
  const net = (amount * BigInt(10000 - fee)) / 10000n;
  return net.toString();
}

function nanoRawToTonHuman(amountRawStr) {
  const v = BigInt(amountRawStr);
  const whole = v / 1_000_000_000n;
  const frac = v % 1_000_000_000n;
  const fracStr = frac.toString().padStart(9, '0').replace(/0+$/, '');
  return fracStr.length ? `${whole}.${fracStr}` : whole.toString();
}

module.exports = {
  tonHumanToNanoRaw,
  applyFeeBps,
  nanoRawToTonHuman,
};
