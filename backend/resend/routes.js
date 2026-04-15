'use strict';

const express = require('express');
const { Resend } = require('resend');
const { logger } = require('../logger');
const repo = require('../core/repository');
const { requireAdmin: requireAdminRole, apiRequireAuth } = require('../middleware/auth');

const router = express.Router();

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

const TEMPLATES_STORE = new Map([
  ['welcome', { id: 'welcome', name: 'Welcome', subject: 'Welcome to TON Web Store!', body: '<h1>Welcome, {{name}}!</h1><p>Thanks for joining TON Web Store.</p>' }],
  ['order_confirmation', { id: 'order_confirmation', name: 'Order Confirmation', subject: 'Your order #{{orderId}} is confirmed', body: '<h1>Order Confirmed</h1><p>Thank you for your purchase, {{name}}.</p><p>Order: {{orderId}}</p>' }],
  ['developer_approved', { id: 'developer_approved', name: 'Developer Approved', subject: 'Your developer application has been approved!', body: '<h1>Congratulations, {{name}}!</h1><p>You are now a verified developer on TON Web Store.</p>' }],
]);

const CAMPAIGNS_STORE = [];

router.get(
  '/status',
  apiRequireAuth(),
  requireAdminRole,
  async (_req, res) => {
    const resend = getResendClient();
    if (!resend) {
      return res.json({
        success: true,
        data: { connected: false, error: 'RESEND_API_KEY not configured in environment' },
      });
    }

    try {
      const { data: domains } = await resend.domains.list();
      const activeDomain = domains?.find((d) => d.status === 'verified') || domains?.[0];
      res.json({
        success: true,
        data: {
          connected: true,
          domain: activeDomain?.name || null,
          domainStatus: activeDomain?.status || null,
          totalDomains: domains?.length || 0,
        },
      });
    } catch (err) {
      logger.error('Resend status check failed:', err.message);
      res.json({
        success: true,
        data: { connected: false, error: err.message },
      });
    }
  }
);

router.post(
  '/test',
  apiRequireAuth(),
  requireAdminRole,
  async (req, res) => {
    const resend = getResendClient();
    if (!resend) {
      return res.status(400).json({ success: false, message: 'Resend not configured' });
    }

    const { to } = req.body;
    if (!to) return res.status(400).json({ success: false, message: 'to email is required' });

    try {
      const result = await resend.emails.send({
        from: process.env.RESEND_FROM || 'TON Web Store <noreply@tonwebstore.com>',
        to,
        subject: 'Test Email from TON Web Store Admin',
        html: '<h1>Test Email</h1><p>This is a test email from your TON Web Store admin panel. If you received this, Resend is configured correctly!</p>',
      });
      res.json({ success: true, data: result });
    } catch (err) {
      logger.error('Resend test email failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get(
  '/templates',
  apiRequireAuth(),
  requireAdminRole,
  async (_req, res) => {
    res.json({ success: true, data: Array.from(TEMPLATES_STORE.values()) });
  }
);

router.put(
  '/templates/:id',
  apiRequireAuth(),
  requireAdminRole,
  async (req, res) => {
    const template = TEMPLATES_STORE.get(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const { subject, body, name } = req.body;
    if (subject) template.subject = subject;
    if (body) template.body = body;
    if (name) template.name = name;
    TEMPLATES_STORE.set(req.params.id, template);

    res.json({ success: true, data: template });
  }
);

router.get(
  '/campaigns',
  apiRequireAuth(),
  requireAdminRole,
  async (_req, res) => {
    res.json({ success: true, data: CAMPAIGNS_STORE });
  }
);

router.post(
  '/campaigns',
  apiRequireAuth(),
  requireAdminRole,
  async (req, res) => {
    const { templateId, audience, scheduledAt } = req.body;
    if (!templateId) return res.status(400).json({ success: false, message: 'templateId required' });

    const template = TEMPLATES_STORE.get(templateId);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    const campaign = {
      id: `camp_${Date.now()}`,
      templateId,
      templateName: template.name,
      audience: audience || 'all',
      status: 'draft',
      recipientCount: 0,
      sentCount: 0,
      scheduledAt: scheduledAt || null,
      createdAt: new Date().toISOString(),
      createdBy: req.profile.id,
    };

    CAMPAIGNS_STORE.push(campaign);
    res.json({ success: true, data: campaign });
  }
);

router.post(
  '/campaigns/:id/send',
  apiRequireAuth(),
  requireAdminRole,
  async (req, res) => {
    const resend = getResendClient();
    if (!resend) {
      return res.status(400).json({ success: false, message: 'Resend not configured' });
    }

    const campaign = CAMPAIGNS_STORE.find((c) => c.id === req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    if (campaign.status === 'sent') return res.status(400).json({ success: false, message: 'Campaign already sent' });

    const template = TEMPLATES_STORE.get(campaign.templateId);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    try {
      const users = await repo.listUsers();
      const recipients = users
        .filter((u) => u.is_active && u.email)
        .map((u) => u.email);

      campaign.recipientCount = recipients.length;
      campaign.status = 'sending';

      const from = process.env.RESEND_FROM || 'TON Web Store <noreply@tonwebstore.com>';
      let sentCount = 0;

      const BATCH_SIZE = 50;
      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);
        const promises = batch.map((to) =>
          resend.emails.send({
            from,
            to,
            subject: template.subject,
            html: template.body,
          }).then(() => { sentCount++; }).catch((err) => {
            logger.warn(`Failed to send to ${to}:`, err.message);
          })
        );
        await Promise.all(promises);
      }

      campaign.sentCount = sentCount;
      campaign.status = 'sent';
      campaign.sentAt = new Date().toISOString();

      res.json({ success: true, data: campaign });
    } catch (err) {
      campaign.status = 'failed';
      logger.error('Campaign send failed:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;
