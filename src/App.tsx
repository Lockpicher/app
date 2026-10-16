import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { NotebooksView } from './components/NotebooksView';
import { NotebookNotesGrid } from './components/NotebookNotesGrid';
import { RichNoteEditor } from './components/RichNoteEditor';
import { RemindersView } from './components/RemindersView';
import { NotebookModal } from './components/NotebookModal';
import { TasksView } from './components/TasksView';
import { ProjectsView } from './components/ProjectsView';
import { ObjectsView } from './components/ObjectsView';
import { GraphView } from './components/GraphView';
import { StorageView } from './components/StorageView';
import { FilesManagerView } from './components/FilesManagerView';
import { CalendarView } from './components/CalendarView';
import { QuickSwitcher } from './components/QuickSwitcher';
import { db, storage } from './lib/insforge';
import { reminderService } from './lib/reminders';
import { 
  AppNotebook,
  AppNote, 
  AppReminder,
  AppProject, 
  AppTask, 
  AppObject, 
  AppLink, 
  AppAttachment, 
  AppFolder,
  TaskCategory,
  ViewMode 
} from './lib/types';
import { 
  Loader2, 
  Menu, 
  ChevronRight, 
  Book, 
  CheckSquare, 
  Calendar as CalendarIcon, 
  FolderKanban, 
  HardDrive 
} from 'lucide-react';

export function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('notebooks');
  const [loading, setLoading] = useState(true);

  // Core Data
  const [notebooks, setNotebooks] = useState<AppNotebook[]>([]);
  const [notes, setNotes] = useState<AppNote[]>([]);
  const [reminders, setReminders] = useState<AppReminder[]>([]);
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [tasks, setTasks] = useState<AppTask[]>([]);
  const [objects, setObjects] = useState<AppObject[]>([]);
  const [links, setLinks] = useState<AppLink[]>([]);
  const [attachments, setAttachments] = useState<AppAttachment[]>([]);
  const [folders, setFolders] = useState<AppFolder[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);

  // Selection & Editor States
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isEditingNote, setIsEditingNote] = useState<boolean>(false);
  const [isQuickSwitcherOpen, setIsQuickSwitcherOpen] = useState(false);

  // Notebook creation modal from sidebar
  const [isNotebookModalOpen, setIsNotebookModalOpen] = useState(false);
  const [editingNotebook, setEditingNotebook] = useState<AppNotebook | null>(null);

  // Responsive Sidebar States (Segundo Cerebro collapse & mobile drawer)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('segundo_cerebro_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('segundo_cerebro_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Load initial data from InsForge in progressive stages for instant startup
  const loadData = async () => {
    try {
      setLoading(true);

      // Phase 1: Critical data for first screen (Notebooks and Notes)
      const [nbs, n] = await Promise.all([
        db.getNotebooks(),
        db.getNotes()
      ]);

      // If no notebooks exist yet, create a default one
      let finalNbs = nbs;
      if (nbs.length === 0) {
        const defaultNb = await db.createNotebook({
          name: 'Mi Primer Cuaderno',
          description: 'Cuaderno principal para tus notas, ideas y proyectos',
          cover_type: 'gallery',
          cover_url: 'classic-minimal',
          color: '#3b82f6',
          is_default: true,
          is_archived: false
        });
        if (defaultNb) finalNbs = [defaultNb];
      }

      setNotebooks(finalNbs);
      setNotes(n);
      if (n.length > 0 && !selectedNoteId) {
        setSelectedNoteId(n[0].id);
      }

      // Dismiss full-screen blocking loader right away!
      setLoading(false);

      // Phase 2: Deferred load for other views (Projects, Tasks, Objects, Reminders, Files, Links)
      Promise.all([
        db.getReminders().catch(() => []),
        db.getProjects().catch(() => []),
        db.getTasks().catch(() => []),
        db.getObjects().catch(() => []),
        db.getLinks().catch(() => []),
        db.getAttachments().catch(() => []),
        db.getFileFolders().catch(() => []),
        db.getTaskCategories().catch(() => [])
      ]).then(([rems, p, t, o, l, a, flds, cats]) => {
        setReminders(rems);
        setProjects(p);
        setTasks(t);
        setObjects(o);
        setLinks(l);
        setAttachments(a);
        setFolders(flds);
        setCategories(cats);
      }).catch(err => {
        console.warn('Background sync error (non-fatal):', err);
      });

    } catch (err) {
      console.error('Error cargando datos de InsForge:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Reminders scheduler listener
  useEffect(() => {
    if (reminders.length > 0) {
      reminderService.startListening(reminders, (r) => {
        // Notification triggered
        console.log('Recordatorio activado:', r.title);
      });
    }
    return () => {
      reminderService.stopListening();
    };
  }, [reminders]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickSwitcherOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // All entities for autocomplete & linking
  const allEntities = [
    ...notes.map(n => ({ id: n.id, title: n.title, type: 'note' })),
    ...projects.map(p => ({ id: p.id, title: p.title, type: 'project' })),
    ...tasks.map(t => ({ id: t.id, title: t.title, type: 'task' })),
    ...objects.map(o => ({ id: o.id, title: o.title, type: 'object' }))
  ];

  // ==========================================
  // NOTEBOOK ACTIONS
  // ==========================================
  const handleCreateNotebook = async (data: Partial<AppNotebook>) => {
    try {
      const created = await db.createNotebook(data);
      if (created) {
        setNotebooks(prev => [created, ...prev]);
      }
    } catch (err: any) {
      alert('Error creando cuaderno: ' + err.message);
    }
  };

  const handleUpdateNotebook = async (id: string, updates: Partial<AppNotebook>) => {
    try {
      const updated = await db.updateNotebook(id, updates);
      if (updated) {
        setNotebooks(prev => prev.map(nb => nb.id === id ? updated : nb));
      }
    } catch (err: any) {
      alert('Error actualizando cuaderno: ' + err.message);
    }
  };

  const handleDeleteNotebook = async (id: string) => {
    if (!window.confirm('¿Eliminar este cuaderno? Las notas dentro de él no se borrarán pero quedarán sin cuaderno.')) return;
    try {
      await db.deleteNotebook(id);
      setNotebooks(prev => prev.filter(nb => nb.id !== id));
      if (selectedNotebookId === id) {
        setSelectedNotebookId(null);
      }
    } catch (err: any) {
      alert('Error eliminando cuaderno: ' + err.message);
    }
  };

  const handleSelectNotebook = (notebook: AppNotebook) => {
    setSelectedNotebookId(notebook.id);
    setIsEditingNote(false);
  };

  // ==========================================
  // NOTES ACTIONS (Zoho Notebook style)
  // ==========================================
  const handleNewNote = async (initialData?: Partial<AppNote>) => {
    try {
      // Determine default notebook
      const targetNotebookId = selectedNotebookId || 
        (notebooks.find(n => n.is_default)?.id) || 
        (notebooks[0]?.id) || 
        null;

      const created = await db.createNote({
        title: initialData?.title || 'Nueva Nota',
        content: initialData?.content || '',
        plain_text: initialData?.plain_text || '',
        notebook_id: initialData?.notebook_id || targetNotebookId,
        note_type: initialData?.note_type || 'text',
        category: initialData?.category || 'General',
        tags: initialData?.tags || [],
        is_pinned: initialData?.is_pinned || false,
        is_favorite: initialData?.is_favorite || false,
        audio_url: initialData?.audio_url || null,
        audio_duration: initialData?.audio_duration || null,
        audio_transcription: initialData?.audio_transcription || null,
        thumbnail_url: initialData?.thumbnail_url || null
      });

      if (created) {
        setNotes(prev => [created, ...prev]);
        setSelectedNoteId(created.id);
        setIsEditingNote(true);
      }
    } catch (err: any) {
      alert('Error creando nota: ' + err.message);
    }
  };

  const handleOpenNote = (note: AppNote) => {
    setSelectedNoteId(note.id);
    setIsEditingNote(true);
  };

  const handleCloseEditor = () => {
    setIsEditingNote(false);
  };

  const handleSaveNote = async (noteId: string, updates: Partial<AppNote>) => {
    // 1. Optimistic UI update so local state stays fresh
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, ...updates, updated_at: new Date().toISOString() } : n));

    try {
      const updated = await db.updateNote(noteId, updates);
      if (updated) {
        setNotes(prev => prev.map(n => n.id === noteId ? updated : n));
      }

      // If reminder was updated, reload reminders
      if (updates.reminder_at !== undefined) {
        const freshReminders = await db.getReminders();
        setReminders(freshReminders);
      }
    } catch (err: any) {
      console.error('Error guardando nota en backend:', err);
      // Propagate error so editor knows saving failed and can allow retry without losing text
      throw err;
    }
  };

  const handleDuplicateNote = async (noteId: string) => {
    try {
      const duplicated = await db.duplicateNote(noteId);
      if (duplicated) {
        setNotes(prev => [duplicated, ...prev]);
        setSelectedNoteId(duplicated.id);
        setIsEditingNote(true);
      }
    } catch (err: any) {
      alert('Error duplicando nota: ' + err.message);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta nota permanentemente?')) return;
    try {
      await db.deleteNote(noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
      if (selectedNoteId === noteId) {
        setSelectedNoteId(null);
        setIsEditingNote(false);
      }
    } catch (err: any) {
      alert('Error eliminando nota: ' + err.message);
    }
  };

  const handleMoveNote = async (noteId: string, targetNotebookId: string) => {
    try {
      const updated = await db.updateNote(noteId, { notebook_id: targetNotebookId });
      if (updated) {
        setNotes(prev => prev.map(n => n.id === noteId ? updated : n));
      }
    } catch (err: any) {
      alert('Error moviendo nota de cuaderno: ' + err.message);
    }
  };

  const handleToggleFavorite = async (note: AppNote) => {
    const nextFav = !note.is_favorite;
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, is_favorite: nextFav } : n));
    try {
      await db.updateNote(note.id, { is_favorite: nextFav });
    } catch (err: any) {
      console.error('Error actualizando favorito:', err);
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, is_favorite: !nextFav } : n));
    }
  };

  const handleTogglePin = async (note: AppNote) => {
    const nextPin = !note.is_pinned;
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, is_pinned: nextPin } : n));
    try {
      await db.updateNote(note.id, { is_pinned: nextPin });
    } catch (err: any) {
      console.error('Error actualizando pin:', err);
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, is_pinned: !nextPin } : n));
    }
  };

  // ==========================================
  // REMINDERS ACTIONS
  // ==========================================
  const handleToggleReminderStatus = async (reminderId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    setReminders(prev => prev.map(r => r.id === reminderId ? { ...r, status: nextStatus as any } : r));
    try {
      await db.updateReminder(reminderId, { status: nextStatus as any });
    } catch (err: any) {
      console.error('Error actualizando recordatorio:', err);
      setReminders(prev => prev.map(r => r.id === reminderId ? { ...r, status: currentStatus as any } : r));
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      await db.deleteReminder(reminderId);
      setReminders(prev => prev.filter(r => r.id !== reminderId));
    } catch (err: any) {
      alert('Error eliminando recordatorio: ' + err.message);
    }
  };

  // ==========================================
  // TASKS ACTIONS
  // ==========================================
  const handleCreateTask = async (task: Partial<AppTask>): Promise<AppTask | null> => {
    const created = await db.createTask(task);
    if (created) {
      setTasks(prev => [created, ...prev]);
    }
    return created;
  };

  const handleCreateTaskFromNote = async (title: string, noteId: string) => {
    const created = await db.createTask({
      title,
      note_id: noteId,
      status: 'todo',
      priority: 'medium'
    });
    if (created) {
      setTasks(prev => [created, ...prev]);
    }
  };

  const handleUpdateTask = async (id: string, updates: Partial<AppTask>) => {
    const previousTasks = tasks;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t));

    try {
      const updated = await db.updateTask(id, updates);
      if (updated) {
        setTasks(prev => prev.map(t => t.id === id ? updated : t));
      }
    } catch (err: any) {
      console.error('Error actualizando tarea en InsForge, revirtiendo estado:', err);
      setTasks(previousTasks);
      alert('Error al actualizar la tarea: ' + (err.message || 'Error desconocido'));
    }
  };

  const handleDeleteTask = async (id: string) => {
    const previousTasks = tasks;
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await db.deleteTask(id);
    } catch (err: any) {
      console.error('Error eliminando tarea:', err);
      setTasks(previousTasks);
      alert('Error al eliminar la tarea: ' + err.message);
    }
  };

  // ==========================================
  // PROJECTS ACTIONS
  // ==========================================
  const handleCreateProject = async (project: Partial<AppProject>) => {
    const created = await db.createProject(project);
    if (created) setProjects(prev => [created, ...prev]);
  };

  const handleUpdateProject = async (id: string, updates: Partial<AppProject>) => {
    const previousProjects = projects;
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p));
    try {
      const updated = await db.updateProject(id, updates);
      if (updated) setProjects(prev => prev.map(p => p.id === id ? updated : p));
    } catch (err: any) {
      console.error('Error actualizando proyecto en InsForge, revirtiendo estado:', err);
      setProjects(previousProjects);
      alert('Error al actualizar proyecto: ' + (err.message || 'Error desconocido'));
    }
  };

  const handleDeleteProject = async (id: string) => {
    const previousProjects = projects;
    setProjects(prev => prev.filter(p => p.id !== id));
    try {
      await db.deleteProject(id);
    } catch (err: any) {
      console.error('Error eliminando proyecto:', err);
      setProjects(previousProjects);
      alert('Error al eliminar proyecto: ' + err.message);
    }
  };

  // ==========================================
  // OBJECTS ACTIONS
  // ==========================================
  const handleCreateObject = async (obj: Partial<AppObject>) => {
    const created = await db.createObject(obj);
    if (created) setObjects(prev => [created, ...prev]);
  };

  const handleUpdateObject = async (id: string, updates: Partial<AppObject>) => {
    const updated = await db.updateObject(id, updates);
    if (updated) setObjects(prev => prev.map(o => o.id === id ? updated : o));
  };

  const handleDeleteObject = async (id: string) => {
    await db.deleteObject(id);
    setObjects(prev => prev.filter(o => o.id !== id));
  };

  const handleAttachmentCreated = (attachment: AppAttachment) => {
    setAttachments(prev => [attachment, ...prev]);
  };

  const handleAttachmentUpdated = (updated: AppAttachment) => {
    setAttachments(prev => prev.map(a => a.id === updated.id ? updated : a));
  };

  const handleAttachmentDeleted = async (id: string, path: string) => {
    await storage.deleteFile(path);
    await db.deleteAttachment(id);
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleFoldersChanged = async () => {
    const flds = await db.getFileFolders();
    setFolders(flds);
  };

  // ==========================================
  // NAVIGATION BETWEEN ENTITIES
  // ==========================================
  const handleNavigateToEntity = (id: string, type: string) => {
    if (type === 'note') {
      setSelectedNoteId(id);
      setIsEditingNote(true);
      setCurrentView('notebooks');
    } else if (type === 'task') {
      setIsEditingNote(false);
      setCurrentView('tasks');
    } else if (type === 'project') {
      setIsEditingNote(false);
      setCurrentView('projects');
    } else if (type === 'object') {
      setIsEditingNote(false);
      setCurrentView('objects');
    }
  };

  const activeNote = notes.find(n => n.id === selectedNoteId);
  const selectedNotebook = notebooks.find(nb => nb.id === selectedNotebookId) || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#121217] text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-400">Cargando Cuadernos y Base de Datos de InsForge...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden bg-obsidian-bg">
      {/* Mobile Top App Bar (visible on <lg screens) */}
      <header className="lg:hidden h-14 bg-[#141419] border-b border-[#23232b] flex items-center justify-between px-4 z-30 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-1 text-gray-300 hover:text-white rounded-lg hover:bg-[#20202a] active:bg-[#282836] transition"
            aria-label="Abrir menú de navegación"
          >
            <Menu className="w-5 h-5 text-gray-200" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <span className="text-xs font-bold">SC</span>
            </div>
            <span className="text-sm font-bold text-white tracking-wide truncate max-w-[150px] sm:max-w-xs">
              {currentView === 'notebooks' && 'Cuadernos'}
              {currentView === 'all_notes' && 'Todas las notas'}
              {currentView === 'favorites' && 'Favoritos'}
              {currentView === 'reminders' && 'Recordatorios'}
              {currentView === 'calendar' && 'Calendario'}
              {currentView === 'tasks' && 'Tareas'}
              {currentView === 'projects' && 'Proyectos'}
              {currentView === 'objects' && 'Objetos'}
              {currentView === 'graph' && 'Grafo'}
              {currentView === 'files' && 'Archivos R2'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleNewNote()}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium shadow-sm transition"
          >
            <span>+ Nota</span>
          </button>
        </div>
      </header>

      {/* Floating Re-expand Button for Desktop when Sidebar is collapsed */}
      {isSidebarCollapsed && (
        <button
          onClick={toggleSidebarCollapse}
          className="hidden lg:flex fixed left-3 top-3 z-40 p-2 rounded-xl bg-[#1a1a24] border border-[#2b2b3a] hover:border-purple-500/50 text-gray-300 hover:text-white shadow-xl hover:scale-105 transition duration-200 items-center gap-1.5 text-xs font-medium"
          title="Mostrar Segundo Cerebro"
          aria-label="Expandir navegación lateral"
        >
          <ChevronRight className="w-4 h-4 text-purple-400" />
          <span className="text-[11px] font-semibold text-gray-200">Menú</span>
        </button>
      )}

      {/* Left Sidebar (Desktop responsive / Mobile drawer) */}
      <Sidebar
        currentView={currentView}
        onSelectView={(v) => {
          setIsEditingNote(false);
          if (v === 'notebooks') setSelectedNotebookId(null);
          setCurrentView(v);
        }}
        notes={notes}
        selectedNoteId={selectedNoteId}
        onSelectNote={(id) => {
          setSelectedNoteId(id);
          setIsEditingNote(true);
        }}
        onNewNote={() => handleNewNote({ note_type: 'text', title: 'Nueva Nota' })}
        onNewTaskNote={() => {
          const defaultTaskListHtml = `
            <ul data-type="taskList">
              <li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div>Primera tarea</div></li>
              <li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div>Segunda tarea</div></li>
              <li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div>Nueva tarea...</div></li>
            </ul>
          `.trim();
          handleNewNote({
            title: 'Lista de Tareas',
            note_type: 'tasks',
            content: defaultTaskListHtml,
            plain_text: 'Primera tarea\nSegunda tarea\nNueva tarea...'
          });
        }}
        onNewNotebook={() => {
          setEditingNotebook(null);
          setIsNotebookModalOpen(true);
        }}
        counts={{
          notebooks: notebooks.filter(nb => !nb.is_archived).length,
          notes: notes.length,
          favorites: notes.filter(n => n.is_favorite).length,
          reminders: reminders.filter(r => r.status === 'pending').length,
          tasks: tasks.length,
          projects: projects.length,
          objects: objects.length
        }}
        onOpenQuickSwitcher={() => setIsQuickSwitcherOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0 pb-14 lg:pb-0 relative">
        {/* If user is editing a note, display the RichNoteEditor */}
        {isEditingNote && activeNote ? (
          <RichNoteEditor
            key={activeNote.id}
            note={activeNote}
            notebooks={notebooks}
            projects={projects}
            tasks={tasks}
            objects={objects}
            onBack={handleCloseEditor}
            onSave={handleSaveNote}
            onDelete={handleDeleteNote}
            onNavigateToEntity={handleNavigateToEntity}
            onCreateTaskFromNote={handleCreateTaskFromNote}
          />
        ) : (
          <>
            {/* Cuadernos View */}
            {currentView === 'notebooks' && (
              selectedNotebookId && selectedNotebook ? (
                <NotebookNotesGrid
                  notebook={selectedNotebook}
                  notes={notes.filter(n => n.notebook_id === selectedNotebook.id)}
                  notebooks={notebooks}
                  onBackToNotebooks={() => setSelectedNotebookId(null)}
                  onOpenNote={handleOpenNote}
                  onCreateNote={handleNewNote}
                  onDuplicateNote={handleDuplicateNote}
                  onDeleteNote={handleDeleteNote}
                  onMoveNote={handleMoveNote}
                  onToggleFavorite={handleToggleFavorite}
                  onTogglePin={handleTogglePin}
                />
              ) : (
                <NotebooksView
                  notebooks={notebooks}
                  notes={notes}
                  onCreateNotebook={handleCreateNotebook}
                  onUpdateNotebook={handleUpdateNotebook}
                  onDeleteNotebook={handleDeleteNotebook}
                  onOpenNotebook={handleSelectNotebook}
                />
              )
            )}

            {/* Todas las Notas View */}
            {(currentView === 'all_notes' || currentView === 'notes') && (
              <NotebookNotesGrid
                notebook={null}
                notes={notes}
                notebooks={notebooks}
                onBackToNotebooks={() => setCurrentView('notebooks')}
                onOpenNote={handleOpenNote}
                onCreateNote={handleNewNote}
                onDuplicateNote={handleDuplicateNote}
                onDeleteNote={handleDeleteNote}
                onMoveNote={handleMoveNote}
                onToggleFavorite={handleToggleFavorite}
                onTogglePin={handleTogglePin}
              />
            )}

            {/* Favoritos View */}
            {currentView === 'favorites' && (
              <NotebookNotesGrid
                notebook={null}
                notes={notes.filter(n => n.is_favorite)}
                notebooks={notebooks}
                onBackToNotebooks={() => setCurrentView('notebooks')}
                onOpenNote={handleOpenNote}
                onCreateNote={handleNewNote}
                onDuplicateNote={handleDuplicateNote}
                onDeleteNote={handleDeleteNote}
                onMoveNote={handleMoveNote}
                onToggleFavorite={handleToggleFavorite}
                onTogglePin={handleTogglePin}
              />
            )}

            {/* Recordatorios View */}
            {currentView === 'reminders' && (
              <RemindersView
                reminders={reminders}
                notes={notes}
                tasks={tasks}
                onToggleReminderStatus={handleToggleReminderStatus}
                onDeleteReminder={handleDeleteReminder}
                onOpenNote={handleOpenNote}
              />
            )}

            {/* Calendario Central Integrado */}
            {currentView === 'calendar' && (
              <CalendarView
                tasks={tasks}
                notes={notes}
                projects={projects}
                reminders={reminders}
                onUpdateTask={handleUpdateTask}
                onCreateTask={handleCreateTask}
                onOpenNote={(id: string) => {
                  const note = notes.find(n => n.id === id);
                  if (note) handleOpenNote(note);
                }}
                onCreateNote={handleNewNote}
              />
            )}

            {/* Tareas View */}
            {currentView === 'tasks' && (
              <TasksView
                tasks={tasks}
                projects={projects}
                notes={notes}
                categories={categories}
                onCreateTask={handleCreateTask}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                onNavigateToNote={(noteId) => {
                  setSelectedNoteId(noteId);
                  setIsEditingNote(true);
                  setCurrentView('notebooks');
                }}
              />
            )}

            {/* Proyectos View */}
            {currentView === 'projects' && (
              <ProjectsView
                projects={projects}
                tasks={tasks}
                notes={notes}
                onCreateProject={handleCreateProject}
                onUpdateProject={handleUpdateProject}
                onDeleteProject={handleDeleteProject}
                onSelectProject={() => {}}
              />
            )}

            {/* Objetos View */}
            {currentView === 'objects' && (
              <ObjectsView
                objects={objects}
                projects={projects}
                attachments={attachments}
                onAttachmentCreated={handleAttachmentCreated}
                onAttachmentDeleted={handleAttachmentDeleted}
                onCreateObject={handleCreateObject}
                onUpdateObject={handleUpdateObject}
                onDeleteObject={handleDeleteObject}
                notes={notes}
                tasks={tasks}
                onOpenNote={handleOpenNote}
              />
            )}

            {/* Graph View */}
            {currentView === 'graph' && (
              <GraphView
                notes={notes}
                projects={projects}
                tasks={tasks}
                objects={objects}
                links={links}
                onNavigateToEntity={handleNavigateToEntity}
              />
            )}

            {/* Files View (Cloudflare R2 + InsForge) */}
            {currentView === 'files' && (
              <FilesManagerView
                attachments={attachments}
                folders={folders}
                onAttachmentCreated={handleAttachmentCreated}
                onAttachmentUpdated={handleAttachmentUpdated}
                onAttachmentDeleted={handleAttachmentDeleted}
                onFoldersChanged={handleFoldersChanged}
                onNavigateToEntity={handleNavigateToEntity}
              />
            )}

            {/* Storage View (Legacy) */}
            {currentView === 'storage' && (
              <StorageView
                attachments={attachments}
                onAttachmentCreated={handleAttachmentCreated}
                onAttachmentDeleted={handleAttachmentDeleted}
              />
            )}
          </>
        )}

        {/* Mobile Bottom Navigation Bar (visible on <lg screens) */}
        <nav 
          className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#121218]/95 backdrop-blur-md border-t border-[#23232f] flex items-center justify-around px-2 z-30"
          aria-label="Navegación inferior móvil"
        >
          <button
            onClick={() => {
              setIsEditingNote(false);
              setSelectedNotebookId(null);
              setCurrentView('notebooks');
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
              currentView === 'notebooks' || currentView === 'all_notes' ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Book className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-medium leading-none">Cuadernos</span>
          </button>

          <button
            onClick={() => {
              setIsEditingNote(false);
              setCurrentView('tasks');
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
              currentView === 'tasks' ? 'text-amber-400' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <CheckSquare className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-medium leading-none">Tareas</span>
          </button>

          <button
            onClick={() => {
              setIsEditingNote(false);
              setCurrentView('calendar');
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
              currentView === 'calendar' ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <CalendarIcon className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-medium leading-none">Calendario</span>
          </button>

          <button
            onClick={() => {
              setIsEditingNote(false);
              setCurrentView('projects');
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
              currentView === 'projects' ? 'text-purple-400' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <FolderKanban className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-medium leading-none">Proyectos</span>
          </button>

          <button
            onClick={() => {
              setIsEditingNote(false);
              setCurrentView('files');
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
              currentView === 'files' ? 'text-cyan-400' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <HardDrive className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-medium leading-none">Archivos</span>
          </button>
        </nav>
      </main>

      {/* Global Notebook Modal (triggered from sidebar) */}
      <NotebookModal
        isOpen={isNotebookModalOpen}
        onClose={() => setIsNotebookModalOpen(false)}
        notebook={editingNotebook}
        onSave={async (data) => {
          if (editingNotebook) {
            await handleUpdateNotebook(editingNotebook.id, data);
          } else {
            await handleCreateNotebook(data);
          }
          setIsNotebookModalOpen(false);
        }}
        onDelete={handleDeleteNotebook}
      />

      {/* Global Quick Switcher (Ctrl+K) */}
      <QuickSwitcher
        isOpen={isQuickSwitcherOpen}
        onClose={() => setIsQuickSwitcherOpen(false)}
        notes={notes}
        tasks={tasks}
        projects={projects}
        objects={objects}
        onSelectEntity={handleNavigateToEntity}
      />
    </div>
  );
}

export default App;
