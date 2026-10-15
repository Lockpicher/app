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
  Pin
} from 'lucide-react';
import { AppNote, AppNotebook, NoteType } from '../lib/types';
import { getCoverById } from '../lib/covers';
import { storage } from '../lib/insforge';
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
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [movingNoteId, setMovingNoteId] = useState<string | null>(null);

  // Filter notes
  const filteredNotes = notes.filter(n => {
    // If inside a specific notebook, match notebook_id
    if (notebook && n.notebook_id !== notebook.id) return false;
    if (n.is_archived) return false;

    // Filter by type or favorite
    if (filterType === 'favorites' && !n.is_favorite) return false;
    if (filterType === 'images' && n.note_type !== 'image' && !n.thumbnail_url) return false;
    if (filterType === 'audio' && n.note_type !== 'audio' && !n.audio_url) return false;
    if (filterType === 'tasks' && n.note_type !== 'tasks') return false;

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
        const res = await storage.uploadFile(file, isImg ? 'notes/images' : 'notes/files');
        
        await onCreateNote({
          title: file.name.replace(/\.[^/.]+$/, ''),
          note_type: isImg ? 'image' : 'file',
          thumbnail_url: isImg ? res.url : undefined,
          content: isImg ? `<img src="${res.url}" alt="${file.name}" />` : `<p>📎 <a href="${res.url}">${file.name}</a></p>`,
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
      <div className="px-8 py-5 border-b border-[#252538] bg-[#14141e] flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToNotebooks}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-[#1c1c28] hover:bg-[#252538] border border-[#2c2c40] transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Cuadernos
          </button>

          {/* Notebook Title & Badge */}
          <div className="flex items-center gap-2.5">
            {notebook && (
              <div 
                className="w-7 h-9 rounded-md shadow-sm border border-white/20 flex-shrink-0"
                style={{ 
                  backgroundColor: notebook.color || '#3b82f6',
                  backgroundImage: notebookCoverPreset?.patternSvg 
                }}
              />
            )}
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {notebook ? notebook.name : 'Todas las Notas'}
                <span className="text-[11px] font-mono font-normal text-gray-400">
                  ({filteredNotes.length})
                </span>
              </h2>
              {notebook?.description && (
                <p className="text-[11px] text-gray-400 truncate max-w-md">
                  {notebook.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en notas..."
              className="pl-8 pr-3 py-1.5 bg-[#1a1a28] border border-[#2c2c40] rounded-xl text-xs text-white placeholder-gray-500 outline-none w-52 focus:border-blue-500"
            />
          </div>

          {/* Quick Voice Note Button */}
          <button
            onClick={() => setIsVoiceModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-600/20 text-red-300 hover:bg-red-600/30 border border-red-500/30 transition"
            title="Grabar nota de voz con transcripción automática"
          >
            <Mic className="w-3.5 h-3.5 text-red-400" />
            Grabar Voz
          </button>

          {/* Quick Create Note Button */}
          <button
            onClick={() => onCreateNote({ notebook_id: notebook?.id || null })}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30 transition"
          >
            <Plus className="w-4 h-4" />
            Nueva Nota
          </button>
        </div>
      </div>

      {/* Filter Filter Tabs */}
      <div className="px-8 py-2.5 bg-[#121218] border-b border-[#222232] flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-lg font-medium transition ${
              filterType === 'all' ? 'bg-[#252538] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilterType('favorites')}
            className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
              filterType === 'favorites' ? 'bg-amber-500/20 text-amber-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Star className="w-3 h-3 text-amber-400" />
            Favoritas
          </button>
          <button
            onClick={() => setFilterType('audio')}
            className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
              filterType === 'audio' ? 'bg-red-500/20 text-red-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Mic className="w-3 h-3 text-red-400" />
            Notas de Voz
          </button>
          <button
            onClick={() => setFilterType('images')}
            className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
              filterType === 'images' ? 'bg-blue-500/20 text-blue-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3 h-3 text-blue-400" />
            Imágenes
          </button>
          <button
            onClick={() => setFilterType('tasks')}
            className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
              filterType === 'tasks' ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            <CheckSquare className="w-3 h-3 text-emerald-400" />
            Listas de Tareas
          </button>
        </div>

        <span className="text-gray-500 font-mono text-[11px] hidden sm:inline">
          {filteredNotes.length} {filteredNotes.length === 1 ? 'nota mostrada' : 'notas mostradas'}
        </span>
      </div>

      {/* Symmetrical Uniform Cards Grid */}
      <div className="flex-1 overflow-y-auto p-8">
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
              const hasThumb = !!noteItem.thumbnail_url;
              const excerpt = cleanExcerpt(noteItem);

              return (
                <div
                  key={noteItem.id}
                  onClick={() => onOpenNote(noteItem)}
                  className="bg-[#181824] rounded-2xl border border-[#2b2b3d] hover:border-blue-500/50 transition-all duration-200 p-4 flex flex-col justify-between group shadow-sm hover:shadow-xl cursor-pointer h-64 relative overflow-hidden select-none"
                >
                  {/* Top Row: Type Pill, Favorite & Actions */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {isVoice ? (
                        <span className="flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-red-950/80 text-red-300 border border-red-800/40">
                          <Volume2 className="w-2.5 h-2.5 text-red-400" />
                          Audio
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
                  <div className="flex-1 overflow-hidden my-1">
                    <h3 className="font-bold text-xs text-white line-clamp-1 mb-1.5 group-hover:text-blue-400 transition">
                      {noteItem.title || 'Sin título'}
                    </h3>

                    {/* Image Preview Thumbnail */}
                    {hasThumb ? (
                      <div className="h-24 rounded-lg bg-[#111118] border border-[#20202e] overflow-hidden mb-1 relative">
                        <img
                          src={noteItem.thumbnail_url!}
                          alt={noteItem.title}
                          className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    ) : isVoice ? (
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
