import React from 'react';
import Image from 'next/image';
import { Asset } from '@/app/assets';

interface IconProps {
    asset: Asset;
    size: 'small' | 'large';
}

export const Icon: React.FC<IconProps> = ({ asset, size }) => {
    const dimensions = size === 'small' ? 'w-6 h-6' : 'w-8 h-8';

    return (
        <div className={`${dimensions} flex items-center justify-center`}>
            <Image
                src={asset.icon}
                alt={asset.symbol}
                width={size === 'small' ? 24 : 32}
                height={size === 'small' ? 24 : 32}
            />
        </div>
    );
};