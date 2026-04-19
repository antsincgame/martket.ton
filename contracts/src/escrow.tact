import "@stdlib/deploy";

// ─── Messages ────────────────────────────────────────────────────────

message(0xd2e5b971) PayEscrow {}
message(0x45dfb5a1) ConfirmDelivery {}
message(0x7f8c9a12) TimeoutRelease {}
message(0x70e30189) RegisterLicense { licenseAddress: Address; }
message(0x9b3c2d45) RefundOnBurn {}
message(0x5a8e1f23) RefundIfNotMinted {}

// Bounceable outgoing wrapper (для bounced<>)
message(0x01a2b3c4) ReleaseSeller { amount: Int as coins; }

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

// ─── State constants ─────────────────────────────────────────────────
//   0 = INIT        — deployed, awaiting buyer payment
//   1 = FUNDED      — buyer paid, trial window open
//   3 = RELEASED    — seller paid, contract self-destructed
//   4 = REFUNDED    — buyer burned NFT → auto-refund, contract self-destructed

const STATE_INIT:     Int = 0;
const STATE_FUNDED:   Int = 1;
const STATE_RELEASED: Int = 3;
const STATE_REFUNDED: Int = 4;

// Сколько ждать до того как buyer может вытянуть деньги обратно если mint не прошёл.
// Короткий период — достаточно чтобы on-chain mint chain (escrow → collection → item → register)
// гарантированно завершился при нормальных условиях (~15 секунд).
const MINT_GRACE_SEC: Int = 600; // 10 минут

// ─── Contract ────────────────────────────────────────────────────────

contract Escrow with Deployable {
    orderId:          Int as uint256;
    buyer:            Address;
    seller:           Address;
    treasury:         Address;
    amountNano:       Int as coins;
    sellerAmountNano: Int as coins;
    feeNano:          Int as coins;
    trialWindowSec:   Int as uint32;
    state:            Int as uint8;
    paidAt:           Int as uint32;
    licenseAddress:   Address;

    init(
        orderId:          Int,
        buyer:            Address,
        seller:           Address,
        treasury:         Address,
        amountNano:       Int,
        sellerAmountNano: Int,
        feeNano:          Int,
        trialWindowSec:   Int,
    ) {
        // Invariant: amount == seller + fee (чтобы не было "потерянной копейки")
        require(sellerAmountNano + feeNano == amountNano, "Amount split mismatch");
        require(sellerAmountNano > 0, "Seller amount must be positive");
        require(feeNano >= 0, "Fee cannot be negative");

        self.orderId          = orderId;
        self.buyer            = buyer;
        self.seller           = seller;
        self.treasury         = treasury;
        self.amountNano       = amountNano;
        self.sellerAmountNano = sellerAmountNano;
        self.feeNano          = feeNano;
        self.trialWindowSec   = trialWindowSec;
        self.state            = STATE_INIT;
        self.paidAt           = 0;
        self.licenseAddress   = newAddress(0, 0);
    }

    // ─── Buyer pays ──────────────────────────────────────────────────

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
    //
    // LicenseItem.init отправляет RegisterLicense обратно в escrow чтобы
    // замкнуть петлю "escrow знает свой license". Проверяем что sender —
    // это legitimate адрес лицензии (по init-hash).

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
    //
    // Страховка на случай когда buyer заплатил, но by какой-либо причине
    // на-chain-цепочка mint не завершилась (collection паузнул, нет газа,
    // race condition). Через 10 минут после оплаты buyer может вернуть деньги.

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

    // ─── Bounce handler для release ──────────────────────────────────
    //
    // Если send seller'у bounce'нул (seller wallet не принимает, уничтожен),
    // откатываемся в FUNDED — buyer сможет либо burn, либо ждать нового timeout.
    // Без этого escrow остался бы в RELEASED с деньгами на балансе — zombie.

    bounced(msg: bounced<ReleaseSeller>) {
        self.state = STATE_FUNDED;
    }

    // ─── Internal: split funds between seller and treasury ───────────

    fun releaseFunds() {
        // CEI pattern: сначала обновить state, потом внешние send'ы.
        self.state = STATE_RELEASED;

        // Bounceable send seller'у. Если bounce — вернёмся в FUNDED через bounced<>.
        send(SendParameters{
            to: self.seller,
            value: self.sellerAmountNano,
            mode: SendPayGasSeparately,
            bounce: true,
            body: ReleaseSeller{ amount: self.sellerAmountNano }.toCell(),
        });

        // Остаток (fee + сдача газа) в treasury + самоуничтожение.
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
}
