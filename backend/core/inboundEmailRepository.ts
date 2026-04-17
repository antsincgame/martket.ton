import { Query } from 'node-appwrite';
import { databases } from './db.js';
import { CORE_DATABASE_ID, COL_INBOUND_EMAILS } from './constants.js';
import { generateId } from './generateId.js';
import { type AppwriteDoc, asDoc } from '../domain/appwrite-helpers.js';

export interface InboundAttachmentMeta {
  id: string;
  filename: string;
  contentType: string;
  contentDisposition?: string;
  contentId?: string;
}

export interface InboundEmail {
  id: string;
  emailId: string;
  messageId: string | null;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  receivedAt: string;
  attachments: InboundAttachmentMeta[];
  previewText: string | null;
  status: 'new' | 'read' | 'replied' | 'archived';
  isRead: boolean;
  assignedTo: string | null;
  createdAt: string;
}

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function mapInbound(doc: AppwriteDoc): InboundEmail {
  return {
    id: doc.$id,
    emailId: (doc['email_id'] as string) ?? '',
    messageId: (doc['message_id'] as string) ?? null,
    from: (doc['from_address'] as string) ?? '',
    to: safeJsonParse<string[]>(doc['to_address'], []),
    cc: safeJsonParse<string[]>(doc['cc_address'], []),
    subject: (doc['subject'] as string) ?? '',
    receivedAt: (doc['received_at'] as string) ?? doc.$createdAt,
    attachments: safeJsonParse<InboundAttachmentMeta[]>(doc['attachments_meta'], []),
    previewText: (doc['preview_text'] as string) ?? null,
    status: ((doc['status'] as string) ?? 'new') as InboundEmail['status'],
    isRead: Boolean(doc['is_read']),
    assignedTo: (doc['assigned_to'] as string) ?? null,
    createdAt: doc.$createdAt,
  };
}

export interface CreateInboundEmailInput {
  emailId: string;
  messageId?: string | null;
  from: string;
  to: string[];
  cc?: string[];
  subject?: string;
  receivedAt: string;
  attachments?: InboundAttachmentMeta[];
}

/**
 * Creates an inbound email record. If `email_id` already exists (Resend
 * retried the same webhook), returns the existing record instead of
 * throwing — this keeps the webhook handler idempotent.
 */
export async function createOrGetInboundEmail(
  input: CreateInboundEmailInput,
): Promise<InboundEmail | null> {
  const existing = await findByEmailId(input.emailId);
  if (existing) return existing;

  const id = generateId();
  await databases().createDocument(CORE_DATABASE_ID, COL_INBOUND_EMAILS, id, {
    email_id: input.emailId,
    message_id: input.messageId ?? null,
    from_address: input.from.slice(0, 320),
    to_address: JSON.stringify(input.to),
    cc_address: JSON.stringify(input.cc ?? []),
    subject: (input.subject ?? '').slice(0, 1024),
    received_at: input.receivedAt,
    attachments_meta: JSON.stringify(input.attachments ?? []),
    preview_text: null,
    status: 'new',
    is_read: false,
    assigned_to: null,
  });
  return findById(id);
}

export async function findById(id: string): Promise<InboundEmail | null> {
  try {
    const doc = await databases().getDocument(CORE_DATABASE_ID, COL_INBOUND_EMAILS, id);
    return mapInbound(asDoc(doc));
  } catch {
    return null;
  }
}

export async function findByEmailId(emailId: string): Promise<InboundEmail | null> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_INBOUND_EMAILS, [
    Query.equal('email_id', emailId),
    Query.limit(1),
  ]);
  const doc = res.documents[0];
  return doc ? mapInbound(asDoc(doc)) : null;
}

export interface ListInboundOptions {
  limit?: number;
  status?: InboundEmail['status'];
  toAddress?: string;
}

export async function listInbound(opts: ListInboundOptions = {}): Promise<InboundEmail[]> {
  const queries = [Query.orderDesc('received_at'), Query.limit(Math.min(opts.limit ?? 100, 200))];
  if (opts.status) queries.push(Query.equal('status', opts.status));
  if (opts.toAddress) queries.push(Query.contains('to_address', opts.toAddress));
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_INBOUND_EMAILS, queries);
  return res.documents.map((d) => mapInbound(asDoc(d)));
}

export async function markRead(id: string, isRead: boolean): Promise<InboundEmail | null> {
  await databases().updateDocument(CORE_DATABASE_ID, COL_INBOUND_EMAILS, id, {
    is_read: isRead,
    status: isRead ? 'read' : 'new',
  });
  return findById(id);
}

export async function archive(id: string): Promise<InboundEmail | null> {
  await databases().updateDocument(CORE_DATABASE_ID, COL_INBOUND_EMAILS, id, {
    status: 'archived',
    is_read: true,
  });
  return findById(id);
}

export async function deleteInbound(id: string): Promise<void> {
  await databases().deleteDocument(CORE_DATABASE_ID, COL_INBOUND_EMAILS, id);
}

export async function countUnread(): Promise<number> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_INBOUND_EMAILS, [
    Query.equal('is_read', false),
    Query.limit(1),
  ]);
  return res.total ?? 0;
}
