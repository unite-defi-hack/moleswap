import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import { Op } from './opcodes';

export type EscrowFactoryConfig = {
    admin: Address;
    srcEscrowCode: Cell;
    dstEscrowCode: Cell;
};

export function escrowFactoryConfigToCell(config: EscrowFactoryConfig): Cell {
    return beginCell()
        .storeAddress(config.admin)
        .storeRef(config.srcEscrowCode)
        .storeRef(config.dstEscrowCode)
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

    static createFromConfig(config: EscrowFactoryConfig, code: Cell, workchain = 0) {
        const data = escrowFactoryConfigToCell(config);
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
        opts: {
            value: bigint;
            queryId: number;
            makerAddress: Address;
            makerAsset: Address;
            makingAmount: bigint;
            receiverAddress: bigint;
            takerAsset: bigint;
            takingAmount: bigint;
            salt: bigint;
            hashlock: bigint;
            expirationTime: bigint;
        },
    ) {
        return await provider.internal(via, {
            value: opts.value + opts.makingAmount,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Op.create_order, 32)
                .storeUint(opts.queryId, 64)
                .storeAddress(opts.makerAddress)
                .storeAddress(opts.makerAsset)
                .storeUint(opts.makingAmount, 128)
                .storeUint(opts.receiverAddress, 256)
                .storeRef(
                    beginCell()
                        .storeUint(opts.takerAsset, 256)
                        .storeUint(opts.takingAmount, 128)
                        .storeUint(opts.salt, 128)
                        .storeUint(opts.hashlock, 256)
                        .storeUint(opts.expirationTime, 64)
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
}
