// Доступ к коллекциям Appwrite (database core) вместо SQLite.
'use strict';

const { Databases, Query } = require('node-appwrite');
const { createServerClient } = require('./appwriteServer');
const {
  CORE_DATABASE_ID,
  COL_PROFILES,
  COL_DEVELOPERS,
  COL_LEGACY_PRODUCTS,
  COL_AUDIT_LOGS,
} = require('./constants');
const { generateId } = require('./generateId');

let _databases;

function databases() {
  if (!_databases) {
    _databases = new Databases(createServerClient());
  }
  return _databases;
}

function mapProfile(doc) {
  return {
    id: doc.$id,
    email: doc.email ?? null,
    ton_address: doc.ton_address ?? null,
    name: doc.name ?? '',
    role: doc.role ?? 'user',
    avatar: doc.avatar ?? null,
    bio: doc.bio ?? null,
    security_level: doc.security_level ?? 'low',
    is_active: doc.is_active !== false,
    appwrite_user_id: doc.appwrite_user_id ?? null,
    clerk_user_id: doc.clerk_user_id ?? null,
    created_at: doc.$createdAt,
    updated_at: doc.$updatedAt,
  };
}

function mapDeveloper(doc) {
  return {
    id: doc.$id,
    user_id: doc.user_id ?? null,
    name: doc.name,
    email: doc.email,
    description: doc.description ?? null,
    ton_address: doc.ton_address ?? null,
    status: doc.status ?? 'pending',
    created_at: doc.$createdAt,
    updated_at: doc.$updatedAt,
  };
}

function mapProduct(doc) {
  return {
    id: doc.$id,
    developer_id: doc.developer_id ?? null,
    name: doc.name,
    description: doc.description ?? null,
    short_description: doc.short_description ?? null,
    price_ton: doc.price_ton ?? 0,
    category: doc.category ?? 'other',
    image: doc.image ?? null,
    rating: doc.rating ?? 0,
    reviews_count: doc.reviews_count ?? 0,
    downloads: doc.downloads ?? 0,
    status: doc.status ?? 'draft',
    created_at: doc.$createdAt,
    updated_at: doc.$updatedAt,
  };
}

function mapAudit(doc) {
  return {
    id: doc.$id,
    user_id: doc.user_id ?? null,
    action: doc.action,
    resource: doc.resource,
    resource_id: doc.resource_id ?? null,
    result: doc.result ?? 'success',
    metadata: doc.metadata ?? null,
    ip_address: doc.ip_address ?? null,
    user_agent: doc.user_agent ?? null,
    created_at: doc.$createdAt,
  };
}

async function findUserByTonAddress(tonAddress) {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [
    Query.equal('ton_address', tonAddress),
    Query.limit(1),
  ]);
  return res.documents[0] ? mapProfile(res.documents[0]) : null;
}

async function findUserById(id) {
  try {
    const doc = await databases().getDocument(CORE_DATABASE_ID, COL_PROFILES, id);
    return mapProfile(doc);
  } catch (e) {
    if (e.code === 404) return null;
    throw e;
  }
}

async function findUserByAppwriteId(appwriteUserId) {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [
    Query.equal('appwrite_user_id', appwriteUserId),
    Query.limit(1),
  ]);
  return res.documents[0] ? mapProfile(res.documents[0]) : null;
}

async function findUserByEmail(email) {
  if (!email) return null;
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [
    Query.equal('email', email),
    Query.limit(1),
  ]);
  return res.documents[0] ? mapProfile(res.documents[0]) : null;
}

async function insertUser(row) {
  const id = row.id || generateId();
  await databases().createDocument(CORE_DATABASE_ID, COL_PROFILES, id, {
    email: row.email,
    ton_address: row.ton_address,
    name: row.name,
    role: row.role,
    avatar: row.avatar,
    bio: row.bio,
    security_level: row.security_level,
    is_active: row.is_active !== 0 && row.is_active !== false,
    appwrite_user_id: row.appwrite_user_id ?? null,
  });
  return findUserById(id);
}

async function listUsers() {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [Query.limit(5000)]);
  return res.documents.map(mapProfile);
}

async function countUsers() {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [Query.limit(1)]);
  return res.total;
}

async function listDevelopers() {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_DEVELOPERS, [
    Query.orderDesc('$createdAt'),
    Query.limit(5000),
  ]);
  return res.documents.map(mapDeveloper);
}

async function findDeveloperById(id) {
  try {
    const doc = await databases().getDocument(CORE_DATABASE_ID, COL_DEVELOPERS, id);
    return mapDeveloper(doc);
  } catch (e) {
    if (e.code === 404) return null;
    throw e;
  }
}

async function findDeveloperByEmail(email) {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_DEVELOPERS, [
    Query.equal('email', email),
    Query.limit(1),
  ]);
  return res.documents[0] ? mapDeveloper(res.documents[0]) : null;
}

async function insertDeveloper(row) {
  const id = row.id || generateId();
  await databases().createDocument(CORE_DATABASE_ID, COL_DEVELOPERS, id, {
    user_id: row.user_id,
    name: row.name,
    email: row.email,
    description: row.description,
    ton_address: row.ton_address,
    status: row.status ?? 'pending',
  });
  return findDeveloperById(id);
}

async function deleteDeveloperById(id) {
  await databases().deleteDocument(CORE_DATABASE_ID, COL_DEVELOPERS, id);
}

async function listProductsByStatus(status) {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, [
    Query.equal('status', status),
    Query.orderDesc('$createdAt'),
    Query.limit(5000),
  ]);
  return res.documents.map(mapProduct);
}

async function listAllProducts() {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, [
    Query.orderDesc('$createdAt'),
    Query.limit(5000),
  ]);
  return res.documents.map(mapProduct);
}

async function findProductById(id) {
  try {
    const doc = await databases().getDocument(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, id);
    return mapProduct(doc);
  } catch (e) {
    if (e.code === 404) return null;
    throw e;
  }
}

async function insertProduct(row) {
  const id = row.id || generateId();
  await databases().createDocument(CORE_DATABASE_ID, COL_LEGACY_PRODUCTS, id, {
    developer_id: row.developer_id,
    name: row.name,
    description: row.description,
    short_description: row.short_description,
    price_ton: row.price_ton,
    category: row.category,
    image: row.image,
    rating: row.rating ?? 0,
    reviews_count: row.reviews_count ?? 0,
    downloads: row.downloads ?? 0,
    status: row.status ?? 'draft',
  });
  return findProductById(id);
}

async function insertAuditLog(row) {
  const id = row.id || generateId();
  await databases().createDocument(CORE_DATABASE_ID, COL_AUDIT_LOGS, id, {
    user_id: row.user_id,
    action: row.action,
    resource: row.resource,
    resource_id: row.resource_id,
    result: row.result,
    metadata: row.metadata,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
  });
}

async function listAuditLogs(limit) {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_AUDIT_LOGS, [
    Query.orderDesc('$createdAt'),
    Query.limit(limit),
  ]);
  return res.documents.map(mapAudit);
}

async function findUserByClerkId(clerkUserId) {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_PROFILES, [
    Query.equal('clerk_user_id', clerkUserId),
    Query.limit(1),
  ]);
  return res.documents[0] ? mapProfile(res.documents[0]) : null;
}

async function updateProfileField(profileId, field, value) {
  await databases().updateDocument(CORE_DATABASE_ID, COL_PROFILES, profileId, { [field]: value });
}

async function upsertProfileForClerkUser(clerkUserId, payload) {
  let existing = await findUserByClerkId(clerkUserId);
  if (!existing && payload.email) {
    const byEmail = await findUserByEmail(payload.email);
    if (byEmail && !byEmail.clerk_user_id) {
      existing = byEmail;
    }
  }

  const data = {
    clerk_user_id: clerkUserId,
    email: payload.email ?? existing?.email ?? null,
    ton_address: payload.ton_address ?? existing?.ton_address ?? null,
    name: payload.name ?? existing?.name ?? 'User',
    role: payload.role ?? existing?.role ?? 'user',
    avatar: payload.avatar ?? existing?.avatar ?? null,
    bio: payload.bio ?? existing?.bio ?? null,
    security_level: payload.security_level ?? existing?.security_level ?? 'low',
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

async function upsertProfileForAppwriteUser(appwriteUserId, payload) {
  const byAccount = await findUserByAppwriteId(appwriteUserId);
  const byEmail = payload.email ? await findUserByEmail(payload.email) : null;
  let existing = byAccount;
  if (!existing && byEmail && !byEmail.appwrite_user_id) {
    existing = byEmail;
  }
  if (!existing && byEmail && byEmail.appwrite_user_id === appwriteUserId) {
    existing = byEmail;
  }

  const data = {
    appwrite_user_id: appwriteUserId,
    email: payload.email ?? existing?.email ?? null,
    ton_address: payload.ton_address ?? existing?.ton_address ?? null,
    name: payload.name ?? existing?.name ?? 'User',
    role: payload.role ?? existing?.role ?? 'user',
    avatar: payload.avatar ?? existing?.avatar ?? null,
    bio: payload.bio ?? existing?.bio ?? null,
    security_level: payload.security_level ?? existing?.security_level ?? 'low',
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

module.exports = {
  generateId,
  mapProfile,
  findUserByTonAddress,
  findUserById,
  findUserByAppwriteId,
  findUserByEmail,
  findUserByClerkId,
  updateProfileField,
  upsertProfileForClerkUser,
  insertUser,
  listUsers,
  countUsers,
  listDevelopers,
  findDeveloperById,
  findDeveloperByEmail,
  insertDeveloper,
  deleteDeveloperById,
  listProductsByStatus,
  listAllProducts,
  findProductById,
  insertProduct,
  insertAuditLog,
  listAuditLogs,
  upsertProfileForAppwriteUser,
};
