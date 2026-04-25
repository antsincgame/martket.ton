import { Query } from 'node-appwrite';
import { databases } from './db.js';
import { CORE_DATABASE_ID, COL_EMAIL_CAMPAIGNS } from './constants.js';
import { generateId } from './generateId.js';
import { type AppwriteDoc, asDoc } from '../domain/appwrite-helpers.js';

export interface EmailCampaign {
  id: string;
  campaignId: string;
  templateKey: string;
  templateName: string;
  audience: string;
  status: 'draft' | 'sending' | 'sent' | 'failed';
  recipientCount: number;
  sentCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdBy: string;
  createdAt: string;
}

function mapCampaign(doc: AppwriteDoc): EmailCampaign {
  return {
    id: doc.$id,
    campaignId: String(doc['campaign_id'] ?? ''),
    templateKey: String(doc['template_key'] ?? ''),
    templateName: String(doc['template_name'] ?? ''),
    audience: String(doc['audience'] ?? 'all'),
    status: (String(doc['status'] ?? 'draft')) as EmailCampaign['status'],
    recipientCount: Number(doc['recipient_count'] ?? 0),
    sentCount: Number(doc['sent_count'] ?? 0),
    scheduledAt: doc['scheduled_at'] ? String(doc['scheduled_at']) : null,
    sentAt: doc['sent_at'] ? String(doc['sent_at']) : null,
    createdBy: String(doc['created_by'] ?? ''),
    createdAt: doc.$createdAt,
  };
}

export interface CreateCampaignInput {
  templateKey: string;
  templateName: string;
  audience: string;
  scheduledAt?: string | null;
  createdBy: string;
}

export async function createCampaign(input: CreateCampaignInput): Promise<EmailCampaign | null> {
  const docId = generateId();
  const campaignId = `camp_${Date.now()}`;
  await databases().createDocument(CORE_DATABASE_ID, COL_EMAIL_CAMPAIGNS, docId, {
    campaign_id: campaignId,
    template_key: input.templateKey,
    template_name: input.templateName,
    audience: input.audience,
    status: 'draft',
    recipient_count: 0,
    sent_count: 0,
    scheduled_at: input.scheduledAt ?? null,
    sent_at: null,
    created_by: input.createdBy,
  });
  return findById(docId);
}

export async function listCampaigns(): Promise<EmailCampaign[]> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_EMAIL_CAMPAIGNS, [
    Query.orderDesc('$createdAt'),
    Query.limit(100),
  ]);
  return res.documents.map((d) => mapCampaign(asDoc(d)));
}

export async function findById(id: string): Promise<EmailCampaign | null> {
  try {
    const doc = await databases().getDocument(CORE_DATABASE_ID, COL_EMAIL_CAMPAIGNS, id);
    return mapCampaign(asDoc(doc));
  } catch {
    return null;
  }
}

export async function findByCampaignId(campaignId: string): Promise<EmailCampaign | null> {
  const res = await databases().listDocuments(CORE_DATABASE_ID, COL_EMAIL_CAMPAIGNS, [
    Query.equal('campaign_id', campaignId),
    Query.limit(1),
  ]);
  const doc = res.documents[0];
  return doc ? mapCampaign(asDoc(doc)) : null;
}

export async function deleteCampaign(id: string): Promise<boolean> {
  try {
    await databases().deleteDocument(CORE_DATABASE_ID, COL_EMAIL_CAMPAIGNS, id);
    return true;
  } catch {
    return false;
  }
}

export async function updateStatus(
  id: string,
  status: EmailCampaign['status'],
  extra?: { recipientCount?: number; sentCount?: number; sentAt?: string },
): Promise<EmailCampaign | null> {
  const payload: Record<string, unknown> = { status };
  if (extra?.recipientCount !== undefined) payload['recipient_count'] = extra.recipientCount;
  if (extra?.sentCount !== undefined) payload['sent_count'] = extra.sentCount;
  if (extra?.sentAt !== undefined) payload['sent_at'] = extra.sentAt;
  await databases().updateDocument(CORE_DATABASE_ID, COL_EMAIL_CAMPAIGNS, id, payload);
  return findById(id);
}
