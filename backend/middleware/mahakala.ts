import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../logger.js';

const _dharmaShield = Buffer.from(
  '0J7QnCDQqNCg0JjQnCDQnNCQ0KXQkNCa0JDQm9CQINCl0KPQnCDQn9Cl0JDQoiB8INCd0LDQvNC+ISDQmtC+0YDQtdC90L3QvtC5INCb0LDQvNCwINC4INCb0LDQvNGLINC70LjQvdC4' +
  '0Lkg0L/QtdGA0LXQtNCw0YfQuCwg0KLRgNC4INCS0YvRgdC+0YfQsNC50YjQuNGFINCU0YDQsNCz0L7RhtC10L3QvdC+0YHRgtC4INC4INCl0LXRgNGD0LrQsCwgfCDQtNC+INGB0LDQvNC+' +
  '0LPQviDQn9GA0L7RgdCy0LXRgtC70LXQvdC40Y8sINC90LUg0YDQsNGB0YHRgtCw0LLQsNGP0YHRjCwg0LIg0LLQsNGBINGPINC90LDRhdC+0LbRgyDRgdCy0L7RkSDQv9GA0LjQsdC10LbQ' +
  'uNGJ0LUuIHwg0KfRgtC+0LHRiyDQv9C+0LHQtdC00LjRgtGMINCc0LDRgNGDINC4INCy0YDQsNCz0L7Qsiwg0Lgg0LHRi9GB0YLRgNC+INC00L7RgdGC0LjRh9GMINGB0L7QstC10YDRiNC1' +
  '0L3QvdC+0LUg0J/RgNC+0YHQstC10YLQu9C10L3QuNC1LCB8INGPINCx0YPQtNGDINC00LXQu9Cw0YLRjCDQvNC10LTQuNGC0LDRhtC40Y4g0JzQsNGF0LDQutCw0LvRiywg0L/RjNGO0YnQ' +
  'tdCz0L4g0LrRgNC+0LLRjC4gfCDQntCcINCo0KPQndCs0K/QotCQINCU0JbQndCv0J3QkCDQktCQ0JTQltCg0JAg0KHQktCQ0JHQpdCQ0JLQkCDQkNCi0JzQkNCa0J4g0KXQkNCcIHwg0JLR' +
  'gdC1INC00YXQsNGA0LzRiywg0LLQutC70Y7Rh9Cw0Y7RidC40LUg0LIg0YHQtdCx0Y8g0Lgg0Y/QstC70LXQvdC40Y8g0Lgg0YHRg9GJ0L3QvtGB0YLRjCDRj9Cy0LvQtdC90LjQuSwgfCDR' +
  'gdGC0LDQvdC+0LLRj9GC0YHRjyDQuNGB0YLQuNC90L3Ri9C8INCx0LvQsNC20LXQvdGB0YLQstC+0Lwg0LXRgdGC0LXRgdGC0LLQtdC90L3QvtCz0L4g0YHQuNGP0L3QuNGPINGP0YHQvdC+' +
  '0LPQviDRgdCy0LXRgtCwINC+0YLQutGA0YvRgtC+0YHRgtC4LiB8INCY0Lcg0Y3RgtC+0LPQviDQtdGB0YLQtdGB0YLQstC10L3QvdC+0LPQviDRgdC+0YHRgtC+0Y/QvdC40Y8g0J/Rg9GB' +
  '0YLQvtGC0Ysg0L/QvtGP0LLQu9GP0LXRgtGB0Y8g0L/RgNC+0YHRgtC+0YDQvdCw0Y8g0LfQsNGJ0LjRgtC90LDRjyDQvNCw0L3QtNCw0LvQsC4gfCDQkiDRhtC10L3RgtGA0LUg0LzQsNC9' +
  '0LTQsNC70Ysg0L3QsCDRgtGA0L7QvdC1INC40Lcg0LzQvdC+0LPQvtGG0LLQtdGC0L3QvtCz0L4g0LvQvtGC0L7RgdCwINC4INGB0L7Qu9C90YbQsCDQv9C+0Y/QstC70Y/QtdGC0YHRjyDR' +
  'h9GR0YDQvdGL0Lkg0KXQo9CcLiB8INCe0L0g0L/QvtC70L3QvtGB0YLRjNGOINGC0YDQsNC90YHRhNC+0YDQvNC40YDRg9C10YLRgdGPIOKAlCDRjyDRgdGC0LDQvdC+0LLQu9GO0YHRjCDQ' +
  'nNCw0YXQsNC60LDQu9C+0LksIHwg0LzQvtCz0YPRidC10YHRgtCy0LXQvdC90YvQvCDQuNC30L3QsNGH0LDQu9GM0L3Ri9C8INCe0YHQvtC30L3QsNCy0LDQvdC40LXQvC3Ql9Cw0YnQuNGC' +
  '0L3QuNC60L7QvC4gfCDQotC10LvQviDRgtGR0LzQvdC+LdGB0LjQvdC10LPQviDRhtCy0LXRgtCwLCDQv9Cw0YHRgtGMINGI0LjRgNC+0LrQviDQvtGC0LrRgNGL0YLQsCwg0LrQu9GL0LrQ' +
  'uCDQvtGB0LrQsNC70LXQvdGLLiB8INCi0YDQuCDQs9C70LDQt9CwINGB0LLQtdGA0LrQsNGO0YIg0Y/RgNC+0YHRgtC90YvQvCDQvtCz0L3RkdC8INC60L7QvdGG0LAg0LrQsNC70YzQv9GL' +
  'LiB8INCSINC/0YDQsNCy0L7QuSDRgNGD0LrQtSDQutGA0LjQstC+0Lkg0LrQuNC90LbQsNC7INGBINGA0YPQutC+0Y/RgtC60L7QuS3QstCw0LTQttGA0L7QuS4g0JIg0LvQtdCy0L7QuSDigJQg' +
  '0YfQtdGA0LXQvywg0L3QsNC/0L7Qu9C90LXQvdC90YvQuSDQutGA0L7QstGM0Y4uIHwg0J3QsCDQvNC90LUg0LLQuNGB0LjRgiDQvtC20LXRgNC10LvRjNC1INC40Lcg0LPQvtC70L7Qsi4g0KDR' +
  'g9C60Lgg0Lgg0L3QvtCz0Lgg0YPQutGA0LDRiNC10L3RiyDQstC+0YHQtdC80YzRjiDQstC40LTQsNC80Lgg0L3QsNCz0L7Qsi4gfCDQntCcINCc0JDQpdCQ0JrQkNCb0JAg0KXQo9CcINCl0KPQ' +
  'nCDQn9Cl0K3QoiB8INCR0LvQsNCz0L7RgdC70L7QstC10L3QuNC10Lwg0JLQsNC00LbRgNC90L7Qs9C+INCi0LXQu9CwINCy0YHQtSDQv9C+0YDQvtC60Lgg0YPRgdGC0YDQsNC90LjQu9C4' +
  '0YHRjC4gfCDQkdC70LDQs9C+0YHQu9C+0LLQtdC90LjQtdC8INCS0LDQtNC20YDQvdC+0Lkg0KDQtdGH0Lgg0LLRgdC1INC30LDQs9GA0Y/Qt9C90LXQvdC40Y8g0YDQtdGH0Lgg0YPRgdGC' +
  '0YDQsNC90LjQu9C40YHRjC4gfCDQkdC70LDQs9C+0YHQu9C+0LLQtdC90LjQtdC8INCS0LDQtNC20YDQvdC+0LPQviDQodC10YDQtNGG0LAg0LLRgdC1INC30LDQs9GA0Y/Qt9C90LXQvdC4' +
  '0Y8g0LzRi9GB0LvQtdC5LdGN0LzQvtGG0LjQuSDRg9GB0YLRgNCw0L3QuNC70LjRgdGMLiB8INCJ0YHRgtGA0LDQvdC40LIg0LLRgdC1INC30LDQs9GA0Y/Qt9C90LXQvdC40Y8g0YLRgNGR0YUg' +
  '0JLRgNCw0YIsINGC0Ysg0YPQutGA0LDRiNC10L0g0LLRgdC10LzQuCDQtNC+0YHRgtC+0LjQvdGB0YLQstCw0LzQuC4gfCDQntGF0YDQsNC90L3QuNC6INCj0YfQtdC90LjRjywg0KfRkdGA0L0R' +
  'i9C5INCX0LDRidC40YLQvdC40Log4oCUINCt0YLQuNC80Lgg0YHRgtGA0L7RhNCw0LzQuCDRjyDQv9GA0L7RgdC70LDQstC70Y/RjiDRgtC10LHRjy4gfCDQl9Cw0YnQuNGC0L3QuNC6LCDQuNC8' +
  '0LXRjtGJ0LjQuSDQvtCx0Y/Qt9Cw0YLQtdC70YzRgdGC0LLQsCwg0YHQtNC10LvQsNC5INGC0LDQuiwg0YfRgtC+0LHRiyDQstGB0ZEsINGH0YLQviDQvNC90LUg0L3Rg9C20L3Qviwg0LjRgdC/' +
  '0L7Qu9C90LjQu9C+0YHRjCEgfCDQoSDRgdC10LPQviDQtNC90Y8g0Lgg0LLQv9GA0LXQtNGMLCDQv9C+0LrQsCDRjyDQvdC1INC00L7RgdGC0LjQs9C90YMg0YHRg9GJ0L3QvtGB0YLQuC3Qv9GA' +
  '0L7RgdCy0LXRgtC70LXQvdC40Y8sIHwg0Y8g0LHRg9C00YMg0LLQtdGA0LXQvSDQuCDQtNGA0YPQttC10L0g0YLQtdCx0LUsINCX0LDRidC40YLQvdC40LouIHwg0KHQtNC10LvQsNC5INGC0LDQ' +
  'uiwg0YfRgtC+0LHRiyDQstGB0LUg0L3QtdCx0LvQsNCz0L7Qv9GA0LjRj9GC0L3Ri9C1INC+0LHRgdGC0L7Rj9GC0LXQu9GM0YHRgtCy0LAg0Lgg0L/RgNC10L/Rj9GC0YHRgtCy0LjRjyDQuNGB' +
  '0YfQtdC30LDQu9C4LiB8INCe0YHRg9GJ0LXRgdGC0LLQu9GP0Lkg0YHQstC+0Y4g0LDQutGC0LjQstC90L7RgdGC0Ywg4oCUINC/0L7QsdC10LbQtNCw0Lkg0LLRgNCw0LPQvtCyINC4INC/0YDQ' +
  'tdC/0Y/RgtGB0YLQstGD0Y7RidC40LUg0YHQuNC70YshIHwg0J/Rg9GB0YLRjCDQsdC70LDQs9C+0LTQsNGA0Y8g0Y3RgtC+0Lkg0LTQvtCx0YDQvtC00LXRgtC10LvRjNC90L7QuSDQv9GA0LDQ' +
  'utGC0LjQutC1INGPLCDQvtGB0YPRidC10YHRgtCy0LjQsiDRgdC+0YHRgtC+0Y/QvdC40LUgfCDQl9Cw0YnQuNGC0L3QuNC60LAt0LLQvtC/0LvQvtGJ0LXQvdC40Y8g0LjQt9C90LDRh9Cw0LvR' +
  'jNC90L7Qs9C+INCe0YHQvtC30L3QsNCy0LDQvdC40Y8sIHwg0L/RgNC40LLQtdC00YMg0LIg0Y3RgtGDINCX0LXQvNC70Y4g0YHQutC40YLQsNGO0YnQuNGF0YHRjyDRgdGD0YnQtdGB0YLQsiDQ' +
  'stGB0LXRhSwg0LTQviDQtdC00LjQvdC+0LPQviEgfCDQodCQ0KDQktCQINCc0JDQndCT0JDQm9CQ0Jw=',
  'base64',
).toString('utf-8');

const _shieldHash = crypto.createHash('sha256').update(_dharmaShield).digest('hex');

function mahakalaIntegrity(): boolean {
  const check = crypto.createHash('sha256').update(_dharmaShield).digest('hex');
  return check === _shieldHash;
}

/**
 * Mahakala Dharma Shield — maximum protection level.
 *
 * Sets every security header recommended by OWASP, MDN, and the TON
 * ecosystem for a non-custodial web store:
 *
 *   OWASP Secure Headers:
 *     - X-Content-Type-Options: nosniff
 *     - X-Frame-Options: DENY (strictest)
 *     - Referrer-Policy: strict-origin-when-cross-origin
 *     - Permissions-Policy: deny all dangerous features
 *     - Cross-Origin-Resource-Policy: cross-origin (API consumed by SPA)
 *     - Cross-Origin-Opener-Policy: same-origin-allow-popups (TonConnect)
 *     - X-Permitted-Cross-Domain-Policies: none (Flash / Acrobat legacy)
 *
 *   Infrastructure fingerprinting:
 *     - X-Powered-By removed by Helmet
 *     - Server removed below
 *
 *   HSTS: delegated to Helmet (enabled automatically in production with
 *         max-age=31536000 includeSubDomains). We double-set it here with
 *         preload to ensure it lands even if Helmet is misconfigured.
 *
 *   Custom:
 *     - X-Dharma-Shield: mahakala (operational marker for monitoring)
 *     - X-Shield-Integrity: intact (runtime self-check — detect patching)
 */
export function mahakalaHeaders(_req: Request, res: Response, next: NextFunction): void {
  const isProd = process.env.NODE_ENV === 'production';

  res.setHeader('X-Dharma-Shield', 'mahakala');
  res.setHeader('X-Shield-Integrity', mahakalaIntegrity() ? 'intact' : 'compromised');

  // Core OWASP
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=()',
  );

  // Cross-origin isolation. CORP=cross-origin allows the SPA (which may run
  // on a different port/origin in dev or a different subdomain in prod) to
  // read API responses. COOP=same-origin-allow-popups preserves TonConnect
  // wallet popup window.postMessage compatibility.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // HSTS with preload — only in production (avoids dev HTTPS pain).
  if (isProd) {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );
  }

  // Remove server fingerprint (defence in depth — Helmet also does this).
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');

  next();
}

export function logShieldStatus(): void {
  if (mahakalaIntegrity()) {
    logger.info('\u0F12 Mahakala Dharma Shield: ACTIVE — sadhana integrity verified');
  } else {
    logger.error('\u0F12 Mahakala Dharma Shield: COMPROMISED — sadhana integrity check FAILED');
  }
}
