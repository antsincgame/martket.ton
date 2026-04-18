import type { UserRole } from '../../types/auth';

export const ROLES: Record<string, UserRole> = {
  super_admin: {
    id: 'super_admin',
    name: 'super_admin',
    permissions: [{ resource: '*', actions: ['create', 'read', 'update', 'delete', 'approve', 'ban'] }],
    sessionDuration: 120,
    requiresMFA: true,
    description: 'Supreme cosmic administrator with all divine permissions',
  },
  admin: {
    id: 'admin',
    name: 'admin',
    permissions: [
      { resource: 'users', actions: ['create', 'read', 'update', 'ban'] },
      { resource: 'products', actions: ['create', 'read', 'update', 'delete', 'approve'] },
      { resource: 'categories', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'donations', actions: ['read', 'approve'] },
    ],
    sessionDuration: 240,
    requiresMFA: true,
    description: 'Administrative guardian with elevated access',
  },
  moderator: {
    id: 'moderator',
    name: 'moderator',
    permissions: [
      { resource: 'products', actions: ['read', 'update', 'approve'] },
      { resource: 'users', actions: ['read', 'ban'] },
      { resource: 'reviews', actions: ['read', 'update', 'delete'] },
      { resource: 'support_tickets', actions: ['read', 'update'] },
      { resource: 'analytics', actions: ['read'] },
    ],
    sessionDuration: 360,
    requiresMFA: false,
    description: 'Content moderator and support agent ensuring marketplace harmony',
  },
  demiurge: {
    id: 'demiurge',
    name: 'demiurge',
    permissions: [
      { resource: 'products', actions: ['create', 'read', 'update'] },
      { resource: 'listings', actions: ['create', 'read', 'update'] },
      { resource: 'orders', actions: ['read', 'update'] },
      { resource: 'purchases', actions: ['create', 'read'] },
      { resource: 'dashboard', actions: ['read'] },
      { resource: 'support_tickets', actions: ['create', 'read'] },
    ],
    sessionDuration: 480,
    requiresMFA: false,
    description: 'Creator, seller and consumer of digital realms',
  },
  viewer: {
    id: 'viewer',
    name: 'viewer',
    permissions: [{ resource: 'dashboard', actions: ['read'] }],
    sessionDuration: 240,
    requiresMFA: false,
    description: 'Observer with read-only access',
  },
};
