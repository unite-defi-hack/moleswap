export function formatAmount(amount: bigint): string {
    // Assuming 9 decimals for display
    const divisor = BigInt(10 ** 9);
    const wholePart = amount / divisor;
    const decimalPart = amount % divisor;
    
    if (decimalPart === BigInt(0)) {
        return wholePart.toString();
    }
    
    const decimalStr = decimalPart.toString().padStart(9, '0').replace(/0+$/, '');
    return `${wholePart}.${decimalStr}`;
}

export function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function getAssetDisplayName(asset: string): string {
    return asset.toUpperCase();
}

export function getStateColor(state: string): string {
    switch (state.toLowerCase()) {
        case 'active':
            return 'text-green-600 bg-green-100';
        case 'pending':
            return 'text-yellow-600 bg-yellow-100';
        case 'completed':
            return 'text-blue-600 bg-blue-100';
        case 'cancelled':
            return 'text-red-600 bg-red-100';
        default:
            return 'text-gray-600 bg-gray-100';
    }
} 