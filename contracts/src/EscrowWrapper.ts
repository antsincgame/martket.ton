/**
 * Manual helpers for Escrow Tact contract (v4 — auto-mint).
 *
 * ВНИМАНИЕ: В v4 init Escrow содержит Cell (licenseContent) и множество
 * полей с Tact-специфичной сериализацией. Правильный способ создать init
 * cell — использовать автогенерированный Tact wrapper из
 * `contracts/build/Escrow_Escrow.ts` (метод `Escrow.fromInit(...)` или
 * `Escrow_init(...)`).
 *
 * Этот файл предоставляет только:
 *   - opcode константы для построения payload'ов
 *   - helper'ы для построения payload Cell'ов (не init!)
 *   - утилиты для сериализации StateInit в base64
 *
 * Если нужно вычислить deterministic escrow address — используй
 * backend/commerce/escrow.ts (computeEscrow), он делает это через
 * автоген wrapper.
 */

import {
  Address,
  beginCell,
  Cell,
  type StateInit,
} from '@ton/core';

// ─── Message opcodes (должны совпадать с escrow.tact message declarations) ─

export const OP_DEPLOY                 = 0x946a98b6;
export const OP_PAY_ESCROW             = 0xd2e5b971;
export const OP_CONFIRM                = 0x45dfb5a1;
export const OP_TIMEOUT_RELEASE        = 0x7f8c9a12;
export const OP_REGISTER_LICENSE       = 0x70e30189;
export const OP_REFUND_ON_BURN         = 0x9b3c2d45;
export const OP_REFUND_IF_NOT_MINTED   = 0x5a8e1f23;

// Outgoing (Escrow шлёт в Collection после PayEscrow)
export const OP_MINT_LICENSE           = 0x6a3aaa14;

// Outgoing (Escrow шлёт seller'у при release) — bounceable wrapper
export const OP_RELEASE_SELLER         = 0x01a2b3c4;

// ─── Escrow state enum ───────────────────────────────────────────────

export const ESCROW_STATE = {
  INIT: 0,
  FUNDED: 1,
  RELEASED: 3,
  REFUNDED: 4,
} as const;

// ─── Gas constants (keep in sync с escrow.tact) ──────────────────────

export const MINT_FORWARD_GAS_NANO = 400_000_000n; // 0.4 TON
export const MINT_GRACE_SEC        = 600;          // 10 минут

// ─── Payload builders ────────────────────────────────────────────────
//
// Эти payload'ы используются на фронте или backend'е для отправки
// сообщений в уже задеплоенный Escrow (через TonConnect или серверный
// wallet). На buyer'а ложится также включить достаточно газа — в
// particular для PayEscrow это amountNano + MINT_FORWARD_GAS.

export function buildPayEscrowPayload(): Cell {
  return beginCell().storeUint(OP_PAY_ESCROW, 32).storeUint(0, 64).endCell();
}

export function buildConfirmDeliveryPayload(): Cell {
  return beginCell().storeUint(OP_CONFIRM, 32).storeUint(0, 64).endCell();
}

export function buildTimeoutReleasePayload(): Cell {
  return beginCell().storeUint(OP_TIMEOUT_RELEASE, 32).storeUint(0, 64).endCell();
}

export function buildRefundIfNotMintedPayload(): Cell {
  return beginCell().storeUint(OP_REFUND_IF_NOT_MINTED, 32).storeUint(0, 64).endCell();
}

/**
 * BuyerBurn — шлётся на LicenseItem (НЕ на Escrow!), но тут для удобства.
 * Используется когда buyer хочет вернуть деньги через burn лицензии.
 */
export function buildBuyerBurnPayload(): Cell {
  return beginCell().storeUint(0x7a1b3c5d, 32).storeUint(0, 64).endCell();
}

// ─── StateInit serialization ─────────────────────────────────────────

/**
 * Сериализует StateInit в base64 строку для использования с TonConnect
 * (поле `stateInit` в TonConnect tx message).
 *
 * StateInit cell format (TL-B):
 *   _ split_depth:(Maybe (## 5))
 *     special:(Maybe TickTock)
 *     code:(Maybe ^Cell)
 *     data:(Maybe ^Cell)
 *     library:(HashmapE 256 SimpleLib) = StateInit;
 */
export function stateInitToBase64(init: StateInit): string {
  const builder = beginCell()
    .storeBit(false)  // split_depth = None
    .storeBit(false); // special = None

  if (init.code) {
    builder.storeBit(true).storeRef(init.code);
  } else {
    builder.storeBit(false);
  }

  if (init.data) {
    builder.storeBit(true).storeRef(init.data);
  } else {
    builder.storeBit(false);
  }

  builder.storeBit(false); // library = empty

  return builder.endCell().toBoc().toString('base64');
}

/**
 * Re-export Address для консистентности API.
 */
export { Address };
