import React, { useState } from 'react';
import { 
  Archive, 
  RotateCcw, 
  Trash2, 
  Search, 
  FolderKanban, 
  FileText, 
  CheckSquare, 
  Boxes, 
  Clock, 
  Layers, 
  AlertTriangle 
} from 'lucide-react';
import { 
  AppProject, 
  AppNote, 
  AppTask, 
  AppObject, 
  AppArea 
} from '../lib/types';

interface ParaArchiveViewProps {
  projects: AppProject[];
  notes: AppNote[];
  tasks: AppTask[];
  objects: AppObject[];
  areas: AppArea[];
  onRestoreItem: (itemType: 'project' | 'note' | 'task' | 'object' | 'area', itemId: string) => Promise<void>;
  onPermanentDelete: (itemType: 'project' | 'note' | 'task' | 'object' | 'area', itemId: string) => Promise<void>;
  onOpenProject?: (project: AppProject) => void;
  onOpenNote?: (note: AppNote) => void;
  onOpenObject?: (obj: AppObject) => void;
}

export const ParaArchiveView: React.FC<ParaArchiveViewProps> = ({
  projects,
  notes,
  tasks,
  objects,
  areas,
  onRestoreItem,
  onPermanentDelete,
  onOpenNote,
  onOpenProject,
  onOpenObject
}) => {
  const [filterType, setFilterType] = useState<'all' | 'projects' | 'notes' | 'areas' | 'objects'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Collect archived items
  const archivedProjects = projects.filter(p => p.is_archived || p.status === 'completed' || p.para_category === 'archive');
  const archivedNotes = notes.filter(n => n.is_archived || n.para_category === 'archive');
  const archivedAreas = areas.filter(a => a.is_archived);
  const archivedObjects = objects.filter(o => o.para_category === 'archive');

  const totalArchived = archivedProjects.length + archivedNotes.length + archivedAreas.length + archivedObjects.length;

  const handleRestore = async (type: 'project' | 'note' | 'task' | 'object' | 'area', id: string) => {
    try {
      await onRestoreItem(type, id);
    } catch (err: any) {
      alert('Error restaurando elemento: ' + err.message);
    }
  };

  const handleDelete = async (type: 'project' | 'note' | 'task' | 'object' | 'area', id: string, name: string) => {
    if (!confirm(`¿Eliminar PERMANENTEMENTE "${name}" del archivo? Esta acción no se puede deshacer.`)) return;
    try {
      await onPermanentDelete(type, id);
    } catch (err: any) {
      alert('Error eliminando elemento: ' + err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#16161f] overflow-hidden">
      {/* Top Header */}
      <div className="px-5 sm:px-8 py-5 border-b border-[#252538] bg-[#14141c] flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gray-500/10 border border-gray-500/30 flex items-center justify-center text-gray-300">
              <Archive className="w-4 h-4" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span>Archivo Histórico</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-300 font-mono">
                {totalArchived} registros
              </span>
            </h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Elementos inactivos preservados con sus datos y relaciones históricas intactas. Restaura o elimina cuando lo decidas.
          </p>
        </div>
      </div>

      {/* Subheader: Filter Pills & Search */}
      <div className="px-5 sm:px-8 py-3 bg-[#13131a] border-b border-[#232332] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterType === 'all' ? 'bg-[#252538] text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Todos ({totalArchived})
          </button>
          <button
            onClick={() => setFilterType('projects')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterType === 'projects' ? 'bg-[#252538] text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Proyectos ({archivedProjects.length})
          </button>
          <button
            onClick={() => setFilterType('notes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterType === 'notes' ? 'bg-[#252538] text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Notas ({archivedNotes.length})
          </button>
          <button
            onClick={() => setFilterType('areas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filterType === 'areas' ? 'bg-[#252538] text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Áreas ({archivedAreas.length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar en archivo..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-[#1a1a26] border border-[#2c2c3e] rounded-lg text-xs text-white placeholder-gray-500 outline-none focus:border-gray-400 w-48"
          />
        </div>
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-8">
        <div className="max-w-4xl mx-auto space-y-3">
          {totalArchived === 0 ? (
            <div className="text-center py-20 text-gray-500 text-xs flex flex-col items-center">
              <Archive className="w-10 h-10 mb-2 stroke-[1.5] text-gray-600" />
              <span>No hay elementos archivados. Todo tu material se encuentra activo.</span>
            </div>
          ) : (
            <>
              {/* Proyectos archivados */}
              {(filterType === 'all' || filterType === 'projects') && archivedProjects.map(proj => (
                <div
                  key={proj.id}
                  className="p-4 rounded-xl bg-[#14141c] border border-[#242436] flex items-center justify-between gap-4 hover:border-[#38384f] transition"
                >
                  <div className="flex items-center gap-3 truncate">
                    <FolderKanban className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <div className="truncate">
                      <span className="font-bold text-xs text-white block truncate">{proj.title}</span>
                      <span className="text-[10px] text-gray-500">Proyecto • {proj.status}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRestore('project', proj.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1f1f2e] hover:bg-[#28283a] text-emerald-400 text-xs font-medium transition"
                      title="Restaurar a proyectos activos"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restaurar</span>
                    </button>
                    <button
                      onClick={() => handleDelete('project', proj.id, proj.title)}
                      className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition"
                      title="Eliminar definitivamente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Notas archivadas */}
              {(filterType === 'all' || filterType === 'notes') && archivedNotes.map(note => (
                <div
                  key={note.id}
                  className="p-4 rounded-xl bg-[#14141c] border border-[#242436] flex items-center justify-between gap-4 hover:border-[#38384f] transition"
                >
                  <div className="flex items-center gap-3 truncate">
                    <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <div className="truncate">
                      <span className="font-bold text-xs text-white block truncate">{note.title}</span>
                      <span className="text-[10px] text-gray-500">Nota • {new Date(note.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRestore('note', note.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1f1f2e] hover:bg-[#28283a] text-emerald-400 text-xs font-medium transition"
                      title="Restaurar a notas activas"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restaurar</span>
                    </button>
                    <button
                      onClick={() => handleDelete('note', note.id, note.title)}
                      className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition"
                      title="Eliminar definitivamente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Áreas archivadas */}
              {(filterType === 'all' || filterType === 'areas') && archivedAreas.map(area => (
                <div
                  key={area.id}
                  className="p-4 rounded-xl bg-[#14141c] border border-[#242436] flex items-center justify-between gap-4 hover:border-[#38384f] transition"
                >
                  <div className="flex items-center gap-3 truncate">
                    <Layers className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <div className="truncate">
                      <span className="font-bold text-xs text-white block truncate">{area.title}</span>
                      <span className="text-[10px] text-gray-500">Área de Responsabilidad</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRestore('area', area.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1f1f2e] hover:bg-[#28283a] text-emerald-400 text-xs font-medium transition"
                      title="Restaurar a áreas activas"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restaurar</span>
                    </button>
                    <button
                      onClick={() => handleDelete('area', area.id, area.title)}
                      className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition"
                      title="Eliminar definitivamente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
