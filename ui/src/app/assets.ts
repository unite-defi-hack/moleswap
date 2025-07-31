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
        network: 1,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        icon: '/assets/ton.svg',
    },
    {
        symbol: 'ETH',
        name: 'Ethereum',
        coinGeckoId: 'ethereum',
        network: 2,
        tokenAddress: '0x0000000000000000000000000000000000000000',
        icon: '/assets/ethereum.svg',
    },
];