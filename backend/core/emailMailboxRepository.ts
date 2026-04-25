import { Query } from 'node-appwrite';
import { databases } from './db.js';
import { CORE_DATABASE_ID, COL_EMAIL_MAILBOXES } from './constants.js';
import { generateId } from './generateId.js';
import { type AppwriteDoc, asDoc } from '../domain/appwrite-helpers.js';

export interface EmailMailbox {
  id: string;
  mailboxId: string;
  name: string;
  address: string;
  username: string;
  domain: string;
  description: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function mapMailbox(doc: AppwriteDoc): EmailMailbox {
  return {
    id: doc.$id,
    mailboxId: String(doc['mailbox_id'] ?? ''),
    name: String(doc['name'] ?? ''),
    address: String(doc['address'] ?? ''),
    username: String(doc['username'] ?? ''),
    domain: String(doc['domain'] ?? ''),
    description: doc['description'] ? String(doc['description']) : null,
    isActive: Boolean(doc['is_active'] ?? true),
    createdBy: String(doc['created_by'] ?? ''),
    createdAt: doc.$createdAt,
    updatedAt: doc.$updatedAt,
  };
}

export interface CreateMailboxInput {
  name: string;
  username: string;
  domain: string;
  description?: string | null;
  createdBy: string;
}

export interface UpdateMailboxInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export async function createMailbox(input: CreateMailboxInput): Promise<EmailMailbox> {
  const docId = generateId();
  const mailboxId = `mbox_${Date.now()}`;
  const address = `${input.username.toLowerCase().trim()}@${input.domain.toLowerCase().trim()}`;

  await databases().createDocument(CORE_DATABASE_ID, COL_EMAIL_MAILBOXES, docId, {
    mailbox_id: mailboxId,
    name: input.name.trim(),
    address,
    username: input.username.toLowerCase().trim(),
    domain: input.domain.toLowerCase().trim(),
    description: input.description ?? null,
    is_active: true,
    created_by: input.createdBy,
  });

  const created = await findById(docId);
  if (!created) throw new Error('Failed to create mailbox');
  return created;
}

export async function listMailboxes(onlyActive = false): Promise<EmailMailbox[]> {
  const filters = onlyActive
    ? [Query.equal('is_active', true), Query.orderDesc('$createdAt'), Query.limit(100)]
    : [Query.orderDesc('$createdAt'), Query.limit(100)];

  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_EMAIL_MAILBOXES, filters);
  return res.documents.map((d) => mapMailbox(asDoc(d)));
}

export async function findById(id: string): Promise<EmailMailbox | null> {
  try {
    const doc = await databases().getDocument(CORE_DATABASE_ID, COL_EMAIL_MAILBOXES, id);
    return mapMailbox(asDoc(doc));
  } catch {
    return null;
  }
}

export async function findByMailboxId(mailboxId: string): Promise<EmailMailbox | null> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_EMAIL_MAILBOXES, [
    Query.equal('mailbox_id', mailboxId),
    Query.limit(1),
  ]);
  const doc = res.documents[0];
  return doc ? mapMailbox(asDoc(doc)) : null;
}

export async function findByAddress(address: string): Promise<EmailMailbox | null> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_EMAIL_MAILBOXES, [
    Query.equal('address', address.toLowerCase()),
    Query.limit(1),
  ]);
  const doc = res.documents[0];
  return doc ? mapMailbox(asDoc(doc)) : null;
}

export async function updateMailbox(id: string, input: UpdateMailboxInput): Promise<EmailMailbox | null> {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload['name'] = input.name.trim();
  if (input.description !== undefined) payload['description'] = input.description;
  if (input.isActive !== undefined) payload['is_active'] = input.isActive;

  await databases().updateDocument(CORE_DATABASE_ID, COL_EMAIL_MAILBOXES, id, payload);
  return findById(id);
}

export async function deleteMailbox(id: string): Promise<void> {
  await databases().deleteDocument(CORE_DATABASE_ID, COL_EMAIL_MAILBOXES, id);
}
