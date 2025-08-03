import { Address } from "@ton/core";
import { API_CONFIG } from "./config";
import { AVAILABLE_ASSETS } from "../assets";

export type Order = {
    order_hash: bigint;
    creation_time: number;
    expiration_time?: number;
    maker: string;
    maker_asset: string;
    making_amount: bigint;
    receiver: string;
    taker_asset: string;
    taking_amount: bigint;
    src_chain: string;
    dst_chain: string;
    state: string;
};

export async function getOrders(): Promise<Order[]> {
    try {
        const response = await fetch(`${API_CONFIG.relayerBaseUrl}/api/orders`, {
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

        console.log('data', res);
        
        let orders: Order[] = [];

        for (const order of res.data.orders) {
            orders.push({
                order_hash: order.orderHash,
                maker: order.order.maker,
                maker_asset: convertAsset(order.order.makerAsset),
                making_amount: BigInt(order.order.makingAmount),
                taker_asset: convertAsset(order.order.takerAsset),
                taking_amount: BigInt(order.order.takingAmount),
                state: order.status,
                src_chain: convertChainId(order.order.srcChainId),
                dst_chain: convertChainId(order.order.dstChainId),
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

function convertChainId(chainId: number) {
    if (chainId === 1) {
        return 'Ton';
    } else if (chainId === -239) {
        return 'Ethereum';
    } else {
        return 'Unknown';
    }
}

function convertAsset(asset: string) {
    for (const a of AVAILABLE_ASSETS) {
        if (a.tokenAddress.toLowerCase() === asset.toLowerCase()) {
            return a.symbol;
        }
    }
    return '<Unknown Asset>';
}