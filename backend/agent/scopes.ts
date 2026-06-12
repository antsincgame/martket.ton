/**
 * Personal Access Token scope catalog.
 *
 * Scopes are stored as a CSV string on the token document. Keep them
 * small, hierarchical, and predictable so docs and UI stay in sync with
 * the middleware.
 *
 * Read scopes are cheap and broad; write scopes correspond to mutating
 * routes that affect public listings or distribution. A token with
 * `listings:write` implicitly has `listings:read` (helper below).
 */

export const ALL_SCOPES = [
  'listings:read',
  'listings:write',
  'orders:read',
  'distribution:write',
  // Read the agent onboarding/instructions channel (service docs, prerequisites,
  // lifecycle, behaviour policy). Intentionally readable before KYC so a brand-new
  // agent can learn how to get verified — see `skipKyc` in agentAuth.
  'instructions:read',
  // Create catalog product drafts. Drafts enter the same moderation + antivirus
  // pipeline as human-created products and stay unpublished until a moderator
  // approves them. Requires KYC like every other write scope.
  'products:write',
  // Buyer-side agent commerce: create/confirm/read own orders and download
  // purchased goods for the token's wallet. Issued via the buyer-token route
  // (owner KYC-lite + wallet-ownership proof at issuance), NOT the seller one.
  'orders:buy',
] as const;

export type AgentScope = (typeof ALL_SCOPES)[number];

/**
 * Scopes the SELLER token route (`POST /api/v1/commerce/agent-tokens`) may
 * grant. `orders:buy` is intentionally excluded: it is a BUYER capability,
 * issuable only via the buyer-token route, which enforces buyer Lite KYC and
 * an on-chain proof that the issuer owns the paying wallet. Letting the seller
 * route mint it would let those buyer-specific gates be sidestepped.
 */
export const SELLER_GRANTABLE_SCOPES = ALL_SCOPES.filter(
  (s) => s !== 'orders:buy',
) as readonly Exclude<AgentScope, 'orders:buy'>[];

/**
 * Scopes a BUYER token carries. `orders:buy` is the capability; the read-only
 * `instructions:read` rides along so a buyer agent can orient itself — read the
 * manual, poll status, ask the assistant — instead of operating blind.
 * Deliberately NO seller write scopes.
 */
export const BUYER_TOKEN_SCOPES: AgentScope[] = ['orders:buy', 'instructions:read'];

const READ_IMPLIED_BY: Record<AgentScope, AgentScope[]> = {
  'listings:read': [],
  'listings:write': ['listings:read'],
  'orders:read': [],
  'distribution:write': ['listings:read'],
  'instructions:read': [],
  'products:write': [],
  'orders:buy': [],
};

export function parseScopes(csv: string | undefined | null): AgentScope[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is AgentScope => (ALL_SCOPES as readonly string[]).includes(s));
}

export function serializeScopes(scopes: readonly AgentScope[]): string {
  // De-duplicate and pin to canonical order so storage is stable.
  const set = new Set<AgentScope>(scopes);
  return ALL_SCOPES.filter((s) => set.has(s)).join(',');
}

/** Expand each granted scope to include implicit prerequisites. */
export function expandScopes(granted: readonly AgentScope[]): Set<AgentScope> {
  const out = new Set<AgentScope>();
  for (const s of granted) {
    out.add(s);
    for (const implied of READ_IMPLIED_BY[s]) out.add(implied);
  }
  return out;
}

export function hasAllScopes(granted: readonly AgentScope[], required: readonly AgentScope[]): boolean {
  const expanded = expandScopes(granted);
  return required.every((r) => expanded.has(r));
}
