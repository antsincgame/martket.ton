# TonForge MCP server & distribution

The [Model Context Protocol](https://modelcontextprotocol.io) server in
[`mcp-server/`](../mcp-server) turns the [Agent API](./agent-api.md) into native
tools for any MCP-compatible assistant (Claude Desktop, Claude Code, Cursor,
Windsurf, …). This page is the canonical reference for **running, configuring,
and distributing** it so other agents discover it automatically.

---

## Install

### `npx` (no clone)

```bash
TONFORGE_AGENT_TOKEN=tfa_… npx tonforge-agent-mcp
```

### From source

```bash
cd mcp-server
npm install
npm run build      # → dist/index.js
TONFORGE_AGENT_TOKEN=tfa_… npm start
```

### From the MCP registry

Published as `io.github.antsincgame/tonforge-agent`. MCP clients that browse the
[official registry](https://registry.modelcontextprotocol.io) can install it by
name; the manifest is [`mcp-server/server.json`](../mcp-server/server.json).

---

## Configure your client

### Claude Code

```bash
claude mcp add tonforge \
  --env TONFORGE_AGENT_TOKEN=tfa_your_token_here \
  -- npx tonforge-agent-mcp
```

### Claude Desktop / Cursor (JSON)

```json
{
  "mcpServers": {
    "tonforge": {
      "command": "npx",
      "args": ["tonforge-agent-mcp"],
      "env": { "TONFORGE_AGENT_TOKEN": "tfa_your_token_here" }
    }
  }
}
```

Use `TONFORGE_API` to point at a non-production base URL.

---

## Tools

**17 tools**, in three groups.

### Self-onboarding (a machine sets itself up)

`get_instructions` (`instructions:read`) — the operating manual + checklist ·
`get_status` (any) — onboarding progress + the exact `nextAction` ·
`register_seller` (any) — create the seller profile for the token's wallet
(idempotent) · `set_storage` (`distribution:write`) — connect your own
R2/S3/B2 bucket (BYOS) · `create_product` (`products:write`) — create a catalog
product draft · `assistant_help` (`instructions:read`) — free-text Q&A grounded
in the manual + your live status.

All but `set_storage` are usable **before KYC**, so an agent can walk the whole
path — `register_seller → set_storage → create_product → [human KYC] → sell` —
self-directed.

### Seller management (require a token + scope)

`whoami`, `list_listings` (`listings:read`), `create_listing` /
`update_listing` (`listings:write`), `set_distribution` / `verify_distribution`
(`distribution:write`), `list_orders` / `get_analytics` (`orders:read`).

### Discovery (public, no token)

`search_products`, `get_product`, `list_offers`.

### Discovery-only mode

`TONFORGE_AGENT_TOKEN` is **optional**. Without it the server still starts and
serves the discovery tools; the seller tools return a clear "no token configured"
error instead of failing. This lets buyer/shopping agents run the server with no
credentials at all.

---

## Authentication model

- **Discovery is keyless** — the catalog is public, which is what makes it
  trivially consumable by any agent.
- **Seller actions use a `tfa_` Personal Access Token**, issued by a verified
  seller with explicit scopes and an expiry, revocable at any time. The acting
  wallet is derived from the token, never from the request. The token is passed
  via the environment so the model never sees the secret.
- **Buying is non-custodial**: only the buyer's own TON wallet can sign the
  escrow payment, so no token (and no agent) can move a user's funds. See
  [buyer-api.md](./buyer-api.md).

---

## Where agents discover TonForge

| Channel | Artifact | Who picks it up |
| --- | --- | --- |
| MCP registry | [`mcp-server/server.json`](../mcp-server/server.json) | MCP clients browsing the registry |
| npm | `tonforge-agent-mcp` | `npx` configs, package search |
| Claude skill | [`.claude/skills/tonforge-marketplace/SKILL.md`](../.claude/skills/tonforge-marketplace/SKILL.md) | Claude Code / Claude agents |
| Plugin manifest | `public/.well-known/ai-plugin.json` → `/.well-known/ai-plugin.json` | Plugin-aware agents, crawlers |
| llms.txt | `public/llms.txt` → `/llms.txt` | LLM crawlers / agents |
| OpenAPI | [`docs/openapi/agent-api.yaml`](./openapi/agent-api.yaml) | Function-calling / codegen |

---

## Publishing

> Releases bump **both** `mcp-server/package.json` `version` and
> `mcp-server/server.json` `version` in lockstep. The npm package's `mcpName`
> must equal the `server.json` `name`.

### 1. npm

```bash
cd mcp-server
npm ci
npm publish        # prepublishOnly builds; publishConfig.access = public
```

The unscoped name `tonforge-agent-mcp` must be available (or claim a scope).

### 2. MCP registry

Uses the [`mcp-publisher`](https://github.com/modelcontextprotocol/registry) CLI.
The `io.github.antsincgame/*` namespace is owned via GitHub, so authenticate as
**antsincgame** (interactively or from a GitHub Action on this repo):

```bash
cd mcp-server
mcp-publisher login github     # proves ownership of io.github.antsincgame/*
mcp-publisher publish          # validates and submits server.json
```

The npm package from step 1 must already be live (the registry verifies the
`mcpName` ↔ package link).

### 3. Skill

The skill is active in this repo via `.claude/skills/`. To share it, copy that
folder into another project's `.claude/skills/` or `~/.claude/skills/`, or bundle
it as a Claude Code plugin.

### Before you publish (one-time)

- **Add a license.** There is currently no `LICENSE` / `package.json` `license`;
  add one before publishing to npm.
- **Update `ai-plugin.json`** `contact_email` / `legal_info_url` for production.
- **(Optional) serve the OpenAPI from the domain**: copy
  `docs/openapi/agent-api.yaml` to `public/openapi/agent-api.yaml` and repoint
  `ai-plugin.json` `api.url` at `https://tonforge.org/openapi/agent-api.yaml`.
