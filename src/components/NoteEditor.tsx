import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Save, 
  Trash2, 
  Pin, 
  FolderKanban, 
  Image as ImageIcon, 
  Paperclip, 
  Eye, 
  Edit3, 
  Columns, 
  Link2, 
  Tag, 
  Sparkles,
  ArrowUpRight,
  Upload,
  Check,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { AppNote, AppProject, AppLink } from '../lib/types';
import { storage } from '../lib/insforge';

interface NoteEditorProps {
  note: AppNote;
  projects: AppProject[];
  allEntities: { id: string; title: string; type: string }[];
  incomingLinks: AppLink[];
  onSave: (noteId: string, updates: Partial<AppNote>, wikilinks: string[]) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
  onNavigateToEntity: (id: string, type: string) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  projects,
  allEntities,
  incomingLinks,
  onSave,
  onDelete,
  onNavigateToEntity
}) => {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content || '');
  const [projectId, setProjectId] = useState(note.project_id || '');
  const [category, setCategory] = useState(note.category || 'General');
  const [tagsInput, setTagsInput] = useState((note.tags || []).join(', '));
  const [isPinned, setIsPinned] = useState(!!note.is_pinned);
  
  // View mode: 'edit' | 'split' | 'preview'
  const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('split');
  const [isUploading, setIsUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [showBacklinks, setShowBacklinks] = useState(true);

  // Wikilink autocomplete state
  const [showLinkSuggestions, setShowLinkSuggestions] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');
  const [suggestionCursorPos, setSuggestionCursorPos] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content || '');
    setProjectId(note.project_id || '');
    setCategory(note.category || 'General');
    setTagsInput((note.tags || []).join(', '));
    setIsPinned(!!note.is_pinned);
    setSaveStatus('saved');
  }, [note.id]);

  // Extract all [[wikilinks]] from content
  const extractWikilinks = (text: string): string[] => {
    const regex = /\[\[(.*?)\]\]/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      const linkTitle = match[1].trim();
      if (linkTitle && !matches.includes(linkTitle)) {
        matches.push(linkTitle);
      }
    }
    return matches;
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    const tags = tagsInput
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const wikilinks = extractWikilinks(content);

    await onSave(note.id, {
      title,
      content,
      project_id: projectId || undefined,
      category,
      tags,
      is_pinned: isPinned,
    }, wikilinks);

    setSaveStatus('saved');
  };

  // Auto-save debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (
        title !== note.title ||
        content !== (note.content || '') ||
        projectId !== (note.project_id || '') ||
        isPinned !== !!note.is_pinned
      ) {
        handleSave();
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [title, content, projectId, isPinned]);

  // Handle Wikilink Autocomplete while typing [[
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const cursor = e.target.selectionStart;
    setContent(newText);
    setSaveStatus('dirty');

    const textBeforeCursor = newText.slice(0, cursor);
    const lastOpen = textBeforeCursor.lastIndexOf('[[');
    const lastClose = textBeforeCursor.lastIndexOf(']]');

    if (lastOpen !== -1 && lastOpen > lastClose) {
      const query = textBeforeCursor.slice(lastOpen + 2);
      if (!query.includes('\n')) {
        setLinkQuery(query.toLowerCase());
        setShowLinkSuggestions(true);
        setSuggestionCursorPos(lastOpen);
        return;
      }
    }
    setShowLinkSuggestions(false);
  };

  const insertWikilink = (targetTitle: string) => {
    if (suggestionCursorPos === null || !textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const before = content.slice(0, suggestionCursorPos);
    const after = content.slice(cursor);
    const newContent = `${before}[[${targetTitle}]]${after}`;
    setContent(newContent);
    setShowLinkSuggestions(false);
    
    setTimeout(() => {
      if (textareaRef.current) {
        const nextPos = suggestionCursorPos + targetTitle.length + 4;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 50);
  };

  // Upload file to InsForge Storage and insert markdown syntax
  const handleFileUpload = async (file: File) => {
    try {
      setIsUploading(true);
      const res = await storage.uploadFile(file, 'notes');
      
      const isImg = file.type.startsWith('image/');
      const markdownSnippet = isImg 
        ? `\n\n![${res.name}](${res.url})\n\n`
        : `\n\n📄 [${res.name}](${res.url})\n\n`;

      const nextContent = content + markdownSnippet;
      setContent(nextContent);
      setSaveStatus('dirty');
    } catch (err: any) {
      alert('Error subiendo archivo a InsForge Storage: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Drag & Drop onto editor
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const filteredSuggestions = allEntities.filter(e => 
    e.id !== note.id && e.title.toLowerCase().includes(linkQuery)
  ).slice(0, 7);

  const outgoingLinks = extractWikilinks(content);

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#16161d] overflow-hidden">
      {/* Editor Header Toolbar */}
      <div className="px-6 py-3 border-b border-[#252530] bg-[#141419] flex items-center justify-between gap-4">
        {/* Left: Project & Category */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[#1c1c25] px-2.5 py-1 rounded-md border border-[#2e2e3d]">
            <FolderKanban className="w-3.5 h-3.5 text-blue-400" />
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setSaveStatus('dirty');
              }}
              aria-label="Proyecto Asociado"
              className="bg-transparent text-xs text-gray-200 outline-none cursor-pointer"
            >
              <option value="">Sin Proyecto</option>
              {projects.map(p => (
                <option key={p.id} value={p.id} className="bg-[#1c1c25]">
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setIsPinned(!isPinned);
              setSaveStatus('dirty');
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition border ${
              isPinned
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-[#1c1c25] text-gray-400 border-[#2e2e3d] hover:text-gray-200'
            }`}
          >
            <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-400 text-amber-400' : ''}`} />
            {isPinned ? 'Fijada' : 'Fijar'}
          </button>
        </div>

        {/* Center: View Switcher (Edit | Split | Preview) */}
        <div className="flex items-center bg-[#1c1c25] p-0.5 rounded-lg border border-[#2b2b3a]">
          <button
            onClick={() => setViewMode('edit')}
            className={`p-1.5 rounded-md text-xs transition ${
              viewMode === 'edit' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Solo Editor"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`p-1.5 rounded-md text-xs transition ${
              viewMode === 'split' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Vista Dividida (Split)"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('preview')}
            className={`p-1.5 rounded-md text-xs transition ${
              viewMode === 'preview' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Solo Lectura (Preview)"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* File Upload to InsForge Storage */}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs bg-[#1e1e28] hover:bg-[#282836] text-gray-300 border border-[#303040] transition"
            title="Subir archivo o imagen a InsForge Storage (bucket: app-storage)"
          >
            <Upload className={`w-3.5 h-3.5 text-cyan-400 ${isUploading ? 'animate-bounce' : ''}`} />
            {isUploading ? 'Subiendo...' : 'Adjuntar a Storage'}
          </button>

          {/* Save Status Indicator */}
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-purple-600 hover:bg-purple-500 text-white font-medium transition"
          >
            {saveStatus === 'saving' ? (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : saveStatus === 'saved' ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saveStatus === 'saved' ? 'Guardado' : 'Guardar'}
          </button>

          {/* Delete Button */}
          <button
            onClick={() => {
              if (confirm(`¿Estás seguro de eliminar "${note.title}"?`)) {
                onDelete(note.id);
              }
            }}
            className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition"
            title="Eliminar nota"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Note Title & Metadata Bar */}
      <div className="px-8 pt-6 pb-3 max-w-5xl w-full mx-auto">
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSaveStatus('dirty');
          }}
          placeholder="Título de la Nota..."
          className="w-full text-2xl lg:text-3xl font-bold bg-transparent text-white placeholder-gray-500 outline-none tracking-tight"
        />

        {/* Tags input bar */}
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
          <Tag className="w-3.5 h-3.5 text-purple-400" />
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => {
              setTagsInput(e.target.value);
              setSaveStatus('dirty');
            }}
            placeholder="Etiquetas (separadas por coma, ej: obsidian, backend, roadmap)..."
            className="bg-transparent text-xs text-gray-300 placeholder-gray-400 outline-none flex-1 border-b border-transparent focus:border-purple-500/50 py-0.5"
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
        {/* Editor Panes */}
        <div className="flex-1 flex overflow-hidden">
          {/* Markdown Textarea */}
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div className={`h-full flex flex-col ${viewMode === 'split' ? 'w-1/2 border-r border-[#242430]' : 'w-full'}`}>
              <div className="px-8 py-2 bg-[#121217] text-[11px] font-mono text-gray-400 border-b border-[#20202a] flex justify-between">
                <span>EDITOR MARKDOWN (Escribe [[ para enlazar)</span>
                <span>{content.length} caracteres</span>
              </div>
              <div className="flex-1 relative p-8 overflow-y-auto">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={handleContentChange}
                  placeholder="Comienza a escribir en Markdown...&#10;&#10;Usa [[Nombre de Nota o Proyecto]] para crear wikilinks interactivos tipo Obsidian.&#10;Arrastra imágenes o documentos para subirlos automáticamente a InsForge Storage."
                  className="w-full h-full bg-transparent text-gray-200 font-mono text-sm leading-relaxed resize-none outline-none selection:bg-purple-600/40"
                />

                {/* Wikilink Suggestion Popup */}
                {showLinkSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute left-8 bottom-12 w-72 bg-[#1c1c26] border border-purple-500/40 rounded-lg shadow-2xl shadow-purple-950/60 overflow-hidden z-30">
                    <div className="px-3 py-1.5 bg-purple-950/40 border-b border-purple-500/20 text-[10px] font-semibold text-purple-300 uppercase tracking-wider">
                      Enlazar Objeto o Nota: [[...]]
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-[#282836]">
                      {filteredSuggestions.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => insertWikilink(item.title)}
                          className="w-full px-3 py-2 text-left hover:bg-purple-600/20 transition flex items-center justify-between text-xs text-gray-200"
                        >
                          <span className="font-medium truncate">{item.title}</span>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#272736] text-gray-400">
                            {item.type}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Markdown Preview */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className={`h-full flex flex-col ${viewMode === 'split' ? 'w-1/2' : 'w-full'} bg-[#15151c]`}>
              <div className="px-8 py-2 bg-[#131319] text-[11px] font-mono text-gray-400 border-b border-[#20202a]">
                VISTA PREVIA RENDERIZADA
              </div>
              <div className="flex-1 p-8 overflow-y-auto markdown-body">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Custom wikilink renderer inside paragraphs
                    p: ({ children }) => {
                      return <p>{renderChildrenWithWikilinks(children, allEntities, onNavigateToEntity)}</p>;
                    },
                    li: ({ children }) => {
                      return <li>{renderChildrenWithWikilinks(children, allEntities, onNavigateToEntity)}</li>;
                    }
                  }}
                >
                  {content || '*No hay contenido todavía. Escribe en el editor para previsualizar.*'}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {/* Backlinks & Connections Sidebar */}
        <div className={`w-72 bg-[#131318] border-l border-[#242430] flex flex-col transition-all select-none ${showBacklinks ? '' : 'hidden'}`}>
          <div className="px-4 py-3 border-b border-[#242430] flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-purple-400" />
              Red de Vínculos
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Outgoing Wikilinks */}
            <div>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Enlaces Salientes ({outgoingLinks.length})
              </div>
              {outgoingLinks.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No contiene enlaces [[wikilinks]].</p>
              ) : (
                <div className="space-y-1.5">
                  {outgoingLinks.map((targetTitle, idx) => {
                    const match = allEntities.find(e => e.title.toLowerCase() === targetTitle.toLowerCase());
                    return (
                      <button
                        key={idx}
                        onClick={() => match && onNavigateToEntity(match.id, match.type)}
                        className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition border ${
                          match
                            ? 'bg-[#1c1c26] hover:bg-purple-950/30 text-purple-200 border-[#2b2b3a] hover:border-purple-500/40'
                            : 'bg-[#181820] text-gray-400 border-dashed border-[#2b2b3a]'
                        }`}
                      >
                        <span className="truncate">{targetTitle}</span>
                        {match ? (
                          <ArrowUpRight className="w-3 h-3 text-purple-400 flex-shrink-0" />
                        ) : (
                          <span className="text-[10px] text-gray-400">no creado</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Backlinks (Incoming Links) */}
            <div>
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Backlinks / Menciones ({incomingLinks.length})
              </div>
              {incomingLinks.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Ninguna otra nota o entidad enlaza aquí.</p>
              ) : (
                <div className="space-y-1.5">
                  {incomingLinks.map((link) => {
                    const source = allEntities.find(e => e.id === link.source_id);
                    return (
                      <button
                        key={link.id}
                        onClick={() => source && onNavigateToEntity(source.id, source.type)}
                        className="w-full text-left px-2.5 py-1.5 rounded text-xs bg-[#1c1c26] hover:bg-purple-950/30 text-purple-200 border border-[#2b2b3a] hover:border-purple-500/40 flex items-center justify-between transition"
                      >
                        <span className="truncate">{source?.title || 'Entidad origen'}</span>
                        <span className="text-[10px] font-mono uppercase text-gray-400">
                          {link.source_type}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Tips */}
            <div className="p-3 rounded-lg bg-[#181824] border border-[#272738] text-[11px] text-gray-400 space-y-1.5">
              <div className="text-purple-300 font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Atajos de Obsidian
              </div>
              <p>• Escribe <code className="text-purple-300 font-mono">[[</code> para autocompletar enlaces.</p>
              <p>• Arrastra imágenes al editor para subirlas a InsForge Storage.</p>
              <p>• Las conexiones aparecen en tiempo real en la vista de Grafo.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper to replace [[Title]] in React Markdown tree with interactive clickable pills
function renderChildrenWithWikilinks(
  children: React.ReactNode, 
  allEntities: { id: string; title: string; type: string }[],
  onNavigate: (id: string, type: string) => void
): React.ReactNode {
  if (typeof children === 'string') {
    const parts = children.split(/(\[\[.*?\]\])/g);
    return parts.map((part, index) => {
      const match = part.match(/^\[\[(.*?)\]\]$/);
      if (match) {
        const linkTitle = match[1];
        const entity = allEntities.find(e => e.title.toLowerCase() === linkTitle.toLowerCase());
        return (
          <span
            key={index}
            onClick={() => entity && onNavigate(entity.id, entity.type)}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium cursor-pointer transition mx-0.5 ${
              entity
                ? 'bg-purple-950/60 text-purple-300 hover:bg-purple-800/40 border border-purple-500/30'
                : 'bg-gray-800/60 text-gray-400 border border-dashed border-gray-600'
            }`}
            title={entity ? `Ir a ${entity.title} (${entity.type})` : 'Entidad no encontrada'}
          >
            <span>[[{linkTitle}]]</span>
          </span>
        );
      }
      return part;
    });
  }
  return children;
}
