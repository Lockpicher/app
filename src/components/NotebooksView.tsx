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
  Layers,
  Lock
} from 'lucide-react';
import { AppNotebook, AppNote } from '../lib/types';
import { getCoverById } from '../lib/covers';
import { isNotebookUnlocked, unlockNotebookSession, verifyPassword } from '../lib/security';
import { NotebookModal } from './NotebookModal';
import { PasswordUnlockModal } from './PasswordUnlockModal';

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

  // Desbloqueo de contraseña
  const [unlockTarget, setUnlockTarget] = useState<AppNotebook | null>(null);

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
    if (nb.is_locked && nb.password_hash && !isNotebookUnlocked(nb.id)) {
      setUnlockTarget(nb);
      return;
    }
    setSelectedNotebook(nb);
    setIsModalOpen(true);
  };

  const handleNotebookClick = (nb: AppNotebook) => {
    if (nb.is_locked && nb.password_hash && !isNotebookUnlocked(nb.id)) {
      setUnlockTarget(nb);
      return;
    }
    onOpenNotebook(nb);
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
      <div className="px-4 sm:px-8 py-3.5 sm:py-5 pt-[max(0.75rem,env(safe-area-inset-top,0px))] border-b border-[#252538] bg-[#14141d] flex items-center justify-between flex-wrap gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8 max-w-7xl mx-auto">
            {filteredNotebooks.map((nb) => {
              const nbNotes = notes.filter(n => n.notebook_id === nb.id && !n.is_archived);
              const preset = getCoverById(nb.cover_url);

              return (
                <div
                  key={nb.id}
                  onClick={() => handleNotebookClick(nb)}
                  className="flex flex-col items-center group cursor-pointer select-none text-center"
                >
                  {/* Clean Visual Cover Card (3:4 ratio, clean corners, no spine, no text overlay) */}
                  <div className="w-full max-w-[200px] aspect-[3/4] rounded-2xl shadow-md group-hover:shadow-xl relative overflow-hidden transition-all duration-300 transform group-hover:-translate-y-1.5 border border-white/10 group-hover:border-white/20 bg-[#1e1e2d] flex-shrink-0">
                    {/* Cover Surface: custom image, solid color, or preset design */}
                    {nb.cover_type === 'custom' && nb.cover_url ? (
                      <img
                        src={nb.cover_url}
                        alt={nb.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    ) : nb.cover_type === 'color' ? (
                      <div
                        className="w-full h-full transition-transform duration-300 group-hover:scale-[1.02]"
                        style={{ backgroundColor: nb.color || '#3b82f6' }}
                      />
                    ) : (
                      <div
                        className={`w-full h-full bg-gradient-to-br ${preset.bgGradient} transition-transform duration-300 group-hover:scale-[1.02]`}
                        style={{ backgroundImage: preset.patternSvg }}
                      />
                    )}

                    {/* Subtle hover edit button on top-right (no text overlay, accessible) */}
                    <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1">
                      <button
                        onClick={(e) => handleOpenEdit(nb, e)}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-md shadow"
                        title="Configurar cuaderno"
                        aria-label={`Configurar cuaderno ${nb.name}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Lock indicator */}
                    {nb.is_locked && (
                      <div className="absolute bottom-2.5 right-2.5 z-10">
                        <span className="p-1 rounded-lg bg-black/70 backdrop-blur-md text-amber-400 border border-amber-500/30 flex items-center justify-center shadow">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    )}

                    {/* Subtle default indicator if notebook is primary */}
                    {nb.is_default && (
                      <div className="absolute top-2.5 left-2.5 z-10">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-900/80 text-blue-200 border border-blue-500/40 backdrop-blur-sm">
                          Principal
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Clean Content Composition Outside Cover */}
                  <div className="mt-3 w-full max-w-[200px] flex flex-col items-center">
                    {/* Notebook Name */}
                    <h3 className="text-sm font-medium text-gray-100 group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug">
                      {nb.name}
                    </h3>

                    {/* Brief Description */}
                    {nb.description ? (
                      <p className="text-xs text-gray-400 line-clamp-2 mt-1 leading-relaxed">
                        {nb.description}
                      </p>
                    ) : null}

                    {/* Discrete Notes Pill Indicator */}
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono text-gray-400 bg-[#20202e] border border-[#2b2b3e]">
                        {nbNotes.length} {nbNotes.length === 1 ? 'nota' : 'notas'}
                      </span>
                    </div>
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

      {/* Password Unlock Modal */}
      {unlockTarget && (
        <PasswordUnlockModal
          isOpen={!!unlockTarget}
          title={`Desbloquear Cuaderno "${unlockTarget.name}"`}
          subtitle="Ingresa la contraseña de este cuaderno para acceder a sus notas."
          onClose={() => setUnlockTarget(null)}
          onVerify={async (password) => {
            return verifyPassword(password, unlockTarget.password_hash || '');
          }}
          onSuccess={() => {
            unlockNotebookSession(unlockTarget.id);
            const target = unlockTarget;
            setUnlockTarget(null);
            onOpenNotebook(target);
          }}
        />
      )}
    </div>
  );
};
