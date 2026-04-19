import express, { type Request, type Response } from 'express';
import { getTonForgeService } from './service.js';
import { validateBody } from '../middleware/validate.js';
import { apiRequireAuth, requireAdmin } from '../middleware/auth.js';
import { requireWalletOwner } from '../commerce/helpers.js';
import { screenWallet } from '../sanctions/screen.js';
import {
  kycSchema,
  publishAppSchema,
  purchaseSessionSchema,
  confirmPurchaseSchema,
  activateDeviceSchema,
} from './validation.js';

const router = express.Router();

function str(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? '';
  return val ?? '';
}

const ERROR_STATUS: Record<string, number> = {
  APP_NOT_FOUND: 404,
  SESSION_NOT_FOUND: 404,
  LICENSE_NOT_FOUND: 404,
  BUYER_WALLET_MISMATCH: 403,
  LICENSE_ACCESS_DENIED: 403,
  LICENSE_ONCHAIN_VERIFY_FAILED: 403,
  LICENSE_REVOKED: 403,
  LICENSE_NOT_READY: 409,
  SESSION_ALREADY_CONFIRMED: 409,
  ONCHAIN_DISABLED: 503,
  INVALID_TRIAL_ENDS_AT: 500,
};

function handleError(res: Response, error: unknown): void {
  const code = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  const status = ERROR_STATUS[code] ?? 400;
  res.status(status).json({ error: code });
}

router.get('/config', (_req: Request, res: Response) => {
  res.json({ data: getTonForgeService().getContractOverview() });
});

router.get('/apps/featured', (_req: Request, res: Response) => {
  res.json({ data: { apps: getTonForgeService().listFeaturedApps() } });
});

router.get('/apps/:appId', (req: Request, res: Response) => {
  const app = getTonForgeService().getAppById(str(req.params.appId));
  if (!app) {
    res.status(404).json({ error: 'APP_NOT_FOUND' });
    return;
  }
  res.json({ data: { app, reviews: getTonForgeService().getReviews(app.appId) } });
});

// Workspace contains developer profile, apps, scans — must be authenticated
// and restricted to the wallet owner to prevent recon and state pollution
// (ensureDeveloperProfile has a side effect of creating a profile).
router.get('/developers/:wallet/workspace', apiRequireAuth(), async (req: Request, res: Response) => {
  const wallet = str(req.params.wallet);
  const owner = await requireWalletOwner(req, res, wallet);
  if (!owner) return;
  res.json({ data: getTonForgeService().getDeveloperWorkspace(wallet) });
});

// KYC submission must come from the wallet's authenticated owner — otherwise
// any anonymous caller could pollute another seller's KYC state, and a
// sanctioned wallet could attempt to clear itself by re-submitting.
router.post('/developers/kyc', apiRequireAuth(), validateBody(kycSchema), async (req: Request, res: Response) => {
  try {
    const wallet = String((req.body as { wallet?: string }).wallet || '');
    const owner = await requireWalletOwner(req, res, wallet);
    if (!owner) return;

    const screen = screenWallet(wallet);
    if (!screen.ok) {
      res.status(451).json({
        error: 'Wallet is on a sanctions list and cannot be KYC-verified.',
        code: screen.reason || 'SANCTIONED',
      });
      return;
    }

    const profile = getTonForgeService().submitDeveloperKyc(req.body as Record<string, string>);
    res.json({ data: { profile } });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/artifacts/scan', apiRequireAuth(), async (req: Request, res: Response) => {
  try {
    const { resolveProfile } = await import('../middleware/auth.js');
    const profile = await resolveProfile(req);
    if (!profile?.tonAddress) {
      res.status(403).json({ error: 'WALLET_NOT_LINKED' });
      return;
    }
    const body = req.body as Record<string, string>;
    body.sellerWallet = profile.tonAddress;
    const scan = getTonForgeService().scanArtifact(body);
    res.json({ data: { scan } });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/apps', apiRequireAuth(), validateBody(publishAppSchema), async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const sellerWallet = String(body.sellerWallet || '');
    if (!sellerWallet) {
      res.status(400).json({ error: 'sellerWallet is required' });
      return;
    }
    const owner = await requireWalletOwner(req, res, sellerWallet);
    if (!owner) return;
    const app = getTonForgeService().publishApp(body);
    res.json({ data: { app } });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/purchase/session', apiRequireAuth(), validateBody(purchaseSessionSchema), async (req: Request, res: Response) => {
  try {
    const body = req.body as { appId: string; buyerWallet: string };
    const owner = await requireWalletOwner(req, res, body.buyerWallet);
    if (!owner) return;
    const response = getTonForgeService().createPurchaseSession(body);
    res.json({ data: response });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/purchase/confirm', apiRequireAuth(), validateBody(confirmPurchaseSchema), async (req: Request, res: Response) => {
  try {
    const body = req.body as { purchaseSessionId: string; buyerWallet: string; txHash?: string };
    const owner = await requireWalletOwner(req, res, body.buyerWallet);
    if (!owner) return;
    const response = getTonForgeService().confirmPurchaseSession(body);
    res.json({ data: response });
  } catch (error) {
    handleError(res, error);
  }
});

// IDOR fix: wallet is derived from the authenticated profile, not from query.
// Prevents any authenticated user from reading another user's licenses.
router.get('/licenses/me', apiRequireAuth(), async (req: Request, res: Response) => {
  const { resolveProfile } = await import('../middleware/auth.js');
  const profile = await resolveProfile(req);
  if (!profile || !profile.tonAddress) {
    res.status(403).json({ error: 'WALLET_NOT_LINKED' });
    return;
  }
  res.json({ data: getTonForgeService().getWalletProfile(profile.tonAddress) });
});

router.post('/licenses/:licenseId/activate-device', apiRequireAuth(), validateBody(activateDeviceSchema), async (req: Request, res: Response) => {
  try {
    const body = req.body as { buyerWallet: string; deviceId: string };
    const owner = await requireWalletOwner(req, res, body.buyerWallet);
    if (!owner) return;
    const response = await getTonForgeService().activateLicenseDevice({
      licenseId: str(req.params.licenseId),
      buyerWallet: body.buyerWallet,
      deviceId: body.deviceId,
    });
    res.json({ data: response });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/licenses/:licenseId', apiRequireAuth(), async (req: Request, res: Response) => {
  const { resolveProfile } = await import('../middleware/auth.js');
  const profile = await resolveProfile(req);
  if (!profile?.tonAddress) {
    res.status(403).json({ error: 'WALLET_NOT_LINKED' });
    return;
  }
  const license = getTonForgeService().getLicenseById(str(req.params.licenseId));
  if (!license) {
    res.status(404).json({ error: 'LICENSE_NOT_FOUND' });
    return;
  }
  if (license.buyerWallet !== profile.tonAddress) {
    res.status(403).json({ error: 'LICENSE_ACCESS_DENIED' });
    return;
  }
  res.json({ data: { license } });
});

router.get('/licenses/:licenseId/verify', apiRequireAuth(), async (req: Request, res: Response) => {
  const { resolveProfile } = await import('../middleware/auth.js');
  const profile = await resolveProfile(req);
  if (!profile?.tonAddress) {
    res.status(403).json({ error: 'WALLET_NOT_LINKED' });
    return;
  }
  const license = getTonForgeService().getLicenseById(str(req.params.licenseId));
  if (!license || license.buyerWallet !== profile.tonAddress) {
    res.status(403).json({ error: 'LICENSE_ACCESS_DENIED' });
    return;
  }
  try {
    const verify = await getTonForgeService().verifyLicenseOnchain(str(req.params.licenseId));
    res.json({ data: { verify } });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/admin/apps/:appId/collection', requireAdmin, (req: Request, res: Response) => {
  try {
    const body = req.body as { collectionAddress?: string; metadataUriPrefix?: string };
    if (!body.collectionAddress) {
      res.status(400).json({ error: 'COLLECTION_ADDRESS_REQUIRED' });
      return;
    }
    const app = getTonForgeService().setAppCollectionAddress(
      str(req.params.appId),
      body.collectionAddress,
      body.metadataUriPrefix,
    );
    res.json({ data: { app } });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
