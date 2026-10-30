import { AppNote, AppTask, AppObject, AppProject } from './types';

export interface KnowledgeMatch {
  id: string;
  type: 'note' | 'task' | 'object' | 'project';
  title: string;
  contentSnippet: string;
  score: number;
}

/**
 * Searches the user's personal knowledge base for relevant items.
 */
export function searchKnowledgeBase(
  query: string,
  data: {
    notes: AppNote[];
    tasks: AppTask[];
    objects: AppObject[];
    projects: AppProject[];
  },
  limit = 6
): KnowledgeMatch[] {
  if (!query || !query.trim()) return [];

  const rawTerms = query
    .toLowerCase()
    .replace(/[^\w\sáéíóúüñ]/gi, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);

  // Common stop words to deprioritize
  const stopWords = new Set(['para', 'como', 'sobre', 'este', 'esta', 'estos', 'estas', 'cual', 'cuales', 'donde', 'hacer', 'tener', 'pero', 'mas', 'menos', 'algo', 'hacer', 'nota', 'notas', 'tarea', 'tareas', 'segundo', 'cerebro']);
  const terms = rawTerms.filter(t => !stopWords.has(t));
  const effectiveTerms = terms.length > 0 ? terms : rawTerms;

  if (effectiveTerms.length === 0) return [];

  const results: KnowledgeMatch[] = [];

  // 1. Search Notes
  for (const note of data.notes) {
    const titleLower = (note.title || '').toLowerCase();
    const contentText = cleanHtmlToPlainText(note.content || '');
    const contentLower = contentText.toLowerCase();
    const tagsLower = (note.tags || []).join(' ').toLowerCase();

    let score = 0;
    for (const term of effectiveTerms) {
      if (titleLower.includes(term)) score += 10;
      if (tagsLower.includes(term)) score += 6;
      if (contentLower.includes(term)) score += 3;
    }

    if (score > 0) {
      const snippet = extractSnippet(contentText, effectiveTerms);
      results.push({
        id: note.id,
        type: 'note',
        title: note.title || 'Nota sin título',
        contentSnippet: snippet,
        score
      });
    }
  }

  // 2. Search Tasks
  for (const task of data.tasks) {
    const titleLower = (task.title || '').toLowerCase();
    const descLower = (task.description || '').toLowerCase();

    let score = 0;
    for (const term of effectiveTerms) {
      if (titleLower.includes(term)) score += 8;
      if (descLower.includes(term)) score += 3;
    }

    if (score > 0) {
      results.push({
        id: task.id,
        type: 'task',
        title: task.title,
        contentSnippet: `Estado: ${task.status}${task.due_date ? ` • Vence: ${task.due_date}` : ''}${task.description ? ` • ${task.description}` : ''}`,
        score
      });
    }
  }

  // 3. Search Objects (Books, Pages, Persons, Trips, Ideas)
  for (const obj of data.objects) {
    const titleLower = (obj.title || '').toLowerCase();
    const descLower = (obj.description || '').toLowerCase();
    const contentText = cleanHtmlToPlainText(obj.content || '');
    const contentLower = contentText.toLowerCase();

    let score = 0;
    for (const term of effectiveTerms) {
      if (titleLower.includes(term)) score += 10;
      if (descLower.includes(term)) score += 5;
      if (contentLower.includes(term)) score += 3;
    }

    if (score > 0) {
      const snippet = obj.description || extractSnippet(contentText, effectiveTerms);
      results.push({
        id: obj.id,
        type: 'object',
        title: `${obj.title} (${obj.object_type})`,
        contentSnippet: snippet,
        score
      });
    }
  }

  // 4. Search Projects
  for (const proj of data.projects) {
    const titleLower = (proj.title || '').toLowerCase();
    const descLower = (proj.description || '').toLowerCase();

    let score = 0;
    for (const term of effectiveTerms) {
      if (titleLower.includes(term)) score += 8;
      if (descLower.includes(term)) score += 3;
    }

    if (score > 0) {
      results.push({
        id: proj.id,
        type: 'project',
        title: proj.title,
        contentSnippet: `Proyecto (${proj.status}): ${proj.description || 'Sin descripción'}`,
        score
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Strips HTML tags and normalizes whitespace
 */
function cleanHtmlToPlainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts a relevant snippet surrounding matched search terms
 */
function extractSnippet(text: string, terms: string[], maxLength = 240): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;

  const textLower = text.toLowerCase();
  let firstIndex = -1;

  for (const term of terms) {
    const idx = textLower.indexOf(term);
    if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) {
      firstIndex = idx;
    }
  }

  if (firstIndex === -1) {
    return text.slice(0, maxLength) + '...';
  }

  const start = Math.max(0, firstIndex - 60);
  const end = Math.min(text.length, start + maxLength);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';

  return prefix + text.slice(start, end).trim() + suffix;
}
