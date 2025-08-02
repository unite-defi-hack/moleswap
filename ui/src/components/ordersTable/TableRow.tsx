import React from 'react';
import { formatAmount, formatTime, getAssetDisplayName, getStateColor } from '@/utils/formatters';

type Order = {
    order_hash: bigint;
    creation_time: number;
    expiration_time: number;
    maker_asset: string;
    making_amount: bigint;
    taker_asset: string;
    taking_amount: bigint;
    state: string;
};

interface TableRowProps {
    order: Order;
}

export function TableRow({ order }: TableRowProps) {
    const makingAmount = parseFloat(formatAmount(order.making_amount));
    const takingAmount = parseFloat(formatAmount(order.taking_amount));
    const rate = takingAmount > 0 ? (makingAmount / takingAmount).toFixed(4) : '0';

    return (
        <tr className="hover:bg-gray-50 border border-gray-200 rounded-lg">
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900 font-medium">
                    {formatAmount(order.making_amount)} {getAssetDisplayName(order.maker_asset)}
                </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900 font-medium">
                    {formatAmount(order.taking_amount)} {getAssetDisplayName(order.taker_asset)}
                </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-600">
                    {rate} {getAssetDisplayName(order.maker_asset)}/{getAssetDisplayName(order.taker_asset)}
                </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {formatTime(order.creation_time)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {formatTime(order.expiration_time)}
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStateColor(order.state)}`}>
                    {order.state}
                </span>
            </td>
        </tr>
    );
} 