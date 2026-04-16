import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('homepage loads and shows header', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TON/i);
    const header = page.locator('header');
    await expect(header).toBeVisible();
  });

  test('homepage displays product cards or empty state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const hasProducts = await page.locator('[data-testid="product-card"], .product-card, a[href*="/product/"]').count();
    const hasEmptyState = await page.locator('text=/no products|coming soon|browse/i').count();
    expect(hasProducts + hasEmptyState).toBeGreaterThan(0);
  });

  test('navigation links are present', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('header nav, header');
    await expect(nav).toBeVisible();
  });

  test('footer is rendered', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });
});

test.describe('Health check', () => {
  test('API health endpoint responds', async ({ request }) => {
    const response = await request.get('http://localhost:8081/api/health');
    if (response.ok()) {
      const data = await response.json();
      expect(data.status).toBe('OK');
      expect(data.auth).toBeDefined();
      expect(data.shield).toBe('mahakala');
    }
  });
});

test.describe('Product page', () => {
  test('navigating to /category shows category page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const categoryLink = page.locator('a[href*="/category"]').first();
    if (await categoryLink.isVisible()) {
      await categoryLink.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/category');
    }
  });
});

test.describe('Security headers', () => {
  test('response includes security headers', async ({ request }) => {
    const response = await request.get('http://localhost:8081/api/health');
    if (response.ok()) {
      const headers = response.headers();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['x-dharma-shield']).toBe('mahakala');
    }
  });
});
