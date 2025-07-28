import { readFileSync } from 'fs';
import { join } from 'path';
import { Address } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { LimitOrderProtocol } from '../wrappers/LimitOrderProtocol';
import { ethAddressToBigInt } from '../wrappers/utils';
import { OrderConfig } from '../wrappers/types';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const lopAddress = await ui.input('Enter LOP address:');
    const lopSC = provider.open(LimitOrderProtocol.createFromAddress(Address.parse(lopAddress)));

    const orderJsonPath = join(__dirname, 'ethTonOrder.json');
    const order = parseOrder(orderJsonPath);

    await lopSC.sendClaimOrder(provider.sender(), order);

    ui.write('Order claim transaction was sent...');
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
        hashlock: BigInt(jsonData.hashlock!!),
    };
}
