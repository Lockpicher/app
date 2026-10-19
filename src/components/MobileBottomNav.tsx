import React, { useState, useRef, useEffect } from 'react';
import { 
  Home, 
  Calendar, 
  CheckSquare, 
  Plus, 
  Search, 
  FileText, 
  FolderKanban, 
  User, 
  Boxes, 
  Layers, 
  Book, 
  X,
  Sparkles,
  Menu,
  MoreHorizontal,
  Paperclip
} from 'lucide-react';
import { ViewMode } from '../lib/types';

interface MobileBottomNavProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  onOpenQuickCreate: (type: 'note' | 'task' | 'page' | 'project' | 'notebook' | 'person' | 'object' | 'file') => void;
  onOpenSearch: () => void;
  onOpenMore?: () => void;
  isMoreOpen?: boolean;
  isEditorOpen?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onSelectView,
  onOpenQuickCreate,
  onOpenSearch,
  onOpenMore,
  isMoreOpen = false,
  isEditorOpen = false
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close create menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Determine active states
  const isHomeActive = currentView === 'home';
  const isCalendarActive = currentView === 'calendar';
  const isTasksActive = currentView === 'tasks';

  // Creation options for Capacities-style "+" button (8 items in 2x4 grid)
  const createOptions: {
    id: 'note' | 'task' | 'page' | 'project' | 'notebook' | 'person' | 'object' | 'file';
    label: string;
    subtitle: string;
    icon: any;
    color: string;
    bg: string;
  }[] = [
    {
      id: 'note',
      label: 'Nueva Nota',
      subtitle: 'Editor de texto enriquecido',
      icon: FileText,
      color: 'text-purple-400',
      bg: 'bg-purple-950/40 border-purple-800/40'
    },
    {
      id: 'task',
      label: 'Nueva Tarea',
      subtitle: 'Crear tarea en la lista y Kanban',
      icon: CheckSquare,
      color: 'text-amber-400',
      bg: 'bg-amber-950/40 border-amber-800/40'
    },
    {
      id: 'file',
      label: 'Adjuntar archivo',
      subtitle: 'Subir archivos a tu biblioteca',
      icon: Paperclip,
      color: 'text-cyan-400',
      bg: 'bg-cyan-950/40 border-cyan-800/40'
    },
    {
      id: 'notebook',
      label: 'Nuevo Cuaderno',
      subtitle: 'Organizador de notas por tema',
      icon: Book,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/40 border-emerald-800/40'
    },
    {
      id: 'page',
      label: 'Nueva Página',
      subtitle: 'Documento estructurado & portada',
      icon: Layers,
      color: 'text-indigo-400',
      bg: 'bg-indigo-950/40 border-indigo-800/40'
    },
    {
      id: 'project',
      label: 'Nuevo Proyecto',
      subtitle: 'Objetivo con fechas y tareas',
      icon: FolderKanban,
      color: 'text-blue-400',
      bg: 'bg-blue-950/40 border-blue-800/40'
    },
    {
      id: 'person',
      label: 'Nuevo Contacto',
      subtitle: 'Ficha personal & cumpleaños',
      icon: User,
      color: 'text-teal-400',
      bg: 'bg-teal-950/40 border-teal-800/40'
    },
    {
      id: 'object',
      label: 'Nuevo Objeto',
      subtitle: 'Entidad personalizada o recurso',
      icon: Boxes,
      color: 'text-pink-400',
      bg: 'bg-pink-950/40 border-pink-800/40'
    }
  ];

  return (
    <>
      {/* Create Sheet / Menu Overlay for Mobile */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end lg:hidden animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-label="Menú de creación rápida"
        >
          <div 
            ref={menuRef}
            className="bg-[#181822] border-t border-[#2e2e42] rounded-t-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#252538]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Crear Nuevo Elemento</h3>
                  <p className="text-[10px] text-gray-400">Selecciona qué deseas añadir a tu Segundo Cerebro</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-[#20202e] border border-[#2c2c3e] transition"
                aria-label="Cerrar menú de creación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {createOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenQuickCreate(opt.id);
                    }}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between group active:scale-[0.98] ${opt.bg}`}
                    aria-label={`Crear ${opt.label}`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className={`w-8 h-8 rounded-xl bg-[#14141c] border border-white/10 flex items-center justify-center ${opt.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <Plus className="w-3.5 h-3.5 text-gray-500 group-hover:text-white transition" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-white block">{opt.label}</span>
                      <span className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{opt.subtitle}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar (64px + safe-area, 48px touch targets, 56px elevated FAB) */}
      <nav 
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#141419]/95 backdrop-blur-md border-t border-[#23232c] flex items-center justify-between px-3 shadow-2xl select-none"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          height: 'calc(64px + env(safe-area-inset-bottom, 0px))'
        }}
        aria-label="Navegación inferior"
      >
        {/* 1. Inicio */}
        <button
          type="button"
          onClick={() => onSelectView('home')}
          className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] flex-1 py-1 transition active:scale-95 ${
            isHomeActive ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-gray-200'
          }`}
          aria-label="Ir a Inicio"
          aria-current={isHomeActive ? 'page' : undefined}
        >
          <Home className={`w-6 h-6 mb-1 ${isHomeActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[12px] leading-none">Inicio</span>
        </button>

        {/* 2. Calendario */}
        <button
          type="button"
          onClick={() => onSelectView('calendar')}
          className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] flex-1 py-1 transition active:scale-95 ${
            isCalendarActive ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-gray-200'
          }`}
          aria-label="Ir a Calendario"
          aria-current={isCalendarActive ? 'page' : undefined}
        >
          <Calendar className={`w-6 h-6 mb-1 ${isCalendarActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[12px] leading-none">Calendario</span>
        </button>

        {/* 3. FAB Central Elevado (56px, elevado ~20px sobre la barra) */}
        <div className="flex-1 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setIsMenuOpen(prev => !prev)}
            className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-xl shadow-blue-900/50 active:scale-95 transition-transform transform -translate-y-5 border-2 border-[#141419]"
            title="Crear nueva tarea, nota, cuaderno, página u objeto"
            aria-label="Crear nuevo elemento"
            aria-expanded={isMenuOpen}
            aria-haspopup="dialog"
          >
            <Plus className={`w-7 h-7 stroke-[2.5] transition-transform duration-200 ${isMenuOpen ? 'rotate-45' : 'rotate-0'}`} />
          </button>
        </div>

        {/* 4. Tareas */}
        <button
          type="button"
          onClick={() => onSelectView('tasks')}
          className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] flex-1 py-1 transition active:scale-95 ${
            isTasksActive ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-gray-200'
          }`}
          aria-label="Ir a Tareas"
          aria-current={isTasksActive ? 'page' : undefined}
        >
          <CheckSquare className={`w-6 h-6 mb-1 ${isTasksActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[12px] leading-none">Tareas</span>
        </button>

        {/* 5. Más (reemplaza a Buscar y al menú hamburguesa) */}
        <button
          type="button"
          onClick={() => {
            if (onOpenMore) onOpenMore();
          }}
          className={`flex flex-col items-center justify-center min-w-[48px] min-h-[48px] flex-1 py-1 transition active:scale-95 ${
            isMoreOpen ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-gray-200'
          }`}
          aria-label="Abrir menú Más"
          aria-expanded={isMoreOpen}
        >
          <Menu className={`w-6 h-6 mb-1 ${isMoreOpen ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[12px] leading-none">Más</span>
        </button>
      </nav>
    </>
  );
};
