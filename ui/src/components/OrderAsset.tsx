'use client';

import React, { useState, useEffect } from 'react';
import { Asset } from '@/app/assets';
import { AssetDropdown } from './AssetSelect';
import { getAssetPrice } from '@/app/api/price';

interface OrderAssetProps {
    label: string;
    asset: Asset;
    amount: string;
    onAssetChange: (asset: Asset) => void;
    onAmountChange: (amount: string) => void;
}

export const OrderAsset: React.FC<OrderAssetProps> = ({ label, asset, amount, onAssetChange, onAmountChange }) => {
    const [usdValue, setUsdValue] = useState<string>('');
    const [usdPrice, setUsdPrice] = useState<number>(0);

    useEffect(() => {
        const fetchPrice = async () => {
            try {
                setUsdPrice(await getAssetPrice(asset.coinGeckoId));
            } catch (error) {
                console.error('Error fetching asset price:', error);
            }
        };

        fetchPrice();
    }, [amount]);

    useEffect(() => {
        if (amount && !isNaN(parseFloat(amount.replace(/,/g, '')))) {
            const cleanAmount = parseFloat(amount.replace(/,/g, ''));
            const usdVal = cleanAmount * usdPrice;
            setUsdValue(`~$${usdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        } else {
            setUsdValue('');
        }
    }, [amount, usdPrice]);

    return (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="mb-1">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-gray-600">{label}</span>
                </div>

                <div className="flex justify-between items-center mb-3">
                    <AssetDropdown asset={asset} onAssetSelect={onAssetChange} />

                    <div className="text-right">
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => onAmountChange(e.target.value)}
                            className="bg-transparent text-right text-2xl font-semibold text-gray-900 border-none outline-none w-20"
                            placeholder="0"
                        />
                    </div>
                </div>

                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">{asset.name}</span>
                    {usdValue && <span className="text-gray-500">{usdValue}</span>}
                </div>
            </div>
        </div>
    );
};