import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Flame, 
  Check, 
  Minus, 
  Sparkles, 
  BookOpen, 
  Dumbbell, 
  Droplet, 
  Brain, 
  Heart, 
  Coffee, 
  Moon, 
  Calendar, 
  TrendingUp, 
  Award, 
  Filter, 
  Edit3, 
  Trash2, 
  Archive, 
  RefreshCw, 
  X,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AppHabit, AppHabitLog, HabitLogStatus } from '../lib/types';
import { useTheme } from '../lib/themeContext';

interface HabitsViewProps {
  habits: AppHabit[];
  habitLogs: AppHabitLog[];
  onToggleLog: (habitId: string, date: string, status?: HabitLogStatus) => Promise<void>;
  onCreateHabit: (habit: Partial<AppHabit>) => Promise<AppHabit | null>;
  onUpdateHabit: (id: string, updates: Partial<AppHabit>) => Promise<void>;
  onDeleteHabit: (id: string) => Promise<void>;
  onNavigateToCalendar?: () => void;
}

// Map of popular Lucide icon options for habit creation
const HABIT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  Sparkles,
  Dumbbell,
  BookOpen,
  Droplet,
  Brain,
  Heart,
  Coffee,
  Moon,
  Flame,
  Calendar
};

const COLOR_PALETTE = [
  '#3b82f6', // Azul
  '#8b5cf6', // Púrpura
  '#ec4899', // Rosa
  '#10b981', // Esmeralda
  '#f59e0b', // Ámbar
  '#06b6d4', // Cian
  '#ef4444', // Rojo
  '#6366f1'  // Índigo
];

const DAYS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const SHORT_DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Format Date YYYY-MM-DD local
function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const HabitsView: React.FC<HabitsViewProps> = ({
  habits,
  habitLogs,
  onToggleLog,
  onCreateHabit,
  onUpdateHabit,
  onDeleteHabit,
  onNavigateToCalendar
}) => {
  const { theme } = useTheme();

  // Selected date anchor for week navigation (defaults to today)
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());

  // Modal State for Habit Create/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<AppHabit | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIcon, setFormIcon] = useState('Sparkles');
  const [formColor, setFormColor] = useState('#3b82f6');
  const [formFrequency, setFormFrequency] = useState<'daily' | 'weekdays' | 'weekends' | 'custom'>('daily');
  const [formDays, setFormDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [formTime, setFormTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Detail Popover / Action for a cell
  const [selectedCell, setSelectedCell] = useState<{ habit: AppHabit; date: string; status: HabitLogStatus | 'none' } | null>(null);

  // Today key
  const todayKey = useMemo(() => toDateKey(new Date()), []);

  // Compute the 7 days of the current week (Monday to Sunday)
  const weekDays = useMemo(() => {
    const curr = new Date(anchorDate);
    // getDay(): 0 is Sunday, 1 is Monday... 6 is Saturday
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1); // adjust to Monday
    const monday = new Date(curr.setDate(diff));

    const days: { date: Date; dateKey: string; dayName: string; dayNumber: number; isToday: boolean; isFuture: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const k = toDateKey(d);
      days.push({
        date: d,
        dateKey: k,
        dayName: SHORT_DAYS_ES[i],
        dayNumber: d.getDate(),
        isToday: k === todayKey,
        isFuture: k > todayKey
      });
    }
    return days;
  }, [anchorDate, todayKey]);

  // Month-Year Label
  const monthYearLabel = useMemo(() => {
    const first = weekDays[0]?.date || new Date();
    const month = first.toLocaleDateString('es-ES', { month: 'long' });
    const year = first.getFullYear();
    return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
  }, [weekDays]);

  // Lookup map for fast status resolution: Map<`${habit_id}_${date}`, HabitLogStatus>
  const logMap = useMemo(() => {
    const map = new Map<string, HabitLogStatus>();
    habitLogs.forEach(l => {
      map.set(`${l.habit_id}_${l.date}`, l.status);
    });
    return map;
  }, [habitLogs]);

  // Navigation handlers
  const handlePrevWeek = () => {
    const next = new Date(anchorDate);
    next.setDate(next.getDate() - 7);
    setAnchorDate(next);
  };

  const handleNextWeek = () => {
    const next = new Date(anchorDate);
    next.setDate(next.getDate() + 7);
    setAnchorDate(next);
  };

  const handleToday = () => {
    setAnchorDate(new Date());
  };

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingHabit(null);
    setFormTitle('');
    setFormDescription('');
    setFormIcon('Sparkles');
    setFormColor('#3b82f6');
    setFormFrequency('daily');
    setFormDays([1, 2, 3, 4, 5, 6, 7]);
    setFormTime('');
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (habit: AppHabit) => {
    setEditingHabit(habit);
    setFormTitle(habit.title);
    setFormDescription(habit.description || '');
    setFormIcon(habit.icon || 'Sparkles');
    setFormColor(habit.color || '#3b82f6');
    setFormFrequency(habit.frequency);
    setFormDays(habit.frequency_days || [1, 2, 3, 4, 5, 6, 7]);
    setFormTime(habit.reminder_time || '');
    setIsModalOpen(true);
  };

  // Save Habit
  const handleSaveHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    try {
      setIsSaving(true);
      if (editingHabit) {
        await onUpdateHabit(editingHabit.id, {
          title: formTitle.trim(),
          description: formDescription.trim(),
          icon: formIcon,
          color: formColor,
          frequency: formFrequency,
          frequency_days: formDays,
          reminder_time: formTime || null
        });
      } else {
        await onCreateHabit({
          title: formTitle.trim(),
          description: formDescription.trim(),
          icon: formIcon,
          color: formColor,
          frequency: formFrequency,
          frequency_days: formDays,
          reminder_time: formTime || null
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert('Error guardando hábito: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper: check if a habit is scheduled for a given ISO day (1..7)
  const isHabitScheduledForDate = (habit: AppHabit, d: Date): boolean => {
    // 0 is Sunday in JS -> convert to ISO 1..7 (1=Monday ... 7=Sunday)
    const jsDay = d.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;
    const dateStr = toDateKey(d);

    // Check start and end date bounds
    if (habit.start_date && dateStr < habit.start_date) return false;
    if (habit.end_date && dateStr > habit.end_date) return false;

    if (habit.frequency === 'daily') return true;
    if (habit.frequency === 'weekdays') return isoDay >= 1 && isoDay <= 5;
    if (habit.frequency === 'weekends') return isoDay === 6 || isoDay === 7;
    if (habit.frequency === 'custom') {
      return (habit.frequency_days || []).includes(isoDay);
    }
    return true;
  };

  // Calculate streaks and statistics for each habit based on persisted logs
  const habitStats = useMemo(() => {
    const stats: Record<string, { currentStreak: number; bestStreak: number; totalCompleted: number }> = {};

    habits.forEach(habit => {
      const logsForHabit = habitLogs.filter(l => l.habit_id === habit.id && l.status === 'completed');
      const completedDates = new Set(logsForHabit.map(l => l.date));

      // Calculate total completed
      const totalCompleted = completedDates.size;

      // Calculate current streak backwards from today or yesterday
      let currentStreak = 0;
      let checkDate = new Date();
      let missesAllowed = 0; // strict streak based on scheduled occurrences

      // If today is scheduled and not completed yet, streak can still be alive if yesterday was completed
      const todayScheduled = isHabitScheduledForDate(habit, checkDate);
      const todayDone = completedDates.has(toDateKey(checkDate));

      if (!todayDone && todayScheduled) {
        // Step 1 day back to see if streak was completed until yesterday
        checkDate.setDate(checkDate.getDate() - 1);
      }

      for (let i = 0; i < 365; i++) {
        const dKey = toDateKey(checkDate);
        const scheduled = isHabitScheduledForDate(habit, checkDate);

        if (scheduled) {
          if (completedDates.has(dKey)) {
            currentStreak++;
          } else {
            // Streak broken
            break;
          }
        }
        checkDate.setDate(checkDate.getDate() - 1);
      }

      // Best streak calculation
      let bestStreak = currentStreak;
      let tempStreak = 0;
      // Sort all completed dates
      const sortedDates = Array.from(completedDates).sort();
      for (let i = 0; i < sortedDates.length; i++) {
        tempStreak++;
        if (tempStreak > bestStreak) bestStreak = tempStreak;
      }

      stats[habit.id] = { currentStreak, bestStreak, totalCompleted };
    });

    return stats;
  }, [habits, habitLogs]);

  // Overall Global Statistics for the Header Cards
  const globalStats = useMemo(() => {
    let todayScheduledCount = 0;
    let todayCompletedCount = 0;

    let weekScheduledCount = 0;
    let weekCompletedCount = 0;

    const todayObj = new Date();

    habits.forEach(h => {
      // Today
      if (isHabitScheduledForDate(h, todayObj)) {
        todayScheduledCount++;
        if (logMap.get(`${h.id}_${todayKey}`) === 'completed') {
          todayCompletedCount++;
        }
      }

      // Week (only past and today days are counted to avoid penalizing future days)
      weekDays.forEach(wd => {
        if (!wd.isFuture && isHabitScheduledForDate(h, wd.date)) {
          weekScheduledCount++;
          if (logMap.get(`${h.id}_${wd.dateKey}`) === 'completed') {
            weekCompletedCount++;
          }
        }
      });
    });

    const todayPercentage = todayScheduledCount > 0 
      ? Math.round((todayCompletedCount / todayScheduledCount) * 100) 
      : 0;

    const weekPercentage = weekScheduledCount > 0 
      ? Math.round((weekCompletedCount / weekScheduledCount) * 100) 
      : 0;

    // Highest current streak
    let maxStreak = 0;
    Object.values(habitStats).forEach(s => {
      if (s.currentStreak > maxStreak) maxStreak = s.currentStreak;
    });

    return {
      todayCompletedCount,
      todayScheduledCount,
      todayPercentage,
      weekCompletedCount,
      weekScheduledCount,
      weekPercentage,
      maxStreak
    };
  }, [habits, logMap, weekDays, todayKey, habitStats]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111117] text-gray-100 overflow-y-auto">
      {/* Top Header */}
      <div className="px-4 sm:px-8 py-5 border-b border-[#222232] bg-[#161622] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Hábitos & Rutinas
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-950/70 text-blue-400 border border-blue-800/40 font-medium">
                  {habits.length} activos
                </span>
              </h1>
              <p className="text-xs text-gray-400">
                Construye constancia diaria y sincroniza con tu calendario central
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {onNavigateToCalendar && (
            <button
              onClick={onNavigateToCalendar}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white bg-[#20202e] hover:bg-[#28283a] border border-[#2d2d3e] transition"
              title="Ver en el Calendario Integrado"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Ver Calendario</span>
            </button>
          )}

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Hábito</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">

        {/* Global Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Hoy */}
          <div className="p-4 rounded-xl bg-[#171723] border border-[#232332] flex flex-col justify-between">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Hoy</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white">
                {globalStats.todayCompletedCount}/{globalStats.todayScheduledCount}
              </span>
              <span className="text-xs font-semibold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-800/40">
                {globalStats.todayPercentage}%
              </span>
            </div>
            {/* Mini Progress Bar */}
            <div className="mt-3 w-full bg-[#232334] h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full rounded-full transition-all duration-300" 
                style={{ width: `${globalStats.todayPercentage}%` }}
              />
            </div>
          </div>

          {/* Card 2: Semana actual */}
          <div className="p-4 rounded-xl bg-[#171723] border border-[#232332] flex flex-col justify-between">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Esta Semana</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white">
                {globalStats.weekCompletedCount}/{globalStats.weekScheduledCount}
              </span>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40">
                {globalStats.weekPercentage}%
              </span>
            </div>
            <div className="mt-3 w-full bg-[#232334] h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-300" 
                style={{ width: `${globalStats.weekPercentage}%` }}
              />
            </div>
          </div>

          {/* Card 3: Mejor racha activa */}
          <div className="p-4 rounded-xl bg-[#171723] border border-[#232332] flex flex-col justify-between">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Racha Activa
            </span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-amber-400">
                {globalStats.maxStreak}
              </span>
              <span className="text-xs text-gray-400 font-medium">días consecutivos</span>
            </div>
            <p className="mt-2 text-[10px] text-gray-400 truncate">
              {globalStats.maxStreak > 0 ? '¡Excelente disciplina!' : 'Empieza tu racha hoy'}
            </p>
          </div>

          {/* Card 4: Total Hábitos */}
          <div className="p-4 rounded-xl bg-[#171723] border border-[#232332] flex flex-col justify-between">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Hábitos Activos</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white">
                {habits.length}
              </span>
              <span className="text-xs text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-800/40">
                Rutina
              </span>
            </div>
            <p className="mt-2 text-[10px] text-gray-400">
              Registrados en Segundo Cerebro
            </p>
          </div>
        </div>

        {/* Weekly Habit Tracker Grid Card (Capacities & Visual Tracking reference style) */}
        <div className="bg-[#171723] border border-[#232332] rounded-2xl p-4 sm:p-6 shadow-xl">
          {/* Grid Navigation & Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-[#242436] gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-[#20202e] rounded-lg border border-[#2e2e42] p-0.5">
                <button
                  onClick={handlePrevWeek}
                  className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#2c2c3e] transition"
                  title="Semana anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleToday}
                  className="px-2.5 py-1 text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#2c2c3e] rounded transition"
                >
                  Hoy
                </button>
                <button
                  onClick={handleNextWeek}
                  className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#2c2c3e] transition"
                  title="Semana siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <span className="text-sm font-semibold text-white">
                {monthYearLabel}
              </span>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[9px] font-bold">✓</span>
                Completado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-600/30 border border-amber-500/40 text-amber-400 flex items-center justify-center text-[9px] font-bold">-</span>
                Omitido
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full border border-gray-600 bg-transparent" />
                Pendiente
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-[#1b1b26] border border-dashed border-[#2b2b3e]" />
                No programado
              </span>
            </div>
          </div>

          {/* Habit Tracker Rows */}
          <div className="mt-4 overflow-x-auto no-scrollbar">
            {habits.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-950/40 border border-blue-800/30 flex items-center justify-center text-blue-400 mb-3">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white">No tienes hábitos creados aún</h3>
                <p className="text-xs text-gray-400 max-w-sm mt-1">
                  Crea tu primer hábito para empezar el seguimiento visual de tus rutinas diarias y sincronizarlas con el calendario.
                </p>
                <button
                  onClick={handleOpenCreate}
                  className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition"
                >
                  + Crear mi primer hábito
                </button>
              </div>
            ) : (
              <table className="w-full border-collapse min-w-[620px]">
                <thead>
                  <tr className="border-b border-[#242436]">
                    <th className="py-2.5 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-64">
                      Hábito
                    </th>
                    {weekDays.map(d => (
                      <th 
                        key={d.dateKey}
                        className={`py-2 px-1 text-center font-medium transition ${
                          d.isToday 
                            ? 'bg-blue-950/30 text-blue-300 font-bold rounded-t-lg' 
                            : 'text-gray-400'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-[10px] uppercase">{d.dayName}</span>
                          <span className={`text-xs mt-0.5 w-6 h-6 flex items-center justify-center rounded-full ${
                            d.isToday ? 'bg-blue-600 text-white font-bold' : ''
                          }`}>
                            {d.dayNumber}
                          </span>
                        </div>
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">
                      Racha
                    </th>
                    <th className="py-2.5 px-2 text-right text-xs font-semibold text-gray-400 w-16">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#202030]">
                  {habits.map(habit => {
                    const stats = habitStats[habit.id] || { currentStreak: 0, bestStreak: 0, totalCompleted: 0 };
                    const IconComponent = HABIT_ICONS[habit.icon || 'Sparkles'] || Sparkles;

                    return (
                      <tr 
                        key={habit.id}
                        className="hover:bg-[#1c1c2b] transition-colors group"
                      >
                        {/* Habit Title & Icon */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm"
                              style={{ backgroundColor: habit.color || '#3b82f6' }}
                            >
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-100 truncate flex items-center gap-1.5">
                                {habit.title}
                                {habit.reminder_time && (
                                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                    <Clock className="w-3 h-3 text-gray-500" />
                                    {habit.reminder_time.slice(0, 5)}
                                  </span>
                                )}
                              </p>
                              {habit.description && (
                                <p className="text-[11px] text-gray-400 truncate max-w-xs">
                                  {habit.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 7 Days of the Week */}
                        {weekDays.map(d => {
                          const isScheduled = isHabitScheduledForDate(habit, d.date);
                          const logStatus = logMap.get(`${habit.id}_${d.dateKey}`);

                          return (
                            <td 
                              key={d.dateKey}
                              className={`py-3 px-1 text-center ${d.isToday ? 'bg-blue-950/15' : ''}`}
                            >
                              <div className="flex items-center justify-center">
                                {!isScheduled ? (
                                  /* Not scheduled for this day */
                                  <div 
                                    className="w-8 h-8 rounded-full border border-dashed border-[#2e2e42] bg-[#161622]/60 flex items-center justify-center text-gray-600 text-[10px] cursor-not-allowed"
                                    title="No programado para este día"
                                  >
                                    ·
                                  </div>
                                ) : (
                                  /* Scheduled occurrence */
                                  <button
                                    onClick={() => onToggleLog(habit.id, d.dateKey)}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all transform active:scale-90 ${
                                      logStatus === 'completed'
                                        ? 'text-white shadow-md shadow-blue-500/20'
                                        : logStatus === 'skipped'
                                        ? 'bg-amber-950/40 border border-amber-600/50 text-amber-400'
                                        : d.isFuture
                                        ? 'border border-[#34344a] bg-[#181824] text-gray-600 hover:border-gray-400 cursor-pointer'
                                        : 'border-2 border-gray-500 hover:border-blue-400 bg-[#181824] text-transparent hover:text-gray-400'
                                    }`}
                                    style={
                                      logStatus === 'completed'
                                        ? { backgroundColor: habit.color || '#3b82f6' }
                                        : {}
                                    }
                                    title={
                                      logStatus === 'completed'
                                        ? `Completado el ${d.dateKey}. Pulsa para desmarcar.`
                                        : logStatus === 'skipped'
                                        ? `Omitido el ${d.dateKey}. Pulsa para marcar completado.`
                                        : `Pendiente para el ${d.dateKey}. Pulsa para registrar.`
                                    }
                                  >
                                    {logStatus === 'completed' && <Check className="w-4 h-4 stroke-[3]" />}
                                    {logStatus === 'skipped' && <Minus className="w-4 h-4 stroke-[2.5]" />}
                                    {!logStatus && <Check className="w-3.5 h-3.5 opacity-0 group-hover:opacity-40" />}
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        {/* Streak Badge */}
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#202030] text-amber-400 border border-[#2f2f45]">
                            <Flame className={`w-3.5 h-3.5 ${stats.currentStreak > 0 ? 'fill-amber-400' : 'text-gray-500'}`} />
                            <span>{stats.currentStreak}</span>
                          </div>
                        </td>

                        {/* Actions (Edit / Delete) */}
                        <td className="py-3 px-2 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition">
                            <button
                              onClick={() => handleOpenEdit(habit)}
                              className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-[#252538] transition"
                              title="Editar hábito"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`¿Eliminar el hábito "${habit.title}" y su historial de cumplimiento?`)) {
                                  onDeleteHabit(habit.id);
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-400 rounded-md hover:bg-red-950/40 transition"
                              title="Eliminar hábito"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Detailed Stats & Insights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card: Hábitos más constantes */}
          <div className="bg-[#171723] border border-[#232332] rounded-2xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-amber-400" />
              Hábitos con Mejor Racha Histórica
            </h3>
            <div className="space-y-2.5">
              {habits.length === 0 ? (
                <p className="text-xs text-gray-400">Sin datos de hábitos todavía.</p>
              ) : (
                habits.map(h => {
                  const s = habitStats[h.id] || { currentStreak: 0, bestStreak: 0, totalCompleted: 0 };
                  return (
                    <div key={h.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[#1e1e2d] border border-[#28283c]">
                      <div className="flex items-center gap-2.5 truncate">
                        <span 
                          className="w-2.5 h-2.5 rounded-full" 
                          style={{ backgroundColor: h.color || '#3b82f6' }} 
                        />
                        <span className="text-xs font-semibold text-gray-200 truncate">{h.title}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs shrink-0">
                        <span className="text-gray-400 text-[11px]">Total: <strong className="text-gray-200">{s.totalCompleted}</strong></span>
                        <span className="text-amber-400 font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40 flex items-center gap-1">
                          <Flame className="w-3 h-3 fill-amber-400" />
                          Racha: {s.currentStreak} d
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Card: Resumen de Frecuencias y Calendario */}
          <div className="bg-[#171723] border border-[#232332] rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                Integración con Calendario Central
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Tus hábitos con horario o programados para hoy se proyectan automáticamente en la vista Calendario y en el panel de Inicio (Home), con sincronización instantánea y bidireccional.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-900/40 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-300">¿Quieres ver la agenda del día?</p>
                <p className="text-[11px] text-gray-400">Revisa tus citas, tareas y hábitos en una sola vista unificada</p>
              </div>
              {onNavigateToCalendar && (
                <button
                  onClick={onNavigateToCalendar}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shrink-0 transition"
                >
                  Abrir Calendario
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Modal Crear / Editar Hábito */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#181826] border border-[#2c2c40] rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-left">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#252538] transition"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-base font-bold text-white mb-1">
              {editingHabit ? 'Editar Hábito' : 'Crear Nuevo Hábito'}
            </h2>
            <p className="text-xs text-gray-400 mb-5">
              Define la práctica recurrente y sus días de programación semanal.
            </p>

            <form onSubmit={handleSaveHabit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Nombre del hábito *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Leer 20 páginas, Meditar, Beber agua..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#202030] border border-[#303046] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Descripción u objetivo (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Por la mañana antes de empezar a trabajar"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-[#202030] border border-[#303046] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Icon & Color selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Icono
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {Object.keys(HABIT_ICONS).map(iconKey => {
                      const IconComp = HABIT_ICONS[iconKey];
                      const isSelected = formIcon === iconKey;
                      return (
                        <button
                          key={iconKey}
                          type="button"
                          onClick={() => setFormIcon(iconKey)}
                          className={`p-2 rounded-lg border transition ${
                            isSelected 
                              ? 'bg-blue-600 border-blue-400 text-white' 
                              : 'bg-[#202030] border-[#303046] text-gray-400 hover:text-white'
                          }`}
                        >
                          <IconComp className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Color identificador
                  </label>
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {COLOR_PALETTE.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setFormColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition ${
                          formColor === c ? 'border-white scale-110 shadow-md' : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Frequency Pattern */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Frecuencia de programación
                </label>
                <div className="grid grid-cols-4 gap-1.5 bg-[#202030] p-1 rounded-lg border border-[#303046]">
                  {[
                    { id: 'daily', label: 'Diario' },
                    { id: 'weekdays', label: 'L - V' },
                    { id: 'weekends', label: 'S - D' },
                    { id: 'custom', label: 'Días' }
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setFormFrequency(f.id as any);
                        if (f.id === 'daily') setFormDays([1, 2, 3, 4, 5, 6, 7]);
                        if (f.id === 'weekdays') setFormDays([1, 2, 3, 4, 5]);
                        if (f.id === 'weekends') setFormDays([6, 7]);
                      }}
                      className={`py-1.5 text-xs font-medium rounded-md transition ${
                        formFrequency === f.id 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Day selector if custom */}
                {formFrequency === 'custom' && (
                  <div className="mt-2.5 flex items-center justify-between gap-1">
                    {DAYS_ES.map((dayName, idx) => {
                      const isoDay = idx + 1;
                      const isSelected = formDays.includes(isoDay);
                      return (
                        <button
                          key={isoDay}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setFormDays(prev => prev.filter(d => d !== isoDay));
                            } else {
                              setFormDays(prev => [...prev, isoDay]);
                            }
                          }}
                          className={`w-8 h-8 rounded-full text-xs font-semibold transition ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-[#202030] border border-[#303046] text-gray-400 hover:text-white'
                          }`}
                          title={dayName}
                        >
                          {SHORT_DAYS_ES[idx].slice(0, 1)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reminder Time */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  Horario habitual en calendario (opcional)
                </label>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="w-full px-3 py-2 bg-[#202030] border border-[#303046] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-[#252538] transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !formTitle.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md disabled:opacity-50 transition"
                >
                  {isSaving ? 'Guardando...' : editingHabit ? 'Guardar Cambios' : 'Crear Hábito'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
