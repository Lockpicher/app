export interface AppProject {
  id: string;
  title: string;
  description?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  color?: string;
  icon?: string;
  start_date?: string;
  due_date?: string;
  progress: number;
  properties?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type CoverType = 'gallery' | 'custom' | 'color';

export interface AppNotebook {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  cover_url?: string;
  cover_type: CoverType;
  color: string;
  order_index: number;
  is_default: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  notes_count?: number;
}

export type NoteType = 'text' | 'image' | 'audio' | 'tasks' | 'file' | 'link';

export interface AppNote {
  id: string;
  notebook_id?: string | null;
  title: string;
  content: string;
  content_json?: Record<string, any> | null;
  plain_text?: string;
  summary?: string;
  project_id?: string;
  category?: string;
  tags?: string[];
  is_pinned?: boolean;
  is_archived?: boolean;
  is_favorite?: boolean;
  color?: string;
  icon?: string;
  note_type?: NoteType;
  thumbnail_url?: string | null;
  audio_url?: string | null;
  audio_duration?: number | null;
  audio_transcription?: string | null;
  audio_transcription_status?: 'none' | 'pending' | 'transcribing' | 'completed' | 'error';
  reminder_at?: string | null;
  reminder_status?: 'none' | 'pending' | 'completed' | 'dismissed';
  properties?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AppReminder {
  id: string;
  user_id?: string;
  note_id?: string | null;
  task_id?: string | null;
  title: string;
  description?: string;
  remind_at: string;
  timezone?: string;
  status: 'pending' | 'completed' | 'dismissed';
  created_at: string;
  updated_at: string;
}

export type EisenhowerCategory = 'none' | 'do' | 'schedule' | 'delegate' | 'delete';
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface AppTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  eisenhower?: EisenhowerCategory;
  category_id?: number | string | null;
  product_id?: number | string | null;
  due_date?: string | null;
  scheduled_date?: string | null;
  project_id?: string | null;
  note_id?: string | null;
  lista_id?: number | null;
  order_index?: number;
  parent_task_id?: string | null;
  tags?: string[];
  completed_at?: string | null;
  properties?: Record<string, any>;
  content_rich?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface KubbonetWorkspace {
  id: number;
  nombre: string;
  slug: string;
  descripcion?: string | null;
  color?: string | null;
  icono?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KubbonetSpace {
  id: number;
  workspace_id?: number;
  nombre: string;
  descripcion?: string | null;
  color?: string | null;
  icono?: string | null;
  orden: number;
  estado: string;
  created_at: string;
  updated_at: string;
}

export interface KubbonetFolder {
  id: number;
  espacio_id: number;
  nombre: string;
  descripcion?: string | null;
  color?: string | null;
  icono?: string | null;
  orden: number;
  created_at: string;
  updated_at: string;
}

export interface KubbonetList {
  id: number;
  espacio_id: number;
  carpeta_id?: number | null;
  nombre: string;
  descripcion?: string | null;
  color?: string | null;
  icono?: string | null;
  orden: number;
  created_at: string;
  updated_at: string;
}

export interface ProductCatalogItem {
  id: number | string;
  nombre: string;
  nombre_interno?: string | null;
  codigo_ml?: string | null;
  precio_base?: number | null;
  miniatura_url?: string | null;
  estado?: string | null;
}

export interface TaskCategory {
  id: number | string;
  nombre: string;
  descripcion?: string | null;
  color: string;
  orden?: number;
  es_activo?: boolean;
}

export interface AppObject {
  id: string;
  object_type: 'person' | 'meeting' | 'resource' | 'book' | 'concept' | 'custom' | string;
  title: string;
  description?: string;
  content?: string;
  project_id?: string;
  tags?: string[];
  properties?: Record<string, any>;
  color?: string;
  icon?: string;
  created_at: string;
  updated_at: string;
}

export interface AppLink {
  id: string;
  source_id: string;
  source_type: 'note' | 'task' | 'project' | 'object';
  target_id: string;
  target_type: 'note' | 'task' | 'project' | 'object';
  target_title?: string;
  link_type: 'wikilink' | 'relates_to' | 'parent_of' | 'depends_on';
  created_at: string;
}

export interface AppFolder {
  id: string;
  name: string;
  parent_id?: string | null;
  color?: string;
  icon?: string;
  created_at: string;
  updated_at: string;
}

export interface AppFileRelation {
  id: string;
  file_id: string;
  entity_id: string;
  entity_type: 'note' | 'task' | 'project' | 'object' | string;
  created_at: string;
}

export interface AppAttachment {
  id: string;
  entity_id: string;
  entity_type: 'note' | 'task' | 'project' | 'object' | 'storage_library' | 'notebook' | string;
  file_name: string;
  display_name?: string;
  file_url: string;
  file_path: string;
  r2_key?: string;
  bucket_name: string;
  storage_provider?: 'r2' | 'insforge' | 'external';
  folder_id?: string | null;
  file_size?: number;
  mime_type?: string;
  etag?: string;
  is_favorite?: boolean;
  tags?: string[];
  migration_status?: 'pending' | 'migrated' | 'verified' | 'failed';
  verified_at?: string | null;
  metadata?: Record<string, any>;
  relations?: AppFileRelation[];
  created_at: string;
}

export interface AppTag {
  id: string;
  name: string;
  color?: string;
  created_at: string;
}

export type ViewMode = 
  | 'notebooks'    // Cuadernos (Zoho Notebook style)
  | 'notes'        // Alias for compatibility
  | 'all_notes'    // Todas las notas
  | 'favorites'    // Notas favoritas
  | 'reminders'    // Recordatorios
  | 'calendar'     // Calendario Central Integrado
  | 'tasks'        // Tareas (ClickUp / Kanban)
  | 'projects'     // Proyectos
  | 'objects'      // Objetos & Entidades
  | 'graph'        // Vista de Red
  | 'files'        // Nueva sección central Archivos (Cloudflare R2)
  | 'storage';     // Almacenamiento (compatibilidad)
