'use strict';

const express = require('express');
const { Resend } = require('resend');
const { logger } = require('../logger');
const repo = require('../core/repository');
const { requireAdmin: requireAdminRole, apiRequireAuth } = require('../middleware/auth');

const router = express.Router();

let inboundRepoCache = null;
async function getInboundRepo() {
  if (!inboundRepoCache) {
    const mod = await import('../core/inboundEmailRepository.js');
    inboundRepoCache = (mod && typeof mod.listInbound === 'function') ? mod : (mod.default ?? mod);
  }
  return inboundRepoCache;
}

let templateRepoCache = null;
async function getTemplateRepo() {
  if (!templateRepoCache) {
    const mod = await import('../core/emailTemplateRepository.js');
    templateRepoCache = (mod && typeof mod.listTemplates === 'function') ? mod : (mod.default ?? mod);
    await templateRepoCache.seedDefaults();
  }
  return templateRepoCache;
}

let campaignRepoCache = null;
async function getCampaignRepo() {
  if (!campaignRepoCache) {
    const mod = await import('../core/emailCampaignRepository.js');
    // tsx/ESM interop: named exports may live on mod.default when imported from CJS
    campaignRepoCache = (mod && typeof mod.listCampaigns === 'function') ? mod : (mod.default ?? mod);
  }
  return campaignRepoCache;
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

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
        from: process.env.RESEND_FROM || 'TonForge <noreply@tonforge.org>',
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
    try {
      const tmplRepo = await getTemplateRepo();
      const templates = await tmplRepo.listTemplates();
      const data = templates.map((t) => ({
        id: t.templateKey,
        name: t.name,
        subject: t.subject,
        body: t.body,
      }));
      res.json({ success: true, data });
    } catch (err) {
      logger.error('[resend/templates] list failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.put(
  '/templates/:id',
  apiRequireAuth(),
  requireAdminRole,
  async (req, res) => {
    try {
      const tmplRepo = await getTemplateRepo();
      const { subject, body, name } = req.body;
      const updated = await tmplRepo.updateTemplate(req.params.id, { subject, body, name });
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Template not found' });
      }
      res.json({
        success: true,
        data: { id: updated.templateKey, name: updated.name, subject: updated.subject, body: updated.body },
      });
    } catch (err) {
      logger.error('[resend/templates] update failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get(
  '/campaigns',
  apiRequireAuth(),
  requireAdminRole,
  async (_req, res) => {
    try {
      const campRepo = await getCampaignRepo();
      const campaigns = await campRepo.listCampaigns();
      const data = campaigns.map((c) => ({
        id: c.campaignId,
        templateId: c.templateKey,
        templateName: c.templateName,
        audience: c.audience,
        status: c.status,
        recipientCount: c.recipientCount,
        sentCount: c.sentCount,
        scheduledAt: c.scheduledAt,
        createdAt: c.createdAt,
        sentAt: c.sentAt,
      }));
      res.json({ success: true, data });
    } catch (err) {
      logger.error('[resend/campaigns] list failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.delete(
  '/templates/:id',
  apiRequireAuth(),
  requireAdminRole,
  async (req, res) => {
    try {
      const tmplRepo = await getTemplateRepo();
      const deleted = await tmplRepo.deleteTemplate(req.params.id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Template not found' });
      res.json({ success: true });
    } catch (err) {
      logger.error('[resend/templates] delete failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.post(
  '/campaigns',
  apiRequireAuth(),
  requireAdminRole,
  async (req, res) => {
    const { templateId, audience, scheduledAt } = req.body;
    if (!templateId) return res.status(400).json({ success: false, message: 'templateId required' });

    try {
      const tmplRepo = await getTemplateRepo();
      const template = await tmplRepo.findByKey(templateId);
      if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

      const campRepo = await getCampaignRepo();
      const campaign = await campRepo.createCampaign({
        templateKey: templateId,
        templateName: template.name,
        audience: audience || 'all',
        scheduledAt: scheduledAt || null,
        createdBy: req.profile.id,
      });
      if (!campaign) return res.status(500).json({ success: false, message: 'Failed to create campaign' });

      res.json({
        success: true,
        data: {
          id: campaign.campaignId,
          templateId: campaign.templateKey,
          templateName: campaign.templateName,
          audience: campaign.audience,
          status: campaign.status,
          recipientCount: campaign.recipientCount,
          sentCount: campaign.sentCount,
          scheduledAt: campaign.scheduledAt,
          createdAt: campaign.createdAt,
        },
      });
    } catch (err) {
      logger.error('[resend/campaigns] create failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.delete(
  '/campaigns/:id',
  apiRequireAuth(),
  requireAdminRole,
  async (req, res) => {
    try {
      const campRepo = await getCampaignRepo();
      const campaign = await campRepo.findByCampaignId(req.params.id);
      if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
      if (campaign.status === 'sending') {
        return res.status(409).json({ success: false, message: 'Cannot delete a campaign that is currently sending' });
      }
      await campRepo.deleteCampaign(campaign.id);
      res.json({ success: true });
    } catch (err) {
      logger.error('[resend/campaigns] delete failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  },
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

    try {
      const campRepo = await getCampaignRepo();
      const campaign = await campRepo.findByCampaignId(req.params.id);
      if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
      if (campaign.status === 'sent') return res.status(400).json({ success: false, message: 'Campaign already sent' });

      const tmplRepo = await getTemplateRepo();
      const template = await tmplRepo.findByKey(campaign.templateKey);
      if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

      const users = await repo.listUsers();
      const recipients = users
        .filter((u) => u.is_active && u.email)
        .map((u) => u.email);

      await campRepo.updateStatus(campaign.id, 'sending', { recipientCount: recipients.length });

      const from = process.env.RESEND_FROM || 'TonForge <noreply@tonforge.org>';
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

      const updated = await campRepo.updateStatus(campaign.id, 'sent', {
        sentCount,
        sentAt: new Date().toISOString(),
      });
      res.json({
        success: true,
        data: updated
          ? {
              id: updated.campaignId,
              templateId: updated.templateKey,
              templateName: updated.templateName,
              audience: updated.audience,
              status: updated.status,
              recipientCount: updated.recipientCount,
              sentCount: updated.sentCount,
              scheduledAt: updated.scheduledAt,
              createdAt: updated.createdAt,
              sentAt: updated.sentAt,
            }
          : null,
      });
    } catch (err) {
      logger.error('Campaign send failed:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─── Inbound (receiving) emails ─────────────────────────────────────

/**
 * Resend inbound webhook.
 *
 * Resend POSTs `email.received` events here. We validate the svix
 * signature, store metadata in Appwrite, and ack. The full body and
 * attachments are fetched on-demand via the Receiving API.
 *
 * IMPORTANT: this endpoint must NOT be behind apiRequireAuth — Resend
 * authenticates via svix headers, not Appwrite JWT.
 *
 * The `express.raw` middleware below makes `req.body` a Buffer so we can
 * compute the svix signature over the exact bytes Resend sent.
 */
router.post(
  '/webhook/inbound',
  express.raw({ type: 'application/json', limit: '5mb' }),
  async (req, res) => {
    const resend = getResendClient();
    if (!resend) {
      logger.warn('[resend/inbound] webhook hit but RESEND_API_KEY not set');
      return res.status(503).json({ success: false, message: 'Resend not configured' });
    }

    const secret = process.env.RESEND_WEBHOOK_SECRET;
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';

    // Refuse to process unsigned events. Allowing the webhook to run
    // without a secret would let anyone spam our inbox with forged
    // events. Operators must explicitly set RESEND_WEBHOOK_SECRET to
    // enable inbound — otherwise the endpoint replies 503 and Resend
    // retries (so events are not lost; they queue at Resend).
    if (!secret) {
      logger.error('[resend/inbound] RESEND_WEBHOOK_SECRET not set — webhook disabled');
      return res
        .status(503)
        .json({ success: false, message: 'Webhook disabled (RESEND_WEBHOOK_SECRET not configured)' });
    }
    try {
      await resend.webhooks.verify({
        payload: rawBody,
        headers: {
          id: req.get('svix-id') || '',
          timestamp: req.get('svix-timestamp') || '',
          signature: req.get('svix-signature') || '',
        },
        webhookSecret: secret,
      });
    } catch (err) {
      logger.warn('[resend/inbound] webhook signature invalid:', err.message);
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid JSON' });
    }

    if (!event || event.type !== 'email.received' || !event.data) {
      return res.json({ success: true, ignored: true });
    }

    const data = event.data;
    try {
      const inbound = await getInboundRepo();
      await inbound.createOrGetInboundEmail({
        emailId: String(data.email_id || ''),
        messageId: data.message_id ? String(data.message_id) : null,
        from: String(data.from || ''),
        to: Array.isArray(data.to) ? data.to.map(String) : [],
        cc: Array.isArray(data.cc) ? data.cc.map(String) : [],
        subject: data.subject ? String(data.subject) : '',
        receivedAt: data.created_at ? String(data.created_at) : new Date().toISOString(),
        attachments: Array.isArray(data.attachments)
          ? data.attachments.map((a) => ({
              id: String(a.id || ''),
              filename: String(a.filename || ''),
              contentType: String(a.content_type || ''),
              contentDisposition: a.content_disposition ? String(a.content_disposition) : undefined,
              contentId: a.content_id ? String(a.content_id) : undefined,
            }))
          : [],
      });
      return res.json({ success: true });
    } catch (err) {
      logger.error('[resend/inbound] failed to persist event:', err.message);
      // Return 500 so Resend retries delivery.
      return res.status(500).json({ success: false, message: 'Persist failed' });
    }
  },
);

/**
 * Admin: list inbound emails (paginated by `limit`, default 100).
 * Optional filters: `status`, `to` (substring match on recipients).
 */
router.get(
  '/inbox',
  apiRequireAuth(),
  requireAdminRole,
  async (req, res) => {
    try {
      const inbound = await getInboundRepo();
      const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 200);
      const status = req.query.status ? String(req.query.status) : undefined;
      const toAddress = req.query.to ? String(req.query.to) : undefined;
      const items = await inbound.listInbound({ limit, status, toAddress });
      const unread = await inbound.countUnread();
      res.json({ success: true, data: { items, unread } });
    } catch (err) {
      logger.error('[resend/inbox] list failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

/**
 * Admin: fetch full body of a single inbound email from Resend
 * (HTML + text + headers). Marks the local record as read on success.
 */
router.get(
  '/inbox/:id',
  apiRequireAuth(),
  requireAdminRole,
  async (req, res) => {
    const resend = getResendClient();
    if (!resend) {
      return res.status(503).json({ success: false, message: 'Resend not configured' });
    }
    try {
      const inbound = await getInboundRepo();
      const local = await inbound.findById(req.params.id);
      if (!local) return res.status(404).json({ success: false, message: 'Not found' });

      let body = null;
      try {
        const remote = await resend.emails.receiving.get(local.emailId);
        body = remote?.data ?? remote ?? null;
      } catch (err) {
        logger.warn('[resend/inbox] body fetch failed:', err.message);
      }

      if (!local.isRead) {
        await inbound.markRead(local.id, true);
      }
      res.json({ success: true, data: { meta: local, body } });
    } catch (err) {
      logger.error('[resend/inbox/:id] failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

/**
 * Admin: reply to an inbound email — sends via Resend from the address
 * the original email was sent TO, keeping the thread natural.
 */
router.post(
  '/inbox/:id/reply',
  apiRequireAuth(),
  requireAdminRole,
  async (req, res) => {
    const resend = getResendClient();
    if (!resend) {
      return res.status(503).json({ success: false, message: 'Resend not configured' });
    }
    const { body: replyBody, html: replyHtml } = req.body;
    if (!replyBody && !replyHtml) {
      return res.status(400).json({ success: false, message: 'body or html is required' });
    }
    try {
      const inbound = await getInboundRepo();
      const email = await inbound.findById(req.params.id);
      if (!email) return res.status(404).json({ success: false, message: 'Email not found' });

      const senderFrom = process.env.RESEND_FROM || 'TonForge <noreply@tonforge.org>';
      const replyTo = email.to[0] || senderFrom;
      const fromDisplay = replyTo.includes('<') ? replyTo : `TonForge <${replyTo}>`;

      const recipientAddr = email.from.match(/<([^>]+)>/)?.[1] || email.from;

      const result = await resend.emails.send({
        from: fromDisplay,
        to: recipientAddr,
        subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
        ...(replyHtml ? { html: replyHtml } : { text: replyBody }),
        headers: email.messageId ? { 'In-Reply-To': email.messageId, References: email.messageId } : {},
      });

      await inbound.markReplied(email.id);
      res.json({ success: true, data: result });
    } catch (err) {
      logger.error('[resend/inbox] reply failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

/**
 * Admin: compose a brand-new email from any verified domain address.
 */
router.post(
  '/compose',
  apiRequireAuth(),
  requireAdminRole,
  async (req, res) => {
    const resend = getResendClient();
    if (!resend) {
      return res.status(503).json({ success: false, message: 'Resend not configured' });
    }
    const { from, to, subject, body, html } = req.body;
    if (!to || !subject) {
      return res.status(400).json({ success: false, message: 'to and subject are required' });
    }
    if (!body && !html) {
      return res.status(400).json({ success: false, message: 'body or html is required' });
    }
    try {
      const senderFrom = from || process.env.RESEND_FROM || 'TonForge <noreply@tonforge.org>';
      const result = await resend.emails.send({
        from: senderFrom,
        to: Array.isArray(to) ? to : [to],
        subject,
        ...(html ? { html } : { text: body }),
      });
      res.json({ success: true, data: result });
    } catch (err) {
      logger.error('[resend/compose] failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

/**
 * Admin: list verified domain addresses (aliases). Resend catches ALL
 * mail to a verified domain, so any address is valid — but we surface
 * what the Resend API reports for domain verification status.
 */
router.get(
  '/addresses',
  apiRequireAuth(),
  requireAdminRole,
  async (_req, res) => {
    const resend = getResendClient();
    if (!resend) {
      return res.status(503).json({ success: false, message: 'Resend not configured' });
    }
    try {
      const { data: domains } = await resend.domains.list();
      const addresses = (domains || []).map((d) => ({
        domain: d.name,
        status: d.status,
        region: d.region,
        id: d.id,
        catchAll: true,
        suggestedAddresses: [
          `support@${d.name}`,
          `hello@${d.name}`,
          `admin@${d.name}`,
          `noreply@${d.name}`,
          `info@${d.name}`,
        ],
      }));
      res.json({ success: true, data: { domains: addresses, senderFrom: process.env.RESEND_FROM || null } });
    } catch (err) {
      logger.error('[resend/addresses] failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.post(
  '/inbox/:id/archive',
  apiRequireAuth(),
  requireAdminRole,
  async (req, res) => {
    try {
      const inbound = await getInboundRepo();
      const updated = await inbound.archive(req.params.id);
      if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

router.delete(
  '/inbox/:id',
  apiRequireAuth(),
  requireAdminRole,
  async (req, res) => {
    try {
      const inbound = await getInboundRepo();
      await inbound.deleteInbound(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

/**
 * Admin: returns hints for setting up inbound — public webhook URL,
 * MX domain (Resend-managed), DNS instructions.
 *
 * The frontend uses this to render a "how to wire this up" card so the
 * operator doesn't need to read the docs.
 */
router.get(
  '/inbox-setup',
  apiRequireAuth(),
  requireAdminRole,
  async (req, res) => {
    const apiOrigin = (process.env.PUBLIC_API_ORIGIN || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
    res.json({
      success: true,
      data: {
        webhookUrl: `${apiOrigin}/api/admin/resend/webhook/inbound`,
        webhookSecretConfigured: !!process.env.RESEND_WEBHOOK_SECRET,
        senderFrom: process.env.RESEND_FROM || null,
        apiKeyConfigured: !!process.env.RESEND_API_KEY,
      },
    });
  },
);

// ─── Corporate Mailboxes ─────────────────────────────────────────────

let mailboxRepoCache = null;
async function getMailboxRepo() {
  if (!mailboxRepoCache) {
    const mod = await import('../core/emailMailboxRepository.js');
    mailboxRepoCache = (mod && typeof mod.listMailboxes === 'function') ? mod : (mod.default ?? mod);
  }
  return mailboxRepoCache;
}

/**
 * GET /mailboxes — list all corporate mailboxes.
 */
router.get(
  '/mailboxes',
  apiRequireAuth(),
  requireAdminRole,
  async (_req, res) => {
    try {
      const mboxRepo = await getMailboxRepo();
      const mailboxes = await mboxRepo.listMailboxes();
      res.json({ success: true, data: mailboxes });
    } catch (err) {
      logger.error('[resend/mailboxes] list failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

/**
 * POST /mailboxes — create a new corporate mailbox.
 * Body: { name, username, domain, description? }
 *
 * Validates that the domain is verified in Resend before creating.
 */
router.post(
  '/mailboxes',
  apiRequireAuth(),
  requireAdminRole,
  async (req, res) => {
    const { name, username, domain, description } = req.body;
    if (!name || !username || !domain) {
      return res.status(400).json({ success: false, message: 'name, username and domain are required' });
    }

    const usernameClean = username.toLowerCase().trim();
    const domainClean = domain.toLowerCase().trim();
    const usernameRe = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;
    if (!usernameRe.test(usernameClean)) {
      return res.status(400).json({ success: false, message: 'Invalid username format' });
    }

    const resend = getResendClient();
    if (resend) {
      try {
        const { data: domains } = await resend.domains.list();
        const verifiedDomains = (domains || []).map((d) => d.name.toLowerCase());
        if (!verifiedDomains.includes(domainClean)) {
          return res.status(400).json({
            success: false,
            message: `Domain "${domainClean}" is not verified in Resend. Verify the domain first.`,
          });
        }
      } catch (err) {
        logger.warn('[resend/mailboxes] domain check failed, proceeding anyway:', err.message);
      }
    }

    try {
      const mboxRepo = await getMailboxRepo();

      const address = `${usernameClean}@${domainClean}`;
      const existing = await mboxRepo.findByAddress(address);
      if (existing) {
        return res.status(409).json({ success: false, message: `Mailbox ${address} already exists` });
      }

      const mailbox = await mboxRepo.createMailbox({
        name: name.trim(),
        username: usernameClean,
        domain: domainClean,
        description: description ? String(description).trim() : null,
        createdBy: req.profile.id,
      });
      res.status(201).json({ success: true, data: mailbox });
    } catch (err) {
      logger.error('[resend/mailboxes] create failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

/**
 * PUT /mailboxes/:id — update name, description or active status.
 */
router.put(
  '/mailboxes/:id',
  apiRequireAuth(),
  requireAdminRole,
  async (req, res) => {
    const { name, description, isActive } = req.body;
    try {
      const mboxRepo = await getMailboxRepo();
      const updated = await mboxRepo.updateMailbox(req.params.id, {
        ...(name !== undefined && { name: String(name) }),
        ...(description !== undefined && { description: description ? String(description) : null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      });
      if (!updated) return res.status(404).json({ success: false, message: 'Mailbox not found' });
      res.json({ success: true, data: updated });
    } catch (err) {
      logger.error('[resend/mailboxes] update failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

/**
 * DELETE /mailboxes/:id — permanently remove a mailbox.
 */
router.delete(
  '/mailboxes/:id',
  apiRequireAuth(),
  requireAdminRole,
  async (req, res) => {
    try {
      const mboxRepo = await getMailboxRepo();
      const existing = await mboxRepo.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, message: 'Mailbox not found' });
      await mboxRepo.deleteMailbox(req.params.id);
      res.json({ success: true });
    } catch (err) {
      logger.error('[resend/mailboxes] delete failed:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

module.exports = router;
