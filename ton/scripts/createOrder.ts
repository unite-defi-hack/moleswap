import { readFileSync } from 'fs';
import { join } from 'path';
import { ethers } from 'ethers';
import { Address } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { LimitOrderProtocol } from '../wrappers/LimitOrderProtocol';
import { JettonWallet } from '../wrappers/JettonWallet';
import { JettonMinter } from '../wrappers/JettonMinter';
import { ethAddressToBigInt, generateRandomBigInt, HOLE_ADDRESS } from '../wrappers/utils';
import { OrderConfig } from '../wrappers/types';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const lopAddress = await ui.input('Enter LOP address:');
    const lopSC = provider.open(LimitOrderProtocol.createFromAddress(Address.parse(lopAddress)));

    const secret = generateRandomBigInt();
    const hashKey = ethers.keccak256(ethers.toBeHex(secret));
    ui.write(`User secret: ${secret}`);
    ui.write(`Hash key: ${hashKey}`);

    const orderJsonPath = join(__dirname, join('orders', 'tonEthOrder.json'));
    const order = parseOrder(orderJsonPath);
    order.hashlock = BigInt(hashKey);

    if (order.maker_asset.toString() === HOLE_ADDRESS.toString()) {
        await lopSC.sendCreateOrder(provider.sender(), order);
    } else {
        const lopJetton = provider.open(JettonWallet.createFromAddress(order.maker_asset as Address));
        const { jettonMasterAddress } = await lopJetton.getWalletData();
        const jettonMinter = provider.open(JettonMinter.createFromAddress(jettonMasterAddress));
        const jettonWalletAddr = await jettonMinter.getWalletAddress(provider.sender().address as Address);
        const jettonWallet = provider.open(JettonWallet.createFromAddress(jettonWalletAddr));

        const orderHash = LimitOrderProtocol.calculateSrcOrderHash(order);
        const srcEscrowAddress = await lopSC.getSrcEscrowAddress(orderHash);
        order.asset_jetton_address = await jettonMinter.getWalletAddress(srcEscrowAddress);

        await jettonWallet.sendCreateOrder(provider.sender(), order, lopSC.address);
    }

    ui.write('Order creation transaction was sent...');
}

function parseOrder(orderJsonPath: string): OrderConfig {
    const jsonData = JSON.parse(readFileSync(orderJsonPath, 'utf-8'));

    return {
        maker_address: Address.parse(jsonData.maker_address),
        maker_asset: Address.parse(jsonData.maker_asset),
        making_amount: BigInt(jsonData.making_amount),
        receiver_address: ethAddressToBigInt(jsonData.receiver_address),
        taker_asset: ethAddressToBigInt(jsonData.taker_asset),
        taking_amount: BigInt(jsonData.taking_amount),
        salt: BigInt(jsonData.salt),
        creation_time: Math.floor(new Date(jsonData.creation_time).getTime() / 1000),
        expiration_time: Math.floor(new Date(jsonData.expiration_time).getTime() / 1000),
        hashlock: BigInt(0),
        asset_jetton_address: HOLE_ADDRESS,
    };
}
