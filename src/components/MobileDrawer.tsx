import React, { useState, useEffect } from 'react';
import { 
  Building2,
  Pin,
  Inbox,
  FolderKanban,
  Layers,
  BookOpen,
  Archive,
  Book,
  FileText,
  Star,
  Bell,
  CheckSquare,
  Calendar,
  Boxes,
  Share2,
  HardDrive,
  ChevronDown,
  ChevronRight,
  Plus,
  Sparkles,
  X,
  ShieldCheck
} from 'lucide-react';
import { ViewMode, AppNote, ObjectTypeDefinition, AppObject } from '../lib/types';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
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
    inbox?: number;
    areas?: number;
    archives?: number;
  };
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  currentView,
  onSelectView,
  notes,
  selectedNoteId,
  onSelectNote,
  onTogglePinNote,
  objects,
  objectTypes,
  activeObjectType,
  onSelectObjectType,
  onCreateCustomType,
  counts
}) => {
  // Collapsible section states (persisted)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('sc_mobile_drawer_groups');
      return saved ? JSON.parse(saved) : {
        capture: false,
        knowledge: false,
        planning: false,
        media: false,
        objectTypes: true,
        pinned: false
      };
    } catch {
      return {
        capture: false,
        knowledge: false,
        planning: false,
        media: false,
        objectTypes: true,
        pinned: false
      };
    }
  });

  const toggleSection = (sec: string) => {
    setCollapsedSections(prev => {
      const next = { ...prev, [sec]: !prev[sec] };
      try {
        localStorage.setItem('sc_mobile_drawer_groups', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const pinnedNotes = notes.filter(n => n.is_pinned);

  const handleNav = (view: ViewMode) => {
    onSelectView(view);
    onClose();
  };

  // Keyboard navigation & Escape
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
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex" role="dialog" aria-modal="true" aria-label="Navegación Móvil">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" 
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <aside 
        className="relative w-4/5 max-w-xs bg-[#141419] border-r border-[#242434] h-full flex flex-col z-10 shadow-2xl overflow-hidden select-none animate-in slide-in-from-left duration-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Drawer Header */}
        <div className="p-3.5 border-b border-[#23232f] flex items-center justify-between bg-[#121217] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-900/30 flex-shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Segundo Cerebro</h2>
              <p className="text-[10px] text-gray-400">PKM & Productividad</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-[#1c1c24] border border-[#2b2b38]"
            aria-label="Cerrar panel de navegación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3.5 no-scrollbar">

          {/* 1. SECCIÓN: CAPTURA & ORGANIZACIÓN (SISTEMA PARA) */}
          <div>
            <div 
              onClick={() => toggleSection('capture')}
              className="flex items-center justify-between py-1 px-1 cursor-pointer select-none text-[10px] font-bold tracking-wider uppercase text-amber-400/90"
            >
              <span className="flex items-center gap-1.5">
                <Inbox className="w-3.5 h-3.5" />
                <span>Captura & PARA</span>
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsedSections.capture ? '-rotate-90' : 'rotate-0'}`} />
            </div>

            {!collapsedSections.capture && (
              <div className="mt-1 space-y-0.5">
                {/* Capturar / Inbox */}
                <button
                  type="button"
                  onClick={() => handleNav('para_inbox')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'para_inbox' ? 'bg-amber-600/20 text-amber-300 font-semibold border border-amber-500/30' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Inbox className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span className="truncate">Capturar (Inbox)</span>
                  </span>
                  {counts.inbox !== undefined && counts.inbox > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1e1e2c] text-amber-300 flex-shrink-0">
                      {counts.inbox}
                    </span>
                  )}
                </button>

                {/* Proyectos (Entrada UNIFICADA) */}
                <button
                  type="button"
                  onClick={() => handleNav('projects')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'projects' || currentView === 'para_projects' ? 'bg-blue-600/20 text-blue-300 font-semibold border border-blue-500/30' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <FolderKanban className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="truncate">Proyectos</span>
                  </span>
                  {counts.projects > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1e1e2c] text-gray-400 flex-shrink-0">
                      {counts.projects}
                    </span>
                  )}
                </button>

                {/* Áreas */}
                <button
                  type="button"
                  onClick={() => handleNav('para_areas')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'para_areas' ? 'bg-purple-600/20 text-purple-300 font-semibold border border-purple-500/30' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Layers className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span className="truncate">Áreas</span>
                  </span>
                  {counts.areas !== undefined && counts.areas > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1e1e2c] text-gray-400 flex-shrink-0">
                      {counts.areas}
                    </span>
                  )}
                </button>

                {/* Recursos */}
                <button
                  type="button"
                  onClick={() => handleNav('para_resources')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'para_resources' ? 'bg-emerald-600/20 text-emerald-300 font-semibold border border-emerald-500/30' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <BookOpen className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="truncate">Recursos</span>
                  </span>
                  {counts.objects > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1e1e2c] text-gray-400 flex-shrink-0">
                      {counts.objects}
                    </span>
                  )}
                </button>

                {/* Archivo */}
                <button
                  type="button"
                  onClick={() => handleNav('para_archives')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'para_archives' ? 'bg-gray-700/30 text-gray-200 font-semibold border border-gray-600/30' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Archive className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="truncate">Archivo</span>
                  </span>
                  {counts.archives !== undefined && counts.archives > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1e1e2c] text-gray-400 flex-shrink-0">
                      {counts.archives}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* 2. SECCIÓN: CONOCIMIENTO (Cuadernos, Notas, Entidades, Grafo) */}
          <div>
            <div 
              onClick={() => toggleSection('knowledge')}
              className="flex items-center justify-between py-1 px-1 cursor-pointer select-none text-[10px] font-bold tracking-wider uppercase text-purple-400/90"
            >
              <span className="flex items-center gap-1.5">
                <Book className="w-3.5 h-3.5" />
                <span>Conocimiento</span>
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsedSections.knowledge ? '-rotate-90' : 'rotate-0'}`} />
            </div>

            {!collapsedSections.knowledge && (
              <div className="mt-1 space-y-0.5">
                {/* Cuadernos */}
                <button
                  type="button"
                  onClick={() => handleNav('notebooks')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'notebooks' ? 'bg-blue-600/20 text-blue-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Book className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="truncate">Cuadernos</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">{counts.notebooks}</span>
                </button>

                {/* Todas las Notas */}
                <button
                  type="button"
                  onClick={() => handleNav('all_notes')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'all_notes' || currentView === 'notes' ? 'bg-purple-600/20 text-purple-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span className="truncate">Todas las notas</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">{counts.notes}</span>
                </button>

                {/* Favoritos */}
                <button
                  type="button"
                  onClick={() => handleNav('favorites')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'favorites' ? 'bg-amber-600/20 text-amber-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span className="truncate">Favoritos</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">{counts.favorites}</span>
                </button>

                {/* Objetos y Entidades */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectObjectType('all');
                    handleNav('objects');
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'objects' ? 'bg-emerald-600/20 text-emerald-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Boxes className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="truncate">Objetos & Entidades</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">{counts.objects}</span>
                </button>

                {/* Vista de Grafo */}
                <button
                  type="button"
                  onClick={() => handleNav('graph')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'graph' ? 'bg-indigo-600/20 text-indigo-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Share2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span className="truncate">Grafo de Red</span>
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* 3. SECCIÓN: PLANIFICACIÓN & ACCIÓN (Tareas, Calendario, Recordatorios) */}
          <div>
            <div 
              onClick={() => toggleSection('planning')}
              className="flex items-center justify-between py-1 px-1 cursor-pointer select-none text-[10px] font-bold tracking-wider uppercase text-blue-400/90"
            >
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Planificación</span>
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsedSections.planning ? '-rotate-90' : 'rotate-0'}`} />
            </div>

            {!collapsedSections.planning && (
              <div className="mt-1 space-y-0.5">
                {/* Tareas */}
                <button
                  type="button"
                  onClick={() => handleNav('tasks')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'tasks' ? 'bg-purple-600/20 text-purple-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <CheckSquare className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span className="truncate">Tareas (Kanban)</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">{counts.tasks}</span>
                </button>

                {/* Calendario */}
                <button
                  type="button"
                  onClick={() => handleNav('calendar')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'calendar' ? 'bg-blue-600/20 text-blue-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Calendar className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="truncate">Calendario</span>
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1e1e28] text-gray-400 border border-[#2b2b3a]">
                    Agenda
                  </span>
                </button>

                {/* Recordatorios */}
                <button
                  type="button"
                  onClick={() => handleNav('reminders')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'reminders' ? 'bg-pink-600/20 text-pink-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Bell className="w-4 h-4 text-pink-400 flex-shrink-0" />
                    <span className="truncate">Recordatorios</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">{counts.reminders}</span>
                </button>

                {/* Revisión Periódica */}
                <button
                  type="button"
                  onClick={() => handleNav('para_review')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'para_review' ? 'bg-cyan-600/20 text-cyan-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span className="truncate">Revisión Periódica</span>
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300">
                    Auditar
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* 4. SECCIÓN: ARCHIVOS & MEDIOS */}
          <div>
            <div 
              onClick={() => toggleSection('media')}
              className="flex items-center justify-between py-1 px-1 cursor-pointer select-none text-[10px] font-bold tracking-wider uppercase text-cyan-400/90"
            >
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5" />
                <span>Archivos & Medios</span>
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsedSections.media ? '-rotate-90' : 'rotate-0'}`} />
            </div>

            {!collapsedSections.media && (
              <div className="mt-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => handleNav('files')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'files' ? 'bg-cyan-600/20 text-cyan-300 font-semibold border border-cyan-500/40' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <HardDrive className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span className="truncate">Archivos y Medios</span>
                  </span>
                  <span className="text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-800/40 px-1.5 py-0.2 rounded font-mono">
                    R2
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* 5. SECCIÓN OPCIONAL: TIPOS DE OBJETO PERSONALIZADOS */}
          {objectTypes.length > 0 && (
            <div className="pt-1 border-t border-[#232332]">
              <div 
                onClick={() => toggleSection('objectTypes')}
                className="flex items-center justify-between py-1 px-1 cursor-pointer select-none text-[10px] font-bold tracking-wider uppercase text-emerald-400"
              >
                <span className="flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5" />
                  <span>Tipos de Objeto ({objectTypes.length})</span>
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsedSections.objectTypes ? '-rotate-90' : 'rotate-0'}`} />
              </div>

              {!collapsedSections.objectTypes && (
                <div className="mt-1 space-y-0.5 pl-1">
                  {objectTypes.map(t => {
                    const typeCount = objects.filter(o => o.object_type === t.id).length;
                    const isSelected = currentView === 'objects' && activeObjectType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          onSelectObjectType(t.id);
                          handleNav('objects');
                        }}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition ${
                          isSelected 
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-medium' 
                            : 'text-gray-300 hover:bg-[#1a1a24]'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span 
                            className="w-2 h-2 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: t.color || '#10b981' }} 
                          />
                          <span className="truncate">{t.name}</span>
                        </span>
                        <span className="text-[10px] font-mono text-gray-500">{typeCount}</span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onCreateCustomType();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 mt-1.5 rounded-lg text-xs text-purple-300 bg-purple-950/30 hover:bg-purple-900/40 border border-purple-800/40 transition font-medium"
                  >
                    <Plus className="w-3 h-3 text-purple-400" />
                    <span>Crear Tipo Personalizado</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 6. NOTAS FIJADAS (si existen) */}
          {pinnedNotes.length > 0 && (
            <div className="pt-1 border-t border-[#232332]">
              <div 
                onClick={() => toggleSection('pinned')}
                className="flex items-center justify-between py-1 px-1 cursor-pointer select-none text-[10px] font-bold tracking-wider uppercase text-amber-300"
              >
                <span className="flex items-center gap-1.5">
                  <Pin className="w-3.5 h-3.5" />
                  <span>Fijadas ({pinnedNotes.length})</span>
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsedSections.pinned ? '-rotate-90' : 'rotate-0'}`} />
              </div>

              {!collapsedSections.pinned && (
                <div className="mt-1 space-y-0.5">
                  {pinnedNotes.map(n => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        onSelectNote(n.id);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition truncate ${
                        selectedNoteId === n.id ? 'bg-purple-900/40 text-purple-200 font-semibold' : 'text-gray-300 hover:bg-[#1a1a24]'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <FileText className="w-3 h-3 text-purple-400 flex-shrink-0" />
                        <span className="truncate">{n.title || 'Sin título'}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-[#23232f] bg-[#111116] flex items-center justify-between text-[11px] text-gray-400 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>InsForge BaaS + R2</span>
          </div>
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        </div>
      </aside>
    </div>
  );
};
