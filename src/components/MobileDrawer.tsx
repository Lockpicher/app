import React, { useState } from 'react';
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
  Sliders,
  Settings,
  Search,
  Check,
  Tag
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
  // Collapsible section states
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    workspace: false,
    pinned: false,
    para: false,
    notebooks: false,
    management: false,
    media: false,
    objectTypes: false
  });

  const toggleSection = (sec: string) => {
    setCollapsedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const pinnedNotes = notes.filter(n => n.is_pinned);
  const pinnedObjects = objects.filter(o => o.properties?.is_pinned);

  const handleNav = (view: ViewMode) => {
    onSelectView(view);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" 
      />

      {/* Drawer Container */}
      <aside 
        className="relative w-4/5 max-w-xs bg-[#141419] border-r border-[#242434] h-full flex flex-col z-10 shadow-2xl overflow-hidden select-none animate-in slide-in-from-left duration-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#23232f] flex items-center justify-between bg-[#121217]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-900/30 flex-shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Segundo Cerebro</h2>
              <p className="text-[10px] text-gray-400">PKM & Gestor Integral</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-[#1c1c24] border border-[#2b2b38]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          
          {/* 1. SECCIÓN: ESPACIO DE TRABAJO */}
          <div className="border border-[#232332] rounded-xl p-2.5 bg-[#171720]">
            <div 
              onClick={() => toggleSection('workspace')}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white">Grupo Kubbonet</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsedSections.workspace ? '-rotate-90' : 'rotate-0'}`} />
            </div>

            {!collapsedSections.workspace && (
              <div className="mt-2 pt-2 border-t border-[#222230] text-[11px] text-gray-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Espacio activo</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 text-[10px] font-mono">Conectado</span>
                </div>
                <div className="text-[10px] text-gray-500">
                  InsForge BaaS + Cloudflare R2
                </div>
              </div>
            )}
          </div>

          {/* 2. SECCIÓN: FIJADOS (PINNED) */}
          <div>
            <div 
              onClick={() => toggleSection('pinned')}
              className="flex items-center justify-between py-1 px-1 cursor-pointer select-none text-[11px] font-semibold tracking-wider uppercase text-gray-400 hover:text-gray-200"
            >
              <span className="flex items-center gap-1.5 text-amber-300">
                <Pin className="w-3.5 h-3.5" />
                <span>Fijados ({pinnedNotes.length + pinnedObjects.length})</span>
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${collapsedSections.pinned ? '-rotate-90' : 'rotate-0'}`} />
            </div>

            {!collapsedSections.pinned && (
              <div className="mt-1 space-y-1 pl-1">
                {pinnedNotes.length === 0 && pinnedObjects.length === 0 ? (
                  <p className="text-[11px] text-gray-500 italic py-1 px-2">Sin notas ni páginas fijadas.</p>
                ) : (
                  <>
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
                        {onTogglePinNote && (
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              onTogglePinNote(n.id);
                            }}
                            className="text-amber-400 text-[10px] ml-1"
                            title="Desfijar"
                          >
                            ★
                          </span>
                        )}
                      </button>
                    ))}

                    {pinnedObjects.map(obj => (
                      <button
                        key={obj.id}
                        type="button"
                        onClick={() => {
                          onSelectObjectType(obj.object_type);
                          handleNav('objects');
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-[#1a1a24] transition truncate"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Layers className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                          <span className="truncate">{obj.title}</span>
                        </span>
                        <span className="text-[10px] text-gray-500 uppercase font-mono">{obj.object_type}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* 3. SECCIÓN: SISTEMA PARA */}
          <div>
            <div 
              onClick={() => toggleSection('para')}
              className="flex items-center justify-between py-1 px-1 cursor-pointer select-none text-[11px] font-semibold tracking-wider uppercase text-amber-400/90"
            >
              <span>Sistema PARA</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsedSections.para ? '-rotate-90' : 'rotate-0'}`} />
            </div>

            {!collapsedSections.para && (
              <div className="mt-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => handleNav('para_inbox')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'para_inbox' ? 'bg-amber-600/20 text-amber-300 font-semibold border border-amber-500/30' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Inbox className="w-4 h-4 text-amber-400" />
                    <span>Capturar / Inbox</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1e1e2c] text-amber-300">
                    {counts.inbox ?? 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('para_projects')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'para_projects' ? 'bg-blue-600/20 text-blue-300 font-semibold border border-blue-500/30' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <FolderKanban className="w-4 h-4 text-blue-400" />
                    <span>Proyectos</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1e1e2c] text-gray-400">
                    {counts.projects}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('para_areas')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'para_areas' ? 'bg-purple-600/20 text-purple-300 font-semibold border border-purple-500/30' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span>Áreas</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1e1e2c] text-gray-400">
                    {counts.areas ?? 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('para_resources')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'para_resources' ? 'bg-emerald-600/20 text-emerald-300 font-semibold border border-emerald-500/30' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <BookOpen className="w-4 h-4 text-emerald-400" />
                    <span>Recursos</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1e1e2c] text-gray-400">
                    {counts.objects}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('para_archives')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'para_archives' ? 'bg-gray-700/30 text-gray-200 font-semibold border border-gray-600/30' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Archive className="w-4 h-4 text-gray-400" />
                    <span>Archivo</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1e1e2c] text-gray-400">
                    {counts.archives ?? 0}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* 4. SECCIÓN: CUADERNOS Y NOTAS */}
          <div>
            <div 
              onClick={() => toggleSection('notebooks')}
              className="flex items-center justify-between py-1 px-1 cursor-pointer select-none text-[11px] font-semibold tracking-wider uppercase text-gray-400"
            >
              <span>Cuadernos y Notas</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsedSections.notebooks ? '-rotate-90' : 'rotate-0'}`} />
            </div>

            {!collapsedSections.notebooks && (
              <div className="mt-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => handleNav('notebooks')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'notebooks' ? 'bg-blue-600/20 text-blue-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Book className="w-4 h-4 text-blue-400" />
                    <span>Cuadernos</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">{counts.notebooks}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('all_notes')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'all_notes' ? 'bg-purple-600/20 text-purple-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <span>Todas las notas</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">{counts.notes}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('favorites')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'favorites' ? 'bg-amber-600/20 text-amber-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Star className="w-4 h-4 text-amber-400" />
                    <span>Favoritos</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">{counts.favorites}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('reminders')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'reminders' ? 'bg-pink-600/20 text-pink-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Bell className="w-4 h-4 text-pink-400" />
                    <span>Recordatorios</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">{counts.reminders}</span>
                </button>
              </div>
            )}
          </div>

          {/* 5. SECCIÓN: GESTIÓN OPERATIVA */}
          <div>
            <div 
              onClick={() => toggleSection('management')}
              className="flex items-center justify-between py-1 px-1 cursor-pointer select-none text-[11px] font-semibold tracking-wider uppercase text-gray-400"
            >
              <span>Gestión</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsedSections.management ? '-rotate-90' : 'rotate-0'}`} />
            </div>

            {!collapsedSections.management && (
              <div className="mt-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => handleNav('tasks')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'tasks' ? 'bg-amber-600/20 text-amber-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <CheckSquare className="w-4 h-4 text-amber-400" />
                    <span>Tareas (Kanban)</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">{counts.tasks}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('calendar')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'calendar' ? 'bg-blue-600/20 text-blue-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <span>Calendario</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('projects')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'projects' ? 'bg-indigo-600/20 text-indigo-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <FolderKanban className="w-4 h-4 text-indigo-400" />
                    <span>Proyectos</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">{counts.projects}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('objects')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'objects' && activeObjectType === 'all' ? 'bg-emerald-600/20 text-emerald-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Boxes className="w-4 h-4 text-emerald-400" />
                    <span>Objetos y Entidades</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">{counts.objects}</span>
                </button>
              </div>
            )}
          </div>

          {/* 6. SECCIÓN: VISUALIZACIÓN Y MEDIOS */}
          <div>
            <div 
              onClick={() => toggleSection('media')}
              className="flex items-center justify-between py-1 px-1 cursor-pointer select-none text-[11px] font-semibold tracking-wider uppercase text-gray-400"
            >
              <span>Visualización y Medios</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsedSections.media ? '-rotate-90' : 'rotate-0'}`} />
            </div>

            {!collapsedSections.media && (
              <div className="mt-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => handleNav('graph')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'graph' ? 'bg-purple-600/20 text-purple-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Share2 className="w-4 h-4 text-purple-400" />
                    <span>Vista de Grafo</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNav('files')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    currentView === 'files' ? 'bg-cyan-600/20 text-cyan-300 font-semibold' : 'text-gray-300 hover:bg-[#1b1b26]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                    <span>Archivos (Cloudflare R2)</span>
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* 7. SECCIÓN: TIPOS DE OBJETO (CAPACITIES STYLE) */}
          <div className="pt-2 border-t border-[#232332]">
            <div 
              onClick={() => toggleSection('objectTypes')}
              className="flex items-center justify-between py-1 px-1 cursor-pointer select-none text-[11px] font-semibold tracking-wider uppercase text-emerald-400"
            >
              <span className="flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5" />
                <span>Tipos de Objeto ({objectTypes.length})</span>
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsedSections.objectTypes ? '-rotate-90' : 'rotate-0'}`} />
            </div>

            {!collapsedSections.objectTypes && (
              <div className="mt-1.5 space-y-1 pl-1">
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
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
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

                {/* Acción para crear tipo personalizado */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCreateCustomType();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 mt-2 rounded-lg text-xs text-purple-300 bg-purple-950/30 hover:bg-purple-900/40 border border-purple-800/40 transition font-medium"
                >
                  <Plus className="w-3.5 h-3.5 text-purple-400" />
                  <span>Crear Tipo Personalizado</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </aside>
    </div>
  );
};
