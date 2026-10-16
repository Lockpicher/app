import React, { useState } from 'react';
import { 
  Layers, 
  Plus, 
  Trash2, 
  Edit3, 
  FolderKanban, 
  CheckSquare, 
  FileText, 
  Calendar, 
  Clock, 
  Sparkles, 
  Tag, 
  ChevronDown, 
  ChevronRight, 
  Target, 
  User, 
  Boxes, 
  Archive, 
  CheckCircle, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { 
  AppArea, 
  AppProject, 
  AppNote, 
  AppTask, 
  AppObject 
} from '../lib/types';

interface ParaAreasViewProps {
  areas: AppArea[];
  projects: AppProject[];
  notes: AppNote[];
  tasks: AppTask[];
  objects: AppObject[];
  onCreateArea: (area: Partial<AppArea>) => Promise<void>;
  onUpdateArea: (id: string, updates: Partial<AppArea>) => Promise<void>;
  onDeleteArea: (id: string) => Promise<void>;
  onOpenProject?: (project: AppProject) => void;
  onOpenNote?: (note: AppNote) => void;
  onOpenObject?: (obj: AppObject) => void;
}

export const ParaAreasView: React.FC<ParaAreasViewProps> = ({
  areas,
  projects,
  notes,
  tasks,
  objects,
  onCreateArea,
  onUpdateArea,
  onDeleteArea,
  onOpenProject,
  onOpenNote,
  onOpenObject
}) => {
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(areas[0]?.id || null);
  const [isCreatingArea, setIsCreatingArea] = useState(false);
  const [newAreaTitle, setNewAreaTitle] = useState('');
  const [newAreaDescription, setNewAreaDescription] = useState('');
  const [newAreaColor, setNewAreaColor] = useState('#8b5cf6');
  const [newAreaReviewDays, setNewAreaReviewDays] = useState(30);

  const selectedArea = areas.find(a => a.id === selectedAreaId) || areas[0] || null;

  // Linked items to selected area
  const areaProjects = selectedArea ? projects.filter(p => p.area_id === selectedArea.id || p.properties?.area_id === selectedArea.id) : [];
  const areaNotes = selectedArea ? notes.filter(n => n.area_id === selectedArea.id || n.properties?.area_id === selectedArea.id) : [];
  const areaTasks = selectedArea ? tasks.filter(t => t.area_id === selectedArea.id || t.properties?.area_id === selectedArea.id) : [];
  const areaObjects = selectedArea ? objects.filter(o => o.area_id === selectedArea.id || o.properties?.area_id === selectedArea.id) : [];

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaTitle.trim()) return;

    try {
      await onCreateArea({
        title: newAreaTitle.trim(),
        description: newAreaDescription.trim() || undefined,
        color: newAreaColor,
        review_frequency_days: newAreaReviewDays,
        last_reviewed_at: new Date().toISOString()
      });
      setNewAreaTitle('');
      setNewAreaDescription('');
      setIsCreatingArea(false);
    } catch (err: any) {
      alert('Error creando área: ' + err.message);
    }
  };

  const handleCompleteReview = async (area: AppArea) => {
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + (area.review_frequency_days || 30));

    await onUpdateArea(area.id, {
      last_reviewed_at: new Date().toISOString(),
      next_review_at: nextReview.toISOString()
    });
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#16161f] overflow-hidden">
      {/* Top Header */}
      <div className="px-5 sm:px-8 py-5 border-b border-[#252538] bg-[#14141c] flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span>Áreas de Responsabilidad</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                {areas.length} áreas
              </span>
            </h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Responsabilidades continuas sin fecha de finalización (salud, finanzas, desarrollo profesional, familia).
          </p>
        </div>

        <button
          onClick={() => setIsCreatingArea(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition shadow-md shadow-purple-950/40"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Área</span>
        </button>
      </div>

      {/* Main Two-Panel Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Left List of Areas */}
        <aside className="w-full md:w-80 bg-[#13131c] border-b md:border-b-0 md:border-r border-[#242436] p-4 flex flex-col overflow-y-auto no-scrollbar flex-shrink-0 space-y-2">
          {areas.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-xs">
              No tienes áreas creadas aún. Haz clic en "Nueva Área" para estructurar tus responsabilidades.
            </div>
          ) : (
            areas.map(area => {
              const isSelected = selectedArea?.id === area.id;
              const areaProjCount = projects.filter(p => p.area_id === area.id || p.properties?.area_id === area.id).length;

              return (
                <div
                  key={area.id}
                  onClick={() => setSelectedAreaId(area.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-[#1e1e2d] border-purple-500/50 shadow-md'
                      : 'bg-[#171722] border-[#252536] hover:bg-[#1a1a28] hover:border-[#38384f]'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <span 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: area.color || '#8b5cf6' }} 
                    />
                    <div className="truncate">
                      <h4 className="font-bold text-xs text-white truncate">{area.title}</h4>
                      {area.description && (
                        <p className="text-[11px] text-gray-400 truncate">{area.description}</p>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#242436] text-gray-300 font-mono flex-shrink-0">
                    {areaProjCount} proj
                  </span>
                </div>
              );
            })
          )}
        </aside>

        {/* Right Detail Dossier for Selected Area */}
        <main className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {selectedArea ? (
            <div className="max-w-4xl space-y-6">
              
              {/* Area Header Card */}
              <div className="p-5 rounded-2xl bg-[#171724] border border-[#26263a] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span 
                      className="w-2.5 h-2.5 rounded-full" 
                      style={{ backgroundColor: selectedArea.color || '#8b5cf6' }} 
                    />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-semibold">
                      Área de Responsabilidad
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white">{selectedArea.title}</h3>
                  {selectedArea.description && (
                    <p className="text-xs text-gray-300 mt-1 leading-relaxed max-w-2xl">
                      {selectedArea.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleCompleteReview(selectedArea)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 transition"
                    title="Registrar revisión de área completada"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Marcar Revisión Hoy</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`¿Eliminar área "${selectedArea.title}"? Los proyectos y notas vinculados no se borrarán.`)) {
                        onDeleteArea(selectedArea.id);
                      }
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 1. Proyectos activos en esta Área */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-blue-400" />
                    <span>Proyectos Vinculados ({areaProjects.length})</span>
                  </h4>
                </div>

                {areaProjects.length === 0 ? (
                  <p className="text-xs text-gray-500 italic p-3 rounded-xl bg-[#14141c] border border-[#222230]">
                    No hay proyectos activos asignados a esta área de responsabilidad.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {areaProjects.map(proj => (
                      <div
                        key={proj.id}
                        onClick={() => onOpenProject && onOpenProject(proj)}
                        className="p-3.5 bg-[#14141d] rounded-xl border border-[#242436] hover:border-blue-500/40 cursor-pointer transition flex flex-col justify-between h-28 group"
                      >
                        <div>
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#1e1e2c] text-blue-300">
                            {proj.status}
                          </span>
                          <h5 className="font-bold text-xs text-white group-hover:text-blue-300 transition mt-1.5 truncate">
                            {proj.title}
                          </h5>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                          <span>{proj.progress}% completado</span>
                          <span>{proj.due_date || 'Sin fecha'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Tareas recurrentes o de mantenimiento en esta Área */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  <span>Tareas de Mantenimiento ({areaTasks.length})</span>
                </h4>

                {areaTasks.length === 0 ? (
                  <p className="text-xs text-gray-500 italic p-3 rounded-xl bg-[#14141c] border border-[#222230]">
                    No hay tareas asignadas directamente a esta área.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {areaTasks.map(t => (
                      <div key={t.id} className="p-2.5 rounded-xl bg-[#14141d] border border-[#242436] text-xs flex items-center justify-between">
                        <span className="text-gray-200">{t.title}</span>
                        {t.due_date && <span className="text-[10px] font-mono text-purple-300">{t.due_date}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Notas y Documentación en esta Área */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span>Notas & Recursos de Área ({areaNotes.length})</span>
                </h4>

                {areaNotes.length === 0 ? (
                  <p className="text-xs text-gray-500 italic p-3 rounded-xl bg-[#14141c] border border-[#222230]">
                    No hay notas asociadas a esta área.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {areaNotes.map(n => (
                      <div
                        key={n.id}
                        onClick={() => onOpenNote && onOpenNote(n)}
                        className="p-3 bg-[#14141d] rounded-xl border border-[#242436] hover:border-purple-500/40 cursor-pointer transition text-xs flex items-center justify-between"
                      >
                        <span className="text-gray-200 font-medium truncate">{n.title}</span>
                        <ExternalLink className="w-3 h-3 text-gray-500 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="text-center py-20 text-gray-500 text-xs">
              Selecciona un área en el panel lateral para consultar su detalle.
            </div>
          )}
        </main>
      </div>

      {/* CREATE AREA MODAL */}
      {isCreatingArea && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in">
          <form onSubmit={handleCreateSubmit} className="bg-[#181824] border border-[#2e2e42] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#252538]">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <span>Nueva Área de Responsabilidad</span>
              </h4>
              <button type="button" onClick={() => setIsCreatingArea(false)} className="text-gray-400 hover:text-white text-xs">✕</button>
            </div>

            <div>
              <label className="text-xs text-gray-300 font-medium block mb-1">Nombre del Área *</label>
              <input
                type="text"
                required
                placeholder="Ej. Salud & Bienestar, Finanzas Personales, Desarrollo Profesional..."
                value={newAreaTitle}
                onChange={e => setNewAreaTitle(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#121218] border border-[#2b2b3e] rounded-xl text-xs sm:text-sm text-white outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-300 font-medium block mb-1">Descripción / Estándar de Éxito</label>
              <textarea
                rows={2}
                placeholder="¿Qué estándar buscas mantener en esta área continua?"
                value={newAreaDescription}
                onChange={e => setNewAreaDescription(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#121218] border border-[#2b2b3e] rounded-xl text-xs text-white outline-none focus:border-purple-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-300 font-medium block mb-1">Color</label>
                <input
                  type="color"
                  value={newAreaColor}
                  onChange={e => setNewAreaColor(e.target.value)}
                  className="w-full h-9 bg-transparent border-0 rounded cursor-pointer"
                />
              </div>
              <div>
                <label className="text-xs text-gray-300 font-medium block mb-1">Revisión cada (días)</label>
                <input
                  type="number"
                  min={7}
                  max={365}
                  value={newAreaReviewDays}
                  onChange={e => setNewAreaReviewDays(parseInt(e.target.value, 10) || 30)}
                  className="w-full px-3 py-2 bg-[#121218] border border-[#2b2b3e] rounded-xl text-xs text-white outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#252538]">
              <button
                type="button"
                onClick={() => setIsCreatingArea(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-sm"
              >
                Crear Área
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
