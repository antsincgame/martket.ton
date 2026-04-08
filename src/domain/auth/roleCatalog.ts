// Каталог ролей вынесен из AuthContext, чтобы маппить профили Appwrite без циклических импортов.
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
    ],
    sessionDuration: 360,
    requiresMFA: false,
    description: 'Content moderator ensuring marketplace harmony',
  },
  developer: {
    id: 'developer',
    name: 'developer',
    permissions: [
      { resource: 'products', actions: ['create', 'read', 'update'], conditions: { owner: true } },
      { resource: 'analytics', actions: ['read'], conditions: { owner: true } },
    ],
    sessionDuration: 480,
    requiresMFA: false,
    description: 'Sacred developer creating digital treasures',
  },
  support: {
    id: 'support',
    name: 'support',
    permissions: [
      { resource: 'users', actions: ['read'] },
      { resource: 'tickets', actions: ['create', 'read', 'update'] },
    ],
    sessionDuration: 1440,
    requiresMFA: false,
    description: 'Compassionate support helping users',
  },
  analyst: {
    id: 'analyst',
    name: 'analyst',
    permissions: [
      { resource: 'analytics', actions: ['read'] },
      { resource: 'reports', actions: ['create', 'read'] },
    ],
    sessionDuration: 480,
    requiresMFA: false,
    description: 'Data analyst seeking marketplace insights',
  },
  viewer: {
    id: 'viewer',
    name: 'viewer',
    permissions: [{ resource: 'dashboard', actions: ['read'] }],
    sessionDuration: 240,
    requiresMFA: false,
    description: 'Observer with read-only access',
  },
  auditor: {
    id: 'auditor',
    name: 'auditor',
    permissions: [
      { resource: 'audit_logs', actions: ['read'] },
      { resource: 'security_events', actions: ['read'] },
    ],
    sessionDuration: 120,
    requiresMFA: true,
    description: 'Security auditor monitoring system integrity',
  },
  user: {
    id: 'user',
    name: 'user',
    permissions: [
      { resource: 'dashboard', actions: ['read'] },
      { resource: 'products', actions: ['read'] },
    ],
    sessionDuration: 480,
    requiresMFA: false,
    description: 'Standard marketplace user',
  },
};
