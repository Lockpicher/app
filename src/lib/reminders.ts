import { AppReminder } from './types';

class ReminderService {
  private notifiedIds = new Set<string>();
  private checkInterval: any = null;
  private onTriggerCallback: ((reminder: AppReminder) => void) | null = null;

  public async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  public startListening(reminders: AppReminder[], onTrigger?: (reminder: AppReminder) => void) {
    if (onTrigger) this.onTriggerCallback = onTrigger;
    if (this.checkInterval) clearInterval(this.checkInterval);

    // Check every 30 seconds
    this.checkInterval = setInterval(() => {
      this.checkDueReminders(reminders);
    }, 30000);

    // Initial check
    this.checkDueReminders(reminders);
  }

  public stopListening() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private checkDueReminders(reminders: AppReminder[]) {
    const now = Date.now();
    for (const r of reminders) {
      if (r.status !== 'pending') continue;
      const remindTime = new Date(r.remind_at).getTime();
      
      // If due within the last 5 minutes and not notified yet
      if (remindTime <= now && remindTime >= now - 5 * 60 * 1000 && !this.notifiedIds.has(r.id)) {
        this.notifiedIds.add(r.id);
        this.sendNotification(r);
        if (this.onTriggerCallback) this.onTriggerCallback(r);
      }
    }
  }

  public sendNotification(reminder: AppReminder) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`⏰ Recordatorio: ${reminder.title}`, {
          body: reminder.description || 'Tienes un recordatorio programado en Segundo Cerebro',
          icon: '/favicon.ico'
        });
      } catch (e) {
        console.warn('Notification failed:', e);
      }
    }
  }
}

export const reminderService = new ReminderService();
