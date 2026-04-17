import { Query } from 'node-appwrite';
import { databases } from './db.js';
import { CORE_DATABASE_ID, COL_SUPPORT_TICKETS } from './constants.js';
import { generateId } from './generateId.js';
import { type AppwriteDoc, asDoc } from '../domain/appwrite-helpers.js';

export interface TicketMessage {
  authorId: string;
  role: string;
  text: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  productId: string | null;
  assignedTo: string | null;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

function parseMessages(raw: unknown): TicketMessage[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as TicketMessage[]; } catch { return []; }
  }
  return Array.isArray(raw) ? (raw as TicketMessage[]) : [];
}

function mapTicket(doc: AppwriteDoc): SupportTicket {
  return {
    id: doc.$id,
    userId: (doc['user_id'] as string) ?? '',
    subject: (doc['subject'] as string) ?? '',
    category: (doc['category'] as string) ?? 'other',
    status: (doc['status'] as string) ?? 'open',
    priority: (doc['priority'] as string) ?? 'normal',
    productId: (doc['product_id'] as string) ?? null,
    assignedTo: (doc['assigned_to'] as string) ?? null,
    messages: parseMessages(doc['messages']),
    createdAt: doc.$createdAt,
    updatedAt: doc.$updatedAt,
  };
}

export function ticketToSnakeCase(t: SupportTicket): Record<string, unknown> {
  return {
    id: t.id,
    user_id: t.userId,
    subject: t.subject,
    category: t.category,
    status: t.status,
    priority: t.priority,
    product_id: t.productId,
    assigned_to: t.assignedTo,
    messages: t.messages,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

export async function createTicket(data: {
  userId: string;
  subject: string;
  category: string;
  priority?: string;
  productId?: string | null;
  initialMessage: string;
}): Promise<SupportTicket | null> {
  const id = generateId();
  const messages: TicketMessage[] = [{
    authorId: data.userId,
    role: 'user',
    text: data.initialMessage,
    createdAt: new Date().toISOString(),
  }];
  await databases().createDocument(CORE_DATABASE_ID, COL_SUPPORT_TICKETS, id, {
    user_id: data.userId,
    subject: data.subject,
    category: data.category,
    status: 'open',
    priority: data.priority ?? 'normal',
    product_id: data.productId ?? null,
    assigned_to: null,
    messages: JSON.stringify(messages),
  });
  return findTicketById(id);
}

export async function findTicketById(id: string): Promise<SupportTicket | null> {
  try {
    const doc = await databases().getDocument(CORE_DATABASE_ID, COL_SUPPORT_TICKETS, id);
    return mapTicket(asDoc(doc));
  } catch (e: unknown) {
    if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: number }).code === 404) return null;
    throw e;
  }
}

export async function listTicketsByUser(userId: string): Promise<SupportTicket[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_SUPPORT_TICKETS, [
    Query.equal('user_id', userId),
    Query.orderDesc('$updatedAt'),
    Query.limit(100),
  ]);
  return res.documents.map((d) => mapTicket(asDoc(d)));
}

export async function listAllTickets(statusFilter?: string): Promise<SupportTicket[]> {
  const queries = [Query.orderDesc('$updatedAt'), Query.limit(200)];
  if (statusFilter) queries.push(Query.equal('status', statusFilter));
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_SUPPORT_TICKETS, queries);
  return res.documents.map((d) => mapTicket(asDoc(d)));
}

export async function addMessage(ticketId: string, message: TicketMessage): Promise<SupportTicket | null> {
  const ticket = await findTicketById(ticketId);
  if (!ticket) return null;
  const messages = [...ticket.messages, message];
  await databases().updateDocument(CORE_DATABASE_ID, COL_SUPPORT_TICKETS, ticketId, {
    messages: JSON.stringify(messages),
  });
  return findTicketById(ticketId);
}

export async function updateTicket(
  ticketId: string,
  data: { status?: string; priority?: string; assignedTo?: string | null },
): Promise<SupportTicket | null> {
  const updates: Record<string, unknown> = {};
  if (data.status !== undefined) updates.status = data.status;
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.assignedTo !== undefined) updates.assigned_to = data.assignedTo;
  if (Object.keys(updates).length === 0) return findTicketById(ticketId);
  await databases().updateDocument(CORE_DATABASE_ID, COL_SUPPORT_TICKETS, ticketId, updates);
  return findTicketById(ticketId);
}

export async function getTicketStats(): Promise<{ open: number; inProgress: number; resolved: number }> {
  const all = await listAllTickets();
  return {
    open: all.filter((t) => t.status === 'open').length,
    inProgress: all.filter((t) => t.status === 'in_progress').length,
    resolved: all.filter((t) => t.status === 'resolved' || t.status === 'closed').length,
  };
}
