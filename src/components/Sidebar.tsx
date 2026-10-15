import React, { useState, useEffect } from 'react';
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
  Layers
} from 'lucide-react';
import { ViewMode, AppNote } from '../lib/types';
import { auth, AuthUser } from '../lib/auth';

interface SidebarProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  notes: AppNote[];
  selectedNoteId: string | null;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  onNewNotebook?: () => void;
  counts: {
    notebooks: number;
    notes: number;
    favorites: number;
    reminders: number;
    tasks: number;
    projects: number;
    objects: number;
  };
  onOpenQuickSwitcher: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  notes,
  selectedNoteId,
  onSelectNote,
  onNewNote,
  onNewNotebook,
  counts,
  onOpenQuickSwitcher
}) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    return auth.onAuthStateChanged((u) => setCurrentUser(u));
  }, []);

  const pinnedNotes = notes.filter(n => n.is_pinned);

  return (
    <aside className="w-64 bg-[#141419] border-r border-[#23232b] flex flex-col h-screen select-none">
      {/* App Header */}
      <div className="p-4 border-b border-[#23232b]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-900/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-white flex items-center gap-1.5">
                Segundo Cerebro
              </h1>
              <p className="text-[11px] text-gray-400">Cuadernos & Conocimiento</p>
            </div>
          </div>
        </div>

        {/* InsForge Status Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1a1a22] border border-[#2c2c38] text-[11px] text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <Database className="w-3 h-3 text-emerald-400" />
          <span className="truncate">InsForge BaaS Conectado</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-3 space-y-2 border-b border-[#23232b]">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onNewNotebook}
            className="flex items-center justify-center gap-1 px-2.5 py-2 bg-[#20202e] hover:bg-[#28283a] text-blue-300 rounded-lg text-xs font-semibold transition border border-blue-500/20"
          >
            <Book className="w-3.5 h-3.5 text-blue-400" />
            + Cuaderno
          </button>

          <button
            onClick={onNewNote}
            className="flex items-center justify-center gap-1 px-2.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition shadow-sm shadow-purple-900/30"
          >
            <Plus className="w-3.5 h-3.5" />
            + Nota
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
        <div className="px-2 pb-1 text-[11px] font-semibold tracking-wider uppercase text-gray-400">
          Cuadernos & Notas
        </div>

        {/* Cuadernos (Zoho Notebook style) */}
        <button
          onClick={() => onSelectView('notebooks')}
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
          onClick={() => onSelectView('all_notes')}
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
          onClick={() => onSelectView('favorites')}
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
          onClick={() => onSelectView('reminders')}
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

        <div className="pt-3 px-2 pb-1 text-[11px] font-semibold tracking-wider uppercase text-gray-400">
          Gestión & Entidades
        </div>

        <button
          onClick={() => onSelectView('tasks')}
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
          onClick={() => onSelectView('projects')}
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

        <button
          onClick={() => onSelectView('objects')}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition ${
            currentView === 'objects'
              ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
              : 'text-gray-300 hover:bg-[#1c1c24] hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Boxes className="w-4 h-4 text-emerald-400" />
            Objetos & Entidades
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e1e28] text-gray-400">
            {counts.objects}
          </span>
        </button>

        <div className="pt-3 px-2 pb-1 text-[11px] font-semibold tracking-wider uppercase text-gray-400">
          Visualización & Medios
        </div>

        <button
          onClick={() => onSelectView('graph')}
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
          onClick={() => onSelectView('files')}
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

        <button
          onClick={() => onSelectView('storage')}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition ${
            currentView === 'storage'
              ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30'
              : 'text-gray-400 hover:bg-[#1c1c24] hover:text-gray-300'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Database className="w-4 h-4 text-gray-400" />
            InsForge Storage (Legacy)
          </span>
          <span className="text-[10px] bg-gray-900 text-gray-400 border border-gray-800 px-1 rounded">
            app-storage
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
  );
};
