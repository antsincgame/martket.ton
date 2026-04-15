'use strict';

const { getAuth } = require('@clerk/express');
const { logger } = require('../logger');
const repo = require('../core/repository');

async function resolveProfile(req) {
  const auth = getAuth(req);
  if (!auth || !auth.userId) return null;
  return repo.findUserByClerkId(auth.userId);
}

function requireAdmin(req, res, next) {
  resolveProfile(req).then((profile) => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    req.profile = profile;
    next();
  }).catch((err) => {
    logger.error('requireAdmin error:', err.message);
    res.status(500).json({ success: false, message: 'Internal error' });
  });
}

function isAdminRole(role) {
  return role === 'admin' || role === 'super_admin';
}

function apiRequireAuth() {
  return (req, res, next) => {
    try {
      const auth = getAuth(req);
      if (!auth || !auth.userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      next();
    } catch (err) {
      logger.error('Auth verification failed:', err.message);
      return res.status(401).json({ success: false, message: 'Authentication failed' });
    }
  };
}

module.exports = { resolveProfile, requireAdmin, isAdminRole, apiRequireAuth };
