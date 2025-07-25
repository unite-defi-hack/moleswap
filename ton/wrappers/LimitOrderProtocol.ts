import {Address, beginCell, Cell, Contract, contractAddress} from "@ton/core";

export type EscrowFactoryConfig = {
    admin: Address;
    escrowCode: Cell;
};

export function escrowFactoryConfigToCell(config: EscrowFactoryConfig): Cell {
    return beginCell()
        .storeAddress(config.admin)
        .storeRef(config.escrowCode)
        .endCell();
}

export class LimitOrderProtocol implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {
    }

    static createFromAddress(address: Address) {
        return new LimitOrderProtocol(address);
    }

    static createFromConfig(config: EscrowFactoryConfig, code: Cell, workchain = 0) {
        const data = escrowFactoryConfigToCell(config);
        const init = {code, data};
        return new LimitOrderProtocol(contractAddress(workchain, init), init);
    }
}