import React, { useState, useMemo, useRef } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  Star, 
  FileText, 
  Image as ImageIcon, 
  Mic, 
  CheckSquare, 
  Paperclip, 
  Link2, 
  MoreVertical, 
  Trash2, 
  Copy, 
  FolderInput, 
  Calendar, 
  Upload, 
  Sparkles,
  Volume2,
  Clock,
  Book,
  Pin,
  Check,
  Lock,
  LayoutGrid,
  List,
  ArrowUpDown,
  Palette,
  X,
  File,
  ChevronRight,
  SlidersHorizontal,
  FolderOpen
} from 'lucide-react';
import { AppNote, AppNotebook, NoteType, AppTask } from '../lib/types';
import { getCoverById } from '../lib/covers';
import { isNoteUnlocked, unlockNoteSession, verifyPassword } from '../lib/security';
import { r2Storage } from '../lib/r2Client';
import { AudioRecorderModal } from './AudioRecorderModal';
import { PasswordUnlockModal } from './PasswordUnlockModal';

type SortOption = 'recent' | 'oldest' | 'title_asc' | 'title_desc';
type ViewModeOption = 'grid' | 'list';

interface NotebookNotesGridProps {
  notebook: AppNotebook | null; // null if viewing "Todas las notas" or "Favoritos"
  isFavoritesView?: boolean;
  notes: AppNote[];
  notebooks: AppNotebook[];
  onBackToNotebooks: () => void;
  onOpenNote: (note: AppNote) => void;
  onCreateNote: (initialData?: Partial<AppNote>) => Promise<void>;
  onDuplicateNote: (noteId: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onMoveNote: (noteId: string, targetNotebookId: string) => Promise<void>;
  onToggleFavorite: (note: AppNote) => Promise<void>;
  onTogglePin?: (note: AppNote) => Promise<void>;
  onNewTask?: (initialData?: Partial<AppTask>) => void;
  onNewCanvas?: (notebookId?: string) => Promise<void>;
}

export const NotebookNotesGrid: React.FC<NotebookNotesGridProps> = ({
  notebook,
  isFavoritesView = false,
  notes,
  notebooks,
  onBackToNotebooks,
  onOpenNote,
  onCreateNote,
  onDuplicateNote,
  onDeleteNote,
  onMoveNote,
  onToggleFavorite,
  onTogglePin,
  onNewTask,
  onNewCanvas
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [viewMode, setViewMode] = useState<ViewModeOption>('grid');

  // Modals
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isUploadingImageNote, setIsUploadingImageNote] = useState(false);
  const [isUploadingFileNote, setIsUploadingFileNote] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [movingNote, setMovingNote] = useState<AppNote | null>(null);
  const [unlockTargetNote, setUnlockTargetNote] = useState<AppNote | null>(null);
  const [activeMenuNoteId, setActiveMenuNoteId] = useState<string | null>(null);
  const [isMobileQuickMenuOpen, setIsMobileQuickMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleNoteCardClick = (noteItem: AppNote) => {
    setActiveMenuNoteId(null);
    if (noteItem.is_locked && noteItem.password_hash && !isNoteUnlocked(noteItem.id)) {
      setUnlockTargetNote(noteItem);
      return;
    }
    onOpenNote(noteItem);
  };

  // Extract task items from note HTML content
  const extractTaskList = (html: string): { total: number; completed: number; items: { text: string; checked: boolean }[] } => {
    if (!html) return { total: 0, completed: 0, items: [] };
    const items: { text: string; checked: boolean }[] = [];
    
    const regex = /<li[^>]*data-type="taskItem"[^>]*data-checked="(true|false)"[^>]*>([\s\S]*?)<\/li>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const checked = match[1] === 'true';
      const innerHtml = match[2];
      const text = innerHtml.replace(/<label[\s\S]*?<\/label>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      items.push({ text: text || 'Tarea sin texto', checked });
    }

    if (items.length === 0 && (html.includes('type="checkbox"') || html.includes('data-checked='))) {
      const fallbackRegex = /<li[^>]*>[\s\S]*?<input[^>]*type="checkbox"([^>]*)>([\s\S]*?)<\/li>/gi;
      let fbMatch;
      while ((fbMatch = fallbackRegex.exec(html)) !== null) {
        const isChecked = fbMatch[1].includes('checked');
        const text = fbMatch[2].replace(/<[^>]+>/g, ' ').trim();
        items.push({ text: text || 'Tarea', checked: isChecked });
      }
    }

    const completed = items.filter(i => i.checked).length;
    return { total: items.length, completed, items };
  };

  const isTaskNote = (n: AppNote): boolean => {
    if (n.note_type === 'tasks') return true;
    if (n.content && (n.content.includes('data-type="taskList"') || n.content.includes('data-type="taskItem"'))) {
      return true;
    }
    return false;
  };

  // Base notes for current notebook view
  const baseNotes = useMemo(() => {
    return notes.filter(n => {
      if (notebook && n.notebook_id !== notebook.id) return false;
      if (isFavoritesView && !n.is_favorite) return false;
      if (n.is_archived) return false;
      return true;
    });
  }, [notes, notebook, isFavoritesView]);

  // Extract all distinct tags in current notebook notes
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const note of baseNotes) {
      if (note.tags && Array.isArray(note.tags)) {
        for (const t of note.tags) {
          if (t.trim()) set.add(t.trim());
        }
      }
    }
    return Array.from(set);
  }, [baseNotes]);

  // Counts for tabs
  const counts = useMemo(() => ({
    all: baseNotes.length,
    favorites: baseNotes.filter(n => n.is_favorite).length,
    audio: baseNotes.filter(n => n.note_type === 'audio' || Boolean(n.audio_url)).length,
    images: baseNotes.filter(n => n.note_type === 'image' || Boolean(n.thumbnail_url) || Boolean(n.content && n.content.includes('<img'))).length,
    tasks: baseNotes.filter(n => isTaskNote(n)).length,
  }), [baseNotes]);

  // Filtered & Sorted notes
  const processedNotes = useMemo(() => {
    const list = baseNotes.filter(n => {
      if (filterType === 'favorites' && !n.is_favorite) return false;
      if (filterType === 'images') {
        const hasImg = n.note_type === 'image' || Boolean(n.thumbnail_url) || Boolean(n.content && n.content.includes('<img'));
        if (!hasImg) return false;
      }
      if (filterType === 'audio') {
        const isVoice = n.note_type === 'audio' || Boolean(n.audio_url);
        if (!isVoice) return false;
      }
      if (filterType === 'tasks') {
        if (!isTaskNote(n)) return false;
      }

      if (selectedTag) {
        if (!n.tags || !n.tags.includes(selectedTag)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (n.title || '').toLowerCase().includes(q);
        const matchText = (n.plain_text || n.content || '').toLowerCase().includes(q);
        const matchTag = (n.tags || []).some(t => t.toLowerCase().includes(q));
        return matchTitle || matchText || matchTag;
      }

      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'title_asc') {
        return (a.title || '').localeCompare(b.title || '');
      }
      if (sortBy === 'title_desc') {
        return (b.title || '').localeCompare(a.title || '');
      }
      if (sortBy === 'oldest') {
        return new Date(a.updated_at || a.created_at).getTime() - new Date(b.updated_at || b.created_at).getTime();
      }
      // default: recent
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    });
  }, [baseNotes, filterType, selectedTag, searchQuery, sortBy]);

  const cleanExcerpt = (note: AppNote): string => {
    if (note.plain_text) return note.plain_text.slice(0, 150);
    const raw = note.content || '';
    const clean = raw.replace(/<[^>]+>/g, ' ').replace(/[#*`_\[\]]/g, ' ').trim();
    return clean.slice(0, 150);
  };

  // Quick Action Handlers
  const handleCreateTextNote = () => {
    onCreateNote({
      title: 'Nueva Nota',
      note_type: 'text',
      notebook_id: notebook?.id || null,
    });
  };

  const handleCreateTaskListNote = () => {
    const defaultTaskListHtml = `
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div>Primera tarea</div></li>
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div>Segunda tarea</div></li>
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox"></label><div>Nueva tarea...</div></li>
      </ul>
    `.trim();
    onCreateNote({
      title: 'Lista de Tareas',
      note_type: 'tasks',
      content: defaultTaskListHtml,
      plain_text: 'Primera tarea\nSegunda tarea\nNueva tarea...',
      notebook_id: notebook?.id || null
    });
  };

  const handleUploadImageNote = async (file: File) => {
    try {
      setIsUploadingImageNote(true);
      const res = await r2Storage.uploadFile(file, 'notes/images');
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').trim() || 'Imagen';
      const imgHtml = `<p><img src="${res.url}" alt="${cleanTitle}" /></p><p></p>`;

      await onCreateNote({
        title: cleanTitle,
        note_type: 'image',
        thumbnail_url: res.url,
        content: imgHtml,
        plain_text: '',
        notebook_id: notebook?.id || null
      });
    } catch (err: any) {
      alert('Error al subir imagen para la nota: ' + (err.message || 'Error de red'));
    } finally {
      setIsUploadingImageNote(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleUploadFileAttachmentNote = async (file: File) => {
    try {
      setIsUploadingFileNote(true);
      const res = await r2Storage.uploadFile(file, 'notes/attachments');
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').trim() || 'Archivo adjunto';
      const fileHtml = `<p>📎 <a href="${res.url}" target="_blank" rel="noopener noreferrer">${file.name}</a></p><p></p>`;

      await onCreateNote({
        title: cleanTitle,
        note_type: 'file',
        content: fileHtml,
        plain_text: `Archivo: ${file.name}`,
        notebook_id: notebook?.id || null
      });
    } catch (err: any) {
      alert('Error al subir archivo: ' + (err.message || 'Error de red'));
    } finally {
      setIsUploadingFileNote(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateCanvas = () => {
    if (onNewCanvas) {
      onNewCanvas(notebook?.id);
    }
  };

  const handleCreateTask = () => {
    if (onNewTask) {
      onNewTask();
    }
  };

  // Drag and drop files from desktop directly into notebook
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDropFiles = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files);

    for (const file of files) {
      try {
        const isImg = file.type.startsWith('image/');
        const res = await r2Storage.uploadFile(file, isImg ? 'notes/images' : 'notes/files');
        const cleanTitle = file.name.replace(/\.[^/.]+$/, '').trim() || (isImg ? 'Imagen' : 'Archivo');
        
        await onCreateNote({
          title: cleanTitle,
          note_type: isImg ? 'image' : 'file',
          thumbnail_url: isImg ? res.url : undefined,
          content: isImg ? `<p><img src="${res.url}" alt="${cleanTitle}" /></p><p></p>` : `<p>📎 <a href="${res.url}">${file.name}</a></p>`,
          plain_text: '',
          notebook_id: notebook?.id || null
        });
      } catch (err: any) {
        console.error('Error subiendo archivo arrastrado:', err);
        alert(`Error al subir ${file.name}: ` + (err.message || 'Error de conexión'));
      }
    }
  };

  const notebookCoverPreset = notebook ? getCoverById(notebook.cover_url) : null;

  return (
    <div 
      onClick={() => setActiveMenuNoteId(null)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropFiles}
      className="flex-1 flex flex-col h-screen bg-[#14141e] overflow-hidden relative select-none"
    >
      {/* Hidden File Inputs for quick creation */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleUploadImageNote(e.target.files[0]);
          }
        }}
      />
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleUploadFileAttachmentNote(e.target.files[0]);
          }
        }}
      />

      {/* Drag & Drop Visual Indicator */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-blue-600/20 backdrop-blur-sm border-2 border-dashed border-blue-400 flex flex-col items-center justify-center pointer-events-none animate-fadeIn">
          <Upload className="w-12 h-12 text-blue-400 animate-bounce mb-2" />
          <p className="text-sm font-bold text-white">Suelta tus archivos para crear notas automáticamente</p>
          <p className="text-xs text-blue-200">En el cuaderno: {notebook?.name || 'General'}</p>
        </div>
      )}

      {/* Top Header */}
      <div className="px-4 sm:px-8 py-3.5 sm:py-5 pt-[max(0.75rem,env(safe-area-inset-top,0px))] border-b border-[#252538] bg-[#12121b] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
          <button
            onClick={onBackToNotebooks}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-[#1c1c28] hover:bg-[#252538] border border-[#2c2c40] transition flex-shrink-0"
            title="Volver a la biblioteca de cuadernos"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cuadernos</span>
          </button>

          {/* Notebook Title & Badge */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            {notebook ? (
              <div 
                className="w-6 h-8 sm:w-7 sm:h-9 rounded-md shadow-sm border border-white/20 flex-shrink-0 overflow-hidden"
                style={{ 
                  backgroundColor: notebook.color || '#3b82f6',
                  backgroundImage: notebookCoverPreset?.patternSvg 
                }}
              >
                {notebook.cover_type === 'custom' && notebook.cover_url && (
                  <img src={notebook.cover_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
            ) : isFavoritesView ? (
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                <Star className="w-4 h-4 fill-amber-400" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
                <Book className="w-4 h-4" />
              </div>
            )}

            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 truncate">
                <span className="truncate">
                  {notebook ? notebook.name : isFavoritesView ? 'Notas Favoritas' : 'Todas las Notas'}
                </span>
                <span className="text-[11px] font-mono font-normal text-gray-400 flex-shrink-0">
                  ({processedNotes.length})
                </span>
              </h2>
              {notebook?.description && (
                <p className="text-[11px] text-gray-400 truncate max-w-md hidden sm:block">
                  {notebook.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Controls: Search, Sort & View Mode */}
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
          {/* Search */}
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar notas..."
              className="pl-8 pr-3 py-1.5 bg-[#1a1a28] border border-[#2c2c40] rounded-xl text-xs text-white placeholder-gray-500 outline-none w-full sm:w-44 focus:border-blue-500"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 bg-[#1a1a28] border border-[#2c2c40] rounded-xl px-2 py-1 text-xs text-gray-300">
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent border-none text-xs text-gray-200 outline-none cursor-pointer pr-1"
            >
              <option value="recent" className="bg-[#1a1a28] text-white">Más recientes</option>
              <option value="oldest" className="bg-[#1a1a28] text-white">Más antiguas</option>
              <option value="title_asc" className="bg-[#1a1a28] text-white">Título (A-Z)</option>
              <option value="title_desc" className="bg-[#1a1a28] text-white">Título (Z-A)</option>
            </select>
          </div>

          {/* Grid / List View Toggle */}
          <div className="flex items-center bg-[#1a1a28] border border-[#2c2c40] rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
              title="Vista de cuadrícula"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
              title="Vista de lista"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile Quick Action Menu Toggle */}
          <button
            type="button"
            onClick={() => setIsMobileQuickMenuOpen(!isMobileQuickMenuOpen)}
            className="md:hidden flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-md shadow-blue-900/30"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Crear</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Tags Bar */}
      <div className="px-4 sm:px-8 py-2 bg-[#12121a] border-b border-[#222232] flex items-center justify-between text-xs overflow-x-auto no-scrollbar gap-3">
        <div className="flex items-center gap-1.5 flex-nowrap min-w-max">
          <button
            onClick={() => { setFilterType('all'); setSelectedTag(null); }}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
              filterType === 'all' && !selectedTag ? 'bg-[#252538] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>Todas</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-gray-300">{counts.all}</span>
          </button>
          <button
            onClick={() => { setFilterType('favorites'); setSelectedTag(null); }}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
              filterType === 'favorites' ? 'bg-amber-500/20 text-amber-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Star className="w-3 h-3 text-amber-400" />
            <span>Favoritas</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-amber-300">{counts.favorites}</span>
          </button>
          <button
            onClick={() => { setFilterType('audio'); setSelectedTag(null); }}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
              filterType === 'audio' ? 'bg-red-500/20 text-red-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Mic className="w-3 h-3 text-red-400" />
            <span>Audio</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-red-300">{counts.audio}</span>
          </button>
          <button
            onClick={() => { setFilterType('images'); setSelectedTag(null); }}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
              filterType === 'images' ? 'bg-blue-500/20 text-blue-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3 h-3 text-blue-400" />
            <span>Imágenes</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-blue-300">{counts.images}</span>
          </button>
          <button
            onClick={() => { setFilterType('tasks'); setSelectedTag(null); }}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
              filterType === 'tasks' ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            <CheckSquare className="w-3 h-3 text-emerald-400" />
            <span>Tareas</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-emerald-300">{counts.tasks}</span>
          </button>

          {/* Tags Chips if available */}
          {availableTags.length > 0 && (
            <div className="flex items-center gap-1 pl-2 border-l border-[#26263a]">
              {availableTags.slice(0, 5).map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono transition ${
                    selectedTag === tag 
                      ? 'bg-blue-600 text-white font-bold' 
                      : 'bg-[#181824] text-gray-400 hover:text-gray-200 border border-[#2b2b3d]'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="text-gray-500 font-mono text-[11px] hidden md:inline ml-2 flex-shrink-0">
          {processedNotes.length} {processedNotes.length === 1 ? 'nota' : 'notas'}
        </span>
      </div>

      {/* Main Workspace Layout: Desktop Vertical Actions Sidebar + Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* DESKTOP VERTICAL QUICK CREATION BAR (Inspired by user request) */}
        <div className="hidden md:flex flex-col items-center justify-between py-5 px-2 bg-[#12121a] border-r border-[#222232] w-14 z-20 flex-shrink-0">
          <div className="flex flex-col items-center gap-2.5">
            {/* New Note */}
            <button
              type="button"
              onClick={handleCreateTextNote}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30 transition transform hover:scale-105"
              title="Nueva Nota de texto enriquecido"
              aria-label="Nueva Nota"
            >
              <FileText className="w-4 h-4" />
            </button>

            {/* New Task */}
            <button
              type="button"
              onClick={handleCreateTask}
              className="p-2.5 rounded-xl bg-[#1a1a28] hover:bg-[#252538] text-emerald-400 hover:text-emerald-300 border border-[#2c2c40] transition transform hover:scale-105"
              title="Nueva Tarea para gestionar"
              aria-label="Nueva Tarea"
            >
              <CheckSquare className="w-4 h-4" />
            </button>

            {/* New Task List / Checklist Note */}
            <button
              type="button"
              onClick={handleCreateTaskListNote}
              className="p-2.5 rounded-xl bg-[#1a1a28] hover:bg-[#252538] text-teal-400 hover:text-teal-300 border border-[#2c2c40] transition transform hover:scale-105"
              title="Nota con Checklist / Lista de tareas interactiva"
              aria-label="Nueva Lista de Tareas"
            >
              <CheckSquare className="w-4 h-4" />
            </button>

            {/* Add Image */}
            <button
              type="button"
              disabled={isUploadingImageNote}
              onClick={() => imageInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-[#1a1a28] hover:bg-[#252538] text-blue-400 hover:text-blue-300 border border-[#2c2c40] transition transform hover:scale-105 disabled:opacity-50"
              title="Añadir Imagen (sube a R2)"
              aria-label="Añadir Imagen"
            >
              <ImageIcon className={`w-4 h-4 ${isUploadingImageNote ? 'animate-spin' : ''}`} />
            </button>

            {/* Attach File */}
            <button
              type="button"
              disabled={isUploadingFileNote}
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-[#1a1a28] hover:bg-[#252538] text-purple-400 hover:text-purple-300 border border-[#2c2c40] transition transform hover:scale-105 disabled:opacity-50"
              title="Adjuntar Archivo o Documento a este cuaderno"
              aria-label="Adjuntar Archivo"
            >
              <Paperclip className={`w-4 h-4 ${isUploadingFileNote ? 'animate-bounce' : ''}`} />
            </button>

            {/* New Drawing / Canvas */}
            <button
              type="button"
              onClick={handleCreateCanvas}
              className="p-2.5 rounded-xl bg-[#1a1a28] hover:bg-[#252538] text-amber-400 hover:text-amber-300 border border-[#2c2c40] transition transform hover:scale-105"
              title="Nuevo Dibujo / Lienzo visual (Excalidraw)"
              aria-label="Nuevo Dibujo"
            >
              <Palette className="w-4 h-4" />
            </button>

            {/* New Voice Note */}
            <button
              type="button"
              onClick={() => setIsVoiceModalOpen(true)}
              className="p-2.5 rounded-xl bg-[#1a1a28] hover:bg-[#252538] text-red-400 hover:text-red-300 border border-[#2c2c40] transition transform hover:scale-105"
              title="Nueva Nota de Voz con transcripción automática"
              aria-label="Nueva Nota de Voz"
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>

          {/* Discrete bottom icon */}
          <div className="text-gray-600 text-[10px] font-mono">
            <span>SC</span>
          </div>
        </div>

        {/* MOBILE POPUP QUICK ACTIONS DIAL (Does not overlap bottom nav) */}
        {isMobileQuickMenuOpen && (
          <div 
            onClick={() => setIsMobileQuickMenuOpen(false)}
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex flex-col justify-end p-4 pb-20 animate-in fade-in"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-[#181826] border border-[#2d2d42] rounded-2xl p-4 shadow-2xl space-y-2 animate-in slide-in-from-bottom-5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#252538]">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-blue-400" />
                  <span>Crear en {notebook?.name || 'este cuaderno'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsMobileQuickMenuOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => { setIsMobileQuickMenuOpen(false); handleCreateTextNote(); }}
                  className="p-2.5 rounded-xl bg-[#202030] hover:bg-blue-600 text-white flex items-center gap-2 transition"
                >
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>Nueva Nota</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setIsMobileQuickMenuOpen(false); handleCreateTask(); }}
                  className="p-2.5 rounded-xl bg-[#202030] hover:bg-emerald-600 text-white flex items-center gap-2 transition"
                >
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  <span>Nueva Tarea</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setIsMobileQuickMenuOpen(false); handleCreateTaskListNote(); }}
                  className="p-2.5 rounded-xl bg-[#202030] hover:bg-teal-600 text-white flex items-center gap-2 transition"
                >
                  <CheckSquare className="w-4 h-4 text-teal-400" />
                  <span>Lista Tareas</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setIsMobileQuickMenuOpen(false); imageInputRef.current?.click(); }}
                  className="p-2.5 rounded-xl bg-[#202030] hover:bg-blue-600 text-white flex items-center gap-2 transition"
                >
                  <ImageIcon className="w-4 h-4 text-blue-400" />
                  <span>Añadir Imagen</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setIsMobileQuickMenuOpen(false); fileInputRef.current?.click(); }}
                  className="p-2.5 rounded-xl bg-[#202030] hover:bg-purple-600 text-white flex items-center gap-2 transition"
                >
                  <Paperclip className="w-4 h-4 text-purple-400" />
                  <span>Adjuntar Archivo</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setIsMobileQuickMenuOpen(false); handleCreateCanvas(); }}
                  className="p-2.5 rounded-xl bg-[#202030] hover:bg-amber-600 text-white flex items-center gap-2 transition"
                >
                  <Palette className="w-4 h-4 text-amber-400" />
                  <span>Nuevo Dibujo</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setIsMobileQuickMenuOpen(false); setIsVoiceModalOpen(true); }}
                  className="p-2.5 rounded-xl bg-[#202030] hover:bg-red-600 text-white flex items-center gap-2 transition col-span-2 justify-center"
                >
                  <Mic className="w-4 h-4 text-red-400" />
                  <span>Grabar Nota de Voz</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONTENT AREA: Grid or List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          {processedNotes.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-[#262638] rounded-2xl max-w-md mx-auto p-8 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#1a1a26] text-blue-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">
                {isFavoritesView ? 'No hay notas favoritas todavía' : 'No hay notas en este cuaderno'}
              </h3>
              <p className="text-xs text-gray-400">
                {isFavoritesView 
                  ? 'Marca con una estrella las notas que quieras tener a mano y aparecerán aquí.' 
                  : 'Crea tu primera nota, graba un audio, añade una lista de tareas o arrastra imágenes directamente.'}
              </p>
              {!isFavoritesView && (
                <button
                  onClick={handleCreateTextNote}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium transition"
                >
                  Crear Primera Nota
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* 1. GRID VIEW */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
              {processedNotes.map((noteItem) => {
                const isVoice = noteItem.note_type === 'audio' || !!noteItem.audio_url;
                const isTasks = isTaskNote(noteItem);
                const taskData = isTasks ? extractTaskList(noteItem.content || '') : null;
                const hasThumb = Boolean(noteItem.thumbnail_url) || Boolean(noteItem.content && noteItem.content.includes('<img'));
                const isMixed = hasThumb && Boolean(noteItem.plain_text?.trim()) && !isTasks;
                const excerpt = cleanExcerpt(noteItem);
                const resolvedThumbUrl = noteItem.thumbnail_url || (noteItem.content ? (noteItem.content.match(/<img[^>]+src="([^">]+)"/)?.[1] || null) : null);
                const isMenuOpen = activeMenuNoteId === noteItem.id;

                return (
                  <div
                    key={noteItem.id}
                    onClick={() => handleNoteCardClick(noteItem)}
                    className="bg-[#181824] rounded-2xl border border-[#2b2b3d] hover:border-blue-500/50 transition-all duration-200 p-4 flex flex-col justify-between group shadow-sm hover:shadow-xl cursor-pointer h-64 relative overflow-hidden select-none"
                  >
                    {/* Top Row: Type Pill, Favorite Star & Menu */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        {noteItem.is_locked ? (
                          <span className="flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/40">
                            <Lock className="w-2.5 h-2.5 text-amber-400" />
                            Bloqueada
                          </span>
                        ) : isTasks ? (
                          <span className="flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/40">
                            <CheckSquare className="w-2.5 h-2.5 text-emerald-400" />
                            Tarea
                          </span>
                        ) : isVoice ? (
                          <span className="flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-red-950/80 text-red-300 border border-red-800/40">
                            <Volume2 className="w-2.5 h-2.5 text-red-400" />
                            Audio
                          </span>
                        ) : isMixed ? (
                          <span className="flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
                            <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                            Mixta
                          </span>
                        ) : hasThumb ? (
                          <span className="flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/40">
                            <ImageIcon className="w-2.5 h-2.5 text-blue-400" />
                            Imagen
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/40">
                            <FileText className="w-2.5 h-2.5 text-purple-400" />
                            Texto
                          </span>
                        )}

                        {noteItem.is_pinned && (
                          <Pin className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
                        )}
                      </div>

                      {/* Right top action: STAR + MORE MENU */}
                      <div className="flex items-center gap-1">
                        {/* Favorite Button (Visible and interactive) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(noteItem);
                          }}
                          className={`p-1 rounded-lg transition ${
                            noteItem.is_favorite 
                              ? 'text-amber-400' 
                              : 'text-gray-500 hover:text-amber-400'
                          }`}
                          title={noteItem.is_favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
                          aria-label="Favorito"
                        >
                          <Star className={`w-4 h-4 ${noteItem.is_favorite ? 'fill-amber-400' : ''}`} />
                        </button>

                        {/* More Menu Dropdown */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuNoteId(isMenuOpen ? null : noteItem.id);
                            }}
                            className="p-1 text-gray-500 hover:text-white rounded-lg transition"
                            title="Opciones de nota"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {isMenuOpen && (
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-1 w-44 bg-[#1a1a27] border border-[#2d2d42] rounded-xl shadow-2xl py-1 z-30 text-left text-xs text-gray-200 divide-y divide-[#252538] animate-in fade-in zoom-in-95 duration-100"
                            >
                              <div className="py-1">
                                <button
                                  type="button"
                                  onClick={() => handleNoteCardClick(noteItem)}
                                  className="w-full px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition"
                                >
                                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                                  <span>Abrir nota</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuNoteId(null);
                                    setMovingNote(noteItem);
                                  }}
                                  className="w-full px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition"
                                >
                                  <FolderInput className="w-3.5 h-3.5 text-purple-400" />
                                  <span>Mover a cuaderno</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuNoteId(null);
                                    onDuplicateNote(noteItem.id);
                                  }}
                                  className="w-full px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition"
                                >
                                  <Copy className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Duplicar nota</span>
                                </button>
                              </div>

                              <div className="py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuNoteId(null);
                                    if (confirm(`¿Eliminar nota "${noteItem.title}"?`)) {
                                      onDeleteNote(noteItem.id);
                                    }
                                  }}
                                  className="w-full px-3 py-1.5 hover:bg-red-600 hover:text-white text-red-400 flex items-center gap-2 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Eliminar</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Thumbnail / Body Preview */}
                    <div className="flex-1 overflow-hidden my-1 flex flex-col justify-start">
                      <h3 className="font-bold text-xs text-white line-clamp-1 mb-1.5 group-hover:text-blue-400 transition flex-shrink-0">
                        {noteItem.title || 'Sin título'}
                      </h3>

                      {isTasks && taskData ? (
                        <div className="flex-1 flex flex-col justify-between overflow-hidden space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400 pb-1 border-b border-[#252538]">
                            <span className="flex items-center gap-1">
                              <CheckSquare className="w-3 h-3 text-emerald-400" />
                              {taskData.completed} de {taskData.total}
                            </span>
                            <span className="text-gray-500">
                              {taskData.total > 0 ? `${Math.round((taskData.completed / taskData.total) * 100)}%` : '0%'}
                            </span>
                          </div>

                          <div className="space-y-1.5 overflow-hidden">
                            {taskData.items.slice(0, 3).map((t, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-[11px] leading-tight">
                                <span 
                                  className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border ${
                                    t.checked 
                                      ? 'bg-emerald-600 border-emerald-500 text-white' 
                                      : 'border-[#4b5563] bg-[#1a1a26]'
                                  }`}
                                >
                                  {t.checked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </span>
                                <span className={`truncate ${t.checked ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                                  {t.text}
                                </span>
                              </div>
                            ))}
                            {taskData.items.length > 3 && (
                              <p className="text-[10px] text-gray-500 font-mono italic pl-5">
                                +{taskData.items.length - 3} tareas más...
                              </p>
                            )}
                          </div>
                        </div>
                      ) : resolvedThumbUrl ? (
                        <div className="w-full flex-1 flex flex-col overflow-hidden">
                          <div className="w-full aspect-[4/3] max-h-28 rounded-xl bg-[#111118] border border-[#20202e] overflow-hidden mb-1 relative flex-shrink-0">
                            <img
                              src={resolvedThumbUrl}
                              alt={noteItem.title}
                              className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                              loading="lazy"
                            />
                          </div>
                          {excerpt && (
                            <p className="text-[10px] text-gray-400 line-clamp-1">
                              {excerpt}
                            </p>
                          )}
                        </div>
                      ) : isVoice ? (
                        <div className="p-2.5 rounded-lg bg-red-950/20 border border-red-900/30 text-xs text-red-200 space-y-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-red-400">
                            <Clock className="w-3 h-3" />
                            <span>{noteItem.audio_duration ? `${noteItem.audio_duration}s` : 'Audio'}</span>
                            {noteItem.audio_transcription_status === 'completed' && (
                              <span className="text-emerald-400 ml-auto">✓ Transcrito</span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-300 line-clamp-2 leading-relaxed">
                            {noteItem.audio_transcription || excerpt || 'Nota de voz guardada'}
                          </p>
                        </div>
                      ) : noteItem.is_locked ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-3 text-center space-y-1 bg-[#14141e] rounded-xl border border-[#232332]">
                          <Lock className="w-5 h-5 text-amber-400/80 mb-0.5" />
                          <span className="text-xs font-semibold text-gray-200">Nota Protegida</span>
                          <span className="text-[10px] text-gray-400">Clic para desbloquear con tu contraseña</span>
                        </div>
                      ) : (
                        <p className="text-[11px] text-gray-400 line-clamp-4 leading-relaxed">
                          {excerpt || 'Nota vacía...'}
                        </p>
                      )}
                    </div>

                    {/* Card Footer: Tags & Modified Date */}
                    <div className="pt-2 border-t border-[#232334] flex items-center justify-between text-[10px] text-gray-400 font-mono mt-1">
                      <div className="flex items-center gap-1 overflow-hidden max-w-[120px]">
                        {(noteItem.tags || []).slice(0, 1).map((tag, idx) => (
                          <span key={idx} className="bg-[#121218] px-1.5 py-0.5 rounded text-gray-400 truncate">
                            #{tag}
                          </span>
                        ))}
                        {(noteItem.tags || []).length > 1 && (
                          <span>+{noteItem.tags!.length - 1}</span>
                        )}
                      </div>
                      <span>{new Date(noteItem.updated_at || noteItem.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 2. LIST VIEW */
            <div className="space-y-2 max-w-5xl mx-auto">
              {processedNotes.map((noteItem) => {
                const excerpt = cleanExcerpt(noteItem);
                const isMenuOpen = activeMenuNoteId === noteItem.id;
                const isTasks = isTaskNote(noteItem);
                const isVoice = noteItem.note_type === 'audio' || !!noteItem.audio_url;

                return (
                  <div
                    key={noteItem.id}
                    onClick={() => handleNoteCardClick(noteItem)}
                    className="p-3 sm:p-4 rounded-xl bg-[#181824] border border-[#2b2b3d] hover:border-blue-500/50 transition flex items-center justify-between gap-3 cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Favorite Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(noteItem);
                        }}
                        className={`p-1.5 rounded-lg transition flex-shrink-0 ${
                          noteItem.is_favorite 
                            ? 'text-amber-400' 
                            : 'text-gray-500 hover:text-amber-400'
                        }`}
                        title={noteItem.is_favorite ? 'Quitar de favoritos' : 'Favorita'}
                      >
                        <Star className={`w-4 h-4 ${noteItem.is_favorite ? 'fill-amber-400' : ''}`} />
                      </button>

                      {/* Icon */}
                      <div className="p-2 rounded-lg bg-[#202030] text-gray-300 flex-shrink-0">
                        {isTasks ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : isVoice ? (
                          <Mic className="w-4 h-4 text-red-400" />
                        ) : (
                          <FileText className="w-4 h-4 text-blue-400" />
                        )}
                      </div>

                      {/* Title & Preview */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-white group-hover:text-blue-400 transition truncate">
                            {noteItem.title || 'Sin título'}
                          </h4>
                          {noteItem.is_pinned && (
                            <Pin className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {excerpt || 'Nota vacía...'}
                        </p>
                      </div>
                    </div>

                    {/* Metadata & Menu */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* Tags */}
                      <div className="hidden sm:flex items-center gap-1 font-mono text-[10px] text-gray-400">
                        {(noteItem.tags || []).slice(0, 2).map((t, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded bg-[#1e1e2d] border border-[#2c2c3e]">
                            #{t}
                          </span>
                        ))}
                      </div>

                      {/* Date */}
                      <span className="text-[11px] font-mono text-gray-400 hidden xs:inline">
                        {new Date(noteItem.updated_at || noteItem.created_at).toLocaleDateString()}
                      </span>

                      {/* Actions Menu */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuNoteId(isMenuOpen ? null : noteItem.id);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#20202e] transition"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {isMenuOpen && (
                          <div 
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-full mt-1 w-44 bg-[#1a1a27] border border-[#2d2d42] rounded-xl shadow-2xl py-1 z-30 text-left text-xs text-gray-200 divide-y divide-[#252538] animate-in fade-in zoom-in-95 duration-100"
                          >
                            <div className="py-1">
                              <button
                                type="button"
                                onClick={() => handleNoteCardClick(noteItem)}
                                className="w-full px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition"
                              >
                                <FileText className="w-3.5 h-3.5 text-blue-400" />
                                <span>Abrir nota</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuNoteId(null);
                                  setMovingNote(noteItem);
                                }}
                                className="w-full px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition"
                              >
                                <FolderInput className="w-3.5 h-3.5 text-purple-400" />
                                <span>Mover a cuaderno</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuNoteId(null);
                                  onDuplicateNote(noteItem.id);
                                }}
                                className="w-full px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition"
                              >
                                <Copy className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Duplicar nota</span>
                              </button>
                            </div>

                            <div className="py-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuNoteId(null);
                                  if (confirm(`¿Eliminar nota "${noteItem.title}"?`)) {
                                    onDeleteNote(noteItem.id);
                                  }
                                }}
                                className="w-full px-3 py-1.5 hover:bg-red-600 hover:text-white text-red-400 flex items-center gap-2 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Eliminar</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MOVE NOTE TO NOTEBOOK MODAL */}
      {movingNote && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#181826] border border-[#2d2d42] rounded-2xl max-w-md w-full shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#252538]">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FolderInput className="w-4 h-4 text-purple-400" />
                  <span>Mover Nota a Cuaderno</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                  "{movingNote.title || 'Sin título'}"
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMovingNote(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {/* Option: Sin Cuaderno (General) */}
              <button
                type="button"
                onClick={async () => {
                  const nId = movingNote.id;
                  setMovingNote(null);
                  await onMoveNote(nId, '');
                }}
                className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                  !movingNote.notebook_id 
                    ? 'bg-blue-600/20 border-blue-500/50 text-white font-semibold' 
                    : 'bg-[#1e1e2d] border-[#29293e] text-gray-300 hover:bg-[#25253a] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-[#28283c] flex items-center justify-center text-gray-400">
                    <FolderOpen className="w-3.5 h-3.5" />
                  </div>
                  <span>Sin cuaderno (General / Suelta)</span>
                </div>
                {!movingNote.notebook_id && <Check className="w-4 h-4 text-blue-400" />}
              </button>

              {/* Notebooks List */}
              {notebooks.map(nb => {
                const isCurrent = movingNote.notebook_id === nb.id;
                const preset = getCoverById(nb.cover_url);

                return (
                  <button
                    key={nb.id}
                    type="button"
                    onClick={async () => {
                      const nId = movingNote.id;
                      setMovingNote(null);
                      await onMoveNote(nId, nb.id);
                    }}
                    className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs transition ${
                      isCurrent 
                        ? 'bg-blue-600/20 border-blue-500/50 text-white font-semibold' 
                        : 'bg-[#1e1e2d] border-[#29293e] text-gray-300 hover:bg-[#25253a] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div 
                        className="w-5 h-7 rounded-sm shadow-sm border border-white/20 flex-shrink-0 overflow-hidden"
                        style={{ backgroundColor: nb.color || '#3b82f6', backgroundImage: preset?.patternSvg }}
                      >
                        {nb.cover_type === 'custom' && nb.cover_url && (
                          <img src={nb.cover_url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <span className="truncate">{nb.name}</span>
                    </div>
                    {isCurrent && <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#252538]">
              <button
                type="button"
                onClick={() => setMovingNote(null)}
                className="px-4 py-1.5 rounded-xl bg-[#20202e] hover:bg-[#28283c] text-gray-300 text-xs font-medium transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Recorder Modal */}
      <AudioRecorderModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        notebookId={notebook?.id || null}
        onSaveVoiceNote={async (audioData) => {
          await onCreateNote({
            title: audioData.title,
            note_type: 'audio',
            audio_url: audioData.audioUrl,
            audio_duration: audioData.durationSeconds,
            audio_transcription: audioData.transcription,
            audio_transcription_status: audioData.transcriptionStatus,
            content: audioData.transcription ? `<p><strong>Transcripción:</strong> ${audioData.transcription}</p>` : '<p>Nota de voz</p>',
            notebook_id: audioData.notebookId || notebook?.id || null
          });
        }}
      />

      {/* Password Unlock Modal for Locked Note */}
      {unlockTargetNote && (
        <PasswordUnlockModal
          isOpen={!!unlockTargetNote}
          title={`Desbloquear Nota "${unlockTargetNote.title || 'Sin título'}"`}
          subtitle="Ingresa la contraseña de esta nota para ver y editar su contenido."
          onClose={() => setUnlockTargetNote(null)}
          onVerify={async (password) => {
            return verifyPassword(password, unlockTargetNote.password_hash || '');
          }}
          onSuccess={() => {
            unlockNoteSession(unlockTargetNote.id);
            const target = unlockTargetNote;
            setUnlockTargetNote(null);
            onOpenNote(target);
          }}
        />
      )}
    </div>
  );
};
