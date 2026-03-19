'use strict';

const { DATABASE_ID, COL_AUDIT } = require('./constants');
const { databases, ID } = require('./appwrite');

async function writeAudit(actor, action, entityType, entityId, payload) {
  try {
    const db = databases();
    await db.createDocument(DATABASE_ID, COL_AUDIT, ID.unique(), {
      actor: String(actor).slice(0, 128),
      action: String(action).slice(0, 64),
      entityType: String(entityType).slice(0, 32),
      entityId: String(entityId).slice(0, 64),
      payloadJson: payload ? JSON.stringify(payload).slice(0, 12000) : '',
    });
  } catch (e) {
    console.error('[commerce-audit]', e.message);
  }
}

module.exports = { writeAudit };
