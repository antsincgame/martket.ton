import { Query } from 'node-appwrite';
import { databases } from './db.js';
import { CORE_DATABASE_ID, COL_PROFILES } from './constants.js';
import { generateId } from './generateId.js';
import type { Profile, ProfileId, TonAddress } from '../domain/types.js';
import { type AppwriteDoc, asDoc } from '../domain/appwrite-helpers.js';
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
    role: normalizeLegacyRole((doc['role'] as string) ?? 'demiurge') as Profile['role'],
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
    verified: doc['verified'] === true,
    trustScore: (doc['trust_score'] as number) ?? 0,
    publishedCount: (doc['published_count'] as number) ?? 0,
    rejectionCount: (doc['rejection_count'] as number) ?? 0,
    kycLiteFirstName: (doc['kyc_lite_first_name'] as string) ?? null,
    kycLiteLastName: (doc['kyc_lite_last_name'] as string) ?? null,
    kycLiteDateOfBirth: (doc['kyc_lite_date_of_birth'] as string) ?? null,
    kycLiteCountryCode: (doc['kyc_lite_country_code'] as string) ?? null,
    kycLiteCity: (doc['kyc_lite_city'] as string) ?? null,
    kycLiteConsentAt: (doc['kyc_lite_consent_at'] as string) ?? null,
    kycLiteCompletedAt: (doc['kyc_lite_completed_at'] as string) ?? null,
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
    verified: p.verified,
    trust_score: p.trustScore,
    published_count: p.publishedCount,
    rejection_count: p.rejectionCount,
    kyc_lite_first_name: p.kycLiteFirstName,
    kyc_lite_last_name: p.kycLiteLastName,
    kyc_lite_date_of_birth: p.kycLiteDateOfBirth,
    kyc_lite_country_code: p.kycLiteCountryCode,
    kyc_lite_city: p.kycLiteCity,
    kyc_lite_consent_at: p.kycLiteConsentAt,
    kyc_lite_completed_at: p.kycLiteCompletedAt,
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

/**
 * Find-or-create a profile for an Appwrite Account user.
 *
 * GoD principle: one email = one profile. If a profile already exists for
 * this email (from a different auth method, e.g. OTP vs GitHub OAuth),
 * we merge by updating the existing document with the new `appwrite_user_id`.
 * This prevents duplicate accounts and preserves purchases, trust_score, etc.
 *
 * Race-condition safety: if two concurrent requests both try to create a
 * profile for the same user, the unique index on `appwrite_user_id` causes
 * the second insert to fail. We catch that and retry the lookup.
 */
export async function upsertProfileForAppwriteUser(
  appwriteUserId: string,
  payload: UpsertPayload,
): Promise<Profile | null> {
  const doUpsert = async (): Promise<Profile | null> => {
    const byAccount = await findUserByAppwriteId(appwriteUserId);
    const byEmail = payload.email ? await findUserByEmail(payload.email) : null;
    const existing = byAccount ?? byEmail ?? null;

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
      role: normalizeLegacyRole(payload.role ?? existing?.role ?? 'demiurge'),
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
  };

  try {
    return await doUpsert();
  } catch (e: unknown) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code: number }).code : 0;
    if (code === 409) {
      // Unique constraint hit — another request won the race. Retry the
      // lookup so we return the already-created profile instead of failing.
      const retried = await findUserByAppwriteId(appwriteUserId);
      if (retried) return retried;
    }
    throw e;
  }
}
