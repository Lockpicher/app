import React, { useState } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Calendar, 
  HardDrive, 
  Tag, 
  ExternalLink 
} from 'lucide-react';
import { AppAttachment } from '../lib/types';
import { r2Storage } from '../lib/r2Client';

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
  const [zoom, setZoom] = useState(1);
  const currentFile = files[currentIndex];

  if (!isOpen || !currentFile) return null;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < files.length - 1;

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

  const isVideo = currentFile.mime_type?.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(currentFile.file_name);
  const isAudio = currentFile.mime_type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|webm|oga)$/i.test(currentFile.file_name);
  const isImage = currentFile.mime_type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(currentFile.file_name);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between overflow-hidden select-none"
      onClick={onClose}
    >
      {/* Top Header - Fixed and safe-area aware */}
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

        {/* Right: Controls (Download & Close prioritized, Zoom responsive) */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Zoom controls (visible on tablets/desktops or screens > 480px) */}
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

          {/* Download Original File Button - Guaranteed visible with min 44x44px touch area */}
          <a 
            href={r2Storage.getDisplayUrl(currentFile)} 
            download={currentFile.file_name}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 min-w-[44px] px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-cyan-950/40 transition flex-shrink-0 touch-manipulation"
            title="Descargar archivo original preservado de R2"
            aria-label="Descargar archivo original"
          >
            <Download className="w-4 h-4 flex-shrink-0" />
            <span className="hidden xs:inline">Descargar</span>
          </a>

          {/* Close Visor Button - Guaranteed visible with min 44x44px touch area */}
          <button 
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-[#1e1e2c] hover:bg-[#28283c] active:bg-[#32324a] text-gray-300 hover:text-white border border-[#2e2e42] transition flex-shrink-0 touch-manipulation"
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
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Media render */}
        <div className="max-w-full max-h-full flex items-center justify-center overflow-auto p-2">
          {isImage && (
            <img 
              src={r2Storage.getDisplayUrl(currentFile)} 
              alt={currentFile.file_name}
              style={{ transform: `scale(${zoom})`, transition: 'transform 0.15s ease-out' }}
              className="max-h-[75vh] max-w-[85vw] object-contain rounded-lg shadow-2xl select-none"
            />
          )}

          {isVideo && (
            <div className="w-full max-w-4xl bg-black rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
              <video 
                src={r2Storage.getDisplayUrl(currentFile)} 
                controls 
                autoPlay
                playsInline
                className="w-full max-h-[70vh] object-contain"
              >
                Tu navegador no soporta la reproducción directa de este vídeo.
              </video>
            </div>
          )}

          {isAudio && (
            <div className="bg-[#1c1c28] border border-[#2b2b3d] p-8 rounded-2xl max-w-lg w-full text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-800/40 flex items-center justify-center mx-auto text-cyan-400">
                <HardDrive className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-white">{currentFile.display_name || currentFile.file_name}</h4>
                <p className="text-xs text-gray-400 font-mono mt-1">{formatSize(currentFile.file_size)} • {currentFile.mime_type}</p>
              </div>
              <audio 
                src={r2Storage.getDisplayUrl(currentFile)} 
                controls 
                autoPlay
                className="w-full mt-4" 
              />
            </div>
          )}
        </div>

        {/* Next button */}
        {hasNext && (
          <button 
            onClick={handleNext}
            className="absolute right-2 md:right-4 z-10 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white border border-gray-700/60 transition shadow-lg"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Footer Info & Relations - Safe-area aware on mobile */}
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
            <span>{new Date(currentFile.created_at).toLocaleString()}</span>
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
