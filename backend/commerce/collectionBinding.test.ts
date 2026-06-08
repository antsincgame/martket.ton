import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('./sellerCollectionRepository.js', () => ({ findSellerCollection: vi.fn() }));

import { rejectMismatchedCollection } from './collectionBinding.js';
import { findSellerCollection } from './sellerCollectionRepository.js';

// Two distinct, parseable TON addresses (addressesEqual is the real impl).
const OWN = 'kQA9mT1B8zY1WnOEbVUrQOL5P9F5pR4wpyhUqT40wAUm1D4-';
const OTHER = 'EQAjKFSmQeDWBChuG8huGX3JyeMyf85qZgn64AOQeK0msPHU';
const WALLET = OTHER;

const mFind = findSellerCollection as unknown as ReturnType<typeof vi.fn>;

function harness() {
  const state = { status: 0, body: null as unknown };
  const req = { get: () => undefined, query: {} } as unknown as Request;
  const res = {
    status(code: number) { state.status = code; return res; },
    json(body: unknown) { state.body = body; return res; },
  } as unknown as Response;
  return { req, res, state };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('rejectMismatchedCollection — soft-strict per-seller binding', () => {
  it('allows (false) when the seller has no provisioned collection', async () => {
    mFind.mockResolvedValue(null);
    const { req, res, state } = harness();
    expect(await rejectMismatchedCollection(req, res, WALLET, OWN)).toBe(false);
    expect(state.status).toBe(0);
  });

  it('allows (false) when the supplied address equals the deployed collection', async () => {
    mFind.mockResolvedValue({ status: 'deployed', collectionAddress: OWN });
    const { req, res, state } = harness();
    expect(await rejectMismatchedCollection(req, res, WALLET, OWN)).toBe(false);
    expect(state.status).toBe(0);
  });

  it('rejects (403 COLLECTION_MISMATCH) when the address is not the deployed collection', async () => {
    mFind.mockResolvedValue({ status: 'deployed', collectionAddress: OWN });
    const { req, res, state } = harness();
    expect(await rejectMismatchedCollection(req, res, WALLET, OTHER)).toBe(true);
    expect(state.status).toBe(403);
    expect((state.body as { code: string }).code).toBe('COLLECTION_MISMATCH');
  });

  it('does not enforce a non-deployed (pending) registry row', async () => {
    mFind.mockResolvedValue({ status: 'pending', collectionAddress: OWN });
    const { req, res, state } = harness();
    expect(await rejectMismatchedCollection(req, res, WALLET, OTHER)).toBe(false);
    expect(state.status).toBe(0);
  });

  it('fails open (false) when the registry lookup throws', async () => {
    mFind.mockRejectedValue(new Error('appwrite down'));
    const { req, res, state } = harness();
    expect(await rejectMismatchedCollection(req, res, WALLET, OTHER)).toBe(false);
    expect(state.status).toBe(0);
  });
});
