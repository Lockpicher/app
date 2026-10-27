import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Search,
  BookOpen,
  Sparkles,
  Quote,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  RotateCw,
  Sliders,
  Maximize,
  ArrowLeft,
  Loader2
} from 'lucide-react';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

export interface BookPdfReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  bookTitle: string;
  bookAuthor?: string;
  bookId: string;
  initialPage?: number;
  totalPages?: number;
  onPageChange?: (newPage: number, totalPages: number) => void;
  onCaptureIdea?: (prefill: { page: number; selectedText?: string }) => void;
  onCaptureQuote?: (prefill: { page: number; quoteText: string }) => void;
}

interface SearchMatch {
  pageNumber: number;
  snippet: string;
}

export const BookPdfReaderModal: React.FC<BookPdfReaderModalProps> = ({
  isOpen,
  onClose,
  pdfUrl,
  bookTitle,
  bookAuthor,
  bookId,
  initialPage = 1,
  totalPages: propTotalPages,
  onPageChange,
  onCaptureIdea,
  onCaptureQuote
}) => {
  const [currentPage, setCurrentPage] = useState<number>(initialPage > 0 ? initialPage : 1);
  const [numPages, setNumPages] = useState<number>(propTotalPages || 0);
  const [scale, setScale] = useState<number>(1.2);
  const [fitMode, setFitMode] = useState<'custom' | 'width'>('width');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [viewerMode, setViewerMode] = useState<'canvas' | 'native'>('canvas');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Search in PDF
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  // Text selection & floating menu
  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const modalRootRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const pageInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Sync initialPage when modal opens
  useEffect(() => {
    if (isOpen && initialPage > 0) {
      setCurrentPage(initialPage);
    }
  }, [isOpen, initialPage]);

  // Load PDF document
  useEffect(() => {
    if (!isOpen || !pdfUrl) return;

    let isCancelled = false;
    setIsLoading(true);
    setRenderError(null);

    const loadDocument = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true,
          withCredentials: false
        });

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setIsLoading(false);

        // Notify parent about total pages if updated
        if (onPageChange && doc.numPages > 0) {
          onPageChange(currentPage, doc.numPages);
        }
      } catch (err: any) {
        if (isCancelled) return;
        console.error('Error cargando PDF con PDF.js:', err);
        setRenderError(err?.message || 'No se pudo procesar el archivo PDF directamente con el motor integrado.');
        setIsLoading(false);
      }
    };

    loadDocument();

    return () => {
      isCancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy().catch(() => {});
        pdfDocRef.current = null;
      }
    };
  }, [isOpen, pdfUrl]);

  // Render current page
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocRef.current || !canvasRef.current || viewerMode !== 'canvas') return;

    try {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await pdfDocRef.current.getPage(pageNum);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Determine scale based on fit mode
      let targetScale = scale;
      if (fitMode === 'width' && containerRef.current) {
        const containerWidth = containerRef.current.clientWidth - 48; // padding
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        if (containerWidth > 200 && unscaledViewport.width > 0) {
          targetScale = Math.min(2.5, Math.max(0.6, containerWidth / unscaledViewport.width));
        }
      }

      const viewport = page.getViewport({ scale: targetScale });
      const outputScale = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

      const renderContext: any = {
        canvasContext: context,
        transform: transform,
        viewport: viewport
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.warn('Error renderizando página PDF:', err);
      }
    }
  }, [scale, fitMode, viewerMode]);

  useEffect(() => {
    if (!isLoading && pdfDocRef.current && viewerMode === 'canvas') {
      renderPage(currentPage);
    }
  }, [currentPage, scale, fitMode, isLoading, viewerMode, renderPage]);

  // Auto-resize on window resize if in fit width mode
  useEffect(() => {
    if (fitMode !== 'width') return;
    const handleResize = () => {
      renderPage(currentPage);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fitMode, currentPage, renderPage]);

  // Notify parent of page change with debounce
  const notifyPageChange = useCallback((newPage: number) => {
    if (onPageChange && numPages > 0) {
      onPageChange(newPage, numPages);
    }
  }, [onPageChange, numPages]);

  const goToPage = (target: number) => {
    if (numPages <= 0) return;
    const clamped = Math.max(1, Math.min(target, numPages));
    setCurrentPage(clamped);
    notifyPageChange(clamped);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      goToPage(currentPage + 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevPage();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentPage, numPages, onClose]);

  // Handle text selection on reader
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectedText('');
      setSelectionPosition(null);
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 2) {
      setSelectedText(text);
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionPosition({
          x: Math.max(20, rect.left + rect.width / 2),
          y: Math.max(70, rect.top - 12)
        });
      } catch {
        setSelectionPosition(null);
      }
    } else {
      setSelectedText('');
      setSelectionPosition(null);
    }
  };

  // Document Search feature
  const performSearch = async () => {
    if (!searchQuery.trim() || !pdfDocRef.current) return;
    setIsSearching(true);
    setSearchResults([]);
    const q = searchQuery.toLowerCase().trim();
    const matches: SearchMatch[] = [];

    try {
      for (let p = 1; p <= pdfDocRef.current.numPages; p++) {
        const page = await pdfDocRef.current.getPage(p);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item: any) => item.str).join(' ');
        if (text.toLowerCase().includes(q)) {
          const idx = text.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 40);
          const end = Math.min(text.length, idx + q.length + 40);
          const snippet = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
          matches.push({ pageNumber: p, snippet });
        }
        if (matches.length >= 50) break; // limit
      }

      setSearchResults(matches);
      setCurrentMatchIndex(0);
      if (matches.length > 0) {
        goToPage(matches[0].pageNumber);
      }
    } catch (e) {
      console.error('Error buscando texto en PDF:', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleNextMatch = () => {
    if (searchResults.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % searchResults.length;
    setCurrentMatchIndex(nextIdx);
    goToPage(searchResults[nextIdx].pageNumber);
  };

  const handlePrevMatch = () => {
    if (searchResults.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentMatchIndex(prevIdx);
    goToPage(searchResults[prevIdx].pageNumber);
  };

  // Zoom helpers
  const handleZoomIn = () => {
    setFitMode('custom');
    setScale(prev => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setFitMode('custom');
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleFitWidth = () => {
    setFitMode('width');
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!modalRootRef.current) return;
    if (!document.fullscreenElement) {
      modalRootRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Quick Capture triggers
  const triggerCaptureIdea = (text?: string) => {
    setSelectedText('');
    setSelectionPosition(null);
    if (onCaptureIdea) {
      onCaptureIdea({ page: currentPage, selectedText: text || selectedText });
    }
  };

  const triggerCaptureQuote = (text?: string) => {
    setSelectedText('');
    setSelectionPosition(null);
    if (onCaptureQuote) {
      onCaptureQuote({ page: currentPage, quoteText: text || selectedText });
    }
  };

  const copySelectedText = () => {
    if (selectedText) {
      navigator.clipboard.writeText(selectedText);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={modalRootRef}
      className="fixed inset-0 z-50 bg-[#0e0e14]/95 backdrop-blur-md flex flex-col select-none overflow-hidden"
    >
      {/* Top Navigation Bar */}
      <div className="h-14 sm:h-16 px-3 sm:px-6 bg-[#16161f] border-b border-[#252536] flex items-center justify-between gap-2 z-20 flex-shrink-0 shadow-lg">
        {/* Left: Book Title & Author */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="p-2 -ml-1 text-gray-400 hover:text-white hover:bg-[#252536] rounded-xl transition"
            title="Volver a la ficha del libro (Esc)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <span className="truncate">{bookTitle}</span>
            </h2>
            {bookAuthor && (
              <p className="text-[10px] sm:text-[11px] text-gray-400 truncate">
                {bookAuthor}
              </p>
            )}
          </div>
        </div>

        {/* Center: Page Navigation Controls */}
        <div className="flex items-center gap-1 sm:gap-2 bg-[#1d1d2b] border border-[#2d2d42] px-2 py-1 rounded-xl shadow-inner">
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="p-1 sm:p-1.5 text-gray-300 hover:text-white disabled:text-gray-600 hover:bg-[#2b2b40] disabled:hover:bg-transparent rounded-lg transition"
            title="Página anterior (← o PageUp)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 text-xs font-mono text-gray-300">
            <span className="hidden sm:inline text-gray-400 text-[11px]">Pág.</span>
            <input
              ref={pageInputRef}
              type="number"
              min={1}
              max={numPages || 1}
              value={currentPage}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) goToPage(val);
              }}
              className="w-12 sm:w-14 text-center bg-[#13131c] border border-[#3b3b55] rounded-md px-1 py-0.5 text-white font-bold text-xs focus:border-purple-500 outline-none"
            />
            <span className="text-gray-500">/</span>
            <span className="text-gray-400">{numPages || '—'}</span>
          </div>

          <button
            onClick={handleNextPage}
            disabled={numPages > 0 && currentPage >= numPages}
            className="p-1 sm:p-1.5 text-gray-300 hover:text-white disabled:text-gray-600 hover:bg-[#2b2b40] disabled:hover:bg-transparent rounded-lg transition"
            title="Página siguiente (→, PageDown o Espacio)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Quick Capture, Zoom & Tools */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Quick Capture Buttons */}
          <div className="hidden md:flex items-center gap-1.5 border-r border-[#2b2b40] pr-2 mr-1">
            <button
              onClick={() => triggerCaptureIdea()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 transition shadow-sm"
              title={`Capturar idea sobre la página ${currentPage}`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Capturar Idea</span>
            </button>

            <button
              onClick={() => triggerCaptureQuote()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 border border-purple-500/30 transition shadow-sm"
              title={`Registrar cita de la página ${currentPage}`}
            >
              <Quote className="w-3.5 h-3.5 text-purple-400" />
              <span>Registrar Cita</span>
            </button>
          </div>

          {/* Search Trigger */}
          <button
            onClick={() => {
              setIsSearchOpen(!isSearchOpen);
              if (!isSearchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            className={`p-2 rounded-xl transition ${isSearchOpen ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40' : 'text-gray-400 hover:text-white hover:bg-[#252536]'}`}
            title="Buscar texto en el libro (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Zoom controls (Canvas mode only) */}
          {viewerMode === 'canvas' && (
            <div className="hidden lg:flex items-center gap-1 bg-[#1d1d2b] border border-[#2d2d42] p-1 rounded-xl">
              <button
                onClick={handleZoomOut}
                className="p-1 text-gray-300 hover:text-white hover:bg-[#2b2b40] rounded-lg transition"
                title="Reducir zoom"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-gray-400 px-1">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1 text-gray-300 hover:text-white hover:bg-[#2b2b40] rounded-lg transition"
                title="Ampliar zoom"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleFitWidth}
                className={`px-2 py-0.5 text-[10px] rounded-lg transition ${fitMode === 'width' ? 'bg-purple-600/40 text-purple-200 border border-purple-500/40' : 'text-gray-400 hover:text-white hover:bg-[#2b2b40]'}`}
                title="Ajustar ancho a la pantalla"
              >
                Ajustar ancho
              </button>
            </div>
          )}

          {/* Viewer Mode Switcher */}
          <button
            onClick={() => setViewerMode(viewerMode === 'canvas' ? 'native' : 'canvas')}
            className={`p-2 rounded-xl text-xs flex items-center gap-1.5 transition ${viewerMode === 'native' ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' : 'text-gray-400 hover:text-white hover:bg-[#252536]'}`}
            title={viewerMode === 'canvas' ? 'Cambiar a visor nativo del navegador' : 'Cambiar a lector integrado'}
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden xl:inline text-[11px]">
              {viewerMode === 'canvas' ? 'Visor Nativo' : 'Lector Integrado'}
            </span>
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="hidden sm:inline-flex p-2 text-gray-400 hover:text-white hover:bg-[#252536] rounded-xl transition"
            title="Pantalla completa"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-red-950/40 hover:text-red-400 rounded-xl transition"
            title="Cerrar lector"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search Toolbar (Expandable) */}
      {isSearchOpen && (
        <div className="bg-[#1b1b26] border-b border-[#2b2b40] px-4 py-2 flex items-center justify-between gap-3 flex-wrap z-20 animate-fadeIn">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') performSearch();
              }}
              placeholder="Buscar palabra o frase en el libro..."
              className="flex-1 bg-[#12121b] border border-[#2f2f45] rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-purple-500"
            />
            <button
              onClick={performSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition flex items-center gap-1.5"
            >
              {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Buscar</span>}
            </button>
          </div>

          {/* Search Results Navigation */}
          {searchResults.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <span className="text-purple-300 font-mono text-[11px]">
                {currentMatchIndex + 1} de {searchResults.length} {searchResults.length === 1 ? 'coincidencia' : 'coincidencias'}
              </span>
              <button
                onClick={handlePrevMatch}
                className="p-1 rounded bg-[#252538] hover:bg-[#32324b] text-gray-300 transition"
                title="Coincidencia anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleNextMatch}
                className="p-1 rounded bg-[#252538] hover:bg-[#32324b] text-gray-300 transition"
                title="Siguiente coincidencia"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {searchResults.length === 0 && !isSearching && searchQuery.trim() && (
            <span className="text-[11px] text-gray-400">Sin coincidencias</span>
          )}

          <button
            onClick={() => setIsSearchOpen(false)}
            className="text-gray-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Reader Viewport */}
      <div 
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className="flex-1 overflow-auto bg-[#0a0a0f] relative flex flex-col items-center justify-start p-2 sm:p-6"
      >
        {/* Loading state */}
        {isLoading && (
          <div className="my-auto flex flex-col items-center gap-3 text-gray-400 py-16">
            <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
            <p className="text-sm font-medium text-gray-300">Cargando libro digital...</p>
            <p className="text-xs text-gray-500">Preparando páginas y tipografías</p>
          </div>
        )}

        {/* Error Fallback: Render with Native Iframe option */}
        {!isLoading && renderError && (
          <div className="my-auto max-w-lg p-6 rounded-2xl bg-[#191926] border border-amber-500/30 text-center space-y-4 shadow-2xl">
            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
            <h3 className="text-base font-bold text-white">Visualización optimizada</h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              El motor integrado encontró una limitación con la estructura de este PDF. Puedes abrirlo directamente con el visor nativo del navegador sin problemas.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setViewerMode('native')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition flex items-center gap-2 shadow"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Usar Visor Nativo</span>
              </button>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-[#252538] hover:bg-[#32324b] text-gray-200 rounded-xl text-xs font-semibold transition"
              >
                Abrir en nueva pestaña
              </a>
            </div>
          </div>
        )}

        {/* Canvas PDF Viewer */}
        {!isLoading && !renderError && viewerMode === 'canvas' && (
          <div className="relative shadow-2xl rounded-sm border border-[#2b2b3a] bg-white transition-transform duration-150">
            <canvas ref={canvasRef} className="block mx-auto max-w-full" />
          </div>
        )}

        {/* Native Browser PDF Embed Mode */}
        {viewerMode === 'native' && (
          <div className="w-full h-full flex-1 flex flex-col rounded-xl overflow-hidden border border-[#252538] bg-[#16161f]">
            <iframe
              src={`${pdfUrl}#page=${currentPage}&toolbar=1&navpanes=1`}
              title={bookTitle}
              className="w-full h-full flex-1 border-0"
            />
          </div>
        )}

        {/* Floating Text Selection Context Menu */}
        {selectedText && selectionPosition && (
          <div
            style={{
              position: 'fixed',
              left: `${selectionPosition.x}px`,
              top: `${selectionPosition.y}px`,
              transform: 'translate(-50%, -100%)'
            }}
            className="z-50 bg-[#1e1e2d] border border-[#3b3b55] rounded-xl shadow-2xl p-1.5 flex items-center gap-1.5 animate-scaleUp"
          >
            <button
              onClick={() => triggerCaptureQuote(selectedText)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition shadow"
              title="Guardar como cita destacada"
            >
              <Quote className="w-3.5 h-3.5" />
              <span>Cita (Pág. {currentPage})</span>
            </button>

            <button
              onClick={() => triggerCaptureIdea(selectedText)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-500 transition shadow"
              title="Guardar como idea reflexiva"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Idea</span>
            </button>

            <button
              onClick={copySelectedText}
              className="p-1.5 text-gray-300 hover:text-white hover:bg-[#2b2b40] rounded-lg transition"
              title="Copiar texto"
            >
              {copiedNotification ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Mobile Bottom Quick Bar */}
      <div className="md:hidden h-14 bg-[#14141c] border-t border-[#232330] px-4 flex items-center justify-around z-20 flex-shrink-0">
        <button
          onClick={handlePrevPage}
          disabled={currentPage <= 1}
          className="p-2 text-gray-300 disabled:text-gray-600 rounded-lg"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => triggerCaptureIdea()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Idea</span>
        </button>

        <button
          onClick={() => triggerCaptureQuote()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30"
        >
          <Quote className="w-3.5 h-3.5" />
          <span>Cita</span>
        </button>

        <button
          onClick={handleNextPage}
          disabled={numPages > 0 && currentPage >= numPages}
          className="p-2 text-gray-300 disabled:text-gray-600 rounded-lg"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
