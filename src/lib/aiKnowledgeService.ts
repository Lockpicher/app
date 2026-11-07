import { AppNote, AppTask, AppObject, AppProject } from './types';

export interface KnowledgeMatch {
  id: string;
  type: 'note' | 'task' | 'object' | 'project';
  title: string;
  contentSnippet: string;
  score: number;
}

const STOP_WORDS = new Set([
  'para', 'como', 'sobre', 'este', 'esta', 'estos', 'estas', 'cual', 'cuales', 'donde',
  'hacer', 'tener', 'pero', 'mas', 'menos', 'algo', 'nota', 'notas', 'tarea', 'tareas',
  'segundo', 'cerebro', 'que', 'con', 'por', 'una', 'uno', 'los', 'las', 'del', 'desde',
  'cuando', 'quien', 'quienes', 'dime', 'muestra', 'busca', 'recuerda', 'informacion'
]);

// Concept expansion in Spanish. Search stays local and does not send private notes to an API.
const CONCEPTS: Record<string, string[]> = {
  dinero: ['finanzas', 'presupuesto', 'gasto', 'costos', 'costo', 'precio', 'pago', 'ahorro', 'ingreso'],
  finanzas: ['dinero', 'presupuesto', 'gasto', 'costos', 'precio', 'pago', 'ahorro', 'ingreso'],
  salud: ['medico', 'medicina', 'ejercicio', 'bienestar', 'sueno', 'alimentacion'],
  trabajo: ['laboral', 'profesion', 'empleo', 'proyecto', 'reunion', 'tarea'],
  aprender: ['estudio', 'estudiar', 'aprendizaje', 'libro', 'lectura', 'curso', 'conocimiento'],
  estudiar: ['aprender', 'aprendizaje', 'libro', 'lectura', 'curso', 'conocimiento'],
  libro: ['lectura', 'autor', 'capitulo', 'cita', 'literatura', 'estudio'],
  lectura: ['libro', 'autor', 'capitulo', 'cita', 'literatura', 'estudio'],
  persona: ['contacto', 'amigo', 'familia', 'reunion', 'relacion'],
  contacto: ['persona', 'amigo', 'familia', 'reunion', 'relacion'],
  viaje: ['viajar', 'destino', 'hotel', 'vuelo', 'itinerario', 'transporte'],
  viajar: ['viaje', 'destino', 'hotel', 'vuelo', 'itinerario'],
  lugar: ['sitio', 'ubicacion', 'direccion', 'ciudad', 'mapa'],
  idea: ['concepto', 'pensamiento', 'hipotesis', 'reflexion', 'nota atomica'],
  proyecto: ['objetivo', 'plan', 'entrega', 'tarea', 'avance'],
  problema: ['solucion', 'error', 'dificultad', 'incidente', 'causa'],
  solucion: ['problema', 'alternativa', 'respuesta', 'metodo'],
  comprar: ['compra', 'adquirir', 'precio', 'producto', 'proveedor'],
  compra: ['comprar', 'adquirir', 'precio', 'producto', 'proveedor']
};

function normalize(value: string): string {
  return value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function tokens(value: string): string[] {
  return normalize(value).split(' ').filter(token => token.length > 2 && !STOP_WORDS.has(token));
}
function cleanHtmlToPlainText(html: string): string {
  if (!html) return '';
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}
function expandTerms(query: string): string[] {
  const base = tokens(query);
  const expanded = new Set(base);
  base.forEach(term => (CONCEPTS[term] || []).forEach(alias => tokens(alias).forEach(token => expanded.add(token))));
  return Array.from(expanded);
}
function scoreField(field: string, queryTerms: string[], expandedTerms: string[], weight: number): number {
  const normalized = normalize(field);
  if (!normalized) return 0;
  const fieldTokens = new Set(tokens(normalized));
  let score = 0;
  queryTerms.forEach(term => {
    if (fieldTokens.has(term)) score += weight;
    else if (normalized.includes(term)) score += weight * 0.65;
  });
  expandedTerms.filter(term => !queryTerms.includes(term)).forEach(term => {
    if (fieldTokens.has(term)) score += weight * 0.42;
  });
  return score;
}
function extractSnippet(text: string, terms: string[], maxLength = 240): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  const normalized = normalize(text);
  let firstIndex = -1;
  for (const term of terms) {
    const idx = normalized.indexOf(term);
    if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) firstIndex = idx;
  }
  if (firstIndex === -1) return text.slice(0, maxLength) + '...';
  const start = Math.max(0, firstIndex - 60), end = Math.min(text.length, start + maxLength);
  return (start > 0 ? '...' : '') + text.slice(start, end).trim() + (end < text.length ? '...' : '');
}

/** Contextual local retrieval: exact terms, weighted fields, metadata and Spanish concept expansion.
 * This is not vector embedding search; it works offline and keeps personal content on-device.
 */
export function searchKnowledgeBase(
  query: string,
  data: { notes: AppNote[]; tasks: AppTask[]; objects: AppObject[]; projects: AppProject[] },
  limit = 10
): KnowledgeMatch[] {
  const queryTerms = tokens(query);
  if (!queryTerms.length) return [];
  const expandedTerms = expandTerms(query);
  const results: KnowledgeMatch[] = [];

  data.notes.filter(note => !note.is_archived).forEach(note => {
    const content = cleanHtmlToPlainText(note.content || note.plain_text || '');
    const title = note.title || 'Nota sin título';
    const score = scoreField(title, queryTerms, expandedTerms, 12)
      + scoreField(content, queryTerms, expandedTerms, 3)
      + scoreField((note.tags || []).join(' '), queryTerms, expandedTerms, 7)
      + scoreField(note.summary || '', queryTerms, expandedTerms, 6)
      + scoreField(note.audio_transcription || '', queryTerms, expandedTerms, 2)
      + scoreField(String(note.properties?.knowledge_type || '') + ' ' + String(note.para_category || ''), queryTerms, expandedTerms, 2)
      + (normalize(title).includes(normalize(query)) ? 12 : 0);
    if (score > 0) results.push({ id: note.id, type: 'note', title, contentSnippet: extractSnippet(content || note.summary || '', expandedTerms), score });
  });

  data.tasks.forEach(task => {
    const description = task.description || '';
    const score = scoreField(task.title || '', queryTerms, expandedTerms, 10)
      + scoreField(description, queryTerms, expandedTerms, 3)
      + scoreField(String(task.status || '') + ' ' + String(task.priority || ''), queryTerms, expandedTerms, 1);
    if (score > 0) results.push({ id: task.id, type: 'task', title: task.title, contentSnippet: `Estado: ${task.status}${task.due_date ? ` • Vence: ${task.due_date}` : ''}${description ? ` • ${description}` : ''}`, score });
  });

  data.objects.forEach(object => {
    const content = cleanHtmlToPlainText(object.content || '');
    const metadata = JSON.stringify(object.properties || {});
    const score = scoreField(object.title || '', queryTerms, expandedTerms, 12)
      + scoreField(object.description || '', queryTerms, expandedTerms, 5)
      + scoreField(content, queryTerms, expandedTerms, 3)
      + scoreField((object.tags || []).join(' ') + ' ' + object.object_type + ' ' + metadata, queryTerms, expandedTerms, 4);
    if (score > 0) results.push({ id: object.id, type: 'object', title: `${object.title} (${object.object_type})`, contentSnippet: object.description || extractSnippet(content, expandedTerms), score });
  });

  data.projects.forEach(project => {
    const description = project.description || '';
    const score = scoreField(project.title || '', queryTerms, expandedTerms, 10)
      + scoreField(description, queryTerms, expandedTerms, 4)
      + scoreField((project.tags || []).join(' ') + ' ' + project.status, queryTerms, expandedTerms, 2);
    if (score > 0) results.push({ id: project.id, type: 'project', title: project.title, contentSnippet: `Proyecto (${project.status}): ${description || 'Sin descripción'}`, score });
  });

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
