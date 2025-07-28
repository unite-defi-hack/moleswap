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
import { OrderConfig } from './types';

export type DstEscrowConfig = {
    lop_address: Address;
    order_hash: bigint;
};

export function dstEscrowConfigToCell(config: DstEscrowConfig): Cell {
    return beginCell().storeAddress(config.lop_address).storeUint(config.order_hash, 256).endCell();
}

export class DstEscrow implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new DstEscrow(address);
    }

    static createFromConfig(config: DstEscrowConfig, code: Cell, workchain = 0) {
        const data = dstEscrowConfigToCell(config);
        const init = { code, data };
        return new DstEscrow(contractAddress(workchain, init), init);
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
        order: OrderConfig,
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
                        .storeUint(order.maker_address as bigint, 256)
                        .storeUint(order.maker_asset as bigint, 256)
                        .storeUint(order.making_amount, 128)
                        .storeAddress(order.receiver_address as Address)
                        .endCell(),
                )
                .storeRef(
                    beginCell()
                        .storeAddress(order.taker_address as Address)
                        .storeAddress(order.taker_asset as Address)
                        .storeCoins(order.taking_amount)
                        .endCell(),
                )
                .endCell(),
        });
    }

    async sendWithdraw(
        provider: ContractProvider,
        via: Sender,
        secret: bigint,
        query_id: number = 0,
        value: bigint = toNano('0.05'),
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(EscrowOp.withdraw, 32).storeUint(query_id, 64).storeUint(secret, 256).endCell(),
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
            makerAddress: result.stack.readBigNumber(),
            makerAssetAddress: result.stack.readBigNumber(),
            makerAssetAmount: result.stack.readBigNumber(),
            receiverAddress: result.stack.readAddress(),
            takerAddress: result.stack.readAddress(),
            takerAssetAddress: result.stack.readAddress(),
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

    readStringOrAddress(stack: TupleReader) {
        try {
            return stack.readAddress();
        } catch (e) {
            return '';
        }
    }
}
