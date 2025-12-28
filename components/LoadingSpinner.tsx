
import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-neutral-800 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-yellow-500 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute inset-2 bg-gradient-to-tr from-yellow-600 to-yellow-200 rounded-full animate-pulse opacity-40"></div>
      </div>
      <p className="text-xs uppercase tracking-[0.2em] font-bold text-yellow-500/80 animate-pulse">zix is processing</p>
    </div>
  );
};

export default LoadingSpinner;
