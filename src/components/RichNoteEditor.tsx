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
  Image as ImageIcon,
  ChevronDown,
  Rows,
  Columns,
  RotateCw,
  AlertTriangle,
  Lock,
  Unlock
} from 'lucide-react';

import { 
  AppNote, 
  AppNotebook, 
  AppProject, 
  AppTask, 
  AppObject, 
  AppReminder, 
  AppAttachment,
  AppArea,
  ObjectTypeDefinition
} from '../lib/types';
import { db, storage } from '../lib/insforge';
import { r2Storage } from '../lib/r2Client';
import { hashPassword } from '../lib/security';
import { AudioRecorderModal } from './AudioRecorderModal';
import { UniversalLinkSelectorModal, UniversalLinkItem } from './UniversalLinkSelectorModal';
import { TableGridPicker } from './TableGridPicker';
import { TableToolbar } from './TableToolbar';
import { AudioNode } from './tiptap/AudioNode';
import { AudioInsertModal } from './AudioInsertModal';

interface RichNoteEditorProps {
  note: AppNote;
  notebooks: AppNotebook[];
  projects: AppProject[];
  tasks: AppTask[];
  objects: AppObject[];
  areas?: AppArea[];
  customTypes?: ObjectTypeDefinition[];
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
  areas = [],
  customTypes = [],
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
  const [isLocked, setIsLocked] = useState(!!note.is_locked);
  const [passwordInput, setPasswordInput] = useState('');
  const [existingHash, setExistingHash] = useState<string | null>(note.password_hash || null);
  const [showPasswordBox, setShowPasswordBox] = useState(false);
  const [tagsInput, setTagsInput] = useState((note.tags || []).join(', '));
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  // Universal Link Selector state & Trigger
  const [isUniversalLinkModalOpen, setIsUniversalLinkModalOpen] = useState(false);
  const [linkInitialQuery, setLinkInitialQuery] = useState('');

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

  // Table management menu state
  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);
  const tableMenuRef = useRef<HTMLDivElement>(null);

  // Drag & drop file overlay
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [lightboxImgUrl, setLightboxImgUrl] = useState<string | null>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);
  const lastSelectionRef = useRef<{ from: number; to: number } | null>(null);

  // Delete note state & modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      AudioNode,
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
          } else if (item.type.startsWith('audio/')) {
            const file = item.getAsFile();
            if (file) {
              event.preventDefault();
              handleInsertAudioFile(file);
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
          } else if (file.type.startsWith('audio/')) {
            event.preventDefault();
            handleInsertAudioFile(file);
            return true;
          }
        }
        return false;
      }
    },
    content: (() => {
      // If content_json exists, check whether note.content (HTML) contains images or audio that might be missing in content_json
      if (note.content_json && typeof note.content_json === 'object' && Object.keys(note.content_json).length > 0) {
        const jsonStr = JSON.stringify(note.content_json);
        const htmlHasImage = typeof note.content === 'string' && note.content.includes('<img');
        const jsonHasImage = jsonStr.includes('"type":"image"') || jsonStr.includes('"image"');
        const htmlHasAudio = typeof note.content === 'string' && (note.content.includes('audio-player') || note.content.includes('<audio'));
        const jsonHasAudio = jsonStr.includes('audioNode');
        
        // If HTML has images or audio but JSON missed them, prefer the HTML version to prevent disappearing media
        if ((htmlHasImage && !jsonHasImage) || (htmlHasAudio && !jsonHasAudio)) {
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
    onUpdate: ({ editor: currentEditor }) => {
      setSaveStatus('dirty');

      // Check for [[ or @ trigger at cursor position
      try {
        const { from } = currentEditor.state.selection;
        const textBefore = currentEditor.state.doc.textBetween(Math.max(0, from - 30), from, '\n', '\n');

        // Check for double bracket [[
        const bracketIndex = textBefore.lastIndexOf('[[');
        if (bracketIndex !== -1) {
          const queryAfterBracket = textBefore.slice(bracketIndex + 2);
          if (!queryAfterBracket.includes(']]') && queryAfterBracket.length < 25) {
            setLinkInitialQuery(queryAfterBracket.trim());
            setIsUniversalLinkModalOpen(true);
            return;
          }
        }

        // Check for @ mention trigger
        const atIndex = textBefore.lastIndexOf('@');
        if (atIndex !== -1 && (atIndex === 0 || /\s/.test(textBefore[atIndex - 1]))) {
          const queryAfterAt = textBefore.slice(atIndex + 1);
          if (!queryAfterAt.includes(' ') && queryAfterAt.length < 20) {
            setLinkInitialQuery(queryAfterAt.trim());
            setIsUniversalLinkModalOpen(true);
            return;
          }
        }
      } catch (err) {
        // Silently continue
      }
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
  const handleSave = async (): Promise<boolean> => {
    if (!editor || isSavingRef.current) return false;
    try {
      isSavingRef.current = true;
      setSaveStatus('saving');
      setSaveErrorMessage(null);
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

      let finalHash: string | null = null;
      if (isLocked) {
        if (passwordInput.trim()) {
          finalHash = await hashPassword(passwordInput);
          setExistingHash(finalHash);
          setPasswordInput('');
        } else if (existingHash) {
          finalHash = existingHash;
        } else {
          setSaveStatus('error');
          setSaveErrorMessage('Establece una contraseña para bloquear la nota');
          return false;
        }
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
        is_locked: isLocked,
        password_hash: finalHash,
        tags,
        note_type: calculatedType,
        thumbnail_url: thumbUrl
      });

      setSaveStatus('saved');
      setSaveErrorMessage(null);
      return true;
    } catch (err: any) {
      console.error('Error guardando nota en InsForge:', err);
      // Keep local content dirty so user does not lose changes and can retry
      setSaveStatus('error');
      setSaveErrorMessage(err.message || 'Error de conexión');
      return false;
    } finally {
      isSavingRef.current = false;
    }
  };

  // Safe Back handler: if changes are dirty or error, save before leaving
  const handleSafeBack = async () => {
    if (saveStatus === 'dirty' || saveStatus === 'error') {
      await handleSave();
    }
    onBack();
  };

  // Auto-save debounce:
  // - 800ms normalmente para respuesta instantánea
  // - Pausado si el usuario tiene el panel de contraseña abierto y está escribiendo una nueva clave, para que no corte mientras escribe
  useEffect(() => {
    // Si el usuario está escribiendo una nueva contraseña, dar suficiente tiempo o esperar a que termine
    const isTypingPassword = showPasswordBox && isLocked && passwordInput.length > 0;
    const delay = isTypingPassword ? 3000 : 800;

    const timer = setTimeout(() => {
      if (saveStatus === 'dirty') {
        // Si activó el candado pero el campo de contraseña aún está vacío y no hay hash previo, no intentar guardar aún para no mostrar error
        if (isLocked && !passwordInput.trim() && !existingHash) {
          return;
        }
        handleSave();
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [saveStatus, title, notebookId, projectId, isFavorite, isPinned, isLocked, passwordInput, tagsInput, showPasswordBox]);

  // Close table dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tableMenuRef.current && !tableMenuRef.current.contains(event.target as Node)) {
        setIsTableMenuOpen(false);
      }
    };
    if (isTableMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTableMenuOpen]);

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

  const handleInsertAudioFile = async (file: File) => {
    try {
      setIsUploadingImage(true);
      const res = await r2Storage.uploadFile(file, `notes/${note.id}/audio`);
      let attachmentId = '';
      try {
        const createdAtt = await db.recordAttachment({
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
        if (createdAtt) attachmentId = createdAtt.id;
        loadAttachments();
      } catch (attErr) {
        console.warn('Adjunto de audio registrado en la nota visualmente, error en metadatos:', attErr);
      }

      if (editor) {
        editor.chain().focus().setAudioNode({
          src: res.url,
          title: file.name.replace(/\.[^/.]+$/, ''),
          fileId: attachmentId,
          r2Key: res.r2Key,
          mimeType: res.mime,
          size: res.size
        }).run();
      }
      setSaveStatus('dirty');
    } catch (e: any) {
      console.error('Error insertando audio en nota:', e);
      alert('Error subiendo audio: ' + (e.message || 'Error de red'));
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Insert Link
  const handleAddLink = () => {
    setIsUniversalLinkModalOpen(true);
  };

  // Insert linked entity chip into TipTap editor and record in links table
  const handleUniversalLinkSelect = async (item: UniversalLinkItem, relationLabel = 'mention') => {
    if (!editor) return;

    try {
      editor.commands.focus();

      // Clean up [[ or @ prefix if user had typed it
      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 30), from, '\n', '\n');
      
      let replaceFrom = from;
      const bracketIdx = textBefore.lastIndexOf('[[');
      const atIdx = textBefore.lastIndexOf('@');

      if (bracketIdx !== -1) {
        replaceFrom = from - (textBefore.length - bracketIdx);
      } else if (atIdx !== -1) {
        replaceFrom = from - (textBefore.length - atIdx);
      }

      if (replaceFrom < from) {
        editor.chain().deleteRange({ from: replaceFrom, to: from }).run();
      }

      // Capacities-style interactive chip HTML
      const chipHtml = `<a href="#entity/${item.type}/${item.id}" data-entity-id="${item.id}" data-entity-type="${item.type}" class="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 rounded-md text-xs font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/50 hover:bg-blue-900/60 transition no-underline"><span>🔗</span><span>${item.title}</span></a> `;

      editor
        .chain()
        .focus()
        .insertContent(chipHtml)
        .run();

      // Record link in database
      await db.createUniversalLink(note.id, 'note', item.id, item.type, relationLabel);

      setSaveStatus('dirty');
    } catch (err) {
      console.error('Error insertando vínculo universal:', err);
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

  // Trigger delete modal or discard unsaved changes
  const handleDeleteClick = () => {
    // If the note does not exist yet in DB or has no valid ID
    if (!note.id) {
      if (window.confirm('Esta nota no ha sido guardada en la base de datos. ¿Deseas descartar los cambios y salir?')) {
        onBack();
      }
      return;
    }

    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  // Perform permanent deletion through existing onDelete prop
  const handleDeleteConfirm = async () => {
    if (!note.id || isDeleting) return;

    try {
      setIsDeleting(true);
      setDeleteError(null);

      // Call parent deletion handler
      await onDelete(note.id);

      // Close modal and navigate back to the origin notes list/notebook
      setIsDeleteModalOpen(false);
      onBack();
    } catch (err: any) {
      console.error('Error eliminando la nota desde el editor:', err);
      // Keep note open and display informative error message
      setDeleteError(err.message || 'Error al eliminar la nota de la base de datos.');
    } finally {
      setIsDeleting(false);
    }
  };

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

      {/* Top Header & Metadata Bar - Fully Responsive with Dedicated Mobile Action Tier */}
      <div className="border-b border-[#252538] bg-[#111117] flex-shrink-0 z-20">
        {/* Tier 1: Main Bar (Back, Title, Status & Primary Actions: Guardar, Eliminar, Favorito) */}
        <div className="px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 min-h-[48px]">
          {/* Left: Back button & Title */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={handleSafeBack}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#20202e] transition flex-shrink-0"
              title="Volver (guarda cambios automáticamente)"
              aria-label="Volver a la vista anterior"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-semibold text-gray-300 truncate max-w-[140px] sm:max-w-xs block">
              {title || 'Nota sin título'}
            </span>

            {/* Save Status Indicator - Always visible next to title/back */}
            <div 
              className={`flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border transition flex-shrink-0 ${
                saveStatus === 'saved' 
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40' 
                  : saveStatus === 'saving'
                  ? 'bg-blue-950/40 text-blue-400 border-blue-800/40 animate-pulse'
                  : saveStatus === 'error'
                  ? 'bg-red-950/50 text-red-400 border-red-800/50'
                  : 'bg-amber-950/40 text-amber-400 border-amber-800/40'
              }`}
              title={
                saveStatus === 'error' 
                  ? `Error al guardar: ${saveErrorMessage || 'Reintentar'}` 
                  : saveStatus === 'saving'
                  ? 'Guardando cambios en InsForge...'
                  : saveStatus === 'saved'
                  ? 'Cambios guardados con éxito'
                  : 'Hay cambios pendientes de guardar'
              }
            >
              {saveStatus === 'saved' && (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="hidden xs:inline">Guardado</span>
                </>
              )}
              {saveStatus === 'saving' && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                  <span>Guardando…</span>
                </>
              )}
              {saveStatus === 'dirty' && (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="hidden sm:inline">Pendiente</span>
                </>
              )}
              {saveStatus === 'error' && (
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-1 text-red-300 hover:text-white underline font-semibold"
                  title="Pulsar para reintentar guardado"
                >
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  <span>Error · Reintentar</span>
                </button>
              )}
            </div>
          </div>

          {/* Right: Permanent Actions (Desktop displays all; Mobile guarantees Guardar + Eliminar + Favorito) */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Desktop-only: Selectors inline */}
            <div className="hidden md:flex items-center gap-1.5">
              {/* Notebook Selector */}
              <div className="flex items-center gap-1.5 bg-[#181824] px-2 py-1 rounded-lg border border-[#2b2b3e]">
                <Book className="w-3.5 h-3.5 text-blue-400" />
                <select
                  value={notebookId}
                  onChange={(e) => {
                    setNotebookId(e.target.value);
                    setSaveStatus('dirty');
                  }}
                  className="bg-transparent text-xs text-gray-200 outline-none cursor-pointer max-w-[120px] truncate"
                >
                  <option value="" className="bg-[#181824]">Sin Cuaderno</option>
                  {notebooks.map(nb => (
                    <option key={nb.id} value={nb.id} className="bg-[#181824]">{nb.name}</option>
                  ))}
                </select>
              </div>

              {/* Project Selector */}
              <div className="flex items-center gap-1.5 bg-[#181824] px-2 py-1 rounded-lg border border-[#2b2b3e]">
                <FolderKanban className="w-3.5 h-3.5 text-purple-400" />
                <select
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    setSaveStatus('dirty');
                  }}
                  className="bg-transparent text-xs text-gray-200 outline-none cursor-pointer max-w-[120px] truncate"
                >
                  <option value="" className="bg-[#181824]">Sin Proyecto</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id} className="bg-[#181824]">{p.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Password Lock Toggle */}
            <button
              type="button"
              onClick={() => {
                setShowPasswordBox(!showPasswordBox);
              }}
              className={`p-1.5 rounded-lg transition relative ${
                isLocked ? 'text-amber-400 bg-amber-500/15' : 'text-gray-400 hover:text-white hover:bg-[#20202e]'
              }`}
              title={isLocked ? 'Nota protegida con contraseña (clic para configurar)' : 'Proteger esta nota con contraseña'}
              aria-label="Contraseña"
            >
              {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>

            {/* Favorite Toggle */}
            <button
              type="button"
              onClick={async () => {
                const nextFav = !isFavorite;
                setIsFavorite(nextFav);
                setSaveStatus('dirty');
                try {
                  await onSave(note.id, { is_favorite: nextFav });
                  setSaveStatus('saved');
                } catch {
                  // Fallback to auto-save debounce
                }
              }}
              className={`p-1.5 rounded-lg transition ${
                isFavorite 
                  ? 'text-amber-400 bg-amber-500/15 ring-1 ring-amber-500/30' 
                  : 'text-gray-400 hover:text-amber-300 hover:bg-[#20202e]'
              }`}
              title={isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
              aria-label="Favorito"
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>

            {/* Manual Save Button - Always visible, never hidden */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus === 'saving' || isDeleting}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-white rounded-lg text-xs font-semibold shadow-sm transition active:scale-95 ${
                saveStatus === 'saving' 
                  ? 'bg-blue-800 cursor-wait opacity-80' 
                  : saveStatus === 'error'
                  ? 'bg-red-600 hover:bg-red-500'
                  : 'bg-blue-600 hover:bg-blue-500'
              }`}
              title="Guardar nota manualmente"
              aria-label="Guardar nota"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">{saveStatus === 'saving' ? 'Guardando…' : 'Guardar'}</span>
            </button>

            {/* Delete Button - Always visible next to Guardar */}
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={isDeleting || saveStatus === 'saving'}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 border border-red-900/40 hover:border-red-800/60 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Eliminar esta nota"
              aria-label="Eliminar nota"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Eliminar</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Mobile Metadata Bar (Cuaderno, Proyecto y Estado detallado en pantallas estrechas) */}
        <div className="md:hidden px-3 py-1.5 bg-[#14141d] border-t border-[#1e1e2c] flex items-center justify-between gap-2 overflow-x-auto no-scrollbar text-xs">
          {/* Mobile Notebook Selector */}
          <div className="flex items-center gap-1.5 bg-[#191925] px-2 py-1 rounded-md border border-[#2b2b3e] flex-1 min-w-[130px]">
            <Book className="w-3 h-3 text-blue-400 flex-shrink-0" />
            <select
              value={notebookId}
              onChange={(e) => {
                setNotebookId(e.target.value);
                setSaveStatus('dirty');
              }}
              className="bg-transparent text-[11px] text-gray-200 outline-none cursor-pointer w-full"
            >
              <option value="" className="bg-[#181824]">Sin Cuaderno</option>
              {notebooks.map(nb => (
                <option key={nb.id} value={nb.id} className="bg-[#181824]">{nb.name}</option>
              ))}
            </select>
          </div>

          {/* Mobile Project Selector */}
          <div className="flex items-center gap-1.5 bg-[#191925] px-2 py-1 rounded-md border border-[#2b2b3e] flex-1 min-w-[130px]">
            <FolderKanban className="w-3 h-3 text-purple-400 flex-shrink-0" />
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setSaveStatus('dirty');
              }}
              className="bg-transparent text-[11px] text-gray-200 outline-none cursor-pointer w-full"
            >
              <option value="" className="bg-[#181824]">Sin Proyecto</option>
              {projects.map(p => (
                <option key={p.id} value={p.id} className="bg-[#181824]">{p.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Password Protection Dropdown / Settings Banner */}
      {showPasswordBox && (
        <div className="px-4 sm:px-6 py-3 bg-[#13131c] border-b border-[#2b2b3d] animate-fadeIn flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-white block">
                Protección con Contraseña
              </span>
              <span className="text-[11px] text-gray-400">
                {isLocked
                  ? 'Esta nota requiere contraseña para abrirse.'
                  : 'Protege esta nota para que nadie pueda ver su contenido sin la clave.'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="flex items-center gap-2 cursor-pointer bg-[#1b1b26] px-3 py-1.5 rounded-xl border border-[#2b2b3e]">
              <input
                type="checkbox"
                checked={isLocked}
                onChange={(e) => {
                  setIsLocked(e.target.checked);
                  setSaveStatus('dirty');
                }}
                className="rounded bg-[#121218] border-[#2c2c3e] text-amber-500 focus:ring-0"
              />
              <span className="text-gray-200 font-medium">Bloquear</span>
            </label>

            {isLocked && (
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setSaveStatus('dirty');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setShowPasswordBox(false);
                    handleSave();
                  }
                }}
                placeholder={existingHash ? "Nueva clave (o blanco para mantener)" : "Escribe contraseña o PIN..."}
                className="px-3 py-1.5 bg-[#171722] border border-[#2c2c3e] rounded-xl text-xs text-white placeholder-gray-500 outline-none focus:border-amber-500 flex-1 sm:w-56"
              />
            )}

            <button
              type="button"
              onClick={() => {
                setShowPasswordBox(false);
                handleSave();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition shadow-sm"
            >
              Aplicar y Guardar
            </button>
          </div>
        </div>
      )}

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

      {/* Zoho Notebook Style Rich Toolbar - Centered relative to document area */}
      {editor && (
        <div className="w-full border-b border-[#222232] bg-[#161622] sticky top-0 z-20">
          <div className="max-w-[840px] mx-auto px-2 sm:px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            {/* Formatting Tools - Centered, uniform spacing, wrapping without horizontal scroll */}
            <div className="w-full flex-1 flex items-center justify-center flex-wrap gap-1 sm:gap-1.5 py-0.5">
              {/* Undo / Redo */}
              <button
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="p-1 sm:p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#252538] disabled:opacity-30 transition"
                title="Deshacer (Ctrl+Z)"
              >
                <Undo className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="p-1 sm:p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#252538] disabled:opacity-30 transition"
                title="Rehacer (Ctrl+Y)"
              >
                <Redo className="w-3.5 h-3.5" />
              </button>

              <span className="w-px h-3.5 bg-[#2b2b3e] mx-0.5" />

              {/* Headings */}
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-1 sm:p-1.5 rounded transition ${
                  editor.isActive('heading', { level: 1 }) ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                }`}
                title="Encabezado H1"
              >
                <Heading1 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-1 sm:p-1.5 rounded transition ${
                  editor.isActive('heading', { level: 2 }) ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                }`}
                title="Encabezado H2"
              >
                <Heading2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`p-1 sm:p-1.5 rounded transition ${
                  editor.isActive('heading', { level: 3 }) ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                }`}
                title="Encabezado H3"
              >
                <Heading3 className="w-3.5 h-3.5" />
              </button>

              <span className="w-px h-3.5 bg-[#2b2b3e] mx-0.5" />

              {/* Inline Formatting */}
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1 sm:p-1.5 rounded transition ${
                  editor.isActive('bold') ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                }`}
                title="Negrita (Ctrl+B)"
              >
                <BoldIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1 sm:p-1.5 rounded transition ${
                  editor.isActive('italic') ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                }`}
                title="Cursiva (Ctrl+I)"
              >
                <ItalicIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-1 sm:p-1.5 rounded transition ${
                  editor.isActive('underline') ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                }`}
                title="Subrayado (Ctrl+U)"
              >
                <UnderlineIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`p-1 sm:p-1.5 rounded transition ${
                  editor.isActive('strike') ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                }`}
                title="Tachado"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
                className={`p-1 sm:p-1.5 rounded transition ${
                  editor.isActive('highlight') ? 'bg-yellow-400 text-black' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                }`}
                title="Resaltado"
              >
                <Highlighter className="w-3.5 h-3.5" />
              </button>

              <span className="w-px h-3.5 bg-[#2b2b3e] mx-0.5" />

              {/* Alignments */}
              <button
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                className={`p-1 sm:p-1.5 rounded transition ${
                  editor.isActive({ textAlign: 'left' }) ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                }`}
                title="Alinear a la izquierda"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                className={`p-1 sm:p-1.5 rounded transition ${
                  editor.isActive({ textAlign: 'center' }) ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                }`}
                title="Centrar"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                className={`p-1 sm:p-1.5 rounded transition ${
                  editor.isActive({ textAlign: 'right' }) ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                }`}
                title="Alinear a la derecha"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>

              <span className="w-px h-3.5 bg-[#2b2b3e] mx-0.5" />

              {/* Lists & Task Checklist */}
              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1 sm:p-1.5 rounded transition ${
                  editor.isActive('bulletList') ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                }`}
                title="Lista con viñetas"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1 sm:p-1.5 rounded transition ${
                  editor.isActive('orderedList') ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#252538]'
                }`}
                title="Lista numerada"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className={`p-1 sm:p-1.5 rounded transition ${
                  editor.isActive('taskList') ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:bg-[#252538]'
                }`}
                title="Lista de Tareas Interactivas"
              >
                <CheckSquare className="w-3.5 h-3.5" />
              </button>

              <span className="w-px h-3.5 bg-[#2b2b3e] mx-0.5" />

              {/* Media & Structures: Visual Table Matrix Picker */}
              <TableGridPicker editor={editor} onTableDeleted={() => setSaveStatus('dirty')} />

              <button
                onClick={handleAddLink}
                className={`p-1 sm:p-1.5 rounded transition ${
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
                className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded transition text-xs ${
                  isUploadingImage
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 cursor-wait'
                    : 'text-gray-300 hover:text-white hover:bg-[#252538] border border-transparent'
                }`}
                title={isUploadingImage ? 'Subiendo e insertando imagen...' : 'Insertar imagen en la nota'}
              >
                {isUploadingImage ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                    <span className="hidden sm:inline text-[11px] font-medium text-blue-300">Subiendo...</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span className="hidden md:inline text-[11px]">Imagen</span>
                  </>
                )}
              </button>

              {/* Record Voice Note Button */}
              <button
                onClick={() => setIsVoiceModalOpen(true)}
                className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded bg-red-600/20 text-red-300 hover:bg-red-600/30 border border-red-500/30 transition text-[11px]"
                title="Grabar Nota de Voz & Transcribir"
              >
                <Mic className="w-3 h-3 text-red-400" />
                <span className="hidden sm:inline">Voz</span>
              </button>

              {/* Safe HTML Block */}
              <button
                onClick={handleInsertSafeHtml}
                className="p-1 sm:p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#252538] font-mono text-[11px]"
                title="Insertar bloque HTML sanitizado de forma segura"
              >
                &lt;/&gt;
              </button>
            </div>

            {/* Right Toolbar Panels Toggle */}
            <div className="flex items-center justify-center flex-wrap gap-1 sm:gap-1.5 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#222232]/80 sm:border-l sm:border-[#2b2b3e] sm:pl-2 shrink-0">
              <button
                onClick={() => setSidebarTab(sidebarTab === 'tasks' ? 'none' : 'tasks')}
                className={`flex items-center gap-1 px-2 py-1 rounded transition text-[11px] ${
                  sidebarTab === 'tasks' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-[#20202e]'
                }`}
              >
                <CheckSquare className="w-3 h-3 text-emerald-400" />
                <span>Tareas ({noteTasks.length})</span>
              </button>

              <button
                onClick={() => setSidebarTab(sidebarTab === 'reminders' ? 'none' : 'reminders')}
                className={`flex items-center gap-1 px-2 py-1 rounded transition text-[11px] ${
                  sidebarTab === 'reminders' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:bg-[#20202e]'
                }`}
              >
                <Bell className="w-3 h-3 text-amber-400" />
                <span>Recordatorios ({reminders.length})</span>
              </button>

              <button
                onClick={() => setSidebarTab(sidebarTab === 'attachments' ? 'none' : 'attachments')}
                className={`flex items-center gap-1 px-2 py-1 rounded transition text-[11px] ${
                  sidebarTab === 'attachments' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:bg-[#20202e]'
                }`}
              >
                <Paperclip className="w-3 h-3 text-cyan-400" />
                <span>Adjuntos ({attachments.length})</span>
              </button>
            </div>
          </div>

          {/* Dedicated Contextual Action Bar when Cursor is inside a Table */}
          <TableToolbar editor={editor} onTableDeleted={() => setSaveStatus('dirty')} />
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
            {/* Note Title and save indicator inside the document column */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setSaveStatus('dirty');
                  }}
                  placeholder="Título de la nota..."
                  className="flex-1 bg-transparent text-2xl sm:text-3xl font-extrabold text-white outline-none placeholder-gray-600 font-sans tracking-tight leading-tight min-w-[200px]"
                />

                {/* Inline Save Status indicator right by the title */}
                <div className="flex items-center gap-2">
                  {saveStatus === 'saved' && (
                    <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-800/40">
                      <Check className="w-3.5 h-3.5" />
                      <span>Guardado</span>
                    </span>
                  )}
                  {saveStatus === 'saving' && (
                    <span className="flex items-center gap-1.5 text-xs font-mono text-blue-400 bg-blue-950/50 px-2.5 py-1 rounded-full border border-blue-800/40 animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando…</span>
                    </span>
                  )}
                  {saveStatus === 'dirty' && (
                    <span className="flex items-center gap-1.5 text-xs font-mono text-amber-400 bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-800/40">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      <span>Cambios pendientes…</span>
                    </span>
                  )}
                  {saveStatus === 'error' && (
                    <button
                      type="button"
                      onClick={handleSave}
                      className="flex items-center gap-1.5 text-xs font-mono text-red-300 bg-red-950/60 hover:bg-red-900/60 px-3 py-1 rounded-full border border-red-800/50 transition active:scale-95"
                      title="Pulsar para reintentar guardar"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      <span>Error al guardar · Reintentar</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* TipTap Rich Text Area */}
            <div 
              onClick={(e) => {
                const target = e.target as HTMLElement;
                const entityLink = target.closest('[data-entity-id]');
                if (entityLink) {
                  e.preventDefault();
                  e.stopPropagation();
                  const entityId = entityLink.getAttribute('data-entity-id');
                  const entityType = entityLink.getAttribute('data-entity-type') || 'object';
                  if (entityId) {
                    onNavigateToEntity(entityId, entityType);
                  }
                  return;
                }

                if (editor && !editor.isFocused) {
                  editor.commands.focus('end');
                }
              }}
              className="w-full min-h-[450px] text-gray-100 cursor-text pb-6"
            >
              <EditorContent editor={editor} className="outline-none" />
            </div>

            {/* Editor Bottom Actions Row: Left "+ Agregar elemento de tarea" | Right "Añadir etiquetas..." */}
            <div className="pt-3 pb-32 border-t border-[#20202e] flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Left: Quick Add Task Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (editor) {
                      editor.chain().focus('end').toggleTaskList().run();
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-emerald-400 bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-800/40 transition group flex-shrink-0 active:scale-95"
                  title="Agregar elemento de tarea en el editor"
                >
                  <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  <span>+ Agregar elemento de tarea</span>
                </button>

                {/* Right: Tags input aligned in the same row */}
                <div className="flex items-center gap-2 bg-[#181824] px-3 py-1.5 rounded-xl border border-[#2b2b3e] focus-within:border-indigo-500/60 transition flex-1 sm:max-w-md w-full">
                  <Tag className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => {
                      setTagsInput(e.target.value);
                      setSaveStatus('dirty');
                    }}
                    placeholder="Añadir etiquetas separadas por coma..."
                    className="bg-transparent text-xs text-gray-200 outline-none w-full placeholder-gray-500 focus:placeholder-gray-400 font-sans"
                    aria-label="Etiquetas de la nota"
                  />
                </div>
              </div>

              {/* Note Date and Metadata at the bottom */}
              <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                <div className="flex items-center gap-2 font-mono text-[11px] text-gray-500">
                  <Calendar className="w-3 h-3 text-gray-500" />
                  <span>Última edición: {new Date(note.updated_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
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

      {/* Audio & Voice Note In-Document Insert Modal */}
      <AudioInsertModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        editor={editor}
        entityId={note.id}
        entityType="note"
        existingAttachments={attachments}
        onAudioInserted={async (audioData) => {
          if (!note.audio_url) {
            await onSave(note.id, {
              note_type: 'audio',
              audio_url: audioData.url,
              audio_duration: audioData.duration
            });
          }
          setSaveStatus('dirty');
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

      {/* Delete Note Confirmation Dialog */}
      {isDeleteModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-note-modal-title"
          aria-describedby="delete-note-modal-description"
        >
          <div 
            className="w-full max-w-md bg-[#181824] border border-[#2e2e42] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800/50 flex items-center justify-center text-red-400 flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 id="delete-note-modal-title" className="text-base font-bold text-white tracking-tight">
                  ¿Eliminar nota?
                </h3>
                <p id="delete-note-modal-description" className="text-sm text-gray-400">
                  Esta acción eliminará de forma permanente la nota{' '}
                  <span className="font-semibold text-gray-200 break-words">
                    «{title?.trim() || note.title?.trim() || 'Nota sin título'}»
                  </span>.
                </p>
              </div>
            </div>

            {/* Error Message if backend deletion failed */}
            {deleteError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/60 flex items-start gap-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block">No se pudo eliminar la nota:</span>
                  <span>{deleteError}</span>
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) {
                    setIsDeleteModalOpen(false);
                    setDeleteError(null);
                  }
                }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-gray-300 hover:text-white bg-[#222232] hover:bg-[#2a2a3e] border border-[#323246] transition disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-red-600 hover:bg-red-500 active:scale-95 transition flex items-center gap-2 shadow-lg shadow-red-950/50 disabled:opacity-50 disabled:cursor-wait"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar nota</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Link Selector Modal (Triggered by [[, @ or Link button) */}
      <UniversalLinkSelectorModal
        isOpen={isUniversalLinkModalOpen}
        onClose={() => setIsUniversalLinkModalOpen(false)}
        initialQuery={linkInitialQuery}
        onSelect={handleUniversalLinkSelect}
        notes={[]}
        tasks={tasks}
        projects={projects}
        objects={objects}
        areas={areas}
        customTypes={customTypes}
        currentEntityId={note.id}
        currentEntityType="note"
        title="Vincular a esta nota"
      />
    </div>
  );
};
