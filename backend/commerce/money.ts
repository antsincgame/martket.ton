export function tonHumanToNanoRaw(human: string | number): string {
  const s = String(human).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error('INVALID_PRICE');
  const [whole, frac = ''] = s.split('.');
  const frac9 = (frac + '000000000').slice(0, 9);
  const nano = BigInt(whole!) * 1_000_000_000n + BigInt(frac9 || '0');
  return nano.toString();
}

export function applyFeeBps(amountRawStr: string, bps: number): string {
  const amount = BigInt(amountRawStr);
  const fee = Math.max(0, Math.min(10000, Number(bps)));
  const net = (amount * BigInt(10000 - fee)) / 10000n;
  return net.toString();
}

export function nanoRawToTonHuman(amountRawStr: string): string {
  const v = BigInt(amountRawStr);
  const whole = v / 1_000_000_000n;
  const frac = v % 1_000_000_000n;
  const fracStr = frac.toString().padStart(9, '0').replace(/0+$/, '');
  return fracStr.length ? `${whole}.${fracStr}` : whole.toString();
}

export function jettonHumanToRaw(human: string | number, decimals: number): string {
  const d = Math.min(18, Math.max(0, decimals || 0));
  const s = String(human).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error('INVALID_JETTON_PRICE');
  const [w, frac = ''] = s.split('.');
  const fracPad = (frac + '0'.repeat(d)).slice(0, d);
  const whole = BigInt(w!);
  const part = BigInt(fracPad || '0');
  const mult = BigInt(10) ** BigInt(d);
  return (whole * mult + part).toString();
}
