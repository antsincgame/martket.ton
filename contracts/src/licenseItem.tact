import "@stdlib/deploy";
import "./escrow.tact";

// ─── Messages ────────────────────────────────────────────────────────
//
// Item-side: TEP-62 transfer + Burn from collection + BuyerBurn.
// Soulbound по умолчанию — transferLimit = 0 в стандартном mint flow.
//
// NOTE: RegisterLicense и RefundOnBurn объявлены в escrow.tact и
// получаются через import. Дублировать здесь нельзя — Tact валит
// компиляцию при collision'е типов с одинаковым именем.

message(0x5fcc3d14) Transfer {
    queryId:    Int as uint64;
    newOwner:   Address;
    responseTo: Address;
    customPayload: Cell?;
    forwardAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

message(0x595f07bc) Burn {
    queryId: Int as uint64;
}

message(0x2fcb26a2) GetStaticData {
    queryId: Int as uint64;
}

message(0x8b771735) ReportStaticData {
    queryId:    Int as uint64;
    index:      Int as uint256;
    collection: Address;
}

message(0x05138d91) OwnerAssigned {
    queryId:        Int as uint64;
    prevOwner:      Address;
    forwardPayload: Slice as remaining;
}

message(0xd53276db) Excesses {
    queryId: Int as uint64;
}

// Buyer-initiated burn: owner burns NFT within trial window,
// triggering an automatic on-chain refund from escrow.
message(0x7a1b3c5d) BuyerBurn {
    queryId: Int as uint64;
}

// Owner recovery for a stuck two-phase burn (A-1). If BuyerBurn was accepted by
// the escrow (refund issued) but the BurnConfirmed reply was lost, the item is
// left burnRequested=true with no way to finalize. After burnDeadline — by which
// point a refund has settled or the burn window has closed — the owner may
// finalize and reclaim the item's residual balance.
message(0x6b2e4d1a) FinalizeBurn {
    queryId: Int as uint64;
}

// ─── Contract ────────────────────────────────────────────────────────

contract LicenseItem with Deployable {
    index:         Int as uint256;
    collection:    Address;
    ownerAddress:  Address;
    escrowAddress: Address;
    transferLimit: Int as uint8;
    transfers:     Int as uint8;
    content:       Cell;
    burnDeadline:  Int as uint32;
    burnRequested: Bool;

    init(
        index:         Int,
        collection:    Address,
        ownerAddress:  Address,
        escrowAddress: Address,
        transferLimit: Int,
        content:       Cell,
        burnDeadline:  Int,
    ) {
        self.index         = index;
        self.collection    = collection;
        self.ownerAddress  = ownerAddress;
        self.escrowAddress = escrowAddress;
        self.transferLimit = transferLimit;
        self.transfers     = 0;
        self.content       = content;
        self.burnDeadline  = burnDeadline;
        self.burnRequested = false;
    }

    // ─── Deploy-сообщение от Collection ──────────────────────────────
    //
    // Collection деплоит айтем с пустым телом — этот no-op receiver его
    // поглощает. Регистрацию лицензии в Escrow теперь выполняет САМА
    // Collection (RegisterLicense, привязанный к self.collectionAddress
    // на стороне эскроу), а не айтем: прежняя «саморегистрация» висела на
    // пустом receive(), но Collection слала текстовый комментарий
    // ("License minted".asComment()) с opcode=0 — он НЕ матчился пустым
    // телом, поэтому регистрация не происходила вовсе, а деплой айтема
    // аварийно завершался. См. CON-01 fix в appCollection.tact / escrow.tact.

    receive() {
        // no-op: поглощает пустое deploy-сообщение от Collection.
    }

    // ─── TEP-62 Transfer ─────────────────────────────────────────────

    receive(msg: Transfer) {
        require(sender() == self.ownerAddress, "Only owner can transfer");
        require(self.transfers < self.transferLimit, "Soulbound or transfer limit exhausted");

        let prev: Address = self.ownerAddress;
        self.ownerAddress = msg.newOwner;
        self.transfers = self.transfers + 1;

        if (msg.forwardAmount > 0) {
            send(SendParameters{
                to: msg.newOwner,
                value: msg.forwardAmount,
                mode: SendPayGasSeparately,
                bounce: false,
                body: OwnerAssigned{
                    queryId: msg.queryId,
                    prevOwner: prev,
                    forwardPayload: msg.forwardPayload,
                }.toCell(),
            });
        }

        send(SendParameters{
            to: msg.responseTo,
            value: 0,
            mode: SendRemainingValue | SendIgnoreErrors,
            bounce: false,
            body: Excesses{ queryId: msg.queryId }.toCell(),
        });
    }

    // ─── Burn (collection-mediated, for admin edge cases) ────────────

    receive(msg: Burn) {
        require(sender() == self.collection, "Only collection can burn");

        send(SendParameters{
            to: self.ownerAddress,
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero,
            bounce: false,
            body: "License burned".asComment(),
        });
    }

    // ─── BuyerBurn: owner burns NFT → escrow auto-refund ─────────────
    //
    // Двухфазный burn (H-1 fix). Раньше айтем самоуничтожался В ТОЙ ЖЕ
    // транзакции, что слал RefundOnBurn (bounce:false, без bounced-обработки):
    // если эскроу отвергал возврат (не FUNDED / окно закрыто / адрес не
    // совпал), покупатель терял и NFT, и деньги. Теперь:
    //   1. BuyerBurn только помечает burnRequested и шлёт RefundOnBurn
    //      (bounce:true) — НЕ уничтожаясь.
    //   2. Эскроу при успехе отвечает BurnConfirmed → айтем уничтожается.
    //   3. Если RefundOnBurn баунсится — bounced() снимает флаг, NFT цел.
    receive(msg: BuyerBurn) {
        require(sender() == self.ownerAddress, "Only owner can burn");
        require(now() <= self.burnDeadline, "Trial window closed");
        require(!self.burnRequested, "Burn already requested");

        self.burnRequested = true;

        send(SendParameters{
            to: self.escrowAddress,
            value: ton("0.05"),
            mode: SendPayGasSeparately,
            bounce: true,
            body: RefundOnBurn{}.toCell(),
        });
    }

    // Эскроу подтвердил возврат — теперь безопасно уничтожить лицензию.
    receive(msg: BurnConfirmed) {
        require(sender() == self.escrowAddress, "Only bound escrow");
        require(self.burnRequested, "No burn in progress");

        send(SendParameters{
            to: self.ownerAddress,
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero,
            bounce: false,
            body: "License burned by owner".asComment(),
        });
    }

    // RefundOnBurn отвергнут эскроу (баунс) — откатываем запрос, NFT остаётся
    // валидным, покупатель может повторить позже (в пределах burnDeadline).
    bounced(msg: RefundOnBurn) {
        self.burnRequested = false;
    }

    // A-1 recovery: finalize a burn whose BurnConfirmed was lost. Gated on owner
    // + burnRequested + past burnDeadline, so the refund (if RefundOnBurn was
    // accepted) has already settled and the burn window is closed — no double
    // refund is possible (the escrow is REFUNDED, rejecting any further refund).
    receive(msg: FinalizeBurn) {
        require(sender() == self.ownerAddress, "Only owner can finalize");
        require(self.burnRequested, "No burn in progress");
        require(now() > self.burnDeadline, "Wait until trial window closes");

        send(SendParameters{
            to: self.ownerAddress,
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero,
            bounce: false,
            body: "License burn finalized".asComment(),
        });
    }

    // ─── TEP-62 GetStaticData ────────────────────────────────────────

    receive(msg: GetStaticData) {
        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: ReportStaticData{
                queryId: msg.queryId,
                index: self.index,
                collection: self.collection,
            }.toCell(),
        });
    }

    // ─── TEP-62 Getter ───────────────────────────────────────────────

    get fun get_nft_data(): NftData {
        return NftData{
            init: true,
            index: self.index,
            collection: self.collection,
            owner: self.ownerAddress,
            content: self.content,
        };
    }

    get fun escrow_address(): Address {
        return self.escrowAddress;
    }

    get fun soulbound_info(): SoulboundInfo {
        return SoulboundInfo{
            transferLimit: self.transferLimit,
            transfers: self.transfers,
        };
    }

    get fun burn_deadline(): Int {
        return self.burnDeadline;
    }

    get fun burn_requested(): Bool {
        return self.burnRequested;
    }
}

// ─── Getter return types ─────────────────────────────────────────────

struct NftData {
    init:       Bool;
    index:      Int as uint256;
    collection: Address;
    owner:      Address;
    content:    Cell;
}

struct SoulboundInfo {
    transferLimit: Int as uint8;
    transfers:     Int as uint8;
}
