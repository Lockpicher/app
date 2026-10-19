import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  Layers,
  Trash2,
  Loader2,
  Menu,
  Sun,
  Moon,
  Inbox,
  Mic,
  Send
} from 'lucide-react';
import { AppTask, AppNote, AppProject, TaskPriority } from '../lib/types';
import { useTheme } from '../lib/themeContext';

interface HomeViewProps {
  tasks: AppTask[];
  notes: AppNote[];
  projects: AppProject[];
  onToggleTaskComplete: (task: AppTask) => Promise<void>;
  onOpenTask: (task: AppTask) => void;
  onDeleteTask?: (taskId: string) => Promise<void>;
  onOpenNote: (note: AppNote) => void;
  onDeleteNote?: (noteId: string) => Promise<void>;
  onToggleFavoriteNote: (note: AppNote) => Promise<void>;
  onNewTask: () => void;
  onNewNote: () => void;
  onNavigateToView: (view: 'tasks' | 'all_notes' | 'favorites' | 'projects' | 'calendar' | 'para_inbox') => void;
  onOpenSearch: () => void;
  onOpenMobileMenu?: () => void;
  inboxCount?: number;
  onQuickCapture?: (type: 'note' | 'task', data: { title: string }) => Promise<void>;
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
  onDeleteTask,
  onOpenNote,
  onDeleteNote,
  onToggleFavoriteNote,
  onNewTask,
  onNewNote,
  onNavigateToView,
  onOpenSearch,
  onOpenMobileMenu,
  inboxCount = 0,
  onQuickCapture
}) => {
  const { theme, toggleTheme } = useTheme();
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  // Quick capture bar state
  const [captureText, setCaptureText] = useState('');
  const [captureType, setCaptureType] = useState<'note' | 'task'>('task');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Mobile top search bar scroll visibility (hide on scroll down, show on scroll up)
  const [showMobileSearch, setShowMobileSearch] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollYRef = useRef(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const currentY = e.currentTarget.scrollTop;
    const diff = currentY - lastScrollYRef.current;

    // Only react if scroll difference is significant (> 6px) to avoid jitter
    if (Math.abs(diff) > 6) {
      if (currentY <= 10) {
        setShowMobileSearch(true);
      } else if (diff > 0 && currentY > 50) {
        // Scrolling down
        setShowMobileSearch(false);
      } else if (diff < 0) {
        // Scrolling up
        setShowMobileSearch(true);
      }
      lastScrollYRef.current = currentY;
    }
  };

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

  // Formatted date string for header in true sentence case (e.g. "domingo, 18 de octubre")
  const formattedTodayHeader = useMemo(() => {
    const dateStr = now.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
    // Ensure lowercase sentence case
    return dateStr.toLowerCase();
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

  // Handler for deleting a task from Home
  const handleDeleteTask = async (e: React.MouseEvent, t: AppTask) => {
    e.stopPropagation();
    if (!onDeleteTask) return;
    if (!window.confirm(`¿Eliminar la tarea "${t.title}"?`)) return;

    try {
      setDeletingTaskId(t.id);
      await onDeleteTask(t.id);
    } catch (err: any) {
      alert('Error eliminando tarea: ' + (err.message || 'Error desconocido'));
    } finally {
      setDeletingTaskId(null);
    }
  };

  // Handler for deleting a note from Home
  const handleDeleteNote = async (e: React.MouseEvent, n: AppNote) => {
    e.stopPropagation();
    if (!onDeleteNote) return;
    if (!window.confirm(`¿Eliminar la nota "${n.title || 'Sin título'}"?`)) return;

    try {
      setDeletingNoteId(n.id);
      await onDeleteNote(n.id);
    } catch (err: any) {
      alert('Error eliminando nota: ' + (err.message || 'Error desconocido'));
    } finally {
      setDeletingNoteId(null);
    }
  };

  // Quick capture submit handler
  const handleQuickCaptureSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = captureText.trim();
    if (!trimmed || !onQuickCapture) return;

    try {
      setIsCapturing(true);
      await onQuickCapture(captureType, { title: trimmed });
      setCaptureText('');
    } catch (err: any) {
      alert('Error al capturar: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsCapturing(false);
    }
  };

  // Web Speech API voice capture handler
  const handleToggleVoiceCapture = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz nativo.');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setCaptureText(prev => prev ? `${prev} ${transcript}` : transcript);
        }
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch (err) {
      setIsRecording(false);
    }
  };

  // Helper for human-friendly short relative date format ("Hoy", "Ayer", "16 oct")
  const formatShortDate = (dateIso: string) => {
    const d = new Date(dateIso);
    const dStr = getLocalDateString(d);
    if (dStr === todayStr) return 'Hoy';
    if (dStr === tomorrowStr) return 'Mañana';
    
    // Check yesterday
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    if (dStr === getLocalDateString(y)) return 'Ayer';

    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 flex flex-col h-full bg-[#111116] overflow-y-auto text-gray-100 select-none pb-8"
      style={{
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))'
      }}
    >
      {/* ==================================================== */}
      {/* 1A. MOBILE FIXED TOP SEARCH BAR (Width: full, 44px,   */}
      {/* auto-hides on scroll down, appears on scroll up)      */}
      {/* ==================================================== */}
      <div 
        className={`lg:hidden sticky top-0 z-30 px-3 pt-2 pb-1.5 bg-[#111116]/95 backdrop-blur-md transition-transform duration-200 ${
          showMobileSearch ? 'translate-y-0' : '-translate-y-full'
        }`}
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)'
        }}
      >
        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full h-11 px-3.5 bg-[#1a1a24] hover:bg-[#20202c] active:bg-[#252535] border border-[#2b2b3a] rounded-xl flex items-center gap-2.5 text-gray-400 text-sm shadow-sm transition"
          aria-label="Buscar en todo"
        >
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="flex-1 text-left truncate text-gray-400 font-normal">Buscar en todo</span>
        </button>
      </div>

      {/* ==================================================== */}
      {/* 1B. DESKTOP-ONLY HEADER (Identical to before)        */}
      {/* ==================================================== */}
      <header className="hidden lg:block px-6 lg:px-8 py-3.5 border-b border-[#23232f] bg-[#14141c] sticky top-0 z-20 backdrop-blur-md bg-opacity-95">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-400">
                <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{greeting}</span>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight mt-0.5 truncate">
                Inicio
              </h1>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {formattedTodayHeader}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Search Icon (Ctrl + K) */}
            <button
              type="button"
              onClick={onOpenSearch}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#20202a] transition"
              title="Buscar (Ctrl + K)"
              aria-label="Buscar"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#20202a] transition"
              title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              aria-label="Alternar tema claro u oscuro"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-400" />
              )}
            </button>

            {/* Desktop-only single creation button */}
            <button
              type="button"
              onClick={onNewNote}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-900/30 transition active:scale-95 ml-1"
              title="Crear elemento (Atajo: N)"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Nuevo</span>
              <kbd className="text-[10px] bg-blue-700 px-1.5 py-0.2 rounded font-mono font-normal">N</kbd>
            </button>
          </div>
        </div>
      </header>

      {/* ==================================================== */}
      {/* 2. MAIN WORKSPACE: BALANCED 2-COLUMN LAYOUT          */}
      {/* ==================================================== */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">

        {/* ==================================================== */}
        {/* MOBILE IN-CONTENT LARGE HEADER (Greeting & Date only)*/}
        {/* Does not repeat "Inicio" and scrolls with page        */}
        {/* ==================================================== */}
        <div className="lg:hidden pt-1 pb-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-blue-400">
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{greeting}</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mt-1 capitalize">
            {formattedTodayHeader}
          </h2>
        </div>

        {/* ==================================================== */}
        {/* BARRA DE CAPTURA RÁPIDA (Full width input + Chips)  */}
        {/* ==================================================== */}
        <section className="bg-[#161620] border border-[#232332] rounded-2xl p-3 sm:p-3.5 shadow-sm space-y-2.5">
          <form onSubmit={handleQuickCaptureSubmit} className="space-y-2.5">
            {/* Campo a ancho completo con micrófono y enviar dentro */}
            <div className="relative flex items-center bg-[#1c1c28] border border-[#2e2e40] focus-within:border-blue-500/60 rounded-xl px-3 py-2 transition">
              <input
                type="text"
                value={captureText}
                onChange={(e) => setCaptureText(e.target.value)}
                placeholder={captureType === 'task' ? 'Capturar tarea rápida...' : 'Capturar idea o nota rápida...'}
                disabled={isCapturing}
                className="w-full bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none pr-16"
              />

              {/* Botones internos de acción: Dictado por voz y Enviar */}
              <div className="absolute right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleToggleVoiceCapture}
                  className={`p-1.5 rounded-lg transition ${
                    isRecording 
                      ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse' 
                      : 'text-gray-400 hover:text-white hover:bg-[#28283a]'
                  }`}
                  title={isRecording ? 'Detener dictado' : 'Dictar por voz'}
                  aria-label="Dictado por voz"
                >
                  <Mic className="w-4 h-4" />
                </button>

                <button
                  type="submit"
                  disabled={isCapturing || !captureText.trim()}
                  className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 text-white transition active:scale-95"
                  title="Capturar"
                  aria-label="Guardar captura"
                >
                  {isCapturing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Selector Tarea / Nota como chips pequeños debajo */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setCaptureType('task')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  captureType === 'task'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[#1c1c28] text-gray-400 hover:text-gray-200 border border-[#2b2b3a]'
                }`}
              >
                Tarea
              </button>
              <button
                type="button"
                onClick={() => setCaptureType('note')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  captureType === 'note'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[#1c1c28] text-gray-400 hover:text-gray-200 border border-[#2b2b3a]'
                }`}
              >
                Nota
              </button>
            </div>
          </form>
        </section>

        {/* ==================================================== */}
        {/* BANNER INBOX ACCIONABLE (Si hay pendientes)          */}
        {/* ==================================================== */}
        {inboxCount > 0 && (
          <div 
            onClick={() => onNavigateToView('para_inbox')}
            className="group flex items-center justify-between px-4 py-3 rounded-2xl bg-blue-950/30 hover:bg-blue-950/50 border border-blue-900/40 hover:border-blue-700/60 cursor-pointer transition min-h-[48px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Inbox className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <p className="text-sm text-gray-300 group-hover:text-white transition truncate">
                Tienes <span className="font-bold text-blue-400">{inboxCount}</span> {inboxCount === 1 ? 'elemento' : 'elementos'} en tu Inbox por procesar
              </p>
            </div>
            <div className="flex items-center gap-1 text-sm font-semibold text-blue-400 group-hover:text-blue-300 flex-shrink-0">
              <span>Procesar</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* 2-COLUMN BALANCED GRID (5 / 7 proportions)           */}
        {/* ==================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ==================================================== */}
          {/* COLUMNA 1: AGENDA UNIFICADA (Hoy, Mañana, Semana)    */}
          {/* ==================================================== */}
          <div className="lg:col-span-5 space-y-6">

            {/* Tareas Atrasadas (si existen) */}
            {overdueTasks.length > 0 && (
              <section className="bg-red-950/20 border border-red-900/40 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-red-400">
                      Tareas atrasadas ({overdueTasks.length})
                    </h2>
                  </div>
                  <span className="text-xs text-red-400/80">Requieren atención</span>
                </div>

                <div className="divide-y divide-red-950/60">
                  {overdueTasks.map(t => {
                    const project = t.project_id ? projectsMap.get(t.project_id) : null;
                    const dateStr = getTaskDateKey(t);

                    return (
                      <div
                        key={t.id}
                        onClick={() => onOpenTask(t)}
                        className="group flex items-center justify-between py-2.5 cursor-pointer transition hover:bg-red-950/20 px-2 rounded-xl"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            disabled={completingTaskId === t.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleComplete(t);
                            }}
                            className="text-gray-500 hover:text-emerald-400 transition flex-shrink-0 p-1"
                            title="Marcar como completada"
                          >
                            <Circle className="w-4 h-4" />
                          </button>
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-gray-200 group-hover:text-white transition block truncate">
                              {t.title}
                            </span>
                            <div className="flex items-center gap-2 text-xs text-red-400 mt-0.5">
                              <span>Venció: {dateStr}</span>
                              {project && (
                                <span className="text-gray-400 truncate hidden sm:inline">
                                  • {project.title}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          {onDeleteTask && (
                            <button
                              type="button"
                              disabled={deletingTaskId === t.id}
                              onClick={(e) => handleDeleteTask(e, t)}
                              className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-950/40 opacity-0 group-hover:opacity-100 transition"
                              title="Eliminar tarea"
                            >
                              {deletingTaskId === t.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* TARJETA UNIFICADA: AGENDA (Hoy, Mañana, Esta semana) */}
            <section className="bg-[#161620] border border-[#232332] rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#232332]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    Agenda
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateToView('tasks')}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                >
                  <span>Ver todas</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Sub-sección 1: Hoy (Sentence case, sin puntos de color, ocultar contador si es 0) */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-gray-300">
                      Hoy
                    </h3>
                    {todayTasks.length > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 font-mono">
                        {todayTasks.length}
                      </span>
                    )}
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
                  <p className="text-sm text-gray-500 py-2.5 pl-3 border-l-2 border-[#272738]">
                    Sin tareas para hoy.{' '}
                    <button
                      type="button"
                      onClick={onNewTask}
                      className="text-blue-400 hover:underline font-medium"
                    >
                      Crea la primera
                    </button>
                  </p>
                ) : (
                  <div className="divide-y divide-[#232332]">
                    {todayTasks.map(t => {
                      const project = t.project_id ? projectsMap.get(t.project_id) : null;

                      return (
                        <div
                          key={t.id}
                          onClick={() => onOpenTask(t)}
                          className="group flex items-center justify-between py-2.5 cursor-pointer transition hover:bg-[#1a1a26] px-2 rounded-xl"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <button
                              type="button"
                              disabled={completingTaskId === t.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleComplete(t);
                              }}
                              className="text-gray-500 hover:text-emerald-400 transition flex-shrink-0 p-1"
                              title="Completar tarea"
                            >
                              <Circle className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-medium text-gray-200 group-hover:text-white transition truncate">
                              {t.title}
                            </span>
                            {project && (
                              <span className="text-xs text-gray-500 truncate hidden sm:inline">
                                • {project.title}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            {onDeleteTask && (
                              <button
                                type="button"
                                disabled={deletingTaskId === t.id}
                                onClick={(e) => handleDeleteTask(e, t)}
                                className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-950/40 opacity-0 group-hover:opacity-100 transition"
                                title="Eliminar tarea"
                              >
                                {deletingTaskId === t.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sub-sección 2: Mañana (Sentence case, sin puntos, ocultar contador si es 0) */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-gray-300">
                      Mañana
                    </h3>
                    {tomorrowTasks.length > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 font-mono">
                        {tomorrowTasks.length}
                      </span>
                    )}
                  </div>
                </div>

                {tomorrowTasks.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2.5 pl-3 border-l-2 border-[#272738]">
                    Sin tareas para mañana.
                  </p>
                ) : (
                  <div className="divide-y divide-[#232332]">
                    {tomorrowTasks.map(t => {
                      const project = t.project_id ? projectsMap.get(t.project_id) : null;

                      return (
                        <div
                          key={t.id}
                          onClick={() => onOpenTask(t)}
                          className="group flex items-center justify-between py-2.5 cursor-pointer transition hover:bg-[#1a1a26] px-2 rounded-xl"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleComplete(t);
                              }}
                              className="text-gray-500 hover:text-emerald-400 transition flex-shrink-0 p-1"
                            >
                              <Circle className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-medium text-gray-300 group-hover:text-white transition truncate">
                              {t.title}
                            </span>
                            {project && (
                              <span className="text-xs text-gray-500 truncate hidden sm:inline">
                                • {project.title}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            {onDeleteTask && (
                              <button
                                type="button"
                                disabled={deletingTaskId === t.id}
                                onClick={(e) => handleDeleteTask(e, t)}
                                className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-950/40 opacity-0 group-hover:opacity-100 transition"
                                title="Eliminar tarea"
                              >
                                {deletingTaskId === t.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sub-sección 3: Esta semana (Sentence case, sin puntos) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-300">
                    Esta semana
                  </h3>
                </div>

                {weekGroupedTasks.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2.5 pl-3 border-l-2 border-[#272738]">
                    Sin tareas programadas para el resto de la semana.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {weekGroupedTasks.map(group => (
                      <div key={group.dateStr} className="space-y-1">
                        <div className="text-xs font-medium text-blue-400 capitalize flex items-center gap-1.5 pl-1">
                          <span>{group.dayName}</span>
                          <span className="text-gray-500">({group.dayNumber})</span>
                        </div>

                        <div className="divide-y divide-[#232332] pl-2 border-l border-[#272738]">
                          {group.tasks.map(t => {
                            const project = t.project_id ? projectsMap.get(t.project_id) : null;

                            return (
                              <div
                                key={t.id}
                                onClick={() => onOpenTask(t)}
                                className="group flex items-center justify-between py-2 cursor-pointer transition hover:bg-[#1a1a26] px-2 rounded-xl"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleComplete(t);
                                    }}
                                    className="text-gray-500 hover:text-emerald-400 transition flex-shrink-0 p-1"
                                  >
                                    <Circle className="w-4 h-4" />
                                  </button>
                                  <span className="text-sm text-gray-300 group-hover:text-white transition truncate">
                                    {t.title}
                                  </span>
                                  {project && (
                                    <span className="text-xs text-gray-500 truncate hidden sm:inline">
                                      • {project.title}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                  {onDeleteTask && (
                                    <button
                                      type="button"
                                      disabled={deletingTaskId === t.id}
                                      onClick={(e) => handleDeleteTask(e, t)}
                                      className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-950/40 opacity-0 group-hover:opacity-100 transition"
                                      title="Eliminar tarea"
                                    >
                                      {deletingTaskId === t.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                                      ) : (
                                        <Trash2 className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </section>

          </div>

          {/* ==================================================== */}
          {/* COLUMNA 2: NOTAS RECIENTES (Flat List >= 56px)       */}
          {/* ==================================================== */}
          <div className="lg:col-span-7 space-y-6">

            {/* SECCIÓN: NOTAS RECIENTES (Filas de al menos 56px, sin tarjetas anidadas) */}
            <section className="bg-[#161620] border border-[#232332] rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-1 border-b border-[#232332]">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    Notas recientes
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onNewNote}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nueva</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateToView('all_notes')}
                    className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-0.5 transition"
                  >
                    <span>Ver todas</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {recentNotes.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  <p className="font-medium text-gray-300">Sin notas aún</p>
                  <button
                    type="button"
                    onClick={onNewNote}
                    className="mt-2 text-purple-400 hover:underline font-medium text-sm"
                  >
                    Crea la primera nota
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#232332]">
                  {recentNotes.map(n => {
                    const shortDate = formatShortDate(n.updated_at);
                    // Extract first non-empty line of content if title is missing
                    const firstContentLine = n.plain_text?.split('\n').find(l => l.trim().length > 0)?.trim();
                    const titleText = (n.title && n.title.trim().length > 0 && n.title !== 'Nueva Nota')
                      ? n.title.trim() 
                      : (firstContentLine || n.plain_text?.slice(0, 45)?.trim() || 'Nota sin título');

                    return (
                      <div
                        key={n.id}
                        onClick={() => onOpenNote(n)}
                        className="group flex items-center justify-between min-h-[56px] py-2.5 px-2 hover:bg-[#1a1a26] rounded-xl transition cursor-pointer gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <h3 className="text-sm font-medium text-gray-200 group-hover:text-white transition truncate">
                              {titleText}
                            </h3>
                            {/* Short date: standard typography, non-monospace */}
                            <span className="text-xs text-gray-400 font-normal flex-shrink-0">
                              {shortDate}
                            </span>
                          </div>

                          {n.plain_text && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">
                              {n.plain_text}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Favorite star */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavoriteNote(n);
                            }}
                            className={`p-1.5 rounded-lg transition ${
                              n.is_favorite 
                                ? 'text-amber-400 hover:text-amber-300' 
                                : 'text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100'
                            }`}
                            title={n.is_favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                          >
                            <Star className={`w-4 h-4 ${n.is_favorite ? 'fill-amber-400' : ''}`} />
                          </button>

                          {/* Delete note button */}
                          {onDeleteNote && (
                            <button
                              type="button"
                              disabled={deletingNoteId === n.id}
                              onClick={(e) => handleDeleteNote(e, n)}
                              className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-950/40 opacity-0 group-hover:opacity-100 transition"
                              title="Eliminar nota"
                            >
                              {deletingNoteId === n.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* SECCIÓN: FAVORITOS (SOLO si hay favoritos per Rule 6) */}
            {favoriteNotes.length > 0 && (
              <section className="bg-[#161620] border border-[#232332] rounded-xl p-4 sm:p-5 shadow-sm">
                <div className="flex items-center justify-between pb-3 mb-1 border-b border-[#232332]">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400/30" />
                    <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                      <span>Favoritos</span>
                      <span className="text-xs px-2 py-0.2 rounded-full bg-amber-950 text-amber-400 font-mono">
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

                <div className="divide-y divide-[#232332]">
                  {favoriteNotes.map(n => (
                    <div
                      key={n.id}
                      onClick={() => onOpenNote(n)}
                      className="group flex items-center justify-between py-2 px-2 hover:bg-[#1a1a26] rounded transition cursor-pointer gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-200 group-hover:text-white transition truncate">
                          {n.title || 'Nota sin título'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
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

                        {onDeleteNote && (
                          <button
                            type="button"
                            disabled={deletingNoteId === n.id}
                            onClick={(e) => handleDeleteNote(e, n)}
                            className="p-1 text-gray-500 hover:text-red-400 rounded hover:bg-red-950/40 opacity-0 group-hover:opacity-100 transition"
                            title="Eliminar nota"
                          >
                            {deletingNoteId === n.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>

        </div>
      </main>
    </div>
  );
};
