import { createClient } from '@insforge/sdk';
import { 
  AppNote, 
  AppNotebook,
  AppProject, 
  AppTask, 
  AppObject, 
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
  KubbonetList
} from './types';
import { auth } from './auth';

export const INSFORGE_BASE_URL = 'https://insforge.kora.ovh';
export const INSFORGE_ANON_KEY = 'anon_6e45c1e47c7e83e3c5406969f76eb289f5a03eba';
export const STORAGE_BUCKET = 'app-storage';

export const insforge = createClient({
  baseUrl: INSFORGE_BASE_URL,
  anonKey: INSFORGE_ANON_KEY,
  timeout: 120000, // 2 minutos para soportar cargas de archivos e imágenes sin cortes prematuros
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
    const { id: _ignored, ...cleanUpdates } = updates;
    const { data, error } = await insforge.database
      .from('app_tasks')
      .update({ ...cleanUpdates, updated_at: new Date().toISOString() })
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
