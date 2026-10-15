import React, { useState, useRef } from 'react';
import { 
  Paperclip, 
  Upload, 
  Download, 
  Trash2, 
  ExternalLink, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music, 
  Check, 
  Sparkles,
  Link2
} from 'lucide-react';
import { AppAttachment } from '../lib/types';
import { r2Storage } from '../lib/r2Client';
import { db } from '../lib/insforge';

interface EntityAttachmentsSectionProps {
  entityId: string;
  entityType: 'note' | 'task' | 'project' | 'object';
  attachments: AppAttachment[];
  onAttachmentCreated: (attachment: AppAttachment) => void;
  onAttachmentDeleted: (id: string, path: string) => void;
}

export const EntityAttachmentsSection: React.FC<EntityAttachmentsSectionProps> = ({
  entityId,
  entityType,
  attachments,
  onAttachmentCreated,
  onAttachmentDeleted
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter attachments directly related to this entity or through relations
  const relevantAttachments = attachments.filter(a => {
    if (a.entity_id === entityId) return true;
    if (a.relations && a.relations.some(r => r.entity_id === entityId)) return true;
    return false;
  });

  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      setIsUploading(true);
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const res = await r2Storage.uploadFile(file, `${entityType}s/${entityId}`);

        const created = await db.recordAttachment({
          entity_id: entityId,
          entity_type: entityType,
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

        if (created) {
          onAttachmentCreated(created);
        }
      }
    } catch (err: any) {
      alert('Error adjuntando archivo a R2: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCopyLink = (file: AppAttachment) => {
    navigator.clipboard.writeText(file.file_url);
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="mt-6 border-t border-[#262638] pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-300 flex items-center gap-2">
          <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
          <span>Archivos Adjuntos ({relevantAttachments.length})</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/40 font-mono">
            R2 Cloudflare
          </span>
        </h4>

        <div>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e1e2c] hover:bg-[#272738] text-cyan-300 border border-[#2d2d42] transition shadow-sm"
          >
            <Upload className={`w-3 h-3 ${isUploading ? 'animate-bounce' : ''}`} />
            <span>{isUploading ? 'Subiendo a R2...' : 'Adjuntar Archivo'}</span>
          </button>
        </div>
      </div>

      {relevantAttachments.length === 0 ? (
        <div className="p-4 rounded-xl bg-[#14141d] border border-dashed border-[#29293a] text-center text-xs text-gray-500">
          No hay archivos adjuntos en este registro. Adjunta documentos, fotos o audios para acceder a ellos sin duplicar almacenamiento.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {relevantAttachments.map(file => {
            const isImg = file.mime_type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.file_name);
            const isAudio = file.mime_type?.startsWith('audio/');
            const isVideo = file.mime_type?.startsWith('video/');

            return (
              <div
                key={file.id}
                className="p-2.5 rounded-xl bg-[#171722] border border-[#252538] hover:border-cyan-500/40 flex items-center justify-between gap-3 group transition"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-9 h-9 rounded-lg bg-[#111118] border border-[#232332] flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {isImg ? (
                      <img src={file.file_url} alt="" className="w-full h-full object-cover" />
                    ) : isVideo ? (
                      <Film className="w-4 h-4 text-purple-400" />
                    ) : isAudio ? (
                      <Music className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <FileText className="w-4 h-4 text-cyan-400" />
                    )}
                  </div>

                  <div className="overflow-hidden">
                    <p className="text-xs font-medium text-white truncate" title={file.display_name || file.file_name}>
                      {file.display_name || file.file_name}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono">
                      {formatSize(file.file_size)} • {file.storage_provider || 'r2'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(file)}
                    className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition"
                    title="Copiar enlace"
                  >
                    {copiedId === file.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Link2 className="w-3 h-3" />}
                  </button>

                  <a
                    href={file.file_url}
                    download={file.file_name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition"
                    title="Descargar original"
                  >
                    <Download className="w-3 h-3" />
                  </a>

                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm(`¿Eliminar ${file.display_name || file.file_name}?`)) {
                        await r2Storage.deleteFile(file);
                        onAttachmentDeleted(file.id, file.file_path);
                      }
                    }}
                    className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
