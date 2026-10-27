import React, { useState, useMemo } from 'react';
import { 
  Palette, 
  Plus, 
  Search, 
  Calendar, 
  FolderKanban, 
  Book, 
  Layers, 
  Trash2, 
  Copy, 
  ArrowUpRight, 
  Clock, 
  Sparkles,
  LayoutGrid,
  FileImage,
  Edit2
} from 'lucide-react';
import { AppCanvas, AppProject, AppNotebook, AppArea } from '../lib/types';

interface CanvasesViewProps {
  canvases: AppCanvas[];
  projects: AppProject[];
  notebooks: AppNotebook[];
  areas?: AppArea[];
  onCreateCanvas: () => Promise<void>;
  onSelectCanvas: (canvas: AppCanvas) => void;
  onDeleteCanvas: (id: string) => Promise<void>;
  onDuplicateCanvas?: (canvas: AppCanvas) => Promise<void>;
}

export const CanvasesView: React.FC<CanvasesViewProps> = ({
  canvases,
  projects,
  notebooks,
  areas = [],
  onCreateCanvas,
  onSelectCanvas,
  onDeleteCanvas,
  onDuplicateCanvas
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedNotebookId, setSelectedNotebookId] = useState<string>('all');

  const filteredCanvases = useMemo(() => {
    return canvases.filter(c => {
      if (selectedProjectId !== 'all' && c.project_id !== selectedProjectId) return false;
      if (selectedNotebookId !== 'all' && c.notebook_id !== selectedNotebookId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (c.title || '').toLowerCase().includes(q);
        const matchDesc = (c.description || '').toLowerCase().includes(q);
        return matchTitle || matchDesc;
      }
      return true;
    });
  }, [canvases, searchQuery, selectedProjectId, selectedNotebookId]);

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#16161d] overflow-hidden">
      {/* HEADER */}
      <div className="px-4 sm:px-6 md:px-8 py-3 sm:py-5 pt-[max(0.75rem,env(safe-area-inset-top,0px))] border-b border-[#252530] bg-[#141419] flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Palette className="w-5 h-5 text-pink-400 flex-shrink-0" />
            <span>Lienzos visuales</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#1e1e2c] text-gray-400 font-mono">
              {canvases.length}
            </span>
          </h2>
          <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
            Diagramas, esquemas, bocetos y pizarras visuales integradas con Excalidraw y Cloudflare R2.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCreateCanvas}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow-md shadow-blue-900/30 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nuevo Lienzo</span>
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="px-4 sm:px-6 md:px-8 py-2.5 bg-[#121217] border-b border-[#20202c] flex items-center justify-between flex-wrap gap-2.5 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md bg-[#181822] border border-[#282838] rounded-xl px-3 py-1.5 focus-within:border-blue-500 transition">
          <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar lienzos por título..."
            className="w-full bg-transparent text-xs text-white placeholder-gray-500 outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-gray-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter by Project */}
        <div className="flex items-center gap-2">
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="bg-[#181822] border border-[#282838] rounded-xl px-2.5 py-1.5 text-xs text-gray-300 outline-none hover:border-[#38384f] transition"
          >
            <option value="all">Todos los proyectos</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>

          <select
            value={selectedNotebookId}
            onChange={e => setSelectedNotebookId(e.target.value)}
            className="bg-[#181822] border border-[#282838] rounded-xl px-2.5 py-1.5 text-xs text-gray-300 outline-none hover:border-[#38384f] transition hidden sm:block"
          >
            <option value="all">Todos los cuadernos</option>
            {notebooks.map(nb => (
              <option key={nb.id} value={nb.id}>{nb.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* CANVAS GRID CONTAINER */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        {filteredCanvases.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center max-w-md mx-auto space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center">
              <Palette className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">No hay lienzos disponibles</h3>
              <p className="text-xs text-gray-400 mt-1">
                {searchQuery || selectedProjectId !== 'all' || selectedNotebookId !== 'all'
                  ? 'Ningún lienzo coincide con los filtros aplicados.'
                  : 'Crea tu primer lienzo para diagramar ideas, flujos y esquemas a mano alzada con Excalidraw.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onCreateCanvas}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow-md shadow-blue-900/30 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Lienzo</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCanvases.map(canvas => {
              const elementCount = canvas.elements?.length || 0;
              const relatedProject = projects.find(p => p.id === canvas.project_id);
              const relatedNotebook = notebooks.find(nb => nb.id === canvas.notebook_id);
              const updatedDate = new Date(canvas.updated_at || canvas.created_at).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={canvas.id}
                  onClick={() => onSelectCanvas(canvas)}
                  className="group relative flex flex-col justify-between bg-[#181824] hover:bg-[#1d1d2b] border border-[#272738] hover:border-pink-500/40 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-0.5 overflow-hidden"
                >
                  {/* Top card header */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition">
                          <Palette className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-bold text-white group-hover:text-pink-300 transition truncate">
                          {canvas.title || 'Lienzo sin título'}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`¿Estás seguro de que deseas eliminar el lienzo "${canvas.title}"?`)) {
                            onDeleteCanvas(canvas.id);
                          }
                        }}
                        className="p-1 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition"
                        title="Eliminar lienzo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Canvas stats and preview */}
                    <div className="h-28 rounded-xl bg-[#121218] border border-[#222230] flex flex-col items-center justify-center text-center p-3 text-gray-400 relative overflow-hidden group-hover:border-[#2f2f45] transition">
                      <div className="w-10 h-10 rounded-full bg-[#1b1b24] flex items-center justify-center mb-1 text-gray-500 group-hover:text-pink-400 transition">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <span className="text-xs text-gray-300 font-semibold">
                        {elementCount} {elementCount === 1 ? 'elemento' : 'elementos'}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        Toca para abrir en Excalidraw
                      </span>
                    </div>
                  </div>

                  {/* Badges & Footer */}
                  <div className="mt-3 pt-2.5 border-t border-[#222232] space-y-2">
                    {/* Relations tags */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {relatedProject && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-950/50 text-blue-300 border border-blue-800/40 truncate max-w-[140px]">
                          <FolderKanban className="w-2.5 h-2.5" />
                          <span className="truncate">{relatedProject.title}</span>
                        </span>
                      )}
                      {relatedNotebook && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-950/50 text-purple-300 border border-purple-800/40 truncate max-w-[140px]">
                          <Book className="w-2.5 h-2.5" />
                          <span className="truncate">{relatedNotebook.name}</span>
                        </span>
                      )}
                    </div>

                    {/* Date */}
                    <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{updatedDate}</span>
                      </span>
                      <span className="text-blue-400 text-xs font-sans group-hover:translate-x-0.5 transition flex items-center gap-0.5">
                        <span>Abrir</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
