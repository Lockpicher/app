import React, { useState } from 'react';
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
  Check
} from 'lucide-react';
import { AppNote, AppNotebook, NoteType } from '../lib/types';
import { getCoverById } from '../lib/covers';
import { storage } from '../lib/insforge';
import { r2Storage } from '../lib/r2Client';
import { AudioRecorderModal } from './AudioRecorderModal';

interface NotebookNotesGridProps {
  notebook: AppNotebook | null; // null if viewing "Todas las notas"
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
}

export const NotebookNotesGrid: React.FC<NotebookNotesGridProps> = ({
  notebook,
  notes,
  notebooks,
  onBackToNotebooks,
  onOpenNote,
  onCreateNote,
  onDuplicateNote,
  onDeleteNote,
  onMoveNote,
  onToggleFavorite,
  onTogglePin
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isUploadingImageNote, setIsUploadingImageNote] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [movingNoteId, setMovingNoteId] = useState<string | null>(null);

  // Helper: Extract task items from note HTML content
  const extractTaskList = (html: string): { total: number; completed: number; items: { text: string; checked: boolean }[] } => {
    if (!html) return { total: 0, completed: 0, items: [] };
    const items: { text: string; checked: boolean }[] = [];
    
    // Match TipTap taskItem elements: <li data-type="taskItem" data-checked="true/false">...</li>
    const regex = /<li[^>]*data-type="taskItem"[^>]*data-checked="(true|false)"[^>]*>([\s\S]*?)<\/li>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const checked = match[1] === 'true';
      const innerHtml = match[2];
      // Clean inner text
      const text = innerHtml.replace(/<label[\s\S]*?<\/label>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      items.push({ text: text || 'Tarea sin texto', checked });
    }

    // Fallback: check standard checkboxes <input type="checkbox" checked ...>
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

  // Helper: check if a note is truly a task note
  const isTaskNote = (n: AppNote): boolean => {
    if (n.note_type === 'tasks') return true;
    if (n.content && (n.content.includes('data-type="taskList"') || n.content.includes('data-type="taskItem"'))) {
      return true;
    }
    return false;
  };

  // Base notes for current notebook view
  const baseNotes = notes.filter(n => {
    if (notebook && n.notebook_id !== notebook.id) return false;
    if (n.is_archived) return false;
    return true;
  });

  // Calculate real filter counts based on actual content
  const counts = {
    all: baseNotes.length,
    favorites: baseNotes.filter(n => n.is_favorite).length,
    audio: baseNotes.filter(n => n.note_type === 'audio' || Boolean(n.audio_url)).length,
    images: baseNotes.filter(n => n.note_type === 'image' || Boolean(n.thumbnail_url) || Boolean(n.content && n.content.includes('<img'))).length,
    tasks: baseNotes.filter(n => isTaskNote(n)).length,
  };

  // Filter notes
  const filteredNotes = baseNotes.filter(n => {
    // Filter by type or favorite
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

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = n.title.toLowerCase().includes(q);
      const matchText = (n.plain_text || n.content || '').toLowerCase().includes(q);
      const matchTag = (n.tags || []).some(t => t.toLowerCase().includes(q));
      return matchTitle || matchText || matchTag;
    }

    return true;
  });

  // Extract clean plain text preview from HTML or Markdown
  const cleanExcerpt = (note: AppNote): string => {
    if (note.plain_text) return note.plain_text.slice(0, 160);
    const raw = note.content || '';
    const clean = raw.replace(/<[^>]+>/g, ' ').replace(/[#*`_\[\]]/g, ' ').trim();
    return clean.slice(0, 160);
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
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropFiles}
      className="flex-1 flex flex-col h-screen bg-[#161622] overflow-hidden relative"
    >
      {/* Drag & Drop Visual Indicator */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-blue-600/20 backdrop-blur-sm border-2 border-dashed border-blue-400 flex flex-col items-center justify-center pointer-events-none animate-fadeIn">
          <Upload className="w-12 h-12 text-blue-400 animate-bounce mb-2" />
          <p className="text-sm font-bold text-white">Suelta tus archivos para crear notas automáticamente</p>
          <p className="text-xs text-blue-200">En el cuaderno: {notebook?.name || 'General'}</p>
        </div>
      )}

      {/* Top Header */}
      <div className="px-4 sm:px-8 py-3.5 sm:py-5 border-b border-[#252538] bg-[#14141e] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
          <button
            onClick={onBackToNotebooks}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-[#1c1c28] hover:bg-[#252538] border border-[#2c2c40] transition flex-shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cuadernos</span>
          </button>

          {/* Notebook Title & Badge */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            {notebook && (
              <div 
                className="w-6 h-8 sm:w-7 sm:h-9 rounded-md shadow-sm border border-white/20 flex-shrink-0"
                style={{ 
                  backgroundColor: notebook.color || '#3b82f6',
                  backgroundImage: notebookCoverPreset?.patternSvg 
                }}
              />
            )}
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 truncate">
                <span className="truncate">{notebook ? notebook.name : 'Todas las Notas'}</span>
                <span className="text-[11px] font-mono font-normal text-gray-400 flex-shrink-0">
                  ({filteredNotes.length})
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

        {/* Search & Actions */}
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en notas..."
              className="pl-8 pr-3 py-1.5 bg-[#1a1a28] border border-[#2c2c40] rounded-xl text-xs text-white placeholder-gray-500 outline-none w-full sm:w-48 focus:border-blue-500"
            />
          </div>

          {/* Quick Voice Note Button */}
          <button
            onClick={() => setIsVoiceModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-600/20 text-red-300 hover:bg-red-600/30 border border-red-500/30 transition flex-shrink-0"
            title="Grabar nota de voz con transcripción automática"
          >
            <Mic className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden xs:inline">Grabar</span>
          </button>

          {/* Quick Upload Image Note Button */}
          <input
            type="file"
            id="quick-image-note-upload"
            accept="image/*"
            className="hidden"
            disabled={isUploadingImageNote}
            onChange={async (e) => {
              if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
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
                  e.target.value = '';
                }
              }
            }}
          />
          <label
            htmlFor="quick-image-note-upload"
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex-shrink-0 cursor-pointer ${
              isUploadingImageNote 
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 cursor-wait'
                : 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border-emerald-500/30'
            }`}
            title="Crear nota de tipo imagen seleccionando un archivo de tu equipo"
          >
            {isUploadingImageNote ? (
              <span className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="hidden xs:inline">{isUploadingImageNote ? 'Subiendo...' : 'Imagen'}</span>
          </label>

          {/* Quick Task List Note Button (Zoho Notebook style) */}
          <button
            onClick={() => {
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
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 transition flex-shrink-0"
            title="Crear nota de lista de tareas interactiva"
          >
            <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden xs:inline">Tareas</span>
          </button>

          {/* Quick Create Note Button */}
          <button
            onClick={() => onCreateNote({ notebook_id: notebook?.id || null })}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30 transition flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Nota</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs with real counts */}
      <div className="px-4 sm:px-8 py-2 bg-[#121218] border-b border-[#222232] flex items-center justify-between text-xs overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 flex-nowrap min-w-max">
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
              filterType === 'all' ? 'bg-[#252538] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>Todas</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-gray-300">{counts.all}</span>
          </button>
          <button
            onClick={() => setFilterType('favorites')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
              filterType === 'favorites' ? 'bg-amber-500/20 text-amber-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Star className="w-3 h-3 text-amber-400" />
            <span>Favoritas</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-amber-300">{counts.favorites}</span>
          </button>
          <button
            onClick={() => setFilterType('audio')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
              filterType === 'audio' ? 'bg-red-500/20 text-red-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Mic className="w-3 h-3 text-red-400" />
            <span>Audio</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-red-300">{counts.audio}</span>
          </button>
          <button
            onClick={() => setFilterType('images')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
              filterType === 'images' ? 'bg-blue-500/20 text-blue-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3 h-3 text-blue-400" />
            <span>Imágenes</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-blue-300">{counts.images}</span>
          </button>
          <button
            onClick={() => setFilterType('tasks')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
              filterType === 'tasks' ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            <CheckSquare className="w-3 h-3 text-emerald-400" />
            <span>Tareas</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-emerald-300">{counts.tasks}</span>
          </button>
        </div>

        <span className="text-gray-500 font-mono text-[11px] hidden md:inline ml-2 flex-shrink-0">
          Mostrando {filteredNotes.length} {filteredNotes.length === 1 ? 'nota' : 'notas'}
        </span>
      </div>

      {/* Symmetrical Uniform Cards Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-[#262638] rounded-2xl max-w-md mx-auto p-8 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#1a1a26] text-blue-400 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">No hay notas en este filtro</h3>
            <p className="text-xs text-gray-400">
              Escribe tus pensamientos, graba audios o arrastra imágenes directamente a la pantalla.
            </p>
            <button
              onClick={() => onCreateNote({ notebook_id: notebook?.id || null })}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium transition"
            >
              Crear Primera Nota
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {filteredNotes.map((noteItem) => {
              const isVoice = noteItem.note_type === 'audio' || !!noteItem.audio_url;
              const isTasks = isTaskNote(noteItem);
              const taskData = isTasks ? extractTaskList(noteItem.content || '') : null;
              const hasThumb = Boolean(noteItem.thumbnail_url) || Boolean(noteItem.content && noteItem.content.includes('<img'));
              const isMixed = hasThumb && Boolean(noteItem.plain_text?.trim()) && !isTasks;
              const excerpt = cleanExcerpt(noteItem);
              const resolvedThumbUrl = noteItem.thumbnail_url || (noteItem.content ? (noteItem.content.match(/<img[^>]+src="([^">]+)"/)?.[1] || null) : null);

              return (
                <div
                  key={noteItem.id}
                  onClick={() => onOpenNote(noteItem)}
                  className="bg-[#181824] rounded-2xl border border-[#2b2b3d] hover:border-blue-500/50 transition-all duration-200 p-4 flex flex-col justify-between group shadow-sm hover:shadow-xl cursor-pointer h-64 relative overflow-hidden select-none"
                >
                  {/* Top Row: Type Pill, Favorite & Actions */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {isTasks ? (
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

                    <div className="flex items-center gap-1">
                      {/* Favorite Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(noteItem);
                        }}
                        className={`p-1 rounded transition ${
                          noteItem.is_favorite 
                            ? 'text-amber-400' 
                            : 'text-gray-500 hover:text-amber-400 opacity-0 group-hover:opacity-100'
                        }`}
                        title={noteItem.is_favorite ? 'Quitar de favoritos' : 'Favorita'}
                      >
                        <Star className={`w-3.5 h-3.5 ${noteItem.is_favorite ? 'fill-current' : ''}`} />
                      </button>

                      {/* Duplicate Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateNote(noteItem.id);
                        }}
                        className="p-1 text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition rounded"
                        title="Duplicar nota"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`¿Eliminar nota "${noteItem.title}"?`)) {
                            onDeleteNote(noteItem.id);
                          }
                        }}
                        className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition rounded"
                        title="Eliminar nota"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Thumbnail / Body Preview (Controlled Height) */}
                  <div className="flex-1 overflow-hidden my-1 flex flex-col justify-start">
                    <h3 className="font-bold text-xs text-white line-clamp-1 mb-1.5 group-hover:text-blue-400 transition flex-shrink-0">
                      {noteItem.title || 'Sin título'}
                    </h3>

                    {/* Task Note Card Preview (Zoho Notebook checklist with progress) */}
                    {isTasks && taskData ? (
                      <div className="flex-1 flex flex-col justify-between overflow-hidden space-y-1.5">
                        {/* Progress indicator */}
                        <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400 pb-1 border-b border-[#252538]">
                          <span className="flex items-center gap-1">
                            <CheckSquare className="w-3 h-3 text-emerald-400" />
                            {taskData.completed} de {taskData.total} completadas
                          </span>
                          <span className="text-gray-500">
                            {taskData.total > 0 ? `${Math.round((taskData.completed / taskData.total) * 100)}%` : '0%'}
                          </span>
                        </div>

                        {/* List preview items (up to 3 or 4) */}
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
                          {taskData.items.length === 0 && (
                            <p className="text-[11px] text-gray-500 italic">
                              Lista de tareas vacía...
                            </p>
                          )}
                        </div>
                      </div>
                    ) : resolvedThumbUrl ? (() => {
                      const imgCount = (noteItem.content || '').match(/<img[^>]+src=/gi)?.length || 1;
                      return (
                        <div className="w-full flex-1 flex flex-col overflow-hidden">
                          <div className="w-full aspect-[4/3] max-h-28 rounded-xl bg-[#111118] border border-[#20202e] overflow-hidden mb-1 relative flex-shrink-0">
                            <img
                              src={resolvedThumbUrl}
                              alt={noteItem.title}
                              className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                              loading="lazy"
                            />
                            {imgCount > 1 && (
                              <span className="absolute bottom-1.5 right-1.5 bg-black/70 backdrop-blur-sm text-white font-mono text-[9px] px-1.5 py-0.5 rounded-md border border-white/10 flex items-center gap-1 shadow">
                                <ImageIcon className="w-2.5 h-2.5 text-blue-400" />
                                {imgCount}
                              </span>
                            )}
                          </div>
                          {excerpt && (
                            <p className="text-[10px] text-gray-400 line-clamp-1">
                              {excerpt}
                            </p>
                          )}
                        </div>
                      );
                    })() : isVoice ? (
                      /* Voice Note Card snippet */
                      <div className="p-2.5 rounded-lg bg-red-950/20 border border-red-900/30 text-xs text-red-200 space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-red-400">
                          <Clock className="w-3 h-3" />
                          <span>{noteItem.audio_duration ? `${noteItem.audio_duration}s` : 'Audio'}</span>
                          {noteItem.audio_transcription_status === 'completed' && (
                            <span className="text-emerald-400 ml-auto">✓ Transcrito</span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-300 line-clamp-2 leading-relaxed">
                          {noteItem.audio_transcription || excerpt || 'Audio guardado'}
                        </p>
                      </div>
                    ) : (
                      /* Plain text excerpt snippet */
                      <p className="text-[11px] text-gray-400 line-clamp-4 leading-relaxed">
                        {excerpt || 'Nota vacía...'}
                      </p>
                    )}
                  </div>

                  {/* Card Footer: Tags & Date */}
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
                    <span>{new Date(noteItem.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
            notebook_id: audioData.notebookId || null
          });
        }}
      />
    </div>
  );
};
