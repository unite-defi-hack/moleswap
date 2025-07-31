import { Asset } from '@/app/assets';
import { Address, beginCell, toNano } from '@ton/core';
import { CHAIN, TonConnectUI } from '@tonconnect/ui-react';
import { ethers } from 'ethers';
import { 
    generateRandomBigInt, 
    ethAddressToBigInt, 
    crc32,
    generateSecret,
    createHashLock,
    createTimeLocks,
    createSafetyDeposits,
    createAuctionDetails,
    randBigInt,
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
    const secret = generateSecret();
    const hashLock = await createHashLock(secret);
    const secretHash = hashLock;

    // ----------------------------------------------------------------------------
    // 2. Time-locks & Safety deposits
    // ----------------------------------------------------------------------------
    const timeLocks = createTimeLocks();
    const safetyDeposits = {
        srcSafetyDeposit: BigInt(ORDER_CONFIG.srcSafetyDeposit),
        dstSafetyDeposit: BigInt(ORDER_CONFIG.dstSafetyDeposit)
    };

    // ----------------------------------------------------------------------------
    // 3. Auction parameters (no auction - fixed price)
    // ----------------------------------------------------------------------------
    const auctionDetails = createAuctionDetails();

    // ----------------------------------------------------------------------------
    // 4. Build Cross-Chain Order
    // ----------------------------------------------------------------------------
    const makingAmount = BigInt(Math.floor(fromAmount * 1e9)); // Convert to nano
    const takingAmount = BigInt(Math.floor(toAmount * 1e9)); // Convert to nano
    const nonce = randBigInt(UINT_40_MAX);

    // Create order structure similar to 1_order_create.ts
    const order = {
        escrowFactory: ESCROW_FACTORY.toString(),
        makerAsset: fromAsset.tokenAddress,
        takerAsset: toAsset.tokenAddress,
        makingAmount: makingAmount.toString(),
        takingAmount: takingAmount.toString(),
        maker: toAddress, // This would be the user's address
        receiver: toAddress,
        hashLock: secretHash,
        srcChainId: fromAsset.network,
        dstChainId: toAsset.network,
        srcSafetyDeposit: safetyDeposits.srcSafetyDeposit.toString(),
        dstSafetyDeposit: safetyDeposits.dstSafetyDeposit.toString(),
        timeLocks: {
            srcWithdrawal: timeLocks.srcWithdrawal.toString(),
            srcPublicWithdrawal: timeLocks.srcPublicWithdrawal.toString(),
            srcCancellation: timeLocks.srcCancellation.toString(),
            srcPublicCancellation: timeLocks.srcPublicCancellation.toString(),
            dstWithdrawal: timeLocks.dstWithdrawal.toString(),
            dstPublicWithdrawal: timeLocks.dstPublicWithdrawal.toString(),
            dstCancellation: timeLocks.dstCancellation.toString()
        },
        auction: {
            noAuction: auctionDetails.noAuction,
            startTime: auctionDetails.startTime.toString(),
            endTime: auctionDetails.endTime.toString(),
            minBid: auctionDetails.minBid.toString()
        },
        allowPartialFills: false,
        allowMultipleFills: false,
        nonce: nonce.toString()
    };

    // ----------------------------------------------------------------------------
    // 5. Sign the order (EIP-712)
    // ----------------------------------------------------------------------------
    // For now, we'll create a simple signature
    // In production, this would use proper EIP-712 signing
    const orderData = safeStringify(order);
    const signature = ethers.keccak256(ethers.toUtf8Bytes(orderData)).slice(0, 66); // Simple hash signature

    const orderHash = ethers.keccak256(ethers.toUtf8Bytes(orderData));
    const expirationTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now

    return {
        order,
        extension: btoa(orderData), // Base64 encode the order data
        signature: signature as string,
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