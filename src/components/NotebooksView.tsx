import React, { useState } from 'react';
import { 
  Book, 
  Plus, 
  Search, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  Archive, 
  Check, 
  FolderPlus,
  BookOpen,
  Sparkles,
  Layers
} from 'lucide-react';
import { AppNotebook, AppNote } from '../lib/types';
import { getCoverById } from '../lib/covers';
import { NotebookModal } from './NotebookModal';

interface NotebooksViewProps {
  notebooks: AppNotebook[];
  notes: AppNote[];
  onCreateNotebook: (data: Partial<AppNotebook>) => Promise<void>;
  onUpdateNotebook: (id: string, updates: Partial<AppNotebook>) => Promise<void>;
  onDeleteNotebook: (id: string) => Promise<void>;
  onOpenNotebook: (notebook: AppNotebook) => void;
}

export const NotebooksView: React.FC<NotebooksViewProps> = ({
  notebooks,
  notes,
  onCreateNotebook,
  onUpdateNotebook,
  onDeleteNotebook,
  onOpenNotebook
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNotebook, setSelectedNotebook] = useState<AppNotebook | null>(null);

  const filteredNotebooks = notebooks.filter(nb => {
    if (showArchived ? !nb.is_archived : nb.is_archived) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = nb.name.toLowerCase().includes(q);
      const matchDesc = (nb.description || '').toLowerCase().includes(q);
      return matchName || matchDesc;
    }
    return true;
  });

  const handleOpenCreate = () => {
    setSelectedNotebook(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (nb: AppNotebook, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedNotebook(nb);
    setIsModalOpen(true);
  };

  const handleSaveModal = async (data: Partial<AppNotebook>) => {
    if (selectedNotebook?.id) {
      await onUpdateNotebook(selectedNotebook.id, data);
    } else {
      await onCreateNotebook(data);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#161620] overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-8 py-4 sm:py-5 border-b border-[#252538] bg-[#14141d] flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 sm:gap-2.5">
            <Book className="w-5 h-5 text-blue-400" />
            Cuadernos
          </h2>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
            Colecciones de notas, ideas y conocimiento organizadas en cuadernos visuales estilo Zoho Notebook.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cuaderno..."
              className="pl-8 pr-3 py-1.5 bg-[#1a1a26] border border-[#2c2c40] rounded-xl text-xs text-white placeholder-gray-500 outline-none w-full sm:w-48 focus:border-blue-500 transition"
            />
          </div>

          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
              showArchived 
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' 
                : 'bg-[#1a1a26] border-[#2c2c40] text-gray-400 hover:text-white'
            }`}
          >
            {showArchived ? 'Activos' : 'Archivados'}
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-900/30 transition flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Cuaderno</span>
          </button>
        </div>
      </div>

      {/* Main Grid Canvas (3:4 ratio covers) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        {filteredNotebooks.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-[#29293e] rounded-2xl max-w-lg mx-auto p-8 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#1b1b28] text-blue-400 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">
              {showArchived ? 'No hay cuadernos archivados' : 'No se encontraron cuadernos'}
            </h3>
            <p className="text-xs text-gray-400">
              Crea tu primer cuaderno para organizar tus notas de texto, audios, tareas e imágenes.
            </p>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium transition"
            >
              Crear Cuaderno
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-6 items-start">
            {filteredNotebooks.map((nb) => {
              const nbNotes = notes.filter(n => n.notebook_id === nb.id && !n.is_archived);
              const preset = getCoverById(nb.cover_url);

              return (
                <div
                  key={nb.id}
                  onClick={() => onOpenNotebook(nb)}
                  className="w-[144px] flex flex-col items-center group cursor-pointer select-none"
                >
                  {/* 144px x 200px Dimension Notebook Cover Card */}
                  <div className="w-[144px] h-[200px] rounded-2xl shadow-lg relative overflow-hidden transition-all duration-300 transform group-hover:-translate-y-2 group-hover:shadow-2xl border border-white/10 group-hover:border-blue-500/50 flex flex-col justify-between p-3.5 flex-shrink-0">
                    {/* Background: custom image, solid color, or preset gradient */}
                    {nb.cover_type === 'custom' && nb.cover_url ? (
                      <img
                        src={nb.cover_url}
                        alt={nb.name}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : nb.cover_type === 'color' ? (
                      <div
                        className="absolute inset-0"
                        style={{ backgroundColor: nb.color || '#3b82f6' }}
                      />
                    ) : (
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${preset.bgGradient}`}
                        style={{ backgroundImage: preset.patternSvg }}
                      />
                    )}

                    {/* Realistic notebook spine on the left */}
                    <div className="absolute left-0 top-0 bottom-0 w-3.5 bg-black/35 backdrop-blur-[1px] border-r border-white/10" />

                    {/* Ribbon bookmark / Default indicator */}
                    <div className="relative z-10 flex items-center justify-between">
                      {nb.is_default ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-900/80 text-blue-200 border border-blue-500/40 backdrop-blur-sm">
                          Principal
                        </span>
                      ) : <div />}

                      {/* Edit Button */}
                      <button
                        onClick={(e) => handleOpenEdit(nb, e)}
                        className="opacity-0 group-hover:opacity-100 transition p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-md shadow"
                        title="Configurar cuaderno"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Centered Cover Title Emblem */}
                    <div className="relative z-10 my-auto text-center px-2 py-2.5 rounded-xl bg-black/45 backdrop-blur-md border border-white/15 shadow-sm">
                      <p className="text-xs font-bold text-white line-clamp-2 leading-snug">
                        {nb.name}
                      </p>
                    </div>

                    {/* Bottom notes count pill */}
                    <div className="relative z-10 flex justify-center">
                      <span className="text-[10px] font-mono text-white/90 bg-black/50 px-2.5 py-0.5 rounded-full backdrop-blur-sm border border-white/10">
                        {nbNotes.length} {nbNotes.length === 1 ? 'nota' : 'notas'}
                      </span>
                    </div>
                  </div>

                  {/* Name centered under cover */}
                  <div className="mt-3 text-center max-w-full px-1">
                    <h3 className="text-xs font-semibold text-gray-200 group-hover:text-blue-400 transition truncate">
                      {nb.name}
                    </h3>
                    {nb.description && (
                      <p className="text-[11px] text-gray-400 truncate max-w-[160px] mx-auto mt-0.5">
                        {nb.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Notebook Modal */}
      <NotebookModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        notebook={selectedNotebook}
        onSave={handleSaveModal}
        onDelete={onDeleteNotebook}
      />
    </div>
  );
};
