'use client';

import React, { useState, useEffect } from 'react';
import { Address } from '@ton/core';
import { getUserOrders, Order } from '@/app/api/orders';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { OrdersContainer } from '@/components/ordersTable/OrdersContainer';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { useAccount } from 'wagmi';

export function OrdersTable() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [tonConnectUI] = useTonConnectUI();
    const { address: ethAddress, isConnected } = useAccount();

    useEffect(() => {
        fetchOrders();
    }, [tonConnectUI?.account?.address, ethAddress]);

    async function fetchOrders() {
        try {
            setLoading(true);
            setError(null);

            const userAddresses: string[] = [];

            // TODO: should be uncommented when relayer supports ton addresses
            // if (tonConnectUI?.account?.address) {
            //     userAddresses.push(tonConnectUI.account.address);
            // }

            if (ethAddress) {
                userAddresses.push(ethAddress);
            }

            const fetchedOrders = await getUserOrders(userAddresses);
            setOrders(fetchedOrders);
        } catch (err) {
            setError('Failed to load orders');
            console.error('Error fetching orders:', err);
        } finally {
            setLoading(false);
        }
    }

    function handleRetry() {
        fetchOrders();
    }

    if (loading) {
        return <LoadingState />;
    }

    if (error) {
        return <ErrorState message={error} onRetry={handleRetry} />;
    }

    return <OrdersContainer orders={orders} />;
} 