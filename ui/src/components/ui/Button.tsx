import React from 'react';

interface ButtonProps {
  name: string;
  onClick: () => void;
}

export const Button: React.FC<ButtonProps> = ({ name, onClick }) => {
  return (
    <button 
      onClick={onClick}
      className="w-full bg-blue-500 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-600 transition-colors"
    >
      {name}
    </button>
  );
}; 