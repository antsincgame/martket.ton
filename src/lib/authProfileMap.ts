import type { AuthenticatedUser } from '../types/auth';
import { ROLES } from '../domain/auth/roleCatalog';

export interface ProfileRow {
  id: string;
  email?: string | null;
  ton_address?: string | null;
  name?: string | null;
  display_name?: string | null;
  role?: string | null;
  avatar?: string | null;
  bio?: string | null;
  security_level?: string | null;
  is_active?: boolean;
}

export function profileRowToAuthenticatedUser(row: ProfileRow): AuthenticatedUser {
  const roleKey = row.role || 'demiurge';
  const primaryRole = ROLES[roleKey] ?? ROLES.demiurge;
  const sec = (row.security_level || 'low') as AuthenticatedUser['securityLevel'];

  return {
    id: row.id,
    tonAddress: row.ton_address ?? '',
    email: row.email ?? undefined,
    username: row.name ?? undefined,
    role: primaryRole.name,
    roles: [primaryRole],
    permissions: primaryRole.permissions,
    mfaMethods: [],
    mfaEnabled: false,
    lastLogin: new Date().toISOString(),
    securityLevel: sec,
    securityFlags: [],
    isActive: row.is_active !== false,
    sessionDuration: primaryRole.sessionDuration,
    requiresMFA: primaryRole.requiresMFA,
    description: primaryRole.description,
    profile: {
      displayName: row.display_name || row.name || 'Demiurge',
      bio: row.bio ?? undefined,
      avatar: row.avatar ?? undefined,
    },
    stats: {
      totalSpent: 0,
      totalDonated: 0,
      karmaPoints: 0,
      appsOwned: 0,
      productsPublished: 0,
      totalDownloads: 0,
      donationsReceived: 0,
      avgRating: 0,
      totalReviews: 0,
    },
    library: [],
    products: [],
    achievements: [],
  };
}
