import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Mic, 
  Square, 
  Play, 
  Pause, 
  RotateCcw, 
  Check, 
  Upload, 
  Clock, 
  Volume2, 
  FileAudio,
  FolderOpen,
  Search,
  Loader2,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { Editor } from '@tiptap/react';
import { r2Storage } from '../lib/r2Client';
import { db } from '../lib/insforge';
import { AppAttachment } from '../lib/types';

interface AudioInsertModalProps {
  isOpen: boolean;
  onClose: () => void;
  editor: Editor | null;
  entityId?: string;
  entityType?: 'note' | 'object' | 'task' | 'project' | string;
  existingAttachments?: AppAttachment[];
  onAudioInserted?: (audioData: {
    url: string;
    title: string;
    duration: number;
    fileId?: string;
    r2Key?: string;
    mimeType?: string;
    size?: number;
  }) => void;
}

export const AudioInsertModal: React.FC<AudioInsertModalProps> = ({
  isOpen,
  onClose,
  editor,
  entityId,
  entityType = 'note',
  existingAttachments = [],
  onAudioInserted
}) => {
  const [activeTab, setActiveTab] = useState<'record' | 'library' | 'upload'>('record');

  // --- RECORDING STATE ---
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused' | 'stopped'>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordTitle, setRecordTitle] = useState('');
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);

  // --- LIBRARY STATE ---
  const [libraryAudios, setLibraryAudios] = useState<AppAttachment[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [playingLibraryAudioId, setPlayingLibraryAudioId] = useState<string | null>(null);

  // --- UPLOAD STATE ---
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [uploadFilePreviewUrl, setUploadFilePreviewUrl] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusStep, setUploadStatusStep] = useState('');

  // --- GENERAL STATE ---
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- REFS ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const libraryAudioRef = useRef<HTMLAudioElement | null>(null);
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Format bytes to KB / MB
  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setRecordingState('idle');
      setElapsedSeconds(0);
      setRecordedBlob(null);
      setRecordedUrl(null);
      const defaultName = `Nota de voz ${new Date().toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
      setRecordTitle(defaultName);
      setUploadTitle('');
      setSelectedUploadFile(null);
      setUploadFilePreviewUrl(null);
      setErrorMessage(null);
      setIsPreviewPlaying(false);
      setPlayingLibraryAudioId(null);
      setIsUploading(false);
      loadLibraryAudios();
    } else {
      cleanupRecording();
      if (previewAudioRef.current) previewAudioRef.current.pause();
      if (libraryAudioRef.current) libraryAudioRef.current.pause();
    }
  }, [isOpen]);

  const cleanupRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      } catch (e) {
        console.warn('Error closing media recorder:', e);
      }
    }
  };

  // Load library audios
  const loadLibraryAudios = async () => {
    try {
      setIsLoadingLibrary(true);
      const attachments = await db.getAttachments();
      const audios = (attachments || []).filter((a) => {
        const mime = (a.mime_type || '').toLowerCase();
        const name = (a.file_name || '').toLowerCase();
        return mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|webm|flac)$/i.test(name);
      });
      setLibraryAudios(audios);
    } catch (err) {
      console.warn('Could not load library audios:', err);
      // Fallback to passed existingAttachments
      const audios = existingAttachments.filter((a) => {
        const mime = (a.mime_type || '').toLowerCase();
        const name = (a.file_name || '').toLowerCase();
        return mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|webm|flac)$/i.test(name);
      });
      setLibraryAudios(audios);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  // ==========================================
  // TAB 1: RECORDING LOGIC
  // ==========================================
  const startRecording = async () => {
    try {
      setErrorMessage(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage('Tu navegador o dispositivo no soporta acceso al micrófono.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalMime = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: finalMime });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        setRecordingState('stopped');
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);
      setRecordingState('recording');

      setElapsedSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Mic access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Permiso denegado: Habilita el acceso al micrófono en tu navegador para grabar.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No se encontró ningún micrófono conectado en este dispositivo.');
      } else {
        setErrorMessage('Error al acceder al micrófono: ' + (err.message || 'Verifica los permisos.'));
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.pause();
        setRecordingState('paused');
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      } catch (e) {
        console.warn('Pause error:', e);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      try {
        mediaRecorderRef.current.resume();
        setRecordingState('recording');
        timerIntervalRef.current = setInterval(() => {
          setElapsedSeconds((prev) => prev + 1);
        }, 1000);
      } catch (e) {
        console.warn('Resume error:', e);
      }
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('Stop error:', e);
      }
    }
  };

  const resetRecording = () => {
    cleanupRecording();
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingState('idle');
    setElapsedSeconds(0);
    setIsPreviewPlaying(false);
  };

  // Preview recording controls
  const togglePreviewPlay = () => {
    if (!previewAudioRef.current) return;
    if (isPreviewPlaying) {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    } else {
      previewAudioRef.current.play();
      setIsPreviewPlaying(true);
    }
  };

  // Confirm and insert recorded audio into TipTap
  const handleConfirmRecordedAudio = async () => {
    if (!recordedBlob) return;

    try {
      setIsUploading(true);
      setErrorMessage(null);
      setUploadStatusStep('Subiendo audio a Cloudflare R2...');

      const ext = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const fileName = `voice_${Date.now()}.${ext}`;
      const folder = `${entityType}s/${entityId || 'general'}`;
      const uploadRes = await r2Storage.uploadFile(recordedBlob, folder, fileName);

      setUploadStatusStep('Registrando metadatos del archivo...');
      let attachmentId = '';
      try {
        const createdAtt = await db.recordAttachment({
          entity_id: entityId || '00000000-0000-0000-0000-000000000000',
          entity_type: entityType,
          file_name: uploadRes.name,
          display_name: recordTitle.trim() || 'Nota de voz',
          file_url: uploadRes.url,
          file_path: uploadRes.r2Key,
          r2_key: uploadRes.provider === 'r2' ? uploadRes.r2Key : undefined,
          bucket_name: uploadRes.provider === 'r2' ? 'cloudflare-r2' : 'app-storage',
          storage_provider: uploadRes.provider,
          file_size: uploadRes.size,
          mime_type: uploadRes.mime,
          migration_status: uploadRes.provider === 'r2' ? 'migrated' : 'pending',
          metadata: { duration: elapsedSeconds }
        });
        if (createdAtt) attachmentId = createdAtt.id;
      } catch (attErr) {
        console.warn('Metadata record warning:', attErr);
      }

      // Insert into TipTap editor
      insertAudioNodeIntoEditor({
        src: uploadRes.url,
        title: recordTitle.trim() || 'Nota de voz',
        duration: elapsedSeconds,
        fileId: attachmentId,
        r2Key: uploadRes.r2Key,
        mimeType: uploadRes.mime,
        size: uploadRes.size
      });

      onClose();
    } catch (err: any) {
      console.error('Error saving voice note:', err);
      setErrorMessage('Error al guardar el audio: ' + (err.message || 'Error de conexión'));
    } finally {
      setIsUploading(false);
      setUploadStatusStep('');
    }
  };

  // ==========================================
  // TAB 2: LIBRARY SELECTION LOGIC
  // ==========================================
  const filteredLibrary = libraryAudios.filter((a) => {
    if (!librarySearchQuery.trim()) return true;
    const q = librarySearchQuery.toLowerCase();
    return (
      (a.display_name && a.display_name.toLowerCase().includes(q)) ||
      (a.file_name && a.file_name.toLowerCase().includes(q))
    );
  });

  const toggleLibraryAudioPreview = (att: AppAttachment) => {
    if (playingLibraryAudioId === att.id) {
      if (libraryAudioRef.current) libraryAudioRef.current.pause();
      setPlayingLibraryAudioId(null);
    } else {
      if (libraryAudioRef.current) {
        libraryAudioRef.current.src = att.file_url;
        libraryAudioRef.current.play();
        setPlayingLibraryAudioId(att.id);
      }
    }
  };

  const handleSelectFromLibrary = (att: AppAttachment) => {
    insertAudioNodeIntoEditor({
      src: att.file_url,
      title: att.display_name || att.file_name,
      duration: (att.metadata as any)?.duration || 0,
      fileId: att.id,
      r2Key: att.r2_key,
      mimeType: att.mime_type || 'audio/webm',
      size: att.file_size
    });
    onClose();
  };

  // ==========================================
  // TAB 3: FILE UPLOAD LOGIC
  // ==========================================
  const handleFilePicked = (file: File) => {
    setSelectedUploadFile(file);
    const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
    setUploadTitle(cleanTitle);
    const previewUrl = URL.createObjectURL(file);
    setUploadFilePreviewUrl(previewUrl);
    setErrorMessage(null);
  };

  const handleConfirmUploadFile = async () => {
    if (!selectedUploadFile) return;

    try {
      setIsUploading(true);
      setErrorMessage(null);
      setUploadStatusStep('Subiendo archivo de audio a Cloudflare R2...');

      const folder = `${entityType}s/${entityId || 'general'}`;
      const uploadRes = await r2Storage.uploadFile(selectedUploadFile, folder);

      setUploadStatusStep('Registrando en la biblioteca...');
      let attachmentId = '';
      try {
        const createdAtt = await db.recordAttachment({
          entity_id: entityId || '00000000-0000-0000-0000-000000000000',
          entity_type: entityType,
          file_name: uploadRes.name,
          display_name: uploadTitle.trim() || uploadRes.name,
          file_url: uploadRes.url,
          file_path: uploadRes.r2Key,
          r2_key: uploadRes.provider === 'r2' ? uploadRes.r2Key : undefined,
          bucket_name: uploadRes.provider === 'r2' ? 'cloudflare-r2' : 'app-storage',
          storage_provider: uploadRes.provider,
          file_size: uploadRes.size,
          mime_type: uploadRes.mime,
          migration_status: uploadRes.provider === 'r2' ? 'migrated' : 'pending'
        });
        if (createdAtt) attachmentId = createdAtt.id;
      } catch (attErr) {
        console.warn('Metadata recording warning:', attErr);
      }

      insertAudioNodeIntoEditor({
        src: uploadRes.url,
        title: uploadTitle.trim() || uploadRes.name,
        duration: 0,
        fileId: attachmentId,
        r2Key: uploadRes.r2Key,
        mimeType: uploadRes.mime,
        size: uploadRes.size
      });

      onClose();
    } catch (err: any) {
      console.error('Error uploading audio file:', err);
      setErrorMessage('Error al subir el archivo: ' + (err.message || 'Error de conexión'));
    } finally {
      setIsUploading(false);
      setUploadStatusStep('');
    }
  };

  // Unified helper to insert audio node into TipTap
  const insertAudioNodeIntoEditor = (data: {
    src: string;
    title: string;
    duration?: number;
    fileId?: string;
    r2Key?: string;
    mimeType?: string;
    size?: number;
  }) => {
    if (editor) {
      editor
        .chain()
        .focus()
        .insertContent([
          {
            type: 'audioNode',
            attrs: {
              src: data.src,
              title: data.title,
              duration: data.duration || 0,
              fileId: data.fileId || '',
              r2Key: data.r2Key || '',
              mimeType: data.mimeType || 'audio/webm',
              size: data.size || 0
            }
          },
          {
            type: 'paragraph'
          }
        ])
        .run();
    }

    if (onAudioInserted) {
      onAudioInserted({
        url: data.src,
        title: data.title,
        duration: data.duration || 0,
        fileId: data.fileId,
        r2Key: data.r2Key,
        mimeType: data.mimeType,
        size: data.size
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      {/* Hidden audio element for previewing library audios */}
      <audio
        ref={libraryAudioRef}
        onEnded={() => setPlayingLibraryAudioId(null)}
        onError={() => setPlayingLibraryAudioId(null)}
        className="hidden"
      />

      <div className="bg-[#171724] border border-[#2d2d42] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#26263a] bg-[#14141f]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Insertar Nota de Voz</h3>
              <p className="text-xs text-gray-400">
                Añade audio interactivo en la posición del cursor
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252538] transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-3 border-b border-[#26263a] bg-[#13131c] text-xs font-semibold p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('record')}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition ${
              activeTab === 'record'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1f1f2e]'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Grabar voz</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition ${
              activeTab === 'library'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1f1f2e]'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Biblioteca</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition ${
              activeTab === 'upload'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1f1f2e]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Subir archivo</span>
          </button>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {/* ========================================================= */}
          {/* TAB 1: GRABAR VOZ                                        */}
          {/* ========================================================= */}
          {activeTab === 'record' && (
            <div className="flex flex-col items-center justify-center py-4 space-y-6">
              {recordingState === 'idle' && (
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={startRecording}
                      className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-2xl shadow-red-600/40 transition transform active:scale-95 group"
                    >
                      <Mic className="w-9 h-9 group-hover:scale-110 transition" />
                    </button>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      Haz clic para comenzar a grabar
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Captura tus ideas, notas rápidas o resúmenes hablados
                    </p>
                  </div>
                </div>
              )}

              {(recordingState === 'recording' || recordingState === 'paused') && (
                <div className="flex flex-col items-center text-center space-y-5 w-full">
                  {/* Elapsed Timer & Pulsing badge */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center">
                      <span className="w-3 h-3 rounded-full bg-red-500 animate-ping absolute" />
                      <span className="w-3 h-3 rounded-full bg-red-500" />
                    </div>
                    <span className="text-3xl font-mono font-bold text-white tracking-wider">
                      {formatTime(elapsedSeconds)}
                    </span>
                  </div>

                  {/* Equalizer animation */}
                  <div className="flex items-center justify-center gap-1 h-8 w-48">
                    {[40, 70, 90, 60, 100, 75, 50, 85, 65, 95, 45, 80].map((h, i) => (
                      <span
                        key={i}
                        className={`w-1.5 rounded-full ${
                          recordingState === 'recording'
                            ? 'bg-red-500 animate-pulse'
                            : 'bg-gray-600'
                        }`}
                        style={{
                          height: recordingState === 'recording' ? `${h}%` : '20%',
                          animationDelay: `${i * 0.08}s`
                        }}
                      />
                    ))}
                  </div>

                  <p className="text-xs text-gray-400">
                    {recordingState === 'recording' ? 'Grabando audio...' : 'Grabación pausada'}
                  </p>

                  {/* Action Controls */}
                  <div className="flex items-center gap-3">
                    {recordingState === 'recording' ? (
                      <button
                        type="button"
                        onClick={pauseRecording}
                        className="px-4 py-2 rounded-xl bg-[#252538] hover:bg-[#2d2d44] text-white text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <Pause className="w-4 h-4 text-amber-400" />
                        <span>Pausar</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={resumeRecording}
                        className="px-4 py-2 rounded-xl bg-[#252538] hover:bg-[#2d2d44] text-white text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <Play className="w-4 h-4 text-emerald-400" />
                        <span>Reanudar</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-red-600/30 transition"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      <span>Terminar</span>
                    </button>
                  </div>
                </div>
              )}

              {recordingState === 'stopped' && recordedBlob && (
                <div className="w-full space-y-4">
                  {/* Hidden preview audio element */}
                  {recordedUrl && (
                    <audio
                      ref={previewAudioRef}
                      src={recordedUrl}
                      onTimeUpdate={() => {
                        if (previewAudioRef.current) {
                          setPreviewCurrentTime(previewAudioRef.current.currentTime);
                        }
                      }}
                      onLoadedMetadata={() => {
                        if (previewAudioRef.current) {
                          setPreviewDuration(previewAudioRef.current.duration);
                        }
                      }}
                      onEnded={() => {
                        setIsPreviewPlaying(false);
                        setPreviewCurrentTime(0);
                      }}
                      className="hidden"
                    />
                  )}

                  {/* Audio Preview Card */}
                  <div className="p-3.5 rounded-2xl bg-[#11111a] border border-[#2b2b3d] flex items-center gap-3">
                    <button
                      type="button"
                      onClick={togglePreviewPlay}
                      className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-md transition"
                      title={isPreviewPlaying ? 'Pausar' : 'Escuchar vista previa'}
                    >
                      {isPreviewPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 ml-0.5" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                        <span>Vista previa de grabación</span>
                        <span className="font-mono text-[11px]">
                          {formatTime(previewCurrentTime)} / {formatTime(elapsedSeconds)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#252538] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 transition-all duration-100"
                          style={{
                            width: `${
                              elapsedSeconds > 0
                                ? Math.min(100, (previewCurrentTime / elapsedSeconds) * 100)
                                : 0
                            }%`
                          }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={resetRecording}
                      disabled={isUploading}
                      className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#252538] transition"
                      title="Descartar y volver a grabar"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Title Input */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Nombre o descripción del audio
                    </label>
                    <input
                      type="text"
                      value={recordTitle}
                      onChange={(e) => setRecordTitle(e.target.value)}
                      disabled={isUploading}
                      placeholder="Ej. Ideas clave para el proyecto..."
                      className="w-full px-3 py-2 rounded-xl bg-[#12121a] border border-[#2b2b3d] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  {/* Upload Step Notification */}
                  {isUploading && (
                    <div className="p-3 bg-indigo-950/40 border border-indigo-700/50 rounded-xl text-xs text-indigo-300 flex items-center gap-2 animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>{uploadStatusStep || 'Procesando e insertando...'}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={resetRecording}
                      disabled={isUploading}
                      className="px-3 py-2 rounded-xl bg-[#222232] hover:bg-[#2a2a3e] text-gray-300 text-xs font-medium transition"
                    >
                      Regrabar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmRecordedAudio}
                      disabled={isUploading}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Insertar en el documento</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: SELECCIONAR DE LA BIBLIOTECA                      */}
          {/* ========================================================= */}
          {activeTab === 'library' && (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                  placeholder="Buscar audio en la biblioteca..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#11111a] border border-[#2b2b3d] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* List */}
              {isLoadingLibrary ? (
                <div className="py-12 text-center text-gray-400 text-xs flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                  <span>Cargando audios de la biblioteca...</span>
                </div>
              ) : filteredLibrary.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-xs flex flex-col items-center gap-2">
                  <FileAudio className="w-8 h-8 text-gray-600" />
                  <span>No hay archivos de audio guardados en la biblioteca.</span>
                  <span className="text-[11px] text-gray-600">
                    Graba una nota nueva o sube un archivo desde las otras pestañas.
                  </span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {filteredLibrary.map((att) => {
                    const isPlaying = playingLibraryAudioId === att.id;
                    return (
                      <div
                        key={att.id}
                        className="p-3 rounded-2xl bg-[#12121c] hover:bg-[#181826] border border-[#26263a] hover:border-indigo-500/40 flex items-center justify-between gap-3 transition group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleLibraryAudioPreview(att)}
                            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition ${
                              isPlaying
                                ? 'bg-amber-500 text-black shadow-md'
                                : 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white'
                            }`}
                            title={isPlaying ? 'Pausar' : 'Escuchar vista previa'}
                          >
                            {isPlaying ? (
                              <Pause className="w-4 h-4 fill-current" />
                            ) : (
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate group-hover:text-indigo-300 transition">
                              {att.display_name || att.file_name}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                              {att.file_size ? <span>{formatBytes(att.file_size)}</span> : null}
                              {att.storage_provider ? (
                                <span className="bg-[#242436] px-1.5 py-0.2 rounded text-gray-400">
                                  {att.storage_provider === 'r2' ? 'Cloudflare R2' : 'Storage'}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectFromLibrary(att)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-semibold transition shrink-0"
                        >
                          Insertar
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: SUBIR ARCHIVO                                     */}
          {/* ========================================================= */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <input
                type="file"
                ref={uploadFileInputRef}
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.webm,.flac"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFilePicked(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {!selectedUploadFile ? (
                <div
                  onClick={() => uploadFileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFilePicked(e.dataTransfer.files[0]);
                    }
                  }}
                  className="border-2 border-dashed border-[#2d2d44] hover:border-indigo-500/60 rounded-3xl p-8 text-center cursor-pointer bg-[#12121c] hover:bg-[#161624] transition flex flex-col items-center justify-center gap-3 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 flex items-center justify-center transition">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-white">
                      Haz clic para seleccionar o arrastra un archivo de audio
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Formatos soportados: MP3, WAV, M4A, OGG, AAC, WebM, FLAC (se almacena en Cloudflare R2)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* File preview info */}
                  <div className="p-3.5 rounded-2xl bg-[#11111a] border border-[#2b2b3d] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0">
                        <FileAudio className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {selectedUploadFile.name}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {formatBytes(selectedUploadFile.size)} • {selectedUploadFile.type || 'audio'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUploadFile(null);
                        setUploadFilePreviewUrl(null);
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252538] transition"
                      title="Cambiar archivo"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Audio preview player */}
                  {uploadFilePreviewUrl && (
                    <audio
                      src={uploadFilePreviewUrl}
                      controls
                      className="w-full h-9 rounded-lg"
                    />
                  )}

                  {/* Editable Title */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Título para mostrar en la nota
                    </label>
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="Título de la nota de audio..."
                      className="w-full px-3 py-2 rounded-xl bg-[#12121a] border border-[#2b2b3d] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  {/* Status */}
                  {isUploading && (
                    <div className="p-3 bg-indigo-950/40 border border-indigo-700/50 rounded-xl text-xs text-indigo-300 flex items-center gap-2 animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>{uploadStatusStep || 'Subiendo archivo...'}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedUploadFile(null)}
                      disabled={isUploading}
                      className="px-3 py-2 rounded-xl bg-[#222232] hover:bg-[#2a2a3e] text-gray-300 text-xs font-medium transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmUploadFile}
                      disabled={isUploading}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Subiendo...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Subir e insertar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
