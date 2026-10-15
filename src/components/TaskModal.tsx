import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  CheckSquare, 
  Layers, 
  Paperclip, 
  Calendar, 
  Clock, 
  FolderKanban, 
  Tag, 
  AlertTriangle, 
  Flame, 
  CalendarClock, 
  UserCheck, 
  Trash2, 
  Plus, 
  Check, 
  ExternalLink, 
  Image as ImageIcon, 
  Video, 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  List, 
  ListOrdered, 
  Quote, 
  Eye, 
  Edit3, 
  Search, 
  Copy, 
  Download, 
  Upload,
  AlertCircle,
  Building2,
  Link2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  AppTask, 
  AppProject, 
  AppNote, 
  TaskCategory, 
  AppAttachment, 
  EisenhowerCategory,
  TaskStatus,
  TaskPriority,
  KubbonetSpace,
  KubbonetFolder,
  KubbonetList
} from '../lib/types';
import { db, storage } from '../lib/insforge';
import { r2Storage } from '../lib/r2Client';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: AppTask | null; // null if creating new task
  projects: AppProject[];
  notes: AppNote[];
  categories: TaskCategory[];
  spaces?: KubbonetSpace[];
  folders?: KubbonetFolder[];
  lists?: KubbonetList[];
  initialListId?: number | null;
  initialStatus?: TaskStatus;
  onSave: (taskData: Partial<AppTask>) => Promise<void>;
  onDelete?: (taskId: string) => Promise<void>;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  task,
  projects,
  notes,
  categories,
  spaces = [],
  folders = [],
  lists = [],
  initialListId,
  initialStatus = 'todo',
  onSave,
  onDelete
}) => {
  const isEditing = !!task?.id;
  const [activeTab, setActiveTab] = useState<'details' | 'subtasks' | 'attachments'>('details');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [eisenhower, setEisenhower] = useState<EisenhowerCategory>('none');
  const [categoryId, setCategoryId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [noteId, setNoteId] = useState<string>('');
  const [listaId, setListaId] = useState<number | null>(task?.lista_id || initialListId || (lists[0]?.id || 3));
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [taskUrl, setTaskUrl] = useState<string>('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  
  // Markdown Editor / Preview Mode
  const [descViewMode, setDescViewMode] = useState<'edit' | 'preview'>('edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subtasks & Attachments Data
  const [subtasks, setSubtasks] = useState<AppTask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [loadingSubtasks, setLoadingSubtasks] = useState(false);

  const [attachments, setAttachments] = useState<AppAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [copiedAttachmentId, setCopiedAttachmentId] = useState<string | null>(null);

  // Initialize or Reset Form
  useEffect(() => {
    if (isOpen) {
      if (task) {
        setTitle(task.title || '');
        setDescription(task.description || '');
        setStatus(task.status || 'todo');
        setPriority(task.priority || 'medium');
        setEisenhower(task.eisenhower || 'none');
        setCategoryId(task.category_id ? String(task.category_id) : '');
        setProjectId(task.project_id || '');
        setNoteId(task.note_id || '');
        setListaId(task.lista_id || initialListId || (lists[0]?.id || 3));
        setScheduledDate(task.scheduled_date ? task.scheduled_date.slice(0, 10) : '');
        setDueDate(task.due_date ? task.due_date.slice(0, 16) : '');
        setTaskUrl(task.url || '');
        setThumbnailUrl(task.thumbnail_url || '');

        // Fetch subtasks and attachments for existing task
        loadSubtasks(task.id);
        loadAttachments(task.id);
      } else {
        // Reset for new task
        setTitle('');
        setDescription('');
        setStatus(initialStatus);
        setPriority('medium');
        setEisenhower('none');
        setCategoryId('');
        setProjectId('');
        setNoteId('');
        setListaId(initialListId || (lists[0]?.id || 3));
        setScheduledDate('');
        setDueDate('');
        setTaskUrl('');
        setThumbnailUrl('');
        setSubtasks([]);
        setAttachments([]);
      }
      setHasUnsavedChanges(false);
      setValidationError(null);
      setActiveTab('details');
      setDescViewMode('edit');
    }
  }, [isOpen, task, initialStatus, initialListId]);

  // Load Subtasks
  const loadSubtasks = async (taskId: string) => {
    try {
      setLoadingSubtasks(true);
      const subs = await db.getSubtasks(taskId);
      setSubtasks(subs);
    } catch (e) {
      console.error('Error cargando subtareas:', e);
    } finally {
      setLoadingSubtasks(false);
    }
  };

  // Load Attachments
  const loadAttachments = async (taskId: string) => {
    try {
      const atts = await db.getAttachments(taskId);
      setAttachments(atts);
    } catch (e) {
      console.error('Error cargando adjuntos:', e);
    }
  };

  if (!isOpen) return null;

  // Handle Safe Close with Unsaved Changes Warning
  const handleSafeClose = () => {
    if (hasUnsavedChanges) {
      if (confirm('Tienes cambios sin guardar en esta tarea. ¿Seguro que deseas salir y descartarlos?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Formatting helpers for Markdown editor
  const applyFormat = (prefix: string, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = description;
    const selected = text.slice(start, end);
    const replacement = `${prefix}${selected || 'texto'}${suffix}`;

    const nextText = text.slice(0, start) + replacement + text.slice(end);
    setDescription(nextText);
    setHasUnsavedChanges(true);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected.length || 5));
    }, 20);
  };

  const handleInsertImage = async (file: File) => {
    try {
      setIsUploadingAttachment(true);
      const res = await r2Storage.uploadFile(file, 'tasks');
      const mdSnippet = `\n\n![${res.name}](${res.url})\n\n`;
      setDescription(prev => prev + mdSnippet);
      setHasUnsavedChanges(true);

      // If task already exists, record as attachment too
      if (task?.id) {
        const att = await db.recordAttachment({
          entity_id: task.id,
          entity_type: 'task',
          file_name: res.name,
          display_name: file.name,
          file_url: res.url,
          file_path: res.r2Key,
          r2_key: res.provider === 'r2' ? res.r2Key : undefined,
          bucket_name: res.provider === 'r2' ? 'cloudflare-r2' : 'app-storage',
          storage_provider: res.provider,
          file_size: res.size,
          mime_type: res.mime,
          migration_status: res.provider === 'r2' ? 'migrated' : 'pending'
        });
        if (att) setAttachments(prev => [att, ...prev]);
      }
    } catch (e: any) {
      alert('Error al subir imagen: ' + e.message);
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleInsertVideoUrl = () => {
    const url = prompt('Ingresa la URL del video (YouTube, Vimeo, MP4):');
    if (!url) return;
    
    // YouTube embed helper
    let snippet = '';
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (ytMatch) {
      snippet = `\n\n[![Video](https://img.youtube.com/vi/${ytMatch[1]}/0.jpg)](https://www.youtube.com/watch?v=${ytMatch[1]})\n\n`;
    } else {
      snippet = `\n\n🎬 [Ver Video](${url})\n\n`;
    }
    setDescription(prev => prev + snippet);
    setHasUnsavedChanges(true);
  };

  // Subtasks actions
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSub = newSubtaskTitle.trim();
    if (!cleanSub) return;

    if (!task?.id) {
      // Tarea nueva sin guardar: mantener en estado local pendiente
      const tempSub: AppTask = {
        id: `temp_sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: cleanSub,
        status: 'todo',
        priority: priority,
        parent_task_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setSubtasks(prev => [...prev, tempSub]);
      setNewSubtaskTitle('');
      setHasUnsavedChanges(true);
      return;
    }

    try {
      const created = await db.createSubtask({
        parent_task_id: task.id,
        title: cleanSub,
        status: 'todo',
        priority: priority
      });
      if (created) {
        setSubtasks(prev => [...prev, created]);
        setNewSubtaskTitle('');
      }
    } catch (err: any) {
      alert('Error creando subtarea: ' + err.message);
    }
  };

  const handleToggleSubtask = async (sub: AppTask) => {
    const nextStatus: TaskStatus = sub.status === 'completed' ? 'todo' : 'completed';
    if (sub.id.startsWith('temp_')) {
      setSubtasks(prev => prev.map(s => s.id === sub.id ? { ...s, status: nextStatus } : s));
      setHasUnsavedChanges(true);
      return;
    }
    const updated = await db.updateTask(sub.id, {
      status: nextStatus,
      completed_at: nextStatus === 'completed' ? new Date().toISOString() : null
    });
    if (updated) {
      setSubtasks(prev => prev.map(s => s.id === sub.id ? updated : s));
    }
  };

  const handleDeleteSubtask = async (subId: string) => {
    if (subId.startsWith('temp_')) {
      setSubtasks(prev => prev.filter(s => s.id !== subId));
      setHasUnsavedChanges(true);
      return;
    }
    await db.deleteTask(subId);
    setSubtasks(prev => prev.filter(s => s.id !== subId));
  };

  // Attachments upload action
  const handleUploadNewAttachment = async (file: File) => {
    try {
      setIsUploadingAttachment(true);
      const res = await r2Storage.uploadFile(file, 'tasks');
      
      const isImg = res.mime?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(res.name);
      if (isImg && !thumbnailUrl) {
        setThumbnailUrl(res.url);
      }

      if (!task?.id) {
        // Tarea nueva sin guardar: registrar adjunto pendiente y persistir enlace al guardar la tarea
        const tempAtt: AppAttachment = {
          id: `temp_att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          entity_id: '',
          entity_type: 'task',
          file_name: res.name,
          display_name: file.name,
          file_url: res.url,
          file_path: res.r2Key,
          r2_key: res.provider === 'r2' ? res.r2Key : undefined,
          bucket_name: res.provider === 'r2' ? 'cloudflare-r2' : 'app-storage',
          storage_provider: res.provider,
          file_size: res.size,
          mime_type: res.mime,
          created_at: new Date().toISOString()
        };
        setAttachments(prev => [tempAtt, ...prev]);
        setHasUnsavedChanges(true);
        return;
      }

      const recorded = await db.recordAttachment({
        entity_id: task.id,
        entity_type: 'task',
        file_name: res.name,
        display_name: file.name,
        file_url: res.url,
        file_path: res.r2Key,
        r2_key: res.provider === 'r2' ? res.r2Key : undefined,
        bucket_name: res.provider === 'r2' ? 'cloudflare-r2' : 'app-storage',
        storage_provider: res.provider,
        file_size: res.size,
        mime_type: res.mime,
        migration_status: res.provider === 'r2' ? 'migrated' : 'pending'
      });
      if (recorded) {
        setAttachments(prev => [recorded, ...prev]);
      }
    } catch (e: any) {
      alert('Error subiendo adjunto a R2: ' + e.message);
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (attId: string, path: string) => {
    if (!confirm('¿Eliminar este adjunto?')) return;
    await storage.deleteFile(path);
    if (!attId.startsWith('temp_')) {
      await db.deleteAttachment(attId);
    }
    setAttachments(prev => prev.filter(a => a.id !== attId));
  };

  const handleCopyMarkdown = (att: AppAttachment) => {
    const isImg = att.mime_type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(att.file_name);
    const md = isImg ? `![${att.file_name}](${att.file_url})` : `[${att.file_name}](${att.file_url})`;
    navigator.clipboard.writeText(md);
    setCopiedAttachmentId(att.id);
    setTimeout(() => setCopiedAttachmentId(null), 2000);
  };

  // Main Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setValidationError('El título de la tarea es obligatorio y no puede consistir únicamente en espacios en blanco.');
      return;
    }

    if (cleanTitle.length > 250) {
      setValidationError('El título supera el límite máximo permitido de 250 caracteres.');
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);

    try {
      const taskData: Partial<AppTask> = {
        title: cleanTitle,
        description: description.trim() || undefined,
        status,
        priority,
        eisenhower,
        category_id: categoryId ? Number(categoryId) : null,
        project_id: projectId || null,
        note_id: noteId || null,
        lista_id: listaId || null,
        product_id: task?.product_id || null,
        url: taskUrl.trim() || null,
        thumbnail_url: thumbnailUrl.trim() || null,
        scheduled_date: scheduledDate || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
        content_rich: {
          version: 1,
          has_multimedia: description.includes('!['),
          ...(task?.content_rich?.product_snapshot ? { product_snapshot: task.content_rich.product_snapshot } : {})
        }
      };

      const savedTask = await onSave(taskData);
      const finalTaskId = task?.id || (savedTask as any)?.id;

      // Si la tarea era nueva, persistir subtareas y adjuntos pendientes
      if (finalTaskId) {
        const pendingSubs = subtasks.filter(s => s.id.startsWith('temp_'));
        for (const s of pendingSubs) {
          try {
            await db.createSubtask({
              parent_task_id: finalTaskId,
              title: s.title,
              status: s.status,
              priority: s.priority
            });
          } catch (errSub) {
            console.error('Error guardando subtarea pendiente:', errSub);
          }
        }

        const pendingAtts = attachments.filter(a => a.id.startsWith('temp_'));
        for (const a of pendingAtts) {
          try {
            await db.recordAttachment({
              entity_id: finalTaskId,
              entity_type: 'task',
              file_name: a.file_name,
              file_url: a.file_url,
              file_path: a.file_path,
              bucket_name: a.bucket_name,
              file_size: a.file_size,
              mime_type: a.mime_type
            });
          } catch (errAtt) {
            console.error('Error guardando adjunto pendiente:', errAtt);
          }
        }
      }

      setHasUnsavedChanges(false);
      onClose();
    } catch (err: any) {
      setValidationError('Error guardando tarea en InsForge: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Date Calculation Helpers
  const handleQuickScheduled = (daysOffset: number | null) => {
    if (daysOffset === null) {
      setScheduledDate('');
    } else {
      const target = new Date();
      target.setDate(target.getDate() + daysOffset);
      const yyyy = target.getFullYear();
      const mm = String(target.getMonth() + 1).padStart(2, '0');
      const dd = String(target.getDate()).padStart(2, '0');
      setScheduledDate(`${yyyy}-${mm}-${dd}`);
    }
    setHasUnsavedChanges(true);
  };

  // Check if due date is overdue
  const isOverdue = dueDate && new Date(dueDate) < new Date() && status !== 'completed' && status !== 'cancelled';

  // Completed subtasks count
  const completedSubsCount = subtasks.filter(s => s.status === 'completed').length;
  const subtasksPercent = subtasks.length > 0 ? Math.round((completedSubsCount / subtasks.length) * 100) : 0;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto"
      onClick={handleSafeClose}
    >
      <div 
        className="bg-[#181822] border border-[#2e2e42] rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col my-auto max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado Principal */}
        <div className="px-6 py-4 bg-[#14141c] border-b border-[#252535] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white shadow-md shadow-amber-900/40">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {isEditing ? 'Editar Tarea Ágil' : 'Nueva Tarea Ágil'}
                {isOverdue && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-950/80 text-red-300 border border-red-800/60 flex items-center gap-1 font-semibold uppercase animate-pulse">
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    Vencida
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-0.5 flex-wrap">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-gray-300 font-medium">Grupo Kubbonet</span>
                {(() => {
                  const currentList = lists?.find(l => l.id === listaId);
                  if (!currentList) return null;
                  const currentSpace = spaces?.find(s => s.id === currentList.espacio_id);
                  const currentFolder = folders?.find(f => f.id === currentList.carpeta_id);
                  return (
                    <>
                      <span>/</span>
                      <span className="text-indigo-300 font-medium">{currentSpace?.nombre || 'Espacio'}</span>
                      {currentFolder && (
                        <>
                          <span>/</span>
                          <span className="text-cyan-300 font-medium">{currentFolder.nombre}</span>
                        </>
                      )}
                      <span>/</span>
                      <span className="text-blue-300 font-semibold">{currentList.nombre}</span>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSafeClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252535] transition"
              title="Cerrar formulario"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Pestañas (Tabs) Funcionales */}
        <div className="px-6 bg-[#13131a] border-b border-[#232332] flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'details'
                ? 'border-amber-500 text-amber-300 bg-amber-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Detalles de Tarea
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('subtasks')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'subtasks'
                ? 'border-amber-500 text-amber-300 bg-amber-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            Subtareas
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#20202e] text-gray-300 font-mono">
              {subtasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('attachments')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'attachments'
                ? 'border-amber-500 text-amber-300 bg-amber-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
            Adjuntos
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#20202e] text-gray-300 font-mono">
              {attachments.length}
            </span>
          </button>
        </div>

        {/* Mensaje de Error de Validación */}
        {validationError && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-950/60 border border-red-800/60 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Contenido de Pestañas con Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: DETALLES DE TAREA */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Campo: Título de la Tarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                    Título de la Tarea <span className="text-red-400">*</span>
                  </label>
                  <span className={`text-[10px] font-mono ${title.length > 230 ? 'text-orange-400' : 'text-gray-500'}`}>
                    {title.length}/250
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={250}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setHasUnsavedChanges(true);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="Ej. Revisar inventario de collar jade y sincronizar con Mercado Libre..."
                  className="w-full px-4 py-2.5 bg-[#121217] border border-[#2d2d3f] focus:border-amber-500 rounded-xl text-sm font-medium text-white placeholder-gray-500 outline-none transition"
                />
              </div>

              {/* Grid: Lista ClickUp, Estado, Prioridad, Categoría, Proyecto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Lista ClickUp */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-blue-300 flex items-center gap-1">
                    <ListOrdered className="w-3.5 h-3.5" />
                    Lista ClickUp
                  </label>
                  <select
                    value={listaId || ''}
                    onChange={(e) => {
                      setListaId(e.target.value ? Number(e.target.value) : null);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-2.5 py-2 bg-[#121217] border border-blue-500/30 focus:border-blue-400 rounded-lg text-xs text-blue-200 outline-none cursor-pointer truncate"
                  >
                    <option value="">Sin Lista (Inbox)</option>
                    {lists.map((l) => {
                      const sp = spaces.find(s => s.id === l.espacio_id);
                      const fo = folders.find(f => f.id === l.carpeta_id);
                      const label = `${sp?.nombre || 'Espacio'} > ${fo ? fo.nombre + ' > ' : ''}${l.nombre}`;
                      return (
                        <option key={l.id} value={l.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Estado */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Estado</label>
                  <select
                    value={status}
                    onChange={(e: any) => {
                      setStatus(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-3 py-2 bg-[#121217] border border-[#2b2b3a] focus:border-amber-500 rounded-lg text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="todo">Por hacer</option>
                    <option value="in_progress">En progreso</option>
                    <option value="in_review">En revisión</option>
                    <option value="completed">Completada</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </div>

                {/* Prioridad */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Prioridad</label>
                  <select
                    value={priority}
                    onChange={(e: any) => {
                      setPriority(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-3 py-2 bg-[#121217] border border-[#2b2b3a] focus:border-amber-500 rounded-lg text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente 🔥</option>
                  </select>
                </div>

                {/* Categoría */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Categoría</label>
                  <select
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-3 py-2 bg-[#121217] border border-[#2b2b3a] focus:border-amber-500 rounded-lg text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Proyecto Asignado */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">Proyecto</label>
                  <select
                    value={projectId}
                    onChange={(e) => {
                      setProjectId(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-3 py-2 bg-[#121217] border border-[#2b2b3a] focus:border-amber-500 rounded-lg text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="">Sin proyecto (General)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* URL de referencia y Miniatura de Imagen */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#14141c] p-4 rounded-xl border border-[#252535]">
                {/* Enlace / URL */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-blue-300">
                      <Link2 className="w-3.5 h-3.5" />
                      Enlace / URL de la Tarea
                    </span>
                    {taskUrl && (
                      <a 
                        href={taskUrl.startsWith('http') ? taskUrl : `https://${taskUrl}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        Abrir <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </label>
                  <input
                    type="url"
                    value={taskUrl}
                    onChange={(e) => {
                      setTaskUrl(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="https://ejemplo.com/recurso o documento..."
                    className="w-full px-3 py-2 bg-[#101015] border border-[#2a2a3b] focus:border-blue-500 rounded-lg text-xs text-white placeholder-gray-500 outline-none"
                  />
                </div>

                {/* Imagen / Miniatura */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-emerald-300">
                      <ImageIcon className="w-3.5 h-3.5" />
                      Imagen / Miniatura de la Tarea
                    </span>
                    {thumbnailUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setThumbnailUrl('');
                          setHasUnsavedChanges(true);
                        }}
                        className="text-[10px] text-red-400 hover:text-red-300"
                      >
                        Quitar
                      </button>
                    )}
                  </label>

                  <div className="flex items-center gap-2">
                    {thumbnailUrl ? (
                      <div className="relative w-12 h-10 rounded-lg overflow-hidden border border-[#2d2d3f] flex-shrink-0 bg-[#0d0d12]">
                        <img src={thumbnailUrl} alt="Miniatura" className="w-full h-full object-cover" />
                      </div>
                    ) : null}

                    <input
                      type="text"
                      value={thumbnailUrl}
                      onChange={(e) => {
                        setThumbnailUrl(e.target.value);
                        setHasUnsavedChanges(true);
                      }}
                      placeholder="URL de imagen o sube un archivo..."
                      className="flex-1 px-3 py-2 bg-[#101015] border border-[#2a2a3b] focus:border-emerald-500 rounded-lg text-xs text-white placeholder-gray-500 outline-none truncate"
                    />

                    <input
                      type="file"
                      id="task-thumbnail-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          try {
                            setIsUploadingAttachment(true);
                            const res = await r2Storage.uploadFile(e.target.files[0], 'tasks/thumbnails');
                            setThumbnailUrl(res.url);
                            setHasUnsavedChanges(true);
                          } catch (err: any) {
                            alert('Error subiendo imagen: ' + err.message);
                          } finally {
                            setIsUploadingAttachment(false);
                            e.target.value = '';
                          }
                        }
                      }}
                    />
                    <label
                      htmlFor="task-thumbnail-upload"
                      className="px-2.5 py-2 rounded-lg bg-[#20202e] hover:bg-emerald-600/30 text-emerald-300 hover:text-emerald-200 border border-[#2a2a3e] text-xs font-medium cursor-pointer transition flex items-center gap-1 flex-shrink-0"
                      title="Subir imagen desde tu equipo a Cloudflare R2"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Subir</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Fechas: Planificar Día y Fecha Límite */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#14141c] p-4 rounded-xl border border-[#252535]">
                {/* Planificar día (ejecución) */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    Planificar día (ejecución)
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => {
                      setScheduledDate(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-3 py-2 bg-[#101015] border border-[#2a2a3b] focus:border-blue-500 rounded-lg text-xs text-white outline-none"
                  />
                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => handleQuickScheduled(0)}
                      className="px-2.5 py-1 rounded bg-[#20202d] hover:bg-blue-900/40 text-blue-300 text-[11px] font-medium transition"
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickScheduled(1)}
                      className="px-2.5 py-1 rounded bg-[#20202d] hover:bg-blue-900/40 text-blue-300 text-[11px] font-medium transition"
                    >
                      Mañana
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickScheduled(null)}
                      className="px-2.5 py-1 rounded bg-[#20202d] hover:bg-gray-800 text-gray-400 text-[11px] transition"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                {/* Fecha límite / vencimiento */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Fecha límite / vencimiento
                    </span>
                    {dueDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setDueDate('');
                          setHasUnsavedChanges(true);
                        }}
                        className="text-[10px] text-gray-400 hover:text-white"
                      >
                        Quitar fecha
                      </button>
                    )}
                  </label>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => {
                      setDueDate(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className={`w-full px-3 py-2 bg-[#101015] border rounded-lg text-xs text-white outline-none ${
                      isOverdue ? 'border-red-500 focus:border-red-400' : 'border-[#2a2a3b] focus:border-amber-500'
                    }`}
                  />
                  {isOverdue && (
                    <p className="text-[11px] text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Esta tarea tiene una fecha límite vencida.
                    </p>
                  )}
                </div>
              </div>

              {/* Clasificación de Eisenhower */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  Clasificación de Eisenhower
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  {/* Sin clasificar */}
                  <button
                    type="button"
                    onClick={() => {
                      setEisenhower('none');
                      setHasUnsavedChanges(true);
                    }}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      eisenhower === 'none'
                        ? 'bg-[#252536] border-purple-500 text-white shadow-md'
                        : 'bg-[#14141c] border-[#262635] text-gray-400 hover:bg-[#1a1a24]'
                    }`}
                  >
                    <span className="text-xs font-semibold">Sin clasificar</span>
                    <span className="text-[10px] text-gray-400 mt-1">General</span>
                  </button>

                  {/* 1. HACER */}
                  <button
                    type="button"
                    onClick={() => {
                      setEisenhower('do');
                      setHasUnsavedChanges(true);
                    }}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      eisenhower === 'do'
                        ? 'bg-red-950/60 border-red-500 text-red-100 shadow-md shadow-red-950/40 ring-1 ring-red-500'
                        : 'bg-[#14141c] border-[#262635] text-gray-300 hover:bg-[#1a1a24]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-red-400 font-bold text-xs">
                      <Flame className="w-3.5 h-3.5" />
                      1. HACER
                    </div>
                    <span className="text-[10px] text-red-300/80 mt-1">Urgente e Importante</span>
                  </button>

                  {/* 2. PROGRAMAR */}
                  <button
                    type="button"
                    onClick={() => {
                      setEisenhower('schedule');
                      setHasUnsavedChanges(true);
                    }}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      eisenhower === 'schedule'
                        ? 'bg-blue-950/60 border-blue-500 text-blue-100 shadow-md shadow-blue-950/40 ring-1 ring-blue-500'
                        : 'bg-[#14141c] border-[#262635] text-gray-300 hover:bg-[#1a1a24]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs">
                      <CalendarClock className="w-3.5 h-3.5" />
                      2. PROGRAMAR
                    </div>
                    <span className="text-[10px] text-blue-300/80 mt-1">No urgente e Importante</span>
                  </button>

                  {/* 3. DELEGAR */}
                  <button
                    type="button"
                    onClick={() => {
                      setEisenhower('delegate');
                      setHasUnsavedChanges(true);
                    }}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      eisenhower === 'delegate'
                        ? 'bg-amber-950/60 border-amber-500 text-amber-100 shadow-md shadow-amber-950/40 ring-1 ring-amber-500'
                        : 'bg-[#14141c] border-[#262635] text-gray-300 hover:bg-[#1a1a24]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                      <UserCheck className="w-3.5 h-3.5" />
                      3. DELEGAR
                    </div>
                    <span className="text-[10px] text-amber-300/80 mt-1">Urgente y No Importante</span>
                  </button>

                  {/* 4. ELIMINAR */}
                  <button
                    type="button"
                    onClick={() => {
                      setEisenhower('delete');
                      setHasUnsavedChanges(true);
                    }}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      eisenhower === 'delete'
                        ? 'bg-gray-800/80 border-gray-400 text-gray-100 shadow-md ring-1 ring-gray-400'
                        : 'bg-[#14141c] border-[#262635] text-gray-300 hover:bg-[#1a1a24]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-gray-400 font-bold text-xs">
                      <Trash2 className="w-3.5 h-3.5" />
                      4. ELIMINAR
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1">Ni urgente ni importante</span>
                  </button>
                </div>
              </div>

              {/* Descripción / Editor Enriquecido */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                    Descripción / Contenido Multimedia
                  </label>
                  
                  {/* Modo Editor vs Vista Previa */}
                  <div className="flex items-center bg-[#13131a] p-0.5 rounded-lg border border-[#2a2a3a]">
                    <button
                      type="button"
                      onClick={() => setDescViewMode('edit')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition ${
                        descViewMode === 'edit' ? 'bg-amber-600 text-white font-medium' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => setDescViewMode('preview')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition ${
                        descViewMode === 'preview' ? 'bg-amber-600 text-white font-medium' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      Vista Previa
                    </button>
                  </div>
                </div>

                {descViewMode === 'edit' ? (
                  <div className="border border-[#2d2d3f] rounded-xl overflow-hidden bg-[#121217]">
                    {/* Barra de Herramientas de Formato */}
                    <div className="px-3 py-1.5 bg-[#171720] border-b border-[#262635] flex items-center gap-1 flex-wrap text-gray-300">
                      <button
                        type="button"
                        onClick={() => applyFormat('**', '**')}
                        className="p-1.5 rounded hover:bg-[#252535] hover:text-white transition"
                        title="Negrita"
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormat('*', '*')}
                        className="p-1.5 rounded hover:bg-[#252535] hover:text-white transition"
                        title="Cursiva"
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </button>
                      <div className="w-[1px] h-4 bg-[#2f2f42] mx-1" />
                      <button
                        type="button"
                        onClick={() => applyFormat('# ')}
                        className="p-1.5 rounded hover:bg-[#252535] hover:text-white transition"
                        title="Encabezado H1"
                      >
                        <Heading1 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormat('## ')}
                        className="p-1.5 rounded hover:bg-[#252535] hover:text-white transition"
                        title="Encabezado H2"
                      >
                        <Heading2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="w-[1px] h-4 bg-[#2f2f42] mx-1" />
                      <button
                        type="button"
                        onClick={() => applyFormat('- ')}
                        className="p-1.5 rounded hover:bg-[#252535] hover:text-white transition"
                        title="Lista con viñetas"
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormat('1. ')}
                        className="p-1.5 rounded hover:bg-[#252535] hover:text-white transition"
                        title="Lista numerada"
                      >
                        <ListOrdered className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormat('> ')}
                        className="p-1.5 rounded hover:bg-[#252535] hover:text-white transition"
                        title="Cita"
                      >
                        <Quote className="w-3.5 h-3.5" />
                      </button>
                      <div className="w-[1px] h-4 bg-[#2f2f42] mx-1" />
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleInsertImage(e.target.files[0]);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 rounded hover:bg-[#252535] hover:text-cyan-400 transition"
                        title="Insertar imagen desde archivo (Sube a InsForge Storage)"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleInsertVideoUrl}
                        className="p-1.5 rounded hover:bg-[#252535] hover:text-amber-400 transition"
                        title="Insertar video (YouTube, Vimeo, MP4)"
                      >
                        <Video className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <textarea
                      ref={textareaRef}
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setHasUnsavedChanges(true);
                      }}
                      placeholder="Describe la tarea en Markdown o texto enriquecido. Puedes adjuntar imágenes, listas y videos..."
                      rows={6}
                      className="w-full p-4 bg-transparent text-xs text-gray-200 font-mono outline-none resize-y leading-relaxed"
                    />
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-[#2d2d3f] bg-[#121217] min-h-[160px] markdown-body text-xs">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {description || '*Sin descripción.*'}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SUBTAREAS */}
          {activeTab === 'subtasks' && (
            <div className="space-y-5">
              {/* Barra de progreso de subtareas */}
              <div className="bg-[#14141c] p-4 rounded-xl border border-[#252535] space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-gray-200">
                    Progreso de Subtareas ({completedSubsCount}/{subtasks.length} completadas)
                  </span>
                  <span className="text-blue-400 font-mono">{subtasksPercent}%</span>
                </div>
                <div className="w-full h-2 bg-[#101015] rounded-full overflow-hidden border border-[#252535]">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${subtasksPercent}%` }}
                  />
                </div>
              </div>

              {/* Formulario Nueva Subtarea */}
              <form onSubmit={handleAddSubtask} className="flex gap-2">
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="Escribe el nombre de la nueva subtarea..."
                  className="flex-1 px-4 py-2 bg-[#121217] border border-[#2b2b3a] focus:border-blue-500 rounded-lg text-xs text-white placeholder-gray-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={!task?.id}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar Subtarea
                </button>
              </form>

              {!task?.id && (
                <p className="text-[11px] text-amber-400 italic">
                  * Debes guardar la tarea principal para habilitar la adición de subtareas.
                </p>
              )}

              {/* Lista de Subtareas */}
              <div className="space-y-2">
                {subtasks.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 text-xs italic">
                    No hay subtareas registradas para esta tarea.
                  </div>
                ) : (
                  subtasks.map((sub) => {
                    const isDone = sub.status === 'completed';
                    return (
                      <div
                        key={sub.id}
                        className={`p-3 rounded-xl border flex items-center justify-between transition ${
                          isDone 
                            ? 'bg-[#121218] border-[#22222f] opacity-75' 
                            : 'bg-[#181824] border-[#28283a]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleSubtask(sub)}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                              isDone
                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                : 'border-[#38384d] hover:border-emerald-400 text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <span className={`text-xs ${isDone ? 'line-through text-gray-400' : 'text-gray-100 font-medium'}`}>
                            {sub.title}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteSubtask(sub.id)}
                          className="text-gray-500 hover:text-red-400 transition p-1"
                          title="Eliminar subtarea"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ADJUNTOS */}
          {activeTab === 'attachments' && (
            <div className="space-y-5">
              {/* Botón de subida a InsForge Storage */}
              <div className="bg-[#14141c] p-4 rounded-xl border border-[#252535] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-cyan-400" />
                    Archivos en InsForge Storage (app-storage)
                  </h4>
                  <p className="text-[11px] text-gray-400">Sube imágenes, documentos, capturas o PDFs vinculados a esta tarea.</p>
                </div>

                <input
                  type="file"
                  id="modal-attachment-upload"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleUploadNewAttachment(e.target.files[0]);
                    }
                  }}
                />
                <label
                  htmlFor="modal-attachment-upload"
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition cursor-pointer flex items-center gap-1.5 ${
                    isUploadingAttachment ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <Upload className={`w-3.5 h-3.5 ${isUploadingAttachment ? 'animate-bounce' : ''}`} />
                  {isUploadingAttachment ? 'Subiendo...' : 'Subir Adjunto'}
                </label>
              </div>

              {!task?.id && (
                <p className="text-[11px] text-amber-400 italic">
                  * Debes guardar la tarea principal para habilitar la carga de adjuntos directos.
                </p>
              )}

              {/* Lista de Adjuntos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {attachments.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-gray-500 text-xs italic">
                    No hay archivos adjuntos en esta tarea.
                  </div>
                ) : (
                  attachments.map((att) => {
                    const isImg = att.mime_type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(att.file_name);
                    const isCopied = copiedAttachmentId === att.id;

                    return (
                      <div
                        key={att.id}
                        className="bg-[#161622] rounded-xl border border-[#252538] p-3 flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 rounded-lg bg-[#111116] border border-[#242435] flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {isImg ? (
                              <img src={att.file_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Paperclip className="w-4 h-4 text-cyan-400" />
                            )}
                          </div>
                          <div className="overflow-hidden">
                            <div className="text-xs font-medium text-white truncate" title={att.file_name}>
                              {att.file_name}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono">
                              {att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB` : 'Archivo'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyMarkdown(att)}
                            className="p-1.5 rounded hover:bg-[#252538] text-gray-400 hover:text-cyan-300 transition"
                            title="Copiar sintaxis Markdown"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <a
                            href={att.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded hover:bg-[#252538] text-gray-400 hover:text-white transition"
                            title="Abrir archivo"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(att.id, att.file_path)}
                            className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition"
                            title="Eliminar adjunto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer / Barra de Guardado */}
        <div className="px-6 py-4 bg-[#14141c] border-t border-[#252535] flex items-center justify-between">
          <div>
            {isEditing && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`¿Estás seguro de eliminar permanentemente la tarea "${title}"?`)) {
                    onDelete(task.id);
                    onClose();
                  }
                }}
                className="text-xs text-red-400 hover:text-red-300 transition flex items-center gap-1 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar Tarea
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSafeClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#252535] transition"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition shadow-lg shadow-amber-900/30 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Guardando en InsForge...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {isEditing ? 'Guardar Cambios' : 'Crear Tarea Ágil'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
