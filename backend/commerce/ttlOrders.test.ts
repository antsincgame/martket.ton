import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock Appwrite client модуль перед импортом тестируемого кода.
// databases() возвращает объект с listDocuments + updateDocument — мы их подменим per-test.
const mockListDocuments = vi.fn();
const mockUpdateDocument = vi.fn();

vi.mock('./appwrite.js', () => ({
  databases: () => ({
    listDocuments: mockListDocuments,
    updateDocument: mockUpdateDocument,
  }),
  Query: {
    equal: (field: string, value: unknown) => `equal(${field},${String(value)})`,
    lessThan: (field: string, value: unknown) => `lessThan(${field},${String(value)})`,
    limit: (n: number) => `limit(${n})`,
  },
  ID: { unique: () => 'test-id' },
}));

import { expireStalePendingOrders } from './ttlOrders.js';

describe('expireStalePendingOrders', () => {
  beforeEach(() => {
    mockListDocuments.mockReset();
    mockUpdateDocument.mockReset();
    mockUpdateDocument.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('cancels stale orders without tonTxHash (unpaid)', async () => {
    mockListDocuments.mockResolvedValueOnce({
      documents: [
        { $id: 'order1', tonTxHash: '' },
        { $id: 'order2', tonTxHash: undefined },
      ],
    });

    const count = await expireStalePendingOrders();

    expect(count).toBe(2);
    expect(mockUpdateDocument).toHaveBeenCalledTimes(2);
    expect(mockUpdateDocument).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'order1',
      { state: 'cancelled' },
    );
    expect(mockUpdateDocument).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'order2',
      { state: 'cancelled' },
    );
  });

  it('protects v4 orders with tonTxHash from cancellation (awaiting mint worker)', async () => {
    mockListDocuments.mockResolvedValueOnce({
      documents: [
        { $id: 'paid_order', tonTxHash: 'abc123def456' },
        { $id: 'paid_order_with_whitespace', tonTxHash: '  realhash  ' },
      ],
    });

    const count = await expireStalePendingOrders();

    // Оба orders защищены — ни один не отменён
    expect(count).toBe(0);
    expect(mockUpdateDocument).not.toHaveBeenCalled();
  });

  it('cancels only unpaid, skips paid in mixed batch', async () => {
    mockListDocuments.mockResolvedValueOnce({
      documents: [
        { $id: 'unpaid_1', tonTxHash: '' },
        { $id: 'paid_1', tonTxHash: 'hashA' },
        { $id: 'unpaid_2', tonTxHash: '' },
        { $id: 'paid_2', tonTxHash: 'hashB' },
      ],
    });

    const count = await expireStalePendingOrders();

    expect(count).toBe(2);
    expect(mockUpdateDocument).toHaveBeenCalledTimes(2);
    // Только unpaid отменены
    const cancelledIds = mockUpdateDocument.mock.calls.map((call) => call[2]);
    expect(cancelledIds).toContain('unpaid_1');
    expect(cancelledIds).toContain('unpaid_2');
    expect(cancelledIds).not.toContain('paid_1');
    expect(cancelledIds).not.toContain('paid_2');
  });

  it('returns 0 when no stale orders', async () => {
    mockListDocuments.mockResolvedValueOnce({ documents: [] });

    const count = await expireStalePendingOrders();

    expect(count).toBe(0);
    expect(mockUpdateDocument).not.toHaveBeenCalled();
  });

  it('continues processing after single updateDocument failure', async () => {
    mockListDocuments.mockResolvedValueOnce({
      documents: [
        { $id: 'order_a', tonTxHash: '' },
        { $id: 'order_b', tonTxHash: '' },
      ],
    });
    mockUpdateDocument
      .mockRejectedValueOnce(new Error('Appwrite 503'))
      .mockResolvedValueOnce({});

    const count = await expireStalePendingOrders();

    // Только второй успешный update учитывается в counter
    expect(count).toBe(1);
    expect(mockUpdateDocument).toHaveBeenCalledTimes(2);
  });

  it('honors custom ttlMs parameter', async () => {
    mockListDocuments.mockResolvedValueOnce({ documents: [] });

    const customTtl = 60 * 1000; // 1 minute
    await expireStalePendingOrders(customTtl);

    // Первый аргумент listDocuments — DATABASE_ID, третий — queries array
    expect(mockListDocuments).toHaveBeenCalledTimes(1);
    const callArgs = mockListDocuments.mock.calls[0];
    const queries = callArgs?.[2] as string[];
    // lessThan query с cutoff должен быть в queries
    const lessThanQuery = queries?.find((q) => q.startsWith('lessThan($createdAt,'));
    expect(lessThanQuery).toBeDefined();
  });
});
