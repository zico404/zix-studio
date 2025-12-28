import React from 'react';

interface HeaderProps {
  onToggleMenu: () => void;
  isMenuOpen: boolean;
  isIdle: boolean;
}

const Header: React.FC<HeaderProps> = ({ onToggleMenu, isMenuOpen, isIdle }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-[150] bg-black/60 backdrop-blur-2xl border-b border-neutral-900 px-3 md:px-6 py-2.5 md:py-4 flex justify-between items-center">
      <div className="flex items-center gap-2 md:gap-3">
        <div 
          className={`relative w-7 h-7 md:w-9 md:h-9 bg-black rounded-lg flex items-center justify-center border border-yellow-500/40 transition-all duration-700 ${isIdle && !isMenuOpen ? 'animate-subtle-pulse' : ''}`}
        >
          <span className="text-base md:text-xl font-black text-transparent bg-clip-text bg-gradient-to-tr from-yellow-600 to-yellow-200">Z</span>
        </div>
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg md:text-2xl font-black tracking-tighter text-white">zix<span className="text-yellow-500">.</span></h1>
            {isIdle && (
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/40 animate-pulse hidden md:block"></span>
            )}
          </div>
          <span className="hidden md:block text-[8px] font-black uppercase tracking-[0.3em] text-neutral-600">Neural Visual Studio</span>
        </div>
      </div>
      
      <button 
        onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
        className="w-9 h-9 md:w-12 md:h-12 flex items-center justify-center rounded-xl hover:bg-neutral-900 transition-all text-neutral-500 hover:text-yellow-500 active:scale-95"
      >
        {isMenuOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        )}
      </button>
    </header>
  );
};

export default Header;