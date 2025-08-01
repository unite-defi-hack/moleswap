// Configuration for cross-chain order creation
// Following the structure from 1_order_create.ts

export const ORDER_CONFIG = {
    // Chain IDs - these will be determined based on order direction
    sourceChainId: 608, // TON_TESTNET
    destinationChainId: 11155111, // Sepolia (Ethereum testnet)
    
    // Addresses from the deployed contracts
    escrowFactoryAddress: '0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a', // From deployments.ts
    resolverProxyAddress: '0x1234567890123456789012345678901234567890', // Placeholder - needs actual deployment
    
    // Token addresses
    tokenA: '0xda0000d4000015a526378bb6fafc650cea5966f8', // TRUE_ERC20 from deployments.ts
    tokenB: '0xda0000d4000015a526378bb6fafc650cea5966f8', // TRUE_ERC20 from deployments.ts
    
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