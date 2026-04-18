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

export type Transfer = {
    $$type: 'Transfer';
    queryId: bigint;
    newOwner: Address;
    responseTo: Address;
    customPayload: Cell | null;
    forwardAmount: bigint;
    forwardPayload: Slice;
}

export function storeTransfer(src: Transfer) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1607220500, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeAddress(src.newOwner);
        b_0.storeAddress(src.responseTo);
        if (src.customPayload !== null && src.customPayload !== undefined) { b_0.storeBit(true).storeRef(src.customPayload); } else { b_0.storeBit(false); }
        b_0.storeCoins(src.forwardAmount);
        b_0.storeBuilder(src.forwardPayload.asBuilder());
    };
}

export function loadTransfer(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1607220500) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _newOwner = sc_0.loadAddress();
    const _responseTo = sc_0.loadAddress();
    const _customPayload = sc_0.loadBit() ? sc_0.loadRef() : null;
    const _forwardAmount = sc_0.loadCoins();
    const _forwardPayload = sc_0;
    return { $$type: 'Transfer' as const, queryId: _queryId, newOwner: _newOwner, responseTo: _responseTo, customPayload: _customPayload, forwardAmount: _forwardAmount, forwardPayload: _forwardPayload };
}

export function loadTupleTransfer(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _newOwner = source.readAddress();
    const _responseTo = source.readAddress();
    const _customPayload = source.readCellOpt();
    const _forwardAmount = source.readBigNumber();
    const _forwardPayload = source.readCell().asSlice();
    return { $$type: 'Transfer' as const, queryId: _queryId, newOwner: _newOwner, responseTo: _responseTo, customPayload: _customPayload, forwardAmount: _forwardAmount, forwardPayload: _forwardPayload };
}

export function loadGetterTupleTransfer(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _newOwner = source.readAddress();
    const _responseTo = source.readAddress();
    const _customPayload = source.readCellOpt();
    const _forwardAmount = source.readBigNumber();
    const _forwardPayload = source.readCell().asSlice();
    return { $$type: 'Transfer' as const, queryId: _queryId, newOwner: _newOwner, responseTo: _responseTo, customPayload: _customPayload, forwardAmount: _forwardAmount, forwardPayload: _forwardPayload };
}

export function storeTupleTransfer(source: Transfer) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeAddress(source.newOwner);
    builder.writeAddress(source.responseTo);
    builder.writeCell(source.customPayload);
    builder.writeNumber(source.forwardAmount);
    builder.writeSlice(source.forwardPayload.asCell());
    return builder.build();
}

export function dictValueParserTransfer(): DictionaryValue<Transfer> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeTransfer(src)).endCell());
        },
        parse: (src) => {
            return loadTransfer(src.loadRef().beginParse());
        }
    }
}

export type Burn = {
    $$type: 'Burn';
    queryId: bigint;
}

export function storeBurn(src: Burn) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1499400124, 32);
        b_0.storeUint(src.queryId, 64);
    };
}

export function loadBurn(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1499400124) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    return { $$type: 'Burn' as const, queryId: _queryId };
}

export function loadTupleBurn(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'Burn' as const, queryId: _queryId };
}

export function loadGetterTupleBurn(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'Burn' as const, queryId: _queryId };
}

export function storeTupleBurn(source: Burn) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    return builder.build();
}

export function dictValueParserBurn(): DictionaryValue<Burn> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBurn(src)).endCell());
        },
        parse: (src) => {
            return loadBurn(src.loadRef().beginParse());
        }
    }
}

export type GetStaticData = {
    $$type: 'GetStaticData';
    queryId: bigint;
}

export function storeGetStaticData(src: GetStaticData) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(801842850, 32);
        b_0.storeUint(src.queryId, 64);
    };
}

export function loadGetStaticData(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 801842850) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    return { $$type: 'GetStaticData' as const, queryId: _queryId };
}

export function loadTupleGetStaticData(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'GetStaticData' as const, queryId: _queryId };
}

export function loadGetterTupleGetStaticData(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'GetStaticData' as const, queryId: _queryId };
}

export function storeTupleGetStaticData(source: GetStaticData) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    return builder.build();
}

export function dictValueParserGetStaticData(): DictionaryValue<GetStaticData> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeGetStaticData(src)).endCell());
        },
        parse: (src) => {
            return loadGetStaticData(src.loadRef().beginParse());
        }
    }
}

export type ReportStaticData = {
    $$type: 'ReportStaticData';
    queryId: bigint;
    index: bigint;
    collection: Address;
}

export function storeReportStaticData(src: ReportStaticData) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2339837749, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeUint(src.index, 256);
        b_0.storeAddress(src.collection);
    };
}

export function loadReportStaticData(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2339837749) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _index = sc_0.loadUintBig(256);
    const _collection = sc_0.loadAddress();
    return { $$type: 'ReportStaticData' as const, queryId: _queryId, index: _index, collection: _collection };
}

export function loadTupleReportStaticData(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _index = source.readBigNumber();
    const _collection = source.readAddress();
    return { $$type: 'ReportStaticData' as const, queryId: _queryId, index: _index, collection: _collection };
}

export function loadGetterTupleReportStaticData(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _index = source.readBigNumber();
    const _collection = source.readAddress();
    return { $$type: 'ReportStaticData' as const, queryId: _queryId, index: _index, collection: _collection };
}

export function storeTupleReportStaticData(source: ReportStaticData) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeNumber(source.index);
    builder.writeAddress(source.collection);
    return builder.build();
}

export function dictValueParserReportStaticData(): DictionaryValue<ReportStaticData> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeReportStaticData(src)).endCell());
        },
        parse: (src) => {
            return loadReportStaticData(src.loadRef().beginParse());
        }
    }
}

export type OwnerAssigned = {
    $$type: 'OwnerAssigned';
    queryId: bigint;
    prevOwner: Address;
    forwardPayload: Slice;
}

export function storeOwnerAssigned(src: OwnerAssigned) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(85167505, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeAddress(src.prevOwner);
        b_0.storeBuilder(src.forwardPayload.asBuilder());
    };
}

export function loadOwnerAssigned(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 85167505) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _prevOwner = sc_0.loadAddress();
    const _forwardPayload = sc_0;
    return { $$type: 'OwnerAssigned' as const, queryId: _queryId, prevOwner: _prevOwner, forwardPayload: _forwardPayload };
}

export function loadTupleOwnerAssigned(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _prevOwner = source.readAddress();
    const _forwardPayload = source.readCell().asSlice();
    return { $$type: 'OwnerAssigned' as const, queryId: _queryId, prevOwner: _prevOwner, forwardPayload: _forwardPayload };
}

export function loadGetterTupleOwnerAssigned(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _prevOwner = source.readAddress();
    const _forwardPayload = source.readCell().asSlice();
    return { $$type: 'OwnerAssigned' as const, queryId: _queryId, prevOwner: _prevOwner, forwardPayload: _forwardPayload };
}

export function storeTupleOwnerAssigned(source: OwnerAssigned) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeAddress(source.prevOwner);
    builder.writeSlice(source.forwardPayload.asCell());
    return builder.build();
}

export function dictValueParserOwnerAssigned(): DictionaryValue<OwnerAssigned> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeOwnerAssigned(src)).endCell());
        },
        parse: (src) => {
            return loadOwnerAssigned(src.loadRef().beginParse());
        }
    }
}

export type Excesses = {
    $$type: 'Excesses';
    queryId: bigint;
}

export function storeExcesses(src: Excesses) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(3576854235, 32);
        b_0.storeUint(src.queryId, 64);
    };
}

export function loadExcesses(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 3576854235) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    return { $$type: 'Excesses' as const, queryId: _queryId };
}

export function loadTupleExcesses(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'Excesses' as const, queryId: _queryId };
}

export function loadGetterTupleExcesses(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'Excesses' as const, queryId: _queryId };
}

export function storeTupleExcesses(source: Excesses) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    return builder.build();
}

export function dictValueParserExcesses(): DictionaryValue<Excesses> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeExcesses(src)).endCell());
        },
        parse: (src) => {
            return loadExcesses(src.loadRef().beginParse());
        }
    }
}

export type BuyerBurn = {
    $$type: 'BuyerBurn';
    queryId: bigint;
}

export function storeBuyerBurn(src: BuyerBurn) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2048605277, 32);
        b_0.storeUint(src.queryId, 64);
    };
}

export function loadBuyerBurn(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2048605277) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    return { $$type: 'BuyerBurn' as const, queryId: _queryId };
}

export function loadTupleBuyerBurn(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'BuyerBurn' as const, queryId: _queryId };
}

export function loadGetterTupleBuyerBurn(source: TupleReader) {
    const _queryId = source.readBigNumber();
    return { $$type: 'BuyerBurn' as const, queryId: _queryId };
}

export function storeTupleBuyerBurn(source: BuyerBurn) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    return builder.build();
}

export function dictValueParserBuyerBurn(): DictionaryValue<BuyerBurn> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBuyerBurn(src)).endCell());
        },
        parse: (src) => {
            return loadBuyerBurn(src.loadRef().beginParse());
        }
    }
}

export type RefundOnBurn = {
    $$type: 'RefundOnBurn';
}

export function storeRefundOnBurn(src: RefundOnBurn) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(2114466325, 32);
    };
}

export function loadRefundOnBurn(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 2114466325) { throw Error('Invalid prefix'); }
    return { $$type: 'RefundOnBurn' as const };
}

export function loadTupleRefundOnBurn(source: TupleReader) {
    return { $$type: 'RefundOnBurn' as const };
}

export function loadGetterTupleRefundOnBurn(source: TupleReader) {
    return { $$type: 'RefundOnBurn' as const };
}

export function storeTupleRefundOnBurn(source: RefundOnBurn) {
    const builder = new TupleBuilder();
    return builder.build();
}

export function dictValueParserRefundOnBurn(): DictionaryValue<RefundOnBurn> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeRefundOnBurn(src)).endCell());
        },
        parse: (src) => {
            return loadRefundOnBurn(src.loadRef().beginParse());
        }
    }
}

export type LicenseItem$Data = {
    $$type: 'LicenseItem$Data';
    index: bigint;
    collection: Address;
    ownerAddress: Address;
    escrowAddress: Address;
    transferLimit: bigint;
    transfers: bigint;
    content: Cell;
    burnDeadline: bigint;
}

export function storeLicenseItem$Data(src: LicenseItem$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.index, 256);
        b_0.storeAddress(src.collection);
        b_0.storeAddress(src.ownerAddress);
        const b_1 = new Builder();
        b_1.storeAddress(src.escrowAddress);
        b_1.storeUint(src.transferLimit, 8);
        b_1.storeUint(src.transfers, 8);
        b_1.storeRef(src.content);
        b_1.storeUint(src.burnDeadline, 32);
        b_0.storeRef(b_1.endCell());
    };
}

export function loadLicenseItem$Data(slice: Slice) {
    const sc_0 = slice;
    const _index = sc_0.loadUintBig(256);
    const _collection = sc_0.loadAddress();
    const _ownerAddress = sc_0.loadAddress();
    const sc_1 = sc_0.loadRef().beginParse();
    const _escrowAddress = sc_1.loadAddress();
    const _transferLimit = sc_1.loadUintBig(8);
    const _transfers = sc_1.loadUintBig(8);
    const _content = sc_1.loadRef();
    const _burnDeadline = sc_1.loadUintBig(32);
    return { $$type: 'LicenseItem$Data' as const, index: _index, collection: _collection, ownerAddress: _ownerAddress, escrowAddress: _escrowAddress, transferLimit: _transferLimit, transfers: _transfers, content: _content, burnDeadline: _burnDeadline };
}

export function loadTupleLicenseItem$Data(source: TupleReader) {
    const _index = source.readBigNumber();
    const _collection = source.readAddress();
    const _ownerAddress = source.readAddress();
    const _escrowAddress = source.readAddress();
    const _transferLimit = source.readBigNumber();
    const _transfers = source.readBigNumber();
    const _content = source.readCell();
    const _burnDeadline = source.readBigNumber();
    return { $$type: 'LicenseItem$Data' as const, index: _index, collection: _collection, ownerAddress: _ownerAddress, escrowAddress: _escrowAddress, transferLimit: _transferLimit, transfers: _transfers, content: _content, burnDeadline: _burnDeadline };
}

export function loadGetterTupleLicenseItem$Data(source: TupleReader) {
    const _index = source.readBigNumber();
    const _collection = source.readAddress();
    const _ownerAddress = source.readAddress();
    const _escrowAddress = source.readAddress();
    const _transferLimit = source.readBigNumber();
    const _transfers = source.readBigNumber();
    const _content = source.readCell();
    const _burnDeadline = source.readBigNumber();
    return { $$type: 'LicenseItem$Data' as const, index: _index, collection: _collection, ownerAddress: _ownerAddress, escrowAddress: _escrowAddress, transferLimit: _transferLimit, transfers: _transfers, content: _content, burnDeadline: _burnDeadline };
}

export function storeTupleLicenseItem$Data(source: LicenseItem$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.index);
    builder.writeAddress(source.collection);
    builder.writeAddress(source.ownerAddress);
    builder.writeAddress(source.escrowAddress);
    builder.writeNumber(source.transferLimit);
    builder.writeNumber(source.transfers);
    builder.writeCell(source.content);
    builder.writeNumber(source.burnDeadline);
    return builder.build();
}

export function dictValueParserLicenseItem$Data(): DictionaryValue<LicenseItem$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeLicenseItem$Data(src)).endCell());
        },
        parse: (src) => {
            return loadLicenseItem$Data(src.loadRef().beginParse());
        }
    }
}

export type NftData = {
    $$type: 'NftData';
    init: boolean;
    index: bigint;
    collection: Address;
    owner: Address;
    content: Cell;
}

export function storeNftData(src: NftData) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeBit(src.init);
        b_0.storeUint(src.index, 256);
        b_0.storeAddress(src.collection);
        b_0.storeAddress(src.owner);
        b_0.storeRef(src.content);
    };
}

export function loadNftData(slice: Slice) {
    const sc_0 = slice;
    const _init = sc_0.loadBit();
    const _index = sc_0.loadUintBig(256);
    const _collection = sc_0.loadAddress();
    const _owner = sc_0.loadAddress();
    const _content = sc_0.loadRef();
    return { $$type: 'NftData' as const, init: _init, index: _index, collection: _collection, owner: _owner, content: _content };
}

export function loadTupleNftData(source: TupleReader) {
    const _init = source.readBoolean();
    const _index = source.readBigNumber();
    const _collection = source.readAddress();
    const _owner = source.readAddress();
    const _content = source.readCell();
    return { $$type: 'NftData' as const, init: _init, index: _index, collection: _collection, owner: _owner, content: _content };
}

export function loadGetterTupleNftData(source: TupleReader) {
    const _init = source.readBoolean();
    const _index = source.readBigNumber();
    const _collection = source.readAddress();
    const _owner = source.readAddress();
    const _content = source.readCell();
    return { $$type: 'NftData' as const, init: _init, index: _index, collection: _collection, owner: _owner, content: _content };
}

export function storeTupleNftData(source: NftData) {
    const builder = new TupleBuilder();
    builder.writeBoolean(source.init);
    builder.writeNumber(source.index);
    builder.writeAddress(source.collection);
    builder.writeAddress(source.owner);
    builder.writeCell(source.content);
    return builder.build();
}

export function dictValueParserNftData(): DictionaryValue<NftData> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeNftData(src)).endCell());
        },
        parse: (src) => {
            return loadNftData(src.loadRef().beginParse());
        }
    }
}

export type SoulboundInfo = {
    $$type: 'SoulboundInfo';
    transferLimit: bigint;
    transfers: bigint;
}

export function storeSoulboundInfo(src: SoulboundInfo) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.transferLimit, 8);
        b_0.storeUint(src.transfers, 8);
    };
}

export function loadSoulboundInfo(slice: Slice) {
    const sc_0 = slice;
    const _transferLimit = sc_0.loadUintBig(8);
    const _transfers = sc_0.loadUintBig(8);
    return { $$type: 'SoulboundInfo' as const, transferLimit: _transferLimit, transfers: _transfers };
}

export function loadTupleSoulboundInfo(source: TupleReader) {
    const _transferLimit = source.readBigNumber();
    const _transfers = source.readBigNumber();
    return { $$type: 'SoulboundInfo' as const, transferLimit: _transferLimit, transfers: _transfers };
}

export function loadGetterTupleSoulboundInfo(source: TupleReader) {
    const _transferLimit = source.readBigNumber();
    const _transfers = source.readBigNumber();
    return { $$type: 'SoulboundInfo' as const, transferLimit: _transferLimit, transfers: _transfers };
}

export function storeTupleSoulboundInfo(source: SoulboundInfo) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.transferLimit);
    builder.writeNumber(source.transfers);
    return builder.build();
}

export function dictValueParserSoulboundInfo(): DictionaryValue<SoulboundInfo> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeSoulboundInfo(src)).endCell());
        },
        parse: (src) => {
            return loadSoulboundInfo(src.loadRef().beginParse());
        }
    }
}

export type MintLicense = {
    $$type: 'MintLicense';
    queryId: bigint;
    buyerAddress: Address;
    escrowAddress: Address;
    transferLimit: bigint;
    individualContent: Cell;
    burnDeadline: bigint;
}

export function storeMintLicense(src: MintLicense) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1782229524, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeAddress(src.buyerAddress);
        b_0.storeAddress(src.escrowAddress);
        b_0.storeUint(src.transferLimit, 8);
        b_0.storeRef(src.individualContent);
        b_0.storeUint(src.burnDeadline, 32);
    };
}

export function loadMintLicense(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1782229524) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _buyerAddress = sc_0.loadAddress();
    const _escrowAddress = sc_0.loadAddress();
    const _transferLimit = sc_0.loadUintBig(8);
    const _individualContent = sc_0.loadRef();
    const _burnDeadline = sc_0.loadUintBig(32);
    return { $$type: 'MintLicense' as const, queryId: _queryId, buyerAddress: _buyerAddress, escrowAddress: _escrowAddress, transferLimit: _transferLimit, individualContent: _individualContent, burnDeadline: _burnDeadline };
}

export function loadTupleMintLicense(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _buyerAddress = source.readAddress();
    const _escrowAddress = source.readAddress();
    const _transferLimit = source.readBigNumber();
    const _individualContent = source.readCell();
    const _burnDeadline = source.readBigNumber();
    return { $$type: 'MintLicense' as const, queryId: _queryId, buyerAddress: _buyerAddress, escrowAddress: _escrowAddress, transferLimit: _transferLimit, individualContent: _individualContent, burnDeadline: _burnDeadline };
}

export function loadGetterTupleMintLicense(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _buyerAddress = source.readAddress();
    const _escrowAddress = source.readAddress();
    const _transferLimit = source.readBigNumber();
    const _individualContent = source.readCell();
    const _burnDeadline = source.readBigNumber();
    return { $$type: 'MintLicense' as const, queryId: _queryId, buyerAddress: _buyerAddress, escrowAddress: _escrowAddress, transferLimit: _transferLimit, individualContent: _individualContent, burnDeadline: _burnDeadline };
}

export function storeTupleMintLicense(source: MintLicense) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeAddress(source.buyerAddress);
    builder.writeAddress(source.escrowAddress);
    builder.writeNumber(source.transferLimit);
    builder.writeCell(source.individualContent);
    builder.writeNumber(source.burnDeadline);
    return builder.build();
}

export function dictValueParserMintLicense(): DictionaryValue<MintLicense> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeMintLicense(src)).endCell());
        },
        parse: (src) => {
            return loadMintLicense(src.loadRef().beginParse());
        }
    }
}

export type BurnLicense = {
    $$type: 'BurnLicense';
    queryId: bigint;
    itemAddress: Address;
}

export function storeBurnLicense(src: BurnLicense) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1301187092, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeAddress(src.itemAddress);
    };
}

export function loadBurnLicense(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1301187092) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _itemAddress = sc_0.loadAddress();
    return { $$type: 'BurnLicense' as const, queryId: _queryId, itemAddress: _itemAddress };
}

export function loadTupleBurnLicense(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _itemAddress = source.readAddress();
    return { $$type: 'BurnLicense' as const, queryId: _queryId, itemAddress: _itemAddress };
}

export function loadGetterTupleBurnLicense(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _itemAddress = source.readAddress();
    return { $$type: 'BurnLicense' as const, queryId: _queryId, itemAddress: _itemAddress };
}

export function storeTupleBurnLicense(source: BurnLicense) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeAddress(source.itemAddress);
    return builder.build();
}

export function dictValueParserBurnLicense(): DictionaryValue<BurnLicense> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeBurnLicense(src)).endCell());
        },
        parse: (src) => {
            return loadBurnLicense(src.loadRef().beginParse());
        }
    }
}

export type ChangeOwner = {
    $$type: 'ChangeOwner';
    queryId: bigint;
    newOwner: Address;
}

export function storeChangeOwner(src: ChangeOwner) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(1300990859, 32);
        b_0.storeUint(src.queryId, 64);
        b_0.storeAddress(src.newOwner);
    };
}

export function loadChangeOwner(slice: Slice) {
    const sc_0 = slice;
    if (sc_0.loadUint(32) !== 1300990859) { throw Error('Invalid prefix'); }
    const _queryId = sc_0.loadUintBig(64);
    const _newOwner = sc_0.loadAddress();
    return { $$type: 'ChangeOwner' as const, queryId: _queryId, newOwner: _newOwner };
}

export function loadTupleChangeOwner(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _newOwner = source.readAddress();
    return { $$type: 'ChangeOwner' as const, queryId: _queryId, newOwner: _newOwner };
}

export function loadGetterTupleChangeOwner(source: TupleReader) {
    const _queryId = source.readBigNumber();
    const _newOwner = source.readAddress();
    return { $$type: 'ChangeOwner' as const, queryId: _queryId, newOwner: _newOwner };
}

export function storeTupleChangeOwner(source: ChangeOwner) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.queryId);
    builder.writeAddress(source.newOwner);
    return builder.build();
}

export function dictValueParserChangeOwner(): DictionaryValue<ChangeOwner> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeChangeOwner(src)).endCell());
        },
        parse: (src) => {
            return loadChangeOwner(src.loadRef().beginParse());
        }
    }
}

export type AppCollection$Data = {
    $$type: 'AppCollection$Data';
    appId: bigint;
    ownerAddress: Address;
    nextItemIndex: bigint;
    collectionContent: Cell;
    commonContent: Cell;
}

export function storeAppCollection$Data(src: AppCollection$Data) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.appId, 256);
        b_0.storeAddress(src.ownerAddress);
        b_0.storeUint(src.nextItemIndex, 64);
        b_0.storeRef(src.collectionContent);
        b_0.storeRef(src.commonContent);
    };
}

export function loadAppCollection$Data(slice: Slice) {
    const sc_0 = slice;
    const _appId = sc_0.loadUintBig(256);
    const _ownerAddress = sc_0.loadAddress();
    const _nextItemIndex = sc_0.loadUintBig(64);
    const _collectionContent = sc_0.loadRef();
    const _commonContent = sc_0.loadRef();
    return { $$type: 'AppCollection$Data' as const, appId: _appId, ownerAddress: _ownerAddress, nextItemIndex: _nextItemIndex, collectionContent: _collectionContent, commonContent: _commonContent };
}

export function loadTupleAppCollection$Data(source: TupleReader) {
    const _appId = source.readBigNumber();
    const _ownerAddress = source.readAddress();
    const _nextItemIndex = source.readBigNumber();
    const _collectionContent = source.readCell();
    const _commonContent = source.readCell();
    return { $$type: 'AppCollection$Data' as const, appId: _appId, ownerAddress: _ownerAddress, nextItemIndex: _nextItemIndex, collectionContent: _collectionContent, commonContent: _commonContent };
}

export function loadGetterTupleAppCollection$Data(source: TupleReader) {
    const _appId = source.readBigNumber();
    const _ownerAddress = source.readAddress();
    const _nextItemIndex = source.readBigNumber();
    const _collectionContent = source.readCell();
    const _commonContent = source.readCell();
    return { $$type: 'AppCollection$Data' as const, appId: _appId, ownerAddress: _ownerAddress, nextItemIndex: _nextItemIndex, collectionContent: _collectionContent, commonContent: _commonContent };
}

export function storeTupleAppCollection$Data(source: AppCollection$Data) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.appId);
    builder.writeAddress(source.ownerAddress);
    builder.writeNumber(source.nextItemIndex);
    builder.writeCell(source.collectionContent);
    builder.writeCell(source.commonContent);
    return builder.build();
}

export function dictValueParserAppCollection$Data(): DictionaryValue<AppCollection$Data> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeAppCollection$Data(src)).endCell());
        },
        parse: (src) => {
            return loadAppCollection$Data(src.loadRef().beginParse());
        }
    }
}

export type CollectionData = {
    $$type: 'CollectionData';
    nextItemIndex: bigint;
    collectionContent: Cell;
    owner: Address;
}

export function storeCollectionData(src: CollectionData) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeUint(src.nextItemIndex, 64);
        b_0.storeRef(src.collectionContent);
        b_0.storeAddress(src.owner);
    };
}

export function loadCollectionData(slice: Slice) {
    const sc_0 = slice;
    const _nextItemIndex = sc_0.loadUintBig(64);
    const _collectionContent = sc_0.loadRef();
    const _owner = sc_0.loadAddress();
    return { $$type: 'CollectionData' as const, nextItemIndex: _nextItemIndex, collectionContent: _collectionContent, owner: _owner };
}

export function loadTupleCollectionData(source: TupleReader) {
    const _nextItemIndex = source.readBigNumber();
    const _collectionContent = source.readCell();
    const _owner = source.readAddress();
    return { $$type: 'CollectionData' as const, nextItemIndex: _nextItemIndex, collectionContent: _collectionContent, owner: _owner };
}

export function loadGetterTupleCollectionData(source: TupleReader) {
    const _nextItemIndex = source.readBigNumber();
    const _collectionContent = source.readCell();
    const _owner = source.readAddress();
    return { $$type: 'CollectionData' as const, nextItemIndex: _nextItemIndex, collectionContent: _collectionContent, owner: _owner };
}

export function storeTupleCollectionData(source: CollectionData) {
    const builder = new TupleBuilder();
    builder.writeNumber(source.nextItemIndex);
    builder.writeCell(source.collectionContent);
    builder.writeAddress(source.owner);
    return builder.build();
}

export function dictValueParserCollectionData(): DictionaryValue<CollectionData> {
    return {
        serialize: (src, builder) => {
            builder.storeRef(beginCell().store(storeCollectionData(src)).endCell());
        },
        parse: (src) => {
            return loadCollectionData(src.loadRef().beginParse());
        }
    }
}

 type LicenseItem_init_args = {
    $$type: 'LicenseItem_init_args';
    index: bigint;
    collection: Address;
    ownerAddress: Address;
    escrowAddress: Address;
    transferLimit: bigint;
    content: Cell;
    burnDeadline: bigint;
}

function initLicenseItem_init_args(src: LicenseItem_init_args) {
    return (builder: Builder) => {
        const b_0 = builder;
        b_0.storeInt(src.index, 257);
        b_0.storeAddress(src.collection);
        b_0.storeAddress(src.ownerAddress);
        const b_1 = new Builder();
        b_1.storeAddress(src.escrowAddress);
        b_1.storeInt(src.transferLimit, 257);
        b_1.storeRef(src.content);
        b_1.storeInt(src.burnDeadline, 257);
        b_0.storeRef(b_1.endCell());
    };
}

async function LicenseItem_init(index: bigint, collection: Address, ownerAddress: Address, escrowAddress: Address, transferLimit: bigint, content: Cell, burnDeadline: bigint) {
    const __code = Cell.fromHex('b5ee9c7241021701000510000114ff00f4a413f4bcf2c80b01020162020c02f6d001d072d721d200d200fa4021103450666f04f86102f862ed44d0d200018e1bd3fffa40fa40d401d0fa40d307d307d4d31f301058105710566c188e26810101d700fa40fa40d401d0fa40810101d700d4810101d7003010471046104507d155057059e209925f09e007d70d1ff2e0822182105fcc3d14bae30221030602fe31d33ffa40fa40f40431fa0082009058f8422ac705f2f481750c5367b9f2f42306a422c2009410396c41e30d7080427004c8018210d53276db58cb1fcb3fc9104841301810246d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0010571046040500a671705447c4c85520821005138d915004cb1f12cb3fcecec910451a10246d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00050048443512c87f01ca0055705078cbff15ce13ce01c8ce12cb0712cb0712cc12cb1fcdc9ed5402f88210595f07bcba8ef15b8200ea52f84226c705f2f4708100a0708827553010246d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0010575514c87f01ca0055705078cbff15ce13ce01c8ce12cb0712cb0712cc12cb1fcdc9ed54e02107080024000000004c6963656e7365206275726e656403f482107a1b3c5dba8ee55b815427f84225c705f2f481586cf82329bbf2f4708040706f00c8013082107e08321501cb1fc926553010246d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb0010575514e02182102fcb26a2bae302010a090b01c031d33f30f842708040705434a9c8552082108b7717355004cb1f12cb3fcbffcec91034413010246d50436d03c8cf8580ca00cf8440ce01fa028069cf40025c6e016eb0935bcf819d58cf8680cf8480f400f400cf81e2f400c901fb00105755140a0042c87f01ca0055705078cbff15ce13ce01c8ce12cb0712cb0712cc12cb1fcdc9ed5400de8210946a98b6ba8e60d33f30c8018210aff90f5758cb1fcb3fc91068105710461035443012f84270705003804201503304c8cf8580ca00cf8440ce01fa02806acf40f400c901fb00c87f01ca0055705078cbff15ce13ce01c8ce12cb0712cb0712cc12cb1fcdc9ed54e05f09f2c0820201200d150201200e1001a5ba853ed44d0d200018e1bd3fffa40fa40d401d0fa40d307d307d4d31f301058105710566c188e26810101d700fa40fa40d401d0fa40810101d700d4810101d7003010471046104507d155057059e2db3c6c8180f000224020120111301a5b5fd1da89a1a400031c37a7fff481f481a803a1f481a60fa60fa9a63e6020b020ae20acd8311c4d020203ae01f481f481a803a1f481020203ae01a9020203ae0060208e208c208a0fa2aa0ae0b3c5b678d90301200022001a5b5e1bda89a1a400031c37a7fff481f481a803a1f481a60fa60fa9a63e6020b020ae20acd8311c4d020203ae01f481f481a803a1f481020203ae01a9020203ae0060208e208c208a0fa2aa0ae0b3c5b678d90501400025d01a5bc7e7f6a268690000c70de9fffd207d206a00e87d206983e983ea698f98082c082b882b360c4713408080eb807d207d206a00e87d20408080eb806a408080eb801808238823082283e8aa82b82cf16d9e3642c16000a7f54787625b79de466');
    const builder = beginCell();
    builder.storeUint(0, 1);
    initLicenseItem_init_args({ $$type: 'LicenseItem_init_args', index, collection, ownerAddress, escrowAddress, transferLimit, content, burnDeadline })(builder);
    const __data = builder.endCell();
    return { code: __code, data: __data };
}

export const LicenseItem_errors = {
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
    21543: { message: "Only owner can burn" },
    22636: { message: "Trial window closed" },
    29964: { message: "Soulbound or transfer limit exhausted" },
    36952: { message: "Only owner can transfer" },
    37629: { message: "Insufficient gas for mint" },
    49958: { message: "Only current owner can rotate" },
    57323: { message: "Only collection owner can mint" },
    58313: { message: "Only collection owner can burn" },
    59986: { message: "Only collection can burn" },
} as const

export const LicenseItem_errors_backward = {
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
    "Only owner can burn": 21543,
    "Trial window closed": 22636,
    "Soulbound or transfer limit exhausted": 29964,
    "Only owner can transfer": 36952,
    "Insufficient gas for mint": 37629,
    "Only current owner can rotate": 49958,
    "Only collection owner can mint": 57323,
    "Only collection owner can burn": 58313,
    "Only collection can burn": 59986,
} as const

const LicenseItem_types: ABIType[] = [
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
    {"name":"Transfer","header":1607220500,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"newOwner","type":{"kind":"simple","type":"address","optional":false}},{"name":"responseTo","type":{"kind":"simple","type":"address","optional":false}},{"name":"customPayload","type":{"kind":"simple","type":"cell","optional":true}},{"name":"forwardAmount","type":{"kind":"simple","type":"uint","optional":false,"format":"coins"}},{"name":"forwardPayload","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"Burn","header":1499400124,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"GetStaticData","header":801842850,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"ReportStaticData","header":2339837749,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"index","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"collection","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"OwnerAssigned","header":85167505,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"prevOwner","type":{"kind":"simple","type":"address","optional":false}},{"name":"forwardPayload","type":{"kind":"simple","type":"slice","optional":false,"format":"remainder"}}]},
    {"name":"Excesses","header":3576854235,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"BuyerBurn","header":2048605277,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}}]},
    {"name":"RefundOnBurn","header":2114466325,"fields":[]},
    {"name":"LicenseItem$Data","header":null,"fields":[{"name":"index","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"collection","type":{"kind":"simple","type":"address","optional":false}},{"name":"ownerAddress","type":{"kind":"simple","type":"address","optional":false}},{"name":"escrowAddress","type":{"kind":"simple","type":"address","optional":false}},{"name":"transferLimit","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"transfers","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"content","type":{"kind":"simple","type":"cell","optional":false}},{"name":"burnDeadline","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"NftData","header":null,"fields":[{"name":"init","type":{"kind":"simple","type":"bool","optional":false}},{"name":"index","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"collection","type":{"kind":"simple","type":"address","optional":false}},{"name":"owner","type":{"kind":"simple","type":"address","optional":false}},{"name":"content","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"SoulboundInfo","header":null,"fields":[{"name":"transferLimit","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"transfers","type":{"kind":"simple","type":"uint","optional":false,"format":8}}]},
    {"name":"MintLicense","header":1782229524,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"buyerAddress","type":{"kind":"simple","type":"address","optional":false}},{"name":"escrowAddress","type":{"kind":"simple","type":"address","optional":false}},{"name":"transferLimit","type":{"kind":"simple","type":"uint","optional":false,"format":8}},{"name":"individualContent","type":{"kind":"simple","type":"cell","optional":false}},{"name":"burnDeadline","type":{"kind":"simple","type":"uint","optional":false,"format":32}}]},
    {"name":"BurnLicense","header":1301187092,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"itemAddress","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"ChangeOwner","header":1300990859,"fields":[{"name":"queryId","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"newOwner","type":{"kind":"simple","type":"address","optional":false}}]},
    {"name":"AppCollection$Data","header":null,"fields":[{"name":"appId","type":{"kind":"simple","type":"uint","optional":false,"format":256}},{"name":"ownerAddress","type":{"kind":"simple","type":"address","optional":false}},{"name":"nextItemIndex","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"collectionContent","type":{"kind":"simple","type":"cell","optional":false}},{"name":"commonContent","type":{"kind":"simple","type":"cell","optional":false}}]},
    {"name":"CollectionData","header":null,"fields":[{"name":"nextItemIndex","type":{"kind":"simple","type":"uint","optional":false,"format":64}},{"name":"collectionContent","type":{"kind":"simple","type":"cell","optional":false}},{"name":"owner","type":{"kind":"simple","type":"address","optional":false}}]},
]

const LicenseItem_opcodes = {
    "Deploy": 2490013878,
    "DeployOk": 2952335191,
    "FactoryDeploy": 1829761339,
    "Transfer": 1607220500,
    "Burn": 1499400124,
    "GetStaticData": 801842850,
    "ReportStaticData": 2339837749,
    "OwnerAssigned": 85167505,
    "Excesses": 3576854235,
    "BuyerBurn": 2048605277,
    "RefundOnBurn": 2114466325,
    "MintLicense": 1782229524,
    "BurnLicense": 1301187092,
    "ChangeOwner": 1300990859,
}

const LicenseItem_getters: ABIGetter[] = [
    {"name":"get_nft_data","methodId":102351,"arguments":[],"returnType":{"kind":"simple","type":"NftData","optional":false}},
    {"name":"escrow_address","methodId":75859,"arguments":[],"returnType":{"kind":"simple","type":"address","optional":false}},
    {"name":"soulbound_info","methodId":93965,"arguments":[],"returnType":{"kind":"simple","type":"SoulboundInfo","optional":false}},
    {"name":"burn_deadline","methodId":85992,"arguments":[],"returnType":{"kind":"simple","type":"int","optional":false,"format":257}},
]

export const LicenseItem_getterMapping: { [key: string]: string } = {
    'get_nft_data': 'getGetNftData',
    'escrow_address': 'getEscrowAddress',
    'soulbound_info': 'getSoulboundInfo',
    'burn_deadline': 'getBurnDeadline',
}

const LicenseItem_receivers: ABIReceiver[] = [
    {"receiver":"internal","message":{"kind":"typed","type":"Transfer"}},
    {"receiver":"internal","message":{"kind":"typed","type":"Burn"}},
    {"receiver":"internal","message":{"kind":"typed","type":"BuyerBurn"}},
    {"receiver":"internal","message":{"kind":"typed","type":"GetStaticData"}},
    {"receiver":"internal","message":{"kind":"typed","type":"Deploy"}},
]


export class LicenseItem implements Contract {
    
    public static readonly storageReserve = 0n;
    public static readonly errors = LicenseItem_errors_backward;
    public static readonly opcodes = LicenseItem_opcodes;
    
    static async init(index: bigint, collection: Address, ownerAddress: Address, escrowAddress: Address, transferLimit: bigint, content: Cell, burnDeadline: bigint) {
        return await LicenseItem_init(index, collection, ownerAddress, escrowAddress, transferLimit, content, burnDeadline);
    }
    
    static async fromInit(index: bigint, collection: Address, ownerAddress: Address, escrowAddress: Address, transferLimit: bigint, content: Cell, burnDeadline: bigint) {
        const __gen_init = await LicenseItem_init(index, collection, ownerAddress, escrowAddress, transferLimit, content, burnDeadline);
        const address = contractAddress(0, __gen_init);
        return new LicenseItem(address, __gen_init);
    }
    
    static fromAddress(address: Address) {
        return new LicenseItem(address);
    }
    
    readonly address: Address; 
    readonly init?: { code: Cell, data: Cell };
    readonly abi: ContractABI = {
        types:  LicenseItem_types,
        getters: LicenseItem_getters,
        receivers: LicenseItem_receivers,
        errors: LicenseItem_errors,
    };
    
    constructor(address: Address, init?: { code: Cell, data: Cell }) {
        this.address = address;
        this.init = init;
    }
    
    async send(provider: ContractProvider, via: Sender, args: { value: bigint, bounce?: boolean| null | undefined }, message: Transfer | Burn | BuyerBurn | GetStaticData | Deploy) {
        
        let body: Cell | null = null;
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'Transfer') {
            body = beginCell().store(storeTransfer(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'Burn') {
            body = beginCell().store(storeBurn(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'BuyerBurn') {
            body = beginCell().store(storeBuyerBurn(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'GetStaticData') {
            body = beginCell().store(storeGetStaticData(message)).endCell();
        }
        if (message && typeof message === 'object' && !(message instanceof Slice) && message.$$type === 'Deploy') {
            body = beginCell().store(storeDeploy(message)).endCell();
        }
        if (body === null) { throw new Error('Invalid message type'); }
        
        await provider.internal(via, { ...args, body: body });
        
    }
    
    async getGetNftData(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('get_nft_data', builder.build())).stack;
        const result = loadGetterTupleNftData(source);
        return result;
    }
    
    async getEscrowAddress(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('escrow_address', builder.build())).stack;
        const result = source.readAddress();
        return result;
    }
    
    async getSoulboundInfo(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('soulbound_info', builder.build())).stack;
        const result = loadGetterTupleSoulboundInfo(source);
        return result;
    }
    
    async getBurnDeadline(provider: ContractProvider) {
        const builder = new TupleBuilder();
        const source = (await provider.get('burn_deadline', builder.build())).stack;
        const result = source.readBigNumber();
        return result;
    }
    
}