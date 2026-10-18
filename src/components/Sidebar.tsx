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
  X,
  Home
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

  // Group collapse states (persisted in localStorage)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('sc_sidebar_groups');
      return saved ? JSON.parse(saved) : {
        capture: false,
        knowledge: false,
        planning: false,
        media: false,
        pinned: false
      };
    } catch {
      return {
        capture: false,
        knowledge: false,
        planning: false,
        media: false,
        pinned: false
      };
    }
  });

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try {
        localStorage.setItem('sc_sidebar_groups', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Capacities-style Objects & Entities collapsible and resizable panel state
  const [isObjectsExpanded, setIsObjectsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('segundo_cerebro_objects_expanded');
      return saved !== null ? saved === 'true' : false;
    } catch {
      return false;
    }
  });

  const [objectsPanelHeight, setObjectsPanelHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('segundo_cerebro_objects_height');
      const val = saved ? parseInt(saved, 10) : 160;
      return isNaN(val) ? 160 : Math.min(Math.max(val, 80), 320);
    } catch {
      return 160;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('segundo_cerebro_objects_expanded', String(isObjectsExpanded));
    } catch {}
  }, [isObjectsExpanded]);

  // Pointer event resize logic for Objects panel
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
    const nextHeight = Math.min(Math.max(startHeightRef.current + deltaY, 70), 340);
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

  // Keyboard navigation & Escape handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen && onCloseMobile) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  // Render navigation item button helper
  const renderNavItem = (
    view: ViewMode,
    label: string,
    icon: React.ReactNode,
    options?: {
      count?: number;
      badgeText?: string;
      activeCondition?: boolean;
      activeBorderColor?: string;
      activeBgColor?: string;
      activeTextColor?: string;
    }
  ) => {
    const isActive = options?.activeCondition !== undefined 
      ? options.activeCondition 
      : currentView === view;

    return (
      <button
        key={view}
        type="button"
        onClick={() => handleSelectNav(view)}
        title={isCollapsed ? `${label}${options?.count !== undefined && options.count > 0 ? ` (${options.count})` : ''}` : undefined}
        className={`w-full flex items-center justify-between rounded-lg transition-all duration-150 relative group ${
          isCollapsed 
            ? 'p-2 justify-center' 
            : 'px-2.5 py-1.5 text-xs font-medium'
        } ${
          isActive
            ? `${options?.activeBgColor || 'bg-blue-600/15'} ${options?.activeTextColor || 'text-blue-300'} ${options?.activeBorderColor || 'border border-blue-500/30'}`
            : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white border border-transparent'
        }`}
      >
        <span className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 truncate'}`}>
          <span className="flex-shrink-0">{icon}</span>
          {!isCollapsed && <span className="truncate">{label}</span>}
        </span>

        {/* Counter or Badge for Expanded mode */}
        {!isCollapsed && (
          <>
            {options?.badgeText && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1e1e28] text-gray-400 border border-[#2b2b3a] flex-shrink-0">
                {options.badgeText}
              </span>
            )}
            {options?.count !== undefined && options.count > 0 && !options.badgeText && (
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded flex-shrink-0 ${
                isActive ? 'bg-blue-950/60 text-blue-300' : 'bg-[#1e1e28] text-gray-400'
              }`}>
                {options.count}
              </span>
            )}
          </>
        )}

        {/* Tooltip for Collapsed mode */}
        {isCollapsed && (
          <div className="hidden group-hover:flex absolute left-full ml-2 px-2.5 py-1 bg-[#1e1e28] text-gray-200 text-xs rounded-md shadow-xl border border-[#2d2d3e] whitespace-nowrap z-50 pointer-events-none items-center gap-1.5">
            <span>{label}</span>
            {options?.count !== undefined && options.count > 0 && (
              <span className="text-[10px] font-mono text-purple-400">({options.count})</span>
            )}
          </div>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Mobile Backdrop Overlay with blur & accessible click-outside */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm lg:hidden transition-opacity duration-200"
          aria-hidden="true"
        />
      )}

      <aside 
        aria-label="Menú principal de navegación"
        className={`
          fixed lg:static top-0 bottom-0 left-0 z-50
          bg-[#141419] border-r border-[#23232b] flex flex-col h-screen select-none transition-all duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0 shadow-2xl w-[270px] max-w-[85vw]' : '-translate-x-full lg:translate-x-0'}
          ${isCollapsed ? 'lg:w-[60px]' : 'lg:w-[250px]'}
        `}
      >
        {/* App Header / Brand bar */}
        <div className="p-3 border-b border-[#23232b] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 overflow-hidden ${isCollapsed ? 'justify-center w-full' : ''}`}>
              <div 
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-900/30 flex-shrink-0 cursor-pointer"
                onClick={() => {
                  if (isCollapsed && onToggleCollapse) onToggleCollapse();
                }}
                title="Segundo Cerebro"
              >
                <Sparkles className="w-4 h-4" />
              </div>
              
              {!isCollapsed && (
                <div className="overflow-hidden min-w-0">
                  <h1 className="font-bold text-sm tracking-wide text-white truncate flex items-center gap-1.5">
                    Segundo Cerebro
                  </h1>
                  <p className="text-[10px] text-gray-400 truncate">PKM & Productividad</p>
                </div>
              )}
            </div>

            {/* Close button for Mobile / Collapse button for Desktop */}
            {!isCollapsed && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {onCloseMobile && (
                  <button
                    onClick={onCloseMobile}
                    className="lg:hidden p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#20202a]"
                    title="Cerrar menú"
                    aria-label="Cerrar menú"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {onToggleCollapse && (
                  <button
                    onClick={onToggleCollapse}
                    className="hidden lg:flex p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#20202a]"
                    title="Contraer barra lateral"
                    aria-label="Contraer barra lateral"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Expand toggle when in collapsed mode on desktop */}
          {isCollapsed && onToggleCollapse && (
            <div className="hidden lg:flex justify-center mt-2">
              <button
                onClick={onToggleCollapse}
                className="p-1 text-gray-400 hover:text-white rounded-md hover:bg-[#20202a]"
                title="Expandir barra lateral"
                aria-label="Expandir barra lateral"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Quick Actions Bar */}
        <div className="p-2 border-b border-[#23232b] flex-shrink-0 space-y-1.5">
          {!isCollapsed ? (
            <>
              {/* Compact 3-action buttons grid */}
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (onNewNotebook) onNewNotebook();
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className="flex items-center justify-center gap-1 py-1 px-1 bg-[#1e1e2a] hover:bg-[#262638] text-blue-300 rounded-md text-[10px] font-semibold transition border border-blue-500/20 text-center"
                  title="Crear un nuevo cuaderno"
                >
                  <Book className="w-3 h-3 text-blue-400 flex-shrink-0" />
                  <span className="truncate">Cuaderno</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onNewNote();
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className="flex items-center justify-center gap-1 py-1 px-1 bg-purple-600/90 hover:bg-purple-600 text-white rounded-md text-[10px] font-semibold transition shadow-sm shadow-purple-900/30 text-center"
                  title="Crear una nota de texto enriquecido"
                >
                  <Plus className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">Nota</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onNewTaskNote) onNewTaskNote();
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className="flex items-center justify-center gap-1 py-1 px-1 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-md text-[10px] font-semibold transition shadow-sm shadow-emerald-900/30 text-center"
                  title="Crear una lista de tareas rápida"
                >
                  <CheckSquare className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">Tarea</span>
                </button>
              </div>

              {/* Quick Switcher Button */}
              <button
                type="button"
                onClick={() => {
                  onOpenQuickSwitcher();
                  if (onCloseMobile) onCloseMobile();
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[#1b1b22] hover:bg-[#23232d] text-gray-400 hover:text-gray-200 rounded-md text-xs transition border border-[#292934]"
              >
                <span className="flex items-center gap-2 truncate">
                  <Search className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[11px] truncate">Buscar todo...</span>
                </span>
                <kbd className="text-[9px] bg-[#121217] px-1 py-0.5 rounded border border-[#343442] text-gray-400 font-mono">
                  Ctrl K
                </kbd>
              </button>
            </>
          ) : (
            /* Collapsed Action Icons */
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenQuickSwitcher}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#20202a] transition"
                title="Búsqueda global (Ctrl + K)"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onNewNote}
                className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition shadow-sm"
                title="Nueva Nota"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3 no-scrollbar">

          {/* ==================================================== */}
          {/* VISTA PRINCIPAL: INICIO / HOME                        */}
          {/* ==================================================== */}
          <div className="space-y-0.5">
            {renderNavItem('home', 'Inicio', <Home className="w-4 h-4 text-purple-400" />, {
              activeCondition: currentView === 'home',
              activeBgColor: 'bg-purple-600/15',
              activeTextColor: 'text-purple-300',
              activeBorderColor: 'border-purple-500/30'
            })}
          </div>

          {/* ==================================================== */}
          {/* GRUPO 1: CAPTURA & ORGANIZACIÓN (SISTEMA PARA)        */}
          {/* ==================================================== */}
          <div className="space-y-0.5">
            {!isCollapsed && (
              <button
                type="button"
                onClick={() => toggleGroup('capture')}
                className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] font-bold tracking-wider uppercase text-amber-400/90 hover:text-amber-300 transition select-none group"
              >
                <span className="flex items-center gap-1.5">
                  <Inbox className="w-3 h-3 text-amber-400" />
                  <span>Captura & PARA</span>
                </span>
                <ChevronDown className={`w-3 h-3 text-gray-500 group-hover:text-gray-300 transition-transform ${
                  collapsedGroups.capture ? '-rotate-90' : 'rotate-0'
                }`} />
              </button>
            )}

            {(!collapsedGroups.capture || isCollapsed) && (
              <div className="space-y-0.5">
                {/* 1. Capturar / Inbox */}
                {renderNavItem('para_inbox', 'Capturar (Inbox)', <Inbox className="w-4 h-4 text-amber-400" />, {
                  count: counts.inbox,
                  activeBgColor: 'bg-amber-600/15',
                  activeTextColor: 'text-amber-300',
                  activeBorderColor: 'border-amber-500/30'
                })}

                {/* 2. Proyectos (Entrada UNIFICADA - elimina la duplicación) */}
                {renderNavItem('projects', 'Proyectos', <FolderKanban className="w-4 h-4 text-blue-400" />, {
                  count: counts.projects,
                  activeCondition: currentView === 'projects' || currentView === 'para_projects',
                  activeBgColor: 'bg-blue-600/15',
                  activeTextColor: 'text-blue-300',
                  activeBorderColor: 'border-blue-500/30'
                })}

                {/* 3. Áreas de Responsabilidad */}
                {renderNavItem('para_areas', 'Áreas', <Layers className="w-4 h-4 text-purple-400" />, {
                  count: counts.areas,
                  activeBgColor: 'bg-purple-600/15',
                  activeTextColor: 'text-purple-300',
                  activeBorderColor: 'border-purple-500/30'
                })}

                {/* 4. Recursos de Conocimiento */}
                {renderNavItem('para_resources', 'Recursos', <BookOpen className="w-4 h-4 text-emerald-400" />, {
                  count: counts.objects,
                  activeBgColor: 'bg-emerald-600/15',
                  activeTextColor: 'text-emerald-300',
                  activeBorderColor: 'border-emerald-500/30'
                })}

                {/* 5. Archivo Histórico */}
                {renderNavItem('para_archives', 'Archivo', <Archive className="w-4 h-4 text-gray-400" />, {
                  count: counts.archives,
                  activeBgColor: 'bg-gray-600/20',
                  activeTextColor: 'text-gray-200',
                  activeBorderColor: 'border-gray-500/30'
                })}
              </div>
            )}
          </div>

          {/* ==================================================== */}
          {/* GRUPO 2: CONOCIMIENTO (Cuadernos, Notas, Entidades)   */}
          {/* ==================================================== */}
          <div className="space-y-0.5">
            {!isCollapsed && (
              <button
                type="button"
                onClick={() => toggleGroup('knowledge')}
                className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] font-bold tracking-wider uppercase text-purple-400/90 hover:text-purple-300 transition select-none group"
              >
                <span className="flex items-center gap-1.5">
                  <Book className="w-3 h-3 text-purple-400" />
                  <span>Conocimiento</span>
                </span>
                <ChevronDown className={`w-3 h-3 text-gray-500 group-hover:text-gray-300 transition-transform ${
                  collapsedGroups.knowledge ? '-rotate-90' : 'rotate-0'
                }`} />
              </button>
            )}

            {(!collapsedGroups.knowledge || isCollapsed) && (
              <div className="space-y-0.5">
                {/* Cuadernos */}
                {renderNavItem('notebooks', 'Cuadernos', <Book className="w-4 h-4 text-blue-400" />, {
                  count: counts.notebooks,
                  activeBgColor: 'bg-blue-600/15',
                  activeTextColor: 'text-blue-300',
                  activeBorderColor: 'border-blue-500/30'
                })}

                {/* Todas las Notas */}
                {renderNavItem('all_notes', 'Todas las notas', <FileText className="w-4 h-4 text-purple-400" />, {
                  count: counts.notes,
                  activeCondition: currentView === 'all_notes' || currentView === 'notes',
                  activeBgColor: 'bg-purple-600/15',
                  activeTextColor: 'text-purple-300',
                  activeBorderColor: 'border-purple-500/30'
                })}

                {/* Favoritos */}
                {renderNavItem('favorites', 'Favoritos', <Star className="w-4 h-4 text-amber-400" />, {
                  count: counts.favorites,
                  activeBgColor: 'bg-amber-600/15',
                  activeTextColor: 'text-amber-300',
                  activeBorderColor: 'border-amber-500/30'
                })}

                {/* Objetos & Entidades (con subpanel desplegable opcional) */}
                <div className="pt-0.5">
                  <div
                    onClick={() => handleSelectNav('objects')}
                    className={`w-full flex items-center justify-between rounded-lg transition cursor-pointer group ${
                      isCollapsed 
                        ? 'p-2 justify-center' 
                        : 'px-2.5 py-1.5 text-xs font-medium'
                    } ${
                      currentView === 'objects' && (!activeObjectType || activeObjectType === 'all')
                        ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
                        : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white border border-transparent'
                    }`}
                    title={isCollapsed ? `Objetos & Entidades (${counts.objects})` : undefined}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {!isCollapsed && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsObjectsExpanded(prev => !prev);
                          }}
                          className="p-0.5 text-gray-500 hover:text-white rounded hover:bg-[#252535] transition"
                          title={isObjectsExpanded ? 'Contraer tipos' : 'Desplegar tipos'}
                        >
                          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isObjectsExpanded ? 'rotate-0' : '-rotate-90'}`} />
                        </button>
                      )}
                      <span className="flex items-center gap-2 truncate">
                        <Boxes className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        {!isCollapsed && <span className="truncate">Objetos & Entidades</span>}
                      </span>
                    </div>

                    {!isCollapsed && counts.objects > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1e1e28] text-gray-400">
                        {counts.objects}
                      </span>
                    )}

                    {isCollapsed && (
                      <div className="hidden group-hover:flex absolute left-full ml-2 px-2.5 py-1 bg-[#1e1e28] text-gray-200 text-xs rounded-md shadow-xl border border-[#2d2d3e] whitespace-nowrap z-50 pointer-events-none items-center gap-1.5">
                        <span>Objetos & Entidades</span>
                        <span className="text-[10px] font-mono text-emerald-400">({counts.objects})</span>
                      </div>
                    )}
                  </div>

                  {/* Sub-panel of Dynamic Object Types in Expanded Mode */}
                  {!isCollapsed && isObjectsExpanded && (
                    <div className="mt-1 pl-4 pr-1">
                      <div 
                        style={{ height: `${objectsPanelHeight}px` }}
                        className="overflow-y-auto no-scrollbar rounded-lg bg-[#121218] border border-[#232330] p-1 space-y-0.5"
                      >
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

                      {/* Resizer Handle */}
                      <div
                        onPointerDown={handlePointerDown}
                        className="h-2 my-0.5 cursor-row-resize flex items-center justify-center group/resizer"
                        title="Arrastrar para redimensionar panel"
                      >
                        <div className="w-8 h-1 rounded-full bg-[#29293a] group-hover/resizer:bg-emerald-500 transition-colors" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Grafo de Conocimiento */}
                {renderNavItem('graph', 'Grafo de Red', <Share2 className="w-4 h-4 text-indigo-400" />, {
                  activeBgColor: 'bg-purple-600/15',
                  activeTextColor: 'text-purple-300',
                  activeBorderColor: 'border-purple-500/30'
                })}
              </div>
            )}
          </div>

          {/* ==================================================== */}
          {/* GRUPO 3: PLANIFICACIÓN & ACCIÓN (Tareas, Calendario)  */}
          {/* ==================================================== */}
          <div className="space-y-0.5">
            {!isCollapsed && (
              <button
                type="button"
                onClick={() => toggleGroup('planning')}
                className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] font-bold tracking-wider uppercase text-blue-400/90 hover:text-blue-300 transition select-none group"
              >
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-blue-400" />
                  <span>Planificación</span>
                </span>
                <ChevronDown className={`w-3 h-3 text-gray-500 group-hover:text-gray-300 transition-transform ${
                  collapsedGroups.planning ? '-rotate-90' : 'rotate-0'
                }`} />
              </button>
            )}

            {(!collapsedGroups.planning || isCollapsed) && (
              <div className="space-y-0.5">
                {/* Tareas (Kanban) */}
                {renderNavItem('tasks', 'Tareas (Kanban)', <CheckSquare className="w-4 h-4 text-amber-400" />, {
                  count: counts.tasks,
                  activeBgColor: 'bg-purple-600/15',
                  activeTextColor: 'text-purple-300',
                  activeBorderColor: 'border-purple-500/30'
                })}

                {/* Calendario Central Integrado */}
                {renderNavItem('calendar', 'Calendario', <Calendar className="w-4 h-4 text-blue-400" />, {
                  badgeText: 'Agenda',
                  activeBgColor: 'bg-blue-600/15',
                  activeTextColor: 'text-blue-300',
                  activeBorderColor: 'border-blue-500/30'
                })}

                {/* Recordatorios */}
                {renderNavItem('reminders', 'Recordatorios', <Bell className="w-4 h-4 text-amber-400" />, {
                  count: counts.reminders,
                  activeBgColor: 'bg-amber-600/15',
                  activeTextColor: 'text-amber-300',
                  activeBorderColor: 'border-amber-500/30'
                })}

                {/* Revisión Periódica */}
                {renderNavItem('para_review', 'Revisión Periódica', <Sparkles className="w-4 h-4 text-cyan-400" />, {
                  badgeText: 'Auditar',
                  activeBgColor: 'bg-cyan-600/15',
                  activeTextColor: 'text-cyan-300',
                  activeBorderColor: 'border-cyan-500/30'
                })}
              </div>
            )}
          </div>

          {/* ==================================================== */}
          {/* GRUPO 4: ARCHIVOS & ALMACENAMIENTO                    */}
          {/* ==================================================== */}
          <div className="space-y-0.5">
            {!isCollapsed && (
              <button
                type="button"
                onClick={() => toggleGroup('media')}
                className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] font-bold tracking-wider uppercase text-cyan-400/90 hover:text-cyan-300 transition select-none group"
              >
                <span className="flex items-center gap-1.5">
                  <HardDrive className="w-3 h-3 text-cyan-400" />
                  <span>Archivos & Medios</span>
                </span>
                <ChevronDown className={`w-3 h-3 text-gray-500 group-hover:text-gray-300 transition-transform ${
                  collapsedGroups.media ? '-rotate-90' : 'rotate-0'
                }`} />
              </button>
            )}

            {(!collapsedGroups.media || isCollapsed) && (
              <div className="space-y-0.5">
                {renderNavItem('files', 'Archivos y Medios', <HardDrive className="w-4 h-4 text-cyan-400" />, {
                  badgeText: 'R2',
                  activeBgColor: 'bg-cyan-600/20',
                  activeTextColor: 'text-cyan-300',
                  activeBorderColor: 'border-cyan-500/40'
                })}
              </div>
            )}
          </div>

          {/* ==================================================== */}
          {/* NOTAS FIJADAS (Opcional si hay elementos marcados)    */}
          {/* ==================================================== */}
          {!isCollapsed && pinnedNotes.length > 0 && (
            <div className="pt-2 border-t border-[#23232f]">
              <button
                type="button"
                onClick={() => toggleGroup('pinned')}
                className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] font-bold tracking-wider uppercase text-gray-400 hover:text-gray-200 transition select-none group"
              >
                <span className="flex items-center gap-1.5 text-amber-300">
                  <Pin className="w-3 h-3" />
                  <span>Fijadas ({pinnedNotes.length})</span>
                </span>
                <ChevronDown className={`w-3 h-3 text-gray-500 group-hover:text-gray-300 transition-transform ${
                  collapsedGroups.pinned ? '-rotate-90' : 'rotate-0'
                }`} />
              </button>

              {!collapsedGroups.pinned && (
                <div className="mt-1 space-y-0.5">
                  {pinnedNotes.map(n => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        onSelectView('all_notes');
                        onSelectNote(n.id);
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className={`w-full text-left truncate px-2 py-1 rounded-md text-xs transition ${
                        selectedNoteId === n.id
                          ? 'bg-purple-900/30 text-purple-200 border-l-2 border-purple-400'
                          : 'text-gray-400 hover:bg-[#1c1c24] hover:text-gray-200'
                      }`}
                    >
                      {n.title || 'Sin título'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer: User & BaaS Connection Status */}
        <div className="p-2.5 border-t border-[#23232b] bg-[#101014] text-[11px] text-gray-400 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 overflow-hidden ${isCollapsed ? 'justify-center w-full' : ''}`}>
              <div 
                className="w-6 h-6 rounded-full bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold text-[10px] flex-shrink-0"
                title={currentUser?.email || 'Sesión activa'}
              >
                {currentUser?.email ? currentUser.email.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
              </div>

              {!isCollapsed && (
                <div className="overflow-hidden min-w-0">
                  <p className="text-xs text-gray-200 truncate font-medium">
                    {currentUser?.email || 'Usuario Conectado'}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>InsForge + R2</span>
                  </div>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <span title="BaaS y Almacenamiento Autorizados">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              </span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
