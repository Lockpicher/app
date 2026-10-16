export type PARACategory = 'project' | 'area' | 'resource' | 'archive' | 'inbox';

export interface AppArea {
  id: string;
  title: string;
  name?: string; // Optional convenience alias for title
  description?: string;
  color?: string;
  icon?: string;
  order_index?: number;
  review_frequency_days?: number; // Periodicidad de revisión (ej. 7, 30, 90 días)
  last_reviewed_at?: string | null;
  next_review_at?: string | null;
  is_archived?: boolean;
  objectives?: string[];
  metrics?: Record<string, any>;
  properties?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

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
  tags?: string[];
  area_id?: string | null; // Vínculo con Área de responsabilidad (PARA)
  is_archived?: boolean; // Estado en Archivo (PARA)
  para_category?: PARACategory; // Clasificación transversal
  next_action?: string | null; // Próxima acción definida
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
  project_id?: string | null;
  category?: string;
  tags?: string[];
  area_id?: string | null; // Vínculo con Área de responsabilidad (PARA)
  para_category?: PARACategory; // Clasificación transversal (project | area | resource | archive | inbox)
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
  person_id?: string | null;
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
  area_id?: string | null; // Vínculo con Área de responsabilidad (PARA)
  para_category?: PARACategory; // Clasificación transversal
  note_id?: string | null;
  lista_id?: number | null;
  order_index?: number;
  parent_task_id?: string | null;
  tags?: string[];
  completed_at?: string | null;
  properties?: Record<string, any>;
  content_rich?: Record<string, any>;
  url?: string | null;
  thumbnail_url?: string | null;
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

export type ObjectFieldType = 
  | 'text' 
  | 'textarea' 
  | 'number' 
  | 'date' 
  | 'url' 
  | 'email' 
  | 'checkbox' 
  | 'select' 
  | 'multiselect';

export interface ObjectFieldDefinition {
  key: string;
  label: string;
  type: ObjectFieldType;
  required?: boolean;
  order?: number;
  options?: string[]; // for select / multiselect
  visible?: boolean;
  placeholder?: string;
}

export interface ObjectTypeDefinition {
  id: string; // unique slug e.g. 'podcast', 'movie', 'person'
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  category?: string;
  fields: ObjectFieldDefinition[];
  is_custom?: boolean;
  meta_id?: string; // id in app_objects table if stored as __meta_type__
}

export type RelationshipCategory = 'family' | 'work' | 'social' | 'mentor' | 'other';

export interface RelationshipTypeConfig {
  id: string; // e.g. 'hermano'
  label: string; // 'Hermano/a'
  category: RelationshipCategory;
  inverseId: string; // 'hermano'
  inverseLabel: string; // 'Hermano/a'
  isSymmetric?: boolean; // if true, A -> B implies B -> A with identical relation
}

export const RELATION_CATALOG: RelationshipTypeConfig[] = [
  // Familiar
  { id: 'pareja', label: 'Cónyuge / Pareja', category: 'family', inverseId: 'pareja', inverseLabel: 'Cónyuge / Pareja', isSymmetric: true },
  { id: 'esposo_esposa', label: 'Esposo/a', category: 'family', inverseId: 'esposo_esposa', inverseLabel: 'Esposo/a', isSymmetric: true },
  { id: 'padre_madre', label: 'Padre / Madre', category: 'family', inverseId: 'hijo_hija', inverseLabel: 'Hijo/a', isSymmetric: false },
  { id: 'hijo_hija', label: 'Hijo / Hija', category: 'family', inverseId: 'padre_madre', inverseLabel: 'Padre / Madre', isSymmetric: false },
  { id: 'hermano_hermana', label: 'Hermano/a', category: 'family', inverseId: 'hermano_hermana', inverseLabel: 'Hermano/a', isSymmetric: true },
  { id: 'abuelo_abuela', label: 'Abuelo/a', category: 'family', inverseId: 'nieto_nieta', inverseLabel: 'Nieto/a', isSymmetric: false },
  { id: 'nieto_nieta', label: 'Nieto/a', category: 'family', inverseId: 'abuelo_abuela', inverseLabel: 'Abuelo/a', isSymmetric: false },
  { id: 'tio_tia', label: 'Tío/a', category: 'family', inverseId: 'sobrino_sobrina', inverseLabel: 'Sobrino/a', isSymmetric: false },
  { id: 'sobrino_sobrina', label: 'Sobrino/a', category: 'family', inverseId: 'tio_tia', inverseLabel: 'Tío/a', isSymmetric: false },
  { id: 'primo_prima', label: 'Primo/a', category: 'family', inverseId: 'primo_prima', inverseLabel: 'Primo/a', isSymmetric: true },
  
  // Trabajo / Profesional
  { id: 'companero_trabajo', label: 'Compañero/a de Trabajo', category: 'work', inverseId: 'companero_trabajo', inverseLabel: 'Compañero/a de Trabajo', isSymmetric: true },
  { id: 'jefe_superior', label: 'Responsable / Superior', category: 'work', inverseId: 'colaborador_subordinado', inverseLabel: 'Colaborador/a directo', isSymmetric: false },
  { id: 'colaborador_subordinado', label: 'Colaborador/a directo', category: 'work', inverseId: 'jefe_superior', inverseLabel: 'Responsable / Superior', isSymmetric: false },
  { id: 'socio_negocio', label: 'Socio/a de Negocio', category: 'work', inverseId: 'socio_negocio', inverseLabel: 'Socio/a de Negocio', isSymmetric: true },
  { id: 'cliente', label: 'Cliente', category: 'work', inverseId: 'proveedor', inverseLabel: 'Proveedor / Consultor', isSymmetric: false },
  { id: 'proveedor', label: 'Proveedor / Consultor', category: 'work', inverseId: 'cliente', inverseLabel: 'Cliente', isSymmetric: false },

  // Mentoría y Conocimiento
  { id: 'mentor', label: 'Mentor/a', category: 'mentor', inverseId: 'aprendiz_mentorado', inverseLabel: 'Mentorado/a', isSymmetric: false },
  { id: 'aprendiz_mentorado', label: 'Mentorado/a', category: 'mentor', inverseId: 'mentor', inverseLabel: 'Mentor/a', isSymmetric: false },

  // Social / Amistad / Otros
  { id: 'amigo_amiga', label: 'Amigo/a cercano', category: 'social', inverseId: 'amigo_amiga', inverseLabel: 'Amigo/a cercano', isSymmetric: true },
  { id: 'conocido', label: 'Conocido/a', category: 'social', inverseId: 'conocido', inverseLabel: 'Conocido/a', isSymmetric: true },
  { id: 'otro', label: 'Relación Personal', category: 'other', inverseId: 'otro', inverseLabel: 'Relación Personal', isSymmetric: true }
];

export interface PersonRelationship {
  id: string;
  source_person_id: string;
  target_person_id: string;
  relation_type: string;
  notes?: string;
  status?: 'active' | 'historic';
  created_at: string;
  updated_at?: string;
}

export const DEFAULT_OBJECT_TYPES: ObjectTypeDefinition[] = [
  { id: 'person', name: 'Personas', icon: 'user', color: '#3b82f6', category: 'General', fields: [
    { key: 'birthday', label: 'Fecha de Cumpleaños', type: 'date', required: true },
    { key: 'rol', label: 'Rol / Cargo', type: 'text' },
    { key: 'email', label: 'Correo Electrónico', type: 'email' },
    { key: 'telefono', label: 'Teléfono', type: 'text' }
  ]},
  { id: 'page', name: 'Páginas', icon: 'file-text', color: '#6366f1', category: 'General', fields: [
    { key: 'subtitle', label: 'Subtítulo / Bajada', type: 'text' },
    { key: 'cover_url', label: 'URL de Portada', type: 'url' },
    { key: 'summary', label: 'Resumen Breve', type: 'textarea' },
    { key: 'is_pinned', label: 'Fijar en barra lateral', type: 'checkbox' }
  ]},
  { id: 'meeting', name: 'Reuniones', icon: 'calendar', color: '#f59e0b', category: 'General', fields: [
    { key: 'fecha', label: 'Fecha de Reunión', type: 'date' },
    { key: 'participantes', label: 'Participantes', type: 'text' },
    { key: 'acuerdos', label: 'Acuerdos Principales', type: 'textarea' }
  ]},
  { id: 'resource', name: 'Recursos', icon: 'link', color: '#10b981', category: 'General', fields: [
    { key: 'url', label: 'URL / Enlace', type: 'url' },
    { key: 'tipo_recurso', label: 'Tipo de Recurso', type: 'text' }
  ]},
  { id: 'book', name: 'Libros', icon: 'book', color: '#8b5cf6', category: 'Conocimiento', fields: [
    { key: 'autor', label: 'Autor', type: 'text' },
    { key: 'año', label: 'Año de Publicación', type: 'number' },
    { key: 'calificacion', label: 'Calificación (1-5)', type: 'number' }
  ]},
  { id: 'concept', name: 'Conceptos', icon: 'lightbulb', color: '#eab308', category: 'Conocimiento', fields: [
    { key: 'disciplina', label: 'Disciplina / Área', type: 'text' },
    { key: 'fuente', label: 'Fuente de Origen', type: 'text' }
  ]}
];

export type InteractionType = 'meeting' | 'call' | 'message' | 'email' | 'event' | 'note' | 'other';

export interface PersonInteraction {
  id: string;
  person_id: string;
  type: InteractionType;
  date: string; // ISO string or YYYY-MM-DD HH:mm
  summary: string;
  notes?: string;
  commitments?: string; // Compromisos adquiridos
  next_action?: string; // Próxima acción
  follow_up_date?: string | null; // Fecha de seguimiento
  file_urls?: string[];
  created_at: string;
  updated_at?: string;
}

export interface PersonCustomField {
  id: string;
  name: string;
  type: 'text' | 'date' | 'url' | 'email' | 'number' | 'select';
  value: any;
  order?: number;
  visible?: boolean;
}

export interface AppObject {
  id: string;
  object_type: 'page' | 'person' | 'meeting' | 'resource' | 'book' | 'concept' | 'custom' | string;
  title: string;
  description?: string;
  content?: string;
  project_id?: string | null;
  area_id?: string | null; // Vínculo con Área de responsabilidad (PARA)
  para_category?: PARACategory; // Clasificación transversal
  tags?: string[];
  properties?: Record<string, any>;
  color?: string;
  icon?: string;
  thumbnail_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppLink {
  id: string;
  source_id: string;
  source_type: 'note' | 'task' | 'project' | 'object' | 'area';
  target_id: string;
  target_type: 'note' | 'task' | 'project' | 'object' | 'area';
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
  // Core PARA Views
  | 'para_inbox'    // Capturar / Bandeja de Entrada Universal
  | 'para_projects' // Proyectos (Resultados con fecha límite)
  | 'para_areas'    // Áreas de Responsabilidad continua
  | 'para_resources'// Recursos de Conocimiento
  | 'para_archives' // Archivo Histórico
  | 'para_review'   // Revisiones periódicas
  // Functional views
  | 'notebooks'    // Cuadernos (Zoho Notebook style)
  | 'notes'        // Alias for compatibility
  | 'all_notes'    // Todas las notas
  | 'favorites'    // Notas favoritas
  | 'reminders'    // Recordatorios
  | 'calendar'     // Calendario Central Integrado
  | 'tasks'        // Tareas (ClickUp / Kanban)
  | 'projects'     // Proyectos (Alias / Vista específica)
  | 'objects'      // Objetos & Entidades
  | 'graph'        // Vista de Red
  | 'files'        // Sección central Archivos (Cloudflare R2)
  | 'storage';     // Almacenamiento (compatibilidad)
