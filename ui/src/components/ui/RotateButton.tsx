import React from 'react';

interface RotateButtonProps {
  onClick: () => void;
}

export const RotateButton: React.FC<RotateButtonProps> = ({ onClick }) => {
  return (
    <div className="relative flex justify-center -my-3 z-10">
      <button
        onClick={onClick}
        className="group w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
      >
        <svg className="w-4 h-4 text-gray-600 group-hover:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>
    </div>
  );
}; 