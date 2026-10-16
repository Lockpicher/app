import React, { useState, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';

import { 
  X, 
  Trash2, 
  Edit3, 
  Save, 
  Paperclip, 
  FolderKanban, 
  Calendar, 
  ExternalLink, 
  Tag, 
  FileText, 
  Layers, 
  Image as ImageIcon,
  CheckCircle,
  Clock,
  Sparkles,
  Link2,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Highlighter,
  Boxes,
  Loader2,
  Check,
  Eye,
  Plus
} from 'lucide-react';
import { AppObject, AppProject, AppAttachment, ObjectTypeDefinition, AppNote, AppTask } from '../lib/types';
import { EntityAttachmentsSection } from './EntityAttachmentsSection';
import { r2Storage } from '../lib/r2Client';

interface ObjectDetailModalProps {
  object: AppObject | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<AppObject>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  projects: AppProject[];
  typeDef?: ObjectTypeDefinition;
  attachments?: AppAttachment[];
  onAttachmentCreated?: (attachment: AppAttachment) => void;
  onAttachmentDeleted?: (id: string, path: string) => void;
  notes?: AppNote[];
  tasks?: AppTask[];
  allObjects?: AppObject[];
  onOpenNote?: (note: AppNote) => void;
  onNavigateToObject?: (object: AppObject) => void;
}

export const ObjectDetailModal: React.FC<ObjectDetailModalProps> = ({
  object,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  projects,
  typeDef,
  attachments = [],
  onAttachmentCreated = () => {},
  onAttachmentDeleted = () => {},
  notes = [],
  tasks = [],
  allObjects = [],
  onOpenNote,
  onNavigateToObject
}) => {
  if (!isOpen || !object) return null;

  const isPage = object.object_type === 'page';

  // State
  const [activeTab, setActiveTab] = useState<'info' | 'content' | 'attachments' | 'relations'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(object.title || '');
  const [description, setDescription] = useState(object.description || '');
  const [projectId, setProjectId] = useState(object.project_id || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(object.thumbnail_url || '');
  const [properties, setProperties] = useState<Record<string, any>>(object.properties || {});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Cover image uploading state
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // TipTap image uploading state
  const [isUploadingEditorImage, setIsUploadingEditorImage] = useState(false);
  const editorImageInputRef = useRef<HTMLInputElement>(null);

  // Quick entity linker state in editor
  const [showEntityLinker, setShowEntityLinker] = useState(false);

  const project = projects.find(p => p.id === object.project_id);
  const objectAttachments = attachments.filter(a => a.entity_id === object.id);

  // Related items
  const relatedNotes = notes.filter(n => (object.project_id && n.project_id === object.project_id));
  const relatedTasks = tasks.filter(t => (object.project_id && t.project_id === object.project_id));

  // TipTap editor initialization
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'text-blue-400 underline hover:text-blue-300'
        }
      })
    ],
    content: (() => {
      const raw = object.content || '';
      if (!raw.trim()) return '<p></p>';
      const trimmed = raw.trim();
      if (
        trimmed.includes('<p>') || 
        trimmed.includes('<h1>') || 
        trimmed.includes('<h2>') || 
        trimmed.includes('<h3>') || 
        trimmed.includes('<table') || 
        trimmed.includes('<ul') || 
        trimmed.includes('<ol') || 
        trimmed.includes('<img') || 
        trimmed.includes('<blockquote')
      ) {
        return trimmed;
      }
      // Convert plain text / simple markdown newlines to paragraphs
      return trimmed
        .split('\n')
        .map(line => `<p>${line || '<br>'}</p>`)
        .join('');
    })(),
    editable: isEditing
  });

  // Keep editor editable state in sync
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
    }
  }, [isEditing, editor]);

  // Sync state if object changes
  useEffect(() => {
    setTitle(object.title || '');
    setDescription(object.description || '');
    setProjectId(object.project_id || '');
    setThumbnailUrl(object.thumbnail_url || '');
    setProperties(object.properties || {});
    setIsEditing(false);
    setError(null);

    if (editor && object.content !== undefined) {
      const raw = object.content || '';
      const trimmed = raw.trim();
      let html = '<p></p>';
      if (
        trimmed.includes('<p>') || 
        trimmed.includes('<h1>') || 
        trimmed.includes('<h2>') || 
        trimmed.includes('<h3>') || 
        trimmed.includes('<table') || 
        trimmed.includes('<ul') || 
        trimmed.includes('<ol') || 
        trimmed.includes('<img')
      ) {
        html = trimmed;
      } else if (trimmed) {
        html = trimmed.split('\n').map(l => `<p>${l || '<br>'}</p>`).join('');
      }
      editor.commands.setContent(html);
    }
  }, [object.id]);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('El título no puede estar vacío.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // Get rich HTML content from TipTap if available
      let updatedContent = object.content;
      if (editor) {
        updatedContent = editor.getHTML();
      }

      await onUpdate(object.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        content: updatedContent || undefined,
        project_id: projectId || undefined,
        thumbnail_url: thumbnailUrl.trim() || undefined,
        properties
      });

      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      setError(err.message || 'Error al guardar los cambios en InsForge.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePropertyChange = (key: string, value: any) => {
    setProperties(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Upload Cover Image directly to R2
  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    try {
      setIsUploadingCover(true);
      const res = await r2Storage.uploadFile(file, `objects/${object.id}/covers`);
      setThumbnailUrl(res.url);
      setProperties(prev => ({ ...prev, cover_url: res.url }));
    } catch (err: any) {
      alert('Error subiendo imagen de portada a R2: ' + err.message);
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  // Insert Image into TipTap editor via R2
  const handleInsertEditorImage = async (file: File) => {
    if (!editor) return;
    try {
      setIsUploadingEditorImage(true);
      const res = await r2Storage.uploadFile(file, `objects/${object.id}/content-images`);
      editor
        .chain()
        .focus()
        .setImage({ src: res.url, alt: res.name })
        .insertContent('<p></p>')
        .run();
    } catch (err: any) {
      alert('Error insertando imagen en el editor: ' + err.message);
    } finally {
      setIsUploadingEditorImage(false);
      if (editorImageInputRef.current) editorImageInputRef.current.value = '';
    }
  };

  // Insert Table
  const handleInsertTable = () => {
    if (editor) {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }
  };

  // Insert Link
  const handleInsertLink = () => {
    if (!editor) return;
    const url = prompt('Ingresa la dirección web (https://...):');
    if (!url) return;
    editor.chain().focus().setLink({ href: url }).run();
  };

  // Insert Internal Link to another entity
  const handleInsertEntityLink = (title: string, entityUrl: string) => {
    if (editor) {
      editor.chain().focus().insertContent(`<a href="${entityUrl}" class="text-emerald-400 font-semibold underline">[${title}]</a> `).run();
    }
    setShowEntityLinker(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 z-50 animate-in fade-in duration-200">
      <div className="bg-[#171722] border border-[#2d2d40] rounded-2xl max-w-5xl w-full flex flex-col max-h-[96vh] shadow-2xl overflow-hidden">
        {/* Cover / Header Banner */}
        <div className="relative bg-[#13131c] border-b border-[#262638] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            {thumbnailUrl || object.thumbnail_url ? (
              <img 
                src={thumbnailUrl || object.thumbnail_url!} 
                alt={object.title} 
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover border border-[#35354a] shadow flex-shrink-0"
              />
            ) : (
              <div 
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-base sm:text-lg font-bold shadow flex-shrink-0"
                style={{ backgroundColor: `${typeDef?.color || '#3b82f6'}20`, color: typeDef?.color || '#3b82f6' }}
              >
                {object.title ? object.title.slice(0, 2).toUpperCase() : 'PG'}
              </div>
            )}
            <div className="overflow-hidden">
              <div className="flex items-center gap-2 flex-wrap">
                <span 
                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider"
                  style={{ backgroundColor: `${typeDef?.color || '#3b82f6'}25`, color: typeDef?.color || '#3b82f6' }}
                >
                  {typeDef?.name || (isPage ? 'Página' : object.object_type)}
                </span>
                {project && (
                  <span className="text-[11px] text-gray-400 flex items-center gap-1 truncate">
                    <FolderKanban className="w-3 h-3 text-blue-400 flex-shrink-0" />
                    <span className="truncate">{project.title}</span>
                  </span>
                )}
                {saveSuccess && (
                  <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                    <Check className="w-3 h-3" /> Cambios guardados
                  </span>
                )}
              </div>
              <h2 className="text-sm sm:text-lg md:text-xl font-bold text-white mt-0.5 truncate">
                {title || object.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#222232] text-emerald-400 hover:bg-[#2b2b3e] border border-emerald-500/20 transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Editar Ficha</span>
                <span className="sm:hidden">Editar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (confirm(`¿Eliminar objeto "${object.title}" permanentemente?`)) {
                  onDelete(object.id);
                  onClose();
                }
              }}
              className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition"
              title="Eliminar objeto"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#252535] transition"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 bg-[#14141c] border-b border-[#242436] text-xs overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('info')}
            className={`py-2.5 px-3 border-b-2 font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'info'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Atributos y Propiedades</span>
          </button>

          <button
            onClick={() => setActiveTab('content')}
            className={`py-2.5 px-3 border-b-2 font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'content'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isPage ? 'Editor de Contenido' : 'Dossier / Notas Extensas'}</span>
          </button>

          <button
            onClick={() => setActiveTab('attachments')}
            className={`py-2.5 px-3 border-b-2 font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'attachments'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>Archivos R2 ({objectAttachments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('relations')}
            className={`py-2.5 px-3 border-b-2 font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'relations'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Relaciones ({relatedNotes.length + relatedTasks.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs">
              {error}
            </div>
          )}

          {/* TAB 1: INFO & ATTRIBUTES */}
          {activeTab === 'info' && (
            <div className="space-y-5">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Título o Nombre *</label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-[#121217] border border-[#2b2b3c] rounded-xl text-sm text-white outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Descripción Breve / Bajada</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-[#121217] border border-[#2b2b3c] rounded-xl text-xs text-white outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Proyecto Vinculado</label>
                      <select
                        value={projectId}
                        onChange={e => setProjectId(e.target.value)}
                        className="w-full px-3 py-2 bg-[#121217] border border-[#2b2b3c] rounded-xl text-xs text-white outline-none"
                      >
                        <option value="">Sin Proyecto</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 block mb-1">URL de Portada / Imagen</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="url"
                          value={thumbnailUrl}
                          onChange={e => setThumbnailUrl(e.target.value)}
                          placeholder="https://..."
                          className="flex-1 px-3 py-2 bg-[#121217] border border-[#2b2b3c] rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                        />
                        <input
                          type="file"
                          ref={coverInputRef}
                          accept="image/*"
                          className="hidden"
                          onChange={handleUploadCover}
                        />
                        <button
                          type="button"
                          onClick={() => coverInputRef.current?.click()}
                          disabled={isUploadingCover}
                          className="px-3 py-2 rounded-xl bg-[#222232] hover:bg-[#2b2b3e] text-xs text-gray-300 hover:text-white border border-[#35354a] transition flex items-center gap-1.5 flex-shrink-0"
                          title="Subir archivo de imagen a Cloudflare R2"
                        >
                          {isUploadingCover ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                          )}
                          <span className="hidden sm:inline">Subir R2</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {object.description && (
                    <p className="text-sm text-gray-300 leading-relaxed bg-[#13131b] p-3.5 rounded-xl border border-[#222230] mb-4">
                      {object.description}
                    </p>
                  )}
                </div>
              )}

              {/* Dynamic Defined Fields */}
              <div className="bg-[#13131a] rounded-xl p-4 border border-[#232332]">
                <h4 className="text-xs font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Campos de la Entidad ({typeDef?.fields?.length || Object.keys(properties).length})</span>
                </h4>

                {typeDef && typeDef.fields && typeDef.fields.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {typeDef.fields.map(field => {
                      const val = properties[field.key] ?? '';
                      return (
                        <div key={field.key} className="space-y-1">
                          <label className="text-[11px] font-medium text-gray-400 block capitalize">
                            {field.label} {field.required && <span className="text-red-400">*</span>}
                          </label>

                          {isEditing ? (
                            field.type === 'select' ? (
                              <select
                                value={val}
                                onChange={e => handlePropertyChange(field.key, e.target.value)}
                                className="w-full px-3 py-1.5 bg-[#1a1a24] border border-[#2f2f42] rounded-lg text-xs text-white outline-none"
                              >
                                <option value="">Seleccionar...</option>
                                {(field.options || []).map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : field.type === 'checkbox' ? (
                              <label className="flex items-center gap-2 cursor-pointer mt-1">
                                <input
                                  type="checkbox"
                                  checked={Boolean(val)}
                                  onChange={e => handlePropertyChange(field.key, e.target.checked)}
                                  className="rounded bg-[#1a1a24] border-gray-600 text-emerald-600"
                                />
                                <span className="text-xs text-white">{field.label}</span>
                              </label>
                            ) : (
                              <input
                                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                value={val}
                                onChange={e => handlePropertyChange(field.key, e.target.value)}
                                className="w-full px-3 py-1.5 bg-[#1a1a24] border border-[#2f2f42] rounded-lg text-xs text-white outline-none focus:border-emerald-500"
                              />
                            )
                          ) : (
                            <div className="px-3 py-2 bg-[#171720] rounded-lg border border-[#252535] text-xs text-gray-200">
                              {field.type === 'checkbox' ? (
                                <span className={val ? 'text-emerald-400 font-medium' : 'text-gray-500'}>
                                  {val ? 'Sí' : 'No'}
                                </span>
                              ) : field.type === 'url' && val ? (
                                <a 
                                  href={val} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-blue-400 hover:underline flex items-center gap-1"
                                >
                                  <span>{val}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                val ? String(val) : <span className="text-gray-500 italic">No especificado</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Fallback key-value viewer */
                  <div className="space-y-2">
                    {Object.entries(properties).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between p-2 rounded bg-[#171720] border border-[#222230] text-xs">
                        <span className="font-mono text-gray-400 capitalize">{k}</span>
                        <span className="text-gray-200 font-medium">{String(v)}</span>
                      </div>
                    ))}
                    {Object.keys(properties).length === 0 && (
                      <p className="text-xs text-gray-500 italic">No hay propiedades configuradas.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Attachments quick preview section inside Attributes */}
              <div>
                <EntityAttachmentsSection
                  entityId={object.id}
                  entityType="object"
                  attachments={attachments}
                  onAttachmentCreated={onAttachmentCreated}
                  onAttachmentDeleted={onAttachmentDeleted}
                />
              </div>
            </div>
          )}

          {/* TAB 2: RICH CONTENT / TIPTAP EDITOR */}
          {activeTab === 'content' && (
            <div className="space-y-3">
              {/* TipTap Rich Editor Toolbar (Visible when editing) */}
              {isEditing && editor && (
                <div className="p-2 bg-[#13131c] border border-[#2b2b3e] rounded-xl flex items-center justify-between gap-1 flex-wrap text-xs">
                  <div className="flex items-center gap-1 flex-wrap">
                    {/* Undo / Redo */}
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().undo().run()}
                      disabled={!editor.can().undo()}
                      className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#252538] disabled:opacity-30"
                      title="Deshacer"
                    >
                      <Undo className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().redo().run()}
                      disabled={!editor.can().redo()}
                      className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#252538] disabled:opacity-30"
                      title="Rehacer"
                    >
                      <Redo className="w-3.5 h-3.5" />
                    </button>

                    <span className="w-px h-4 bg-[#2b2b3e] mx-1" />

                    {/* Headings */}
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                      className={`p-1.5 rounded transition ${
                        editor.isActive('heading', { level: 1 }) ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                      }`}
                      title="Título 1"
                    >
                      <Heading1 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                      className={`p-1.5 rounded transition ${
                        editor.isActive('heading', { level: 2 }) ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                      }`}
                      title="Título 2"
                    >
                      <Heading2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                      className={`p-1.5 rounded transition ${
                        editor.isActive('heading', { level: 3 }) ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                      }`}
                      title="Título 3"
                    >
                      <Heading3 className="w-3.5 h-3.5" />
                    </button>

                    <span className="w-px h-4 bg-[#2b2b3e] mx-1" />

                    {/* Inline formats */}
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleBold().run()}
                      className={`p-1.5 rounded transition ${
                        editor.isActive('bold') ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                      }`}
                      title="Negrita"
                    >
                      <BoldIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleItalic().run()}
                      className={`p-1.5 rounded transition ${
                        editor.isActive('italic') ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                      }`}
                      title="Cursiva"
                    >
                      <ItalicIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleUnderline().run()}
                      className={`p-1.5 rounded transition ${
                        editor.isActive('underline') ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                      }`}
                      title="Subrayado"
                    >
                      <UnderlineIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleStrike().run()}
                      className={`p-1.5 rounded transition ${
                        editor.isActive('strike') ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                      }`}
                      title="Tachado"
                    >
                      <Strikethrough className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
                      className={`p-1.5 rounded transition ${
                        editor.isActive('highlight') ? 'bg-yellow-400 text-black' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                      }`}
                      title="Resaltado"
                    >
                      <Highlighter className="w-3.5 h-3.5" />
                    </button>

                    <span className="w-px h-4 bg-[#2b2b3e] mx-1" />

                    {/* Lists & Task Checklist */}
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleBulletList().run()}
                      className={`p-1.5 rounded transition ${
                        editor.isActive('bulletList') ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                      }`}
                      title="Lista con viñetas"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleOrderedList().run()}
                      className={`p-1.5 rounded transition ${
                        editor.isActive('orderedList') ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                      }`}
                      title="Lista numerada"
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleTaskList().run()}
                      className={`p-1.5 rounded transition ${
                        editor.isActive('taskList') ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:bg-[#252538]'
                      }`}
                      title="Lista de Tareas con Checkbox"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>

                    <span className="w-px h-4 bg-[#2b2b3e] mx-1" />

                    {/* Table, Quote, Code, Separator */}
                    <button
                      type="button"
                      onClick={handleInsertTable}
                      className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#252538]"
                      title="Insertar Tabla Editable (3x3)"
                    >
                      <Boxes className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleBlockquote().run()}
                      className={`p-1.5 rounded transition ${
                        editor.isActive('blockquote') ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                      }`}
                      title="Cita"
                    >
                      <Quote className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                      className={`p-1.5 rounded transition ${
                        editor.isActive('codeBlock') ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                      }`}
                      title="Bloque de Código"
                    >
                      <Code className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => editor.chain().focus().setHorizontalRule().run()}
                      className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#252538]"
                      title="Línea Separadora"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <span className="w-px h-4 bg-[#2b2b3e] mx-1" />

                    {/* External Link */}
                    <button
                      type="button"
                      onClick={handleInsertLink}
                      className={`p-1.5 rounded transition ${
                        editor.isActive('link') ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                      }`}
                      title="Insertar Enlace URL"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>

                    {/* Insert Image via R2 */}
                    <input
                      type="file"
                      ref={editorImageInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleInsertEditorImage(e.target.files[0]);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => editorImageInputRef.current?.click()}
                      disabled={isUploadingEditorImage}
                      className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#1e1e2d] hover:bg-[#2a2a3e] text-cyan-300 transition text-[11px]"
                      title="Subir imagen e insertarla en el texto enriquecido"
                    >
                      {isUploadingEditorImage ? (
                        <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                      ) : (
                        <ImageIcon className="w-3 h-3 text-cyan-400" />
                      )}
                      <span>Insertar Imagen</span>
                    </button>

                    {/* Link to Entity */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowEntityLinker(!showEntityLinker)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e1e2d] hover:bg-[#2a2a3e] text-purple-300 transition text-[11px]"
                        title="Vincular a otra entidad, nota o proyecto"
                      >
                        <Link2 className="w-3 h-3 text-purple-400" />
                        <span>Vincular Entidad</span>
                      </button>

                      {showEntityLinker && (
                        <div className="absolute left-0 top-full mt-1 w-64 bg-[#191924] border border-[#2d2d42] rounded-xl shadow-2xl p-2 z-50 max-h-48 overflow-y-auto space-y-1">
                          <span className="text-[10px] font-semibold text-gray-400 px-2 block">
                            Selecciona una entidad para referenciar:
                          </span>
                          {allObjects.slice(0, 10).map(o => (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => handleInsertEntityLink(o.title, `#object-${o.id}`)}
                              className="w-full text-left px-2 py-1 rounded text-xs text-gray-200 hover:bg-[#242436] truncate block"
                            >
                              📌 {o.title}
                            </button>
                          ))}
                          {notes.slice(0, 10).map(n => (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => handleInsertEntityLink(n.title, `#note-${n.id}`)}
                              className="w-full text-left px-2 py-1 rounded text-xs text-blue-300 hover:bg-[#242436] truncate block"
                            >
                              📝 {n.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Editor Workspace Area */}
              <div 
                className={`bg-[#121217] border border-[#252535] rounded-xl min-h-[350px] p-4 sm:p-6 text-gray-100 ${
                  isEditing ? 'focus-within:border-emerald-500/60' : ''
                }`}
              >
                {editor ? (
                  <EditorContent editor={editor} className="outline-none min-h-[300px]" />
                ) : (
                  <div className="text-gray-500 italic text-sm">Cargando editor...</div>
                )}
              </div>

              {!isEditing && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 hover:bg-[#222232] border border-emerald-500/20 transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Modificar contenido</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ATTACHMENTS (CLOUDFLARE R2) */}
          {activeTab === 'attachments' && (
            <div>
              <EntityAttachmentsSection
                entityId={object.id}
                entityType="object"
                attachments={attachments}
                onAttachmentCreated={onAttachmentCreated}
                onAttachmentDeleted={onAttachmentDeleted}
              />
            </div>
          )}

          {/* TAB 4: RELATIONS */}
          {activeTab === 'relations' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-gray-300 mb-2">Notas Vinculadas ({relatedNotes.length})</h4>
                {relatedNotes.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No hay notas directamente asociadas al mismo proyecto.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {relatedNotes.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => onOpenNote && onOpenNote(n)}
                        className="p-2.5 rounded-lg bg-[#14141c] border border-[#242436] hover:border-emerald-500/40 cursor-pointer transition text-xs flex items-center justify-between"
                      >
                        <span className="font-medium text-white truncate">{n.title}</span>
                        <ExternalLink className="w-3 h-3 text-gray-500" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold text-gray-300 mb-2">Tareas Vinculadas ({relatedTasks.length})</h4>
                {relatedTasks.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No hay tareas asociadas al mismo proyecto.</p>
                ) : (
                  <div className="space-y-1.5">
                    {relatedTasks.map(t => (
                      <div key={t.id} className="p-2 rounded-lg bg-[#14141c] border border-[#242436] text-xs flex items-center justify-between">
                        <span className="text-gray-200">{t.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#20202e] text-gray-400 capitalize">{t.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 bg-[#13131c] border-t border-[#252538] flex items-center justify-between text-xs text-gray-400">
          <span className="text-[11px] font-mono">
            Creado el {new Date(object.created_at).toLocaleDateString()}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#222230] hover:bg-[#2b2b3e] text-white transition font-medium"
          >
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
};
