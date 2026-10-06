import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SuggestionInputProps {
  id?: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  isTextarea?: boolean;
  rows?: number;
  type?: string;
  required?: boolean;
  helperText?: string;
  autoFormatMac?: boolean;
}

export const SuggestionInput: React.FC<SuggestionInputProps> = ({
  id,
  name,
  label,
  value,
  onChange,
  suggestions = [],
  placeholder = '',
  isTextarea = false,
  rows = 3,
  type = 'text',
  required = false,
  helperText,
  autoFormatMac = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const query = value.trim().toLowerCase();
  const filteredSuggestions = suggestions.filter((s) => {
    if (!query) return true;
    return s.toLowerCase().includes(query);
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (rawVal: string) => {
    let finalVal = rawVal;
    if (autoFormatMac) {
      const hexOnly = rawVal.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
      const parts: string[] = [];
      for (let i = 0; i < hexOnly.length && i < 12; i += 2) {
        parts.push(hexOnly.slice(i, i + 2));
      }
      finalVal = parts.join(':');
    }
    onChange(finalVal);
    setIsOpen(true);
    setSelectedIndex(-1);
  };

  const handleSelectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setIsOpen(false);
    setSelectedIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        e.preventDefault();
        setIsOpen(true);
        setSelectedIndex(0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(filteredSuggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="flex items-center justify-between mb-1">
        <label htmlFor={id || name} className="text-xs font-medium text-slate-700">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
        
        {suggestions.length > 0 && (
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors"
            title="Show saved entries"
          >
            <span>{suggestions.length} saved</span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      <div className="relative">
        {isTextarea ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            id={id || name}
            name={name}
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            rows={rows}
            placeholder={placeholder}
            required={required}
            className="w-full px-2.5 py-1.5 text-xs text-slate-900 bg-white border border-slate-300 rounded focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600/20 transition-colors placeholder:text-slate-400"
          />
        ) : (
          <div className="relative flex items-center">
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={type}
              id={id || name}
              name={name}
              value={value}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setIsOpen(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              required={required}
              className={`w-full px-2.5 py-1.5 text-xs text-slate-900 bg-white border border-slate-300 rounded focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600/20 transition-colors placeholder:text-slate-400 ${
                autoFormatMac ? 'font-mono uppercase tracking-wider' : ''
              }`}
            />
            {suggestions.length > 0 && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setIsOpen((prev) => !prev)}
                className="absolute right-2 p-1 text-slate-400 hover:text-slate-600"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {isOpen && filteredSuggestions.length > 0 && (
          <div className="absolute z-40 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded shadow-md divide-y divide-slate-100 text-xs">
            {filteredSuggestions.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const isExactMatch = item.toLowerCase() === value.trim().toLowerCase();

              return (
                <button
                  key={`${item}-${idx}`}
                  type="button"
                  onClick={() => handleSelectSuggestion(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between transition-colors ${
                    isSelected ? 'bg-brand-50 text-brand-800 font-medium' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate pr-2">{item}</span>
                  {isExactMatch && <Check className="w-3 h-3 text-slate-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {helperText && (
        <p className="mt-0.5 text-[10px] text-slate-400">{helperText}</p>
      )}
    </div>
  );
};
