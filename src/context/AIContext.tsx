import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { 
  AIMode, 
  AIContextData, 
  AIToolAction, 
  AIProviderStatus,
  AppNote, 
  AppTask, 
  AppObject, 
  AppProject,
  AppNotebook
} from '../lib/types';
import { db } from '../lib/insforge';

export interface EditorBridge {
  getEditorContent: () => string;
  getSelectedText: () => string;
  applyEdit: (proposed: string, mode: 'replace_all' | 'replace_selection' | 'insert_at_cursor' | 'append') => Promise<void> | void;
}

interface AIContextType {
  isAIDrawerOpen: boolean;
  setIsAIDrawerOpen: (open: boolean) => void;
  toggleAIDrawer: () => void;
  aiMode: AIMode;
  setAIMode: (mode: AIMode) => void;
  activeContext: AIContextData;
  isDetachedContext: boolean;
  setIsDetachedContext: (detached: boolean) => void;
  registerEditorBridge: (bridge: EditorBridge) => () => void;
  providerStatus: AIProviderStatus | null;
  isLoadingStatus: boolean;
  reloadProviderStatus: () => Promise<void>;
  pendingQuickPrompt: { text: string; mode: AIMode } | null;
  clearPendingQuickPrompt: () => void;
  sendQuickPrompt: (text: string, mode?: AIMode) => void;
  executeToolAction: (action: AIToolAction) => Promise<{ success: boolean; message: string }>;
  onNavigateToEntity?: (id: string, type: string) => void;
}

const AIContext = createContext<AIContextType | null>(null);

interface AIProviderProps {
  children: React.ReactNode;
  currentView: string;
  activeNote?: AppNote | null;
  activeNotebook?: AppNotebook | null;
  notes: AppNote[];
  tasks: AppTask[];
  objects: AppObject[];
  projects: AppProject[];
  notebooks: AppNotebook[];
  onNavigateToEntity?: (id: string, type: string) => void;
  onCreateNote?: (note: Partial<AppNote>) => Promise<void>;
  onUpdateNote?: (id: string, updates: Partial<AppNote>) => Promise<void>;
  onCreateTask?: (task: Partial<AppTask>) => Promise<void>;
  onToggleFavoriteNote?: (noteId: string) => Promise<void>;
}

export const AIContextProvider: React.FC<AIProviderProps> = ({
  children,
  currentView,
  activeNote,
  activeNotebook,
  notes,
  tasks,
  objects,
  projects,
  notebooks,
  onNavigateToEntity,
  onCreateNote,
  onUpdateNote,
  onCreateTask,
  onToggleFavoriteNote
}) => {
  const [isAIDrawerOpen, setIsAIDrawerOpen] = useState(false);
  const [aiMode, setAIMode] = useState<AIMode>('ask');
  const [isDetachedContext, setIsDetachedContext] = useState(false);
  const [providerStatus, setProviderStatus] = useState<AIProviderStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [pendingQuickPrompt, setPendingQuickPrompt] = useState<{ text: string; mode: AIMode } | null>(null);

  // Active Editor Bridge (registered by RichNoteEditor, ObjectPagePanel, etc.)
  const editorBridgeRef = useRef<EditorBridge | null>(null);

  const registerEditorBridge = useCallback((bridge: EditorBridge) => {
    editorBridgeRef.current = bridge;
    return () => {
      if (editorBridgeRef.current === bridge) {
        editorBridgeRef.current = null;
      }
    };
  }, []);

  const toggleAIDrawer = useCallback(() => {
    setIsAIDrawerOpen(prev => !prev);
  }, []);

  const sendQuickPrompt = useCallback((text: string, mode: AIMode = 'ask') => {
    setAIMode(mode);
    setPendingQuickPrompt({ text, mode });
    setIsAIDrawerOpen(true);
  }, []);

  const clearPendingQuickPrompt = useCallback(() => {
    setPendingQuickPrompt(null);
  }, []);

  // Fetch AI server configuration status
  const reloadProviderStatus = useCallback(async () => {
    try {
      setIsLoadingStatus(true);
      const res = await fetch('/api/ai/status');
      if (res.ok) {
        const data = await res.json();
        setProviderStatus(data);
      } else {
        setProviderStatus({
          configured: false,
          provider: null,
          model: '',
          availableModels: [],
          missingKey: 'GEMINI_API_KEY o OPENROUTER_API_KEY'
        });
      }
    } catch {
      setProviderStatus({
        configured: false,
        provider: null,
        model: '',
        availableModels: [],
        missingKey: 'GEMINI_API_KEY o OPENROUTER_API_KEY'
      });
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    reloadProviderStatus();
  }, [reloadProviderStatus]);

  // Compute active context dynamically based on screen and live editor bridge
  const computeActiveContext = useCallback((): AIContextData => {
    if (isDetachedContext) {
      return { type: 'general' };
    }

    // 1. Note is active and being edited
    if (activeNote) {
      const liveContent = editorBridgeRef.current?.getEditorContent() || activeNote.content || '';
      const selectedText = editorBridgeRef.current?.getSelectedText() || '';
      const nb = notebooks.find(n => n.id === activeNote.notebook_id) || activeNotebook;

      return {
        type: 'note',
        id: activeNote.id,
        title: activeNote.title || 'Nota sin título',
        content: liveContent,
        selectedText: selectedText.trim() || undefined,
        notebookTitle: nb?.name,
        tags: activeNote.tags || [],
        metadata: {
          note_type: activeNote.note_type,
          is_favorite: activeNote.is_favorite
        },
        applyEdit: (proposed, mode) => {
          if (editorBridgeRef.current) {
            return editorBridgeRef.current.applyEdit(proposed, mode);
          }
          if (onUpdateNote && activeNote.id) {
            return onUpdateNote(activeNote.id, { content: proposed });
          }
        }
      };
    }

    // 2. View specific context
    if (currentView === 'tasks') {
      const pendingTasks = tasks.filter(t => t.status !== 'completed');
      return {
        type: 'task',
        title: 'Gestor de Tareas',
        content: `Hay ${pendingTasks.length} tareas pendientes:\n` + pendingTasks.slice(0, 15).map(t => `- ${t.title} (Prioridad: ${t.priority || 'media'}, Vence: ${t.due_date || 'sin fecha'})`).join('\n')
      };
    }

    if (currentView === 'objects') {
      return {
        type: 'object',
        title: 'Objetos y Entidades',
        content: `Biblioteca de Objetos (${objects.length} elementos registrados entre Personas, Libros, Páginas, Viajes e Ideas).`
      };
    }

    if (currentView === 'notebooks') {
      return {
        type: 'note',
        title: activeNotebook ? `Cuaderno: ${activeNotebook.name}` : 'Biblioteca de Cuadernos',
        notebookTitle: activeNotebook?.name,
        content: activeNotebook?.description || undefined
      };
    }

    return { type: 'general' };
  }, [isDetachedContext, activeNote, activeNotebook, notebooks, currentView, tasks, objects, onUpdateNote]);

  const activeContext = computeActiveContext();

  // Execute confirmed real actions in the app
  const executeToolAction = async (action: AIToolAction): Promise<{ success: boolean; message: string }> => {
    try {
      const { tool, parameters } = action;

      if (tool === 'create_note') {
        const title = parameters.title || 'Nueva nota desde IA';
        const content = parameters.content || '<p></p>';
        const notebookId = parameters.notebook_id || activeNotebook?.id || notebooks[0]?.id || null;

        if (onCreateNote) {
          await onCreateNote({
            title,
            content,
            notebook_id: notebookId,
            note_type: 'text'
          });
        } else {
          await db.createNote({
            title,
            content,
            notebook_id: notebookId,
            note_type: 'text'
          });
        }

        return {
          success: true,
          message: `Nota «${title}» creada exitosamente.`
        };
      }

      if (tool === 'update_note') {
        const targetId = parameters.note_id || activeNote?.id;
        if (!targetId) {
          throw new Error('No hay ninguna nota abierta para actualizar.');
        }

        const updates: Partial<AppNote> = {};
        if (parameters.title) updates.title = parameters.title;
        if (parameters.content) updates.content = parameters.content;

        if (onUpdateNote) {
          await onUpdateNote(targetId, updates);
        } else {
          await db.updateNote(targetId, updates);
        }

        return {
          success: true,
          message: `Nota actualizada correctamente.`
        };
      }

      if (tool === 'create_task') {
        const title = parameters.title || 'Nueva tarea sugerida';
        const taskData: Partial<AppTask> = {
          title,
          description: parameters.description || '',
          due_date: parameters.due_date || null,
          priority: parameters.priority || 'medium',
          status: 'todo'
        };

        if (onCreateTask) {
          await onCreateTask(taskData);
        } else {
          await db.createTask(taskData);
        }

        return {
          success: true,
          message: `Tarea «${title}» creada con éxito.`
        };
      }

      if (tool === 'mark_favorite') {
        if (!activeNote) {
          throw new Error('No hay una nota activa para marcar como favorita.');
        }

        if (onToggleFavoriteNote) {
          await onToggleFavoriteNote(activeNote.id);
        } else {
          await db.updateNote(activeNote.id, { is_favorite: true });
        }

        return {
          success: true,
          message: `La nota «${activeNote.title}» se ha marcado como favorita.`
        };
      }

      if (tool === 'create_idea') {
        const title = parameters.title || 'Idea capturada';
        const content = parameters.content || '';
        await db.createObject({
          title,
          object_type: 'idea',
          description: content.slice(0, 200),
          content
        });

        return {
          success: true,
          message: `Idea «${title}» registrada en Objetos y Entidades.`
        };
      }

      if (tool === 'link_entities') {
        const sourceId = parameters.source_id || activeNote?.id;
        const sourceType = parameters.source_type || 'note';
        const targetId = parameters.target_id;
        const targetType = parameters.target_type || 'object';

        if (!sourceId || !targetId) {
          throw new Error('Faltan los identificadores de origen o destino para vincular.');
        }

        await db.createUniversalLink(sourceId, targetId, sourceType, targetType);

        return {
          success: true,
          message: `Elementos vinculados correctamente.`
        };
      }

      return {
        success: false,
        message: `Herramienta desconocida: ${tool}`
      };
    } catch (err: any) {
      console.error('Error executing tool action:', err);
      return {
        success: false,
        message: err.message || 'Error al ejecutar la acción.'
      };
    }
  };

  return (
    <AIContext.Provider
      value={{
        isAIDrawerOpen,
        setIsAIDrawerOpen,
        toggleAIDrawer,
        aiMode,
        setAIMode,
        activeContext,
        isDetachedContext,
        setIsDetachedContext,
        registerEditorBridge,
        providerStatus,
        isLoadingStatus,
        reloadProviderStatus,
        pendingQuickPrompt,
        clearPendingQuickPrompt,
        sendQuickPrompt,
        executeToolAction,
        onNavigateToEntity
      }}
    >
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIContextProvider');
  }
  return context;
};
