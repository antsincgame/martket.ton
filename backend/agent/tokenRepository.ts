/**
 * Persistence layer for Agent API Personal Access Tokens.
 *
 * Tokens live in Appwrite (`COL_AGENT_TOKENS`) as opaque records keyed by
 * `tokenHash` (sha256 of the plaintext). The plaintext never reaches
 * storage. The `tokenPrefix` field lets the UI render a human-friendly
 * fragment ("tfa_AbCd...") without exposing the secret.
 */

import { databases, ID, Query } from '../commerce/appwrite.js';
import { DATABASE_ID, COL_AGENT_TOKENS } from '../commerce/constants.js';

export interface AgentTokenRecord {
  $id: string;
  wallet: string;
  tokenHash: string;
  tokenPrefix: string;
  name: string;
  scopes: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  $createdAt: string;
  $updatedAt: string;
}

function fromDoc(doc: Record<string, unknown>): AgentTokenRecord {
  return {
    $id: String(doc.$id),
    wallet: String(doc.wallet || ''),
    tokenHash: String(doc.tokenHash || ''),
    tokenPrefix: String(doc.tokenPrefix || ''),
    name: String(doc.name || ''),
    scopes: String(doc.scopes || ''),
    lastUsedAt: (doc.lastUsedAt as string | undefined) || null,
    expiresAt: (doc.expiresAt as string | undefined) || null,
    revokedAt: (doc.revokedAt as string | undefined) || null,
    $createdAt: String(doc.$createdAt || ''),
    $updatedAt: String(doc.$updatedAt || ''),
  };
}

export interface CreateAgentTokenInput {
  wallet: string;
  tokenHash: string;
  tokenPrefix: string;
  name: string;
  scopes: string;
  expiresAt: string | null;
}

export async function createAgentToken(input: CreateAgentTokenInput): Promise<AgentTokenRecord> {
  const doc = await databases().createDocument(DATABASE_ID, COL_AGENT_TOKENS, ID.unique(), {
    wallet: input.wallet,
    tokenHash: input.tokenHash,
    tokenPrefix: input.tokenPrefix,
    name: input.name,
    scopes: input.scopes,
    expiresAt: input.expiresAt,
  });
  return fromDoc(doc);
}

export async function findAgentTokenByHash(tokenHash: string): Promise<AgentTokenRecord | null> {
  const { documents } = await databases().listDocuments(DATABASE_ID, COL_AGENT_TOKENS, [
    Query.equal('tokenHash', [tokenHash]),
    Query.limit(1),
  ]);
  return documents[0] ? fromDoc(documents[0]) : null;
}

export async function listAgentTokensForWallet(wallet: string, limit = 50): Promise<AgentTokenRecord[]> {
  const { documents } = await databases().listDocuments(DATABASE_ID, COL_AGENT_TOKENS, [
    Query.equal('wallet', [wallet]),
    Query.orderDesc('$createdAt'),
    Query.limit(Math.min(limit, 100)),
  ]);
  return documents.map(fromDoc);
}

export async function getAgentTokenById(id: string): Promise<AgentTokenRecord | null> {
  try {
    const doc = await databases().getDocument(DATABASE_ID, COL_AGENT_TOKENS, id);
    return fromDoc(doc);
  } catch {
    return null;
  }
}

export async function revokeAgentToken(id: string): Promise<void> {
  await databases().updateDocument(DATABASE_ID, COL_AGENT_TOKENS, id, {
    revokedAt: new Date().toISOString(),
  });
}

export async function touchLastUsedAt(id: string): Promise<void> {
  await databases().updateDocument(DATABASE_ID, COL_AGENT_TOKENS, id, {
    lastUsedAt: new Date().toISOString(),
  });
}
