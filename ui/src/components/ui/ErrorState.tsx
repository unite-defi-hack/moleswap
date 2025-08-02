import React from 'react';

interface ErrorStateProps {
    message: string;
    onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="text-center py-8">
                <div className="text-red-600 font-medium">{message}</div>
                {onRetry && (
                    <button 
                        onClick={onRetry}
                        className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    >
                        Retry
                    </button>
                )}
            </div>
        </div>
    );
} 