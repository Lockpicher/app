import React, { useRef } from 'react';
import { Calendar as CalendarIcon, X, Cake } from 'lucide-react';
import { formatBirthdayDisplay, calculateAge } from '../lib/birthdays';

interface DatePickerInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isBirthday?: boolean;
  className?: string;
  compact?: boolean;
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  value,
  onChange,
  placeholder = 'YYYY-MM-DD',
  isBirthday = false,
  className = '',
  compact = false
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const openCalendar = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (inputRef.current) {
      try {
        if ('showPicker' in HTMLInputElement.prototype && typeof inputRef.current.showPicker === 'function') {
          inputRef.current.showPicker();
        } else {
          inputRef.current.focus();
        }
      } catch {
        inputRef.current.focus();
      }
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange('');
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const age = isBirthday && value ? calculateAge(value) : null;
  const formattedText = value ? formatBirthdayDisplay(value) : '';

  if (compact) {
    return (
      <div className={`flex flex-col gap-1 w-full mt-0.5 ${className}`}>
        <div className="flex items-center gap-1.5 w-full">
          {/* Native visible interactive date input */}
          <div className="relative flex-1 min-w-0 flex items-center">
            <input
              ref={inputRef}
              type="date"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              onClick={() => {
                try {
                  inputRef.current?.showPicker?.();
                } catch {
                  // Fallback
                }
              }}
              className="w-full bg-[#14141c] hover:bg-[#1c1c2a] focus:bg-[#1c1c2a] border border-[#2c2c40] focus:border-blue-500 rounded-lg px-2 py-1 text-xs text-white outline-none cursor-pointer [color-scheme:dark] transition font-sans"
              title={isBirthday ? 'Toca para abrir calendario de cumpleaños' : 'Toca para abrir calendario'}
            />
          </div>

          {/* Quick Calendar icon button */}
          <button
            type="button"
            onClick={openCalendar}
            className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition flex-shrink-0"
            title="Abrir selector de calendario"
          >
            {isBirthday ? (
              <Cake className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <CalendarIcon className="w-3.5 h-3.5 text-blue-400" />
            )}
          </button>

          {/* Clear button */}
          {value ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition flex-shrink-0"
              title="Borrar fecha"
            >
              <X className="w-3 h-3" />
            </button>
          ) : null}
        </div>

        {/* Human-readable badge when a date is selected */}
        {value && (
          <div className="flex items-center gap-1 text-[10px] text-gray-300 truncate">
            <span className="truncate text-amber-200/90 font-medium">{formattedText}</span>
            {age !== null && (
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold flex-shrink-0">
                🎂 {age} a
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full layout (modals, forms)
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      <div className="flex items-center gap-2 w-full">
        <div className="relative flex-1 flex items-center">
          <input
            ref={inputRef}
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onClick={() => {
              try {
                inputRef.current?.showPicker?.();
              } catch {
                // Fallback
              }
            }}
            className="w-full bg-[#14141c] hover:bg-[#1a1a24] focus:bg-[#1a1a24] border border-[#2a2a3c] focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none cursor-pointer [color-scheme:dark] transition shadow-inner font-sans"
            title={isBirthday ? 'Toca para abrir calendario de cumpleaños' : 'Toca para abrir calendario'}
          />
        </div>

        <button
          type="button"
          onClick={openCalendar}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition shadow-sm flex-shrink-0"
          title="Abrir calendario"
        >
          {isBirthday ? <Cake className="w-3.5 h-3.5 text-amber-400" /> : <CalendarIcon className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">Calendario</span>
        </button>

        {value ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-2 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition flex-shrink-0 border border-[#2a2a3c]"
            title="Borrar fecha"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {value && (
        <div className="flex items-center gap-2 text-xs text-gray-300 px-1">
          <span className="text-amber-200 font-semibold">{formattedText}</span>
          {age !== null && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[11px]">
              🎂 {age} años
            </span>
          )}
        </div>
      )}
    </div>
  );
};
