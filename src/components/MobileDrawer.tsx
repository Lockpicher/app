import React, { useState, useEffect, useRef } from 'react';
import { 
  Inbox,
  FolderKanban,
  Layers,
  BookOpen,
  Archive,
  FileText,
  Book,
  Star,
  Boxes,
  Share2,
  Bell,
  Sparkles,
  HardDrive,
  Pin,
  Sun,
  Moon,
  Settings,
  ChevronRight,
  Flame,
  X,
  User,
  ShieldCheck,
  Palette
} from 'lucide-react';
import { ViewMode, AppNote, ObjectTypeDefinition, AppObject } from '../lib/types';
import { useTheme } from '../lib/themeContext';
import { auth, AuthUser } from '../lib/auth';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth?: () => void;
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  notes: AppNote[];
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  onTogglePinNote?: (noteId: string) => void;
  objects: AppObject[];
  objectTypes: ObjectTypeDefinition[];
  activeObjectType: string;
  onSelectObjectType: (typeId: string) => void;
  onCreateCustomType: () => void;
  counts: {
    notebooks: number;
    notes: number;
    favorites: number;
    reminders: number;
    tasks: number;
    projects: number;
    objects: number;
    canvases?: number;
    habits?: number;
    inbox?: number;
    areas?: number;
    archives?: number;
  };
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  onOpenAuth,
  currentView,
  onSelectView,
  notes,
  selectedNoteId,
  onSelectNote,
  objects,
  objectTypes,
  activeObjectType,
  onSelectObjectType,
  counts
}) => {
  const { theme, toggleTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    return auth.onAuthStateChanged((u) => setCurrentUser(u));
  }, []);

  // Touch drag state to swipe down to dismiss
  const [dragOffset, setDragOffset] = useState(0);
  const touchStartYRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handleNav = (view: ViewMode) => {
    onSelectView(view);
    onClose();
  };

  // Keyboard navigation & Escape key handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
      setDragOffset(0);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Touch handlers for swipe down to close
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartYRef.current;
    if (deltaY > 0) {
      setDragOffset(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (dragOffset > 90) {
      onClose();
    }
    setDragOffset(0);
  };

  if (!isOpen) return null;

  // Row render helper: strictly 48px height minimum with touch targets
  const renderRow = (
    view: ViewMode,
    label: string,
    icon: React.ReactNode,
    count?: number,
    activeCondition?: boolean
  ) => {
    const isActive = activeCondition !== undefined ? activeCondition : currentView === view;

    return (
      <button
        key={view}
        type="button"
        onClick={() => handleNav(view)}
        className={`w-full h-12 min-h-[48px] px-3 rounded-xl flex items-center justify-between text-sm transition active:scale-[0.99] ${
          isActive 
            ? 'bg-blue-600/15 text-blue-300 font-semibold border border-blue-500/30' 
            : 'text-gray-300 hover:bg-[#1c1c24] active:bg-[#22222e]'
        }`}
      >
        <span className="flex items-center gap-3 truncate">
          <span className="flex-shrink-0">{icon}</span>
          <span className="truncate">{label}</span>
        </span>

        {count !== undefined && count > 0 && (
          <span className={`text-xs font-mono px-2 py-0.5 rounded-full flex-shrink-0 ${
            isActive ? 'bg-blue-950 text-blue-300 border border-blue-800/40' : 'bg-[#1e1e28] text-gray-400'
          }`}>
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Menú Más">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" 
        aria-hidden="true"
      />

      {/* Bottom Sheet Container */}
      <div 
        style={{
          transform: `translateY(${dragOffset}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 200ms ease-out',
          maxHeight: '88dvh',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)'
        }}
        className="relative w-full bg-[#141419] border-t border-[#242434] rounded-t-3xl flex flex-col z-10 shadow-2xl overflow-hidden select-none animate-in slide-in-from-bottom duration-200"
      >
        {/* Grab Handle Header */}
        <div 
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="pt-3 pb-2 px-4 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing border-b border-[#20202a] flex-shrink-0"
        >
          {/* Visual grab bar */}
          <div className="w-12 h-1.5 rounded-full bg-gray-600 mb-2.5" />
          
          <div className="w-full flex items-center justify-between">
            <h3 className="text-sm font-bold text-white tracking-wide">Más opciones</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-[#1c1c24] transition"
              aria-label="Cerrar hoja de opciones"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Rows Body */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 no-scrollbar">

          {/* Grupo 1: Captura & Organización (SISTEMA PARA) */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-gray-400 px-3 block mb-1">
              Captura & PARA
            </span>
            {renderRow('para_inbox', 'Capturar (Inbox)', <Inbox className="w-5 h-5 text-amber-400" />, counts.inbox)}
            {renderRow('projects', 'Proyectos', <FolderKanban className="w-5 h-5 text-blue-400" />, counts.projects, currentView === 'projects' || currentView === 'para_projects')}
            {renderRow('para_areas', 'Áreas', <Layers className="w-5 h-5 text-purple-400" />, counts.areas)}
            {renderRow('para_resources', 'Recursos', <BookOpen className="w-5 h-5 text-emerald-400" />, counts.objects)}
            {renderRow('para_archives', 'Archivo', <Archive className="w-5 h-5 text-gray-400" />, counts.archives)}
          </div>

          <div className="border-t border-[#20202c]" />

          {/* Grupo 2: Conocimiento */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-gray-400 px-3 block mb-1">
              Conocimiento
            </span>
            {renderRow('all_notes', 'Todas las notas', <FileText className="w-5 h-5 text-purple-400" />, counts.notes, currentView === 'all_notes' || currentView === 'notes')}
            {renderRow('notebooks', 'Cuadernos', <Book className="w-5 h-5 text-blue-400" />, counts.notebooks)}
            {renderRow('canvases', 'Lienzos visuales', <Palette className="w-5 h-5 text-pink-400" />, counts.canvases, currentView === 'canvases' || currentView === 'canvas')}
            {renderRow('favorites', 'Favoritos', <Star className="w-5 h-5 text-amber-400" />, counts.favorites)}
            {renderRow('objects', 'Objetos y Entidades', <Boxes className="w-5 h-5 text-emerald-400" />, counts.objects)}
            {renderRow('graph', 'Grafo de Red', <Share2 className="w-5 h-5 text-indigo-400" />)}
          </div>

          <div className="border-t border-[#20202c]" />

          {/* Grupo 3: Planificación & Almacenamiento */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-gray-400 px-3 block mb-1">
              Gestión & Medios
            </span>
            {renderRow('habits', 'Hábitos & Rutinas', <Flame className="w-5 h-5 text-amber-400" />, counts.habits)}
            {renderRow('reminders', 'Recordatorios', <Bell className="w-5 h-5 text-amber-400" />, counts.reminders)}
            {renderRow('para_review', 'Revisión periódica', <Sparkles className="w-5 h-5 text-cyan-400" />)}
            {renderRow('files', 'Archivos y medios', <HardDrive className="w-5 h-5 text-cyan-400" />)}
          </div>

          <div className="border-t border-[#20202c]" />

          {/* Grupo 4: Ajustes y Tema */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-gray-400 px-3 block mb-1">
              Preferencias
            </span>
            
            {/* Toggle Tema Claro / Oscuro */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-full h-12 min-h-[48px] px-3 rounded-xl flex items-center justify-between text-sm text-gray-300 hover:bg-[#1c1c24] active:bg-[#22222e] transition"
            >
              <span className="flex items-center gap-3">
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 text-amber-400 flex-shrink-0" />
                ) : (
                  <Moon className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                )}
                <span>Tema: {theme === 'dark' ? 'Oscuro' : 'Claro'}</span>
              </span>
              <span className="text-xs text-blue-400 font-medium">Cambiar</span>
            </button>

            {/* Cuenta / Iniciar Sesión */}
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenAuth) onOpenAuth();
              }}
              className="w-full h-12 min-h-[48px] px-3 rounded-xl flex items-center justify-between text-sm text-gray-300 hover:bg-[#1c1c24] active:bg-[#22222e] transition"
            >
              <span className="flex items-center gap-3 overflow-hidden">
                <div className="w-6 h-6 rounded-full bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                  {currentUser?.email ? (currentUser.name ? currentUser.name.charAt(0).toUpperCase() : currentUser.email.charAt(0).toUpperCase()) : <User className="w-3.5 h-3.5" />}
                </div>
                <div className="text-left overflow-hidden min-w-0">
                  <span className="block truncate text-xs text-white">
                    {currentUser?.name || currentUser?.email || 'Iniciar Sesión'}
                  </span>
                  <span className="block text-[10px] text-gray-400">
                    {currentUser ? 'Cuenta sincronizada' : 'Acceder a tu cuenta'}
                  </span>
                </div>
              </span>
              <span className="text-xs text-purple-400 font-medium flex-shrink-0">
                {currentUser ? 'Perfil' : 'Entrar'}
              </span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
