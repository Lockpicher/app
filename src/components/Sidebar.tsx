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
  Home,
  Sun,
  Moon,
  Flame,
  Paperclip,
  Mic
} from 'lucide-react';
import { ViewMode, AppNote, ObjectTypeDefinition, AppObject } from '../lib/types';
import { auth, AuthUser } from '../lib/auth';
import { useTheme } from '../lib/themeContext';

interface SidebarProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  notes: AppNote[];
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  onNewVoiceNote?: () => void;
  onNewTaskNote?: () => void;
  onNewNotebook?: () => void;
  onUploadFile?: () => void;
  counts: {
    notebooks: number;
    notes: number;
    favorites: number;
    reminders: number;
    tasks: number;
    projects: number;
    objects: number;
    habits?: number;
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
  onOpenAuth?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  notes,
  selectedNoteId,
  onSelectNote,
  onNewNote,
  onNewVoiceNote,
  onNewTaskNote,
  onNewNotebook,
  onUploadFile,
  counts,
  onOpenQuickSwitcher,
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
  objectTypes = [],
  activeObjectType = 'all',
  onSelectObjectType,
  objects = [],
  onOpenAuth
}) => {
  const { theme, toggleTheme } = useTheme();
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
      activeCondition?: boolean;
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
            ? 'bg-blue-600/15 text-blue-300 border border-blue-500/30'
            : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white border border-transparent'
        }`}
      >
        <span className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 truncate'}`}>
          <span className="flex-shrink-0">{icon}</span>
          {!isCollapsed && <span className="truncate">{label}</span>}
        </span>

        {/* Counter for Expanded mode */}
        {!isCollapsed && options?.count !== undefined && options.count > 0 && (
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded flex-shrink-0 ${
            isActive ? 'bg-blue-950/80 text-blue-300 border border-blue-800/40' : 'bg-[#1e1e28] text-gray-400'
          }`}>
            {options.count}
          </span>
        )}

        {/* Tooltip for Collapsed mode */}
        {isCollapsed && (
          <div className="hidden group-hover:flex absolute left-full ml-2 px-2.5 py-1 bg-[#1e1e28] text-gray-200 text-xs rounded-md shadow-xl border border-[#2d2d3e] whitespace-nowrap z-50 pointer-events-none items-center gap-1.5">
            <span>{label}</span>
            {options?.count !== undefined && options.count > 0 && (
              <span className="text-[10px] font-mono text-blue-400">({options.count})</span>
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

            {/* Close button for Mobile / Collapse button for Desktop & Theme Toggle */}
            {!isCollapsed && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#20202a] transition"
                  title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                  aria-label="Alternar tema claro u oscuro"
                >
                  {theme === 'dark' ? (
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                </button>

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
            <div className="hidden lg:flex flex-col items-center gap-1.5 mt-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-[#20202a] transition"
                title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                aria-label="Alternar tema claro u oscuro"
              >
                {theme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                )}
              </button>
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

        {/* Quick Actions Bar - Unified Single "Nuevo" Button (Shortcut N), Voice note & Search (Ctrl K) */}
        <div className="p-2 border-b border-[#23232b] flex-shrink-0 space-y-1.5">
          {!isCollapsed ? (
            <>
              {/* Primary creation row with New Note and Voice Note */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onNewNote();
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className="flex-1 flex items-center justify-between px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition shadow-sm shadow-blue-900/30 group active:scale-[0.98]"
                  title="Crear elemento (Atajo: N)"
                >
                  <span className="flex items-center gap-1.5">
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Nuevo</span>
                  </span>
                  <kbd className="text-[10px] bg-blue-700/80 px-1.5 py-0.5 rounded text-blue-100 font-mono font-normal">
                    N
                  </kbd>
                </button>

                {onNewVoiceNote && (
                  <button
                    type="button"
                    onClick={() => {
                      onNewVoiceNote();
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className="p-1.5 bg-[#1b1b24] hover:bg-[#252534] border border-[#2e2e42] hover:border-blue-500/50 text-blue-400 hover:text-blue-300 rounded-lg transition active:scale-95 flex items-center justify-center flex-shrink-0"
                    title="Nueva nota de voz (Grabar audio)"
                    aria-label="Nueva nota de voz"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Unified Quick Switcher Button */}
              <button
                type="button"
                onClick={() => {
                  onOpenQuickSwitcher();
                  if (onCloseMobile) onCloseMobile();
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[#1b1b22] hover:bg-[#23232d] text-gray-400 hover:text-gray-200 rounded-md text-xs transition border border-[#292934]"
                title="Búsqueda global (Ctrl + K)"
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
                title="Buscar todo (Ctrl + K)"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onNewNote}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition shadow-sm"
                title="Nuevo (N)"
              >
                <Plus className="w-4 h-4" />
              </button>
              {onNewVoiceNote && (
                <button
                  type="button"
                  onClick={onNewVoiceNote}
                  className="p-2 bg-[#1c1c28] text-blue-400 hover:text-blue-300 rounded-lg hover:bg-[#252538] transition border border-[#2d2d40]"
                  title="Nueva nota de voz"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3 no-scrollbar">

          {/* ==================================================== */}
          {/* VISTA PRINCIPAL: INICIO / HOME                        */}
          {/* ==================================================== */}
          <div className="space-y-0.5">
            {renderNavItem('home', 'Inicio', <Home className="w-4 h-4 text-blue-400" />, {
              activeCondition: currentView === 'home'
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
                className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] font-bold tracking-wider uppercase text-gray-400 hover:text-gray-200 transition select-none group"
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
                  count: counts.inbox
                })}

                {/* 2. Proyectos (Entrada UNIFICADA) */}
                {renderNavItem('projects', 'Proyectos', <FolderKanban className="w-4 h-4 text-blue-400" />, {
                  count: counts.projects,
                  activeCondition: currentView === 'projects' || currentView === 'para_projects'
                })}

                {/* 3. Áreas de Responsabilidad */}
                {renderNavItem('para_areas', 'Áreas', <Layers className="w-4 h-4 text-purple-400" />, {
                  count: counts.areas
                })}

                {/* 4. Recursos de Conocimiento */}
                {renderNavItem('para_resources', 'Recursos', <BookOpen className="w-4 h-4 text-emerald-400" />, {
                  count: counts.objects
                })}

                {/* 5. Archivo Histórico */}
                {renderNavItem('para_archives', 'Archivo', <Archive className="w-4 h-4 text-gray-400" />, {
                  count: counts.archives
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
                className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] font-bold tracking-wider uppercase text-gray-400 hover:text-gray-200 transition select-none group"
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
                  count: counts.notebooks
                })}

                {/* Todas las Notas */}
                {renderNavItem('all_notes', 'Todas las notas', <FileText className="w-4 h-4 text-purple-400" />, {
                  count: counts.notes,
                  activeCondition: currentView === 'all_notes' || currentView === 'notes'
                })}

                {/* Favoritos */}
                {renderNavItem('favorites', 'Favoritos', <Star className="w-4 h-4 text-amber-400" />, {
                  count: counts.favorites
                })}

                {/* Objetos & Entidades */}
                <div className="pt-0.5">
                  <div
                    onClick={() => handleSelectNav('objects')}
                    className={`w-full flex items-center justify-between rounded-lg transition cursor-pointer group ${
                      isCollapsed 
                        ? 'p-2 justify-center' 
                        : 'px-2.5 py-1.5 text-xs font-medium'
                    } ${
                      currentView === 'objects' && (!activeObjectType || activeObjectType === 'all')
                        ? 'bg-blue-600/15 text-blue-300 border border-blue-500/30'
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
                        <span className="text-[10px] font-mono text-blue-400">({counts.objects})</span>
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
                              ? 'bg-blue-950/60 text-blue-300 border border-blue-800/40'
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
                                  ? 'bg-blue-950/60 text-blue-300 border border-blue-800/40'
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
                        <div className="w-8 h-1 rounded-full bg-[#29293a] group-hover/resizer:bg-blue-500 transition-colors" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Grafo de Conocimiento */}
                {renderNavItem('graph', 'Grafo de Red', <Share2 className="w-4 h-4 text-indigo-400" />)}
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
                className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] font-bold tracking-wider uppercase text-gray-400 hover:text-gray-200 transition select-none group"
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
                {/* Hábitos & Rutinas */}
                {renderNavItem('habits', 'Hábitos', <Flame className="w-4 h-4 text-amber-400" />, {
                  count: counts.habits
                })}

                {/* Tareas (Kanban) */}
                {renderNavItem('tasks', 'Tareas', <CheckSquare className="w-4 h-4 text-amber-400" />, {
                  count: counts.tasks
                })}

                {/* Calendario Central Integrado */}
                {renderNavItem('calendar', 'Calendario', <Calendar className="w-4 h-4 text-blue-400" />)}

                {/* Recordatorios */}
                {renderNavItem('reminders', 'Recordatorios', <Bell className="w-4 h-4 text-amber-400" />, {
                  count: counts.reminders
                })}

                {/* Revisión Periódica */}
                {renderNavItem('para_review', 'Revisión Periódica', <Sparkles className="w-4 h-4 text-cyan-400" />)}
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
                className="w-full flex items-center justify-between px-1.5 py-1 text-[10px] font-bold tracking-wider uppercase text-gray-400 hover:text-gray-200 transition select-none group"
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
                {renderNavItem('files', 'Archivos y Medios', <HardDrive className="w-4 h-4 text-cyan-400" />)}
                {onUploadFile && (
                  <button
                    type="button"
                    onClick={() => {
                      onUploadFile();
                      if (onCloseMobile) onCloseMobile();
                    }}
                    title={isCollapsed ? 'Adjuntar archivo (R2)' : undefined}
                    className={`w-full flex items-center justify-between rounded-lg transition-all duration-150 text-cyan-400/90 hover:text-cyan-200 hover:bg-[#1c1c24] border border-transparent ${
                      isCollapsed ? 'p-2 justify-center' : 'px-2.5 py-1.5 text-xs font-medium'
                    }`}
                  >
                    <span className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 truncate'}`}>
                      <Paperclip className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      {!isCollapsed && <span className="truncate">Adjuntar archivo</span>}
                    </span>
                    {!isCollapsed && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/60 border border-cyan-800/40 text-cyan-300">
                        R2
                      </span>
                    )}
                  </button>
                )}
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

        {/* Footer: User profile */}
        <div className="p-2 border-t border-[#23232b] bg-[#101014] text-[11px] text-gray-400 flex-shrink-0">
          <button
            type="button"
            onClick={onOpenAuth}
            className={`w-full flex items-center justify-between p-1.5 rounded-xl hover:bg-[#1c1c28] transition group text-left ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title={currentUser ? `Conectado como ${currentUser.email} (Clic para gestionar)` : 'Iniciar sesión'}
          >
            <div className={`flex items-center gap-2 overflow-hidden ${isCollapsed ? 'justify-center' : ''}`}>
              <div 
                className="w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold text-xs flex-shrink-0 group-hover:border-blue-400 group-hover:scale-105 transition"
              >
                {currentUser?.email ? (currentUser.name ? currentUser.name.charAt(0).toUpperCase() : currentUser.email.charAt(0).toUpperCase()) : <User className="w-3.5 h-3.5" />}
              </div>

              {!isCollapsed && (
                <div className="overflow-hidden min-w-0">
                  <p className="text-xs text-gray-200 truncate font-medium group-hover:text-white transition">
                    {currentUser?.name || currentUser?.email || 'Iniciar Sesión'}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                    <span className={`w-1.5 h-1.5 rounded-full ${currentUser ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                    <span>{currentUser ? 'Cuenta activa' : 'Toca para acceder'}</span>
                  </div>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <span className="text-[10px] text-gray-500 group-hover:text-blue-400 px-1.5 py-0.5 rounded bg-[#161622] border border-[#272738] transition">
                {currentUser ? 'Perfil' : 'Entrar'}
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
