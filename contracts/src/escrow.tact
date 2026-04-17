import "@stdlib/deploy";

// ─── Messages ────────────────────────────────────────────────────────

message PayEscrow {}
message ConfirmDelivery {}
message OpenDispute {}
message ResolveRefund {}
message ResolveRelease {}
message TimeoutRelease {}

// ─── Structs (getter returns) ────────────────────────────────────────

struct Parties {
    buyer: Address;
    seller: Address;
    treasury: Address;
}

struct EscrowDetails {
    orderId: Int as uint256;
    amountNano: Int as coins;
    feeBps: Int as uint16;
    disputeWindowSec: Int as uint32;
    state: Int as uint8;
    paidAt: Int as uint32;
}

// ─── State constants (not exported, used internally) ─────────────────
//   0 = INIT        — deployed, awaiting buyer payment
//   1 = FUNDED      — buyer paid, dispute window open
//   2 = DISPUTED    — buyer opened dispute
//   3 = RELEASED    — seller paid, contract self-destructed
//   4 = REFUNDED    — buyer refunded, contract self-destructed

// ─── Contract ────────────────────────────────────────────────────────

contract Escrow with Deployable {
    orderId:          Int as uint256;
    buyer:            Address;
    seller:           Address;
    treasury:         Address;
    amountNano:       Int as coins;
    feeBps:           Int as uint16;
    disputeWindowSec: Int as uint32;
    state:            Int as uint8;
    paidAt:           Int as uint32;

    init(
        orderId:          Int,
        buyer:            Address,
        seller:           Address,
        treasury:         Address,
        amountNano:       Int,
        feeBps:           Int,
        disputeWindowSec: Int,
    ) {
        self.orderId          = orderId;
        self.buyer            = buyer;
        self.seller           = seller;
        self.treasury         = treasury;
        self.amountNano       = amountNano;
        self.feeBps           = feeBps;
        self.disputeWindowSec = disputeWindowSec;
        self.state            = 0;
        self.paidAt           = 0;
    }

    // ─── Buyer pays ──────────────────────────────────────────────────

    receive(msg: PayEscrow) {
        require(self.state == 0, "Already funded");
        require(sender() == self.buyer, "Only buyer");
        require(context().value >= self.amountNano, "Insufficient payment");
        self.state  = 1;
        self.paidAt = now();
    }

    // ─── Buyer confirms delivery → release to seller ─────────────────

    receive(msg: ConfirmDelivery) {
        require(self.state == 1, "Not funded");
        require(sender() == self.buyer, "Only buyer");
        self.releaseFunds();
    }

    // ─── Buyer opens dispute ─────────────────────────────────────────

    receive(msg: OpenDispute) {
        require(self.state == 1, "Not funded");
        require(sender() == self.buyer, "Only buyer");
        let deadline: Int = self.paidAt + self.disputeWindowSec;
        require(now() <= deadline, "Dispute window closed");
        self.state = 2;
    }

    // ─── Admin (treasury) refunds buyer ──────────────────────────────

    receive(msg: ResolveRefund) {
        require(self.state == 2, "Not disputed");
        require(sender() == self.treasury, "Only admin");
        self.state = 4;
        send(SendParameters{
            to: self.buyer,
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero,
            bounce: false,
            body: "Escrow refund".asComment(),
        });
    }

    // ─── Admin (treasury) releases to seller ─────────────────────────

    receive(msg: ResolveRelease) {
        require(self.state == 2, "Not disputed");
        require(sender() == self.treasury, "Only admin");
        self.releaseFunds();
    }

    // ─── Timeout release (anyone, after dispute window) ──────────────

    receive(msg: TimeoutRelease) {
        require(self.state == 1, "Not funded");
        let deadline: Int = self.paidAt + self.disputeWindowSec;
        require(now() > deadline, "Window still open");
        self.releaseFunds();
    }

    // ─── Internal: split funds between seller and treasury ───────────

    fun releaseFunds() {
        let fee: Int = self.amountNano * self.feeBps / 10000;
        let sellerAmount: Int = self.amountNano - fee;

        send(SendParameters{
            to: self.seller,
            value: sellerAmount,
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

        self.state = 3;
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
            orderId: self.orderId,
            amountNano: self.amountNano,
            feeBps: self.feeBps,
            disputeWindowSec: self.disputeWindowSec,
            state: self.state,
            paidAt: self.paidAt,
        };
    }
}
