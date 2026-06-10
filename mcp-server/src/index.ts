#!/usr/bin/env node
/**
 * TonForge Agent MCP server.
 *
 * Exposes the TonForge Agent API (https://tonforge.org/api/v1/agent) as MCP
 * tools so any MCP-compatible assistant (Claude Desktop, Claude Code, Cursor, …)
 * can operate a seller's storefront: manage listings, attach/verify the
 * downloadable artifact, and read orders.
 *
 * Auth is a single Personal Access Token, supplied out-of-band via env so the
 * model never sees or handles the secret:
 *   - TONFORGE_AGENT_TOKEN  (required)  a `tfa_…` token issued by a verified seller
 *   - TONFORGE_API          (optional)  override the API base URL
 *
 * The token's scopes bound what the tools can do; a call missing a scope returns
 * a clear error rather than failing silently.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE = process.env.TONFORGE_API ?? 'https://tonforge.org/api/v1/agent';
const TOKEN = process.env.TONFORGE_AGENT_TOKEN;
// Site origin (e.g. https://tonforge.org) for the PUBLIC discovery endpoints,
// derived from BASE so a TONFORGE_API override (staging, etc.) carries over.
const ORIGIN = new URL(BASE).origin;

if (!TOKEN) {
  // Seller tools need a token; the public discovery tools do not. Run in
  // discovery-only mode rather than refusing to start, so buyer/shopping
  // agents can use the server with no seller credentials.
  console.error(
    'TONFORGE_AGENT_TOKEN not set — seller tools are disabled; public discovery tools still work.',
  );
}

interface ApiError {
  error?: string;
  message?: string;
  code?: string;
}

/**
 * Call the Agent API and unwrap its `{ data }` envelope. Surfaces both the
 * route-level (`{ error, code }`) and middleware (`{ message, code }`) error
 * shapes as a single thrown Error the tool layer turns into an isError result.
 */
async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  if (!TOKEN) {
    throw new Error(
      'No TONFORGE_AGENT_TOKEN configured. This is a seller tool — set a tfa_ token issued by a verified seller. ' +
        'Public discovery tools (search_products, get_product, list_offers) work without one.',
    );
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const e = json as ApiError;
    const code = e.code ? `${e.code}: ` : '';
    throw new Error(`HTTP ${res.status} ${code}${e.error ?? e.message ?? res.statusText}`);
  }

  const obj = json as { data?: unknown };
  return obj.data ?? json;
}

/**
 * GET a PUBLIC endpoint under the site origin (catalog discovery). These need
 * no token — they back the storefront — so a shopping agent can browse before
 * any seller token is involved. Both the products (`{ success, data }`) and
 * commerce (`{ data }`) envelopes expose `.data`, so we unwrap it uniformly.
 */
async function publicGet(path: string): Promise<unknown> {
  const res = await fetch(`${ORIGIN}${path}`, { headers: { Accept: 'application/json' } });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const e = json as ApiError;
    const code = e.code ? `${e.code}: ` : '';
    throw new Error(`HTTP ${res.status} ${code}${e.error ?? e.message ?? res.statusText}`);
  }
  const obj = json as { data?: unknown };
  return obj.data ?? json;
}

type ToolResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function fail(e: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
    isError: true,
  };
}

const server = new McpServer({ name: 'tonforge-agent', version: '1.0.0' });

server.tool(
  'whoami',
  'Return the wallet, scopes, and token prefix bound to the configured TonForge agent token.',
  {},
  async () => {
    try {
      return ok(await api('GET', '/me'));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'list_listings',
  "List the seller's marketplace listings (requires the listings:read scope).",
  {},
  async () => {
    try {
      return ok(await api('GET', '/listings'));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'create_listing',
  'Create a new active listing owned by the token\'s wallet (requires listings:write). priceUsd is converted to TON at the current oracle rate.',
  {
    sellerWallet: z
      .string()
      .describe("Your wallet. Required for validation, but overridden server-side with the token's wallet."),
    catalogProductId: z.string(),
    title: z.string().max(200),
    priceUsd: z.number().positive(),
    deliveryType: z.string().describe('e.g. "file"'),
    deliveryPayload: z.string().describe('Buyer-facing secret (download URL/key); never returned by read endpoints.'),
    collectionAddress: z.string().describe('Pre-deployed AppCollection address; mandatory for license-NFT minting on purchase.'),
    description: z.string().max(5000).optional(),
    platformFeeBps: z.number().int().min(0).max(10000).optional(),
  },
  async (args) => {
    try {
      return ok(await api('POST', '/listings', args));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'update_listing',
  'Update fields on a listing you own (requires listings:write). Setting status to "active" requires a collectionAddress (existing or supplied here).',
  {
    id: z.string().describe('Listing id.'),
    status: z.enum(['active', 'inactive', 'draft']).optional(),
    title: z.string().max(200).optional(),
    description: z.string().max(5000).optional(),
    priceUsd: z.number().positive().optional(),
    deliveryPayload: z.string().optional(),
    collectionAddress: z.string().optional(),
  },
  async ({ id, ...patch }) => {
    try {
      return ok(await api('PATCH', `/listings/${encodeURIComponent(id)}`, patch));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'set_distribution',
  'Attach a distribution manifest (R2 object or GitHub release asset) to a listing and move it to the draft state (requires distribution:write). Follow with verify_distribution.',
  {
    id: z.string().describe('Listing id.'),
    manifest: z
      .record(z.any())
      .describe('Distribution manifest object (kind r2|github, sha256, …); see docs/byos-distribution.md.'),
    ttlSec: z.number().int().positive().optional().describe('Signed-URL TTL in seconds (default 3600).'),
  },
  async ({ id, manifest, ttlSec }) => {
    try {
      return ok(await api('PUT', `/listings/${encodeURIComponent(id)}/distribution`, { manifest, ttlSec }));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'verify_distribution',
  "Resolve and hash the listing's artifact, comparing it to the declared sha256 (requires distribution:write). Moves the listing to verified or manifest_drift.",
  {
    id: z.string().describe('Listing id.'),
  },
  async ({ id }) => {
    try {
      return ok(await api('POST', `/listings/${encodeURIComponent(id)}/distribution/verify`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'list_orders',
  "List the seller's orders across all their listings, newest first (requires orders:read).",
  {
    limit: z.number().int().min(1).max(500).optional().describe('Max orders to return (default 100, max 500).'),
  },
  async ({ limit }) => {
    try {
      return ok(await api('GET', `/orders?limit=${limit ?? 100}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'get_analytics',
  "Read the seller's store performance (requires orders:read): sales count, revenue split (gross / your net / platform fees, in raw nanoton + human TON), refunds, order-state breakdown, and a top-products ranking by sales. Use it to decide what to restock, re-price, or promote.",
  {},
  async () => {
    try {
      return ok(await api('GET', '/analytics'));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'get_instructions',
  'Read the platform-authored agent onboarding/operating manual (instructions:read; readable before KYC). Returns the honest service overview, prerequisites, lifecycle, KYC policy, and behaviour/honesty boundary, plus your personalised onboarding checklist.',
  {},
  async () => {
    try {
      return ok(await api('GET', '/instructions'));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'get_status',
  'Your self-status: the onboarding checklist + the single next action toward autonomy (nextAction: step, the instruction section that explains it, and the exact API affordance), plus listing / order / license / product-scan / distribution aggregates. Readable before KYC.',
  {},
  async () => {
    try {
      return ok(await api('GET', '/status'));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'register_seller',
  'Register your seller profile (machine self-onboarding). Creates the profile bound to your token wallet so you can onboard up to the human KYC gate. Idempotent; the wallet comes from your token, never the input. Your accountable human owner then completes KYC — there is no autonomous KYC bypass.',
  {
    displayName: z.string().optional().describe('Public seller display name (default "Agent Demiurge").'),
    bio: z.string().optional().describe('Short seller bio.'),
  },
  async (args) => {
    try {
      return ok(await api('POST', '/sellers/register', args));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'create_product',
  'Create a catalog product as a DRAFT (products:write). The draft enters the same moderation + antivirus pipeline as a human-created product and stays unpublished until a moderator approves it. The creator is resolved from your token wallet — register as a seller first, or this returns NO_CREATOR_PROFILE.',
  {
    name: z.string().min(1).describe('Product name.'),
    description: z.string().optional().describe('Full description (markdown ok).'),
    short_description: z.string().optional().describe('Short tagline.'),
    price_usd: z.number().min(0).optional().describe('Price in USD (default 0).'),
    category: z.string().optional().describe('Category slug (default "other").'),
    image: z.string().optional().describe('Image URL.'),
    version: z.string().optional().describe('Version (default "1.0.0").'),
  },
  async (args) => {
    try {
      return ok(await api('POST', '/products', args));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'assistant_help',
  'Ask the onboarding assistant. MVP MOCKUP: returns a deterministic, grounded answer — your current next action plus the instruction section explaining it — honestly flagged "mockup" (no LLM connected yet). A grounded local-LLM copilot is planned.',
  {
    question: z.string().min(1).describe('Your onboarding / operating question.'),
  },
  async ({ question }) => {
    try {
      return ok(await api('POST', '/help', { question }));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'set_storage',
  'Connect your own (BYOS) distribution storage — Cloudflare R2 / S3 / B2 (requires distribution:write). Validates the bucket (HeadBucket) and stores the credentials AES-256-GCM-encrypted on your seller profile. The wallet is your token wallet; the secret is write-only (never returned).',
  {
    provider: z.enum(['cloudflare-r2', 's3', 'b2']).describe('Storage provider.'),
    accountId: z.string().describe('Account/region id (R2 account id, S3 region, B2 region).'),
    bucket: z.string().describe('Bucket name.'),
    endpoint: z.string().url().optional().describe('Custom S3-compatible endpoint (https only; private IPs blocked).'),
    accessKeyId: z.string().describe('Access key id.'),
    secretAccessKey: z.string().describe('Secret access key (stored encrypted, never returned).'),
    publicBaseUrl: z.string().url().optional().describe('Public base URL for public-bucket downloads (optional).'),
  },
  async (args) => {
    try {
      return ok(await api('POST', '/storage', args));
    } catch (e) {
      return fail(e);
    }
  },
);

// ── Discovery tools (public, no token) — for shopping/buyer agents ──────────

server.tool(
  'search_products',
  'Search the public TonForge product catalog by keyword (no auth). Returns published products a buyer could shop for.',
  {
    q: z.string().min(2).describe('Search query (min 2 chars).'),
    limit: z.number().int().min(1).max(200).optional().describe('Max results (default 50, max 200).'),
  },
  async ({ q, limit }) => {
    try {
      const qs = new URLSearchParams({ q, limit: String(limit ?? 50) });
      return ok(await publicGet(`/api/products/search?${qs.toString()}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'get_product',
  'Fetch a single published product from the public catalog by id (no auth).',
  {
    id: z.string().describe('Product id.'),
  },
  async ({ id }) => {
    try {
      return ok(await publicGet(`/api/products/${encodeURIComponent(id)}`));
    } catch (e) {
      return fail(e);
    }
  },
);

server.tool(
  'list_offers',
  "List the active listings (sellers' offers) for a given catalog product (no auth). Use this to find what's for sale and at what price before initiating a purchase.",
  {
    catalogProductId: z.string().describe('The catalog product id to find offers for.'),
  },
  async ({ catalogProductId }) => {
    try {
      return ok(await publicGet(`/api/v1/commerce/listings/catalog/${encodeURIComponent(catalogProductId)}`));
    } catch (e) {
      return fail(e);
    }
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP speaks JSON-RPC on stdout; logs must go to stderr.
  console.error(`tonforge-agent MCP server ready (base=${BASE}, seller tools ${TOKEN ? 'enabled' : 'disabled'})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
