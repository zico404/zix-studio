
import React, { useState, KeyboardEvent, useEffect, useRef } from 'react';

interface PromptInputProps {
  onSend: (prompt: string) => void;
  disabled: boolean;
  placeholder?: string;
}

const PromptInput: React.FC<PromptInputProps> = ({ onSend, disabled, placeholder = "Instruct zix to transform..." }) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <div className="relative flex items-center gap-2 md:gap-3 rounded-3xl px-2">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none focus:ring-0 py-4 md:py-5 px-3 md:px-5 resize-none max-h-40 scrollbar-hide text-neutral-200 placeholder-neutral-700 text-xs md:text-sm leading-relaxed disabled:opacity-50 transition-all self-center"
      />
      <button
        onClick={handleSubmit}
        disabled={!value.trim() || disabled}
        className={`shrink-0 p-3 md:p-4 rounded-2xl transition-all duration-300 flex items-center justify-center self-center ${
          !value.trim() || disabled
            ? 'text-neutral-800'
            : 'text-yellow-500 scale-100 hover:scale-110 active:scale-95'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  );
};

export default PromptInput;
