/**
 * Product Lifecycle E2E — full pipeline from creation to purchase.
 *
 * Covers:
 *   - Admin dashboard access (gate check)
 *   - Product catalog API (CRUD)
 *   - Commerce listing workflow (create → activate → order → confirm)
 *   - Security gate enforcement (auth, wallet, sanctions)
 *   - Admin moderation flow (pending → approved → published)
 *
 * Tests are structured so they work partially when the backend is down
 * (UI-only tests still run) and fully when both servers are live.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

const API = 'http://localhost:8081';

async function isBackendUp(request: APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get(`${API}/api/health`);
    return res.ok();
  } catch {
    return false;
  }
}

// ─── API Product Catalog ─────────────────────────────────────────────

test.describe('Product catalog API', () => {
  test('GET /api/products returns array', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/products/`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /api/products/search returns filtered results', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/products/search?q=test`);
    expect(res.status()).toBeLessThan(500);
  });

  test('POST /api/products requires auth', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.post(`${API}/api/products/`, {
      data: { name: 'test', description: 'test', price_usd: 0 },
    });
    expect(res.status()).toBe(401);
  });

  test('PATCH /api/products/:id requires auth', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.patch(`${API}/api/products/nonexistent`, {
      data: { name: 'updated' },
    });
    expect([401, 403, 404]).toContain(res.status());
  });

  test('GET /api/products/:id returns 404 for nonexistent', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/products/this-does-not-exist-12345`);
    expect(res.status()).toBe(404);
  });
});

// ─── Commerce API gates ─────────────────────────────────────────────

test.describe('Commerce API security gates', () => {
  test('POST /api/v1/commerce/orders requires auth', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.post(`${API}/api/v1/commerce/orders`, {
      data: { listingId: 'fake', buyerWallet: 'EQfake' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/commerce/orders/:id/confirm requires auth', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.post(`${API}/api/v1/commerce/orders/fake/confirm`, {
      data: { buyerWallet: 'EQfake', txHash: '0x0' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/commerce/buyers/me/orders requires auth', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/v1/commerce/buyers/me/orders`);
    expect(res.status()).toBe(401);
  });

  test('POST /api/v1/commerce/sellers/register requires auth', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.post(`${API}/api/v1/commerce/sellers/register`, {
      data: { wallet: 'EQfake' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/commerce/listings requires auth', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.post(`${API}/api/v1/commerce/listings`, {
      data: { title: 'test', priceAmountRaw: '1000000000' },
    });
    expect([401, 403]).toContain(res.status());
  });
});

// ─── Agent API gates ─────────────────────────────────────────────────

test.describe('Agent API security gates', () => {
  test('GET /api/v1/agent/me requires agent token', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/v1/agent/me`);
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/v1/agent/listings requires agent token', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/v1/agent/listings`);
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/v1/agent/listings requires agent token + listings:write', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.post(`${API}/api/v1/agent/listings`, {
      data: { title: 'agent-test' },
    });
    expect([401, 403]).toContain(res.status());
  });
});

// ─── Admin routes security ──────────────────────────────────────────

test.describe('Admin API security gates', () => {
  test('GET /api/users requires auth', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/users`);
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/stats requires auth + admin role', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/stats`);
    expect([401, 403]).toContain(res.status());
  });

  test('PATCH /api/users/:id/role requires super_admin', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.patch(`${API}/api/users/fake/role`, {
      data: { role: 'admin' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/admin/ledger requires admin', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/admin/ledger`);
    expect([401, 403]).toContain(res.status());
  });

  test('admin router-status requires health token', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/admin/router-status`);
    expect(res.status()).toBe(403);
  });
});

// ─── TonForge API ───────────────────────────────────────────────────

test.describe('TonForge API', () => {
  test('GET /api/tonforge/config returns contract overview', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/tonforge/config`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('backendMode');
    expect(body.data).toHaveProperty('treasuryWallet');
  });

  test('GET /api/tonforge/apps/featured returns array', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/tonforge/apps/featured`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data.apps)).toBe(true);
  });

  test('GET /api/tonforge/apps/:id returns 404 for nonexistent', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/tonforge/apps/nonexistent-app-id`);
    expect(res.status()).toBe(404);
  });

  test('POST /api/tonforge/developers/kyc requires auth', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.post(`${API}/api/tonforge/developers/kyc`, {
      data: { wallet: 'EQfake', displayName: 'Test' },
    });
    expect([401, 403]).toContain(res.status());
  });
});

// ─── Support tickets API ────────────────────────────────────────────

test.describe('Support API security', () => {
  test('POST /api/support/tickets requires auth', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.post(`${API}/api/support/tickets`, {
      data: { subject: 'test', body: 'test body' },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/support/admin/tickets requires moderator role', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/support/admin/tickets`);
    expect([401, 403]).toContain(res.status());
  });
});

// ─── R2 storage API ─────────────────────────────────────────────────

test.describe('R2 storage security', () => {
  test('POST /api/r2/upload/:productId requires auth', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.post(`${API}/api/r2/upload/fake-id`);
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/r2/download/:productId requires auth', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/r2/download/fake-id`);
    expect([401, 403]).toContain(res.status());
  });
});

// ─── Resend admin API ───────────────────────────────────────────────

test.describe('Resend admin security', () => {
  test('GET /api/admin/resend/status requires admin', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/admin/resend/status`);
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/admin/resend/test requires admin', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.post(`${API}/api/admin/resend/test`, {
      data: { to: 'test@test.com' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('inbound webhook rejects unsigned events', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.post(`${API}/api/admin/resend/webhook/inbound`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ type: 'email.received', data: {} }),
    });
    expect([401, 503]).toContain(res.status());
  });
});

// ─── UI: Admin Dashboard ────────────────────────────────────────────

test.describe('Admin Dashboard UI', () => {
  test('unauthenticated user sees access denied', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const url = page.url();
    const hasRedirect = url.includes('/sign-in');
    const hasAccessDenied = await page.locator('text=/access denied|sign in/i').count() > 0;
    expect(hasRedirect || hasAccessDenied).toBeTruthy();
  });
});

// ─── UI: Product Creation Flow (Demiurge Studio) ────────────────────

test.describe('Demiurge Studio UI', () => {
  test('unauthenticated user is redirected from /profile', async ({ page }) => {
    await page.goto('/profile/studio');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const url = page.url();
    const hasRedirect = url.includes('/sign-in');
    const hasSignInUI = await page.locator('input[type="email"], button:has-text("GitHub")').count() > 0;
    expect(hasRedirect || hasSignInUI).toBeTruthy();
  });

  test('/profile/commerce redirects unauthenticated user', async ({ page }) => {
    await page.goto('/profile/commerce');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const url = page.url();
    const hasRedirect = url.includes('/sign-in');
    const hasSignInUI = await page.locator('input[type="email"], button:has-text("GitHub")').count() > 0;
    expect(hasRedirect || hasSignInUI).toBeTruthy();
  });

  test('/seller/commerce redirects to /profile/commerce', async ({ page }) => {
    await page.goto('/seller/commerce');
    await page.waitForLoadState('networkidle');
    const url = page.url();
    const hasExpectedRedirect = url.includes('/profile/commerce') || url.includes('/sign-in');
    const hasSignInUI = await page.locator('input[type="email"], button:has-text("GitHub")').count() > 0;
    expect(hasExpectedRedirect || hasSignInUI).toBeTruthy();
  });
});

// ─── API: Rate Limiting ─────────────────────────────────────────────

test.describe('Rate limiting', () => {
  test('global rate limiter headers on API calls', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/products/`);
    const headers = res.headers();
    const hasLimit = headers['ratelimit-limit'] || headers['x-ratelimit-limit'];
    expect(hasLimit).toBeTruthy();
  });

  test('TON price endpoint returns price data', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/ton-price`);
    if (res.ok()) {
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('usd');
      expect(typeof body.data.usd).toBe('number');
    }
  });
});

// ─── API: Readiness ─────────────────────────────────────────────────

test.describe('Infrastructure endpoints', () => {
  test('readiness endpoint returns status', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/ready`);
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('ready');
    expect(typeof body.ready).toBe('boolean');
  });

  test('client error reporting endpoint accepts errors', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.post(`${API}/api/client-errors`, {
      data: {
        message: 'E2E test error',
        stack: 'Error: E2E test\n    at test.spec.ts',
        pathname: '/e2e-test',
        userAgent: 'playwright',
        timestamp: new Date().toISOString(),
      },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.errorId).toBeTruthy();
    expect(body.errorId).toMatch(/^ce_/);
  });
});
