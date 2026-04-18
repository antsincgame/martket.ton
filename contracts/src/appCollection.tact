import "@stdlib/deploy";
import "./licenseItem.tact";

// ─── Messages ────────────────────────────────────────────────────────
//
// Mint deploys a new LicenseItem with deterministic address derived from
// (collection, index, buyer, escrow, transferLimit, content, burnDeadline).
// The backend computes the same address client-side using the wrapper.
//
// Burn forwards Burn{} to a specific item address provided by the backend,
// because the collection has no on-chain mapping of (index → init data).
// LicenseItem internally checks sender() == collection, so only this path
// can trigger a collection-mediated burn.

message(0x6a3aaa14) MintLicense {
    queryId:           Int as uint64;
    buyerAddress:      Address;
    escrowAddress:     Address;
    transferLimit:     Int as uint8;
    individualContent: Cell;
    burnDeadline:      Int as uint32;
}

message(0x4d8e8a14) BurnLicense {
    queryId:     Int as uint64;
    itemAddress: Address;
}

message(0x4d8b8b8b) ChangeOwner {
    queryId:  Int as uint64;
    newOwner: Address;
}

// ─── Contract ────────────────────────────────────────────────────────

contract AppCollection with Deployable {
    appId:             Int as uint256;
    ownerAddress:      Address;
    nextItemIndex:     Int as uint64;
    collectionContent: Cell;
    commonContent:     Cell;

    init(
        appId:             Int,
        ownerAddress:      Address,
        collectionContent: Cell,
        commonContent:     Cell,
    ) {
        self.appId             = appId;
        self.ownerAddress      = ownerAddress;
        self.nextItemIndex     = 0;
        self.collectionContent = collectionContent;
        self.commonContent     = commonContent;
    }

    // ─── Mint: only owner ────────────────────────────────────────────

    receive(msg: MintLicense) {
        require(sender() == self.ownerAddress, "Only collection owner can mint");
        require(context().value >= ton("0.1"), "Insufficient gas for mint");

        let index: Int = self.nextItemIndex;

        let init: StateInit = initOf LicenseItem(
            index,
            myAddress(),
            msg.buyerAddress,
            msg.escrowAddress,
            msg.transferLimit,
            msg.individualContent,
            msg.burnDeadline,
        );

        let itemAddress: Address = contractAddress(init);

        send(SendParameters{
            to: itemAddress,
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            code: init.code,
            data: init.data,
            body: "License minted".asComment(),
        });

        self.nextItemIndex = index + 1;
    }

    // ─── Burn: only owner can request collection-mediated burn ───────

    receive(msg: BurnLicense) {
        require(sender() == self.ownerAddress, "Only collection owner can burn");

        send(SendParameters{
            to: msg.itemAddress,
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: Burn{ queryId: msg.queryId }.toCell(),
        });
    }

    // ─── Owner rotation ──────────────────────────────────────────────

    receive(msg: ChangeOwner) {
        require(sender() == self.ownerAddress, "Only current owner can rotate");
        self.ownerAddress = msg.newOwner;
    }

    // ─── TEP-62 Getters ──────────────────────────────────────────────

    get fun get_collection_data(): CollectionData {
        return CollectionData{
            nextItemIndex: self.nextItemIndex,
            collectionContent: self.collectionContent,
            owner: self.ownerAddress,
        };
    }

    get fun get_nft_address_by_index(index: Int): Address {
        return newAddress(0, 0);
    }

    get fun get_nft_content(index: Int, individualContent: Cell): Cell {
        return individualContent;
    }

    get fun app_id(): Int {
        return self.appId;
    }
}

// ─── Getter return types ─────────────────────────────────────────────

struct CollectionData {
    nextItemIndex:     Int as uint64;
    collectionContent: Cell;
    owner:             Address;
}
