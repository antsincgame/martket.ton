import express, { type Request, type Response } from 'express';
import { getTonForgeService } from './service.js';
import { validateBody } from '../middleware/validate.js';
import { requireAdmin } from '../middleware/auth.js';
import {
  kycSchema,
  scanArtifactSchema,
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
  SESSION_ALREADY_CONFIRMED: 409,
  ONCHAIN_DISABLED: 503,
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

router.get('/developers/:wallet/workspace', (req: Request, res: Response) => {
  res.json({ data: getTonForgeService().getDeveloperWorkspace(str(req.params.wallet)) });
});

router.post('/developers/kyc', validateBody(kycSchema), (req: Request, res: Response) => {
  try {
    const profile = getTonForgeService().submitDeveloperKyc(req.body as Record<string, string>);
    res.json({ data: { profile } });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/artifacts/scan', validateBody(scanArtifactSchema), (req: Request, res: Response) => {
  try {
    const scan = getTonForgeService().scanArtifact(req.body as Record<string, string>);
    res.json({ data: { scan } });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/apps', validateBody(publishAppSchema), (req: Request, res: Response) => {
  try {
    const app = getTonForgeService().publishApp(req.body as Record<string, unknown>);
    res.json({ data: { app } });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/purchase/session', validateBody(purchaseSessionSchema), (req: Request, res: Response) => {
  try {
    const response = getTonForgeService().createPurchaseSession(
      req.body as { appId: string; buyerWallet: string },
    );
    res.json({ data: response });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/purchase/confirm', validateBody(confirmPurchaseSchema), (req: Request, res: Response) => {
  try {
    const response = getTonForgeService().confirmPurchaseSession(
      req.body as { purchaseSessionId: string; buyerWallet: string; txHash?: string },
    );
    res.json({ data: response });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/licenses/me', (req: Request, res: Response) => {
  const wallet = String(req.query.wallet || '').trim();
  if (!wallet) {
    res.status(400).json({ error: 'WALLET_REQUIRED' });
    return;
  }
  res.json({ data: getTonForgeService().getWalletProfile(wallet) });
});

router.post('/licenses/:licenseId/activate-device', validateBody(activateDeviceSchema), async (req: Request, res: Response) => {
  try {
    const body = req.body as { buyerWallet: string; deviceId: string };
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

router.get('/licenses/:licenseId', (req: Request, res: Response) => {
  const license = getTonForgeService().getLicenseById(str(req.params.licenseId));
  if (!license) {
    res.status(404).json({ error: 'LICENSE_NOT_FOUND' });
    return;
  }
  res.json({ data: { license } });
});

router.get('/licenses/:licenseId/verify', async (req: Request, res: Response) => {
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
