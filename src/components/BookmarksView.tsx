import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bookmark,
  Plus,
  Search,
  ExternalLink,
  Copy,
  Check,
  Star,
  Pin,
  Trash2,
  Edit2,
  FolderPlus,
  Folder,
  Globe,
  Tag,
  Grid,
  List,
  Sparkles,
  RefreshCw,
  X,
  ChevronDown,
  Layers,
  Code,
  BookOpen,
  Heart,
  Compass,
  ArrowUpDown,
  MoreVertical
} from 'lucide-react';
import { AppBookmark, AppBookmarkCollection, AppNote } from '../lib/types';
import { db } from '../lib/insforge';

interface BookmarksViewProps {
  bookmarks: AppBookmark[];
  notes: AppNote[];
  openCreateOnMount?: boolean;
  quickCreateUrl?: string;
  onQuickCreateConsumed?: () => void;
  collections: AppBookmarkCollection[];
  onBookmarkCreated: (bookmark: AppBookmark) => void;
  onBookmarkUpdated: (bookmark: AppBookmark) => void;
  onBookmarkDeleted: (id: string) => void;
  onCollectionCreated: (collection: AppBookmarkCollection) => void;
  onCollectionUpdated: (collection: AppBookmarkCollection) => void;
  onCollectionDeleted: (id: string) => void;
}

const RESOURCE_TYPES = [
  { value: 'article', label: 'Artículo' },
  { value: 'video', label: 'Vídeo' },
  { value: 'tool', label: 'Herramienta' },
  { value: 'documentation', label: 'Documentación' },
  { value: 'repository', label: 'Repositorio' },
  { value: 'course', label: 'Curso' },
  { value: 'product', label: 'Producto' },
  { value: 'other', label: 'Otro' }
] as const;
const RESOURCE_STATUSES = [
  { value: 'unread', label: 'Pendiente' },
  { value: 'reading', label: 'En revisión' },
  { value: 'read', label: 'Leído' },
  { value: 'reference', label: 'Referencia' },
  { value: 'archived', label: 'Archivado' }
] as const;
const TYPE_TAG_PREFIX = '__resource_type:';
const STATUS_TAG_PREFIX = '__resource_status:';
const getResourceMeta = (tags: string[] | undefined, prefix: string, fallback: string) =>
  tags?.find(tag => tag.startsWith(prefix))?.slice(prefix.length) || fallback;
const getVisibleTags = (tags: string[] | undefined) =>
  (tags || []).filter(tag => !tag.startsWith(TYPE_TAG_PREFIX) && !tag.startsWith(STATUS_TAG_PREFIX));
const normalizeBookmarkUrl = (value: string) => {
  try {
    const url = new URL(value);
    url.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].forEach(key => url.searchParams.delete(key));
    url.hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    return url.toString().replace(/\/$/, '');
  } catch { return value.trim().replace(/\/$/, '').toLowerCase(); }
};
const expandResourceQuery = (query: string) => {
  const normalized = query.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const groups: Record<string, string[]> = {
    r2: ['cloudflare', 'storage', 'almacenamiento', 'bucket', 'archivos'],
    almacenamiento: ['storage', 'r2', 's3', 'cloudflare', 'archivos', 'bucket'],
    archivos: ['files', 'storage', 'almacenamiento', 'r2'],
    repositorio: ['github', 'gitlab', 'codigo', 'source', 'repo'],
    codigo: ['github', 'gitlab', 'repositorio', 'programacion'],
    tutorial: ['guia', 'curso', 'video', 'aprendizaje'],
    automatizacion: ['n8n', 'workflow', 'flujo', 'integracion'],
    ia: ['inteligencia artificial', 'ai', 'modelo', 'llm', 'gemini'],
    diseno: ['design', 'ux', 'ui', 'interfaz']
  };
  const stopWords = new Set(['para', 'como', 'este', 'esta', 'sobre', 'desde', 'donde', 'cuando', 'que', 'con', 'una', 'por']);
  const terms = new Set([normalized, ...normalized.split(/\s+/).filter(term => term.length > 2 && !stopWords.has(term))]);
  Object.entries(groups).forEach(([key, values]) => {
    if (normalized.includes(key) || values.some(value => normalized.includes(value))) {
      terms.add(key);
      values.forEach(value => terms.add(value));
    }
  });
  return Array.from(terms).filter(term => term.length > 2);
};

const PRESET_COLORS = [
  '#3b82f6', // Azul
  '#8b5cf6', // Púrpura
  '#ec4899', // Rosa
  '#10b981', // Esmeralda
  '#06b6d4', // Cian
  '#f59e0b', // Ámbar
  '#ef4444', // Rojo
  '#6366f1', // Índigo
  '#64748b'  // Pizarra
];

const PRESET_ICONS = [
  { name: 'Bookmark', icon: Bookmark, label: 'Marcador' },
  { name: 'Folder', icon: Folder, label: 'Carpeta' },
  { name: 'Globe', icon: Globe, label: 'Web' },
  { name: 'Sparkles', icon: Sparkles, label: 'Destacado' },
  { name: 'Code', icon: Code, label: 'Código' },
  { name: 'BookOpen', icon: BookOpen, label: 'Lectura' },
  { name: 'Layers', icon: Layers, label: 'Recursos' },
  { name: 'Heart', icon: Heart, label: 'Favorito' },
  { name: 'Compass', icon: Compass, label: 'Explorar' }
];

export const BookmarksView: React.FC<BookmarksViewProps> = ({
  bookmarks,
  notes,
  collections,
  onBookmarkCreated,
  onBookmarkUpdated,
  onBookmarkDeleted,
  onCollectionCreated,
  onCollectionUpdated,
  onCollectionDeleted,
  openCreateOnMount = false,
  quickCreateUrl = '',
  onQuickCreateConsumed
}) => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all'); // 'all', 'favorites', 'pinned', 'unorganized', or collection.id
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<AppBookmark | null>(null);
  const [editingCollection, setEditingCollection] = useState<AppBookmarkCollection | null>(null);

  // Bookmark Form State
  const [formUrl, setFormUrl] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCoverImage, setFormCoverImage] = useState('');
  const [formFavicon, setFormFavicon] = useState('');
  const [formSiteName, setFormSiteName] = useState('');
  const [formCollectionId, setFormCollectionId] = useState<string>('');
  const [formTags, setFormTags] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIsFavorite, setFormIsFavorite] = useState(false);
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formResourceType, setFormResourceType] = useState<string>('other');
  const [formResourceStatus, setFormResourceStatus] = useState<string>('unread');
  const [formEntityId, setFormEntityId] = useState<string>('');
  const [activeResourceType, setActiveResourceType] = useState('all');
  const [activeResourceStatus, setActiveResourceStatus] = useState('all');
  const [isExtractingMetadata, setIsExtractingMetadata] = useState(false);
  const [isSavingBookmark, setIsSavingBookmark] = useState(false);

  // Collection Form State
  const [collectionName, setCollectionName] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [collectionColor, setCollectionColor] = useState('#3b82f6');
  const [collectionIcon, setCollectionIcon] = useState('Bookmark');
  const [isSavingCollection, setIsSavingCollection] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyUrl = (url: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    showToast('¡Enlace copiado al portapapeles!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open Bookmark Modal
  const handleOpenNewBookmarkModal = (targetCollectionId?: string) => {
    setEditingBookmark(null);
    setFormUrl('');
    setFormTitle('');
    setFormDescription('');
    setFormCoverImage('');
    setFormFavicon('');
    setFormSiteName('');
    setFormCollectionId(targetCollectionId || (activeTab !== 'all' && activeTab !== 'favorites' && activeTab !== 'pinned' && activeTab !== 'unorganized' ? activeTab : ''));
    setFormTags('');
    setFormNotes('');
    setFormIsFavorite(false);
    setFormIsPinned(false);
    setFormResourceType('other');
    setFormResourceStatus('unread');
    setFormEntityId('');
    setIsBookmarkModalOpen(true);
  };

  const handleOpenEditBookmarkModal = (bm: AppBookmark, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingBookmark(bm);
    setFormUrl(bm.url);
    setFormTitle(bm.title);
    setFormDescription(bm.description || '');
    setFormCoverImage(bm.cover_image_url || '');
    setFormFavicon(bm.favicon_url || '');
    setFormSiteName(bm.site_name || '');
    setFormCollectionId(bm.collection_id || '');
    setFormTags(getVisibleTags(bm.tags).join(', '));
    setFormNotes(bm.notes || '');
    setFormIsFavorite(Boolean(bm.is_favorite));
    setFormIsPinned(Boolean(bm.is_pinned));
    setFormResourceType(getResourceMeta(bm.tags, TYPE_TAG_PREFIX, 'other'));
    setFormResourceStatus(getResourceMeta(bm.tags, STATUS_TAG_PREFIX, 'unread'));
    setFormEntityId(bm.entity_type === 'note' ? bm.entity_id || '' : '');
    setIsBookmarkModalOpen(true);
  };

  useEffect(() => {
    if (openCreateOnMount) {
      handleOpenNewBookmarkModal();
      if (quickCreateUrl) setFormUrl(quickCreateUrl);
      onQuickCreateConsumed?.();
    }
  }, [openCreateOnMount]);

  // Open Collection Modal
  const handleOpenNewCollectionModal = () => {
    setEditingCollection(null);
    setCollectionName('');
    setCollectionDescription('');
    setCollectionColor('#3b82f6');
    setCollectionIcon('Bookmark');
    setIsCollectionModalOpen(true);
  };

  const handleOpenEditCollectionModal = (col: AppBookmarkCollection, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCollection(col);
    setCollectionName(col.name);
    setCollectionDescription(col.description || '');
    setCollectionColor(col.color || '#3b82f6');
    setCollectionIcon(col.icon || 'Bookmark');
    setIsCollectionModalOpen(true);
  };

  // Auto-extract metadata from URL
  const handleUrlBlur = async () => {
    const trimmed = formUrl.trim();
    if (!trimmed || !trimmed.startsWith('http')) return;
    if (formResourceType === 'other') {
      try {
        const host = new URL(trimmed).hostname.toLowerCase();
        if (/youtube|youtu\.be|vimeo|tiktok/.test(host)) setFormResourceType('video');
        else if (/github|gitlab|bitbucket/.test(host)) setFormResourceType('repository');
        else if (/docs\.|developer\.|readthedocs|devdocs/.test(host)) setFormResourceType('documentation');
        else if (/coursera|udemy|edx|platzi/.test(host)) setFormResourceType('course');
        else if (/producthunt|alternativeto/.test(host)) setFormResourceType('tool');
        else setFormResourceType('article');
      } catch {}
    }
    if (formTitle && !editingBookmark) return; // Ya tiene título

    try {
      setIsExtractingMetadata(true);
      const res = await fetch('/api/web-scraper/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.title && !formTitle) setFormTitle(data.title);
        if (data.description && !formDescription) setFormDescription(data.description);
        if (data.coverImage && !formCoverImage) setFormCoverImage(data.coverImage);
        if (data.favicon && !formFavicon) setFormFavicon(data.favicon);
        if (data.siteName && !formSiteName) setFormSiteName(data.siteName);
      } else {
        // Fallback básico si falla el scraper
        try {
          const parsed = new URL(trimmed);
          if (!formTitle) setFormTitle(parsed.hostname.replace(/^www\./, ''));
          if (!formSiteName) setFormSiteName(parsed.hostname.replace(/^www\./, ''));
          if (!formFavicon) setFormFavicon(`https://${parsed.host}/favicon.ico`);
        } catch {}
      }
    } catch {
      try {
        const parsed = new URL(trimmed);
        if (!formTitle) setFormTitle(parsed.hostname.replace(/^www\./, ''));
        if (!formSiteName) setFormSiteName(parsed.hostname.replace(/^www\./, ''));
        if (!formFavicon) setFormFavicon(`https://${parsed.host}/favicon.ico`);
      } catch {}
    } finally {
      setIsExtractingMetadata(false);
    }
  };

  // Save Bookmark
  const handleSaveBookmark = async () => {
    let url = formUrl.trim();
    if (!url) {
      showToast('Por favor introduce una URL válida');
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const title = formTitle.trim() || url;
    const tagsArray = [
      ...formTags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean),
      `${TYPE_TAG_PREFIX}${formResourceType}`,
      `${STATUS_TAG_PREFIX}${formResourceStatus}`
    ];

    try {
      if (!editingBookmark) {
        const duplicate = bookmarks.find(item => normalizeBookmarkUrl(item.url) === normalizeBookmarkUrl(url));
        if (duplicate) {
          handleOpenEditBookmarkModal(duplicate);
          showToast('Este recurso ya existe. Abrí el registro guardado para actualizarlo.');
          return;
        }
      }
      setIsSavingBookmark(true);
      const payload: Partial<AppBookmark> = {
        collection_id: formCollectionId || null,
        url,
        title,
        description: formDescription.trim() || undefined,
        cover_image_url: formCoverImage.trim() || undefined,
        favicon_url: formFavicon.trim() || undefined,
        site_name: formSiteName.trim() || undefined,
        tags: tagsArray,
        is_favorite: formIsFavorite,
        is_pinned: formIsPinned,
        notes: formNotes.trim() || undefined,
        entity_id: formEntityId || undefined,
        entity_type: formEntityId ? 'note' : undefined
      };

      if (editingBookmark) {
        const updated = await db.updateBookmark(editingBookmark.id, payload);
        if (updated) {
          onBookmarkUpdated(updated);
          showToast('¡Enlace actualizado con éxito!');
        }
      } else {
        const created = await db.createBookmark(payload);
        if (created) {
          onBookmarkCreated(created);
          showToast('¡Enlace guardado con éxito!');
        }
      }
      setIsBookmarkModalOpen(false);
    } catch (err: any) {
      showToast('Error al guardar: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSavingBookmark(false);
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = async (bm: AppBookmark, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await db.updateBookmark(bm.id, { is_favorite: !bm.is_favorite });
      if (updated) {
        onBookmarkUpdated(updated);
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  // Toggle Pin
  const handleTogglePin = async (bm: AppBookmark, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = await db.updateBookmark(bm.id, { is_pinned: !bm.is_pinned });
      if (updated) {
        onBookmarkUpdated(updated);
      }
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  };

  // Delete Bookmark
  const handleDeleteBookmark = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('¿Seguro que deseas eliminar este enlace?')) return;
    try {
      const ok = await db.deleteBookmark(id);
      if (ok) {
        onBookmarkDeleted(id);
        showToast('Enlace eliminado');
      }
    } catch (err: any) {
      showToast('Error al eliminar: ' + err.message);
    }
  };

  // Save Collection
  const handleSaveCollection = async () => {
    const name = collectionName.trim();
    if (!name) {
      showToast('Por favor escribe un nombre para el cuaderno');
      return;
    }

    try {
      setIsSavingCollection(true);
      if (editingCollection) {
        const updated = await db.updateBookmarkCollection(editingCollection.id, {
          name,
          description: collectionDescription.trim() || undefined,
          color: collectionColor,
          icon: collectionIcon
        });
        if (updated) {
          onCollectionUpdated(updated);
          showToast('¡Cuaderno actualizado!');
        }
      } else {
        const created = await db.createBookmarkCollection({
          name,
          description: collectionDescription.trim() || undefined,
          color: collectionColor,
          icon: collectionIcon
        });
        if (created) {
          onCollectionCreated(created);
          showToast('¡Cuaderno de enlaces creado!');
          setActiveTab(created.id);
        }
      }
      setIsCollectionModalOpen(false);
    } catch (err: any) {
      showToast('Error al guardar cuaderno: ' + err.message);
    } finally {
      setIsSavingCollection(false);
    }
  };

  // Delete Collection
  const handleDeleteCollection = async (col: AppBookmarkCollection, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar el cuaderno "${col.name}"? Los enlaces quedarán sin cuaderno pero no se borrarán.`)) return;
    try {
      const ok = await db.deleteBookmarkCollection(col.id);
      if (ok) {
        onCollectionDeleted(col.id);
        if (activeTab === col.id) setActiveTab('all');
        showToast('Cuaderno eliminado');
      }
    } catch (err: any) {
      showToast('Error eliminando cuaderno: ' + err.message);
    }
  };

  // Helper map of collections
  const collectionMap = useMemo(() => {
    const map = new Map<string, AppBookmarkCollection>();
    collections.forEach(c => map.set(c.id, c));
    return map;
  }, [collections]);

  // All Unique Tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    bookmarks.forEach(bm => {
      getVisibleTags(bm.tags).forEach(tag => set.add(tag));
    });
    return Array.from(set).sort();
  }, [bookmarks]);

  // Filtering
  const filteredBookmarks = useMemo(() => {
    const queryTerms = searchQuery.trim() ? expandResourceQuery(searchQuery) : [];
    return bookmarks.filter(bm => {
      if (activeTab === 'favorites' && !bm.is_favorite) return false;
      if (activeTab === 'pinned' && !bm.is_pinned) return false;
      if (activeTab === 'unorganized' && bm.collection_id) return false;
      if (activeTab !== 'all' && activeTab !== 'favorites' && activeTab !== 'pinned' && activeTab !== 'unorganized' && bm.collection_id !== activeTab) return false;
      if (selectedTag && !getVisibleTags(bm.tags).includes(selectedTag)) return false;
      if (activeResourceType !== 'all' && getResourceMeta(bm.tags, TYPE_TAG_PREFIX, 'other') !== activeResourceType) return false;
      if (activeResourceStatus !== 'all' && getResourceMeta(bm.tags, STATUS_TAG_PREFIX, 'unread') !== activeResourceStatus) return false;
      if (queryTerms.length) {
        const linkedNote = bm.entity_type === 'note' ? notes.find(note => note.id === bm.entity_id)?.title : '';
        const corpus = [bm.title, bm.url, bm.description, bm.site_name, bm.notes, linkedNote, ...getVisibleTags(bm.tags)].filter(Boolean).join(' ').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!queryTerms.some(term => corpus.includes(term))) return false;
      }
      return true;
    }).sort((a, b) => {
      if (!searchQuery.trim()) return Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
      const score = (item: AppBookmark) => {
        const q = searchQuery.toLocaleLowerCase('es');
        const title = item.title.toLocaleLowerCase('es');
        const tags = getVisibleTags(item.tags).join(' ').toLocaleLowerCase('es');
        return (title === q ? 100 : title.includes(q) ? 60 : 0) + (tags.includes(q) ? 35 : 0) + (item.site_name?.toLocaleLowerCase('es').includes(q) ? 20 : 0) + (item.description?.toLocaleLowerCase('es').includes(q) ? 12 : 0) + (item.notes?.toLocaleLowerCase('es').includes(q) ? 10 : 0) + (item.is_pinned ? 5 : 0);
      };
      return score(b) - score(a);
    });
  }, [bookmarks, notes, activeTab, selectedTag, searchQuery, activeResourceType, activeResourceStatus]);

  // Counts
  const counts = useMemo(() => {
    return {
      all: bookmarks.length,
      favorites: bookmarks.filter(b => b.is_favorite).length,
      pinned: bookmarks.filter(b => b.is_pinned).length,
      unorganized: bookmarks.filter(b => !b.collection_id).length
    };
  }, [bookmarks]);

  const activeCollectionObj = collections.find(c => c.id === activeTab);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d0d12] text-gray-100 overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-cyan-600 text-white text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="border-b border-[#20202d] bg-[#12121a]/90 backdrop-blur-md px-4 sm:px-6 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Enlaces & Marcadores</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 font-mono">
                  {bookmarks.length}
                </span>
              </h1>
              <p className="text-xs text-gray-400">
                Organiza tus recursos web en cuadernos temáticos con previsualización enriquecida
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenNewCollectionModal}
              className="px-3 py-2 rounded-xl bg-[#1a1a26] hover:bg-[#252536] border border-[#2e2e42] text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
              title="Crear un nuevo cuaderno temático de enlaces"
            >
              <FolderPlus className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Nuevo Cuaderno</span>
            </button>
            <button
              onClick={() => handleOpenNewBookmarkModal()}
              className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-950/50 transition"
              title="Guardar un nuevo enlace"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar Enlace</span>
            </button>
          </div>
        </div>

        {/* Search & View Controls */}
        <div className="flex items-center gap-3 pt-1">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Busca por lo que recuerdas: tema, utilidad, contenido o dominio..."
              className="w-full bg-[#161622] border border-[#272738] rounded-xl pl-9 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <select value={activeResourceType} onChange={e => setActiveResourceType(e.target.value)} aria-label="Filtrar por tipo de recurso" className="bg-[#161622] border border-[#272738] rounded-lg px-2 py-1.5 text-[11px] text-gray-300">
              <option value="all">Todos los tipos</option>
              {RESOURCE_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
            <select value={activeResourceStatus} onChange={e => setActiveResourceStatus(e.target.value)} aria-label="Filtrar por estado" className="bg-[#161622] border border-[#272738] rounded-lg px-2 py-1.5 text-[11px] text-gray-300">
              <option value="all">Todos los estados</option>
              {RESOURCE_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center bg-[#161622] rounded-xl border border-[#272738] p-0.5 ml-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid' ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/40 shadow-inner' : 'text-gray-400 hover:text-white'
              }`}
              title="Vista en cuadrícula"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'list' ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/40 shadow-inner' : 'text-gray-400 hover:text-white'
              }`}
              title="Vista en lista"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex sm:hidden items-center gap-2 -mt-1">
          <select value={activeResourceType} onChange={e => setActiveResourceType(e.target.value)} aria-label="Filtrar por tipo de recurso" className="min-w-0 flex-1 bg-[#161622] border border-[#272738] rounded-lg px-2 py-2 text-[11px] text-gray-300">
            <option value="all">Todos los tipos</option>
            {RESOURCE_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <select value={activeResourceStatus} onChange={e => setActiveResourceStatus(e.target.value)} aria-label="Filtrar por estado" className="min-w-0 flex-1 bg-[#161622] border border-[#272738] rounded-lg px-2 py-2 text-[11px] text-gray-300">
            <option value="all">Todos los estados</option>
            {RESOURCE_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </div>

        {/* Cuadernos / Collections Tabs Slider */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 pb-0.5">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 flex-shrink-0 ${
              activeTab === 'all'
                ? 'bg-cyan-600 text-white font-semibold shadow-sm'
                : 'bg-[#181824] border border-[#282838] text-gray-300 hover:text-white hover:border-[#38384d]'
            }`}
          >
            <span>Todos</span>
            <span className="text-[10px] font-mono px-1 rounded bg-black/30 text-gray-300">
              {counts.all}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('favorites')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 flex-shrink-0 ${
              activeTab === 'favorites'
                ? 'bg-amber-600 text-white font-semibold shadow-sm'
                : 'bg-[#181824] border border-[#282838] text-gray-300 hover:text-white hover:border-[#38384d]'
            }`}
          >
            <Star className="w-3 h-3 text-amber-400 fill-amber-400/30" />
            <span>Favoritos</span>
            <span className="text-[10px] font-mono px-1 rounded bg-black/30 text-gray-300">
              {counts.favorites}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('pinned')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 flex-shrink-0 ${
              activeTab === 'pinned'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'bg-[#181824] border border-[#282838] text-gray-300 hover:text-white hover:border-[#38384d]'
            }`}
          >
            <Pin className="w-3 h-3 text-indigo-300" />
            <span>Fijados</span>
            <span className="text-[10px] font-mono px-1 rounded bg-black/30 text-gray-300">
              {counts.pinned}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('unorganized')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 flex-shrink-0 ${
              activeTab === 'unorganized'
                ? 'bg-slate-700 text-white font-semibold shadow-sm'
                : 'bg-[#181824] border border-[#282838] text-gray-300 hover:text-white hover:border-[#38384d]'
            }`}
          >
            <span>Sin Cuaderno</span>
            <span className="text-[10px] font-mono px-1 rounded bg-black/30 text-gray-300">
              {counts.unorganized}
            </span>
          </button>

          <div className="w-[1px] h-4 bg-[#29293a] mx-1 flex-shrink-0" />

          {/* User Collections */}
          {collections.map(col => {
            const count = bookmarks.filter(b => b.collection_id === col.id).length;
            const isSelected = activeTab === col.id;

            return (
              <div key={col.id} className="relative group/tab flex items-center flex-shrink-0">
                <button
                  onClick={() => setActiveTab(col.id)}
                  style={{
                    borderColor: isSelected ? col.color || '#3b82f6' : undefined,
                    backgroundColor: isSelected ? `${col.color || '#3b82f6'}25` : undefined
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                    isSelected
                      ? 'text-white border shadow-sm font-semibold'
                      : 'bg-[#181824] border border-[#282838] text-gray-300 hover:text-white hover:border-[#38384d]'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: col.color || '#3b82f6' }}
                  />
                  <span>{col.name}</span>
                  <span className="text-[10px] font-mono px-1 rounded bg-black/30 text-gray-300">
                    {count}
                  </span>
                </button>

                {/* Edit collection button */}
                <button
                  onClick={(e) => handleOpenEditCollectionModal(col, e)}
                  className="opacity-0 group-hover/tab:opacity-100 ml-1 p-1 rounded hover:bg-[#252536] text-gray-400 hover:text-white transition"
                  title="Configurar cuaderno"
                >
                  <Edit2 className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Tags filter if any */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 text-[11px]">
            <span className="text-gray-500 flex items-center gap-1 mr-1">
              <Tag className="w-3 h-3" /> Tags:
            </span>
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(null)}
                className="px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800/50 flex items-center gap-1"
              >
                <span>#{selectedTag}</span>
                <X className="w-2.5 h-2.5" />
              </button>
            )}
            {allTags.map(t => {
              if (t === selectedTag) return null;
              return (
                <button
                  key={t}
                  onClick={() => setSelectedTag(t)}
                  className="px-2 py-0.5 rounded-md bg-[#181822] hover:bg-[#222232] text-gray-400 hover:text-gray-200 border border-[#252535] transition"
                >
                  #{t}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {filteredBookmarks.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#262638] rounded-2xl bg-[#111119]/50 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-800/30 flex items-center justify-center text-cyan-400">
              <Bookmark className="w-8 h-8 opacity-70" />
            </div>
            <div className="max-w-sm space-y-1">
              <h3 className="text-sm font-semibold text-white">No hay enlaces aquí</h3>
              <p className="text-xs text-gray-400">
                {searchQuery || selectedTag
                  ? 'No se encontraron resultados con los filtros actuales.'
                  : 'Guarda artículos, herramientas, repositorios o vídeos para encontrarlos siempre que los necesites.'}
              </p>
            </div>
            <button
              onClick={() => handleOpenNewBookmarkModal(activeCollectionObj?.id)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg transition"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar mi primer enlace</span>
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredBookmarks.map(bm => {
              const col = bm.collection_id ? collectionMap.get(bm.collection_id) : null;
              const hasCover = Boolean(bm.cover_image_url);

              return (
                <div
                  key={bm.id}
                  onClick={() => window.open(bm.url, '_blank')}
                  className="group bg-[#151520] hover:bg-[#181826] border border-[#242436] hover:border-cyan-500/50 rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 shadow-sm hover:shadow-xl cursor-pointer"
                >
                  {/* Card Header Media / Cover */}
                  <div className="h-36 bg-[#0f0f16] border-b border-[#222233] relative overflow-hidden flex items-center justify-center">
                    {hasCover ? (
                      <img
                        src={bm.cover_image_url}
                        alt={bm.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#12121c] to-[#1c1c2a] p-4 text-center">
                        <Globe className="w-8 h-8 text-cyan-400 opacity-40 group-hover:scale-110 transition duration-300" />
                        <span className="text-[11px] font-semibold text-gray-400 truncate max-w-full">
                          {bm.site_name || new URL(bm.url).hostname.replace(/^www\./, '')}
                        </span>
                      </div>
                    )}

                    {/* Top Badges (Pin & Favorite) */}
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      {bm.is_pinned && (
                        <span className="p-1 rounded-md bg-indigo-600/90 text-white shadow-md">
                          <Pin className="w-3 h-3" />
                        </span>
                      )}
                      {bm.is_favorite && (
                        <span className="p-1 rounded-md bg-amber-500/90 text-white shadow-md">
                          <Star className="w-3 h-3 fill-white" />
                        </span>
                      )}
                    </div>

                    {/* Quick copy & Open buttons overlay */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleCopyUrl(bm.url, bm.id, e)}
                        className="p-1.5 rounded-lg bg-black/75 hover:bg-black text-gray-300 hover:text-white backdrop-blur-sm border border-gray-700/60 shadow-md transition"
                        title="Copiar enlace"
                      >
                        {copiedId === bm.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => handleOpenEditBookmarkModal(bm, e)}
                        className="p-1.5 rounded-lg bg-black/75 hover:bg-black text-gray-300 hover:text-white backdrop-blur-sm border border-gray-700/60 shadow-md transition"
                        title="Editar enlace"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Collection badge at bottom */}
                    {col && (
                      <div className="absolute bottom-2 left-2">
                        <span
                          style={{
                            backgroundColor: `${col.color || '#3b82f6'}30`,
                            borderColor: `${col.color || '#3b82f6'}60`,
                            color: col.color || '#3b82f6'
                          }}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold border backdrop-blur-sm shadow-sm flex items-center gap-1 truncate max-w-[140px]"
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.color || '#3b82f6' }} />
                          <span className="truncate">{col.name}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      {/* Site name & Favicon */}
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-1">
                        {bm.favicon_url ? (
                          <img
                            src={bm.favicon_url}
                            alt=""
                            className="w-3.5 h-3.5 rounded flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Globe className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        )}
                        <span className="truncate font-mono">
                          {bm.site_name || new URL(bm.url).hostname.replace(/^www\./, '')}
                        </span>
                      </div>

                      {/* Title */}
                      <h4
                        className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug group-hover:text-cyan-300 transition"
                        title={bm.title}
                      >
                        {bm.title}
                      </h4>

                      {/* Description */}
                      {bm.description && (
                        <p className="text-[11px] text-gray-400 line-clamp-2 mt-1 leading-normal">
                          {bm.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1 px-3 pt-2">
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-cyan-950/50 text-cyan-300 border border-cyan-800/30">{RESOURCE_TYPES.find(type => type.value === getResourceMeta(bm.tags, TYPE_TAG_PREFIX, 'other'))?.label || 'Otro'}</span>
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] bg-[#20202e] text-gray-400 border border-[#2a2a3c]">{RESOURCE_STATUSES.find(status => status.value === getResourceMeta(bm.tags, STATUS_TAG_PREFIX, 'unread'))?.label || 'Pendiente'}</span>
                    </div>

                    {bm.entity_type === 'note' && bm.entity_id && notes.find(note => note.id === bm.entity_id) && (
                      <div className="px-3 pt-2 text-[10px] text-violet-300 truncate">Nota vinculada: {notes.find(note => note.id === bm.entity_id)?.title}</div>
                    )}
                    {/* Tags & Action Bar */}
                    <div className="pt-2 border-t border-[#1f1f2e] space-y-2">
                      {getVisibleTags(bm.tags).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {getVisibleTags(bm.tags).slice(0, 3).map(t => (
                            <span
                              key={t}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTag(t);
                              }}
                              className="px-1.5 py-0.2 rounded text-[9.5px] bg-[#1a1a27] text-gray-400 hover:text-cyan-300 border border-[#2a2a3c] transition"
                            >
                              #{t}
                            </span>
                          ))}
                          {getVisibleTags(bm.tags).length > 3 && (
                            <span className="text-[9px] text-gray-500 font-mono">
                              +{getVisibleTags(bm.tags).length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-gray-500 text-[11px]">
                        <span className="font-mono text-[10px]">
                          {new Date(bm.created_at).toLocaleDateString()}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleToggleFavorite(bm, e)}
                            className={`p-1 rounded hover:bg-[#202030] transition ${
                              bm.is_favorite ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'
                            }`}
                            title={bm.is_favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
                          >
                            <Star className={`w-3.5 h-3.5 ${bm.is_favorite ? 'fill-amber-400' : ''}`} />
                          </button>
                          <button
                            onClick={(e) => handleTogglePin(bm, e)}
                            className={`p-1 rounded hover:bg-[#202030] transition ${
                              bm.is_pinned ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'
                            }`}
                            title={bm.is_pinned ? 'Desfijar' : 'Fijar arriba'}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteBookmark(bm.id, e)}
                            className="p-1 rounded hover:bg-rose-950/60 text-gray-500 hover:text-rose-400 transition"
                            title="Eliminar enlace"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="bg-[#14141e] border border-[#232332] rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#101018] border-b border-[#232332] text-gray-400 uppercase text-[10px] tracking-wider font-mono">
                <tr>
                  <th className="py-3 px-4">Enlace</th>
                  <th className="py-3 px-4 hidden md:table-cell">Cuaderno</th>
                  <th className="py-3 px-4 hidden lg:table-cell">Etiquetas</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Fecha</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e2d]">
                {filteredBookmarks.map(bm => {
                  const col = bm.collection_id ? collectionMap.get(bm.collection_id) : null;

                  return (
                    <tr
                      key={bm.id}
                      onClick={() => window.open(bm.url, '_blank')}
                      className="cursor-pointer transition hover:bg-[#1b1b28]"
                    >
                      <td className="py-3 px-4 max-w-sm">
                        <div className="flex items-center gap-2.5">
                          {bm.favicon_url ? (
                            <img
                              src={bm.favicon_url}
                              alt=""
                              className="w-4 h-4 rounded flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Globe className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate hover:text-cyan-300 flex items-center gap-1.5">
                              <span className="truncate">{bm.title}</span>
                              {bm.is_pinned && <Pin className="w-3 h-3 text-indigo-400 flex-shrink-0" />}
                              {bm.is_favorite && <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
                            </div>
                            <div className="text-[11px] text-gray-500 font-mono truncate">
                              {bm.url}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 hidden md:table-cell">
                        {col ? (
                          <span
                            style={{
                              backgroundColor: `${col.color || '#3b82f6'}20`,
                              borderColor: `${col.color || '#3b82f6'}40`,
                              color: col.color || '#3b82f6'
                            }}
                            className="px-2 py-0.5 rounded text-[11px] font-medium border"
                          >
                            {col.name}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-[11px]">Sin cuaderno</span>
                        )}
                      </td>

                      <td className="py-3 px-4 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {getVisibleTags(bm.tags).slice(0, 2).map(t => (
                            <span key={t} className="px-1.5 py-0.2 rounded text-[10px] bg-[#1a1a27] text-gray-400 border border-[#2a2a3c]">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4 hidden sm:table-cell text-gray-500 font-mono text-[11px]">
                        {new Date(bm.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => handleCopyUrl(bm.url, bm.id, e)}
                            className="p-1.5 rounded-lg hover:bg-[#252536] text-gray-400 hover:text-white transition"
                            title="Copiar enlace"
                          >
                            {copiedId === bm.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={(e) => handleToggleFavorite(bm, e)}
                            className={`p-1.5 rounded-lg hover:bg-[#252536] transition ${
                              bm.is_favorite ? 'text-amber-400' : 'text-gray-400 hover:text-white'
                            }`}
                            title={bm.is_favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
                          >
                            <Star className={`w-3.5 h-3.5 ${bm.is_favorite ? 'fill-amber-400' : ''}`} />
                          </button>
                          <button
                            onClick={(e) => handleOpenEditBookmarkModal(bm, e)}
                            className="p-1.5 rounded-lg hover:bg-[#252536] text-gray-400 hover:text-white transition"
                            title="Editar enlace"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteBookmark(bm.id, e)}
                            className="p-1.5 rounded-lg hover:bg-rose-950/60 text-gray-400 hover:text-rose-400 transition"
                            title="Eliminar enlace"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Crear / Editar Enlace */}
      {isBookmarkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#171722] border border-[#2c2c3d] rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#262638] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-cyan-400" />
                {editingBookmark ? 'Editar Enlace Web' : 'Guardar Nuevo Enlace'}
              </h3>
              <button
                onClick={() => setIsBookmarkModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* URL input */}
              <div>
                <label className="block text-gray-400 mb-1 font-semibold">
                  URL del sitio web <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={formUrl}
                    onChange={e => setFormUrl(e.target.value)}
                    onBlur={handleUrlBlur}
                    placeholder="https://ejemplo.com/articulo"
                    className="w-full bg-[#101018] border border-[#2a2a3c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition"
                  />
                  {isExtractingMetadata && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-cyan-400 text-[11px]">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Extrayendo datos...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Title input */}
              <div>
                <label className="block text-gray-400 mb-1 font-semibold">Título</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Título del enlace o recurso"
                  className="w-full bg-[#101018] border border-[#2a2a3c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition"
                />
              </div>

              {/* Description input */}
              <div>
                <label className="block text-gray-400 mb-1 font-semibold">Descripción o resumen</label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder="Breve descripción del contenido..."
                  className="w-full bg-[#101018] border border-[#2a2a3c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition resize-none"
                />
              </div>

              {/* Cuaderno / Collection & Tags */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1 font-semibold">Cuaderno / Colección</label>
                  <select
                    value={formCollectionId}
                    onChange={e => setFormCollectionId(e.target.value)}
                    className="w-full bg-[#101018] border border-[#2a2a3c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition"
                  >
                    <option value="">Sin Cuaderno</option>
                    {collections.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-semibold">Etiquetas (separadas por coma)</label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={e => setFormTags(e.target.value)}
                    placeholder="ia, tutorial, diseño"
                    className="w-full bg-[#101018] border border-[#2a2a3c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1 font-semibold">Tipo de recurso</label>
                  <select value={formResourceType} onChange={e => setFormResourceType(e.target.value)} className="w-full bg-[#101018] border border-[#2a2a3c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
                    {RESOURCE_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-semibold">Estado de lectura</label>
                  <select value={formResourceStatus} onChange={e => setFormResourceStatus(e.target.value)} className="w-full bg-[#101018] border border-[#2a2a3c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
                    {RESOURCE_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-semibold">Vincular con una nota</label>
                <select value={formEntityId} onChange={e => setFormEntityId(e.target.value)} className="w-full bg-[#101018] border border-[#2a2a3c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500">
                  <option value="">Sin nota vinculada</option>
                  {notes.map(note => <option key={note.id} value={note.id}>{note.title || 'Nota sin título'}</option>)}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">El recurso quedará asociado a esta nota y podrás localizarlo desde su contexto.</p>
              </div>

              {/* Cover image preview if present */
              {formCoverImage && (
                <div className="flex items-center gap-3 bg-[#101018] border border-[#2a2a3c] p-2 rounded-xl">
                  <img
                    src={formCoverImage}
                    alt=""
                    className="w-16 h-12 object-cover rounded-lg"
                    onError={(e) => (e.target as HTMLElement).style.display = 'none'}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-gray-400 truncate block">Imagen de portada detectada</span>
                    <button
                      onClick={() => setFormCoverImage('')}
                      className="text-[10px] text-rose-400 hover:underline"
                    >
                      Quitar imagen
                    </button>
                  </div>
                </div>
              )}

              {/* Switches: Favorite & Pinned */}
              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formIsFavorite}
                    onChange={e => setFormIsFavorite(e.target.checked)}
                    className="rounded bg-[#101018] border-gray-700 text-amber-500 focus:ring-0"
                  />
                  <span className="text-gray-300 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-400" /> Favorito
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formIsPinned}
                    onChange={e => setFormIsPinned(e.target.checked)}
                    className="rounded bg-[#101018] border-gray-700 text-indigo-500 focus:ring-0"
                  />
                  <span className="text-gray-300 flex items-center gap-1">
                    <Pin className="w-3.5 h-3.5 text-indigo-400" /> Fijar arriba
                  </span>
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-[#262638]">
              <button
                onClick={() => setIsBookmarkModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-[#2a2a3c] text-gray-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveBookmark}
                disabled={isSavingBookmark}
                className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {isSavingBookmark && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>{editingBookmark ? 'Guardar Cambios' : 'Guardar Enlace'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear / Editar Cuaderno de Enlaces */}
      {isCollectionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#171722] border border-[#2c2c3d] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#262638] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-cyan-400" />
                {editingCollection ? 'Configurar Cuaderno' : 'Nuevo Cuaderno de Enlaces'}
              </h3>
              <button
                onClick={() => setIsCollectionModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-400 mb-1 font-semibold">
                  Nombre del Cuaderno <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={collectionName}
                  onChange={e => setCollectionName(e.target.value)}
                  placeholder="ej: Herramientas IA, Diseño, Cursos"
                  className="w-full bg-[#101018] border border-[#2a2a3c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-semibold">Descripción (opcional)</label>
                <input
                  type="text"
                  value={collectionDescription}
                  onChange={e => setCollectionDescription(e.target.value)}
                  placeholder="ej: Recursos clave para productividad"
                  className="w-full bg-[#101018] border border-[#2a2a3c] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition"
                />
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-gray-400 mb-1.5 font-semibold">Color temático</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCollectionColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        collectionColor === c ? 'scale-125 ring-2 ring-white' : 'hover:scale-110 opacity-80'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-[#262638]">
              {editingCollection ? (
                <button
                  type="button"
                  onClick={(e) => handleDeleteCollection(editingCollection, e)}
                  className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>
              ) : <div />}

              <div className="flex gap-2">
                <button
                  onClick={() => setIsCollectionModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-[#2a2a3c] text-gray-400 hover:text-white transition text-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveCollection}
                  disabled={isSavingCollection}
                  className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-1.5 transition text-xs disabled:opacity-50"
                >
                  {isSavingCollection && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>{editingCollection ? 'Guardar' : 'Crear Cuaderno'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
