import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Editor, EditorContent } from '@tiptap/react';
import {
  FileText,
  Globe,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Download,
  Calendar,
  Clock,
  BookOpen,
  Share2,
  Paperclip,
  Trash2,
  Edit3,
  X,
  Plus,
  Camera,
  Loader2,
  AlertCircle,
  Link as LinkIcon,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Minus,
  Table as TableIcon,
  Image as ImageIcon,
  Mic,
  Undo,
  Redo,
  Highlighter,
  Maximize2,
  Minimize2,
  Columns,
  Rows,
  AlignLeft,
  Search,
  Tag
} from 'lucide-react';
import {
  AppObject,
  AppProject,
  AppArea,
  AppNote,
  AppAttachment,
  AppLink
} from '../lib/types';
import { db } from '../lib/insforge';
import { r2Storage } from '../lib/r2Client';
import { cleanPastedHtml, plainTextToHtml, uploadBase64ImagesToR2 } from '../lib/htmlPasteCleaner';
import { EntityAttachmentsSection } from './EntityAttachmentsSection';
import { TableGridPicker } from './TableGridPicker';
import { TableToolbar } from './TableToolbar';

export interface PageDocumentViewProps {
  object: AppObject;
  properties: Record<string, any>;
  onPropertyChange: (key: string, val: any) => void;
  title: string;
  onTitleChange: (newTitle: string) => void;
  description: string;
  onDescriptionChange: (newDesc: string) => void;
  thumbnailUrl: string;
  onThumbnailUrlChange: (newUrl: string) => void;
  editor: Editor | null;
  editorImageInputRef: React.RefObject<HTMLInputElement>;
  onUploadImage: (file: File) => Promise<void>;
  allObjects: AppObject[];
  projects: AppProject[];
  areas: AppArea[];
  notes: AppNote[];
  attachments: AppAttachment[];
  onAttachmentCreated: (att: AppAttachment) => void;
  onAttachmentDeleted: (id: string, path: string) => void;
  outgoingLinks: AppLink[];
  incomingLinks: AppLink[];
  onOpenLinkSelector: () => void;
  onOpenNote?: (note: AppNote) => void;
  onNavigateToObject?: (object: AppObject) => void;
  onNavigateToEntity?: (id: string, type: string) => void;
  onSaveStatusChange: (status: 'saved' | 'saving' | 'dirty') => void;
  onOpenAudioModal?: () => void;
}

interface WebScrapeResult {
  title: string;
  description: string;
  ogImage: string;
  siteName: string;
  favicon: string;
  contentHtml?: string;
  wordCount?: number;
  readingTimeMinutes?: number;
}

export const PageDocumentView: React.FC<PageDocumentViewProps> = ({
  object,
  properties,
  onPropertyChange,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  thumbnailUrl,
  onThumbnailUrlChange,
  editor,
  editorImageInputRef,
  onUploadImage,
  allObjects,
  projects,
  areas,
  notes,
  attachments,
  onAttachmentCreated,
  onAttachmentDeleted,
  outgoingLinks,
  incomingLinks,
  onOpenLinkSelector,
  onOpenNote,
  onNavigateToObject,
  onNavigateToEntity,
  onSaveStatusChange,
  onOpenAudioModal
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'document' | 'properties' | 'relations' | 'attachments'>('document');

  // URL States & Metadata
  const sourceUrl = properties.source_url || properties.url_origen || properties.url || '';
  const siteName = properties.site_name || properties.sitio_web || '';
  const subtitle = properties.subtitle || properties.subtitulo || '';
  const summary = properties.summary || properties.resumen || description || '';

  const [urlInput, setUrlInput] = useState(sourceUrl);
  const [isCopiedUrl, setIsCopiedUrl] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [metadataFeedback, setMetadataFeedback] = useState<string | null>(null);

  // Web Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importUrl, setImportUrl] = useState(sourceUrl);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<WebScrapeResult | null>(null);
  const [importOptions, setImportOptions] = useState({
    updateTitle: true,
    updateDescription: true,
    updateCover: true
  });

  // Editor Display mode
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);
  const [isUploadingPastedImage, setIsUploadingPastedImage] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  // Sync urlInput when properties change
  useEffect(() => {
    setUrlInput(sourceUrl);
  }, [sourceUrl]);

  // Derived Domain name
  const sourceDomain = useMemo(() => {
    if (!sourceUrl) return null;
    try {
      const u = new URL(sourceUrl);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }, [sourceUrl]);

  // Editor stats
  const editorStats = useMemo(() => {
    if (!editor) return { words: 0, characters: 0, readingTime: 1 };
    const text = editor.getText();
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const characters = text.length;
    const readingTime = Math.max(1, Math.ceil(words / 200));
    return { words, characters, readingTime };
  }, [editor?.getText()]);

  // Copy source URL
  const handleCopyUrl = () => {
    if (sourceUrl) {
      navigator.clipboard.writeText(sourceUrl);
      setIsCopiedUrl(true);
      setTimeout(() => setIsCopiedUrl(false), 2000);
    }
  };

  // Open source URL in new tab
  const handleOpenSourceUrl = () => {
    if (sourceUrl) {
      window.open(sourceUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Commit URL input
  const handleSaveSourceUrl = (newUrl: string) => {
    const trimmed = newUrl.trim();
    onPropertyChange('source_url', trimmed);
    onPropertyChange('url_origen', trimmed);
    onSaveStatusChange('dirty');
  };

  // Fetch Web Metadata (Title, Description, OG Image, Site Name)
  const handleFetchMetadata = async (targetUrl = sourceUrl) => {
    if (!targetUrl || !targetUrl.trim()) {
      alert('Por favor ingresa una URL válida primero.');
      return;
    }

    try {
      setIsFetchingMetadata(true);
      setMetadataFeedback(null);

      const res = await fetch('/api/web-scraper/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudieron extraer metadatos del sitio web.');
      }

      // Update source metadata
      if (data.siteName) {
        onPropertyChange('site_name', data.siteName);
      }
      if (data.favicon) {
        onPropertyChange('favicon', data.favicon);
      }

      let appliedFields: string[] = [];

      // Only update title if currently empty or user confirms
      if (data.title && (!title || title === 'Página sin título' || title === 'Nueva Página')) {
        onTitleChange(data.title);
        appliedFields.push('título');
      }

      // Only update description if empty
      if (data.description && !description) {
        onDescriptionChange(data.description);
        onPropertyChange('summary', data.description);
        appliedFields.push('resumen');
      }

      // Only update cover image if empty
      if (data.ogImage && !thumbnailUrl) {
        onThumbnailUrlChange(data.ogImage);
        onPropertyChange('cover_url', data.ogImage);
        appliedFields.push('imagen de portada');
      }

      onSaveStatusChange('dirty');

      if (appliedFields.length > 0) {
        setMetadataFeedback(`Metadatos aplicados: ${appliedFields.join(', ')}.`);
      } else {
        setMetadataFeedback('Metadatos verificados. Los campos existentes se mantuvieron intactos.');
      }
      setTimeout(() => setMetadataFeedback(null), 4000);
    } catch (err: any) {
      console.warn('Error recuperando metadatos web:', err);
      alert(`No se pudieron obtener los metadatos: ${err.message || 'Error de conexión'}`);
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  // Run Web Article Scraper and preview
  const handleStartImport = async () => {
    if (!importUrl || !importUrl.trim()) {
      setImportError('Por favor introduce una dirección URL completa.');
      return;
    }

    try {
      setIsImporting(true);
      setImportError(null);
      setImportResult(null);

      const res = await fetch('/api/web-scraper/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo importar el contenido del sitio web.');
      }

      setImportResult(data);
    } catch (err: any) {
      console.warn('Error importando página web:', err);
      setImportError(err.message || 'Error desconocido contactando al servidor.');
    } finally {
      setIsImporting(false);
    }
  };

  // Confirm import and insert into editor
  const handleConfirmImport = async () => {
    if (!importResult || !editor) return;

    try {
      // 1. Set source URL
      onPropertyChange('source_url', importUrl.trim());
      onPropertyChange('url_origen', importUrl.trim());

      if (importResult.siteName) {
        onPropertyChange('site_name', importResult.siteName);
      }
      if (importResult.favicon) {
        onPropertyChange('favicon', importResult.favicon);
      }

      // 2. Optional Title
      if (importOptions.updateTitle && importResult.title) {
        onTitleChange(importResult.title);
      }

      // 3. Optional Description
      if (importOptions.updateDescription && importResult.description) {
        onDescriptionChange(importResult.description);
        onPropertyChange('summary', importResult.description);
      }

      // 4. Optional Cover Image
      if (importOptions.updateCover && importResult.ogImage) {
        onThumbnailUrlChange(importResult.ogImage);
        onPropertyChange('cover_url', importResult.ogImage);
      }

      // 5. Clean HTML and convert base64 images to R2
      const rawHtml = importResult.contentHtml || '';
      const cleaned = cleanPastedHtml(rawHtml);
      const withR2Images = await uploadBase64ImagesToR2(cleaned, `pages/${object.id}/web-imports`);

      // Set content in editor
      editor.commands.setContent(withR2Images || '<p>Contenido importado sin texto legible.</p>');
      onSaveStatusChange('dirty');

      setIsImportModalOpen(false);
      setImportResult(null);
    } catch (err: any) {
      alert(`Error al insertar el contenido importado: ${err.message}`);
    }
  };

  // Upload custom cover to R2
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await r2Storage.uploadFile(file, `pages/${object.id}/cover`);
      if (res?.url) {
        onThumbnailUrlChange(res.url);
        onPropertyChange('cover_url', res.url);
        onPropertyChange('photo_url', res.url);
        onSaveStatusChange('dirty');
      }
    } catch (err: any) {
      alert('Error subiendo imagen de portada: ' + (err.message || 'Error'));
    } finally {
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  // Table manipulation helpers
  const insertTable = () => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    onSaveStatusChange('dirty');
  };

  const addColumnBefore = () => editor?.chain().focus().addColumnBefore().run();
  const addColumnAfter = () => editor?.chain().focus().addColumnAfter().run();
  const deleteColumn = () => editor?.chain().focus().deleteColumn().run();
  const addRowBefore = () => editor?.chain().focus().addRowBefore().run();
  const addRowAfter = () => editor?.chain().focus().addRowAfter().run();
  const deleteRow = () => editor?.chain().focus().deleteRow().run();
  const toggleHeaderRow = () => editor?.chain().focus().toggleHeaderRow().run();
  const deleteTable = () => editor?.chain().focus().deleteTable().run();

  // Link Dialog
  const handleToggleLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = prompt('Introduce la dirección URL del enlace:', previousUrl || 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
    onSaveStatusChange('dirty');
  };

  return (
    <div className="space-y-6">
      {/* Hidden Cover Input */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        onChange={handleCoverUpload}
        className="hidden"
      />

      {/* ==================================================== */}
      {/* 1. CABECERA PRINCIPAL DEL DOCUMENTO / PÁGINA */}
      {/* ==================================================== */}
      <div className="bg-[#181824] border border-[#2b2b3d] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xl relative overflow-hidden space-y-5">
        {/* Cover Image (if present or trigger to add) */}
        {thumbnailUrl ? (
          <div className="relative w-full h-48 sm:h-64 rounded-2xl overflow-hidden border border-[#2b2b3e] group bg-[#12121c] shadow-inner">
            <img
              src={thumbnailUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="px-3 py-1.5 bg-black/70 hover:bg-black text-white text-xs font-medium rounded-xl border border-white/20 transition flex items-center gap-1.5 shadow"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Cambiar portada</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onThumbnailUrlChange('');
                  onPropertyChange('cover_url', '');
                  onSaveStatusChange('dirty');
                }}
                className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900 text-red-200 text-xs font-medium rounded-xl border border-red-700/50 transition flex items-center gap-1.5 shadow"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Quitar portada</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between border-b border-[#262638] pb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              <span>Documento / Página Web</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-[#222232] transition"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Añadir portada</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setImportUrl(sourceUrl);
                  setIsImportModalOpen(true);
                }}
                className="text-xs text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-700/40 px-3 py-1 rounded-xl font-medium transition flex items-center gap-1.5 shadow-sm"
              >
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>Importar página web</span>
              </button>
            </div>
          </div>
        )}

        {/* Title & Subtitle */}
        <div className="space-y-1">
          <input
            type="text"
            value={title}
            onChange={e => onTitleChange(e.target.value)}
            placeholder="Título del documento..."
            className="w-full text-2xl sm:text-3xl md:text-4xl font-extrabold text-white bg-transparent border-0 border-b border-transparent hover:border-[#38384f] focus:border-indigo-500 outline-none pb-1 transition placeholder-gray-600 font-serif leading-tight"
          />
          <input
            type="text"
            value={subtitle}
            onChange={e => {
              onPropertyChange('subtitle', e.target.value);
              onPropertyChange('subtitulo', e.target.value);
              onSaveStatusChange('dirty');
            }}
            placeholder="Subtítulo, bajada o contexto breve..."
            className="w-full text-xs sm:text-sm text-gray-400 bg-transparent border-0 border-b border-transparent hover:border-[#38384f] focus:border-indigo-500 outline-none py-1 transition placeholder-gray-600"
          />
        </div>

        {/* URL de Origen Bar */}
        <div className="bg-[#12121b] border border-[#2b2b3e] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Globe className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-gray-400 whitespace-nowrap">
              URL de origen:
            </span>
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onBlur={() => handleSaveSourceUrl(urlInput)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveSourceUrl(urlInput);
              }}
              placeholder="https://ejemplo.com/articulo-original"
              className="flex-1 text-xs text-indigo-200 bg-transparent outline-none placeholder-gray-600 font-mono truncate"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-auto">
            {sourceDomain && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1e2d] text-gray-300 border border-[#303046] font-mono mr-1">
                {siteName || sourceDomain}
              </span>
            )}

            {sourceUrl && (
              <>
                <button
                  type="button"
                  onClick={handleOpenSourceUrl}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#20202e] transition"
                  title="Abrir página original en otra pestaña"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#20202e] transition"
                  title="Copiar enlace original"
                >
                  {isCopiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleFetchMetadata(sourceUrl)}
                  disabled={isFetchingMetadata}
                  className="px-2.5 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-700/40 text-[11px] font-medium transition flex items-center gap-1"
                  title="Completar título, resumen y portada con los metadatos de la URL"
                >
                  {isFetchingMetadata ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  <span>Metadatos</span>
                </button>
              </>
            )}

            {!thumbnailUrl && (
              <button
                type="button"
                onClick={() => {
                  setImportUrl(urlInput || sourceUrl);
                  setIsImportModalOpen(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold transition flex items-center gap-1 shadow"
              >
                <Download className="w-3 h-3" />
                <span>Importar texto</span>
              </button>
            )}
          </div>
        </div>

        {/* Feedback alert after fetching metadata */}
        {metadataFeedback && (
          <div className="text-xs px-3 py-2 rounded-xl bg-emerald-950/50 border border-emerald-800/40 text-emerald-300 flex items-center gap-2 animate-fadeIn">
            <Check className="w-3.5 h-3.5" />
            <span>{metadataFeedback}</span>
          </div>
        )}

        {/* Summary Field */}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">
            Resumen o Idea Principal
          </label>
          <textarea
            value={summary}
            onChange={e => {
              onDescriptionChange(e.target.value);
              onPropertyChange('summary', e.target.value);
              onPropertyChange('resumen', e.target.value);
              onSaveStatusChange('dirty');
            }}
            placeholder="Resumen ejecutivo del documento o artículo..."
            rows={2}
            className="w-full text-xs text-gray-300 bg-[#12121b] border border-[#2b2b3e] rounded-xl p-2.5 focus:border-indigo-500 outline-none resize-y leading-relaxed"
          />
        </div>

        {/* Document Stats & Metadata Bar */}
        <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-[#222232] flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{editorStats.words} palabras ({editorStats.readingTime} min de lectura)</span>
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">{editorStats.characters} caracteres</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span>Creado: {new Date(object.created_at).toLocaleDateString()}</span>
            <span>•</span>
            <span>Editado: {new Date(object.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 2. PESTAÑAS DE VISTA */}
      {/* ==================================================== */}
      <div className="flex items-center justify-between border-b border-[#252535] pb-2 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('document')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'document'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a26]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Documento</span>
          </button>

          <button
            onClick={() => setActiveTab('properties')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'properties'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a26]'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Propiedades</span>
          </button>

          <button
            onClick={() => setActiveTab('relations')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'relations'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a26]'
            }`}
          >
            <Share2 className="w-4 h-4" />
            <span>Vínculos</span>
            {(outgoingLinks.length + incomingLinks.length) > 0 && (
              <span className="text-[10px] px-1.5 rounded-full bg-white/20 text-white font-mono">
                {outgoingLinks.length + incomingLinks.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('attachments')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'attachments'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a26]'
            }`}
          >
            <Paperclip className="w-4 h-4" />
            <span>Archivos</span>
            {attachments.length > 0 && (
              <span className="text-[10px] px-1.5 rounded-full bg-white/20 text-white font-mono">
                {attachments.length}
              </span>
            )}
          </button>
        </div>

        {/* View Mode Toggle: Centered Reading vs Full Width */}
        {activeTab === 'document' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullWidth(!isFullWidth)}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#1f1f2e] transition text-xs flex items-center gap-1"
              title={isFullWidth ? 'Modo lectura centrado' : 'Modo ancho completo'}
            >
              {isFullWidth ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline text-[11px]">{isFullWidth ? 'Centrado' : 'Ancho completo'}</span>
            </button>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 3. PESTAÑA PRINCIPAL: EDITOR DE DOCUMENTO Y TABLAS */}
      {/* ==================================================== */}
      {activeTab === 'document' && (
        <div className={`space-y-3 ${isFullWidth ? 'w-full' : 'max-w-4xl mx-auto'}`}>
          {/* TipTap Advanced Formatting Toolbar */}
          {editor && (
            <div className="sticky top-0 z-20 bg-[#161622]/95 backdrop-blur-md border border-[#2b2b3d] rounded-2xl p-1.5 flex items-center gap-1 flex-wrap shadow-lg">
              {/* Headings */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-1.5 rounded-lg text-xs transition ${editor.isActive('heading', { level: 1 }) ? 'bg-indigo-600 text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-[#252538]'}`}
                title="Título 1 (H1)"
              >
                <Heading1 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-1.5 rounded-lg text-xs transition ${editor.isActive('heading', { level: 2 }) ? 'bg-indigo-600 text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-[#252538]'}`}
                title="Título 2 (H2)"
              >
                <Heading2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`p-1.5 rounded-lg text-xs transition ${editor.isActive('heading', { level: 3 }) ? 'bg-indigo-600 text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-[#252538]'}`}
                title="Título 3 (H3)"
              >
                <Heading3 className="w-4 h-4" />
              </button>

              <span className="w-[1px] h-4 bg-[#2b2b3e] mx-0.5" />

              {/* Inline Styling: Bold, Italic, Underline, Strike, Code, Highlight */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded-lg transition ${editor.isActive('bold') ? 'bg-indigo-600 text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-[#252538]'}`}
                title="Negrita (Ctrl+B)"
              >
                <Bold className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded-lg transition ${editor.isActive('italic') ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'}`}
                title="Cursiva (Ctrl+I)"
              >
                <Italic className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-1.5 rounded-lg transition ${editor.isActive('underline') ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'}`}
                title="Subrayado (Ctrl+U)"
              >
                <UnderlineIcon className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`p-1.5 rounded-lg transition ${editor.isActive('strike') ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'}`}
                title="Tachado"
              >
                <Strikethrough className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className={`p-1.5 rounded-lg transition ${editor.isActive('highlight') ? 'bg-amber-500/30 text-amber-300' : 'text-gray-400 hover:text-white hover:bg-[#252538]'}`}
                title="Resaltar texto"
              >
                <Highlighter className="w-4 h-4" />
              </button>

              <span className="w-[1px] h-4 bg-[#2b2b3e] mx-0.5" />

              {/* Lists: Bullets, Numbers, Tasks */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded-lg transition ${editor.isActive('bulletList') ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'}`}
                title="Lista con viñetas"
              >
                <List className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1.5 rounded-lg transition ${editor.isActive('orderedList') ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'}`}
                title="Lista numerada"
              >
                <ListOrdered className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className={`p-1.5 rounded-lg transition ${editor.isActive('taskList') ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'}`}
                title="Lista de tareas (Checklist)"
              >
                <CheckSquare className="w-4 h-4" />
              </button>

              <span className="w-[1px] h-4 bg-[#2b2b3e] mx-0.5" />

              {/* Blockquote, CodeBlock, HR */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-1.5 rounded-lg transition ${editor.isActive('blockquote') ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'}`}
                title="Cita destacada"
              >
                <Quote className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={`p-1.5 rounded-lg transition ${editor.isActive('codeBlock') ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'}`}
                title="Bloque de código"
              >
                <Code className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252538] transition"
                title="Línea divisoria horizontal"
              >
                <Minus className="w-4 h-4" />
              </button>

              <span className="w-[1px] h-4 bg-[#2b2b3e] mx-0.5" />

              {/* Visual Matrix Table Grid Picker */}
              <TableGridPicker
                editor={editor}
                iconClassName="w-4 h-4"
                onTableDeleted={() => onSaveStatusChange('dirty')}
              />

              {/* Link */}
              <button
                type="button"
                onClick={handleToggleLink}
                className={`p-1.5 rounded-lg transition ${editor.isActive('link') ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'}`}
                title="Añadir o editar enlace"
              >
                <LinkIcon className="w-4 h-4" />
              </button>

              {/* Image Upload Trigger */}
              <button
                type="button"
                onClick={() => editorImageInputRef.current?.click()}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252538] transition"
                title="Insertar imagen desde tu equipo (Cloudflare R2)"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              {/* Voice / Audio Note Trigger */}
              {onOpenAudioModal && (
                <button
                  type="button"
                  onClick={onOpenAudioModal}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 transition"
                  title="Grabar o insertar nota de voz en el documento"
                >
                  <Mic className="w-3.5 h-3.5 text-red-400" />
                  <span>Voz</span>
                </button>
              )}

              <span className="w-[1px] h-4 bg-[#2b2b3e] mx-0.5" />

              {/* Undo / Redo */}
              <button
                type="button"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 hover:bg-[#252538] transition"
                title="Deshacer (Ctrl+Z)"
              >
                <Undo className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 hover:bg-[#252538] transition"
                title="Rehacer (Ctrl+Y)"
              >
                <Redo className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Contextual Table Management Toolbar */}
          <TableToolbar
            editor={editor}
            className="rounded-xl border border-[#2b2b3d] shadow-lg mb-3"
            onTableDeleted={() => onSaveStatusChange('dirty')}
          />

          {/* Paste & Drop Helper Notification */}
          {isUploadingPastedImage && (
            <div className="p-3 bg-indigo-950/50 border border-indigo-700/50 rounded-xl text-xs text-indigo-300 flex items-center gap-2 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Subiendo imagen del portapapeles a Cloudflare R2...</span>
            </div>
          )}

          {/* Contextual Table Management Toolbar */}
          <TableToolbar
            editor={editor}
            className="rounded-xl border border-[#2b2b3d] shadow-lg mb-3"
            onTableDeleted={() => onSaveStatusChange('dirty')}
          />

          {/* Document Content Canvas */}
          <div className="bg-[#181824] border border-[#2b2b3d] rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 shadow-xl min-h-[600px] transition-all">
            {editor ? (
              <EditorContent
                editor={editor}
                className="prose prose-invert max-w-none focus:outline-none text-sm leading-relaxed"
              />
            ) : (
              <div className="py-24 text-center text-gray-500 text-xs flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                <p>Cargando editor avanzado...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. PESTAÑA: PROPIEDADES PERSONALIZADAS */}
      {/* ==================================================== */}
      {activeTab === 'properties' && (
        <div className="bg-[#181824] border border-[#2b2b3d] rounded-2xl p-6 space-y-4 max-w-4xl mx-auto">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-400" />
            <span>Propiedades del Documento</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-[10px] text-gray-400 uppercase font-semibold">Sitio Web / Fuente</label>
              <input
                type="text"
                value={siteName}
                onChange={e => {
                  onPropertyChange('site_name', e.target.value);
                  onSaveStatusChange('dirty');
                }}
                placeholder="Ej. The New York Times, Medium..."
                className="w-full bg-[#12121b] border border-[#2b2b3e] rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500 mt-1"
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 uppercase font-semibold">URL de Portada</label>
              <input
                type="url"
                value={thumbnailUrl}
                onChange={e => {
                  onThumbnailUrlChange(e.target.value);
                  onPropertyChange('cover_url', e.target.value);
                  onSaveStatusChange('dirty');
                }}
                placeholder="https://..."
                className="w-full bg-[#12121b] border border-[#2b2b3e] rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500 mt-1 font-mono text-[11px]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. PESTAÑA: VÍNCULOS Y RELACIONES */}
      {/* ==================================================== */}
      {activeTab === 'relations' && (
        <div className="bg-[#181824] border border-[#2b2b3d] rounded-2xl p-6 space-y-4 max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-indigo-400" />
                <span>Vínculos y Backlinks de la Página</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Conecta este documento con proyectos, libros, notas o personas de tu Segundo Cerebro.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenLinkSelector}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir vínculo</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Outgoing */}
            <div className="bg-[#12121b] border border-[#2b2b3e] rounded-xl p-4 space-y-3">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Vínculos Salientes ({outgoingLinks.length})
              </span>
              {outgoingLinks.length === 0 ? (
                <p className="text-xs text-gray-500 py-2">Sin vínculos directos.</p>
              ) : (
                <div className="space-y-2">
                  {outgoingLinks.map(link => (
                    <div
                      key={link.id}
                      onClick={() => {
                        const targetId = link.to_id || link.target_id;
                        const targetType = link.to_type || link.target_type || 'object';
                        if (targetId && onNavigateToEntity) {
                          onNavigateToEntity(targetId, targetType);
                        }
                      }}
                      className="p-2.5 bg-[#181826] border border-[#272738] rounded-lg hover:border-indigo-500/40 cursor-pointer transition flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-white truncate">
                        {link.target_title || link.relation_label || 'Elemento vinculado'}
                      </span>
                      <span className="text-[10px] text-indigo-400 font-mono">
                        {link.to_type || link.target_type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Incoming / Backlinks */}
            <div className="bg-[#12121b] border border-[#2b2b3e] rounded-xl p-4 space-y-3">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Menciones y Backlinks ({incomingLinks.length})
              </span>
              {incomingLinks.length === 0 ? (
                <p className="text-xs text-gray-500 py-2">Ningún otro elemento referencia esta página.</p>
              ) : (
                <div className="space-y-2">
                  {incomingLinks.map(link => (
                    <div
                      key={link.id}
                      onClick={() => {
                        const sourceId = link.from_id || link.source_id;
                        const sourceType = link.from_type || link.source_type || 'object';
                        if (sourceId && onNavigateToEntity) {
                          onNavigateToEntity(sourceId, sourceType);
                        }
                      }}
                      className="p-2.5 bg-[#181826] border border-[#272738] rounded-lg hover:border-indigo-500/40 cursor-pointer transition flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-white truncate">
                        {link.relation_label || 'Referenciado desde'}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {link.from_type || link.source_type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. PESTAÑA: ARCHIVOS ADJUNTOS */}
      {/* ==================================================== */}
      {activeTab === 'attachments' && (
        <div className="bg-[#181824] border border-[#2b2b3d] rounded-2xl p-6 space-y-4 max-w-4xl mx-auto">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-indigo-400" />
              <span>Archivos Adjuntos en Cloudflare R2</span>
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Documentos complementarios, imágenes originales y PDFs vinculados a esta página.
            </p>
          </div>

          <EntityAttachmentsSection
            entityId={object.id}
            entityType="object"
            attachments={attachments}
            onAttachmentCreated={onAttachmentCreated}
            onAttachmentDeleted={onAttachmentDeleted}
          />
        </div>
      )}

      {/* ==================================================== */}
      {/* 7. MODAL: IMPORTAR PÁGINA WEB */}
      {/* ==================================================== */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181826] border border-[#2b2b3d] rounded-2xl sm:rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-5 animate-scaleUp max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#2b2b3e] pb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white">Importar Contenido Web</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportResult(null);
                  setImportError(null);
                }}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Input URL */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-300 block">
                Introduce la dirección del artículo o página web
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={importUrl}
                  onChange={e => setImportUrl(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleStartImport();
                  }}
                  placeholder="https://ejemplo.com/articulo-a-importar"
                  className="flex-1 bg-[#12121b] border border-[#2b2b3e] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleStartImport}
                  disabled={isImporting || !importUrl.trim()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center gap-2 shadow"
                >
                  {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>{isImporting ? 'Analizando...' : 'Analizar'}</span>
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                La importación extrae el artículo principal eliminando anuncios, menús y navegación para convertirlo en texto editable.
              </p>
            </div>

            {/* Error Message */}
            {importError && (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs space-y-1 animate-fadeIn">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>No se pudo importar la página web</span>
                </div>
                <p className="leading-relaxed pl-6">{importError}</p>
                <p className="text-[11px] text-gray-400 pl-6 pt-1">
                  💡 Sugerencia: Puedes abrir el artículo original, seleccionar el contenido deseado con Ctrl+C y pegarlo directamente en el editor con Ctrl+V conservando todo su formato.
                </p>
              </div>
            )}

            {/* Scrape Preview & Options */}
            {importResult && (
              <div className="space-y-4 pt-2 border-t border-[#262638] animate-fadeIn">
                <div className="bg-[#12121b] border border-[#2a2a3e] rounded-2xl p-4 space-y-3">
                  <div className="flex items-start gap-4">
                    {importResult.ogImage && (
                      <img
                        src={importResult.ogImage}
                        alt=""
                        className="w-24 h-20 rounded-xl object-cover border border-[#303046] flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-indigo-400 font-mono uppercase font-bold block">
                        {importResult.siteName || 'Artículo web'}
                      </span>
                      <h4 className="font-bold text-sm text-white line-clamp-2 mt-0.5">
                        {importResult.title}
                      </h4>
                      {importResult.description && (
                        <p className="text-xs text-gray-400 line-clamp-2 mt-1 leading-relaxed">
                          {importResult.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-2 font-mono">
                        <span>{importResult.wordCount} palabras</span>
                        <span>•</span>
                        <span>~{importResult.readingTimeMinutes} min de lectura</span>
                      </div>
                    </div>
                  </div>

                  {/* Options Checkboxes */}
                  <div className="pt-2 border-t border-[#222232] grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-300">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importOptions.updateTitle}
                        onChange={e => setImportOptions({ ...importOptions, updateTitle: e.target.checked })}
                        className="rounded accent-indigo-600"
                      />
                      <span>Actualizar título</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importOptions.updateDescription}
                        onChange={e => setImportOptions({ ...importOptions, updateDescription: e.target.checked })}
                        className="rounded accent-indigo-600"
                      />
                      <span>Actualizar resumen</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importOptions.updateCover}
                        onChange={e => setImportOptions({ ...importOptions, updateCover: e.target.checked })}
                        className="rounded accent-indigo-600"
                      />
                      <span>Usar imagen portada</span>
                    </label>
                  </div>
                </div>

                {/* Content Preview Box */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                    Vista previa del texto extraído:
                  </span>
                  <div className="max-h-56 overflow-y-auto bg-[#101016] border border-[#232332] rounded-xl p-4 text-xs text-gray-300 leading-relaxed space-y-2">
                    <div
                      dangerouslySetInnerHTML={{ __html: importResult.contentHtml?.slice(0, 1500) + '...' }}
                    />
                  </div>
                </div>

                {/* Confirm Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImportResult(null);
                      setImportError(null);
                    }}
                    className="px-4 py-2 bg-[#232334] text-gray-300 hover:text-white rounded-xl text-xs font-semibold transition"
                  >
                    Volver a buscar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-900/40 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Insertar en la Página</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
