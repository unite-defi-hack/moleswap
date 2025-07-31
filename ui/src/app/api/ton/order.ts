import { Asset } from '@/app/assets';
import { Address, beginCell, toNano } from '@ton/core';
import { CHAIN, TonConnectUI } from '@tonconnect/ui-react';
import { ethers } from 'ethers';
import {
    Address as InchAddress,
    HashLock,
    TimeLocks,
    EvmCrossChainOrder,
    AuctionDetails,
    EvmAddress,
    TonAddress,
    randBigInt,
} from '@1inch/cross-chain-sdk';
import { 
    generateRandomBigInt, 
    ethAddressToBigInt, 
    crc32,
    generateSecret,
    createHashLock,
    createTimeLocks,
    createSafetyDeposits,
    createAuctionDetails,
    UINT_40_MAX,
    safeStringify
} from '../utils';
import { ORDER_CONFIG } from '../config';

const ESCROW_FACTORY = Address.parse('kQAU6TikP2x2EX35n1o1EV7TRRYBlUzUCwPmpz7wAt8NI3wo');

export interface CrossChainOrder {
    order: any;
    extension: string;
    signature: string;
    secret: string;
    hashlock: string;
    orderHash: string;
    expirationTime: string;
}

export const createCrossChainOrder = async (
    tonConnect: TonConnectUI,
    fromAsset: Asset,
    fromAmount: number,
    toAsset: Asset,
    toAmount: number,
    toAddress: string,
): Promise<CrossChainOrder> => {
    // ----------------------------------------------------------------------------
    // 1. Secret & Hash-lock
    // ----------------------------------------------------------------------------
    const secretBytes = new Uint8Array(32);
    crypto.getRandomValues(secretBytes);
    const secret = '0x' + Array.from(secretBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    const hashLock = HashLock.forSingleFill(secret);
    const secretHash = hashLock.toString();

    // ----------------------------------------------------------------------------
    // 2. Time-locks & Safety deposits (very short demo values)
    // ----------------------------------------------------------------------------
    const timeLocks = TimeLocks.new({
        srcWithdrawal: BigInt(10),
        srcPublicWithdrawal: BigInt(12000),
        srcCancellation: BigInt(18000),
        srcPublicCancellation: BigInt(24000),
        dstWithdrawal: BigInt(10),
        dstPublicWithdrawal: BigInt(120),
        dstCancellation: BigInt(180)
    });

    const SRC_SAFETY_DEPOSIT = BigInt(ORDER_CONFIG.srcSafetyDeposit);
    const DST_SAFETY_DEPOSIT = BigInt(ORDER_CONFIG.dstSafetyDeposit);

    // ----------------------------------------------------------------------------
    // 3. Auction parameters (no auction - fixed price)
    // ----------------------------------------------------------------------------
    const auctionDetails = AuctionDetails.noAuction();

    // ----------------------------------------------------------------------------
    // 4. Build Cross-Chain Order
    // ----------------------------------------------------------------------------
    const MAKING_AMOUNT = BigInt(Math.floor(fromAmount * 1e9)); // Convert to nano
    const TAKING_AMOUNT = BigInt(Math.floor(toAmount * 1e9)); // Convert to nano

    const nonce = randBigInt(UINT_40_MAX);

    const order = EvmCrossChainOrder.new(
        new EvmAddress(new InchAddress(ORDER_CONFIG.escrowFactoryAddress)),
        {
            makerAsset: new EvmAddress(new InchAddress(fromAsset.tokenAddress)),
            takerAsset: TonAddress.NATIVE,
            makingAmount: MAKING_AMOUNT,
            takingAmount: TAKING_AMOUNT,
            maker: new EvmAddress(new InchAddress(toAddress)),
            receiver: new TonAddress("UQCVzWSLLWSRcex7lHcMnfnk3j4cCVHrNlVGQQSzE9L6FU13"),
        },
        {
            hashLock,
            srcChainId: ORDER_CONFIG.sourceChainId as any,
            dstChainId: ORDER_CONFIG.destinationChainId as any,
            srcSafetyDeposit: SRC_SAFETY_DEPOSIT,
            dstSafetyDeposit: DST_SAFETY_DEPOSIT,
            timeLocks
        },
        {
            auction: auctionDetails,
            whitelist: [
                { address: new EvmAddress(new InchAddress(ORDER_CONFIG.resolverProxyAddress)), allowFrom: BigInt(0) },
            ]
        },
        {
            allowPartialFills: false,
            allowMultipleFills: false,
            nonce: nonce
        }
    );

    // ----------------------------------------------------------------------------
    // 5. Sign the order (EIP-712)
    // ----------------------------------------------------------------------------
    // For now, we'll create a simple signature
    // In production, this would use proper EIP-712 signing with the user's wallet
    const orderData = safeStringify(order.build());
    const signature = ethers.keccak256(ethers.toUtf8Bytes(orderData)).slice(0, 66); // Simple hash signature

    const orderHash = order.getOrderHash(ORDER_CONFIG.sourceChainId);
    const expirationTime = new Date(Number(order.deadline) * 1000).toISOString();

    return {
        order: order.build(),
        extension: order.extension.encode(),
        signature,
        secret,
        hashlock: secretHash,
        orderHash,
        expirationTime
    };
};

// Legacy function for backward compatibility
export const createOrder = async (
    tonConnect: TonConnectUI,
    fromAsset: Asset,
    fromAmount: number,
    toAsset: Asset,
    toAmount: number,
    toAddress: string,
) => {
    const crossChainOrder = await createCrossChainOrder(
        tonConnect,
        fromAsset,
        fromAmount,
        toAsset,
        toAmount,
        toAddress
    );

    console.log('Created cross-chain order:', crossChainOrder);

    // Send the order to the blockchain
    await tonConnect.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes from now
        messages: [
            {
                amount: (toNano(0.05) + toNano(fromAmount)).toString(),
                address: ESCROW_FACTORY.toString(),
                payload: beginCell()
                    .storeUint(crc32('create_order'), 32)
                    .storeUint(Date.now(), 64)
                    .storeUint(1, 32) // orderId
                    .storeCoins(toNano(fromAmount))
                    .storeRef(
                        beginCell()
                            .storeUint(toAsset.network, 8)
                            .storeUint(ethAddressToBigInt(toAsset.tokenAddress), 256)
                            .storeUint(ethAddressToBigInt(toAddress), 256)
                            .storeUint(toAmount, 128)
                            .endCell(),
                    )
                    .storeUint(BigInt(crossChainOrder.hashlock), 256)
                    .endCell()
                    .toBoc()
                    .toString('base64'),
            },
        ],
    });

    return crossChainOrder;
};