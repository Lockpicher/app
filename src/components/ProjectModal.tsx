import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  FolderKanban, 
  Calendar, 
  Clock, 
  Trash2, 
  Plus, 
  Check, 
  ExternalLink, 
  Image as ImageIcon, 
  FileText, 
  Paperclip, 
  Link2, 
  Download, 
  Upload, 
  CheckSquare, 
  AlertTriangle, 
  Edit3, 
  Eye, 
  Maximize2,
  Copy,
  Layers,
  Sparkles,
  BarChart2,
  PanelRightClose,
  PanelRightOpen
} from 'lucide-react';
import { AppProject, AppTask, AppNote, AppAttachment } from '../lib/types';
import { db, storage } from '../lib/insforge';
import { r2Storage } from '../lib/r2Client';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: AppProject | null;
  tasks: AppTask[];
  notes: AppNote[];
  areas?: import('../lib/types').AppArea[];
  onSave: (projectData: Partial<AppProject>) => Promise<void>;
  onDelete?: (projectId: string) => Promise<void>;
  onCreateTask?: (taskData: Partial<AppTask>) => Promise<AppTask | null | void>;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  tasks,
  notes,
  areas = [],
  onSave,
  onDelete,
  onCreateTask
}) => {
  const isEditing = !!project?.id;
  const [activeTab, setActiveTab] = useState<'details' | 'attachments' | 'tasks'>('details');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<AppProject['status']>('active');
  const [priority, setPriority] = useState<AppProject['priority']>('medium');
  const [color, setColor] = useState('#6366f1');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [progress, setProgress] = useState(0);
  const [tagsInput, setTagsInput] = useState('');
  const [areaId, setAreaId] = useState<string>('');
  const [nextAction, setNextAction] = useState<string>('');

  // Attachments State
  const [attachments, setAttachments] = useState<AppAttachment[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [attachmentFilter, setAttachmentFilter] = useState<'all' | 'images' | 'documents' | 'links'>('all');
  const [isUploading, setIsUploading] = useState(false);

  // Link Form State
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);

  // Lightbox Image Preview Modal
  const [lightboxImage, setLightboxImage] = useState<AppAttachment | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Quick Task Creation inside project
  const [newProjectTaskTitle, setNewProjectTaskTitle] = useState('');
  const [isCreatingProjectTask, setIsCreatingProjectTask] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset form on open/project change
  useEffect(() => {
    if (isOpen) {
      if (project) {
        setTitle(project.title || '');
        setDescription(project.description || '');
        setStatus(project.status || 'active');
        setPriority(project.priority || 'medium');
        setColor(project.color || '#6366f1');
        setStartDate(project.start_date ? project.start_date.slice(0, 10) : '');
        setDueDate(project.due_date ? project.due_date.slice(0, 10) : '');
        setProgress(project.progress ?? 0);
        setTagsInput((project.tags || []).join(', '));
        setAreaId(project.area_id || '');
        setNextAction(project.next_action || '');
        loadAttachments(project.id);
      } else {
        setTitle('');
        setDescription('');
        setStatus('active');
        setPriority('medium');
        setColor('#6366f1');
        setStartDate('');
        setDueDate('');
        setProgress(0);
        setTagsInput('');
        setAreaId('');
        setNextAction('');
        setAttachments([]);
      }
      setHasUnsavedChanges(false);
      setErrorMessage(null);
      setSuccessMessage(null);
      setActiveTab('details');
      setIsAddingLink(false);
      setEditingLinkId(null);
    }
  }, [isOpen, project]);

  const [panelMode, setPanelMode] = useState<'panel' | 'modal'>('panel');

  // Keyboard shortcut: Escape to close safe
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasUnsavedChanges]);

  const loadAttachments = async (projectId: string) => {
    try {
      setIsLoadingAttachments(true);
      const items = await db.getAttachments(projectId);
      setAttachments(items);
    } catch (err: any) {
      console.error('Error cargando adjuntos del proyecto:', err);
    } finally {
      setIsLoadingAttachments(false);
    }
  };

  if (!isOpen) return null;

  // Handle Safe Close
  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (!confirm('Hay cambios sin guardar en el proyecto. ¿Seguro que deseas salir?')) {
        return;
      }
    }
    onClose();
  };

  // Submit Project Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('El nombre del proyecto es obligatorio.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const parsedTags = tagsInput
        .split(',')
        .map(t => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const projectData: Partial<AppProject> = {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        color,
        start_date: startDate || undefined,
        due_date: dueDate || undefined,
        progress: Number(progress) || 0,
        tags: parsedTags,
        area_id: areaId || null,
        next_action: nextAction.trim() || null
      };

      await onSave(projectData);
      setHasUnsavedChanges(false);
      setSuccessMessage('Proyecto guardado exitosamente.');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // If was creating new project, close
      if (!isEditing) {
        onClose();
      }
    } catch (err: any) {
      console.error('Error al guardar proyecto:', err);
      setErrorMessage(err.message || 'Error al guardar el proyecto en InsForge.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Upload File or Image to InsForge Storage
  const handleFileUpload = async (file: File) => {
    if (!project?.id) {
      alert('Guarda el proyecto primero antes de adjuntar archivos.');
      return;
    }

    try {
      setIsUploading(true);
      setErrorMessage(null);

      // Scoped folder for project files
      const isImg = file.type.startsWith('image/');
      const folder = `projects/${project.id}/${isImg ? 'images' : 'documents'}`;
      
      const res = await r2Storage.uploadFile(file, folder);

      // Record in app_attachments table
      const recorded = await db.recordAttachment({
        entity_id: project.id,
        entity_type: 'project',
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
        setSuccessMessage(`Archivo "${res.name}" subido a ${res.provider === 'r2' ? 'Cloudflare R2' : 'Storage'}.`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      console.error('Error subiendo archivo al proyecto:', err);
      setErrorMessage('Error al subir a InsForge Storage: ' + (err.message || 'Permisos insuficientes'));
    } finally {
      setIsUploading(false);
    }
  };

  // Add / Edit External Link
  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project?.id) {
      alert('Guarda el proyecto primero antes de agregar enlaces.');
      return;
    }

    let url = linkUrl.trim();
    if (!url) {
      setLinkError('La URL es obligatoria.');
      return;
    }

    // Auto-prefix protocol if missing
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    try {
      new URL(url);
    } catch {
      setLinkError('Por favor ingresa una URL válida (ej. https://ejemplo.com)');
      return;
    }

    try {
      const linkTitleToSave = linkTitle.trim() || url;

      if (editingLinkId) {
        // Update existing link
        const updated = await db.updateAttachment(editingLinkId, {
          file_name: linkTitleToSave,
          file_url: url
        });
        if (updated) {
          setAttachments(prev => prev.map(a => a.id === editingLinkId ? updated : a));
        }
      } else {
        // Create new external link record
        const created = await db.recordAttachment({
          entity_id: project.id,
          entity_type: 'project',
          file_name: linkTitleToSave,
          file_url: url,
          file_path: 'external',
          bucket_name: 'external',
          file_size: 0,
          mime_type: 'link'
        });
        if (created) {
          setAttachments(prev => [created, ...prev]);
        }
      }

      setLinkUrl('');
      setLinkTitle('');
      setIsAddingLink(false);
      setEditingLinkId(null);
      setLinkError(null);
    } catch (err: any) {
      console.error('Error guardando enlace:', err);
      setLinkError(err.message || 'Error al guardar enlace');
    }
  };

  const handleStartEditLink = (att: AppAttachment) => {
    setEditingLinkId(att.id);
    setLinkTitle(att.file_name);
    setLinkUrl(att.file_url);
    setIsAddingLink(true);
  };

  // Delete Attachment
  const handleDeleteAttachment = async (att: AppAttachment) => {
    if (!confirm(`¿Eliminar "${att.file_name}"?`)) return;

    try {
      if (att.bucket_name !== 'external' && att.file_path) {
        await storage.deleteFile(att.file_path);
      }
      await db.deleteAttachment(att.id);
      setAttachments(prev => prev.filter(a => a.id !== att.id));
    } catch (err: any) {
      console.error('Error eliminando adjunto:', err);
      alert('Error eliminando adjunto: ' + err.message);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Filter attachments
  const filteredAttachments = attachments.filter(a => {
    const isLink = a.mime_type === 'link' || a.bucket_name === 'external';
    const isImg = a.mime_type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(a.file_name);
    
    if (attachmentFilter === 'images') return isImg && !isLink;
    if (attachmentFilter === 'documents') return !isImg && !isLink;
    if (attachmentFilter === 'links') return isLink;
    return true;
  });

  const projectTasks = project ? tasks.filter(t => t.project_id === project.id) : [];
  const completedProjectTasks = projectTasks.filter(t => t.status === 'completed');
  const computedProgress = projectTasks.length > 0 
    ? Math.round((completedProjectTasks.length / projectTasks.length) * 100) 
    : progress;

  return (
    <div 
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-200 ${
        panelMode === 'panel'
          ? 'flex justify-end'
          : 'flex items-center justify-center p-2 sm:p-4 overflow-y-auto'
      }`}
      onClick={handleClose}
    >
      <div 
        className={`bg-[#181822] border-[#2b2b3c] shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          panelMode === 'panel'
            ? 'w-full max-w-2xl h-full border-l border-y-0 border-r-0 rounded-none sm:rounded-l-2xl animate-in slide-in-from-right duration-200'
            : 'w-full max-w-4xl border rounded-2xl my-auto h-[90vh] animate-in zoom-in-95 duration-200'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-[#252535] bg-[#14141c] flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0"
              style={{ backgroundColor: color }}
            >
              <FolderKanban className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <h2 className="text-base font-bold text-white flex items-center gap-2 truncate">
                <span className="truncate">{isEditing ? `Editar Proyecto: ${project.title}` : 'Nuevo Proyecto'}</span>
                {isEditing && (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-300 border border-blue-800/40 flex-shrink-0">
                    {status}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-400 truncate">
                Gestiona la configuración, cronograma, archivos y tareas de este proyecto.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Toggle Panel vs Modal button */}
            <button
              type="button"
              onClick={() => setPanelMode(prev => prev === 'panel' ? 'modal' : 'panel')}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252535] transition hidden sm:flex items-center justify-center"
              title={panelMode === 'panel' ? 'Expandir a modal centrado' : 'Acoplar a panel lateral'}
            >
              {panelMode === 'panel' ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <PanelRightClose className="w-4 h-4 text-blue-400" />
              )}
            </button>

            <button
              onClick={handleClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#252535] transition"
              title="Cerrar ventana (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-[#252535] bg-[#161620] flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <FolderKanban className="w-4 h-4" />
              Detalles del Proyecto
            </button>

            <button
              onClick={() => setActiveTab('attachments')}
              className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
                activeTab === 'attachments'
                  ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Paperclip className="w-4 h-4" />
              Adjuntos & Enlaces
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#242436] text-gray-300 font-mono">
                {attachments.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
                activeTab === 'tasks'
                  ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              Tareas Vinculadas
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#242436] text-gray-300 font-mono">
                {projectTasks.length}
              </span>
            </button>
          </div>

          {/* Quick Progress Indicator */}
          {isEditing && (
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1 font-mono text-gray-300">
                <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
                {computedProgress}% completado
              </span>
              <div className="w-24 h-2 bg-[#121217] rounded-full overflow-hidden border border-[#2b2b3c]">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${computedProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Notification Toasts */}
        {errorMessage && (
          <div className="px-6 py-2.5 bg-red-950/60 border-b border-red-800/60 text-red-200 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              {errorMessage}
            </span>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="px-6 py-2 bg-emerald-950/60 border-b border-emerald-800/60 text-emerald-200 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              {successMessage}
            </span>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' && (
            <form onSubmit={handleSubmit} className="space-y-5 max-w-3xl mx-auto">
              {/* Project Title */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                  Nombre del Proyecto <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Ej. Rediseño eCommerce 2026..."
                  className="w-full px-3.5 py-2.5 bg-[#121217] border border-[#2c2c3e] rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition font-medium"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                  Descripción / Alcance del Proyecto
                </label>
                <textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="Detalla los objetivos principales, entregables y especificaciones clave..."
                  rows={4}
                  className="w-full px-3.5 py-2.5 bg-[#121217] border border-[#2c2c3e] rounded-xl text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition resize-none leading-relaxed"
                />
              </div>

              {/* Status, Priority, Color */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">Estado</label>
                  <select
                    value={status}
                    onChange={(e: any) => {
                      setStatus(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-3 py-2 bg-[#121217] border border-[#2c2c3e] rounded-xl text-xs text-white outline-none cursor-pointer focus:border-blue-500"
                  >
                    <option value="planning">Planificación</option>
                    <option value="active">Activo / En curso</option>
                    <option value="on_hold">En Pausa</option>
                    <option value="completed">Completado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">Prioridad</label>
                  <select
                    value={priority}
                    onChange={(e: any) => {
                      setPriority(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-3 py-2 bg-[#121217] border border-[#2c2c3e] rounded-xl text-xs text-white outline-none cursor-pointer focus:border-blue-500"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">Color del Proyecto</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => {
                        setColor(e.target.value);
                        setHasUnsavedChanges(true);
                      }}
                      className="w-10 h-8 rounded-lg bg-[#121217] border border-[#2c2c3e] cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={color}
                      onChange={(e) => {
                        setColor(e.target.value);
                        setHasUnsavedChanges(true);
                      }}
                      className="flex-1 px-3 py-1.5 bg-[#121217] border border-[#2c2c3e] rounded-xl text-xs text-white font-mono outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                    Fecha de Inicio
                  </label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full pl-9 pr-3 py-2 bg-[#121217] border border-[#2c2c3e] rounded-xl text-xs text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                    Fecha Límite / Vencimiento
                  </label>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => {
                        setDueDate(e.target.value);
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full pl-9 pr-3 py-2 bg-[#121217] border border-[#2c2c3e] rounded-xl text-xs text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Tags / Etiquetas */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                  Etiquetas (separadas por coma)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => {
                    setTagsInput(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="ej. marketing, diseño, urgente, sprint-1"
                  className="w-full px-3.5 py-2 bg-[#121217] border border-[#2c2c3e] rounded-xl text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500 transition"
                />
              </div>

              {/* Sistema PARA: Área vinculada y Próxima Acción */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 bg-[#14141e] rounded-xl border border-purple-500/20">
                <div>
                  <label className="text-xs font-semibold text-purple-300 block mb-1.5 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    <span>Área de Responsabilidad (PARA)</span>
                  </label>
                  <select
                    value={areaId}
                    onChange={(e) => {
                      setAreaId(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-3 py-2 bg-[#121217] border border-[#2c2c3e] rounded-xl text-xs text-white outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="">Sin área vinculada</option>
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>{a.title || a.name || 'Área sin título'}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-amber-300 block mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Próxima Acción Inmediata</span>
                  </label>
                  <input
                    type="text"
                    value={nextAction}
                    onChange={(e) => {
                      setNextAction(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="¿Cuál es el siguiente paso concreto?"
                    className="w-full px-3 py-2 bg-[#121217] border border-[#2c2c3e] rounded-xl text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500 transition"
                  />
                </div>
              </div>

              {/* Progress Slider */}
              <div className="p-4 bg-[#14141c] rounded-xl border border-[#252535] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-300">Progreso Manual</span>
                  <span className="font-mono text-blue-400 font-bold">{progress}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={(e) => {
                    setProgress(Number(e.target.value));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full h-2 bg-[#252535] rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <p className="text-[11px] text-gray-400">
                  {projectTasks.length > 0 
                    ? `Nota: Existen ${projectTasks.length} tareas vinculadas. El progreso calculado es ${computedProgress}%.` 
                    : 'Ajusta el progreso del proyecto si no cuenta con tareas asignadas.'}
                </p>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-[#252535] flex items-center justify-between">
                {isEditing && onDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`¿Eliminar proyecto "${project.title}"? Esta acción no se puede deshacer.`)) {
                        onDelete(project.id);
                        onClose();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar Proyecto
                  </button>
                ) : <div />}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-[#252535] transition"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg shadow-blue-900/30 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>Guardando...</>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        {isEditing ? 'Guardar Cambios' : 'Crear Proyecto'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {activeTab === 'attachments' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {/* Attachment Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-[#252535]">
                {/* Filters */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setAttachmentFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      attachmentFilter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#1e1e2b] text-gray-400 hover:text-white'
                    }`}
                  >
                    Todos ({attachments.length})
                  </button>
                  <button
                    onClick={() => setAttachmentFilter('images')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      attachmentFilter === 'images'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#1e1e2b] text-gray-400 hover:text-white'
                    }`}
                  >
                    Imágenes
                  </button>
                  <button
                    onClick={() => setAttachmentFilter('documents')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      attachmentFilter === 'documents'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#1e1e2b] text-gray-400 hover:text-white'
                    }`}
                  >
                    Documentos
                  </button>
                  <button
                    onClick={() => setAttachmentFilter('links')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      attachmentFilter === 'links'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#1e1e2b] text-gray-400 hover:text-white'
                    }`}
                  >
                    Enlaces
                  </button>
                </div>

                {/* Upload & Add Link Actions */}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingLink(true);
                      setEditingLinkId(null);
                      setLinkTitle('');
                      setLinkUrl('');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#252535] hover:bg-[#2f2f45] text-gray-200 rounded-lg text-xs font-medium transition"
                  >
                    <Link2 className="w-3.5 h-3.5 text-blue-400" />
                    Agregar Enlace
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || !project?.id}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition shadow-sm disabled:opacity-50"
                  >
                    <Upload className={`w-3.5 h-3.5 ${isUploading ? 'animate-bounce' : ''}`} />
                    {isUploading ? 'Subiendo a Storage...' : 'Subir Archivo / Imagen'}
                  </button>
                </div>
              </div>

              {/* Modal / Inline Form to Add / Edit External Link */}
              {isAddingLink && (
                <form onSubmit={handleSaveLink} className="p-4 bg-[#14141d] rounded-xl border border-blue-500/40 space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-blue-400" />
                    {editingLinkId ? 'Editar Enlace Externo' : 'Nuevo Enlace Externo'}
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-gray-400 block mb-1">Título o Nombre (opcional)</label>
                      <input
                        type="text"
                        value={linkTitle}
                        onChange={(e) => setLinkTitle(e.target.value)}
                        placeholder="Ej. Figma del Proyecto, Repositorio..."
                        className="w-full px-3 py-1.5 bg-[#1a1a24] border border-[#2f2f42] rounded-lg text-xs text-white outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-gray-400 block mb-1">
                        URL / Dirección Web <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-1.5 bg-[#1a1a24] border border-[#2f2f42] rounded-lg text-xs text-white outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {linkError && (
                    <p className="text-[11px] text-red-400">{linkError}</p>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingLink(false);
                        setEditingLinkId(null);
                        setLinkError(null);
                      }}
                      className="px-3 py-1 rounded-md text-xs text-gray-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-medium"
                    >
                      {editingLinkId ? 'Actualizar Enlace' : 'Guardar Enlace'}
                    </button>
                  </div>
                </form>
              )}

              {/* Attachments List */}
              {isLoadingAttachments ? (
                <div className="text-center py-12 text-gray-400 text-xs">
                  Cargando adjuntos de InsForge...
                </div>
              ) : filteredAttachments.length === 0 ? (
                <div className="text-center py-12 space-y-2 border border-dashed border-[#282838] rounded-xl p-8">
                  <Paperclip className="w-8 h-8 text-gray-400 mx-auto" />
                  <p className="text-xs text-gray-300 font-medium">No hay adjuntos en esta categoría</p>
                  <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
                    Sube capturas, bocetos, documentos técnicos o agrega enlaces a Figma, repositorios o dashboards de este proyecto.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAttachments.map((att) => {
                    const isLink = att.mime_type === 'link' || att.bucket_name === 'external';
                    const isImg = !isLink && (att.mime_type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(att.file_name));

                    return (
                      <div
                        key={att.id}
                        className="bg-[#15151e] border border-[#252535] hover:border-[#38384f] rounded-xl p-3 flex flex-col justify-between group shadow-sm transition"
                      >
                        {/* Thumbnail / Header */}
                        {isImg ? (
                          <div 
                            onClick={() => setLightboxImage(att)}
                            className="h-28 rounded-lg bg-[#101015] border border-[#20202d] overflow-hidden mb-2.5 relative cursor-pointer group/img flex items-center justify-center"
                          >
                            <img
                              src={att.file_url}
                              alt={att.file_name}
                              className="w-full h-full object-cover transition duration-300 group-hover/img:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center gap-1.5 text-white text-xs font-medium">
                              <Eye className="w-4 h-4" />
                              Ver Ampliada
                            </div>
                          </div>
                        ) : isLink ? (
                          <div className="h-16 rounded-lg bg-blue-950/20 border border-blue-900/40 p-2.5 flex items-center gap-3 mb-2.5">
                            <div className="w-9 h-9 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                              <Link2 className="w-5 h-5" />
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-[10px] font-mono text-blue-400 uppercase block">Enlace Externo</span>
                              <p className="text-xs font-semibold text-white truncate">{att.file_name}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="h-20 rounded-lg bg-[#101015] border border-[#20202d] p-3 flex items-center gap-3 mb-2.5">
                            <div className="w-10 h-10 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-[10px] font-mono text-purple-400 uppercase">Documento</span>
                              <p className="text-xs font-semibold text-white truncate" title={att.file_name}>{att.file_name}</p>
                            </div>
                          </div>
                        )}

                        {/* Title & Metadata */}
                        <div className="mb-2">
                          <p className="text-xs font-medium text-white truncate" title={att.file_name}>
                            {att.file_name}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-gray-400 mt-0.5">
                            {!isLink && <span>{formatSize(att.file_size)}</span>}
                            <span>{new Date(att.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="pt-2 border-t border-[#20202f] flex items-center justify-between gap-1">
                          {isLink ? (
                            <>
                              <a
                                href={att.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium px-2 py-1 rounded hover:bg-blue-500/10 transition"
                              >
                                Abrir Enlace
                                <ExternalLink className="w-3 h-3" />
                              </a>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditLink(att)}
                                  className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#252535] transition"
                                  title="Editar enlace"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAttachment(att)}
                                  className="p-1.5 text-gray-400 hover:text-red-400 rounded hover:bg-red-500/10 transition"
                                  title="Eliminar enlace"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <a
                                href={att.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={att.file_name}
                                className="flex items-center gap-1 text-[11px] text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-[#252535] transition"
                                title="Descargar / Abrir archivo"
                              >
                                <Download className="w-3 h-3 text-cyan-400" />
                                Descargar
                              </a>

                              <button
                                type="button"
                                onClick={() => handleDeleteAttachment(att)}
                                className="p-1.5 text-gray-400 hover:text-red-400 rounded hover:bg-red-500/10 transition"
                                title="Eliminar adjunto de Storage"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="flex items-center justify-between pb-3 border-b border-[#252535]">
                <h3 className="text-xs font-semibold text-gray-300">
                  Tareas asociadas al proyecto ({projectTasks.length})
                </h3>
              </div>

              {/* Formulario para Crear Tarea Directa para este Proyecto */}
              {project?.id ? (
                <div className="p-3 bg-[#15151f] border border-[#262638] rounded-xl flex items-center gap-2">
                  <input
                    type="text"
                    value={newProjectTaskTitle}
                    onChange={(e) => setNewProjectTaskTitle(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && newProjectTaskTitle.trim()) {
                        e.preventDefault();
                        if (onCreateTask) {
                          setIsCreatingProjectTask(true);
                          await onCreateTask({
                            title: newProjectTaskTitle.trim(),
                            project_id: project.id,
                            status: 'todo',
                            priority: 'medium'
                          });
                          setNewProjectTaskTitle('');
                          setIsCreatingProjectTask(false);
                        }
                      }
                    }}
                    placeholder="Escribe una nueva tarea para este proyecto y presiona Enter..."
                    className="flex-1 px-3 py-1.5 bg-[#101016] border border-[#2c2c3e] rounded-lg text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    disabled={!newProjectTaskTitle.trim() || isCreatingProjectTask}
                    onClick={async () => {
                      if (newProjectTaskTitle.trim() && onCreateTask) {
                        setIsCreatingProjectTask(true);
                        await onCreateTask({
                          title: newProjectTaskTitle.trim(),
                          project_id: project.id,
                          status: 'todo',
                          priority: 'medium'
                        });
                        setNewProjectTaskTitle('');
                        setIsCreatingProjectTask(false);
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5 flex-shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Tarea</span>
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-amber-400 italic">
                  * Guarda el proyecto para comenzar a vincular y crear tareas operativas.
                </p>
              )}

              {projectTasks.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-[#282838] rounded-xl p-6">
                  <CheckSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-300">No hay tareas asignadas a este proyecto.</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Puedes agregar tareas usando el campo superior o asignarlas desde el tablero de tareas Kanban.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {projectTasks.map(t => (
                    <div
                      key={t.id}
                      className="p-3 bg-[#15151e] border border-[#252535] rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          t.status === 'completed' ? 'bg-emerald-400' :
                          t.status === 'in_progress' ? 'bg-blue-400' :
                          t.status === 'in_review' ? 'bg-purple-400' : 'bg-amber-400'
                        }`} />
                        <div>
                          <p className={`text-xs font-medium ${t.status === 'completed' ? 'line-through text-gray-400' : 'text-white'}`}>
                            {t.title}
                          </p>
                          <span className="text-[10px] text-gray-400 uppercase font-mono">
                            {t.status} • Prioridad: {t.priority}
                          </span>
                        </div>
                      </div>

                      {t.due_date && (
                        <span className="text-[11px] text-gray-400 flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3" />
                          {new Date(t.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Image Preview Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 z-[60] animate-fadeIn">
          <div className="max-w-4xl max-h-[90vh] flex flex-col bg-[#14141c] border border-[#2f2f45] rounded-2xl overflow-hidden shadow-2xl">
            {/* Lightbox Header */}
            <div className="px-5 py-3 border-b border-[#252535] flex items-center justify-between bg-[#101015]">
              <div className="overflow-hidden">
                <h4 className="text-xs font-bold text-white truncate">{lightboxImage.file_name}</h4>
                <p className="text-[10px] text-gray-400 font-mono">
                  {formatSize(lightboxImage.file_size)} • {new Date(lightboxImage.created_at).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={lightboxImage.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={lightboxImage.file_name}
                  className="p-1.5 text-gray-300 hover:text-white rounded-lg hover:bg-[#252535] transition"
                  title="Descargar imagen"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setLightboxImage(null)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#252535] transition"
                  title="Cerrar vista previa"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Lightbox Image View */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40">
              <img
                src={lightboxImage.file_url}
                alt={lightboxImage.file_name}
                className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
