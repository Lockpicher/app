import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FileText, 
  CheckSquare, 
  FolderKanban, 
  Boxes, 
  Share2, 
  HardDrive, 
  Plus, 
  Search, 
  Pin, 
  Database,
  Sparkles,
  User,
  ShieldCheck,
  Book,
  Star,
  Bell,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Inbox,
  Archive,
  BookOpen,
  X
} from 'lucide-react';
import { ViewMode, AppNote, ObjectTypeDefinition, AppObject } from '../lib/types';
import { auth, AuthUser } from '../lib/auth';

interface SidebarProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  notes: AppNote[];
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  onNewTaskNote?: () => void;
  onNewNotebook?: () => void;
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
  onOpenQuickSwitcher: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  objectTypes?: ObjectTypeDefinition[];
  activeObjectType?: string;
  onSelectObjectType?: (typeId: string) => void;
  objects?: AppObject[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  notes,
  selectedNoteId,
  onSelectNote,
  onNewNote,
  onNewTaskNote,
  onNewNotebook,
  counts,
  onOpenQuickSwitcher,
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
  objectTypes = [],
  activeObjectType = 'all',
  onSelectObjectType,
  objects = []
}) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  // Capacities-style Objects & Entities collapsible and resizable panel state
  const [isObjectsExpanded, setIsObjectsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('segundo_cerebro_objects_expanded');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [objectsPanelHeight, setObjectsPanelHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('segundo_cerebro_objects_height');
      const val = saved ? parseInt(saved, 10) : 180;
      return isNaN(val) ? 180 : Math.min(Math.max(val, 80), 380);
    } catch {
      return 180;
    }
  });

  // Persist expanded state
  useEffect(() => {
    try {
      localStorage.setItem('segundo_cerebro_objects_expanded', String(isObjectsExpanded));
    } catch {}
  }, [isObjectsExpanded]);

  // Pointer event resize logic
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(objectsPanelHeight);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = objectsPanelHeight;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaY = e.clientY - startYRef.current;
    const nextHeight = Math.min(Math.max(startHeightRef.current + deltaY, 70), 400);
    setObjectsPanelHeight(nextHeight);
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    try {
      localStorage.setItem('segundo_cerebro_objects_height', String(objectsPanelHeight));
    } catch {}
  }, [objectsPanelHeight]);

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  useEffect(() => {
    return auth.onAuthStateChanged((u) => setCurrentUser(u));
  }, []);

  const pinnedNotes = notes.filter(n => n.is_pinned);

  const handleSelectNav = (v: ViewMode) => {
    onSelectView(v);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside className={`
        fixed lg:static top-0 bottom-0 left-0 z-50
        bg-[#141419] border-r border-[#23232b] flex flex-col h-screen select-none transition-all duration-300
        ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
        ${isCollapsed ? 'lg:w-0 lg:overflow-hidden lg:border-none' : 'w-64'}
      `}>
        {/* App Header */}
        <div className="p-4 border-b border-[#23232b]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-900/30 flex-shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <h1 className="font-bold text-sm tracking-wide text-white truncate flex items-center gap-1.5">
                  Segundo Cerebro
                </h1>
                <p className="text-[11px] text-gray-400 truncate">Cuadernos & Conocimiento</p>
              </div>
            </div>

            {/* Close button for Mobile / Collapse button for Desktop */}
            <div className="flex items-center gap-1">
              {onCloseMobile && (
                <button
                  onClick={onCloseMobile}
                  className="lg:hidden p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#20202a]"
                  title="Cerrar menú"
                  aria-label="Cerrar navegación lateral"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              {onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  className="hidden lg:flex p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#20202a]"
                  title="Contraer Segundo Cerebro"
                  aria-label="Contraer barra lateral"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* InsForge Status Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1a1a22] border border-[#2c2c38] text-[11px] text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0"></span>
            <Database className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            <span className="truncate">InsForge BaaS Conectado</span>
          </div>
        </div>

      {/* Quick Actions: 3 Distinct Creation Buttons */}
      <div className="p-3 space-y-2 border-b border-[#23232b]">
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => {
              if (onNewNotebook) onNewNotebook();
              if (onCloseMobile) onCloseMobile();
            }}
            className="flex flex-col sm:flex-row items-center justify-center gap-1 px-1.5 py-2 bg-[#20202e] hover:bg-[#28283a] text-blue-300 rounded-lg text-[11px] font-semibold transition border border-blue-500/20 text-center"
            title="Crear un nuevo cuaderno"
          >
            <Book className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span className="truncate">+ Cuaderno</span>
          </button>

          <button
            onClick={() => {
              onNewNote();
              if (onCloseMobile) onCloseMobile();
            }}
            className="flex flex-col sm:flex-row items-center justify-center gap-1 px-1.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[11px] font-semibold transition shadow-sm shadow-purple-900/30 text-center"
            title="Crear una nota de texto enriquecido"
          >
            <Plus className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">+ Nota</span>
          </button>

          <button
            onClick={() => {
              if (onNewTaskNote) onNewTaskNote();
              if (onCloseMobile) onCloseMobile();
            }}
            className="flex flex-col sm:flex-row items-center justify-center gap-1 px-1.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold transition shadow-sm shadow-emerald-900/30 text-center"
            title="Crear una nota de lista de tareas interactiva"
          >
            <CheckSquare className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">+ Tarea</span>
          </button>
        </div>

        <button
          onClick={onOpenQuickSwitcher}
          className="w-full flex items-center justify-between px-3 py-1.5 bg-[#1b1b22] hover:bg-[#23232d] text-gray-400 hover:text-gray-200 rounded-lg text-xs transition border border-[#292934]"
        >
          <span className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5" />
            Búsqueda global...
          </span>
          <kbd className="text-[10px] bg-[#121217] px-1.5 py-0.5 rounded border border-[#343442] text-gray-400">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {/* SISTEMA PARA (Tiago Forte) */}
        <div className="px-2 pb-1 text-[11px] font-semibold tracking-wider uppercase text-amber-400/90 flex items-center justify-between">
          <span>Sistema PARA</span>
          <span className="text-[9px] font-mono px-1 rounded bg-amber-500/10 text-amber-400">Método</span>
        </div>

        {/* Capturar / Inbox */}
        <button
          onClick={() => handleSelectNav('para_inbox')}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition ${
            currentView === 'para_inbox'
              ? 'bg-amber-600/15 text-amber-300 border border-amber-500/30'
              : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Inbox className="w-4 h-4 text-amber-400" />
            <span>Capturar (Inbox)</span>
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e1e28] text-amber-300 font-mono">
            {counts.inbox ?? 0}
          </span>
        </button>

        {/* Proyectos (PARA) */}
        <button
          onClick={() => handleSelectNav('para_projects')}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition ${
            currentView === 'para_projects' || currentView === 'projects'
              ? 'bg-blue-600/15 text-blue-300 border border-blue-500/30'
              : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <FolderKanban className="w-4 h-4 text-blue-400" />
            <span>Proyectos</span>
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e1e28] text-gray-400">
            {counts.projects}
          </span>
        </button>

        {/* Áreas de Responsabilidad */}
        <button
          onClick={() => handleSelectNav('para_areas')}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition ${
            currentView === 'para_areas'
              ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
              : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-purple-400" />
            <span>Áreas</span>
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e1e28] text-gray-400">
            {counts.areas ?? 0}
          </span>
        </button>

        {/* Recursos de Conocimiento */}
        <button
          onClick={() => handleSelectNav('para_resources')}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition ${
            currentView === 'para_resources'
              ? 'bg-emerald-600/15 text-emerald-300 border border-emerald-500/30'
              : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>Recursos</span>
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e1e28] text-gray-400">
            {counts.objects}
          </span>
        </button>

        {/* Archivo Histórico */}
        <button
          onClick={() => handleSelectNav('para_archives')}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition ${
            currentView === 'para_archives'
              ? 'bg-gray-600/15 text-gray-200 border border-gray-500/30'
              : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Archive className="w-4 h-4 text-gray-400" />
            <span>Archivo</span>
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e1e28] text-gray-400">
            {counts.archives ?? 0}
          </span>
        </button>

        {/* Revisión Periódica */}
        <button
          onClick={() => handleSelectNav('para_review')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition mb-2 ${
            currentView === 'para_review'
              ? 'bg-cyan-600/15 text-cyan-300 border border-cyan-500/30'
              : 'text-gray-400 hover:bg-[#1c1c24] hover:text-gray-200'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Revisión Periódica</span>
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/60 text-cyan-300">
            Auditar
          </span>
        </button>

        <div className="pt-2 px-2 pb-1 text-[11px] font-semibold tracking-wider uppercase text-gray-400 border-t border-[#23232f]">
          Cuadernos & Notas
        </div>

        {/* Cuadernos (Zoho Notebook style) */}
        <button
          onClick={() => handleSelectNav('notebooks')}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition ${
            currentView === 'notebooks'
              ? 'bg-blue-600/15 text-blue-300 border border-blue-500/30'
              : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Book className="w-4 h-4 text-blue-400" />
            Cuadernos
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e1e28] text-gray-400">
            {counts.notebooks}
          </span>
        </button>

        {/* Todas las Notas */}
        <button
          onClick={() => handleSelectNav('all_notes')}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition ${
            currentView === 'all_notes' || currentView === 'notes'
              ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
              : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-purple-400" />
            Todas las notas
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e1e28] text-gray-400">
            {counts.notes}
          </span>
        </button>

        {/* Favoritos */}
        <button
          onClick={() => handleSelectNav('favorites')}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition ${
            currentView === 'favorites'
              ? 'bg-amber-600/15 text-amber-300 border border-amber-500/30'
              : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Star className="w-4 h-4 text-amber-400" />
            Favoritos
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e1e28] text-gray-400">
            {counts.favorites}
          </span>
        </button>

        {/* Recordatorios */}
        <button
          onClick={() => handleSelectNav('reminders')}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition ${
            currentView === 'reminders'
              ? 'bg-amber-600/15 text-amber-300 border border-amber-500/30'
              : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Bell className="w-4 h-4 text-amber-400" />
            Recordatorios
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e1e28] text-gray-400">
            {counts.reminders}
          </span>
        </button>

        {/* Calendario Central Integrado */}
        <button
          onClick={() => handleSelectNav('calendar')}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition ${
            currentView === 'calendar'
              ? 'bg-blue-600/15 text-blue-300 border border-blue-500/30'
              : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-blue-400" />
            Calendario
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-850 font-mono">
            Agenda
          </span>
        </button>

        <div className="pt-3 px-2 pb-1 text-[11px] font-semibold tracking-wider uppercase text-gray-400">
          Gestión & Entidades
        </div>

        <button
          onClick={() => handleSelectNav('tasks')}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition ${
            currentView === 'tasks'
              ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
              : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <CheckSquare className="w-4 h-4 text-amber-400" />
            Tareas (Kanban)
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e1e28] text-gray-400">
            {counts.tasks}
          </span>
        </button>

        <button
          onClick={() => handleSelectNav('projects')}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition ${
            currentView === 'projects'
              ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
              : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <FolderKanban className="w-4 h-4 text-blue-400" />
            Proyectos
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e1e28] text-gray-400">
            {counts.projects}
          </span>
        </button>

        {/* Capacities-style Expandable & Resizable Objects & Entities Panel */}
        <div className="pt-0.5">
          <div 
            onClick={() => handleSelectNav('objects')}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition cursor-pointer group ${
              currentView === 'objects' && (!activeObjectType || activeObjectType === 'all')
                ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
                : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsObjectsExpanded(prev => !prev);
                }}
                className="p-0.5 text-gray-500 hover:text-white rounded hover:bg-[#252535] transition"
                title={isObjectsExpanded ? 'Contraer tipos' : 'Desplegar tipos'}
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isObjectsExpanded ? 'rotate-0' : '-rotate-90'}`} />
              </button>
              <span className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-emerald-400" />
                <span>Objetos & Entidades</span>
              </span>
            </div>

            <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e1e28] text-gray-400">
              {counts.objects}
            </span>
          </div>

          {/* Sub-panel of Dynamic Object Types */}
          {isObjectsExpanded && (
            <div className="mt-1 pl-4 pr-1">
              <div 
                style={{ height: `${objectsPanelHeight}px` }}
                className="overflow-y-auto no-scrollbar rounded-lg bg-[#121218] border border-[#232330] p-1 space-y-0.5"
              >
                {/* Option to view All Objects */}
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectObjectType) onSelectObjectType('all');
                    handleSelectNav('objects');
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] font-medium transition ${
                    currentView === 'objects' && (!activeObjectType || activeObjectType === 'all')
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                      : 'text-gray-400 hover:bg-[#1a1a24] hover:text-gray-200'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Boxes className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    <span className="truncate">Todos los tipos</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-500">
                    {objects.length}
                  </span>
                </button>

                {/* Dynamic Types List (predefined + custom from InsForge) */}
                {objectTypes.map(t => {
                  const typeCount = objects.filter(o => o.object_type === t.id).length;
                  const isSelected = currentView === 'objects' && activeObjectType === t.id;

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        if (onSelectObjectType) onSelectObjectType(t.id);
                        handleSelectNav('objects');
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] font-medium transition ${
                        isSelected
                          ? 'bg-[#20202e] text-white border border-[#3b3b4f]'
                          : 'text-gray-400 hover:bg-[#1a1a24] hover:text-gray-200'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span 
                          className="w-2 h-2 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: t.color || '#3b82f6' }} 
                        />
                        <span className="truncate">{t.name}</span>
                      </span>
                      <span className="text-[10px] font-mono text-gray-500">
                        {typeCount}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Horizontal Drag Resizer Handle */}
              <div
                onPointerDown={handlePointerDown}
                className="h-2.5 my-0.5 cursor-row-resize flex items-center justify-center group/resizer"
                title="Arrastrar verticalmente para cambiar altura del panel"
              >
                <div className="w-10 h-1 rounded-full bg-[#29293a] group-hover/resizer:bg-emerald-500 transition-colors" />
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 px-2 pb-1 text-[11px] font-semibold tracking-wider uppercase text-gray-400">
          Visualización & Medios
        </div>

        <button
          onClick={() => handleSelectNav('graph')}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition ${
            currentView === 'graph'
              ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
              : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Share2 className="w-4 h-4 text-indigo-400" />
            Vista de Grafo (Red)
          </span>
        </button>

        <button
          onClick={() => handleSelectNav('files')}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition ${
            currentView === 'files'
              ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <HardDrive className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold">Archivos</span>
          </span>
          <span className="text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-800/40 px-1.5 py-0.5 rounded font-mono font-medium">
            R2
          </span>
        </button>



        {/* Pinned Notes List */}
        {pinnedNotes.length > 0 && (
          <div className="pt-4">
            <div className="px-2 pb-1 text-[11px] font-semibold tracking-wider uppercase text-gray-400 flex items-center gap-1.5">
              <Pin className="w-3 h-3 text-amber-400" />
              Notas Fijadas
            </div>
            <div className="space-y-0.5">
              {pinnedNotes.map(n => (
                <button
                  key={n.id}
                  onClick={() => {
                    onSelectView('all_notes');
                    onSelectNote(n.id);
                  }}
                  className={`w-full text-left truncate px-2.5 py-1.5 rounded text-xs transition ${
                    selectedNoteId === n.id
                      ? 'bg-purple-900/30 text-purple-200 border-l-2 border-purple-400'
                      : 'text-gray-400 hover:bg-[#1c1c24] hover:text-gray-200'
                  }`}
                >
                  {n.title || 'Sin título'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User Session & Storage Status Footer */}
      <div className="p-3 border-t border-[#23232b] bg-[#101014] text-[11px] text-gray-400 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-6 h-6 rounded-full bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
              {currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs text-gray-200 truncate font-medium">
                {currentUser?.email || 'Conectando sesión...'}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Storage Autorizado</span>
              </div>
            </div>
          </div>

          <span title="Sesión activa con permisos de Storage">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          </span>
        </div>
      </div>
    </aside>
    </>
  );
};
