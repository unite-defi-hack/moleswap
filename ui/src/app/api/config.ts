// Configuration for cross-chain order creation
// Following the structure from 1_order_create.ts

export const ORDER_CONFIG = {
    // Chain IDs - these will be determined based on order direction
    sourceChainId: 608, // TON_TESTNET
    destinationChainId: 11155111, // Sepolia (Ethereum testnet)
    
    lopAddress: '0x991f286348580c1d2206843D5CfD7863Ff29eB15',
    escrowFactoryAddress: '0x5e7854fC41247FD537FE45d7Ada070b9Bfba41DA',
    resolverProxyAddress: '0xAa15bcf840eb0454C87710E6578E6C77Cd3DC402',
    
    tokenA: '0xa360725f46f43ad1b1aae09acfae96c2b59d1013',
    tokenB: '0xda0000d4000015a526378bb6fafc650cea5966f8',
    
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