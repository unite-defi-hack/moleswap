import { Asset } from '@/app/assets';
import { Address, beginCell, toNano } from '@ton/core';
import { CHAIN, TonConnectUI } from '@tonconnect/ui-react';
import { ethers } from 'ethers';
import {
    HashLock,
    TimeLocks,
    TonCrossChainOrder,
    AuctionDetails,
    EvmAddress,
    TonAddress,
    randBigInt,
    SupportedChains,
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

import { createConfig, http } from '@wagmi/core'
import { sepolia } from '@wagmi/core/chains'
import { EvmCrossChainOrder } from '@1inch/cross-chain-sdk';




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
    receiverAddress: string,
    signTypedDataAsync: any,
    evmAddress: any,
): Promise<CrossChainOrder> => {
    console.log('evm address !!!!!!!!', evmAddress);
    // Determine order direction and chain IDs
    const isTonToEth = fromAsset.network === 608; // TON to ETH
    const isEthToTon = fromAsset.network === 11155111; // ETH to TON
    
    if (!isTonToEth && !isEthToTon) {
        throw new Error('Unsupported order direction. Only TON ↔ ETH orders are supported.');
    }
    
    // For TON to ETH orders, use TonCrossChainOrder (TON as source)
    // For ETH to TON orders, use EvmCrossChainOrder (ETH as source)
    const useTonOrder = isTonToEth;
    const srcChainId = isTonToEth ? 608 : 11155111; // TON or ETH
    const dstChainId = isTonToEth ? 11155111 : 608; // ETH or TON
    
    // Determine the correct address types based on order direction
    const isReceiverAddressEvm = receiverAddress.startsWith('0x');
    const tonPrefixes = ['EQ', 'UQ', 'kQ', '0Q', 'KQ'];
    const isReceiverAddressTon = tonPrefixes.some(prefix => receiverAddress.startsWith(prefix));
    
    if (!isReceiverAddressEvm && !isReceiverAddressTon) {
        throw new Error('Invalid address format. Address must be either EVM (0x...) or TON (EQ.../UQ...) format.');
    }
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
        srcWithdrawal: BigInt(0),
        srcPublicWithdrawal: BigInt(12000),
        srcCancellation: BigInt(18000),
        srcPublicCancellation: BigInt(24000),
        dstWithdrawal: BigInt(0),
        dstPublicWithdrawal: BigInt(600),
        dstCancellation: BigInt(800)
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

    let order;
    
    if (useTonOrder) {
        // TON to ETH order using TonCrossChainOrder
        // Get the user's TON wallet address
        const tonWallet = tonConnect.account;
        if (!tonWallet) {
            throw new Error('TON wallet not connected');
        }
        
        order = TonCrossChainOrder.new(
            {
                makerAsset: TonAddress.NATIVE,
                takerAsset: EvmAddress.fromString(toAsset.tokenAddress),
                makingAmount: MAKING_AMOUNT,
                takingAmount: TAKING_AMOUNT,
                maker: new TonAddress(tonWallet.address), // TON maker address from wallet
                receiver: EvmAddress.fromString(receiverAddress), // EVM receiver address
            },
            {
                hashLock,
                srcChainId: srcChainId as any,
                dstChainId: dstChainId as any,
                srcSafetyDeposit: SRC_SAFETY_DEPOSIT,
                dstSafetyDeposit: DST_SAFETY_DEPOSIT,
                timeLocks
            },
            {
                auction: auctionDetails,
            },
            {
                allowPartialFills: false,
                allowMultipleFills: false,
                srcAssetIsNative: true,
                orderExpirationDelay: BigInt(60 * 60), // 1 hour in seconds
            }
        );
    } else {
        // ETH to TON order using EvmCrossChainOrder
        // Note: In a real implementation, this would require an EVM wallet connection
        // For now, we'll use a placeholder address
        order = EvmCrossChainOrder.new(
            EvmAddress.fromString(ORDER_CONFIG.escrowFactoryAddress),
            {
                makerAsset: EvmAddress.fromString(fromAsset.tokenAddress),
                takerAsset: TonAddress.NATIVE,
                makingAmount: MAKING_AMOUNT,
                takingAmount: TAKING_AMOUNT,
                maker: EvmAddress.fromString(evmAddress), // EVM maker address (placeholder)
                receiver: new TonAddress(receiverAddress), // TON receiver address
            },
            {
                hashLock,
                srcChainId: srcChainId as any,
                dstChainId: dstChainId as any,
                srcSafetyDeposit: SRC_SAFETY_DEPOSIT,
                dstSafetyDeposit: DST_SAFETY_DEPOSIT,
                timeLocks
            },
            {
                auction: auctionDetails,
                whitelist: [
                    { address: EvmAddress.fromString(ORDER_CONFIG.resolverProxyAddress), allowFrom: BigInt(0) },
                ]
            },
            {
                allowPartialFills: false,
                allowMultipleFills: false,
                nonce: nonce,
                orderExpirationDelay: BigInt(60 * 60), // 1 hour in seconds
            }
        );
    }

    // ----------------------------------------------------------------------------
    // 5. Sign the order (EIP-712)
    // ----------------------------------------------------------------------------
    // For now, we'll create a simple signature
    // In production, this would use proper EIP-712 signing with the user's wallet
    let orderData, orderResult, extension;
    let signature;

    if (useTonOrder) {
        // Handle TonCrossChainOrder
        const tonOrder = order as any; // Type assertion for TonCrossChainOrder
        orderData = safeStringify(tonOrder.toJSON());
        orderResult = tonOrder.toJSON();
        extension = tonOrder.getTonContractOrderHash().toString('hex');
    } else {
        // Handle EvmCrossChainOrder
        const evmOrder = order as EvmCrossChainOrder;
        orderData = safeStringify(evmOrder.build());
        orderResult = evmOrder.build();
        extension = evmOrder.extension.encode();
        const typedData = evmOrder.getTypedData(srcChainId);
        signature = await signTypedDataAsync({
            domain: typedData.domain,
            types: { Order: typedData.types.Order },
            primaryType: 'Order',
            message: typedData.message,
        });
    }


    const orderHash = order.getOrderHash(srcChainId);
    const expirationTime = new Date(Number(order.deadline) * 1000).toISOString();

    return {
        order: orderResult,
        extension: extension,
        signature,
        secret,
        hashlock: secretHash,
        orderHash,
        expirationTime
    };
};