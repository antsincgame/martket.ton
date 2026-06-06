/**
 * Minimal, dependency-free TonForge Agent API client (Node 18+ / any fetch env).
 *
 *   TONFORGE_AGENT_TOKEN=tfa_… npx tsx client.ts
 *
 * The acting wallet is derived from the token, so no wallet is passed here
 * except where the API requires it in the body (create listing).
 */

const BASE = process.env.TONFORGE_API ?? 'https://tonforge.org/api/v1/agent';
const TOKEN = process.env.TONFORGE_AGENT_TOKEN;
if (!TOKEN) throw new Error('Set TONFORGE_AGENT_TOKEN');

type Json = Record<string, unknown>;

class TonForgeAgent {
  constructor(private token: string, private base = BASE) {}

  private async call<T = Json>(method: string, path: string, body?: Json): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json()) as { data?: T; error?: string; message?: string; code?: string };
    if (!res.ok) {
      // The API returns either { error, code } or { success:false, message, code }.
      throw new Error(`${res.status} ${json.code ?? ''}: ${json.error ?? json.message ?? 'request failed'}`);
    }
    return json.data as T;
  }

  me() {
    return this.call('GET', '/me');
  }
  listListings() {
    return this.call<{ listings: Json[] }>('GET', '/listings');
  }
  createListing(input: {
    sellerWallet: string;
    catalogProductId: string;
    title: string;
    priceUsd: number;
    deliveryType: string;
    deliveryPayload: string;
    collectionAddress: string;
    description?: string;
    platformFeeBps?: number;
  }) {
    return this.call<{ listing: Json }>('POST', '/listings', input);
  }
  updateListing(id: string, patch: Json) {
    return this.call<{ listing: Json }>('PATCH', `/listings/${id}`, patch);
  }
  listOrders(limit = 100) {
    return this.call<{ orders: Json[] }>('GET', `/orders?limit=${limit}`);
  }
}

async function main() {
  const agent = new TonForgeAgent(TOKEN!);
  console.log('identity:', await agent.me());
  const { listings } = await agent.listListings();
  console.log(`you have ${listings.length} listing(s)`);
  const { orders } = await agent.listOrders(10);
  console.log(`latest ${orders.length} order(s):`, orders);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
