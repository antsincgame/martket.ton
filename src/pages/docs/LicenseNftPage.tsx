import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
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
const LICENSE_MECH_BLOCK = `OMNISSIAH::TONFORGE_LICENSE_NFT v1
IN→license_nft_subsystem OUT→codegen_context
D.tags|concept;contracts;flow;authority;safety

## IDENTITY
W|A|License≡soulbound_NFT;∅transferable;∅fungible
W|A|standard_base=TEP-62+TEP-64;soulbound_intent≡TEP-85
W|A|owner_intent=proof_of_purchase+device_binding+refund_burn
W|A|deploy_target=TON_mainnet;testnet_first→smoke_E2E

## CONTRACTS
A|W|AppCollection.tact≡TEP-62_collection;1_per_app
A|W|LicenseItem.tact≡TEP-64_item;1_per_purchase
A|W|Escrow.tact≡existing;∅change;event_source→escrow_locked
A|W|item_address→deterministic(code,init);buyer-scoped

## STORAGE: AppCollection
A|W|appId:Int256;ownerAddress:Address;nextItemIndex:Int64
A|W|collectionContent:Cell;commonContent:Cell

## STORAGE: LicenseItem
A|W|index:Int(uint256);collection:Address;ownerAddress:Address;escrowAddress:Address
A|W|transferLimit:Int(uint8);transfers:Int(uint8);content:Cell
A|W|transferLimit=0→soulbound;transferLimit>0→edition

## OPCODES
A|W|MintLicense=0x6a3aaa14;BurnLicense=0x4d8e8a14
A|W|ChangeOwner=0x4d8b8b8b;Burn(internal)=fwd_from_collection

## AUTHORITY MATRIX
P|A|MintLicense.sender→require==self.ownerAddress(oracle)
P|A|BuyerBurn.sender→require==self.ownerAddress(buyer);now<burnDeadline
P|A|Burn(item).sender→require==self.collection
P|A|Transfer(item).sender→require==self.ownerAddress;count→require<self.transferLimit

## OFF-CHAIN ORACLE (backend)
A|W|wallet=WalletV4;mnemonic=ORACLE_MNEMONIC(env)
A|W|wallet.address≡AppCollection.ownerAddress;deploy_owner==oracle
A|W|on_event(escrow_locked)→mintLicense(buyer,escrow,index)
A|W|on_event(buyer_burn)→LicenseItem.BuyerBurn→Escrow.RefundOnBurn
A|W|verifyOwner→runMethod(get_nft_data)→cmp_ownerAddress

## STATE MACHINE
A|W|license.state∈{mint_pending,minted,mint_failed,
A|W|  refund_pending,refunded,burned}
A|W|confirm_purchase→mint_pending→[oracle.mint]→minted
A|W|mint_fail(3 retries)→mint_failed→[oracle.refund 1h]→refund_pending→refunded
A|W|buyer_burn→LicenseItem.BuyerBurn→[escrow.RefundOnBurn]→burned

## METADATA (TEP-64 off-chain)
A|W|content_prefix=0x01;tail=utf8(URI)
A|W|collection_meta=<metadataUri>/collection.json
A|W|item_meta=<metadataUriPrefix><index>.json
A|W|fields={name,description,image,attributes:[app_id,sha256,
A|W|  license_type,trial_ends_at,escrow_addr]}

## VERIFICATION FLOW
X|A|frontend.activate→backend.activateDevice
X|A|backend→runMethod(get_nft_data,licenseAddr)
X|A|require(owner==buyerWallet)→else_throw(license_not_owned_onchain)
X|A|tonscan_link=https://tonscan.org/nft/<addr>
X|A|tonkeeper_link=ton://transfer/<addr>

## SECURITY
P|A|sharding→1_contract_per_NFT;∅shared_state;parallel_safe
P|A|gas_budget→mint=0.15TON;burn=0.07TON;configurable_env
P|A|race_safe→DB_unique(purchase_session_id)+SELECT_FOR_UPDATE
P|A|mint_idempotent→queryId=BigInt(Date.now())+DB_unique(session_id)
P|A|key_rotation→ChangeOwner(newOracle)→update_env→restart

## CONSTRAINTS
∅user_initiated_mint;∅bypass_escrow;∅transfer_when_limit_zero
∅burn_without_collection_consent;∅mint_without_oracle_signature
parity_rule→Human==AIAgent→same_NFT_lifecycle

ASCII_FALLBACK::
  buyer -> Frontend -> TonConnect -> Escrow.deploy+pay
  Escrow.locked -> Backend.oracle -> AppCollection.MintLicense
  AppCollection -> deploy LicenseItem -> buyer.wallet
  refund -> buyer.BuyerBurn -> LicenseItem.selfdestruct -> Escrow.RefundOnBurn -> buyer.wallet

READY@send_chunk`;

/* ═══════════════════════════════════════════════════════════════
   Code samples used in the page (kept inline so they render literally,
   not as React-evaluated expressions).
   ═══════════════════════════════════════════════════════════════ */
const TACT_LICENSE_ITEM = `// contracts/src/licenseItem.tact (excerpt)
contract LicenseItem with Deployable {
    index:         Int as uint256;
    collection:    Address;
    ownerAddress:  Address;
    escrowAddress: Address;
    transferLimit: Int as uint8;   // 0 → soulbound forever
    transfers:     Int as uint8;
    content:       Cell;

    receive(msg: Transfer) {
        require(sender() == self.ownerAddress, "Only owner can transfer");
        require(self.transfers < self.transferLimit,
                "Soulbound or transfer limit exhausted");
        self.ownerAddress = msg.newOwner;
        self.transfers = self.transfers + 1;
    }

    receive(msg: Burn) {
        // Only the parent AppCollection can ask us to self-destruct.
        require(sender() == self.collection,
                "Only collection can burn");
        send(SendParameters{
            to: self.ownerAddress,
            value: 0,
            mode: SendRemainingBalance + SendDestroyIfZero,
            bounce: false,
            body: "License burned".asComment()
        });
    }
}`;

const TACT_APP_COLLECTION = `// contracts/src/appCollection.tact (excerpt)
contract AppCollection with Deployable {
    appId:             Int as uint256;
    ownerAddress:      Address;      // oracle wallet, set at deploy
    nextItemIndex:     Int as uint64;
    collectionContent: Cell;
    commonContent:     Cell;

    receive(msg: MintLicense) {
        // Oracle-only mint: nobody else can fabricate a license.
        require(sender() == self.ownerAddress, "Only collection owner can mint");
        require(context().value >= ton("0.05"), "Insufficient gas for mint");
        let init: StateInit = initOf LicenseItem(
            self.nextItemIndex,
            myAddress(),
            msg.buyerAddress,
            msg.escrowAddress,
            msg.transferLimit,
            msg.individualContent
        );
        self.nextItemIndex = self.nextItemIndex + 1;
        send(SendParameters{
            to: contractAddress(init), value: 0,
            mode: SendRemainingValue, bounce: false,
            code: init.code, data: init.data,
            body: "License minted".asComment()
        });
    }

    receive(msg: BurnLicense) {
        require(sender() == self.ownerAddress, "Only collection owner can burn");
        send(SendParameters{
            to: msg.itemAddress, value: 0,
            mode: SendRemainingValue, bounce: false,
            body: Burn{ queryId: msg.queryId }.toCell()
        });
    }
}`;

const TS_ORACLE_MINT = `// backend/tonforge/onchain/mintLicense.ts
export async function mintLicense(args: MintArgs) {
  const collection = AppCollection.fromInit(getCollectionCode(), {
    appId: args.appId, ownerAddress: oracle.address,
    collectionContent: emptyCell(), commonContent: emptyCell(),
  });
  const item = LicenseItem.fromInit(getItemCode(), {
    index: args.index,
    collection: collection.address,
    owner: args.buyer,
    escrow: args.escrow,
    transferLimit: 0,                      // soulbound license
    transfers: 0,
    content: buildOffchainContent(args.metadataUri),
  });
  await oracle.send(client, {
    to: collection.address, value: GAS_BUDGET_MINT,
    body: buildMintLicensePayload({
      queryId: args.queryId,
      buyerAddress: args.buyer,
      escrowAddress: args.escrow,
      transferLimit: 0,
      individualContent: buildOffchainContent(args.metadataUri),
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
            tonforge.org · subsystem · license-nft · rev.1
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
              { t: ' — несъёмное доказательство владения, привязанное к кошельку покупателя. Лицензия живёт в блокчейне, не в нашей БД. Мы лишь её ' },
              { t: 'минтим', c: 'cyan' },
              { t: ', ' },
              { t: 'верифицируем', c: 'emerald' },
              { t: ' и при возврате денег — ' },
              { t: 'сжигаем', c: 'magenta' },
              { t: '.' },
            ])}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Pill label="Soulbound" color="#FFD700" icon={Lock} />
            <Pill label="TEP-62" color="#00F5FF" icon={Hexagon} />
            <Pill label="TEP-64" color="#00F5FF" icon={Hexagon} />
            <Pill label="TEP-85 spirit" color="#8B5CF6" icon={Hexagon} />
            <Pill label="Backend Oracle" color="#00FF88" icon={Cpu} />
            <Pill label="Refund-burn" color="#FF2A6D" icon={Flame} />
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
            Концепция: лицензия как сокровище
          </h2>
          <div className="space-y-4 text-sm leading-relaxed sm:text-base">
            <p>
              {H([
                { t: 'TonForge — это ' },
                { t: 'маркетплейс сокровищ разработки', c: 'gold' },
                { t: '. Каждое приложение, каждая AI-утилита, каждая игра — артефакт труда демиурга. И каждое доказательство покупки — тоже артефакт, ' },
                { t: 'выкованный в блокчейне TON', c: 'cyan' },
                { t: ', а не запись в чьей-то приватной БД, которую можно безнаказанно удалить.' },
              ])}
            </p>
            <p>
              {H([
                { t: 'Технически это ' },
                { t: 'soulbound NFT', c: 'gold' },
                { t: ' (несъёмный): после минта он навсегда привязан к кошельку покупателя. Передать нельзя — ' },
                { t: 'transferLimit = 0', c: 'magenta' },
                { t: '. Сжечь может сам покупатель через BuyerBurn в течение trial window — эскроу автоматически вернёт средства.' },
              ])}
            </p>
            <p className="rounded-lg border border-[#FFD700]/15 bg-black/40 px-4 py-3 font-mono text-xs text-[#FFD700]/90">
              ∅ копий · ∅ "потерянных лицензий" · ∅ серверного локапа
            </p>
            <p className="text-xs text-[#666]">
              Безопасность зависит от сохранности ключа оракула. При компрометации оракул теоретически может минтить
              без оплаты — ротация ключа закрывает угрозу, существующие лицензии остаются валидными.
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
                body: 'Все минты и сжигания публичны в TON. Возврат средств возможен только через buyer-initiated burn в течение trial window — это событие видно всем.',
              },
              {
                title: 'Cross-device proof',
                color: '#00F5FF',
                icon: Fingerprint,
                body: 'Любое устройство покупателя проверяет владение через get_nft_data — без серверной БД.',
              },
              {
                title: 'Composability',
                color: '#8B5CF6',
                icon: Network,
                body: 'Сторонние сервисы (Tonkeeper, TONScan, AI-агенты) видят владение нативно.',
              },
              {
                title: 'Refund integrity',
                color: '#FF2A6D',
                icon: Flame,
                body: 'Burn — это публичное событие. Возврат нельзя «забыть» или скрыть.',
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
            Архитектура: Backend-Oracle Mint
          </h2>
          <p className="mb-5 text-sm text-[#a8a8be] sm:text-base">
            {H([
              { t: 'Минтит NFT не покупатель — это было бы небезопасно. Минтит ' },
              { t: 'backend-кошелёк (oracle)', c: 'emerald' },
              { t: ', который видит событие ' },
              { t: 'escrow_locked', c: 'cyan' },
              { t: ' и шлёт ' },
              { t: 'MintLicense', c: 'gold' },
              { t: ' в коллекцию. Это стандартный паттерн TEP-62: оракул минтит только после подтверждённой оплаты, что делает несанкционированный минт практически невозможным при целостности ключа.' },
            ])}
          </p>

          <CodeBlock language="ASCII / SACRED FLOW">
{`┌──────────┐  TonConnect   ┌──────────┐  event       ┌──────────┐
│  Buyer   │──────────────▶│  Escrow  │─────────────▶│  Oracle  │
│  wallet  │  pay TON      │ contract │  locked      │ (backend)│
└──────────┘               └──────────┘              └────┬─────┘
                                                          │ MintLicense
                                                          ▼
                            ┌──────────┐   deploy    ┌──────────┐
   buyer.collectibles ◀─────│  Coll.   │────────────▶│ License  │
                            │ (TEP-62) │             │ Item NFT │
                            └────┬─────┘             └──────────┘
                                 │
                                 │  refund decision
                                 ▼
                            ┌──────────┐  Burn{}    ┌──────────┐
                            │ Oracle   │───────────▶│ License  │  → self-destruct
                            │ BurnLic. │             │  Item    │  → balance → buyer
                            └──────────┘             └──────────┘`}
          </CodeBlock>

          <p className="mt-5 text-sm text-[#a8a8be]">
            {H([
              { t: 'Адрес каждого ' },
              { t: 'LicenseItem', c: 'gold' },
              { t: ' детерминирован: backend считает его клиентски через ' },
              { t: 'StateInit(buyer, escrow, content)', c: 'cyan' },
              { t: ' и поллит ', },
              { t: 'getContractState', c: 'emerald' },
              { t: ' до ' },
              { t: 'state == active', c: 'emerald' },
              { t: '. Это даёт нам мгновенную ссылку на NFT в TONScan ещё до подтверждения транзакции.' },
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
          <ol className="space-y-3 text-sm">
            {[
              ['mint_pending', '#00F5FF', 'Покупатель оплатил. Oracle ставит задачу минта NFT в очередь.'],
              ['minted', '#00FF88', 'NFT задеплоен и зарегистрирован в Escrow. Скачивание разблокировано.'],
              ['mint_failed', '#FFA040', 'Минт не удался после 3 попыток. Автоматический рефанд через 1 час.'],
              ['refund_pending', '#8B5CF6', 'OracleRefund отправлен в Escrow. Ожидание подтверждения on-chain.'],
              ['refunded', '#FFD700', 'Средства возвращены покупателю. Escrow самоуничтожился.'],
              ['burned', '#FF2A6D', 'NFT сожжён покупателем (BuyerBurn). Escrow рефанднул средства.'],
              ['refunded', '#FF8800', 'Средства вернулись покупателю. NFT сожжён, лицензия аннулирована.'],
              ['mint_failed', '#FF2A6D', 'Сетевая ошибка. Мы автоматически ретраим, покупатель продолжает скачивать.'],
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
              { t: 'Два смарт-контракта на ' },
              { t: 'Tact', c: 'cyan' },
              { t: ': ' },
              { t: 'AppCollection', c: 'gold' },
              { t: ' (один на приложение) и ' },
              { t: 'LicenseItem', c: 'gold' },
              { t: ' (один на покупку). Полные исходники — в ' },
              { t: 'contracts/src/', c: 'emerald' },
              { t: ', тестов в sandbox: ' },
              { t: '37/37 passed', c: 'emerald' },
              { t: '.' },
            ])}
          </p>
          <div className="space-y-4">
            <CodeBlock language="tact · soulbound license item">{TACT_LICENSE_ITEM}</CodeBlock>
            <CodeBlock language="tact · TEP-62 collection">{TACT_APP_COLLECTION}</CodeBlock>
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
              { t: 'Один WalletV4 с мнемоникой в ' },
              { t: 'ORACLE_MNEMONIC', c: 'magenta' },
              { t: '. Адрес кошелька == ' },
              { t: 'AppCollection.ownerAddress', c: 'gold' },
              { t: '. Поэтому только наш backend может вызывать ' },
              { t: 'MintLicense', c: 'cyan' },
              { t: ' и ' },
              { t: 'BurnLicense', c: 'cyan' },
              { t: '.' },
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
            TEP-соответствие и best practices
          </h2>
          <ul className="space-y-3 text-sm text-[#b8b8cc]">
            <li className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00FF88]" aria-hidden />
              <span>
                <strong className="text-white">TEP-62</strong> — реализуем все обязательные геттеры коллекции:
                <code className="ml-1 rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00F5FF]">get_collection_data</code>,{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00F5FF]">get_nft_address_by_index</code>,{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00F5FF]">get_nft_content</code>.
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00FF88]" aria-hidden />
              <span>
                <strong className="text-white">TEP-64</strong> — off-chain content prefix{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#FFD700]">0x01</code> +{' '}
                UTF-8 URI на JSON. Геттер{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00F5FF]">get_nft_data</code>{' '}
                возвращает каноничный кортеж.
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FFD700]" aria-hidden />
              <span>
                <strong className="text-white">TEP-85 (SBT spirit)</strong> — мы реализуем суть soulbound через{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#FF2A6D]">transferLimit=0</code>{' '}
                и oracle-revoke вместо полного TEP-85 интерфейса (prove_ownership / destroy / revoke). Это даёт совместимость
                с TonConnect/Tonkeeper, которые уже понимают TEP-62/64.
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00FF88]" aria-hidden />
              <span>
                <strong className="text-white">Sharding-friendly</strong> — у каждого NFT свой контракт, общего state
                нет, валидаторы могут процессить параллельно (TON-нативный паттерн).
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00FF88]" aria-hidden />
              <span>
                <strong className="text-white">Gas budget</strong> — bounded:{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#FFD700]">0.15 TON</code> mint /{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#FFD700]">0.07 TON</code> burn (configurable),
                Excess возвращается оракулу через{' '}
                <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[#00F5FF]">SendRemainingBalance</code>.
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
              href="https://docs.ton.org/standard/tokens/nft/sbt"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#FFD700] hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> docs.ton.org · SBT
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
              ['Mint без оплаты', 'Практически невозможен при целостности ключа: только oracle-кошелёк может вызвать MintLicense, и backend дёргает его только после escrow_locked.'],
              ['Двойной mint', 'queryId=hash(sessionId), unique-constraint на purchase_session_id в БД, SELECT…FOR UPDATE.'],
              ['Подмена лицензии', 'activateDevice → on-chain verifyLicenseOwner перед записью deviceId.'],
              ['Refund-fraud', 'BuyerBurn возможен только от owner в пределах burnDeadline. После deadline — эскроу release seller.'],
              ['Compromise oracle', 'ChangeOwner(newOracle) → ротация ключа, старые лицензии валидны.'],
              ['Loss of mnemonic', 'Plan B: новая коллекция, старые NFT остаются у владельцев навсегда.'],
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
            Скопируйте блок ниже и вставьте в системный prompt вашего AI-агента (Claude, GPT, локальная LM-модель).
            Грамматика та же, что в основной документации{' '}
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
