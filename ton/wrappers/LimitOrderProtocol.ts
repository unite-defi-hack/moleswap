import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
    toNano,
} from '@ton/core';
import { LopOp } from './opcodes';
import { OrderConfig, TimelocksConfig } from './types';

export type LimitOrderProtocolConfig = {
    admin: Address;
    srcEscrowCode: Cell;
    dstEscrowCode: Cell;
    timelocks: TimelocksConfig;
};

export function limitOrderProtocolConfigToCell(config: LimitOrderProtocolConfig): Cell {
    return beginCell()
        .storeAddress(config.admin)
        .storeRef(config.srcEscrowCode)
        .storeRef(config.dstEscrowCode)
        .storeUint(config.timelocks.srcWithdrawal, 32)
        .storeUint(config.timelocks.srcPublicWithdrawal, 32)
        .storeUint(config.timelocks.srcCancellation, 32)
        .storeUint(config.timelocks.srcPublicCancellation, 32)
        .storeUint(config.timelocks.dstWithdrawal, 32)
        .storeUint(config.timelocks.dstPublicWithdrawal, 32)
        .storeUint(config.timelocks.dstCancellation, 32)
        .endCell();
}

export class LimitOrderProtocol implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new LimitOrderProtocol(address);
    }

    static createFromConfig(config: LimitOrderProtocolConfig, code: Cell, workchain = 0) {
        const data = limitOrderProtocolConfigToCell(config);
        const init = { code, data };
        return new LimitOrderProtocol(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendCreateOrder(
        provider: ContractProvider,
        via: Sender,
        order: OrderConfig,
        value: bigint = toNano(0.08),
        queryId: number = 0,
    ) {
        return await provider.internal(via, {
            value: value + order.making_amount,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(LopOp.create_order, 32)
                .storeUint(queryId, 64)
                .storeAddress(order.maker_address as Address)
                .storeAddress(order.maker_asset as Address)
                .storeCoins(order.making_amount)
                .storeUint(order.receiver_address as bigint, 256)
                .storeRef(
                    beginCell()
                        .storeUint(order.taker_asset as bigint, 256)
                        .storeUint(order.taking_amount, 128)
                        .storeUint(order.salt!!, 256)
                        .storeUint(order.hashlock, 256)
                        .storeUint(order.creation_time, 32)
                        .storeUint(order.expiration_time, 32)
                        .endCell(),
                )
                .endCell(),
        });
    }

    async sendFillOrder(
        provider: ContractProvider,
        via: Sender,
        order: OrderConfig,
        value: bigint = toNano(0.2),
        queryId: number = 0,
    ) {
        return await provider.internal(via, {
            value: value + order.taking_amount,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(LopOp.fill_order, 32)
                .storeUint(queryId, 64)
                .storeUint(order.maker_address as bigint, 256)
                .storeUint(order.maker_asset as bigint, 256)
                .storeUint(order.making_amount, 128)
                .storeAddress(order.receiver_address as Address)
                .storeRef(
                    beginCell()
                        .storeAddress(order.taker_address as Address)
                        .storeAddress(order.taker_asset as Address)
                        .storeCoins(order.taking_amount)
                        .endCell(),
                )
                .storeRef(
                    beginCell()
                        .storeUint(order.order_hash!!, 256)
                        .storeUint(order.hashlock, 256)
                        .storeUint(order.creation_time, 32)
                        .storeUint(order.expiration_time, 32)
                        .endCell(),
                )
                .endCell(),
        });
    }

    async getSrcEscrowAddress(provider: ContractProvider, orderHash: bigint) {
        const result = await provider.get('get_src_escrow_address', [
            {
                type: 'int',
                value: orderHash,
            },
        ]);
        return result.stack.readAddress();
    }

    async getDstEscrowAddress(provider: ContractProvider, orderHash: bigint) {
        const result = await provider.get('get_dst_escrow_address', [
            {
                type: 'int',
                value: orderHash,
            },
        ]);
        return result.stack.readAddress();
    }

    async calculateOrderHash(order: OrderConfig): Promise<bigint> {
        const orderData = beginCell()
            .storeAddress(order.maker_address as Address)
            .storeAddress(order.maker_asset as Address)
            .storeCoins(order.making_amount)
            .storeUint(order.receiver_address as bigint, 256)
            .storeRef(
                beginCell()
                    .storeUint(order.taker_asset as bigint, 256)
                    .storeUint(order.taking_amount, 128)
                    .endCell(),
            )
            .storeRef(
                beginCell()
                    .storeUint(order.hashlock, 256)
                    .storeUint(order.salt!!, 256)
                    .storeUint(order.creation_time, 32)
                    .storeUint(order.expiration_time, 32)
                    .endCell(),
            )
            .endCell();
        return BigInt('0x' + orderData.hash().toString('hex'));
    }
}
