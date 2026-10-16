import React, { useState } from 'react';
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
  Link2
} from 'lucide-react';
import { AppObject, AppProject, AppAttachment, ObjectTypeDefinition, AppNote, AppTask } from '../lib/types';
import { EntityAttachmentsSection } from './EntityAttachmentsSection';

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
  onOpenNote?: (note: AppNote) => void;
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
  onOpenNote
}) => {
  if (!isOpen || !object) return null;

  const [activeTab, setActiveTab] = useState<'info' | 'content' | 'attachments' | 'relations'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(object.title || '');
  const [description, setDescription] = useState(object.description || '');
  const [content, setContent] = useState(object.content || '');
  const [projectId, setProjectId] = useState(object.project_id || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(object.thumbnail_url || '');
  const [properties, setProperties] = useState<Record<string, any>>(object.properties || {});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const project = projects.find(p => p.id === object.project_id);
  const objectAttachments = attachments.filter(a => a.entity_id === object.id);

  // Notes and tasks linked to this project or object
  const relatedNotes = notes.filter(n => (object.project_id && n.project_id === object.project_id));
  const relatedTasks = tasks.filter(t => (object.project_id && t.project_id === object.project_id));

  const handleSave = async () => {
    if (!title.trim()) {
      setError('El título no puede estar vacío.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await onUpdate(object.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        content: content || undefined,
        project_id: projectId || undefined,
        thumbnail_url: thumbnailUrl.trim() || undefined,
        properties
      });
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Error al guardar los cambios.');
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

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 z-50 animate-in fade-in duration-200">
      <div className="bg-[#171722] border border-[#2d2d40] rounded-2xl max-w-4xl w-full flex flex-col max-h-[94vh] shadow-2xl overflow-hidden">
        {/* Cover / Header Banner */}
        <div className="relative bg-[#13131c] border-b border-[#262638] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {object.thumbnail_url ? (
              <img 
                src={object.thumbnail_url} 
                alt={object.title} 
                className="w-12 h-12 rounded-xl object-cover border border-[#35354a] shadow"
              />
            ) : (
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shadow"
                style={{ backgroundColor: `${typeDef?.color || '#3b82f6'}20`, color: typeDef?.color || '#3b82f6' }}
              >
                {object.title.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span 
                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider"
                  style={{ backgroundColor: `${typeDef?.color || '#3b82f6'}25`, color: typeDef?.color || '#3b82f6' }}
                >
                  {typeDef?.name || object.object_type}
                </span>
                {project && (
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    <FolderKanban className="w-3 h-3 text-blue-400" />
                    {project.title}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-xl font-bold text-white mt-0.5">
                {object.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#222232] text-emerald-400 hover:bg-[#2b2b3e] border border-emerald-500/20 transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar Ficha</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
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
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 bg-[#14141c] border-b border-[#242436] text-xs">
          <button
            onClick={() => setActiveTab('info')}
            className={`py-2.5 px-3 border-b-2 font-medium transition flex items-center gap-1.5 ${
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
            className={`py-2.5 px-3 border-b-2 font-medium transition flex items-center gap-1.5 ${
              activeTab === 'content'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Dossier / Notas Extensas</span>
          </button>

          <button
            onClick={() => setActiveTab('attachments')}
            className={`py-2.5 px-3 border-b-2 font-medium transition flex items-center gap-1.5 ${
              activeTab === 'attachments'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>Archivos Cloudflare R2 ({objectAttachments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('relations')}
            className={`py-2.5 px-3 border-b-2 font-medium transition flex items-center gap-1.5 ${
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
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
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
                    <label className="text-xs text-gray-400 block mb-1">Título o Nombre</label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-[#121217] border border-[#2b2b3c] rounded-xl text-sm text-white outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Descripción Breve</label>
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
                      <label className="text-xs text-gray-400 block mb-1">URL de Portada / Miniatura</label>
                      <input
                        type="url"
                        value={thumbnailUrl}
                        onChange={e => setThumbnailUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-2 bg-[#121217] border border-[#2b2b3c] rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                      />
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
            </div>
          )}

          {/* TAB 2: DOSSIER CONTENT / RICH TEXT */}
          {activeTab === 'content' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Cuaderno de apuntes, documentación y notas específicas de este objeto:
                </span>
                {isEditing && (
                  <span className="text-[10px] text-emerald-400 font-mono">Modo edición activo</span>
                )}
              </div>

              {isEditing ? (
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  rows={14}
                  placeholder="Escribe el dossier completo, historial, notas de reuniones o acuerdos..."
                  className="w-full p-4 bg-[#121217] border border-[#2b2b3c] rounded-xl text-xs sm:text-sm text-gray-100 outline-none focus:border-emerald-500 font-sans leading-relaxed resize-y"
                />
              ) : (
                <div className="p-4 bg-[#121217] border border-[#252535] rounded-xl min-h-[220px] text-xs sm:text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {object.content ? (
                    object.content
                  ) : (
                    <span className="text-gray-500 italic">
                      No hay contenido o dossier redactado para este objeto aún. Haz clic en "Editar Ficha" para añadir texto.
                    </span>
                  )}
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
        <div className="px-6 py-3.5 bg-[#13131c] border-t border-[#252538] flex items-center justify-between text-xs text-gray-400">
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
