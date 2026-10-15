import { createClient } from '@insforge/sdk';
import { 
  AppNote, 
  AppNotebook,
  AppProject, 
  AppTask, 
  AppObject, 
  AppLink, 
  AppAttachment,
  AppReminder,
  ProductCatalogItem,
  TaskCategory,
  KubbonetWorkspace,
  KubbonetSpace,
  KubbonetFolder,
  KubbonetList
} from './types';
import { auth } from './auth';

export const INSFORGE_BASE_URL = 'https://insforge.kora.ovh';
export const INSFORGE_ANON_KEY = 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba';
export const STORAGE_BUCKET = 'app-storage';

export const insforge = createClient({
  baseUrl: INSFORGE_BASE_URL,
  anonKey: INSFORGE_ANON_KEY,
});

// === DATABASE API ===

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
    return (data as unknown as AppNotebook[]) || [];
  },

  async createNotebook(notebook: Partial<AppNotebook>): Promise<AppNotebook | null> {
    const { data, error } = await insforge.database
      .from('app_notebooks')
      .insert([notebook])
      .select();
    if (error) {
      console.error('Error creating notebook:', error);
      throw error;
    }
    return (data as unknown as AppNotebook[])?.[0] || null;
  },

  async updateNotebook(id: string, updates: Partial<AppNotebook>): Promise<AppNotebook | null> {
    const { data, error } = await insforge.database
      .from('app_notebooks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating notebook:', error);
      throw error;
    }
    return (data as unknown as AppNotebook[])?.[0] || null;
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
    return (data as unknown as AppNote[]) || [];
  },

  async createNote(note: Partial<AppNote>): Promise<AppNote | null> {
    const { data, error } = await insforge.database
      .from('app_notes')
      .insert([note])
      .select();
    if (error) {
      console.error('Error creating note:', error);
      throw error;
    }
    return (data as unknown as AppNote[])?.[0] || null;
  },

  async updateNote(id: string, updates: Partial<AppNote>): Promise<AppNote | null> {
    const { data, error } = await insforge.database
      .from('app_notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating note:', error);
      throw error;
    }
    return (data as unknown as AppNote[])?.[0] || null;
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

  // Proyectos
  async getProjects(): Promise<AppProject[]> {
    const { data, error } = await insforge.database
      .from('app_projects')
      .select()
      .order('created_at', { ascending: false });
    if (error) console.error('Error fetching projects:', error);
    return (data as unknown as AppProject[]) || [];
  },

  async createProject(project: Partial<AppProject>): Promise<AppProject | null> {
    const { data, error } = await insforge.database
      .from('app_projects')
      .insert([project])
      .select();
    if (error) {
      console.error('Error creating project:', error);
      throw error;
    }
    return (data as unknown as AppProject[])?.[0] || null;
  },

  async updateProject(id: string, updates: Partial<AppProject>): Promise<AppProject | null> {
    const { data, error } = await insforge.database
      .from('app_projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating project:', error);
      throw error;
    }
    return (data as unknown as AppProject[])?.[0] || null;
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
    return (data as unknown as AppTask[]) || [];
  },

  async createTask(task: Partial<AppTask>): Promise<AppTask | null> {
    const { data, error } = await insforge.database
      .from('app_tasks')
      .insert([task])
      .select();
    if (error) {
      console.error('Error creating task:', error);
      throw error;
    }
    return (data as unknown as AppTask[])?.[0] || null;
  },

  async updateTask(id: string, updates: Partial<AppTask>): Promise<AppTask | null> {
    const { data, error } = await insforge.database
      .from('app_tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating task:', error);
      throw error;
    }
    return (data as unknown as AppTask[])?.[0] || null;
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

  // Objetos personalizados
  async getObjects(): Promise<AppObject[]> {
    const { data, error } = await insforge.database
      .from('app_objects')
      .select()
      .order('created_at', { ascending: false });
    if (error) console.error('Error fetching objects:', error);
    return (data as unknown as AppObject[]) || [];
  },

  async createObject(obj: Partial<AppObject>): Promise<AppObject | null> {
    const { data, error } = await insforge.database
      .from('app_objects')
      .insert([obj])
      .select();
    if (error) {
      console.error('Error creating object:', error);
      throw error;
    }
    return (data as unknown as AppObject[])?.[0] || null;
  },

  async updateObject(id: string, updates: Partial<AppObject>): Promise<AppObject | null> {
    const { data, error } = await insforge.database
      .from('app_objects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) {
      console.error('Error updating object:', error);
      throw error;
    }
    return (data as unknown as AppObject[])?.[0] || null;
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

  // Enlaces y Grafo
  async getLinks(): Promise<AppLink[]> {
    const { data, error } = await insforge.database
      .from('app_links')
      .select();
    if (error) console.error('Error fetching links:', error);
    return (data as unknown as AppLink[]) || [];
  },

  async syncNoteLinks(noteId: string, wikilinks: string[], allEntities: { id: string; title: string; type: string }[]) {
    await insforge.database
      .from('app_links')
      .delete()
      .eq('source_id', noteId);

    if (wikilinks.length === 0) return;

    const linksToInsert = wikilinks.map(title => {
      const match = allEntities.find(e => e.title.toLowerCase() === title.toLowerCase());
      return {
        source_id: noteId,
        source_type: 'note',
        target_id: match ? match.id : null,
        target_type: match ? match.type : null,
        target_title: title,
        link_type: 'wikilink'
      };
    });

    await insforge.database
      .from('app_links')
      .insert(linksToInsert);
  },

  // Adjuntos (Archivos, Imágenes y Enlaces)
  async getAttachments(entityId?: string): Promise<AppAttachment[]> {
    let query = insforge.database.from('app_attachments').select().order('created_at', { ascending: false });
    if (entityId) {
      query = query.eq('entity_id', entityId);
    }
    const { data, error } = await query;
    if (error) console.error('Error fetching attachments:', error);
    return (data as unknown as AppAttachment[]) || [];
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
    return (data as unknown as AppAttachment[])?.[0] || null;
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
    const { error } = await insforge.database
      .from('app_attachments')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting attachment:', error);
      throw error;
    }
    return true;
  }
};

// === STORAGE API ===

export const storage = {
  /**
   * Sube un archivo a InsForge Storage bajo una ruta organizada por usuario y entidad:
   * `users/${userId}/${folder}/${timestamp}_${cleanName}`
   * Requiere una sesión de usuario autenticada con JWT para cumplir con las políticas de permisos.
   */
  async uploadFile(file: File | Blob, folder = 'uploads', filenameOverride?: string): Promise<{ url: string; path: string; name: string; size: number; mime: string }> {
    // 1. Verificar sesión autenticada
    const currentUser = await auth.getCurrentUser();
    if (!currentUser || !currentUser.id) {
      throw new Error('Debes iniciar sesión para subir archivos a InsForge Storage. Comprueba tu conexión de usuario.');
    }

    const timestamp = Date.now();
    const rawName = filenameOverride || (file instanceof File ? file.name : `audio_${timestamp}.webm`);
    const cleanName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Organización por usuario y entidad: users/${userId}/${folder}/${timestamp}_${cleanName}
    const objectPath = `users/${currentUser.id}/${folder}/${timestamp}_${cleanName}`;

    try {
      const { data, error } = await insforge.storage
        .from(STORAGE_BUCKET)
        .upload(objectPath, file);

      if (error) {
        console.error('Error detallado de InsForge Storage upload:', error);
        if (error.message?.includes('permission') || error.message?.includes('denied')) {
          throw new Error(`Permisos insuficientes en Storage para la ruta "${objectPath}". Revisa que tu sesión esté activa.`);
        }
        throw new Error(error.message || 'Error desconocido al subir archivo');
      }

      const rawUrl = data?.url || `${INSFORGE_BASE_URL}/api/storage/buckets/${STORAGE_BUCKET}/objects/${encodeURIComponent(objectPath)}`;
      const fileUrl = rawUrl.replace(/^http:\/\/insforge\.kora\.ovh/, 'https://insforge.kora.ovh');

      return {
        url: fileUrl,
        path: data?.key || objectPath,
        name: rawName,
        size: file.size,
        mime: file.type || 'application/octet-stream'
      };
    } catch (err: any) {
      console.error('Error en storage.uploadFile:', err);
      throw err;
    }
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
