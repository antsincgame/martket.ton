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
] as const;

export type AgentScope = (typeof ALL_SCOPES)[number];

const READ_IMPLIED_BY: Record<AgentScope, AgentScope[]> = {
  'listings:read': [],
  'listings:write': ['listings:read'],
  'orders:read': [],
  'distribution:write': ['listings:read'],
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
