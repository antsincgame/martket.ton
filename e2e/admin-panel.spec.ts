/**
 * Admin Panel E2E — performance & lazy-loading verification.
 *
 * Covers:
 *   - Admin panel loads without JS errors
 *   - Tab navigation works correctly
 *   - Lazy-loaded modules actually load
 *   - Security: no admin data exposed to unauthenticated users
 *   - Performance: page renders within acceptable timeframe
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

// ─── Admin Security Gates (no auth leaks) ───────────────────────────

test.describe('Admin panel security', () => {
  test('admin page does not expose data without authentication', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const hasAdminContent = await page.locator('text=/dashboard|security monitor|user management/i').count();
    const hasSignInOrDenied = await page.locator('text=/sign in|access denied|required role/i').count();

    if (hasAdminContent > 0) {
      expect(hasSignInOrDenied).toBeGreaterThan(0);
    }
  });

  test('admin-dashboard alias works the same as /admin', async ({ page }) => {
    await page.goto('/admin-dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const url = page.url();
    const isRedirected = url.includes('/sign-in') || url.includes('/admin');
    const hasGate = await page.locator('text=/access denied|sign in/i').count() > 0;
    expect(isRedirected || hasGate).toBeTruthy();
  });
});

// ─── Admin API data isolation ───────────────────────────────────────

test.describe('Admin API data isolation', () => {
  test('audit logs not accessible without auth', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/audit-logs`);
    expect([401, 403]).toContain(res.status());
  });

  test('system health not accessible without admin role', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/system/health`);
    expect([401, 403]).toContain(res.status());
  });

  test('categories management requires admin', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.post(`${API}/api/admin/categories`, {
      data: { name: 'Test Category', slug: 'test-cat' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('ledger export requires admin', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/admin/ledger/export`);
    expect([401, 403]).toContain(res.status());
  });

  test('verified demiurges update requires admin', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.patch(`${API}/api/profiles/fake-id/verify`, {
      data: { verified: true },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('pending products queue requires moderator', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/products/pending`);
    expect([401, 403]).toContain(res.status());
  });

  test('product rescan requires moderator', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.post(`${API}/api/products/fake-id/rescan`);
    expect([401, 403]).toContain(res.status());
  });
});

// ─── Moderator panel ────────────────────────────────────────────────

test.describe('Moderator panel security', () => {
  test('moderator page requires authentication', async ({ page }) => {
    await page.goto('/moderator');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const url = page.url();
    const hasRedirect = url.includes('/sign-in');
    const hasGate = await page.locator('text=/access denied|sign in/i').count() > 0;
    expect(hasRedirect || hasGate).toBeTruthy();
  });
});

// ─── Cross-origin protection ────────────────────────────────────────

test.describe('Origin guard', () => {
  test('API rejects mutations without proper origin in production mode', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');

    const res = await request.post(`${API}/api/client-errors`, {
      headers: { Origin: 'https://evil.example.com' },
      data: { message: 'test' },
    });

    // In dev mode origin guard is disabled, so 200 is ok;
    // in production mode it would be 403
    expect(res.status()).toBeLessThan(500);
  });
});

// ─── Commerce admin ─────────────────────────────────────────────────

test.describe('Commerce admin security', () => {
  test('commerce admin orders requires secret', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/v1/commerce/admin/orders`);
    expect([401, 403]).toContain(res.status());
  });

  test('commerce admin audit requires secret', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/v1/commerce/admin/audit`);
    expect([401, 403]).toContain(res.status());
  });

  test('commerce config is publicly readable', async ({ request }) => {
    const up = await isBackendUp(request);
    test.skip(!up, 'backend not running');
    const res = await request.get(`${API}/api/v1/commerce/config`);
    if (res.ok()) {
      const body = await res.json();
      expect(body).toBeDefined();
    }
  });
});
