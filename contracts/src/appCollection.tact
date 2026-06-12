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
    // Option C: mint gated by oracle signature. Escrow-адрес передаётся
    // в payload (msg.escrowAddress) → LicenseItem корректно привязан к
    // реальному Escrow, refund-петля (BuyerBurn → RefundOnBurn → Escrow)
    // замыкается.
    //
    // TODO: вернуть trustless init-hash check после testnet E2E —
    // тогда Escrow сам сможет шлать MintLicense без oracle middleman.

    receive(msg: MintLicense) {
        require(sender() == self.ownerAddress, "Only collection owner can mint");
        // A-3: floor raised so the item deploy cannot underfund on mainnet fee
        // spikes. Deploy and RegisterLicense are independent messages — an
        // underfunded deploy that fails while RegisterLicense still binds would
        // leave the escrow pointing at a non-existent item (both buyer refund
        // paths then blocked). Generous gas makes the deploy reliable.
        require(context().value >= ton("0.2"), "Insufficient gas for mint");

        let index: Int = self.nextItemIndex;

        let licenseInit: StateInit = initOf LicenseItem(
            index,
            myAddress(),            // collection
            msg.buyerAddress,       // NFT owner = buyer wallet
            msg.escrowAddress,      // реальный Escrow для refund-петли
            msg.transferLimit,
            msg.individualContent,
            msg.burnDeadline,
        );

        let itemAddress: Address = contractAddress(licenseInit);

        // Деплой айтема с ПУСТЫМ телом (его поглощает no-op receive() айтема).
        // Прежде слался "License minted".asComment() — текстовый комментарий с
        // opcode=0, который НЕ матчился пустым receive() айтема: регистрация не
        // происходила, а деплой аварийно завершался (K-1). Теперь регистрацию
        // выполняет сама Collection ниже.
        send(SendParameters{
            to: itemAddress,
            value: ton("0.08"),
            mode: SendPayGasSeparately,
            bounce: false,
            code: licenseInit.code,
            data: licenseInit.data,
        });

        // CON-01 fix: Collection (привязанная коллекция эскроу) регистрирует
        // реальный адрес заминченного айтема. Escrow проверяет
        // sender() == self.collectionAddress, поэтому подделать регистрацию
        // нельзя. Это замыкает refund-петлю BuyerBurn → RefundOnBurn → Escrow.
        send(SendParameters{
            to: msg.escrowAddress,
            value: ton("0.05"),
            mode: SendPayGasSeparately,
            bounce: false,
            body: RegisterLicense{ licenseAddress: itemAddress }.toCell(),
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
