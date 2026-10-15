import React, { useState, useRef, useEffect } from 'react';
import { 
  Folder, 
  FolderPlus, 
  Upload, 
  Search, 
  Filter, 
  Grid, 
  List, 
  Download, 
  Trash2, 
  Star, 
  StarOff, 
  Tag, 
  Move, 
  Edit3, 
  Check, 
  ExternalLink, 
  Image as ImageIcon, 
  Film, 
  Music, 
  FileText, 
  FileCode, 
  HardDrive, 
  Sparkles, 
  CheckSquare, 
  Square, 
  RefreshCw,
  FolderOpen,
  ArrowUpDown,
  MoreVertical,
  Plus
} from 'lucide-react';
import { AppAttachment, AppFolder } from '../lib/types';
import { db } from '../lib/insforge';
import { r2Storage } from '../lib/r2Client';
import { LightboxModal } from './LightboxModal';

interface FilesManagerViewProps {
  attachments: AppAttachment[];
  folders: AppFolder[];
  onAttachmentCreated: (attachment: AppAttachment) => void;
  onAttachmentUpdated: (attachment: AppAttachment) => void;
  onAttachmentDeleted: (id: string, path: string) => void;
  onFoldersChanged: () => void;
  onNavigateToEntity: (id: string, type: string) => void;
}

export const FilesManagerView: React.FC<FilesManagerViewProps> = ({
  attachments,
  folders,
  onAttachmentCreated,
  onAttachmentUpdated,
  onAttachmentDeleted,
  onFoldersChanged,
  onNavigateToEntity
}) => {
  // Navigation & Sub-views
  const [activeTab, setActiveTab] = useState<'all' | 'gallery' | 'folders' | 'unlinked'>('all');
  const [galleryFilter, setGalleryFilter] = useState<'all_media' | 'images' | 'videos' | 'audios'>('all_media');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | 'root'>(null);
  
  // UI Display state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Folder modal
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<AppFolder | null>(null);

  // Rename modal
  const [renamingFile, setRenamingFile] = useState<AppAttachment | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Move files modal
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [targetMoveFolderId, setTargetMoveFolderId] = useState<string | null>(null);

  // Tags editing
  const [editingTagsFile, setEditingTagsFile] = useState<AppAttachment | null>(null);
  const [tagInput, setTagInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper formatters
  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileCategory = (file: AppAttachment) => {
    const mime = file.mime_type || '';
    const name = file.file_name.toLowerCase();
    if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name)) return 'image';
    if (mime.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(name)) return 'video';
    if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|oga)$/i.test(name)) return 'audio';
    if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
    return 'doc';
  };

  // Upload handler preserving original bytes
  const handleUpload = async (fileList: FileList) => {
    try {
      setIsUploading(true);
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const res = await r2Storage.uploadFile(
          file, 
          selectedFolderId && selectedFolderId !== 'root' ? `folder_${selectedFolderId}` : 'library'
        );

        const created = await db.recordAttachment({
          entity_id: '00000000-0000-0000-0000-000000000000',
          entity_type: 'files_manager',
          file_name: res.name,
          display_name: file.name,
          file_url: res.url,
          file_path: res.r2Key,
          r2_key: res.provider === 'r2' ? res.r2Key : undefined,
          bucket_name: res.provider === 'r2' ? 'cloudflare-r2' : 'app-storage',
          storage_provider: res.provider,
          folder_id: selectedFolderId && selectedFolderId !== 'root' ? selectedFolderId : null,
          file_size: res.size,
          mime_type: res.mime,
          migration_status: res.provider === 'r2' ? 'migrated' : 'pending'
        });

        if (created) {
          onAttachmentCreated(created);
        }
      }
    } catch (err: any) {
      alert('Error subiendo archivo: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Filtering & Sorting
  const filteredAttachments = attachments.filter(a => {
    // Tab filter
    if (activeTab === 'folders') {
      if (selectedFolderId === 'root') {
        if (a.folder_id) return false;
      } else if (selectedFolderId) {
        if (a.folder_id !== selectedFolderId) return false;
      }
    } else if (activeTab === 'unlinked') {
      const hasRels = a.relations && a.relations.length > 0;
      const isSystem = a.entity_id === '00000000-0000-0000-0000-000000000000';
      if (!isSystem || hasRels) return false;
    } else if (activeTab === 'gallery') {
      const cat = getFileCategory(a);
      if (galleryFilter === 'images' && cat !== 'image') return false;
      if (galleryFilter === 'videos' && cat !== 'video') return false;
      if (galleryFilter === 'audios' && cat !== 'audio') return false;
      if (galleryFilter === 'all_media' && cat !== 'image' && cat !== 'video' && cat !== 'audio') return false;
    }

    // Type filter
    if (typeFilter !== 'all') {
      const cat = getFileCategory(a);
      if (typeFilter !== cat) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (a.display_name || a.file_name).toLowerCase().includes(q);
      const matchTag = a.tags?.some(t => t.toLowerCase().includes(q));
      if (!matchName && !matchTag) return false;
    }

    return true;
  }).sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'name') {
      const nameA = (a.display_name || a.file_name).toLowerCase();
      const nameB = (b.display_name || b.file_name).toLowerCase();
      comparison = nameA.localeCompare(nameB);
    } else if (sortBy === 'size') {
      comparison = (a.file_size || 0) - (b.file_size || 0);
    } else {
      comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Batch actions
  const handleSelectAll = () => {
    if (selectedFileIds.size === filteredAttachments.length) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(filteredAttachments.map(f => f.id)));
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedFileIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedFileIds(next);
  };

  const handleDeleteSelected = async () => {
    if (selectedFileIds.size === 0) return;
    if (!confirm(`¿Eliminar ${selectedFileIds.size} archivo(s) seleccionado(s)?`)) return;

    for (const id of selectedFileIds) {
      const file = attachments.find(a => a.id === id);
      if (file) {
        await r2Storage.deleteFile(file);
        onAttachmentDeleted(file.id, file.file_path);
      }
    }
    setSelectedFileIds(new Set());
  };

  const handleToggleFavorite = async (file: AppAttachment, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextFav = !file.is_favorite;
    const updated = await db.updateAttachment(file.id, { is_favorite: nextFav });
    if (updated) onAttachmentUpdated(updated);
  };

  const handleSaveRename = async () => {
    if (!renamingFile || !renameValue.trim()) return;
    const updated = await db.updateAttachment(renamingFile.id, { display_name: renameValue.trim() });
    if (updated) {
      onAttachmentUpdated(updated);
      setRenamingFile(null);
    }
  };

  const handleApplyMove = async () => {
    if (selectedFileIds.size === 0) return;
    for (const id of selectedFileIds) {
      const updated = await db.updateAttachment(id, { folder_id: targetMoveFolderId });
      if (updated) onAttachmentUpdated(updated);
    }
    setIsMoveModalOpen(false);
    setSelectedFileIds(new Set());
  };

  const handleSaveTags = async () => {
    if (!editingTagsFile) return;
    const tagsArray = tagInput.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
    const updated = await db.updateAttachment(editingTagsFile.id, { tags: tagsArray });
    if (updated) {
      onAttachmentUpdated(updated);
      setEditingTagsFile(null);
    }
  };

  // Folder actions
  const handleSaveFolder = async () => {
    if (!newFolderName.trim()) return;
    if (editingFolder) {
      await db.updateFileFolder(editingFolder.id, { name: newFolderName.trim() });
    } else {
      await db.createFileFolder({ name: newFolderName.trim() });
    }
    onFoldersChanged();
    setIsFolderModalOpen(false);
    setNewFolderName('');
    setEditingFolder(null);
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('¿Eliminar esta carpeta? Los archivos dentro pasarán a la raíz sin eliminarse.')) return;
    await db.deleteFileFolder(folderId);
    onFoldersChanged();
    if (selectedFolderId === folderId) setSelectedFolderId(null);
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#16161d] overflow-hidden text-gray-200">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-[#252532] bg-[#13131a] flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-800/40 text-cyan-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Gestor Central de Archivos
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/40 font-mono">
                  Cloudflare R2 + InsForge
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Almacenamiento binario en Cloudflare R2 con metadatos y relaciones en InsForge.
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5">
          <input
            type="file"
            ref={fileInputRef}
            multiple
            className="hidden"
            onChange={e => {
              if (e.target.files && e.target.files.length > 0) {
                handleUpload(e.target.files);
              }
            }}
          />

          <button
            onClick={() => {
              setEditingFolder(null);
              setNewFolderName('');
              setIsFolderModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#20202e] hover:bg-[#28283a] text-gray-200 border border-gray-700/60 transition"
          >
            <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Nueva Carpeta</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/50 transition"
          >
            <Upload className={`w-3.5 h-3.5 ${isUploading ? 'animate-bounce' : ''}`} />
            <span>{isUploading ? 'Subiendo a R2...' : 'Subir Archivos'}</span>
          </button>
        </div>
      </div>

      {/* Navigation tabs & Views Bar */}
      <div className="px-6 py-2.5 bg-[#121217] border-b border-[#232330] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'all'
                ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/50'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'
            }`}
          >
            Todos ({attachments.length})
          </button>

          <button
            onClick={() => setActiveTab('gallery')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'gallery'
                ? 'bg-purple-950/70 text-purple-300 border border-purple-800/50'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
            <span>Galería Multimedia</span>
          </button>

          <button
            onClick={() => setActiveTab('folders')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'folders'
                ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/50'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'
            }`}
          >
            <Folder className="w-3.5 h-3.5 text-cyan-400" />
            <span>Carpetas ({folders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('unlinked')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'unlinked'
                ? 'bg-amber-950/70 text-amber-300 border border-amber-800/50'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'
            }`}
          >
            Sin vincular
          </button>
        </div>

        {/* Gallery specific sub-filter */}
        {activeTab === 'gallery' && (
          <div className="flex items-center gap-1 bg-[#1a1a26] p-1 rounded-lg border border-[#2b2b3d]">
            <button
              onClick={() => setGalleryFilter('all_media')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                galleryFilter === 'all_media' ? 'bg-[#272738] text-white' : 'text-gray-400'
              }`}
            >
              Todo
            </button>
            <button
              onClick={() => setGalleryFilter('images')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition ${
                galleryFilter === 'images' ? 'bg-[#272738] text-white' : 'text-gray-400'
              }`}
            >
              <ImageIcon className="w-3 h-3 text-cyan-400" />
              Imágenes
            </button>
            <button
              onClick={() => setGalleryFilter('videos')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition ${
                galleryFilter === 'videos' ? 'bg-[#272738] text-white' : 'text-gray-400'
              }`}
            >
              <Film className="w-3 h-3 text-purple-400" />
              Vídeos
            </button>
            <button
              onClick={() => setGalleryFilter('audios')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition ${
                galleryFilter === 'audios' ? 'bg-[#272738] text-white' : 'text-gray-400'
              }`}
            >
              <Music className="w-3 h-3 text-emerald-400" />
              Audios
            </button>
          </div>
        )}

        {/* Search, Filter, Sort and View Mode */}
        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar archivo o etiqueta..."
              className="pl-8 pr-3 py-1.5 bg-[#1a1a24] border border-[#2b2b3a] rounded-lg text-xs text-white placeholder-gray-500 outline-none w-48 md:w-56 focus:border-cyan-500"
            />
          </div>

          {/* Sort dropdown */}
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="p-2 rounded-lg bg-[#1a1a24] border border-[#2b2b3a] text-gray-300 hover:text-white"
            title={`Orden: ${sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#1a1a24] border border-[#2b2b3a] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-[#2a2a3c] text-white' : 'text-gray-400'}`}
              title="Cuadrícula"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-[#2a2a3c] text-white' : 'text-gray-400'}`}
              title="Lista detallada"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Sub-bar for batch selection / folder navigation */}
      <div className="px-6 py-2 bg-[#101015] border-b border-[#20202c] flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-1.5 hover:text-white transition"
          >
            {selectedFileIds.size > 0 && selectedFileIds.size === filteredAttachments.length ? (
              <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            <span>Seleccionar todo ({filteredAttachments.length})</span>
          </button>

          {selectedFileIds.size > 0 && (
            <div className="flex items-center gap-2 pl-3 border-l border-gray-700">
              <span className="text-cyan-300 font-medium">{selectedFileIds.size} seleccionados</span>
              <button
                onClick={() => setIsMoveModalOpen(true)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200"
              >
                <Move className="w-3 h-3 text-cyan-400" />
                Mover
              </button>
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/40"
              >
                <Trash2 className="w-3 h-3" />
                Eliminar
              </button>
            </div>
          )}
        </div>

        {activeTab === 'folders' && (
          <div className="flex items-center gap-2">
            <span>Ubicación:</span>
            <button
              onClick={() => setSelectedFolderId(null)}
              className={`px-2 py-0.5 rounded text-[11px] ${
                selectedFolderId === null ? 'bg-cyan-950 text-cyan-300' : 'hover:text-white'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setSelectedFolderId('root')}
              className={`px-2 py-0.5 rounded text-[11px] ${
                selectedFolderId === 'root' ? 'bg-cyan-950 text-cyan-300' : 'hover:text-white'
              }`}
            >
              Raíz (sin carpeta)
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Folders navigation bar if in folders tab */}
        {activeTab === 'folders' && folders.length > 0 && (
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {folders.map(f => {
              const count = attachments.filter(a => a.folder_id === f.id).length;
              const isSelected = selectedFolderId === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => setSelectedFolderId(f.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between group ${
                    isSelected 
                      ? 'bg-cyan-950/40 border-cyan-500/50 shadow-md shadow-cyan-950/50' 
                      : 'bg-[#1a1a24] border-[#292938] hover:border-cyan-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <Folder className={`w-7 h-7 ${isSelected ? 'text-cyan-400' : 'text-gray-400 group-hover:text-cyan-400'} transition`} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(f.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition"
                      title="Eliminar carpeta"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="mt-2">
                    <div className="text-xs font-semibold text-white truncate">{f.name}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{count} archivos</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {filteredAttachments.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[#1b1b26] border border-[#2b2b3d] flex items-center justify-center mx-auto text-gray-400">
              <HardDrive className="w-7 h-7 text-cyan-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-200">No hay archivos en esta vista</h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              Sube tus imágenes, vídeos, audios o documentos a Cloudflare R2 sin transformar ni comprimir los bytes originales.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredAttachments.map((file, idx) => {
              const cat = getFileCategory(file);
              const isSelected = selectedFileIds.has(file.id);

              return (
                <div
                  key={file.id}
                  onClick={() => {
                    setLightboxIndex(idx);
                    setLightboxOpen(true);
                  }}
                  className={`bg-[#191924] rounded-xl border cursor-pointer group flex flex-col justify-between overflow-hidden transition shadow-sm ${
                    isSelected ? 'border-cyan-500 bg-cyan-950/20 ring-1 ring-cyan-500' : 'border-[#272738] hover:border-cyan-500/40'
                  }`}
                >
                  {/* Thumbnail / Media Preview */}
                  <div className="h-36 bg-[#111116] border-b border-[#242432] relative overflow-hidden flex items-center justify-center">
                    {cat === 'image' ? (
                      <img
                        src={file.file_url}
                        alt={file.file_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        loading="lazy"
                      />
                    ) : cat === 'video' ? (
                      <div className="relative w-full h-full flex items-center justify-center bg-black/40">
                        <Film className="w-8 h-8 text-purple-400" />
                        <span className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-black/80 font-mono text-purple-200">
                          Vídeo
                        </span>
                      </div>
                    ) : cat === 'audio' ? (
                      <div className="flex flex-col items-center gap-1 text-emerald-400">
                        <Music className="w-8 h-8" />
                        <span className="text-[10px] font-mono uppercase">Audio</span>
                      </div>
                    ) : cat === 'pdf' ? (
                      <div className="flex flex-col items-center gap-1 text-red-400">
                        <FileText className="w-8 h-8" />
                        <span className="text-[10px] font-mono uppercase">PDF</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-cyan-400">
                        <FileCode className="w-8 h-8" />
                        <span className="text-[10px] font-mono uppercase">{file.file_name.split('.').pop()}</span>
                      </div>
                    )}

                    {/* Checkbox select top left */}
                    <button
                      onClick={(e) => handleToggleSelect(file.id, e)}
                      className="absolute top-2 left-2 p-1 rounded bg-black/60 hover:bg-black/80 text-white z-10"
                    >
                      {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5 text-gray-400" />}
                    </button>

                    {/* Favorite star top right */}
                    <button
                      onClick={(e) => handleToggleFavorite(file, e)}
                      className="absolute top-2 right-2 p-1 rounded bg-black/60 hover:bg-black/80 text-white z-10"
                    >
                      {file.is_favorite ? <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> : <StarOff className="w-3.5 h-3.5 text-gray-400" />}
                    </button>

                    {/* Storage provider badge */}
                    <div className="absolute bottom-2 left-2 text-[9px] px-1.5 py-0.5 rounded bg-black/75 font-mono text-gray-300">
                      {file.storage_provider === 'r2' ? 'R2' : 'InsForge'}
                    </div>
                  </div>

                  {/* Metadata info */}
                  <div className="p-3 space-y-1">
                    <div className="text-xs font-semibold text-white truncate" title={file.display_name || file.file_name}>
                      {file.display_name || file.file_name}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                      <span>{formatSize(file.file_size)}</span>
                      <span>{new Date(file.created_at).toLocaleDateString()}</span>
                    </div>

                    {/* Relations indicator */}
                    {file.relations && file.relations.length > 0 && (
                      <div className="pt-1 flex items-center gap-1 text-[10px] text-cyan-300">
                        <ExternalLink className="w-2.5 h-2.5" />
                        <span>{file.relations.length} relación(es)</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Card Actions */}
                  <div 
                    className="px-3 py-2 bg-[#15151e] border-t border-[#232332] flex items-center justify-between gap-1"
                    onClick={e => e.stopPropagation()}
                  >
                    <a
                      href={file.file_url}
                      download={file.file_name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition"
                      title="Descargar original"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => {
                        setRenamingFile(file);
                        setRenameValue(file.display_name || file.file_name);
                      }}
                      className="p-1 rounded text-gray-400 hover:text-cyan-300 hover:bg-gray-800 transition"
                      title="Renombrar"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        setEditingTagsFile(file);
                        setTagInput(file.tags ? file.tags.join(', ') : '');
                      }}
                      className="p-1 rounded text-gray-400 hover:text-emerald-300 hover:bg-gray-800 transition"
                      title="Etiquetas"
                    >
                      <Tag className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={async () => {
                        if (confirm(`¿Eliminar ${file.display_name || file.file_name}?`)) {
                          await r2Storage.deleteFile(file);
                          onAttachmentDeleted(file.id, file.file_path);
                        }
                      }}
                      className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="bg-[#181822] border border-[#272738] rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#121218] border-b border-[#252535] text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-4">Nombre</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Tamaño</th>
                  <th className="py-3 px-4">Almacenamiento</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Relaciones</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222230]">
                {filteredAttachments.map((file, idx) => {
                  const isSelected = selectedFileIds.has(file.id);
                  const cat = getFileCategory(file);

                  return (
                    <tr
                      key={file.id}
                      onClick={() => {
                        setLightboxIndex(idx);
                        setLightboxOpen(true);
                      }}
                      className={`cursor-pointer transition hover:bg-[#1f1f2c] ${
                        isSelected ? 'bg-cyan-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4" onClick={e => handleToggleSelect(file.id, e)}>
                        {isSelected ? <CheckSquare className="w-4 h-4 text-cyan-400" /> : <Square className="w-4 h-4 text-gray-500" />}
                      </td>
                      <td className="py-3 px-4 font-medium text-white flex items-center gap-2.5">
                        {cat === 'image' && <ImageIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
                        {cat === 'video' && <Film className="w-4 h-4 text-purple-400 flex-shrink-0" />}
                        {cat === 'audio' && <Music className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                        {cat === 'pdf' && <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />}
                        {cat === 'doc' && <FileCode className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                        <span className="truncate max-w-xs">{file.display_name || file.file_name}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-400 font-mono text-[11px] uppercase">
                        {file.mime_type?.split('/')[1] || cat}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-300">
                        {formatSize(file.file_size)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-gray-800 text-[10px] font-mono text-gray-300">
                          {file.storage_provider === 'r2' ? 'Cloudflare R2' : 'InsForge'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">
                        {new Date(file.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        {file.relations && file.relations.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {file.relations.map(rel => (
                              <button
                                key={rel.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigateToEntity(rel.entity_id, rel.entity_type);
                                }}
                                className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 text-[10px] border border-cyan-800/40 hover:bg-cyan-900"
                              >
                                {rel.entity_type}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-600 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={file.file_url}
                            download={file.file_name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800"
                            title="Descargar original"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={async () => {
                              if (confirm(`¿Eliminar ${file.display_name || file.file_name}?`)) {
                                await r2Storage.deleteFile(file);
                                onAttachmentDeleted(file.id, file.file_path);
                              }
                            }}
                            className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                            title="Eliminar"
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

      {/* Lightbox Component */}
      <LightboxModal
        files={filteredAttachments}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setLightboxIndex}
        onNavigateToEntity={onNavigateToEntity}
      />

      {/* Create / Edit Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1b1b26] border border-[#2c2c3d] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Folder className="w-4 h-4 text-cyan-400" />
              {editingFolder ? 'Renombrar Carpeta' : 'Nueva Carpeta Lógica'}
            </h3>
            <input
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Nombre de la carpeta (ej. Documentos 2026)"
              className="w-full px-3 py-2 bg-[#121218] border border-[#29293a] rounded-lg text-xs text-white outline-none focus:border-cyan-500"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsFolderModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveFolder}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename File Modal */}
      {renamingFile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1b1b26] border border-[#2c2c3d] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-cyan-400" />
              Renombrar archivo
            </h3>
            <input
              type="text"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              className="w-full px-3 py-2 bg-[#121218] border border-[#29293a] rounded-lg text-xs text-white outline-none focus:border-cyan-500"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRenamingFile(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRename}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Files Modal */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1b1b26] border border-[#2c2c3d] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Move className="w-4 h-4 text-cyan-400" />
              Mover {selectedFileIds.size} archivo(s) a carpeta
            </h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              <button
                onClick={() => setTargetMoveFolderId(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition flex items-center justify-between ${
                  targetMoveFolderId === null ? 'bg-cyan-950 text-cyan-300' : 'hover:bg-[#252535] text-gray-300'
                }`}
              >
                <span>Raíz (Sin carpeta)</span>
                {targetMoveFolderId === null && <Check className="w-3.5 h-3.5 text-cyan-400" />}
              </button>
              {folders.map(f => (
                <button
                  key={f.id}
                  onClick={() => setTargetMoveFolderId(f.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition flex items-center justify-between ${
                    targetMoveFolderId === f.id ? 'bg-cyan-950 text-cyan-300' : 'hover:bg-[#252535] text-gray-300'
                  }`}
                >
                  <span className="truncate">{f.name}</span>
                  {targetMoveFolderId === f.id && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsMoveModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleApplyMove}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                Mover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tags Modal */}
      {editingTagsFile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1b1b26] border border-[#2c2c3d] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-400" />
              Editar Etiquetas
            </h3>
            <p className="text-xs text-gray-400">
              Introduce etiquetas separadas por comas (ej. factura, diseño, 2026):
            </p>
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              className="w-full px-3 py-2 bg-[#121218] border border-[#29293a] rounded-lg text-xs text-white outline-none focus:border-cyan-500"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingTagsFile(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveTags}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
