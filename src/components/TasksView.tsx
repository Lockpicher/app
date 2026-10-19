import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Plus, 
  Calendar, 
  AlertTriangle, 
  FolderKanban, 
  Trash2, 
  Check, 
  Clock, 
  Filter, 
  FileText, 
  Flame, 
  CalendarClock, 
  UserCheck, 
  Layers, 
  Edit3,
  Search,
  Move,
  LayoutList,
  Kanban,
  Building2,
  ChevronRight,
  ChevronDown,
  ListOrdered,
  Folder,
  Tag,
  Circle,
  CheckCircle2,
  MoreVertical,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
  Link2,
  Inbox,
  Sun,
  Grid3X3,
  CalendarDays,
  Sparkles,
  CheckCircle,
  X
} from 'lucide-react';
import { 
  AppTask, 
  AppProject, 
  AppNote, 
  TaskCategory, 
  TaskStatus,
  TaskPriority,
  EisenhowerCategory,
  KubbonetWorkspace,
  KubbonetSpace,
  KubbonetFolder,
  KubbonetList
} from '../lib/types';
import { TaskModal } from './TaskModal';
import { ClickUpSidebar, HierarchyScope } from './ClickUpSidebar';
import { db } from '../lib/insforge';

interface TasksViewProps {
  tasks: AppTask[];
  projects: AppProject[];
  notes: AppNote[];
  categories: TaskCategory[];
  onCreateTask: (task: Partial<AppTask>) => Promise<AppTask | null | void>;
  onUpdateTask: (id: string, updates: Partial<AppTask>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onNavigateToNote: (noteId: string) => void;
  onNavigateToProject?: (projectId: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  projects,
  notes,
  categories,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onNavigateToNote,
  onNavigateToProject
}) => {
  // Hierarchy Data States
  const [workspace, setWorkspace] = useState<KubbonetWorkspace>({
    id: 1,
    nombre: 'Grupo Kubbonet',
    slug: 'grupo-kubbonet',
    descripcion: 'Espacio de trabajo principal de KUBBONET CONTROL',
    color: 'blue',
    icono: 'Building2',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  const [spaces, setSpaces] = useState<KubbonetSpace[]>([]);
  const [folders, setFolders] = useState<KubbonetFolder[]>([]);
  const [lists, setLists] = useState<KubbonetList[]>([]);
  const [selectedScope, setSelectedScope] = useState<HierarchyScope>({ type: 'all' });
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'eisenhower'>('board');
  const [isClickUpSidebarOpen, setIsClickUpSidebarOpen] = useState(false);

  // Expanded subtasks in List View
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});

  // Quick Inline Task Creator in List View
  const [quickTitleByStatus, setQuickTitleByStatus] = useState<Record<string, string>>({});

  // Filters
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterEisenhower, setFilterEisenhower] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterDateScope, setFilterDateScope] = useState<'all' | 'inbox' | 'today' | 'tomorrow' | 'week' | 'month' | 'pending'>('all');
  const [filterOnlyOverdue, setFilterOnlyOverdue] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Drag and Drop state (Kanban)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTask, setModalTask] = useState<AppTask | null>(null);
  const [modalInitialStatus, setModalInitialStatus] = useState<TaskStatus>('todo');

  // Load Hierarchy from InsForge
  const loadHierarchy = async () => {
    try {
      const [wsArr, sps, flds, lsts] = await Promise.all([
        db.getWorkspaces(),
        db.getSpaces(),
        db.getFolders(),
        db.getLists()
      ]);
      if (wsArr && wsArr.length > 0) setWorkspace(wsArr[0]);
      setSpaces(sps);
      setFolders(flds);
      setLists(lsts);
    } catch (err) {
      console.error('Error cargando jerarquía de ClickUp:', err);
    }
  };

  useEffect(() => {
    loadHierarchy();
  }, []);

  // Columns definition for Kanban
  const columns: { id: TaskStatus; title: string; color: string; border: string; bg: string; dot: string }[] = [
    { id: 'todo', title: 'Por Hacer', color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/5', dot: 'bg-amber-400' },
    { id: 'in_progress', title: 'En Progreso', color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/5', dot: 'bg-blue-400' },
    { id: 'in_review', title: 'En Revisión', color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/5', dot: 'bg-purple-400' },
    { id: 'completed', title: 'Completada', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', dot: 'bg-emerald-400' }
  ];

  // Hierarchy CRUD Callbacks
  const handleCreateSpace = async (spaceData: Partial<KubbonetSpace>) => {
    const created = await db.createSpace(spaceData);
    if (created) setSpaces(prev => [...prev, created]);
  };
  const handleUpdateSpace = async (id: number, updates: Partial<KubbonetSpace>) => {
    const updated = await db.updateSpace(id, updates);
    if (updated) setSpaces(prev => prev.map(s => s.id === id ? updated : s));
  };
  const handleDeleteSpace = async (id: number) => {
    if (!confirm('¿Eliminar este espacio?')) return;
    await db.deleteSpace(id);
    setSpaces(prev => prev.filter(s => s.id !== id));
    if (selectedScope.type === 'space' && selectedScope.spaceId === id) setSelectedScope({ type: 'all' });
  };

  const handleCreateFolder = async (folderData: Partial<KubbonetFolder>) => {
    const created = await db.createFolder(folderData);
    if (created) setFolders(prev => [...prev, created]);
  };
  const handleUpdateFolder = async (id: number, updates: Partial<KubbonetFolder>) => {
    const updated = await db.updateFolder(id, updates);
    if (updated) setFolders(prev => prev.map(f => f.id === id ? updated : f));
  };
  const handleDeleteFolder = async (id: number) => {
    if (!confirm('¿Eliminar esta carpeta?')) return;
    await db.deleteFolder(id);
    setFolders(prev => prev.filter(f => f.id !== id));
    if (selectedScope.type === 'folder' && selectedScope.folderId === id) setSelectedScope({ type: 'all' });
  };

  const handleCreateList = async (listData: Partial<KubbonetList>) => {
    const created = await db.createList(listData);
    if (created) setLists(prev => [...prev, created]);
  };
  const handleUpdateList = async (id: number, updates: Partial<KubbonetList>) => {
    const updated = await db.updateList(id, updates);
    if (updated) setLists(prev => prev.map(l => l.id === id ? updated : l));
  };
  const handleDeleteList = async (id: number) => {
    if (!confirm('¿Eliminar esta lista?')) return;
    await db.deleteList(id);
    setLists(prev => prev.filter(l => l.id !== id));
    if (selectedScope.type === 'list' && selectedScope.listId === id) setSelectedScope({ type: 'all' });
  };

  // Determine active list ID for new task creation
  const getActiveListIdForNewTask = (): number => {
    if (selectedScope.type === 'list') return selectedScope.listId;
    if (selectedScope.type === 'folder') {
      const folderList = lists.find(l => l.carpeta_id === selectedScope.folderId);
      if (folderList) return folderList.id;
    }
    if (selectedScope.type === 'space') {
      const spaceList = lists.find(l => l.espacio_id === selectedScope.spaceId);
      if (spaceList) return spaceList.id;
    }
    return 3; // Default Inbox
  };

  // Filter Tasks based on ClickUp Hierarchy Scope & filters
  const filteredTasks = tasks.filter(t => {
    // Top level tasks only (subtasks rendered under their parent)
    if (t.parent_task_id) return false;

    // Hierarchy Scope Filter
    if (selectedScope.type === 'list') {
      if (t.lista_id !== selectedScope.listId) return false;
    } else if (selectedScope.type === 'folder') {
      const folderListIds = lists.filter(l => l.carpeta_id === selectedScope.folderId).map(l => l.id);
      if (!t.lista_id || !folderListIds.includes(t.lista_id)) return false;
    } else if (selectedScope.type === 'space') {
      const spaceListIds = lists.filter(l => l.espacio_id === selectedScope.spaceId).map(l => l.id);
      if (!t.lista_id || !spaceListIds.includes(t.lista_id)) return false;
    }

    // Additional Criteria Filters
    if (filterProject !== 'all' && t.project_id !== filterProject) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (filterEisenhower !== 'all' && t.eisenhower !== filterEisenhower) return false;
    if (filterCategory !== 'all' && String(t.category_id || '') !== filterCategory) return false;
    
    // Date Scope Filter (Inbox, Hoy, Mañana, Esta semana, Este mes, Pendiente)
    if (filterDateScope !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      // Start of week (Monday) and end of week (Sunday)
      const currentDay = today.getDay(); // 0 is Sun
      const distanceToMonday = (currentDay + 6) % 7;
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - distanceToMonday);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      // Start of month & end of month
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

      if (filterDateScope === 'inbox') {
        // Inbox: sin fecha asignada o en lista inbox
        if (t.due_date) return false;
      } else if (filterDateScope === 'today') {
        if (!t.due_date) return false;
        const taskDate = new Date(t.due_date);
        if (taskDate < today || taskDate >= tomorrow) return false;
      } else if (filterDateScope === 'tomorrow') {
        if (!t.due_date) return false;
        const taskDate = new Date(t.due_date);
        if (taskDate < tomorrow || taskDate >= dayAfterTomorrow) return false;
      } else if (filterDateScope === 'week') {
        if (!t.due_date) return false;
        const taskDate = new Date(t.due_date);
        if (taskDate < startOfWeek || taskDate >= endOfWeek) return false;
      } else if (filterDateScope === 'month') {
        if (!t.due_date) return false;
        const taskDate = new Date(t.due_date);
        if (taskDate < startOfMonth || taskDate > endOfMonth) return false;
      } else if (filterDateScope === 'pending') {
        if (t.status === 'completed') return false;
      }
    }

    // Only Overdue filter
    if (filterOnlyOverdue) {
      if (!t.due_date || t.status === 'completed') return false;
      if (new Date(t.due_date).getTime() >= Date.now()) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = (t.description || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  // Drag & Drop handlers (Kanban)
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  };
  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };
  const handleDragOver = (e: React.DragEvent, colId: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== colId) setDragOverColumn(colId);
  };
  const handleDragLeave = (colId: TaskStatus) => {
    if (dragOverColumn === colId) setDragOverColumn(null);
  };
  const handleDrop = async (e: React.DragEvent, colId: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDragOverColumn(null);
    if (!taskId) return;
    const current = tasks.find(t => t.id === taskId);
    if (current && current.status !== colId) {
      await onUpdateTask(taskId, {
        status: colId,
        completed_at: colId === 'completed' ? new Date().toISOString() : null
      });
    }
    setDraggedTaskId(null);
  };

  // Toggle Task Status (Quick check in list or card)
  const handleToggleTaskStatus = async (task: AppTask) => {
    const nextStatus: TaskStatus = task.status === 'completed' ? 'todo' : 'completed';
    await onUpdateTask(task.id, {
      status: nextStatus,
      completed_at: nextStatus === 'completed' ? new Date().toISOString() : null
    });
  };

  // Quick inline task creation in List View
  const handleQuickCreateTask = async (status: TaskStatus) => {
    const title = (quickTitleByStatus[status] || '').trim();
    if (!title) return;
    await onCreateTask({
      title,
      status,
      priority: 'medium',
      lista_id: getActiveListIdForNewTask()
    });
    setQuickTitleByStatus(prev => ({ ...prev, [status]: '' }));
  };

  // Subtasks helper
  const getSubtasksForTask = (taskId: string) => tasks.filter(t => t.parent_task_id === taskId);

  // Active Scope Details for Header & Breadcrumbs
  const getScopeBreadcrumb = () => {
    if (selectedScope.type === 'all') {
      return {
        title: 'Todo (Vista Global)',
        description: 'Todas las tareas y procesos de Grupo Kubbonet',
        path: ['Grupo Kubbonet', 'Todo']
      };
    }
    if (selectedScope.type === 'space') {
      const space = spaces.find(s => s.id === selectedScope.spaceId);
      return {
        title: space?.nombre || 'Espacio',
        description: space?.descripcion || 'Espacio de trabajo operativo',
        path: ['Grupo Kubbonet', space?.nombre || 'Espacio']
      };
    }
    if (selectedScope.type === 'folder') {
      const folder = folders.find(f => f.id === selectedScope.folderId);
      const space = spaces.find(s => s.id === folder?.espacio_id);
      return {
        title: folder?.nombre || 'Carpeta',
        description: folder?.descripcion || 'Carpeta de agrupación',
        path: ['Grupo Kubbonet', space?.nombre || 'Espacio', folder?.nombre || 'Carpeta']
      };
    }
    if (selectedScope.type === 'list') {
      const list = lists.find(l => l.id === selectedScope.listId);
      const space = spaces.find(s => s.id === list?.espacio_id);
      const folder = folders.find(f => f.id === list?.carpeta_id);
      const path = ['Grupo Kubbonet', space?.nombre || 'Espacio'];
      if (folder) path.push(folder.nombre);
      path.push(list?.nombre || 'Lista');
      return {
        title: list?.nombre || 'Lista Operativa',
        description: list?.descripcion || 'Contenedor operativo de tareas',
        path
      };
    }
    return { title: 'Tareas', description: '', path: ['Grupo Kubbonet'] };
  };

  const scopeInfo = getScopeBreadcrumb();

  return (
    <div className="flex-1 flex h-full bg-[#14141c] overflow-hidden select-none">
      {/* ClickUp Hierarchy Left Sidebar */}
      <ClickUpSidebar
        workspace={workspace}
        spaces={spaces}
        folders={folders}
        lists={lists}
        tasks={tasks}
        selectedScope={selectedScope}
        onSelectScope={(scope) => {
          setSelectedScope(scope);
          setIsClickUpSidebarOpen(false);
        }}
        onCreateSpace={handleCreateSpace}
        onUpdateSpace={handleUpdateSpace}
        onDeleteSpace={handleDeleteSpace}
        onCreateFolder={handleCreateFolder}
        onUpdateFolder={handleUpdateFolder}
        onDeleteFolder={handleDeleteFolder}
        onCreateList={handleCreateList}
        onUpdateList={handleUpdateList}
        onDeleteList={handleDeleteList}
        isMobileOpen={isClickUpSidebarOpen}
        onCloseMobile={() => setIsClickUpSidebarOpen(false)}
      />

      {/* Main Tasks Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Header: Breadcrumbs, Scope Title & View Switcher */}
        <div className="px-3 sm:px-6 py-2.5 sm:py-3.5 bg-[#14141c] border-b border-[#222232] flex items-center justify-between flex-wrap gap-2.5 pt-[max(0.625rem,env(safe-area-inset-top,0px))] flex-shrink-0">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsClickUpSidebarOpen(!isClickUpSidebarOpen)}
                className="md:hidden p-1.5 -ml-1 text-gray-400 hover:text-white rounded-lg bg-[#1a1a24] border border-[#2b2b3a] flex-shrink-0"
                title="Abrir jerarquía de espacios"
                aria-label="Abrir jerarquía"
              >
                <Layers className="w-4 h-4 text-blue-400" />
              </button>

              {/* Breadcrumb Path */}
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium overflow-hidden truncate">
                <Building2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                {scopeInfo.path.map((segment, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <span className="text-gray-600">/</span>}
                    <span className={idx === scopeInfo.path.length - 1 ? 'text-blue-300 font-semibold truncate' : 'text-gray-400 truncate'}>
                      {segment}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2 truncate">
                {scopeInfo.title}
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#202030] text-gray-400 border border-[#2b2b40]">
                  {filteredTasks.length} {filteredTasks.length === 1 ? 'tarea' : 'tareas'}
                </span>
              </h2>
            </div>
          </div>

          {/* Right Header Controls: 1. View Switcher (Kanban, Lista, Eisenhower) & 2. New Task Button */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle: Kanban vs Lista vs Eisenhower */}
            <div className="flex items-center bg-[#181824] p-0.5 rounded-lg border border-[#2b2b3e]">
              <button
                onClick={() => setViewMode('board')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
                  viewMode === 'board'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Vista Tablero Kanban"
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Kanban</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Vista Lista compacta"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Lista</span>
              </button>
              <button
                onClick={() => setViewMode('eisenhower')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
                  viewMode === 'eisenhower'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Matriz de Eisenhower"
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Eisenhower</span>
              </button>
            </div>

            {/* Create Task Button */}
            <button
              onClick={() => {
                setModalTask(null);
                setModalInitialStatus('todo');
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-900/30 transition flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden xs:inline">Nueva Tarea</span>
            </button>
          </div>
        </div>

        {/* 2. Quick Date Access Bar (Inbox, Hoy, Mañana, Esta semana, Este mes, Pendiente, Todas) */}
        <div className="px-3 sm:px-6 py-2 bg-[#161622] border-b border-[#20202e] flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0 text-xs">
          {(() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dayAfterTomorrow = new Date(tomorrow);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

            const currentDay = today.getDay();
            const distanceToMonday = (currentDay + 6) % 7;
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - distanceToMonday);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 7);

            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

            const countInbox = tasks.filter(t => !t.parent_task_id && !t.due_date).length;
            const countToday = tasks.filter(t => !t.parent_task_id && t.due_date && new Date(t.due_date) >= today && new Date(t.due_date) < tomorrow).length;
            const countTomorrow = tasks.filter(t => !t.parent_task_id && t.due_date && new Date(t.due_date) >= tomorrow && new Date(t.due_date) < dayAfterTomorrow).length;
            const countWeek = tasks.filter(t => !t.parent_task_id && t.due_date && new Date(t.due_date) >= startOfWeek && new Date(t.due_date) < endOfWeek).length;
            const countMonth = tasks.filter(t => !t.parent_task_id && t.due_date && new Date(t.due_date) >= startOfMonth && new Date(t.due_date) <= endOfMonth).length;
            const countPending = tasks.filter(t => !t.parent_task_id && t.status !== 'completed').length;
            const countAll = tasks.filter(t => !t.parent_task_id).length;

            const dateOptions: { id: typeof filterDateScope; label: string; icon: React.ReactNode; count: number }[] = [
              { id: 'inbox', label: 'Inbox', icon: <Inbox className="w-3.5 h-3.5 text-indigo-400" />, count: countInbox },
              { id: 'today', label: 'Hoy', icon: <Sun className="w-3.5 h-3.5 text-amber-400" />, count: countToday },
              { id: 'tomorrow', label: 'Mañana', icon: <CalendarDays className="w-3.5 h-3.5 text-sky-400" />, count: countTomorrow },
              { id: 'week', label: 'Esta semana', icon: <Calendar className="w-3.5 h-3.5 text-emerald-400" />, count: countWeek },
              { id: 'month', label: 'Este mes', icon: <Clock className="w-3.5 h-3.5 text-purple-400" />, count: countMonth },
              { id: 'pending', label: 'Pendiente', icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />, count: countPending },
              { id: 'all', label: 'Todas', icon: <CheckSquare className="w-3.5 h-3.5 text-gray-400" />, count: countAll }
            ];

            return dateOptions.map((opt) => {
              const isActive = filterDateScope === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setFilterDateScope(opt.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition flex-shrink-0 text-xs ${
                    isActive
                      ? 'bg-blue-600/90 text-white shadow-sm ring-1 ring-blue-400/30'
                      : 'bg-[#1b1b26] text-gray-300 hover:text-white hover:bg-[#232332] border border-[#272738]'
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-[#13131c] text-gray-400'
                  }`}>
                    {opt.count}
                  </span>
                </button>
              );
            });
          })()}
        </div>

        {/* 3. Date & Timezone Indicator + Compact Controls */}
        <div className="px-3 sm:px-6 py-2 bg-[#121218] border-b border-[#20202c] flex items-center justify-between flex-wrap gap-2 text-xs flex-shrink-0">
          {/* Current Date & Timezone */}
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <CalendarClock className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span className="capitalize">
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-400 font-mono text-[10px]">
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </span>
          </div>

          {/* 5. Summary Flow Metrics */}
          <div className="flex items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-gray-400">Por hacer:</span>
              <span className="font-mono font-semibold text-white">
                {filteredTasks.filter(t => t.status === 'todo').length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-gray-400">En progreso:</span>
              <span className="font-mono font-semibold text-white">
                {filteredTasks.filter(t => t.status === 'in_progress').length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-gray-400">Completadas:</span>
              <span className="font-mono font-semibold text-emerald-400">
                {filteredTasks.filter(t => t.status === 'completed').length}
              </span>
            </div>
          </div>
        </div>

        {/* 4. Compact Search and Filters Bar */}
        <div className="px-3 sm:px-6 py-2 bg-[#14141c] border-b border-[#20202c] flex items-center justify-between flex-wrap gap-2 text-xs flex-shrink-0">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[160px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar tareas..."
              className="w-full pl-8 pr-7 py-1.5 bg-[#181822] border border-[#282838] focus:border-blue-500 rounded-lg text-xs text-white placeholder-gray-500 outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-gray-500 hover:text-gray-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Compact Dropdown Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Project Filter */}
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="px-2 py-1.5 bg-[#181822] border border-[#282838] rounded-lg text-xs text-gray-300 outline-none cursor-pointer max-w-[130px] sm:max-w-[150px] truncate"
            >
              <option value="all">Proyectos: Todos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-2 py-1.5 bg-[#181822] border border-[#282838] rounded-lg text-xs text-gray-300 outline-none cursor-pointer max-w-[120px] sm:max-w-[140px] truncate"
            >
              <option value="all">Categorías: Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.nombre}
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-2 py-1.5 bg-[#181822] border border-[#282838] rounded-lg text-xs text-gray-300 outline-none cursor-pointer"
            >
              <option value="all">Prioridad: Todas</option>
              <option value="urgent">Urgente 🔥</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>

            {/* Eisenhower Filter */}
            <select
              value={filterEisenhower}
              onChange={(e) => setFilterEisenhower(e.target.value)}
              className="px-2 py-1.5 bg-[#181822] border border-[#282838] rounded-lg text-xs text-gray-300 outline-none cursor-pointer max-w-[140px] truncate"
            >
              <option value="all">Eisenhower: Todo</option>
              <option value="do">1. HACER (Urg/Imp)</option>
              <option value="schedule">2. PROGRAMAR</option>
              <option value="delegate">3. DELEGAR</option>
              <option value="delete">4. ELIMINAR</option>
            </select>

            {/* Overdue toggle button */}
            <button
              onClick={() => setFilterOnlyOverdue(!filterOnlyOverdue)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition ${
                filterOnlyOverdue
                  ? 'bg-red-950/80 text-red-300 border-red-700/60'
                  : 'bg-[#181822] text-gray-400 hover:text-white border-[#282838]'
              }`}
              title="Filtrar solo tareas vencidas"
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${filterOnlyOverdue ? 'text-red-400' : 'text-gray-400'}`} />
              <span className="hidden sm:inline">Vencidas</span>
            </button>
          </div>
        </div>

        {/* Content View: Board or List or Eisenhower */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-6 min-h-0">
          {viewMode === 'board' ? (
            /* ==================================================== */
            /* 6. VISTA TABLERO KANBAN HORIZONTAL EN MÓVIL Y DESKTOP */
            /* ==================================================== */
            <div className="flex flex-row overflow-x-auto overflow-y-hidden gap-4 h-full min-h-[480px] pb-3 no-scrollbar items-start">
              {columns.map((col) => {
                const colTasks = filteredTasks.filter(t => t.status === col.id);
                const isOver = dragOverColumn === col.id;

                return (
                  <div
                    key={col.id}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragLeave={() => handleDragLeave(col.id)}
                    onDrop={(e) => handleDrop(e, col.id)}
                    className={`flex flex-col bg-[#14141d] rounded-xl border transition-all duration-200 overflow-hidden flex-shrink-0 w-[85vw] sm:w-[320px] max-w-[340px] h-full ${
                      isOver 
                        ? 'border-blue-400 bg-blue-950/20 shadow-lg shadow-blue-950/40' 
                        : `${col.border} hover:border-[#35354a]`
                    }`}
                  >
                    {/* Column Header */}
                    <div className="px-4 py-3 bg-[#171722] border-b border-[#252535] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                        <h3 className={`font-bold text-xs uppercase tracking-wider ${col.color}`}>
                          {col.title}
                        </h3>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#20202e] text-gray-400">
                          {colTasks.length}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setModalTask(null);
                          setModalInitialStatus(col.id);
                          setIsModalOpen(true);
                        }}
                        className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#252538] transition"
                        title={`Añadir tarea a ${col.title}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Column Cards Container */}
                    <div className="flex-1 p-3 space-y-2.5 overflow-y-auto min-h-[300px]">
                      {colTasks.length === 0 ? (
                        <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-[#20202e] rounded-xl text-center p-4">
                          <p className="text-[11px] text-gray-400">No hay tareas en esta columna</p>
                        </div>
                      ) : (
                        colTasks.map((t) => {
                          const subtasks = getSubtasksForTask(t.id);
                          const completedSubs = subtasks.filter(s => s.status === 'completed').length;
                          const taskList = lists.find(l => l.id === t.lista_id);
                          const isOverdue = t.due_date && new Date(t.due_date).getTime() < Date.now() && t.status !== 'completed';

                          return (
                            <div
                              key={t.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, t.id)}
                              onDragEnd={handleDragEnd}
                              onClick={() => {
                                setModalTask(t);
                                setIsModalOpen(true);
                              }}
                              className={`p-3 bg-[#181824] hover:bg-[#202030] rounded-xl border border-[#2b2b3e] hover:border-blue-500/40 transition cursor-pointer group shadow-sm relative ${
                                draggedTaskId === t.id ? 'opacity-40 scale-95' : ''
                              }`}
                            >
                              {/* Card Header: List origin pill, Project pill & Priority */}
                              <div className="flex items-center justify-between gap-1.5 mb-1.5 flex-wrap">
                                <div className="flex items-center gap-1 overflow-hidden max-w-[70%]">
                                  {taskList ? (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40 truncate">
                                      {taskList.nombre}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#20202c] text-gray-400">
                                      General
                                    </span>
                                  )}

                                  {(() => {
                                    const proj = projects.find(p => p.id === t.project_id);
                                    if (!proj) return null;
                                    return (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onNavigateToProject) {
                                            onNavigateToProject(proj.id);
                                          } else {
                                            setFilterProject(proj.id);
                                          }
                                        }}
                                        className="text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 border truncate max-w-[120px] hover:brightness-125 transition cursor-pointer"
                                        style={{ 
                                          backgroundColor: `${proj.color || '#6366f1'}20`, 
                                          borderColor: `${proj.color || '#6366f1'}40`,
                                          color: proj.color || '#a5b4fc' 
                                        }}
                                        title={`Ver proyecto canónico: ${proj.title}`}
                                      >
                                        <FolderKanban className="w-2.5 h-2.5 flex-shrink-0" />
                                        <span className="truncate">{proj.title}</span>
                                      </button>
                                    );
                                  })()}
                                </div>

                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {t.priority === 'urgent' && (
                                    <span className="text-[10px] bg-red-950/80 text-red-300 border border-red-800/60 px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-0.5">
                                      <Flame className="w-3 h-3 text-red-400" /> Urgente
                                    </span>
                                  )}
                                  {t.priority === 'high' && (
                                    <span className="text-[10px] bg-amber-950/60 text-amber-300 border border-amber-800/40 px-1.5 py-0.5 rounded font-mono">
                                      Alta
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Thumbnail preview if task has an image */}
                              {t.thumbnail_url && (
                                <div className="w-full h-28 rounded-lg overflow-hidden border border-[#2d2d40] bg-[#101016] mb-2 relative">
                                  <img 
                                    src={t.thumbnail_url} 
                                    alt={t.title} 
                                    className="w-full h-full object-cover transition duration-300 group-hover:scale-105" 
                                    loading="lazy" 
                                  />
                                </div>
                              )}

                              {/* Title */}
                              <h4 className="text-xs font-semibold text-gray-100 group-hover:text-blue-300 transition leading-snug mb-1.5 line-clamp-2">
                                {t.title}
                              </h4>

                              {/* Task URL Link badge */}
                              {t.url && (
                                <a
                                  href={t.url.startsWith('http') ? t.url : `https://${t.url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded mb-2 max-w-full truncate"
                                  title={t.url}
                                >
                                  <Link2 className="w-2.5 h-2.5 flex-shrink-0" />
                                  <span className="truncate">{t.url.replace(/^https?:\/\//, '')}</span>
                                  <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                                </a>
                              )}

                              {/* Task Tags */}
                              {t.tags && t.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {t.tags.map((tag, idx) => (
                                    <span 
                                      key={idx} 
                                      className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e1e2c] text-indigo-300 border border-indigo-500/20 font-medium"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Footer Metadata */}
                              <div className="flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-[#232332]">
                                {/* Subtasks Counter Pill */}
                                {subtasks.length > 0 ? (
                                  <span className="flex items-center gap-1 font-mono text-[10px] text-gray-300 bg-[#121218] px-1.5 py-0.5 rounded border border-[#282838]">
                                    <CheckSquare className="w-3 h-3 text-emerald-400" />
                                    {completedSubs}/{subtasks.length}
                                  </span>
                                ) : (
                                  <span />
                                )}

                                {/* Due Date */}
                                {t.due_date && (
                                  <span className={`flex items-center gap-1 font-mono text-[10px] ${
                                    isOverdue ? 'text-red-400 font-semibold' : 'text-gray-400'
                                  }`}>
                                    <Calendar className="w-3 h-3" />
                                    {new Date(t.due_date).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'list' ? (
            /* ==================================================== */
            /* VISTA LISTA (CLICKUP STATUS-GROUPED COMPACT TABLE)  */
            /* ==================================================== */
            <div className="space-y-6">
              {columns.map((col) => {
                const colTasks = filteredTasks.filter(t => t.status === col.id);

                return (
                  <div key={col.id} className="bg-[#151520] rounded-xl border border-[#232332] overflow-hidden shadow-sm">
                    {/* Status Header */}
                    <div className="px-4 py-2.5 bg-[#191926] border-b border-[#252536] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                        <span className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>
                          {col.title}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#202030] text-gray-400">
                          {colTasks.length}
                        </span>
                      </div>
                    </div>

                    {/* Tasks Table */}
                    {colTasks.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-500">
                        No hay tareas en este estado.
                      </div>
                    ) : (
                      <div className="divide-y divide-[#20202e]">
                        {colTasks.map((t) => {
                          const subtasks = getSubtasksForTask(t.id);
                          const isExpanded = !!expandedTaskIds[t.id];
                          const taskList = lists.find(l => l.id === t.lista_id);
                          const isOverdue = t.due_date && new Date(t.due_date).getTime() < Date.now() && t.status !== 'completed';

                          return (
                            <div key={t.id} className="group hover:bg-[#1a1a28] transition">
                              {/* Main Task Row */}
                              <div className="flex items-center justify-between px-4 py-2.5 gap-3">
                                {/* Left: Expand toggle, Complete checkbox & Title */}
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                  {subtasks.length > 0 ? (
                                    <button
                                      onClick={() => setExpandedTaskIds(prev => ({ ...prev, [t.id]: !prev[t.id] }))}
                                      className="p-1 text-gray-400 hover:text-white"
                                      title="Ver subtareas"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
                                      ) : (
                                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                                      )}
                                    </button>
                                  ) : (
                                    <span className="w-5" />
                                  )}

                                  {/* Quick complete checkbox */}
                                  <button
                                    onClick={() => handleToggleTaskStatus(t)}
                                    className="p-1 text-gray-500 hover:text-emerald-400 transition"
                                  >
                                    {t.status === 'completed' ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                      <Circle className="w-4 h-4 text-gray-400 hover:text-emerald-400" />
                                    )}
                                  </button>

                                  {/* Thumbnail preview */}
                                  {t.thumbnail_url && (
                                    <div 
                                      onClick={() => {
                                        setModalTask(t);
                                        setIsModalOpen(true);
                                      }}
                                      className="w-7 h-7 rounded-md overflow-hidden border border-[#2d2d40] bg-[#101016] flex-shrink-0 cursor-pointer"
                                    >
                                      <img src={t.thumbnail_url} alt="" className="w-full h-full object-cover" />
                                    </div>
                                  )}

                                  {/* Task Title (click opens modal) */}
                                  <span
                                    onClick={() => {
                                      setModalTask(t);
                                      setIsModalOpen(true);
                                    }}
                                    className={`text-xs font-medium cursor-pointer hover:text-blue-300 transition truncate ${
                                      t.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-100'
                                    }`}
                                  >
                                    {t.title}
                                  </span>

                                  {/* URL Link badge */}
                                  {t.url && (
                                    <a
                                      href={t.url.startsWith('http') ? t.url : `https://${t.url}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 rounded bg-cyan-950/40 text-cyan-400 hover:text-cyan-300 border border-cyan-800/40 transition flex-shrink-0"
                                      title={`Abrir enlace: ${t.url}`}
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}

                                  {/* Tags */}
                                  {t.tags && t.tags.length > 0 && (
                                    <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                                      {t.tags.slice(0, 3).map((tag, idx) => (
                                        <span 
                                          key={idx} 
                                          className="text-[9px] px-1.5 py-0.2 rounded bg-[#1e1e2c] text-indigo-300 border border-indigo-500/20 font-medium"
                                        >
                                          #{tag}
                                        </span>
                                      ))}
                                      {t.tags.length > 3 && (
                                        <span className="text-[9px] text-gray-500">+{t.tags.length - 3}</span>
                                      )}
                                    </div>
                                  )}

                                  {/* Subtasks Count Badge */}
                                  {subtasks.length > 0 && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1e1e2c] text-gray-400 border border-[#29293a]">
                                      {subtasks.filter(s => s.status === 'completed').length}/{subtasks.length} subtareas
                                    </span>
                                  )}
                                </div>

                                {/* Right Meta Columns */}
                                <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                                  {/* Project pill */}
                                  {(() => {
                                    const proj = projects.find(p => p.id === t.project_id);
                                    if (!proj) return null;
                                    return (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onNavigateToProject) {
                                            onNavigateToProject(proj.id);
                                          } else {
                                            setFilterProject(proj.id);
                                          }
                                        }}
                                        className="text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1 border truncate max-w-[130px] hover:brightness-125 transition cursor-pointer"
                                        style={{ 
                                          backgroundColor: `${proj.color || '#6366f1'}20`, 
                                          borderColor: `${proj.color || '#6366f1'}40`,
                                          color: proj.color || '#a5b4fc' 
                                        }}
                                        title={`Ver proyecto canónico: ${proj.title}`}
                                      >
                                        <FolderKanban className="w-3 h-3 flex-shrink-0" />
                                        <span className="truncate">{proj.title}</span>
                                      </button>
                                    );
                                  })()}

                                  {/* List pill */}
                                  {taskList && (
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40">
                                      {taskList.nombre}
                                    </span>
                                  )}

                                  {/* Priority Badge */}
                                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                                    t.priority === 'urgent' ? 'bg-red-950 text-red-300 border border-red-800/60' :
                                    t.priority === 'high' ? 'bg-amber-950 text-amber-300 border border-amber-800/60' :
                                    t.priority === 'low' ? 'bg-gray-800 text-gray-400 border border-gray-700' :
                                    'bg-blue-950 text-blue-300 border border-blue-800/40'
                                  }`}>
                                    {t.priority.toUpperCase()}
                                  </span>

                                  {/* Due Date */}
                                  {t.due_date ? (
                                    <span className={`text-[10px] font-mono flex items-center gap-1 ${
                                      isOverdue ? 'text-red-400 font-bold' : 'text-gray-400'
                                    }`}>
                                      <Calendar className="w-3 h-3" />
                                      {new Date(t.due_date).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-600 font-mono">Sin fecha</span>
                                  )}

                                  {/* Actions */}
                                  <button
                                    onClick={() => {
                                      setModalTask(t);
                                      setIsModalOpen(true);
                                    }}
                                    className="p-1.5 text-gray-500 hover:text-white rounded hover:bg-[#252538]"
                                    title="Editar tarea"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Expanded Inline Subtasks Table */}
                              {isExpanded && subtasks.length > 0 && (
                                <div className="bg-[#121218] pl-12 pr-4 py-2 border-t border-[#1e1e2a] space-y-1">
                                  {subtasks.map((sub) => (
                                    <div key={sub.id} className="flex items-center justify-between py-1 text-xs">
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => handleToggleTaskStatus(sub)}
                                          className="text-gray-500 hover:text-emerald-400"
                                        >
                                          {sub.status === 'completed' ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                          ) : (
                                            <Circle className="w-3.5 h-3.5 text-gray-500" />
                                          )}
                                        </button>
                                        <span className={sub.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-300'}>
                                          {sub.title}
                                        </span>
                                      </div>
                                      <span className="text-[10px] font-mono text-gray-500 uppercase">
                                        Subtarea
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Quick Inline Add Task Footer */}
                    <div className="p-2.5 bg-[#161622] border-t border-[#222232] flex items-center gap-2">
                      <Plus className="w-3.5 h-3.5 text-gray-400 ml-2" />
                      <input
                        type="text"
                        value={quickTitleByStatus[col.id] || ''}
                        onChange={(e) => setQuickTitleByStatus(prev => ({ ...prev, [col.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleQuickCreateTask(col.id);
                        }}
                        placeholder={`Añadir tarea rápida en ${col.title}... (Presiona Enter)`}
                        className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 outline-none"
                      />
                      {quickTitleByStatus[col.id] && (
                        <button
                          onClick={() => handleQuickCreateTask(col.id)}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold"
                        >
                          Guardar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ==================================================== */
            /* VISTA MATRIZ DE EISENHOWER                           */
            /* ==================================================== */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full min-h-[480px]">
              {[
                { 
                  id: 'do' as const, 
                  title: '1. HACER (Urgente & Importante)', 
                  desc: 'Tareas con alta prioridad e impacto inmediato',
                  border: 'border-red-500/40', 
                  bg: 'bg-red-500/5', 
                  color: 'text-red-400', 
                  badge: 'bg-red-950/80 text-red-300 border-red-800/60' 
                },
                { 
                  id: 'schedule' as const, 
                  title: '2. PROGRAMAR (No urgente, pero Importante)', 
                  desc: 'Planificación, proyectos estratégicos y hábitos',
                  border: 'border-blue-500/40', 
                  bg: 'bg-blue-500/5', 
                  color: 'text-blue-400', 
                  badge: 'bg-blue-950/80 text-blue-300 border-blue-800/60' 
                },
                { 
                  id: 'delegate' as const, 
                  title: '3. DELEGAR (Urgente, pero No importante)', 
                  desc: 'Interrupciones, llamadas y tareas operativas',
                  border: 'border-amber-500/40', 
                  bg: 'bg-amber-500/5', 
                  color: 'text-amber-400', 
                  badge: 'bg-amber-950/80 text-amber-300 border-amber-800/60' 
                },
                { 
                  id: 'delete' as const, 
                  title: '4. ELIMINAR / DESCARTAR (Ni urgente ni importante)', 
                  desc: 'Distracciones, tareas secundarias prescindibles',
                  border: 'border-gray-600/40', 
                  bg: 'bg-gray-500/5', 
                  color: 'text-gray-400', 
                  badge: 'bg-gray-800 text-gray-300 border-gray-700' 
                }
              ].map((quadrant) => {
                const quadTasks = filteredTasks.filter(t => t.eisenhower === quadrant.id);

                return (
                  <div
                    key={quadrant.id}
                    className={`flex flex-col bg-[#14141d] rounded-xl border ${quadrant.border} overflow-hidden shadow-sm`}
                  >
                    <div className="px-4 py-3 bg-[#181824] border-b border-[#252536] flex items-center justify-between">
                      <div>
                        <h3 className={`text-xs font-bold uppercase tracking-wider ${quadrant.color}`}>
                          {quadrant.title}
                        </h3>
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">{quadrant.desc}</p>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${quadrant.badge}`}>
                        {quadTasks.length}
                      </span>
                    </div>

                    <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[380px]">
                      {quadTasks.length === 0 ? (
                        <div className="h-28 flex items-center justify-center border border-dashed border-[#232334] rounded-lg text-center p-3">
                          <p className="text-[11px] text-gray-500">No hay tareas en este cuadrante</p>
                        </div>
                      ) : (
                        quadTasks.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => {
                              setModalTask(t);
                              setIsModalOpen(true);
                            }}
                            className="p-2.5 bg-[#181824] hover:bg-[#202030] rounded-lg border border-[#272738] hover:border-blue-500/40 transition cursor-pointer flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleTaskStatus(t);
                                }}
                                className="text-gray-500 hover:text-emerald-400 flex-shrink-0"
                              >
                                {t.status === 'completed' ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Circle className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                              <span className={`text-xs truncate ${t.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-200'}`}>
                                {t.title}
                              </span>
                            </div>
                            {t.due_date && (
                              <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">
                                {new Date(t.due_date).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Task Creation & Edition Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        task={modalTask}
        projects={projects}
        notes={notes}
        categories={categories}
        spaces={spaces}
        folders={folders}
        lists={lists}
        initialListId={getActiveListIdForNewTask()}
        initialStatus={modalInitialStatus}
        onSave={async (taskData) => {
          if (modalTask) {
            await onUpdateTask(modalTask.id, taskData);
            return modalTask;
          } else {
            const created = await onCreateTask(taskData);
            return (created as any) || undefined;
          }
        }}
        onDelete={async (id) => {
          await onDeleteTask(id);
          setIsModalOpen(false);
        }}
      />
    </div>
  );
};
