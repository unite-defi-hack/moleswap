'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './ui/Icon';
import { Asset, AVAILABLE_ASSETS } from '@/app/assets';

interface AssetDropdownProps {
    asset: Asset;
    onAssetSelect: (asset: Asset) => void;
}

export const AssetDropdown: React.FC<AssetDropdownProps> = ({ asset, onAssetSelect }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleAssetSelect = (selectedAsset: Asset) => {
        onAssetSelect(selectedAsset);
        setDropdownOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
            >
                <Icon asset={asset} size="small" />
                <span className="font-medium text-gray-900">{asset.symbol}</span>
                <svg
                    className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                    {AVAILABLE_ASSETS.map((a) => (
                        <button
                            key={a.symbol}
                            onClick={() => handleAssetSelect(a)}
                            className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg"
                        >
                            <Icon asset={a} size="large" />
                            <div className="flex-1 text-left">
                                <div className="font-medium text-gray-900">{a.symbol}</div>
                                <div className="text-sm text-gray-500">{a.name}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};