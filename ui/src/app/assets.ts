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
        network: 607, // TON_MAINNET
        tokenAddress: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c', // TON native address
        icon: '/assets/ton.svg',
    },
    {
        symbol: 'ETH',
        name: 'Ethereum',
        coinGeckoId: 'ethereum',
        network: 1, // ETHEREUM
        tokenAddress: '0x0000000000000000000000000000000000000000', // ETH native address
        icon: '/assets/ethereum.svg',
    },
];