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
  is_locked?: boolean;
  password_hash?: string | null;
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
  is_locked?: boolean;
  password_hash?: string | null;
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
  | 'phone'
  | 'relation'
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
  target_type?: string; // for 'relation' type: e.g. 'company', 'project', 'person'
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
    { key: 'rol', label: 'Cargo / Rol', type: 'text' },
    { key: 'email', label: 'Correo Electrónico', type: 'email' },
    { key: 'telefono', label: 'Teléfono', type: 'phone' },
    { key: 'birthday', label: 'Fecha de Cumpleaños', type: 'date', required: false },
    { key: 'empresa_id', label: 'Empresa', type: 'relation', target_type: 'company' }
  ]},
  { id: 'company', name: 'Empresas', icon: 'building-2', color: '#0ea5e9', category: 'General', fields: [
    { key: 'sector', label: 'Sector / Industria', type: 'text' },
    { key: 'website', label: 'Sitio Web', type: 'url' },
    { key: 'ubicacion', label: 'Ubicación / Ciudad', type: 'text' }
  ]},
  { id: 'page', name: 'Páginas', icon: 'file-text', color: '#6366f1', category: 'General', fields: [
    { key: 'subtitle', label: 'Subtítulo / Bajada', type: 'text' },
    { key: 'source_url', label: 'URL de Origen', type: 'url' },
    { key: 'site_name', label: 'Sitio Web / Fuente', type: 'text' },
    { key: 'cover_url', label: 'URL de Portada', type: 'url' },
    { key: 'summary', label: 'Resumen Breve', type: 'textarea' },
    { key: 'is_pinned', label: 'Fijar en barra lateral', type: 'checkbox' }
  ]},
  { id: 'meeting', name: 'Reuniones', icon: 'calendar', color: '#f59e0b', category: 'General', fields: [
    { key: 'fecha', label: 'Fecha de Reunión', type: 'date' },
    { key: 'participantes', label: 'Participantes', type: 'text' },
    { key: 'acuerdos', label: 'Acuerdos Principales', type: 'textarea' },
    { key: 'proyecto_id', label: 'Proyecto', type: 'relation', target_type: 'project' }
  ]},
  { id: 'resource', name: 'Recursos', icon: 'link', color: '#10b981', category: 'General', fields: [
    { key: 'url', label: 'URL / Enlace', type: 'url' },
    { key: 'tipo_recurso', label: 'Tipo de Recurso', type: 'text' }
  ]},
  { id: 'book', name: 'Libros', icon: 'book', color: '#8b5cf6', category: 'Conocimiento', fields: [
    { key: 'autor', label: 'Autor', type: 'text' },
    { key: 'subtitulo', label: 'Subtítulo', type: 'text' },
    { key: 'editorial', label: 'Editorial', type: 'text' },
    { key: 'año', label: 'Año de Publicación', type: 'number' },
    { key: 'isbn', label: 'ISBN', type: 'text' },
    { key: 'idioma', label: 'Idioma', type: 'text' },
    { key: 'genero', label: 'Género / Categoría', type: 'text' },
    { key: 'formato', label: 'Formato', type: 'select', options: ['Físico', 'PDF', 'EPUB', 'Audiolibro', 'Otro'] },
    { key: 'reading_status', label: 'Estado de Lectura', type: 'select', options: ['Por Leer', 'Leyendo', 'Pausado', 'Terminado', 'Abandonado'] },
    { key: 'total_pages', label: 'Total de Páginas', type: 'number' },
    { key: 'current_page', label: 'Página Actual', type: 'number' },
    { key: 'calificacion', label: 'Calificación (1-5)', type: 'number' },
    { key: 'started_at', label: 'Fecha de Inicio', type: 'date' },
    { key: 'finished_at', label: 'Fecha de Finalización', type: 'date' }
  ]},
  { id: 'concept', name: 'Conceptos', icon: 'lightbulb', color: '#eab308', category: 'Conocimiento', fields: [
    { key: 'disciplina', label: 'Disciplina / Área', type: 'text' },
    { key: 'fuente', label: 'Fuente de Origen', type: 'text' }
  ]},
  { id: 'atomic_note', name: 'Notas Atómicas', icon: 'atom', color: '#06b6d4', category: 'Conocimiento', fields: [
    { key: 'resumen', label: 'Tesis / Idea Central', type: 'textarea' },
    { key: 'fuente', label: 'Fuente o Referencia', type: 'text' },
    { key: 'palabras_clave', label: 'Palabras Clave', type: 'text' },
    { key: 'disciplina', label: 'Disciplina / Área', type: 'text' }
  ]},
  { id: 'trip', name: 'Viajes', icon: 'plane', color: '#14b8a6', category: 'Personal', fields: [
    { key: 'destino', label: 'Destino / Ciudad', type: 'text' },
    { key: 'fecha_inicio', label: 'Fecha de Salida', type: 'date' },
    { key: 'fecha_fin', label: 'Fecha de Regreso', type: 'date' },
    { key: 'estado', label: 'Estado del Viaje', type: 'select', options: ['Por Planificar', 'En Curso', 'Completado'] },
    { key: 'presupuesto', label: 'Presupuesto Estimado', type: 'number' },
    { key: 'alojamiento', label: 'Alojamiento / Hospedaje', type: 'text' },
    { key: 'itinerario', label: 'Itinerario / Resumen', type: 'textarea' }
  ]},
  { id: 'idea', name: 'Ideas', icon: 'sparkles', color: '#f59e0b', category: 'Conocimiento', fields: [
    { key: 'descripcion', label: 'Descripción de la Idea', type: 'textarea' },
    { key: 'estado', label: 'Fase / Estado', type: 'select', options: ['Capturada', 'En Análisis', 'En Desarrollo', 'Descartada', 'Archivada'] },
    { key: 'impacto', label: 'Impacto Estimado (1-5)', type: 'number' },
    { key: 'viabilidad', label: 'Viabilidad (1-5)', type: 'number' },
    { key: 'proyecto_id', label: 'Proyecto Asociado', type: 'relation', target_type: 'project' }
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

// ==========================================
// BOOK & KNOWLEDGE LIBRARY TYPES
// ==========================================

export type BookReadingStatus = 'want_to_read' | 'reading' | 'paused' | 'finished' | 'abandoned';
export type BookFormat = 'physical' | 'pdf' | 'epub' | 'audiobook' | 'other';

export interface BookIdea {
  id: string;
  book_id: string;
  title: string;
  content: string;
  page?: number | null;
  chapter?: string;
  tags?: string[];
  created_at: string;
  updated_at?: string;
}

export interface BookQuote {
  id: string;
  book_id: string;
  quote_text: string;
  author?: string;
  page?: number | null;
  chapter?: string;
  commentary?: string;
  tags?: string[];
  created_at: string;
  updated_at?: string;
}

// ==========================================
// TRIP MANAGER TYPES (Gestor Integral de Viajes)
// ==========================================

export type TripTransportType = 
  | 'moto' 
  | 'carro' 
  | 'bicicleta' 
  | 'transporte_publico' 
  | 'avion' 
  | 'barco' 
  | 'caminata' 
  | 'multidestino' 
  | 'otro';

export type TripStatus = 'idea' | 'planeado' | 'en_curso' | 'completado' | 'cancelado';

export type TripExpenseCategory = 
  | 'transporte' 
  | 'combustible' 
  | 'peajes' 
  | 'alojamiento' 
  | 'alimentacion' 
  | 'actividades' 
  | 'parqueadero' 
  | 'mantenimiento' 
  | 'compras' 
  | 'otros';

export interface AppTripLeg {
  id: string;
  trip_id: string;
  transport_type: TripTransportType;
  transport_custom?: string | null;
  vehicle_id?: string | null;
  origin: string;
  destination: string;
  departure_time?: string | null;
  arrival_time?: string | null;
  distance: number;
  distance_unit: 'km' | 'mi';
  distance_source: 'odometer' | 'estimated' | 'manual';
  odometer_start?: number | null;
  odometer_end?: number | null;
  fuel_amount?: number | null;
  fuel_unit?: string | null;
  fuel_cost?: number | null;
  maps_url?: string | null;
  notes?: string | null;
  order_index?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AppTripStop {
  id: string;
  trip_id: string;
  name: string;
  location?: string | null;
  scheduled_time?: string | null;
  actual_time?: string | null;
  duration?: string | null;
  status: 'pending' | 'completed' | 'skipped';
  notes?: string | null;
  maps_url?: string | null;
  file_urls?: string[];
  order_index?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AppTripExpense {
  id: string;
  trip_id: string;
  concept: string;
  category: TripExpenseCategory;
  amount: number;
  currency: string;
  expense_date: string;
  payment_method?: string | null;
  vendor?: string | null;
  leg_id?: string | null;
  stop_id?: string | null;
  receipt_url?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AppTripJournal {
  id: string;
  trip_id: string;
  title: string;
  entry_date: string;
  content: string;
  mood?: string | null;
  location?: string | null;
  image_urls?: string[];
  created_at?: string;
  updated_at?: string;
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

export type EntityType = 'object' | 'project' | 'note' | 'task' | 'area';

export interface AppLink {
  id: string;
  from_id: string;
  from_type: EntityType;
  to_id: string;
  to_type: EntityType;
  relation_label: string; // e.g. 'project', 'company', 'mention', 'related', 'parent_of'
  created_at: string;

  // Compatibility aliases for legacy code
  source_id?: string;
  source_type?: EntityType;
  target_id?: string;
  target_type?: EntityType;
  target_title?: string;
  link_type?: string;
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

export interface AppHabit {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  frequency: 'daily' | 'weekdays' | 'weekends' | 'custom';
  frequency_days: number[]; // 1=Lunes, 2=Martes... 7=Domingo
  target_per_day?: number;
  start_date: string; // YYYY-MM-DD
  end_date?: string | null;
  reminder_time?: string | null; // HH:mm
  is_archived?: boolean;
  order_index?: number;
  properties?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type HabitLogStatus = 'completed' | 'skipped';

export interface AppHabitLog {
  id: string;
  habit_id: string;
  date: string; // YYYY-MM-DD
  status: HabitLogStatus;
  notes?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AppCanvas {
  id: string;
  title: string;
  description?: string;
  elements: any[];
  app_state: Record<string, any>;
  files: Record<string, any>;
  thumbnail_url?: string | null;
  notebook_id?: string | null;
  project_id?: string | null;
  area_id?: string | null;
  para_category?: PARACategory;
  tags?: string[];
  is_favorite?: boolean;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
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
  | 'home'         // Vista Principal / Dashboard de Inicio
  | 'habits'       // Módulo de Hábitos y Seguimiento
  | 'notebooks'    // Cuadernos (Zoho Notebook style)
  | 'canvases'     // Módulo de Lienzos visuales (Excalidraw)
  | 'canvas'       // Vista/Editor de Lienzo
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

// ==========================================
// AI ASSISTANT TYPES (Evernote-style)
// ==========================================
export type AIMode = 'ask' | 'edit';

export interface AIProviderStatus {
  configured: boolean;
  provider: 'gemini' | 'openrouter' | 'xiaomi_mimo' | null;
  model: string;
  availableModels: string[];
  missingKey?: string;
  baseUrl?: string;
}

export interface AIContextData {
  type: 'note' | 'task' | 'book' | 'trip' | 'object' | 'page' | 'canvas' | 'general';
  id?: string;
  title?: string;
  content?: string;
  selectedText?: string;
  notebookTitle?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  applyEdit?: (proposed: string, mode: 'replace_all' | 'replace_selection' | 'insert_at_cursor' | 'append') => Promise<void> | void;
}

export interface AIProposedEdit {
  action: 'replace_all' | 'replace_selection' | 'insert_at_cursor' | 'append';
  originalSnippet?: string;
  replacementSnippet: string;
  summary: string;
}

export interface AIToolAction {
  tool: 'create_note' | 'update_note' | 'create_task' | 'mark_favorite' | 'create_idea' | 'link_entities';
  description: string;
  parameters: Record<string, any>;
}

export interface AIReference {
  id: string;
  type: 'note' | 'task' | 'book' | 'object' | 'page';
  title: string;
  excerpt?: string;
}

export interface AIConversation {
  id: string;
  title: string;
  context_type?: string;
  context_id?: string | null;
  context_title?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  mode?: AIMode;
  tool_calls?: any;
  tool_call_id?: string;
  proposed_diff?: AIProposedEdit | null;
  references_used?: AIReference[] | null;
  created_at: string;
}


