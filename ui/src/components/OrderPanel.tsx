'use client';

import React, { useState } from 'react';
import { OrderAsset } from './OrderAsset';
import { RotateButton } from './ui/RotateButton';
import { Button } from './ui/Button';
import { AVAILABLE_ASSETS, Asset } from '@/app/assets';
import { createOrder } from '@/app/api/ton/order';
import { useTonConnectUI } from '@tonconnect/ui-react';

export const OrderPanel = () => {
    const [tonConnectUI] = useTonConnectUI();
    const [payAsset, setPayAsset] = useState<Asset>(AVAILABLE_ASSETS[0]);
    const [receiveAsset, setReceiveAsset] = useState<Asset>(AVAILABLE_ASSETS[1]);
    const [payAmount, setPayAmount] = useState('1');
    const [receiveAmount, setReceiveAmount] = useState('0');

    const handleSwapAssets = () => {
        const tempAsset = payAsset;
        const tempAmount = payAmount;

        setPayAsset(receiveAsset);
        setReceiveAsset(tempAsset);
        setPayAmount(receiveAmount);
        setReceiveAmount(tempAmount);
    };

    const handleCreateOrder = async () => {
        if (!tonConnectUI) return;

        console.log('Creating order...');
        await createOrder(
            tonConnectUI,
            payAsset,
            parseFloat(payAmount),
            receiveAsset,
            parseFloat(receiveAmount),
            '0x58b9147c2411F97841b0b53c42777De5502D54c8',
        )
            .catch(console.error)
            .then(() => {
                console.log('Order created');
            });
    };

    return (
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <OrderAsset
                label="You pay"
                asset={payAsset}
                amount={payAmount}
                onAssetChange={setPayAsset}
                onAmountChange={setPayAmount}
            />

            <RotateButton onClick={handleSwapAssets} />

            <OrderAsset
                label="You receive"
                asset={receiveAsset}
                amount={receiveAmount}
                onAssetChange={setReceiveAsset}
                onAmountChange={setReceiveAmount}
            />

            <div className="mt-6">
                <Button name="Create order" onClick={handleCreateOrder} />
            </div>
        </div>
    );
};