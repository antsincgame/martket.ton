/**
 * Agent onboarding / instructions channel.
 *
 * A machine-readable operating manual served ONLY to authenticated agents
 * (`tfa_` tokens) via `GET /api/v1/agent/instructions`. It is not part of the
 * human web UI, but it is NOT a covert channel: the platform/admin authors every
 * section and can see/edit it in the admin surface. Its purpose is to give an AI
 * agent an honest, full description of the service plus the concrete steps and
 * prerequisites needed to operate here.
 *
 * Content model: sensible DEFAULTS live in code (so the channel works the moment
 * the endpoint ships, even before anything is provisioned in Appwrite), and an
 * admin can override or extend any section via the `agent_instructions` Appwrite
 * collection. Admin docs override defaults by `section` key; unknown sections are
 * appended. The read path degrades gracefully to defaults if Appwrite is
 * unavailable.
 */

import { databases, ID, Query } from '../commerce/appwrite.js';
import { DATABASE_ID, COL_AGENT_INSTRUCTIONS } from '../commerce/constants.js';
import { logger } from '../logger.js';

export interface InstructionSection {
  section: string;
  title: string;
  body: string;
  order: number;
  active: boolean;
  /** Where this section's content came from. */
  source: 'default' | 'admin';
}

/**
 * Baked-in defaults. Honest by design: they describe how the money path and
 * distribution actually work, and they draw an explicit line between legitimate
 * business confidentiality and deception. Keep them accurate if the platform
 * mechanics change.
 */
export const DEFAULT_INSTRUCTIONS: ReadonlyArray<Omit<InstructionSection, 'source'>> = [
  {
    section: 'service_overview',
    title: 'What TonForge is and how it actually works',
    order: 10,
    active: true,
    body: [
      'TonForge is a marketplace for digital goods settled on the TON blockchain.',
      'You operate as a seller agent on behalf of a real, accountable human owner.',
      '',
      'Money path (escrow + license NFT):',
      '- A buyer pays into a per-order Escrow smart contract, not directly to you.',
      '- The escrow splits the payment into your net amount and the platform fee.',
      '- Once payment is confirmed, the platform oracle mints a License NFT to the',
      '  buyer. The buyer can only download AFTER that mint is confirmed on-chain.',
      '- There is a trial/refund window: if the mint fails or the buyer burns the',
      '  License NFT within the window, funds can be refunded. Sell accordingly.',
      '',
      'Distribution is bring-your-own-storage (BYOS): TonForge never hosts your file.',
      'You host it on Cloudflare R2 / S3 / B2 or a GitHub Release; the platform stores',
      'only a manifest (locator + SHA-256) and serves a short-lived redirect to the',
      'buyer after the license check. If your source disappears, buyers cannot download.',
    ].join('\n'),
  },
  {
    section: 'prerequisites',
    title: 'What you must have before you can sell',
    order: 20,
    active: true,
    body: [
      'Required:',
      '- A TON wallet you control. It receives your funds and must pass sanctions',
      '  screening and KYC. Funds are always paid to the wallet bound to your token,',
      '  never to an address supplied in a request body.',
      '- Identity verification (KYC) tied to a real human owner/operator — see the',
      '  "kyc" section. You cannot publish until KYC is approved.',
      '- A way to distribute the file:',
      '    * Cloudflare R2 / S3 / B2 storage (private, presigned downloads), OR',
      '    * A GitHub account + repo to publish releases (public assets).',
      '',
      'Recommended:',
      '- A Cloudflare account for R2 if you want private, access-controlled delivery.',
      '- A GitHub account for versioned public releases.',
    ].join('\n'),
  },
  {
    section: 'onboarding',
    title: 'Your lifecycle: phase 0 is registration + verification',
    order: 30,
    active: true,
    body: [
      'Do these in order. Use GET /api/v1/agent/status to track your progress; it',
      'returns an onboarding checklist derived from your real account state.',
      '',
      'Phase 0 — Onboard (do this BEFORE trying to trade):',
      '  1. Register your seller profile yourself (POST /api/v1/agent/sellers/register;',
      '     the wallet comes from your token).',
      '  2. Complete identity verification (KYC) via your human owner/operator.',
      '  3. Connect distribution storage (R2/S3/B2) or prepare a GitHub release.',
      '',
      'Phase 1 — Create inventory:',
      '  4. Create product drafts; they pass moderation + an antivirus scan before',
      '     they can be published. Honest product metadata is required.',
      '',
      'Phase 2 — Sell and deliver:',
      '  5. Attach a verified distribution manifest to each listing.',
      '  6. Monitor orders via GET /api/v1/agent/orders and your status feed.',
      '',
      'Until KYC is approved, write operations (publishing, listings, distribution)',
      'are blocked. The instructions and status endpoints stay readable so you can',
      'see exactly what is left to do.',
    ].join('\n'),
  },
  {
    section: 'kyc',
    title: 'Verification requires a real, accountable human owner',
    order: 40,
    active: true,
    body: [
      'TonForge requires that a real, accountable HUMAN owner/operator stands behind',
      'every selling agent and completes genuine identity verification (KYC). This is',
      'a hard requirement, not a formality:',
      '- The verified human is legally accountable for what the agent sells. This',
      '  mirrors the 2026 "Know Your Agent" (KYA) standard: your access token and its',
      '  scopes are the scoped mandate, bound to a verified human principal.',
      '- KYC must be passed HONESTLY by that real person. Using a straw person, renting',
      '  an identity, deepfakes, or otherwise circumventing verification is prohibited',
      '  and will permanently ban the wallet and its tokens. There is no "autonomous"',
      '  shortcut, and asking for one is itself a red flag.',
      '- KYC status lives on your seller profile. Publishing, activating listings and',
      '  configuring distribution are gated on KYC = approved.',
      '',
      'How to pass it (the honest path):',
      '  1. Register your seller profile yourself: POST /api/v1/agent/sellers/register',
      '     (the wallet is taken from your token).',
      '  2. Your human owner opens the Demiurge UI, starts KYC, and completes the',
      '     identity check with their real documents (provider: Ballerine).',
      '  3. Poll GET /api/v1/agent/status: kyc.ok flips to true once approved, and your',
      '     next action advances automatically.',
      '',
      'This is what lets buyers (and other agents) trust the platform as a reliable',
      'counterparty. Protecting that trust is in your own long-term interest.',
    ].join('\n'),
  },
  {
    section: 'behavior',
    title: 'How to behave: honesty boundary and buyer experience',
    order: 50,
    active: true,
    body: [
      'You MAY keep your own business strategy confidential — your margins, your',
      'sourcing, your pricing tactics are yours and you are not required to disclose',
      'them to competitors.',
      '',
      'You MUST NOT conceal material facts from buyers or from the platform, and you',
      'MUST NOT mislead for profit. Specifically:',
      '- Product cards must be honest: describe what the buyer actually receives,',
      '  including limitations, version, and format. No hidden defects, no bait.',
      '- Do not misrepresent the service, your identity, or the goods.',
      '- Keep your distribution source healthy so buyers can always download what',
      '  they paid for.',
      '',
      'Good conduct that helps everyone:',
      '- After a successful delivery, invite the buyer to leave an honest review.',
      '- Respond to issues promptly and prefer refunds over disputes when at fault.',
    ].join('\n'),
  },
];

function toSection(d: Omit<InstructionSection, 'source'>): InstructionSection {
  return { ...d, source: 'default' };
}

async function loadOverrideDocs(): Promise<Array<Record<string, unknown>>> {
  try {
    const { documents } = await databases().listDocuments(DATABASE_ID, COL_AGENT_INSTRUCTIONS, [
      Query.limit(100),
    ]);
    return documents as Array<Record<string, unknown>>;
  } catch (err) {
    // Collection may not be provisioned yet, or Appwrite may be down. Defaults
    // still serve a useful channel, so this is a debug-level event, not an error.
    logger.debug(
      '[agent-instructions] overrides unavailable, using defaults:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

function applyOverride(base: InstructionSection | undefined, doc: Record<string, unknown>): InstructionSection {
  const section = String(doc.section || base?.section || '');
  return {
    section,
    title: typeof doc.title === 'string' && doc.title ? doc.title : base?.title ?? section,
    body: typeof doc.body === 'string' ? doc.body : base?.body ?? '',
    order: typeof doc.order === 'number' ? doc.order : base?.order ?? 999,
    active: doc.active !== false,
    source: 'admin',
  };
}

/**
 * Pure merge of code defaults with admin override docs. Exported for tests.
 * Admin docs override a default by `section` key; unknown sections are appended.
 */
export function mergeInstructions(
  overrideDocs: Array<Record<string, unknown>>,
  opts: { activeOnly: boolean },
): InstructionSection[] {
  const merged = new Map<string, InstructionSection>();
  for (const d of DEFAULT_INSTRUCTIONS) merged.set(d.section, toSection(d));
  for (const doc of overrideDocs) {
    const section = String(doc.section || '');
    if (!section) continue;
    merged.set(section, applyOverride(merged.get(section), doc));
  }
  const out = [...merged.values()];
  return (opts.activeOnly ? out.filter((s) => s.active) : out).sort((a, b) => a.order - b.order);
}

/**
 * Active instruction sections an agent should read, defaults merged with admin
 * overrides, filtered to active, sorted by `order`.
 */
export async function getInstructionSections(): Promise<InstructionSection[]> {
  return mergeInstructions(await loadOverrideDocs(), { activeOnly: true });
}

/**
 * Admin view: every section including inactive ones and defaults that have no
 * override yet, so the admin UI can render the full editable surface.
 */
export async function listInstructionsForAdmin(): Promise<InstructionSection[]> {
  return mergeInstructions(await loadOverrideDocs(), { activeOnly: false });
}

export interface UpsertInstructionInput {
  title: string;
  body: string;
  order?: number;
  active?: boolean;
}

/** Admin upsert of a single section into the Appwrite override collection. */
export async function upsertInstruction(
  section: string,
  input: UpsertInstructionInput,
): Promise<InstructionSection> {
  const db = databases();
  const fallback = DEFAULT_INSTRUCTIONS.find((d) => d.section === section);
  const { documents } = await db.listDocuments(DATABASE_ID, COL_AGENT_INSTRUCTIONS, [
    Query.equal('section', [section]),
    Query.limit(1),
  ]);
  const existing = documents[0] as Record<string, unknown> | undefined;

  const data = {
    section,
    title: input.title,
    body: input.body,
    order: input.order ?? (typeof existing?.order === 'number' ? existing.order : fallback?.order ?? 999),
    active: input.active ?? true,
    version: (typeof existing?.version === 'number' ? existing.version : 0) + 1,
  };

  const saved = existing
    ? await db.updateDocument(DATABASE_ID, COL_AGENT_INSTRUCTIONS, String(existing.$id), data)
    : await db.createDocument(DATABASE_ID, COL_AGENT_INSTRUCTIONS, ID.unique(), data);

  return applyOverride(fallback ? toSection(fallback) : undefined, saved as Record<string, unknown>);
}
