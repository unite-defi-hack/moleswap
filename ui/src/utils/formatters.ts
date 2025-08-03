
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