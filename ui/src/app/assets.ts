export interface Asset {
    symbol: string;
    name: string;
    coinGeckoId: string;
    network: number;
    networkName: string;
    tokenAddress: string;
    icon: string;
    decimals: number;
}

export const AVAILABLE_ASSETS: Asset[] = [
    {
        symbol: 'TON',
        name: 'Toncoin',
        coinGeckoId: 'the-open-network',
        network: 608, // TON_TESTNET
        networkName: 'Ton',
        // should be commented address for ton
        // tokenAddress: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c',
        tokenAddress: '0xec0396430645c294ff99b8d71c93f74bc94119fa',
        icon: '/assets/ton.svg',
        decimals: 10**9,
    },
    {
        symbol: 'ETH',
        name: 'Ethereum',
        coinGeckoId: 'ethereum',
        network: 11155111, // Sepolia (Ethereum testnet)
        networkName: 'Ethereum',
        tokenAddress: '0xa360725f46f43ad1b1aae09acfae96c2b59d1013',
        icon: '/assets/ethereum.svg',
        decimals: 10**18,
    },
];