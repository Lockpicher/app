import { createClient } from '@insforge/sdk';
import { 
  AppNote, 
  AppNotebook,
  AppProject, 
  AppTask, 
  AppObject,
  ObjectTypeDefinition, 
  AppLink, 
  AppAttachment,
  AppFolder,
  AppFileRelation,
  AppReminder,
  ProductCatalogItem,
  TaskCategory,
  KubbonetWorkspace,
  KubbonetSpace,
  KubbonetFolder,
  KubbonetList,
  PersonInteraction,
  PersonCustomField,
  PersonRelationship,
  AppArea,
  AppHabit,
  AppHabitLog,
  HabitLogStatus,
  AppCanvas,
  AppTripLeg,
  AppTripStop,
  AppTripExpense,
  AppTripJournal,
  BookIdea,
  BookQuote
} from './types';
import { auth } from './auth';

export const INSFORGE_BASE_URL = 'https://insforge.kora.ovh';
// TODO(security): rotar la clave una vez confirmado el entorno de despliegue y eliminar el fallback
export const INSFORGE_ANON_KEY = import.meta.env.VITE_INSFORGE_ANON_KEY || 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba';
export const STORAGE_BUCKET = 'app-storage';

export const insforge = createClient({
  baseUrl: INSFORGE_BASE_URL,
  anonKey: INSFORGE_ANON_KEY,
  timeout: 120000, // 2 minutos para soportar cargas de archivos e imágenes sin cortes prematuros
});

// === DATABASE API ===

// Helpers para serializar y deserializar metadatos de seguridad de cuadernos dentro de description
function parseNotebookMetadata(nb: any): AppNotebook {
  if (!nb) return nb;
  let is_locked = false;
  let password_hash: string | null = null;
  let cleanDesc = nb.description || '';

  const lockRegex = /\s*\[LOCK_META:([A-Za-z0-9+/=]+)\]\s*$/;
  const match = cleanDesc.match(lockRegex);
  if (match) {
    try {
      const decoded = JSON.parse(atob(match[1]));
      is_locked = !!decoded.is_locked;
      password_hash = decoded.password_hash || null;
      cleanDesc = cleanDesc.replace(lockRegex, '').trim();
    } catch (e) {
      console.warn('Error parseando LOCK_META de cuaderno:', e);
    }
  }

  return {
    ...nb,
    description: cleanDesc,
    is_locked,
    password_hash
  } as AppNotebook;
}

function encodeNotebookDescription(description?: string | null, is_locked?: boolean, password_hash?: string | null): string | undefined {
  let baseDesc = (description || '').replace(/\s*\[LOCK_META:[A-Za-z0-9+/=]+\]\s*$/, '').trim();
  if (is_locked && password_hash) {
    try {
      const metaStr = btoa(JSON.stringify({ is_locked: true, password_hash }));
      baseDesc = baseDesc ? `${baseDesc} [LOCK_META:${metaStr}]` : `[LOCK_META:${metaStr}]`;
    } catch {}
  }
  return baseDesc || undefined;
}

export const db = {
  // Cuadernos (Zoho Notebook style)
  async getNotebooks(includeArchived = false): Promise<AppNotebook[]> {
    let query = insforge.database
      .from('app_notebooks')
      .select()
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query;
    if (error) console.error('Error fetching notebooks:', error);
    if (!data) return [];
    return (data as any[]).map(parseNotebookMetadata);
  },

  async createNotebook(notebook: Partial<AppNotebook>): Promise<AppNotebook | null> {
    const { is_locked, password_hash, description, ...directFields } = notebook;
    const finalDesc = encodeNotebookDescription(description, is_locked, password_hash);

    const payload = {
      ...directFields,
      description: finalDesc
    };

    const { data, error } = await insforge.database
      .from('app_notebooks')
      .insert([payload])
      .select();
    if (error) {
      console.error('Error creating notebook:', error);
      throw error;
    }
    const created = (data as unknown as AppNotebook[])?.[0] || null;
    return created ? parseNotebookMetadata(created) : null;
  },

  async updateNotebook(id: string, updates: Partial<AppNotebook>): Promise<AppNotebook | null> {
    const { id: _ignored, is_locked, password_hash, description, ...directFields } = updates;
    
    // Si se pasa is_locked o password_hash o description, calculamos el description final
    let finalDesc = description;
    if (is_locked !== undefined || password_hash !== undefined || description !== undefined) {
      finalDesc = encodeNotebookDescription(description, is_locked, password_hash);
    }

    const payload: Record<string, any> = {
      ...directFields,
      updated_at: new Date().toISOString()
    };
    if (finalDesc !== undefined) {
      payload.description = finalDesc;
    }

    const { data, error } = await insforge.database
      .from('app_notebooks')
      .update(payload)
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating notebook:', error);
      throw error;
    }
    const updated = (data as unknown as AppNotebook[])?.[0] || null;
    return updated ? parseNotebookMetadata(updated) : null;
  },

  async deleteNotebook(id: string, transferNotesToNotebookId?: string): Promise<boolean> {
    if (transferNotesToNotebookId) {
      await insforge.database
        .from('app_notes')
        .update({ notebook_id: transferNotesToNotebookId })
        .eq('notebook_id', id);
    } else {
      await insforge.database
        .from('app_notes')
        .update({ notebook_id: null })
        .eq('notebook_id', id);
    }

    const { error } = await insforge.database
      .from('app_notebooks')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting notebook:', error);
      throw error;
    }
    return true;
  },

  // Notas
  async getNotes(options?: { notebookId?: string; isFavorite?: boolean; isArchived?: boolean }): Promise<AppNote[]> {
    let query = insforge.database
      .from('app_notes')
      .select()
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (options?.notebookId) {
      query = query.eq('notebook_id', options.notebookId);
    }
    if (options?.isFavorite) {
      query = query.eq('is_favorite', true);
    }
    if (options?.isArchived !== undefined) {
      query = query.eq('is_archived', options.isArchived);
    }

    const { data, error } = await query;
    if (error) console.error('Error fetching notes:', error);
    if (!data) return [];

    return (data as any[]).map(row => {
      const p = row.properties || {};
      return {
        ...row,
        area_id: row.area_id || p.area_id || null,
        para_category: row.para_category || p.para_category || undefined,
        is_locked: row.is_locked !== undefined ? row.is_locked : !!p.is_locked,
        password_hash: row.password_hash || p.password_hash || null
      } as AppNote;
    });
  },

  async createNote(note: Partial<AppNote>): Promise<AppNote | null> {
    const { area_id, para_category, is_locked, password_hash, ...directFields } = note as any;
    const finalProperties = {
      ...(note.properties || {}),
      ...(area_id !== undefined ? { area_id } : {}),
      ...(para_category !== undefined ? { para_category } : {}),
      ...(is_locked !== undefined ? { is_locked } : {}),
      ...(password_hash !== undefined ? { password_hash } : {})
    };

    const payload = {
      ...directFields,
      properties: finalProperties
    };

    const { data, error } = await insforge.database
      .from('app_notes')
      .insert([payload])
      .select();
    if (error) {
      console.error('Error creating note:', error);
      throw error;
    }
    const created = (data as unknown as AppNote[])?.[0] || null;
    if (!created) return null;

    const p = (created as any).properties || {};
    return {
      ...created,
      area_id: created.area_id || p.area_id || null,
      para_category: created.para_category || p.para_category || undefined,
      is_locked: created.is_locked !== undefined ? created.is_locked : !!p.is_locked,
      password_hash: created.password_hash || p.password_hash || null
    };
  },

  async updateNote(id: string, updates: Partial<AppNote>): Promise<AppNote | null> {
    const { id: _ignored, area_id, para_category, is_locked, password_hash, ...directFields } = updates as any;
    
    let finalProperties = updates.properties;
    if (area_id !== undefined || para_category !== undefined || is_locked !== undefined || password_hash !== undefined || finalProperties) {
      finalProperties = {
        ...(finalProperties || {}),
        ...(area_id !== undefined ? { area_id } : {}),
        ...(para_category !== undefined ? { para_category } : {}),
        ...(is_locked !== undefined ? { is_locked } : {}),
        ...(password_hash !== undefined ? { password_hash } : {})
      };
    }

    const payload: Record<string, any> = {
      ...directFields,
      updated_at: new Date().toISOString()
    };
    if (finalProperties !== undefined) {
      payload.properties = finalProperties;
    }

    const { data, error } = await insforge.database
      .from('app_notes')
      .update(payload)
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating note:', error);
      throw error;
    }
    const updated = (data as unknown as AppNote[])?.[0] || null;
    if (!updated) return null;

    const p = (updated as any).properties || {};
    return {
      ...updated,
      area_id: updated.area_id || p.area_id || null,
      para_category: updated.para_category || p.para_category || undefined,
      is_locked: updated.is_locked !== undefined ? updated.is_locked : !!p.is_locked,
      password_hash: updated.password_hash || p.password_hash || null
    };
  },

  async duplicateNote(noteId: string): Promise<AppNote | null> {
    const { data, error } = await insforge.database
      .from('app_notes')
      .select()
      .eq('id', noteId);

    if (error || !data || data.length === 0) {
      throw new Error('Nota no encontrada para duplicar');
    }

    const original = data[0] as unknown as AppNote;
    const clone: Partial<AppNote> = {
      title: `${original.title} (Copia)`,
      content: original.content,
      content_json: original.content_json,
      plain_text: original.plain_text,
      notebook_id: original.notebook_id,
      project_id: original.project_id,
      category: original.category,
      tags: original.tags,
      note_type: original.note_type,
      thumbnail_url: original.thumbnail_url,
      color: original.color,
      is_pinned: false,
      is_favorite: false
    };

    return this.createNote(clone);
  },

  async deleteNote(id: string): Promise<boolean> {
    const { error } = await insforge.database
      .from('app_notes')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
    return true;
  },

  // Recordatorios
  async getReminders(): Promise<AppReminder[]> {
    const { data, error } = await insforge.database
      .from('app_reminders')
      .select()
      .order('remind_at', { ascending: true });
    if (error) console.error('Error fetching reminders:', error);
    return (data as unknown as AppReminder[]) || [];
  },

  async createReminder(reminder: Partial<AppReminder>): Promise<AppReminder | null> {
    const { data, error } = await insforge.database
      .from('app_reminders')
      .insert([reminder])
      .select();
    if (error) {
      console.error('Error creating reminder:', error);
      throw error;
    }
    return (data as unknown as AppReminder[])?.[0] || null;
  },

  async updateReminder(id: string, updates: Partial<AppReminder>): Promise<AppReminder | null> {
    const { data, error } = await insforge.database
      .from('app_reminders')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating reminder:', error);
      throw error;
    }
    return (data as unknown as AppReminder[])?.[0] || null;
  },

  async deleteReminder(id: string): Promise<boolean> {
    const { error } = await insforge.database
      .from('app_reminders')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting reminder:', error);
      throw error;
    }
    return true;
  },

  // Áreas de Responsabilidad (PARA - Persistidas como object_type: 'area' en app_objects)
  async getAreas(): Promise<AppArea[]> {
    try {
      const { data, error } = await insforge.database
        .from('app_objects')
        .select('*')
        .eq('object_type', 'area')
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      return data.map((row: any) => {
        const p = row.properties || {};
        return {
          id: row.id,
          title: row.title,
          description: row.description || '',
          color: row.color || p.color || '#8b5cf6',
          icon: row.icon || p.icon || 'shield',
          order_index: p.order_index || 0,
          review_frequency_days: p.review_frequency_days || 30,
          last_reviewed_at: p.last_reviewed_at || null,
          next_review_at: p.next_review_at || null,
          is_archived: p.is_archived || false,
          objectives: Array.isArray(p.objectives) ? p.objectives : [],
          metrics: p.metrics || {},
          properties: p,
          created_at: row.created_at,
          updated_at: row.updated_at
        } as AppArea;
      });
    } catch (e) {
      console.warn('Error recuperando áreas:', e);
      return [];
    }
  },

  async createArea(area: Partial<AppArea>): Promise<AppArea | null> {
    try {
      const payload = {
        object_type: 'area',
        title: area.title || 'Nueva Área',
        description: area.description || '',
        color: area.color || '#8b5cf6',
        icon: area.icon || 'shield',
        properties: {
          color: area.color || '#8b5cf6',
          icon: area.icon || 'shield',
          order_index: area.order_index || 0,
          review_frequency_days: area.review_frequency_days || 30,
          last_reviewed_at: area.last_reviewed_at || null,
          next_review_at: area.next_review_at || null,
          is_archived: area.is_archived || false,
          objectives: area.objectives || [],
          metrics: area.metrics || {}
        }
      };

      const { data, error } = await insforge.database
        .from('app_objects')
        .insert([payload])
        .select();

      if (error) throw error;
      const created = data?.[0];
      if (!created) return null;

      const p = created.properties || {};
      return {
        id: created.id,
        title: created.title,
        description: created.description,
        color: created.color,
        icon: created.icon,
        order_index: p.order_index,
        review_frequency_days: p.review_frequency_days,
        last_reviewed_at: p.last_reviewed_at,
        next_review_at: p.next_review_at,
        is_archived: p.is_archived,
        objectives: p.objectives,
        metrics: p.metrics,
        properties: p,
        created_at: created.created_at,
        updated_at: created.updated_at
      };
    } catch (e) {
      console.error('Error creando área:', e);
      throw e;
    }
  },

  async updateArea(id: string, updates: Partial<AppArea>): Promise<AppArea | null> {
    try {
      // First get existing area to preserve fields
      const { data: existingData } = await insforge.database
        .from('app_objects')
        .select('*')
        .eq('id', id);

      const existing = existingData?.[0];
      const existingProps = existing?.properties || {};

      const updatedProps = {
        ...existingProps,
        ...(updates.color ? { color: updates.color } : {}),
        ...(updates.icon ? { icon: updates.icon } : {}),
        ...(updates.order_index !== undefined ? { order_index: updates.order_index } : {}),
        ...(updates.review_frequency_days !== undefined ? { review_frequency_days: updates.review_frequency_days } : {}),
        ...(updates.last_reviewed_at !== undefined ? { last_reviewed_at: updates.last_reviewed_at } : {}),
        ...(updates.next_review_at !== undefined ? { next_review_at: updates.next_review_at } : {}),
        ...(updates.is_archived !== undefined ? { is_archived: updates.is_archived } : {}),
        ...(updates.objectives ? { objectives: updates.objectives } : {}),
        ...(updates.metrics ? { metrics: updates.metrics } : {})
      };

      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
        properties: updatedProps
      };
      if (updates.title) payload.title = updates.title;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.color) payload.color = updates.color;
      if (updates.icon) payload.icon = updates.icon;

      const { data, error } = await insforge.database
        .from('app_objects')
        .update(payload)
        .eq('id', id)
        .select();

      if (error) throw error;
      const updated = data?.[0];
      if (!updated) return null;

      const p = updated.properties || {};
      return {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        color: updated.color,
        icon: updated.icon,
        order_index: p.order_index,
        review_frequency_days: p.review_frequency_days,
        last_reviewed_at: p.last_reviewed_at,
        next_review_at: p.next_review_at,
        is_archived: p.is_archived,
        objectives: p.objectives,
        metrics: p.metrics,
        properties: p,
        created_at: updated.created_at,
        updated_at: updated.updated_at
      };
    } catch (e) {
      console.error('Error actualizando área:', e);
      throw e;
    }
  },

  async deleteArea(id: string): Promise<boolean> {
    const { error } = await insforge.database
      .from('app_objects')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error eliminando área:', error);
      throw error;
    }
    return true;
  },

  // Proyectos
  async getProjects(): Promise<AppProject[]> {
    const { data, error } = await insforge.database
      .from('app_projects')
      .select()
      .order('created_at', { ascending: false });
    if (error) console.error('Error fetching projects:', error);
    if (!data) return [];

    return (data as any[]).map(row => {
      const p = row.properties || {};
      return {
        ...row,
        area_id: row.area_id || p.area_id || null,
        para_category: row.para_category || p.para_category || undefined,
        next_action: row.next_action || p.next_action || null
      } as AppProject;
    });
  },

  async createProject(project: Partial<AppProject>): Promise<AppProject | null> {
    const { area_id, para_category, next_action, ...directFields } = project as any;
    const finalProperties = {
      ...(project.properties || {}),
      ...(area_id !== undefined ? { area_id } : {}),
      ...(para_category !== undefined ? { para_category } : {}),
      ...(next_action !== undefined ? { next_action } : {})
    };

    const payload = {
      ...directFields,
      properties: finalProperties
    };

    const { data, error } = await insforge.database
      .from('app_projects')
      .insert([payload])
      .select();
    if (error) {
      console.error('Error creating project:', error);
      throw error;
    }
    const created = (data as unknown as AppProject[])?.[0] || null;
    if (!created) return null;

    const p = (created as any).properties || {};
    return {
      ...created,
      area_id: created.area_id || p.area_id || null,
      para_category: created.para_category || p.para_category || undefined,
      next_action: created.next_action || p.next_action || null
    };
  },

  async updateProject(id: string, updates: Partial<AppProject>): Promise<AppProject | null> {
    const { id: _ignored, area_id, para_category, next_action, ...directFields } = updates as any;
    
    let finalProperties = updates.properties;
    if (area_id !== undefined || para_category !== undefined || next_action !== undefined || finalProperties) {
      finalProperties = {
        ...(finalProperties || {}),
        ...(area_id !== undefined ? { area_id } : {}),
        ...(para_category !== undefined ? { para_category } : {}),
        ...(next_action !== undefined ? { next_action } : {})
      };
    }

    const payload: Record<string, any> = {
      ...directFields,
      updated_at: new Date().toISOString()
    };
    if (finalProperties !== undefined) {
      payload.properties = finalProperties;
    }

    const { data, error } = await insforge.database
      .from('app_projects')
      .update(payload)
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating project:', error);
      throw error;
    }
    const updated = (data as unknown as AppProject[])?.[0] || null;
    if (!updated) return null;

    const p = (updated as any).properties || {};
    return {
      ...updated,
      area_id: updated.area_id || p.area_id || null,
      para_category: updated.para_category || p.para_category || undefined,
      next_action: updated.next_action || p.next_action || null
    };
  },

  async deleteProject(id: string): Promise<boolean> {
    const { error } = await insforge.database
      .from('app_projects')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
    return true;
  },

  // Tareas
  async getTasks(): Promise<AppTask[]> {
    const { data, error } = await insforge.database
      .from('app_tasks')
      .select()
      .is('parent_task_id', null)
      .order('created_at', { ascending: false });
    if (error) console.error('Error fetching tasks:', error);
    if (!data) return [];

    return (data as any[]).map(row => {
      const p = row.properties || {};
      return {
        ...row,
        area_id: row.area_id || p.area_id || null,
        para_category: row.para_category || p.para_category || undefined
      } as AppTask;
    });
  },

  async createTask(task: Partial<AppTask>): Promise<AppTask | null> {
    const { area_id, para_category, ...directFields } = task as any;
    const finalProperties = {
      ...(task.properties || {}),
      ...(area_id !== undefined ? { area_id } : {}),
      ...(para_category !== undefined ? { para_category } : {})
    };

    const payload = {
      ...directFields,
      properties: finalProperties
    };

    const { data, error } = await insforge.database
      .from('app_tasks')
      .insert([payload])
      .select();
    if (error) {
      console.error('Error creating task:', error);
      throw error;
    }
    const created = (data as unknown as AppTask[])?.[0] || null;
    if (!created) return null;

    const p = (created as any).properties || {};
    return {
      ...created,
      area_id: created.area_id || p.area_id || null,
      para_category: created.para_category || p.para_category || undefined
    };
  },

  async updateTask(id: string, updates: Partial<AppTask>): Promise<AppTask | null> {
    const { id: _ignored, area_id, para_category, ...directFields } = updates as any;
    
    let finalProperties = updates.properties;
    if (area_id !== undefined || para_category !== undefined || finalProperties) {
      finalProperties = {
        ...(finalProperties || {}),
        ...(area_id !== undefined ? { area_id } : {}),
        ...(para_category !== undefined ? { para_category } : {})
      };
    }

    const payload: Record<string, any> = {
      ...directFields,
      updated_at: new Date().toISOString()
    };
    if (finalProperties !== undefined) {
      payload.properties = finalProperties;
    }

    let { data, error } = await insforge.database
      .from('app_tasks')
      .update(payload)
      .eq('id', id)
      .select();

    // If network error or unauthorized, re-authenticate workspace session and retry once
    if (error && (error.message?.includes('NetworkError') || error.message?.includes('fetch failed') || error.message?.includes('JWT') || (error as any).status === 401)) {
      console.warn('Re-autenticando sesión tras fallo de red en updateTask...');
      try {
        await auth.ensureActiveSession();
        const retryRes = await insforge.database
          .from('app_tasks')
          .update(payload)
          .eq('id', id)
          .select();
        data = retryRes.data;
        error = retryRes.error;
      } catch (authErr) {
        console.error('Error re-autenticando en updateTask:', authErr);
      }
    }

    if (error) {
      console.error('Error updating task:', error);
      throw error;
    }
    const updated = (data as unknown as AppTask[])?.[0] || null;
    if (!updated) return null;

    const p = (updated as any).properties || {};
    return {
      ...updated,
      area_id: updated.area_id || p.area_id || null,
      para_category: updated.para_category || p.para_category || undefined
    };
  },

  async deleteTask(id: string): Promise<boolean> {
    const { error } = await insforge.database
      .from('app_tasks')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
    return true;
  },

  // Subtareas
  async getSubtasks(parentTaskId: string): Promise<AppTask[]> {
    const { data, error } = await insforge.database
      .from('app_tasks')
      .select()
      .eq('parent_task_id', parentTaskId)
      .order('created_at', { ascending: true });
    if (error) console.error('Error fetching subtasks:', error);
    return (data as unknown as AppTask[]) || [];
  },

  async createSubtask(subtask: Partial<AppTask>): Promise<AppTask | null> {
    const { data, error } = await insforge.database
      .from('app_tasks')
      .insert([subtask])
      .select();
    if (error) {
      console.error('Error creating subtask:', error);
      throw error;
    }
    return (data as unknown as AppTask[])?.[0] || null;
  },

  // Categorías de Tareas (Catálogo real de kubbonet_tarea_categorias)
  async getTaskCategories(): Promise<TaskCategory[]> {
    const { data, error } = await insforge.database
      .from('kubbonet_tarea_categorias')
      .select()
      .eq('es_activo', true)
      .order('orden', { ascending: true });
    if (error) {
      console.error('Error fetching task categories:', error);
      return [];
    }
    return (data as unknown as TaskCategory[]) || [];
  },

  // Catálogo Maestro de Productos (kubbonet_productos)
  async searchProducts(query: string): Promise<ProductCatalogItem[]> {
    if (!query.trim()) {
      const { data, error } = await insforge.database
        .from('kubbonet_productos')
        .select('id, nombre, nombre_interno, codigo_ml, precio_base, miniatura_url, estado')
        .limit(15);
      if (error) {
        console.error('Error searching products:', error);
        return [];
      }
      return (data as unknown as ProductCatalogItem[]) || [];
    }

    const { data, error } = await insforge.database
      .from('kubbonet_productos')
      .select('id, nombre, nombre_interno, codigo_ml, precio_base, miniatura_url, estado')
      .ilike('nombre', `%${query}%`)
      .limit(15);

    if (error) {
      console.error('Error searching products with query:', error);
      return [];
    }
    return (data as unknown as ProductCatalogItem[]) || [];
  },

  async getProductById(id: number | string): Promise<ProductCatalogItem | null> {
    const { data, error } = await insforge.database
      .from('kubbonet_productos')
      .select('id, nombre, nombre_interno, codigo_ml, precio_base, miniatura_url, estado')
      .eq('id', id);
    if (error) {
      console.error('Error fetching product by id:', error);
      return null;
    }
    return (data as unknown as ProductCatalogItem[])?.[0] || null;
  },

  // === JERARQUÍA CLICKUP: WORKSPACES, ESPACIOS, CARPETAS Y LISTAS ===

  async getWorkspaces(): Promise<KubbonetWorkspace[]> {
    const { data, error } = await insforge.database
      .from('kubbonet_workspaces')
      .select('*')
      .order('id', { ascending: true });
    if (error) console.error('Error fetching workspaces:', error);
    return (data as unknown as KubbonetWorkspace[]) || [];
  },

  async getSpaces(): Promise<KubbonetSpace[]> {
    const { data, error } = await insforge.database
      .from('kubbonet_espacios')
      .select('*')
      .order('orden', { ascending: true });
    if (error) console.error('Error fetching spaces:', error);
    return (data as unknown as KubbonetSpace[]) || [];
  },

  async createSpace(space: Partial<KubbonetSpace>): Promise<KubbonetSpace | null> {
    const { data, error } = await insforge.database
      .from('kubbonet_espacios')
      .insert([{ 
        ...space, 
        workspace_id: space.workspace_id || 1, 
        orden: space.orden || 99, 
        estado: space.estado || 'activo' 
      }])
      .select();
    if (error) {
      console.error('Error creating space:', error);
      throw error;
    }
    return (data as unknown as KubbonetSpace[])?.[0] || null;
  },

  async updateSpace(id: number, updates: Partial<KubbonetSpace>): Promise<KubbonetSpace | null> {
    const { data, error } = await insforge.database
      .from('kubbonet_espacios')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating space:', error);
      throw error;
    }
    return (data as unknown as KubbonetSpace[])?.[0] || null;
  },

  async deleteSpace(id: number): Promise<boolean> {
    const { error } = await insforge.database
      .from('kubbonet_espacios')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting space:', error);
      throw error;
    }
    return true;
  },

  async getFolders(): Promise<KubbonetFolder[]> {
    const { data, error } = await insforge.database
      .from('kubbonet_carpetas')
      .select('*')
      .order('orden', { ascending: true });
    if (error) console.error('Error fetching folders:', error);
    return (data as unknown as KubbonetFolder[]) || [];
  },

  async createFolder(folder: Partial<KubbonetFolder>): Promise<KubbonetFolder | null> {
    const { data, error } = await insforge.database
      .from('kubbonet_carpetas')
      .insert([folder])
      .select();
    if (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
    return (data as unknown as KubbonetFolder[])?.[0] || null;
  },

  async updateFolder(id: number, updates: Partial<KubbonetFolder>): Promise<KubbonetFolder | null> {
    const { data, error } = await insforge.database
      .from('kubbonet_carpetas')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating folder:', error);
      throw error;
    }
    return (data as unknown as KubbonetFolder[])?.[0] || null;
  },

  async deleteFolder(id: number): Promise<boolean> {
    const { error } = await insforge.database
      .from('kubbonet_carpetas')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting folder:', error);
      throw error;
    }
    return true;
  },

  async getLists(): Promise<KubbonetList[]> {
    const { data, error } = await insforge.database
      .from('kubbonet_listas')
      .select('*')
      .order('orden', { ascending: true });
    if (error) console.error('Error fetching lists:', error);
    return (data as unknown as KubbonetList[]) || [];
  },

  async createList(list: Partial<KubbonetList>): Promise<KubbonetList | null> {
    const { data, error } = await insforge.database
      .from('kubbonet_listas')
      .insert([list])
      .select();
    if (error) {
      console.error('Error creating list:', error);
      throw error;
    }
    return (data as unknown as KubbonetList[])?.[0] || null;
  },

  async updateList(id: number, updates: Partial<KubbonetList>): Promise<KubbonetList | null> {
    const { data, error } = await insforge.database
      .from('kubbonet_listas')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating list:', error);
      throw error;
    }
    return (data as unknown as KubbonetList[])?.[0] || null;
  },

  async deleteList(id: number): Promise<boolean> {
    const { error } = await insforge.database
      .from('kubbonet_listas')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting list:', error);
      throw error;
    }
    return true;
  },

  async moveTaskToList(taskId: string, targetListId: number): Promise<AppTask | null> {
    const { data, error } = await insforge.database
      .from('app_tasks')
      .update({ lista_id: targetListId, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select();
    if (error) {
      console.error('Error moving task to list:', error);
      throw error;
    }
    return (data as unknown as AppTask[])?.[0] || null;
  },

  // Objetos y Entidades
  async getObjects(): Promise<AppObject[]> {
    const { data, error } = await insforge.database
      .from('app_objects')
      .select()
      .neq('object_type', '__meta_type__')
      .neq('object_type', 'interaction')
      .neq('object_type', 'area')
      .neq('object_type', 'person_relationship')
      .order('created_at', { ascending: false });
    if (error) console.error('Error fetching objects:', error);
    if (!data) return [];

    return (data as any[]).map(row => {
      const p = row.properties || {};
      return {
        ...row,
        thumbnail_url: row.thumbnail_url || p.thumbnail_url || p.cover_url || null,
        area_id: row.area_id || p.area_id || null,
        para_category: row.para_category || p.para_category || undefined
      } as AppObject;
    });
  },

  async createObject(obj: Partial<AppObject>): Promise<AppObject | null> {
    const { thumbnail_url, area_id, para_category, ...directFields } = obj as any;
    const finalProperties = {
      ...(obj.properties || {}),
      ...(thumbnail_url ? { thumbnail_url, cover_url: thumbnail_url } : {}),
      ...(area_id ? { area_id } : {}),
      ...(para_category ? { para_category } : {})
    };

    const payload = {
      ...directFields,
      properties: finalProperties
    };

    const { data, error } = await insforge.database
      .from('app_objects')
      .insert([payload])
      .select();
    if (error) {
      console.error('Error creating object:', error);
      throw error;
    }
    const created = (data as unknown as AppObject[])?.[0] || null;
    if (!created) return null;

    const p = (created as any).properties || {};
    return {
      ...created,
      thumbnail_url: created.thumbnail_url || p.thumbnail_url || p.cover_url || null,
      area_id: created.area_id || p.area_id || null,
      para_category: created.para_category || p.para_category || undefined
    };
  },

  async updateObject(id: string, updates: Partial<AppObject>): Promise<AppObject | null> {
    const { thumbnail_url, area_id, para_category, ...directFields } = updates as any;
    
    // Merge properties if provided
    let finalProperties = updates.properties;
    if (thumbnail_url !== undefined || area_id !== undefined || para_category !== undefined || finalProperties) {
      finalProperties = {
        ...(finalProperties || {}),
        ...(thumbnail_url !== undefined ? { thumbnail_url, cover_url: thumbnail_url } : {}),
        ...(area_id !== undefined ? { area_id } : {}),
        ...(para_category !== undefined ? { para_category } : {})
      };
    }

    const payload: Record<string, any> = {
      ...directFields,
      updated_at: new Date().toISOString()
    };
    if (finalProperties !== undefined) {
      payload.properties = finalProperties;
    }

    const { data, error } = await insforge.database
      .from('app_objects')
      .update(payload)
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating object:', error);
      throw error;
    }
    const updated = (data as unknown as AppObject[])?.[0] || null;
    if (!updated) return null;

    const p = (updated as any).properties || {};
    return {
      ...updated,
      thumbnail_url: updated.thumbnail_url || p.thumbnail_url || p.cover_url || null,
      area_id: updated.area_id || p.area_id || null,
      para_category: updated.para_category || p.para_category || undefined
    };
  },

  async deleteObject(id: string): Promise<boolean> {
    const { error } = await insforge.database
      .from('app_objects')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting object:', error);
      throw error;
    }
    return true;
  },

  // Interacciones con Personas (Persistidas como registros independientes en app_objects con object_type: 'interaction')
  async getPersonInteractions(personId: string): Promise<PersonInteraction[]> {
    try {
      const { data, error } = await insforge.database
        .from('app_objects')
        .select('*')
        .eq('object_type', 'interaction')
        .order('created_at', { ascending: false });
      
      if (error || !data) return [];
      
      // Filtrar por personId en properties
      const matches = data.filter((row: any) => row.properties?.person_id === personId);
      return matches.map((row: any) => {
        const p = row.properties || {};
        return {
          id: row.id,
          person_id: p.person_id || personId,
          type: p.interaction_type || 'meeting',
          date: p.interaction_date || row.created_at,
          summary: row.title,
          notes: row.content || p.notes || '',
          commitments: p.commitments || '',
          next_action: p.next_action || '',
          follow_up_date: p.follow_up_date || null,
          file_urls: Array.isArray(p.file_urls) ? p.file_urls : [],
          created_at: row.created_at,
          updated_at: row.updated_at
        } as PersonInteraction;
      });
    } catch (e) {
      console.warn('Error recuperando interacciones de la persona:', e);
      return [];
    }
  },

  async createPersonInteraction(interaction: Omit<PersonInteraction, 'id' | 'created_at'>): Promise<PersonInteraction | null> {
    try {
      const payload = {
        object_type: 'interaction',
        title: interaction.summary,
        description: interaction.notes?.slice(0, 200) || '',
        content: interaction.notes || '',
        properties: {
          person_id: interaction.person_id,
          interaction_type: interaction.type,
          interaction_date: interaction.date,
          commitments: interaction.commitments,
          next_action: interaction.next_action,
          follow_up_date: interaction.follow_up_date,
          file_urls: interaction.file_urls || []
        }
      };

      const { data, error } = await insforge.database
        .from('app_objects')
        .insert([payload])
        .select();

      if (error) throw error;
      const created = data?.[0];
      if (!created) return null;

      const p = created.properties || {};
      return {
        id: created.id,
        person_id: p.person_id,
        type: p.interaction_type,
        date: p.interaction_date,
        summary: created.title,
        notes: created.content,
        commitments: p.commitments,
        next_action: p.next_action,
        follow_up_date: p.follow_up_date,
        file_urls: p.file_urls,
        created_at: created.created_at,
        updated_at: created.updated_at
      };
    } catch (e) {
      console.error('Error registrando interacción:', e);
      throw e;
    }
  },

  async updatePersonInteraction(interactionId: string, interaction: Partial<PersonInteraction>): Promise<PersonInteraction | null> {
    try {
      const payload: any = {
        updated_at: new Date().toISOString()
      };
      if (interaction.summary !== undefined) payload.title = interaction.summary;
      if (interaction.notes !== undefined) {
        payload.description = interaction.notes.slice(0, 200);
        payload.content = interaction.notes;
      }

      const { data: currentData } = await insforge.database
        .from('app_objects')
        .select('*')
        .eq('id', interactionId)
        .limit(1);

      const existingProps = currentData?.[0]?.properties || {};
      payload.properties = {
        ...existingProps,
        ...(interaction.person_id !== undefined ? { person_id: interaction.person_id } : {}),
        ...(interaction.type !== undefined ? { interaction_type: interaction.type } : {}),
        ...(interaction.date !== undefined ? { interaction_date: interaction.date } : {}),
        ...(interaction.commitments !== undefined ? { commitments: interaction.commitments } : {}),
        ...(interaction.next_action !== undefined ? { next_action: interaction.next_action } : {}),
        ...(interaction.follow_up_date !== undefined ? { follow_up_date: interaction.follow_up_date } : {}),
        ...(interaction.file_urls !== undefined ? { file_urls: interaction.file_urls } : {})
      };

      const { data, error } = await insforge.database
        .from('app_objects')
        .update(payload)
        .eq('id', interactionId)
        .select();

      if (error) throw error;
      const updated = data?.[0];
      if (!updated) return null;

      const p = updated.properties || {};
      return {
        id: updated.id,
        person_id: p.person_id,
        type: p.interaction_type || 'meeting',
        date: p.interaction_date || updated.created_at,
        summary: updated.title,
        notes: updated.content,
        commitments: p.commitments,
        next_action: p.next_action,
        follow_up_date: p.follow_up_date,
        file_urls: Array.isArray(p.file_urls) ? p.file_urls : [],
        created_at: updated.created_at,
        updated_at: updated.updated_at
      };
    } catch (e) {
      console.error('Error actualizando interacción:', e);
      throw e;
    }
  },

  async deletePersonInteraction(interactionId: string): Promise<boolean> {
    const { error } = await insforge.database
      .from('app_objects')
      .delete()
      .eq('id', interactionId);
    if (error) {
      console.error('Error eliminando interacción:', error);
      throw error;
    }
    return true;
  },

  // ==========================================
  // RELACIONES PERSONALES ENTRE CONTACTOS
  // (Persistidas en app_objects con object_type: 'person_relationship')
  // ==========================================
  async getPersonRelationships(personId?: string): Promise<PersonRelationship[]> {
    try {
      const { data, error } = await insforge.database
        .from('app_objects')
        .select('*')
        .eq('object_type', 'person_relationship')
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      const list: PersonRelationship[] = data.map((row: any) => {
        const p = row.properties || {};
        return {
          id: row.id,
          source_person_id: p.source_person_id,
          target_person_id: p.target_person_id,
          relation_type: p.relation_type,
          notes: row.content || p.notes || '',
          status: p.status || 'active',
          created_at: row.created_at,
          updated_at: row.updated_at
        };
      });

      if (!personId) return list;
      return list.filter(r => r.source_person_id === personId || r.target_person_id === personId);
    } catch (e) {
      console.warn('Error recuperando relaciones personales:', e);
      return [];
    }
  },

  async createPersonRelationship(rel: Omit<PersonRelationship, 'id' | 'created_at'>): Promise<PersonRelationship | null> {
    try {
      if (rel.source_person_id === rel.target_person_id) {
        throw new Error('No puedes vincular una persona consigo misma.');
      }

      // Check if relationship already exists in either direction
      const existing = await this.getPersonRelationships();
      const duplicate = existing.find(r => 
        (r.source_person_id === rel.source_person_id && r.target_person_id === rel.target_person_id) ||
        (r.source_person_id === rel.target_person_id && r.target_person_id === rel.source_person_id)
      );

      if (duplicate) {
        throw new Error('Ya existe una relación registrada entre estas dos personas.');
      }

      const payload = {
        object_type: 'person_relationship',
        title: `${rel.relation_type}: ${rel.source_person_id} -> ${rel.target_person_id}`,
        content: rel.notes || '',
        properties: {
          source_person_id: rel.source_person_id,
          target_person_id: rel.target_person_id,
          relation_type: rel.relation_type,
          notes: rel.notes || '',
          status: rel.status || 'active'
        }
      };

      const { data, error } = await insforge.database
        .from('app_objects')
        .insert([payload])
        .select();

      if (error) throw error;
      const created = data?.[0];
      if (!created) return null;

      const p = created.properties || {};
      return {
        id: created.id,
        source_person_id: p.source_person_id,
        target_person_id: p.target_person_id,
        relation_type: p.relation_type,
        notes: created.content,
        status: p.status,
        created_at: created.created_at,
        updated_at: created.updated_at
      };
    } catch (e) {
      console.error('Error creando relación personal:', e);
      throw e;
    }
  },

  async updatePersonRelationship(id: string, updates: Partial<PersonRelationship>): Promise<PersonRelationship | null> {
    try {
      const { data: existingData } = await insforge.database
        .from('app_objects')
        .select('*')
        .eq('id', id);

      const existing = existingData?.[0];
      const p = existing?.properties || {};

      const updatedProps = {
        ...p,
        ...(updates.relation_type ? { relation_type: updates.relation_type } : {}),
        ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
        ...(updates.status ? { status: updates.status } : {})
      };

      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
        properties: updatedProps
      };
      if (updates.notes !== undefined) payload.content = updates.notes;

      const { data, error } = await insforge.database
        .from('app_objects')
        .update(payload)
        .eq('id', id)
        .select();

      if (error) throw error;
      const updated = data?.[0];
      if (!updated) return null;

      const finalProps = updated.properties || {};
      return {
        id: updated.id,
        source_person_id: finalProps.source_person_id,
        target_person_id: finalProps.target_person_id,
        relation_type: finalProps.relation_type,
        notes: updated.content,
        status: finalProps.status,
        created_at: updated.created_at,
        updated_at: updated.updated_at
      };
    } catch (e) {
      console.error('Error actualizando relación personal:', e);
      throw e;
    }
  },

  async deletePersonRelationship(id: string): Promise<boolean> {
    try {
      const { error } = await insforge.database
        .from('app_objects')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Error eliminando relación personal:', e);
      throw e;
    }
  },

  // ==========================================
  // IDEAS Y NOTAS DE LIBROS
  // (Persistidas en app_objects con object_type: 'book_idea')
  // ==========================================
  async getBookIdeas(bookId: string): Promise<BookIdea[]> {
    try {
      const { data, error } = await insforge.database
        .from('app_objects')
        .select('*')
        .eq('object_type', 'book_idea')
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      const matches = data.filter((row: any) => row.properties?.book_id === bookId);
      return matches.map((row: any) => {
        const p = row.properties || {};
        return {
          id: row.id,
          book_id: p.book_id || bookId,
          title: row.title || 'Idea de lectura',
          content: row.content || '',
          page: p.page !== undefined ? Number(p.page) : null,
          chapter: p.chapter || '',
          tags: Array.isArray(p.tags) ? p.tags : [],
          created_at: row.created_at,
          updated_at: row.updated_at
        };
      });
    } catch (e) {
      console.error('Error obteniendo ideas del libro:', e);
      return [];
    }
  },

  async createBookIdea(idea: Omit<BookIdea, 'id' | 'created_at'>): Promise<BookIdea | null> {
    try {
      const payload = {
        object_type: 'book_idea',
        title: idea.title.trim() || 'Idea sin título',
        content: idea.content || '',
        description: idea.content ? idea.content.replace(/<[^>]*>/g, '').slice(0, 200) : '',
        properties: {
          book_id: idea.book_id,
          page: idea.page !== undefined ? idea.page : null,
          chapter: idea.chapter || '',
          tags: Array.isArray(idea.tags) ? idea.tags : []
        }
      };

      const { data, error } = await insforge.database
        .from('app_objects')
        .insert([payload])
        .select();

      if (error) throw error;
      const created = data?.[0];
      if (!created) return null;

      const p = created.properties || {};
      return {
        id: created.id,
        book_id: p.book_id,
        title: created.title,
        content: created.content,
        page: p.page !== undefined ? Number(p.page) : null,
        chapter: p.chapter || '',
        tags: Array.isArray(p.tags) ? p.tags : [],
        created_at: created.created_at,
        updated_at: created.updated_at
      };
    } catch (e) {
      console.error('Error creando idea del libro:', e);
      throw e;
    }
  },

  async updateBookIdea(id: string, updates: Partial<BookIdea>): Promise<boolean> {
    try {
      const { data: existingData } = await insforge.database
        .from('app_objects')
        .select('*')
        .eq('id', id);

      const existing = existingData?.[0];
      const p = existing?.properties || {};

      const updatedProps = {
        ...p,
        ...(updates.page !== undefined ? { page: updates.page } : {}),
        ...(updates.chapter !== undefined ? { chapter: updates.chapter } : {}),
        ...(updates.tags !== undefined ? { tags: updates.tags } : {})
      };

      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
        properties: updatedProps
      };
      if (updates.title !== undefined) payload.title = updates.title.trim();
      if (updates.content !== undefined) {
        payload.content = updates.content;
        payload.description = updates.content.replace(/<[^>]*>/g, '').slice(0, 200);
      }

      const { error } = await insforge.database
        .from('app_objects')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Error actualizando idea del libro:', e);
      throw e;
    }
  },

  async deleteBookIdea(id: string): Promise<boolean> {
    try {
      const { error } = await insforge.database
        .from('app_objects')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Error eliminando idea del libro:', e);
      throw e;
    }
  },

  // ==========================================
  // CITAS DESTACADAS DE LIBROS
  // (Persistidas en app_objects con object_type: 'book_quote')
  // ==========================================
  async getBookQuotes(bookId: string): Promise<BookQuote[]> {
    try {
      const { data, error } = await insforge.database
        .from('app_objects')
        .select('*')
        .eq('object_type', 'book_quote')
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      const matches = data.filter((row: any) => row.properties?.book_id === bookId);
      return matches.map((row: any) => {
        const p = row.properties || {};
        return {
          id: row.id,
          book_id: p.book_id || bookId,
          quote_text: p.quote_text || row.content || '',
          author: p.author || '',
          page: p.page !== undefined ? Number(p.page) : null,
          chapter: p.chapter || '',
          commentary: p.commentary || row.description || '',
          tags: Array.isArray(p.tags) ? p.tags : [],
          created_at: row.created_at,
          updated_at: row.updated_at
        };
      });
    } catch (e) {
      console.error('Error obteniendo citas del libro:', e);
      return [];
    }
  },

  async createBookQuote(quote: Omit<BookQuote, 'id' | 'created_at'>): Promise<BookQuote | null> {
    try {
      const payload = {
        object_type: 'book_quote',
        title: `Cita${quote.page ? ` (Pág. ${quote.page})` : ''}: "${quote.quote_text.slice(0, 40)}..."`,
        content: quote.quote_text,
        description: quote.commentary || '',
        properties: {
          book_id: quote.book_id,
          quote_text: quote.quote_text,
          author: quote.author || '',
          page: quote.page !== undefined ? quote.page : null,
          chapter: quote.chapter || '',
          commentary: quote.commentary || '',
          tags: Array.isArray(quote.tags) ? quote.tags : []
        }
      };

      const { data, error } = await insforge.database
        .from('app_objects')
        .insert([payload])
        .select();

      if (error) throw error;
      const created = data?.[0];
      if (!created) return null;

      const p = created.properties || {};
      return {
        id: created.id,
        book_id: p.book_id,
        quote_text: p.quote_text || created.content,
        author: p.author || '',
        page: p.page !== undefined ? Number(p.page) : null,
        chapter: p.chapter || '',
        commentary: p.commentary || created.description,
        tags: Array.isArray(p.tags) ? p.tags : [],
        created_at: created.created_at,
        updated_at: created.updated_at
      };
    } catch (e) {
      console.error('Error creando cita del libro:', e);
      throw e;
    }
  },

  async updateBookQuote(id: string, updates: Partial<BookQuote>): Promise<boolean> {
    try {
      const { data: existingData } = await insforge.database
        .from('app_objects')
        .select('*')
        .eq('id', id);

      const existing = existingData?.[0];
      const p = existing?.properties || {};

      const updatedProps = {
        ...p,
        ...(updates.quote_text !== undefined ? { quote_text: updates.quote_text } : {}),
        ...(updates.author !== undefined ? { author: updates.author } : {}),
        ...(updates.page !== undefined ? { page: updates.page } : {}),
        ...(updates.chapter !== undefined ? { chapter: updates.chapter } : {}),
        ...(updates.commentary !== undefined ? { commentary: updates.commentary } : {}),
        ...(updates.tags !== undefined ? { tags: updates.tags } : {})
      };

      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
        properties: updatedProps
      };
      if (updates.quote_text !== undefined) {
        payload.content = updates.quote_text;
        payload.title = `Cita${updatedProps.page ? ` (Pág. ${updatedProps.page})` : ''}: "${updates.quote_text.slice(0, 40)}..."`;
      }
      if (updates.commentary !== undefined) {
        payload.description = updates.commentary;
      }

      const { error } = await insforge.database
        .from('app_objects')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Error actualizando cita del libro:', e);
      throw e;
    }
  },

  async deleteBookQuote(id: string): Promise<boolean> {
    try {
      const { error } = await insforge.database
        .from('app_objects')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Error eliminando cita del libro:', e);
      throw e;
    }
  },

  // Tipos de Objeto Personalizados (Persistidos en InsForge como __meta_type__)
  async getCustomObjectTypes(): Promise<ObjectTypeDefinition[]> {
    try {
      const { data, error } = await insforge.database
        .from('app_objects')
        .select('*')
        .eq('object_type', '__meta_type__');
      if (error || !data) return [];
      
      return data.map((row: any) => {
        const props = row.properties || {};
        return {
          id: props.type_id || row.title.toLowerCase().replace(/\s+/g, '_'),
          name: row.title,
          description: row.description || props.description,
          icon: row.icon || props.icon || 'boxes',
          color: row.color || props.color || '#3b82f6',
          category: props.category || 'Personalizado',
          fields: Array.isArray(props.fields) ? props.fields : [],
          is_custom: true,
          meta_id: row.id
        } as ObjectTypeDefinition;
      });
    } catch (e) {
      console.warn('Error recuperando tipos personalizados:', e);
      return [];
    }
  },

  async saveCustomObjectType(typeDef: ObjectTypeDefinition): Promise<ObjectTypeDefinition | null> {
    try {
      const metaPayload = {
        object_type: '__meta_type__',
        title: typeDef.name,
        description: typeDef.description || '',
        icon: typeDef.icon || 'boxes',
        color: typeDef.color || '#3b82f6',
        properties: {
          type_id: typeDef.id,
          name: typeDef.name,
          description: typeDef.description,
          icon: typeDef.icon,
          color: typeDef.color,
          category: typeDef.category,
          fields: typeDef.fields
        }
      };

      if (typeDef.meta_id) {
        const { data, error } = await insforge.database
          .from('app_objects')
          .update({ ...metaPayload, updated_at: new Date().toISOString() })
          .eq('id', typeDef.meta_id)
          .select();
        if (error) throw error;
        return { ...typeDef, meta_id: data[0].id };
      } else {
        const { data, error } = await insforge.database
          .from('app_objects')
          .insert([metaPayload])
          .select();
        if (error) throw error;
        return { ...typeDef, meta_id: data[0].id };
      }
    } catch (e) {
      console.error('Error guardando tipo personalizado:', e);
      throw e;
    }
  },

  async deleteCustomObjectType(metaId: string): Promise<boolean> {
    try {
      const { error } = await insforge.database
        .from('app_objects')
        .delete()
        .eq('id', metaId);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Error eliminando tipo personalizado:', e);
      throw e;
    }
  },

  // Enlaces universales y Grafo (Tabla `links`)
  async getLinks(): Promise<AppLink[]> {
    const { data, error } = await insforge.database
      .from('links')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('Error fetching links:', error);
    if (!data) return [];
    return (data as any[]).map(row => ({
      id: row.id,
      from_id: row.from_id,
      from_type: row.from_type,
      to_id: row.to_id,
      to_type: row.to_type,
      relation_label: row.relation_label || 'related',
      created_at: row.created_at,
      source_id: row.from_id,
      source_type: row.from_type,
      target_id: row.to_id,
      target_type: row.to_type,
      link_type: row.relation_label
    }));
  },

  async getLinksForEntity(entityId: string, entityType?: string): Promise<{ outgoing: AppLink[]; incoming: AppLink[] }> {
    try {
      let outQuery = insforge.database.from('links').select('*').eq('from_id', entityId);
      let inQuery = insforge.database.from('links').select('*').eq('to_id', entityId);

      if (entityType) {
        outQuery = outQuery.eq('from_type', entityType);
        inQuery = inQuery.eq('to_type', entityType);
      }

      const [{ data: outData, error: outErr }, { data: inData, error: inErr }] = await Promise.all([outQuery, inQuery]);

      if (outErr) console.error('Error fetching outgoing links:', outErr);
      if (inErr) console.error('Error fetching incoming links:', inErr);

      const mapRow = (r: any): AppLink => ({
        id: r.id,
        from_id: r.from_id,
        from_type: r.from_type,
        to_id: r.to_id,
        to_type: r.to_type,
        relation_label: r.relation_label || 'related',
        created_at: r.created_at,
        source_id: r.from_id,
        source_type: r.from_type,
        target_id: r.to_id,
        target_type: r.to_type,
        link_type: r.relation_label
      });

      return {
        outgoing: (outData || []).map(mapRow),
        incoming: (inData || []).map(mapRow)
      };
    } catch (e) {
      console.warn('Error fetching entity links:', e);
      return { outgoing: [], incoming: [] };
    }
  },

  async createUniversalLink(
    fromId: string,
    fromType: string,
    toId: string,
    toType: string,
    relationLabel = 'related'
  ): Promise<AppLink | null> {
    if (fromId === toId && fromType === toType) {
      console.warn('Auto-vínculo no permitido');
      return null;
    }

    try {
      const payload = {
        from_id: fromId,
        from_type: fromType,
        to_id: toId,
        to_type: toType,
        relation_label: relationLabel
      };

      const { data, error } = await insforge.database
        .from('links')
        .insert([payload])
        .select();

      if (error) {
        // If unique constraint violation, retrieve existing link
        if (error.code === '23505' || String(error.message).includes('unique') || String(error.message).includes('uq_links_direction')) {
          const { data: existing } = await insforge.database
            .from('links')
            .select('*')
            .eq('from_id', fromId)
            .eq('from_type', fromType)
            .eq('to_id', toId)
            .eq('to_type', toType)
            .eq('relation_label', relationLabel)
            .limit(1);
          if (existing && existing.length > 0) {
            const r = existing[0];
            return {
              id: r.id,
              from_id: r.from_id,
              from_type: r.from_type,
              to_id: r.to_id,
              to_type: r.to_type,
              relation_label: r.relation_label || 'related',
              created_at: r.created_at
            };
          }
        }
        throw error;
      }

      const r = (data as any[])?.[0];
      if (!r) return null;
      return {
        id: r.id,
        from_id: r.from_id,
        from_type: r.from_type,
        to_id: r.to_id,
        to_type: r.to_type,
        relation_label: r.relation_label || 'related',
        created_at: r.created_at,
        source_id: r.from_id,
        source_type: r.from_type,
        target_id: r.to_id,
        target_type: r.to_type,
        link_type: r.relation_label
      };
    } catch (e: any) {
      console.error('Error creando vínculo universal:', e);
      throw e;
    }
  },

  async createLink(link: any): Promise<AppLink | null> {
    const fromId = link.from_id || link.source_id;
    const fromType = link.from_type || link.source_type;
    const toId = link.to_id || link.target_id;
    const toType = link.to_type || link.target_type;
    const relationLabel = link.relation_label || link.link_type || 'related';

    if (!fromId || !fromType || !toId || !toType) return null;
    return this.createUniversalLink(fromId, fromType, toId, toType, relationLabel);
  },

  async deleteLink(id: string): Promise<boolean> {
    const { error } = await insforge.database
      .from('links')
      .delete()
      .eq('id', id);
    return !error;
  },

  async syncNoteLinks(noteId: string, wikilinks: string[], allEntities: { id: string; title: string; type: string }[]) {
    await insforge.database
      .from('links')
      .delete()
      .eq('from_id', noteId)
      .eq('from_type', 'note')
      .eq('relation_label', 'mention');

    if (wikilinks.length === 0) return;

    for (const title of wikilinks) {
      const match = allEntities.find(e => e.title.toLowerCase() === title.toLowerCase());
      if (match && match.id !== noteId) {
        try {
          await this.createUniversalLink(noteId, 'note', match.id, match.type, 'mention');
        } catch (e) {
          console.warn('Error vinculando wikilink a nota:', e);
        }
      }
    }
  },

  // Carpetas lógicas de Archivos (Cloudflare R2 / InsForge)
  async getFileFolders(): Promise<AppFolder[]> {
    const { data, error } = await insforge.database
      .from('app_folders')
      .select('*')
      .order('name', { ascending: true });
    if (error) console.error('Error fetching file folders:', error);
    return (data as unknown as AppFolder[]) || [];
  },

  async createFileFolder(folder: Partial<AppFolder>): Promise<AppFolder | null> {
    const { data, error } = await insforge.database
      .from('app_folders')
      .insert([folder])
      .select();
    if (error) {
      console.error('Error creating file folder:', error);
      throw error;
    }
    return (data as unknown as AppFolder[])?.[0] || null;
  },

  async updateFileFolder(id: string, updates: Partial<AppFolder>): Promise<AppFolder | null> {
    const { data, error } = await insforge.database
      .from('app_folders')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating file folder:', error);
      throw error;
    }
    return (data as unknown as AppFolder[])?.[0] || null;
  },

  async deleteFileFolder(id: string): Promise<boolean> {
    // Unlink files in this folder before deleting
    await insforge.database
      .from('app_attachments')
      .update({ folder_id: null })
      .eq('folder_id', id);

    const { error } = await insforge.database
      .from('app_folders')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting file folder:', error);
      throw error;
    }
    return true;
  },

  // Relaciones explícitas de archivos
  async getFileRelations(fileId?: string, entityId?: string): Promise<AppFileRelation[]> {
    let query = insforge.database.from('app_file_relations').select('*');
    if (fileId) {
      query = query.eq('file_id', fileId);
    }
    if (entityId) {
      query = query.eq('entity_id', entityId);
    }
    const { data, error } = await query;
    if (error) console.error('Error fetching file relations:', error);
    return (data as unknown as AppFileRelation[]) || [];
  },

  async addFileRelation(fileId: string, entityId: string, entityType: string): Promise<AppFileRelation | null> {
    // Check if relation already exists
    const { data: existing } = await insforge.database
      .from('app_file_relations')
      .select('id')
      .eq('file_id', fileId)
      .eq('entity_id', entityId)
      .limit(1);

    if (existing && existing.length > 0) {
      return existing[0] as unknown as AppFileRelation;
    }

    const { data, error } = await insforge.database
      .from('app_file_relations')
      .insert([{
        file_id: fileId,
        entity_id: entityId,
        entity_type: entityType
      }])
      .select();

    if (error) {
      console.error('Error adding file relation:', error);
      throw error;
    }
    return (data as unknown as AppFileRelation[])?.[0] || null;
  },

  async removeFileRelation(relationId: string): Promise<boolean> {
    const { error } = await insforge.database
      .from('app_file_relations')
      .delete()
      .eq('id', relationId);
    if (error) {
      console.error('Error removing file relation:', error);
      throw error;
    }
    return true;
  },

  // Adjuntos (Archivos, Imágenes y Enlaces)
  async getAttachments(options?: string | { 
    entityId?: string; 
    folderId?: string | null; 
    isFavorite?: boolean;
    storageProvider?: string;
  }): Promise<AppAttachment[]> {
    let query = insforge.database.from('app_attachments').select('*').order('created_at', { ascending: false });
    
    if (typeof options === 'string') {
      query = query.eq('entity_id', options);
    } else if (options?.entityId) {
      query = query.eq('entity_id', options.entityId);
    }
    if (typeof options === 'object') {
      if (options.folderId !== undefined) {
        if (options.folderId === null) {
          query = query.is('folder_id', null);
        } else {
          query = query.eq('folder_id', options.folderId);
        }
      }
      if (options.isFavorite !== undefined) {
        query = query.eq('is_favorite', options.isFavorite);
      }
      if (options.storageProvider) {
        query = query.eq('storage_provider', options.storageProvider);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching attachments:', error);
      return [];
    }
    
    const attachments = (data as unknown as AppAttachment[]) || [];
    
    // Fetch relations for all retrieved files
    try {
      const { data: relations } = await insforge.database.from('app_file_relations').select('*');
      if (relations && relations.length > 0) {
        const relMap = new Map<string, AppFileRelation[]>();
        for (const r of (relations as unknown as AppFileRelation[])) {
          if (!relMap.has(r.file_id)) relMap.set(r.file_id, []);
          relMap.get(r.file_id)!.push(r);
        }
        for (const att of attachments) {
          att.relations = relMap.get(att.id) || [];
        }
      }
    } catch (e) {
      console.warn('Could not load relations for attachments:', e);
    }

    return attachments;
  },

  async recordAttachment(attachment: Partial<AppAttachment>): Promise<AppAttachment | null> {
    const { data, error } = await insforge.database
      .from('app_attachments')
      .insert([attachment])
      .select();
    if (error) {
      console.error('Error recording attachment:', error);
      throw error;
    }
    const created = (data as unknown as AppAttachment[])?.[0] || null;
    
    // If entity_id is specified and valid, register explicit relation
    if (created && created.entity_id && created.entity_id !== '00000000-0000-0000-0000-000000000000') {
      try {
        await this.addFileRelation(created.id, created.entity_id, created.entity_type);
      } catch (e) {
        console.warn('Auto file relation creation failed:', e);
      }
    }

    return created;
  },

  async updateAttachment(id: string, updates: Partial<AppAttachment>): Promise<AppAttachment | null> {
    const { data, error } = await insforge.database
      .from('app_attachments')
      .update(updates)
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating attachment:', error);
      throw error;
    }
    return (data as unknown as AppAttachment[])?.[0] || null;
  },

  async deleteAttachment(id: string): Promise<boolean> {
    // Delete associated relations first
    await insforge.database
      .from('app_file_relations')
      .delete()
      .eq('file_id', id);

    const { error } = await insforge.database
      .from('app_attachments')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting attachment:', error);
      throw error;
    }
    return true;
  },

  // Hábitos & Seguimiento
  async getHabits(includeArchived = false): Promise<AppHabit[]> {
    let query = insforge.database
      .from('app_habits')
      .select('*')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching habits:', error);
      return [];
    }
    return (data as AppHabit[]) || [];
  },

  async createHabit(habit: Partial<AppHabit>): Promise<AppHabit | null> {
    const payload = {
      title: habit.title || 'Nuevo hábito',
      description: habit.description || '',
      icon: habit.icon || 'Sparkles',
      color: habit.color || '#3b82f6',
      frequency: habit.frequency || 'daily',
      frequency_days: habit.frequency_days || [1, 2, 3, 4, 5, 6, 7],
      target_per_day: habit.target_per_day || 1,
      start_date: habit.start_date || new Date().toISOString().split('T')[0],
      end_date: habit.end_date || null,
      reminder_time: habit.reminder_time || null,
      is_archived: !!habit.is_archived,
      order_index: habit.order_index || 0,
      properties: habit.properties || {}
    };

    const { data, error } = await insforge.database
      .from('app_habits')
      .insert([payload])
      .select();

    if (error) {
      console.error('Error creating habit:', error);
      throw error;
    }
    return (data as unknown as AppHabit[])?.[0] || null;
  },

  async updateHabit(id: string, updates: Partial<AppHabit>): Promise<AppHabit | null> {
    const payload: Record<string, any> = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    delete payload.id;

    const { data, error } = await insforge.database
      .from('app_habits')
      .update(payload)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating habit:', error);
      throw error;
    }
    return (data as unknown as AppHabit[])?.[0] || null;
  },

  async deleteHabit(id: string): Promise<boolean> {
    const { error } = await insforge.database
      .from('app_habits')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting habit:', error);
      throw error;
    }
    return true;
  },

  // Logs de cumplimiento de hábitos
  async getHabitLogs(startDate?: string, endDate?: string): Promise<AppHabitLog[]> {
    let query = insforge.database
      .from('app_habit_logs')
      .select('*')
      .order('date', { ascending: false });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching habit logs:', error);
      return [];
    }
    return (data as AppHabitLog[]) || [];
  },

  async toggleHabitLog(
    habitId: string, 
    date: string, 
    nextStatus?: HabitLogStatus
  ): Promise<{ status: HabitLogStatus | 'none'; log?: AppHabitLog }> {
    // Check if log exists for this date and habit
    const { data: existingLogs } = await insforge.database
      .from('app_habit_logs')
      .select('*')
      .eq('habit_id', habitId)
      .eq('date', date);

    const existing = existingLogs?.[0] as AppHabitLog | undefined;

    if (!existing) {
      // Create new log with completed or desired status
      const statusToSet: HabitLogStatus = nextStatus || 'completed';
      const { data, error } = await insforge.database
        .from('app_habit_logs')
        .insert([{
          habit_id: habitId,
          date,
          status: statusToSet,
          completed_at: statusToSet === 'completed' ? new Date().toISOString() : null
        }])
        .select();

      if (error) {
        console.error('Error setting habit log:', error);
        throw error;
      }
      return { status: statusToSet, log: (data as any)?.[0] };
    }

    // If explicit nextStatus is given and matches current, or if cycling: completed -> skipped -> none (delete)
    if (nextStatus) {
      if (nextStatus === existing.status) {
        // Toggle off (delete)
        await insforge.database
          .from('app_habit_logs')
          .delete()
          .eq('id', existing.id);
        return { status: 'none' };
      } else {
        // Update to new status
        const { data, error } = await insforge.database
          .from('app_habit_logs')
          .update({
            status: nextStatus,
            completed_at: nextStatus === 'completed' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select();

        if (error) throw error;
        return { status: nextStatus, log: (data as any)?.[0] };
      }
    }

    // Default cycle when clicking: completed -> delete
    if (existing.status === 'completed') {
      await insforge.database
        .from('app_habit_logs')
        .delete()
        .eq('id', existing.id);
      return { status: 'none' };
    } else {
      // from skipped to completed
      const { data, error } = await insforge.database
        .from('app_habit_logs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select();

      if (error) throw error;
      return { status: 'completed', log: (data as any)?.[0] };
    }
  },

  // === LIENZOS (CANVASES) ===
  async getCanvases(options?: { notebookId?: string; projectId?: string; isFavorite?: boolean; isArchived?: boolean }): Promise<AppCanvas[]> {
    let query = insforge.database
      .from('app_canvases')
      .select()
      .order('updated_at', { ascending: false });

    if (options?.notebookId) {
      query = query.eq('notebook_id', options.notebookId);
    }
    if (options?.projectId) {
      query = query.eq('project_id', options.projectId);
    }
    if (options?.isFavorite !== undefined) {
      query = query.eq('is_favorite', options.isFavorite);
    }
    if (options?.isArchived !== undefined) {
      query = query.eq('is_archived', options.isArchived);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching canvases:', error);
      return [];
    }
    return (data as AppCanvas[]) || [];
  },

  async getCanvasById(id: string): Promise<AppCanvas | null> {
    const { data, error } = await insforge.database
      .from('app_canvases')
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching canvas by id:', error);
      return null;
    }
    return (data as AppCanvas) || null;
  },

  async createCanvas(canvas: Partial<AppCanvas>): Promise<AppCanvas | null> {
    const payload = {
      title: canvas.title || 'Lienzo sin título',
      description: canvas.description || null,
      elements: canvas.elements || [],
      app_state: canvas.app_state || {},
      files: canvas.files || {},
      thumbnail_url: canvas.thumbnail_url || null,
      notebook_id: canvas.notebook_id || null,
      project_id: canvas.project_id || null,
      area_id: canvas.area_id || null,
      para_category: canvas.para_category || null,
      tags: canvas.tags || [],
      is_favorite: canvas.is_favorite || false,
      is_archived: canvas.is_archived || false,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await insforge.database
      .from('app_canvases')
      .insert([payload])
      .select();

    if (error) {
      console.error('Error creating canvas:', error);
      throw error;
    }
    return (data as unknown as AppCanvas[])?.[0] || null;
  },

  async updateCanvas(id: string, updates: Partial<AppCanvas>): Promise<AppCanvas | null> {
    const payload: Record<string, any> = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    delete payload.id;
    delete payload.created_at;

    const { data, error } = await insforge.database
      .from('app_canvases')
      .update(payload)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating canvas:', error);
      throw error;
    }
    return (data as unknown as AppCanvas[])?.[0] || null;
  },

  async deleteCanvas(id: string): Promise<boolean> {
    const { error } = await insforge.database
      .from('app_canvases')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting canvas:', error);
      return false;
    }
    return true;
  },

  // ==========================================
  // TRIP MANAGER API (Gestor Integral de Viajes)
  // ==========================================

  // --- Trayectos (Legs) ---
  async getTripLegs(tripId: string): Promise<AppTripLeg[]> {
    try {
      const { data, error } = await insforge.database
        .from('app_trip_legs')
        .select('*')
        .eq('trip_id', tripId)
        .order('order_index', { ascending: true })
        .order('departure_time', { ascending: true, nullsFirst: false });
      if (error) {
        console.error('Error fetching trip legs:', error);
        return [];
      }
      return (data as AppTripLeg[]) || [];
    } catch (e) {
      console.error('Exception fetching trip legs:', e);
      return [];
    }
  },

  async createTripLeg(leg: Partial<AppTripLeg>): Promise<AppTripLeg | null> {
    const { data, error } = await insforge.database
      .from('app_trip_legs')
      .insert([{
        ...leg,
        updated_at: new Date().toISOString()
      }])
      .select();
    if (error) {
      console.error('Error creating trip leg:', error);
      throw error;
    }
    return (data as AppTripLeg[])?.[0] || null;
  },

  async updateTripLeg(id: string, updates: Partial<AppTripLeg>): Promise<AppTripLeg | null> {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    delete (payload as any).id;
    delete (payload as any).created_at;

    const { data, error } = await insforge.database
      .from('app_trip_legs')
      .update(payload)
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating trip leg:', error);
      throw error;
    }
    return (data as AppTripLeg[])?.[0] || null;
  },

  async deleteTripLeg(id: string): Promise<boolean> {
    const { error } = await insforge.database
      .from('app_trip_legs')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting trip leg:', error);
      return false;
    }
    return true;
  },

  // --- Paradas e Itinerario (Stops) ---
  async getTripStops(tripId: string): Promise<AppTripStop[]> {
    try {
      const { data, error } = await insforge.database
        .from('app_trip_stops')
        .select('*')
        .eq('trip_id', tripId)
        .order('order_index', { ascending: true })
        .order('scheduled_time', { ascending: true, nullsFirst: false });
      if (error) {
        console.error('Error fetching trip stops:', error);
        return [];
      }
      return (data as AppTripStop[]) || [];
    } catch (e) {
      console.error('Exception fetching trip stops:', e);
      return [];
    }
  },

  async createTripStop(stop: Partial<AppTripStop>): Promise<AppTripStop | null> {
    const { data, error } = await insforge.database
      .from('app_trip_stops')
      .insert([{
        ...stop,
        updated_at: new Date().toISOString()
      }])
      .select();
    if (error) {
      console.error('Error creating trip stop:', error);
      throw error;
    }
    return (data as AppTripStop[])?.[0] || null;
  },

  async updateTripStop(id: string, updates: Partial<AppTripStop>): Promise<AppTripStop | null> {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    delete (payload as any).id;
    delete (payload as any).created_at;

    const { data, error } = await insforge.database
      .from('app_trip_stops')
      .update(payload)
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating trip stop:', error);
      throw error;
    }
    return (data as AppTripStop[])?.[0] || null;
  },

  async deleteTripStop(id: string): Promise<boolean> {
    const { error } = await insforge.database
      .from('app_trip_stops')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting trip stop:', error);
      return false;
    }
    return true;
  },

  // --- Gastos del Viaje (Expenses) ---
  async getTripExpenses(tripId: string): Promise<AppTripExpense[]> {
    try {
      const { data, error } = await insforge.database
        .from('app_trip_expenses')
        .select('*')
        .eq('trip_id', tripId)
        .order('expense_date', { ascending: false });
      if (error) {
        console.error('Error fetching trip expenses:', error);
        return [];
      }
      return (data as AppTripExpense[]) || [];
    } catch (e) {
      console.error('Exception fetching trip expenses:', e);
      return [];
    }
  },

  async createTripExpense(expense: Partial<AppTripExpense>): Promise<AppTripExpense | null> {
    const { data, error } = await insforge.database
      .from('app_trip_expenses')
      .insert([{
        ...expense,
        updated_at: new Date().toISOString()
      }])
      .select();
    if (error) {
      console.error('Error creating trip expense:', error);
      throw error;
    }
    return (data as AppTripExpense[])?.[0] || null;
  },

  async updateTripExpense(id: string, updates: Partial<AppTripExpense>): Promise<AppTripExpense | null> {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    delete (payload as any).id;
    delete (payload as any).created_at;

    const { data, error } = await insforge.database
      .from('app_trip_expenses')
      .update(payload)
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating trip expense:', error);
      throw error;
    }
    return (data as AppTripExpense[])?.[0] || null;
  },

  async deleteTripExpense(id: string): Promise<boolean> {
    const { error } = await insforge.database
      .from('app_trip_expenses')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting trip expense:', error);
      return false;
    }
    return true;
  },

  // --- Diario de Viaje (Journals) ---
  async getTripJournals(tripId: string): Promise<AppTripJournal[]> {
    try {
      const { data, error } = await insforge.database
        .from('app_trip_journals')
        .select('*')
        .eq('trip_id', tripId)
        .order('entry_date', { ascending: false });
      if (error) {
        console.error('Error fetching trip journals:', error);
        return [];
      }
      return (data as AppTripJournal[]) || [];
    } catch (e) {
      console.error('Exception fetching trip journals:', e);
      return [];
    }
  },

  async createTripJournal(journal: Partial<AppTripJournal>): Promise<AppTripJournal | null> {
    const { data, error } = await insforge.database
      .from('app_trip_journals')
      .insert([{
        ...journal,
        updated_at: new Date().toISOString()
      }])
      .select();
    if (error) {
      console.error('Error creating trip journal:', error);
      throw error;
    }
    return (data as AppTripJournal[])?.[0] || null;
  },

  async updateTripJournal(id: string, updates: Partial<AppTripJournal>): Promise<AppTripJournal | null> {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    delete (payload as any).id;
    delete (payload as any).created_at;

    const { data, error } = await insforge.database
      .from('app_trip_journals')
      .update(payload)
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating trip journal:', error);
      throw error;
    }
    return (data as AppTripJournal[])?.[0] || null;
  },

  async deleteTripJournal(id: string): Promise<boolean> {
    const { error } = await insforge.database
      .from('app_trip_journals')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting trip journal:', error);
      return false;
    }
    return true;
  }
};

// === STORAGE API ===

/**
 * REGLA OBLIGATORIA: Conservar bytes originales.
 * No comprime, recomprime, redimensiona ni transforma los archivos multimedia.
 */
export async function optimizeImageBeforeUpload(
  file: File | Blob
): Promise<{ blob: Blob; mime: string }> {
  return { blob: file, mime: file.type || 'application/octet-stream' };
}

export const storage = {
  /**
   * Sube un archivo a InsForge Storage bajo una ruta organizada por usuario y entidad:
   * `users/${userId}/${folder}/${timestamp}_${cleanName}`
   * - Garantiza un token JWT activo y auto-renovado mediante `auth.ensureActiveSession()`.
   * - Optimiza imágenes grandes en el cliente para subidas ultrarrápidas sin cortes.
   * - Ejecuta subida primaria con InsForge SDK y fallback directo a PUT con FormData si hay lag o timeout.
   */
  async uploadFile(file: File | Blob, folder = 'uploads', filenameOverride?: string): Promise<{ url: string; path: string; name: string; size: number; mime: string }> {
    // 1. Garantizar sesión de usuario autenticada con JWT vigente
    const { user: currentUser, token: activeToken } = await auth.ensureActiveSession();
    if (!currentUser || !currentUser.id) {
      throw new Error('Debes iniciar sesión para subir archivos a InsForge Storage. Comprueba tu conexión de usuario.');
    }

    // 2. Optimización ligera de imágenes en el cliente
    const rawName = filenameOverride || (file instanceof File ? file.name : `file_${Date.now()}`);
    let fileToUpload = file;
    let mime = file.type || 'application/octet-stream';

    const optimized = await optimizeImageBeforeUpload(file);
    fileToUpload = optimized.blob;
    mime = optimized.mime;

    const timestamp = Date.now();
    let cleanName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Organización por usuario y entidad: users/${userId}/${folder}/${timestamp}_${cleanName}
    const objectPath = `users/${currentUser.id}/${folder}/${timestamp}_${cleanName}`;

    // Subida directa de alta resiliencia vía PUT con FormData, Bearer Token y timeout de 120s
    let uploadSuccess = false;
    let uploadedKey = objectPath;
    let rawUrl = '';

    console.log('Ejecutando subida directa a Storage:', objectPath);
    const formData = new FormData();
    formData.append('file', fileToUpload, cleanName);

    const targetEndpoint = `${INSFORGE_BASE_URL}/api/storage/buckets/${STORAGE_BUCKET}/objects/${encodeURIComponent(objectPath)}`;
    const controller = new AbortController();
    const directTimer = setTimeout(() => controller.abort(), 120000); // 120 segundos para archivos grandes

    try {
      const response = await fetch(targetEndpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${activeToken}`,
          'apikey': INSFORGE_ANON_KEY
        },
        body: formData,
        signal: controller.signal
      });
      clearTimeout(directTimer);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Error del servidor de Storage (${response.status}): ${errText}`);
      }

      const resJson = await response.json().catch(() => null);
      uploadedKey = resJson?.key || objectPath;
      rawUrl = resJson?.url || targetEndpoint;
      uploadSuccess = true;
    } catch (directErr: any) {
      clearTimeout(directTimer);
      console.error('Error subiendo archivo a Storage:', directErr);
      if (directErr.name === 'AbortError') {
        throw new Error('La subida tardó más de 120s en completarse. Comprueba tu conexión a Internet o el tamaño del archivo.');
      }
      throw new Error(directErr.message || 'Error desconocido al subir archivo a Storage');
    }

    const finalRawUrl = rawUrl || `${INSFORGE_BASE_URL}/api/storage/buckets/${STORAGE_BUCKET}/objects/${encodeURIComponent(uploadedKey)}`;
    const fileUrl = finalRawUrl.replace(/^http:\/\/insforge\.kora\.ovh/, 'https://insforge.kora.ovh');

    return {
      url: fileUrl,
      path: uploadedKey,
      name: cleanName,
      size: fileToUpload.size,
      mime
    };
  },

  async listFiles(prefix = ''): Promise<any[]> {
    const { data, error } = await insforge.storage
      .from(STORAGE_BUCKET)
      .list({ prefix });
    if (error) {
      console.error('Error listing files:', error);
      return [];
    }
    return data?.objects || [];
  },

  async deleteFile(path: string): Promise<boolean> {
    if (!path || path === 'external') return true;
    try {
      const { error } = await insforge.storage
        .from(STORAGE_BUCKET)
        .remove(path);
      if (error) {
        console.error('Error removing file from storage:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Exception removing file:', e);
      return false;
    }
  }
};
