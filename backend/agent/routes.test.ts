import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// The agent routes' core security invariant: the seller wallet is taken from
// the verified token (req.agent.wallet), NEVER from the request body — anything
// else would let a token holder act as a different seller. These tests mount the
// real router with the auth gate stubbed to inject a controllable agent.

const h = vi.hoisted(() => ({
  agent: {
    tokenId: 'tok1',
    wallet: 'PLACEHOLDER',
    scopes: ['products:write', 'listings:write', 'listings:read', 'distribution:write', 'orders:read'],
    tokenPrefix: 'tfa_ABCD',
  },
}));

vi.mock('./agentAuth.js', () => ({
  apiRequireAgentToken:
    () =>
    (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      (req as unknown as { agent: typeof h.agent }).agent = h.agent;
      next();
    },
}));

const db = {
  getDocument: vi.fn(),
  listDocuments: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
};
vi.mock('../commerce/appwrite.js', () => ({
  databases: () => db,
  ID: { unique: () => 'newid' },
  Query: {
    equal: (...a: unknown[]) => ['equal', ...a],
    limit: (n: number) => ['limit', n],
    orderDesc: (f: string) => ['orderDesc', f],
    orderAsc: (f: string) => ['orderAsc', f],
  },
}));
vi.mock('../core/profileRepository.js', () => ({ findUserByTonAddress: vi.fn() }));
vi.mock('../core/repository.js', () => ({
  insertProduct: vi.fn(),
  productToSnakeCase: (p: unknown) => p,
}));
vi.mock('../commerce/audit.js', () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../commerce/tonPriceOracle.js', () => ({
  getTonUsdPrice: vi.fn().mockResolvedValue(5),
  usdToTonHuman: (usd: number) => String(usd / 5),
}));
vi.mock('../commerce/sellerCollectionRepository.js', () => ({
  findSellerCollection: vi.fn().mockResolvedValue(null),
}));

import agentRouter from './routes.js';
import { findUserByTonAddress } from '../core/profileRepository.js';
import { insertProduct } from '../core/repository.js';
import { findSellerCollection } from '../commerce/sellerCollectionRepository.js';

// Valid TON addresses (pass tonAddressSchema's Address.parse) reused from fixtures.
const SELLER = 'EQAjKFSmQeDWBChuG8huGX3JyeMyf85qZgn64AOQeK0msPHU';
const COLLECTION = 'kQA9mT1B8zY1WnOEbVUrQOL5P9F5pR4wpyhUqT40wAUm1D4-';

const mFind = findUserByTonAddress as unknown as ReturnType<typeof vi.fn>;
const mInsert = insertProduct as unknown as ReturnType<typeof vi.fn>;
const mSellerColl = findSellerCollection as unknown as ReturnType<typeof vi.fn>;

function app() {
  const a = express();
  a.use(express.json());
  a.use(agentRouter);
  return a;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.agent.wallet = SELLER;
  mSellerColl.mockResolvedValue(null); // default: seller has no provisioned collection
});

describe('agent routes — wallet-from-token invariant', () => {
  it('POST /products: creator resolved from the TOKEN wallet, status=draft, body wallet ignored', async () => {
    mFind.mockResolvedValue({ id: 'creator-123' });
    mInsert.mockResolvedValue({ id: 'prod-1', name: 'My Test Product', status: 'draft' });

    const res = await request(app())
      .post('/products')
      .send({ name: 'My Test Product', wallet: 'EQattacker', creator_id: 'EVIL' });

    expect(res.status).toBe(200);
    expect(mFind).toHaveBeenCalledWith(SELLER); // token wallet, never the body
    expect(mInsert).toHaveBeenCalledWith(
      expect.objectContaining({ creator_id: 'creator-123', status: 'draft' }),
    );
  });

  it('POST /products: 409 NO_CREATOR_PROFILE when no catalog profile is linked', async () => {
    mFind.mockResolvedValue(null);
    const res = await request(app()).post('/products').send({ name: 'My Test Product' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NO_CREATOR_PROFILE');
    expect(mInsert).not.toHaveBeenCalled();
  });

  it('POST /listings: sellerWallet forced to the token wallet, spoofed body wallet ignored', async () => {
    db.createDocument
      .mockResolvedValueOnce({ $id: 'lst-1', sellerWallet: SELLER, collection_address: COLLECTION })
      .mockResolvedValueOnce({ $id: 'sec-1' });

    const res = await request(app())
      .post('/listings')
      .send({
        catalogProductId: 'cat-1',
        title: 'T',
        priceUsd: 10,
        deliveryType: 'url',
        deliveryPayload: 'https://example.test/build.zip',
        collectionAddress: COLLECTION,
        sellerWallet: 'EQattacker', // omitted by schema + overridden by handler
      });

    expect(res.status).toBe(200);
    const listingPayload = db.createDocument.mock.calls[0][3];
    expect(listingPayload).toEqual(expect.objectContaining({ sellerWallet: SELLER }));
    expect(listingPayload.sellerWallet).not.toBe('EQattacker');
  });

  it('PATCH /listings/:id: 403 NOT_OWNER when the listing belongs to another wallet', async () => {
    db.getDocument.mockResolvedValue({ $id: 'lst-1', sellerWallet: 'EQsomeoneElseWallet' });
    const res = await request(app()).patch('/listings/lst-1').send({ title: 'New' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_OWNER');
    expect(db.updateDocument).not.toHaveBeenCalled();
  });

  it('PATCH /listings/:id: owner can patch their own listing', async () => {
    db.getDocument.mockResolvedValue({ $id: 'lst-1', sellerWallet: SELLER, collection_address: COLLECTION });
    db.updateDocument.mockResolvedValue({ $id: 'lst-1', sellerWallet: SELLER, collection_address: COLLECTION });
    db.listDocuments.mockResolvedValue({ documents: [] });
    const res = await request(app()).patch('/listings/lst-1').send({ title: 'New Title' });
    expect(res.status).toBe(200);
    expect(db.updateDocument).toHaveBeenCalled();
  });
});

describe('agent routes — per-seller collection binding (soft-strict)', () => {
  const listingBody = {
    catalogProductId: 'cat-1',
    title: 'T',
    priceUsd: 10,
    deliveryType: 'url',
    deliveryPayload: 'https://example.test/build.zip',
  };

  it('POST /listings: 403 COLLECTION_MISMATCH when the address is not the seller deployed collection', async () => {
    // Seller already has a deployed collection (SELLER addr); they supply a different one.
    mSellerColl.mockResolvedValue({ status: 'deployed', collectionAddress: SELLER });
    const res = await request(app())
      .post('/listings')
      .send({ ...listingBody, collectionAddress: COLLECTION });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('COLLECTION_MISMATCH');
    expect(db.createDocument).not.toHaveBeenCalled();
  });

  it('POST /listings: allows the seller own deployed collection', async () => {
    mSellerColl.mockResolvedValue({ status: 'deployed', collectionAddress: COLLECTION });
    db.createDocument
      .mockResolvedValueOnce({ $id: 'lst-1', sellerWallet: SELLER, collection_address: COLLECTION })
      .mockResolvedValueOnce({ $id: 'sec-1' });
    const res = await request(app())
      .post('/listings')
      .send({ ...listingBody, collectionAddress: COLLECTION });
    expect(res.status).toBe(200);
  });

  it('POST /listings: allows any collection when the seller has no provisioned one (back-compat)', async () => {
    mSellerColl.mockResolvedValue(null);
    db.createDocument
      .mockResolvedValueOnce({ $id: 'lst-1', sellerWallet: SELLER, collection_address: COLLECTION })
      .mockResolvedValueOnce({ $id: 'sec-1' });
    const res = await request(app())
      .post('/listings')
      .send({ ...listingBody, collectionAddress: COLLECTION });
    expect(res.status).toBe(200);
  });

  it('POST /listings: a non-deployed (pending) registry row does not block (manual / re-provision)', async () => {
    mSellerColl.mockResolvedValue({ status: 'pending', collectionAddress: SELLER });
    db.createDocument
      .mockResolvedValueOnce({ $id: 'lst-1' })
      .mockResolvedValueOnce({ $id: 'sec-1' });
    const res = await request(app())
      .post('/listings')
      .send({ ...listingBody, collectionAddress: COLLECTION });
    expect(res.status).toBe(200);
  });

  it('PATCH /listings/:id: 403 COLLECTION_MISMATCH on a foreign collection for an owned listing', async () => {
    db.getDocument.mockResolvedValue({ $id: 'lst-1', sellerWallet: SELLER, collection_address: SELLER });
    mSellerColl.mockResolvedValue({ status: 'deployed', collectionAddress: SELLER });
    const res = await request(app()).patch('/listings/lst-1').send({ collectionAddress: COLLECTION });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('COLLECTION_MISMATCH');
    expect(db.updateDocument).not.toHaveBeenCalled();
  });
});
