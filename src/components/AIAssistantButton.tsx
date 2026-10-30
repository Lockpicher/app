import React from 'react';
import { Sparkles, Bot } from 'lucide-react';
import { useAI } from '../context/AIContext';

export const AIAssistantButton: React.FC = () => {
  const { isAIDrawerOpen, toggleAIDrawer, activeContext, providerStatus } = useAI();

  return (
    <div className="fixed z-40 bottom-20 md:bottom-6 right-4 md:right-6 select-none group">
      {/* Floating Button with Evernote-inspired Sparkles */}
      <button
        type="button"
        onClick={toggleAIDrawer}
        className={`relative flex items-center gap-2.5 px-4 py-3 rounded-full shadow-2xl transition-all duration-300 transform active:scale-95 border ${
          isAIDrawerOpen
            ? 'bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 text-white border-amber-400/50 shadow-purple-500/40 ring-4 ring-purple-500/20 scale-105'
            : 'bg-[#181825]/95 hover:bg-[#202030] text-gray-200 hover:text-white border-[#3b3b55] hover:border-amber-400/60 shadow-black/60 hover:shadow-amber-500/20'
        } backdrop-blur-md`}
        title="Asistente de Inteligencia Artificial (Segundo Cerebro)"
        aria-label="Abrir asistente de IA"
      >
        {/* Animated aura pulse behind the icon */}
        <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-amber-500/30 to-purple-500/30 blur-sm opacity-70 group-hover:opacity-100 transition duration-300 -z-10" />

        <div className="relative flex items-center justify-center">
          <Sparkles className={`w-5 h-5 ${isAIDrawerOpen ? 'text-amber-200 animate-spin-slow' : 'text-amber-400 group-hover:text-amber-300'} transition-transform duration-300 group-hover:scale-110`} />
          {providerStatus && !providerStatus.configured && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-[#181825]" title="Configuración de IA pendiente" />
          )}
        </div>

        <span className="text-xs font-semibold tracking-wide hidden sm:inline-block">
          Asistente IA
        </span>

        {/* Small active context indicator pill */}
        {activeContext.type !== 'general' && (
          <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-400/20 text-amber-300 border border-amber-400/30 max-w-[120px] truncate">
            {activeContext.title || activeContext.type}
          </span>
        )}
      </button>
    </div>
  );
};
