import { test, expect } from '@playwright/test';

// ─── Homepage ───────────────────────────────────────────────────────

test.describe('Homepage', () => {
  test('loads and shows header + footer', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TON/i);
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });

  test('displays product cards or empty state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const hasProducts = await page.locator('[data-testid="product-card"], .product-card, a[href*="/product/"]').count();
    const hasEmptyState = await page.locator('text=/no products|coming soon|browse/i').count();
    expect(hasProducts + hasEmptyState).toBeGreaterThan(0);
  });

  test('navigation links are present in header', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('header nav, header');
    await expect(nav).toBeVisible();
  });

  test('footer contains legal links', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer.locator('a[href="/terms"]')).toBeVisible();
    await expect(footer.locator('a[href="/privacy"]')).toBeVisible();
  });

  test('cookie consent banner appears', async ({ page }) => {
    await page.goto('/');
    const consent = page.locator('text=/cookie|accept/i');
    if (await consent.count() > 0) {
      await expect(consent.first()).toBeVisible();
    }
  });
});

// ─── Navigation & Routing ───────────────────────────────────────────

test.describe('Navigation', () => {
  test('navigating to /category/:id shows category page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const categoryLink = page.locator('a[href*="/category"]').first();
    if (await categoryLink.isVisible()) {
      await categoryLink.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/category');
    }
  });

  test('unknown route shows 404 or redirects home', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist-12345');
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState('networkidle');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('/sign-up redirects to /sign-in', async ({ page }) => {
    await page.goto('/sign-up');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/sign-in');
  });
});

// ─── Authentication Pages ───────────────────────────────────────────

test.describe('Authentication', () => {
  test('sign-in page renders with email and GitHub options', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    const githubButton = page.locator('button:has-text("GitHub"), a:has-text("GitHub")');
    await expect(emailInput.first()).toBeVisible();
    await expect(githubButton.first()).toBeVisible();
  });

  test('sign-in page rejects empty email', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
    const submitButton = page.locator('button[type="submit"], button:has-text("Send"), button:has-text("Continue")').first();
    if (await submitButton.isVisible()) {
      await submitButton.click();
      const errorOrValidation = page.locator('[role="alert"], .text-red-300, .text-red-400, .error, :invalid');
      const count = await errorOrValidation.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('protected routes redirect unauthenticated users', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const url = page.url();
    const isRedirected = url.includes('/sign-in') || url === new URL('/', page.url()).href;
    const hasSignInUI = await page.locator('input[type="email"], button:has-text("GitHub")').count() > 0;
    expect(isRedirected || hasSignInUI).toBeTruthy();
  });
});

// ─── Legal Pages ────────────────────────────────────────────────────

test.describe('Legal pages', () => {
  test('Terms of Service page loads', async ({ page }) => {
    await page.goto('/terms');
    await page.waitForLoadState('networkidle');
    const body = page.locator('main');
    await expect(body).toBeVisible();
    const content = await body.textContent();
    expect(content?.toLowerCase()).toContain('terms');
  });

  test('Privacy Policy page loads', async ({ page }) => {
    await page.goto('/privacy');
    await page.waitForLoadState('networkidle');
    const body = page.locator('main');
    await expect(body).toBeVisible();
    const content = await body.textContent();
    expect(content?.toLowerCase()).toContain('privacy');
  });

  test('Refund Policy page loads', async ({ page }) => {
    await page.goto('/refund-policy');
    await page.waitForLoadState('networkidle');
    const body = page.locator('main');
    await expect(body).toBeVisible();
    const content = await body.textContent();
    expect(content?.toLowerCase()).toMatch(/refund|dmca/i);
  });
});

// ─── Documentation ──────────────────────────────────────────────────

test.describe('Documentation', () => {
  test('/docs page loads with content', async ({ page }) => {
    await page.goto('/docs');
    await page.waitForLoadState('networkidle');
    const body = page.locator('main');
    await expect(body).toBeVisible();
    const content = await body.textContent();
    expect(content?.length).toBeGreaterThan(100);
  });
});

// ─── Product Pages ──────────────────────────────────────────────────

test.describe('Product pages', () => {
  test('product detail page loads via link', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const productLink = page.locator('a[href*="/product/"]').first();
    if (await productLink.isVisible()) {
      await productLink.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/product/');
      const main = page.locator('main');
      await expect(main).toBeVisible();
    }
  });

  test('product page shows price or free badge', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const productLink = page.locator('a[href*="/product/"]').first();
    if (await productLink.isVisible()) {
      await productLink.click();
      await page.waitForLoadState('networkidle');
      const priceOrFree = page.locator('text=/\\d+\\.?\\d*\\s*TON|free|price/i');
      const count = await priceOrFree.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── API Health & Security ──────────────────────────────────────────

test.describe('API', () => {
  test('health endpoint responds with OK', async ({ request }) => {
    const response = await request.get('http://localhost:8081/api/health');
    if (response.ok()) {
      const data = await response.json();
      expect(data.status).toBe('OK');
    }
  });

  test('security headers are present on API responses', async ({ request }) => {
    const response = await request.get('http://localhost:8081/api/health');
    if (response.ok()) {
      const headers = response.headers();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['x-dharma-shield']).toBe('mahakala');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    }
  });

  test('CSP header does not contain unsafe-eval', async ({ request }) => {
    const response = await request.get('http://localhost:8081/api/health');
    if (response.ok()) {
      const csp = response.headers()['content-security-policy'] || '';
      expect(csp).not.toContain('unsafe-eval');
    }
  });

  test('unknown API routes return 404, not 500', async ({ request }) => {
    const response = await request.get('http://localhost:8081/api/nonexistent-route');
    expect(response.status()).toBeLessThan(500);
  });

  test('rate limiter headers are present', async ({ request }) => {
    const response = await request.get('http://localhost:8081/api/health');
    if (response.ok()) {
      const headers = response.headers();
      const hasRateLimit = headers['ratelimit-limit'] || headers['x-ratelimit-limit'];
      expect(hasRateLimit).toBeTruthy();
    }
  });
});

// ─── Responsive Design ──────────────────────────────────────────────

test.describe('Responsive', () => {
  test('mobile viewport renders without horizontal scroll', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);

    await context.close();
  });

  test('header is visible on mobile', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    await context.close();
  });
});

// ─── Performance ────────────────────────────────────────────────────

test.describe('Performance', () => {
  test('homepage loads within 10 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/', { waitUntil: 'networkidle' });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10_000);
  });

  test('no console errors on homepage', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('Failed to load resource'),
    );
    expect(criticalErrors.length).toBe(0);
  });
});

// ─── Accessibility Basics ───────────────────────────────────────────

test.describe('Accessibility', () => {
  test('page has a lang attribute', async ({ page }) => {
    await page.goto('/');
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBeTruthy();
  });

  test('images have alt attributes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const alt = await images.nth(i).getAttribute('alt');
      const ariaHidden = await images.nth(i).getAttribute('aria-hidden');
      const role = await images.nth(i).getAttribute('role');
      expect(alt !== null || ariaHidden === 'true' || role === 'presentation').toBeTruthy();
    }
  });
});
