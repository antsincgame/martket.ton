import { Query } from 'node-appwrite';
import { databases } from './db.js';
import { CORE_DATABASE_ID, COL_PROFILES } from './constants.js';
import { generateId } from './generateId.js';
import type { Profile, ProfileId, TonAddress } from '../domain/types.js';
import { type AppwriteDoc, asDoc } from '../domain/appwrite-helpers.js';
import { logger } from '../logger.js';

const ADMIN_EMAILS: ReadonlySet<string> = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

const MODERATOR_EMAILS: ReadonlySet<string> = new Set(
  (process.env.MODERATOR_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

function resolveRole(email: string | null | undefined, fallback: string): string {
  if (!email) return normalizeLegacyRole(fallback);
  const lower = email.toLowerCase();
  if (ADMIN_EMAILS.has(lower)) {
    logger.info(`[auto-promote] ${email} → super_admin (ADMIN_EMAILS match)`);
    return 'super_admin';
  }
  if (MODERATOR_EMAILS.has(lower)) {
    logger.info(`[auto-promote] ${email} → moderator (MODERATOR_EMAILS match)`);
    return 'moderator';
  }
  return normalizeLegacyRole(fallback);
}

function normalizeLegacyRole(role: string): string {
  return role === 'seller' ? 'demiurge' : role;
}

function mapProfile(doc: AppwriteDoc): Profile {
  return {
    id: doc.$id as ProfileId,
    email: (doc['email'] as string) ?? null,
    tonAddress: ((doc['ton_address'] as string) ?? null) as TonAddress | null,
    name: (doc['name'] as string) ?? '',
    displayName: (doc['display_name'] as string) ?? (doc['name'] as string) ?? '',
    role: (doc['role'] as Profile['role']) ?? 'demiurge',
    avatar: (doc['avatar'] as string) ?? null,
    bio: (doc['bio'] as string) ?? null,
    securityLevel: (doc['security_level'] as Profile['securityLevel']) ?? 'low',
    isActive: doc['is_active'] !== false,
    appwriteUserId: (doc['appwrite_user_id'] as string) ?? null,
    clerkUserId: (doc['clerk_user_id'] as string) ?? null,
    slug: (doc['slug'] as string) ?? null,
    bannerUrl: (doc['banner_url'] as string) ?? null,
    website: (doc['website'] as string) ?? null,
    github: (doc['github'] as string) ?? null,
    telegram: (doc['telegram'] as string) ?? null,
    twitter: (doc['twitter'] as string) ?? null,
    aboutLong: (doc['about_long'] as string) ?? null,
    featuredProductIds: (doc['featured_product_ids'] as string) ?? null,
    createdAt: doc.$createdAt,
    updatedAt: doc.$updatedAt,
  };
}

export function profileToSnakeCase(p: Profile): Record<string, unknown> {
  return {
    id: p.id,
    email: p.email,
    ton_address: p.tonAddress,
    name: p.name,
    display_name: p.displayName,
    role: p.role,
    avatar: p.avatar,
    bio: p.bio,
    security_level: p.securityLevel,
    is_active: p.isActive,
    appwrite_user_id: p.appwriteUserId,
    clerk_user_id: p.clerkUserId,
    slug: p.slug,
    banner_url: p.bannerUrl,
    website: p.website,
    github: p.github,
    telegram: p.telegram,
    twitter: p.twitter,
    about_long: p.aboutLong,
    featured_product_ids: p.featuredProductIds,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export async function findUserByTonAddress(tonAddress: string): Promise<Profile | null> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [
    Query.equal('ton_address', tonAddress),
    Query.limit(1),
  ]);
  const doc = res.documents[0];
  return doc ? mapProfile(asDoc(doc)) : null;
}

export async function findUserById(id: string): Promise<Profile | null> {
  try {
    const doc = await databases().getDocument(CORE_DATABASE_ID, COL_PROFILES, id);
    return mapProfile(asDoc(doc));
  } catch (e: unknown) {
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: number }).code === 404) return null;
    throw e;
  }
}

export async function findUserByAppwriteId(appwriteUserId: string): Promise<Profile | null> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [
    Query.equal('appwrite_user_id', appwriteUserId),
    Query.limit(1),
  ]);
  const doc = res.documents[0];
  return doc ? mapProfile(asDoc(doc)) : null;
}

export async function findUserByEmail(email: string): Promise<Profile | null> {
  if (!email) return null;
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [
    Query.equal('email', email),
    Query.limit(1),
  ]);
  const doc = res.documents[0];
  return doc ? mapProfile(asDoc(doc)) : null;
}

export async function findUserByClerkId(clerkUserId: string): Promise<Profile | null> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [
    Query.equal('clerk_user_id', clerkUserId),
    Query.limit(1),
  ]);
  const doc = res.documents[0];
  return doc ? mapProfile(asDoc(doc)) : null;
}

export async function findProfileBySlug(slug: string): Promise<Profile | null> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [
    Query.equal('slug', slug),
    Query.limit(1),
  ]);
  const doc = res.documents[0];
  return doc ? mapProfile(asDoc(doc)) : null;
}

export async function listUsers(): Promise<Profile[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [Query.limit(5000)]);
  return res.documents.map((d) => mapProfile(asDoc(d)));
}

export async function countUsers(): Promise<number> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [Query.limit(1)]);
  return res.total;
}

export async function updateProfile(
  profileId: string,
  data: Record<string, unknown>,
): Promise<Profile | null> {
  await databases().updateDocument(CORE_DATABASE_ID, COL_PROFILES, profileId, data);
  return findUserById(profileId);
}

interface UpsertPayload {
  email?: string | null;
  ton_address?: string | null;
  name?: string | null;
  display_name?: string | null;
  role?: string;
  avatar?: string | null;
  bio?: string | null;
  security_level?: string;
  is_active?: boolean;
}

export async function upsertProfileForClerkUser(
  clerkUserId: string,
  payload: UpsertPayload,
): Promise<Profile | null> {
  let existing = await findUserByClerkId(clerkUserId);
  if (!existing && payload.email) {
    const byEmail = await findUserByEmail(payload.email);
    if (byEmail && !byEmail.clerkUserId) {
      existing = byEmail;
    }
  }

  const effectiveEmail = payload.email ?? existing?.email ?? null;
  const effectiveRole = resolveRole(
    effectiveEmail,
    payload.role ?? existing?.role ?? 'demiurge',
  );

  const data: Record<string, unknown> = {
    clerk_user_id: clerkUserId,
    email: effectiveEmail,
    ton_address: payload.ton_address ?? existing?.tonAddress ?? null,
    name: payload.name ?? existing?.name ?? 'Demiurge',
    display_name:
      payload.display_name ??
      existing?.displayName ??
      payload.name ??
      existing?.name ??
      'Demiurge',
    role: effectiveRole,
    avatar: payload.avatar ?? existing?.avatar ?? null,
    bio: payload.bio ?? existing?.bio ?? null,
    security_level: payload.security_level ?? existing?.securityLevel ?? 'low',
    is_active: payload.is_active !== false,
  };

  if (existing) {
    await databases().updateDocument(CORE_DATABASE_ID, COL_PROFILES, existing.id, data);
    return findUserById(existing.id);
  }
  const id = generateId();
  await databases().createDocument(CORE_DATABASE_ID, COL_PROFILES, id, data);
  return findUserById(id);
}

export async function upsertProfileForAppwriteUser(
  appwriteUserId: string,
  payload: UpsertPayload,
): Promise<Profile | null> {
  const byAccount = await findUserByAppwriteId(appwriteUserId);
  const byEmail = payload.email ? await findUserByEmail(payload.email) : null;
  let existing = byAccount;
  if (!existing && byEmail && !byEmail.appwriteUserId) {
    existing = byEmail;
  }
  if (!existing && byEmail && byEmail.appwriteUserId === appwriteUserId) {
    existing = byEmail;
  }

  const data: Record<string, unknown> = {
    appwrite_user_id: appwriteUserId,
    email: payload.email ?? existing?.email ?? null,
    ton_address: payload.ton_address ?? existing?.tonAddress ?? null,
    name: payload.name ?? existing?.name ?? 'Demiurge',
    display_name:
      payload.display_name ??
      existing?.displayName ??
      payload.name ??
      existing?.name ??
      'Demiurge',
    role: payload.role ?? existing?.role ?? 'demiurge',
    avatar: payload.avatar ?? existing?.avatar ?? null,
    bio: payload.bio ?? existing?.bio ?? null,
    security_level: payload.security_level ?? existing?.securityLevel ?? 'low',
    is_active: payload.is_active !== false,
  };

  if (existing) {
    await databases().updateDocument(CORE_DATABASE_ID, COL_PROFILES, existing.id, data);
    return findUserById(existing.id);
  }
  const id = generateId();
  await databases().createDocument(CORE_DATABASE_ID, COL_PROFILES, id, data);
  return findUserById(id);
}
