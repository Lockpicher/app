import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Phone,
  Paperclip,
  Upload,
  Loader2,
  Music,
  Film,
  FileText,
  Check,
  Cake,
  Star,
  Bookmark,
  Glasses
} from 'lucide-react';
import { AppObject, AppProject, AppAttachment, ObjectTypeDefinition, AppNote, AppTask, AppArea, AppLink, DEFAULT_OBJECT_TYPES } from '../lib/types';
import { EntityAttachmentsSection } from './EntityAttachmentsSection';
import { CustomTypeBuilderModal } from './CustomTypeBuilderModal';
import { ObjectPagePanel } from './ObjectPagePanel';
import { DatePickerInput } from './DatePickerInput';
import { syncPersonBirthdayReminders } from '../lib/birthdays';
import { db } from '../lib/insforge';
import { r2Storage } from '../lib/r2Client';

interface ObjectsViewProps {
  objects: AppObject[];
  projects: AppProject[];
  attachments?: AppAttachment[];
  links?: AppLink[];
  onAttachmentCreated?: (attachment: AppAttachment) => void;
  onAttachmentDeleted?: (id: string, path: string) => void;
  onCreateObject: (obj: Partial<AppObject>) => Promise<void>;
  onUpdateObject: (id: string, updates: Partial<AppObject>) => Promise<void>;
  onDeleteObject: (id: string) => Promise<void>;
  notes?: AppNote[];
  tasks?: AppTask[];
  areas?: AppArea[];
  onOpenNote?: (note: AppNote) => void;
  onNavigateToEntity?: (id: string, type: string) => void;
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
  areas = [],
  links = [],
  onOpenNote,
  onNavigateToEntity,
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

  // Default to compact table ('list') as requested in Phase 5
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'gallery'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLinkId, setFilterLinkId] = useState<string>('all'); // Filter by related entity (e.g. company, project)

  // Book-specific filters and sorting
  const [bookStatusFilter, setBookStatusFilter] = useState<string>('all');
  const [bookGenreFilter, setBookGenreFilter] = useState<string>('all');
  const [bookRatingFilter, setBookRatingFilter] = useState<number>(0);
  const [bookSortBy, setBookSortBy] = useState<'date' | 'title' | 'author' | 'progress' | 'rating'>('date');

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

  // Standard predefined types from centralized system (includes page, person, meeting, resource, book, concept)
  const defaultTypes: ObjectTypeDefinition[] = DEFAULT_OBJECT_TYPES;

  // Global 'N' shortcut when inside ObjectsView
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'n' || e.key === 'N') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        const target = e.target as HTMLElement | null;
        const isInput = target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('.ProseMirror')
        );
        if (!isInput && !isCreatingObject && !selectedDetailObject && !isTypeBuilderOpen) {
          e.preventDefault();
          e.stopPropagation();
          setNewFormProperties({});
          setIsCreatingObject(true);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isCreatingObject, selectedDetailObject, isTypeBuilderOpen]);

  // Combined type definitions
  const allTypeDefinitions: ObjectTypeDefinition[] = [...defaultTypes, ...customTypes];

  // Helper to get active type definition
  const currentTypeDef = allTypeDefinitions.find(t => t.id === newType);

  // File uploading states for New Object creation modal
  const [newUploadedFiles, setNewUploadedFiles] = useState<File[]>([]);
  const [isUploadingNewFiles, setIsUploadingNewFiles] = useState(false);
  const [isUploadingNewCover, setIsUploadingNewCover] = useState(false);
  const newFileInputRef = useRef<HTMLInputElement>(null);
  const newCoverInputRef = useRef<HTMLInputElement>(null);

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

    try {
      setIsUploadingNewFiles(true);

      // Default rich starter content for pages
      const defaultContent = newType === 'page' 
        ? `<h1>${newTitle.trim()}</h1><p>${newDescription.trim() || 'Comienza a escribir tu contenido enriquecido...'}</p>`
        : undefined;

      const payload: Partial<AppObject> = {
        title: newTitle.trim(),
        object_type: newType,
        description: newDescription.trim() || undefined,
        content: defaultContent,
        project_id: newProjectId || undefined,
        thumbnail_url: newThumbnailUrl.trim() || undefined,
        properties: newFormProperties
      };

      const createdObj = await db.createObject(payload);

      if (createdObj) {
        // Upload any pending attached files directly to R2 under this object's folder
        if (newUploadedFiles.length > 0) {
          for (const file of newUploadedFiles) {
            try {
              const res = await r2Storage.uploadFile(file, `objects/${createdObj.id}/attachments`);
              const rec = await db.recordAttachment({
                entity_id: createdObj.id,
                entity_type: 'object',
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
              if (rec && onAttachmentCreated) {
                onAttachmentCreated(rec);
              }
            } catch (attErr) {
              console.warn('Error subiendo archivo adjunto a R2:', attErr);
            }
          }
        }

        // Notify parent state without re-invoking database insert
        if (onCreateObject) {
          await onCreateObject(createdObj);
        }

        // Sync birthday reminders if person
        if (createdObj.object_type === 'person') {
          try {
            await syncPersonBirthdayReminders(createdObj);
          } catch (bdayErr) {
            console.warn('Error sincronizando recordatorios:', bdayErr);
          }
        }

        // Open newly created object detail
        setSelectedDetailObject(createdObj);
      }

      setNewTitle('');
      setNewDescription('');
      setNewThumbnailUrl('');
      setNewFormProperties({});
      setNewUploadedFiles([]);
      setIsCreatingObject(false);
    } catch (err: any) {
      alert('Error al crear el objeto: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsUploadingNewFiles(false);
    }
  };

  // Potential linked entities for filter (Companies, Projects, etc.)
  const filterLinkOptions = [
    ...projects.map(p => ({ id: p.id, title: p.title, type: 'project' as const, label: `Proyecto: ${p.title}` })),
    ...objects.filter(o => o.object_type === 'company').map(c => ({ id: c.id, title: c.title, type: 'company' as const, label: `Empresa: ${c.title}` }))
  ];

  // Available genres from existing book objects
  const availableBookGenres = useMemo(() => {
    const genres = new Set<string>();
    objects.forEach(o => {
      if (o.object_type === 'book') {
        const g = o.properties?.genero || o.properties?.genre;
        if (g && typeof g === 'string' && g.trim()) genres.add(g.trim());
      }
    });
    return Array.from(genres);
  }, [objects]);

  // Currently reading books for quick access banner
  const currentlyReadingBooks = useMemo(() => {
    return objects.filter(o => 
      o.object_type === 'book' && 
      (o.properties?.reading_status === 'reading' || o.properties?.estado_lectura === 'reading')
    );
  }, [objects]);

  // Filter objects by type, search query and related link
  const filteredObjects: AppObject[] = useMemo(() => {
    const result: AppObject[] = objects.filter((obj: AppObject) => {
      // 1. Filter by object type
      if (selectedType !== 'all' && obj.object_type !== selectedType) return false;

      // 2. Filter by specific related link (bidirectional check)
      if (filterLinkId !== 'all') {
        const isDirectlyLinked = links.some(l => 
          (l.from_id === obj.id && l.to_id === filterLinkId) ||
          (l.to_id === obj.id && l.from_id === filterLinkId)
        );
        // Legacy fallback check for project_id
        const isLegacyProjectLinked = obj.project_id === filterLinkId;
        if (!isDirectlyLinked && !isLegacyProjectLinked) return false;
      }

      // 3. Search query: Title, description, properties and related entities titles
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = obj.title.toLowerCase().includes(q);
        const matchDesc = obj.description?.toLowerCase().includes(q);
        const matchProps = JSON.stringify(obj.properties || {}).toLowerCase().includes(q);

        // Also check if any linked entity title matches query (e.g. search "Google" finds people linked to Google)
        const linkedEntityIds = links
          .filter(l => l.from_id === obj.id || l.to_id === obj.id)
          .map(l => l.from_id === obj.id ? l.to_id : l.from_id);
        
        const matchLinkedEntity = objects.some(o => linkedEntityIds.includes(o.id) && o.title.toLowerCase().includes(q)) ||
                                  projects.some(p => (linkedEntityIds.includes(p.id) || obj.project_id === p.id) && p.title.toLowerCase().includes(q));

        if (!matchTitle && !matchDesc && !matchProps && !matchLinkedEntity) return false;
      }

      // 4. Book-specific filters when viewing books
      if (selectedType === 'book') {
        const props = obj.properties || {};
        if (bookStatusFilter !== 'all') {
          const st = props.reading_status || props.estado_lectura || 'want_to_read';
          if (st !== bookStatusFilter) return false;
        }

        if (bookGenreFilter !== 'all') {
          const g = props.genero || props.genre || '';
          if (g !== bookGenreFilter) return false;
        }

        if (bookRatingFilter > 0) {
          const r = Number(props.calificacion || props.rating || 0);
          if (r < bookRatingFilter) return false;
        }
      }

      return true;
    });

    // 5. Book sorting when in books view
    if (selectedType === 'book') {
      result.sort((a, b) => {
        const pA = a.properties || {};
        const pB = b.properties || {};

        if (bookSortBy === 'title') {
          return a.title.localeCompare(b.title);
        } else if (bookSortBy === 'author') {
          const authorA = pA.autor || pA.author || '';
          const authorB = pB.autor || pB.author || '';
          return authorA.localeCompare(authorB);
        } else if (bookSortBy === 'progress') {
          const totalA = Number(pA.total_pages || pA.page_count || 0);
          const currA = Number(pA.current_page || 0);
          const pctA = totalA > 0 ? (currA / totalA) : 0;

          const totalB = Number(pB.total_pages || pB.page_count || 0);
          const currB = Number(pB.current_page || 0);
          const pctB = totalB > 0 ? (currB / totalB) : 0;

          return pctB - pctA;
        } else if (bookSortBy === 'rating') {
          const rA = Number(pA.calificacion || pA.rating || 0);
          const rB = Number(pB.calificacion || pB.rating || 0);
          return rB - rA;
        } else {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      });
    }

    return result;
  }, [objects, selectedType, filterLinkId, searchQuery, links, projects, bookStatusFilter, bookGenreFilter, bookRatingFilter, bookSortBy]);

  const getTypeMeta = (typeId: string) => {
    const def = allTypeDefinitions.find(t => t.id === typeId);
    if (def) return def;
    return { id: typeId, name: typeId, color: '#3b82f6', icon: 'box', fields: [] };
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#16161d] overflow-hidden">
      {/* Top Header */}
      <div className="px-4 sm:px-6 md:px-8 py-3 sm:py-5 pt-[max(0.75rem,env(safe-area-inset-top,0px))] border-b border-[#252530] bg-[#141419] flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <span>Objetos y entidades</span>
          </h2>
          <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
            Dossiers estructurados, entidades de conocimiento, atributos y vínculos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Create Custom Type Button */}
          <button
            onClick={() => setIsTypeBuilderOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#1e1e2c] hover:bg-[#28283a] text-blue-300 border border-blue-500/30 transition shadow-sm"
            title="Crear tu propia plantilla de entidad"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Crear plantilla</span>
          </button>

          {/* New Object Button */}
          <button
            onClick={() => {
              setNewFormProperties({});
              setIsCreatingObject(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm whitespace-nowrap active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo objeto</span>
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
        <div className="flex items-center gap-2.5 flex-shrink-0 self-end md:self-auto flex-wrap">
          {/* Link Filter (e.g. "todo lo relacionado con [empresa o proyecto]") */}
          {filterLinkOptions.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#1a1a24] border border-[#2b2b3a] rounded-xl px-2.5 py-1 text-xs text-gray-300">
              <LinkIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <select
                value={filterLinkId}
                onChange={e => setFilterLinkId(e.target.value)}
                className="bg-transparent text-xs text-white outline-none cursor-pointer max-w-[130px] sm:max-w-[170px] truncate"
              >
                <option value="all">Todos los vínculos</option>
                {filterLinkOptions.map(opt => (
                  <option key={opt.id} value={opt.id} className="bg-[#181824] text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
              {filterLinkId !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFilterLinkId('all')}
                  className="text-gray-400 hover:text-white p-0.5 rounded text-[11px]"
                  title="Limpiar filtro de vínculo"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por texto o vínculo..."
              className="pl-8 pr-3 py-1.5 bg-[#1a1a24] border border-[#2b2b3a] rounded-xl text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500 w-40 sm:w-56 transition"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#181822] border border-[#29293a] rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg ${viewMode === 'list' ? 'bg-blue-600/30 text-white border border-blue-500/40' : 'text-gray-400 hover:text-gray-200'}`}
              title="Vista de Tabla (Predeterminada)"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg ${viewMode === 'grid' ? 'bg-blue-600/30 text-white border border-blue-500/40' : 'text-gray-400 hover:text-gray-200'}`}
              title="Vista de Tarjetas Compactas"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('gallery')}
              className={`p-1.5 rounded-lg ${viewMode === 'gallery' ? 'bg-blue-600/30 text-white border border-blue-500/40' : 'text-gray-400 hover:text-gray-200'}`}
              title="Vista de Galería Visual"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Book-Specific Library Filter & Sort Toolbar */}
      {selectedType === 'book' && (
        <div className="px-4 sm:px-6 md:px-8 py-2.5 bg-[#101015] border-b border-[#20202c] flex items-center justify-between gap-3 flex-wrap animate-fadeIn">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mr-1 flex items-center gap-1">
              <Glasses className="w-3.5 h-3.5 text-purple-400" />
              <span>Estado:</span>
            </span>

            {[
              { id: 'all', label: 'Todos' },
              { id: 'reading', label: 'Leyendo' },
              { id: 'want_to_read', label: 'Por Leer' },
              { id: 'paused', label: 'Pausados' },
              { id: 'finished', label: 'Terminados' },
              { id: 'abandoned', label: 'Abandonados' }
            ].map(st => (
              <button
                key={st.id}
                type="button"
                onClick={() => setBookStatusFilter(st.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  bookStatusFilter === st.id
                    ? 'bg-purple-600 text-white shadow-sm font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Genre Filter */}
            {availableBookGenres.length > 0 && (
              <select
                value={bookGenreFilter}
                onChange={e => setBookGenreFilter(e.target.value)}
                className="bg-[#181824] border border-[#2c2c3d] rounded-lg px-2.5 py-1 text-xs text-gray-300 outline-none cursor-pointer"
              >
                <option value="all">Todos los géneros</option>
                {availableBookGenres.map((g: string) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            )}

            {/* Rating Filter */}
            <select
              value={bookRatingFilter}
              onChange={e => setBookRatingFilter(Number(e.target.value))}
              className="bg-[#181824] border border-[#2c2c3d] rounded-lg px-2.5 py-1 text-xs text-gray-300 outline-none cursor-pointer"
            >
              <option value={0}>Todas las calificaciones</option>
              <option value={5}>⭐⭐⭐⭐⭐ (5 estrellas)</option>
              <option value={4}>⭐⭐⭐⭐ (4+ estrellas)</option>
              <option value={3}>⭐⭐⭐ (3+ estrellas)</option>
            </select>

            {/* Sort by */}
            <select
              value={bookSortBy}
              onChange={e => setBookSortBy(e.target.value as any)}
              className="bg-[#181824] border border-purple-500/40 rounded-lg px-2.5 py-1 text-xs text-purple-300 outline-none cursor-pointer font-medium"
            >
              <option value="date">Más recientes</option>
              <option value="title">Título (A-Z)</option>
              <option value="author">Autor</option>
              <option value="progress">Mayor progreso (%)</option>
              <option value="rating">Mayor calificación</option>
            </select>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        {/* Prominent "Leyendo Actualmente" Quick Banner */}
        {selectedType === 'book' && currentlyReadingBooks.length > 0 && (
          <div className="mb-6 bg-gradient-to-r from-purple-950/40 via-[#181828] to-[#12121a] border border-purple-500/30 rounded-2xl p-4 sm:p-5 shadow-lg animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-purple-400" />
                <span>Leyendo actualmente ({currentlyReadingBooks.length})</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentlyReadingBooks.map((book: AppObject) => {
                const bProps = book.properties || {};
                const bTotal = Number(bProps.total_pages || bProps.page_count || 0);
                const bCurrent = Number(bProps.current_page || 0);
                const bPct = bTotal > 0 ? Math.min(100, Math.round((bCurrent / bTotal) * 100)) : 0;
                const bAuthor = bProps.autor || bProps.author || '';

                return (
                  <div
                    key={book.id}
                    onClick={() => setSelectedDetailObject(book)}
                    className="p-3 bg-[#13131e] border border-[#28283e] hover:border-purple-500/60 rounded-xl transition cursor-pointer flex items-center gap-3 group"
                  >
                    <div className="w-12 h-16 rounded-md overflow-hidden bg-purple-950 flex-shrink-0 border border-white/10 shadow">
                      {book.thumbnail_url ? (
                        <img src={book.thumbnail_url} alt={book.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-purple-950 flex items-center justify-center text-[10px] font-bold text-white p-1 text-center font-serif">
                          {book.title.slice(0, 3)}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition">
                        {book.title}
                      </h4>
                      {bAuthor && (
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">{bAuthor}</p>
                      )}

                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                          <span>{bPct}%</span>
                          <span>{bCurrent} / {bTotal || '?'} págs.</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#252536] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-purple-500 to-emerald-400" style={{ width: `${bPct}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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

              // Special Card Representation for Books
              if (obj.object_type === 'book') {
                const bookAuthor = props.autor || props.author || '';
                const bookStatus = props.reading_status || props.estado_lectura || 'want_to_read';
                const bookRating = Number(props.calificacion || props.rating || 0);
                const bookTotal = Number(props.total_pages || props.page_count || 0);
                const bookCurrent = Number(props.current_page || 0);
                const bookPct = bookTotal > 0 ? Math.min(100, Math.round((bookCurrent / bookTotal) * 100)) : 0;
                const bookFormat = props.formato || props.format || 'physical';
                const hasPdf = Boolean(props.main_pdf_url || props.pdf_url);

                const statusLabel = 
                  bookStatus === 'reading' ? 'Leyendo' :
                  bookStatus === 'finished' ? 'Terminado' :
                  bookStatus === 'paused' ? 'Pausado' :
                  bookStatus === 'abandoned' ? 'Abandonado' : 'Por Leer';

                const statusColor = 
                  bookStatus === 'reading' ? 'bg-amber-950/60 text-amber-300 border-amber-800/40' :
                  bookStatus === 'finished' ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40' :
                  bookStatus === 'paused' ? 'bg-gray-800/60 text-gray-300 border-gray-700/40' :
                  bookStatus === 'abandoned' ? 'bg-red-950/60 text-red-300 border-red-800/40' :
                  'bg-blue-950/60 text-blue-300 border-blue-800/40';

                return (
                  <div
                    key={obj.id}
                    onClick={() => setSelectedDetailObject(obj)}
                    className="bg-[#191924] rounded-2xl border border-[#28283a] hover:border-purple-500/50 transition-all duration-200 p-4 flex flex-col justify-between shadow-sm cursor-pointer group hover:shadow-xl relative overflow-hidden select-none min-h-[290px] max-h-[360px]"
                  >
                    <div className="overflow-hidden flex-1 flex flex-col">
                      {/* Top Header: Badge & Actions */}
                      <div className="flex items-center justify-between gap-1.5 mb-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border flex items-center gap-1 ${statusColor}`}>
                            <BookOpen className="w-2.5 h-2.5" />
                            <span>{statusLabel}</span>
                          </span>

                          {hasPdf && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-purple-950/50 text-purple-300 border border-purple-800/40">
                              PDF
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedDetailObject(obj)}
                            className="p-1 rounded bg-[#20202e] hover:bg-[#2b2b3e] text-purple-300 transition"
                            title="Ver Ficha del Libro"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`¿Eliminar libro "${obj.title}"?`)) {
                                onDeleteObject(obj.id);
                              }
                            }}
                            className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition"
                            title="Eliminar libro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Book Cover + Title + Author Layout */}
                      <div className="flex gap-3 mb-2.5">
                        <div className="w-16 h-24 rounded-lg overflow-hidden bg-purple-950 border border-white/10 shadow flex-shrink-0 relative group-hover:scale-105 transition-transform duration-200">
                          {obj.thumbnail_url ? (
                            <img src={obj.thumbnail_url} alt={obj.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-purple-900 to-[#12121e] flex flex-col justify-between p-1.5 text-center border-l-2 border-l-amber-500/70">
                              <span className="text-[7px] text-amber-300/80 uppercase font-mono block">Libro</span>
                              <p className="font-serif font-bold text-[9px] text-white leading-tight line-clamp-3">
                                {obj.title}
                              </p>
                              <span className="text-[7px] text-gray-400 truncate block">
                                {bookAuthor || '—'}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          <div>
                            <h3 className="font-bold text-sm text-white group-hover:text-purple-300 transition line-clamp-2 leading-tight font-serif">
                              {obj.title}
                            </h3>
                            {bookAuthor && (
                              <p className="text-[11px] text-gray-400 truncate mt-1">
                                {bookAuthor}
                              </p>
                            )}
                          </div>

                          {/* Rating Stars */}
                          {bookRating > 0 && (
                            <div className="flex items-center gap-0.5 text-amber-400 mt-1">
                              {[...Array(bookRating)].map((_, i) => (
                                <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Reading Progress */}
                      <div className="mt-auto bg-[#14141d] border border-[#242436] rounded-xl p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                          <span>Progreso</span>
                          <span className="text-purple-300 font-bold">{bookPct}% ({bookCurrent}/{bookTotal || '?'} págs.)</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#252536] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 transition-all duration-300"
                            style={{ width: `${bookPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="pt-2 border-t border-[#232332] flex items-center justify-between text-xs text-gray-400 mt-2 flex-shrink-0">
                      <span className="text-[10px] text-gray-500 capitalize">{bookFormat}</span>
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
          /* List View: Compact Structured Table (Default) */
          <div className="bg-[#181822] rounded-2xl border border-[#28283a] overflow-x-auto shadow-sm">
            <table className="w-full text-left text-xs min-w-[620px]">
              <thead className="bg-[#13131c] text-gray-400 font-medium border-b border-[#242436]">
                <tr>
                  <th className="py-3.5 px-4 font-semibold text-gray-300">Entidad / Nombre</th>
                  <th className="py-3.5 px-3 font-semibold text-gray-300">Tipo</th>
                  <th className="py-3.5 px-3 font-semibold text-gray-300">Vínculos principales</th>
                  <th className="py-3.5 px-3 font-semibold text-gray-300">Propiedades clave</th>
                  <th className="py-3.5 px-3 font-semibold text-gray-300">Fecha</th>
                  <th className="py-3.5 px-4 text-right font-semibold text-gray-300">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222232]">
                {filteredObjects.map(obj => {
                  const typeMeta = getTypeMeta(obj.object_type);
                  const props = obj.properties || {};

                  // Related entities from links
                  const relatedEntityIds = links
                    .filter(l => l.from_id === obj.id || l.to_id === obj.id)
                    .map(l => l.from_id === obj.id ? l.to_id : l.from_id);

                  const relatedEntities = [
                    ...objects.filter(o => relatedEntityIds.includes(o.id)).map(o => ({ id: o.id, title: o.title, type: 'object' })),
                    ...projects.filter(p => relatedEntityIds.includes(p.id) || obj.project_id === p.id).map(p => ({ id: p.id, title: p.title, type: 'project' }))
                  ];

                  // Key property chips based on type
                  const relevantProps = Object.entries(props).filter(([k, v]) => {
                    if (['subtitle', 'is_pinned', 'thumbnail_url', 'cover_url'].includes(k)) return false;
                    return v !== undefined && v !== null && String(v).trim() !== '';
                  }).slice(0, 2);

                  return (
                    <tr 
                      key={obj.id}
                      onClick={() => setSelectedDetailObject(obj)}
                      className="hover:bg-[#1f1f2e] cursor-pointer transition min-h-[56px] group"
                    >
                      <td className="py-3 px-4 min-h-[56px]">
                        <div className="flex items-center gap-3">
                          {obj.thumbnail_url ? (
                            <img 
                              src={obj.thumbnail_url} 
                              alt="" 
                              className="w-9 h-9 rounded-xl object-cover border border-[#2a2a3e] flex-shrink-0" 
                            />
                          ) : (
                            <div 
                              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 border"
                              style={{ 
                                backgroundColor: `${typeMeta.color}18`, 
                                color: typeMeta.color,
                                borderColor: `${typeMeta.color}35`
                              }}
                            >
                              {obj.title.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-semibold text-white group-hover:text-blue-400 transition block truncate text-sm">
                              {obj.title}
                            </span>
                            {obj.description && (
                              <span className="text-[11px] text-gray-400 truncate max-w-xs block mt-0.5">
                                {obj.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span 
                          className="text-[10px] px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1 border"
                          style={{ 
                            backgroundColor: `${typeMeta.color}15`, 
                            color: typeMeta.color,
                            borderColor: `${typeMeta.color}30`
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: typeMeta.color }} />
                          <span>{typeMeta.name}</span>
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {relatedEntities.length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                            {relatedEntities.slice(0, 2).map(r => (
                              <span 
                                key={r.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onNavigateToEntity) onNavigateToEntity(r.id, r.type);
                                }}
                                className="text-[11px] px-2 py-0.5 rounded-lg bg-[#14141c] hover:bg-[#1b1b26] text-blue-300 border border-[#262638] flex items-center gap-1 truncate max-w-[140px] transition"
                              >
                                <LinkIcon className="w-2.5 h-2.5 flex-shrink-0" />
                                <span className="truncate">{r.title}</span>
                              </span>
                            ))}
                            {relatedEntities.length > 2 && (
                              <span className="text-[10px] text-gray-500 font-mono">
                                +{relatedEntities.length - 2}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-gray-400">
                        {obj.object_type === 'book' ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            {(props.autor || props.author) && (
                              <span className="text-[11px] bg-[#14141c] px-2 py-0.5 rounded-lg border border-[#232332] text-gray-300">
                                <span className="text-gray-500 mr-1">Autor:</span>
                                {props.autor || props.author}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 bg-[#14141c] px-2 py-0.5 rounded-lg border border-[#232332]">
                              <span className="text-[10px] font-mono text-purple-300">
                                {props.total_pages ? `${Math.round(((props.current_page || 0) / props.total_pages) * 100)}%` : `${props.current_page || 0} págs.`}
                              </span>
                              <div className="w-12 h-1 bg-[#252536] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-purple-500"
                                  style={{ width: `${props.total_pages ? Math.min(100, Math.round(((props.current_page || 0) / props.total_pages) * 100)) : 0}%` }}
                                />
                              </div>
                            </div>
                            {Number(props.calificacion || props.rating || 0) > 0 && (
                              <span className="text-[11px] text-amber-400 font-mono">
                                {'★'.repeat(Number(props.calificacion || props.rating || 0))}
                              </span>
                            )}
                          </div>
                        ) : relevantProps.length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap max-w-sm">
                            {relevantProps.map(([k, v]) => (
                              <span key={k} className="text-[11px] bg-[#14141c] px-2 py-0.5 rounded-lg border border-[#232332]">
                                <span className="text-gray-400 mr-1 capitalize">{k.replace('_', ' ')}:</span>
                                <span className="text-gray-200 font-medium">{String(v)}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-600 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-[11px] text-gray-400 font-mono">
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
                          className="p-2 text-gray-400 hover:text-red-400 transition rounded-lg hover:bg-red-950/30"
                          title="Eliminar objeto"
                          aria-label="Eliminar objeto"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Modal Creación Rápida de Objeto (Estilo Capacities/Obsidian) */}
      {isCreatingObject && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-50"
          onClick={() => setIsCreatingObject(false)}
        >
          <form 
            onSubmit={handleCreateSubmit} 
            onClick={e => e.stopPropagation()}
            className="bg-[#181824] border border-[#2c2c3e] rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#252538]">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Boxes className="w-4 h-4 text-blue-400" />
                <span>Nuevo objeto</span>
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
              <label className="text-xs text-gray-400 font-medium block mb-1.5">
                Tipo de objeto
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
                {allTypeDefinitions.map(t => {
                  const isSelected = newType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setNewType(t.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium border text-left transition ${
                        isSelected
                          ? 'bg-blue-600/20 text-white border-blue-500/60'
                          : 'bg-[#14141c] text-gray-300 border-[#232332] hover:bg-[#1f1f2d]'
                      }`}
                    >
                      <span 
                        className="w-2 h-2 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: t.color || '#3b82f6' }} 
                      />
                      <span className="truncate">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title / Name (Required) */}
            <div>
              <label className="text-xs text-gray-400 font-medium block mb-1.5">
                Nombre o título *
              </label>
              <input
                type="text"
                autoFocus
                required
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Ej. Carlos Mendoza, Reunión de Sprint, Clean Code..."
                className="w-full px-3.5 py-2.5 bg-[#121218] border border-[#2a2a3c] rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Description (Optional) */}
            <div>
              <label className="text-xs text-gray-400 font-medium block mb-1.5">
                Descripción corta <span className="text-gray-500 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="Breve contexto..."
                className="w-full px-3.5 py-2 bg-[#121218] border border-[#2a2a3c] rounded-xl text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Selector de Cumpleaños interactivo para Personas */}
            {newType === 'person' && (
              <div>
                <label className="text-xs text-amber-300 font-semibold block mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Cake className="w-3.5 h-3.5 text-amber-400" />
                    <span>Fecha de Cumpleaños</span>
                  </span>
                  <span className="text-[10px] text-gray-400 font-normal">(Elegir en calendario)</span>
                </label>
                <DatePickerInput
                  value={newFormProperties.birthday || ''}
                  onChange={(dateStr) => {
                    setNewFormProperties(prev => ({
                      ...prev,
                      birthday: dateStr,
                      cumpleanos: dateStr
                    }));
                  }}
                  isBirthday={true}
                  placeholder="Toca para elegir fecha en calendario..."
                />
              </div>
            )}

            <p className="text-[11px] text-gray-400 leading-relaxed pt-1">
              Las propiedades, portada, adjuntos en R2 y vínculos se completan al abrir el panel del objeto.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#232332]">
              <button
                type="button"
                onClick={() => setIsCreatingObject(false)}
                className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-[#20202c] transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isUploadingNewFiles || !newTitle.trim()}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                {isUploadingNewFiles ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Creando...</span>
                  </>
                ) : (
                  <span>Crear objeto</span>
                )}
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

      {/* Página/Panel Unificado del Objeto (Estilo Capacities & Obsidian) */}
      {selectedDetailObject && (
        <ObjectPagePanel
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
          allObjects={objects}
          areas={areas}
          customTypes={customTypes}
          onOpenNote={onOpenNote}
          onNavigateToObject={(o) => setSelectedDetailObject(o)}
          onNavigateToEntity={onNavigateToEntity}
        />
      )}
    </div>
  );
};
