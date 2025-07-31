import React from 'react';

interface ButtonProps {
  name: string;
  onClick: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ name, onClick, disabled = false }) => {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-3 px-4 rounded-xl font-medium transition-colors ${
        disabled 
          ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
          : 'bg-blue-500 text-white hover:bg-blue-600'
      }`}
    >
      {name}
    </button>
  );
}; 