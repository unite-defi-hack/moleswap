'use client';

import React, { useState } from 'react';
import { OrderAsset } from './OrderAsset';
import { RotateButton } from './ui/RotateButton';
import { Button } from './ui/Button';
import { AVAILABLE_ASSETS, Asset } from '@/app/assets';
import { createCrossChainOrder, CrossChainOrder } from '@/app/api/ton/order';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { Address } from 'ton-core';

import { useAccount, useSignTypedData } from 'wagmi';

export const OrderPanel = () => {
    const { address, isConnected } = useAccount();
    const [tonConnectUI] = useTonConnectUI();
    const [payAsset, setPayAsset] = useState<Asset>(AVAILABLE_ASSETS[0]);
    const [receiveAsset, setReceiveAsset] = useState<Asset>(AVAILABLE_ASSETS[1]);
    const [payAmount, setPayAmount] = useState('1');
    const [receiveAmount, setReceiveAmount] = useState('0');
    const [isCreating, setIsCreating] = useState(false);
    const [orderStep, setOrderStep] = useState<string>('');
    const [createdOrder, setCreatedOrder] = useState<CrossChainOrder | null>(null);

    const { signTypedDataAsync } = useSignTypedData();


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

        setIsCreating(true);
        setOrderStep('Generating secret and hash-lock...');

        try {
            // Step 1: Secret & Hash-lock
            setOrderStep('Creating time-locks and safety deposits...');
            await new Promise(resolve => setTimeout(resolve, 500));

            // Step 2: Time-locks & Safety deposits
            setOrderStep('Setting auction parameters...');
            await new Promise(resolve => setTimeout(resolve, 500));

            // Step 3: Auction parameters
            setOrderStep('Building cross-chain order...');
            await new Promise(resolve => setTimeout(resolve, 500));

            // Step 4: Build Cross-Chain Order
            setOrderStep('Signing the order...');
            await new Promise(resolve => setTimeout(resolve, 500));

            console.log('55555 aaaaa', payAsset);
            console.log('66666', tonConnectUI)

            // Step 5: Sign the order
            const order = await createCrossChainOrder(
                tonConnectUI,
                payAsset,
                parseFloat(payAmount),
                receiveAsset,
                parseFloat(receiveAmount),
                payAsset.name == 'Ethereum' ? Address.parse(tonConnectUI.account.address).toString({testOnly: true}) : address,
                signTypedDataAsync,
                address
            );

            setCreatedOrder(order);
            setOrderStep('Order created successfully!');
            
            console.log('Cross-chain order created:', order);
        } catch (error) {
            console.error('Error creating order:', error);
            setOrderStep('Error creating order');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <OrderAsset
                label="You pay"
                asset={payAsset}
                amount={payAmount}
                onAssetChange={setPayAsset}
                onAmountChange={setPayAmount}
                isProcessing={isCreating}
            />

            <RotateButton onClick={handleSwapAssets} />

            <OrderAsset
                label="You receive"
                asset={receiveAsset}
                amount={receiveAmount}
                onAssetChange={setReceiveAsset}
                onAmountChange={setReceiveAmount}
                isProcessing={isCreating}
            />

            <div className="mt-6">
                <Button 
                    name={isCreating ? "Creating order..." : "Create order"} 
                    onClick={handleCreateOrder}
                    disabled={isCreating}
                />
                
                {isCreating && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <div className="text-sm text-blue-700 font-medium">
                            {orderStep}
                        </div>
                        <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '100%'}}></div>
                        </div>
                    </div>
                )}

                {createdOrder && (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                        <h3 className="text-sm font-medium text-green-800 mb-2">
                            Order Created Successfully!
                        </h3>
                        <div className="text-xs text-green-700 space-y-1">
                            <div><strong>Order Hash:</strong> {createdOrder.orderHash.slice(0, 20)}...</div>
                            <div><strong>Expires:</strong> {new Date(createdOrder.expirationTime).toLocaleString()}</div>
                            <div><strong>Secret:</strong> {createdOrder.secret.slice(0, 20)}...</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};