'use client';

import React, { useState, useEffect } from 'react';
import { getOrders, Order } from '@/app/api/orders';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { OrdersContainer } from '@/components/ordersTable/OrdersContainer';

export function OrdersTable() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchOrders();
    }, []);

    async function fetchOrders() {
        try {
            setLoading(true);
            setError(null);
            const fetchedOrders = await getOrders();
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