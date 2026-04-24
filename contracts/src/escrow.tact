import "@stdlib/deploy";

// ─── Messages ────────────────────────────────────────────────────────

message(0xd2e5b971) PayEscrow {}
message(0x45dfb5a1) ConfirmDelivery {}
message(0x7f8c9a12) TimeoutRelease {}
message(0x70e30189) RegisterLicense { licenseAddress: Address; }
message(0x9b3c2d45) RefundOnBurn {}
message(0x5a8e1f23) RefundIfNotMinted {}

// MintLicense — outgoing message от oracle-кошелька в Collection.
// Объявлен здесь чтобы opcode/структура были в одном месте
// (appCollection.tact импортирует этот тип).
//
// Поля:
//   queryId           — идемпотентность на стороне backend'а
//   buyerAddress      — кому уйдёт soulbound NFT
//   escrowAddress     — к какому Escrow привязать LicenseItem (для refund-петли
//                       BuyerBurn → RefundOnBurn → Escrow). КРИТИЧНО: без этого
//                       поля Collection подставляла бы sender() == oracle, и
//                       refund не замкнулся бы.
//   transferLimit     — 0 для soulbound лицензии
//   individualContent — TEP-64 off-chain content cell
//   burnDeadline      — unix ts после которого BuyerBurn отклоняется контрактом
//
// orderId / seller / treasury / amountNano / sellerAmountNano / feeNano /
// trialWindowSec хранятся в Escrow (init params) — дублировать их в MintLicense
// не нужно, Collection использует только то что уходит в LicenseItem storage.
message(0x6a3aaa14) MintLicense {
    queryId:           Int as uint64;
    buyerAddress:      Address;
    escrowAddress:     Address;
    transferLimit:     Int as uint8;
    individualContent: Cell;
    burnDeadline:      Int as uint32;
}

// ─── Structs (getter returns) ────────────────────────────────────────

struct Parties {
    buyer:    Address;
    seller:   Address;
    treasury: Address;
}

struct EscrowDetails {
    orderId:          Int as uint256;
    amountNano:       Int as coins;
    sellerAmountNano: Int as coins;
    feeNano:          Int as coins;
    trialWindowSec:   Int as uint32;
    state:            Int as uint8;
    paidAt:           Int as uint32;
}

struct LicenseSpec {
    collectionAddress: Address;
    transferLimit:     Int as uint8;
}

// ─── State constants ─────────────────────────────────────────────────

const STATE_INIT:     Int = 0;
const STATE_FUNDED:   Int = 1;
const STATE_RELEASED: Int = 3;
const STATE_REFUNDED: Int = 4;

const MINT_GRACE_SEC: Int = 600;

// ─── Contract ────────────────────────────────────────────────────────

contract Escrow with Deployable {
    orderId:           Int as uint256;
    buyer:             Address;
    seller:            Address;
    treasury:          Address;
    amountNano:        Int as coins;
    sellerAmountNano:  Int as coins;
    feeNano:           Int as coins;
    trialWindowSec:    Int as uint32;
    collectionAddress: Address;
    transferLimit:     Int as uint8;
    licenseContent:    Cell;
    state:             Int as uint8;
    paidAt:            Int as uint32;
    licenseAddress:    Address;

    init(
        orderId:           Int,
        buyer:             Address,
        seller:            Address,
        treasury:          Address,
        amountNano:        Int,
        sellerAmountNano:  Int,
        feeNano:           Int,
        trialWindowSec:    Int,
        collectionAddress: Address,
        transferLimit:     Int,
        licenseContent:    Cell,
    ) {
        require(sellerAmountNano + feeNano == amountNano, "Amount split mismatch");
        require(sellerAmountNano > 0, "Seller amount must be positive");
        require(feeNano >= 0, "Fee cannot be negative");

        self.orderId           = orderId;
        self.buyer             = buyer;
        self.seller            = seller;
        self.treasury          = treasury;
        self.amountNano        = amountNano;
        self.sellerAmountNano  = sellerAmountNano;
        self.feeNano           = feeNano;
        self.trialWindowSec    = trialWindowSec;
        self.collectionAddress = collectionAddress;
        self.transferLimit     = transferLimit;
        self.licenseContent    = licenseContent;
        self.state             = STATE_INIT;
        self.paidAt            = 0;
        self.licenseAddress    = newAddress(0, 0);
    }

    // ─── Buyer pays → state = FUNDED ─────────────────────────────────

    receive(msg: PayEscrow) {
        require(self.state == STATE_INIT, "Already funded");
        require(sender() == self.buyer, "Only buyer");
        require(context().value >= self.amountNano, "Insufficient payment");

        self.state  = STATE_FUNDED;
        self.paidAt = now();
    }

    // ─── Buyer confirms delivery → release to seller ─────────────────

    receive(msg: ConfirmDelivery) {
        require(self.state == STATE_FUNDED, "Not funded");
        require(sender() == self.buyer, "Only buyer");
        self.releaseFunds();
    }

    // ─── Register license address (called by LicenseItem on deploy) ──

    receive(msg: RegisterLicense) {
        require(self.state == STATE_FUNDED, "Not funded");
        require(self.licenseAddress == newAddress(0, 0), "License already registered");
        require(sender() == msg.licenseAddress, "Sender must match license address");
        self.licenseAddress = msg.licenseAddress;
    }

    // ─── Refund triggered by LicenseItem burn ────────────────────────

    receive(msg: RefundOnBurn) {
        require(self.state == STATE_FUNDED, "Not funded");
        require(sender() == self.licenseAddress, "Only registered license");
        self.state = STATE_REFUNDED;
        send(SendParameters{
            to: self.buyer,
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero,
            bounce: false,
            body: "Escrow refund (burn)".asComment(),
        });
    }

    // ─── Emergency refund: если mint не прошёл за MINT_GRACE_SEC ─────

    receive(msg: RefundIfNotMinted) {
        require(self.state == STATE_FUNDED, "Not funded");
        require(sender() == self.buyer, "Only buyer");
        require(self.licenseAddress == newAddress(0, 0), "License already minted");
        require(now() > self.paidAt + MINT_GRACE_SEC, "Wait grace period");
        self.state = STATE_REFUNDED;
        send(SendParameters{
            to: self.buyer,
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero,
            bounce: false,
            body: "Escrow refund (no mint)".asComment(),
        });
    }

    // ─── Timeout release (anyone, after trial window) ────────────────

    receive(msg: TimeoutRelease) {
        require(self.state == STATE_FUNDED, "Not funded");
        let deadline: Int = self.paidAt + self.trialWindowSec;
        require(now() > deadline, "Window still open");
        self.releaseFunds();
    }

    // ─── Internal: split funds between seller and treasury ───────────

    fun releaseFunds() {
        self.state = STATE_RELEASED;

        send(SendParameters{
            to: self.seller,
            value: self.sellerAmountNano,
            mode: SendPayGasSeparately,
            bounce: false,
            body: "Escrow release".asComment(),
        });

        send(SendParameters{
            to: self.treasury,
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero,
            bounce: false,
            body: "Platform fee".asComment(),
        });
    }

    // ─── Getters ─────────────────────────────────────────────────────

    get fun state(): Int {
        return self.state;
    }

    get fun parties(): Parties {
        return Parties{
            buyer: self.buyer,
            seller: self.seller,
            treasury: self.treasury,
        };
    }

    get fun details(): EscrowDetails {
        return EscrowDetails{
            orderId:          self.orderId,
            amountNano:       self.amountNano,
            sellerAmountNano: self.sellerAmountNano,
            feeNano:          self.feeNano,
            trialWindowSec:   self.trialWindowSec,
            state:            self.state,
            paidAt:           self.paidAt,
        };
    }

    get fun license_address(): Address {
        return self.licenseAddress;
    }

    get fun license_spec(): LicenseSpec {
        return LicenseSpec{
            collectionAddress: self.collectionAddress,
            transferLimit:     self.transferLimit,
        };
    }
}
