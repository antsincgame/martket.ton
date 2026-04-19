import "@stdlib/deploy";

// ─── Messages ────────────────────────────────────────────────────────

message PayEscrow {}
message ConfirmDelivery {}
message TimeoutRelease {}
message RegisterLicense { licenseAddress: Address; }
message RefundOnBurn {}
// Oracle-initiated refund used when license mint failed and no NFT was ever
// registered with this escrow. Treasury-only, self-destructs the escrow.
message OracleRefund {}

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
    trialWindowSec: Int as uint32;
    state: Int as uint8;
    paidAt: Int as uint32;
}

// ─── State constants ─────────────────────────────────────────────────
//   0 = INIT        — deployed, awaiting buyer payment
//   1 = FUNDED      — buyer paid, trial window open
//   3 = RELEASED    — seller paid, contract self-destructed
//   4 = REFUNDED    — buyer burned NFT or oracle refunded → contract self-destructed

// ─── Contract ────────────────────────────────────────────────────────

contract Escrow with Deployable {
    orderId:          Int as uint256;
    buyer:            Address;
    seller:           Address;
    treasury:         Address;
    amountNano:       Int as coins;
    feeBps:           Int as uint16;
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
        feeBps:           Int,
        trialWindowSec:   Int,
    ) {
        self.orderId          = orderId;
        self.buyer            = buyer;
        self.seller           = seller;
        self.treasury         = treasury;
        self.amountNano       = amountNano;
        self.feeBps           = feeBps;
        self.trialWindowSec   = trialWindowSec;
        self.state            = 0;
        self.paidAt           = 0;
        self.licenseAddress   = newAddress(0, 0);
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

    // ─── Register license address (oracle calls after mint) ──────────

    receive(msg: RegisterLicense) {
        require(self.state == 1, "Not funded");
        require(sender() == self.treasury, "Only treasury");
        require(self.licenseAddress == newAddress(0, 0), "License already registered");
        self.licenseAddress = msg.licenseAddress;
    }

    // ─── Refund triggered by LicenseItem burn ────────────────────────
    //
    // When buyer burns their NFT (BuyerBurn on LicenseItem), the item
    // sends RefundOnBurn{} here. We verify sender is the registered
    // license and escrow is still funded, then return all funds to buyer.

    receive(msg: RefundOnBurn) {
        require(self.state == 1, "Not funded");
        require(sender() == self.licenseAddress, "Only registered license");
        self.state = 4;
        send(SendParameters{
            to: self.buyer,
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero,
            bounce: false,
            body: "Escrow refund (burn)".asComment(),
        });
    }

    // ─── Oracle refund (mint never registered → return to buyer) ─────
    //
    // Treasury can refund the buyer ONLY while no LicenseItem has been
    // registered. Once `RegisterLicense` succeeds, the buyer's only way
    // to get their funds back is to burn the NFT (RefundOnBurn).
    // This guarantees that a registered, healthy license cannot be
    // unilaterally voided by the platform.

    receive(msg: OracleRefund) {
        require(self.state == 1, "Not funded");
        require(sender() == self.treasury, "Only treasury");
        require(self.licenseAddress == newAddress(0, 0), "License already registered");
        self.state = 4;
        send(SendParameters{
            to: self.buyer,
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero,
            bounce: false,
            body: "Escrow refund (oracle)".asComment(),
        });
    }

    // ─── Timeout release (anyone, after trial window) ────────────────

    receive(msg: TimeoutRelease) {
        require(self.state == 1, "Not funded");
        let deadline: Int = self.paidAt + self.trialWindowSec;
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
            trialWindowSec: self.trialWindowSec,
            state: self.state,
            paidAt: self.paidAt,
        };
    }

    get fun license_address(): Address {
        return self.licenseAddress;
    }
}
