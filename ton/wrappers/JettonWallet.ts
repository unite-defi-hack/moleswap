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

    async getWalletData(provider: ContractProvider) {
        let state = await provider.getState();
        if (state.state.type !== 'active') {
            throw Error('Wallet is not active');
        }
        let res = await provider.get('get_wallet_data', []);
        return {
            balance: res.stack.readBigNumber(),
            ownerAddress: res.stack.readAddress(),
            jettonMasterAddress: res.stack.readAddress(),
        };
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
        lopAddr: Address,
        value: bigint = toNano(0.25),
        fwdValue: bigint = toNano(0.15),
        queryId: number = 0,
    ) {
        if (!via.address) {
            throw Error('Sender address is not defined');
        }
        const fwdMsg = beginCell()
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
            .storeRef(
                beginCell()
                    .storeAddress(order.asset_jetton_address as Address)
                    .endCell(),
            )
            .endCell();

        return await this.sendTransfer(
            provider,
            via,
            value,
            order.making_amount,
            lopAddr,
            via.address,
            null,
            fwdValue,
            fwdMsg,
        );
    }

    async sendFillOrder(
        provider: ContractProvider,
        via: Sender,
        order: OrderConfig,
        lopAddr: Address,
        value: bigint = toNano(0.25),
        fwdValue: bigint = toNano(0.18),
        queryId: number = 0,
    ) {
        if (!via.address) {
            throw Error('Sender address is not defined');
        }
        const fwdMsg = beginCell()
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
                    .storeUint(order.salt, 256)
                    .storeUint(order.hashlock, 256)
                    .storeUint(order.creation_time, 32)
                    .storeUint(order.expiration_time, 32)
                    .endCell(),
            )
            .storeRef(
                beginCell()
                    .storeAddress(order.asset_jetton_address as Address)
                    .endCell(),
            )
            .endCell();

        return await this.sendTransfer(
            provider,
            via,
            value,
            order.taking_amount,
            lopAddr,
            via.address,
            null,
            fwdValue,
            fwdMsg,
        );
    }
}
