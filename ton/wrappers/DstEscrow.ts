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
} from '@ton/core';

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

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async getEscrowData(provider: ContractProvider) {
        const result = await provider.get('get_escrow_data', []);
        return {
            orderHash: result.stack.readNumber(),
            hashlock: result.stack.readNumber(),
            creationTime: result.stack.readNumber(),
            expirationTime: result.stack.readNumber(),
            makerAddress: result.stack.readAddress(),
            makerAssetAddress: result.stack.readAddress(),
            makerAssetAmount: result.stack.readBigNumber(),
            receiverAddress: result.stack.readAddress(),
            takerAssetAddress: result.stack.readAddress(),
            takerAssetAmount: result.stack.readBigNumber(),
            takerAddress: result.stack.readAddress(),
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
