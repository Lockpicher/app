import React, { useState, useMemo } from 'react';
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
  Lock,
  ArrowUpDown,
  Calendar,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import { AppNotebook, AppNote } from '../lib/types';
import { getCoverById } from '../lib/covers';
import { isNotebookUnlocked, unlockNotebookSession, verifyPassword } from '../lib/security';
import { NotebookModal } from './NotebookModal';
import { PasswordUnlockModal } from './PasswordUnlockModal';

type SortOption = 'recent' | 'name' | 'notes_count';

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
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNotebook, setSelectedNotebook] = useState<AppNotebook | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Desbloqueo de contraseña
  const [unlockTarget, setUnlockTarget] = useState<AppNotebook | null>(null);

  // Note counts per notebook memoized
  const noteCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const note of notes) {
      if (!note.is_archived && note.notebook_id) {
        map.set(note.notebook_id, (map.get(note.notebook_id) || 0) + 1);
      }
    }
    return map;
  }, [notes]);

  // Filtered and sorted notebooks
  const processedNotebooks = useMemo(() => {
    const list = notebooks.filter(nb => {
      if (showArchived ? !nb.is_archived : nb.is_archived) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = nb.name.toLowerCase().includes(q);
        const matchDesc = (nb.description || '').toLowerCase().includes(q);
        return matchName || matchDesc;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'notes_count') {
        const countA = noteCounts.get(a.id) || 0;
        const countB = noteCounts.get(b.id) || 0;
        return countB - countA;
      }
      // default: 'recent'
      const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
      const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [notebooks, showArchived, searchQuery, sortBy, noteCounts]);

  const handleOpenCreate = () => {
    setSelectedNotebook(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (nb: AppNotebook, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveMenuId(null);
    if (nb.is_locked && nb.password_hash && !isNotebookUnlocked(nb.id)) {
      setUnlockTarget(nb);
      return;
    }
    setSelectedNotebook(nb);
    setIsModalOpen(true);
  };

  const handleNotebookClick = (nb: AppNotebook) => {
    setActiveMenuId(null);
    if (nb.is_locked && nb.password_hash && !isNotebookUnlocked(nb.id)) {
      setUnlockTarget(nb);
      return;
    }
    onOpenNotebook(nb);
  };

  const handleToggleArchive = async (nb: AppNotebook, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuId(null);
    await onUpdateNotebook(nb.id, { is_archived: !nb.is_archived });
  };

  const handleDelete = async (nb: AppNotebook, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuId(null);
    const count = noteCounts.get(nb.id) || 0;
    const msg = count > 0 
      ? `¿Eliminar el cuaderno "${nb.name}"? Contiene ${count} notas que quedarán sin cuaderno asignado.`
      : `¿Eliminar el cuaderno "${nb.name}"?`;
    if (window.confirm(msg)) {
      await onDeleteNotebook(nb.id);
    }
  };

  const handleSaveModal = async (data: Partial<AppNotebook>) => {
    if (selectedNotebook?.id) {
      await onUpdateNotebook(selectedNotebook.id, data);
    } else {
      await onCreateNotebook(data);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Reciente';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return 'Reciente';
    }
  };

  return (
    <div 
      onClick={() => setActiveMenuId(null)}
      className="flex-1 flex flex-col h-screen bg-[#14141e] overflow-hidden select-none"
    >
      {/* Header */}
      <div className="px-4 sm:px-8 py-3.5 sm:py-5 pt-[max(0.75rem,env(safe-area-inset-top,0px))] border-b border-[#252538] bg-[#12121b] flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 sm:gap-2.5">
            <Book className="w-5 h-5 text-blue-400" />
            <span>Biblioteca de Cuadernos</span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
            Organiza tus notas, tareas, audios, dibujos y archivos en colecciones temáticas.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
          {/* Search bar */}
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cuaderno..."
              className="pl-8 pr-3 py-1.5 bg-[#1a1a26] border border-[#2c2c40] rounded-xl text-xs text-white placeholder-gray-500 outline-none w-full sm:w-44 focus:border-blue-500 transition"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 bg-[#1a1a26] border border-[#2c2c40] rounded-xl px-2 py-1 text-xs text-gray-300">
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent border-none text-xs text-gray-200 outline-none cursor-pointer pr-1"
            >
              <option value="recent" className="bg-[#1a1a26] text-white">Más recientes</option>
              <option value="name" className="bg-[#1a1a26] text-white">Nombre (A-Z)</option>
              <option value="notes_count" className="bg-[#1a1a26] text-white">Cantidad de notas</option>
            </select>
          </div>

          {/* Archive Toggle */}
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

          {/* New Notebook Button */}
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-900/30 transition flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Cuaderno</span>
          </button>
        </div>
      </div>

      {/* Main Grid Canvas (Visual 3:4 ratio covers) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        {processedNotebooks.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-[#29293e] rounded-2xl max-w-lg mx-auto p-8 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#1b1b28] text-blue-400 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">
              {showArchived ? 'No hay cuadernos archivados' : 'No se encontraron cuadernos'}
            </h3>
            <p className="text-xs text-gray-400">
              Crea tu primer cuaderno para organizar tus notas de texto, audios, tareas, dibujos e imágenes.
            </p>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium transition"
            >
              Crear Cuaderno
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8 max-w-7xl mx-auto">
            {processedNotebooks.map((nb) => {
              const count = noteCounts.get(nb.id) || 0;
              const preset = getCoverById(nb.cover_url);
              const isMenuOpen = activeMenuId === nb.id;

              return (
                <div
                  key={nb.id}
                  onClick={() => handleNotebookClick(nb)}
                  className="flex flex-col items-center group cursor-pointer text-center relative"
                >
                  {/* Visual 3:4 Cover Card */}
                  <div className="w-full max-w-[210px] aspect-[3/4] rounded-2xl shadow-md group-hover:shadow-2xl relative overflow-hidden transition-all duration-300 transform group-hover:-translate-y-1.5 border border-white/10 group-hover:border-blue-500/50 bg-[#1c1c2a] flex-shrink-0">
                    {/* Cover Surface: custom image, solid color, or preset pattern */}
                    {nb.cover_type === 'custom' && nb.cover_url ? (
                      <img
                        src={nb.cover_url}
                        alt={nb.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : nb.cover_type === 'color' ? (
                      <div
                        className="w-full h-full transition-transform duration-300 group-hover:scale-105"
                        style={{ backgroundColor: nb.color || '#3b82f6' }}
                      />
                    ) : (
                      <div
                        className={`w-full h-full bg-gradient-to-br ${preset.bgGradient} transition-transform duration-300 group-hover:scale-105`}
                        style={{ backgroundImage: preset.patternSvg }}
                      />
                    )}

                    {/* Gradient overlay on bottom for contrast */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                    {/* Primary Badge */}
                    {nb.is_default && (
                      <div className="absolute top-2.5 left-2.5 z-10">
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-900/90 text-blue-200 border border-blue-500/40 backdrop-blur-md shadow">
                          Principal
                        </span>
                      </div>
                    )}

                    {/* Password Lock Indicator */}
                    {nb.is_locked && (
                      <div className="absolute bottom-2.5 left-2.5 z-10">
                        <span className="p-1 rounded-lg bg-black/70 backdrop-blur-md text-amber-400 border border-amber-500/30 flex items-center justify-center shadow">
                          <Lock className="w-3 h-3" />
                        </span>
                      </div>
                    )}

                    {/* Action Menu Button (Top Right) */}
                    <div className="absolute top-2.5 right-2.5 z-20">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(isMenuOpen ? null : nb.id);
                        }}
                        className={`p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white backdrop-blur-md shadow transition ${
                          isMenuOpen ? 'opacity-100 ring-2 ring-blue-400' : 'opacity-80 group-hover:opacity-100'
                        }`}
                        title="Opciones del cuaderno"
                        aria-label={`Opciones del cuaderno ${nb.name}`}
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <div 
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1.5 w-44 bg-[#1a1a27] border border-[#2d2d42] rounded-xl shadow-2xl py-1 z-30 text-left text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-100 divide-y divide-[#252538]"
                        >
                          <div className="py-1">
                            <button
                              type="button"
                              onClick={() => handleNotebookClick(nb)}
                              className="w-full px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                              <span>Abrir cuaderno</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleOpenEdit(nb, e)}
                              className="w-full px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center gap-2 transition"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Editar / Portada</span>
                            </button>
                          </div>

                          <div className="py-1">
                            <button
                              type="button"
                              onClick={(e) => handleToggleArchive(nb, e)}
                              className="w-full px-3 py-1.5 hover:bg-[#28283c] flex items-center gap-2 transition text-gray-300"
                            >
                              <Archive className="w-3.5 h-3.5 text-amber-400" />
                              <span>{nb.is_archived ? 'Desarchivar' : 'Archivar'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDelete(nb, e)}
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

                  {/* Clean Content Information Below Cover */}
                  <div className="mt-2.5 w-full max-w-[210px] flex flex-col items-center">
                    {/* Notebook Name */}
                    <h3 className="text-sm font-semibold text-gray-100 group-hover:text-blue-400 transition-colors line-clamp-1 leading-snug">
                      {nb.name}
                    </h3>

                    {/* Description */}
                    {nb.description ? (
                      <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5 leading-relaxed">
                        {nb.description}
                      </p>
                    ) : null}

                    {/* Metadata: Notes Count & Modified Date */}
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-gray-400 font-mono">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#1e1e2d] border border-[#2b2b3e] text-gray-300 font-medium">
                        {count} {count === 1 ? 'nota' : 'notas'}
                      </span>
                      <span>•</span>
                      <span title="Última modificación">
                        {formatDate(nb.updated_at || nb.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Notebook Modal (Create & Edit) */}
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
