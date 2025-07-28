import { readFileSync } from 'fs';
import { join } from 'path';
import { ethers } from 'ethers';
import { Address } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { LimitOrderProtocol } from '../wrappers/LimitOrderProtocol';
import { ethAddressToBigInt, generateRandomBigInt } from '../wrappers/utils';
import { OrderConfig } from '../wrappers/types';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const lopAddress = await ui.input('Enter LOP address:');
    const lopSC = provider.open(LimitOrderProtocol.createFromAddress(Address.parse(lopAddress)));

    const secret = generateRandomBigInt();
    const hashKey = ethers.keccak256(ethers.toBeHex(secret));
    ui.write(`User secret: ${secret}`);
    ui.write(`Hash key: ${hashKey}`);

    const orderJsonPath = join(__dirname, 'tonEthOrder.json');
    const order = await parseOrder(orderJsonPath);
    order.hashlock = BigInt(hashKey);

    await lopSC.sendCreateOrder(provider.sender(), order);

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
    };
}
