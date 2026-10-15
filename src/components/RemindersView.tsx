import React, { useState } from 'react';
import { 
  Bell, 
  Calendar, 
  Clock, 
  Check, 
  Trash2, 
  AlertCircle, 
  ExternalLink, 
  FileText, 
  CheckSquare, 
  BellRing,
  Sparkles
} from 'lucide-react';
import { AppReminder, AppNote, AppTask } from '../lib/types';
import { reminderService } from '../lib/reminders';

interface RemindersViewProps {
  reminders: AppReminder[];
  notes: AppNote[];
  tasks: AppTask[];
  onToggleReminderStatus: (reminderId: string, currentStatus: string) => Promise<void>;
  onDeleteReminder: (reminderId: string) => Promise<void>;
  onOpenNote: (note: AppNote) => void;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  reminders,
  notes,
  tasks,
  onToggleReminderStatus,
  onDeleteReminder,
  onOpenNote
}) => {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'overdue' | 'completed'>('upcoming');
  const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(
    'Notification' in window && Notification.permission === 'granted'
  );

  const now = new Date();

  const handleRequestPermission = async () => {
    const granted = await reminderService.requestNotificationPermission();
    setNotificationPermissionGranted(granted);
    if (granted) {
      alert('¡Permiso de notificaciones activado en tu navegador!');
    }
  };

  const filteredReminders = reminders.filter(r => {
    const isOverdue = new Date(r.remind_at) < now && r.status === 'pending';
    const isUpcoming = new Date(r.remind_at) >= now && r.status === 'pending';

    if (filter === 'upcoming') return isUpcoming;
    if (filter === 'overdue') return isOverdue;
    if (filter === 'completed') return r.status === 'completed' || r.status === 'dismissed';
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#161622] overflow-hidden">
      {/* Header */}
      <div className="px-8 py-5 border-b border-[#252538] bg-[#14141d] flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-amber-400" />
            Gestor de Recordatorios
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Recordatorios programados para tus notas y tareas en Segundo Cerebro.
          </p>
        </div>

        {!notificationPermissionGranted && (
          <button
            onClick={handleRequestPermission}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition"
          >
            <BellRing className="w-4 h-4 text-amber-400" />
            Activar Notificaciones Web
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="px-8 py-2.5 bg-[#121218] border-b border-[#222232] flex items-center gap-2 text-xs">
        <button
          onClick={() => setFilter('upcoming')}
          className={`px-3 py-1 rounded-lg font-medium transition ${
            filter === 'upcoming' ? 'bg-[#252538] text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Próximos
        </button>
        <button
          onClick={() => setFilter('overdue')}
          className={`px-3 py-1 rounded-lg font-medium transition ${
            filter === 'overdue' ? 'bg-red-500/20 text-red-300' : 'text-gray-400 hover:text-white'
          }`}
        >
          Vencidos
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-3 py-1 rounded-lg font-medium transition ${
            filter === 'completed' ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-400 hover:text-white'
          }`}
        >
          Completados
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-lg font-medium transition ${
            filter === 'all' ? 'bg-[#252538] text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          Todos ({reminders.length})
        </button>
      </div>

      {/* Reminders List */}
      <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
        {filteredReminders.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-[#262638] rounded-2xl p-8 space-y-2">
            <Bell className="w-8 h-8 text-gray-500 mx-auto" />
            <p className="text-xs font-semibold text-gray-300">No hay recordatorios en esta sección</p>
            <p className="text-[11px] text-gray-500">
              Puedes programar recordatorios abriendo cualquier nota o tarea y seleccionando fecha y hora.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReminders.map(rem => {
              const remDate = new Date(rem.remind_at);
              const isOverdue = remDate < now && rem.status === 'pending';
              const associatedNote = notes.find(n => n.id === rem.note_id);
              const associatedTask = tasks.find(t => t.id === rem.task_id);

              return (
                <div
                  key={rem.id}
                  className={`p-4 rounded-xl border transition flex items-center justify-between gap-4 ${
                    isOverdue 
                      ? 'bg-red-950/20 border-red-800/40' 
                      : rem.status === 'completed' 
                      ? 'bg-[#14141e] border-[#20202d] opacity-60' 
                      : 'bg-[#181824] border-[#29293c]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => onToggleReminderStatus(rem.id, rem.status)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center mt-0.5 transition ${
                        rem.status === 'completed' 
                          ? 'bg-emerald-600 border-emerald-500 text-white' 
                          : 'border-gray-500 hover:border-emerald-400'
                      }`}
                      title={rem.status === 'completed' ? 'Marcar pendiente' : 'Marcar completado'}
                    >
                      {rem.status === 'completed' && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <div>
                      <h4 className={`text-xs font-semibold ${rem.status === 'completed' ? 'line-through text-gray-400' : 'text-white'}`}>
                        {rem.title}
                      </h4>
                      {rem.description && (
                        <p className="text-[11px] text-gray-400 mt-0.5">{rem.description}</p>
                      )}

                      <div className="flex items-center gap-3 text-[10px] font-mono mt-2 text-gray-400">
                        <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400 font-bold' : ''}`}>
                          <Clock className="w-3 h-3" />
                          {remDate.toLocaleDateString()} a las {remDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isOverdue && ' (Vencido)'}
                        </span>

                        {associatedNote && (
                          <button
                            onClick={() => onOpenNote(associatedNote)}
                            className="flex items-center gap-1 text-blue-400 hover:underline"
                          >
                            <FileText className="w-2.5 h-2.5" />
                            Nota: {associatedNote.title}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onDeleteReminder(rem.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition"
                      title="Eliminar recordatorio"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
