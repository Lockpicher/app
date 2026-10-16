import React from 'react';
import { 
  AlertCircle, 
  Clock, 
  FolderKanban, 
  Layers, 
  CheckSquare, 
  ArrowRight, 
  Calendar, 
  Sparkles,
  Inbox
} from 'lucide-react';
import { 
  AppProject, 
  AppArea, 
  AppTask, 
  AppNote 
} from '../lib/types';

interface ParaReviewViewProps {
  projects: AppProject[];
  areas: AppArea[];
  tasks: AppTask[];
  notes: AppNote[];
  onOpenProject?: (project: AppProject) => void;
  onOpenArea?: (area: AppArea) => void;
  onNavigateToView?: (view: any) => void;
}

export const ParaReviewView: React.FC<ParaReviewViewProps> = ({
  projects,
  areas,
  tasks,
  notes,
  onOpenProject,
  onOpenArea,
  onNavigateToView
}) => {
  // 1. Proyectos activos sin tareas o sin próxima acción
  const projectsNeedingAttention = projects.filter(p => {
    if (p.status !== 'active') return false;
    const projectTasks = tasks.filter(t => t.project_id === p.id && t.status !== 'completed');
    return projectTasks.length === 0 || !p.next_action;
  });

  // 2. Tareas atrasadas (due_date en el pasado y no completadas)
  const todayStr = new Date().toISOString().slice(0, 10);
  const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.due_date && t.due_date < todayStr);

  // 3. Áreas que necesitan revisión (last_reviewed_at hace más días que review_frequency_days)
  const areasNeedingReview = areas.filter(a => {
    if (a.is_archived) return false;
    if (!a.last_reviewed_at) return true;
    const lastRev = new Date(a.last_reviewed_at).getTime();
    const diffDays = (Date.now() - lastRev) / (1000 * 3600 * 24);
    return diffDays >= (a.review_frequency_days || 30);
  });

  // 4. Elementos en Bandeja pendientes de clasificar
  const unclassifiedNotes = notes.filter(n => !n.is_archived && !n.project_id && !n.area_id);
  const unclassifiedTasks = tasks.filter(t => t.status !== 'completed' && !t.project_id && !t.area_id);
  const totalInbox = unclassifiedNotes.length + unclassifiedTasks.length;

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#16161f] overflow-hidden">
      {/* Top Header */}
      <div className="px-5 sm:px-8 py-5 border-b border-[#252538] bg-[#14141c] flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span>Revisión Periódica de Segundo Cerebro</span>
            </h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Auditoría de proyectos sin próxima acción, áreas vencidas, tareas retrasadas y bandeja de entrada.
          </p>
        </div>
      </div>

      {/* Review Content */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Diagnostic Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-xl bg-[#14141c] border border-[#242436]">
              <span className="text-[10px] text-gray-500 uppercase font-mono block">En Bandeja</span>
              <span className="text-xl font-bold text-amber-400">{totalInbox}</span>
              <span className="text-[11px] text-gray-400 block mt-0.5">por clasificar</span>
            </div>

            <div className="p-4 rounded-xl bg-[#14141c] border border-[#242436]">
              <span className="text-[10px] text-gray-500 uppercase font-mono block">Proyectos estancados</span>
              <span className="text-xl font-bold text-blue-400">{projectsNeedingAttention.length}</span>
              <span className="text-[11px] text-gray-400 block mt-0.5">sin próxima acción</span>
            </div>

            <div className="p-4 rounded-xl bg-[#14141c] border border-[#242436]">
              <span className="text-[10px] text-gray-500 uppercase font-mono block">Áreas por revisar</span>
              <span className="text-xl font-bold text-purple-400">{areasNeedingReview.length}</span>
              <span className="text-[11px] text-gray-400 block mt-0.5">revisión periódica</span>
            </div>

            <div className="p-4 rounded-xl bg-[#14141c] border border-[#242436]">
              <span className="text-[10px] text-gray-500 uppercase font-mono block">Tareas atrasadas</span>
              <span className="text-xl font-bold text-rose-400">{overdueTasks.length}</span>
              <span className="text-[11px] text-gray-400 block mt-0.5">fecha vencida</span>
            </div>
          </div>

          {/* 1. Proyectos activos que necesitan acción */}
          <div className="p-5 rounded-2xl bg-[#161622] border border-[#252538] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-blue-400" />
                <span>Proyectos Activos que Requieren Próxima Acción ({projectsNeedingAttention.length})</span>
              </h4>
            </div>

            {projectsNeedingAttention.length === 0 ? (
              <p className="text-xs text-gray-500 italic p-3 rounded-xl bg-[#13131c]">
                ¡Excelente! Todos tus proyectos activos tienen tareas pendientes o una próxima acción definida.
              </p>
            ) : (
              <div className="space-y-2">
                {projectsNeedingAttention.map(p => (
                  <div
                    key={p.id}
                    onClick={() => onOpenProject && onOpenProject(p)}
                    className="p-3 bg-[#13131c] rounded-xl border border-[#222230] hover:border-blue-500/40 cursor-pointer transition flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-white block">{p.title}</span>
                      <span className="text-[10px] text-amber-400 font-mono">Sin tareas pendientes activas</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Áreas por revisar */}
          <div className="p-5 rounded-2xl bg-[#161622] border border-[#252538] space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Áreas que Requieren Revisión ({areasNeedingReview.length})</span>
            </h4>

            {areasNeedingReview.length === 0 ? (
              <p className="text-xs text-gray-500 italic p-3 rounded-xl bg-[#13131c]">
                Todas tus áreas de responsabilidad están al día en sus revisiones periódicas.
              </p>
            ) : (
              <div className="space-y-2">
                {areasNeedingReview.map(a => (
                  <div
                    key={a.id}
                    onClick={() => onOpenArea && onOpenArea(a)}
                    className="p-3 bg-[#13131c] rounded-xl border border-[#222230] hover:border-purple-500/40 cursor-pointer transition flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-white block">{a.title}</span>
                      <span className="text-[10px] text-gray-400">
                        Última revisión: {a.last_reviewed_at ? new Date(a.last_reviewed_at).toLocaleDateString() : 'Nunca'}
                      </span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Tareas vencidas */}
          <div className="p-5 rounded-2xl bg-[#161622] border border-[#252538] space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>Tareas con Fecha Vencida ({overdueTasks.length})</span>
            </h4>

            {overdueTasks.length === 0 ? (
              <p className="text-xs text-gray-500 italic p-3 rounded-xl bg-[#13131c]">
                No tienes tareas pendientes atrasadas.
              </p>
            ) : (
              <div className="space-y-1.5">
                {overdueTasks.map(t => (
                  <div key={t.id} className="p-2.5 rounded-xl bg-[#13131c] border border-rose-950/40 text-xs flex items-center justify-between">
                    <span className="text-gray-200">{t.title}</span>
                    <span className="text-[10px] font-mono text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40">
                      {t.due_date}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
