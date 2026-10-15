import React, { useState, useEffect, useRef } from 'react';
import { 
  HardDrive, 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  FileCheck, 
  Trash2, 
  Copy, 
  ExternalLink, 
  Check, 
  Download,
  Search,
  Sparkles
} from 'lucide-react';
import { AppAttachment } from '../lib/types';
import { storage, db } from '../lib/insforge';

interface StorageViewProps {
  attachments: AppAttachment[];
  onAttachmentCreated: (attachment: AppAttachment) => void;
  onAttachmentDeleted: (id: string, path: string) => void;
}

export const StorageView: React.FC<StorageViewProps> = ({
  attachments,
  onAttachmentCreated,
  onAttachmentDeleted
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'images' | 'documents'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    try {
      setIsUploading(true);
      const res = await storage.uploadFile(file, 'library');
      
      // Save record in app_attachments table
      const created = await db.recordAttachment({
        entity_id: '00000000-0000-0000-0000-000000000000', // General library
        entity_type: 'storage_library',
        file_name: res.name,
        file_url: res.url,
        file_path: res.path,
        bucket_name: 'app-storage',
        file_size: res.size,
        mime_type: res.mime
      });

      if (created) {
        onAttachmentCreated(created);
      }
    } catch (err: any) {
      alert('Error subiendo archivo: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyMarkdown = (attachment: AppAttachment) => {
    const isImg = attachment.mime_type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(attachment.file_name);
    const md = isImg 
      ? `![${attachment.file_name}](${attachment.file_url})`
      : `[${attachment.file_name}](${attachment.file_url})`;

    navigator.clipboard.writeText(md);
    setCopiedId(attachment.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = attachments.filter(a => {
    const matchesQuery = a.file_name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesQuery) return false;

    const isImg = a.mime_type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(a.file_name);
    if (filterType === 'images' && !isImg) return false;
    if (filterType === 'documents' && isImg) return false;
    return true;
  });

  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#16161d] overflow-hidden">
      {/* Header */}
      <div className="px-8 py-5 border-b border-[#252530] bg-[#141419] flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-cyan-400" />
            InsForge Storage (Archivos & Medios)
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Bucket público <code className="text-cyan-300 font-mono bg-cyan-950/40 px-1 rounded">app-storage</code> para imágenes y documentos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleUpload(e.target.files[0]);
              }
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-sm shadow-cyan-900/30"
          >
            <Upload className={`w-4 h-4 ${isUploading ? 'animate-bounce' : ''}`} />
            {isUploading ? 'Subiendo archivo...' : 'Subir Imagen o Documento'}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-8 py-3 bg-[#131318] border-b border-[#23232f] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              filterType === 'all' ? 'bg-[#22222e] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Todos ({attachments.length})
          </button>
          <button
            onClick={() => setFilterType('images')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              filterType === 'images' ? 'bg-[#22222e] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Imágenes
          </button>
          <button
            onClick={() => setFilterType('documents')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              filterType === 'documents' ? 'bg-[#22222e] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Documentos
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre..."
            className="pl-8 pr-3 py-1.5 bg-[#1a1a24] border border-[#2b2b3a] rounded-lg text-xs text-white placeholder-gray-500 outline-none w-56 focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Files Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        {filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#1c1c28] border border-[#2c2c3d] flex items-center justify-center mx-auto text-gray-400">
              <HardDrive className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-200">No hay archivos en el bucket</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Sube imágenes, capturas, PDFs o documentos. Podrás copiarlos directamente en sintaxis Markdown para tus notas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(item => {
              const isImg = item.mime_type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(item.file_name);
              const isCopied = copiedId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-[#1a1a24] rounded-xl border border-[#282836] hover:border-cyan-500/40 transition p-3.5 flex flex-col justify-between group shadow-sm"
                >
                  {/* Preview Thumbnail */}
                  <div className="h-32 rounded-lg bg-[#121217] border border-[#232330] flex items-center justify-center overflow-hidden mb-3 relative">
                    {isImg ? (
                      <img
                        src={item.file_url}
                        alt={item.file_name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-gray-400">
                        <FileText className="w-8 h-8 text-cyan-400" />
                        <span className="text-[10px] uppercase font-mono">{item.file_name.split('.').pop()}</span>
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="space-y-1 mb-3">
                    <div className="text-xs font-semibold text-white truncate" title={item.file_name}>
                      {item.file_name}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                      <span>{formatSize(item.file_size)}</span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-[#252535] flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleCopyMarkdown(item)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition ${
                        isCopied 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-[#22222e] hover:bg-cyan-950/40 text-cyan-300 hover:text-cyan-200 border border-[#2d2d3e]'
                      }`}
                      title="Copiar sintaxis Markdown para pegar en una nota"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3" />
                          ¡Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copiar MD
                        </>
                      )}
                    </button>

                    <a
                      href={item.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-[#252535] transition"
                      title="Abrir en pestaña nueva"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar ${item.file_name}?`)) {
                          onAttachmentDeleted(item.id, item.file_path);
                        }
                      }}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition"
                      title="Eliminar de Storage"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
