import "@stdlib/deploy";
import "./licenseItem.tact";
import "./escrow.tact";

// ─── Messages ────────────────────────────────────────────────────────
//
// NOTE: MintLicense объявлен в escrow.tact (outgoing message от эскроу).
// Сюда тип приходит через `import "./escrow.tact"`. Дубликат здесь
// сломает компиляцию — Tact не допускает повторное объявление message-типа.

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

    // ─── Mint: triggered by ownerAddress (backend signer) ────────────
    //
    // ВРЕМЕННОЕ РЕШЕНИЕ (Option C):
    // Mint разрешён только от ownerAddress (backend, wallet controlled by platform).
    // Escrow шлёт MintLicense через PayEscrow→Collection, но sender будет Escrow,
    // не owner. Поэтому нужен backend-oracle который индексирует PayEscrow события
    // и пересылает MintLicense в Collection со своим signed sender.
    //
    // TODO: вернуть trustless init-hash check после локальной отладки.
    // Было: require(sender() == contractAddress(initOf Escrow(...)))

    receive(msg: MintLicense) {
        require(sender() == self.ownerAddress, "Only collection owner can mint");
        require(context().value >= ton("0.1"), "Insufficient gas for mint");

        let index: Int = self.nextItemIndex;

        let licenseInit: StateInit = initOf LicenseItem(
            index,
            myAddress(),          // collection
            msg.buyerAddress,     // owner of NFT
            sender(),             // escrow address — передаётся в item для burn refund flow
            msg.transferLimit,
            msg.individualContent,
            msg.burnDeadline,
        );

        let itemAddress: Address = contractAddress(licenseInit);

        send(SendParameters{
            to: itemAddress,
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            code: licenseInit.code,
            data: licenseInit.data,
            body: "License minted".asComment(),
        });

        self.nextItemIndex = index + 1;
    }

    // ─── Admin burn (только для DMCA/edge cases) ─────────────────────

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

struct CollectionData {
    nextItemIndex:     Int as uint64;
    collectionContent: Cell;
    owner:             Address;
}
