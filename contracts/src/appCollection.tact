import "@stdlib/deploy";
import "./licenseItem.tact";
import "./escrow.tact";

// ─── Messages ────────────────────────────────────────────────────────
//
// Trustless mint: Escrow-контракт сам триггерит MintLicense после получения
// оплаты от buyer. Collection проверяет что sender — это legitimate Escrow,
// пересобирая его init-hash с параметрами из сообщения и сверяясь с sender().
//
// Параметр ownerAddress остаётся только для административных операций
// (BurnLicense, ChangeOwner) и НЕ гейтит mint.

message(0x6a3aaa14) MintLicense {
    queryId:           Int as uint64;

    // Параметры, по которым вычисляется init-hash Escrow → проверяется sender
    orderId:           Int as uint256;
    buyerAddress:      Address;
    sellerAddress:     Address;
    treasuryAddress:   Address;
    amountNano:        Int as coins;
    sellerAmountNano:  Int as coins;
    feeNano:           Int as coins;
    trialWindowSec:    Int as uint32;

    // Параметры самой лицензии
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

    // ─── Mint: triggered by legitimate Escrow ────────────────────────
    //
    // Никакого whitelist адресов — sender проверяется по init-hash.
    // Любой Escrow с валидными параметрами может триггерить mint,
    // при этом параметры такого Escrow жёстко привязаны к конкретному
    // buyer/seller (они в init), поэтому атакующий не может "переиспользовать"
    // чужой Escrow для своей лицензии.

    receive(msg: MintLicense) {
        // Пересобираем initOf Escrow с параметрами из сообщения
        let escrowInit: StateInit = initOf Escrow(
            msg.orderId,
            msg.buyerAddress,
            msg.sellerAddress,
            msg.treasuryAddress,
            msg.amountNano,
            msg.sellerAmountNano,
            msg.feeNano,
            msg.trialWindowSec,
        );
        let expectedEscrow: Address = contractAddress(escrowInit);
        require(sender() == expectedEscrow, "Sender is not a legitimate Escrow");

        require(context().value >= ton("0.1"), "Insufficient gas for mint");

        let index: Int = self.nextItemIndex;

        let licenseInit: StateInit = initOf LicenseItem(
            index,
            myAddress(),          // collection
            msg.buyerAddress,     // owner
            expectedEscrow,       // escrow (знаем точно — свой только что проверили)
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

    // ─── Burn: owner может инициировать collection-mediated burn ─────
    //
    // Нужно только для edge-cases (например DMCA takedown когда нужно
    // принудительно burn лицензию на нарушающий контент). Не для refund —
    // refund идёт через BuyerBurn напрямую на LicenseItem.

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

    // TEP-62 требует этот геттер для индексеров (TonAPI, TonViewer, Getgems).
    // ВАЖНО: в нашем случае init LicenseItem зависит от parameters сделки
    // (buyer, escrow, transferLimit, content, burnDeadline), которые у нас
    // нет в storage коллекции. Индексеры вызывают этот геттер с index,
    // не зная остальных параметров — в такой схеме честный TEP-62 lookup
    // невозможен.
    //
    // Возвращаем newAddress(0, 0) как маркер "unavailable". Индексеры
    // должны использовать off-chain данные (наш API) для перечисления NFT.
    // Альтернатива — хранить map<index, itemAddress> в storage, но это
    // растит storage fee пропорционально числу проданных лицензий.
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
