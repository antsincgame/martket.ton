import { describe, expect, it, vi, beforeEach } from 'vitest';

const getDocument = vi.fn();
const updateDocument = vi.fn();

vi.mock('../appwrite.js', () => ({
  databases: () => ({ getDocument, updateDocument }),
}));

import { finalizeOrderRefund } from './finalizeOrderRefund.js';
import { ORDER_STATE } from '../constants.js';

beforeEach(() => {
  getDocument.mockReset();
  updateDocument.mockReset();
});

describe('finalizeOrderRefund', () => {
  it('moves a pending order to refunded', async () => {
    getDocument.mockResolvedValue({ $id: 'o1', state: ORDER_STATE.PENDING_PAYMENT });
    await finalizeOrderRefund('o1');
    expect(updateDocument).toHaveBeenCalledTimes(1);
    expect(updateDocument).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'o1', {
      state: ORDER_STATE.REFUNDED,
    });
  });

  it('is a no-op when the order is already terminal', async () => {
    for (const s of [ORDER_STATE.REFUNDED, ORDER_STATE.PAID, ORDER_STATE.FULFILLED, ORDER_STATE.CANCELLED]) {
      getDocument.mockResolvedValue({ $id: 'o1', state: s });
      await finalizeOrderRefund('o1');
    }
    expect(updateDocument).not.toHaveBeenCalled();
  });

  it('is a no-op when the order is missing (getDocument throws)', async () => {
    getDocument.mockRejectedValue(new Error('not found'));
    await finalizeOrderRefund('missing');
    expect(updateDocument).not.toHaveBeenCalled();
  });

  it('does nothing for an empty orderId', async () => {
    await finalizeOrderRefund('');
    expect(getDocument).not.toHaveBeenCalled();
    expect(updateDocument).not.toHaveBeenCalled();
  });
});
