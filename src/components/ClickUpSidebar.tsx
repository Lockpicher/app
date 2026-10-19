import React, { useState } from 'react';
import { 
  Building2, 
  Layers, 
  Folder, 
  ListOrdered, 
  Plus, 
  ChevronRight, 
  ChevronDown, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Archive, 
  FolderPlus, 
  CheckSquare, 
  Sparkles,
  Inbox,
  Briefcase,
  Store,
  Megaphone,
  Code2,
  FileSpreadsheet,
  Truck,
  Server,
  Tag,
  ShieldCheck,
  PackageCheck,
  Rocket,
  Calculator
} from 'lucide-react';
import { 
  KubbonetWorkspace, 
  KubbonetSpace, 
  KubbonetFolder, 
  KubbonetList,
  AppTask
} from '../lib/types';

export type HierarchyScope = 
  | { type: 'all' }
  | { type: 'space'; spaceId: number }
  | { type: 'folder'; folderId: number }
  | { type: 'list'; listId: number };

interface ClickUpSidebarProps {
  workspace: KubbonetWorkspace;
  spaces: KubbonetSpace[];
  folders: KubbonetFolder[];
  lists: KubbonetList[];
  tasks: AppTask[];
  selectedScope: HierarchyScope;
  onSelectScope: (scope: HierarchyScope) => void;
  onCreateSpace: (space: Partial<KubbonetSpace>) => Promise<void>;
  onUpdateSpace: (id: number, updates: Partial<KubbonetSpace>) => Promise<void>;
  onDeleteSpace: (id: number) => Promise<void>;
  onCreateFolder: (folder: Partial<KubbonetFolder>) => Promise<void>;
  onUpdateFolder: (id: number, updates: Partial<KubbonetFolder>) => Promise<void>;
  onDeleteFolder: (id: number) => Promise<void>;
  onCreateList: (list: Partial<KubbonetList>) => Promise<void>;
  onUpdateList: (id: number, updates: Partial<KubbonetList>) => Promise<void>;
  onDeleteList: (id: number) => Promise<void>;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const ClickUpSidebar: React.FC<ClickUpSidebarProps> = ({
  workspace,
  spaces,
  folders,
  lists,
  tasks,
  selectedScope,
  onSelectScope,
  onCreateSpace,
  onUpdateSpace,
  onDeleteSpace,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onCreateList,
  onUpdateList,
  onDeleteList,
  isMobileOpen = false,
  onCloseMobile
}) => {
  // Expanded state
  const [expandedSpaces, setExpandedSpaces] = useState<Record<number, boolean>>({ 1: true, 2: true });
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>({ 1: true, 2: true, 3: true });

  // Modals state
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<KubbonetSpace | null>(null);
  const [spaceName, setSpaceName] = useState('');
  const [spaceDesc, setSpaceDesc] = useState('');
  const [spaceColor, setSpaceColor] = useState('indigo');

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<KubbonetFolder | null>(null);
  const [folderSpaceId, setFolderSpaceId] = useState<number>(spaces[0]?.id || 1);
  const [folderName, setFolderName] = useState('');
  const [folderDesc, setFolderDesc] = useState('');

  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<KubbonetList | null>(null);
  const [listSpaceId, setListSpaceId] = useState<number>(spaces[0]?.id || 1);
  const [listFolderId, setListFolderId] = useState<number | null>(null);
  const [listName, setListName] = useState('');
  const [listDesc, setListDesc] = useState('');

  const toggleSpace = (spaceId: number) => {
    setExpandedSpaces(prev => ({ ...prev, [spaceId]: !prev[spaceId] }));
  };

  const toggleFolder = (folderId: number) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Helper counts
  const getTasksForList = (listId: number) => tasks.filter(t => t.lista_id === listId && !t.parent_task_id).length;
  const getTasksForFolder = (folderId: number) => {
    const folderListIds = lists.filter(l => l.carpeta_id === folderId).map(l => l.id);
    return tasks.filter(t => t.lista_id && folderListIds.includes(t.lista_id) && !t.parent_task_id).length;
  };
  const getTasksForSpace = (spaceId: number) => {
    const spaceListIds = lists.filter(l => l.espacio_id === spaceId).map(l => l.id);
    return tasks.filter(t => t.lista_id && spaceListIds.includes(t.lista_id) && !t.parent_task_id).length;
  };

  // Icon mapping
  const renderIcon = (name?: string | null, color = 'text-gray-400') => {
    switch (name) {
      case 'Briefcase': return <Briefcase className={`w-3.5 h-3.5 ${color}`} />;
      case 'Store': return <Store className={`w-3.5 h-3.5 ${color}`} />;
      case 'Megaphone': return <Megaphone className={`w-3.5 h-3.5 ${color}`} />;
      case 'Code2': return <Code2 className={`w-3.5 h-3.5 ${color}`} />;
      case 'FileSpreadsheet': return <FileSpreadsheet className={`w-3.5 h-3.5 ${color}`} />;
      case 'Truck': return <Truck className={`w-3.5 h-3.5 ${color}`} />;
      case 'Server': return <Server className={`w-3.5 h-3.5 ${color}`} />;
      case 'Tag': return <Tag className={`w-3.5 h-3.5 ${color}`} />;
      case 'Rocket': return <Rocket className={`w-3.5 h-3.5 ${color}`} />;
      case 'Calculator': return <Calculator className={`w-3.5 h-3.5 ${color}`} />;
      case 'Inbox': return <Inbox className={`w-3.5 h-3.5 ${color}`} />;
      default: return <Layers className={`w-3.5 h-3.5 ${color}`} />;
    }
  };

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside className={`
        fixed md:static top-0 bottom-0 left-0 z-50 md:z-auto
        w-64 bg-[#111116] border-r border-[#20202a] flex flex-col h-full select-none flex-shrink-0 text-xs transition-transform duration-300
        ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Workspace Header (Nivel 1: Workspace) */}
        <div className="p-3 border-b border-[#20202a] bg-[#14141c]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-900/30 flex-shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <div className="font-bold text-white text-xs truncate max-w-[120px]">
                  {workspace.nombre}
                </div>
                <div className="text-[10px] text-blue-400 font-mono">Workspace Operativo</div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {onCloseMobile && (
                <button
                  onClick={onCloseMobile}
                  className="md:hidden p-1 text-gray-400 hover:text-white rounded hover:bg-[#20202e]"
                  title="Cerrar menú jerarquía"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
              )}
              <button
                onClick={() => {
                  setEditingSpace(null);
                  setSpaceName('');
                  setSpaceDesc('');
                  setSpaceColor('indigo');
                  setIsSpaceModalOpen(true);
                }}
                className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#20202e] transition"
                title="Crear nuevo Espacio (Space)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

      {/* Global "Todo" View Button */}
      <div className="p-2 border-b border-[#20202a]">
        <button
          onClick={() => onSelectScope({ type: 'all' })}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg font-medium transition ${
            selectedScope.type === 'all'
              ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
              : 'text-gray-300 hover:bg-[#1a1a24] hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-blue-400" />
            <span className="font-semibold">Todo (Vista Global)</span>
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1c1c28] text-gray-400">
            {tasks.filter(t => !t.parent_task_id).length}
          </span>
        </button>
      </div>

      {/* Hierarchy Tree (Spaces -> Folders -> Lists) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="px-2 py-1 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Espacios Operativos
            </span>
            <span className="text-[9px] text-gray-500">Espacio → Carpeta → Lista</span>
          </div>
          <span className="text-[10px] font-mono text-gray-400">{spaces.length}</span>
        </div>

        {spaces.map(space => {
          const isSpaceExpanded = !!expandedSpaces[space.id];
          const isSpaceSelected = selectedScope.type === 'space' && selectedScope.spaceId === space.id;
          const spaceFolders = folders.filter(f => f.espacio_id === space.id);
          const spaceListsDirect = lists.filter(l => l.espacio_id === space.id && !l.carpeta_id);
          const spaceTaskCount = getTasksForSpace(space.id);

          return (
            <div key={space.id} className="space-y-0.5">
              {/* Space Header Row */}
              <div
                className={`group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition ${
                  isSpaceSelected
                    ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/30'
                    : 'text-gray-300 hover:bg-[#1a1a24] hover:text-white'
                }`}
              >
                <div 
                  className="flex items-center gap-1.5 flex-1 min-w-0"
                  onClick={() => onSelectScope({ type: 'space', spaceId: space.id })}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSpace(space.id);
                    }}
                    className="p-0.5 text-gray-400 hover:text-white"
                  >
                    {isSpaceExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {renderIcon(space.icono, isSpaceSelected ? 'text-indigo-400' : 'text-gray-400')}
                  <span className="font-semibold truncate text-[11px]">{space.nombre}</span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono text-gray-400 group-hover:hidden">
                    {spaceTaskCount}
                  </span>

                  {/* Context Actions */}
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderSpaceId(space.id);
                        setEditingFolder(null);
                        setFolderName('');
                        setFolderDesc('');
                        setIsFolderModalOpen(true);
                      }}
                      className="p-1 text-gray-400 hover:text-cyan-300 rounded hover:bg-[#252538]"
                      title="Nueva Carpeta en este espacio"
                    >
                      <FolderPlus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setListSpaceId(space.id);
                        setListFolderId(null);
                        setEditingList(null);
                        setListName('');
                        setListDesc('');
                        setIsListModalOpen(true);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-300 rounded hover:bg-[#252538]"
                      title="Nueva Lista directa en este espacio"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Children (Folders and Direct Lists) */}
              {isSpaceExpanded && (
                <div className="pl-3.5 ml-2 border-l border-[#20202d] space-y-0.5">
                  {/* Folders inside Space */}
                  {spaceFolders.map(folder => {
                    const isFolderExpanded = !!expandedFolders[folder.id];
                    const isFolderSelected = selectedScope.type === 'folder' && selectedScope.folderId === folder.id;
                    const folderLists = lists.filter(l => l.carpeta_id === folder.id);
                    const folderTaskCount = getTasksForFolder(folder.id);

                    return (
                      <div key={folder.id} className="space-y-0.5">
                        {/* Folder Row */}
                        <div
                          className={`group flex items-center justify-between px-2 py-1 rounded-md cursor-pointer transition ${
                            isFolderSelected
                              ? 'bg-cyan-600/20 text-cyan-200 border border-cyan-500/30'
                              : 'text-gray-400 hover:bg-[#1a1a24] hover:text-gray-200'
                          }`}
                        >
                          <div 
                            className="flex items-center gap-1.5 flex-1 min-w-0"
                            onClick={() => onSelectScope({ type: 'folder', folderId: folder.id })}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFolder(folder.id);
                              }}
                              className="p-0.5 text-gray-400 hover:text-white"
                            >
                              {isFolderExpanded ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                            </button>
                            <Folder className="w-3.5 h-3.5 text-cyan-400/80" />
                            <span className="font-medium truncate text-[11px]">{folder.nombre}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-mono text-gray-400 group-hover:hidden">
                              {folderTaskCount}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setListSpaceId(space.id);
                                setListFolderId(folder.id);
                                setEditingList(null);
                                setListName('');
                                setListDesc('');
                                setIsListModalOpen(true);
                              }}
                              className="hidden group-hover:flex p-1 text-gray-400 hover:text-blue-300 rounded hover:bg-[#252538]"
                              title="Crear Lista dentro de esta carpeta"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Lists inside Folder */}
                        {isFolderExpanded && (
                          <div className="pl-3.5 ml-2 border-l border-[#20202d] space-y-0.5">
                            {folderLists.map(list => {
                              const isListSelected = selectedScope.type === 'list' && selectedScope.listId === list.id;
                              const count = getTasksForList(list.id);
                              return (
                                <button
                                  key={list.id}
                                  onClick={() => onSelectScope({ type: 'list', listId: list.id })}
                                  className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-left transition ${
                                    isListSelected
                                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-semibold'
                                      : 'text-gray-400 hover:bg-[#1a1a24] hover:text-white'
                                  }`}
                                >
                                  <span className="flex items-center gap-1.5 truncate">
                                    <ListOrdered className="w-3 h-3 text-blue-400 flex-shrink-0" />
                                    <span className="truncate text-[11px]">{list.nombre}</span>
                                  </span>
                                  <span className="text-[10px] font-mono text-gray-400">
                                    {count}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Direct Lists (without Folder) */}
                  {spaceListsDirect.map(list => {
                    const isListSelected = selectedScope.type === 'list' && selectedScope.listId === list.id;
                    const count = getTasksForList(list.id);
                    return (
                      <button
                        key={list.id}
                        onClick={() => onSelectScope({ type: 'list', listId: list.id })}
                        className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-left transition ${
                          isListSelected
                            ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 font-semibold'
                            : 'text-gray-400 hover:bg-[#1a1a24] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <ListOrdered className="w-3 h-3 text-blue-400 flex-shrink-0" />
                          <span className="truncate text-[11px]">{list.nombre}</span>
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Crear / Editar Espacio */}
      {isSpaceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#181824] border border-[#2c2c3e] rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              {editingSpace ? 'Editar Espacio' : 'Nuevo Espacio (Space)'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-300 block mb-1">Nombre del Espacio *</label>
                <input
                  type="text"
                  value={spaceName}
                  onChange={(e) => setSpaceName(e.target.value)}
                  placeholder="ej. Marketing, Operaciones, Ventas..."
                  className="w-full px-3 py-1.5 bg-[#121217] border border-[#2b2b3a] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-300 block mb-1">Descripción</label>
                <input
                  type="text"
                  value={spaceDesc}
                  onChange={(e) => setSpaceDesc(e.target.value)}
                  placeholder="Propósito del área o departamento..."
                  className="w-full px-3 py-1.5 bg-[#121217] border border-[#2b2b3a] rounded-lg text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#252538]">
              <button
                onClick={() => setIsSpaceModalOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!spaceName.trim()) return;
                  if (editingSpace) {
                    await onUpdateSpace(editingSpace.id, { nombre: spaceName.trim(), descripcion: spaceDesc.trim() });
                  } else {
                    await onCreateSpace({ nombre: spaceName.trim(), descripcion: spaceDesc.trim(), color: spaceColor });
                  }
                  setIsSpaceModalOpen(false);
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow"
              >
                Guardar Espacio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Carpeta */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#181824] border border-[#2c2c3e] rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-cyan-400" />
              {editingFolder ? 'Editar Carpeta' : 'Nueva Carpeta (Folder)'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-300 block mb-1">Espacio Destino</label>
                <select
                  value={folderSpaceId}
                  onChange={(e) => setFolderSpaceId(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-[#121217] border border-[#2b2b3a] rounded-lg text-xs text-white outline-none"
                >
                  {spaces.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-gray-300 block mb-1">Nombre de la Carpeta *</label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="ej. Marcas Propias, Infraestructura..."
                  className="w-full px-3 py-1.5 bg-[#121217] border border-[#2b2b3a] rounded-lg text-xs text-white outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#252538]">
              <button
                onClick={() => setIsFolderModalOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!folderName.trim()) return;
                  if (editingFolder) {
                    await onUpdateFolder(editingFolder.id, { nombre: folderName.trim(), descripcion: folderDesc.trim() });
                  } else {
                    await onCreateFolder({ espacio_id: folderSpaceId, nombre: folderName.trim(), descripcion: folderDesc.trim() });
                  }
                  setIsFolderModalOpen(false);
                }}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow"
              >
                Guardar Carpeta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Lista */}
      {isListModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#181824] border border-[#2c2c3e] rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-blue-400" />
              {editingList ? 'Editar Lista' : 'Nueva Lista Operativa (List)'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-gray-300 block mb-1">Espacio</label>
                <select
                  value={listSpaceId}
                  onChange={(e) => {
                    const sid = Number(e.target.value);
                    setListSpaceId(sid);
                    setListFolderId(null);
                  }}
                  className="w-full px-2.5 py-1.5 bg-[#121217] border border-[#2b2b3a] rounded-lg text-xs text-white outline-none"
                >
                  {spaces.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-gray-300 block mb-1">Carpeta (Opcional)</label>
                <select
                  value={listFolderId || ''}
                  onChange={(e) => setListFolderId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-2.5 py-1.5 bg-[#121217] border border-[#2b2b3a] rounded-lg text-xs text-white outline-none"
                >
                  <option value="">Sin Carpeta (Directa en el Espacio)</option>
                  {folders.filter(f => f.espacio_id === listSpaceId).map(f => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-gray-300 block mb-1">Nombre de la Lista *</label>
                <input
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="ej. Meridian — Lanzamiento, Mejoras KONTROL..."
                  className="w-full px-3 py-1.5 bg-[#121217] border border-[#2b2b3a] rounded-lg text-xs text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#252538]">
              <button
                onClick={() => setIsListModalOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!listName.trim()) return;
                  if (editingList) {
                    await onUpdateList(editingList.id, { nombre: listName.trim(), descripcion: listDesc.trim() });
                  } else {
                    await onCreateList({ 
                      espacio_id: listSpaceId, 
                      carpeta_id: listFolderId, 
                      nombre: listName.trim(), 
                      descripcion: listDesc.trim() 
                    });
                  }
                  setIsListModalOpen(false);
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow"
              >
                Guardar Lista
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
    </>
  );
};
