import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Editor, EditorContent } from '@tiptap/react';
import {
  BookOpen,
  Bookmark,
  Calendar,
  Clock,
  Sparkles,
  Quote,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  Share2,
  FileText,
  Camera,
  Check,
  X,
  ChevronRight,
  Search,
  Tag,
  AlertCircle,
  Loader2,
  Paperclip,
  Star,
  CheckSquare,
  ArrowRight,
  Sliders,
  FileUp,
  Download,
  Copy,
  Layers,
  BookMarked,
  BarChart3,
  AlignLeft,
  Glasses,
  Mic
} from 'lucide-react';
import {
  AppObject,
  AppProject,
  AppArea,
  AppNote,
  AppAttachment,
  AppLink,
  BookIdea,
  BookQuote,
  BookReadingStatus,
  BookFormat
} from '../lib/types';
import { db } from '../lib/insforge';
import { r2Storage } from '../lib/r2Client';
import { DatePickerInput } from './DatePickerInput';
import { EntityAttachmentsSection } from './EntityAttachmentsSection';
import { BookPdfReaderModal } from './BookPdfReaderModal';
import { TableGridPicker } from './TableGridPicker';
import { TableToolbar } from './TableToolbar';

export interface BookProfileViewProps {
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

const READING_STATUSES: { id: BookReadingStatus; label: string; color: string; bg: string }[] = [
  { id: 'want_to_read', label: 'Por Leer', color: 'text-blue-400', bg: 'bg-blue-950/50 border-blue-800/40' },
  { id: 'reading', label: 'Leyendo Actualmente', color: 'text-amber-400', bg: 'bg-amber-950/50 border-amber-800/40' },
  { id: 'paused', label: 'En Pausa', color: 'text-gray-400', bg: 'bg-gray-800/50 border-gray-700/40' },
  { id: 'finished', label: 'Terminado', color: 'text-emerald-400', bg: 'bg-emerald-950/50 border-emerald-800/40' },
  { id: 'abandoned', label: 'Abandonado', color: 'text-red-400', bg: 'bg-red-950/50 border-red-800/40' }
];

const BOOK_FORMATS: { id: BookFormat; label: string }[] = [
  { id: 'physical', label: 'Libro Físico' },
  { id: 'pdf', label: 'PDF Digital' },
  { id: 'epub', label: 'EPUB' },
  { id: 'audiobook', label: 'Audiolibro' },
  { id: 'other', label: 'Otro Formato' }
];

export const BookProfileView: React.FC<BookProfileViewProps> = ({
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
  const [activeTab, setActiveTab] = useState<'summary' | 'reading' | 'ideas' | 'quotes' | 'notes' | 'files' | 'relations'>('summary');

  // Book Ideas state
  const [ideas, setIdeas] = useState<BookIdea[]>([]);
  const [isLoadingIdeas, setIsLoadingIdeas] = useState(false);
  const [isIdeaModalOpen, setIsIdeaModalOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<BookIdea | null>(null);
  const [ideaFormTitle, setIdeaFormTitle] = useState('');
  const [ideaFormContent, setIdeaFormContent] = useState('');
  const [ideaFormPage, setIdeaFormPage] = useState<string>('');
  const [ideaFormChapter, setIdeaFormChapter] = useState('');
  const [ideaFormTags, setIdeaFormTags] = useState('');
  const [ideaSearchQuery, setIdeaSearchQuery] = useState('');

  // Book Quotes state
  const [quotes, setQuotes] = useState<BookQuote[]>([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<BookQuote | null>(null);
  const [quoteFormText, setQuoteFormText] = useState('');
  const [quoteFormAuthor, setQuoteFormAuthor] = useState('');
  const [quoteFormPage, setQuoteFormPage] = useState<string>('');
  const [quoteFormChapter, setQuoteFormChapter] = useState('');
  const [quoteFormCommentary, setQuoteFormCommentary] = useState('');
  const [quoteFormTags, setQuoteFormTags] = useState('');
  const [quoteSearchQuery, setQuoteSearchQuery] = useState('');
  const [copiedQuoteId, setCopiedQuoteId] = useState<string | null>(null);

  // PDF Reader Modal State
  const [isReaderOpen, setIsReaderOpen] = useState(false);

  // Upload States
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  // Load Ideas and Quotes
  const loadIdeas = async () => {
    try {
      setIsLoadingIdeas(true);
      const data = await db.getBookIdeas(object.id);
      setIdeas(data);
    } catch (e) {
      console.warn('Error cargando ideas del libro:', e);
    } finally {
      setIsLoadingIdeas(false);
    }
  };

  const loadQuotes = async () => {
    try {
      setIsLoadingQuotes(true);
      const data = await db.getBookQuotes(object.id);
      setQuotes(data);
    } catch (e) {
      console.warn('Error cargando citas del libro:', e);
    } finally {
      setIsLoadingQuotes(false);
    }
  };

  useEffect(() => {
    loadIdeas();
    loadQuotes();
  }, [object.id]);

  // Derived properties with fallbacks to preserve existing historical fields
  const author = properties.autor || properties.author || '';
  const subtitle = properties.subtitulo || properties.subtitle || '';
  const publisher = properties.editorial || properties.publisher || '';
  const publicationYear = properties.año || properties.year || properties.publication_year || '';
  const isbn = properties.isbn || '';
  const language = properties.idioma || properties.language || 'Español';
  const genre = properties.genero || properties.genre || '';
  const format: BookFormat = properties.formato || properties.format || 'physical';
  const readingStatus: BookReadingStatus = properties.reading_status || properties.estado_lectura || 'want_to_read';
  const rating: number = Number(properties.calificacion || properties.rating || 0);

  const totalPages: number = Number(properties.total_pages || properties.page_count || properties.paginas || 0);
  const currentPage: number = Number(properties.current_page || properties.pagina_actual || 0);

  const startedAt = properties.started_at || properties.fecha_inicio || '';
  const finishedAt = properties.finished_at || properties.fecha_fin || '';

  // Main digital PDF URL and metadata
  const mainPdfUrl: string = properties.main_pdf_url || properties.pdf_url || '';
  const mainPdfName: string = properties.main_pdf_name || properties.pdf_name || 'Documento PDF';
  const mainPdfSize: number = Number(properties.main_pdf_size || 0);

  // Automatic reading percentage calculation
  const readingProgress = useMemo(() => {
    if (totalPages > 0 && currentPage >= 0) {
      const pct = Math.round((currentPage / totalPages) * 100);
      return Math.min(100, Math.max(0, pct));
    }
    return 0;
  }, [currentPage, totalPages]);

  // Available PDF attachments in this book object (from R2 or file system)
  const availablePdfAttachments = useMemo(() => {
    return attachments.filter(a => 
      a.mime_type === 'application/pdf' || 
      a.file_name.toLowerCase().endsWith('.pdf') ||
      a.file_url.toLowerCase().endsWith('.pdf')
    );
  }, [attachments]);

  // Current reading status definition
  const currentStatusDef = READING_STATUSES.find(s => s.id === readingStatus) || READING_STATUSES[0];

  // Handlers for reading progress
  const handleUpdateCurrentPage = (newPage: number) => {
    const clamped = Math.max(0, totalPages > 0 ? Math.min(newPage, totalPages) : newPage);
    onPropertyChange('current_page', clamped);
    
    // Auto-update status if finished
    if (totalPages > 0 && clamped >= totalPages && readingStatus !== 'finished') {
      onPropertyChange('reading_status', 'finished');
      if (!finishedAt) {
        onPropertyChange('finished_at', new Date().toISOString().split('T')[0]);
      }
    } else if (clamped > 0 && readingStatus === 'want_to_read') {
      onPropertyChange('reading_status', 'reading');
      if (!startedAt) {
        onPropertyChange('started_at', new Date().toISOString().split('T')[0]);
      }
    }
    onSaveStatusChange('dirty');
  };

  const handleUpdateTotalPages = (newTotal: number) => {
    const val = Math.max(0, newTotal);
    onPropertyChange('total_pages', val);
    onSaveStatusChange('dirty');
  };

  // Upload book cover to R2
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingCover(true);
      const res = await r2Storage.uploadFile(file, 'book-covers');
      if (res?.url) {
        onThumbnailUrlChange(res.url);
        onPropertyChange('photo_url', res.url);
        onPropertyChange('cover_url', res.url);
        onSaveStatusChange('dirty');
      }
    } catch (err) {
      console.error('Error subiendo portada del libro:', err);
      alert('No se pudo subir la portada del libro a Cloudflare R2.');
    } finally {
      setIsUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  // Upload primary PDF to R2
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingPdf(true);
      const res = await r2Storage.uploadFile(file, 'books');
      if (res?.url) {
        onPropertyChange('main_pdf_url', res.url);
        onPropertyChange('main_pdf_name', res.name || file.name);
        onPropertyChange('main_pdf_size', res.size || file.size);
        if (format !== 'pdf') {
          onPropertyChange('formato', 'pdf');
        }

        // Register in app_attachments as well
        await db.recordAttachment({
          entity_id: object.id,
          entity_type: 'object',
          file_name: res.name || file.name,
          display_name: res.name || file.name,
          file_url: res.url,
          file_path: res.r2Key,
          bucket_name: 'books',
          storage_provider: 'r2',
          file_size: res.size || file.size,
          mime_type: 'application/pdf'
        }).then((att: AppAttachment | null) => {
          if (att) onAttachmentCreated(att);
        }).catch((err: any) => console.warn('Error registrando adjunto PDF:', err));

        onSaveStatusChange('dirty');
      }
    } catch (err) {
      console.error('Error subiendo PDF a Cloudflare R2:', err);
      alert('No se pudo subir el archivo PDF a Cloudflare R2.');
    } finally {
      setIsUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  // Select existing attachment as main PDF
  const handleSelectExistingPdf = (att: AppAttachment) => {
    onPropertyChange('main_pdf_url', att.file_url);
    onPropertyChange('main_pdf_name', att.display_name || att.file_name);
    onPropertyChange('main_pdf_size', att.file_size || 0);
    if (format !== 'pdf') {
      onPropertyChange('formato', 'pdf');
    }
    onSaveStatusChange('dirty');
  };

  // Open Idea creation/edition modal
  const openNewIdeaModal = (prefill?: { page?: number; selectedText?: string }) => {
    setEditingIdea(null);
    setIdeaFormTitle(prefill?.selectedText ? prefill.selectedText.slice(0, 50) : '');
    setIdeaFormContent(prefill?.selectedText || '');
    setIdeaFormPage(prefill?.page ? String(prefill.page) : currentPage ? String(currentPage) : '');
    setIdeaFormChapter('');
    setIdeaFormTags('');
    setIsIdeaModalOpen(true);
  };

  const openEditIdeaModal = (idea: BookIdea) => {
    setEditingIdea(idea);
    setIdeaFormTitle(idea.title);
    setIdeaFormContent(idea.content);
    setIdeaFormPage(idea.page ? String(idea.page) : '');
    setIdeaFormChapter(idea.chapter || '');
    setIdeaFormTags(idea.tags?.join(', ') || '');
    setIsIdeaModalOpen(true);
  };

  const handleSaveIdea = async () => {
    if (!ideaFormTitle.trim() && !ideaFormContent.trim()) {
      alert('Por favor ingresa un título o descripción para la idea.');
      return;
    }

    try {
      const pageNum = ideaFormPage.trim() ? parseInt(ideaFormPage, 10) : null;
      const tagsArray = ideaFormTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      if (editingIdea) {
        await db.updateBookIdea(editingIdea.id, {
          title: ideaFormTitle.trim() || 'Idea sin título',
          content: ideaFormContent,
          page: !isNaN(pageNum as number) ? pageNum : null,
          chapter: ideaFormChapter.trim(),
          tags: tagsArray
        });
      } else {
        await db.createBookIdea({
          book_id: object.id,
          title: ideaFormTitle.trim() || 'Idea de lectura',
          content: ideaFormContent,
          page: !isNaN(pageNum as number) ? pageNum : null,
          chapter: ideaFormChapter.trim(),
          tags: tagsArray
        });
      }

      setIsIdeaModalOpen(false);
      await loadIdeas();
    } catch (e) {
      console.error('Error guardando idea:', e);
      alert('Error al guardar la idea.');
    }
  };

  const handleDeleteIdea = async (id: string) => {
    if (!confirm('¿Eliminar esta idea reflexiva?')) return;
    try {
      await db.deleteBookIdea(id);
      await loadIdeas();
    } catch (e) {
      console.error('Error eliminando idea:', e);
    }
  };

  // Convert Idea to Independent Note
  const handleConvertIdeaToNote = async (idea: BookIdea) => {
    try {
      const newNote = await db.createNote({
        title: `${idea.title} (De: ${title})`,
        content: `<p><strong>Origen:</strong> Libro <em>${title}</em> (${author}) ${idea.page ? `• Pág. ${idea.page}` : ''}</p><hr/>${idea.content}`,
        category: 'idea',
        tags: [...(idea.tags || []), 'libro', 'idea']
      });

      if (newNote) {
        // Link new note to book
        await db.createLink({
          from_id: object.id,
          from_type: 'object',
          to_id: newNote.id,
          to_type: 'note',
          relation_label: 'idea_extraida'
        });

        alert(`Idea convertida en Nota independiente: "${newNote.title}".`);
        if (onOpenNote) onOpenNote(newNote);
      }
    } catch (e) {
      console.error('Error convirtiendo idea en nota:', e);
      alert('No se pudo convertir la idea en nota.');
    }
  };

  // Open Quote creation/edition modal
  const openNewQuoteModal = (prefill?: { page?: number; quoteText?: string }) => {
    setEditingQuote(null);
    setQuoteFormText(prefill?.quoteText || '');
    setQuoteFormAuthor(author);
    setQuoteFormPage(prefill?.page ? String(prefill.page) : currentPage ? String(currentPage) : '');
    setQuoteFormChapter('');
    setQuoteFormCommentary('');
    setQuoteFormTags('');
    setIsQuoteModalOpen(true);
  };

  const openEditQuoteModal = (quote: BookQuote) => {
    setEditingQuote(quote);
    setQuoteFormText(quote.quote_text);
    setQuoteFormAuthor(quote.author || author);
    setQuoteFormPage(quote.page ? String(quote.page) : '');
    setQuoteFormChapter(quote.chapter || '');
    setQuoteFormCommentary(quote.commentary || '');
    setQuoteFormTags(quote.tags?.join(', ') || '');
    setIsQuoteModalOpen(true);
  };

  const handleSaveQuote = async () => {
    if (!quoteFormText.trim()) {
      alert('Por favor ingresa el texto literal de la cita.');
      return;
    }

    try {
      const pageNum = quoteFormPage.trim() ? parseInt(quoteFormPage, 10) : null;
      const tagsArray = quoteFormTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      if (editingQuote) {
        await db.updateBookQuote(editingQuote.id, {
          quote_text: quoteFormText.trim(),
          author: quoteFormAuthor.trim() || author,
          page: !isNaN(pageNum as number) ? pageNum : null,
          chapter: quoteFormChapter.trim(),
          commentary: quoteFormCommentary.trim(),
          tags: tagsArray
        });
      } else {
        await db.createBookQuote({
          book_id: object.id,
          quote_text: quoteFormText.trim(),
          author: quoteFormAuthor.trim() || author,
          page: !isNaN(pageNum as number) ? pageNum : null,
          chapter: quoteFormChapter.trim(),
          commentary: quoteFormCommentary.trim(),
          tags: tagsArray
        });
      }

      setIsQuoteModalOpen(false);
      await loadQuotes();
    } catch (e) {
      console.error('Error guardando cita:', e);
      alert('Error al guardar la cita.');
    }
  };

  const handleDeleteQuote = async (id: string) => {
    if (!confirm('¿Eliminar esta cita destacada?')) return;
    try {
      await db.deleteBookQuote(id);
      await loadQuotes();
    } catch (e) {
      console.error('Error eliminando cita:', e);
    }
  };

  const copyQuoteToClipboard = (quote: BookQuote) => {
    const text = `"${quote.quote_text}"\n— ${quote.author || author}${quote.page ? ` (Pág. ${quote.page})` : ''}`;
    navigator.clipboard.writeText(text);
    setCopiedQuoteId(quote.id);
    setTimeout(() => setCopiedQuoteId(null), 2000);
  };

  // Filtered lists
  const filteredIdeas = useMemo(() => {
    if (!ideaSearchQuery.trim()) return ideas;
    const q = ideaSearchQuery.toLowerCase();
    return ideas.filter(i => 
      i.title.toLowerCase().includes(q) || 
      i.content.toLowerCase().includes(q) ||
      i.chapter?.toLowerCase().includes(q) ||
      i.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [ideas, ideaSearchQuery]);

  const filteredQuotes = useMemo(() => {
    if (!quoteSearchQuery.trim()) return quotes;
    const q = quoteSearchQuery.toLowerCase();
    return quotes.filter(quote => 
      quote.quote_text.toLowerCase().includes(q) || 
      quote.commentary?.toLowerCase().includes(q) ||
      quote.author?.toLowerCase().includes(q) ||
      quote.chapter?.toLowerCase().includes(q) ||
      quote.tags?.some(t => t.toLowerCase().includes(q))
    );
  }, [quotes, quoteSearchQuery]);

  return (
    <div className="space-y-6">
      {/* Hidden file inputs for cover and PDF uploads */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        onChange={handleCoverUpload}
        className="hidden"
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        onChange={handlePdfUpload}
        className="hidden"
      />

      {/* ==================================================== */}
      {/* 1. CABECERA PRINCIPAL ESTILO BIBLIOTECA */}
      {/* ==================================================== */}
      <div className="bg-[#181824] border border-[#2b2b3d] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xl relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row gap-6 relative z-10 items-start">
          {/* Book Cover (Physical 3D feel with leather/spine spine shadow) */}
          <div className="relative group mx-auto sm:mx-0 flex-shrink-0">
            <div className="w-36 h-52 sm:w-44 sm:h-64 rounded-xl overflow-hidden shadow-2xl border border-white/10 relative transition-transform duration-300 group-hover:scale-[1.02]">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              ) : (
                /* Elegant Generic Cover */
                <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-purple-900 to-[#12121e] flex flex-col justify-between p-4 text-center border-l-4 border-l-amber-500/60 shadow-inner relative">
                  {/* Subtle Book Spine Line */}
                  <div className="absolute left-2 top-0 bottom-0 w-[1px] bg-white/10" />

                  <div className="pt-2">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300/80 block">
                      Segundo Cerebro
                    </span>
                    <span className="text-[9px] text-gray-400 font-mono mt-0.5 block">
                      {genre || 'Biblioteca'}
                    </span>
                  </div>

                  <div className="my-auto px-1">
                    <h3 className="font-serif font-bold text-sm sm:text-base text-white leading-tight line-clamp-3 shadow-sm">
                      {title || 'Título del Libro'}
                    </h3>
                    {author && (
                      <p className="text-[11px] text-purple-200/80 font-medium mt-1 truncate">
                        {author}
                      </p>
                    )}
                  </div>

                  <div className="pb-1 text-[9px] text-gray-400 font-mono border-t border-white/10 pt-1">
                    {publicationYear || 'Edición Personal'}
                  </div>
                </div>
              )}

              {/* Cover overlay button */}
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={isUploadingCover}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 text-white text-xs font-medium cursor-pointer"
                title="Cambiar o subir portada a Cloudflare R2"
              >
                {isUploadingCover ? (
                  <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                ) : (
                  <>
                    <Camera className="w-6 h-6 text-purple-300" />
                    <span>Cambiar portada</span>
                  </>
                )}
              </button>
            </div>

            {thumbnailUrl && (
              <button
                type="button"
                onClick={() => {
                  onThumbnailUrlChange('');
                  onPropertyChange('photo_url', '');
                  onPropertyChange('cover_url', '');
                  onSaveStatusChange('dirty');
                }}
                className="absolute -top-2 -right-2 p-1.5 bg-red-950 border border-red-800 text-red-300 rounded-full hover:bg-red-900 transition opacity-0 group-hover:opacity-100 shadow"
                title="Quitar portada personalizada"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Book Identity & Key Controls */}
          <div className="flex-1 min-w-0 space-y-4 w-full">
            {/* Top Badges & Actions */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Reading Status Selector Badge */}
                <select
                  value={readingStatus}
                  onChange={e => {
                    const newStatus = e.target.value as BookReadingStatus;
                    onPropertyChange('reading_status', newStatus);
                    if (newStatus === 'reading' && !startedAt) {
                      onPropertyChange('started_at', new Date().toISOString().split('T')[0]);
                    } else if (newStatus === 'finished' && !finishedAt) {
                      onPropertyChange('finished_at', new Date().toISOString().split('T')[0]);
                      if (totalPages > 0 && currentPage < totalPages) {
                        onPropertyChange('current_page', totalPages);
                      }
                    }
                    onSaveStatusChange('dirty');
                  }}
                  className={`text-xs px-3 py-1 rounded-full font-semibold border ${currentStatusDef.bg} ${currentStatusDef.color} outline-none cursor-pointer`}
                >
                  {READING_STATUSES.map(s => (
                    <option key={s.id} value={s.id} className="bg-[#181826] text-white">
                      {s.label}
                    </option>
                  ))}
                </select>

                {/* Format Badge */}
                <select
                  value={format}
                  onChange={e => {
                    onPropertyChange('formato', e.target.value);
                    onPropertyChange('format', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  className="text-xs px-2.5 py-1 rounded-full bg-[#222232] border border-[#333348] text-gray-300 outline-none cursor-pointer"
                >
                  {BOOK_FORMATS.map(f => (
                    <option key={f.id} value={f.id} className="bg-[#181826] text-white">
                      {f.label}
                    </option>
                  ))}
                </select>

                {genre && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-purple-950/40 text-purple-300 border border-purple-800/40">
                    {genre}
                  </span>
                )}
              </div>

              {/* Star Rating Interactive Component */}
              <div className="flex items-center gap-1 bg-[#13131c] px-2.5 py-1 rounded-xl border border-[#2b2b3f]">
                {[1, 2, 3, 4, 5].map(starVal => (
                  <button
                    key={starVal}
                    type="button"
                    onClick={() => {
                      const newRating = rating === starVal ? 0 : starVal;
                      onPropertyChange('calificacion', newRating);
                      onPropertyChange('rating', newRating);
                      onSaveStatusChange('dirty');
                    }}
                    className="p-0.5 text-gray-500 hover:text-amber-400 transition"
                    title={`Calificar con ${starVal} estrellas`}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        starVal <= rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-gray-600'
                      }`}
                    />
                  </button>
                ))}
                {rating > 0 && (
                  <span className="text-xs font-bold text-amber-400 font-mono ml-1">
                    {rating}.0
                  </span>
                )}
              </div>
            </div>

            {/* Title & Subtitle Inputs */}
            <div>
              <input
                type="text"
                value={title}
                onChange={e => onTitleChange(e.target.value)}
                placeholder="Título del libro..."
                className="w-full text-xl sm:text-2xl md:text-3xl font-extrabold text-white bg-transparent border-0 border-b border-transparent hover:border-[#38384f] focus:border-purple-500 outline-none pb-1 transition placeholder-gray-600 font-serif"
              />
              <input
                type="text"
                value={subtitle}
                onChange={e => {
                  onPropertyChange('subtitulo', e.target.value);
                  onPropertyChange('subtitle', e.target.value);
                  onSaveStatusChange('dirty');
                }}
                placeholder="Subtítulo opcional (p. ej. 'Historia de una fascinación')..."
                className="w-full text-xs sm:text-sm text-gray-400 bg-transparent border-0 border-b border-transparent hover:border-[#38384f] focus:border-purple-500 outline-none py-0.5 transition placeholder-gray-600 mt-1"
              />
            </div>

            {/* Author & Publisher / Metadata Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">
                  Autor(es)
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={e => {
                    onPropertyChange('autor', e.target.value);
                    onPropertyChange('author', e.target.value);
                    onSaveStatusChange('dirty');
                  }}
                  placeholder="Gabriel García Márquez..."
                  className="w-full text-xs font-medium text-purple-200 bg-[#14141e] border border-[#2b2b3f] rounded-lg px-2.5 py-1.5 focus:border-purple-500 outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">
                  Editorial & Año
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={publisher}
                    onChange={e => {
                      onPropertyChange('editorial', e.target.value);
                      onPropertyChange('publisher', e.target.value);
                      onSaveStatusChange('dirty');
                    }}
                    placeholder="Editorial..."
                    className="flex-1 text-xs text-gray-300 bg-[#14141e] border border-[#2b2b3f] rounded-lg px-2.5 py-1.5 focus:border-purple-500 outline-none"
                  />
                  <input
                    type="number"
                    value={publicationYear}
                    onChange={e => {
                      onPropertyChange('año', e.target.value);
                      onPropertyChange('publication_year', e.target.value);
                      onSaveStatusChange('dirty');
                    }}
                    placeholder="Año"
                    className="w-20 text-xs text-gray-300 bg-[#14141e] border border-[#2b2b3f] rounded-lg px-2 py-1.5 focus:border-purple-500 outline-none text-center"
                  />
                </div>
              </div>
            </div>

            {/* Reading Progress Indicator Bar */}
            <div className="bg-[#13131c] border border-[#2b2b3f] rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Progreso de Lectura</span>
                </span>
                <span className="font-mono font-bold text-purple-300">
                  {readingProgress}% {totalPages > 0 && `(${currentPage} / ${totalPages} págs.)`}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-[#252536] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 via-indigo-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${readingProgress}%` }}
                />
              </div>

              {/* Quick Action Button: Read Book PDF */}
              <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  <span>Página actual:</span>
                  <input
                    type="number"
                    min={0}
                    max={totalPages || 9999}
                    value={currentPage || ''}
                    onChange={e => handleUpdateCurrentPage(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-16 bg-[#1a1a26] border border-[#3b3b52] rounded px-2 py-0.5 text-white font-mono text-xs text-center focus:border-purple-500 outline-none"
                  />
                  <span>de</span>
                  <input
                    type="number"
                    min={0}
                    value={totalPages || ''}
                    onChange={e => handleUpdateTotalPages(parseInt(e.target.value, 10) || 0)}
                    placeholder="Total"
                    className="w-16 bg-[#1a1a26] border border-[#3b3b52] rounded px-2 py-0.5 text-gray-300 font-mono text-xs text-center focus:border-purple-500 outline-none"
                  />
                </div>

                {/* Primary Read Button */}
                {mainPdfUrl ? (
                  <button
                    type="button"
                    onClick={() => setIsReaderOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition shadow-lg shadow-purple-900/30"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>{currentPage > 1 ? `Continuar en Pág. ${currentPage}` : 'Leer libro'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={isUploadingPdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800/50 font-medium text-xs transition"
                  >
                    {isUploadingPdf ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileUp className="w-3.5 h-3.5" />
                    )}
                    <span>Adjuntar PDF para leer</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 2. PESTAÑAS DE NAVEGACIÓN */}
      {/* ==================================================== */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-[#252535] pb-2">
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            activeTab === 'summary'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a26]'
          }`}
        >
          <BookMarked className="w-4 h-4" />
          <span>Resumen</span>
        </button>

        <button
          onClick={() => setActiveTab('reading')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            activeTab === 'reading'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a26]'
          }`}
        >
          <Glasses className="w-4 h-4" />
          <span>Lectura</span>
          {mainPdfUrl && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 ml-0.5" title="PDF disponible" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('ideas')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            activeTab === 'ideas'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a26]'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Ideas y notas</span>
          {ideas.length > 0 && (
            <span className="text-[10px] px-1.5 rounded-full bg-white/20 text-white font-mono">
              {ideas.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('quotes')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            activeTab === 'quotes'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a26]'
          }`}
        >
          <Quote className="w-4 h-4" />
          <span>Citas destacadas</span>
          {quotes.length > 0 && (
            <span className="text-[10px] px-1.5 rounded-full bg-white/20 text-white font-mono">
              {quotes.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            activeTab === 'notes'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a26]'
          }`}
        >
          <AlignLeft className="w-4 h-4" />
          <span>Notas del libro</span>
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            activeTab === 'files'
              ? 'bg-purple-600 text-white shadow-sm'
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

        <button
          onClick={() => setActiveTab('relations')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            activeTab === 'relations'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a26]'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>Relaciones</span>
          {(outgoingLinks.length + incomingLinks.length) > 0 && (
            <span className="text-[10px] px-1.5 rounded-full bg-white/20 text-white font-mono">
              {outgoingLinks.length + incomingLinks.length}
            </span>
          )}
        </button>
      </div>

      {/* ==================================================== */}
      {/* 3. CONTENIDO DE LAS PESTAÑAS */}
      {/* ==================================================== */}

      {/* PESTAÑA 1: RESUMEN GENERAL */}
      {activeTab === 'summary' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Key Indicators Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-[#181826] border border-[#2b2b3d] rounded-2xl p-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">
                Progreso
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-white font-mono mt-1 block">
                {readingProgress}%
              </span>
              <span className="text-[11px] text-gray-500">
                {totalPages > 0 ? `${totalPages - currentPage} págs. restantes` : 'Total no definido'}
              </span>
            </div>

            <div className="bg-[#181826] border border-[#2b2b3d] rounded-2xl p-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">
                Páginas Leídas
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-purple-400 font-mono mt-1 block">
                {currentPage}
              </span>
              <span className="text-[11px] text-gray-500">
                de {totalPages || '—'} páginas
              </span>
            </div>

            <div className="bg-[#181826] border border-[#2b2b3d] rounded-2xl p-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">
                Ideas Capturadas
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-amber-400 font-mono mt-1 block">
                {ideas.length}
              </span>
              <span className="text-[11px] text-gray-500">
                aprendizajes y reflexiones
              </span>
            </div>

            <div className="bg-[#181826] border border-[#2b2b3d] rounded-2xl p-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">
                Citas Destacadas
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-indigo-400 font-mono mt-1 block">
                {quotes.length}
              </span>
              <span className="text-[11px] text-gray-500">
                fragmentos memorables
              </span>
            </div>
          </div>

          {/* Book Metadata & Synopsis */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Synopsis & Personal Notes Preview */}
            <div className="lg:col-span-2 space-y-6">
              {/* Synopsis / Description */}
              <div className="bg-[#181826] border border-[#2b2b3d] rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <span>Sinopsis / Descripción</span>
                  </h4>
                </div>
                <textarea
                  value={description}
                  onChange={e => onDescriptionChange(e.target.value)}
                  placeholder="Escribe la sinopsis del libro, contexto o motivo por el que deseas leerlo..."
                  rows={4}
                  className="w-full text-xs text-gray-300 bg-[#12121b] border border-[#2b2b3e] rounded-xl p-3 focus:border-purple-500 outline-none resize-y leading-relaxed"
                />
              </div>

              {/* Recent Ideas Preview */}
              <div className="bg-[#181826] border border-[#2b2b3d] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Ideas Destacadas Recientes</span>
                  </h4>
                  <button
                    onClick={() => setActiveTab('ideas')}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    <span>Ver todas ({ideas.length})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {ideas.length === 0 ? (
                  <p className="text-xs text-gray-500 py-3 text-center">
                    Aún no has capturado ideas de este libro.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {ideas.slice(0, 3).map(idea => (
                      <div
                        key={idea.id}
                        onClick={() => openEditIdeaModal(idea)}
                        className="p-3 bg-[#13131c] border border-[#262638] rounded-xl hover:border-amber-500/40 cursor-pointer transition"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white truncate">{idea.title}</span>
                          {idea.page && (
                            <span className="text-[10px] font-mono text-purple-300 bg-purple-950/40 px-2 py-0.5 rounded-full">
                              Pág. {idea.page}
                            </span>
                          )}
                        </div>
                        {idea.content && (
                          <p className="text-xs text-gray-400 line-clamp-2 mt-1 leading-relaxed">
                            {idea.content.replace(/<[^>]*>/g, '')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Quotes Preview */}
              <div className="bg-[#181826] border border-[#2b2b3d] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                    <Quote className="w-4 h-4 text-purple-400" />
                    <span>Citas Memorables</span>
                  </h4>
                  <button
                    onClick={() => setActiveTab('quotes')}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    <span>Ver todas ({quotes.length})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {quotes.length === 0 ? (
                  <p className="text-xs text-gray-500 py-3 text-center">
                    Aún no has guardado citas de este libro.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {quotes.slice(0, 2).map(quote => (
                      <div
                        key={quote.id}
                        className="p-3.5 bg-[#13131c] border-l-4 border-l-purple-500 border border-[#262638] rounded-r-xl space-y-1.5"
                      >
                        <p className="text-xs sm:text-sm font-serif italic text-gray-200 leading-relaxed">
                          "{quote.quote_text}"
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-gray-400">
                          <span>— {quote.author || author}</span>
                          {quote.page && <span className="font-mono">Página {quote.page}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right 1 Col: Detailed Book Information */}
            <div className="space-y-6">
              <div className="bg-[#181826] border border-[#2b2b3d] rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  <span>Ficha Técnica</span>
                </h4>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-semibold">ISBN</label>
                    <input
                      type="text"
                      value={isbn}
                      onChange={e => {
                        onPropertyChange('isbn', e.target.value);
                        onSaveStatusChange('dirty');
                      }}
                      placeholder="978-0-123456-47-2"
                      className="w-full text-xs text-white bg-[#12121b] border border-[#2b2b3e] rounded-lg px-2.5 py-1.5 focus:border-purple-500 outline-none mt-1 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-semibold">Idioma</label>
                    <input
                      type="text"
                      value={language}
                      onChange={e => {
                        onPropertyChange('idioma', e.target.value);
                        onPropertyChange('language', e.target.value);
                        onSaveStatusChange('dirty');
                      }}
                      placeholder="Español, Inglés..."
                      className="w-full text-xs text-white bg-[#12121b] border border-[#2b2b3e] rounded-lg px-2.5 py-1.5 focus:border-purple-500 outline-none mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-semibold">Género / Materia</label>
                    <input
                      type="text"
                      value={genre}
                      onChange={e => {
                        onPropertyChange('genero', e.target.value);
                        onPropertyChange('genre', e.target.value);
                        onSaveStatusChange('dirty');
                      }}
                      placeholder="Novela, Filosofía, Negocios..."
                      className="w-full text-xs text-white bg-[#12121b] border border-[#2b2b3e] rounded-lg px-2.5 py-1.5 focus:border-purple-500 outline-none mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase font-semibold">Fecha Inicio</label>
                      <DatePickerInput
                        value={startedAt}
                        onChange={d => {
                          onPropertyChange('started_at', d);
                          onPropertyChange('fecha_inicio', d);
                          onSaveStatusChange('dirty');
                        }}
                        placeholder="Inicio"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-500 uppercase font-semibold">Fecha Fin</label>
                      <DatePickerInput
                        value={finishedAt}
                        onChange={d => {
                          onPropertyChange('finished_at', d);
                          onPropertyChange('fecha_fin', d);
                          onSaveStatusChange('dirty');
                        }}
                        placeholder="Fin"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Digital File Quick Card */}
              <div className="bg-[#181826] border border-[#2b2b3d] rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  <span>Documento Digital</span>
                </h4>

                {mainPdfUrl ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-[#13131c] border border-[#2b2b3f] rounded-xl flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{mainPdfName}</p>
                        {mainPdfSize > 0 && (
                          <p className="text-[10px] text-gray-400">
                            {(mainPdfSize / (1024 * 1024)).toFixed(1)} MB • Cloudflare R2
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
                        Listo
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsReaderOpen(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition shadow"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Abrir en Lector PDF</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-2 border-2 border-dashed border-[#2b2b3f] rounded-xl">
                    <p className="text-xs text-gray-400">Sin archivo PDF vinculado</p>
                    <button
                      type="button"
                      onClick={() => pdfInputRef.current?.click()}
                      disabled={isUploadingPdf}
                      className="px-3 py-1.5 bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-xs font-medium transition"
                    >
                      {isUploadingPdf ? 'Subiendo...' : 'Subir PDF del libro'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: LECTURA Y SEGUIMIENTO ACTIVO */}
      {activeTab === 'reading' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main Reading Header & Controls */}
          <div className="bg-[#181824] border border-[#2b2b3d] rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Glasses className="w-5 h-5 text-purple-400" />
                  <span>Centro de Lectura & Progreso</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Lector de libros digitales integrado, control de páginas y metas de lectura.
                </p>
              </div>

              {mainPdfUrl && (
                <button
                  type="button"
                  onClick={() => setIsReaderOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-lg shadow-purple-900/30"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>{currentPage > 1 ? `Continuar en Pág. ${currentPage}` : 'Comenzar a leer'}</span>
                </button>
              )}
            </div>

            {/* Visual Slider and inputs */}
            <div className="bg-[#12121b] border border-[#2b2b3e] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Página actual de lectura</span>
                <span className="font-mono font-bold text-purple-300 text-sm">
                  {currentPage} de {totalPages || '?'} ({readingProgress}%)
                </span>
              </div>

              {/* Slider for manual progress updating */}
              <input
                type="range"
                min={0}
                max={totalPages || 100}
                value={currentPage}
                onChange={e => handleUpdateCurrentPage(parseInt(e.target.value, 10))}
                className="w-full accent-purple-500 cursor-pointer h-2 bg-[#252536] rounded-lg"
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Página Actual</label>
                  <input
                    type="number"
                    min={0}
                    value={currentPage}
                    onChange={e => handleUpdateCurrentPage(parseInt(e.target.value, 10) || 0)}
                    className="w-full text-xs font-mono font-bold text-white bg-[#191924] border border-[#333348] rounded-lg p-2 focus:border-purple-500 outline-none mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Total Páginas</label>
                  <input
                    type="number"
                    min={0}
                    value={totalPages}
                    onChange={e => handleUpdateTotalPages(parseInt(e.target.value, 10) || 0)}
                    className="w-full text-xs font-mono text-gray-300 bg-[#191924] border border-[#333348] rounded-lg p-2 focus:border-purple-500 outline-none mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Fecha Inicio</label>
                  <DatePickerInput
                    value={startedAt}
                    onChange={d => {
                      onPropertyChange('started_at', d);
                      onSaveStatusChange('dirty');
                    }}
                    placeholder="Inicio"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 uppercase font-semibold">Fecha Fin</label>
                  <DatePickerInput
                    value={finishedAt}
                    onChange={d => {
                      onPropertyChange('finished_at', d);
                      onSaveStatusChange('dirty');
                    }}
                    placeholder="Fin"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Digital PDF Document Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                Archivo Digital Asociado
              </h4>

              {mainPdfUrl ? (
                <div className="p-4 bg-[#12121b] border border-[#2b2b3e] rounded-xl flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-300 flex-shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-white truncate">{mainPdfName}</p>
                      <p className="text-[11px] text-gray-400">
                        {mainPdfSize > 0 ? `${(mainPdfSize / (1024 * 1024)).toFixed(1)} MB • ` : ''}
                        Almacenado de forma segura en Cloudflare R2
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsReaderOpen(true)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Abrir Lector</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => pdfInputRef.current?.click()}
                      disabled={isUploadingPdf}
                      className="p-2 text-gray-400 hover:text-white hover:bg-[#1f1f2e] rounded-xl transition"
                      title="Reemplazar archivo PDF"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <a
                      href={mainPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 text-gray-400 hover:text-white hover:bg-[#1f1f2e] rounded-xl transition"
                      title="Descargar o ver en pestaña nueva"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-[#12121b] border border-[#2b2b3e] rounded-xl space-y-4">
                  <BookOpen className="w-12 h-12 text-gray-600 mx-auto" />
                  <div>
                    <h5 className="text-sm font-bold text-white">Adjunta el archivo PDF de este libro</h5>
                    <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                      Al adjuntar el PDF podrás leerlo dentro de Segundo Cerebro, subrayar citas, capturar ideas y recordar siempre en qué página te quedaste.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={isUploadingPdf}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl transition shadow flex items-center gap-2 mx-auto"
                  >
                    {isUploadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                    <span>Subir archivo PDF desde mi dispositivo</span>
                  </button>
                </div>
              )}

              {/* Select from existing attachments if available */}
              {availablePdfAttachments.length > 0 && !mainPdfUrl && (
                <div className="p-3 bg-[#13131c] border border-[#2a2a3c] rounded-xl space-y-2">
                  <span className="text-[11px] font-semibold text-gray-400 block">
                    O vincular un PDF ya existente en la ficha:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {availablePdfAttachments.map(att => (
                      <button
                        key={att.id}
                        type="button"
                        onClick={() => handleSelectExistingPdf(att)}
                        className="px-3 py-1.5 rounded-lg bg-[#1f1f2e] hover:bg-[#2a2a3e] text-xs text-purple-300 border border-purple-500/30 flex items-center gap-1.5 transition"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                        <span className="truncate max-w-xs">{att.display_name || att.file_name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: IDEAS Y NOTAS INDEPENDIENTES */}
      {activeTab === 'ideas' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & New Idea Button */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <span>Ideas y Reflexiones del Libro</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Captura conceptos, modelos mentales, síntesis y aprendizajes independientes.
              </p>
            </div>

            <button
              type="button"
              onClick={() => openNewIdeaModal()}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl transition shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Capturar Idea</span>
            </button>
          </div>

          {/* Search Ideas */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={ideaSearchQuery}
              onChange={e => setIdeaSearchQuery(e.target.value)}
              placeholder="Buscar entre las ideas capturadas..."
              className="w-full bg-[#161622] border border-[#2b2b3d] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500"
            />
          </div>

          {/* Ideas Grid */}
          {isLoadingIdeas ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            </div>
          ) : filteredIdeas.length === 0 ? (
            <div className="py-12 text-center bg-[#181826] border border-[#2b2b3d] rounded-2xl space-y-3">
              <Sparkles className="w-10 h-10 text-gray-600 mx-auto" />
              <p className="text-xs text-gray-400">
                {ideaSearchQuery ? 'No se encontraron ideas con ese criterio.' : 'Aún no has registrado ideas de este libro.'}
              </p>
              <button
                type="button"
                onClick={() => openNewIdeaModal()}
                className="px-4 py-2 bg-amber-600/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold hover:bg-amber-600/30 transition"
              >
                Capturar mi primera idea
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredIdeas.map(idea => (
                <div
                  key={idea.id}
                  className="bg-[#181826] border border-[#2b2b3d] hover:border-amber-500/50 rounded-2xl p-4.5 space-y-3 transition flex flex-col justify-between shadow-sm group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-sm text-white group-hover:text-amber-300 transition">
                        {idea.title}
                      </h4>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleConvertIdeaToNote(idea)}
                          className="p-1 rounded bg-[#20202e] hover:bg-[#2b2b3e] text-purple-300 transition"
                          title="Convertir en Nota independiente de Segundo Cerebro"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditIdeaModal(idea)}
                          className="p-1 rounded bg-[#20202e] hover:bg-[#2b2b3e] text-amber-300 transition"
                          title="Editar idea"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteIdea(idea.id)}
                          className="p-1 rounded bg-[#20202e] hover:bg-red-950/40 text-red-400 transition"
                          title="Eliminar idea"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {idea.content && (
                      <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {idea.content}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-gray-500 pt-2 border-t border-[#232334] flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {idea.page && (
                        <span className="font-mono px-2 py-0.5 rounded-full bg-purple-950/40 text-purple-300 border border-purple-800/40">
                          Pág. {idea.page}
                        </span>
                      )}
                      {idea.chapter && (
                        <span className="text-gray-400 italic">
                          {idea.chapter}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {idea.tags?.map((t, idx) => (
                        <span key={idx} className="bg-[#242436] text-gray-400 px-1.5 py-0.5 rounded text-[9px]">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 4: CITAS DESTACADAS */}
      {activeTab === 'quotes' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header & New Quote Button */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Quote className="w-5 h-5 text-purple-400" />
                <span>Citas Destacadas</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Fragmentos textuales memorables, subrayados y comentarios reflexivos.
              </p>
            </div>

            <button
              type="button"
              onClick={() => openNewQuoteModal()}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-xl transition shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Cita</span>
            </button>
          </div>

          {/* Search Quotes */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={quoteSearchQuery}
              onChange={e => setQuoteSearchQuery(e.target.value)}
              placeholder="Buscar entre las citas guardadas..."
              className="w-full bg-[#161622] border border-[#2b2b3d] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-purple-500"
            />
          </div>

          {/* Quotes List */}
          {isLoadingQuotes ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="py-12 text-center bg-[#181826] border border-[#2b2b3d] rounded-2xl space-y-3">
              <Quote className="w-10 h-10 text-gray-600 mx-auto" />
              <p className="text-xs text-gray-400">
                {quoteSearchQuery ? 'No se encontraron citas con ese criterio.' : 'Aún no has registrado citas textuales de este libro.'}
              </p>
              <button
                type="button"
                onClick={() => openNewQuoteModal()}
                className="px-4 py-2 bg-purple-600/20 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-semibold hover:bg-purple-600/30 transition"
              >
                Registrar mi primera cita
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredQuotes.map(quote => (
                <div
                  key={quote.id}
                  className="bg-[#181826] border border-[#2b2b3d] hover:border-purple-500/50 rounded-2xl p-5 space-y-3 transition shadow-sm group"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Literal Quote Text (Serif style) */}
                    <div className="flex-1 space-y-2">
                      <div className="border-l-4 border-l-purple-500 pl-4 py-0.5">
                        <p className="font-serif italic text-sm sm:text-base text-gray-100 leading-relaxed">
                          "{quote.quote_text}"
                        </p>
                      </div>

                      {/* User commentary */}
                      {quote.commentary && (
                        <div className="bg-[#13131c] border border-[#242436] rounded-xl p-3 text-xs text-gray-300 space-y-1">
                          <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider block">
                            Reflexión personal
                          </span>
                          <p className="leading-relaxed">{quote.commentary}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => copyQuoteToClipboard(quote)}
                        className="p-1.5 rounded-lg bg-[#20202e] hover:bg-[#2b2b3e] text-gray-300 transition"
                        title="Copiar cita con autor"
                      >
                        {copiedQuoteId === quote.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditQuoteModal(quote)}
                        className="p-1.5 rounded-lg bg-[#20202e] hover:bg-[#2b2b3e] text-purple-300 transition"
                        title="Editar cita"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteQuote(quote.id)}
                        className="p-1.5 rounded-lg bg-[#20202e] hover:bg-red-950/40 text-red-400 transition"
                        title="Eliminar cita"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Metadata Footer */}
                  <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-[#232334] flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-300">— {quote.author || author}</span>
                      {quote.page && (
                        <span className="font-mono text-[11px] text-purple-300 bg-purple-950/40 px-2 py-0.5 rounded-full border border-purple-800/40">
                          Pág. {quote.page}
                        </span>
                      )}
                      {quote.chapter && <span className="text-[11px] italic text-gray-400">{quote.chapter}</span>}
                    </div>

                    <div className="flex items-center gap-1">
                      {quote.tags?.map((t, idx) => (
                        <span key={idx} className="bg-[#242436] text-gray-400 px-1.5 py-0.5 rounded text-[9px]">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 5: NOTAS Y ENSAYO DEL LIBRO (EDITOR TIPTAP) */}
      {activeTab === 'notes' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-[#181826] border border-[#2b2b3d] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#232332]">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlignLeft className="w-4 h-4 text-purple-400" />
                  <span>Notas Personales, Análisis y Síntesis</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Editor enriquecido de Segundo Cerebro con soporte para tablas, formato, imágenes en Cloudflare R2 y autoguardado.
                </p>
              </div>
              <div className="flex items-center gap-2">
              {onOpenAudioModal && (
                <button
                  type="button"
                  onClick={onOpenAudioModal}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 transition shadow-sm"
                  title="Grabar o insertar nota de voz"
                >
                  <Mic className="w-3.5 h-3.5 text-red-400" />
                  <span>Voz</span>
                </button>
              )}
              <TableGridPicker editor={editor} showLabel={true} />
            </div>
            </div>

            {/* Contextual Table Toolbar */}
            <TableToolbar editor={editor} className="rounded-xl border border-[#2b2b3e] mb-2" />

            {/* TipTap Rich Editor */}
            {editor ? (
              <div className="min-h-[350px] bg-[#12121b] border border-[#2b2b3e] rounded-xl p-4 text-gray-200">
                <EditorContent editor={editor} className="prose prose-invert max-w-none focus:outline-none text-xs sm:text-sm leading-relaxed" />
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500 text-xs">
                Cargando editor de notas...
              </div>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 6: ARCHIVOS Y FORMATOS DIGITALES */}
      {activeTab === 'files' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main PDF Card */}
          <div className="bg-[#181826] border border-[#2b2b3d] rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-purple-400" />
              <span>Archivo de Lectura Principal (PDF)</span>
            </h4>

            {mainPdfUrl ? (
              <div className="p-4 bg-[#12121b] border border-[#2b2b3e] rounded-xl flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-white">{mainPdfName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {mainPdfSize > 0 && `${(mainPdfSize / (1024 * 1024)).toFixed(1)} MB • `}
                    Alojado de forma nativa en Cloudflare R2
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsReaderOpen(true)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition"
                  >
                    Abrir Lector
                  </button>
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={isUploadingPdf}
                    className="px-3 py-2 bg-[#252538] hover:bg-[#32324b] text-gray-200 rounded-xl text-xs font-semibold transition"
                  >
                    Reemplazar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('¿Desvincular el PDF principal de este libro?')) {
                        onPropertyChange('main_pdf_url', '');
                        onPropertyChange('main_pdf_name', '');
                        onPropertyChange('main_pdf_size', 0);
                        onSaveStatusChange('dirty');
                      }
                    }}
                    className="p-2 text-red-400 hover:bg-red-950/40 rounded-xl transition"
                    title="Desvincular PDF"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center border-2 border-dashed border-[#2b2b3e] rounded-xl space-y-3">
                <BookOpen className="w-10 h-10 text-gray-600 mx-auto" />
                <p className="text-xs text-gray-400">No hay un archivo PDF principal vinculado.</p>
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={isUploadingPdf}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition shadow inline-flex items-center gap-2"
                >
                  {isUploadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                  <span>Subir PDF a Cloudflare R2</span>
                </button>
              </div>
            )}
          </div>

          {/* Complementary Files Section (EPUB, Audiolibros, Apuntes, Fotos) */}
          <div className="bg-[#181826] border border-[#2b2b3d] rounded-2xl p-5 space-y-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-purple-400" />
                <span>Archivos Complementarios & Material Adicional</span>
              </h4>
              <p className="text-xs text-gray-400 mt-0.5">
                EPUBs, audiolibros, esquemas, resúmenes o fotografías de tu ejemplar físico.
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
        </div>
      )}

      {/* PESTAÑA 7: VÍNCULOS Y RELACIONES */}
      {activeTab === 'relations' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-[#181826] border border-[#2b2b3d] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-purple-400" />
                  <span>Vínculos y Conexiones de Conocimiento</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Conecta este libro con proyectos activos, notas atómicas, personas o áreas de tu Segundo Cerebro.
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenLinkSelector}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir vínculo</span>
              </button>
            </div>

            {/* Outgoing & Incoming Links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Outgoing */}
              <div className="bg-[#12121b] border border-[#2b2b3e] rounded-xl p-4 space-y-3">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  Vínculos Directos ({outgoingLinks.length})
                </span>

                {outgoingLinks.length === 0 ? (
                  <p className="text-xs text-gray-500 py-2">Sin vínculos directos establecidos.</p>
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
                        className="p-2.5 bg-[#181826] border border-[#272738] rounded-lg hover:border-purple-500/40 cursor-pointer transition flex items-center justify-between text-xs"
                      >
                        <span className="font-medium text-white truncate">
                          {link.target_title || link.relation_label || 'Elemento vinculado'}
                        </span>
                        <span className="text-[10px] text-purple-400 font-mono">
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
                  <p className="text-xs text-gray-500 py-2">Ningún otro elemento apunta a este libro.</p>
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
                        className="p-2.5 bg-[#181826] border border-[#272738] rounded-lg hover:border-purple-500/40 cursor-pointer transition flex items-center justify-between text-xs"
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
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. MODALES: CAPTURA DE IDEAS Y CITAS */}
      {/* ==================================================== */}

      {/* Modal: Capturar / Editar Idea */}
      {isIdeaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181826] border border-[#2b2b3d] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-[#2b2b3e] pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{editingIdea ? 'Editar Idea' : 'Capturar Idea del Libro'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsIdeaModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase">Título de la idea</label>
                <input
                  type="text"
                  value={ideaFormTitle}
                  onChange={e => setIdeaFormTitle(e.target.value)}
                  placeholder="Ej. El concepto del bucle de retroalimentación..."
                  className="w-full bg-[#12121b] border border-[#2c2c3e] rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 mt-1 font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase">Contenido / Aprendizaje</label>
                <textarea
                  value={ideaFormContent}
                  onChange={e => setIdeaFormContent(e.target.value)}
                  placeholder="Describe la idea, síntesis, modelo mental o reflexión..."
                  rows={4}
                  className="w-full bg-[#12121b] border border-[#2c2c3e] rounded-xl p-3 text-white outline-none focus:border-amber-500 mt-1 resize-y leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase">Página de origen</label>
                  <input
                    type="number"
                    value={ideaFormPage}
                    onChange={e => setIdeaFormPage(e.target.value)}
                    placeholder="Pág. (opcional)"
                    className="w-full bg-[#12121b] border border-[#2c2c3e] rounded-xl px-3 py-1.5 text-white outline-none focus:border-amber-500 mt-1 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase">Capítulo / Sección</label>
                  <input
                    type="text"
                    value={ideaFormChapter}
                    onChange={e => setIdeaFormChapter(e.target.value)}
                    placeholder="Capítulo 3 (opcional)"
                    className="w-full bg-[#12121b] border border-[#2c2c3e] rounded-xl px-3 py-1.5 text-white outline-none focus:border-amber-500 mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase">Etiquetas (separadas por coma)</label>
                <input
                  type="text"
                  value={ideaFormTags}
                  onChange={e => setIdeaFormTags(e.target.value)}
                  placeholder="enfoque, productividad, psicología"
                  className="w-full bg-[#12121b] border border-[#2c2c3e] rounded-xl px-3 py-1.5 text-white outline-none focus:border-amber-500 mt-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#232334]">
              <button
                type="button"
                onClick={() => setIsIdeaModalOpen(false)}
                className="px-4 py-2 bg-[#232334] text-gray-300 hover:text-white rounded-xl text-xs font-semibold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveIdea}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition shadow"
              >
                {editingIdea ? 'Guardar Cambios' : 'Registrar Idea'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Capturar / Editar Cita */}
      {isQuoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181826] border border-[#2b2b3d] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-[#2b2b3e] pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Quote className="w-4 h-4 text-purple-400" />
                <span>{editingQuote ? 'Editar Cita' : 'Registrar Cita Destacada'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsQuoteModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase">Texto literal de la cita</label>
                <textarea
                  value={quoteFormText}
                  onChange={e => setQuoteFormText(e.target.value)}
                  placeholder="Escribe o pega el texto exacto del autor..."
                  rows={4}
                  className="w-full bg-[#12121b] border border-[#2c2c3e] rounded-xl p-3 text-white outline-none focus:border-purple-500 mt-1 resize-y font-serif italic text-sm leading-relaxed"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase">Comentario o reflexión personal</label>
                <textarea
                  value={quoteFormCommentary}
                  onChange={e => setQuoteFormCommentary(e.target.value)}
                  placeholder="¿Por qué te llamó la atención? ¿Cómo se aplica?"
                  rows={2}
                  className="w-full bg-[#12121b] border border-[#2c2c3e] rounded-xl p-3 text-white outline-none focus:border-purple-500 mt-1 resize-y leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase">Página</label>
                  <input
                    type="number"
                    value={quoteFormPage}
                    onChange={e => setQuoteFormPage(e.target.value)}
                    placeholder="Pág."
                    className="w-full bg-[#12121b] border border-[#2c2c3e] rounded-xl px-3 py-1.5 text-white outline-none focus:border-purple-500 mt-1 font-mono text-center"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase">Autor o Fuente</label>
                  <input
                    type="text"
                    value={quoteFormAuthor}
                    onChange={e => setQuoteFormAuthor(e.target.value)}
                    placeholder="Autor"
                    className="w-full bg-[#12121b] border border-[#2c2c3e] rounded-xl px-3 py-1.5 text-white outline-none focus:border-purple-500 mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase">Capítulo / Sección</label>
                  <input
                    type="text"
                    value={quoteFormChapter}
                    onChange={e => setQuoteFormChapter(e.target.value)}
                    placeholder="Capítulo (opcional)"
                    className="w-full bg-[#12121b] border border-[#2c2c3e] rounded-xl px-3 py-1.5 text-white outline-none focus:border-purple-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-gray-400 uppercase">Etiquetas</label>
                  <input
                    type="text"
                    value={quoteFormTags}
                    onChange={e => setQuoteFormTags(e.target.value)}
                    placeholder="vida, sabiduría, enfoque"
                    className="w-full bg-[#12121b] border border-[#2c2c3e] rounded-xl px-3 py-1.5 text-white outline-none focus:border-purple-500 mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#232334]">
              <button
                type="button"
                onClick={() => setIsQuoteModalOpen(false)}
                className="px-4 py-2 bg-[#232334] text-gray-300 hover:text-white rounded-xl text-xs font-semibold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveQuote}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition shadow"
              >
                {editingQuote ? 'Guardar Cambios' : 'Registrar Cita'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. MODAL DEL LECTOR DIGITAL INTEGRADO PDF */}
      {/* ==================================================== */}
      {isReaderOpen && mainPdfUrl && (
        <BookPdfReaderModal
          isOpen={isReaderOpen}
          onClose={() => setIsReaderOpen(false)}
          pdfUrl={mainPdfUrl}
          bookTitle={title}
          bookAuthor={author}
          bookId={object.id}
          initialPage={currentPage > 0 ? currentPage : 1}
          totalPages={totalPages}
          onPageChange={(newPage, total) => {
            handleUpdateCurrentPage(newPage);
            if (total > 0 && total !== totalPages) {
              handleUpdateTotalPages(total);
            }
          }}
          onCaptureIdea={prefill => {
            openNewIdeaModal(prefill);
          }}
          onCaptureQuote={prefill => {
            openNewQuoteModal(prefill);
          }}
        />
      )}
    </div>
  );
};
