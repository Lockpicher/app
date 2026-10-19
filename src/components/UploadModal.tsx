import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Paperclip, 
  File as FileIcon, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  HardDrive,
  Eye,
  RefreshCw,
  Folder,
  Camera,
  Image as ImageIcon,
  FlipHorizontal,
  CircleDot
} from 'lucide-react';
import { AppAttachment, AppFolder } from '../lib/types';
import { r2Storage } from '../lib/r2Client';
import { db } from '../lib/insforge';

export interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileUploaded: (attachment: AppAttachment) => void;
  folders?: AppFolder[];
  defaultFolderId?: string | null;
  onNavigateToFiles?: () => void;
  acceptFilter?: string;
  titleOverride?: string;
}

type UploadStatus = 'idle' | 'selecting' | 'preparing' | 'uploading_r2' | 'saving_metadata' | 'success' | 'error';

interface FileUploadQueueItem {
  file: File;
  id: string;
  name: string;
  size: number;
  type: string;
  status: UploadStatus;
  progressPercent: number;
  r2Key?: string;
  url?: string;
  attachment?: AppAttachment;
  error?: string;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onFileUploaded,
  folders = [],
  defaultFolderId = null,
  onNavigateToFiles,
  acceptFilter = '*/*',
  titleOverride
}) => {
  const [queue, setQueue] = useState<FileUploadQueueItem[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(defaultFolderId);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Live in-app Camera Viewfinder states
  const [isLiveCameraActive, setIsLiveCameraActive] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsLiveCameraActive(false);
    setCameraError(null);
  };

  const startLiveCamera = async (facingMode: 'user' | 'environment' = cameraFacingMode) => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Fallback a input capture nativo si getUserMedia no está disponible
      cameraInputRef.current?.click();
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      // Solicitar máxima resolución nativa soportada por el sensor del dispositivo (hasta 4K/UHD)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: facingMode },
          width: { ideal: 3840, min: 1280 },
          height: { ideal: 2160, min: 720 }
        },
        audio: false
      });
      streamRef.current = stream;
      setIsLiveCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('No se pudo acceder al stream de la cámara directamente con máxima resolución:', err);
      // Fallback a resolución por defecto
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: false
        });
        streamRef.current = fallbackStream;
        setIsLiveCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play().catch(() => {});
        }
      } catch (fallbackErr) {
        cameraInputRef.current?.click();
      }
    }
  };

  const toggleCameraFacingMode = () => {
    const nextMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextMode);
    startLiveCamera(nextMode);
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    // Capturar a la resolución real y completa del sensor de video
    const width = video.videoWidth || 1920;
    const height = video.videoHeight || 1080;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Si es cámara frontal, aplicar mirror horizontal natural
    if (cameraFacingMode === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);

    // Guardar con máxima calidad 1.0 (sin compresión destructiva)
    canvas.toBlob((blob) => {
      if (!blob) return;
      const fileName = `foto_original_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      stopLiveCamera();
      handleFilesSelected([file] as unknown as FileList);
    }, 'image/jpeg', 1.0);
  };

  if (!isOpen) return null;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems: FileUploadQueueItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      newItems.push({
        file,
        id: `${Date.now()}_${i}_${Math.random().toString(36).substr(2, 6)}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        status: 'idle',
        progressPercent: 0
      });
    }

    setQueue(prev => [...prev, ...newItems]);
  };

  const uploadSingleItem = async (item: FileUploadQueueItem): Promise<boolean> => {
    // 1. Preparing
    setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'preparing', progressPercent: 15, error: undefined } : q));

    try {
      // 2. Upload to Cloudflare R2
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading_r2', progressPercent: 50 } : q));

      const folderPrefix = targetFolderId && targetFolderId !== 'root' ? `folder_${targetFolderId}` : 'library';
      const r2Res = await r2Storage.uploadFile(item.file, folderPrefix);

      // 3. Save metadata to InsForge app_attachments
      setQueue(prev => prev.map(q => q.id === item.id ? { 
        ...q, 
        status: 'saving_metadata', 
        progressPercent: 85,
        r2Key: r2Res.r2Key,
        url: r2Res.url
      } : q));

      const created = await db.recordAttachment({
        entity_id: '00000000-0000-0000-0000-000000000000',
        entity_type: 'storage_library',
        file_name: r2Res.name,
        display_name: item.name,
        file_url: r2Res.url,
        file_path: r2Res.r2Key,
        r2_key: r2Res.provider === 'r2' ? r2Res.r2Key : undefined,
        bucket_name: r2Res.provider === 'r2' ? 'cloudflare-r2' : 'app-storage',
        storage_provider: r2Res.provider,
        folder_id: targetFolderId && targetFolderId !== 'root' ? targetFolderId : null,
        file_size: r2Res.size,
        mime_type: r2Res.mime,
        migration_status: r2Res.provider === 'r2' ? 'migrated' : 'pending'
      });

      if (!created) {
        throw new Error('No se pudo guardar el registro de metadatos en InsForge');
      }

      // 4. Success
      setQueue(prev => prev.map(q => q.id === item.id ? { 
        ...q, 
        status: 'success', 
        progressPercent: 100,
        attachment: created
      } : q));

      onFileUploaded(created);
      return true;
    } catch (err: any) {
      const errMsg = err?.message || 'Error inesperado durante la subida';
      setQueue(prev => prev.map(q => q.id === item.id ? { 
        ...q, 
        status: 'error', 
        progressPercent: 0,
        error: errMsg
      } : q));
      return false;
    }
  };

  const handleStartUpload = async () => {
    if (isProcessing) return;
    const pendingItems = queue.filter(q => q.status === 'idle' || q.status === 'error');
    if (pendingItems.length === 0) return;

    setIsProcessing(true);
    for (const item of pendingItems) {
      await uploadSingleItem(item);
    }
    setIsProcessing(false);
  };

  const handleRetryItem = async (itemId: string) => {
    const item = queue.find(q => q.id === itemId);
    if (!item || isProcessing) return;
    setIsProcessing(true);
    await uploadSingleItem(item);
    setIsProcessing(false);
  };

  const handleRemoveItem = (itemId: string) => {
    setQueue(prev => prev.filter(q => q.id !== itemId));
  };

  const isAllSuccess = queue.length > 0 && queue.every(q => q.status === 'success');
  const hasErrors = queue.some(q => q.status === 'error');
  const hasPending = queue.some(q => q.status === 'idle');

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Adjuntar archivo a Cloudflare R2"
    >
      <div className="bg-[#181824] border border-[#2e2e42] rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#262638] bg-[#14141c] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-sm">
              <Paperclip className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {titleOverride || 'Adjuntar Archivo'}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40">
                  Cloudflare R2
                </span>
              </h3>
              <p className="text-[11px] text-gray-400">
                {acceptFilter?.includes('image') ? 'Sube fotos o vídeos a tu biblioteca de medios' : 'Sube archivos a tu biblioteca global y Segundo Cerebro'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopLiveCamera();
              onClose();
            }}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252538] transition disabled:opacity-40"
            title="Cerrar modal (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {/* Target Folder selector (optional) */}
          {folders.length > 0 && (
            <div className="space-y-1.5 bg-[#14141c] p-3 rounded-xl border border-[#252536]">
              <label className="text-[11px] font-semibold text-gray-300 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-blue-400" />
                Carpeta de destino (Opcional)
              </label>
              <select
                value={targetFolderId || ''}
                onChange={(e) => setTargetFolderId(e.target.value || null)}
                disabled={isProcessing}
                className="w-full px-3 py-1.5 bg-[#1a1a26] border border-[#2e2e42] rounded-lg text-xs text-white outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50"
              >
                <option value="">Biblioteca Principal (Raíz)</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Drag & Drop / Native File Selector Area */}
          <input
            type="file"
            ref={fileInputRef}
            multiple
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              // Reset input value so re-selecting same file triggers change
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="hidden"
            accept={acceptFilter}
          />

          {/* Dedicated Camera Input with capture attribute for Android / iOS */}
          <input
            type="file"
            ref={cameraInputRef}
            accept="image/*,video/*"
            capture="environment"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              if (cameraInputRef.current) cameraInputRef.current.value = '';
            }}
            className="hidden"
          />

          {/* Visor de Cámara en Vivo Interactivo */}
          {isLiveCameraActive ? (
            <div className="relative rounded-2xl overflow-hidden bg-black border border-rose-500/30 flex flex-col items-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full max-h-[360px] object-cover bg-black ${cameraFacingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />

              {/* Botones de control de cámara */}
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleCameraFacingMode}
                  className="p-2 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-black/80 border border-white/20 transition"
                  title="Cambiar de cámara (frontal / trasera)"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={stopLiveCamera}
                  className="p-2 rounded-full bg-black/60 backdrop-blur-md text-gray-300 hover:text-white border border-white/20 transition"
                  title="Cerrar visor de cámara"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Barra inferior: Disparador */}
              <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={handleCapturePhoto}
                  className="w-16 h-16 rounded-full border-4 border-white bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all flex items-center justify-center shadow-2xl"
                  title="Tomar foto ahora"
                >
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <CircleDot className="w-6 h-6 text-white" />
                  </div>
                </button>
              </div>
            </div>
          ) : acceptFilter.includes('image') ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                {/* 1. Opción Cámara Directa */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => {
                    if (!isProcessing) {
                      startLiveCamera();
                    }
                  }}
                  className="p-4 rounded-2xl bg-gradient-to-b from-[#1c1c28] to-[#14141e] border border-rose-500/30 hover:border-rose-500/60 active:scale-[0.98] transition flex flex-col items-center justify-center gap-2 group text-center disabled:opacity-50"
                >
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
                    <Camera className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-white block">
                      Tomar Foto
                    </span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      Abrir cámara directa
                    </span>
                  </div>
                </button>

                {/* 2. Opción Galería / Dispositivo */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => {
                    if (!isProcessing) fileInputRef.current?.click();
                  }}
                  className="p-4 rounded-2xl bg-gradient-to-b from-[#1c1c28] to-[#14141e] border border-purple-500/30 hover:border-purple-500/60 active:scale-[0.98] transition flex flex-col items-center justify-center gap-2 group text-center disabled:opacity-50"
                >
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
                    <ImageIcon className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-white block">
                      Galería
                    </span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      Elegir fotos y vídeos
                    </span>
                  </div>
                </button>
              </div>

              {/* Zona alternativa de arrastrar y soltar */}
              <div
                onClick={() => {
                  if (!isProcessing) fileInputRef.current?.click();
                }}
                className="border border-dashed border-[#2f2f44] hover:border-blue-500/50 rounded-xl p-3 text-center cursor-pointer bg-[#12121a] hover:bg-[#161622] transition"
              >
                <span className="text-[11px] text-gray-400">
                  O arrastra fotos y vídeos aquí desde tu ordenador
                </span>
              </div>
            </div>
          ) : (
            <div
              onClick={() => {
                if (!isProcessing) fileInputRef.current?.click();
              }}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition flex flex-col items-center justify-center gap-2 cursor-pointer ${
                isProcessing 
                  ? 'border-[#2d2d42] bg-[#14141c]/40 cursor-not-allowed opacity-60' 
                  : 'border-[#383852] hover:border-blue-500/80 bg-[#14141c] hover:bg-[#181826]'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                <Upload className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <span className="font-semibold text-sm text-gray-200 block">
                  Seleccionar archivos del dispositivo
                </span>
                <span className="text-[11px] text-gray-400 block mt-0.5">
                  PDFs, imágenes, audios, vídeos, documentos (sin compresión destructiva)
                </span>
              </div>
              <button
                type="button"
                disabled={isProcessing}
                className="mt-1 px-3 py-1.5 bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-medium hover:bg-blue-600/30 transition pointer-events-none"
              >
                Explorar archivos
              </button>
            </div>
          )}

          {/* Files Queue List */}
          {queue.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 px-1">
                <span>Archivos seleccionados ({queue.length})</span>
                {queue.some(q => q.status === 'idle') && (
                  <button
                    type="button"
                    onClick={() => setQueue([])}
                    disabled={isProcessing}
                    className="text-gray-500 hover:text-red-400 transition"
                  >
                    Limpiar lista
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#14141c] p-3 rounded-xl border border-[#272738] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#1f1f2e] text-blue-400 flex items-center justify-center flex-shrink-0 border border-[#2e2e42]">
                        <FileIcon className="w-4 h-4" />
                      </div>
                      <div className="overflow-hidden min-w-0 flex-1">
                        <span className="font-medium text-white truncate block" title={item.name}>
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono mt-0.5">
                          <span>{formatSize(item.size)}</span>
                          <span>•</span>
                          <span className="truncate max-w-[120px]">{item.type}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.status === 'idle' && (
                        <span className="text-[10px] font-mono text-gray-400 bg-[#1c1c28] px-2 py-0.5 rounded border border-[#2b2b3e]">
                          Listo
                        </span>
                      )}

                      {item.status === 'preparing' && (
                        <span className="text-[10px] text-blue-400 flex items-center gap-1 font-mono">
                          <Loader2 className="w-3 h-3 animate-spin" /> Preparando
                        </span>
                      )}

                      {item.status === 'uploading_r2' && (
                        <span className="text-[10px] text-cyan-400 flex items-center gap-1 font-mono animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" /> Subiendo a R2...
                        </span>
                      )}

                      {item.status === 'saving_metadata' && (
                        <span className="text-[10px] text-amber-400 flex items-center gap-1 font-mono">
                          <Loader2 className="w-3 h-3 animate-spin" /> Guardando...
                        </span>
                      )}

                      {item.status === 'success' && (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium font-mono bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Completado
                        </span>
                      )}

                      {item.status === 'error' && (
                        <div className="flex items-center gap-1.5">
                          <span 
                            className="text-[10px] text-red-400 flex items-center gap-1 font-mono bg-red-950/50 border border-red-800/50 px-2 py-0.5 rounded max-w-[110px] truncate"
                            title={item.error}
                          >
                            <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" /> Error
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRetryItem(item.id)}
                            disabled={isProcessing}
                            className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#252538] transition"
                            title="Reintentar subida"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {!isProcessing && item.status !== 'success' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1 text-gray-500 hover:text-red-400 rounded hover:bg-[#252538] transition"
                          title="Quitar de la lista"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-[#262638] bg-[#14141c] flex items-center justify-between gap-3 text-xs">
          <div>
            {isAllSuccess && onNavigateToFiles && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToFiles();
                }}
                className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1.5 transition"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Ver en Archivos y Medios</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl text-gray-400 hover:text-white bg-[#1a1a26] hover:bg-[#222232] transition"
            >
              {isAllSuccess ? 'Cerrar' : 'Cancelar'}
            </button>

            {hasPending || hasErrors ? (
              <button
                type="button"
                onClick={handleStartUpload}
                disabled={isProcessing || queue.length === 0}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-2 transition shadow-md shadow-blue-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Subiendo...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir a Cloudflare R2 ({queue.filter(q => q.status === 'idle' || q.status === 'error').length})</span>
                  </>
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
