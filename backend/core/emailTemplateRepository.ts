import { Query } from 'node-appwrite';
import { databases } from './db.js';
import { CORE_DATABASE_ID, COL_EMAIL_TEMPLATES } from './constants.js';
import { generateId } from './generateId.js';
import { type AppwriteDoc, asDoc } from '../domain/appwrite-helpers.js';

export interface EmailTemplate {
  id: string;
  templateKey: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  createdAt: string;
}

function mapTemplate(doc: AppwriteDoc): EmailTemplate {
  let vars: string[] = [];
  try {
    if (doc['variables']) vars = JSON.parse(String(doc['variables']));
  } catch { /* keep empty */ }
  return {
    id: doc.$id,
    templateKey: String(doc['template_key'] ?? ''),
    name: String(doc['name'] ?? ''),
    subject: String(doc['subject'] ?? ''),
    body: String(doc['body'] ?? ''),
    variables: vars,
    createdAt: doc.$createdAt,
  };
}

export async function listTemplates(): Promise<EmailTemplate[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_EMAIL_TEMPLATES, [
    Query.orderAsc('template_key'),
    Query.limit(100),
  ]);
  return res.documents.map((d) => mapTemplate(asDoc(d)));
}

export async function findByKey(key: string): Promise<EmailTemplate | null> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_EMAIL_TEMPLATES, [
    Query.equal('template_key', key),
    Query.limit(1),
  ]);
  const doc = res.documents[0];
  return doc ? mapTemplate(asDoc(doc)) : null;
}

export async function createTemplate(
  key: string,
  name: string,
  subject: string,
  body: string,
  variables: string[] = [],
): Promise<EmailTemplate | null> {
  const existing = await findByKey(key);
  if (existing) return existing;
  const id = generateId();
  await databases().createDocument(CORE_DATABASE_ID, COL_EMAIL_TEMPLATES, id, {
    template_key: key,
    name,
    subject,
    body,
    variables: JSON.stringify(variables),
  });
  return findByKey(key);
}

export async function updateTemplate(
  key: string,
  updates: { name?: string; subject?: string; body?: string; variables?: string[] },
): Promise<EmailTemplate | null> {
  const existing = await findByKey(key);
  if (!existing) return null;
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload['name'] = updates.name;
  if (updates.subject !== undefined) payload['subject'] = updates.subject;
  if (updates.body !== undefined) payload['body'] = updates.body;
  if (updates.variables !== undefined) payload['variables'] = JSON.stringify(updates.variables);
  if (Object.keys(payload).length > 0) {
    await databases().updateDocument(CORE_DATABASE_ID, COL_EMAIL_TEMPLATES, existing.id, payload);
  }
  return findByKey(key);
}

export async function deleteTemplate(key: string): Promise<boolean> {
  const existing = await findByKey(key);
  if (!existing) return false;
  await databases().deleteDocument(CORE_DATABASE_ID, COL_EMAIL_TEMPLATES, existing.id);
  return true;
}

const DEFAULT_TEMPLATES: Array<{ key: string; name: string; subject: string; body: string; variables: string[] }> = [
  {
    key: 'welcome',
    name: 'Welcome',
    subject: 'Welcome to TON Web Store!',
    body: '<h1>Welcome, {{name}}!</h1><p>Thanks for joining TON Web Store.</p>',
    variables: ['name'],
  },
  {
    key: 'order_confirmation',
    name: 'Order Confirmation',
    subject: 'Your order #{{orderId}} is confirmed',
    body: '<h1>Order Confirmed</h1><p>Thank you for your purchase, {{name}}.</p><p>Order: {{orderId}}</p>',
    variables: ['name', 'orderId'],
  },
  {
    key: 'developer_approved',
    name: 'Developer Approved',
    subject: 'Your developer application has been approved!',
    body: '<h1>Congratulations, {{name}}!</h1><p>You are now a verified developer on TON Web Store.</p>',
    variables: ['name'],
  },
];

let seeded = false;

export async function seedDefaults(): Promise<void> {
  if (seeded) return;
  for (const t of DEFAULT_TEMPLATES) {
    await createTemplate(t.key, t.name, t.subject, t.body, t.variables);
  }
  seeded = true;
}
