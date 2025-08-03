import React from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableHeader } from '@/components/ordersTable/TableHeader';
import { TableRow } from '@/components/ordersTable/TableRow';
import { Order } from '@/app/api/orders';

interface OrdersContainerProps {
    orders: Order[];
}

export function OrdersContainer({ orders }: OrdersContainerProps) {
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Your Orders</h2>
                <p className="text-sm text-gray-500 mt-1">{orders.length} orders found</p>
            </div>

            {orders.length === 0 ? (
                <EmptyState 
                    title="No orders found" 
                    description="Your orders will appear here once you create them"
                />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <TableHeader />
                        <tbody className="bg-white space-y-2">
                            {orders.map((order) => (
                                <TableRow 
                                    key={order.order_hash.toString()} 
                                    order={order} 
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
} 