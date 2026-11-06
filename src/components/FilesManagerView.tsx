import React, { useState, useRef, useEffect } from 'react';
import { 
  Folder, 
  FolderPlus, 
  Upload, 
  UploadCloud, 
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
  Plus,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Settings,
  Key,
  Eye,
  EyeOff,
  ChevronRight,
  CornerDownLeft,
  GripVertical,
  Package
} from 'lucide-react';
import { AppAttachment, AppFolder } from '../lib/types';
import { db } from '../lib/insforge';
import { r2Storage } from '../lib/r2Client';
import { LightboxModal } from './LightboxModal';
import { TextFileThumbnail, isTextAttachment, getFileExtensionBadge } from './TextFileThumbnail';

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
  const [activeTab, setActiveTab] = useState<'all' | 'images' | 'videos' | 'audios' | 'documents' | 'folders' | 'others' | 'unlinked'>('all');
  const [galleryFilter, setGalleryFilter] = useState<'all_media' | 'images' | 'videos' | 'audios'>('all_media');
  const [docFilter, setDocFilter] = useState<'all' | 'pdf' | 'doc' | 'text'>('all');
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
  const [singleMovingFile, setSingleMovingFile] = useState<AppAttachment | null>(null);
  const [targetMoveFolderId, setTargetMoveFolderId] = useState<string | null>(null);

  // Drag and Drop state
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isDraggingOverView, setIsDraggingOverView] = useState(false);
  const dragCounterRef = useRef(0);

  // Quick feedback toast
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Tags editing
  const [editingTagsFile, setEditingTagsFile] = useState<AppAttachment | null>(null);
  const [tagInput, setTagInput] = useState('');

  // Sincronización y Prueba de Conexión R2
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResultModal, setSyncResultModal] = useState<{
    open: boolean;
    type: 'connection' | 'sync';
    connected?: boolean;
    bucket?: string;
    endpoint?: string;
    error?: string;
    details?: any;
  }>({ open: false, type: 'connection' });

  // Configuración de R2 dentro de la app
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [configForm, setConfigForm] = useState({
    accountId: '',
    endpoint: '',
    accessKeyId: '',
    secretAccessKey: '',
    bucketName: 'konnect',
    publicUrl: ''
  });
  const [configMaskedSecret, setConfigMaskedSecret] = useState('');
  const [configStatusMsg, setConfigStatusMsg] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  const handleOpenConfigModal = async () => {
    setIsConfigModalOpen(true);
    setIsLoadingConfig(true);
    setConfigStatusMsg(null);
    try {
      const data = await r2Storage.getConfig();
      setConfigForm({
        accountId: data.accountId || '',
        endpoint: data.endpoint || '',
        accessKeyId: data.accessKeyId || '',
        secretAccessKey: '',
        bucketName: data.bucketName || 'konnect',
        publicUrl: data.publicUrl || ''
      });
      setConfigMaskedSecret(data.secretKeyMasked || '');
    } catch (e: any) {
      console.warn('Error loading R2 config:', e);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleSaveR2Config = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setConfigStatusMsg(null);
    try {
      const res = await r2Storage.saveConfig({
        accountId: configForm.accountId.trim() || undefined,
        endpoint: configForm.endpoint.trim() || undefined,
        accessKeyId: configForm.accessKeyId.trim(),
        secretAccessKey: configForm.secretAccessKey.trim() || undefined,
        bucketName: configForm.bucketName.trim(),
        publicUrl: configForm.publicUrl.trim() || undefined
      });

      if (res.connected) {
        setConfigStatusMsg({
          type: 'success',
          text: `¡Conexión exitosa! Bucket "${res.bucket}" verificado y activo.`
        });
        setTimeout(() => {
          setIsConfigModalOpen(false);
        }, 1800);
      } else if (res.warning) {
        setConfigStatusMsg({
          type: 'warning',
          text: res.warning
        });
      } else {
        setConfigStatusMsg({
          type: 'error',
          text: res.error || 'Credenciales guardadas, pero no se pudo verificar la conexión con Cloudflare.'
        });
      }
    } catch (err: any) {
      setConfigStatusMsg({
        type: 'error',
        text: err.message || 'Error guardando configuración.'
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleTestAndSync = async () => {
    setIsSyncing(true);
    let currentBucket = '';
    let currentEndpoint = '';
    try {
      // 1. Probar conectividad con Cloudflare R2
      const testRes = await r2Storage.testConnection();
      currentBucket = testRes.bucket || 'konnect';
      currentEndpoint = testRes.endpoint || '';

      if (!testRes.connected) {
        setSyncResultModal({
          open: true,
          type: 'connection',
          connected: false,
          bucket: testRes.bucket || 'konnect',
          endpoint: testRes.endpoint,
          error: testRes.error
        });
        return;
      }

      // 2. Ejecutar sincronización y migración si está conectado
      const migrationRes = await r2Storage.runMigration(false);
      setSyncResultModal({
        open: true,
        type: 'sync',
        connected: true,
        bucket: testRes.bucket,
        endpoint: testRes.endpoint,
        details: migrationRes
      });
      // Recargar archivos
      onFoldersChanged();
    } catch (err: any) {
      setSyncResultModal(prev => ({
        open: true,
        type: 'sync',
        connected: false,
        bucket: currentBucket || prev.bucket || 'konnect',
        endpoint: currentEndpoint || prev.endpoint,
        error: err.message || 'Error durante la sincronización'
      }));
    } finally {
      setIsSyncing(false);
    }
  };

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
    if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|ico|tiff?|heic|heif)$/i.test(name)) return 'image';
    if (mime.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|wmv|flv|m4v|3gp)$/i.test(name)) return 'video';
    if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|oga|aac|flac|wma)$/i.test(name)) return 'audio';
    if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
    if (isTextAttachment(file)) return 'text';
    if (/\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf|epub|pages|numbers|key)$/i.test(name) || mime.includes('word') || mime.includes('document') || mime.includes('sheet') || mime.includes('presentation') || mime.includes('officedocument')) return 'doc';
    return 'other';
  };

  // Upload handler with INSTANT optimistic placeholders and PARALLEL execution
  const handleUpload = async (fileList: FileList, folderOverrideId?: string | null) => {
    try {
      setIsUploading(true);
      const targetFolder = folderOverrideId !== undefined ? folderOverrideId : (selectedFolderId && selectedFolderId !== 'root' ? selectedFolderId : null);
      const files = Array.from(fileList);

      // 1. Create instant optimistic placeholders so files appear IMMEDIATELY (0ms delay)
      const optimisticMap = new Map<string, AppAttachment>();
      files.forEach((file, index) => {
        const tempId = 'temp_' + Date.now() + '_' + index + '_' + Math.random().toString(36).slice(2, 7);
        const isImg = file.type.startsWith('image/');
        const tempAttachment: AppAttachment = {
          id: tempId,
          entity_id: '00000000-0000-0000-0000-000000000000',
          entity_type: 'files_manager',
          file_name: file.name,
          display_name: file.name,
          file_url: isImg ? URL.createObjectURL(file) : '',
          file_path: 'uploading/' + file.name,
          storage_provider: 'r2',
          bucket_name: 'cloudflare-r2',
          folder_id: targetFolder,
          file_size: file.size,
          mime_type: file.type || 'application/octet-stream',
          migration_status: 'pending',
          created_at: new Date().toISOString()
        };
        optimisticMap.set(tempId, tempAttachment);
        onAttachmentCreated(tempAttachment);
      });

      // 2. Upload in PARALLEL to Cloudflare R2 (ultra fast, eliminates sequential delays)
      const uploadPromises = files.map(async (file, index) => {
        const tempId = Array.from(optimisticMap.keys())[index];
        try {
          const res = await r2Storage.uploadFile(
            file, 
            targetFolder ? `folder_${targetFolder}` : 'library'
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
            folder_id: targetFolder,
            file_size: res.size,
            mime_type: res.mime,
            migration_status: res.provider === 'r2' ? 'migrated' : 'pending'
          });

          // Replace optimistic placeholder with real persisted attachment
          if (created) {
            onAttachmentDeleted(tempId, '');
            onAttachmentCreated(created);
          }
          return true;
        } catch (uploadErr: any) {
          console.error('Error en subida individual:', uploadErr);
          onAttachmentDeleted(tempId, '');
          throw uploadErr;
        }
      });

      await Promise.all(uploadPromises);
      showToast(`¡${files.length} archivo(s) subido(s) a Cloudflare R2!`);
    } catch (err: any) {
      showToast('Error subiendo archivo: ' + err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Category Counts
  const imageCount = attachments.filter(a => getFileCategory(a) === 'image').length;
  const videoCount = attachments.filter(a => getFileCategory(a) === 'video').length;
  const audioCount = attachments.filter(a => getFileCategory(a) === 'audio').length;
  const pdfCount = attachments.filter(a => getFileCategory(a) === 'pdf').length;
  const officeCount = attachments.filter(a => getFileCategory(a) === 'doc').length;
  const textCount = attachments.filter(a => getFileCategory(a) === 'text').length;
  const documentsCount = pdfCount + officeCount + textCount;
  const otherCount = attachments.filter(a => getFileCategory(a) === 'other').length;

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
    } else if (activeTab === 'images') {
      const cat = getFileCategory(a);
      if (cat !== 'image') return false;
    } else if (activeTab === 'videos') {
      const cat = getFileCategory(a);
      if (cat !== 'video') return false;
    } else if (activeTab === 'audios') {
      const cat = getFileCategory(a);
      if (cat !== 'audio') return false;
    } else if (activeTab === 'documents') {
      const cat = getFileCategory(a);
      if (cat !== 'pdf' && cat !== 'doc' && cat !== 'text') return false;
      if (docFilter === 'pdf' && cat !== 'pdf') return false;
      if (docFilter === 'doc' && cat !== 'doc') return false;
      if (docFilter === 'text' && cat !== 'text') return false;
    } else if (activeTab === 'others') {
      const cat = getFileCategory(a);
      if (cat !== 'other') return false;
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

  const handleOpenMoveModal = (file?: AppAttachment) => {
    if (file) {
      setSingleMovingFile(file);
      setTargetMoveFolderId(file.folder_id || null);
    } else {
      setSingleMovingFile(null);
      setTargetMoveFolderId(null);
    }
    setIsMoveModalOpen(true);
  };

  const handleApplyMove = async () => {
    setIsMoveModalOpen(false);
    const targetFolderId = targetMoveFolderId;
    const folderName = folders.find(f => f.id === targetFolderId)?.name || 'la Raíz';

    if (singleMovingFile) {
      const file = singleMovingFile;
      setSingleMovingFile(null);
      // Instant optimistic update
      onAttachmentUpdated({ ...file, folder_id: targetFolderId });
      showToast(`"${file.display_name || file.file_name}" movido a ${folderName}`);
      db.updateAttachment(file.id, { folder_id: targetFolderId }).catch(err => {
        onAttachmentUpdated(file);
        showToast(`Error al mover: ${err.message}`, 'error');
      });
    } else if (selectedFileIds.size > 0) {
      const ids = Array.from(selectedFileIds);
      setSelectedFileIds(new Set());
      // Instant optimistic update for all files
      ids.forEach(id => {
        const file = attachments.find(a => a.id === id);
        if (file) onAttachmentUpdated({ ...file, folder_id: targetFolderId });
      });
      showToast(`${ids.length} archivo(s) movidos a ${folderName}`);
      Promise.all(ids.map(id => db.updateAttachment(id, { folder_id: targetFolderId }))).catch(err => {
        showToast(`Error al mover archivos: ${err.message}`, 'error');
      });
    }
  };

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, file: AppAttachment) => {
    e.dataTransfer.setData('text/plain', file.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedFileId(file.id);
  };

  const handleDropOnFolder = async (e: React.DragEvent, targetFolderId: string | null, targetFolderName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    setDraggedFileId(null);

    // 1. Dropping files from OS
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleUpload(e.dataTransfer.files, targetFolderId);
      return;
    }

    // 2. Dropping existing file from app (OPTIMISTIC ZERO-DELAY UPDATE)
    const fileId = e.dataTransfer.getData('text/plain');
    if (fileId) {
      const file = attachments.find(a => a.id === fileId);
      if (file && file.folder_id !== targetFolderId) {
        // Immediate UI update - instant visual movement (0ms latency)
        const optimisticFile: AppAttachment = {
          ...file,
          folder_id: targetFolderId
        };
        onAttachmentUpdated(optimisticFile);
        showToast(`"${file.display_name || file.file_name}" movido a ${targetFolderName}`);

        // Background database sync with error recovery
        db.updateAttachment(file.id, { folder_id: targetFolderId }).catch(err => {
          console.error('Error persisting folder move:', err);
          onAttachmentUpdated(file); // Revert on failure
          showToast(`Error al mover: ${err.message}`, 'error');
        });
      }
    }
  };

  // View-level OS Drag & Drop Handlers
  const handleViewDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedFileId && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      dragCounterRef.current++;
      setIsDraggingOverView(true);
    }
  };

  const handleViewDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedFileId && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
      if (!isDraggingOverView) setIsDraggingOverView(true);
    }
  };

  const handleViewDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedFileId && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      dragCounterRef.current--;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDraggingOverView(false);
      }
    }
  };

  const handleViewDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingOverView(false);

    // If OS files dropped directly on the view
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const targetFolder = (selectedFolderId && selectedFolderId !== 'root') ? selectedFolderId : null;
      await handleUpload(e.dataTransfer.files, targetFolder);
    }
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

  // Folder actions (instant modal close + background sync)
  const handleSaveFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;

    // Instant modal dismissal - zero delay perceived by user
    setIsFolderModalOpen(false);
    setNewFolderName('');
    const targetFolder = editingFolder;
    setEditingFolder(null);

    try {
      if (targetFolder) {
        showToast(`Actualizando "${trimmed}"...`);
        const updated = await db.updateFileFolder(targetFolder.id, { name: trimmed });
        if (updated) {
          showToast(`Carpeta "${trimmed}" actualizada`);
        }
      } else {
        showToast(`Creando "${trimmed}"...`);
        const created = await db.createFileFolder({ name: trimmed });
        if (created) {
          showToast(`Carpeta "${trimmed}" creada con éxito`);
        }
      }
      onFoldersChanged();
    } catch (err: any) {
      showToast(`Error al guardar carpeta: ${err.message}`, 'error');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('¿Eliminar esta carpeta? Los archivos dentro pasarán a la raíz sin eliminarse.')) return;
    await db.deleteFileFolder(folderId);
    onFoldersChanged();
    if (selectedFolderId === folderId) setSelectedFolderId(null);
  };

  return (
    <div 
      className="flex-1 flex flex-col h-screen bg-[#16161d] overflow-hidden text-gray-200 relative"
      onDragEnter={handleViewDragEnter}
      onDragOver={handleViewDragOver}
      onDragLeave={handleViewDragLeave}
      onDrop={handleViewDrop}
    >
      {/* OS Drag & Drop Fullscreen Dropzone Overlay */}
      {isDraggingOverView && !draggedFileId && (
        <div className="absolute inset-0 z-50 bg-[#0b0f19]/90 backdrop-blur-md flex flex-col items-center justify-center p-8 border-4 border-dashed border-cyan-400 pointer-events-none transition-all duration-150 animate-in fade-in select-none">
          <div className="w-24 h-24 rounded-3xl bg-cyan-500/20 border-2 border-cyan-400/60 flex items-center justify-center text-cyan-300 shadow-2xl shadow-cyan-500/30 mb-6 animate-bounce">
            <UploadCloud className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
            ¡Suelta tus archivos aquí!
          </h2>
          <p className="text-sm text-cyan-200/80 max-w-md text-center mb-6 leading-relaxed">
            Se subirán automáticamente a tu bucket de <span className="font-semibold text-white">Cloudflare R2</span> sin alterar los bytes originales.
          </p>
          <div className="px-4 py-2 rounded-xl bg-cyan-950/90 border border-cyan-500/50 text-xs font-mono text-cyan-300 flex items-center gap-2 shadow-xl">
            <Folder className="w-4 h-4 text-cyan-400" />
            <span>
              Destino: {selectedFolderId && selectedFolderId !== 'root' ? folders.find(f => f.id === selectedFolderId)?.name || 'Carpeta' : 'Raíz (Todos los archivos)'}
            </span>
          </div>
        </div>
      )}

      {/* Floating Uploading Indicator */}
      {isUploading && (
        <div className="fixed top-5 right-6 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#141d2e]/95 border border-cyan-500/50 text-cyan-200 text-xs font-semibold shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
          <span>Subiendo archivo(s) a Cloudflare R2...</span>
        </div>
      )}

      {/* Top Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] border-b border-[#252532] bg-[#13131a] flex items-center justify-between flex-wrap gap-4">
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
            onClick={handleTestAndSync}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition ${
              isSyncing 
                ? 'bg-amber-950/60 text-amber-300 border-amber-700/50 cursor-wait'
                : 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border-emerald-700/50 hover:border-emerald-600 shadow-sm'
            }`}
            title="Verificar conexión con Cloudflare R2 y sincronizar archivos existentes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar R2'}</span>
          </button>

          <button
            onClick={handleOpenConfigModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#1e1e2d] hover:bg-[#27273c] text-cyan-300 border border-cyan-800/50 hover:border-cyan-600 transition shadow-sm"
            title="Configurar credenciales y bucket de Cloudflare R2 dentro de la app"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Configurar R2</span>
          </button>

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
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'all'
                ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/50 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'
            }`}
          >
            Todos ({attachments.length})
          </button>

          <button
            onClick={() => setActiveTab('images')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'images'
                ? 'bg-purple-950/70 text-purple-300 border border-purple-800/50 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
            <span>Imágenes ({imageCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('videos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'videos'
                ? 'bg-indigo-950/70 text-indigo-300 border border-indigo-800/50 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-indigo-400" />
            <span>Vídeos ({videoCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('audios')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'audios'
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/50 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'
            }`}
          >
            <Music className="w-3.5 h-3.5 text-emerald-400" />
            <span>Audios ({audioCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'documents'
                ? 'bg-blue-950/70 text-blue-300 border border-blue-800/50 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span>Documentos ({documentsCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('others')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'others'
                ? 'bg-slate-800/90 text-slate-200 border border-slate-600/50 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-slate-400" />
            <span>Otros ({otherCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('folders')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'folders'
                ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/50 shadow-sm'
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
                ? 'bg-amber-950/70 text-amber-300 border border-amber-800/50 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'
            }`}
          >
            Sin vincular
          </button>
        </div>

        {/* Document specific sub-filter (.doc, .docx, .pdf, txt) */}
        {activeTab === 'documents' && (
          <div className="flex items-center gap-1 bg-[#1a1a26] p-1 rounded-lg border border-[#2b2b3d]">
            <button
              onClick={() => setDocFilter('all')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                docFilter === 'all' ? 'bg-[#272738] text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Todos ({documentsCount})
            </button>
            <button
              onClick={() => setDocFilter('pdf')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition ${
                docFilter === 'pdf' ? 'bg-[#272738] text-rose-300 shadow-sm' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <FileText className="w-3 h-3 text-rose-400" />
              PDFs ({pdfCount})
            </button>
            <button
              onClick={() => setDocFilter('doc')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition ${
                docFilter === 'doc' ? 'bg-[#272738] text-blue-300 shadow-sm' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <FileCode className="w-3 h-3 text-blue-400" />
              Word / Office ({officeCount})
            </button>
            <button
              onClick={() => setDocFilter('text')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition ${
                docFilter === 'text' ? 'bg-[#272738] text-amber-300 shadow-sm' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <FileCode className="w-3 h-3 text-amber-400" />
              Texto / Código ({textCount})
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
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {/* Breadcrumb Navigation when inside a Folder */}
        {selectedFolderId && selectedFolderId !== 'root' && (
          <div className="mb-6 bg-[#181824] border border-[#272738] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setSelectedFolderId(null)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-[#222232] transition font-medium"
              >
                <Folder className="w-4 h-4 text-cyan-400" />
                <span>Todos los Archivos</span>
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/70 border border-cyan-800/50 text-cyan-200 font-bold">
                <FolderOpen className="w-4 h-4 text-cyan-400" />
                <span>{folders.find(f => f.id === selectedFolderId)?.name || 'Carpeta'}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-900/80 text-cyan-300 font-mono ml-1">
                  {attachments.filter(a => a.folder_id === selectedFolderId).length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Drop zone to move file back to root */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverFolderId('root_zone');
                }}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={(e) => handleDropOnFolder(e, null, 'la Raíz')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed text-xs transition cursor-pointer ${
                  dragOverFolderId === 'root_zone'
                    ? 'border-cyan-400 bg-cyan-900/50 text-cyan-200 scale-105'
                    : 'border-gray-700 bg-[#121218] text-gray-400 hover:border-gray-500'
                }`}
                title="Arrastra un archivo aquí para sacarlo de esta carpeta"
              >
                <CornerDownLeft className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Arrastra aquí para sacar a Raíz</span>
              </div>

              <button
                onClick={() => {
                  const currentFolder = folders.find(f => f.id === selectedFolderId);
                  if (currentFolder) {
                    setEditingFolder(currentFolder);
                    setNewFolderName(currentFolder.name);
                    setIsFolderModalOpen(true);
                  }
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white bg-[#222232] hover:bg-[#2b2b3f] transition flex items-center gap-1"
                title="Renombrar carpeta"
              >
                <Edit3 className="w-3 h-3 text-gray-400" />
                <span>Renombrar</span>
              </button>

              <button
                onClick={() => handleDeleteFolder(selectedFolderId)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-300 hover:text-red-200 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 transition flex items-center gap-1"
                title="Eliminar carpeta"
              >
                <Trash2 className="w-3 h-3" />
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        )}

        {/* Folders shelf when at root level */}
        {(!selectedFolderId || selectedFolderId === 'root') && (
          <div className="mb-6 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-cyan-400" />
                <span>Carpetas ({folders.length})</span>
                <span className="text-[10px] text-gray-500 font-normal normal-case hidden sm:inline">(Arrastra archivos o suelta aquí para organizarlos)</span>
              </h3>
              <button
                onClick={() => {
                  setEditingFolder(null);
                  setNewFolderName('');
                  setIsFolderModalOpen(true);
                }}
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva Carpeta</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {folders.map(f => {
                const count = attachments.filter(a => a.folder_id === f.id).length;
                const isDragOver = dragOverFolderId === f.id;
                return (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFolderId(f.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverFolderId(f.id);
                    }}
                    onDragLeave={() => setDragOverFolderId(null)}
                    onDrop={(e) => handleDropOnFolder(e, f.id, f.name)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between group relative select-none ${
                      isDragOver
                        ? 'bg-cyan-900/50 border-cyan-400 ring-2 ring-cyan-400 scale-105 shadow-xl shadow-cyan-950/80 z-10'
                        : 'bg-[#191924] border-[#28283a] hover:border-cyan-500/40 hover:bg-[#1f1f2e] hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="p-2 rounded-lg bg-cyan-950/50 border border-cyan-800/40 text-cyan-400 group-hover:scale-110 transition duration-200">
                        <Folder className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFolder(f);
                            setNewFolderName(f.name);
                            setIsFolderModalOpen(true);
                          }}
                          className="p-1 rounded hover:bg-[#2a2a3e] text-gray-400 hover:text-white"
                          title="Renombrar carpeta"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(f.id);
                          }}
                          className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                          title="Eliminar carpeta"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs font-bold text-white truncate" title={f.name}>
                        {f.name}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {isDragOver ? (
                          <span className="text-cyan-300 font-semibold animate-pulse">¡Soltar aquí!</span>
                        ) : (
                          `${count} archivo${count === 1 ? '' : 's'}`
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add folder card */}
              <div
                onClick={() => {
                  setEditingFolder(null);
                  setNewFolderName('');
                  setIsFolderModalOpen(true);
                }}
                className="p-3.5 rounded-xl border border-dashed border-[#2d2d42] hover:border-cyan-500/50 hover:bg-[#1b1b28] cursor-pointer transition flex flex-col items-center justify-center text-center gap-1.5 text-gray-400 hover:text-cyan-300 min-h-[90px]"
              >
                <FolderPlus className="w-5 h-5" />
                <span className="text-xs font-semibold">Nueva Carpeta</span>
              </div>
            </div>
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
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, file)}
                  onDragEnd={() => setDraggedFileId(null)}
                  onClick={() => {
                    setLightboxIndex(idx);
                    setLightboxOpen(true);
                  }}
                  className={`bg-[#191924] rounded-xl border cursor-pointer group flex flex-col justify-between overflow-hidden transition shadow-sm select-none ${
                    draggedFileId === file.id ? 'opacity-40 scale-95 border-dashed border-cyan-400' : ''
                  } ${
                    isSelected ? 'border-cyan-500 bg-cyan-950/20 ring-1 ring-cyan-500' : 'border-[#272738] hover:border-cyan-500/40'
                  }`}
                >
                  {/* Thumbnail / Media Preview */}
                  <div className="h-36 bg-[#111116] border-b border-[#242432] relative overflow-hidden flex items-center justify-center">
                    {cat === 'image' ? (
                      <img
                        src={r2Storage.getDisplayUrl(file)}
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
                      <div className="flex flex-col items-center gap-2 text-rose-400">
                        <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shadow-inner">
                          <FileText className="w-6 h-6 text-rose-400" />
                        </div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wide text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40">PDF</span>
                      </div>
                    ) : cat === 'text' ? (
                      <TextFileThumbnail file={file} />
                    ) : cat === 'doc' ? (
                      <div className="flex flex-col items-center gap-2 text-blue-400">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shadow-inner">
                          <FileText className="w-6 h-6 text-blue-400" />
                        </div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wide text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/40">
                          {file.file_name.split('.').pop() || 'DOC'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <div className="w-12 h-12 rounded-xl bg-slate-500/10 border border-slate-500/30 flex items-center justify-center shadow-inner">
                          <Package className="w-6 h-6 text-slate-400" />
                        </div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wide text-slate-300 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-700/40">
                          {file.file_name.split('.').pop() || 'OTRO'}
                        </span>
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
                    <div className="absolute bottom-2 left-2 text-[9px] px-1.5 py-0.5 rounded bg-black/75 font-mono text-gray-300 flex items-center gap-1">
                      {file.id.startsWith('temp_') ? (
                        <span className="text-cyan-400 flex items-center gap-1 font-semibold animate-pulse">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Subiendo a R2...
                        </span>
                      ) : (
                        <span>{file.storage_provider === 'r2' ? 'R2' : 'InsForge'}</span>
                      )}
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

                    {/* Folder indicator if in folder */}
                    {file.folder_id && (
                      <div className="pt-0.5 flex items-center gap-1 text-[10px] text-cyan-400 font-medium">
                        <Folder className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{folders.find(f => f.id === file.folder_id)?.name || 'Carpeta'}</span>
                      </div>
                    )}

                    {/* Relations indicator */}
                    {file.relations && file.relations.length > 0 && (
                      <div className="pt-1 flex items-center gap-1 text-[10px] text-cyan-300">
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
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
                      onClick={() => handleOpenMoveModal(file)}
                      className="p-1 rounded text-gray-400 hover:text-cyan-300 hover:bg-gray-800 transition"
                      title="Mover a carpeta"
                    >
                      <Move className="w-3.5 h-3.5" />
                    </button>

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
          <div className="bg-[#181822] border border-[#272738] rounded-xl overflow-x-auto shadow-sm">
            <table className="w-full text-left text-xs text-gray-300 min-w-[650px] sm:min-w-full">
              <thead className="bg-[#121218] border-b border-[#252535] text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-3 sm:px-4 w-10"></th>
                  <th className="py-3 px-3 sm:px-4">Nombre</th>
                  <th className="py-3 px-3 sm:px-4">Tipo</th>
                  <th className="py-3 px-3 sm:px-4">Tamaño</th>
                  <th className="hidden md:table-cell py-3 px-3 sm:px-4">Almacenamiento</th>
                  <th className="hidden sm:table-cell py-3 px-3 sm:px-4">Fecha</th>
                  <th className="hidden lg:table-cell py-3 px-3 sm:px-4">Relaciones</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222230]">
                {filteredAttachments.map((file, idx) => {
                  const isSelected = selectedFileIds.has(file.id);
                  const cat = getFileCategory(file);

                  return (
                    <tr
                      key={file.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, file)}
                      onDragEnd={() => setDraggedFileId(null)}
                      onClick={() => {
                        setLightboxIndex(idx);
                        setLightboxOpen(true);
                      }}
                      className={`cursor-pointer transition hover:bg-[#1f1f2c] ${
                        draggedFileId === file.id ? 'opacity-40' : ''
                      } ${
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
                        {cat === 'pdf' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 shrink-0">
                            PDF
                          </span>
                        )}
                        {cat === 'text' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                            {getFileExtensionBadge(file.file_name).label}
                          </span>
                        )}
                        {cat === 'doc' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 shrink-0 uppercase">
                            {file.file_name.split('.').pop() || 'DOC'}
                          </span>
                        )}
                        {cat === 'other' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-500/15 text-slate-300 border border-slate-500/30 shrink-0 uppercase">
                            {file.file_name.split('.').pop() || 'OTRO'}
                          </span>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="truncate max-w-xs">{file.display_name || file.file_name}</span>
                          {file.folder_id && (
                            <span className="text-[10px] text-cyan-400 flex items-center gap-1 font-normal">
                              <Folder className="w-2.5 h-2.5" />
                              {folders.find(f => f.id === file.folder_id)?.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-400 font-mono text-[11px] uppercase">
                        {file.mime_type?.split('/')[1] || cat}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-300">
                        {formatSize(file.file_size)}
                      </td>
                      <td className="hidden md:table-cell py-3 px-3 sm:px-4">
                        <span className="px-2 py-0.5 rounded bg-gray-800 text-[10px] font-mono text-gray-300">
                          {file.storage_provider === 'r2' ? 'Cloudflare R2' : 'InsForge'}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell py-3 px-3 sm:px-4 text-gray-400 font-mono text-[11px]">
                        {new Date(file.created_at).toLocaleDateString()}
                      </td>
                      <td className="hidden lg:table-cell py-3 px-3 sm:px-4">
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
                      <td className="py-3 px-3 sm:px-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenMoveModal(file)}
                            className="p-1 rounded text-gray-400 hover:text-cyan-300 hover:bg-gray-800"
                            title="Mover a carpeta"
                          >
                            <Move className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={r2Storage.getDisplayUrl(file)}
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
              Mover {singleMovingFile ? `"${singleMovingFile.display_name || singleMovingFile.file_name}"` : `${selectedFileIds.size} archivo(s)`} a carpeta
            </h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              <button
                onClick={() => setTargetMoveFolderId(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition flex items-center justify-between ${
                  targetMoveFolderId === null ? 'bg-cyan-950 text-cyan-300 font-semibold' : 'hover:bg-[#252535] text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Folder className="w-3.5 h-3.5 text-gray-400" />
                  <span>Raíz (Sin carpeta)</span>
                </div>
                {targetMoveFolderId === null && <Check className="w-3.5 h-3.5 text-cyan-400" />}
              </button>
              {folders.map(f => (
                <button
                  key={f.id}
                  onClick={() => setTargetMoveFolderId(f.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition flex items-center justify-between ${
                    targetMoveFolderId === f.id ? 'bg-cyan-950 text-cyan-300 font-semibold' : 'hover:bg-[#252535] text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Folder className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate">{f.name}</span>
                  </div>
                  {targetMoveFolderId === f.id && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setIsMoveModalOpen(false);
                  setSingleMovingFile(null);
                }}
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

      {/* Sync & Connection Test Diagnosis Modal */}
      {syncResultModal.open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1b1b26] border border-[#2c2c3d] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {syncResultModal.connected ? (
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {syncResultModal.connected
                      ? 'Cloudflare R2: Conexión Exitosa'
                      : 'Error de Sincronización con Cloudflare R2'}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Diagnóstico en vivo de credenciales y bucket
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSyncResultModal(prev => ({ ...prev, open: false }))}
                className="text-gray-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {/* Error or Success details */}
            {syncResultModal.error && (
              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-300">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  Detalle del Error Detectado:
                </div>
                <p className="text-xs text-red-200/90 font-mono bg-black/40 p-2.5 rounded-lg break-words">
                  {syncResultModal.error}
                </p>
              </div>
            )}

            {/* Connection configuration summary */}
            <div className="bg-[#14141e] border border-[#242436] rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center text-gray-400">
                <span>Bucket Configurado:</span>
                <span className="font-mono text-cyan-300 font-semibold">
                  {syncResultModal.bucket || '(no definido)'}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-400">
                <span>Endpoint R2:</span>
                <span className="font-mono text-gray-200 truncate max-w-[260px]">
                  {syncResultModal.endpoint || '(no definido)'}
                </span>
              </div>
            </div>

            {/* Sync Progress / Migration logs if successful */}
            {syncResultModal.details && (
              <div className="bg-[#14141e] border border-emerald-900/50 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between text-emerald-300 font-semibold">
                  <span>Archivos Migrados a R2:</span>
                  <span>{syncResultModal.details.progress?.migratedCount || 0}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Archivos Ya en R2 (Omitidos):</span>
                  <span>{syncResultModal.details.progress?.skippedCount || 0}</span>
                </div>
                {syncResultModal.details.progress?.logs && (
                  <div className="mt-2 max-h-36 overflow-y-auto font-mono text-[11px] text-gray-400 bg-black/40 p-2 rounded">
                    {syncResultModal.details.progress.logs.map((log: string, idx: number) => (
                      <div key={idx}>{log}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!syncResultModal.connected && (
              <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-[11px] text-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-amber-300">💡 Instrucciones para solucionar:</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSyncResultModal(prev => ({ ...prev, open: false }));
                      handleOpenConfigModal();
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-white font-medium text-[11px] shadow transition"
                  >
                    <Settings className="w-3 h-3" />
                    <span>Configurar R2 Ahora</span>
                  </button>
                </div>
                <p>Puedes ingresar o ajustar el Bucket, Account ID y claves directamente sin salir de la app.</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSyncResultModal(prev => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-white"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cloudflare R2 In-App Settings Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1b1b26] border border-[#2c2c3d] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    Configuración de Cloudflare R2
                  </h3>
                  <p className="text-xs text-gray-400">
                    Gestiona el bucket y credenciales S3 directamente desde la aplicación
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {isLoadingConfig ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-400">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                <span className="text-xs">Cargando configuración actual...</span>
              </div>
            ) : (
              <form onSubmit={handleSaveR2Config} className="space-y-3.5 text-xs">
                {configStatusMsg && (
                  <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                    configStatusMsg.type === 'success'
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                      : configStatusMsg.type === 'warning'
                      ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                      : 'bg-red-950/40 border-red-800/60 text-red-200'
                  }`}>
                    {configStatusMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <span>{configStatusMsg.text}</span>
                  </div>
                )}

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Nombre del Bucket <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={configForm.bucketName}
                    onChange={e => setConfigForm(prev => ({ ...prev, bucketName: e.target.value }))}
                    placeholder="konnect"
                    className="w-full px-3 py-2 bg-[#121218] border border-[#2a2a3c] rounded-lg text-white font-mono outline-none focus:border-cyan-500 transition"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    El bucket de almacenamiento en Cloudflare R2 donde se guardarán los archivos.
                  </p>
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Account ID de Cloudflare
                  </label>
                  <input
                    type="text"
                    value={configForm.accountId}
                    onChange={e => setConfigForm(prev => ({ ...prev, accountId: e.target.value }))}
                    placeholder="1e5d66e01cbd4ce37cd5a2f2ea5e3f65"
                    className="w-full px-3 py-2 bg-[#121218] border border-[#2a2a3c] rounded-lg text-white font-mono outline-none focus:border-cyan-500 transition"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Opcional si especificas el Endpoint completo.
                  </p>
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Endpoint S3 de R2
                  </label>
                  <input
                    type="text"
                    value={configForm.endpoint}
                    onChange={e => setConfigForm(prev => ({ ...prev, endpoint: e.target.value }))}
                    placeholder="https://1e5d66e01cbd4ce37cd5a2f2ea5e3f65.r2.cloudflarestorage.com"
                    className="w-full px-3 py-2 bg-[#121218] border border-[#2a2a3c] rounded-lg text-white font-mono outline-none focus:border-cyan-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Access Key ID <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={configForm.accessKeyId}
                    onChange={e => setConfigForm(prev => ({ ...prev, accessKeyId: e.target.value }))}
                    placeholder="438e5c4e30bbd30422152edeb7c6be8a"
                    className="w-full px-3 py-2 bg-[#121218] border border-[#2a2a3c] rounded-lg text-white font-mono outline-none focus:border-cyan-500 transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-gray-300 font-semibold">
                      Secret Access Key <span className="text-cyan-400">*</span>
                    </label>
                    {configMaskedSecret && !configForm.secretAccessKey && (
                      <span className="text-[10px] text-emerald-400 font-mono">
                        Configurada: {configMaskedSecret}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showSecretKey ? 'text' : 'password'}
                      value={configForm.secretAccessKey}
                      onChange={e => setConfigForm(prev => ({ ...prev, secretAccessKey: e.target.value }))}
                      placeholder={configMaskedSecret ? 'Dejar en blanco para conservar la actual' : 'c1112b84055f21b4e5bea0a...'}
                      className="w-full pl-3 pr-9 py-2 bg-[#121218] border border-[#2a2a3c] rounded-lg text-white font-mono outline-none focus:border-cyan-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecretKey(prev => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      title={showSecretKey ? 'Ocultar' : 'Mostrar'}
                    >
                      {showSecretKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Public URL / Dominio Personalizado <span className="text-gray-500 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={configForm.publicUrl}
                    onChange={e => setConfigForm(prev => ({ ...prev, publicUrl: e.target.value }))}
                    placeholder="https://pub-xxxx.r2.dev o https://cdn.kubbonet.com"
                    className="w-full px-3 py-2 bg-[#121218] border border-[#2a2a3c] rounded-lg text-white font-mono outline-none focus:border-cyan-500 transition"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Si está vacío, la app generará enlaces seguros firmados con streaming directo.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#262638]">
                  <button
                    type="button"
                    onClick={() => setIsConfigModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-gray-800 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/50 transition disabled:opacity-50"
                  >
                    {isSavingConfig ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Probando y Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Guardar y Probar Conexión</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Quick Action Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-medium shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200 ${
          toast.type === 'error'
            ? 'bg-red-950/95 border-red-500/50 text-red-200'
            : 'bg-cyan-950/95 border-cyan-500/50 text-cyan-200'
        }`}>
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};
