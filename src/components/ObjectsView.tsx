import React, { useState, useEffect } from 'react';
import { 
  Boxes, 
  Plus, 
  User, 
  Calendar, 
  BookOpen, 
  Link as LinkIcon, 
  Lightbulb, 
  Trash2, 
  Tag, 
  Filter,
  FolderKanban,
  Edit2,
  Sparkles,
  LayoutGrid,
  List as ListIcon,
  Image as ImageIcon,
  ExternalLink,
  Layers,
  Search,
  Eye,
  Building2,
  Briefcase,
  Mail,
  Phone
} from 'lucide-react';
import { AppObject, AppProject, AppAttachment, ObjectTypeDefinition, AppNote, AppTask } from '../lib/types';
import { EntityAttachmentsSection } from './EntityAttachmentsSection';
import { CustomTypeBuilderModal } from './CustomTypeBuilderModal';
import { ObjectDetailModal } from './ObjectDetailModal';
import { PersonDetailModal } from './PersonDetailModal';
import { db } from '../lib/insforge';

interface ObjectsViewProps {
  objects: AppObject[];
  projects: AppProject[];
  attachments?: AppAttachment[];
  onAttachmentCreated?: (attachment: AppAttachment) => void;
  onAttachmentDeleted?: (id: string, path: string) => void;
  onCreateObject: (obj: Partial<AppObject>) => Promise<void>;
  onUpdateObject: (id: string, updates: Partial<AppObject>) => Promise<void>;
  onDeleteObject: (id: string) => Promise<void>;
  notes?: AppNote[];
  tasks?: AppTask[];
  onOpenNote?: (note: AppNote) => void;
  activeType?: string;
  onSelectType?: (typeId: string) => void;
  customTypes?: ObjectTypeDefinition[];
  onCustomTypesChange?: (types: ObjectTypeDefinition[]) => void;
}

export const ObjectsView: React.FC<ObjectsViewProps> = ({
  objects,
  projects,
  attachments = [],
  onAttachmentCreated = () => {},
  onAttachmentDeleted = () => {},
  onCreateObject,
  onUpdateObject,
  onDeleteObject,
  notes = [],
  tasks = [],
  onOpenNote,
  activeType,
  onSelectType,
  customTypes: externalCustomTypes,
  onCustomTypesChange
}) => {
  const [internalSelectedType, setInternalSelectedType] = useState<string>('all');
  const selectedType = activeType !== undefined ? activeType : internalSelectedType;
  const setSelectedType = (t: string) => {
    if (onSelectType) onSelectType(t);
    setInternalSelectedType(t);
  };

  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'gallery'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isCreatingObject, setIsCreatingObject] = useState(false);
  const [isTypeBuilderOpen, setIsTypeBuilderOpen] = useState(false);
  const [selectedDetailObject, setSelectedDetailObject] = useState<AppObject | null>(null);

  // Custom object types from InsForge
  const [internalCustomTypes, setInternalCustomTypes] = useState<ObjectTypeDefinition[]>([]);
  const customTypes = externalCustomTypes !== undefined ? externalCustomTypes : internalCustomTypes;
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);

  // Form for New Object
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<string>('person');
  const [newDescription, setNewDescription] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newThumbnailUrl, setNewThumbnailUrl] = useState('');
  const [newFormProperties, setNewFormProperties] = useState<Record<string, any>>({});

  // Load custom types on mount if not provided by parent
  useEffect(() => {
    if (externalCustomTypes !== undefined && externalCustomTypes.length > 0) return;
    const fetchTypes = async () => {
      try {
        setIsLoadingTypes(true);
        const types = await db.getCustomObjectTypes();
        setInternalCustomTypes(types);
        if (onCustomTypesChange) onCustomTypesChange(types);
      } catch (err) {
        console.warn('Error fetching custom object types:', err);
      } finally {
        setIsLoadingTypes(false);
      }
    };
    fetchTypes();
  }, []);

  // Standard predefined types
  const defaultTypes: ObjectTypeDefinition[] = [
    { id: 'person', name: 'Personas', icon: 'user', color: '#3b82f6', category: 'General', fields: [
      { key: 'rol', label: 'Rol / Cargo', type: 'text' },
      { key: 'email', label: 'Correo Electrónico', type: 'email' },
      { key: 'telefono', label: 'Teléfono', type: 'text' }
    ]},
    { id: 'meeting', name: 'Reuniones', icon: 'calendar', color: '#f59e0b', category: 'General', fields: [
      { key: 'fecha', label: 'Fecha de Reunión', type: 'date' },
      { key: 'participantes', label: 'Participantes', type: 'text' },
      { key: 'acuerdos', label: 'Acuerdos Principales', type: 'textarea' }
    ]},
    { id: 'resource', name: 'Recursos', icon: 'link', color: '#10b981', category: 'General', fields: [
      { key: 'url', label: 'URL / Enlace', type: 'url' },
      { key: 'tipo_recurso', label: 'Tipo de Recurso', type: 'text' }
    ]},
    { id: 'book', name: 'Libros', icon: 'book', color: '#8b5cf6', category: 'Conocimiento', fields: [
      { key: 'autor', label: 'Autor', type: 'text' },
      { key: 'año', label: 'Año de Publicación', type: 'number' },
      { key: 'calificacion', label: 'Calificación (1-5)', type: 'number' }
    ]},
    { id: 'concept', name: 'Conceptos', icon: 'lightbulb', color: '#eab308', category: 'Conocimiento', fields: [
      { key: 'disciplina', label: 'Disciplina / Área', type: 'text' },
      { key: 'fuente', label: 'Fuente de Origen', type: 'text' }
    ]}
  ];

  // Combined type definitions
  const allTypeDefinitions: ObjectTypeDefinition[] = [...defaultTypes, ...customTypes];

  // Helper to get active type definition
  const currentTypeDef = allTypeDefinitions.find(t => t.id === newType);

  const handleSaveCustomType = async (typeDef: ObjectTypeDefinition) => {
    const saved = await db.saveCustomObjectType(typeDef);
    if (saved) {
      const next = [...customTypes.filter(t => t.id !== saved.id), saved];
      setInternalCustomTypes(next);
      if (onCustomTypesChange) onCustomTypesChange(next);
      setSelectedType(saved.id);
      setNewType(saved.id);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    if (newType === 'person') {
      const bday = newFormProperties.birthday;
      if (!bday || !String(bday).trim()) {
        alert('La Fecha de Cumpleaños es obligatoria para registrar un nuevo contacto.');
        return;
      }
      const bdayDate = new Date(bday);
      if (isNaN(bdayDate.getTime())) {
        alert('Por favor introduce una fecha de cumpleaños válida.');
        return;
      }
    }

    await onCreateObject({
      title: newTitle.trim(),
      object_type: newType,
      description: newDescription.trim() || undefined,
      project_id: newProjectId || undefined,
      thumbnail_url: newThumbnailUrl.trim() || undefined,
      properties: newFormProperties
    });

    setNewTitle('');
    setNewDescription('');
    setNewThumbnailUrl('');
    setNewFormProperties({});
    setIsCreatingObject(false);
  };

  // Filter objects by type and search query
  const filteredObjects = objects.filter(obj => {
    if (selectedType !== 'all' && obj.object_type !== selectedType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = obj.title.toLowerCase().includes(q);
      const matchDesc = obj.description?.toLowerCase().includes(q);
      const matchProps = JSON.stringify(obj.properties || {}).toLowerCase().includes(q);
      return matchTitle || matchDesc || matchProps;
    }
    return true;
  });

  const getTypeMeta = (typeId: string) => {
    const def = allTypeDefinitions.find(t => t.id === typeId);
    if (def) return def;
    return { id: typeId, name: typeId, color: '#3b82f6', icon: 'box', fields: [] };
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#16161d] overflow-hidden">
      {/* Top Header */}
      <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 border-b border-[#252530] bg-[#141419] flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>Objetos y Entidades</span>
          </h2>
          <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
            Dossiers estructurados, entidades de conocimiento, atributos dinámicos y archivos R2.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Create Custom Type Button */}
          <button
            onClick={() => setIsTypeBuilderOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e1e2c] hover:bg-[#28283a] text-purple-300 border border-purple-500/30 transition shadow-sm"
            title="Crear tu propia plantilla de entidad"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Crear la tuya</span>
          </button>

          {/* New Object Button */}
          <button
            onClick={() => {
              setNewFormProperties({});
              setIsCreatingObject(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm shadow-emerald-900/30 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Objeto</span>
          </button>
        </div>
      </div>

      {/* Subheader: Search, Filter Tabs & View Modes */}
      <div className="px-4 sm:px-6 md:px-8 py-3 bg-[#131318] border-b border-[#23232f] flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Type pills: Clean flex-wrap with no horizontal scrollbar */}
        <div className="flex flex-wrap items-center gap-1.5 flex-1">
          <button
            onClick={() => setSelectedType('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              selectedType === 'all'
                ? 'bg-[#22222e] text-white border border-[#3b3b4f] shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a22]'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Todos</span>
            <span className="text-[10px] px-1.5 rounded-full bg-[#292936] text-gray-400 font-mono">
              {objects.length}
            </span>
          </button>

          {allTypeDefinitions.map(t => {
            const count = objects.filter(o => o.object_type === t.id).length;
            const isSelected = selectedType === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedType(t.id)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  isSelected
                    ? 'bg-[#22222e] text-white border border-[#3b3b4f] shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a22]'
                }`}
              >
                <span 
                  className="w-2 h-2 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: t.color || '#3b82f6' }} 
                />
                <span>{t.name}</span>
                <span className="text-[10px] px-1.5 rounded-full bg-[#292936] text-gray-400 font-mono">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & View Switcher */}
        <div className="flex items-center gap-2.5 flex-shrink-0 self-end md:self-auto">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar entidad..."
              className="pl-8 pr-3 py-1.5 bg-[#1a1a24] border border-[#2b2b3a] rounded-lg text-xs text-white placeholder-gray-500 outline-none focus:border-emerald-500 w-36 sm:w-48 transition"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#181822] border border-[#29293a] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-[#29293b] text-white' : 'text-gray-400 hover:text-gray-200'}`}
              title="Vista de Cuadrícula"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-[#29293b] text-white' : 'text-gray-400 hover:text-gray-200'}`}
              title="Vista de Lista"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('gallery')}
              className={`p-1.5 rounded ${viewMode === 'gallery' ? 'bg-[#29293b] text-white' : 'text-gray-400 hover:text-gray-200'}`}
              title="Vista de Galería"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        {filteredObjects.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-xs flex flex-col items-center gap-3">
            <Boxes className="w-10 h-10 text-gray-600 stroke-[1.5]" />
            <p>No hay objetos registrados en esta vista.</p>
            <button
              onClick={() => setIsCreatingObject(true)}
              className="px-4 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30 transition text-xs font-medium"
            >
              Crear Nuevo Objeto
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View: Symmetrical, square proportion cards (3 to 5 columns on desktop) */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
            {filteredObjects.map(obj => {
              const project = projects.find(p => p.id === obj.project_id);
              const typeMeta = getTypeMeta(obj.object_type);
              const props = obj.properties || {};
              const topProps = Object.entries(props).slice(0, 2);

              const isPerson = obj.object_type === 'person';
              const organization = props.organization || props.empresa;
              const role = props.role || props.cargo || props.rol;
              const email = props.email;
              const phone = props.phone || props.telefono;

              if (isPerson) {
                const birthday = props.birthday || props.cumpleanos || props.fecha_nacimiento;
                const hasBirthday = Boolean(birthday && String(birthday).trim());

                return (
                  <div
                    key={obj.id}
                    onClick={() => setSelectedDetailObject(obj)}
                    className="bg-[#191924] rounded-2xl border border-[#28283a] hover:border-blue-500/50 transition-all duration-200 p-4.5 flex flex-col justify-between shadow-sm cursor-pointer group hover:shadow-xl relative overflow-hidden select-none min-h-[290px] max-h-[360px]"
                  >
                    <div className="overflow-hidden flex-1 flex flex-col">
                      {/* Top Header: Badge & Actions */}
                      <div className="flex items-center justify-between gap-1.5 mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-blue-950/70 text-blue-400 border border-blue-800/40 flex items-center gap-1">
                            <User className="w-2.5 h-2.5" />
                            <span>Persona</span>
                          </span>

                          {hasBirthday ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-amber-950/50 text-amber-300 border border-amber-800/40 flex items-center gap-1" title={`Cumpleaños: ${birthday}`}>
                              <span>🎂</span>
                              <span>{String(birthday).slice(5)}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-950/50 text-red-400 border border-red-800/40 flex items-center gap-1" title="Cumpleaños no registrado">
                              <span>⚠️ Sin Cumpleaños</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedDetailObject(obj)}
                            className="p-1 rounded bg-[#20202e] hover:bg-[#2b2b3e] text-blue-400 transition"
                            title="Ver Ficha de Contacto"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`¿Eliminar contacto "${obj.title}"?`)) {
                                onDeleteObject(obj.id);
                              }
                            }}
                            className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition"
                            title="Eliminar contacto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Contact Identity Header: Avatar + Name + Org/Role */}
                      <div className="flex items-center gap-3 mb-2.5">
                        {obj.thumbnail_url ? (
                          <img
                            src={obj.thumbnail_url}
                            alt={obj.title}
                            className="w-12 h-12 rounded-xl object-cover border border-[#35354a] shadow flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-base font-bold shadow flex-shrink-0">
                            {obj.title.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm text-white group-hover:text-blue-400 transition truncate leading-tight">
                            {obj.title}
                          </h3>
                          {(role || organization) && (
                            <p className="text-[11px] text-gray-400 truncate mt-0.5">
                              {role} {role && organization && '•'} {organization}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Brief description if any */}
                      {obj.description && (
                        <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed mb-2.5">
                          {obj.description}
                        </p>
                      )}

                      {/* Contact Badges (Email, Phone) */}
                      {(email || phone) && (
                        <div className="flex flex-wrap gap-1.5 mb-2 mt-auto">
                          {email && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[#13131c] text-blue-300 border border-[#232332] flex items-center gap-1 truncate max-w-[170px]">
                              <Mail className="w-2.5 h-2.5 flex-shrink-0" />
                              <span className="truncate">{email}</span>
                            </span>
                          )}
                          {phone && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[#13131c] text-emerald-300 border border-[#232332] flex items-center gap-1 truncate max-w-[130px]">
                              <Phone className="w-2.5 h-2.5 flex-shrink-0" />
                              <span className="truncate">{phone}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Tags */}
                      {obj.tags && obj.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-auto">
                          {obj.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[9.5px] px-1.5 py-0.2 rounded bg-[#1e1e2c] text-gray-400">
                              #{tag}
                            </span>
                          ))}
                          {obj.tags.length > 2 && (
                            <span className="text-[9.5px] text-gray-500">+{obj.tags.length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="pt-2.5 border-t border-[#232332] flex items-center justify-between text-xs text-gray-400 mt-2 flex-shrink-0">
                      {project ? (
                        <span className="flex items-center gap-1 text-[11px] text-blue-300 truncate max-w-[120px]">
                          <FolderKanban className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{project.title}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-500">Sin proyecto</span>
                      )}

                      <span className="text-[10px] font-mono text-gray-400">
                        {new Date(obj.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={obj.id}
                  onClick={() => setSelectedDetailObject(obj)}
                  className="bg-[#191924] rounded-2xl border border-[#28283a] hover:border-emerald-500/40 transition-all duration-200 p-4 sm:p-4.5 flex flex-col justify-between shadow-sm cursor-pointer group hover:shadow-xl relative overflow-hidden select-none min-h-[290px] max-h-[360px]"
                >
                  <div className="overflow-hidden flex-1 flex flex-col">
                    {/* Top Type Pill & Action Buttons */}
                    <div className="flex items-center justify-between gap-1.5 mb-2.5">
                      <span 
                        className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider flex items-center gap-1.5 truncate max-w-[150px]"
                        style={{ backgroundColor: `${typeMeta.color}20`, color: typeMeta.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: typeMeta.color }} />
                        <span className="truncate">{typeMeta.name}</span>
                      </span>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedDetailObject(obj)}
                          className="p-1 rounded bg-[#222232] hover:bg-[#2c2c40] text-emerald-400 transition"
                          title="Ver Ficha Completa"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`¿Eliminar objeto "${obj.title}"?`)) {
                              onDeleteObject(obj.id);
                            }
                          }}
                          className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition"
                          title="Eliminar objeto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Image Thumbnail Preview (if any) */}
                    {obj.thumbnail_url && (
                      <div className="mb-2.5 rounded-xl overflow-hidden aspect-[16/9] bg-[#121218] border border-[#252535] flex-shrink-0">
                        <img 
                          src={obj.thumbnail_url} 
                          alt={obj.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      </div>
                    )}

                    {/* Title & Description */}
                    <h3 className="font-bold text-sm text-white mb-1 group-hover:text-emerald-400 transition leading-snug line-clamp-2">
                      {obj.title}
                    </h3>

                    {obj.description && (
                      <p className="text-[11px] text-gray-400 mb-2.5 line-clamp-2 leading-relaxed">
                        {obj.description}
                      </p>
                    )}

                    {/* Compact Attributes List (limited to 2 to prevent excessive vertical elongation) */}
                    {topProps.length > 0 && (
                      <div className="bg-[#13131a] rounded-xl p-2 border border-[#232330] space-y-1 mb-2 text-[10.5px] mt-auto">
                        {topProps.map(([k, v]) => (
                          <div key={k} className="flex justify-between items-center text-gray-400 gap-1">
                            <span className="font-mono text-gray-400 capitalize truncate max-w-[80px]">{k}:</span>
                            <span className="text-gray-200 truncate max-w-[120px] font-medium">{String(v)}</span>
                          </div>
                        ))}
                        {Object.keys(props).length > 2 && (
                          <div className="text-[9.5px] text-gray-500 text-right pt-0.5">
                            +{Object.keys(props).length - 2} más
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Project & Date */}
                  <div className="pt-2.5 border-t border-[#232332] flex items-center justify-between text-xs text-gray-400 mt-2 flex-shrink-0">
                    {project ? (
                      <span className="flex items-center gap-1 text-[11px] text-blue-300 truncate max-w-[120px]">
                        <FolderKanban className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{project.title}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-500">Sin proyecto</span>
                    )}

                    <span className="text-[10px] font-mono text-gray-400">
                      {new Date(obj.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'list' ? (
          /* List View: Structured Table */
          <div className="bg-[#181822] rounded-2xl border border-[#28283a] overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#13131c] text-gray-400 font-medium border-b border-[#242436]">
                <tr>
                  <th className="py-3 px-4">Entidad / Título</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Proyecto</th>
                  <th className="py-3 px-4">Atributos Destacados</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222232]">
                {filteredObjects.map(obj => {
                  const project = projects.find(p => p.id === obj.project_id);
                  const typeMeta = getTypeMeta(obj.object_type);
                  const props = obj.properties || {};

                  return (
                    <tr 
                      key={obj.id}
                      onClick={() => setSelectedDetailObject(obj)}
                      className="hover:bg-[#1d1d2b] cursor-pointer transition"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {obj.thumbnail_url ? (
                            <img src={obj.thumbnail_url} alt="" className="w-7 h-7 rounded-lg object-cover" />
                          ) : (
                            <div 
                              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px]"
                              style={{ backgroundColor: `${typeMeta.color}25`, color: typeMeta.color }}
                            >
                              {obj.title.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-white block">{obj.title}</span>
                            {obj.description && (
                              <span className="text-[11px] text-gray-400 truncate max-w-xs block">
                                {obj.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span 
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: `${typeMeta.color}20`, color: typeMeta.color }}
                        >
                          {typeMeta.name}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-gray-300">
                        {project ? project.title : <span className="text-gray-600">—</span>}
                      </td>

                      <td className="py-3 px-4 text-gray-400">
                        <div className="flex items-center gap-2 truncate max-w-sm">
                          {Object.entries(props).slice(0, 2).map(([k, v]) => (
                            <span key={k} className="text-[11px] bg-[#14141c] px-2 py-0.5 rounded border border-[#232332]">
                              <span className="text-gray-500 mr-1">{k}:</span>
                              <span className="text-gray-200">{String(v)}</span>
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-gray-400">
                        {new Date(obj.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`¿Eliminar "${obj.title}"?`)) {
                              onDeleteObject(obj.id);
                            }
                          }}
                          className="p-1.5 text-gray-500 hover:text-red-400 transition rounded hover:bg-red-950/30"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Gallery View: Visual Cover Focus */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredObjects.map(obj => {
              const typeMeta = getTypeMeta(obj.object_type);

              return (
                <div
                  key={obj.id}
                  onClick={() => setSelectedDetailObject(obj)}
                  className="group relative bg-[#181822] rounded-2xl border border-[#28283a] hover:border-emerald-500/50 overflow-hidden cursor-pointer transition shadow-sm hover:shadow-xl flex flex-col aspect-[3/4]"
                >
                  {obj.thumbnail_url ? (
                    <img
                      src={obj.thumbnail_url}
                      alt={obj.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div 
                      className="w-full h-full flex flex-col items-center justify-center p-4 text-center"
                      style={{ backgroundColor: `${typeMeta.color}15` }}
                    >
                      <Boxes className="w-10 h-10 mb-2 opacity-50" style={{ color: typeMeta.color }} />
                      <span className="font-bold text-sm text-white line-clamp-2">{obj.title}</span>
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-3.5">
                    <span 
                      className="text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider self-start mb-1"
                      style={{ backgroundColor: `${typeMeta.color}35`, color: typeMeta.color }}
                    >
                      {typeMeta.name}
                    </span>
                    <h4 className="font-bold text-xs sm:text-sm text-white line-clamp-2 drop-shadow">
                      {obj.title}
                    </h4>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Crear Nuevo Objeto */}
      {isCreatingObject && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-50">
          <form 
            onSubmit={handleCreateSubmit} 
            className="bg-[#191924] border border-[#2f2f42] rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#28283a]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Boxes className="w-4 h-4 text-emerald-400" />
                <span>Nuevo Objeto / Entidad</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreatingObject(false)}
                className="text-gray-400 hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>

            {/* Type selector */}
            <div>
              <label className="text-xs text-gray-300 font-medium block mb-1">
                Tipo de Entidad
              </label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value)}
                className="w-full px-3 py-2 bg-[#121217] border border-[#2c2c3e] rounded-xl text-xs text-white outline-none cursor-pointer"
              >
                {allTypeDefinitions.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.is_custom ? '(Personalizado)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs text-gray-300 font-medium block mb-1">
                Nombre o Título *
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Ej. Carlos Mendoza, Reunión Sprint, Clean Architecture..."
                className="w-full px-3.5 py-2 bg-[#121217] border border-[#2c2c3e] rounded-xl text-xs text-white outline-none focus:border-emerald-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-gray-300 font-medium block mb-1">
                Descripción
              </label>
              <textarea
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="Resumen o descripción introductoria..."
                rows={2}
                className="w-full px-3.5 py-2 bg-[#121217] border border-[#2c2c3e] rounded-xl text-xs text-white outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            {/* Project & Thumbnail */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-300 font-medium block mb-1">
                  Proyecto Vinculado
                </label>
                <select
                  value={newProjectId}
                  onChange={e => setNewProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121217] border border-[#2c2c3e] rounded-xl text-xs text-white outline-none cursor-pointer"
                >
                  <option value="">Sin Proyecto</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-300 font-medium block mb-1">
                  URL Portada / Imagen
                </label>
                <input
                  type="url"
                  value={newThumbnailUrl}
                  onChange={e => setNewThumbnailUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-[#121217] border border-[#2c2c3e] rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Form Attributes according to Type Definition */}
            {currentTypeDef && currentTypeDef.fields && currentTypeDef.fields.length > 0 && (
              <div className="border-t border-[#262638] pt-3 space-y-3">
                <span className="text-xs font-semibold text-gray-300 block">
                  Atributos de {currentTypeDef.name}
                </span>

                <div className="space-y-2.5">
                  {currentTypeDef.fields.map(field => (
                    <div key={field.key}>
                      <label className="text-[11px] text-gray-400 block mb-1">
                        {field.label} {field.required && <span className="text-red-400">*</span>}
                      </label>
                      {field.type === 'select' ? (
                        <select
                          value={newFormProperties[field.key] || ''}
                          onChange={e => setNewFormProperties(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full px-3 py-1.5 bg-[#121217] border border-[#2c2c3e] rounded-lg text-xs text-white outline-none"
                        >
                          <option value="">Seleccionar...</option>
                          {(field.options || []).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                          value={newFormProperties[field.key] || ''}
                          onChange={e => setNewFormProperties(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.label}
                          className="w-full px-3 py-1.5 bg-[#121217] border border-[#2c2c3e] rounded-lg text-xs text-white outline-none focus:border-emerald-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[#252538]">
              <button
                type="button"
                onClick={() => setIsCreatingObject(false)}
                className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-[#252533] transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-md"
              >
                Crear Objeto
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Constructor de Tipos Personalizados */}
      <CustomTypeBuilderModal
        isOpen={isTypeBuilderOpen}
        onClose={() => setIsTypeBuilderOpen(false)}
        onSave={handleSaveCustomType}
        existingTypes={allTypeDefinitions}
      />

      {/* Modal Ficha Personal Evolutiva (Personas) */}
      {selectedDetailObject && selectedDetailObject.object_type === 'person' && (
        <PersonDetailModal
          person={selectedDetailObject}
          isOpen={true}
          onClose={() => setSelectedDetailObject(null)}
          onUpdate={onUpdateObject}
          onDelete={onDeleteObject}
          projects={projects}
          allPeople={objects.filter(o => o.object_type === 'person')}
          attachments={attachments}
          onAttachmentCreated={onAttachmentCreated}
          onAttachmentDeleted={onAttachmentDeleted}
          notes={notes}
          tasks={tasks}
          onOpenNote={onOpenNote}
          onSelectPerson={(p) => setSelectedDetailObject(p)}
        />
      )}

      {/* Modal Ficha Completa del Objeto (Dossier estándar para otros tipos) */}
      {selectedDetailObject && selectedDetailObject.object_type !== 'person' && (
        <ObjectDetailModal
          object={selectedDetailObject}
          isOpen={true}
          onClose={() => setSelectedDetailObject(null)}
          onUpdate={onUpdateObject}
          onDelete={onDeleteObject}
          projects={projects}
          typeDef={getTypeMeta(selectedDetailObject.object_type)}
          attachments={attachments}
          onAttachmentCreated={onAttachmentCreated}
          onAttachmentDeleted={onAttachmentDeleted}
          notes={notes}
          tasks={tasks}
          onOpenNote={onOpenNote}
        />
      )}
    </div>
  );
};
