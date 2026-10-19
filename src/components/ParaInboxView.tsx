import React, { useState } from 'react';
import { 
  Inbox, 
  Plus, 
  FileText, 
  CheckSquare, 
  FolderKanban, 
  User, 
  Boxes, 
  Link as LinkIcon, 
  Paperclip, 
  ArrowRight, 
  Sparkles, 
  Check, 
  Tag, 
  Calendar,
  Layers,
  Archive,
  BookOpen,
  Trash2
} from 'lucide-react';
import { 
  AppNote, 
  AppTask, 
  AppProject, 
  AppObject, 
  AppArea, 
  PARACategory 
} from '../lib/types';

interface ParaInboxViewProps {
  notes: AppNote[];
  tasks: AppTask[];
  projects: AppProject[];
  objects: AppObject[];
  areas: AppArea[];
  onQuickCreate: (type: 'note' | 'task' | 'project' | 'person' | 'resource', data: { title: string; content?: string }) => Promise<void>;
  onClassifyItem: (itemType: 'note' | 'task' | 'project' | 'object', itemId: string, targetCategory: PARACategory, targetAreaId?: string, targetProjectId?: string) => Promise<void>;
  onOpenNote?: (note: AppNote) => void;
  onOpenProject?: (project: AppProject) => void;
  onOpenObject?: (obj: AppObject) => void;
  onDeleteTask?: (taskId: string) => Promise<void>;
}

export const ParaInboxView: React.FC<ParaInboxViewProps> = ({
  notes,
  tasks,
  projects,
  objects,
  areas,
  onQuickCreate,
  onClassifyItem,
  onOpenNote,
  onOpenProject,
  onOpenObject,
  onDeleteTask
}) => {
  // Capture input state
  const [captureTitle, setCaptureTitle] = useState('');
  const [captureType, setCaptureType] = useState<'note' | 'task' | 'project' | 'person' | 'resource'>('note');
  const [isCapturing, setIsCapturing] = useState(false);

  // Classification modal / inline drawer
  const [classifyingItem, setClassifyingItem] = useState<{
    id: string;
    type: 'note' | 'task' | 'project' | 'object';
    title: string;
  } | null>(null);
  const [selectedParaCategory, setSelectedParaCategory] = useState<PARACategory>('project');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Find unclassified items (Inbox items: no project_id, no area_id, or explicitly marked as inbox)
  const unclassifiedNotes = notes.filter(n => !n.is_archived && (!n.project_id && !n.area_id && (!n.para_category || n.para_category === 'inbox')));
  const unclassifiedTasks = tasks.filter(t => t.status !== 'completed' && (!t.project_id && !t.area_id && (!t.para_category || t.para_category === 'inbox')));
  const unclassifiedObjects = objects.filter(o => o.object_type !== 'area' && (!o.project_id && !o.area_id && (!o.para_category || o.para_category === 'inbox')));

  const totalInboxCount = unclassifiedNotes.length + unclassifiedTasks.length + unclassifiedObjects.length;

  const handleCaptureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captureTitle.trim()) return;

    try {
      setIsCapturing(true);
      await onQuickCreate(captureType, { title: captureTitle.trim() });
      setCaptureTitle('');
    } catch (err: any) {
      alert('Error capturando elemento: ' + err.message);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleApplyClassification = async () => {
    if (!classifyingItem) return;

    try {
      await onClassifyItem(
        classifyingItem.type,
        classifyingItem.id,
        selectedParaCategory,
        selectedAreaId || undefined,
        selectedProjectId || undefined
      );
      setClassifyingItem(null);
    } catch (err: any) {
      alert('Error clasificando elemento: ' + err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#16161f] overflow-hidden">
      {/* Top Banner / Header */}
      <div className="px-5 sm:px-8 py-5 border-b border-[#252538] bg-[#14141c] flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Inbox className="w-4 h-4" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span>Capturar & Bandeja de Entrada</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                {totalInboxCount} pendientes
              </span>
            </h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Captura rápida con mínima fricción. Organiza y clasifica posteriormente en Proyectos, Áreas, Recursos o Archivo.
          </p>
        </div>
      </div>

      {/* Universal Quick Capture Bar */}
      <div className="p-4 sm:p-6 bg-[#13131a] border-b border-[#232332]">
        <form onSubmit={handleCaptureSubmit} className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-2.5">
          <div className="flex items-center bg-[#191924] border border-[#2b2b3d] rounded-xl px-3 py-1 flex-shrink-0">
            <select
              value={captureType}
              onChange={e => setCaptureType(e.target.value as any)}
              className="bg-transparent text-xs text-gray-200 outline-none cursor-pointer py-1.5"
            >
              <option value="note">📝 Nota Rápida</option>
              <option value="task">✅ Tarea Pendiente</option>
              <option value="person">👤 Persona / Contacto</option>
              <option value="resource">📚 Recurso / Enlace</option>
              <option value="project">🚀 Nuevo Proyecto</option>
            </select>
          </div>

          <div className="flex-1 relative">
            <input
              type="text"
              required
              placeholder="¿Qué tienes en mente? Escribe y presiona Enter para capturar..."
              value={captureTitle}
              onChange={e => setCaptureTitle(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#191924] border border-[#2b2b3d] rounded-xl text-xs sm:text-sm text-white placeholder-gray-500 outline-none focus:border-amber-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={isCapturing || !captureTitle.trim()}
            className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white transition shadow-md shadow-amber-950/40 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{isCapturing ? 'Guardando...' : 'Capturar'}</span>
          </button>
        </form>
      </div>

      {/* Unclassified Items Grid & Lists */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 sm:px-8 space-y-6">
        {totalInboxCount === 0 ? (
          <div className="text-center py-20 flex flex-col items-center justify-center text-gray-400">
            <div className="w-16 h-16 rounded-2xl bg-[#1a1a26] border border-[#262638] flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">¡Bandeja de Entrada al día!</h3>
            <p className="text-xs text-gray-400 max-w-sm">
              Todos tus pensamientos, tareas y notas están organizados en Proyectos, Áreas o Recursos.
            </p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* 1. Tareas sin clasificar */}
            {unclassifiedTasks.length > 0 && (
              <div className="bg-[#181824] rounded-2xl border border-[#262638] p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-200 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                    <span>Tareas en Bandeja ({unclassifiedTasks.length})</span>
                  </h4>
                </div>

                <div className="space-y-1.5">
                  {unclassifiedTasks.map(task => (
                    <div
                      key={task.id}
                      className="p-3 bg-[#13131c] rounded-xl border border-[#232330] hover:border-[#38384d] transition flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                        <span className="font-medium text-white truncate">{task.title}</span>
                        {task.due_date && (
                          <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-800/40">
                            {task.due_date}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => setClassifyingItem({ id: task.id, type: 'task', title: task.title })}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#20202e] hover:bg-[#2b2b3e] text-amber-300 text-[11px] font-medium border border-amber-500/20 transition"
                        >
                          <span>Organizar en PARA</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        {onDeleteTask && (
                          <button
                            onClick={async () => {
                              if (window.confirm(`¿Estás seguro de que deseas eliminar la tarea "${task.title}"?`)) {
                                await onDeleteTask(task.id);
                              }
                            }}
                            title="Eliminar tarea"
                            aria-label="Eliminar tarea"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition border border-transparent hover:border-red-500/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Notas sin clasificar */}
            {unclassifiedNotes.length > 0 && (
              <div className="bg-[#181824] rounded-2xl border border-[#262638] p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-200 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <span>Notas en Bandeja ({unclassifiedNotes.length})</span>
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {unclassifiedNotes.map(note => (
                    <div
                      key={note.id}
                      onClick={() => onOpenNote && onOpenNote(note)}
                      className="p-3.5 bg-[#13131c] rounded-xl border border-[#232330] hover:border-purple-500/40 cursor-pointer transition flex flex-col justify-between h-36 group"
                    >
                      <div>
                        <h5 className="font-bold text-xs text-white group-hover:text-purple-300 transition line-clamp-1 mb-1">
                          {note.title}
                        </h5>
                        <p className="text-[11px] text-gray-400 line-clamp-2">
                          {note.plain_text || 'Sin texto adicional...'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-[#20202c] flex items-center justify-between">
                        <span className="text-[10px] font-mono text-gray-500">
                          {new Date(note.created_at).toLocaleDateString()}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setClassifyingItem({ id: note.id, type: 'note', title: note.title });
                          }}
                          className="px-2 py-0.5 rounded bg-[#20202e] hover:bg-[#2b2b3e] text-amber-300 text-[10px] font-medium transition"
                        >
                          Clasificar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Objetos y Contactos sin clasificar */}
            {unclassifiedObjects.length > 0 && (
              <div className="bg-[#181824] rounded-2xl border border-[#262638] p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-200 flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-blue-400" />
                    <span>Entidades & Contactos en Bandeja ({unclassifiedObjects.length})</span>
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {unclassifiedObjects.map(obj => (
                    <div
                      key={obj.id}
                      onClick={() => onOpenObject && onOpenObject(obj)}
                      className="p-3 bg-[#13131c] rounded-xl border border-[#232330] hover:border-blue-500/40 cursor-pointer transition flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-7 h-7 rounded-lg bg-blue-950/60 border border-blue-800/40 flex items-center justify-center text-blue-300 text-[10px] font-bold flex-shrink-0">
                          {obj.title.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <span className="font-semibold text-xs text-white block truncate">{obj.title}</span>
                          <span className="text-[10px] text-gray-500 uppercase font-mono">{obj.object_type}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setClassifyingItem({ id: obj.id, type: 'object', title: obj.title });
                        }}
                        className="px-2 py-1 rounded bg-[#20202e] hover:bg-[#2b2b3e] text-amber-300 text-[10px] font-medium transition flex-shrink-0"
                      >
                        Clasificar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* CLASSIFICATION MODAL */}
      {classifyingItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in">
          <div className="bg-[#181824] border border-[#2e2e42] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#252538]">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>Clasificar en Sistema PARA</span>
                </h4>
                <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-xs">
                  {classifyingItem.title}
                </p>
              </div>
              <button onClick={() => setClassifyingItem(null)} className="text-gray-400 hover:text-white text-xs">✕</button>
            </div>

            {/* PARA Category Selector */}
            <div>
              <label className="text-xs text-gray-300 font-medium block mb-2">Selecciona la Clasificación</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedParaCategory('project')}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                    selectedParaCategory === 'project'
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-sm'
                      : 'bg-[#13131c] text-gray-400 border-[#232332] hover:bg-[#1a1a26]'
                  }`}
                >
                  <FolderKanban className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">Proyecto</span>
                    <span className="text-[10px] text-gray-500">Resultado con meta</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedParaCategory('area')}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                    selectedParaCategory === 'area'
                      ? 'bg-purple-600/20 text-purple-300 border-purple-500/50 shadow-sm'
                      : 'bg-[#13131c] text-gray-400 border-[#232332] hover:bg-[#1a1a26]'
                  }`}
                >
                  <Layers className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">Área</span>
                    <span className="text-[10px] text-gray-500">Responsabilidad continua</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedParaCategory('resource')}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                    selectedParaCategory === 'resource'
                      ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                      : 'bg-[#13131c] text-gray-400 border-[#232332] hover:bg-[#1a1a26]'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">Recurso</span>
                    <span className="text-[10px] text-gray-500">Conocimiento útil</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedParaCategory('archive')}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                    selectedParaCategory === 'archive'
                      ? 'bg-gray-600/20 text-gray-200 border-gray-500/50 shadow-sm'
                      : 'bg-[#13131c] text-gray-400 border-[#232332] hover:bg-[#1a1a26]'
                  }`}
                >
                  <Archive className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">Archivo</span>
                    <span className="text-[10px] text-gray-500">Histórico inactivo</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Associate with specific Project */}
            {selectedParaCategory === 'project' && (
              <div>
                <label className="text-xs text-gray-300 font-medium block mb-1">Vincular a Proyecto</label>
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121218] border border-[#2b2b3e] rounded-xl text-xs text-white outline-none"
                >
                  <option value="">Selecciona un proyecto...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Associate with specific Area */}
            {(selectedParaCategory === 'area' || selectedParaCategory === 'project') && (
              <div>
                <label className="text-xs text-gray-300 font-medium block mb-1">Área de Responsabilidad</label>
                <select
                  value={selectedAreaId}
                  onChange={e => setSelectedAreaId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121218] border border-[#2b2b3e] rounded-xl text-xs text-white outline-none"
                >
                  <option value="">Sin Área Específica</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{a.title}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#232332]">
              <button
                type="button"
                onClick={() => setClassifyingItem(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyClassification}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-sm"
              >
                Aplicar Clasificación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
