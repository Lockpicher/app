import React, { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import DOMPurify from 'dompurify';

import { 
  Save, 
  Trash2, 
  Star, 
  ArrowLeft, 
  FolderKanban, 
  Book, 
  Calendar, 
  Clock, 
  Bell, 
  Paperclip, 
  Mic, 
  Volume2, 
  CheckSquare, 
  Link2, 
  ExternalLink, 
  Tag, 
  Sparkles, 
  Copy, 
  Download, 
  Upload, 
  Check, 
  Bold as BoldIcon, 
  Italic as ItalicIcon, 
  Underline as UnderlineIcon, 
  Strikethrough, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Minus, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify, 
  Undo, 
  Redo, 
  Palette, 
  Highlighter, 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  Eye, 
  Edit3, 
  AlertCircle,
  FileText,
  Boxes,
  Maximize2,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';

import { 
  AppNote, 
  AppNotebook, 
  AppProject, 
  AppTask, 
  AppObject, 
  AppReminder, 
  AppAttachment 
} from '../lib/types';
import { db, storage } from '../lib/insforge';
import { r2Storage } from '../lib/r2Client';
import { AudioRecorderModal } from './AudioRecorderModal';

interface RichNoteEditorProps {
  note: AppNote;
  notebooks: AppNotebook[];
  projects: AppProject[];
  tasks: AppTask[];
  objects: AppObject[];
  onBack: () => void;
  onSave: (noteId: string, updates: Partial<AppNote>) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
  onNavigateToEntity: (id: string, type: string) => void;
  onCreateTaskFromNote?: (title: string, noteId: string) => Promise<void>;
}

export const RichNoteEditor: React.FC<RichNoteEditorProps> = ({
  note,
  notebooks,
  projects,
  tasks,
  objects,
  onBack,
  onSave,
  onDelete,
  onNavigateToEntity,
  onCreateTaskFromNote
}) => {
  const [title, setTitle] = useState(note.title);
  const [notebookId, setNotebookId] = useState(note.notebook_id || '');
  const [projectId, setProjectId] = useState(note.project_id || '');
  const [isFavorite, setIsFavorite] = useState(!!note.is_favorite);
  const [isPinned, setIsPinned] = useState(!!note.is_pinned);
  const [tagsInput, setTagsInput] = useState((note.tags || []).join(', '));
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');

  // Sidebar Tabs inside editor
  const [sidebarTab, setSidebarTab] = useState<'none' | 'reminders' | 'tasks' | 'entities' | 'attachments'>('none');
  const [attachments, setAttachments] = useState<AppAttachment[]>([]);
  const [reminders, setReminders] = useState<AppReminder[]>([]);
  
  // Reminder Form
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [reminderDesc, setReminderDesc] = useState('');

  // Voice recorder modal
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isReTranscribing, setIsReTranscribing] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);

  // Drag & drop file overlay
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [lightboxImgUrl, setLightboxImgUrl] = useState<string | null>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);

  const lastSelectionRef = useRef<{ from: number; to: number } | null>(null);

  // TipTap Editor initialization
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: true, allowBase64: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'text-blue-400 underline hover:text-blue-300'
        }
      })
    ],
    editorProps: {
      handlePaste: (_view, event) => {
        const items = Array.from(event.clipboardData?.items || []);
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              event.preventDefault();
              handleInsertImage(file);
              return true;
            }
          }
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files || []);
        for (const file of files) {
          if (file.type.startsWith('image/')) {
            event.preventDefault();
            handleInsertImage(file);
            return true;
          }
        }
        return false;
      }
    },
    content: (() => {
      // If content_json exists, check whether note.content (HTML) contains images that might be missing in content_json
      if (note.content_json && typeof note.content_json === 'object' && Object.keys(note.content_json).length > 0) {
        const jsonStr = JSON.stringify(note.content_json);
        const htmlHasImage = typeof note.content === 'string' && note.content.includes('<img');
        const jsonHasImage = jsonStr.includes('"type":"image"') || jsonStr.includes('"image"');
        
        // If HTML has image tags but JSON missed them, prefer the HTML version to prevent disappearing images
        if (htmlHasImage && !jsonHasImage) {
          return note.content;
        }
        return note.content_json;
      }
      if (note.content && typeof note.content === 'string') {
        const trimmed = note.content.trim();
        if (
          trimmed.includes('<p>') || 
          trimmed.includes('<h1>') || 
          trimmed.includes('<h2>') || 
          trimmed.includes('<h3>') || 
          trimmed.includes('<img') || 
          trimmed.includes('<br') ||
          trimmed.includes('<ul>') ||
          trimmed.includes('<ol>')
        ) {
          return trimmed;
        }
        return trimmed
          .split('\n')
          .map(line => `<p>${line || '<br>'}</p>`)
          .join('');
      }
      if (note.thumbnail_url) {
        return `<p><img src="${note.thumbnail_url}" alt="${note.title || 'Imagen'}" /></p><p></p>`;
      }
      return '<p></p>';
    })(),
    onSelectionUpdate: ({ editor: currentEditor }) => {
      const { from, to } = currentEditor.state.selection;
      lastSelectionRef.current = { from, to };
    },
    onUpdate: () => {
      setSaveStatus('dirty');
    }
  });

  // Load attachments & reminders on mount
  useEffect(() => {
    loadAttachments();
    loadReminders();
  }, [note.id]);

  const loadAttachments = async () => {
    try {
      const items = await db.getAttachments(note.id);
      setAttachments(items);
    } catch (e) {
      console.warn('Error fetching attachments for note:', e);
    }
  };

  const loadReminders = async () => {
    try {
      const all = await db.getReminders();
      setReminders(all.filter(r => r.note_id === note.id));
    } catch (e) {
      console.warn('Error fetching reminders for note:', e);
    }
  };

  // Perform Save with robust error handling and classification
  const isSavingRef = useRef(false);
  const handleSave = async () => {
    if (!editor || isSavingRef.current) return;
    try {
      isSavingRef.current = true;
      setSaveStatus('saving');
      const json = editor.getJSON();
      const html = editor.getHTML();
      const plainText = editor.getText();
      const tags = tagsInput
        .split(',')
        .map(t => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      // Extract first image as thumbnail if available
      const imgMatch = html.match(/<img[^>]+src="([^">]+)"/);
      const thumbUrl = imgMatch ? imgMatch[1] : (note.thumbnail_url || null);

      // Check for Task Items in content
      const hasTaskList = html.includes('data-type="taskList"') || 
                          html.includes('data-type="taskItem"') || 
                          Boolean(html.match(/<li[^>]+data-type="taskItem"/i)) ||
                          (json && JSON.stringify(json).includes('"type":"taskList"'));

      const hasImages = Boolean(imgMatch);
      const hasText = plainText.trim().length > 0;

      // Determine dynamic note_type
      let calculatedType: AppNote['note_type'] = note.note_type || 'text';
      if (note.note_type === 'audio') {
        calculatedType = 'audio';
      } else if (hasTaskList) {
        calculatedType = 'tasks';
      } else if (hasImages && !hasText) {
        calculatedType = 'image';
      } else {
        calculatedType = 'text';
      }

      await onSave(note.id, {
        title: title.trim() || 'Nota sin título',
        content: html,
        content_json: json,
        plain_text: plainText,
        notebook_id: notebookId || null,
        project_id: projectId || undefined,
        is_favorite: isFavorite,
        is_pinned: isPinned,
        tags,
        note_type: calculatedType,
        thumbnail_url: thumbUrl
      });

      setSaveStatus('saved');
    } catch (err: any) {
      console.error('Error guardando nota en InsForge:', err);
      // Keep local content dirty so user does not lose changes and can retry
      setSaveStatus('dirty');
    } finally {
      isSavingRef.current = false;
    }
  };

  // Auto-save debounce (800ms for fast responsiveness without freezing)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (saveStatus === 'dirty') {
        handleSave();
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [saveStatus, title, notebookId, projectId, isFavorite, isPinned, tagsInput]);

  // Robust insertion helper that restores cursor position, falls back cleanly and persists
  const insertImageAtCursor = async (imageUrl: string, altText?: string) => {
    if (!editor) return;

    try {
      // 1. Focus editor and restore last valid cursor position if available
      editor.commands.focus();
      if (lastSelectionRef.current && typeof lastSelectionRef.current.from === 'number') {
        const docSize = editor.state.doc.content.size;
        const targetPos = Math.min(Math.max(0, lastSelectionRef.current.from), docSize);
        editor.commands.setTextSelection(targetPos);
      }

      // 2. Primary insertion: insert image block/node
      let inserted = editor
        .chain()
        .focus()
        .insertContent({
          type: 'image',
          attrs: { src: imageUrl, alt: altText || 'Imagen adjunta' }
        })
        .insertContent('<p></p>')
        .run();

      // 3. Fallback: setImage command
      if (!inserted) {
        inserted = editor
          .chain()
          .focus()
          .setImage({ src: imageUrl, alt: altText || 'Imagen adjunta' })
          .insertContent('<p></p>')
          .run();
      }

      // 4. Fallback 2: HTML snippet
      if (!inserted) {
        editor
          .chain()
          .focus()
          .insertContent(`<p><img src="${imageUrl}" alt="${altText || 'Imagen adjunta'}" /></p><p></p>`)
          .run();
      }

      // 5. Update save status and trigger save
      setSaveStatus('dirty');
      await handleSave();
    } catch (insertErr) {
      console.error('Error al insertar imagen en editor:', insertErr);
    }
  };

  // Helper to insert non-image attachment link into the editor
  const insertAttachmentLinkAtCursor = async (fileUrl: string, fileName: string) => {
    if (!editor) return;

    try {
      editor.commands.focus();
      if (lastSelectionRef.current && typeof lastSelectionRef.current.from === 'number') {
        const docSize = editor.state.doc.content.size;
        const targetPos = Math.min(Math.max(0, lastSelectionRef.current.from), docSize);
        editor.commands.setTextSelection(targetPos);
      }

      editor
        .chain()
        .focus()
        .insertContent(`<p>📎 <a href="${fileUrl}" target="_blank" rel="noopener noreferrer">${fileName}</a></p><p></p>`)
        .run();

      setSaveStatus('dirty');
      await handleSave();
    } catch (err) {
      console.error('Error al insertar enlace de adjunto en editor:', err);
    }
  };

  // Insert Image from user desktop
  const handleInsertImage = async (file: File) => {
    try {
      setIsUploadingImage(true);
      const res = await r2Storage.uploadFile(file, `notes/${note.id}/images`);
      
      await insertImageAtCursor(res.url, res.name || file.name);

      try {
        await db.recordAttachment({
          entity_id: note.id,
          entity_type: 'note',
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
        loadAttachments();
      } catch (attErr) {
        console.warn('Adjunto registrado en la nota visualmente, error en metadatos secundarios:', attErr);
      }
    } catch (e: any) {
      console.error('Error insertando imagen en nota:', e);
      alert('Error subiendo imagen: ' + (e.message || 'Error de red en Storage'));
    } finally {
      setIsUploadingImage(false);
      if (fileUploadInputRef.current) {
        fileUploadInputRef.current.value = '';
      }
    }
  };

  // Insert Link
  const handleAddLink = () => {
    const url = prompt('Ingresa la URL del enlace (https://...):');
    if (!url) return;
    if (editor) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  // Insert Table
  const handleInsertTable = () => {
    if (editor) {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }
  };

  // Insert Safe HTML
  const handleInsertSafeHtml = () => {
    const raw = prompt('Ingresa el código HTML a insertar (será sanitizado de forma segura):');
    if (!raw) return;
    const cleanHtml = DOMPurify.sanitize(raw);
    if (editor) {
      editor.chain().focus().insertContent(cleanHtml).run();
    }
  };

  // Create Reminder
  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderDate) return;
    const combinedIso = new Date(`${reminderDate}T${reminderTime}:00`).toISOString();

    const created = await db.createReminder({
      note_id: note.id,
      title: `Recordatorio: ${title}`,
      description: reminderDesc.trim() || undefined,
      remind_at: combinedIso,
      status: 'pending'
    });

    if (created) {
      setReminders(prev => [...prev, created]);
      setReminderDesc('');
      await onSave(note.id, {
        reminder_at: combinedIso,
        reminder_status: 'pending'
      });
    }
  };

  // Re-transcribe audio with ElevenLabs
  const handleReTranscribe = async () => {
    if (!note.audio_url) return;
    try {
      setIsReTranscribing(true);
      setSttError(null);
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_url: note.audio_url, language_code: 'es' })
      });
      const data = await res.json();
      if (res.ok && data.text) {
        await onSave(note.id, {
          audio_transcription: data.text,
          audio_transcription_status: 'completed'
        });
        if (editor) {
          editor.chain().focus().insertContent(`<p><strong>Transcripción ElevenLabs:</strong> ${data.text}</p>`).run();
        }
      } else {
        setSttError(data.error || 'No se pudo transcribir con ElevenLabs Scribe');
      }
    } catch (e: any) {
      setSttError(e.message || 'Error al conectar con el servidor de transcripción');
    } finally {
      setIsReTranscribing(false);
    }
  };

  // Drag and Drop File Handlers from OS Desktop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDropFiles = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        await handleInsertImage(file);
      } else {
        // Upload document or other file to R2
        const res = await r2Storage.uploadFile(file, `notes/${note.id}/files`);
        await db.recordAttachment({
          entity_id: note.id,
          entity_type: 'note',
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
        if (editor) {
          editor.chain().focus().insertContent(`<p>📎 <a href="${res.url}" target="_blank">${res.name}</a> (${(res.size / 1024).toFixed(1)} KB)</p>`).run();
        }
        loadAttachments();
      }
    }
  };

  const noteTasks = tasks.filter(t => t.note_id === note.id);

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropFiles}
      className="flex-1 flex flex-col h-screen bg-[#14141c] overflow-hidden relative"
    >
      {/* Desktop Drag-and-Drop Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 z-50 bg-blue-600/20 backdrop-blur-sm border-2 border-dashed border-blue-400 flex flex-col items-center justify-center pointer-events-none animate-fadeIn">
          <Upload className="w-12 h-12 text-blue-400 animate-bounce mb-2" />
          <p className="text-sm font-bold text-white">Suelta tus archivos aquí para adjuntarlos a InsForge</p>
          <p className="text-xs text-blue-200">Imágenes, documentos, audios o PDFs</p>
        </div>
      )}

      {/* Top Header & Metadata Bar */}
      <div className="px-6 py-3 border-b border-[#252538] bg-[#111117] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <button
            onClick={onBack}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#20202e] transition"
            title="Volver a la cuadrícula de notas"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-semibold text-gray-400 truncate max-w-[200px] sm:max-w-xs">
            {title || 'Nota sin título'}
          </span>
        </div>

        {/* Notebook & Project Selectors */}
        <div className="flex items-center gap-2">
          {/* Notebook Selector */}
          <div className="flex items-center gap-1.5 bg-[#181824] px-2.5 py-1.5 rounded-lg border border-[#2b2b3e]">
            <Book className="w-3.5 h-3.5 text-blue-400" />
            <select
              value={notebookId}
              onChange={(e) => {
                setNotebookId(e.target.value);
                setSaveStatus('dirty');
              }}
              className="bg-transparent text-xs text-gray-200 outline-none cursor-pointer"
            >
              <option value="" className="bg-[#181824]">Sin Cuaderno</option>
              {notebooks.map(nb => (
                <option key={nb.id} value={nb.id} className="bg-[#181824]">{nb.name}</option>
              ))}
            </select>
          </div>

          {/* Project Selector */}
          <div className="flex items-center gap-1.5 bg-[#181824] px-2.5 py-1.5 rounded-lg border border-[#2b2b3e]">
            <FolderKanban className="w-3.5 h-3.5 text-purple-400" />
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setSaveStatus('dirty');
              }}
              className="bg-transparent text-xs text-gray-200 outline-none cursor-pointer max-w-[130px] truncate"
            >
              <option value="" className="bg-[#181824]">Sin Proyecto</option>
              {projects.map(p => (
                <option key={p.id} value={p.id} className="bg-[#181824]">{p.title}</option>
              ))}
            </select>
          </div>

          {/* Favorite Toggle */}
          <button
            onClick={() => {
              setIsFavorite(!isFavorite);
              setSaveStatus('dirty');
            }}
            className={`p-2 rounded-lg transition ${
              isFavorite ? 'text-amber-400 bg-amber-500/10' : 'text-gray-400 hover:text-white hover:bg-[#20202e]'
            }`}
            title={isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>

          {/* Save Status Indicator */}
          <div className="flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded bg-[#181824] border border-[#262638]">
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-emerald-400">
                <Check className="w-3 h-3" />
                Guardado
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-blue-400 animate-pulse">
                Guardando...
              </span>
            )}
            {saveStatus === 'dirty' && (
              <span className="flex items-center gap-1 text-amber-400">
                Cambios pendientes
              </span>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-white rounded-lg text-xs font-semibold shadow-sm transition ${
              saveStatus === 'saving' 
                ? 'bg-blue-800 cursor-wait opacity-80' 
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            {saveStatus === 'saving' ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Voice Note Audio Banner (If Note has audio attached) */}
      {(note.audio_url || note.note_type === 'audio') && (
        <div className="px-6 py-3 bg-red-950/20 border-b border-red-900/30 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-600/30 text-red-400 flex items-center justify-center flex-shrink-0">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-red-300 block font-mono">
                Nota de Voz Grabada
              </span>
              <audio controls src={note.audio_url || undefined} className="h-8 max-w-xs mt-1" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {note.audio_transcription ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                  <Check className="w-3 h-3" /> Transcripción ElevenLabs lista
                </span>
                <button
                  onClick={() => {
                    if (editor && note.audio_transcription) {
                      editor.chain().focus().insertContent(`<p>${note.audio_transcription}</p>`).run();
                    }
                  }}
                  className="px-2.5 py-1 bg-red-900/40 hover:bg-red-800/50 text-red-200 text-xs rounded-lg transition"
                >
                  Insertar en texto
                </button>
              </div>
            ) : (
              <button
                onClick={handleReTranscribe}
                disabled={isReTranscribing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-600 to-indigo-600 hover:from-red-500 text-white text-xs font-semibold rounded-lg shadow transition disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isReTranscribing ? 'Transcribiendo...' : 'Transcribir con ElevenLabs'}
              </button>
            )}
          </div>
        </div>
      )}

      {sttError && (
        <div className="px-6 py-2 bg-amber-950/50 border-b border-amber-800/40 text-amber-200 text-xs flex items-center justify-between">
          <span>{sttError}</span>
          <button onClick={() => setSttError(null)} className="text-amber-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Zoho Notebook Style Rich Toolbar */}
      {editor && (
        <div className="px-3 sm:px-6 py-2 border-b border-[#222232] bg-[#161622] flex items-center justify-between gap-2 text-xs overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 flex-nowrap min-w-max">
            {/* Undo / Redo */}
            <button
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#252538] disabled:opacity-30"
              title="Deshacer (Ctrl+Z)"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#252538] disabled:opacity-30"
              title="Rehacer (Ctrl+Y)"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-4 bg-[#2b2b3e] mx-1" />

            {/* Headings */}
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-1.5 rounded transition ${
                editor.isActive('heading', { level: 1 }) ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
              }`}
              title="Encabezado H1"
            >
              <Heading1 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-1.5 rounded transition ${
                editor.isActive('heading', { level: 2 }) ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
              }`}
              title="Encabezado H2"
            >
              <Heading2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={`p-1.5 rounded transition ${
                editor.isActive('heading', { level: 3 }) ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
              }`}
              title="Encabezado H3"
            >
              <Heading3 className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-4 bg-[#2b2b3e] mx-1" />

            {/* Inline Formatting */}
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded transition ${
                editor.isActive('bold') ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
              }`}
              title="Negrita (Ctrl+B)"
            >
              <BoldIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded transition ${
                editor.isActive('italic') ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
              }`}
              title="Cursiva (Ctrl+I)"
            >
              <ItalicIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded transition ${
                editor.isActive('underline') ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
              }`}
              title="Subrayado (Ctrl+U)"
            >
              <UnderlineIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`p-1.5 rounded transition ${
                editor.isActive('strike') ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
              }`}
              title="Tachado"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
              className={`p-1.5 rounded transition ${
                editor.isActive('highlight') ? 'bg-yellow-400 text-black' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
              }`}
              title="Resaltado"
            >
              <Highlighter className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-4 bg-[#2b2b3e] mx-1" />

            {/* Alignments */}
            <button
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              className={`p-1.5 rounded transition ${
                editor.isActive({ textAlign: 'left' }) ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
              }`}
              title="Alinear a la izquierda"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              className={`p-1.5 rounded transition ${
                editor.isActive({ textAlign: 'center' }) ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
              }`}
              title="Centrar"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              className={`p-1.5 rounded transition ${
                editor.isActive({ textAlign: 'right' }) ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
              }`}
              title="Alinear a la derecha"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-4 bg-[#2b2b3e] mx-1" />

            {/* Lists & Task Checklist */}
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded transition ${
                editor.isActive('bulletList') ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
              }`}
              title="Lista con viñetas"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-1.5 rounded transition ${
                editor.isActive('orderedList') ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
              }`}
              title="Lista numerada"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              className={`p-1.5 rounded transition ${
                editor.isActive('taskList') ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:bg-[#252538]'
              }`}
              title="Lista de Tareas Interactivas"
            >
              <CheckSquare className="w-3.5 h-3.5" />
            </button>

            <span className="w-px h-4 bg-[#2b2b3e] mx-1" />

            {/* Media & Structures */}
            <button
              onClick={handleInsertTable}
              className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#252538]"
              title="Insertar Tabla Editable (3x3)"
            >
              <Boxes className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleAddLink}
              className={`p-1.5 rounded transition ${
                editor.isActive('link') ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
              }`}
              title="Insertar Enlace"
            >
              <Link2 className="w-3.5 h-3.5" />
            </button>

            {/* Upload Image Button */}
            <input
              type="file"
              ref={fileUploadInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleInsertImage(e.target.files[0]);
                }
              }}
            />
            <button
              onClick={() => fileUploadInputRef.current?.click()}
              disabled={isUploadingImage}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition text-xs ${
                isUploadingImage
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 cursor-wait'
                  : 'text-gray-300 hover:text-white hover:bg-[#252538] border border-transparent'
              }`}
              title={isUploadingImage ? 'Subiendo e insertando imagen...' : 'Insertar imagen en la nota'}
            >
              {isUploadingImage ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                  <span className="text-[11px] font-medium text-blue-300">Subiendo imagen...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline text-[11px]">Imagen</span>
                </>
              )}
            </button>

            {/* Record Voice Note Button */}
            <button
              onClick={() => setIsVoiceModalOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-red-600/20 text-red-300 hover:bg-red-600/30 border border-red-500/30 transition"
              title="Grabar Nota de Voz & Transcribir"
            >
              <Mic className="w-3 h-3 text-red-400" />
              <span>Grabar Voz</span>
            </button>

            {/* Safe HTML Block */}
            <button
              onClick={handleInsertSafeHtml}
              className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#252538] font-mono text-[10px]"
              title="Insertar bloque HTML sanitizado de forma segura"
            >
              &lt;/&gt;
            </button>
          </div>

          {/* Right Toolbar Panels Toggle */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSidebarTab(sidebarTab === 'tasks' ? 'none' : 'tasks')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition text-[11px] ${
                sidebarTab === 'tasks' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-[#20202e]'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
              Tareas ({noteTasks.length})
            </button>

            <button
              onClick={() => setSidebarTab(sidebarTab === 'reminders' ? 'none' : 'reminders')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition text-[11px] ${
                sidebarTab === 'reminders' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:bg-[#20202e]'
              }`}
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              Recordatorios ({reminders.length})
            </button>

            <button
              onClick={() => setSidebarTab(sidebarTab === 'attachments' ? 'none' : 'attachments')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition text-[11px] ${
                sidebarTab === 'attachments' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-[#20202e]'
              }`}
            >
              <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
              Adjuntos ({attachments.length})
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area + Collapsible Inspector Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Editor Body - Centered Document Layout (Notion / Craft style) */}
        <div 
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target && target.tagName === 'IMG') {
              const src = target.getAttribute('src');
              if (src) setLightboxImgUrl(src);
            }
          }}
          className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-10"
        >
          {/* Centered Document Column (840px max width) */}
          <div className="max-w-[840px] mx-auto w-full space-y-6">
            {/* Note Title inside the document column */}
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setSaveStatus('dirty');
              }}
              placeholder="Título de la nota..."
              className="w-full bg-transparent text-2xl sm:text-3xl font-extrabold text-white outline-none placeholder-gray-600 font-sans tracking-tight leading-tight"
            />

            {/* Note Tags, Date and Metadata Header aligned with title axis */}
            <div className="flex items-center justify-between text-xs text-gray-400 pb-3 border-b border-[#222232] flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Tag className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => {
                    setTagsInput(e.target.value);
                    setSaveStatus('dirty');
                  }}
                  placeholder="Añadir etiquetas separadas por coma..."
                  className="bg-transparent text-xs text-gray-300 outline-none w-full placeholder-gray-600 focus:placeholder-gray-500"
                />
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-gray-400">
                <Calendar className="w-3 h-3 text-gray-400" />
                <span>{new Date(note.updated_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>

            {/* TipTap Rich Text Area */}
            <div 
              onClick={() => {
                if (editor && !editor.isFocused) {
                  editor.commands.focus('end');
                }
              }}
              className="w-full min-h-[450px] text-gray-100 cursor-text pb-10"
            >
              <EditorContent editor={editor} className="outline-none" />
            </div>

            {/* Zoho Notebook Style: Quick Add Task Bar */}
            <div className="pt-2 pb-32 border-t border-[#20202e] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  if (editor) {
                    editor.chain().focus('end').toggleTaskList().run();
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-emerald-400 bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-800/40 transition group"
              >
                <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                <span>+ Agregar elemento de tarea</span>
              </button>

              <span className="text-[11px] font-mono text-gray-500">
                Presiona Enter dentro de una tarea para crear otra automáticamente
              </span>
            </div>
          </div>
        </div>

        {/* Inspector Sidebar Panel (Tasks, Reminders, Attachments) */}
        {sidebarTab !== 'none' && (
          <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-80 border-l border-[#222232] bg-[#12121a] flex flex-col h-full overflow-hidden shadow-2xl animate-fadeIn">
            {/* Sidebar Tab Header */}
            <div className="px-4 py-3 border-b border-[#222232] flex items-center justify-between bg-[#0e0e15]">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                {sidebarTab === 'tasks' && 'Tareas Vinculadas'}
                {sidebarTab === 'reminders' && 'Recordatorios'}
                {sidebarTab === 'attachments' && 'Archivos & Medios'}
              </h4>
              <button
                onClick={() => setSidebarTab('none')}
                className="text-gray-400 hover:text-white p-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Tasks Tab */}
              {sidebarTab === 'tasks' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Tareas completas de Segundo Cerebro asociadas a esta nota:
                  </p>

                  {noteTasks.length === 0 ? (
                    <div className="p-4 rounded-xl bg-[#171722] border border-[#252538] text-center text-xs text-gray-400">
                      No hay tareas vinculadas.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {noteTasks.map(t => (
                        <div
                          key={t.id}
                          className="p-2.5 rounded-lg bg-[#161622] border border-[#252538] flex items-center justify-between text-xs"
                        >
                          <span className={t.status === 'completed' ? 'line-through text-gray-400' : 'text-white'}>
                            {t.title}
                          </span>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-blue-950 text-blue-300">
                            {t.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {onCreateTaskFromNote && (
                    <button
                      onClick={() => {
                        const taskName = prompt('Nombre de la tarea a crear para esta nota:');
                        if (taskName) {
                          onCreateTaskFromNote(taskName, note.id);
                        }
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Crear Tarea en Segundo Cerebro
                    </button>
                  )}
                </div>
              )}

              {/* Reminders Tab */}
              {sidebarTab === 'reminders' && (
                <div className="space-y-4">
                  <form onSubmit={handleAddReminder} className="p-3 bg-[#161622] rounded-xl border border-[#252538] space-y-2.5">
                    <span className="text-[11px] font-bold text-gray-200 block">Programar Recordatorio</span>
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-0.5">Fecha</label>
                      <input
                        type="date"
                        required
                        value={reminderDate}
                        onChange={(e) => setReminderDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#101015] border border-[#29293a] rounded-lg text-xs text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-0.5">Hora</label>
                      <input
                        type="time"
                        required
                        value={reminderTime}
                        onChange={(e) => setReminderTime(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#101015] border border-[#29293a] rounded-lg text-xs text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 block mb-0.5">Nota o descripción</label>
                      <input
                        type="text"
                        value={reminderDesc}
                        onChange={(e) => setReminderDesc(e.target.value)}
                        placeholder="Ej. Revisar cotización..."
                        className="w-full px-2.5 py-1.5 bg-[#101015] border border-[#29293a] rounded-lg text-xs text-white outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition"
                    >
                      Guardar Recordatorio
                    </button>
                  </form>

                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-gray-400 block">Recordatorios Activos</span>
                    {reminders.map(rem => (
                      <div
                        key={rem.id}
                        className="p-2.5 rounded-lg bg-[#161622] border border-[#252538] flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="text-white font-medium">{rem.title}</p>
                          <span className="text-[10px] text-amber-400 font-mono">
                            {new Date(rem.remind_at).toLocaleString()}
                          </span>
                        </div>
                        <button
                          onClick={async () => {
                            await db.deleteReminder(rem.id);
                            setReminders(prev => prev.filter(r => r.id !== rem.id));
                          }}
                          className="text-gray-500 hover:text-red-400 p-1"
                          title="Eliminar recordatorio"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachments Tab */}
              {sidebarTab === 'attachments' && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-gray-400">
                      Archivos subidos a Cloudflare R2 / Storage para esta nota:
                    </p>
                    {attachments.map(att => {
                      const isImg = att.mime_type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(att.file_name);
                      return (
                        <div
                          key={att.id}
                          className="p-2.5 rounded-lg bg-[#161622] border border-[#252538] flex flex-col gap-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-hidden pr-2">
                              {isImg ? (
                                <img
                                  src={att.file_url}
                                  alt=""
                                  onClick={() => setLightboxImgUrl(att.file_url)}
                                  className="w-8 h-8 rounded object-cover cursor-pointer hover:opacity-80 border border-[#2b2b3e] flex-shrink-0"
                                />
                              ) : (
                                <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              )}
                              <div className="overflow-hidden">
                                <p className="text-white font-medium truncate text-xs">{att.display_name || att.file_name}</p>
                                <span className="text-[10px] text-gray-400 font-mono">
                                  {((att.file_size || 0) / 1024).toFixed(1)} KB
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <a
                                href={att.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-cyan-400 hover:text-cyan-300"
                                title="Abrir archivo original"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>

                          {/* Quick Action: Insert in note content */}
                          {isImg ? (() => {
                            const currentHtml = editor ? editor.getHTML() : '';
                            const isAlreadyInserted = currentHtml.includes(att.file_url) || (att.r2_key && currentHtml.includes(att.r2_key));

                            return (
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  // Prevent blur of editor so cursor selection is not lost
                                  e.preventDefault();
                                }}
                                onClick={async () => {
                                  await insertImageAtCursor(att.file_url, att.display_name || att.file_name);
                                }}
                                className={`w-full py-1.5 px-2 rounded text-[11px] font-medium transition flex items-center justify-center gap-1.5 ${
                                  isAlreadyInserted
                                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 hover:bg-emerald-900/50'
                                    : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30'
                                }`}
                              >
                                {isAlreadyInserted ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    Insertada (Insertar en posición actual)
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3 h-3 text-blue-400" />
                                    Insertar en la nota
                                  </>
                                )}
                              </button>
                            );
                          })() : (
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                              }}
                              onClick={async () => {
                                await insertAttachmentLinkAtCursor(att.file_url, att.display_name || att.file_name);
                              }}
                              className="w-full py-1 px-2 rounded bg-[#20202e] hover:bg-[#28283a] text-gray-300 border border-[#2b2b3e] text-[11px] font-medium transition flex items-center justify-center gap-1.5"
                            >
                              <Plus className="w-3 h-3" />
                              Insertar enlace en nota
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Voice Recorder Modal */}
      <AudioRecorderModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        notebookId={notebookId}
        onSaveVoiceNote={async (audioData) => {
          await onSave(note.id, {
            note_type: 'audio',
            audio_url: audioData.audioUrl,
            audio_duration: audioData.durationSeconds,
            audio_transcription: audioData.transcription,
            audio_transcription_status: audioData.transcriptionStatus
          });
          if (editor && audioData.transcription) {
            editor.chain().focus().insertContent(`<p><strong>Transcripción de Voz:</strong> ${audioData.transcription}</p>`).run();
          }
        }}
      />

      {/* Lightbox Modal for Embedded Images */}
      {lightboxImgUrl && (
        <div 
          onClick={() => setLightboxImgUrl(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn cursor-zoom-out"
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setLightboxImgUrl(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white p-1 rounded-lg bg-black/50"
            >
              ✕ Cerrar
            </button>
            <img 
              src={lightboxImgUrl} 
              alt="Vista previa" 
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()} 
            />
            <div className="mt-3 flex items-center gap-3">
              <a
                href={lightboxImgUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver tamaño completo
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
