import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
    TupleReader,
    toNano,
} from '@ton/core';
import { EscrowOp } from './opcodes';

export type SrcEscrowConfig = {
    lop_address: Address;
    order_hash: bigint;
};

export type SrcOrderConfig = {
    order_hash: bigint;
    hashlock: bigint;
    creation_time: number;
    expiration_time: number;
    maker_address: Address;
    maker_asset: Address;
    making_amount: bigint;
    receiver_address: bigint;
    taker_asset: bigint;
    taking_amount: bigint;
};

export function srcEscrowConfigToCell(config: SrcEscrowConfig): Cell {
    return beginCell().storeAddress(config.lop_address).storeUint(config.order_hash, 256).endCell();
}

export class SrcEscrow implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new SrcEscrow(address);
    }

    static createFromConfig(config: SrcEscrowConfig, code: Cell, workchain = 0) {
        const data = srcEscrowConfigToCell(config);
        const init = { code, data };
        return new SrcEscrow(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint = toNano('0.05')) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendCreate(
        provider: ContractProvider,
        via: Sender,
        order: SrcOrderConfig,
        query_id: number = 0,
        value: bigint = toNano('0.05'),
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(EscrowOp.create, 32)
                .storeUint(query_id, 64)
                .storeUint(order.hashlock, 256)
                .storeUint(order.creation_time, 32)
                .storeUint(order.expiration_time, 32)
                .storeRef(
                    beginCell()
                        .storeAddress(order.maker_address)
                        .storeAddress(order.maker_asset)
                        .storeCoins(order.making_amount)
                        .storeUint(order.receiver_address, 256)
                        .endCell(),
                )
                .storeRef(beginCell().storeUint(order.taker_asset, 256).storeUint(order.taking_amount, 128).endCell())
                .endCell(),
        });
    }

    async getEscrowData(provider: ContractProvider) {
        const result = await provider.get('get_escrow_data', []);
        return {
            lopAddress: result.stack.readAddress(),
            orderHash: result.stack.readBigNumber(),
            hashlock: result.stack.readBigNumber(),
            creationTime: result.stack.readNumber(),
            expirationTime: result.stack.readNumber(),
            makerAddress: result.stack.readAddress(),
            makerAssetAddress: result.stack.readAddress(),
            makerAssetAmount: result.stack.readBigNumber(),
            receiverAddress: result.stack.readBigNumber(),
            takerAssetAddress: result.stack.readBigNumber(),
            takerAssetAmount: result.stack.readBigNumber(),
        };
    }

    async getSecretValid(provider: ContractProvider, secret: bigint) {
        const res = await provider.get('get_secret_valid', [
            {
                type: 'int',
                value: secret,
            },
        ]);

        return res.stack.readNumber();
    }

    async getHash(provider: ContractProvider, secret: bigint) {
        const res = await provider.get('get_hash', [
            {
                type: 'int',
                value: secret,
            },
        ]);
        return res.stack.readBigNumber();
    }
}
