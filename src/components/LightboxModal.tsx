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
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 md:p-6"
      onClick={onClose}
    >
      {/* Top Header */}
      <div 
        className="flex items-center justify-between text-white pb-3 border-b border-gray-800"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold truncate max-w-xs md:max-w-md">
            {currentFile.display_name || currentFile.file_name}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
            {currentIndex + 1} / {files.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isImage && (
            <>
              <button 
                onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
                className="p-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white"
                title="Alejar"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setZoom(1)}
                className="px-2 py-1 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-xs text-gray-300 font-mono"
                title="Restablecer zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button 
                onClick={() => setZoom(prev => Math.min(3, prev + 0.25))}
                className="p-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white"
                title="Acercar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </>
          )}

          <a 
            href={currentFile.file_url} 
            download={currentFile.file_name}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition"
            title="Descargar archivo original preservado"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar original</span>
          </a>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div 
        className="relative flex-1 flex items-center justify-center overflow-hidden my-4"
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
              src={currentFile.file_url} 
              alt={currentFile.file_name}
              style={{ transform: `scale(${zoom})`, transition: 'transform 0.15s ease-out' }}
              className="max-h-[75vh] max-w-[85vw] object-contain rounded-lg shadow-2xl select-none"
            />
          )}

          {isVideo && (
            <div className="w-full max-w-4xl bg-black rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
              <video 
                src={currentFile.file_url} 
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
                src={currentFile.file_url} 
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

      {/* Footer Info & Relations */}
      <div 
        className="bg-[#14141c]/90 border border-gray-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 flex-wrap">
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
