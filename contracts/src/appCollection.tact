import "@stdlib/deploy";
import "./licenseItem.tact";
import "./escrow.tact";

// ─── Messages ────────────────────────────────────────────────────────
//
// MintLicense opcode и поля ДОЛЖНЫ совпадать с outgoing message в escrow.tact.
// Если меняешь здесь — меняй там же.

message(0x6a3aaa14) MintLicense {
    queryId:           Int as uint64;
    orderId:           Int as uint256;
    buyerAddress:      Address;
    sellerAddress:     Address;
    treasuryAddress:   Address;
    amountNano:        Int as coins;
    sellerAmountNano:  Int as coins;
    feeNano:           Int as coins;
    trialWindowSec:    Int as uint32;
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

    // ─── Mint: triggered by legitimate Escrow only ───────────────────
    //
    // Collection пересобирает initOf Escrow с параметрами из сообщения,
    // вычисляет ожидаемый адрес и сверяет с sender(). Если совпало —
    // это реальный Escrow с реальной оплатой (state = FUNDED к моменту
    // отправки этого сообщения в Escrow.receive(PayEscrow)).
    //
    // Атакующий не может подделать: если он задеплоит свой Escrow
    // с другими параметрами — у него будет другой адрес; если возьмёт
    // честные параметры — его адрес не совпадёт с адресом deploy'ом
    // атакующего.

    receive(msg: MintLicense) {
        let escrowInit: StateInit = initOf Escrow(
            msg.orderId,
            msg.buyerAddress,
            msg.sellerAddress,
            msg.treasuryAddress,
            msg.amountNano,
            msg.sellerAmountNano,
            msg.feeNano,
            msg.trialWindowSec,
            myAddress(),              // Escrow должен ссылаться на НАС как collection
            msg.transferLimit,
            msg.individualContent,
        );
        let expectedEscrow: Address = contractAddress(escrowInit);
        require(sender() == expectedEscrow, "Sender is not a legitimate Escrow");

        let index: Int = self.nextItemIndex;

        let licenseInit: StateInit = initOf LicenseItem(
            index,
            myAddress(),          // collection
            msg.buyerAddress,     // owner
            expectedEscrow,       // escrow (already verified)
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

    // TEP-62 требует геттер, но вычислить address-by-index без parameters
    // конкретной сделки невозможно в нашей схеме. Индексеры должны
    // использовать off-chain API (наш backend) для перечисления NFT.
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
