import React, { useState, useEffect } from 'react';
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
  Plus, 
  CheckCircle, 
  Clock, 
  Sparkles, 
  Link2, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  Building2, 
  Briefcase, 
  MessageSquare, 
  PhoneCall, 
  Video, 
  Users, 
  Target, 
  HeartHandshake, 
  ChevronDown, 
  ChevronRight, 
  CheckSquare, 
  AlertCircle,
  HelpCircle,
  Eye,
  Sliders
} from 'lucide-react';
import { 
  AppObject, 
  AppProject, 
  AppAttachment, 
  AppNote, 
  AppTask, 
  PersonInteraction, 
  InteractionType, 
  PersonCustomField,
  PersonRelationship,
  RELATION_CATALOG,
  RelationshipTypeConfig
} from '../lib/types';
import { calculateAge, formatBirthdayDisplay } from '../lib/birthdays';
import { EntityAttachmentsSection } from './EntityAttachmentsSection';
import { db } from '../lib/insforge';

interface PersonDetailModalProps {
  person: AppObject;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<AppObject>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  projects: AppProject[];
  allPeople?: AppObject[];
  attachments?: AppAttachment[];
  onAttachmentCreated?: (attachment: AppAttachment) => void;
  onAttachmentDeleted?: (id: string, path: string) => void;
  notes?: AppNote[];
  tasks?: AppTask[];
  onOpenNote?: (note: AppNote) => void;
  onCreateTaskForPerson?: (title: string, dueDate?: string) => Promise<void>;
  onCreateNoteForPerson?: (title: string) => Promise<void>;
  onSelectPerson?: (person: AppObject) => void;
}

export const PersonDetailModal: React.FC<PersonDetailModalProps> = ({
  person,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  projects,
  allPeople = [],
  attachments = [],
  onAttachmentCreated = () => {},
  onAttachmentDeleted = () => {},
  notes = [],
  tasks = [],
  onOpenNote,
  onCreateTaskForPerson,
  onCreateNoteForPerson,
  onSelectPerson
}) => {
  if (!isOpen) return null;

  const props = person.properties || {};

  // Form states for progressive editing
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [title, setTitle] = useState(person.title || '');
  const [birthday, setBirthday] = useState(props.birthday || props.cumpleanos || props.fecha_nacimiento || '');
  const [organization, setOrganization] = useState(props.organization || props.empresa || '');
  const [role, setRole] = useState(props.role || props.cargo || props.rol || '');
  const [email, setEmail] = useState(props.email || '');
  const [phone, setPhone] = useState(props.phone || props.telefono || '');
  const [location, setLocation] = useState(props.location || props.ciudad || '');
  const [website, setWebsite] = useState(props.website || props.sitio_web || '');
  const [photoUrl, setPhotoUrl] = useState(person.thumbnail_url || props.photo_url || '');
  const [description, setDescription] = useState(person.description || '');
  const [projectId, setProjectId] = useState(person.project_id || '');
  const [tagsInput, setTagsInput] = useState((person.tags || []).join(', '));

  // Context & Relationship fields
  const [howWeMet, setHowWeMet] = useState(props.how_we_met || props.donde_nos_conocimos || '');
  const [introducedBy, setIntroducedBy] = useState(props.introduced_by || props.quien_presento || '');
  const [interests, setInterests] = useState(props.interests || props.intereses || '');
  const [sharedGoals, setSharedGoals] = useState(props.shared_goals || props.objetivos_compartidos || '');
  const [howICanAddValue, setHowICanAddValue] = useState(props.value_add || props.como_aportar_valor || '');

  // Dynamic Custom Fields
  const [customFields, setCustomFields] = useState<PersonCustomField[]>(() => {
    return Array.isArray(props.custom_fields) ? props.custom_fields : [];
  });
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'date' | 'url' | 'number'>('text');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [isAddingField, setIsAddingField] = useState(false);

  // Relationships State
  const [relationships, setRelationships] = useState<PersonRelationship[]>([]);
  const [isLoadingRelationships, setIsLoadingRelationships] = useState(false);
  const [isAddingRelation, setIsAddingRelation] = useState(false);
  const [newRelationTargetId, setNewRelationTargetId] = useState('');
  const [newRelationTypeId, setNewRelationTypeId] = useState(RELATION_CATALOG[0].id);
  const [newRelationNotes, setNewRelationNotes] = useState('');
  const [relationViewTab, setRelationViewTab] = useState<'network' | 'family'>('network');

  // Section collapse states
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    relationships: true,
    context: true,
    interactions: true,
    custom: true,
    dossier: false,
    relations: true,
    attachments: false
  });

  const toggleSection = (sec: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Interactions state
  const [interactions, setInteractions] = useState<PersonInteraction[]>([]);
  const [isLoadingInteractions, setIsLoadingInteractions] = useState(false);
  const [isAddingInteraction, setIsAddingInteraction] = useState(false);
  const [newInteractionType, setNewInteractionType] = useState<InteractionType>('meeting');
  const [newInteractionDate, setNewInteractionDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [newInteractionSummary, setNewInteractionSummary] = useState('');
  const [newInteractionNotes, setNewInteractionNotes] = useState('');
  const [newInteractionCommitments, setNewInteractionCommitments] = useState('');
  const [newInteractionNextAction, setNewInteractionNextAction] = useState('');
  const [newInteractionFollowUp, setNewInteractionFollowUp] = useState('');

  // Quick Action for Note / Task
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskDate, setQuickTaskDate] = useState('');
  const [isAddingQuickTask, setIsAddingQuickTask] = useState(false);

  // Status & Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Fetch interactions and relationships on mount
  useEffect(() => {
    let isMounted = true;
    const fetchInteractionsAndRelations = async () => {
      try {
        setIsLoadingInteractions(true);
        setIsLoadingRelationships(true);
        const [intData, relData] = await Promise.all([
          db.getPersonInteractions(person.id).catch(() => []),
          db.getPersonRelationships(person.id).catch(() => [])
        ]);
        if (isMounted) {
          setInteractions(intData);
          setRelationships(relData);
        }
      } catch (err) {
        console.warn('Error fetching person data:', err);
      } finally {
        if (isMounted) {
          setIsLoadingInteractions(false);
          setIsLoadingRelationships(false);
        }
      }
    };
    fetchInteractionsAndRelations();
    return () => { isMounted = false; };
  }, [person.id]);

  // Project and associated relations
  const project = projects.find(p => p.id === person.project_id);
  const personAttachments = attachments.filter(a => a.entity_id === person.id);
  const relatedNotes = notes.filter(n => (person.project_id && n.project_id === person.project_id) || (n.content && n.content.includes(person.title)));
  const relatedTasks = tasks.filter(t => (person.project_id && t.project_id === person.project_id) || (t.title && t.title.includes(person.title)));

  // Incremental save helper
  const handleSaveContact = async (incrementalUpdates: Record<string, any> = {}) => {
    if (!title.trim()) {
      setStatusMessage({ text: 'El nombre es obligatorio.', type: 'error' });
      return;
    }

    if (birthday && !isNaN(new Date(birthday).getTime()) === false) {
      setStatusMessage({ text: 'Fecha de cumpleaños inválida.', type: 'error' });
      return;
    }

    try {
      setIsSaving(true);
      setStatusMessage(null);

      const parsedTags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      // Preserve existing properties and incrementally merge new updates
      const updatedProperties: Record<string, any> = {
        ...props,
        birthday: birthday.trim() || undefined,
        cumpleanos: birthday.trim() || undefined,
        organization: organization.trim() || undefined,
        empresa: organization.trim() || undefined,
        role: role.trim() || undefined,
        cargo: role.trim() || undefined,
        rol: role.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        telefono: phone.trim() || undefined,
        location: location.trim() || undefined,
        ciudad: location.trim() || undefined,
        website: website.trim() || undefined,
        how_we_met: howWeMet.trim() || undefined,
        introduced_by: introducedBy.trim() || undefined,
        interests: interests.trim() || undefined,
        shared_goals: sharedGoals.trim() || undefined,
        value_add: howICanAddValue.trim() || undefined,
        custom_fields: customFields,
        last_interaction: interactions[0]?.date || props.last_interaction,
        ...incrementalUpdates
      };

      // Clean undefined keys to avoid cluttering JSON
      Object.keys(updatedProperties).forEach(key => {
        if (updatedProperties[key] === undefined) {
          delete updatedProperties[key];
        }
      });

      await onUpdate(person.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        project_id: projectId || undefined,
        thumbnail_url: photoUrl.trim() || undefined,
        tags: parsedTags,
        properties: updatedProperties
      });

      setIsEditingIdentity(false);
      setStatusMessage({ text: 'Cambios guardados correctamente.', type: 'success' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error guardando datos.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // Relationship actions
  const handleCreateRelationship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRelationTargetId) {
      setStatusMessage({ text: 'Selecciona una persona para relacionar.', type: 'error' });
      return;
    }
    if (newRelationTargetId === person.id) {
      setStatusMessage({ text: 'No puedes vincular una persona consigo misma.', type: 'error' });
      return;
    }

    try {
      setIsSaving(true);
      const created = await db.createPersonRelationship({
        source_person_id: person.id,
        target_person_id: newRelationTargetId,
        relation_type: newRelationTypeId,
        notes: newRelationNotes.trim() || undefined,
        status: 'active'
      });

      if (created) {
        setRelationships(prev => [created, ...prev]);
        setIsAddingRelation(false);
        setNewRelationTargetId('');
        setNewRelationNotes('');
        setStatusMessage({ text: 'Relación añadida exitosamente.', type: 'success' });
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error creando relación.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRelationshipType = async (relId: string, nextTypeId: string) => {
    try {
      const updated = await db.updatePersonRelationship(relId, { relation_type: nextTypeId });
      if (updated) {
        setRelationships(prev => prev.map(r => r.id === relId ? updated : r));
      }
    } catch (err: any) {
      alert('Error actualizando tipo de relación: ' + err.message);
    }
  };

  const handleDeleteRelationship = async (relId: string) => {
    if (!confirm('¿Eliminar esta relación? Ninguno de los dos contactos será borrado.')) return;
    try {
      await db.deletePersonRelationship(relId);
      setRelationships(prev => prev.filter(r => r.id !== relId));
      setStatusMessage({ text: 'Relación eliminada.', type: 'success' });
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err: any) {
      alert('Error eliminando relación: ' + err.message);
    }
  };

  // Add custom field
  const handleAddCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim() || !newFieldValue.trim()) return;

    const newField: PersonCustomField = {
      id: `field_${Date.now()}`,
      name: newFieldName.trim(),
      type: newFieldType,
      value: newFieldValue.trim(),
      visible: true
    };

    const nextFields = [...customFields, newField];
    setCustomFields(nextFields);
    setNewFieldName('');
    setNewFieldValue('');
    setIsAddingField(false);

    await handleSaveContact({ custom_fields: nextFields });
  };

  const handleDeleteCustomField = async (fieldId: string, fieldName: string) => {
    if (!confirm(`¿Eliminar el campo "${fieldName}"?`)) return;
    const nextFields = customFields.filter(f => f.id !== fieldId);
    setCustomFields(nextFields);
    await handleSaveContact({ custom_fields: nextFields });
  };

  // Add Interaction
  const handleSaveInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInteractionSummary.trim()) return;

    try {
      setIsSaving(true);
      const created = await db.createPersonInteraction({
        person_id: person.id,
        type: newInteractionType,
        date: newInteractionDate,
        summary: newInteractionSummary.trim(),
        notes: newInteractionNotes.trim() || undefined,
        commitments: newInteractionCommitments.trim() || undefined,
        next_action: newInteractionNextAction.trim() || undefined,
        follow_up_date: newInteractionFollowUp || null
      });

      if (created) {
        setInteractions(prev => [created, ...prev]);
        setIsAddingInteraction(false);
        setNewInteractionSummary('');
        setNewInteractionNotes('');
        setNewInteractionCommitments('');
        setNewInteractionNextAction('');
        setNewInteractionFollowUp('');

        // Also update last_interaction in person object
        await handleSaveContact({ last_interaction: newInteractionDate });
      }
    } catch (err: any) {
      alert('Error registrando interacción: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteInteraction = async (id: string) => {
    if (!confirm('¿Eliminar esta interacción?')) return;
    try {
      await db.deletePersonInteraction(id);
      setInteractions(prev => prev.filter(i => i.id !== id));
    } catch (err: any) {
      alert('Error eliminando interacción: ' + err.message);
    }
  };

  // Quick Task Creation
  const handleCreateQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;
    try {
      if (onCreateTaskForPerson) {
        await onCreateTaskForPerson(quickTaskTitle.trim(), quickTaskDate || undefined);
      } else {
        await db.createTask({
          title: `${quickTaskTitle.trim()} (@${person.title})`,
          due_date: quickTaskDate || null,
          project_id: person.project_id || null,
          status: 'todo',
          priority: 'medium'
        });
      }
      setQuickTaskTitle('');
      setQuickTaskDate('');
      setIsAddingQuickTask(false);
      setStatusMessage({ text: 'Tarea programada vinculada a la persona.', type: 'success' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      alert('Error creando tarea: ' + err.message);
    }
  };

  const getInteractionIcon = (t: InteractionType) => {
    switch (t) {
      case 'meeting': return <Users className="w-3.5 h-3.5 text-amber-400" />;
      case 'call': return <PhoneCall className="w-3.5 h-3.5 text-blue-400" />;
      case 'message': return <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />;
      case 'email': return <Mail className="w-3.5 h-3.5 text-purple-400" />;
      case 'event': return <Calendar className="w-3.5 h-3.5 text-rose-400" />;
      default: return <Clock className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 z-50 animate-in fade-in duration-200">
      <div className="bg-[#171722] border border-[#2d2d40] rounded-2xl max-w-5xl w-full flex flex-col max-h-[95vh] shadow-2xl overflow-hidden">
        
        {/* Top Floating Alert */}
        {statusMessage && (
          <div className={`px-4 py-2 text-xs font-medium flex items-center justify-between ${
            statusMessage.type === 'success' ? 'bg-emerald-950/80 text-emerald-300 border-b border-emerald-800/40' : 'bg-red-950/80 text-red-300 border-b border-red-800/40'
          }`}>
            <span>{statusMessage.text}</span>
            <button onClick={() => setStatusMessage(null)}>✕</button>
          </div>
        )}

        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#13131c] border-b border-[#242436] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-blue-950/70 text-blue-400 border border-blue-800/40 flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>Ficha Personal Evolutiva</span>
            </span>

            {interactions.length > 0 && (
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-400" />
                <span>{interactions.length} {interactions.length === 1 ? 'interacción' : 'interacciones'}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isEditingIdentity ? (
              <button
                type="button"
                onClick={() => setIsEditingIdentity(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#20202e] text-emerald-400 hover:bg-[#2b2b3e] border border-emerald-500/20 transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar Contacto</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSaveContact()}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Guardando...' : 'Guardar Todo'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (confirm(`¿Eliminar permanentemente a "${person.title}"?`)) {
                  onDelete(person.id);
                  onClose();
                }
              }}
              className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition"
              title="Eliminar persona"
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

        {/* Content Body: Two-Panel Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* LEFT PANEL: IDENTITY CARD */}
          <aside className="w-full md:w-72 lg:w-80 bg-[#14141c] border-b md:border-b-0 md:border-r border-[#242436] p-5 flex flex-col overflow-y-auto no-scrollbar flex-shrink-0">
            <div className="flex flex-col items-center text-center">
              {/* Photo or Initials */}
              {person.thumbnail_url || photoUrl ? (
                <img
                  src={person.thumbnail_url || photoUrl}
                  alt={person.title}
                  className="w-24 h-24 rounded-2xl object-cover border-2 border-[#36364d] shadow-lg mb-3"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-3">
                  {person.title.slice(0, 2).toUpperCase()}
                </div>
              )}

              {/* Name & Role */}
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                {person.title}
              </h2>

              {(role || organization) && (
                <p className="text-xs text-gray-300 mt-1">
                  {role} {role && organization && 'en'} <span className="text-emerald-400 font-medium">{organization}</span>
                </p>
              )}

              {/* Tags */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
                {(person.tags || []).map(tag => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-md bg-[#20202e] text-gray-300 border border-[#2d2d3e]">
                    #{tag}
                  </span>
                ))}
                {(!person.tags || person.tags.length === 0) && (
                  <span className="text-[10px] text-gray-500 italic">Sin etiquetas</span>
                )}
              </div>
            </div>

            {/* Quick Contact Info */}
            <div className="mt-5 pt-4 border-t border-[#232332] space-y-2.5 text-xs">
              {/* Cumpleaños */}
              <div className="flex items-center gap-2 p-2 rounded-xl bg-[#191928] border border-amber-600/30">
                <span className="text-base flex-shrink-0">🎂</span>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-gray-400 block uppercase font-mono">Cumpleaños</span>
                  {birthday ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-amber-200 font-semibold">{formatBirthdayDisplay(birthday)}</span>
                      {calculateAge(birthday) !== null && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                          {calculateAge(birthday)} años
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-red-400 font-medium text-[11px] flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>Pendiente de completar</span>
                    </span>
                  )}
                </div>
              </div>

              {email && (
                <div className="flex items-center gap-2 text-gray-300">
                  <Mail className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <a href={`mailto:${email}`} className="truncate hover:text-white hover:underline">
                    {email}
                  </a>
                </div>
              )}

              {phone && (
                <div className="flex items-center gap-2 text-gray-300">
                  <Phone className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <a href={`tel:${phone}`} className="truncate hover:text-white">
                    {phone}
                  </a>
                </div>
              )}

              {location && (
                <div className="flex items-center gap-2 text-gray-400">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span className="truncate">{location}</span>
                </div>
              )}

              {website && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Globe className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  <a href={website} target="_blank" rel="noopener noreferrer" className="truncate text-blue-400 hover:underline flex items-center gap-1">
                    <span className="truncate">{website.replace(/^https?:\/\//, '')}</span>
                    <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                  </a>
                </div>
              )}

              {project && (
                <div className="flex items-center gap-2 text-blue-300 pt-1">
                  <FolderKanban className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{project.title}</span>
                </div>
              )}
            </div>

            {/* Quick Actions in Sidebar */}
            <div className="mt-auto pt-5 border-t border-[#232332] space-y-2">
              <button
                type="button"
                onClick={() => setIsAddingInteraction(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar Interacción</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddingQuickTask(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-[#1e1e2b] hover:bg-[#28283a] text-purple-300 border border-purple-500/30 transition"
              >
                <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
                <span>Programar Tarea / Seguimiento</span>
              </button>
            </div>
          </aside>

          {/* RIGHT MAIN PANEL: EVOLUTIVE SECTIONS */}
          <main className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            
            {/* Quick Form: Add Interaction Modal / Card */}
            {isAddingInteraction && (
              <form onSubmit={handleSaveInteraction} className="bg-[#14141e] rounded-xl border border-emerald-500/40 p-4 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-[#232332]">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span>Nueva Interacción / Reunión / Llamada</span>
                  </h4>
                  <button type="button" onClick={() => setIsAddingInteraction(false)} className="text-gray-400 hover:text-white text-xs">✕</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Tipo</label>
                    <select
                      value={newInteractionType}
                      onChange={e => setNewInteractionType(e.target.value as InteractionType)}
                      className="w-full px-2.5 py-1.5 bg-[#1a1a26] border border-[#2a2a3c] rounded-lg text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="meeting">Reunión Presencial/Virtual</option>
                      <option value="call">Llamada Telefónica</option>
                      <option value="message">Mensaje / WhatsApp</option>
                      <option value="email">Correo Electrónico</option>
                      <option value="event">Evento / Conferencia</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Fecha y Hora</label>
                    <input
                      type="datetime-local"
                      value={newInteractionDate}
                      onChange={e => setNewInteractionDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#1a1a26] border border-[#2a2a3c] rounded-lg text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Resumen Corto *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Revisión presupuesto Q4"
                      value={newInteractionSummary}
                      onChange={e => setNewInteractionSummary(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#1a1a26] border border-[#2a2a3c] rounded-lg text-xs text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Notas de la conversación</label>
                  <textarea
                    rows={2}
                    placeholder="Temas conversados, acuerdos o puntos clave..."
                    value={newInteractionNotes}
                    onChange={e => setNewInteractionNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#1a1a26] border border-[#2a2a3c] rounded-lg text-xs text-white outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Compromisos adquiridos</label>
                    <input
                      type="text"
                      placeholder="Ej. Enviar propuesta técnica"
                      value={newInteractionCommitments}
                      onChange={e => setNewInteractionCommitments(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#1a1a26] border border-[#2a2a3c] rounded-lg text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Próxima acción / Fecha seguimiento</label>
                    <input
                      type="date"
                      value={newInteractionFollowUp}
                      onChange={e => setNewInteractionFollowUp(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#1a1a26] border border-[#2a2a3c] rounded-lg text-xs text-white outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setIsAddingInteraction(false)} className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white">Cancelar</button>
                  <button type="submit" disabled={isSaving} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white">Guardar Interacción</button>
                </div>
              </form>
            )}

            {/* Quick Form: Add Task Modal / Card */}
            {isAddingQuickTask && (
              <form onSubmit={handleCreateQuickTask} className="bg-[#14141e] rounded-xl border border-purple-500/40 p-4 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-[#232332]">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-purple-400" />
                    <span>Programar Tarea de Seguimiento</span>
                  </h4>
                  <button type="button" onClick={() => setIsAddingQuickTask(false)} className="text-gray-400 hover:text-white text-xs">✕</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder="Ej. Enviar correo de seguimiento o cotización..."
                    value={quickTaskTitle}
                    onChange={e => setQuickTaskTitle(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#1a1a26] border border-[#2a2a3c] rounded-lg text-xs text-white outline-none focus:border-purple-500"
                  />
                  <input
                    type="date"
                    value={quickTaskDate}
                    onChange={e => setQuickTaskDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#1a1a26] border border-[#2a2a3c] rounded-lg text-xs text-white outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setIsAddingQuickTask(false)} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancelar</button>
                  <button type="submit" className="px-4 py-1 rounded text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white">Crear Tarea</button>
                </div>
              </form>
            )}

            {/* SECTION 1: INFORMACIÓN BÁSICA (EDITABLE / EVOLUTIVA) */}
            <div className="bg-[#13131b] rounded-2xl border border-[#232332] overflow-hidden">
              <div 
                onClick={() => toggleSection('basic')}
                className="px-4 py-3 bg-[#151520] flex items-center justify-between cursor-pointer select-none border-b border-[#20202e]"
              >
                <span className="text-xs font-bold text-gray-200 flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span>Información Básica y Contacto</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.basic ? 'rotate-0' : '-rotate-90'}`} />
              </div>

              {expandedSections.basic && (
                <div className="p-4 space-y-3.5">
                  {isEditingIdentity ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">Nombre Completo *</label>
                        <input
                          type="text"
                          value={title}
                          onChange={e => setTitle(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[#181824] border border-[#2c2c3e] rounded-lg text-xs text-white outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-amber-300 font-semibold block mb-1 flex items-center gap-1">
                          <span>🎂 Fecha de Cumpleaños *</span>
                          <span className="text-[10px] text-gray-400 font-normal">(Obligatorio)</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={birthday}
                          onChange={e => setBirthday(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[#181824] border border-amber-600/50 rounded-lg text-xs text-white outline-none focus:border-amber-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">Empresa u Organización</label>
                        <input
                          type="text"
                          value={organization}
                          onChange={e => setOrganization(e.target.value)}
                          placeholder="Ej. Acme Corp, KubboNet..."
                          className="w-full px-3 py-1.5 bg-[#181824] border border-[#2c2c3e] rounded-lg text-xs text-white outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">Cargo / Especialidad</label>
                        <input
                          type="text"
                          value={role}
                          onChange={e => setRole(e.target.value)}
                          placeholder="Ej. Gerente de Operaciones"
                          className="w-full px-3 py-1.5 bg-[#181824] border border-[#2c2c3e] rounded-lg text-xs text-white outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">Correo Electrónico</label>
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="correo@ejemplo.com"
                          className="w-full px-3 py-1.5 bg-[#181824] border border-[#2c2c3e] rounded-lg text-xs text-white outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">Teléfono</label>
                        <input
                          type="text"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          placeholder="+34 600..."
                          className="w-full px-3 py-1.5 bg-[#181824] border border-[#2c2c3e] rounded-lg text-xs text-white outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">Ciudad / Ubicación</label>
                        <input
                          type="text"
                          value={location}
                          onChange={e => setLocation(e.target.value)}
                          placeholder="Madrid, Remoto..."
                          className="w-full px-3 py-1.5 bg-[#181824] border border-[#2c2c3e] rounded-lg text-xs text-white outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">Sitio Web / Perfil</label>
                        <input
                          type="url"
                          value={website}
                          onChange={e => setWebsite(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-1.5 bg-[#181824] border border-[#2c2c3e] rounded-lg text-xs text-white outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">URL de Fotografía</label>
                        <input
                          type="url"
                          value={photoUrl}
                          onChange={e => setPhotoUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3 py-1.5 bg-[#181824] border border-[#2c2c3e] rounded-lg text-xs text-white outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="col-span-full">
                        <label className="text-[11px] text-gray-400 block mb-1">Descripción de la Persona</label>
                        <textarea
                          rows={2}
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[#181824] border border-[#2c2c3e] rounded-lg text-xs text-white outline-none resize-none"
                        />
                      </div>
                      <div className="col-span-full">
                        <label className="text-[11px] text-gray-400 block mb-1">Etiquetas (separadas por coma)</label>
                        <input
                          type="text"
                          value={tagsInput}
                          onChange={e => setTagsInput(e.target.value)}
                          placeholder="socio, tech, inversor..."
                          className="w-full px-3 py-1.5 bg-[#181824] border border-[#2c2c3e] rounded-lg text-xs text-white outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {person.description && (
                        <p className="text-xs text-gray-300 leading-relaxed bg-[#161622] p-3 rounded-xl border border-[#252535]">
                          {person.description}
                        </p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {organization && (
                          <div className="p-2.5 rounded-lg bg-[#161622] border border-[#222230]">
                            <span className="text-[10px] text-gray-500 block uppercase font-mono">Organización</span>
                            <span className="text-gray-200 font-medium">{organization}</span>
                          </div>
                        )}
                        {role && (
                          <div className="p-2.5 rounded-lg bg-[#161622] border border-[#222230]">
                            <span className="text-[10px] text-gray-500 block uppercase font-mono">Cargo</span>
                            <span className="text-gray-200 font-medium">{role}</span>
                          </div>
                        )}
                        {email && (
                          <div className="p-2.5 rounded-lg bg-[#161622] border border-[#222230]">
                            <span className="text-[10px] text-gray-500 block uppercase font-mono">Correo</span>
                            <span className="text-gray-200">{email}</span>
                          </div>
                        )}
                        {phone && (
                          <div className="p-2.5 rounded-lg bg-[#161622] border border-[#222230]">
                            <span className="text-[10px] text-gray-500 block uppercase font-mono">Teléfono</span>
                            <span className="text-gray-200">{phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECTION: RELACIONES PERSONALES RECÍPROCAS Y ÁRBOL FAMILIAR */}
            <div className="bg-[#13131b] rounded-2xl border border-[#232332] overflow-hidden">
              <div 
                onClick={() => toggleSection('relationships')}
                className="px-4 py-3 bg-[#151520] flex items-center justify-between cursor-pointer select-none border-b border-[#20202e]"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-bold text-gray-200">
                    Relaciones Personales y Familia ({relationships.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAddingRelation(prev => !prev);
                    }}
                    className="p-1 px-2 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 text-[10px] font-medium flex items-center gap-1 border border-blue-500/30 transition"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Conectar Persona</span>
                  </button>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.relationships ? 'rotate-0' : '-rotate-90'}`} />
                </div>
              </div>

              {expandedSections.relationships && (
                <div className="p-4 space-y-4">
                  {/* Form to connect a person */}
                  {isAddingRelation && (
                    <form onSubmit={handleCreateRelationship} className="bg-[#181826] p-3.5 rounded-xl border border-[#2b2b40] space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between border-b border-[#252538] pb-2">
                        <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-blue-400" />
                          <span>Nueva Relación con {person.title}</span>
                        </span>
                        <button 
                          type="button" 
                          onClick={() => setIsAddingRelation(false)}
                          className="text-gray-400 hover:text-white text-xs"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-gray-300 block mb-1">
                            Persona a vincular <span className="text-red-400">*</span>
                          </label>
                          <select
                            required
                            value={newRelationTargetId}
                            onChange={e => setNewRelationTargetId(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-[#121218] border border-[#2c2c40] rounded-lg text-xs text-white outline-none focus:border-blue-500"
                          >
                            <option value="">-- Seleccionar Persona --</option>
                            {allPeople
                              .filter(p => p.id !== person.id)
                              .map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.title} {p.properties?.organization ? `(${p.properties.organization})` : ''}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] text-gray-300 block mb-1">
                            Tipo de relación <span className="text-red-400">*</span>
                          </label>
                          <select
                            value={newRelationTypeId}
                            onChange={e => setNewRelationTypeId(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-[#121218] border border-[#2c2c40] rounded-lg text-xs text-white outline-none focus:border-blue-500"
                          >
                            {RELATION_CATALOG.map(item => (
                              <option key={item.id} value={item.id}>
                                {item.label} (Categoría: {item.category})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-full">
                          <label className="text-[11px] text-gray-300 block mb-1">
                            Notas o detalles de la relación (opcional)
                          </label>
                          <input
                            type="text"
                            value={newRelationNotes}
                            onChange={e => setNewRelationNotes(e.target.value)}
                            placeholder="Ej. Se conocen desde 2018, trabajaron juntos en el proyecto Alfa..."
                            className="w-full px-2.5 py-1.5 bg-[#121218] border border-[#2c2c40] rounded-lg text-xs text-white outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsAddingRelation(false)}
                          className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-[#252535] transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
                        >
                          {isSaving ? 'Guardando...' : 'Crear Vínculo'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Tabs: Red de Relaciones vs Árbol Familiar */}
                  <div className="flex items-center justify-between border-b border-[#20202e] pb-2">
                    <div className="flex items-center gap-1 bg-[#161622] p-0.5 rounded-lg border border-[#222232]">
                      <button
                        type="button"
                        onClick={() => setRelationViewTab('network')}
                        className={`px-3 py-1 rounded-md text-[11px] font-medium transition ${
                          relationViewTab === 'network'
                            ? 'bg-[#252538] text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Red de Relaciones ({relationships.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setRelationViewTab('family')}
                        className={`px-3 py-1 rounded-md text-[11px] font-medium transition ${
                          relationViewTab === 'family'
                            ? 'bg-[#252538] text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Árbol Familiar
                      </button>
                    </div>
                  </div>

                  {isLoadingRelationships ? (
                    <div className="py-6 text-center text-xs text-gray-400">
                      Cargando vínculos y relaciones...
                    </div>
                  ) : relationships.length === 0 ? (
                    <div className="py-6 px-4 text-center rounded-xl bg-[#161622] border border-[#222230]">
                      <Users className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-50" />
                      <p className="text-xs text-gray-300 font-medium">Sin relaciones registradas</p>
                      <p className="text-[11px] text-gray-500 mt-1 max-w-sm mx-auto">
                        Conecta a {person.title} con familiares, compañeros de trabajo, mentores o amigos para mapear su red y árbol familiar.
                      </p>
                    </div>
                  ) : relationViewTab === 'network' ? (
                    /* Vista Cuadrícula de Relaciones Recíprocas */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {relationships.map(rel => {
                        const isSource = rel.source_person_id === person.id;
                        const relatedPersonId = isSource ? rel.target_person_id : rel.source_person_id;
                        const relatedPerson = allPeople.find(p => p.id === relatedPersonId);
                        const relConfig = RELATION_CATALOG.find(c => c.id === rel.relation_type);
                        
                        // Reciprocal relationship label
                        const displayLabel = isSource 
                          ? (relConfig?.label || rel.relation_type)
                          : (relConfig?.inverseLabel || relConfig?.label || rel.relation_type);

                        const categoryColor = relConfig?.category === 'family' 
                          ? 'border-rose-500/30 bg-rose-950/20 text-rose-300' 
                          : relConfig?.category === 'work'
                          ? 'border-blue-500/30 bg-blue-950/20 text-blue-300'
                          : relConfig?.category === 'mentor'
                          ? 'border-purple-500/30 bg-purple-950/20 text-purple-300'
                          : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300';

                        return (
                          <div 
                            key={rel.id} 
                            className="p-3 rounded-xl bg-[#161622] border border-[#242436] hover:border-[#35354d] transition flex flex-col justify-between group"
                          >
                            <div className="flex items-start gap-2.5">
                              {/* Avatar / Initials */}
                              {relatedPerson?.thumbnail_url ? (
                                <img
                                  src={relatedPerson.thumbnail_url}
                                  alt={relatedPerson.title}
                                  className="w-10 h-10 rounded-xl object-cover border border-[#303042] flex-shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-800 flex items-center justify-center text-white text-xs font-bold border border-[#303042] flex-shrink-0">
                                  {(relatedPerson?.title || 'P').slice(0, 2).toUpperCase()}
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <h6 
                                    onClick={() => relatedPerson && onSelectPerson && onSelectPerson(relatedPerson)}
                                    className="font-bold text-xs text-white truncate cursor-pointer hover:text-blue-400 transition"
                                    title={relatedPerson?.title || 'Contacto'}
                                  >
                                    {relatedPerson?.title || 'Contacto desconocido'}
                                  </h6>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRelationship(rel.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition rounded"
                                    title="Eliminar relación"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${categoryColor}`}>
                                    {displayLabel}
                                  </span>

                                  {relatedPerson?.properties?.birthday && (
                                    <span className="text-[10px] text-amber-300/90 font-mono">
                                      🎂 {formatBirthdayDisplay(relatedPerson.properties.birthday)}
                                    </span>
                                  )}
                                </div>

                                {rel.notes && (
                                  <p className="text-[11px] text-gray-400 mt-1.5 italic line-clamp-2">
                                    "{rel.notes}"
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Bottom Card Actions */}
                            <div className="mt-2.5 pt-2 border-t border-[#20202e] flex items-center justify-between text-[11px]">
                              {relatedPerson ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectPerson && onSelectPerson(relatedPerson)}
                                  className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                                >
                                  <span>Abrir Ficha</span>
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              ) : (
                                <span className="text-gray-500 text-[10px]">Sin ficha asociada</span>
                              )}

                              <div className="flex items-center gap-1">
                                <select
                                  value={rel.relation_type}
                                  onChange={e => handleUpdateRelationshipType(rel.id, e.target.value)}
                                  className="bg-[#121217] text-gray-400 text-[10px] px-1.5 py-0.5 rounded border border-[#2b2b3a] outline-none hover:text-white"
                                  title="Cambiar tipo de relación"
                                >
                                  {RELATION_CATALOG.map(c => (
                                    <option key={c.id} value={c.id}>{c.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Vista Árbol Familiar Jerárquico */
                    <div className="space-y-4">
                      {(() => {
                        const familyRelations = relationships.filter(rel => {
                          const config = RELATION_CATALOG.find(c => c.id === rel.relation_type);
                          return config?.category === 'family';
                        });

                        if (familyRelations.length === 0) {
                          return (
                            <div className="py-6 text-center text-xs text-gray-400 bg-[#161622] rounded-xl border border-[#222230]">
                              No se han registrado relaciones familiares (pareja, cónyuge, padres, hijos, hermanos).
                            </div>
                          );
                        }

                        // Grouping
                        const partners: { rel: PersonRelationship; person?: AppObject; label: string }[] = [];
                        const parents: { rel: PersonRelationship; person?: AppObject; label: string }[] = [];
                        const children: { rel: PersonRelationship; person?: AppObject; label: string }[] = [];
                        const siblings: { rel: PersonRelationship; person?: AppObject; label: string }[] = [];
                        const otherFamily: { rel: PersonRelationship; person?: AppObject; label: string }[] = [];

                        familyRelations.forEach(rel => {
                          const isSource = rel.source_person_id === person.id;
                          const otherId = isSource ? rel.target_person_id : rel.source_person_id;
                          const otherObj = allPeople.find(p => p.id === otherId);
                          const cfg = RELATION_CATALOG.find(c => c.id === rel.relation_type);
                          const label = isSource ? (cfg?.label || rel.relation_type) : (cfg?.inverseLabel || cfg?.label || rel.relation_type);

                          if (['spouse', 'partner'].includes(rel.relation_type)) {
                            partners.push({ rel, person: otherObj, label });
                          } else if (rel.relation_type === 'parent') {
                            if (isSource) {
                              // person is parent of otherObj => otherObj is child
                              children.push({ rel, person: otherObj, label: 'Hijo(a)' });
                            } else {
                              // otherObj is parent of person
                              parents.push({ rel, person: otherObj, label: 'Padre / Madre' });
                            }
                          } else if (rel.relation_type === 'child') {
                            if (isSource) {
                              parents.push({ rel, person: otherObj, label: 'Padre / Madre' });
                            } else {
                              children.push({ rel, person: otherObj, label: 'Hijo(a)' });
                            }
                          } else if (['sibling'].includes(rel.relation_type)) {
                            siblings.push({ rel, person: otherObj, label });
                          } else {
                            otherFamily.push({ rel, person: otherObj, label });
                          }
                        });

                        const renderFamilyNode = (item: { rel: PersonRelationship; person?: AppObject; label: string }) => (
                          <div 
                            key={item.rel.id}
                            onClick={() => item.person && onSelectPerson && onSelectPerson(item.person)}
                            className="p-2.5 rounded-xl bg-[#181826] border border-[#2a2a3e] hover:border-rose-500/50 cursor-pointer transition flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {item.person?.thumbnail_url ? (
                                <img src={item.person.thumbnail_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-rose-900/40 text-rose-300 flex items-center justify-center font-bold text-xs">
                                  {(item.person?.title || 'F').slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="font-bold text-xs text-white block truncate">{item.person?.title || 'Familiar'}</span>
                                <span className="text-[10px] text-rose-300 font-medium">{item.label}</span>
                              </div>
                            </div>
                            {item.person?.properties?.birthday && (
                              <span className="text-[10px] font-mono text-amber-300/90 ml-2">
                                🎂 {formatBirthdayDisplay(item.person.properties.birthday)}
                              </span>
                            )}
                          </div>
                        );

                        return (
                          <div className="space-y-3">
                            {parents.length > 0 && (
                              <div>
                                <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider block mb-1.5">
                                  Ascendencia (Padres / Madres)
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {parents.map(renderFamilyNode)}
                                </div>
                              </div>
                            )}

                            {partners.length > 0 && (
                              <div>
                                <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider block mb-1.5">
                                  Cónyuge / Pareja
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {partners.map(renderFamilyNode)}
                                </div>
                              </div>
                            )}

                            {siblings.length > 0 && (
                              <div>
                                <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider block mb-1.5">
                                  Hermanos(as)
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {siblings.map(renderFamilyNode)}
                                </div>
                              </div>
                            )}

                            {children.length > 0 && (
                              <div>
                                <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider block mb-1.5">
                                  Descendencia (Hijos / Hijas)
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {children.map(renderFamilyNode)}
                                </div>
                              </div>
                            )}

                            {otherFamily.length > 0 && (
                              <div>
                                <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider block mb-1.5">
                                  Otros Familiares
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {otherFamily.map(renderFamilyNode)}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 2: RELACIÓN Y CONTEXTO (CÓMO NOS CONOCIMOS, INTERESES) */}
            <div className="bg-[#13131b] rounded-2xl border border-[#232332] overflow-hidden">
              <div 
                onClick={() => toggleSection('context')}
                className="px-4 py-3 bg-[#151520] flex items-center justify-between cursor-pointer select-none border-b border-[#20202e]"
              >
                <span className="text-xs font-bold text-gray-200 flex items-center gap-2">
                  <HeartHandshake className="w-3.5 h-3.5 text-amber-400" />
                  <span>Relación, Origen y Contexto</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.context ? 'rotate-0' : '-rotate-90'}`} />
              </div>

              {expandedSections.context && (
                <div className="p-4 space-y-3">
                  {isEditingIdentity ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">¿Dónde nos conocimos?</label>
                        <input
                          type="text"
                          value={howWeMet}
                          onChange={e => setHowWeMet(e.target.value)}
                          placeholder="Ej. Cumbre Emprendedores 2026, Universidad..."
                          className="w-full px-3 py-1.5 bg-[#181824] border border-[#2c2c3e] rounded-lg text-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">¿Quién nos presentó?</label>
                        <input
                          type="text"
                          value={introducedBy}
                          onChange={e => setIntroducedBy(e.target.value)}
                          placeholder="Ej. Laura Gómez"
                          className="w-full px-3 py-1.5 bg-[#181824] border border-[#2c2c3e] rounded-lg text-xs text-white outline-none"
                        />
                      </div>
                      <div className="col-span-full">
                        <label className="text-[11px] text-gray-400 block mb-1">Intereses y Temas de Conversación</label>
                        <input
                          type="text"
                          value={interests}
                          onChange={e => setInterests(e.target.value)}
                          placeholder="Inteligencia Artificial, Ciclismo, Inversión SaaS..."
                          className="w-full px-3 py-1.5 bg-[#181824] border border-[#2c2c3e] rounded-lg text-xs text-white outline-none"
                        />
                      </div>
                      <div className="col-span-full">
                        <label className="text-[11px] text-gray-400 block mb-1">¿Cómo puedo aportar valor a esta persona?</label>
                        <textarea
                          rows={2}
                          value={howICanAddValue}
                          onChange={e => setHowICanAddValue(e.target.value)}
                          placeholder="Conexiones con inversores, soporte en arquitectura cloud..."
                          className="w-full px-3 py-1.5 bg-[#181824] border border-[#2c2c3e] rounded-lg text-xs text-white outline-none resize-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {howWeMet && (
                        <div className="p-2.5 rounded-lg bg-[#161622] border border-[#222230]">
                          <span className="text-[10px] text-gray-500 block uppercase font-mono">Origen / Encuentro</span>
                          <span className="text-gray-200">{howWeMet}</span>
                        </div>
                      )}
                      {introducedBy && (
                        <div className="p-2.5 rounded-lg bg-[#161622] border border-[#222230]">
                          <span className="text-[10px] text-gray-500 block uppercase font-mono">Presentado por</span>
                          <span className="text-gray-200">{introducedBy}</span>
                        </div>
                      )}
                      {interests && (
                        <div className="p-2.5 rounded-lg bg-[#161622] border border-[#222230] col-span-full">
                          <span className="text-[10px] text-gray-500 block uppercase font-mono">Intereses compartidos</span>
                          <span className="text-emerald-300 font-medium">{interests}</span>
                        </div>
                      )}
                      {howICanAddValue && (
                        <div className="p-2.5 rounded-lg bg-[#161622] border border-[#222230] col-span-full">
                          <span className="text-[10px] text-gray-500 block uppercase font-mono">Propuesta de valor mutuo</span>
                          <span className="text-gray-200">{howICanAddValue}</span>
                        </div>
                      )}
                      {!howWeMet && !introducedBy && !interests && !howICanAddValue && (
                        <p className="text-xs text-gray-500 italic p-2 col-span-full">
                          No has registrado contexto de esta relación todavía. Haz clic en "Editar Contacto" para añadir detalles.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 3: CAMPOS PERSONALIZADOS DINÁMICOS */}
            <div className="bg-[#13131b] rounded-2xl border border-[#232332] overflow-hidden">
              <div 
                onClick={() => toggleSection('custom')}
                className="px-4 py-3 bg-[#151520] flex items-center justify-between cursor-pointer select-none border-b border-[#20202e]"
              >
                <span className="text-xs font-bold text-gray-200 flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-purple-400" />
                  <span>Campos Personalizados ({customFields.length})</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAddingField(prev => !prev);
                    }}
                    className="p-1 rounded bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 text-[10px] font-medium flex items-center gap-1 border border-purple-500/30"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Añadir Campo</span>
                  </button>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.custom ? 'rotate-0' : '-rotate-90'}`} />
                </div>
              </div>

              {expandedSections.custom && (
                <div className="p-4 space-y-3">
                  {/* Form to add custom field */}
                  {isAddingField && (
                    <form onSubmit={handleAddCustomField} className="bg-[#181824] p-3 rounded-xl border border-[#2d2d42] space-y-2 mb-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Nombre (ej. Cumpleaños, Twitter)"
                          value={newFieldName}
                          onChange={e => setNewFieldName(e.target.value)}
                          className="px-2.5 py-1.5 bg-[#121217] border border-[#2b2b3a] rounded-lg text-xs text-white outline-none"
                        />
                        <select
                          value={newFieldType}
                          onChange={e => setNewFieldType(e.target.value as any)}
                          className="px-2.5 py-1.5 bg-[#121217] border border-[#2b2b3a] rounded-lg text-xs text-white outline-none"
                        >
                          <option value="text">Texto</option>
                          <option value="date">Fecha</option>
                          <option value="url">Enlace / URL</option>
                          <option value="number">Número</option>
                        </select>
                        <input
                          type={newFieldType === 'date' ? 'date' : 'text'}
                          required
                          placeholder="Valor"
                          value={newFieldValue}
                          onChange={e => setNewFieldValue(e.target.value)}
                          className="px-2.5 py-1.5 bg-[#121217] border border-[#2b2b3a] rounded-lg text-xs text-white outline-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={() => setIsAddingField(false)} className="px-3 py-1 text-xs text-gray-400">Cancelar</button>
                        <button type="submit" className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-medium">Añadir</button>
                      </div>
                    </form>
                  )}

                  {/* Existing custom fields list */}
                  {customFields.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {customFields.map(field => (
                        <div key={field.id} className="p-2.5 rounded-lg bg-[#161622] border border-[#222230] flex items-center justify-between group">
                          <div>
                            <span className="text-[10px] text-gray-500 uppercase font-mono block">{field.name}</span>
                            <span className="text-gray-200 font-medium">
                              {field.type === 'url' ? (
                                <a href={field.value} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                  {field.value}
                                </a>
                              ) : (
                                String(field.value)
                              )}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomField(field.id, field.name)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition"
                            title="Eliminar campo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">No hay atributos personalizados adicionales.</p>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 4: HISTORIAL DE INTERACCIONES (CRONOLÓGICO) */}
            <div className="bg-[#13131b] rounded-2xl border border-[#232332] overflow-hidden">
              <div 
                onClick={() => toggleSection('interactions')}
                className="px-4 py-3 bg-[#151520] flex items-center justify-between cursor-pointer select-none border-b border-[#20202e]"
              >
                <span className="text-xs font-bold text-gray-200 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Historial de Interacciones y Acuerdos ({interactions.length})</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAddingInteraction(true);
                    }}
                    className="p-1 rounded bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 text-[10px] font-medium flex items-center gap-1 border border-emerald-500/30"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Registrar</span>
                  </button>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.interactions ? 'rotate-0' : '-rotate-90'}`} />
                </div>
              </div>

              {expandedSections.interactions && (
                <div className="p-4 space-y-3">
                  {isLoadingInteractions ? (
                    <p className="text-xs text-gray-500 italic">Cargando historial de interacciones...</p>
                  ) : interactions.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-xs">
                      No hay reuniones ni conversaciones registradas con {person.title}.
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingInteraction(true)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-medium"
                        >
                          + Registrar la primera interacción
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {interactions.map(item => (
                        <div key={item.id} className="p-3.5 rounded-xl bg-[#161622] border border-[#252535] space-y-1.5 group">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getInteractionIcon(item.type)}
                              <span className="font-bold text-xs text-white">{item.summary}</span>
                              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-[#20202e] text-gray-400">
                                {item.type}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-gray-400">
                                {new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteInteraction(item.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition"
                                title="Eliminar interacción"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {item.notes && (
                            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap pl-5">
                              {item.notes}
                            </p>
                          )}

                          {(item.commitments || item.next_action || item.follow_up_date) && (
                            <div className="mt-2 pl-5 pt-2 border-t border-[#20202e] flex flex-wrap gap-3 text-[11px]">
                              {item.commitments && (
                                <span className="text-amber-300 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-amber-400" />
                                  <span>Acuerdo: {item.commitments}</span>
                                </span>
                              )}
                              {item.follow_up_date && (
                                <span className="text-purple-300 flex items-center gap-1 font-mono">
                                  <Calendar className="w-3 h-3 text-purple-400" />
                                  <span>Seguimiento: {item.follow_up_date}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 5: RELACIONES (NOTAS, TAREAS, PROYECTOS) */}
            <div className="bg-[#13131b] rounded-2xl border border-[#232332] overflow-hidden">
              <div 
                onClick={() => toggleSection('relations')}
                className="px-4 py-3 bg-[#151520] flex items-center justify-between cursor-pointer select-none border-b border-[#20202e]"
              >
                <span className="text-xs font-bold text-gray-200 flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Elementos Vinculados (Notas: {relatedNotes.length}, Tareas: {relatedTasks.length})</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.relations ? 'rotate-0' : '-rotate-90'}`} />
              </div>

              {expandedSections.relations && (
                <div className="p-4 space-y-3.5">
                  <div>
                    <h5 className="text-[11px] font-semibold text-gray-400 uppercase font-mono mb-2">Notas Vinculadas</h5>
                    {relatedNotes.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No hay notas directamente asociadas a esta persona.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {relatedNotes.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => onOpenNote && onOpenNote(n)}
                            className="p-2.5 rounded-lg bg-[#161622] border border-[#242436] hover:border-emerald-500/40 cursor-pointer transition text-xs flex items-center justify-between"
                          >
                            <span className="font-medium text-white truncate">{n.title}</span>
                            <ExternalLink className="w-3 h-3 text-gray-500 flex-shrink-0" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h5 className="text-[11px] font-semibold text-gray-400 uppercase font-mono mb-2">Tareas y Seguimientos</h5>
                    {relatedTasks.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No hay tareas pendientes asignadas con este contacto.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {relatedTasks.map(t => (
                          <div key={t.id} className="p-2.5 rounded-lg bg-[#161622] border border-[#242436] text-xs flex items-center justify-between">
                            <span className="text-gray-200">{t.title}</span>
                            <div className="flex items-center gap-2">
                              {t.due_date && <span className="text-[10px] font-mono text-purple-300">{t.due_date}</span>}
                              <span className="text-[10px] px-2 py-0.5 rounded bg-[#20202e] text-gray-400 capitalize">{t.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 6: ARCHIVOS CLOUDFLARE R2 */}
            <div className="bg-[#13131b] rounded-2xl border border-[#232332] overflow-hidden">
              <div 
                onClick={() => toggleSection('attachments')}
                className="px-4 py-3 bg-[#151520] flex items-center justify-between cursor-pointer select-none border-b border-[#20202e]"
              >
                <span className="text-xs font-bold text-gray-200 flex items-center gap-2">
                  <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Archivos & Documentos Cloudflare R2 ({personAttachments.length})</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.attachments ? 'rotate-0' : '-rotate-90'}`} />
              </div>

              {expandedSections.attachments && (
                <div className="p-4">
                  <EntityAttachmentsSection
                    entityId={person.id}
                    entityType="object"
                    attachments={attachments}
                    onAttachmentCreated={onAttachmentCreated}
                    onAttachmentDeleted={onAttachmentDeleted}
                  />
                </div>
              )}
            </div>

          </main>
        </div>

        {/* Modal Bottom Bar */}
        <div className="px-6 py-3 bg-[#13131c] border-t border-[#232332] flex items-center justify-between text-xs text-gray-400">
          <span className="text-[11px] font-mono">
            Registrado el {new Date(person.created_at).toLocaleDateString()}
          </span>

          <div className="flex items-center gap-2">
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
    </div>
  );
};
