'use strict';

const { Webhook } = require('svix');
const { logger } = require('../logger');
const repo = require('../core/repository');

module.exports = async function clerkWebhookHandler(req, res) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    logger.error('CLERK_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  const svixId = req.headers['svix-id'];
  const svixTimestamp = req.headers['svix-timestamp'];
  const svixSignature = req.headers['svix-signature'];

  if (!svixId || !svixTimestamp || !svixSignature) {
    return res.status(400).json({ error: 'Missing svix headers' });
  }

  let evt;
  try {
    const wh = new Webhook(WEBHOOK_SECRET);
    evt = wh.verify(req.body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
  } catch (err) {
    logger.warn('Clerk webhook verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const { type, data } = evt;
  logger.info(`Clerk webhook: ${type}`, { userId: data.id });

  try {
    switch (type) {
      case 'user.created': {
        const email = data.email_addresses?.[0]?.email_address || null;
        const name =
          [data.first_name, data.last_name].filter(Boolean).join(' ') ||
          data.username ||
          'User';
        await repo.upsertProfileForClerkUser(data.id, {
          email,
          name,
          avatar: data.image_url || null,
          role: 'user',
          is_active: true,
        });
        logger.info(`Profile created for Clerk user ${data.id}`);
        break;
      }

      case 'user.updated': {
        const email = data.email_addresses?.[0]?.email_address || null;
        const name =
          [data.first_name, data.last_name].filter(Boolean).join(' ') ||
          data.username ||
          'User';
        await repo.upsertProfileForClerkUser(data.id, {
          email,
          name,
          avatar: data.image_url || null,
        });
        logger.info(`Profile updated for Clerk user ${data.id}`);
        break;
      }

      case 'user.deleted': {
        const profile = await repo.findUserByClerkId(data.id);
        if (profile) {
          await repo.updateProfileField(profile.id, 'is_active', false);
          logger.info(`Profile deactivated for Clerk user ${data.id}`);
        }
        break;
      }

      default:
        logger.info(`Unhandled Clerk webhook type: ${type}`);
    }
  } catch (err) {
    logger.error(`Clerk webhook handler error for ${type}:`, err);
    return res.status(500).json({ error: 'Internal error processing webhook' });
  }

  res.json({ received: true });
};
