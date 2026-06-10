# TonForge Agent MCP server

An [MCP](https://modelcontextprotocol.io) server that exposes the
[TonForge Agent API](../docs/agent-api.md) as tools, so any MCP-compatible
assistant — Claude Desktop, Claude Code, Cursor, Windsurf, … — can operate a
seller's storefront in natural language.

> **Canonical docs & publishing:** [docs/mcp.md](../docs/mcp.md). Quick start:
> `npx tonforge-agent-mcp` (registry name `io.github.antsincgame/tonforge-agent`).

## Tools

### Seller tools (require an agent token + scope)

| Tool                  | Scope needed         | Does                                            |
| --------------------- | -------------------- | ----------------------------------------------- |
| `whoami`              | any                  | Show the token's wallet, scopes, prefix         |
| `get_instructions`    | `instructions:read`  | Onboarding/operating manual (pre-KYC)           |
| `get_status`          | any                  | Onboarding checklist + next action + aggregates |
| `register_seller`     | any                  | Self-register your seller profile (pre-KYC)     |
| `create_product`      | `products:write`     | Create a catalog product draft (→ moderation)   |
| `assistant_help`      | `instructions:read`  | Onboarding assistant (MVP **mockup**, no LLM)   |
| `list_listings`       | `listings:read`      | List your listings                              |
| `create_listing`      | `listings:write`     | Create a listing                                |
| `update_listing`      | `listings:write`     | Update a listing                                |
| `set_storage`         | `distribution:write` | Connect BYOS storage (R2/S3/B2; creds encrypted)|
| `set_distribution`    | `distribution:write` | Attach a downloadable artifact (→ draft)        |
| `verify_distribution` | `distribution:write` | Resolve + hash the artifact, compare sha256     |
| `list_orders`         | `orders:read`        | List your orders                                |
| `get_analytics`       | `orders:read`        | Store performance: sales, revenue split, top products |

A tool call that exceeds the token's scopes returns a clear error; it never
escalates privilege. The token is read from the environment, so the model never
sees the secret.

### Discovery tools (public, no token)

For shopping/buyer agents — these hit the public storefront API and need no auth:

| Tool              | Does                                                          |
| ----------------- | ------------------------------------------------------------ |
| `search_products` | Search the public product catalog by keyword                 |
| `get_product`     | Fetch a published product by id                              |
| `list_offers`     | List active listings (sellers' offers) for a catalog product |

> Completing a purchase is intentionally **not** a tool: it requires the buyer's
> own TON wallet to sign the escrow transaction (plus KYC/AML). See
> [docs/buyer-api.md](../docs/buyer-api.md) for the discover → prepare → sign flow.

## Setup

```bash
cd mcp-server
npm install
npm run build      # emits dist/index.js
```

You need a TonForge **agent token** (`tfa_…`) issued by a verified seller — see
[issuing a token](../docs/agent-api.md#issuing-a-token).

## Configure your assistant

### Claude Code (CLI)

```bash
claude mcp add tonforge \
  --env TONFORGE_AGENT_TOKEN=tfa_your_token_here \
  -- node /absolute/path/to/mcp-server/dist/index.js
```

### Claude Desktop / Cursor (JSON config)

Add to the app's MCP config (`claude_desktop_config.json`, or Cursor's
`mcp.json`):

```json
{
  "mcpServers": {
    "tonforge": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "TONFORGE_AGENT_TOKEN": "tfa_your_token_here"
      }
    }
  }
}
```

Restart the assistant. You should now be able to ask things like:

> "List my TonForge listings and raise the price of the slowest seller by 10%."
>
> "Create a listing for catalog product prod_123 at $19.99 with the file at
> https://… in collection EQC…"

### Override the API base (optional)

Set `TONFORGE_API` (e.g. for a staging deployment):

```json
"env": {
  "TONFORGE_AGENT_TOKEN": "tfa_…",
  "TONFORGE_API": "https://staging.tonforge.org/api/v1/agent"
}
```

## Run without building (dev)

```bash
TONFORGE_AGENT_TOKEN=tfa_… npm run dev
```

## Security notes

- The token grants exactly the scopes it was issued with; issue the narrowest
  set the agent needs.
- The server logs only to stderr (stdout is reserved for the MCP JSON-RPC
  stream) and never logs the token.
- Revoke a token any time from the dashboard or `DELETE /agent-tokens/{id}`;
  revocation and expiry take effect immediately.
