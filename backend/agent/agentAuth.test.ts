import { describe, it, expect, vi, beforeEach } from 'vitest';

// The agent auth gate is the single highest-risk untested surface: it enforces
// token verification, scope checks, sanctions, KYC gating (+ skipKyc), and rate
// limiting for EVERY agent route. These tests pin those invariants — especially
// that the seller wallet comes from the verified token, never a header/body.

vi.mock('./tokenIssuer.js', () => ({ verifyToken: vi.fn() }));
vi.mock('./tokenRepository.js', () => ({ touchLastUsedAt: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../sanctions/screen.js', () => ({ screenWallet: vi.fn(() => ({ ok: true })) }));
vi.mock('../commerce/handlers/requireSellerKyc.js', () => ({
  requireSellerKyc: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock('../middleware/auth.js', () => ({
  extractBearerToken: (req: { get(n: string): string | undefined }) => {
    const h = req.get('authorization');
    return typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7).trim() : null;
  },
}));

import { apiRequireAgentToken, __resetAgentRateLimitForTesting } from './agentAuth.js';
import { verifyToken } from './tokenIssuer.js';
import { screenWallet } from '../sanctions/screen.js';
import { requireSellerKyc } from '../commerce/handlers/requireSellerKyc.js';

type MockRes = {
  statusCode: number;
  body: { success?: boolean; code?: string; message?: string } | undefined;
  headers: Record<string, string>;
  status(c: number): MockRes;
  json(b: unknown): MockRes;
  setHeader(k: string, v: string): void;
};

function ctx(headers: Record<string, string> = {}, ip = '1.2.3.4') {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const req = { ip, get: (n: string) => lower[n.toLowerCase()] } as unknown as Parameters<
    ReturnType<typeof apiRequireAgentToken>
  >[0];
  const res: MockRes = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b as MockRes['body']; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
  const next = vi.fn();
  return { req, res: res as unknown as Parameters<ReturnType<typeof apiRequireAgentToken>>[1], next, _res: res };
}

const RECORD = {
  $id: 'tok1',
  wallet: 'EQseller',
  scopes: 'listings:read,listings:write', // serializeScopes uses comma-separation
  tokenPrefix: 'tfa_ABCD',
};

const mockVerify = verifyToken as unknown as ReturnType<typeof vi.fn>;
const mockScreen = screenWallet as unknown as ReturnType<typeof vi.fn>;
const mockKyc = requireSellerKyc as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetAgentRateLimitForTesting();
  vi.clearAllMocks();
  mockScreen.mockReturnValue({ ok: true });
  mockKyc.mockResolvedValue({ ok: true });
});

describe('apiRequireAgentToken', () => {
  it('401 NO_AGENT_TOKEN when no token is presented', async () => {
    const { req, res, next, _res } = ctx();
    await apiRequireAgentToken()(req, res, next);
    expect(_res.statusCode).toBe(401);
    expect(_res.body?.code).toBe('NO_AGENT_TOKEN');
    expect(next).not.toHaveBeenCalled();
  });

  it('401 BAD_AGENT_TOKEN on an invalid/expired token', async () => {
    mockVerify.mockResolvedValue(null);
    const { req, res, next, _res } = ctx({ 'x-agent-token': 'tfa_bad' });
    await apiRequireAgentToken()(req, res, next);
    expect(_res.statusCode).toBe(401);
    expect(_res.body?.code).toBe('BAD_AGENT_TOKEN');
  });

  it('passes a valid token and sets req.agent.wallet FROM THE TOKEN, ignoring headers', async () => {
    mockVerify.mockResolvedValue(RECORD);
    const { req, res, next } = ctx({ authorization: 'Bearer tfa_good', 'x-seller-wallet': 'EQattacker' });
    await apiRequireAgentToken(['listings:read'])(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.agent?.wallet).toBe('EQseller'); // never the spoofed header
    expect(req.agent?.tokenId).toBe('tok1');
  });

  it('expands implied scopes (listings:write implies listings:read)', async () => {
    mockVerify.mockResolvedValue({ ...RECORD, scopes: 'listings:write' });
    const { req, res, next } = ctx({ 'x-agent-token': 'tfa_good' });
    await apiRequireAgentToken(['listings:read'])(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('403 SCOPE_FORBIDDEN when a required scope is missing', async () => {
    mockVerify.mockResolvedValue({ ...RECORD, scopes: 'listings:read' });
    const { req, res, next, _res } = ctx({ 'x-agent-token': 'tfa_good' });
    await apiRequireAgentToken(['products:write'])(req, res, next);
    expect(_res.statusCode).toBe(403);
    expect(_res.body?.code).toBe('SCOPE_FORBIDDEN');
    expect(next).not.toHaveBeenCalled();
  });

  it('451 when the token wallet is sanctioned (defence in depth, even with valid scope)', async () => {
    mockVerify.mockResolvedValue(RECORD);
    mockScreen.mockReturnValue({ ok: false, reason: 'OFAC_SDN' });
    const { req, res, next, _res } = ctx({ 'x-agent-token': 'tfa_good' });
    await apiRequireAgentToken(['listings:read'])(req, res, next);
    expect(_res.statusCode).toBe(451);
    expect(_res.body?.code).toBe('OFAC_SDN');
    expect(next).not.toHaveBeenCalled();
  });

  it('403 when KYC is not satisfied (default skipKyc=false)', async () => {
    mockVerify.mockResolvedValue(RECORD);
    mockKyc.mockResolvedValue({ ok: false, status: 403, code: 'KYC_REQUIRED', message: 'KYC required' });
    const { req, res, next, _res } = ctx({ 'x-agent-token': 'tfa_good' });
    await apiRequireAgentToken(['listings:read'])(req, res, next);
    expect(_res.statusCode).toBe(403);
    expect(_res.body?.code).toBe('KYC_REQUIRED');
    expect(next).not.toHaveBeenCalled();
  });

  it('skipKyc lets an un-KYCd wallet through and never calls the KYC gate', async () => {
    mockVerify.mockResolvedValue({ ...RECORD, scopes: 'instructions:read' });
    mockKyc.mockResolvedValue({ ok: false, status: 403, code: 'KYC_REQUIRED' });
    const { req, res, next } = ctx({ 'x-agent-token': 'tfa_good' });
    await apiRequireAgentToken(['instructions:read'], { skipKyc: true })(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(mockKyc).not.toHaveBeenCalled();
  });

  it('skipKyc STILL enforces sanctions (451)', async () => {
    mockVerify.mockResolvedValue({ ...RECORD, scopes: 'instructions:read' });
    mockScreen.mockReturnValue({ ok: false, reason: 'EU_CONSOLIDATED' });
    const { req, res, next, _res } = ctx({ 'x-agent-token': 'tfa_good' });
    await apiRequireAgentToken(['instructions:read'], { skipKyc: true })(req, res, next);
    expect(_res.statusCode).toBe(451);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets X-RateLimit-* headers on a successful request', async () => {
    mockVerify.mockResolvedValue(RECORD);
    const { req, res, next, _res } = ctx({ 'x-agent-token': 'tfa_good' });
    await apiRequireAgentToken(['listings:read'])(req, res, next);
    expect(_res.headers['X-RateLimit-Limit']).toBeDefined();
    expect(_res.headers['X-RateLimit-Remaining']).toBeDefined();
    expect(_res.headers['X-RateLimit-Reset']).toBeDefined();
  });

  it('429 AUTH_RATE_LIMITED after repeated auth failures from one IP', async () => {
    mockVerify.mockResolvedValue(null); // every attempt fails verification
    const ip = '9.9.9.9';
    for (let i = 0; i < 20; i++) {
      const c = ctx({ 'x-agent-token': 'tfa_bad' }, ip);
      await apiRequireAgentToken()(c.req, c.res, c.next);
      expect(c._res.statusCode).toBe(401);
    }
    const c = ctx({ 'x-agent-token': 'tfa_bad' }, ip);
    await apiRequireAgentToken()(c.req, c.res, c.next);
    expect(c._res.statusCode).toBe(429);
    expect(c._res.body?.code).toBe('AUTH_RATE_LIMITED');
  });
});
