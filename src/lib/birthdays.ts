import { AppObject, AppReminder } from './types';
import { db } from './insforge';

export interface BirthdaySettings {
  enabled: boolean;
  notificationTime: string; // "09:00"
  notifyOneDayBefore: boolean;
  notifySameDay: boolean;
  timezone: string;
}

const SETTINGS_KEY = 'segundo_cerebro_birthday_settings';

export function getBirthdaySettings(): BirthdaySettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading birthday settings:', e);
  }
  return {
    enabled: true,
    notificationTime: '09:00',
    notifyOneDayBefore: true,
    notifySameDay: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'
  };
}

export function saveBirthdaySettings(settings: BirthdaySettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving birthday settings:', e);
  }
}

/**
 * Calculates current age or age to be attained on birthday
 */
export function calculateAge(birthdayStr?: string, targetYear?: number): number | null {
  if (!birthdayStr) return null;
  // birthdayStr format YYYY-MM-DD or MM-DD
  const parts = birthdayStr.split('-');
  if (parts.length < 3) return null; // Year unknown
  const birthYear = parseInt(parts[0], 10);
  if (isNaN(birthYear) || birthYear < 1900 || birthYear > 2100) return null;
  const currYear = targetYear || new Date().getFullYear();
  const age = currYear - birthYear;
  return age >= 0 ? age : null;
}

/**
 * Formats a birthday date string safely without timezone offset shifts.
 * Handles YYYY-MM-DD and returns DD/MM (or DD/MM/YYYY)
 */
export function formatBirthdayDisplay(birthdayStr?: string): string {
  if (!birthdayStr) return 'Sin fecha';
  const parts = birthdayStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const monthName = months[parseInt(month, 10) - 1] || month;
    return `${parseInt(day, 10)} de ${monthName} (${year})`;
  } else if (parts.length === 2) {
    const [month, day] = parts;
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const monthName = months[parseInt(month, 10) - 1] || month;
    return `${parseInt(day, 10)} de ${monthName}`;
  }
  return birthdayStr;
}

/**
 * Syncs the two birthday reminders (1 day before and same day) into app_reminders
 * for a specific person.
 * Avoids duplicate reminders by referencing person_id and recurring annual dates.
 */
export async function syncPersonBirthdayReminders(
  person: AppObject,
  existingReminders: AppReminder[] = []
): Promise<AppReminder[]> {
  const props = person.properties || {};
  const birthday = props.birthday || props.cumpleanos || props.fecha_nacimiento;
  if (!birthday) return existingReminders;

  const settings = getBirthdaySettings();
  if (!settings.enabled) return existingReminders;

  let currentReminders = existingReminders;
  if (currentReminders.length === 0) {
    try {
      currentReminders = await db.getReminders();
    } catch {
      currentReminders = [];
    }
  }

  const parts = String(birthday).split('-');
  const month = parts.length === 3 ? parts[1] : parts[0];
  const day = parts.length === 3 ? parts[2] : parts[1];

  if (!month || !day) return currentReminders;

  const currentYear = new Date().getFullYear();
  const yearsToSchedule = [currentYear, currentYear + 1];

  let updatedList = [...currentReminders];

  for (const year of yearsToSchedule) {
    // 1. Same Day Birthday target
    const sameDayStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${settings.notificationTime}:00`;
    // 2. Day before target
    const bdayDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
    bdayDate.setDate(bdayDate.getDate() - 1);
    const prevYear = bdayDate.getFullYear();
    const prevMonth = String(bdayDate.getMonth() + 1).padStart(2, '0');
    const prevDay = String(bdayDate.getDate()).padStart(2, '0');
    const oneDayBeforeStr = `${prevYear}-${prevMonth}-${prevDay}T${settings.notificationTime}:00`;

    const age = calculateAge(birthday, year);
    const ageText = age !== null ? ` (cumple ${age} años)` : '';

    // Check same day reminder
    if (settings.notifySameDay) {
      const sameDayTitle = `🎂 ¡Hoy es el cumpleaños de ${person.title}!${ageText}`;
      const existingSameDay = updatedList.find(r => 
        r.person_id === person.id && 
        r.remind_at?.startsWith(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
      );

      if (!existingSameDay) {
        try {
          const created = await db.createReminder({
            person_id: person.id,
            title: sameDayTitle,
            description: `No olvides felicitar a ${person.title} hoy en su cumpleaños${ageText}.`,
            remind_at: sameDayStr,
            timezone: settings.timezone,
            status: 'pending'
          });
          if (created) updatedList.push(created);
        } catch (e) {
          console.warn('Error creating same day birthday reminder:', e);
        }
      }
    }

    // Check 1 day before reminder
    if (settings.notifyOneDayBefore) {
      const dayBeforeTitle = `🎁 Mañana es el cumpleaños de ${person.title}${ageText}`;
      const existingDayBefore = updatedList.find(r => 
        r.person_id === person.id && 
        r.remind_at?.startsWith(`${prevYear}-${prevMonth}-${prevDay}`)
      );

      if (!existingDayBefore) {
        try {
          const created = await db.createReminder({
            person_id: person.id,
            title: dayBeforeTitle,
            description: `Recuerda preparar un regalo o felicitación para ${person.title} mañana${ageText}.`,
            remind_at: oneDayBeforeStr,
            timezone: settings.timezone,
            status: 'pending'
          });
          if (created) updatedList.push(created);
        } catch (e) {
          console.warn('Error creating day-before birthday reminder:', e);
        }
      }
    }
  }

  return updatedList;
}

/**
 * Registers Service Worker if available in browser
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('[Segundo Cerebro] Service Worker registrado exitosamente:', reg.scope);
      return reg;
    } catch (e) {
      console.warn('[Segundo Cerebro] Service Worker registration failed:', e);
    }
  }
  return null;
}
