
import React, { useState } from 'react';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  activeContent?: string;
  isActive?: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({ children, content, activeContent, isActive }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="relative flex items-center justify-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {(isVisible || isActive) && (
        <div className="absolute bottom-full mb-3 px-3 py-1.5 bg-neutral-900/90 backdrop-blur-md border border-yellow-500/30 rounded-lg shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 pointer-events-none z-[120] whitespace-nowrap">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-500/90">
            {isActive && activeContent ? activeContent : content}
          </p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-neutral-900/90"></div>
        </div>
      )}
    </div>
  );
};

export default Tooltip;
