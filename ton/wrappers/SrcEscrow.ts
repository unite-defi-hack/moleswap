import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
} from '@ton/core';

export type DstEscrowConfig = {
    owner: Address;
    admin: Address;
    orderId: number | bigint;
    fromAmount?: number | bigint;
    toNetwork?: number | bigint;
    toAddress?: number | bigint;
    toAmount?: number | bigint;
};

export function dstEscrowConfigToCell(config: DstEscrowConfig): Cell {
    return (
        beginCell()
            .storeAddress(config.owner)
            .storeAddress(config.admin)
            .storeUint(config.orderId, 32)
            .endCell()
    );
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

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }
}
