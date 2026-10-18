import React, { useMemo, useState } from 'react';
import { 
  CheckSquare, 
  Calendar, 
  Clock, 
  Plus, 
  Star, 
  FileText, 
  FolderKanban, 
  ChevronRight, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Circle, 
  ArrowRight,
  Flame,
  Search,
  Book,
  Boxes,
  ExternalLink,
  Layers
} from 'lucide-react';
import { AppTask, AppNote, AppProject, TaskPriority } from '../lib/types';

interface HomeViewProps {
  tasks: AppTask[];
  notes: AppNote[];
  projects: AppProject[];
  onToggleTaskComplete: (task: AppTask) => Promise<void>;
  onOpenTask: (task: AppTask) => void;
  onOpenNote: (note: AppNote) => void;
  onToggleFavoriteNote: (note: AppNote) => Promise<void>;
  onNewTask: () => void;
  onNewNote: () => void;
  onNavigateToView: (view: 'tasks' | 'all_notes' | 'favorites' | 'projects' | 'calendar') => void;
  onOpenSearch: () => void;
}

// Format local date YYYY-MM-DD
function getLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Extract task scheduled/due date string (YYYY-MM-DD)
function getTaskDateKey(task: AppTask): string | null {
  if (task.scheduled_date) {
    return task.scheduled_date.split('T')[0];
  }
  if (task.due_date) {
    return task.due_date.split('T')[0];
  }
  return null;
}

const PRIORITY_BADGES: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  urgent: { label: 'Urgente', color: 'text-red-400', bg: 'bg-red-950/60 border-red-800/50' },
  high: { label: 'Alta', color: 'text-amber-400', bg: 'bg-amber-950/60 border-amber-800/50' },
  medium: { label: 'Media', color: 'text-blue-400', bg: 'bg-blue-950/60 border-blue-800/50' },
  low: { label: 'Baja', color: 'text-gray-400', bg: 'bg-gray-800/60 border-gray-700/50' }
};

const DAY_NAMES_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const HomeView: React.FC<HomeViewProps> = ({
  tasks,
  notes,
  projects,
  onToggleTaskComplete,
  onOpenTask,
  onOpenNote,
  onToggleFavoriteNote,
  onNewTask,
  onNewNote,
  onNavigateToView,
  onOpenSearch
}) => {
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  // Projects lookup map for fast title & color resolution
  const projectsMap = useMemo(() => {
    const map = new Map<string, AppProject>();
    projects.forEach(p => map.set(p.id, p));
    return map;
  }, [projects]);

  // Current dates in local time
  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => getLocalDateString(now), [now]);

  const tomorrowDate = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }, [now]);
  const tomorrowStr = useMemo(() => getLocalDateString(tomorrowDate), [tomorrowDate]);

  // Current week boundary: Monday to Sunday of the current week
  const weekDays = useMemo(() => {
    const currentDayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday
    // Distance to Monday
    const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);

    const days: { date: Date; dateStr: string; dayName: string; dayNumber: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const str = getLocalDateString(d);
      days.push({
        date: d,
        dateStr: str,
        dayName: DAY_NAMES_ES[d.getDay()],
        dayNumber: d.getDate()
      });
    }
    return days;
  }, [now]);

  // Dynamic greeting based on current local hour
  const greeting = useMemo(() => {
    const hour = now.getHours();
    if (hour >= 5 && hour < 12) return 'Buenos días';
    if (hour >= 12 && hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }, [now]);

  // Formatted date string for header
  const formattedTodayHeader = useMemo(() => {
    return now.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, [now]);

  // Categorize Tasks into: Overdue, Today, Tomorrow, Rest of Current Week
  const { overdueTasks, todayTasks, tomorrowTasks, weekGroupedTasks } = useMemo(() => {
    const overdue: AppTask[] = [];
    const today: AppTask[] = [];
    const tomorrow: AppTask[] = [];
    const weekMap = new Map<string, AppTask[]>();

    // Initialize map for days of the current week that are strictly AFTER tomorrow
    weekDays.forEach(wd => {
      if (wd.dateStr > tomorrowStr) {
        weekMap.set(wd.dateStr, []);
      }
    });

    tasks.forEach(t => {
      if (t.status === 'completed' || t.status === 'cancelled') return;

      const dateKey = getTaskDateKey(t);
      if (!dateKey) return; // Unscheduled tasks are kept in global backlog, not dated buckets

      if (dateKey < todayStr) {
        overdue.push(t);
      } else if (dateKey === todayStr) {
        today.push(t);
      } else if (dateKey === tomorrowStr) {
        tomorrow.push(t);
      } else if (weekMap.has(dateKey)) {
        weekMap.get(dateKey)!.push(t);
      }
    });

    // Sort overdue by oldest first (highest urgency)
    overdue.sort((a, b) => (getTaskDateKey(a) || '').localeCompare(getTaskDateKey(b) || ''));

    // Convert weekMap to array of days containing at least 1 task
    const weekGrouped = weekDays
      .filter(wd => wd.dateStr > tomorrowStr)
      .map(wd => ({
        ...wd,
        tasks: weekMap.get(wd.dateStr) || []
      }))
      .filter(g => g.tasks.length > 0);

    return {
      overdueTasks: overdue,
      todayTasks: today,
      tomorrowTasks: tomorrow,
      weekGroupedTasks: weekGrouped
    };
  }, [tasks, todayStr, tomorrowStr, weekDays]);

  // Recent notes sorted by updated_at descending (limit 5)
  const recentNotes = useMemo(() => {
    return [...notes]
      .filter(n => !n.is_archived)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 6);
  }, [notes]);

  // Favorite notes
  const favoriteNotes = useMemo(() => {
    return notes.filter(n => n.is_favorite && !n.is_archived);
  }, [notes]);

  // Handler for completing a task with debounce visual feedback
  const handleComplete = async (t: AppTask) => {
    try {
      setCompletingTaskId(t.id);
      await onToggleTaskComplete(t);
    } finally {
      setCompletingTaskId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#111116] overflow-y-auto text-gray-100 select-none pb-16 lg:pb-8">
      {/* ==================================================== */}
      {/* 1. HEADER (Compact, Responsive & Productive)          */}
      {/* ==================================================== */}
      <header className="px-5 lg:px-8 py-5 border-b border-[#23232f] bg-[#14141c] sticky top-0 z-20 backdrop-blur-md bg-opacity-90">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{greeting}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight capitalize mt-0.5">
              Inicio
            </h1>
            <p className="text-xs text-gray-400 capitalize mt-0.5">
              {formattedTodayHeader}
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onOpenSearch}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1c1c26] hover:bg-[#252535] text-gray-300 hover:text-white border border-[#2b2b3a] text-xs font-medium transition"
              title="Buscar en Segundo Cerebro (Ctrl + K)"
            >
              <Search className="w-3.5 h-3.5 text-gray-400" />
              <span className="hidden sm:inline">Buscar</span>
            </button>

            <button
              type="button"
              onClick={onNewNote}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm shadow-purple-900/40 transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Nueva nota</span>
            </button>

            <button
              type="button"
              onClick={onNewTask}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm shadow-emerald-900/40 transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Nueva tarea</span>
            </button>
          </div>
        </div>
      </header>

      {/* ==================================================== */}
      {/* 2. MAIN WORKSPACE: 2-COLUMN BALANCED LAYOUT          */}
      {/* ==================================================== */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ==================================================== */}
          {/* LEFT / PRIMARY COLUMN: AGENDA & TASKS (7 Cols)        */}
          {/* ==================================================== */}
          <div className="lg:col-span-7 space-y-6">

            {/* Overdue Tasks Alert (if any) */}
            {overdueTasks.length > 0 && (
              <section className="bg-red-950/20 border border-red-900/40 rounded-xl p-4 shadow-sm animate-fadeIn">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-red-400">
                      Tareas Atrasadas ({overdueTasks.length})
                    </h2>
                  </div>
                  <span className="text-[10px] text-red-400/80 font-mono">Requieren atención</span>
                </div>

                <div className="space-y-2">
                  {overdueTasks.map(t => {
                    const project = t.project_id ? projectsMap.get(t.project_id) : null;
                    const priorityCfg = PRIORITY_BADGES[t.priority] || PRIORITY_BADGES.medium;
                    const dateStr = getTaskDateKey(t);

                    return (
                      <div
                        key={t.id}
                        onClick={() => onOpenTask(t)}
                        className="group flex items-center justify-between p-2.5 rounded-lg bg-[#16161f] border border-red-950/80 hover:border-red-500/40 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            disabled={completingTaskId === t.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleComplete(t);
                            }}
                            className="text-gray-500 hover:text-emerald-400 transition flex-shrink-0"
                            title="Marcar como completada"
                          >
                            <Circle className="w-4 h-4 hover:fill-emerald-500/20" />
                          </button>
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-gray-200 group-hover:text-white transition block truncate">
                              {t.title}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-red-400 mt-0.5">
                              <span className="font-mono">Venció: {dateStr}</span>
                              {project && (
                                <span className="text-gray-400 flex items-center gap-1 truncate">
                                  <span>•</span>
                                  <FolderKanban className="w-3 h-3 text-blue-400" />
                                  <span className="truncate">{project.title}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ml-2 flex-shrink-0 ${priorityCfg.bg} ${priorityCfg.color}`}>
                          {priorityCfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* SECCIÓN B: Tareas para Hoy */}
            <section className="bg-[#161620] border border-[#232332] rounded-xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#232332]">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></div>
                  <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                    <span>Tareas para hoy</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-400 border border-blue-800/40 font-mono">
                      {todayTasks.length}
                    </span>
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={onNewTask}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                >
                  <Plus className="w-3 h-3" />
                  <span>Añadir</span>
                </button>
              </div>

              {todayTasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400 flex flex-col items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400/40 mb-2" />
                  <p className="font-medium text-gray-300">No tienes tareas pendientes para hoy</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">¡Estás al día con tus compromisos!</p>
                  <button
                    type="button"
                    onClick={onNewTask}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-[#20202e] hover:bg-[#28283c] text-blue-300 text-xs font-medium border border-blue-500/20 transition"
                  >
                    + Programar tarea para hoy
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayTasks.map(t => {
                    const project = t.project_id ? projectsMap.get(t.project_id) : null;
                    const priorityCfg = PRIORITY_BADGES[t.priority] || PRIORITY_BADGES.medium;

                    return (
                      <div
                        key={t.id}
                        onClick={() => onOpenTask(t)}
                        className="group flex items-center justify-between p-3 rounded-lg bg-[#1a1a24] border border-[#272738] hover:border-blue-500/40 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            disabled={completingTaskId === t.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleComplete(t);
                            }}
                            className="text-gray-400 hover:text-emerald-400 transition flex-shrink-0"
                            title="Completar tarea"
                          >
                            <Circle className="w-4 h-4 hover:fill-emerald-500/20" />
                          </button>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-gray-200 group-hover:text-white transition block truncate">
                              {t.title}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5 flex-wrap">
                              {project && (
                                <span className="flex items-center gap-1 text-blue-400 truncate">
                                  <FolderKanban className="w-3 h-3" />
                                  <span className="truncate">{project.title}</span>
                                </span>
                              )}
                              {t.description && (
                                <span className="text-gray-500 text-[10px] truncate max-w-[200px]">
                                  {t.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${priorityCfg.bg} ${priorityCfg.color}`}>
                            {priorityCfg.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* SECCIÓN C: Tareas para Mañana */}
            <section className="bg-[#161620] border border-[#232332] rounded-xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#232332]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                    <span>Tareas para mañana</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-400 border border-purple-800/40 font-mono">
                      {tomorrowTasks.length}
                    </span>
                  </h2>
                </div>
                <span className="text-[11px] text-gray-500 capitalize">
                  {tomorrowDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              </div>

              {tomorrowTasks.length === 0 ? (
                <div className="py-5 text-center text-xs text-gray-500">
                  No hay tareas programadas para mañana.
                </div>
              ) : (
                <div className="space-y-2">
                  {tomorrowTasks.map(t => {
                    const project = t.project_id ? projectsMap.get(t.project_id) : null;
                    const priorityCfg = PRIORITY_BADGES[t.priority] || PRIORITY_BADGES.medium;

                    return (
                      <div
                        key={t.id}
                        onClick={() => onOpenTask(t)}
                        className="group flex items-center justify-between p-2.5 rounded-lg bg-[#1a1a24] border border-[#272738] hover:border-purple-500/40 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleComplete(t);
                            }}
                            className="text-gray-500 hover:text-emerald-400 transition flex-shrink-0"
                            title="Completar tarea"
                          >
                            <Circle className="w-3.5 h-3.5" />
                          </button>
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-gray-300 group-hover:text-white transition block truncate">
                              {t.title}
                            </span>
                            {project && (
                              <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                                <FolderKanban className="w-3 h-3 text-blue-400" />
                                <span className="truncate">{project.title}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ml-2 flex-shrink-0 ${priorityCfg.bg} ${priorityCfg.color}`}>
                          {priorityCfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* SECCIÓN D: Tareas de esta semana (días restantes) */}
            <section className="bg-[#161620] border border-[#232332] rounded-xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#232332]">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    Resto de esta semana
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateToView('tasks')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
                >
                  <span>Ver todas las tareas</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {weekGroupedTasks.length === 0 ? (
                <div className="py-5 text-center text-xs text-gray-500">
                  No tienes más tareas programadas para los días restantes de la semana.
                </div>
              ) : (
                <div className="space-y-4">
                  {weekGroupedTasks.map(group => (
                    <div key={group.dateStr} className="space-y-1.5">
                      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <span className="text-cyan-400">{group.dayName}</span>
                        <span className="text-gray-500">({group.dayNumber})</span>
                      </div>

                      <div className="space-y-1.5 pl-2 border-l border-[#272738]">
                        {group.tasks.map(t => {
                          const project = t.project_id ? projectsMap.get(t.project_id) : null;
                          const priorityCfg = PRIORITY_BADGES[t.priority] || PRIORITY_BADGES.medium;

                          return (
                            <div
                              key={t.id}
                              onClick={() => onOpenTask(t)}
                              className="group flex items-center justify-between p-2 rounded-lg bg-[#181822] hover:bg-[#1f1f2d] border border-[#242434] cursor-pointer transition"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleComplete(t);
                                  }}
                                  className="text-gray-500 hover:text-emerald-400 transition flex-shrink-0"
                                >
                                  <Circle className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-xs text-gray-300 group-hover:text-white transition truncate">
                                  {t.title}
                                </span>
                                {project && (
                                  <span className="text-[10px] text-gray-500 truncate hidden sm:inline">
                                    • {project.title}
                                  </span>
                                )}
                              </div>

                              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ml-2 flex-shrink-0 ${priorityCfg.bg} ${priorityCfg.color}`}>
                                {priorityCfg.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>

          {/* ==================================================== */}
          {/* RIGHT COLUMN: KNOWLEDGE, NOTES & FAVORITES (5 Cols)   */}
          {/* ==================================================== */}
          <div className="lg:col-span-5 space-y-6">

            {/* SECCIÓN E: Notas Recientes */}
            <section className="bg-[#161620] border border-[#232332] rounded-xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#232332]">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    Notas recientes
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateToView('all_notes')}
                  className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition"
                >
                  <span>Ver todas</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {recentNotes.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-500">
                  Tus notas recientes aparecerán aquí.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentNotes.map(n => {
                    const updatedStr = new Date(n.updated_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short'
                    });

                    return (
                      <div
                        key={n.id}
                        onClick={() => onOpenNote(n)}
                        className="group p-3 rounded-lg bg-[#1a1a24] border border-[#272738] hover:border-purple-500/40 cursor-pointer transition flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                            <h3 className="text-xs font-semibold text-gray-200 group-hover:text-white transition truncate">
                              {n.title || 'Nota sin título'}
                            </h3>
                          </div>

                          {n.plain_text && (
                            <p className="text-[11px] text-gray-400 line-clamp-1 mt-1 pl-5">
                              {n.plain_text}
                            </p>
                          )}

                          <div className="flex items-center gap-2 text-[10px] text-gray-500 pl-5 mt-1.5 font-mono">
                            <span>Editado: {updatedStr}</span>
                            {n.category && (
                              <span className="text-gray-400 bg-[#222232] px-1.5 py-0.2 rounded font-sans">
                                {n.category}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Favorite star */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavoriteNote(n);
                          }}
                          className={`p-1 rounded transition flex-shrink-0 ${
                            n.is_favorite 
                              ? 'text-amber-400 hover:text-amber-300' 
                              : 'text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100'
                          }`}
                          title={n.is_favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                        >
                          <Star className={`w-3.5 h-3.5 ${n.is_favorite ? 'fill-amber-400' : ''}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* SECCIÓN F: Favoritos */}
            <section className="bg-[#161620] border border-[#232332] rounded-xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#232332]">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400/30" />
                  <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                    <span>Favoritos</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/40 font-mono">
                      {favoriteNotes.length}
                    </span>
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateToView('favorites')}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
                >
                  <span>Ver todos</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {favoriteNotes.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-500">
                  <Star className="w-6 h-6 text-gray-600 mx-auto mb-1.5" />
                  <p className="font-medium text-gray-400">Sin elementos favoritos</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Marca la estrella en tus notas para acceder a ellas rápidamente desde aquí.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {favoriteNotes.map(n => (
                    <div
                      key={n.id}
                      onClick={() => onOpenNote(n)}
                      className="group flex items-center justify-between p-2.5 rounded-lg bg-[#1a1a24] border border-[#272738] hover:border-amber-500/40 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-200 group-hover:text-white transition truncate">
                          {n.title || 'Nota sin título'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavoriteNote(n);
                        }}
                        className="text-amber-400 hover:text-gray-400 transition p-1"
                        title="Quitar de favoritos"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Quick Access to Key Modules banner */}
            <section className="bg-gradient-to-br from-indigo-950/40 to-purple-950/40 border border-indigo-800/30 rounded-xl p-4 shadow-sm">
              <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">
                Accesos directos
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onNavigateToView('calendar')}
                  className="p-2 rounded-lg bg-[#151522] hover:bg-[#1e1e30] border border-[#2b2b40] text-left transition flex items-center gap-2"
                >
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs text-gray-300 font-medium">Calendario</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateToView('projects')}
                  className="p-2 rounded-lg bg-[#151522] hover:bg-[#1e1e30] border border-[#2b2b40] text-left transition flex items-center gap-2"
                >
                  <FolderKanban className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-xs text-gray-300 font-medium">Proyectos</span>
                </button>
              </div>
            </section>

          </div>

        </div>
      </main>
    </div>
  );
};
