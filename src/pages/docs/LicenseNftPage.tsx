import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Box,
  CheckCircle2,
  Coins,
  Copy,
  Cpu,
  ExternalLink,
  Fingerprint,
  Flame,
  Hexagon,
  Lock,
  Network,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   MECHANICUS PROTOCOL — License NFT subsystem
   Grammar: OMNISSIAH::HDSK_EXTRACTOR  (см. /docs)
   IN→license_nft_subsystem  OUT→codegen_context
   ═══════════════════════════════════════════════════════════════ */
const LICENSE_MECH_BLOCK = `OMNISSIAH::TONFORGE_LICENSE_NFT v2
IN→license_nft_subsystem OUT→codegen_context
D.tags|concept;contracts;flow;authority;safety;limitations

## IDENTITY
W|A|License≡soulbound_NFT;∅transferable;∅fungible
W|A|standard_base=TEP-62+TEP-64;soulbound_via=transferLimit=0
W|A|∅inherits_TEP-85→authority_role_duplicates_collection_owner
W|A|purpose=proof_of_purchase+entitlement_key+refund_anchor
W|A|deploy_target=TON_mainnet;testnet_first→smoke_E2E

## CONTRACTS
A|W|Escrow.tact≡per_purchase;holds_funds;state_machine
A|W|AppCollection.tact≡TEP-62_collection;1_per_app;oracle_owned
A|W|LicenseItem.tact≡TEP-64_item;1_per_purchase;soulbound
A|W|item_address→deterministic(code,init);buyer-scoped

## STORAGE: Escrow
A|W|orderId,buyer,seller,treasury:Address
A|W|amountNano,sellerAmountNano,feeNano:coins
A|W|trialWindowSec:uint32;state:uint8;paidAt:uint32
A|W|collectionAddress,licenseAddress:Address
A|W|state∈{INIT=0,FUNDED=1,RELEASED=3,REFUNDED=4}

## STORAGE: AppCollection
A|W|appId:Int256;ownerAddress:Address(oracle);nextItemIndex:Int64
A|W|collectionContent:Cell;commonContent:Cell

## STORAGE: LicenseItem
A|W|index:uint256;collection,ownerAddress,escrowAddress:Address
A|W|transferLimit,transfers:uint8;content:Cell
A|W|burnDeadline:uint32;registered:Bool
A|W|transferLimit=0→soulbound

## OPCODES
A|W|Escrow: PayEscrow=0xd2e5b971;ConfirmDelivery=0x45dfb5a1
A|W|Escrow: TimeoutRelease=0x7f8c9a12;RegisterLicense=0x70e30189
A|W|Escrow: RefundOnBurn=0x9b3c2d45;RefundIfNotMinted=0x5a8e1f23
A|W|Collection: MintLicense=0x6a3aaa14;BurnLicense=0x4d8e8a14;ChangeOwner=0x4d8b8b8b
A|W|Item: Transfer=0x5fcc3d14;Burn=0x595f07bc;BuyerBurn=0x7a1b3c5d
A|W|Item: GetStaticData=0x2fcb26a2

## AUTHORITY MATRIX
P|A|PayEscrow→require(sender==buyer && state==INIT && value≥amount)
P|A|MintLicense→require(sender==ownerAddress(oracle) && value≥0.1TON)
P|A|BuyerBurn→require(sender==ownerAddress(buyer) && now≤burnDeadline)
P|A|Burn(item)→require(sender==collection) // admin edge case
P|A|RefundOnBurn→require(sender==registered_licenseAddress)
P|A|RefundIfNotMinted→require(sender==buyer && now>paidAt+600)
P|A|ChangeOwner→require(sender==current_ownerAddress)

## OFF-CHAIN ORACLE
A|W|wallet=WalletV4;mnemonic=ORACLE_MNEMONIC(env)
A|W|wallet.address≡AppCollection.ownerAddress;deployer==oracle
A|W|on_state(escrow.FUNDED)→mintLicense(buyer,index,burnDeadline)
A|W|verifyOwner→runMethod(get_nft_data)→cmp_ownerAddress
A|W|gas_budget_mint=0.1TON;gas_budget_burn=0.05TON

## STATE MACHINE (DB)
A|W|license.state∈{mint_pending,mint_failed,trial_active,
A|W|  device_bound,released,burn_pending,revoked,refunded}
A|W|confirm_purchase→mint_pending→[oracle.mint]→trial_active
A|W|oracle_timeout→[buyer.RefundIfNotMinted@+10min]→refunded
A|W|buyer_burn→burn_pending→[escrow.refund]→revoked+refunded

## REFUND FLOW (on-chain, no arbitrator)
A|W|buyer→BuyerBurn→LicenseItem
A|W|  LicenseItem→RefundOnBurn→Escrow
A|W|  Escrow→SendRemainingBalance→buyer
A|W|  LicenseItem→self_destruct
A|W|trial_window_expired→TimeoutRelease→seller+treasury_split

## METADATA (TEP-64 off-chain)
A|W|content_prefix=0x01;tail=utf8(URI)
A|W|collection_meta=<metadataUri>/collection.json
A|W|item_meta=<metadataUriPrefix><index>.json
A|W|fields={name,description,image,attributes:[app_id,sha256,
A|W|  license_type,trial_ends_at,escrow_addr]}

## CURRENT LIMITATIONS (Option C)
P|A|mint_authority=oracle_only→trust_assumption_on_key
P|A|MintLicense.escrowAddress=sender()→bug:binds_to_oracle_not_escrow
P|A|TODO→add_escrowAddress_param_to_MintLicense_then_trustless_init_hash
P|A|∅auto_mint_from_PayEscrow_yet;backend_index_required

## SECURITY
P|A|sharding→1_contract_per_NFT;∅shared_state;parallel_safe
P|A|race_safe→DB_unique(purchase_session_id)+SELECT_FOR_UPDATE
P|A|mint_idempotent→queryId=hash(sessionId)+DB_constraint
P|A|key_rotation→ChangeOwner(newOracle)→old_licenses_remain_valid
P|A|key_loss→deploy_new_collection;old_NFTs_stay_with_holders

## CONSTRAINTS
∅user_initiated_mint;∅bypass_escrow;∅transfer_when_limit_zero
∅burn_without_collection_consent;∅mint_without_oracle_signature
parity_rule→Human==AIAgent→same_NFT_lifecycle

ASCII_FALLBACK::
  MINT:
    buyer → PayEscrow → Escrow(FUNDED)
                         → oracle sees event
                         → oracle.MintLicense → Collection
                         → Collection.deploy LicenseItem(buyer)
                         → LicenseItem.RegisterLicense → Escrow

  REFUND (within burnDeadline):
    buyer → BuyerBurn → LicenseItem
                         → RefundOnBurn → Escrow → buyer
                         → self-destruct

  TIMEOUT (after trial window):
    anyone → TimeoutRelease → Escrow → seller + treasury

  STUCK MINT (after 10 min):
    buyer → RefundIfNotMinted → Escrow → buyer

READY@send_chunk`;

/* ═══════════════════════════════════════════════════════════════
   Code samples — mirrored against contracts/src/ at v4.
   ═══════════════════════════════════════════════════════════════ */
const TACT_LICENSE_ITEM = `// contracts/src/licenseItem.tact (excerpt, v4)
contract LicenseItem with Deployable {
    index:         Int as uint256;
    collection:    Address;
    ownerAddress:  Address;        // buyer wallet — immutable when soulbound
    escrowAddress: Address;        // bound at deploy, target for refund
    transferLimit: Int as uint8;   // 0 = soulbound forever
    transfers:     Int as uint8;
    content:       Cell;           // TEP-64 off-chain URI
    burnDeadline:  Int as uint32;  // unix ts; after it BuyerBurn is rejected
    registered:    Bool;           // true once RegisterLicense sent to Escrow

    // Self-register. First message from Collection after deploy
    // is an empty "License minted" comment — we bounce a signed
    // RegisterLicense back to Escrow so it knows our real address.
    receive() {
        if (!self.registered && sender() == self.collection) {
            self.registered = true;
            send(SendParameters{
                to: self.escrowAddress,
                value: ton("0.02"),
                mode: SendPayGasSeparately,
                bounce: false,
                body: RegisterLicense{ licenseAddress: myAddress() }.toCell(),
            });
        }
    }

    // Buyer-initiated refund: burn within deadline → Escrow auto-refund.
    receive(msg: BuyerBurn) {
        require(sender() == self.ownerAddress, "Only owner can burn");
        require(now() <= self.burnDeadline, "Trial window closed");
        send(SendParameters{
            to: self.escrowAddress, value: 0,
            mode: SendRemainingValue, bounce: false,
            body: RefundOnBurn{}.toCell(),
        });
        // self destroys via SendRemainingValue → 0 balance
    }

    // Soulbound: every Transfer attempt fails when transferLimit = 0.
    receive(msg: Transfer) {
        require(sender() == self.ownerAddress, "Only owner can transfer");
        require(self.transfers < self.transferLimit,
                "Soulbound or transfer limit exhausted");
        // ... update owner, notify newOwner
    }

    // Admin edge case (DMCA): only Collection may force-burn.
    receive(msg: Burn) {
        require(sender() == self.collection, "Only collection can burn");
        send(SendParameters{
            to: self.ownerAddress, value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero,
            bounce: false,
            body: "License burned".asComment(),
        });
    }
}`;

const TACT_APP_COLLECTION = `// contracts/src/appCollection.tact (excerpt, v4)
contract AppCollection with Deployable {
    appId:             Int as uint256;
    ownerAddress:      Address;      // oracle wallet, set at deploy
    nextItemIndex:     Int as uint64;
    collectionContent: Cell;
    commonContent:     Cell;

    // Option C (current): mint is gated by oracle signature.
    // TODO: switch to trustless init-hash check from Escrow
    //       after full E2E — see "Current limitations" below.
    receive(msg: MintLicense) {
        require(sender() == self.ownerAddress, "Only collection owner can mint");
        require(context().value >= ton("0.1"), "Insufficient gas for mint");

        let index: Int = self.nextItemIndex;
        let init: StateInit = initOf LicenseItem(
            index,
            myAddress(),          // collection
            msg.buyerAddress,     // NFT owner = buyer
            sender(),             // ⚠ escrowAddress = sender() (oracle, not Escrow)
            msg.transferLimit,
            msg.individualContent,
            msg.burnDeadline,
        );
        self.nextItemIndex = index + 1;

        send(SendParameters{
            to: contractAddress(init), value: 0,
            mode: SendRemainingValue, bounce: false,
            code: init.code, data: init.data,
            body: "License minted".asComment(),
        });
    }

    // Oracle-only key rotation.
    receive(msg: ChangeOwner) {
        require(sender() == self.ownerAddress, "Only current owner can rotate");
        self.ownerAddress = msg.newOwner;
    }
}`;

const TS_ORACLE_MINT = `// backend/tonforge/onchain/mintLicense.ts
export async function mintLicense(args: MintArgs) {
  // Deterministic address is computed client-side from (code, init).
  const item = LicenseItem.fromInit({
    index:         args.index,
    collection:    collection.address,
    ownerAddress:  args.buyer,
    escrowAddress: args.escrow,
    transferLimit: 0,                  // soulbound
    transfers:     0,
    content:       buildOffchainContent(args.metadataUri),
    burnDeadline:  args.burnDeadline,  // unix ts = paidAt + trialWindowSec
    registered:    false,
  });

  await oracle.send(client, {
    to:    collection.address,
    value: LICENSE_MINT_GAS_NANO,      // default 0.1 TON
    body:  buildMintLicensePayload({
      queryId:         args.queryId,
      orderId:         args.orderId,
      buyerAddress:    args.buyer,
      sellerAddress:   args.seller,
      treasuryAddress: args.treasury,
      amountNano:      args.amountNano,
      sellerAmountNano:args.sellerAmountNano,
      feeNano:         args.feeNano,
      trialWindowSec:  args.trialWindowSec,
      transferLimit:   0,
      individualContent: buildOffchainContent(args.metadataUri),
      burnDeadline:    args.burnDeadline,
    }),
  });

  await pollItemDeployed(client, item.address);
  return { itemAddress: item.address, txHash: args.queryId.toString(16) };
}`;

const TS_VERIFY = `// backend/tonforge/onchain/verifyOwnership.ts
export async function verifyLicenseOwner(addr: Address, expected: Address) {
  const state = await client.getContractState(addr);
  if (state.state !== 'active') return { ok: false, reason: 'item_not_active' };
  const data = await client.runMethod(addr, 'get_nft_data');
  // TEP-64 stack: (init?, index, collection, owner, content)
  data.stack.skip(3);
  const ownerOnchain = data.stack.readAddress();
  return ownerOnchain.equals(expected)
    ? { ok: true, ownerOnchain }
    : { ok: false, reason: 'owner_mismatch', ownerOnchain };
}`;

/* ─────────────────────────────────────────────
   Inline coloured text helper (mirrors /docs).
   ───────────────────────────────────────────── */
function H(
  parts: Array<{ t: string; c?: 'gold' | 'cyan' | 'violet' | 'magenta' | 'emerald' | 'red' | 'white' }>,
): React.ReactNode {
  const map = {
    gold: 'text-[#FFD700]',
    cyan: 'text-[#00F5FF]',
    violet: 'text-[#8B5CF6]',
    magenta: 'text-[#FF2A6D]',
    red: 'text-[#FF2A6D]',
    emerald: 'text-[#00FF88]',
    white: 'text-white',
  } as const;
  return (
    <>
      {parts.map((p, i) =>
        p.c ? (
          <span key={i} className={`font-medium ${map[p.c]}`}>
            {p.t}
          </span>
        ) : (
          <span key={i}>{p.t}</span>
        ),
      )}
    </>
  );
}

const TOC = [
  ['#concept', 'Concept'],
  ['#why', 'Why NFT'],
  ['#architecture', 'Architecture'],
  ['#lifecycle', 'Lifecycle'],
  ['#contracts', 'Contracts'],
  ['#oracle', 'Oracle'],
  ['#standards', 'TEP'],
  ['#security', 'Security'],
  ['#limitations', 'Limits'],
  ['#mechanicus', 'LM∞'],
];

function CodeBlock({ language, children }: { language: string; children: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#FFD700]/20 bg-black/70 shadow-[0_0_30px_rgba(255,215,0,0.04)]">
      <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#0a0a14] to-[#06060e] px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#FFD700]/70">
          {language}
        </span>
        <Hexagon className="h-3 w-3 text-[#8B5CF6]/60" aria-hidden />
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[12px] leading-relaxed text-[#c4d4ff]">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function Pill({
  label,
  color,
  icon: Icon,
}: {
  label: string;
  color: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider"
      style={{ borderColor: `${color}35`, color, backgroundColor: `${color}10` }}
    >
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {label}
    </span>
  );
}

export default function LicenseNftPage() {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => {
    void navigator.clipboard.writeText(LICENSE_MECH_BLOCK).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }, []);

  return (
    <div className="relative -mx-4 -my-8 min-h-[calc(100vh-10rem)] overflow-hidden text-[#c4c4d4]">
      {/* ── Background: void + sacred grid + scanline pulse ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#04040b]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,215,0,0.35) 1px,transparent 1px),linear-gradient(90deg,rgba(255,215,0,0.22) 1px,transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 20% 0%, rgba(255,215,0,0.08), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(0,245,255,0.06), transparent 50%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 animate-pulse opacity-[0.18]"
        style={{
          background:
            'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.025) 3px,rgba(255,255,255,0.025) 4px)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link
          to="/docs"
          className="mb-10 inline-flex items-center gap-2 text-sm text-[#555] transition-colors hover:text-[#FFD700]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Manifest
        </Link>

        {/* ── HERO ── */}
        <header className="mb-14">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.38em] text-[#FF2A6D]">
            tonforge.org · subsystem · license-nft · rev.2
          </p>
          <h1 className="bg-gradient-to-r from-white via-[#FFD700] to-[#00F5FF] bg-clip-text font-display text-3xl font-bold uppercase tracking-[0.12em] text-transparent drop-shadow-[0_0_40px_rgba(255,215,0,0.25)] sm:text-4xl md:text-5xl">
            License NFT
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.25em] text-[#FFD700]/70">
            Soulbound proof of purchase · forged in TON
          </p>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#9a9ab0] sm:text-lg">
            {H([
              { t: 'Каждая покупка приложения на TonForge выпускает ' },
              { t: 'soulbound NFT', c: 'gold' },
              { t: ' — несъёмное доказательство владения, привязанное к кошельку покупателя. Лицензия живёт в блокчейне, а не в нашей БД. Платформа её ' },
              { t: 'минтит', c: 'cyan' },
              { t: ' через oracle и ' },
              { t: 'верифицирует', c: 'emerald' },
              { t: ' on-chain. Сжигает её сам покупатель — чтобы забрать средства из эскроу в течение trial window.' },
            ])}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Pill label="Soulbound" color="#FFD700" icon={Lock} />
            <Pill label="TEP-62" color="#00F5FF" icon={Hexagon} />
            <Pill label="TEP-64" color="#00F5FF" icon={Hexagon} />
            <Pill label="Backend Oracle" color="#00FF88" icon={Cpu} />
            <Pill label="BuyerBurn refund" color="#FF2A6D" icon={Flame} />
          </div>
        </header>

        {/* ── TOC ── */}
        <nav
          aria-label="Page sections"
          className="mb-12 flex flex-wrap gap-2 border border-white/10 bg-black/25 p-3 backdrop-blur-sm"
        >
          {TOC.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded border border-[#FFD700]/20 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-[#888] transition-all hover:border-[#FFD700]/50 hover:text-[#FFD700]"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* ── CONCEPT ── */}
        <section
          id="concept"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#FFD700]/15 bg-gradient-to-br from-[#0f0f1e]/95 to-[#06060e] p-6 shadow-[0_0_40px_rgba(255,215,0,0.05)] sm:p-8"
        >
          <h2 className="mb-5 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <Sparkles className="h-5 w-5 text-[#FFD700]" aria-hidden />
            Концепция
          </h2>
          <div className="space-y-4 text-sm leading-relaxed sm:text-base">
            <p>
              {H([
                { t: 'License NFT — это ' },
                { t: 'soulbound токен', c: 'gold' },
                { t: ' (несъёмный): после минта он навсегда привязан к кошельку покупателя. Передать нельзя — в storage стоит ' },
                { t: 'transferLimit = 0', c: 'magenta' },
                { t: ', и контракт отклоняет любой входящий Transfer.' },
              ])}
            </p>
            <p>
              {H([
                { t: 'Лицензия выполняет ' },
                { t: 'три функции одновременно', c: 'cyan' },
                { t: ': proof-of-purchase (в metadata зашит SHA-256 артефакта), entitlement key (backend проверяет on-chain владение перед активацией устройства) и refund anchor (покупатель может сжечь NFT в trial window — эскроу вернёт средства автоматически).' },
              ])}
            </p>
            <p>
              {H([
                { t: 'Сжечь NFT может только ' },
                { t: 'сам покупатель', c: 'emerald' },
                { t: ' через BuyerBurn — и только до ' },
                { t: 'burnDeadline', c: 'gold' },
                { t: '. После дедлайна лицензия становится постоянной, а эскроу разблокирует средства продавцу по TimeoutRelease.' },
              ])}
            </p>
            <p className="rounded-lg border border-[#FFD700]/15 bg-black/40 px-4 py-3 font-mono text-xs text-[#FFD700]/90">
              ∅ копий · ∅ "потерянных лицензий" · ∅ серверного локапа · ∅ арбитра при рефанде
            </p>
          </div>
        </section>

        {/* ── WHY NFT ── */}
        <section
          id="why"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#00F5FF]/15 bg-gradient-to-br from-[#0a0a18]/95 to-[#04040c] p-6 sm:p-8"
        >
          <h2 className="mb-5 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <BadgeCheck className="h-5 w-5 text-[#00F5FF]" aria-hidden />
            Зачем нам вообще NFT
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: 'Tamper-evidence',
                color: '#FFD700',
                icon: ShieldCheck,
                body: 'Все минты и сжигания публичны в TON. Фейковая запись в нашей БД без on-chain NFT не пройдёт верификацию.',
              },
              {
                title: 'Cross-device proof',
                color: '#00F5FF',
                icon: Fingerprint,
                body: 'Любое устройство проверяет владение через get_nft_data. Серверная БД — вторичный кэш, не источник истины.',
              },
              {
                title: 'Composability',
                color: '#8B5CF6',
                icon: Network,
                body: 'Tonkeeper, TONScan, сторонние сервисы и AI-агенты видят владение нативно, без нашего API.',
              },
              {
                title: 'Refund integrity',
                color: '#FF2A6D',
                icon: Flame,
                body: 'Рефанд инициируется покупателем, контракт эскроу возвращает средства без арбитра. Событие видно всем.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-lg border border-white/10 bg-black/30 p-4 transition-all hover:border-[#FFD700]/30 hover:shadow-[0_0_20px_rgba(255,215,0,0.06)]"
              >
                <div className="flex items-center gap-2">
                  <card.icon className="h-4 w-4" style={{ color: card.color }} aria-hidden />
                  <h3 className="font-display text-sm font-bold uppercase tracking-wider" style={{ color: card.color }}>
                    {card.title}
                  </h3>
                </div>
                <p className="mt-2 text-sm text-[#a8a8be]">{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── ARCHITECTURE ── */}
        <section
          id="architecture"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#8B5CF6]/20 bg-gradient-to-br from-[#0a0814]/95 to-[#04040c] p-6 sm:p-8"
        >
          <h2 className="mb-5 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <Box className="h-5 w-5 text-[#8B5CF6]" aria-hidden />
            Архитектура: три контракта, один оракул
          </h2>
          <p className="mb-5 text-sm text-[#a8a8be] sm:text-base">
            {H([
              { t: 'Система состоит из трёх Tact-контрактов: ' },
              { t: 'Escrow', c: 'cyan' },
              { t: ' (по одному на покупку, холдит средства), ' },
              { t: 'AppCollection', c: 'gold' },
              { t: ' (по одному на приложение, TEP-62) и ' },
              { t: 'LicenseItem', c: 'magenta' },
              { t: ' (по одному на покупку, TEP-64). Минтит лицензии не покупатель — ' },
              { t: 'backend-oracle', c: 'emerald' },
              { t: ', кошелёк которого задан как ownerAddress в коллекции. Это стандартный паттерн TEP-62: oracle проверяет факт оплаты в эскроу и затем шлёт MintLicense.' },
            ])}
          </p>

          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#FFD700]/70">Mint flow</p>
          <CodeBlock language="sacred flow">
{`Buyer ──PayEscrow──▶ Escrow (state: INIT → FUNDED)
                       │
                       └─ oracle sees event
                          │
                          └─ MintLicense ─▶ AppCollection
                                              │
                                              └─ deploy LicenseItem(index)
                                                      │
                                                      └─ self-register:
                                                         RegisterLicense ──▶ Escrow`}
          </CodeBlock>

          <p className="mb-2 mt-6 font-mono text-[10px] uppercase tracking-[0.25em] text-[#FF2A6D]/80">Refund flow (buyer-initiated, on-chain)</p>
          <CodeBlock language="sacred flow">
{`Buyer ──BuyerBurn──▶ LicenseItem  (require: now ≤ burnDeadline)
                       │
                       ├─ RefundOnBurn ──▶ Escrow  (require: sender == registered license)
                       │                     │
                       │                     └─ SendRemainingBalance ──▶ Buyer
                       │
                       └─ self-destruct`}
          </CodeBlock>

          <p className="mt-5 text-sm text-[#a8a8be]">
            {H([
              { t: 'Адрес каждого ' },
              { t: 'LicenseItem', c: 'gold' },
              { t: ' детерминирован: backend считает его клиентски через ' },
              { t: 'StateInit(code, init_data)', c: 'cyan' },
              { t: ' и поллит ' },
              { t: 'getContractState', c: 'emerald' },
              { t: ' до ' },
              { t: 'state == active', c: 'emerald' },
              { t: '. Ссылка в TONScan и Tonkeeper готова ещё до финализации mint-транзакции.' },
            ])}
          </p>
        </section>

        {/* ── LIFECYCLE ── */}
        <section
          id="lifecycle"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#00FF88]/15 bg-gradient-to-br from-[#06120c]/95 to-[#04040c] p-6 sm:p-8"
        >
          <h2 className="mb-5 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <Zap className="h-5 w-5 text-[#00FF88]" aria-hidden />
            Жизненный цикл лицензии
          </h2>

          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.25em] text-[#00FF88]/70">On-chain (Escrow state)</p>
          <ol className="mb-6 space-y-2 text-sm">
            {[
              ['INIT (0)', '#777', 'Escrow задеплоен, средств нет.'],
              ['FUNDED (1)', '#00F5FF', 'Buyer оплатил, paidAt зафиксирован. Окно для BuyerBurn открыто.'],
              ['RELEASED (3)', '#FFD700', 'Trial window истёк или buyer подтвердил delivery — средства ушли продавцу и треасури.'],
              ['REFUNDED (4)', '#FF2A6D', 'Либо buyer сжёг NFT (BuyerBurn), либо oracle не уложился в grace и buyer вернул средства через RefundIfNotMinted.'],
            ].map(([state, color, desc]) => (
              <li
                key={state}
                className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5"
              >
                <span
                  className="mt-0.5 inline-flex shrink-0 rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color, borderColor: `${color}40`, backgroundColor: `${color}12` }}
                >
                  {state}
                </span>
                <span className="text-[#b8b8cc]">{desc}</span>
              </li>
            ))}
          </ol>

          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.25em] text-[#00FF88]/70">Off-chain (license.state в БД)</p>
          <ol className="space-y-2 text-sm">
            {[
              ['mint_pending', '#00F5FF', 'Покупка подтверждена, оракул поставил задачу минта в очередь.'],
              ['mint_failed', '#FF2A6D', 'Сетевая ошибка или проблема seqno. Оракул ретраит; buyer может дернуть RefundIfNotMinted через 10 минут.'],
              ['trial_active', '#00FF88', 'NFT задеплоен, registered. Tonkeeper показывает его в Collectibles. Buyer может жечь.'],
              ['device_bound', '#8B5CF6', 'Backend проверил on-chain владение и привязал deviceId. On-chain состояние NFT не меняется.'],
              ['released', '#FFD700', 'Trial window истёк и эскроу разблокирован. NFT остаётся у покупателя навсегда.'],
              ['burn_pending', '#FFA040', 'Buyer отправил BuyerBurn; ждём подтверждения.'],
              ['revoked / refunded', '#FF2A6D', 'NFT сожжён, средства вернулись. Verify возвращает false, artifact gate закрыт.'],
            ].map(([state, color, desc]) => (
              <li
                key={state}
                className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5"
              >
                <span
                  className="mt-0.5 inline-flex shrink-0 rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color, borderColor: `${color}40`, backgroundColor: `${color}12` }}
                >
                  {state}
                </span>
                <span className="text-[#b8b8cc]">{desc}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* ── CONTRACTS ── */}
        <section
          id="contracts"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#FFD700]/15 bg-gradient-to-br from-[#101018]/95 to-[#06060e] p-6 sm:p-8"
        >
          <h2 className="mb-5 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <Hexagon className="h-5 w-5 text-[#FFD700]" aria-hidden />
            Контракты (Tact)
          </h2>
          <p className="mb-4 text-sm text-[#a8a8be]">
            {H([
              { t: 'Исходники — в ' },
              { t: 'contracts/src/', c: 'emerald' },
              { t: ', покрытие sandbox-тестов по всем четырём спекам (' },
              { t: 'escrow · appCollection · licenseItem · licenseLifecycle', c: 'cyan' },
              { t: '). Runbook с процедурами testnet→mainnet — в ' },
              { t: 'docs/license-nft-runbook.md', c: 'gold' },
              { t: '.' },
            ])}
          </p>
          <div className="space-y-4">
            <CodeBlock language="tact · soulbound license item">{TACT_LICENSE_ITEM}</CodeBlock>
            <CodeBlock language="tact · TEP-62 collection (Option C)">{TACT_APP_COLLECTION}</CodeBlock>
          </div>
        </section>

        {/* ── ORACLE ── */}
        <section
          id="oracle"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#00F5FF]/15 bg-gradient-to-br from-[#06121a]/95 to-[#04040c] p-6 sm:p-8"
        >
          <h2 className="mb-5 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <Cpu className="h-5 w-5 text-[#00F5FF]" aria-hidden />
            Backend oracle (TypeScript)
          </h2>
          <p className="mb-4 text-sm text-[#a8a8be]">
            {H([
              { t: 'Один WalletV4 c мнемоникой в ' },
              { t: 'ORACLE_MNEMONIC', c: 'magenta' },
              { t: ' (Coolify secret). Адрес кошелька == ' },
              { t: 'AppCollection.ownerAddress', c: 'gold' },
              { t: ', поэтому только наш backend может вызывать MintLicense, BurnLicense и ChangeOwner. Gas-бюджеты сконфигурированы через env (' },
              { t: 'LICENSE_MINT_GAS_NANO=0.1 TON', c: 'emerald' },
              { t: ', ' },
              { t: 'LICENSE_BURN_GAS_NANO=0.05 TON', c: 'emerald' },
              { t: ').' },
            ])}
          </p>
          <div className="space-y-4">
            <CodeBlock language="typescript · mint">{TS_ORACLE_MINT}</CodeBlock>
            <CodeBlock language="typescript · on-chain verify">{TS_VERIFY}</CodeBlock>
          </div>
        </section>

        {/* ── STANDARDS ── */}
        <section
          id="standards"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#8B5CF6]/15 bg-gradient-to-br from-[#0a0814]/95 to-[#04040c] p-6 sm:p-8"
        >
          <h2 className="mb-5 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <BadgeCheck className="h-5 w-5 text-[#8B5CF6]" aria-hidden />
            TEP-соответствие
          </h2>
          <ul className="space-y-3 text-sm text-[#b8b8cc]">
            <li className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00FF88]" aria-hidden />
              <span>
                <strong className="text-white">TEP-62</strong> — коллекция реализует канонические геттеры{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00F5FF]">get_collection_data</code>,{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00F5FF]">get_nft_content</code>.
                Индексация item-ов через монотонный{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#FFD700]">nextItemIndex</code>.
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00FF88]" aria-hidden />
              <span>
                <strong className="text-white">TEP-64</strong> — off-chain content с префиксом{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#FFD700]">0x01</code> +{' '}
                UTF-8 URI на JSON. Геттер{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00F5FF]">get_nft_data</code>{' '}
                возвращает <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#8B5CF6]">(init, index, collection, owner, content)</code>.
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FFD700]" aria-hidden />
              <span>
                <strong className="text-white">TEP-85 (SBT) — не наследуем</strong>. TEP-85 требует отдельную authority-роль
                (prove_ownership / destroy / revoke), которая по сути дублирует{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#8B5CF6]">collection_owner</code>.
                Soulbound-семантику мы получаем проще — через{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#FF2A6D]">transferLimit = 0</code>{' '}
                в item-контракте. Для коллекционных NFT (в будущем) этот же механизм даёт controlled edition с{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#FFD700]">transferLimit &gt; 0</code>.
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00FF88]" aria-hidden />
              <span>
                <strong className="text-white">Sharding-friendly</strong> — у каждого NFT свой контракт, общего state
                нет, валидаторы могут процессить параллельно (TON-нативный паттерн).
              </span>
            </li>
          </ul>

          <div className="mt-5 flex flex-wrap gap-3 text-xs">
            <a
              href="https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#00F5FF] hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> TEP-62
            </a>
            <a
              href="https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#00F5FF] hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> TEP-64
            </a>
            <a
              href="https://github.com/ton-blockchain/TEPs/blob/master/text/0085-sbt-standard.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#8B5CF6] hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> TEP-85
            </a>
            <a
              href="https://docs.tact-lang.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#FFD700] hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Tact docs
            </a>
          </div>
        </section>

        {/* ── SECURITY ── */}
        <section
          id="security"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#FF2A6D]/15 bg-gradient-to-br from-[#180810]/95 to-[#04040c] p-6 sm:p-8"
        >
          <h2 className="mb-5 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <ShieldCheck className="h-5 w-5 text-[#FF2A6D]" aria-hidden />
            Безопасность и threat-model
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Mint без оплаты', 'Практически невозможен при целостности ключа: только oracle-кошелёк может вызвать MintLicense, и backend дёргает его только после state=FUNDED в эскроу.'],
              ['Двойной mint', 'queryId=hash(sessionId) + unique-constraint на purchase_session_id в БД + SELECT…FOR UPDATE. Поверх — контрактный nextItemIndex монотонно растёт.'],
              ['Подмена лицензии', 'activateDevice → on-chain verifyLicenseOwner до записи deviceId. Запись в БД без живого NFT не пройдёт.'],
              ['Refund-fraud', 'BuyerBurn возможен только от owner и только пока now() ≤ burnDeadline. После дедлайна — контракт отклоняет.'],
              ['Oracle завис', 'Через 600 секунд после оплаты buyer может сам вызвать RefundIfNotMinted и вернуть средства без участия платформы.'],
              ['Compromise oracle', 'ChangeOwner(newOracle) → ротация ключа, существующие NFT остаются валидными.'],
              ['Loss of mnemonic', 'Plan B: деплой новой коллекции; старые NFT остаются у владельцев, новые минты в старой коллекции невозможны.'],
              ['Подмена item-кода', 'nftItemCode фиксирован в StateInit коллекции; backend сверяет hash с pinned env LICENSE_NFT_ITEM_CODE_BOC.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg border border-white/10 bg-black/35 p-3">
                <p className="font-mono text-[11px] uppercase tracking-wider text-[#FF2A6D]">{title}</p>
                <p className="mt-1 text-sm text-[#b8b8cc]">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs text-[#666]">
            Полный runbook операций:{' '}
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[#FFD700]">docs/license-nft-runbook.md</code>;
            спецификация:{' '}
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[#FFD700]">docs/license-nft-spec.md</code>.
          </p>
        </section>

        {/* ── CURRENT LIMITATIONS ── */}
        <section
          id="limitations"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#FFA040]/25 bg-gradient-to-br from-[#1a1206]/95 to-[#04040c] p-6 sm:p-8"
        >
          <h2 className="mb-5 flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
            <AlertTriangle className="h-5 w-5 text-[#FFA040]" aria-hidden />
            Current limitations (Option C)
          </h2>
          <p className="mb-4 text-sm text-[#c8b898]">
            {H([
              { t: 'Текущая реализация — это осознанно упрощённый ' },
              { t: 'Option C', c: 'gold' },
              { t: '. Мы фиксируем известные компромиссы здесь, а не прячем их в TODO-комментариях.' },
            ])}
          </p>
          <ul className="space-y-3 text-sm text-[#c8b898]">
            <li className="rounded-lg border border-[#FFA040]/20 bg-black/40 p-3">
              <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-[#FFA040]">
                Mint gated by oracle, not trustless
              </p>
              <p>
                В канонической TEP-62-архитектуре Escrow сам шлёт MintLicense в Collection, а Collection проверяет{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#FFD700]">init_hash(sender) == expectedEscrow</code>.
                У нас сейчас минт разрешён только от oracle-кошелька. Скомпрометированный ключ оракула → потенциальная
                возможность фейкового минта. Митигация: hardware wallet в проде, ротация через ChangeOwner, multisig в
                roadmap.
              </p>
            </li>
            <li className="rounded-lg border border-[#FFA040]/20 bg-black/40 p-3">
              <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-[#FFA040]">
                Known bug: escrowAddress в LicenseItem
              </p>
              <p>
                В сообщении{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#FF2A6D]">MintLicense</code>{' '}
                нет поля{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#FF2A6D]">escrowAddress</code>.
                AppCollection использует{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00F5FF]">sender()</code> как
                escrow-адрес при деплое item-а — то есть LicenseItem привязывается к адресу oracle, а не к реальному
                Escrow. Refund-петля (LicenseItem → RefundOnBurn → Escrow) в продакшене без патча не замкнётся.
                Исправление — добавить{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00FF88]">escrowAddress</code>{' '}
                в payload MintLicense и передавать его в{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00FF88]">initOf LicenseItem</code>.
              </p>
            </li>
            <li className="rounded-lg border border-[#FFA040]/20 bg-black/40 p-3">
              <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-[#FFA040]">
                Metadata hosting — пока Appwrite
              </p>
              <p>
                TEP-64 JSON хостятся в Appwrite Storage (bucket{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#FFD700]">license-metadata</code>).
                Для production-target — IPFS / Pinata, чтобы при исчезновении нашего CDN лицензия оставалась читаемой.
              </p>
            </li>
            <li className="rounded-lg border border-[#FFA040]/20 bg-black/40 p-3">
              <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-[#FFA040]">
                Пока не защищаем
              </p>
              <p>
                Реверс-инжиниринг скачанного бинарника и шаринг файла вне платформы — вне scope этого слоя. Лицензия
                защищает право на обновления и entitlement, не сам артефакт. DRM-watermarking — отдельный roadmap item.
              </p>
            </li>
          </ul>
        </section>

        {/* ── MECHANICUS BLOCK FOR LM∞ ── */}
        <section
          id="mechanicus"
          className="mb-10 scroll-mt-24 rounded-xl border border-[#FF2A6D]/30 bg-gradient-to-br from-[#0a0008]/95 to-[#000] p-6 shadow-[0_0_60px_rgba(255,42,109,0.08)] sm:p-8"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-widest text-white">
              <Coins className="h-5 w-5 text-[#FF2A6D]" aria-hidden />
              LM∞ · Mechanicus block
            </h2>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#FFD700]/30 bg-[#FFD700]/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-[#FFD700] transition-all hover:border-[#FFD700]/60 hover:bg-[#FFD700]/20"
            >
              <Copy className="h-3 w-3" />
              {copied ? 'copied' : 'copy chunk'}
            </button>
          </div>
          <p className="mb-4 text-xs text-[#888]">
            Скопируйте блок и вставьте в системный prompt AI-агента (Claude, GPT, локальная LM-модель).
            Грамматика та же, что на{' '}
            <Link to="/docs#mechanicus" className="text-[#FFD700] hover:underline">/docs#mechanicus</Link>: операторы (≡, →, ⊕, ∅),
            домены (W/X/A/P), сжатые правила. Малая модель не ошибётся в API контрактов.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-[#FF2A6D]/20 bg-black/80 p-4 font-mono text-[11px] leading-relaxed text-[#7affb0]">
            <code>{LICENSE_MECH_BLOCK}</code>
          </pre>
        </section>

        <p className="mt-12 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-[#444]">
          forged in TON · soulbound by design · burnable by consent
        </p>
      </div>
    </div>
  );
}
