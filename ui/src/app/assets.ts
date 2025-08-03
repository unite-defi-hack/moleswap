export interface Asset {
    symbol: string;
    name: string;
    coinGeckoId: string;
    network: number;
    tokenAddress: string;
    icon: string;
}

export const AVAILABLE_ASSETS: Asset[] = [
    {
        symbol: 'TON',
        name: 'Toncoin',
        coinGeckoId: 'the-open-network',
        network: 608, // TON_TESTNET
        tokenAddress: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c',
        icon: '/assets/ton.svg',
    },
    {
        symbol: 'ETH',
        name: 'Ethereum',
        coinGeckoId: 'ethereum',
        network: 11155111, // Sepolia (Ethereum testnet)
        tokenAddress: '0xda0000d4000015a526378bb6fafc650cea5966f8',
        icon: '/assets/ethereum.svg',
    },
];