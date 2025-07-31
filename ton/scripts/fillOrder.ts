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

    const orderJsonPath = join(__dirname, join('orders', 'ethTonOrder.json'));
    const order = parseOrder(orderJsonPath);

    await lopSC.sendFillOrder(provider.sender(), order);

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
        order_hash: BigInt(jsonData.order_hash),
        creation_time: Math.floor(new Date(jsonData.creation_time).getTime() / 1000),
        expiration_time: Math.floor(new Date(jsonData.expiration_time).getTime() / 1000),
        hashlock: BigInt(jsonData.hashlock!!),
    };
}
