import React from 'react';

interface EmptyStateProps {
    title: string;
    description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
    return (
        <div className="text-center py-12">
            <div className="text-gray-500 font-medium">{title}</div>
            <p className="text-sm text-gray-400 mt-2">{description}</p>
        </div>
    );
} 