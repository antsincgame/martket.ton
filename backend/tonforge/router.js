// Новый router TonForge нужен, чтобы фронт работал через канонический API licenses/escrow/devices вместо legacy deliveryPayload flow.
'use strict';

const express = require('express');
const tonForgeModule = require('./service');

const router = express.Router();

function tf() {
  return tonForgeModule.tonForgeService;
}

function handleError(res, error) {
  const code = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  const statusMap = {
    APP_NOT_FOUND: 404,
    SESSION_NOT_FOUND: 404,
    LICENSE_NOT_FOUND: 404,
    BUYER_WALLET_MISMATCH: 403,
    LICENSE_ACCESS_DENIED: 403,
    SESSION_ALREADY_CONFIRMED: 409,
  };
  const status = statusMap[code] || 400;
  res.status(status).json({ error: code });
}

router.get('/config', (_req, res) => {
  res.json({ data: tf().getContractOverview() });
});

router.get('/apps/featured', (_req, res) => {
  res.json({ data: { apps: tf().listFeaturedApps() } });
});

router.get('/apps/:appId', (req, res) => {
  const app = tf().getAppById(req.params.appId);
  if (!app) {
    res.status(404).json({ error: 'APP_NOT_FOUND' });
    return;
  }

  res.json({
    data: {
      app,
      reviews: tf().getReviews(app.appId),
    },
  });
});

router.get('/developers/:wallet/workspace', (req, res) => {
  res.json({ data: tf().getDeveloperWorkspace(req.params.wallet) });
});

router.post('/developers/kyc', (req, res) => {
  try {
    const profile = tf().submitDeveloperKyc(req.body);
    res.json({ data: { profile } });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/artifacts/scan', (req, res) => {
  try {
    const scan = tf().scanArtifact(req.body);
    res.json({ data: { scan } });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/apps', (req, res) => {
  try {
    const app = tf().publishApp(req.body);
    res.json({ data: { app } });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/purchase/session', (req, res) => {
  try {
    const response = tf().createPurchaseSession(req.body);
    res.json({ data: response });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/purchase/confirm', (req, res) => {
  try {
    const response = tf().confirmPurchaseSession(req.body);
    res.json({ data: response });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/licenses/me', (req, res) => {
  const wallet = String(req.query.wallet || '').trim();
  if (!wallet) {
    res.status(400).json({ error: 'WALLET_REQUIRED' });
    return;
  }

  res.json({ data: tf().getWalletProfile(wallet) });
});

router.post('/licenses/:licenseId/activate-device', (req, res) => {
  try {
    const response = tf().activateLicenseDevice({
      licenseId: req.params.licenseId,
      buyerWallet: req.body.buyerWallet,
      deviceId: req.body.deviceId,
    });
    res.json({ data: response });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/disputes', (req, res) => {
  try {
    const dispute = tf().openDispute(req.body);
    res.json({ data: { dispute } });
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
