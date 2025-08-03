import { API_CONFIG } from "./config";
import { AVAILABLE_ASSETS } from "../assets";

export type Order = {
    order_hash: bigint;
    creation_time: number;
    expiration_time?: number;
    maker: string;
    maker_asset: string;
    making_amount: string;
    receiver: string;
    taker_asset: string;
    taking_amount: string;
    src_chain: string;
    dst_chain: string;
    state: string;
};

export async function getUserOrders(userAddresses: string[]): Promise<Order[]> {
    try {
        const makerParams = userAddresses.map(address => `maker=${address.toLowerCase()}`).join('&');
        const response = await fetch(`${API_CONFIG.relayerBaseUrl}/api/orders?${makerParams}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            next: { revalidate: 30 }, // Cache for 30 seconds for better performance
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch orders: ${response.status} ${response.statusText}`);
        }

        const res = await response.json();
        
        let orders: Order[] = [];

        for (const order of res.data.orders) {
            const srcAsset = convertAsset(order.order.srcChainId, order.order.makerAsset, order.order.makingAmount);
            const dstAsset = convertAsset(order.order.dstChainId, order.order.takerAsset, order.order.takingAmount);
            orders.push({
                order_hash: order.orderHash,
                maker: order.order.maker,
                maker_asset: srcAsset.symbol,
                making_amount: srcAsset.amount,
                taker_asset: dstAsset.symbol,
                taking_amount: dstAsset.amount,
                state: order.status,
                src_chain: srcAsset.network,
                dst_chain: dstAsset.network,
                receiver: order.order.receiver,
                creation_time: order.createdAt,
            });
        }

        return orders;
    } catch (error) {
        console.error('Error fetching orders:', error);
        return [];
    }
}

function convertAsset(chainId: number, assetAddr: string, assetAmount: string) {
    for (const a of AVAILABLE_ASSETS) {
        if (a.tokenAddress.toLowerCase() === assetAddr.toLowerCase()) {
            const amount = Number(assetAmount) / a.decimals;
            return { network: a.networkName, symbol: a.symbol, amount: parseFloat(amount.toFixed(8)).toString() };
        }
    }
    return { network: (chainId | 0).toString(), symbol: '<Unknown>', amount: assetAmount };
}