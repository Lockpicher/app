import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  CheckSquare, 
  Bell, 
  FileText, 
  FolderKanban, 
  CheckCircle2, 
  Circle, 
  Filter,
  X,
  Flame,
  AlertCircle,
  Sparkles,
  CalendarDays,
  List,
  Columns
} from 'lucide-react';
import { AppTask, AppNote, AppProject, AppReminder, TaskPriority, TaskStatus } from '../lib/types';
import { db } from '../lib/insforge';

type CalendarViewType = 'month' | 'week' | 'day' | 'agenda';

interface CalendarViewProps {
  tasks: AppTask[];
  notes: AppNote[];
  projects: AppProject[];
  reminders: AppReminder[];
  onUpdateTask: (id: string, updates: Partial<AppTask>) => Promise<void>;
  onCreateTask: (task: Partial<AppTask>) => Promise<AppTask | null>;
  onOpenNote?: (id: string) => void;
  onCreateNote?: (note: Partial<AppNote>) => Promise<void>;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  notes,
  projects,
  reminders,
  onUpdateTask,
  onCreateTask,
  onOpenNote,
  onCreateNote
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<CalendarViewType>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return 'agenda';
    }
    return 'month';
  });
  
  // Mobile Tray Drawer State
  const [isMobileTrayOpen, setIsMobileTrayOpen] = useState(false);

  // Filters
  const [showTasks, setShowTasks] = useState(true);
  const [showReminders, setShowReminders] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [showProjects, setShowProjects] = useState(true);

  // Drag & drop state
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'task' | 'reminder' | 'note' } | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  // Quick creation modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createInitialDate, setCreateInitialDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [createType, setCreateType] = useState<'task' | 'reminder' | 'note'>('task');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createTime, setCreateTime] = useState('09:00');
  const [createPriority, setCreatePriority] = useState<TaskPriority>('medium');
  const [createProjectId, setCreateProjectId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Feedback message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Month navigation helpers
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewType === 'month') next.setMonth(next.getMonth() - 1);
    else if (viewType === 'week') next.setDate(next.getDate() - 7);
    else if (viewType === 'day') next.setDate(next.getDate() - 1);
    else next.setMonth(next.getMonth() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewType === 'month') next.setMonth(next.getMonth() + 1);
    else if (viewType === 'week') next.setDate(next.getDate() + 7);
    else if (viewType === 'day') next.setDate(next.getDate() + 1);
    else next.setMonth(next.getMonth() + 1);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Format month and year label
  const monthYearLabel = useMemo(() => {
    const month = currentDate.toLocaleDateString('es-ES', { month: 'long' });
    const year = currentDate.getFullYear();
    return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
  }, [currentDate]);

  // Aggregate items by date (YYYY-MM-DD)
  const itemsByDate = useMemo(() => {
    const map = new Map<string, {
      tasks: AppTask[];
      reminders: AppReminder[];
      notes: AppNote[];
      projects: AppProject[];
    }>();

    const getBucket = (dateKey: string) => {
      if (!map.has(dateKey)) {
        map.set(dateKey, { tasks: [], reminders: [], notes: [], projects: [] });
      }
      return map.get(dateKey)!;
    };

    if (showTasks) {
      tasks.forEach(t => {
        const d = t.scheduled_date || (t.due_date ? t.due_date.split('T')[0] : null);
        if (d) {
          getBucket(d).tasks.push(t);
        }
      });
    }

    if (showReminders) {
      reminders.forEach(r => {
        if (r.remind_at) {
          const d = r.remind_at.split('T')[0];
          getBucket(d).reminders.push(r);
        }
      });
    }

    if (showNotes) {
      notes.forEach(n => {
        if (n.reminder_at) {
          const d = n.reminder_at.split('T')[0];
          getBucket(d).notes.push(n);
        }
      });
    }

    if (showProjects) {
      projects.forEach(p => {
        if (p.due_date) {
          const d = p.due_date.split('T')[0];
          getBucket(d).projects.push(p);
        }
      });
    }

    return map;
  }, [tasks, reminders, notes, projects, showTasks, showReminders, showNotes, showProjects]);

  // Unscheduled tasks (Bandeja de pendientes sin fecha)
  const unscheduledTasks = useMemo(() => {
    return tasks.filter(t => !t.scheduled_date && !t.due_date && t.status !== 'completed');
  }, [tasks]);

  // Month grid generation (standard Monday to Sunday)
  const monthGridDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Convert Sunday (0) to 6, Monday (1) to 0
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days = [];

    // Days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, d);
      days.push({
        date: prevDate,
        dateString: prevDate.toISOString().split('T')[0],
        isCurrentMonth: false,
        dayNumber: d
      });
    }

    // Days of current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const thisDate = new Date(year, month, d);
      days.push({
        date: thisDate,
        dateString: thisDate.toISOString().split('T')[0],
        isCurrentMonth: true,
        dayNumber: d
      });
    }

    // Days from next month to complete 35 or 42 cells (multiple of 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      days.push({
        date: nextDate,
        dateString: nextDate.toISOString().split('T')[0],
        isCurrentMonth: false,
        dayNumber: d
      });
    }

    return days;
  }, [currentDate]);

  // Week days generation
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    let dayOfWeek = curr.getDay() - 1;
    if (dayOfWeek === -1) dayOfWeek = 6;

    const startOfWeek = new Date(curr);
    startOfWeek.setDate(curr.getDate() - dayOfWeek);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push({
        date: d,
        dateString: d.toISOString().split('T')[0],
        dayNumber: d.getDate(),
        dayName: d.toLocaleDateString('es-ES', { weekday: 'short' })
      });
    }
    return days;
  }, [currentDate]);

  // Check if date is today
  const isToday = (dateString: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateString === today;
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string, type: 'task' | 'reminder' | 'note') => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id, type }));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem({ id, type });
  };

  const handleDragOver = (e: React.DragEvent, dateString: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDay !== dateString) {
      setDragOverDay(dateString);
    }
  };

  const handleDragLeave = (dateString: string) => {
    if (dragOverDay === dateString) {
      setDragOverDay(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDragOverDay(null);

    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;

    try {
      const { id, type } = JSON.parse(raw);
      if (type === 'task') {
        await onUpdateTask(id, { scheduled_date: targetDate });
        showToast(`Tarea reprogramada para el ${targetDate}`);
      } else if (type === 'reminder') {
        const iso = `${targetDate}T09:00:00.000Z`;
        await db.updateReminder(id, { remind_at: iso });
        showToast(`Recordatorio movido al ${targetDate}`);
      }
    } catch (err) {
      console.error('Error al procesar el elemento soltado:', err);
    } finally {
      setDraggedItem(null);
    }
  };

  // Quick creation submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) return;

    try {
      setIsSubmitting(true);
      if (createType === 'task') {
        await onCreateTask({
          title: createTitle.trim(),
          description: createDescription.trim() || undefined,
          scheduled_date: createInitialDate,
          priority: createPriority,
          status: 'todo',
          project_id: createProjectId || null
        });
        showToast('Tarea creada y programada con éxito');
      } else if (createType === 'reminder') {
        const timePart = createTime || '09:00';
        const isoDateTime = new Date(`${createInitialDate}T${timePart}:00`).toISOString();
        await db.createReminder({
          title: createTitle.trim(),
          description: createDescription.trim() || undefined,
          remind_at: isoDateTime,
          status: 'pending'
        });
        showToast('Recordatorio programado con éxito');
      } else if (createType === 'note' && onCreateNote) {
        await onCreateNote({
          title: createTitle.trim(),
          content: createDescription ? `<p>${createDescription}</p>` : '<p></p>',
          reminder_at: createInitialDate ? `${createInitialDate}T09:00:00.000Z` : undefined
        });
        showToast('Nota creada y fechada en calendario');
      }

      setIsCreateModalOpen(false);
      setCreateTitle('');
      setCreateDescription('');
    } catch (err: any) {
      alert('Error creando elemento: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#14141c] text-gray-200 select-none overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl shadow-xl shadow-blue-900/40 border border-blue-400 text-xs font-semibold animate-fadeIn">
          <Sparkles className="w-4 h-4 text-cyan-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Calendar Top Control Header */}
      <header className="px-4 py-3 bg-[#171722] border-b border-[#252535] flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        {/* Navigation & Month Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#1c1c28] p-1 rounded-xl border border-[#2c2c3e]">
            <button
              onClick={handlePrev}
              className="p-1.5 rounded-lg hover:bg-[#252538] text-gray-400 hover:text-white transition"
              title="Periodo anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition hover:bg-[#252538] rounded-md"
            >
              Hoy
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 rounded-lg hover:bg-[#252538] text-gray-400 hover:text-white transition"
              title="Periodo siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-base font-bold text-white tracking-wide">
            {monthYearLabel}
          </h2>
        </div>

        {/* View Selectors & Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Tabs */}
          <div className="flex items-center bg-[#1c1c28] p-1 rounded-xl border border-[#2c2c3e]">
            <button
              onClick={() => setViewType('month')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                viewType === 'month'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mes</span>
            </button>

            <button
              onClick={() => setViewType('week')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                viewType === 'week'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Semana</span>
            </button>

            <button
              onClick={() => setViewType('day')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                viewType === 'day'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Día</span>
            </button>

            <button
              onClick={() => setViewType('agenda')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition ${
                viewType === 'agenda'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Agenda</span>
            </button>
          </div>

          {/* Mobile Pendientes Toggle */}
          <button
            onClick={() => setIsMobileTrayOpen(!isMobileTrayOpen)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 bg-[#1e1e2c] hover:bg-[#252538] text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Pendientes ({unscheduledTasks.length})</span>
          </button>

          {/* Quick Create Button */}
          <button
            onClick={() => {
              setCreateInitialDate(new Date().toISOString().split('T')[0]);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-900/30 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Planificar</span>
          </button>
        </div>
      </header>

      {/* Main Calendar Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Tray Modal/Drawer */}
        {isMobileTrayOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end p-2">
            <div className="bg-[#181824] border border-[#2c2c3e] rounded-t-2xl max-h-[75vh] flex flex-col p-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#252538]">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  Tareas sin Fecha ({unscheduledTasks.length})
                </span>
                <button
                  onClick={() => setIsMobileTrayOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3 space-y-2">
                {unscheduledTasks.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">
                    Todas las tareas están fechadas.
                  </p>
                ) : (
                  unscheduledTasks.map(task => (
                    <div
                      key={task.id}
                      className="p-3 bg-[#13131c] rounded-xl border border-[#252538] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="overflow-hidden">
                        <p className="font-semibold text-gray-200 truncate">{task.title}</p>
                        <span className="text-[10px] text-gray-400 uppercase font-mono">{task.priority}</span>
                      </div>
                      <button
                        onClick={async () => {
                          const todayStr = new Date().toISOString().split('T')[0];
                          await onUpdateTask(task.id, { scheduled_date: todayStr });
                          showToast(`Tarea programada para hoy`);
                        }}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-semibold flex-shrink-0"
                      >
                        Agendar Hoy
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Left Desktop Pending Unscheduled Tray */}
        <div className="hidden lg:flex w-64 bg-[#121218] border-r border-[#222230] flex-col overflow-hidden">
          <div className="p-3 border-b border-[#222230] flex items-center justify-between">
            <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              Pendientes sin Fecha ({unscheduledTasks.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {unscheduledTasks.length === 0 ? (
              <p className="text-[11px] text-gray-500 text-center py-6">
                Todas las tareas están fechadas o completadas.
              </p>
            ) : (
              unscheduledTasks.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id, 'task')}
                  className="p-2.5 bg-[#181824] hover:bg-[#202030] rounded-xl border border-[#29293a] cursor-grab active:cursor-grabbing transition shadow-sm text-xs"
                >
                  <p className="font-semibold text-gray-200 truncate">{task.title}</p>
                  <div className="flex items-center justify-between mt-1.5 text-[10px] text-gray-400 font-mono">
                    <span className="text-amber-400">Arrastra al calendario</span>
                    <span className="uppercase">{task.priority}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Calendar View Container */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* MONTH VIEW */}
          {viewType === 'month' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Day Name Header Row */}
              <div className="grid grid-cols-7 border-b border-[#252535] bg-[#161622] text-center py-2 text-xs font-bold text-gray-400">
                <span>Lun</span>
                <span>Mar</span>
                <span>Mié</span>
                <span>Jue</span>
                <span>Vie</span>
                <span className="text-blue-400">Sáb</span>
                <span className="text-blue-400">Dom</span>
              </div>

              {/* Monthly Cells Grid */}
              <div className="flex-1 grid grid-cols-7 grid-rows-5 sm:grid-rows-6 gap-px bg-[#20202e] overflow-y-auto p-px">
                {monthGridDays.map((dayItem) => {
                  const dayItems = itemsByDate.get(dayItem.dateString);
                  const isCurrentDay = isToday(dayItem.dateString);
                  const isDragTarget = dragOverDay === dayItem.dateString;

                  const totalCount = 
                    (dayItems?.tasks.length || 0) + 
                    (dayItems?.reminders.length || 0) + 
                    (dayItems?.notes.length || 0) + 
                    (dayItems?.projects.length || 0);

                  return (
                    <div
                      key={dayItem.dateString}
                      onDragOver={(e) => handleDragOver(e, dayItem.dateString)}
                      onDragLeave={() => handleDragLeave(dayItem.dateString)}
                      onDrop={(e) => handleDrop(e, dayItem.dateString)}
                      onClick={() => {
                        setCreateInitialDate(dayItem.dateString);
                        setIsCreateModalOpen(true);
                      }}
                      className={`min-h-[85px] sm:min-h-[110px] p-1.5 sm:p-2 flex flex-col transition cursor-pointer select-none group relative ${
                        dayItem.isCurrentMonth ? 'bg-[#15151f]' : 'bg-[#111118] text-gray-600'
                      } ${isDragTarget ? 'ring-2 ring-blue-500 bg-blue-950/40' : 'hover:bg-[#191926]'}`}
                    >
                      {/* Cell Header: Day Number */}
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-mono font-semibold w-6 h-6 rounded-full flex items-center justify-center ${
                            isCurrentDay
                              ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-900/40'
                              : dayItem.isCurrentMonth
                              ? 'text-gray-300'
                              : 'text-gray-600'
                          }`}
                        >
                          {dayItem.dayNumber}
                        </span>

                        {totalCount > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#20202e] text-gray-400">
                            {totalCount}
                          </span>
                        )}
                      </div>

                      {/* Items List in Day Cell */}
                      <div className="flex-1 space-y-1 overflow-y-auto max-h-[85px] no-scrollbar">
                        {/* Tasks */}
                        {dayItems?.tasks.slice(0, 3).map(task => (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              handleDragStart(e, task.id, 'task');
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateTask(task.id, {
                                status: task.status === 'completed' ? 'todo' : 'completed'
                              });
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium truncate flex items-center gap-1 border transition ${
                              task.status === 'completed'
                                ? 'bg-[#1b1b26] text-gray-500 line-through border-[#282838]'
                                : task.priority === 'urgent'
                                ? 'bg-red-950/80 text-red-300 border-red-800/60'
                                : 'bg-blue-950/70 text-blue-300 border-blue-800/50 hover:border-blue-500'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${task.status === 'completed' ? 'bg-gray-500' : 'bg-blue-400'}`} />
                            <span className="truncate">{task.title}</span>
                          </div>
                        ))}

                        {/* Reminders */}
                        {dayItems?.reminders.slice(0, 2).map(rem => (
                          <div
                            key={rem.id}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950/70 text-amber-300 border border-amber-800/50 truncate flex items-center gap-1"
                          >
                            <Bell className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
                            <span className="truncate">{rem.title}</span>
                          </div>
                        ))}

                        {/* Notes */}
                        {dayItems?.notes.slice(0, 2).map(n => (
                          <div
                            key={n.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onOpenNote) onOpenNote(n.id);
                            }}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950/70 text-purple-300 border border-purple-800/50 truncate flex items-center gap-1 hover:border-purple-400"
                          >
                            <FileText className="w-2.5 h-2.5 text-purple-400 flex-shrink-0" />
                            <span className="truncate">{n.title}</span>
                          </div>
                        ))}

                        {/* Overflow Counter */}
                        {totalCount > 3 && (
                          <div className="text-[9px] text-gray-500 font-mono text-center">
                            +{totalCount - 3} más
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AGENDA VIEW */}
          {viewType === 'agenda' && (
            <div className="flex-1 overflow-y-auto p-4 max-w-4xl mx-auto w-full space-y-4">
              {Array.from(itemsByDate.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([dateKey, dayItems]) => {
                  const dObj = new Date(dateKey + 'T00:00:00');
                  const dateTitle = dObj.toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                  });

                  return (
                    <div key={dateKey} className="bg-[#181824] rounded-2xl border border-[#2b2b3e] p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-[#252538] pb-2">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4 text-blue-400" />
                          <h3 className="font-bold text-sm text-white capitalize">{dateTitle}</h3>
                        </div>
                        {isToday(dateKey) && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-600 text-[10px] font-bold text-white uppercase font-mono">
                            Hoy
                          </span>
                        )}
                      </div>

                      {/* Tasks on this day */}
                      <div className="space-y-2">
                        {dayItems.tasks.map(t => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-[#14141d] border border-[#242436] hover:border-blue-500/40 transition"
                          >
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => onUpdateTask(t.id, {
                                  status: t.status === 'completed' ? 'todo' : 'completed'
                                })}
                                className="text-gray-400 hover:text-emerald-400 transition"
                              >
                                {t.status === 'completed' ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Circle className="w-4 h-4 text-gray-500" />
                                )}
                              </button>
                              <span className={`text-xs font-semibold ${t.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                                {t.title}
                              </span>
                            </div>

                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1e1e2c] text-gray-400 uppercase">
                              {t.priority}
                            </span>
                          </div>
                        ))}

                        {/* Reminders on this day */}
                        {dayItems.reminders.map(r => (
                          <div
                            key={r.id}
                            className="flex items-center gap-3 p-2.5 rounded-xl bg-amber-950/20 border border-amber-900/40 text-amber-300 text-xs"
                          >
                            <Bell className="w-4 h-4 text-amber-400 flex-shrink-0" />
                            <span className="font-semibold">{r.title}</span>
                          </div>
                        ))}

                        {/* Notes on this day */}
                        {dayItems.notes.map(n => (
                          <div
                            key={n.id}
                            onClick={() => onOpenNote && onOpenNote(n.id)}
                            className="flex items-center gap-3 p-2.5 rounded-xl bg-purple-950/20 border border-purple-900/40 text-purple-300 text-xs cursor-pointer hover:border-purple-500 transition"
                          >
                            <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
                            <span className="font-semibold">{n.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* WEEK VIEW */}
          {viewType === 'week' && (
            <div className="flex-1 grid grid-cols-7 border-t border-[#252535] overflow-y-auto">
              {weekDays.map(w => {
                const dayItems = itemsByDate.get(w.dateString);
                const isCurrent = isToday(w.dateString);

                return (
                  <div
                    key={w.dateString}
                    onDragOver={(e) => handleDragOver(e, w.dateString)}
                    onDragLeave={() => handleDragLeave(w.dateString)}
                    onDrop={(e) => handleDrop(e, w.dateString)}
                    onClick={() => {
                      setCreateInitialDate(w.dateString);
                      setIsCreateModalOpen(true);
                    }}
                    className={`border-r border-[#222230] p-2 flex flex-col space-y-2 cursor-pointer ${
                      isCurrent ? 'bg-[#181827]' : 'bg-[#14141c]'
                    }`}
                  >
                    <div className="text-center pb-2 border-b border-[#252538]">
                      <p className="text-[11px] text-gray-400 uppercase font-mono">{w.dayName}</p>
                      <p className={`text-base font-bold ${isCurrent ? 'text-blue-400' : 'text-white'}`}>{w.dayNumber}</p>
                    </div>

                    <div className="flex-1 space-y-1.5 overflow-y-auto">
                      {dayItems?.tasks.map(t => (
                        <div
                          key={t.id}
                          className="p-2 rounded-lg bg-blue-950/60 border border-blue-800/40 text-xs text-blue-200"
                        >
                          <p className="font-semibold truncate">{t.title}</p>
                        </div>
                      ))}
                      {dayItems?.reminders.map(r => (
                        <div
                          key={r.id}
                          className="p-2 rounded-lg bg-amber-950/60 border border-amber-800/40 text-xs text-amber-200 flex items-center gap-1.5"
                        >
                          <Bell className="w-3 h-3 text-amber-400" />
                          <p className="font-semibold truncate">{r.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* DAY VIEW */}
          {viewType === 'day' && (
            <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-3">
              <div className="p-4 bg-[#181824] rounded-2xl border border-[#2b2b3e]">
                <h3 className="text-lg font-bold text-white mb-3">
                  Plan del Día — {currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <div className="space-y-2">
                  {(itemsByDate.get(currentDate.toISOString().split('T')[0])?.tasks || []).map(t => (
                    <div key={t.id} className="p-3 bg-[#13131c] rounded-xl border border-[#262638] flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-200">{t.title}</span>
                      <span className="text-xs font-mono text-gray-400 uppercase">{t.priority}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Item Creation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#171722] border border-[#2c2c3e] rounded-2xl w-full max-w-md p-4 sm:p-5 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between mb-4 border-b border-[#252538] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Planificar Nuevo Elemento</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#252538]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              {/* Type Switcher */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-[#121218] rounded-xl border border-[#262638]">
                <button
                  type="button"
                  onClick={() => setCreateType('task')}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                    createType === 'task' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Tarea
                </button>
                <button
                  type="button"
                  onClick={() => setCreateType('reminder')}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                    createType === 'reminder' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Recordatorio
                </button>
                <button
                  type="button"
                  onClick={() => setCreateType('note')}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                    createType === 'note' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Nota
                </button>
              </div>

              {/* Title Input */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Título <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="¿Qué deseas planificar?"
                  className="w-full px-3 py-2 bg-[#121218] border border-[#2b2b3e] rounded-xl text-xs text-white outline-none focus:border-blue-500 font-medium"
                />
              </div>

              {/* Description Input */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  rows={2}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Detalles, notas u objetivos..."
                  className="w-full px-3 py-2 bg-[#121218] border border-[#2b2b3e] rounded-xl text-xs text-white outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Date & Time Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={createInitialDate}
                    onChange={(e) => setCreateInitialDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#121218] border border-[#2b2b3e] rounded-xl text-xs text-white outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Hora</label>
                  <input
                    type="time"
                    value={createTime}
                    onChange={(e) => setCreateTime(e.target.value)}
                    className="w-full px-3 py-2 bg-[#121218] border border-[#2b2b3e] rounded-xl text-xs text-white outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Priority & Project (For Tasks) */}
              {createType === 'task' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">Prioridad</label>
                    <select
                      value={createPriority}
                      onChange={(e) => setCreatePriority(e.target.value as TaskPriority)}
                      className="w-full px-3 py-2 bg-[#121218] border border-[#2b2b3e] rounded-xl text-xs text-white outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">Proyecto</label>
                    <select
                      value={createProjectId}
                      onChange={(e) => setCreateProjectId(e.target.value)}
                      className="w-full px-3 py-2 bg-[#121218] border border-[#2b2b3e] rounded-xl text-xs text-white outline-none focus:border-blue-500 cursor-pointer truncate"
                    >
                      <option value="">Sin Proyecto</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#252538]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-900/30 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : 'Crear en Calendario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
