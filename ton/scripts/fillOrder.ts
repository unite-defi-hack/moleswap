import { readFileSync } from 'fs';
import { join } from 'path';
import { Address } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { LimitOrderProtocol } from '../wrappers/LimitOrderProtocol';
import { JettonWallet } from '../wrappers/JettonWallet';
import { JettonMinter } from '../wrappers/JettonMinter';
import { ethAddressToBigInt, HOLE_ADDRESS } from '../wrappers/utils';
import { OrderConfig } from '../wrappers/types';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const lopAddress = await ui.input('Enter LOP address:');
    const lopSC = provider.open(LimitOrderProtocol.createFromAddress(Address.parse(lopAddress)));

    const orderJsonPath = join(__dirname, join('orders', 'ethTonOrder.json'));
    const order = parseOrder(orderJsonPath);

    if (order.taker_asset.toString() === HOLE_ADDRESS.toString()) {
        await lopSC.sendFillOrder(provider.sender(), order);
    } else {
        const lopJetton = provider.open(JettonWallet.createFromAddress(order.taker_asset as Address));
        const { jettonMasterAddress } = await lopJetton.getWalletData();
        const jettonMinter = provider.open(JettonMinter.createFromAddress(jettonMasterAddress));

        const jettonWalletAddr = await jettonMinter.getWalletAddress(provider.sender().address as Address);
        const jettonWallet = provider.open(JettonWallet.createFromAddress(jettonWalletAddr));

        await jettonWallet.sendFillOrder(provider.sender(), order, lopSC.address);
    }

    ui.write('Order fill transaction was sent...');
}

function parseOrder(orderJsonPath: string): OrderConfig {
    const jsonData = JSON.parse(readFileSync(orderJsonPath, 'utf-8'));

    return {
        maker_address: ethAddressToBigInt(jsonData.maker_address),
        maker_asset: ethAddressToBigInt(jsonData.maker_asset),
        making_amount: BigInt(jsonData.making_amount),
        receiver_address: Address.parse(jsonData.receiver_address),
        taker_address: Address.parse(jsonData.taker_address),
        taker_asset: Address.parse(jsonData.taker_asset),
        taking_amount: BigInt(jsonData.taking_amount),
        salt: BigInt(jsonData.salt),
        creation_time: Math.floor(new Date(jsonData.creation_time).getTime() / 1000),
        expiration_time: Math.floor(new Date(jsonData.expiration_time).getTime() / 1000),
        hashlock: BigInt(jsonData.hashlock!!),
    };
}
