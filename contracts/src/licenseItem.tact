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
    registered:    Bool;

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
        self.registered    = false;
    }

    // ─── Self-register в Escrow после deploy ─────────────────────────
    //
    // Первое сообщение, которое LicenseItem получает после deploy —
    // это "License minted" от Collection. Здесь мы шлём RegisterLicense
    // обратно в Escrow, замыкая on-chain петлю "escrow знает свой license".
    //
    // В Escrow проверяется sender() == msg.licenseAddress, что гарантирует:
    // регистрация может произойти только от самой лицензии, не от атакующего.

    receive() {
        // Empty body receive — срабатывает на "License minted".asComment()
        // от Collection (комментарий это внутреннее слово без opcode).
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

    receive(msg: BuyerBurn) {
        require(sender() == self.ownerAddress, "Only owner can burn");
        require(now() <= self.burnDeadline, "Trial window closed");

        send(SendParameters{
            to: self.escrowAddress,
            value: ton("0.03"),
            mode: SendPayGasSeparately,
            bounce: false,
            body: RefundOnBurn{}.toCell(),
        });

        send(SendParameters{
            to: self.ownerAddress,
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero,
            bounce: false,
            body: "License burned by owner".asComment(),
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

    get fun is_registered(): Bool {
        return self.registered;
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
