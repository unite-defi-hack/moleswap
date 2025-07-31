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
import { JettonOp, LopOp } from './opcodes';
import { OrderConfig } from './types';

export type JettonWalletConfig = {};

export function jettonWalletConfigToCell(config: JettonWalletConfig): Cell {
    return beginCell().endCell();
}

export class JettonWallet implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell },
    ) {}

    static createFromAddress(address: Address) {
        return new JettonWallet(address);
    }

    static createFromConfig(config: JettonWalletConfig, code: Cell, workchain = 0) {
        const data = jettonWalletConfigToCell(config);
        const init = { code, data };
        return new JettonWallet(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async getJettonBalance(provider: ContractProvider) {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            return 0n;
        }
        let res = await provider.get('get_wallet_data', []);
        return res.stack.readBigNumber();
    }

    static transferMessage(
        jetton_amount: bigint,
        to: Address,
        responseAddress: Address,
        customPayload: Cell | null,
        forward_ton_amount: bigint,
        forwardPayload: Cell | null,
    ) {
        return beginCell()
            .storeUint(JettonOp.transfer, 32)
            .storeUint(0, 64) // queryId
            .storeCoins(jetton_amount)
            .storeAddress(to)
            .storeAddress(responseAddress)
            .storeMaybeRef(customPayload)
            .storeCoins(forward_ton_amount)
            .storeMaybeRef(forwardPayload)
            .endCell();
    }

    async sendTransfer(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        jetton_amount: bigint,
        to: Address,
        responseAddress: Address,
        customPayload: Cell | null,
        forward_ton_amount: bigint,
        forwardPayload: Cell | null,
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonWallet.transferMessage(
                jetton_amount,
                to,
                responseAddress,
                customPayload,
                forward_ton_amount,
                forwardPayload,
            ),
            value: value,
        });
    }

    async sendCreateOrder(
        provider: ContractProvider,
        via: Sender,
        order: OrderConfig,
        walletAddr: Address,
        value: bigint = toNano(0.2),
        fwdValue: bigint = toNano(0.15),
    ) {
        if (!via.address) {
            throw Error('Sender address is not defined');
        }
        return await this.sendTransfer(
            provider,
            via,
            value,
            order.making_amount,
            walletAddr,
            via.address,
            beginCell().endCell(),
            fwdValue,
            beginCell().storeUint(LopOp.create_order, 32).endCell(),
        );
    }
}
