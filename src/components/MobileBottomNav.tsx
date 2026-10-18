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
  Sparkles
} from 'lucide-react';
import { ViewMode } from '../lib/types';

interface MobileBottomNavProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  onOpenQuickCreate: (type: 'note' | 'task' | 'page' | 'project' | 'person' | 'object') => void;
  onOpenSearch: () => void;
  isEditorOpen?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onSelectView,
  onOpenQuickCreate,
  onOpenSearch,
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

  // Creation options for Capacities-style "+" button
  const createOptions: {
    id: 'note' | 'task' | 'page' | 'project' | 'person' | 'object';
    label: string;
    subtitle: string;
    icon: any;
    color: string;
    bg: string;
  }[] = [
    {
      id: 'note',
      label: 'Nueva Nota',
      subtitle: 'Texto enriquecido y Markdown',
      icon: FileText,
      color: 'text-purple-400',
      bg: 'bg-purple-950/40 border-purple-800/40'
    },
    {
      id: 'task',
      label: 'Nueva Tarea',
      subtitle: 'Kanban y lista operativa',
      icon: CheckSquare,
      color: 'text-amber-400',
      bg: 'bg-amber-950/40 border-amber-800/40'
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
      subtitle: 'Objetivo con fecha límite',
      icon: FolderKanban,
      color: 'text-blue-400',
      bg: 'bg-blue-950/40 border-blue-800/40'
    },
    {
      id: 'person',
      label: 'Nuevo Contacto',
      subtitle: 'Ficha personal & cumpleaños',
      icon: User,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/40 border-emerald-800/40'
    },
    {
      id: 'object',
      label: 'Nuevo Objeto / Entidad',
      subtitle: 'Recurso, libro o personalizado',
      icon: Boxes,
      color: 'text-pink-400',
      bg: 'bg-pink-950/40 border-pink-800/40'
    }
  ];

  return (
    <>
      {/* Create Sheet / Menu Overlay for Mobile */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end lg:hidden animate-in fade-in duration-150">
          <div 
            ref={menuRef}
            className="bg-[#181822] border-t border-[#2e2e42] rounded-t-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#252538]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Crear Nuevo Elemento</h3>
                  <p className="text-[10px] text-gray-400">Selecciona el tipo de contenido a registrar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-[#20202e] border border-[#2c2c3e]"
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

      {/* Fixed Bottom Navigation Bar */}
      <nav 
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#141419]/95 backdrop-blur-md border-t border-[#23232c] flex items-center justify-around px-2 shadow-2xl select-none"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          height: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))'
        }}
      >
        {/* 1. Inicio */}
        <button
          type="button"
          onClick={() => onSelectView('home')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition active:scale-95 ${
            isHomeActive ? 'text-purple-400 font-bold' : 'text-gray-400 hover:text-gray-200'
          }`}
          aria-label="Ir a Inicio"
        >
          <Home className={`w-5 h-5 mb-0.5 ${isHomeActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] leading-none">Inicio</span>
        </button>

        {/* 2. Calendario */}
        <button
          type="button"
          onClick={() => onSelectView('calendar')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition active:scale-95 ${
            isCalendarActive ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-gray-200'
          }`}
          aria-label="Ir a Calendario"
        >
          <Calendar className={`w-5 h-5 mb-0.5 ${isCalendarActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] leading-none">Calendario</span>
        </button>

        {/* 3. Botón Central Nuevo (+) Estilo Capacities */}
        <div className="flex-1 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setIsMenuOpen(prev => !prev)}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-purple-900/40 active:scale-95 transition transform -translate-y-1.5 border border-white/20"
            title="Crear nota, tarea, página u objeto"
            aria-label="Crear nuevo elemento"
          >
            <Plus className={`w-6 h-6 transition-transform duration-200 ${isMenuOpen ? 'rotate-45' : 'rotate-0'}`} />
          </button>
        </div>

        {/* 4. Tareas */}
        <button
          type="button"
          onClick={() => onSelectView('tasks')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition active:scale-95 ${
            isTasksActive ? 'text-amber-400 font-bold' : 'text-gray-400 hover:text-gray-200'
          }`}
          aria-label="Ir a Tareas"
        >
          <CheckSquare className={`w-5 h-5 mb-0.5 ${isTasksActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] leading-none">Tareas</span>
        </button>

        {/* 5. Buscar */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex flex-col items-center justify-center flex-1 py-1 text-gray-400 hover:text-gray-200 transition active:scale-95"
          aria-label="Búsqueda global"
        >
          <Search className="w-5 h-5 mb-0.5 stroke-2" />
          <span className="text-[10px] leading-none">Buscar</span>
        </button>
      </nav>
    </>
  );
};
