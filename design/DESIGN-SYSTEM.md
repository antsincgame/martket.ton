# TonForge Design System

The bridge artifact for taking TonForge's component library into a design tool
(claude.ai/design, Figma via Tokens Studio, or Style Dictionary). Tokens are in
[`tokens.json`](./tokens.json) (W3C Design Tokens Community Group format);
this file is the human-readable spec and the component inventory.

> **Note on the live sync.** A direct claude.ai/design round-trip needs the
> design MCP connector to be attached to the session. When it is, these tokens
> import directly. When it isn't (as now), `tokens.json` is the portable
> hand-off: import it into Tokens Studio / Style Dictionary, or paste the
> palette into claude.ai/design manually.

## Voice

A machine-temple aesthetic: dark chrome, neon accents, `Orbitron` uppercase
headings with wide tracking over `Inter` body. Gold is the dominant accent
(seller/Demiurge surfaces), TON-cyan the secondary (buyer surfaces), emerald
for "minted/verified", violet for agentic/AI surfaces.

## Palette (as actually used)

| Role | Token | Hex | Where |
|---|---|---|---|
| Primary accent | `color.brand.gold` | `#FFD700` | CTAs, seller console, highlights (448 uses) |
| Secondary accent | `color.brand.cyan` | `#00F5FF` | Buyer surface, links, focus (276) |
| Success | `color.brand.emerald` | `#00FF88` | Minted / verified / enabled |
| Agentic | `color.brand.violet` | `#8B5CF6` | AI / agent surfaces |
| Danger | `color.feedback.danger` | `#FF4444` | Errors, sanctions/AML blocks |
| Wishlist / destructive | `color.feedback.danger-pink` | `#FF3B6B` | Hearts, destructive accents |
| Warning / mockup | `color.feedback.warning` | `#FFB347` | Pending, not-finalised |
| Background | `color.surface.bg` | `#0A0A0A` | App + Telegram Mini App chrome |
| Panel | `color.surface.panel` | `#12121A` | Cards |
| Border | `color.surface.border` | `#2A2A3A` | Hairlines |

Text ramp: `#FFFFFF` → `#D8D8E8` → `#8A8AA0` → `#888888` → `#666666`.

Gradients live under `gradient.*`; the primary CTA is `gradient.ton`
(`bg-ton-gradient`). The Tailwind `ton/cosmic/mystical` numbered scales are
retained under `color.scale.*` for completeness but the brand accents above are
what the UI leans on.

## Type & motion

- **Display**: Orbitron, uppercase, wide tracking (`tracking-widest`).
- **Body**: Inter Variable.
- **Mono**: addresses, `tfa_` tokens, code.
- Motion: `fade-in` 250ms (scale+opacity), `slide-in` 300ms (toasts/drawers),
  `float` 6s idle, `glow` 3s pulsing shadow. Hover glows: `shadow.glow-gold`,
  `shadow.glow-cyan`.

## Component inventory (~62 components)

**Primitives** (`src/components/ui/`): `Toast`, `Skeleton`, `CopyButton`.

**Catalog / storefront**: `ProductCard`, `ProductPreview`, `SteamProductRow`,
`CollectionRow`, `StoreBrowser`, `CategorySidebar`, `CategoryFilterChips`,
`PlatformFilter`, `TagCloud`, `WishlistHeart`, `Header`, `Footer`,
`Breadcrumbs`, `LoadingScreen`, `CookieConsent`, `MvpBadge`.

**Commerce / checkout** (`src/components/checkout/`, `product/`): the
`CommerceCheckout` flow, `ReviewSection`.

**Demiurge (seller) console** (`src/pages/demiurge/commerce/`): `ApiTokensTab`
(seller + buyer token management), studio status badges, publish workflow,
no-collection warning.

**Admin** (`src/components/admin/`): `AmlCompliancePanel` (now with the live
screenings table), `ProductModerationQueue`, `RealUserManagement`,
`SecurityMonitor`, `SecurityAlertsPanel`, `SecurityEventsTable`,
`SecurityStats`, `AuditLogs`, `ResendSettings`.

**Plumbing**: `TonConnectWrapper`, `ProtectedRoute`, `ErrorBoundary`,
`ScrollToTop`.

## Importing

- **Style Dictionary**: point `source` at `design/tokens.json`, build CSS
  variables / Tailwind theme — the values already match the live Tailwind
  config, so it round-trips.
- **Figma (Tokens Studio)**: import `tokens.json` as a token set; the DTCG
  `$type`/`$value` shape is native.
- **claude.ai/design**: attach the design connector, then import the token set;
  or seed a new design with the palette + type + the component inventory above.

## Caveat

This captures the system as it is *today*, including the few neon colors used
sparingly. Before publishing the library externally, consider consolidating the
near-duplicate darks (`#0A0A0A` / `#0A0A0F` / `#0D0D1A` / `#111119`) and the
red family (`#FF4444` / `#FF3B6B` / `#FF2A6D`) to one token each.
