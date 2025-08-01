// Configuration for cross-chain order creation
// Following the structure from 1_order_create.ts

export const ORDER_CONFIG = {
    // Chain IDs - these will be determined based on order direction
    sourceChainId: 607, // TON_MAINNET
    destinationChainId: 1, // Ethereum
    
    // Addresses (these would be fetched from environment or contract deployment)
    escrowFactoryAddress: '0x0000000000000000000000000000000000000000', // Placeholder - should be actual deployed address
    resolverProxyAddress: '0x0000000000000000000000000000000000000000', // Placeholder
    
    // Token addresses
    tokenA: '0x0000000000000000000000000000000000000000', // TON native
    tokenB: '0x0000000000000000000000000000000000000000', // ETH native
    
    // Safety deposits (in nano/wei)
    srcSafetyDeposit: '1000000000000',
    dstSafetyDeposit: '1000000000000',
    
    // Time lock durations (in seconds)
    timeLocks: {
        srcWithdrawal: 10,
        srcPublicWithdrawal: 12000,
        srcCancellation: 18000,
        srcPublicCancellation: 24000,
        dstWithdrawal: 10,
        dstPublicWithdrawal: 120,
        dstCancellation: 180
    },
    
    // Auction settings (no auction for now)
    auction: {
        noAuction: true,
        startTime: 0,
        endTime: 0,
        minBid: 0
    },
    
    // Order settings
    order: {
        allowPartialFills: false,
        allowMultipleFills: false,
        expirationHours: 24
    }
};

export function initOrderConfig() {
    return ORDER_CONFIG;
} 