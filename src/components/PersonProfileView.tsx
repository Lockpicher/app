import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Editor, EditorContent } from '@tiptap/react';
import { 
  User, 
  Mail, 
  Phone, 
  MessageCircle, 
  Globe, 
  Building2, 
  Briefcase, 
  Calendar, 
  Cake, 
  Clock, 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit3, 
  ExternalLink, 
  Share2, 
  FileText, 
  Camera, 
  Check, 
  X, 
  ChevronRight, 
  Search, 
  Sliders, 
  Tag, 
  MapPin, 
  AlertCircle, 
  Loader2, 
  Paperclip, 
  Linkedin, 
  Twitter, 
  Instagram, 
  Heart, 
  Users, 
  CheckSquare, 
  Bell,
  Send,
  ArrowRight,
  Mic
} from 'lucide-react';
import { 
  AppObject, 
  AppProject, 
  AppArea, 
  AppNote, 
  AppAttachment, 
  AppLink, 
  PersonInteraction,
  PersonRelationship,
  InteractionType
} from '../lib/types';
import { db } from '../lib/insforge';
import { r2Storage } from '../lib/r2Client';
import { DatePickerInput } from './DatePickerInput';
import { 
  calculateAge, 
  formatBirthdayDisplay, 
  syncPersonBirthdayReminders, 
  getBirthdaySettings 
} from '../lib/birthdays';
import { TableGridPicker } from './TableGridPicker';
import { TableToolbar } from './TableToolbar';

export interface PersonProfileViewProps {
  object: AppObject;
  properties: Record<string, any>;
  onPropertyChange: (key: string, val: any) => void;
  title: string;
  onTitleChange: (newTitle: string) => void;
  description: string;
  onDescriptionChange: (newDesc: string) => void;
  thumbnailUrl: string;
  onThumbnailUrlChange: (newUrl: string) => void;
  editor: Editor | null;
  editorImageInputRef: React.RefObject<HTMLInputElement>;
  onUploadImage: (file: File) => Promise<void>;
  allObjects: AppObject[];
  projects: AppProject[];
  areas: AppArea[];
  notes: AppNote[];
  attachments: AppAttachment[];
  onAttachmentCreated: (att: AppAttachment) => void;
  onAttachmentDeleted: (id: string, path: string) => void;
  outgoingLinks: AppLink[];
  incomingLinks: AppLink[];
  onOpenLinkSelector: () => void;
  onOpenNote?: (note: AppNote) => void;
  onNavigateToObject?: (object: AppObject) => void;
  onNavigateToEntity?: (id: string, type: string) => void;
  onSaveStatusChange: (status: 'saved' | 'saving' | 'dirty') => void;
  onOpenAudioModal?: () => void;
}

export const RELATIONSHIP_TYPES = [
  { id: 'personal', label: 'Personal', color: 'text-blue-400', bg: 'bg-blue-950/40 border-blue-800/40' },
  { id: 'familiar', label: 'Familiar', color: 'text-pink-400', bg: 'bg-pink-950/40 border-pink-800/40' },
  { id: 'amistad', label: 'Amistad', color: 'text-amber-400', bg: 'bg-amber-950/40 border-amber-800/40' },
  { id: 'trabajo', label: 'Trabajo / Colega', color: 'text-purple-400', bg: 'bg-purple-950/40 border-purple-800/40' },
  { id: 'cliente', label: 'Cliente', color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-800/40' },
  { id: 'proveedor', label: 'Proveedor', color: 'text-cyan-400', bg: 'bg-cyan-950/40 border-cyan-800/40' },
  { id: 'mentor', label: 'Mentor / Asesor', color: 'text-indigo-400', bg: 'bg-indigo-950/40 border-indigo-800/40' },
  { id: 'otro', label: 'Otro', color: 'text-gray-400', bg: 'bg-gray-800/40 border-gray-700/40' }
];

export const INTERACTION_TYPE_OPTIONS: { id: InteractionType; label: string; icon: any; color: string }[] = [
  { id: 'call', label: 'Llamada telefónica', icon: Phone, color: '#3b82f6' },
  { id: 'meeting', label: 'Reunión presencial / virtual', icon: Users, color: '#10b981' },
  { id: 'message', label: 'Mensaje / WhatsApp', icon: MessageCircle, color: '#22c55e' },
  { id: 'email', label: 'Correo electrónico', icon: Mail, color: '#8b5cf6' },
  { id: 'event', label: 'Evento / Encuentro', icon: Calendar, color: '#f59e0b' },
  { id: 'note', label: 'Nota personal / Observación', icon: FileText, color: '#ec4899' },
  { id: 'other', label: 'Otra interacción', icon: Sparkles, color: '#6b7280' }
];

export const PersonProfileView: React.FC<PersonProfileViewProps> = ({
  object,
  properties,
  onPropertyChange,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  thumbnailUrl,
  onThumbnailUrlChange,
  editor,
  editorImageInputRef,
  onUploadImage,
  allObjects,
  projects,
  areas,
  notes,
  attachments,
  onAttachmentCreated,
  onAttachmentDeleted,
  outgoingLinks,
  incomingLinks,
  onOpenLinkSelector,
  onOpenNote,
  onNavigateToObject,
  onNavigateToEntity,
  onSaveStatusChange,
  onOpenAudioModal
}) => {
  // Tabs: 'contacto' | 'cumpleanos' | 'interacciones' | 'notas' | 'relaciones' | 'archivos' | 'personalizadas'
  const [activeTab, setActiveTab] = useState<'contacto' | 'cumpleanos' | 'interacciones' | 'notas' | 'relaciones' | 'archivos' | 'personalizadas'>('contacto');

  // Photo uploading state
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Interactions state
  const [interactions, setInteractions] = useState<PersonInteraction[]>([]);
  const [isLoadingInteractions, setIsLoadingInteractions] = useState(true);
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
  const [editingInteraction, setEditingInteraction] = useState<Partial<PersonInteraction> | null>(null);

  // Personal Relationships state (colleague, family, friend...)
  const [relationships, setRelationships] = useState<PersonRelationship[]>([]);
  const [isRelModalOpen, setIsRelModalOpen] = useState(false);
  const [newRelTargetId, setNewRelTargetId] = useState('');
  const [newRelType, setNewRelType] = useState('Colega de trabajo');
  const [newRelNotes, setNewRelNotes] = useState('');

  // Custom field creation
  const [isAddingFieldOpen, setIsAddingFieldOpen] = useState(false);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');

  // Load interactions and relationships on mount
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setIsLoadingInteractions(true);
        const [loadedInteractions, loadedRels] = await Promise.all([
          db.getPersonInteractions(object.id),
          db.getPersonRelationships(object.id)
        ]);
        if (isMounted) {
          setInteractions(loadedInteractions);
          setRelationships(loadedRels);
        }
      } catch (err) {
        console.error('Error loading person details:', err);
      } finally {
        if (isMounted) setIsLoadingInteractions(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [object.id]);

  // Extract contact fields cleanly from properties
  const role = properties.cargo || properties.rol || '';
  const email = properties.email || properties.correo || '';
  const phone = properties.phone || properties.telefono || '';
  const whatsapp = properties.whatsapp || phone || '';
  const birthday = properties.birthday || properties.cumpleanos || properties.fecha_nacimiento || '';
  const company = properties.empresa || '';
  const companyId = properties.empresa_id || '';
  const relationshipType = properties.relationship_type || 'personal';
  const address = properties.direccion || properties.address || '';
  const city = properties.ciudad || properties.city || '';
  const country = properties.pais || properties.country || '';
  const website = properties.website || properties.sitio_web || '';
  const linkedin = properties.linkedin || '';
  const twitter = properties.twitter || '';
  const instagram = properties.instagram || '';

  // Calculate Age and Next Birthday
  const currentAge = useMemo(() => {
    return calculateAge(birthday);
  }, [birthday]);

  const nextBirthdayInfo = useMemo(() => {
    if (!birthday) return null;
    const parts = birthday.split('-');
    const month = parts.length === 3 ? parseInt(parts[1], 10) : parseInt(parts[0], 10);
    const day = parts.length === 3 ? parseInt(parts[2], 10) : parseInt(parts[1], 10);
    if (isNaN(month) || isNaN(day)) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentYear = today.getFullYear();
    let nextBday = new Date(currentYear, month - 1, day);

    if (nextBday.getTime() < today.getTime()) {
      nextBday = new Date(currentYear + 1, month - 1, day);
    }

    const diffTime = nextBday.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const turningAge = calculateAge(birthday, nextBday.getFullYear());

    return {
      date: nextBday,
      daysRemaining,
      turningAge,
      formattedText: daysRemaining === 0 
        ? '¡Hoy es su cumpleaños! 🎂' 
        : daysRemaining === 1 
          ? 'Mañana 🎁' 
          : `En ${daysRemaining} días`
    };
  }, [birthday]);

  // Pending next follow-up from interactions
  const nextFollowUp = useMemo(() => {
    const today = new Date().toISOString();
    const withFollowUp = interactions
      .filter(i => i.follow_up_date && i.follow_up_date >= today.slice(0, 10))
      .sort((a, b) => (a.follow_up_date! > b.follow_up_date! ? 1 : -1));
    return withFollowUp[0] || null;
  }, [interactions]);

  // Last interaction
  const lastInteraction = useMemo(() => {
    if (interactions.length === 0) return null;
    return interactions[0];
  }, [interactions]);

  // Companies list for linking
  const companyObjects = useMemo(() => {
    return allObjects.filter(o => o.object_type === 'company');
  }, [allObjects]);

  // Clean WhatsApp number for link
  const cleanWhatsappNumber = useMemo(() => {
    if (!whatsapp) return '';
    return whatsapp.replace(/[^0-9]/g, '');
  }, [whatsapp]);

  // Avatar initials if no photo
  const avatarInitials = useMemo(() => {
    const names = (title || 'Persona').trim().split(/\s+/);
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return (names[0]?.[0] || 'P').toUpperCase();
  }, [title]);

  // Filtered custom properties (excluding core contact keys)
  const nativeKeys = [
    'rol', 'cargo', 'email', 'correo', 'phone', 'telefono', 'whatsapp',
    'birthday', 'cumpleanos', 'fecha_nacimiento', 'photo_url', 'photourl',
    'photo_path', 'avatar_url', 'thumbnail_url', 'relationship_type',
    'empresa', 'empresa_id', 'website', 'sitio_web', 'direccion', 'address',
    'ciudad', 'city', 'pais', 'country', 'linkedin', 'twitter', 'instagram'
  ];

  const customPropertiesEntries = useMemo(() => {
    return Object.entries(properties).filter(([key]) => !nativeKeys.includes(key.toLowerCase()));
  }, [properties]);

  // Handler to upload photo to R2
  const handleUploadPhoto = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida.');
      return;
    }
    try {
      setIsUploadingPhoto(true);
      const res = await r2Storage.uploadFile(file, `contacts/${object.id}/photo`);
      onThumbnailUrlChange(res.url);
      onPropertyChange('photo_url', res.url);
      onSaveStatusChange('dirty');

      // Record in app_attachments
      const att = await db.recordAttachment({
        entity_id: object.id,
        entity_type: 'object',
        file_name: res.name,
        display_name: `Foto de perfil - ${file.name}`,
        file_url: res.url,
        file_path: res.r2Key,
        r2_key: res.provider === 'r2' ? res.r2Key : undefined,
        storage_provider: res.provider,
        file_size: res.size,
        mime_type: res.mime
      });
      if (att && onAttachmentCreated) onAttachmentCreated(att);
    } catch (err: any) {
      alert('Error subiendo fotografía: ' + err.message);
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = () => {
    if (confirm('¿Deseas quitar la fotografía de perfil?')) {
      onThumbnailUrlChange('');
      onPropertyChange('photo_url', '');
      onSaveStatusChange('dirty');
    }
  };

  // Handler to save interaction
  const handleSaveInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInteraction || !editingInteraction.summary) return;

    try {
      const payload = {
        person_id: object.id,
        type: editingInteraction.type || 'call',
        date: editingInteraction.date || new Date().toISOString(),
        summary: editingInteraction.summary.trim(),
        notes: editingInteraction.notes || '',
        commitments: editingInteraction.commitments || '',
        next_action: editingInteraction.next_action || '',
        follow_up_date: editingInteraction.follow_up_date || null,
        file_urls: editingInteraction.file_urls || []
      };

      if (editingInteraction.id) {
        const updated = await db.updatePersonInteraction(editingInteraction.id, payload);
        if (updated) {
          setInteractions(prev => prev.map(i => i.id === updated.id ? updated : i));
        }
      } else {
        const created = await db.createPersonInteraction(payload);
        if (created) {
          setInteractions(prev => [created, ...prev]);

          // If follow_up_date is set, automatically create a reminder in app_reminders
          if (created.follow_up_date) {
            try {
              await db.createReminder({
                person_id: object.id,
                title: `Seguimiento con ${title}: ${created.next_action || created.summary}`,
                description: `Compromiso: ${created.commitments || 'Revisar notas de la interacción'}\nContacto: ${title}`,
                remind_at: `${created.follow_up_date}T09:00:00`,
                status: 'pending'
              });
            } catch (remErr) {
              console.warn('Error sincronizando recordatorio de seguimiento:', remErr);
            }
          }
        }
      }

      setIsInteractionModalOpen(false);
      setEditingInteraction(null);
    } catch (err: any) {
      alert('Error guardando interacción: ' + err.message);
    }
  };

  const handleDeleteInteraction = async (id: string) => {
    if (!confirm('¿Eliminar esta interacción del historial?')) return;
    try {
      await db.deletePersonInteraction(id);
      setInteractions(prev => prev.filter(i => i.id !== id));
    } catch (err: any) {
      alert('Error eliminando interacción: ' + err.message);
    }
  };

  // Handler to add personal relationship
  const handleAddRelationship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRelTargetId || !newRelType) return;

    try {
      const created = await db.createPersonRelationship({
        source_person_id: object.id,
        target_person_id: newRelTargetId,
        relation_type: newRelType,
        notes: newRelNotes,
        status: 'active'
      });
      if (created) {
        setRelationships(prev => [created, ...prev]);
        setIsRelModalOpen(false);
        setNewRelTargetId('');
        setNewRelNotes('');
      }
    } catch (err: any) {
      alert('Error guardando relación: ' + err.message);
    }
  };

  const handleDeleteRelationship = async (relId: string) => {
    if (!confirm('¿Eliminar esta relación?')) return;
    try {
      await db.deletePersonRelationship(relId);
      setRelationships(prev => prev.filter(r => r.id !== relId));
    } catch (err: any) {
      alert('Error eliminando relación: ' + err.message);
    }
  };

  // Other contacts for relationship selector
  const otherContacts = useMemo(() => {
    return allObjects.filter(o => o.object_type === 'person' && o.id !== object.id);
  }, [allObjects, object.id]);

  const activePhoto = thumbnailUrl || properties.photo_url || properties.avatar_url;

  return (
    <div className="w-full flex flex-col space-y-6">
      
      {/* ========================================================================= */}
      {/* 1. CABECERA VISUAL DEL PERFIL                                             */}
      {/* ========================================================================= */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#181826] to-[#12121a] border border-[#2b2b3e] shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          
          {/* Avatar / Fotografía de Perfil con hover interactivo */}
          <div className="relative group flex-shrink-0">
            <div 
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-blue-500/50 shadow-2xl bg-[#1c1c28] flex items-center justify-center text-white"
            >
              {activePhoto ? (
                <img 
                  src={activePhoto} 
                  alt={title} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-blue-700 via-indigo-600 to-teal-500 flex items-center justify-center text-3xl font-extrabold tracking-wider">
                  {avatarInitials}
                </div>
              )}
            </div>

            {/* Hover overlay para cambiar o quitar foto */}
            <div className="absolute inset-0 rounded-full bg-black/60 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-500 transition shadow"
                title="Cambiar fotografía de perfil"
              >
                {isUploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
              {activePhoto && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="p-2 rounded-full bg-red-600 text-white hover:bg-red-500 transition shadow"
                  title="Quitar fotografía"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <input
              type="file"
              ref={photoInputRef}
              accept="image/*"
              className="hidden"
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  handleUploadPhoto(e.target.files[0]);
                }
              }}
            />
          </div>

          {/* Información Principal: Nombre, Cargo, Organización y Tipo */}
          <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <input
                type="text"
                value={title}
                onChange={e => {
                  onTitleChange(e.target.value);
                  onSaveStatusChange('dirty');
                }}
                placeholder="Nombre y apellidos del contacto..."
                className="w-full bg-transparent text-2xl sm:text-3xl font-extrabold text-white outline-none placeholder-gray-600 tracking-tight"
              />

              {/* Selector de tipo de relación */}
              <div className="self-center sm:self-auto">
                <select
                  value={relationshipType}
                  onChange={e => {
                    onPropertyChange('relationship_type', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  className="bg-[#1c1c28] border border-[#303046] text-blue-300 text-xs font-semibold rounded-xl px-3 py-1.5 outline-none cursor-pointer hover:border-blue-500 transition"
                >
                  {RELATIONSHIP_TYPES.map(rel => (
                    <option key={rel.id} value={rel.id} className="bg-[#161622] text-white">
                      {rel.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cargo y Empresa / Organización */}
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap text-sm text-gray-300">
              <div className="flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  value={role}
                  onChange={e => {
                    onPropertyChange('cargo', e.target.value);
                    onPropertyChange('rol', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="Cargo o profesión..."
                  className="bg-transparent border-b border-dashed border-gray-600 focus:border-blue-400 outline-none text-white text-sm max-w-[180px] sm:max-w-[220px]"
                />
              </div>

              <span className="text-gray-500 hidden sm:inline">•</span>

              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  value={company}
                  onChange={e => {
                    onPropertyChange('empresa', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="Empresa u organización..."
                  className="bg-transparent border-b border-dashed border-gray-600 focus:border-blue-400 outline-none text-white text-sm max-w-[180px] sm:max-w-[220px]"
                />
              </div>
            </div>

            {/* Descripción breve */}
            <input
              type="text"
              value={description}
              onChange={e => {
                onDescriptionChange(e.target.value);
                onSaveStatusChange('dirty');
              }}
              placeholder="Añade un resumen breve o contexto..."
              className="w-full bg-transparent text-xs sm:text-sm text-gray-400 outline-none placeholder-gray-600"
            />

            {/* Botones de Acción Rápida de Contacto */}
            <div className="flex items-center justify-center sm:justify-start gap-2 pt-2 flex-wrap">
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-950/50 hover:bg-blue-900/60 border border-blue-800/50 text-blue-300 text-xs font-medium transition"
                  title={`Enviar correo a ${email}`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Enviar Correo</span>
                </a>
              )}

              {cleanWhatsappNumber && (
                <a
                  href={`https://wa.me/${cleanWhatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-800/50 text-emerald-300 text-xs font-medium transition"
                  title={`Abrir chat de WhatsApp (${whatsapp})`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              )}

              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#222234] hover:bg-[#2c2c42] border border-[#35354e] text-gray-300 text-xs font-medium transition"
                  title={`Llamar a ${phone}`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Llamar</span>
                </a>
              )}

              {website && (
                <a
                  href={website.startsWith('http') ? website : `https://${website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#222234] hover:bg-[#2c2c42] border border-[#35354e] text-gray-300 text-xs font-medium transition"
                  title="Visitar sitio web"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Web</span>
                </a>
              )}

              {linkedin && (
                <a
                  href={linkedin.startsWith('http') ? linkedin : `https://linkedin.com/in/${linkedin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-xl bg-[#222234] hover:bg-[#2c2c42] border border-[#35354e] text-blue-400 hover:text-white transition"
                  title="Perfil de LinkedIn"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. RESUMEN VISUAL DEL CONTACTO (INDICADORES COMPACTOS)                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        
        {/* Próximo Cumpleaños */}
        <div className="p-3.5 rounded-2xl bg-[#161622] border border-[#262638] flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Cumpleaños</span>
            <Cake className="w-4 h-4 text-pink-400" />
          </div>
          <div className="my-0.5">
            {nextBirthdayInfo ? (
              <div>
                <span className="text-base sm:text-lg font-bold text-white block">
                  {nextBirthdayInfo.formattedText}
                </span>
                <span className="text-[11px] text-pink-400">
                  {nextBirthdayInfo.turningAge !== null ? `Cumplirá ${nextBirthdayInfo.turningAge} años` : formatBirthdayDisplay(birthday)}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('cumpleanos')}
                className="text-xs text-blue-400 hover:underline text-left block py-1"
              >
                + Registrar fecha
              </button>
            )}
          </div>
          <span className="text-[10px] text-gray-500 truncate">
            {currentAge !== null ? `Edad actual: ${currentAge} años` : 'Sin año de nacimiento'}
          </span>
        </div>

        {/* Última Interacción */}
        <div className="p-3.5 rounded-2xl bg-[#161622] border border-[#262638] flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Último Contacto</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="my-0.5">
            {lastInteraction ? (
              <div>
                <span className="text-base sm:text-lg font-bold text-white block truncate">
                  {lastInteraction.summary}
                </span>
                <span className="text-[11px] text-blue-400">
                  {new Date(lastInteraction.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ) : (
              <span className="text-xs text-gray-500 py-1 block">Sin interacciones</span>
            )}
          </div>
          <span className="text-[10px] text-gray-500 truncate">
            {interactions.length} interacción{interactions.length !== 1 ? 'es' : ''} total
          </span>
        </div>

        {/* Próximo Seguimiento */}
        <div className="p-3.5 rounded-2xl bg-[#161622] border border-[#262638] flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Seguimiento</span>
            <Bell className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-0.5">
            {nextFollowUp ? (
              <div>
                <span className="text-base sm:text-lg font-bold text-white block truncate">
                  {nextFollowUp.next_action || 'Pendiente'}
                </span>
                <span className="text-[11px] text-amber-400">
                  {nextFollowUp.follow_up_date}
                </span>
              </div>
            ) : (
              <span className="text-xs text-gray-500 py-1 block">Sin pendientes</span>
            )}
          </div>
          <span className="text-[10px] text-gray-500 truncate">
            {nextFollowUp ? 'Recordatorio activo' : 'Al día'}
          </span>
        </div>

        {/* Total Interacciones */}
        <div className="p-3.5 rounded-2xl bg-[#161622] border border-[#262638] flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Historial</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-0.5 text-xl font-bold text-white">
            {interactions.length}
          </div>
          <span className="text-[10px] text-gray-500">
            Reuniones y llamadas
          </span>
        </div>

        {/* Vínculos / Relaciones */}
        <div className="p-3.5 rounded-2xl bg-[#161622] border border-[#262638] flex flex-col justify-between space-y-1 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Vínculos</span>
            <Share2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="my-0.5 text-xl font-bold text-white">
            {outgoingLinks.length + incomingLinks.length + relationships.length}
          </div>
          <span className="text-[10px] text-gray-500">
            Proyectos, notas y personas
          </span>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. BARRA DE PESTAÑAS (ORGANIZACIÓN POR SECCIONES)                         */}
      {/* ========================================================================= */}
      <div className="border-b border-[#252538] -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-1">
          {[
            { id: 'contacto', label: 'Contacto & Datos', icon: User },
            { id: 'cumpleanos', label: 'Cumpleaños & Fechas', icon: Cake },
            { id: 'interacciones', label: `Interacciones (${interactions.length})`, icon: Clock },
            { id: 'notas', label: 'Notas Personales', icon: FileText },
            { id: 'relaciones', label: `Relaciones (${relationships.length + outgoingLinks.length})`, icon: Share2 },
            { id: 'archivos', label: `Archivos (${attachments.length})`, icon: Paperclip },
            { id: 'personalizadas', label: `Personalizadas (${customPropertiesEntries.length})`, icon: Sliders }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                  isActive
                    ? 'bg-[#1e1e2c] text-blue-400 border border-[#2d2d42] shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#161622]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-gray-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECCIÓN A: INFORMACIÓN DE CONTACTO                                        */}
      {/* ========================================================================= */}
      {activeTab === 'contacto' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-[#161622] border border-[#252536] space-y-6">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#232332] pb-3">
            <User className="w-4 h-4 text-blue-400" />
            <span>Datos de Contacto y Ubicación</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            
            {/* Correo Electrónico */}
            <div>
              <label className="text-gray-400 font-medium block mb-1">Correo Electrónico</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={e => {
                    onPropertyChange('email', e.target.value);
                    onPropertyChange('correo', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="ejemplo@correo.com"
                  className="flex-1 bg-[#1a1a26] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                />
                {email && (
                  <a
                    href={`mailto:${email}`}
                    className="p-2 rounded-xl bg-[#232334] text-blue-400 hover:text-white border border-[#303046] flex items-center justify-center transition"
                    title="Enviar correo"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Teléfono */}
            <div>
              <label className="text-gray-400 font-medium block mb-1">Teléfono principal</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => {
                    onPropertyChange('phone', e.target.value);
                    onPropertyChange('telefono', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="+57 300 123 4567"
                  className="flex-1 bg-[#1a1a26] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                />
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    className="p-2 rounded-xl bg-[#232334] text-emerald-400 hover:text-white border border-[#303046] flex items-center justify-center transition"
                    title="Llamar"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* WhatsApp */}
            <div>
              <label className="text-gray-400 font-medium block mb-1">WhatsApp (con código de país)</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={e => {
                    onPropertyChange('whatsapp', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="573001234567"
                  className="flex-1 bg-[#1a1a26] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                />
                {cleanWhatsappNumber && (
                  <a
                    href={`https://wa.me/${cleanWhatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-emerald-950/40 text-emerald-400 hover:text-white border border-emerald-800/40 flex items-center justify-center transition"
                    title="Abrir WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Dirección / Ubicación */}
            <div>
              <label className="text-gray-400 font-medium block mb-1">Dirección residencial / oficina</label>
              <input
                type="text"
                value={address}
                onChange={e => {
                  onPropertyChange('direccion', e.target.value);
                  onSaveStatusChange('dirty');
                }}
                placeholder="Calle 123 # 45-67..."
                className="w-full bg-[#1a1a26] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </div>

            {/* Ciudad y País */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-400 font-medium block mb-1">Ciudad</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => {
                    onPropertyChange('ciudad', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="Bogotá"
                  className="w-full bg-[#1a1a26] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-gray-400 font-medium block mb-1">País</label>
                <input
                  type="text"
                  value={country}
                  onChange={e => {
                    onPropertyChange('pais', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="Colombia"
                  className="w-full bg-[#1a1a26] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Sitio Web */}
            <div>
              <label className="text-gray-400 font-medium block mb-1">Sitio Web personal o portafolio</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={website}
                  onChange={e => {
                    onPropertyChange('website', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="https://persona.com"
                  className="flex-1 bg-[#1a1a26] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                />
                {website && (
                  <a
                    href={website.startsWith('http') ? website : `https://${website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-[#232334] text-gray-300 hover:text-white border border-[#303046] flex items-center justify-center transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* LinkedIn */}
            <div>
              <label className="text-gray-400 font-medium block mb-1">LinkedIn</label>
              <input
                type="text"
                value={linkedin}
                onChange={e => {
                  onPropertyChange('linkedin', e.target.value);
                  onSaveStatusChange('dirty');
                }}
                placeholder="usuario o enlace completo..."
                className="w-full bg-[#1a1a26] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </div>

            {/* Twitter / X */}
            <div>
              <label className="text-gray-400 font-medium block mb-1">X (Twitter)</label>
              <input
                type="text"
                value={twitter}
                onChange={e => {
                  onPropertyChange('twitter', e.target.value);
                  onSaveStatusChange('dirty');
                }}
                placeholder="@usuario..."
                className="w-full bg-[#1a1a26] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </div>

            {/* Instagram */}
            <div>
              <label className="text-gray-400 font-medium block mb-1">Instagram</label>
              <input
                type="text"
                value={instagram}
                onChange={e => {
                  onPropertyChange('instagram', e.target.value);
                  onSaveStatusChange('dirty');
                }}
                placeholder="@usuario..."
                className="w-full bg-[#1a1a26] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECCIÓN B: CUMPLEAÑOS Y FECHAS IMPORTANTES                                */}
      {/* ========================================================================= */}
      {activeTab === 'cumpleanos' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-[#161622] border border-[#252536] space-y-6">
          <div className="flex items-center justify-between border-b border-[#232332] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cake className="w-4 h-4 text-pink-400" />
                <span>Cumpleaños y Recordatorios Automáticos</span>
              </h3>
              <p className="text-[11px] text-gray-400">
                Calcula la edad dinámicamente y programa recordatorios el mismo día y el día previo.
              </p>
            </div>

            {birthday && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await syncPersonBirthdayReminders(object);
                    alert('¡Recordatorios de cumpleaños sincronizados correctamente en el calendario!');
                  } catch (e: any) {
                    alert('Error sincronizando recordatorios: ' + e.message);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-600/30 hover:bg-pink-600/50 border border-pink-500/50 text-pink-300 text-xs font-semibold transition"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Sincronizar recordatorio</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            
            {/* Selector de fecha */}
            <div className="space-y-3">
              <label className="text-gray-300 text-xs font-semibold block">
                Fecha de nacimiento o cumpleaños
              </label>
              <DatePickerInput
                value={birthday}
                onChange={newDate => {
                  onPropertyChange('birthday', newDate);
                  onPropertyChange('cumpleanos', newDate);
                  onPropertyChange('fecha_nacimiento', newDate);
                  onSaveStatusChange('dirty');
                }}
                isBirthday={true}
                placeholder="Elegir fecha de cumpleaños..."
              />
              <p className="text-[11px] text-gray-500">
                Puedes seleccionar el año para calcular la edad exacta o solo día y mes.
              </p>
            </div>

            {/* Tarjeta de edad y próximo cumpleaños */}
            {nextBirthdayInfo ? (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-950/20 to-purple-950/20 border border-pink-800/30 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-pink-400 block">
                      Cuenta regresiva
                    </span>
                    <span className="text-2xl font-black text-white mt-1 block">
                      {nextBirthdayInfo.formattedText}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold">
                    🎂
                  </div>
                </div>

                <div className="space-y-1 text-xs text-gray-300 border-t border-pink-800/30 pt-2.5">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Fecha del evento:</span>
                    <span className="font-semibold text-white">{formatBirthdayDisplay(birthday)}</span>
                  </div>
                  {currentAge !== null && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Edad actual:</span>
                      <span className="font-semibold text-white">{currentAge} años</span>
                    </div>
                  )}
                  {nextBirthdayInfo.turningAge !== null && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Cumplirá:</span>
                      <span className="font-semibold text-pink-300">{nextBirthdayInfo.turningAge} años</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-[#1a1a26] border border-dashed border-[#29293c] flex flex-col items-center justify-center text-center text-xs text-gray-400 space-y-1">
                <Cake className="w-6 h-6 text-gray-500 mb-1" />
                <span>No se ha registrado fecha de cumpleaños para {title}.</span>
                <span className="text-[11px] text-gray-500">Usa el selector para programar las alertas anuales.</span>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECCIÓN C: INTERACCIONES E HISTORIAL (CRONOLOGÍA)                         */}
      {/* ========================================================================= */}
      {activeTab === 'interacciones' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-[#161622] border border-[#252536] space-y-6">
          <div className="flex items-center justify-between border-b border-[#232332] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Historial de Interacciones & Cronología ({interactions.length})</span>
              </h3>
              <p className="text-[11px] text-gray-400">
                Registra llamadas, reuniones, acuerdos y fechas de seguimiento.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingInteraction({
                  person_id: object.id,
                  type: 'call',
                  date: new Date().toISOString(),
                  summary: '',
                  notes: '',
                  commitments: '',
                  next_action: '',
                  follow_up_date: null
                });
                setIsInteractionModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Interacción</span>
            </button>
          </div>

          {interactions.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-[#29293c] text-center text-gray-400 text-xs space-y-2">
              <Users className="w-6 h-6 text-gray-500 mx-auto" />
              <p>Aún no hay interacciones registradas con {title}.</p>
              <button
                type="button"
                onClick={() => {
                  setEditingInteraction({
                    person_id: object.id,
                    type: 'call',
                    date: new Date().toISOString(),
                    summary: 'Primera conversación'
                  });
                  setIsInteractionModalOpen(true);
                }}
                className="text-emerald-400 hover:underline text-xs font-semibold"
              >
                + Registrar la primera interacción
              </button>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#252538]">
              {interactions.map(interaction => {
                const typeMeta = INTERACTION_TYPE_OPTIONS.find(t => t.id === interaction.type) || INTERACTION_TYPE_OPTIONS[0];
                const Icon = typeMeta.icon;

                return (
                  <div key={interaction.id} className="relative group">
                    {/* Bullet icon on timeline */}
                    <div 
                      className="absolute -left-[27px] top-1.5 w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#161622] shadow"
                      style={{ backgroundColor: typeMeta.color, color: '#fff' }}
                    >
                      <Icon className="w-3 h-3" />
                    </div>

                    {/* Interaction Card */}
                    <div className="p-4 rounded-2xl bg-[#1a1a26] border border-[#2b2b40] hover:border-[#383852] transition space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">
                            {interaction.summary}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#242436] text-gray-300">
                            {typeMeta.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingInteraction(interaction);
                              setIsInteractionModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white"
                            title="Editar interacción"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInteraction(interaction.id)}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-300"
                            title="Eliminar interacción"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <span className="text-[11px] text-gray-400 block">
                        {new Date(interaction.date).toLocaleDateString('es-ES', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>

                      {interaction.notes && (
                        <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed pt-1">
                          {interaction.notes}
                        </p>
                      )}

                      {(interaction.commitments || interaction.next_action || interaction.follow_up_date) && (
                        <div className="pt-2 border-t border-[#252538] flex items-center gap-3 text-[11px] text-gray-300 flex-wrap">
                          {interaction.commitments && (
                            <span className="flex items-center gap-1 text-emerald-400 font-medium">
                              <CheckSquare className="w-3 h-3" />
                              Acuerdos: {interaction.commitments}
                            </span>
                          )}
                          {interaction.follow_up_date && (
                            <span className="flex items-center gap-1 text-amber-400 font-medium">
                              <Bell className="w-3 h-3" />
                              Seguimiento: {interaction.follow_up_date}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECCIÓN D: NOTAS PERSONALES (TIPTAP EDITOR ENRIQUECIDO)                   */}
      {/* ========================================================================= */}
      {activeTab === 'notas' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-[#161622] border border-[#252536] space-y-4">
          <div className="flex items-center justify-between border-b border-[#232332] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <span>Notas Personales & Contexto de la Relación</span>
              </h3>
              <p className="text-[11px] text-gray-400">
                Apuntes enriquecidos, preferencias, temas de conversación e ideas vinculadas.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onOpenAudioModal && (
                <button
                  type="button"
                  onClick={onOpenAudioModal}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 transition shadow-sm"
                  title="Grabar o insertar nota de voz"
                >
                  <Mic className="w-3.5 h-3.5 text-red-400" />
                  <span>Voz</span>
                </button>
              )}
              <TableGridPicker editor={editor} showLabel={true} />
            </div>
          </div>

          <TableToolbar editor={editor} className="rounded-xl border border-[#252538] mb-2" />

          <div className="min-h-[250px] rounded-2xl bg-[#121218] border border-[#252538] p-4 text-white">
            {editor ? (
              <EditorContent editor={editor} className="prose prose-invert max-w-none text-xs sm:text-sm focus:outline-none" />
            ) : (
              <div className="text-gray-500 text-xs">Cargando editor de notas...</div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECCIÓN E: RELACIONES (CONTACTOS, EMPRESAS, PROYECTOS, VÍNCULOS)          */}
      {/* ========================================================================= */}
      {activeTab === 'relaciones' && (
        <div className="space-y-6">
          
          {/* Relaciones Personales (Familiar, Colega, Amigo, etc.) */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#161622] border border-[#252536] space-y-4">
            <div className="flex items-center justify-between border-b border-[#232332] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-pink-400" />
                  <span>Relaciones con Otros Contactos ({relationships.length})</span>
                </h3>
                <p className="text-[11px] text-gray-400">
                  Indica la naturaleza de la relación: socio, familiar, amigo o colega.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsRelModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Vincular contacto</span>
              </button>
            </div>

            {relationships.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-[#29293c] text-center text-xs text-gray-400">
                No hay relaciones directas con otros contactos registradas.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relationships.map(rel => {
                  const targetPersonId = rel.source_person_id === object.id ? rel.target_person_id : rel.source_person_id;
                  const targetPerson = allObjects.find(o => o.id === targetPersonId);

                  return (
                    <div 
                      key={rel.id}
                      className="p-3.5 rounded-2xl bg-[#1a1a26] border border-[#2b2b40] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-xs">
                          {targetPerson?.title?.charAt(0).toUpperCase() || 'P'}
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => targetPerson && onNavigateToObject && onNavigateToObject(targetPerson)}
                            className="text-xs font-bold text-white hover:text-pink-300 transition text-left block"
                          >
                            {targetPerson?.title || 'Contacto vinculado'}
                          </button>
                          <span className="text-[11px] text-pink-400">
                            {rel.relation_type}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteRelationship(rel.id)}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-300"
                        title="Eliminar relación"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Vínculos Universales (Proyectos, Notas, Lugares, Viajes) */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#161622] border border-[#252536] space-y-4">
            <div className="flex items-center justify-between border-b border-[#232332] pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-indigo-400" />
                  <span>Vínculos Universales & Backlinks ({outgoingLinks.length + incomingLinks.length})</span>
                </h3>
                <p className="text-[11px] text-gray-400">
                  Conexiones del grafo con proyectos, tareas y notas de Segundo Cerebro.
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenLinkSelector}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#232334] hover:bg-[#2d2d42] text-white text-xs font-semibold shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5 text-blue-400" />
                <span>Vincular entidad</span>
              </button>
            </div>

            {/* Enlaces salientes */}
            {outgoingLinks.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-gray-400 block">Enlaces salientes:</span>
                <div className="flex flex-wrap gap-2">
                  {outgoingLinks.map(link => (
                    <button
                      key={link.id}
                      type="button"
                      onClick={() => onNavigateToEntity && link.target_id && onNavigateToEntity(link.target_id, link.target_type || 'object')}
                      className="px-2.5 py-1.5 rounded-xl bg-[#1a1a26] border border-[#2d2d40] text-xs text-blue-300 hover:text-white flex items-center gap-1.5 transition"
                    >
                      <Share2 className="w-3 h-3 text-blue-400" />
                      <span>{link.target_id ? `${link.target_id.slice(0, 8)}...` : 'Enlace'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Backlinks */}
            {incomingLinks.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#232332]">
                <span className="text-[11px] font-semibold text-gray-400 block">Mencionado en (Backlinks):</span>
                <div className="flex flex-wrap gap-2">
                  {incomingLinks.map(link => (
                    <button
                      key={link.id}
                      type="button"
                      onClick={() => onNavigateToEntity && link.source_id && onNavigateToEntity(link.source_id, link.source_type || 'object')}
                      className="px-2.5 py-1.5 rounded-xl bg-[#1a1a26] border border-[#2d2d40] text-xs text-indigo-300 hover:text-white flex items-center gap-1.5 transition"
                    >
                      <Share2 className="w-3 h-3 text-indigo-400" />
                      <span>{link.source_id ? `${link.source_id.slice(0, 8)}...` : 'Enlace'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SECCIÓN F: ARCHIVOS ADJUNTOS EN CLOUDFLARE R2                             */}
      {/* ========================================================================= */}
      {activeTab === 'archivos' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-[#161622] border border-[#252536] space-y-4">
          <div className="flex items-center justify-between border-b border-[#232332] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-teal-400" />
                <span>Archivos y Documentos Adjuntos ({attachments.length})</span>
              </h3>
              <p className="text-[11px] text-gray-400">
                Almacenados de forma persistente en Cloudflare R2 sin duplicar binarios.
              </p>
            </div>

            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold cursor-pointer transition">
              <Plus className="w-3.5 h-3.5" />
              <span>Subir archivo</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={async e => {
                  if (e.target.files && e.target.files.length > 0) {
                    for (let i = 0; i < e.target.files.length; i++) {
                      const f = e.target.files[i];
                      try {
                        const res = await r2Storage.uploadFile(f, `contacts/${object.id}/files`);
                        const rec = await db.recordAttachment({
                          entity_id: object.id,
                          entity_type: 'object',
                          file_name: res.name,
                          display_name: f.name,
                          file_url: res.url,
                          file_path: res.r2Key,
                          r2_key: res.provider === 'r2' ? res.r2Key : undefined,
                          storage_provider: res.provider,
                          file_size: res.size,
                          mime_type: res.mime
                        });
                        if (rec && onAttachmentCreated) onAttachmentCreated(rec);
                      } catch (err: any) {
                        alert(`Error subiendo ${f.name}: ` + err.message);
                      }
                    }
                    e.target.value = '';
                  }
                }}
              />
            </label>
          </div>

          {attachments.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-[#29293c] text-center text-xs text-gray-400">
              No hay archivos adjuntos para este contacto.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {attachments.map(att => (
                <div key={att.id} className="p-3 rounded-2xl bg-[#1a1a26] border border-[#2b2b40] flex items-center justify-between gap-3 group">
                  <div className="flex items-center gap-2.5 truncate">
                    <FileText className="w-4 h-4 text-teal-400 flex-shrink-0" />
                    <div className="truncate">
                      <a
                        href={att.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-white hover:underline truncate block"
                      >
                        {att.display_name || att.file_name}
                      </a>
                      <span className="text-[10px] text-gray-500">
                        {att.file_size ? `${Math.round(att.file_size / 1024)} KB` : 'Archivo R2'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <a
                      href={att.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white"
                      title="Abrir / Descargar"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm('¿Eliminar este archivo?')) {
                          await db.deleteAttachment(att.id);
                          if (onAttachmentDeleted) onAttachmentDeleted(att.id, att.file_path || att.file_url);
                        }
                      }}
                      className="p-1.5 rounded-lg text-red-400 hover:text-red-300"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECCIÓN G: PROPIEDADES PERSONALIZADAS (SIN CONTAMINAR CAMPOS NATIVOS)    */}
      {/* ========================================================================= */}
      {activeTab === 'personalizadas' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-[#161622] border border-[#252536] space-y-4">
          <div className="flex items-center justify-between border-b border-[#232332] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <span>Propiedades Personalizadas ({customPropertiesEntries.length})</span>
              </h3>
              <p className="text-[11px] text-gray-400">
                Campos personalizados adicionales creados exclusivamente por ti.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddingFieldOpen(prev => !prev)}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir propiedad</span>
            </button>
          </div>

          {isAddingFieldOpen && (
            <div className="p-3.5 rounded-2xl bg-[#1a1a26] border border-[#2b2b40] space-y-2">
              <span className="text-xs font-semibold text-white block">Nueva propiedad personalizada</span>
              <input
                type="text"
                value={newFieldLabel}
                onChange={e => {
                  setNewFieldLabel(e.target.value);
                  setNewFieldKey(e.target.value.toLowerCase().trim().replace(/\s+/g, '_'));
                }}
                placeholder="Nombre del campo (ej. Talla de camiseta, Pasatiempo)..."
                className="w-full bg-[#121218] border border-[#2d2d42] rounded-xl px-3 py-1.5 text-xs text-white outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingFieldOpen(false)}
                  className="text-xs text-gray-400 hover:text-white px-2 py-1"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (newFieldKey && newFieldLabel) {
                      onPropertyChange(newFieldKey, '');
                      setNewFieldKey('');
                      setNewFieldLabel('');
                      setIsAddingFieldOpen(false);
                      onSaveStatusChange('dirty');
                    }
                  }}
                  className="text-xs font-semibold px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                >
                  Guardar campo
                </button>
              </div>
            </div>
          )}

          {customPropertiesEntries.length === 0 ? (
            <div className="p-6 rounded-2xl border border-dashed border-[#29293c] text-center text-xs text-gray-400">
              No hay propiedades personalizadas adicionales para este contacto.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {customPropertiesEntries.map(([key, val]) => (
                <div key={key} className="p-3 rounded-2xl bg-[#1a1a26] border border-[#2b2b40] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{key}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const copy = { ...properties };
                        delete copy[key];
                        onPropertyChange(key, undefined);
                        onSaveStatusChange('dirty');
                      }}
                      className="text-gray-500 hover:text-red-400"
                      title="Eliminar campo"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={val || ''}
                    onChange={e => {
                      onPropertyChange(key, e.target.value);
                      onSaveStatusChange('dirty');
                    }}
                    placeholder={`Valor de ${key}...`}
                    className="w-full bg-[#121218] border border-[#262638] rounded-xl px-2.5 py-1.5 text-xs text-white outline-none"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR / EDITAR INTERACCIÓN                                     */}
      {/* ========================================================================= */}
      {isInteractionModalOpen && editingInteraction && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsInteractionModalOpen(false)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-[#161622] border border-[#2c2c42] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-5 py-4 border-b border-[#242436] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>{editingInteraction.id ? 'Editar Interacción' : 'Registrar Interacción con Contacto'}</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setIsInteractionModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveInteraction} className="p-5 space-y-4 overflow-y-auto no-scrollbar text-xs">
              
              {/* Tipo de Interacción */}
              <div>
                <label className="text-gray-300 font-medium block mb-1.5">Tipo de interacción</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {INTERACTION_TYPE_OPTIONS.map(opt => {
                    const isSelected = editingInteraction.type === opt.id;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setEditingInteraction(prev => ({ ...prev, type: opt.id }))}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-left transition ${
                          isSelected
                            ? 'bg-emerald-600/25 border-emerald-500 text-white font-semibold'
                            : 'bg-[#1a1a26] border-[#29293c] text-gray-300 hover:bg-[#202030]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: opt.color }} />
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Resumen / Título */}
              <div>
                <label className="text-gray-300 font-medium block mb-1">Resumen del asunto *</label>
                <input
                  type="text"
                  required
                  value={editingInteraction.summary || ''}
                  onChange={e => setEditingInteraction(prev => ({ ...prev, summary: e.target.value }))}
                  placeholder="Ej. Revisión de propuesta, Llamada de cumpleaños, Café en la oficina..."
                  className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              {/* Fecha y Hora */}
              <div>
                <label className="text-gray-300 font-medium block mb-1">Fecha y hora de la interacción</label>
                <DatePickerInput
                  value={editingInteraction.date?.slice(0, 10) || new Date().toISOString().slice(0, 10)}
                  onChange={newDate => setEditingInteraction(prev => ({ ...prev, date: `${newDate}T12:00:00` }))}
                />
              </div>

              {/* Notas detalladas */}
              <div>
                <label className="text-gray-300 font-medium block mb-1">Notas detalladas de la conversación</label>
                <textarea
                  rows={3}
                  value={editingInteraction.notes || ''}
                  onChange={e => setEditingInteraction(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Puntos tratados, comentarios, feedback recibido..."
                  className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Compromisos y Resultados */}
              <div>
                <label className="text-gray-300 font-medium block mb-1">Compromisos / Resultado alcanzado</label>
                <input
                  type="text"
                  value={editingInteraction.commitments || ''}
                  onChange={e => setEditingInteraction(prev => ({ ...prev, commitments: e.target.value }))}
                  placeholder="Ej. Enviar cotización actualizada, Agendar reunión presencial..."
                  className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              {/* Próxima Acción y Fecha de Seguimiento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 font-medium block mb-1">Próximo paso</label>
                  <input
                    type="text"
                    value={editingInteraction.next_action || ''}
                    onChange={e => setEditingInteraction(prev => ({ ...prev, next_action: e.target.value }))}
                    placeholder="Ej. Llamar el viernes"
                    className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-gray-300 font-medium block mb-1">Fecha de seguimiento</label>
                  <DatePickerInput
                    value={editingInteraction.follow_up_date || ''}
                    onChange={d => setEditingInteraction(prev => ({ ...prev, follow_up_date: d }))}
                    placeholder="Configurar alerta..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#232332]">
                <button
                  type="button"
                  onClick={() => setIsInteractionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm"
                >
                  Guardar Interacción
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VINCULAR OTRO CONTACTO / RELACIÓN PERSONAL                         */}
      {/* ========================================================================= */}
      {isRelModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsRelModalOpen(false)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-[#161622] border border-[#2c2c42] rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#232332] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-pink-400" />
                <span>Vincular Relación entre Contactos</span>
              </h3>
              <button 
                type="button" 
                onClick={() => setIsRelModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddRelationship} className="space-y-4 text-xs">
              <div>
                <label className="text-gray-300 font-medium block mb-1">Contacto a vincular con {title} *</label>
                <select
                  required
                  value={newRelTargetId}
                  onChange={e => setNewRelTargetId(e.target.value)}
                  className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none cursor-pointer"
                >
                  <option value="">Selecciona un contacto...</option>
                  {otherContacts.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gray-300 font-medium block mb-1">Naturaleza de la relación</label>
                <select
                  value={newRelType}
                  onChange={e => setNewRelType(e.target.value)}
                  className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none cursor-pointer"
                >
                  <option value="Colega de trabajo">Colega de trabajo</option>
                  <option value="Socio / Partner">Socio / Partner</option>
                  <option value="Familiar">Familiar (Hermano, Primo, etc.)</option>
                  <option value="Pareja / Cónyuge">Pareja / Cónyuge</option>
                  <option value="Amigo personal">Amigo personal</option>
                  <option value="Cliente / Cuenta">Cliente / Cuenta</option>
                  <option value="Jefe / Superior">Jefe / Superior</option>
                  <option value="Colaborador / Empleado">Colaborador / Empleado</option>
                  <option value="Mentor / Alumno">Mentor / Alumno</option>
                </select>
              </div>

              <div>
                <label className="text-gray-300 font-medium block mb-1">Notas adicionales (opcional)</label>
                <input
                  type="text"
                  value={newRelNotes}
                  onChange={e => setNewRelNotes(e.target.value)}
                  placeholder="Ej. Trabajaron juntos en el proyecto X..."
                  className="w-full bg-[#121218] border border-[#2a2a3e] rounded-xl px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#232332]">
                <button
                  type="button"
                  onClick={() => setIsRelModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-semibold shadow-sm"
                >
                  Guardar Relación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
