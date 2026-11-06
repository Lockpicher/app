import React, { useState, useEffect } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  Calendar, 
  HardDrive, 
  Tag, 
  ExternalLink,
  Copy,
  Check,
  FileText,
  AlignLeft,
  RefreshCw,
  Music,
  Film
} from 'lucide-react';
import { AppAttachment } from '../lib/types';
import { r2Storage } from '../lib/r2Client';
import { isTextAttachment, getFileExtensionBadge } from './TextFileThumbnail';

interface LightboxModalProps {
  files: AppAttachment[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onNavigateToEntity?: (id: string, type: string) => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({
  files,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
  onNavigateToEntity
}) => {
  // CRITICAL: Declare all hooks at the very top to satisfy React Rules of Hooks
  const [zoom, setZoom] = useState(1);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [wrapText, setWrapText] = useState(true);

  const currentFile = files && files.length > 0 && files[currentIndex] ? files[currentIndex] : null;

  const isVideo = Boolean(currentFile && (currentFile.mime_type?.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(currentFile.file_name)));
  const isAudio = Boolean(currentFile && (currentFile.mime_type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|webm|oga)$/i.test(currentFile.file_name)));
  const isImage = Boolean(currentFile && (currentFile.mime_type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(currentFile.file_name)));
  const isText = Boolean(currentFile && isTextAttachment(currentFile));
  const isPdf = Boolean(currentFile && (currentFile.mime_type === 'application/pdf' || /\.pdf$/i.test(currentFile.file_name)));

  // Load text file content when viewing text
  useEffect(() => {
    if (!isOpen || !isText || !currentFile) {
      setTextContent(null);
      setIsLoadingText(false);
      return;
    }

    let cancelled = false;
    setIsLoadingText(true);
    setTextContent(null);
    const url = r2Storage.getDisplayUrl(currentFile);
    if (!url) {
      setIsLoadingText(false);
      return;
    }

    fetch(url)
      .then(async res => {
        if (!res.ok) throw new Error('Error al leer el archivo');
        const t = await res.text();
        if (!cancelled) setTextContent(t);
      })
      .catch(err => {
        if (!cancelled) setTextContent(`[No se pudo cargar la vista previa: ${err.message}]`);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingText(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, isText, currentFile?.id]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setZoom(1);
        onNavigate(currentIndex - 1);
      }
      if (e.key === 'ArrowRight' && files && currentIndex < files.length - 1) {
        setZoom(1);
        onNavigate(currentIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, files?.length, onClose, onNavigate]);

  // Early return ONLY after all hooks are executed
  if (!isOpen || !currentFile) return null;

  const hasPrev = currentIndex > 0;
  const hasNext = files && currentIndex < files.length - 1;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasPrev) {
      setZoom(1);
      onNavigate(currentIndex - 1);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasNext) {
      setZoom(1);
      onNavigate(currentIndex + 1);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Fecha no disponible';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? 'Fecha no disponible' : d.toLocaleString();
    } catch {
      return 'Fecha no disponible';
    }
  };

  const handleCopyText = () => {
    if (!textContent) return;
    navigator.clipboard.writeText(textContent);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const displayUrl = r2Storage.getDisplayUrl(currentFile);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between overflow-hidden select-none"
      onClick={onClose}
    >
      {/* Top Header */}
      <div 
        className="w-full bg-[#121217]/95 border-b border-[#232332] px-3 sm:px-6 py-2 sm:py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] flex items-center justify-between gap-2 z-20 flex-shrink-0"
        onClick={e => e.stopPropagation()}
      >
        {/* Left: Truncated Title & Counter */}
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <span 
            className="text-xs sm:text-sm font-semibold text-white truncate min-w-0 block"
            title={currentFile.display_name || currentFile.file_name}
          >
            {currentFile.display_name || currentFile.file_name}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-[#1e1e2c] text-gray-400 font-mono flex-shrink-0 border border-[#2b2b3e]">
            {currentIndex + 1}/{files.length}
          </span>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Zoom controls for images */}
          {isImage && (
            <div className="hidden sm:flex items-center gap-1 bg-[#181824] p-0.5 rounded-lg border border-[#282838] mr-1">
              <button 
                onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#252538] text-gray-300 hover:text-white transition"
                title="Alejar"
                aria-label="Alejar"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setZoom(1)}
                className="px-2 h-8 flex items-center justify-center rounded-md text-xs text-gray-300 hover:text-white font-mono"
                title="Restablecer zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button 
                onClick={() => setZoom(prev => Math.min(3, prev + 0.25))}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#252538] text-gray-300 hover:text-white transition"
                title="Acercar"
                aria-label="Acercar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Download Original File Button */}
          {displayUrl && (
            <a 
              href={displayUrl} 
              download={currentFile.file_name}
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 min-w-[40px] px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-cyan-950/40 transition flex-shrink-0 touch-manipulation"
              title="Descargar archivo original preservado de R2"
              aria-label="Descargar archivo original"
            >
              <Download className="w-4 h-4 flex-shrink-0" />
              <span className="hidden xs:inline">Descargar</span>
            </a>
          )}

          {/* Close Visor Button */}
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#1e1e2c] hover:bg-[#28283c] active:bg-[#32324a] text-gray-300 hover:text-white border border-[#2e2e42] transition flex-shrink-0 touch-manipulation"
            title="Cerrar visor"
            aria-label="Cerrar visor"
          >
            <X className="w-5 h-5 flex-shrink-0" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div 
        className="relative flex-1 flex items-center justify-center overflow-hidden w-full h-full min-h-0"
        onClick={e => e.stopPropagation()}
      >
        {/* Prev button */}
        {hasPrev && (
          <button 
            onClick={handlePrev}
            className="absolute left-2 md:left-4 z-10 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white border border-gray-700/60 transition shadow-lg"
            title="Anterior"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Media render */}
        <div className="max-w-full max-h-full flex items-center justify-center overflow-auto p-2">
          {/* 1. Images */}
          {isImage && displayUrl && (
            <img 
              loading="lazy" 
              decoding="async" 
              src={displayUrl} 
              alt={currentFile.file_name}
              style={{ transform: `scale(${zoom})`, transition: 'transform 0.15s ease-out' }}
              className="max-h-[75vh] max-w-[85vw] object-contain rounded-lg shadow-2xl select-none"
            />
          )}

          {/* 2. Videos */}
          {isVideo && displayUrl && (
            <div className="w-full max-w-4xl bg-black rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
              <video 
                src={displayUrl} 
                controls 
                autoPlay
                playsInline
                className="w-full max-h-[70vh] object-contain"
              >
                Tu navegador no soporta la reproducción directa de este vídeo.
              </video>
            </div>
          )}

          {/* 3. Audio */}
          {isAudio && displayUrl && (
            <div className="bg-[#1c1c28] border border-[#2b2b3d] p-8 rounded-2xl max-w-lg w-full text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-800/40 flex items-center justify-center mx-auto text-cyan-400">
                <Music className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-white">{currentFile.display_name || currentFile.file_name}</h4>
                <p className="text-xs text-gray-400 font-mono mt-1">{formatSize(currentFile.file_size)} • {currentFile.mime_type}</p>
              </div>
              <audio 
                src={displayUrl} 
                controls 
                autoPlay
                className="w-full mt-4" 
              />
            </div>
          )}

          {/* 4. Text and Code files */}
          {isText && (
            <div className="bg-[#15151f] border border-[#2b2b3d] rounded-2xl max-w-4xl w-full h-[75vh] flex flex-col overflow-hidden shadow-2xl">
              {/* Text viewer toolbar */}
              <div className="px-4 py-2.5 bg-[#1a1a27] border-b border-[#29293c] flex items-center justify-between gap-3 text-xs flex-shrink-0">
                <div className="flex items-center gap-2">
                  {(() => {
                    const badge = getFileExtensionBadge(currentFile.file_name);
                    return (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider ${badge.color} ${badge.border} ${badge.bg}`}>
                        {badge.label}
                      </span>
                    );
                  })()}
                  <span className="font-semibold text-white truncate max-w-sm">
                    {currentFile.display_name || currentFile.file_name}
                  </span>
                  {textContent && (
                    <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                      ({textContent.split('\n').length} líneas • {formatSize(currentFile.file_size)})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setWrapText(prev => !prev)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition flex items-center gap-1 ${
                      wrapText
                        ? 'bg-cyan-950/70 border-cyan-800/60 text-cyan-300'
                        : 'bg-[#1e1e2c] border-[#2e2e40] text-gray-400 hover:text-white'
                    }`}
                    title="Alternar ajuste de línea"
                  >
                    <AlignLeft className="w-3 h-3" />
                    <span className="hidden sm:inline">Ajuste</span>
                  </button>
                  <button
                    onClick={handleCopyText}
                    disabled={!textContent}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#1e1e2c] hover:bg-[#28283c] border border-[#2e2e40] text-gray-200 transition flex items-center gap-1 disabled:opacity-40"
                    title="Copiar contenido"
                  >
                    {copiedText ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-300">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-gray-400" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Text content area with line numbers */}
              <div className="flex-1 overflow-auto p-4 font-mono text-xs select-text bg-[#0e0e14]">
                {isLoadingText ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                    <span>Cargando contenido del documento...</span>
                  </div>
                ) : textContent !== null ? (
                  <div className="flex gap-3 leading-relaxed text-gray-200">
                    {/* Line numbers */}
                    <div className="text-gray-600 text-right select-none pr-3 border-r border-[#222233] shrink-0 font-mono text-[11px]">
                      {textContent.split('\n').map((_, idx) => (
                        <div key={idx}>{idx + 1}</div>
                      ))}
                    </div>
                    {/* Text code */}
                    <pre className={`flex-1 font-mono text-gray-200 text-xs ${wrapText ? 'whitespace-pre-wrap break-words' : 'whitespace-pre overflow-x-auto'}`}>
                      {textContent}
                    </pre>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <FileText className="w-8 h-8 opacity-40 mb-1" />
                    <span>No hay contenido de texto disponible.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. PDF Documents */}
          {isPdf && displayUrl && (
            <div className="w-full max-w-5xl h-[78vh] bg-[#1a1a24] rounded-2xl overflow-hidden border border-[#2d2d3e] flex flex-col shadow-2xl">
              <div className="px-4 py-2.5 bg-[#12121a] border-b border-[#252535] flex items-center justify-between text-xs text-gray-300 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/70 text-rose-400 border border-rose-800/50">PDF</span>
                  <span className="font-semibold text-white truncate max-w-md">{currentFile.display_name || currentFile.file_name}</span>
                </div>
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
                >
                  Abrir en pestaña nueva <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <iframe
                src={displayUrl}
                title={currentFile.file_name}
                className="w-full flex-1 border-0 bg-white"
              />
            </div>
          )}

          {/* 6. Other Documents (DOCX, ZIP, etc.) */}
          {!isImage && !isVideo && !isAudio && !isText && !isPdf && (
            <div className="bg-[#181824] border border-[#2b2b3d] p-8 rounded-2xl max-w-md w-full text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-indigo-950/60 border border-indigo-800/40 flex items-center justify-center mx-auto text-indigo-400">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-white break-words">{currentFile.display_name || currentFile.file_name}</h4>
                <p className="text-xs text-gray-400 font-mono mt-1">{formatSize(currentFile.file_size)} • {currentFile.mime_type || 'Documento'}</p>
              </div>
              <p className="text-xs text-gray-400">
                Este tipo de archivo no cuenta con visualizador directo en el navegador. Puedes descargarlo o abrirlo externamente.
              </p>
              {displayUrl && (
                <div className="pt-2 flex justify-center gap-2">
                  <a
                    href={displayUrl}
                    download={currentFile.file_name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg transition"
                  >
                    <Download className="w-4 h-4" />
                    Descargar Archivo
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Next button */}
        {hasNext && (
          <button 
            onClick={handleNext}
            className="absolute right-2 md:right-4 z-10 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white border border-gray-700/60 transition shadow-lg"
            title="Siguiente"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Footer Info & Relations */}
      <div 
        className="w-full bg-[#14141c]/95 border-t border-[#232332] px-3 sm:px-6 py-2 sm:py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] flex flex-wrap items-center justify-between gap-2.5 text-xs text-gray-300 z-20 flex-shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-gray-400">
            <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono text-gray-200">{formatSize(currentFile.file_size)}</span>
            <span>({currentFile.storage_provider || 'r2'})</span>
          </div>

          <div className="flex items-center gap-1.5 text-gray-400">
            <Calendar className="w-3.5 h-3.5 text-purple-400" />
            <span>{formatDate(currentFile.created_at)}</span>
          </div>

          {currentFile.tags && currentFile.tags.length > 0 && (
            <div className="flex items-center gap-1">
              <Tag className="w-3 h-3 text-emerald-400" />
              {currentFile.tags.map(t => (
                <span key={t} className="px-1.5 py-0.5 rounded bg-gray-800 text-[10px] text-gray-300">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Related entities links */}
        {currentFile.relations && currentFile.relations.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-[11px]">Vinculado a:</span>
            {currentFile.relations.map(rel => (
              <button
                key={rel.id}
                onClick={() => onNavigateToEntity && onNavigateToEntity(rel.entity_id, rel.entity_type)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#20202e] hover:bg-cyan-950/60 text-cyan-300 border border-gray-700/60 text-[11px] transition"
              >
                <span>{rel.entity_type}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
