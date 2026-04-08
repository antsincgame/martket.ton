// Тесты фиксируют базовый purchase/license/device flow нового TonForge service, чтобы миграция не ломала критичный сценарий.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createTonForgeService } = require('../tonforge/service');
const { createDemoState } = require('../tonforge/demoData');

test('createPurchaseSession и confirmPurchaseSession выпускают trial license', () => {
  const service = createTonForgeService(createDemoState());
  const buyerWallet = 'EQBNewBuyerWalletTonForge000000000000000000000000001';

  const { session, app } = service.createPurchaseSession({
    appId: 'app_cosmic_code_editor',
    buyerWallet,
  });

  assert.equal(session.state, 'awaiting_wallet_payment');
  assert.equal(app.appId, 'app_cosmic_code_editor');

  const confirmed = service.confirmPurchaseSession({
    purchaseSessionId: session.purchaseSessionId,
    buyerWallet,
    txHash: '0xtesthash',
  });

  assert.equal(confirmed.session.state, 'trial_active');
  assert.equal(confirmed.license.appId, 'app_cosmic_code_editor');
  assert.equal(confirmed.license.purchaseTxHash, '0xtesthash');
});

test('activateLicenseDevice привязывает устройство и переводит лицензию в device_bound', () => {
  const service = createTonForgeService(createDemoState());
  const buyerWallet = 'EQBActivationBuyerTonForge000000000000000000000000001';
  const { session } = service.createPurchaseSession({
    appId: 'app_inner_peace_miniapp',
    buyerWallet,
  });
  const { license } = service.confirmPurchaseSession({
    purchaseSessionId: session.purchaseSessionId,
    buyerWallet,
  });

  const activated = service.activateLicenseDevice({
    licenseId: license.licenseId,
    buyerWallet,
    deviceId: 'surface-pro-11',
  });

  assert.equal(activated.license.state, 'device_bound');
  assert.equal(activated.license.activatedDevices.length, 1);
  assert.equal(activated.license.activatedDevices[0].deviceId, 'surface-pro-11');
});
