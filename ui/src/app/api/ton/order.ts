import { Asset } from '@/app/assets';
import { Address, beginCell, toNano } from '@ton/core';
import { CHAIN, TonConnectUI } from '@tonconnect/ui-react';
import { ethers } from 'ethers';
import { generateRandomBigInt, ethAddressToBigInt, crc32 } from '../utils';

const ESCROW_FACTORY = Address.parse('kQAU6TikP2x2EX35n1o1EV7TRRYBlUzUCwPmpz7wAt8NI3wo');

export const createOrder = async (
    tonConnect: TonConnectUI,
    fromAsset: Asset,
    fromAmount: number,
    toAsset: Asset,
    toAmount: number,
    toAddress: string,
) => {
    const orderId = 1;
    const queryId = Date.now();
    const secret = generateRandomBigInt();
    const hashKey = ethers.keccak256(ethers.toBeHex(secret));

    console.log('send create order...');
    await tonConnect.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes from now
        messages: [
            {
                amount: (toNano(0.05) + toNano(fromAmount)).toString(),
                address: ESCROW_FACTORY.toString(),
                payload: beginCell()
                    .storeUint(crc32('create_order'), 32)
                    .storeUint(queryId, 64)
                    .storeUint(orderId, 32)
                    .storeCoins(toNano(fromAmount))
                    .storeRef(
                        beginCell()
                            .storeUint(toAsset.network, 8)
                            .storeUint(ethAddressToBigInt(toAsset.tokenAddress), 256)
                            .storeUint(ethAddressToBigInt(toAddress), 256)
                            .storeUint(toAmount, 128)
                            .endCell(),
                    )
                    .storeUint(BigInt(hashKey), 256)
                    .endCell()
                    .toBoc()
                    .toString('base64'),
            },
        ],
    });
};