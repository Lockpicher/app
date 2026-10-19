import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { 
  X, 
  Trash2, 
  Save, 
  ExternalLink, 
  FolderKanban, 
  Calendar, 
  FileText, 
  CheckSquare, 
  Layers, 
  Link as LinkIcon, 
  User, 
  Building2, 
  Book, 
  Lightbulb, 
  Boxes, 
  Plus, 
  ArrowLeft, 
  Upload, 
  Loader2, 
  Clock, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  Sparkles,
  Camera,
  ChevronRight,
  MessageSquare,
  AlertCircle,
  Share2
} from 'lucide-react';
import { 
  AppObject, 
  AppProject, 
  AppAttachment, 
  ObjectTypeDefinition, 
  AppNote, 
  AppTask, 
  AppArea,
  AppLink, 
  PersonInteraction, 
  DEFAULT_OBJECT_TYPES 
} from '../lib/types';
import { UniversalLinkSelectorModal, UniversalLinkItem } from './UniversalLinkSelectorModal';
import { EntityAttachmentsSection } from './EntityAttachmentsSection';
import { db } from '../lib/insforge';
import { r2Storage } from '../lib/r2Client';

interface ObjectPagePanelProps {
  object: AppObject | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<AppObject>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  projects?: AppProject[];
  typeDef?: ObjectTypeDefinition;
  attachments?: AppAttachment[];
  onAttachmentCreated?: (attachment: AppAttachment) => void;
  onAttachmentDeleted?: (id: string, path: string) => void;
  notes?: AppNote[];
  tasks?: AppTask[];
  allObjects?: AppObject[];
  areas?: AppArea[];
  customTypes?: ObjectTypeDefinition[];
  onOpenNote?: (note: AppNote) => void;
  onNavigateToObject?: (object: AppObject) => void;
  onNavigateToEntity?: (id: string, type: string) => void;
}

export const ObjectPagePanel: React.FC<ObjectPagePanelProps> = ({
  object,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  projects = [],
  typeDef,
  attachments = [],
  onAttachmentCreated = () => {},
  onAttachmentDeleted = () => {},
  notes = [],
  tasks = [],
  allObjects = [],
  areas = [],
  customTypes = [],
  onOpenNote,
  onNavigateToObject,
  onNavigateToEntity
}) => {
  if (!isOpen || !object) return null;

  // Header & Title
  const [title, setTitle] = useState(object.title || '');
  const [description, setDescription] = useState(object.description || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(object.thumbnail_url || '');
  const [properties, setProperties] = useState<Record<string, any>>(object.properties || {});
  
  // Save & Status
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');

  // Links & Backlinks
  const [outgoingLinks, setOutgoingLinks] = useState<AppLink[]>([]);
  const [incomingLinks, setIncomingLinks] = useState<AppLink[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [isLinkSelectorOpen, setIsLinkSelectorOpen] = useState(false);
  const [linkInitialQuery, setLinkInitialQuery] = useState('');

  // Interactions (timeline)
  const [interactions, setInteractions] = useState<PersonInteraction[]>([]);
  const [isLoadingInteractions, setIsLoadingInteractions] = useState(false);
  const [isAddingInteraction, setIsAddingInteraction] = useState(false);
  const [interactionSummary, setInteractionSummary] = useState('');
  const [interactionNotes, setInteractionNotes] = useState('');
  const [interactionType, setInteractionType] = useState<string>('meeting');

  // Cover uploading
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Field adding popup state
  const [isAddingFieldOpen, setIsAddingFieldOpen] = useState(false);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');

  // Effective Type Definition
  const effectiveTypeDef = useMemo(() => {
    if (typeDef) return typeDef;
    const allDefs = [...DEFAULT_OBJECT_TYPES, ...customTypes];
    return allDefs.find(t => t.id === object.object_type) || {
      id: object.object_type,
      name: object.object_type,
      icon: 'boxes',
      color: '#3b82f6',
      fields: []
    };
  }, [typeDef, object.object_type, customTypes]);

  // TipTap Note Content Editor inside Object
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-400 underline' } })
    ],
    content: object.content || '',
    onUpdate: ({ editor: curEditor }) => {
      setSaveStatus('dirty');

      // Trigger universal link on [[ or @
      try {
        const { from } = curEditor.state.selection;
        const textBefore = curEditor.state.doc.textBetween(Math.max(0, from - 30), from, '\n', '\n');
        const bracketIndex = textBefore.lastIndexOf('[[');
        if (bracketIndex !== -1) {
          const queryAfter = textBefore.slice(bracketIndex + 2);
          if (!queryAfter.includes(']]') && queryAfter.length < 25) {
            setLinkInitialQuery(queryAfter.trim());
            setIsLinkSelectorOpen(true);
            return;
          }
        }
        const atIndex = textBefore.lastIndexOf('@');
        if (atIndex !== -1 && (atIndex === 0 || /\s/.test(textBefore[atIndex - 1]))) {
          const queryAfter = textBefore.slice(atIndex + 1);
          if (!queryAfter.includes(' ') && queryAfter.length < 20) {
            setLinkInitialQuery(queryAfter.trim());
            setIsLinkSelectorOpen(true);
            return;
          }
        }
      } catch (e) {
        // Continue
      }
    }
  });

  // Load links and interactions
  useEffect(() => {
    loadLinks();
    if (object.object_type === 'person' || object.object_type === 'company' || object.object_type === 'meeting') {
      loadInteractions();
    }
  }, [object.id]);

  const loadLinks = async () => {
    try {
      setIsLoadingLinks(true);
      const res = await db.getLinksForEntity(object.id);
      setOutgoingLinks(res.outgoing);
      setIncomingLinks(res.incoming);
    } catch (err) {
      console.warn('Error loading links for object:', err);
    } finally {
      setIsLoadingLinks(false);
    }
  };

  const loadInteractions = async () => {
    try {
      setIsLoadingInteractions(true);
      const data = await db.getPersonInteractions(object.id);
      setInteractions(data);
    } catch (e) {
      console.warn('Error loading interactions:', e);
    } finally {
      setIsLoadingInteractions(false);
    }
  };

  // Auto-save debounced
  useEffect(() => {
    const timer = setTimeout(() => {
      if (saveStatus === 'dirty') {
        handleSave();
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [saveStatus, title, description, properties, thumbnailUrl]);

  const handleSave = async () => {
    if (isSaving) return;
    try {
      setIsSaving(true);
      setSaveStatus('saving');
      const htmlContent = editor ? editor.getHTML() : object.content;

      await onUpdate(object.id, {
        title: title.trim() || 'Objeto sin título',
        description: description.trim() || undefined,
        content: htmlContent,
        thumbnail_url: thumbnailUrl.trim() || undefined,
        properties
      });

      setSaveStatus('saved');
    } catch (err: any) {
      console.error('Error saving object:', err);
      setSaveStatus('dirty');
    } finally {
      setIsSaving(false);
    }
  };

  // Link selector callback
  const handleSelectLink = async (item: UniversalLinkItem, relationLabel = 'related') => {
    try {
      await db.createUniversalLink(object.id, 'object', item.id, item.type, relationLabel);
      await loadLinks();

      // If TipTap has an open cursor, insert chip if user was typing [[
      if (editor && editor.isFocused) {
        const { from } = editor.state.selection;
        const textBefore = editor.state.doc.textBetween(Math.max(0, from - 30), from, '\n', '\n');
        let replaceFrom = from;
        const bracketIdx = textBefore.lastIndexOf('[[');
        const atIdx = textBefore.lastIndexOf('@');
        if (bracketIdx !== -1) replaceFrom = from - (textBefore.length - bracketIdx);
        else if (atIdx !== -1) replaceFrom = from - (textBefore.length - atIdx);

        if (replaceFrom < from) {
          editor.chain().deleteRange({ from: replaceFrom, to: from }).run();
        }

        const chipHtml = `<a href="#entity/${item.type}/${item.id}" data-entity-id="${item.id}" data-entity-type="${item.type}" class="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 rounded-md text-xs font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/50 hover:bg-blue-900/60 transition no-underline"><span>🔗</span><span>${item.title}</span></a> `;
        editor.chain().focus().insertContent(chipHtml).run();
      }
    } catch (err) {
      console.error('Error creating link:', err);
    }
  };

  // Remove a link
  const handleRemoveLink = async (linkId: string) => {
    try {
      await db.deleteLink(linkId);
      await loadLinks();
    } catch (err) {
      console.error('Error removing link:', err);
    }
  };

  // Add interaction
  const handleAddInteractionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interactionSummary.trim()) return;

    try {
      const created = await db.createPersonInteraction({
        person_id: object.id,
        type: interactionType as any,
        date: new Date().toISOString(),
        summary: interactionSummary.trim(),
        notes: interactionNotes.trim()
      });
      if (created) {
        setInteractions(prev => [created, ...prev]);
        setInteractionSummary('');
        setInteractionNotes('');
        setIsAddingInteraction(false);
      }
    } catch (err: any) {
      alert('Error registrando interacción: ' + err.message);
    }
  };

  // Cover image upload to R2
  const handleUploadCover = async (file: File) => {
    try {
      setIsUploadingCover(true);
      const res = await r2Storage.uploadFile(file, `objects/${object.id}/cover`);
      setThumbnailUrl(res.url);
      setSaveStatus('dirty');
    } catch (err: any) {
      alert('Error subiendo imagen de portada: ' + err.message);
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  // Delete object
  const handleDeleteConfirm = async () => {
    if (isDeleting) return;
    try {
      setIsDeleting(true);
      await onDelete(object.id);
      setIsDeleteModalOpen(false);
      onClose();
    } catch (err: any) {
      alert('Error eliminando objeto: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper to resolve entity metadata for link chips
  const resolveEntityItem = (entityId: string, entityType: string): { id: string; type: string; title: string; subtitle: string; icon: any } => {
    if (entityType === 'project') {
      const p = projects.find(item => item.id === entityId);
      return { id: entityId, type: 'project', title: p?.title || 'Proyecto', subtitle: 'Proyecto', icon: FolderKanban };
    }
    if (entityType === 'note') {
      const n = notes.find(item => item.id === entityId);
      return { id: entityId, type: 'note', title: n?.title || 'Nota', subtitle: 'Nota', icon: FileText };
    }
    if (entityType === 'task') {
      const t = tasks.find(item => item.id === entityId);
      return { id: entityId, type: 'task', title: t?.title || 'Tarea', subtitle: 'Tarea', icon: CheckSquare };
    }
    if (entityType === 'area') {
      const a = areas.find(item => item.id === entityId);
      return { id: entityId, type: 'area', title: a?.title || 'Área', subtitle: 'Área', icon: Layers };
    }
    const o = allObjects.find(item => item.id === entityId);
    return {
      id: entityId,
      type: 'object',
      title: o?.title || 'Objeto',
      subtitle: o?.object_type || 'Objeto',
      icon: o?.object_type === 'person' ? User : o?.object_type === 'company' ? Building2 : Boxes
    };
  };

  // Inline editable key properties (top 3)
  const keyProperties = useMemo(() => {
    const fields = effectiveTypeDef.fields || [];
    return fields.slice(0, 3);
  }, [effectiveTypeDef]);

  // Other populated properties
  const populatedProperties = useMemo(() => {
    const keys = Object.keys(properties).filter(k => {
      // Exclude internal technical fields
      if (k === 'subtitle' || k === 'is_pinned' || k === 'cover_url' || k === 'thumbnail_url') return false;
      const val = properties[k];
      return val !== undefined && val !== null && String(val).trim() !== '';
    });
    return keys;
  }, [properties]);

  // Group outgoing and incoming links by entity type
  const groupedLinks = useMemo(() => {
    const groups = new Map<string, AppLink[]>();
    outgoingLinks.forEach(l => {
      const typeKey = l.to_type;
      if (!groups.has(typeKey)) groups.set(typeKey, []);
      groups.get(typeKey)!.push(l);
    });
    return Array.from(groups.entries());
  }, [outgoingLinks]);

  const typeColor = effectiveTypeDef.color || '#3b82f6';

  return (
    <div 
      className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={`Página de ${title}`}
    >
      {/* Backdrop */}
      <div className="hidden lg:block absolute inset-0 cursor-pointer" onClick={onClose} />

      {/* Main Panel Container: Fullscreen on mobile, 85vw/90vw split on desktop */}
      <div 
        className="relative w-full lg:w-[85vw] xl:w-[75vw] 2xl:w-[70vw] h-full bg-[#121217] border-l border-[#242436] flex flex-col shadow-2xl overflow-hidden select-none"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)'
        }}
      >
        {/* Top Sticky Bar: Back, Status, and Delete */}
        <div className="h-13 min-h-[52px] px-4 sm:px-6 bg-[#161622]/95 border-b border-[#232334] flex items-center justify-between gap-3 flex-shrink-0 backdrop-blur-md z-20">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-[#1e1e2c] transition"
              title="Volver"
              aria-label="Cerrar panel"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 truncate">
              <span 
                className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border truncate"
                style={{
                  backgroundColor: `${typeColor}15`,
                  color: typeColor,
                  borderColor: `${typeColor}35`
                }}
              >
                {effectiveTypeDef.name}
              </span>
              <span className="text-sm font-bold text-gray-200 truncate hidden sm:inline">
                {title || 'Sin título'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Auto-save status */}
            <span className="text-xs text-gray-400 font-mono hidden sm:inline">
              {saveStatus === 'saved' && <span className="text-emerald-400">Guardado</span>}
              {saveStatus === 'saving' && <span className="text-blue-400 animate-pulse">Guardando...</span>}
              {saveStatus === 'dirty' && <span className="text-amber-400">Pendiente</span>}
            </span>

            {/* Vincular button */}
            <button
              type="button"
              onClick={() => setIsLinkSelectorOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 transition flex items-center gap-1.5 shadow-sm"
              title="Vincular a otro objeto, nota o tarea"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Vincular</span>
            </button>

            {/* Delete button */}
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-transparent hover:border-red-900/40 transition"
              title="Eliminar objeto"
              aria-label="Eliminar objeto"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#20202e] transition"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body: Split Layout (Desktop 2-col, Mobile stacked) */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-full">
            
            {/* LEFT MAIN CONTENT: Header, Title, Rich Notes, Timeline (7 cols) */}
            <div className="lg:col-span-7 p-4 sm:p-6 lg:p-8 space-y-6 lg:border-r border-[#202030]">
              
              {/* 1. ENCABEZADO: Foto/Icono, Portada opcional, Título y Descripción */}
              <div className="space-y-4">
                {/* Portada si existe */}
                {thumbnailUrl && (
                  <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-[#2b2b3e] group bg-[#161622]">
                    <img 
                      src={thumbnailUrl} 
                      alt="" 
                      className="w-full h-full object-cover" 
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setThumbnailUrl('');
                        setSaveStatus('dirty');
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition"
                      title="Quitar portada"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-start gap-4">
                  {/* Foto de perfil / Icono representativo */}
                  <div className="relative group flex-shrink-0">
                    <div 
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-md overflow-hidden border border-[#2b2b3e]"
                      style={{ backgroundColor: `${typeColor}25`, color: typeColor }}
                    >
                      {thumbnailUrl && !thumbnailUrl.includes('cover') ? (
                        <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span>{title.charAt(0).toUpperCase() || 'O'}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={isUploadingCover}
                      className="absolute -bottom-1 -right-1 p-1 rounded-lg bg-[#20202e] border border-[#303046] text-gray-300 hover:text-white transition shadow-sm"
                      title="Cambiar foto o portada"
                    >
                      {isUploadingCover ? <Loader2 className="w-3 h-3 animate-spin text-blue-400" /> : <Camera className="w-3 h-3" />}
                    </button>
                    <input 
                      type="file" 
                      ref={coverInputRef} 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadCover(e.target.files[0]);
                        }
                      }} 
                    />
                  </div>

                  {/* Title and Short Description */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setSaveStatus('dirty');
                      }}
                      placeholder="Nombre del objeto..."
                      className="w-full bg-transparent text-2xl sm:text-3xl font-extrabold text-white outline-none placeholder-gray-600 tracking-tight"
                    />
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setSaveStatus('dirty');
                      }}
                      placeholder="Descripción breve..."
                      className="w-full bg-transparent text-sm text-gray-400 outline-none placeholder-gray-600"
                    />
                  </div>
                </div>

                {/* 3 Propiedades clave en línea (editables tocando) */}
                {keyProperties.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                    {keyProperties.map(field => {
                      const val = properties[field.key] || '';

                      return (
                        <div 
                          key={field.key} 
                          className="bg-[#181824] border border-[#262638] rounded-xl px-3 py-2 flex flex-col"
                        >
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                            {field.label}
                          </span>
                          <input
                            type={field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
                            value={val}
                            onChange={(e) => {
                              setProperties(prev => ({ ...prev, [field.key]: e.target.value }));
                              setSaveStatus('dirty');
                            }}
                            placeholder="Toca para editar..."
                            className="bg-transparent text-xs text-gray-200 outline-none placeholder-gray-600 mt-0.5 truncate"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* BARRA DE ACCIONES RÁPIDAS DE ESTADO VACÍO (Capacities Style) */}
              <div className="flex items-center gap-2 flex-wrap py-1 border-y border-[#20202e] text-xs">
                <button
                  type="button"
                  onClick={() => setIsLinkSelectorOpen(true)}
                  className="text-blue-400 hover:text-blue-300 font-medium py-1 transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir vínculo</span>
                </button>
                <span className="text-gray-600">•</span>
                <button
                  type="button"
                  onClick={() => setIsAddingInteraction(true)}
                  className="text-amber-400 hover:text-amber-300 font-medium py-1 transition flex items-center gap-1"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Registrar interacción</span>
                </button>
                <span className="text-gray-600">•</span>
                <button
                  type="button"
                  onClick={() => setIsAddingFieldOpen(true)}
                  className="text-emerald-400 hover:text-emerald-300 font-medium py-1 transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir campo</span>
                </button>
              </div>

              {/* 5. CONTENIDO: Notas enriquecidas con soporte TipTap, [[ y @ */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Contenido & Notas
                  </h4>
                  <span className="text-[11px] text-gray-500">
                    Escribe <kbd className="px-1 py-0.5 rounded bg-[#1e1e2c] text-blue-400 font-mono">[[</kbd> o <kbd className="px-1 py-0.5 rounded bg-[#1e1e2c] text-blue-400 font-mono">@</kbd> para vincular
                  </span>
                </div>

                <div 
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    const entityLink = target.closest('[data-entity-id]');
                    if (entityLink) {
                      e.preventDefault();
                      e.stopPropagation();
                      const eId = entityLink.getAttribute('data-entity-id');
                      const eType = entityLink.getAttribute('data-entity-type') || 'object';
                      if (eId && onNavigateToEntity) {
                        onNavigateToEntity(eId, eType);
                      }
                      return;
                    }
                    if (editor && !editor.isFocused) editor.commands.focus('end');
                  }}
                  className="w-full min-h-[300px] bg-[#161622] border border-[#242436] focus-within:border-blue-500/50 rounded-2xl p-4 text-gray-100 cursor-text shadow-sm"
                >
                  <EditorContent editor={editor} className="outline-none" />
                </div>
              </div>

              {/* 6. LÍNEA DE TIEMPO DE INTERACCIONES Y REUNIONES */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Línea de tiempo de interacciones</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsAddingInteraction(true)}
                    className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Registrar</span>
                  </button>
                </div>

                {/* Form to log interaction */}
                {isAddingInteraction && (
                  <form onSubmit={handleAddInteractionSubmit} className="p-3.5 bg-[#181824] border border-[#2b2b3e] rounded-2xl space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={interactionType}
                        onChange={(e) => setInteractionType(e.target.value)}
                        className="bg-[#121217] border border-[#2b2b3e] rounded-lg px-2.5 py-1 text-xs text-gray-200 outline-none"
                      >
                        <option value="meeting">Reunión</option>
                        <option value="call">Llamada</option>
                        <option value="email">Correo</option>
                        <option value="message">Mensaje</option>
                        <option value="event">Evento</option>
                        <option value="note">Nota rápida</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setIsAddingInteraction(false)}
                        className="text-gray-500 hover:text-gray-300 text-xs"
                      >
                        Cancelar
                      </button>
                    </div>

                    <input
                      type="text"
                      value={interactionSummary}
                      onChange={(e) => setInteractionSummary(e.target.value)}
                      placeholder="Resumen o tema de la interacción..."
                      className="w-full bg-[#121217] border border-[#2b2b3e] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                    />

                    <textarea
                      value={interactionNotes}
                      onChange={(e) => setInteractionNotes(e.target.value)}
                      placeholder="Acuerdos o notas detalladas..."
                      rows={2}
                      className="w-full bg-[#121217] border border-[#2b2b3e] rounded-lg px-3 py-1.5 text-xs text-gray-300 outline-none resize-none"
                    />

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 transition"
                      >
                        Guardar Interacción
                      </button>
                    </div>
                  </form>
                )}

                {/* List of interactions */}
                {interactions.length === 0 ? (
                  <p className="text-xs text-gray-500 py-3 pl-3 border-l-2 border-[#232334]">
                    Sin interacciones registradas aún.{' '}
                    <button 
                      type="button" 
                      onClick={() => setIsAddingInteraction(true)} 
                      className="text-amber-400 hover:underline font-medium"
                    >
                      Registra la primera
                    </button>
                  </p>
                ) : (
                  <div className="space-y-2 border-l-2 border-[#262638] pl-3">
                    {interactions.map(it => (
                      <div key={it.id} className="p-2.5 rounded-xl bg-[#161622] border border-[#222234] space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-gray-200">{it.summary}</span>
                          <span className="text-[11px] text-gray-500">
                            {new Date(it.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {it.notes && <p className="text-xs text-gray-400">{it.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT PANEL: Propiedades completas, Vínculos agrupados, Backlinks (5 cols) */}
            <div className="lg:col-span-5 p-4 sm:p-6 lg:p-8 space-y-6 bg-[#14141a]">
              
              {/* 2. PROPIEDADES COMPLETAS (Mostrando solo las que tienen valor + botón añadir) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Propiedades
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsAddingFieldOpen(prev => !prev)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir propiedad</span>
                  </button>
                </div>

                {/* Add dynamic field mini form */}
                {isAddingFieldOpen && (
                  <div className="p-3 rounded-xl bg-[#1a1a26] border border-[#2b2b40] space-y-2">
                    <span className="text-[11px] font-semibold text-gray-300 block">Nueva propiedad personalizada</span>
                    <input
                      type="text"
                      value={newFieldLabel}
                      onChange={(e) => {
                        setNewFieldLabel(e.target.value);
                        setNewFieldKey(e.target.value.toLowerCase().trim().replace(/\s+/g, '_'));
                      }}
                      placeholder="Nombre del campo (ej. LinkedIn)..."
                      className="w-full bg-[#121217] border border-[#2d2d42] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingFieldOpen(false)}
                        className="text-xs text-gray-400 hover:text-gray-200"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (newFieldKey && newFieldLabel) {
                            setProperties(prev => ({ ...prev, [newFieldKey]: '' }));
                            setNewFieldKey('');
                            setNewFieldLabel('');
                            setIsAddingFieldOpen(false);
                            setSaveStatus('dirty');
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500"
                      >
                        Crear
                      </button>
                    </div>
                  </div>
                )}

                {populatedProperties.length === 0 ? (
                  <p className="text-xs text-gray-500 py-2.5 pl-3 border-l-2 border-[#242436]">
                    Sin propiedades secundarias definidas.{' '}
                    <button 
                      type="button" 
                      onClick={() => setIsAddingFieldOpen(true)} 
                      className="text-blue-400 hover:underline font-medium"
                    >
                      Añade la primera
                    </button>
                  </p>
                ) : (
                  <div className="space-y-2">
                    {populatedProperties.map(key => {
                      const val = properties[key];
                      const matchedDef = effectiveTypeDef.fields?.find(f => f.key === key);
                      const label = matchedDef?.label || key.replace(/_/g, ' ');

                      return (
                        <div key={key} className="bg-[#181824] border border-[#252538] rounded-xl px-3 py-2 flex items-center justify-between gap-3">
                          <span className="text-xs text-gray-400 font-medium capitalize truncate max-w-[120px]">
                            {label}
                          </span>
                          <input
                            type="text"
                            value={val || ''}
                            onChange={(e) => {
                              setProperties(prev => ({ ...prev, [key]: e.target.value }));
                              setSaveStatus('dirty');
                            }}
                            className="bg-transparent text-xs text-gray-200 text-right outline-none flex-1 truncate font-sans"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. VÍNCULOS AGRUPADOS POR TIPO (Personas, Empresas, Proyectos, Notas...) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span>Vínculos ({outgoingLinks.length})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsLinkSelectorOpen(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Vincular</span>
                  </button>
                </div>

                {outgoingLinks.length === 0 ? (
                  <p className="text-xs text-gray-500 py-2.5 pl-3 border-l-2 border-[#242436]">
                    Sin vínculos salientes.{' '}
                    <button 
                      type="button" 
                      onClick={() => setIsLinkSelectorOpen(true)} 
                      className="text-blue-400 hover:underline font-medium"
                    >
                      Vincular a otro elemento
                    </button>
                  </p>
                ) : (
                  <div className="space-y-4">
                    {groupedLinks.map(([toType, linksInType]) => (
                      <div key={toType} className="space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block px-1">
                          {toType === 'object' ? 'Objetos' : toType === 'project' ? 'Proyectos' : toType === 'note' ? 'Notas' : toType === 'task' ? 'Tareas' : 'Áreas'}
                        </span>
                        <div className="space-y-1">
                          {linksInType.map(link => {
                            const meta = resolveEntityItem(link.to_id, link.to_type);
                            const Icon = meta.icon;

                            return (
                              <div
                                key={link.id}
                                className="group flex items-center justify-between p-2 rounded-xl bg-[#181824] border border-[#252538] hover:border-blue-500/40 transition cursor-pointer"
                                onClick={() => {
                                  if (onNavigateToEntity) {
                                    onNavigateToEntity(link.to_id, link.to_type);
                                  }
                                }}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div className="w-7 h-7 rounded-lg bg-[#14141c] border border-[#2e2e42] flex items-center justify-center flex-shrink-0">
                                    <Icon className="w-3.5 h-3.5 text-blue-400" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <span className="text-xs font-semibold text-gray-200 group-hover:text-white transition block truncate">
                                      {meta.title}
                                    </span>
                                    <span className="text-[10px] text-gray-400 truncate block">
                                      {link.relation_label !== 'related' ? link.relation_label : meta.subtitle}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveLink(link.id);
                                  }}
                                  className="p-1 rounded text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                                  title="Quitar vínculo"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. MENCIONADO EN (Backlinks automáticos) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Mencionado en (Backlinks: {incomingLinks.length})</span>
                  </h4>
                </div>

                {incomingLinks.length === 0 ? (
                  <p className="text-xs text-gray-500 py-2 pl-3 border-l-2 border-[#242436]">
                    Ningún elemento menciona a este objeto todavía.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {incomingLinks.map(link => {
                      const meta = resolveEntityItem(link.from_id, link.from_type);
                      const Icon = meta.icon;

                      return (
                        <div
                          key={link.id}
                          className="group flex items-center justify-between p-2 rounded-xl bg-[#181824] border border-[#252538] hover:border-indigo-500/40 transition cursor-pointer"
                          onClick={() => {
                            if (onNavigateToEntity) {
                              onNavigateToEntity(link.from_id, link.from_type);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-7 h-7 rounded-lg bg-[#14141c] border border-[#2e2e42] flex items-center justify-center flex-shrink-0">
                              <Icon className="w-3.5 h-3.5 text-indigo-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-semibold text-gray-200 group-hover:text-white transition block truncate">
                                {meta.title}
                              </span>
                              <span className="text-[10px] text-gray-400 truncate block">
                                {meta.subtitle} • Referencia entrante
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:translate-x-0.5 transition" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 5. GRAFO LOCAL (1 NIVEL) */}
              {(outgoingLinks.length > 0 || incomingLinks.length > 0) && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Grafo de conexiones (1 nivel)</span>
                  </h4>

                  <div className="bg-[#14141d] rounded-2xl border border-[#262638] p-3">
                    <div className="flex flex-col items-center">
                      {/* Centro: Objeto actual */}
                      <div className="px-3.5 py-1.5 rounded-xl bg-blue-600/20 border border-blue-500/50 text-white font-bold text-xs shadow-md flex items-center gap-2 mb-3">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        <span className="truncate max-w-[180px]">{title || 'Este objeto'}</span>
                      </div>

                      {/* Conexiones de 1 nivel */}
                      <div className="grid grid-cols-2 gap-2 w-full">
                        {[
                          ...outgoingLinks.map(l => ({ ...resolveEntityItem(l.to_id, l.to_type), direction: 'out' })),
                          ...incomingLinks.map(l => ({ ...resolveEntityItem(l.from_id, l.from_type), direction: 'in' }))
                        ].map((node, i) => {
                          const Icon = node.icon;
                          return (
                            <div
                              key={i}
                              onClick={() => {
                                if (onNavigateToEntity) {
                                  onNavigateToEntity(node.id, node.type);
                                }
                              }}
                              className="flex items-center gap-2 p-2 rounded-xl bg-[#191926] border border-[#252538] hover:border-blue-500/40 cursor-pointer transition text-left"
                            >
                              <div className="w-6 h-6 rounded-lg bg-[#121218] border border-[#2d2d3e] flex items-center justify-center flex-shrink-0">
                                <Icon className="w-3 h-3 text-blue-400" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="text-xs font-medium text-gray-200 block truncate">
                                  {node.title}
                                </span>
                                <span className="text-[10px] text-gray-400 block truncate">
                                  {node.direction === 'out' ? '→ Saliente' : '← Entrante'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Archivos y adjuntos en R2 */}
              <div className="pt-2">
                <EntityAttachmentsSection
                  entityId={object.id}
                  entityType="object"
                  attachments={attachments}
                  onAttachmentCreated={onAttachmentCreated}
                  onAttachmentDeleted={onAttachmentDeleted}
                />
              </div>

            </div>

          </div>
        </div>

      </div>

      {/* Universal Link Selector Modal */}
      <UniversalLinkSelectorModal
        isOpen={isLinkSelectorOpen}
        onClose={() => setIsLinkSelectorOpen(false)}
        initialQuery={linkInitialQuery}
        onSelect={handleSelectLink}
        notes={notes}
        tasks={tasks}
        projects={projects}
        objects={allObjects}
        areas={areas}
        customTypes={customTypes}
        currentEntityId={object.id}
        currentEntityType="object"
        title={`Vincular con ${title || 'este objeto'}`}
      />

      {/* Delete Confirmation Dialog */}
      {isDeleteModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-[#181824] border border-[#2e2e42] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800/50 flex items-center justify-center text-red-400 flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-base font-bold text-white tracking-tight">¿Eliminar objeto?</h3>
                <p className="text-sm text-gray-400">
                  Esta acción eliminará de forma permanente{' '}
                  <span className="font-semibold text-gray-200">«{title || 'Objeto'}»</span>{' '}
                  y limpiará sus vínculos automáticamente.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-gray-300 hover:text-white bg-[#222232] hover:bg-[#2a2a3e] border border-[#323246] transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition flex items-center gap-2"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Eliminar objeto</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
