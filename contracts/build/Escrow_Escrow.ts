import {
    Cell,
    Slice,
    Address,
    Builder,
    beginCell,
    ComputeError,
    TupleItem,
    TupleReader,
    Dictionary,
    contractAddress,
    address,
    ContractProvider,
    Sender,
    Contract,
    ContractABI,
    ABIType,
    ABIGetter,
    ABIReceiver,
    TupleBuilder,
    DictionaryValue
} from '@ton/core';

export type DataSize = {
    $$type: 'DataSize';
    cells: bigint;
    bits: bigint;
    refs: bigint;
}

export function storeDataSize(src: DataSize) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.cells, 257);
        b_0.storeInt(src.bits, 257);
        b_0.storeInt(src.refs, 257);
    };
}

export function loadDataSize(slice: Slice) {
    const sc_0 = slice;
    const _cells = sc_0.loadIntBig(257);
    const _bits = sc_0.loadIntBig(257);
    const _refs = sc_0.loadIntBig(257);
    return { $$type: 'DataSize' as const, cells: _cells, bits: _bits, refs: _refs };
}

export function loadTupleDataSize(source: TupleReader) {
    const _cells = source.readBigNumber();
    const _bits = source.readBigNumber();
    const _refs = source.readBigNumber();
    return { $$type: 'DataSize' as const, cells: _cells, bits: _bits, refs: _refs };
}

export function loadGetterTupleDataSize(source: TupleReader) {
    const _cells = source.readBigNumber();
    const _bits = source.readBigNumber();
    const _refs = source.readBigNumber();
    return { $$type: 'DataSize' as const, cells: _cells, bits: _bits, refs: _refs };
}

export function storeTupleDataSize(source: DataSize) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.cells);
    builder.writeNumber(source.bits);
    builder.writeNumber(source.refs);
    return builder.build();
}

export function dictValueParserDataSize(): DictionaryValue<DataSize> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDataSize(src)).endCell());
        },
        parse: (src) => {
            return loadDataSize(src.loadRef().beginParse());
        }
    }
}

export type SignedBundle = {
    $$type: 'SignedBundle';
    signature: Buffer;
    signedData: Slice;
}

export function storeSignedBundle(src: SignedBundle) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBuffer(src.signature);
        b_0.storeBuilder(src.signedData.asBuilder());
    };
}

export function loadSignedBundle(slice: Slice) {
    const sc_0 = slice;
    const _signature = sc_0.loadBuffer(64);
    const _signedData = sc_0;
    return { $$type: 'SignedBundle' as const, signature: _signature, signedData: _signedData };
}

export function loadTupleSignedBundle(source: TupleReader) {
    const _signature = source.readBuffer();
    const _signedData = source.readCell().asSlice();
    return { $$type: 'SignedBundle' as const, signature: _signature, signedData: _signedData };
}

export function loadGetterTupleSignedBundle(source: TupleReader) {
    const _signature = source.readBuffer();
    const _signedData = source.readCell().asSlice();
    return { $$type: 'SignedBundle' as const, signature: _signature, signedData: _signedData };
}

export function storeTupleSignedBundle(source: SignedBundle) {
    const builder = new TupleBuilder();
    builder.writeBuffer(source.signature);
    builder.writeSlice(source.signedData.asCell());
    return builder.build();
}

export function dictValueParserSignedBundle(): DictionaryValue<SignedBundle> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSignedBundle(src)).endCell());
        },
        parse: (src) => {
            return loadSignedBundle(src.loadRef().beginParse());
        }
    }
}

export type StateInit = {
    $$type: 'StateInit';
    code: Cell;
    data: Cell;
}

export function storeStateInit(src: StateInit) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeRef(src.code);
        b_0.storeRef(src.data);
    };
}

export function loadStateInit(slice: Slice) {
    const sc_0 = slice;
    const _code = sc_0.loadRef();
    const _data = sc_0.loadRef();
    return { $$type: 'StateInit' as const, code: _code, data: _data };
}

export function loadTupleStateInit(source: TupleReader) {
    const _code = source.readCell();
    const _data = source.readCell();
    return { $$type: 'StateInit' as const, code: _code, data: _data };
}

export function loadGetterTupleStateInit(source: TupleReader) {
    const _code = source.readCell();
    const _data = source.readCell();
    return { $$type: 'StateInit' as const, code: _code, data: _data };
}

export function storeTupleStateInit(source: StateInit) {
    const builder = new TupleBuilder();
    builder.writeCell(source.code);
    builder.writeCell(source.data);
    return builder.build();
}

export function dictValueParserStateInit(): DictionaryValue<StateInit> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeStateInit(src)).endCell());
        },
        parse: (src) => {
            return loadStateInit(src.loadRef().beginParse());
        }
    }
}

export type Context = {
    $$type: 'Context';
    bounceable: boolean;
    sender: Address;
    value: bigint;
    raw: Slice;
}

export function storeContext(src: Context) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.bounceable);
        b_0.storeAddress(src.sender);
        b_0.storeInt(src.value, 257);
        b_0.storeRef(src.raw.asCell());
    };
}

export function loadContext(slice: Slice) {
    const sc_0 = slice;
    const _bounceable = sc_0.loadBit();
    const _sender = sc_0.loadAddress();
    const _value = sc_0.loadIntBig(257);
    const _raw = sc_0.loadRef().asSlice();
    return { $$type: 'Context' as const, bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}

export function loadTupleContext(source: TupleReader) {
    const _bounceable = source.readBoolean();
    const _sender = source.readAddress();
    const _value = source.readBigNumber();
    const _raw = source.readCell().asSlice();
    return { $$type: 'Context' as const, bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}

export function loadGetterTupleContext(source: TupleReader) {
    const _bounceable = source.readBoolean();
    const _sender = source.readAddress();
    const _value = source.readBigNumber();
    const _raw = source.readCell().asSlice();
    return { $$type: 'Context' as const, bounceable: _bounceable, sender: _sender, value: _value, raw: _raw };
}

export function storeTupleContext(source: Context) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.bounceable);
    builder.writeAddress(source.sender);
    builder.writeNumber(source.value);
    builder.writeSlice(source.raw.asCell());
    return builder.build();
}

export function dictValueParserContext(): DictionaryValue<Context> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeContext(src)).endCell());
        },
        parse: (src) => {
            return loadContext(src.loadRef().beginParse());
        }
    }
}

export type SendParameters = {
    $$type: 'SendParameters';
    mode: bigint;
    body: Cell | null;
    code: Cell | null;
    data: Cell | null;
    value: bigint;
    to: Address;
    bounce: boolean;
}

export function storeSendParameters(src: SendParameters) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) { b_0.storeBit(true).storeRef(src.body); } else { b_0.storeBit(false); }
        if (src.code !== null && src.code !== undefined) { b_0.storeBit(true).storeRef(src.code); } else { b_0.storeBit(false); }
        if (src.data !== null && src.data !== undefined) { b_0.storeBit(true).storeRef(src.data); } else { b_0.storeBit(false); }
        b_0.storeInt(src.value, 257);
        b_0.storeAddress(src.to);
        b_0.storeBit(src.bounce);
    };
}

export function loadSendParameters(slice: Slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _code = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _data = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _to = sc_0.loadAddress();
    const _bounce = sc_0.loadBit();
    return { $$type: 'SendParameters' as const, mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}

export function loadTupleSendParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _code = source.readCellOpt();
    const _data = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'SendParameters' as const, mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}

export function loadGetterTupleSendParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _code = source.readCellOpt();
    const _data = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'SendParameters' as const, mode: _mode, body: _body, code: _code, data: _data, value: _value, to: _to, bounce: _bounce };
}

export function storeTupleSendParameters(source: SendParameters) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeCell(source.code);
    builder.writeCell(source.data);
    builder.writeNumber(source.value);
    builder.writeAddress(source.to);
    builder.writeBoolean(source.bounce);
    return builder.build();
}

export function dictValueParserSendParameters(): DictionaryValue<SendParameters> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSendParameters(src)).endCell());
        },
        parse: (src) => {
            return loadSendParameters(src.loadRef().beginParse());
        }
    }
}

export type MessageParameters = {
    $$type: 'MessageParameters';
    mode: bigint;
    body: Cell | null;
    value: bigint;
    to: Address;
    bounce: boolean;
}

export function storeMessageParameters(src: MessageParameters) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) { b_0.storeBit(true).storeRef(src.body); } else { b_0.storeBit(false); }
        b_0.storeInt(src.value, 257);
        b_0.storeAddress(src.to);
        b_0.storeBit(src.bounce);
    };
}

export function loadMessageParameters(slice: Slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _to = sc_0.loadAddress();
    const _bounce = sc_0.loadBit();
    return { $$type: 'MessageParameters' as const, mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}

export function loadTupleMessageParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'MessageParameters' as const, mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}

export function loadGetterTupleMessageParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _to = source.readAddress();
    const _bounce = source.readBoolean();
    return { $$type: 'MessageParameters' as const, mode: _mode, body: _body, value: _value, to: _to, bounce: _bounce };
}

export function storeTupleMessageParameters(source: MessageParameters) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeNumber(source.value);
    builder.writeAddress(source.to);
    builder.writeBoolean(source.bounce);
    return builder.build();
}

export function dictValueParserMessageParameters(): DictionaryValue<MessageParameters> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeMessageParameters(src)).endCell());
        },
        parse: (src) => {
            return loadMessageParameters(src.loadRef().beginParse());
        }
    }
}

export type DeployParameters = {
    $$type: 'DeployParameters';
    mode: bigint;
    body: Cell | null;
    value: bigint;
    bounce: boolean;
    init: StateInit;
}

export function storeDeployParameters(src: DeployParameters) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.mode, 257);
        if (src.body !== null && src.body !== undefined) { b_0.storeBit(true).storeRef(src.body); } else { b_0.storeBit(false); }
        b_0.storeInt(src.value, 257);
        b_0.storeBit(src.bounce);
        b_0.store(storeStateInit(src.init));
    };
}

export function loadDeployParameters(slice: Slice) {
    const sc_0 = slice;
    const _mode = sc_0.loadIntBig(257);
    const _body = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _value = sc_0.loadIntBig(257);
    const _bounce = sc_0.loadBit();
    const _init = loadStateInit(sc_0);
    return { $$type: 'DeployParameters' as const, mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}

export function loadTupleDeployParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _bounce = source.readBoolean();
    const _init = loadTupleStateInit(source);
    return { $$type: 'DeployParameters' as const, mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}

export function loadGetterTupleDeployParameters(source: TupleReader) {
    const _mode = source.readBigNumber();
    const _body = source.readCellOpt();
    const _value = source.readBigNumber();
    const _bounce = source.readBoolean();
    const _init = loadGetterTupleStateInit(source);
    return { $$type: 'DeployParameters' as const, mode: _mode, body: _body, value: _value, bounce: _bounce, init: _init };
}

export function storeTupleDeployParameters(source: DeployParameters) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.mode);
    builder.writeCell(source.body);
    builder.writeNumber(source.value);
    builder.writeBoolean(source.bounce);
    builder.writeTuple(storeTupleStateInit(source.init));
    return builder.build();
}

export function dictValueParserDeployParameters(): DictionaryValue<DeployParameters> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDeployParameters(src)).endCell());
        },
        parse: (src) => {
            return loadDeployParameters(src.loadRef().beginParse());
        }
    }
}

export type StdAddress = {
    $$type: 'StdAddress';
    workchain: bigint;
    address: bigint;
}

export function storeStdAddress(src: StdAddress) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.workchain, 8);
        b_0.storeUint(src.address, 256);
    };
}

export function loadStdAddress(slice: Slice) {
    const sc_0 = slice;
    const _workchain = sc_0.loadIntBig(8);
    const _address = sc_0.loadUintBig(256);
    return { $$type: 'StdAddress' as const, workchain: _workchain, address: _address };
}

export function loadTupleStdAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readBigNumber();
    return { $$type: 'StdAddress' as const, workchain: _workchain, address: _address };
}

export function loadGetterTupleStdAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readBigNumber();
    return { $$type: 'StdAddress' as const, workchain: _workchain, address: _address };
}

export function storeTupleStdAddress(source: StdAddress) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.workchain);
    builder.writeNumber(source.address);
    return builder.build();
}

export function dictValueParserStdAddress(): DictionaryValue<StdAddress> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeStdAddress(src)).endCell());
        },
        parse: (src) => {
            return loadStdAddress(src.loadRef().beginParse());
        }
    }
}

export type VarAddress = {
    $$type: 'VarAddress';
    workchain: bigint;
    address: Slice;
}

export function storeVarAddress(src: VarAddress) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.workchain, 32);
        b_0.storeRef(src.address.asCell());
    };
}

export function loadVarAddress(slice: Slice) {
    const sc_0 = slice;
    const _workchain = sc_0.loadIntBig(32);
    const _address = sc_0.loadRef().asSlice();
    return { $$type: 'VarAddress' as const, workchain: _workchain, address: _address };
}

export function loadTupleVarAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readCell().asSlice();
    return { $$type: 'VarAddress' as const, workchain: _workchain, address: _address };
}

export function loadGetterTupleVarAddress(source: TupleReader) {
    const _workchain = source.readBigNumber();
    const _address = source.readCell().asSlice();
    return { $$type: 'VarAddress' as const, workchain: _workchain, address: _address };
}

export function storeTupleVarAddress(source: VarAddress) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.workchain);
    builder.writeSlice(source.address.asCell());
    return builder.build();
}

export function dictValueParserVarAddress(): DictionaryValue<VarAddress> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeVarAddress(src)).endCell());
        },
        parse: (src) => {
            return loadVarAddress(src.loadRef().beginParse());
        }
    }
}

export type BasechainAddress = {
    $$type: 'BasechainAddress';
    hash: bigint | null;
}

export function storeBasechainAddress(src: BasechainAddress) {
    return (builder: Builder) => {
        const b_0 = builder;
        if (src.hash !== null && src.hash !== undefined) { b_0.storeBit(true).storeInt(src.hash, 257); } else { b_0.storeBit(false); }
    };
}

export function loadBasechainAddress(slice: Slice) {
    const sc_0 = slice;
    const _hash = sc_0.loadBit() ? sc_0.loadIntBig(257) : null;
    return { $$type: 'BasechainAddress' as const, hash: _hash };
}

export function loadTupleBasechainAddress(source: TupleReader) {
    const _hash = source.readBigNumberOpt();
    return { $$type: 'BasechainAddress' as const, hash: _hash };
}

export function loadGetterTupleBasechainAddress(source: TupleReader) {
    const _hash = source.readBigNumberOpt();
    return { $$type: 'BasechainAddress' as const, hash: _hash };
}

export function storeTupleBasechainAddress(source: BasechainAddress) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.hash);
    return builder.build();
}

export function dictValueParserBasechainAddress(): DictionaryValue<BasechainAddress> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBasechainAddress(src)).endCell());
        },
        parse: (src) => {
            return loadBasechainAddress(src.loadRef().beginParse());
        }
    }
}

export type Deploy = {
    $$type: 'Deploy';
    queryId: bigint;
}

export function storeDeploy(src: Deploy) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2490013878, 32);
        b_0.storeUint(src.queryId, 64);
    };
}

export function loadDeploy(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2490013878) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    return { $$type: 'Deploy' as const, queryId: _queryId };
}

export function loadTupleDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'Deploy' as const, queryId: _queryId };
}

export function loadGetterTupleDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'Deploy' as const, queryId: _queryId };
}

export function storeTupleDeploy(source: Deploy) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    return builder.build();
}

export function dictValueParserDeploy(): DictionaryValue<Deploy> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDeploy(src)).endCell());
        },
        parse: (src) => {
            return loadDeploy(src.loadRef().beginParse());
        }
    }
}

export type DeployOk = {
    $$type: 'DeployOk';
    queryId: bigint;
}

export function storeDeployOk(src: DeployOk) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2952335191, 32);
        b_0.storeUint(src.queryId, 64);
    };
}

export function loadDeployOk(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2952335191) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    return { $$type: 'DeployOk' as const, queryId: _queryId };
}

export function loadTupleDeployOk(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'DeployOk' as const, queryId: _queryId };
}

export function loadGetterTupleDeployOk(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'DeployOk' as const, queryId: _queryId };
}

export function storeTupleDeployOk(source: DeployOk) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    return builder.build();
}

export function dictValueParserDeployOk(): DictionaryValue<DeployOk> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeDeployOk(src)).endCell());
        },
        parse: (src) => {
            return loadDeployOk(src.loadRef().beginParse());
        }
    }
}

export type FactoryDeploy = {
    $$type: 'FactoryDeploy';
    queryId: bigint;
    cashback: Address;
}

export function storeFactoryDeploy(src: FactoryDeploy) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1829761339, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeAddress(src.cashback);
    };
}

export function loadFactoryDeploy(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1829761339) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _cashback = sc_0.loadAddress();
    return { $$type: 'FactoryDeploy' as const, queryId: _queryId, cashback: _cashback };
}

export function loadTupleFactoryDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _cashback = source.readAddress();
    return { $$type: 'FactoryDeploy' as const, queryId: _queryId, cashback: _cashback };
}

export function loadGetterTupleFactoryDeploy(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _cashback = source.readAddress();
    return { $$type: 'FactoryDeploy' as const, queryId: _queryId, cashback: _cashback };
}

export function storeTupleFactoryDeploy(source: FactoryDeploy) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeAddress(source.cashback);
    return builder.build();
}

export function dictValueParserFactoryDeploy(): DictionaryValue<FactoryDeploy> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeFactoryDeploy(src)).endCell());
        },
        parse: (src) => {
            return loadFactoryDeploy(src.loadRef().beginParse());
        }
    }
}

export type PayEscrow = {
    $$type: 'PayEscrow';
}

export function storePayEscrow(src: PayEscrow) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3453919792, 32);
    };
}

export function loadPayEscrow(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3453919792) { throw Error('Invalid prefix'); }
    return { $$type: 'PayEscrow' as const };
}

export function loadTuplePayEscrow(source: TupleReader) {
    return { $$type: 'PayEscrow' as const };
}

export function loadGetterTuplePayEscrow(source: TupleReader) {
    return { $$type: 'PayEscrow' as const };
}

export function storeTuplePayEscrow(source: PayEscrow) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserPayEscrow(): DictionaryValue<PayEscrow> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storePayEscrow(src)).endCell());
        },
        parse: (src) => {
            return loadPayEscrow(src.loadRef().beginParse());
        }
    }
}

export type ConfirmDelivery = {
    $$type: 'ConfirmDelivery';
}

export function storeConfirmDelivery(src: ConfirmDelivery) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(4104699808, 32);
    };
}

export function loadConfirmDelivery(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 4104699808) { throw Error('Invalid prefix'); }
    return { $$type: 'ConfirmDelivery' as const };
}

export function loadTupleConfirmDelivery(source: TupleReader) {
    return { $$type: 'ConfirmDelivery' as const };
}

export function loadGetterTupleConfirmDelivery(source: TupleReader) {
    return { $$type: 'ConfirmDelivery' as const };
}

export function storeTupleConfirmDelivery(source: ConfirmDelivery) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserConfirmDelivery(): DictionaryValue<ConfirmDelivery> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeConfirmDelivery(src)).endCell());
        },
        parse: (src) => {
            return loadConfirmDelivery(src.loadRef().beginParse());
        }
    }
}

export type OpenDispute = {
    $$type: 'OpenDispute';
}

export function storeOpenDispute(src: OpenDispute) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2663435750, 32);
    };
}

export function loadOpenDispute(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2663435750) { throw Error('Invalid prefix'); }
    return { $$type: 'OpenDispute' as const };
}

export function loadTupleOpenDispute(source: TupleReader) {
    return { $$type: 'OpenDispute' as const };
}

export function loadGetterTupleOpenDispute(source: TupleReader) {
    return { $$type: 'OpenDispute' as const };
}

export function storeTupleOpenDispute(source: OpenDispute) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserOpenDispute(): DictionaryValue<OpenDispute> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeOpenDispute(src)).endCell());
        },
        parse: (src) => {
            return loadOpenDispute(src.loadRef().beginParse());
        }
    }
}

export type ResolveRefund = {
    $$type: 'ResolveRefund';
}

export function storeResolveRefund(src: ResolveRefund) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2284215684, 32);
    };
}

export function loadResolveRefund(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2284215684) { throw Error('Invalid prefix'); }
    return { $$type: 'ResolveRefund' as const };
}

export function loadTupleResolveRefund(source: TupleReader) {
    return { $$type: 'ResolveRefund' as const };
}

export function loadGetterTupleResolveRefund(source: TupleReader) {
    return { $$type: 'ResolveRefund' as const };
}

export function storeTupleResolveRefund(source: ResolveRefund) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserResolveRefund(): DictionaryValue<ResolveRefund> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeResolveRefund(src)).endCell());
        },
        parse: (src) => {
            return loadResolveRefund(src.loadRef().beginParse());
        }
    }
}

export type ResolveRelease = {
    $$type: 'ResolveRelease';
}

export function storeResolveRelease(src: ResolveRelease) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1387388998, 32);
    };
}

export function loadResolveRelease(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1387388998) { throw Error('Invalid prefix'); }
    return { $$type: 'ResolveRelease' as const };
}

export function loadTupleResolveRelease(source: TupleReader) {
    return { $$type: 'ResolveRelease' as const };
}

export function loadGetterTupleResolveRelease(source: TupleReader) {
    return { $$type: 'ResolveRelease' as const };
}

export function storeTupleResolveRelease(source: ResolveRelease) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserResolveRelease(): DictionaryValue<ResolveRelease> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeResolveRelease(src)).endCell());
        },
        parse: (src) => {
            return loadResolveRelease(src.loadRef().beginParse());
        }
    }
}

export type TimeoutRelease = {
    $$type: 'TimeoutRelease';
}

export function storeTimeoutRelease(src: TimeoutRelease) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(432490359, 32);
    };
}

export function loadTimeoutRelease(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 432490359) { throw Error('Invalid prefix'); }
    return { $$type: 'TimeoutRelease' as const };
}

export function loadTupleTimeoutRelease(source: TupleReader) {
    return { $$type: 'TimeoutRelease' as const };
}

export function loadGetterTupleTimeoutRelease(source: TupleReader) {
    return { $$type: 'TimeoutRelease' as const };
}

export function storeTupleTimeoutRelease(source: TimeoutRelease) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserTimeoutRelease(): DictionaryValue<TimeoutRelease> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeTimeoutRelease(src)).endCell());
        },
        parse: (src) => {
            return loadTimeoutRelease(src.loadRef().beginParse());
        }
    }
}

export type Parties = {
    $$type: 'Parties';
    buyer: Address;
    seller: Address;
    treasury: Address;
}

export function storeParties(src: Parties) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeAddress(src.buyer);
        b_0.storeAddress(src.seller);
        b_0.storeAddress(src.treasury);
    };
}

export function loadParties(slice: Slice) {
    const sc_0 = slice;
    const _buyer = sc_0.loadAddress();
    const _seller = sc_0.loadAddress();
    const _treasury = sc_0.loadAddress();
    return { $$type: 'Parties' as const, buyer: _buyer, seller: _seller, treasury: _treasury };
}

export function loadTupleParties(source: TupleReader) {
    const _buyer = source.readAddress();
    const _seller = source.readAddress();
    const _treasury = source.readAddress();
    return { $$type: 'Parties' as const, buyer: _buyer, seller: _seller, treasury: _treasury };
}

export function loadGetterTupleParties(source: TupleReader) {
    const _buyer = source.readAddress();
    const _seller = source.readAddress();
    const _treasury = source.readAddress();
    return { $$type: 'Parties' as const, buyer: _buyer, seller: _seller, treasury: _treasury };
}

export function storeTupleParties(source: Parties) {
    const builder = new TupleBuilder();
    builder.writeAddress(source.buyer);
    builder.writeAddress(source.seller);
    builder.writeAddress(source.treasury);
    return builder.build();
}

export function dictValueParserParties(): DictionaryValue<Parties> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeParties(src)).endCell());
        },
        parse: (src) => {
            return loadParties(src.loadRef().beginParse());
        }
    }
}

export type EscrowDetails = {
    $$type: 'EscrowDetails';
    orderId: bigint;
    amountNano: bigint;
    feeBps: bigint;
    disputeWindowSec: bigint;
    state: bigint;
    paidAt: bigint;
}

export function storeEscrowDetails(src: EscrowDetails) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.orderId, 256);
        b_0.storeCoins(src.amountNano);
        b_0.storeUint(src.feeBps, 16);
        b_0.storeUint(src.disputeWindowSec, 32);
        b_0.storeUint(src.state, 8);
        b_0.storeUint(src.paidAt, 32);
    };
}

export function loadEscrowDetails(slice: Slice) {
    const sc_0 = slice;
    const _orderId = sc_0.loadUintBig(256);
    const _amountNano = sc_0.loadCoins();
    const _feeBps = sc_0.loadUintBig(16);
    const _disputeWindowSec = sc_0.loadUintBig(32);
    const _state = sc_0.loadUintBig(8);
    const _paidAt = sc_0.loadUintBig(32);
    return { $$type: 'EscrowDetails' as const, orderId: _orderId, amountNano: _amountNano, feeBps: _feeBps, disputeWindowSec: _disputeWindowSec, state: _state, paidAt: _paidAt };
}

export function loadTupleEscrowDetails(source: TupleReader) {
    const _orderId = source.readBigNumber();
    const _amountNano = source.readBigNumber();
    const _feeBps = source.readBigNumber();
    const _disputeWindowSec = source.readBigNumber();
    const _state = source.readBigNumber();
    const _paidAt = source.readBigNumber();
    return { $$type: 'EscrowDetails' as const, orderId: _orderId, amountNano: _amountNano, feeBps: _feeBps, disputeWindowSec: _disputeWindowSec, state: _state, paidAt: _paidAt };
}

export function loadGetterTupleEscrowDetails(source: TupleReader) {
    const _orderId = source.readBigNumber();
    const _amountNano = source.readBigNumber();
    const _feeBps = source.readBigNumber();
    const _disputeWindowSec = source.readBigNumber();
    const _state = source.readBigNumber();
    const _paidAt = source.readBigNumber();
    return { $$type: 'EscrowDetails' as const, orderId: _orderId, amountNano: _amountNano, feeBps: _feeBps, disputeWindowSec: _disputeWindowSec, state: _state, paidAt: _paidAt };
}

export function storeTupleEscrowDetails(source: EscrowDetails) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.orderId);
    builder.writeNumber(source.amountNano);
    builder.writeNumber(source.feeBps);
    builder.writeNumber(source.disputeWindowSec);
    builder.writeNumber(source.state);
    builder.writeNumber(source.paidAt);
    return builder.build();
}

export function dictValueParserEscrowDetails(): DictionaryValue<EscrowDetails> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeEscrowDetails(src)).endCell());
        },
        parse: (src) => {
            return loadEscrowDetails(src.loadRef().beginParse());
        }
    }
}

export type Escrow$Data = {
    $$type: 'Escrow$Data';
    orderId: bigint;
    buyer: Address;
    seller: Address;
    treasury: Address;
    amountNano: bigint;
    feeBps: bigint;
    disputeWindowSec: bigint;
    state: bigint;
    paidAt: bigint;
}

export function storeEscrow$Data(src: Escrow$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.orderId, 256);
        b_0.storeAddress(src.buyer);
        b_0.storeAddress(src.seller);
        const b_1 = new Builder();
        b_1.storeAddress(src.treasury);
        b_1.storeCoins(src.amountNano);
        b_1.storeUint(src.feeBps, 16);
        b_1.storeUint(src.disputeWindowSec, 32);
        b_1.storeUint(src.state, 8);
        b_1.storeUint(src.paidAt, 32);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadEscrow$Data(slice: Slice) {
    const sc_0 = slice;
    const _orderId = sc_0.loadUintBig(256);
    const _buyer = sc_0.loadAddress();
    const _seller = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _treasury = sc_1.loadAddress();
    const _amountNano = sc_1.loadCoins();
    const _feeBps = sc_1.loadUintBig(16);
    const _disputeWindowSec = sc_1.loadUintBig(32);
    const _state = sc_1.loadUintBig(8);
    const _paidAt = sc_1.loadUintBig(32);
    return { $$type: 'Escrow$Data' as const, orderId: _orderId, buyer: _buyer, seller: _seller, treasury: _treasury, amountNano: _amountNano, feeBps: _feeBps, disputeWindowSec: _disputeWindowSec, state: _state, paidAt: _paidAt };
}

export function loadTupleEscrow$Data(source: TupleReader) {
    const _orderId = source.readBigNumber();
    const _buyer = source.readAddress();
    const _seller = source.readAddress();
    const _treasury = source.readAddress();
    const _amountNano = source.readBigNumber();
    const _feeBps = source.readBigNumber();
    const _disputeWindowSec = source.readBigNumber();
    const _state = source.readBigNumber();
    const _paidAt = source.readBigNumber();
    return { $$type: 'Escrow$Data' as const, orderId: _orderId, buyer: _buyer, seller: _seller, treasury: _treasury, amountNano: _amountNano, feeBps: _feeBps, disputeWindowSec: _disputeWindowSec, state: _state, paidAt: _paidAt };
}

export function loadGetterTupleEscrow$Data(source: TupleReader) {
    const _orderId = source.readBigNumber();
    const _buyer = source.readAddress();
    const _seller = source.readAddress();
    const _treasury = source.readAddress();
    const _amountNano = source.readBigNumber();
    const _feeBps = source.readBigNumber();
    const _disputeWindowSec = source.readBigNumber();
    const _state = source.readBigNumber();
    const _paidAt = source.readBigNumber();
    return { $$type: 'Escrow$Data' as const, orderId: _orderId, buyer: _buyer, seller: _seller, treasury: _treasury, amountNano: _amountNano, feeBps: _feeBps, disputeWindowSec: _disputeWindowSec, state: _state, paidAt: _paidAt };
}

export function storeTupleEscrow$Data(source: Escrow$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.orderId);
    builder.writeAddress(source.buyer);
    builder.writeAddress(source.seller);
    builder.writeAddress(source.treasury);
    builder.writeNumber(source.amountNano);
    builder.writeNumber(source.feeBps);
    builder.writeNumber(source.disputeWindowSec);
    builder.writeNumber(source.state);
    builder.writeNumber(source.paidAt);
    return builder.build();
}

export function dictValueParserEscrow$Data(): DictionaryValue<Escrow$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeEscrow$Data(src)).endCell());
        },
        parse: (src) => {
            return loadEscrow$Data(src.loadRef().beginParse());
        }
    }
}

 type Escrow_init_args = {
    $$type: 'Escrow_init_args';
    orderId: bigint;
    buyer: Address;
    seller: Address;
    treasury: Address;
    amountNano: bigint;
    feeBps: bigint;
    disputeWindowSec: bigint;
}

function initEscrow_init_args(src: Escrow_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.orderId, 257);
        b_0.storeAddress(src.buyer);
        b_0.storeAddress(src.seller);
        const b_1 = new Builder();
        b_1.storeAddress(src.treasury);
        b_1.storeInt(src.amountNano, 257);
        b_1.storeInt(src.feeBps, 257);
        const b_2 = new Builder();
        b_2.storeInt(src.disputeWindowSec, 257);
        b_1.storeRef(b_2.endCell());
        b_0.storeRef(b_1.endCell());
    };
}

async function Escrow_init(orderId: bigint, buyer: Address, seller: Address, treasury: Address, amountNano: bigint, feeBps: bigint, disputeWindowSec: bigint) {
    const __code = Cell.fromHex('b5ee9c7241021901000549000114ff00f4a413f4bcf2c80b01020162021101f6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e1ed3fffa40fa40d401d0fa40fa00d30fd31fd307d31f301069106810676c198e2d810101d700fa40fa40d401d0fa40810101d700810101d700d430d0810101d7003010471046104507d155057020e20a925f0ae008d70d1ff2e082210304fe8210cddea230ba8e565b38816b0007c00017f2f4813dcdf84225c705f2f48200b637f8416f24135f0322bef2f471f82310681057104610351024c87f01ca0055805089cbff16ce14ce02c8ce01fa0212cb0f12cb1f12cb0712cb1fcdc9ed54e0218210f4a8bfa0bae3022182109ec0cde6bae30221821088265d84bae3022104050609017c5b81762428c001f2f4813dcdf84227c705f2f410685515db3cc87f01ca0055805089cbff16ce14ce02c8ce01fa0212cb0f12cb1f12cb0712cb1fcdc9ed540b00985b81762408c00118f2f4813dcdf84226c705f2f45376a08200c8fff82358bbf2f4105755147201c87f01ca0055805089cbff16ce14ce02c8ce01fa0212cb0f12cb1f12cb0712cb1fcdc9ed5402c25b8200f26e08c00218f2f481404df84224c705f2f474708100a0708829553010246d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0010681057104610354403020708002200000000457363726f7720726566756e64004ac87f01ca0055805089cbff16ce14ce02c8ce01fa0212cb0f12cb1f12cb0712cb1fcdc9ed5403c4821052b1e046ba8ebf5b8200f26e28c002f2f481404df84225c705f2f410685515db3cc87f01ca0055805089cbff16ce14ce02c8ce01fa0212cb0f12cb1f12cb0712cb1fcdc9ed54e021821019c74777bae302018210946a98b6bae3025f0af2c0820b0a1001825b81762428c001f2f45380a0820086fdf82358bcf2f410685515db3cc87f01ca0055805089cbff16ce14ce02c8ce01fa0212cb0f12cb1f12cb0712cb1fcdc9ed540b04f6315da8812710a9045240a171708829553010246d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00708100a0708828553010246d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf818ae2f400c901fb000c0d0e0f002400000000457363726f772072656c65617365002000000000506c6174666f726d20666565001a58cf8680cf8480f400f400cf810004730100cad33f30c8018210aff90f5758cb1fcb3fc9107910681057104610354430f84270705003804201503304c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00c87f01ca0055805089cbff16ce14ce02c8ce01fa0212cb0f12cb1f12cb0712cb1fcdc9ed54020120121401b9bd78af6a268690000c70f69fffd207d206a00e87d207d006987e98fe983e98f98083488340833b60cc716c08080eb807d207d206a00e87d20408080eb80408080eb806a1868408080eb801808238823082283e8aa82b810716d9e3648c13000221020158151701b9b60d5da89a1a400031c3da7fff481f481a803a1f481f401a61fa63fa60fa63e6020d220d020ced8331c5b020203ae01f481f481a803a1f481020203ae01020203ae01a861a1020203ae0060208e208c208a0fa2aa0ae041c5b678d92d016000c54784354754301b9b6113da89a1a400031c3da7fff481f481a803a1f481f401a61fa63fa60fa63e6020d220d020ced8331c5b020203ae01f481f481a803a1f481020203ae01020203ae01a861a1020203ae0060208e208c208a0fa2aa0ae041c5b678d92701800065477655aa9f84c');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initEscrow_init_args({ $$type: 'Escrow_init_args', orderId, buyer, seller, treasury, amountNano, feeBps, disputeWindowSec })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const Escrow_errors = {
    2: { message: "Stack underflow" },
    3: { message: "Stack overflow" },
    4: { message: "Integer overflow" },
    5: { message: "Integer out of expected range" },
    6: { message: "Invalid opcode" },
    7: { message: "Type check error" },
    8: { message: "Cell overflow" },
    9: { message: "Cell underflow" },
    10: { message: "Dictionary error" },
    11: { message: "'Unknown' error" },
    12: { message: "Fatal error" },
    13: { message: "Out of gas error" },
    14: { message: "Virtualization error" },
    32: { message: "Action list is invalid" },
    33: { message: "Action list is too long" },
    34: { message: "Action is invalid or not supported" },
    35: { message: "Invalid source address in outbound message" },
    36: { message: "Invalid destination address in outbound message" },
    37: { message: "Not enough Toncoin" },
    38: { message: "Not enough extra currencies" },
    39: { message: "Outbound message does not fit into a cell after rewriting" },
    40: { message: "Cannot process a message" },
    41: { message: "Library reference is null" },
    42: { message: "Library change action error" },
    43: { message: "Exceeded maximum number of cells in the library or the maximum depth of the Merkle tree" },
    50: { message: "Account state size exceeded limits" },
    128: { message: "Null reference exception" },
    129: { message: "Invalid serialization prefix" },
    130: { message: "Invalid incoming message" },
    131: { message: "Constraints error" },
    132: { message: "Access denied" },
    133: { message: "Contract stopped" },
    134: { message: "Invalid argument" },
    135: { message: "Code of a contract was not found" },
    136: { message: "Invalid standard address" },
    138: { message: "Not a basechain address" },
    15821: { message: "Only buyer" },
    16461: { message: "Only admin" },
    27392: { message: "Already funded" },
    30244: { message: "Not funded" },
    34557: { message: "Window still open" },
    46647: { message: "Insufficient payment" },
    51455: { message: "Dispute window closed" },
    62062: { message: "Not disputed" },
} as const

export const Escrow_errors_backward = {
    "Stack underflow": 2,
    "Stack overflow": 3,
    "Integer overflow": 4,
    "Integer out of expected range": 5,
    "Invalid opcode": 6,
    "Type check error": 7,
    "Cell overflow": 8,
    "Cell underflow": 9,
    "Dictionary error": 10,
    "'Unknown' error": 11,
    "Fatal error": 12,
    "Out of gas error": 13,
    "Virtualization error": 14,
    "Action list is invalid": 32,
    "Action list is too long": 33,
    "Action is invalid or not supported": 34,
    "Invalid source address in outbound message": 35,
    "Invalid destination address in outbound message": 36,
    "Not enough Toncoin": 37,
    "Not enough extra currencies": 38,
    "Outbound message does not fit into a cell after rewriting": 39,
    "Cannot process a message": 40,
    "Library reference is null": 41,
    "Library change action error": 42,
    "Exceeded maximum number of cells in the library or the maximum depth of the Merkle tree": 43,
    "Account state size exceeded limits": 50,
    "Null reference exception": 128,
    "Invalid serialization prefix": 129,
    "Invalid incoming message": 130,
    "Constraints error": 131,
    "Access denied": 132,
    "Contract stopped": 133,
    "Invalid argument": 134,
    "Code of a contract was not found": 135,
    "Invalid standard address": 136,
    "Not a basechain address": 138,
    "Only buyer": 15821,
    "Only admin": 16461,
    "Already funded": 27392,
    "Not funded": 30244,
    "Window still open": 34557,
    "Insufficient payment": 46647,
    "Dispute window closed": 51455,
    "Not disputed": 62062,
} as const

const Escrow_types: ABIType[] = [
    {"name":"DataSize","header":null,"fields":[{"name":"cells","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bits","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"refs","type":{"kind":"simple","type":"int","optional":false,"format":257}}]},
    {"name":"SignedBundle","header":null,"fields":[{"name":"signature","type":{"kind":"simple","type":"fixed-bytes","optional":false,"format":64}},{"name":"signedData","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"StateInit","header":null,"fields":[{"name":"code","type":{"kind":"simple","type":"cell","optional":false}},{"name":"data","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"Context","header":null,"fields":[{"name":"bounceable","type":{"kind":"simple","type":"bool","optional":false}},{"name":"sender","type":{"kind":"simple","type":"address","optional":false}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"raw","type":{"kind":"simple","type":"slice","optional":false}}]},
    {"name":"SendParameters","header":null,"fields":[{"name":"mode","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body","type":{"kind":"simple","type":"cell","optional":true}},{"name":"code","type":{"kind":"simple","type":"cell","optional":true}},{"name":"data","type":{"kind":"simple","type":"cell","optional":true}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"to","type":{"kind":"simple","type":"address","optional":false}},{"name":"bounce","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"MessageParameters","header":null,"fields":[{"name":"mode","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body","type":{"kind":"simple","type":"cell","optional":true}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"to","type":{"kind":"simple","type":"address","optional":false}},{"name":"bounce","type":{"kind":"simple","type":"bool","optional":false}}]},
    {"name":"DeployParameters","header":null,"fields":[{"name":"mode","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"body","type":{"kind":"simple","type":"cell","optional":true}},{"name":"value","type":{"kind":"simple","type":"int","optional":false,"format":257}},{"name":"bounce","type":{"kind":"simple","type":"bool","optional":false}},{"name":"init","type":{"kind":"simple","type":"StateInit","optional":false}}]},
    {"name":"StdAddress","header":null,"fields":[{"name":"workchain","type":{"kind":"simple","type":"int","optional":false,"format":8}},{"name":"address","type":{"kind":"simple","type":"uint","optional":false,"format":256}}]},
    {"name":"VarAddress","header":null,"fields":[{"name":"workchain","type":{"kind":"simple","type":"int","optional":false,"format":32}},{"name":"address","type":{"kind":"simple","type":"slice","optional":false}}]},
    {"name":"BasechainAddress","header":null,"fields":[{"name":"hash","type":{"kind":"simple","type":"int","optional":true,"format":257}}]},
    {"name":"Deploy","header":2490013878,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"DeployOk","header":2952335191,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"FactoryDeploy","header":1829761339,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"cashback","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"PayEscrow","header":3453919792,"fields":[]},
    {"name":"ConfirmDelivery","header":4104699808,"fields":[]},
    {"name":"OpenDispute","header":2663435750,"fields":[]},
    {"name":"ResolveRefund","header":2284215684,"fields":[]},
    {"name":"ResolveRelease","header":1387388998,"fields":[]},
    {"name":"TimeoutRelease","header":432490359,"fields":[]},
    {"name":"Parties","header":null,"fields":[{"name":"buyer","type":{"kind":"simple","type":"address","optional":false}},{"name":"seller","type":{"kind":"simple","type":"address","optional":false}},{"name":"treasury","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"EscrowDetails","header":null,"fields":[{"name":"orderId","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"amountNano","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"feeBps","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"disputeWindowSec","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"state","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"paidAt","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"Escrow$Data","header":null,"fields":[{"name":"orderId","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"buyer","type":{"kind":"simple","type":"address","optional":false}},{"name":"seller","type":{"kind":"simple","type":"address","optional":false}},{"name":"treasury","type":{"kind":"simple","type":"address","optional":false}},{"name":"amountNano","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"feeBps","type":{"kind":"simple","type":"uint","optional":false,"format":16}},{"name":"disputeWindowSec","type":{"kind":"simple","type":"uint","optional":false,"format":32}},{"name":"state","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"paidAt","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
]

const Escrow_opcodes = {
    "Deploy": 2490013878,
    "DeployOk": 2952335191,
    "FactoryDeploy": 1829761339,
    "PayEscrow": 3453919792,
    "ConfirmDelivery": 4104699808,
    "OpenDispute": 2663435750,
    "ResolveRefund": 2284215684,
    "ResolveRelease": 1387388998,
    "TimeoutRelease": 432490359,
}

const Escrow_getters: ABIGetter[] = [
    {"name":"state","methodId":77589,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
    {"name":"parties","methodId":127113,"arguments":[],"returnType":{"kind":"simple","type":"Parties","optional":false}},
    {"name":"details","methodId":118890,"arguments":[],"returnType":{"kind":"simple","type":"EscrowDetails","optional":false}},
]

export const Escrow_getterMapping: { [key: string]: string } = {
    'state': 'getState',
    'parties': 'getParties',
    'details': 'getDetails',
}

const Escrow_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"PayEscrow"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ConfirmDelivery"}},
    {"receiver":"internal","message":{"kind":"typed","type":"OpenDispute"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ResolveRefund"}},
    {"receiver":"internal","message":{"kind":"typed","type":"ResolveRelease"}},
    {"receiver":"internal","message":{"kind":"typed","type":"TimeoutRelease"}},
    {"receiver":"internal","message":{"kind":"typed","type":"Deploy"}},
]


export class Escrow implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = Escrow_errors_backward;
    public static readonly opcodes = Escrow_opcodes;
    
    static async init(orderId: bigint, buyer: Address, seller: Address, treasury: Address, amountNano: bigint, feeBps: bigint, disputeWindowSec: bigint) {
        return await Escrow_init(orderId, buyer, seller, treasury, amountNano, feeBps, disputeWindowSec);
    }
    
    static async fromInit(orderId: bigint, buyer: Address, seller: Address, treasury: Address, amountNano: bigint, feeBps: bigint, disputeWindowSec: bigint) {
        const __gen_init = await Escrow_init(orderId, buyer, seller, treasury, amountNano, feeBps, disputeWindowSec);
        const address = contractAddress(0, __gen_init);
        return new Escrow(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new Escrow(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  Escrow_types,
        getters: Escrow_getters,
        receivers: Escrow_receivers,
        errors: Escrow_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: PayEscrow | ConfirmDelivery | OpenDispute | ResolveRefund | ResolveRelease | TimeoutRelease | Deploy) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'PayEscrow') {
            body = beginCell().store(storePayEscrow(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ConfirmDelivery') {
            body = beginCell().store(storeConfirmDelivery(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'OpenDispute') {
            body = beginCell().store(storeOpenDispute(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ResolveRefund') {
            body = beginCell().store(storeResolveRefund(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'ResolveRelease') {
            body = beginCell().store(storeResolveRelease(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'TimeoutRelease') {
            body = beginCell().store(storeTimeoutRelease(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'Deploy') {
            body = beginCell().store(storeDeploy(message)).endCell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getState(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('state', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
    async getParties(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('parties', builder.build())).stack;
        const result = loadGetterTupleParties(source);
        return result;
    }
    
    async getDetails(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('details', builder.build())).stack;
        const result = loadGetterTupleEscrowDetails(source);
        return result;
    }
    
}