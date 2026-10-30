import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Sparkles, 
  Send, 
  X, 
  Minimize2, 
  Maximize2, 
  RefreshCw, 
  Check, 
  Trash2, 
  MessageSquare, 
  Plus, 
  FileText, 
  CheckSquare, 
  Book, 
  Layers, 
  Sliders, 
  HelpCircle, 
  Settings, 
  ExternalLink, 
  AlertCircle, 
  Loader2, 
  Key, 
  ChevronRight, 
  FolderKanban,
  Edit3,
  Copy,
  FileCheck2,
  ListTodo,
  Table,
  Zap,
  Globe,
  Cpu
} from 'lucide-react';
import { useAI } from '../context/AIContext';
import { aiConversationService } from '../lib/aiConversationService';
import { searchKnowledgeBase } from '../lib/aiKnowledgeService';
import { AIConversation, AIMessage, AIProposedEdit, AIToolAction, AIReference, AppNote, AppTask, AppObject, AppProject } from '../lib/types';

interface AIAssistantDrawerProps {
  notes: AppNote[];
  tasks: AppTask[];
  objects: AppObject[];
  projects: AppProject[];
}

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  notes,
  tasks,
  objects,
  projects
}) => {
  const { 
    isAIDrawerOpen, 
    setIsAIDrawerOpen, 
    aiMode, 
    setAIMode, 
    activeContext, 
    isDetachedContext, 
    setIsDetachedContext,
    providerStatus,
    reloadProviderStatus,
    pendingQuickPrompt,
    clearPendingQuickPrompt,
    executeToolAction,
    onNavigateToEntity
  } = useAI();

  // Panel sizing & view mode
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Conversations & Messages
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<AIConversation | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Settings State (API Key config)
  const [configProvider, setConfigProvider] = useState<'xiaomi_mimo' | 'gemini' | 'openrouter'>('xiaomi_mimo');
  const [configApiKey, setConfigApiKey] = useState('');
  const [configModel, setConfigModel] = useState('');
  const [configBaseUrl, setConfigBaseUrl] = useState('https://api.xiaomimimo.com/v1');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const convs = await aiConversationService.getConversations();
      setConversations(convs);
      if (convs.length > 0 && !currentConversation) {
        selectConversation(convs[0]);
      }
    } catch (e) {
      console.warn('Error loading conversations:', e);
    }
  };

  const selectConversation = async (conv: AIConversation) => {
    setCurrentConversation(conv);
    setShowHistory(false);
    try {
      const msgs = await aiConversationService.getMessages(conv.id);
      setMessages(msgs);
    } catch (e) {
      console.warn('Error loading messages:', e);
    }
  };

  const handleStartNewConversation = async () => {
    const title = activeContext.type !== 'general' 
      ? `${activeContext.title || activeContext.type}`
      : `Conversación ${new Date().toLocaleDateString('es', { day: 'numeric', month: 'short' })}`;

    const newConv = await aiConversationService.createConversation({
      title,
      context_type: activeContext.type,
      context_id: activeContext.id,
      context_title: activeContext.title
    });

    setConversations(prev => [newConv, ...prev]);
    setCurrentConversation(newConv);
    setMessages([]);
    setShowHistory(false);
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await aiConversationService.deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConversation?.id === id) {
      setCurrentConversation(null);
      setMessages([]);
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isAIDrawerOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAIDrawerOpen]);

  // Handle incoming quick prompt (e.g. from toolbar button or chips)
  useEffect(() => {
    if (pendingQuickPrompt && isAIDrawerOpen) {
      handleSendMessage(pendingQuickPrompt.text, pendingQuickPrompt.mode);
      clearPendingQuickPrompt();
    }
  }, [pendingQuickPrompt, isAIDrawerOpen]);

  // Auto-resize textarea
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputPrompt(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  // Send message
  const handleSendMessage = async (textToSend?: string, modeOverride?: 'ask' | 'edit') => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || isLoading) return;

    const currentMode = modeOverride || aiMode;

    // Ensure we have an active conversation
    let conv = currentConversation;
    if (!conv) {
      const title = text.slice(0, 30) + (text.length > 30 ? '...' : '');
      conv = await aiConversationService.createConversation({
        title,
        context_type: activeContext.type,
        context_id: activeContext.id,
        context_title: activeContext.title
      });
      setConversations(prev => [conv!, ...prev]);
      setCurrentConversation(conv);
    }

    // 1. Add User Message
    const userMsg = await aiConversationService.addMessage({
      conversation_id: conv.id,
      role: 'user',
      content: text,
      mode: currentMode
    });

    setMessages(prev => [...prev, userMsg]);
    setInputPrompt('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsLoading(true);

    try {
      // 2. Perform personal knowledge retrieval if user is querying information
      const relevantMatches = searchKnowledgeBase(text, { notes, tasks, objects, projects });
      const relevantKnowledge = relevantMatches.map(m => ({
        id: m.id,
        type: m.type,
        title: m.title,
        contentSnippet: m.contentSnippet
      }));

      // 3. Prepare messages history for API call
      const historyPayload = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }));
      historyPayload.push({ role: 'user', content: text });

      // 4. Send to server-side AI endpoint
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyPayload,
          mode: currentMode,
          context: isDetachedContext ? { type: 'general' } : activeContext,
          relevantKnowledge
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || errJson.error || 'Error contactando al servidor de IA');
      }

      const resData = await response.json();

      // 5. Add Assistant Message
      const assistantMsg = await aiConversationService.addMessage({
        conversation_id: conv.id,
        role: 'assistant',
        content: resData.reply || 'Respuesta generada.',
        mode: currentMode,
        proposed_diff: resData.proposedEdit || null,
        tool_calls: resData.toolAction ? [resData.toolAction] : null,
        references_used: resData.references || null
      });

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('AI chat error:', err);
      const errorMsg = await aiConversationService.addMessage({
        conversation_id: conv.id,
        role: 'assistant',
        content: `⚠️ **No fue posible procesar la consulta**: ${err.message || 'Error de conexión'}.
${!providerStatus?.configured ? '\n\n*Nota: Debes configurar tu GEMINI_API_KEY o OPENROUTER_API_KEY en el servidor para activar el asistente.*' : ''}`
      });
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Apply proposed edit into the document
  const handleApplyProposedEdit = async (edit: AIProposedEdit, msgId: string) => {
    if (!activeContext.applyEdit) {
      alert('No hay un editor activo para aplicar esta modificación.');
      return;
    }

    try {
      setActionLoadingId(msgId);
      await activeContext.applyEdit(edit.replacementSnippet, edit.action);
      // Update local message to show it was applied
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: `${m.content}\n\n✅ *Modificación aplicada con éxito en el documento.*`, proposed_diff: null } : m));
    } catch (e: any) {
      alert('Error aplicando cambios: ' + (e.message || 'Error en el editor'));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reject proposed edit
  const handleRejectProposedEdit = (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, proposed_diff: null } : m));
  };

  // Execute tool action
  const handleConfirmToolAction = async (action: AIToolAction, msgId: string) => {
    try {
      setActionLoadingId(msgId);
      const res = await executeToolAction(action);
      if (res.success) {
        setMessages(prev => prev.map(m => m.id === msgId ? { 
          ...m, 
          content: `${m.content}\n\n✅ *Acción ejecutada:* ${res.message}`, 
          tool_calls: null 
        } : m));
      } else {
        alert('Error ejecutando acción: ' + res.message);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Copy message text helper
  const handleCopyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Save API key config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configApiKey.trim()) return;

    try {
      setIsSavingConfig(true);
      setConfigError(null);
      setConfigSuccess(false);

      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: configProvider,
          apiKey: configApiKey.trim(),
          model: configModel.trim() || undefined,
          baseUrl: configProvider === 'xiaomi_mimo' ? (configBaseUrl.trim() || 'https://api.xiaomimimo.com/v1') : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al validar la clave de API');
      }

      setConfigSuccess(true);
      setConfigApiKey('');
      await reloadProviderStatus();
      setTimeout(() => {
        setShowSettings(false);
        setConfigSuccess(false);
      }, 1500);
    } catch (err: any) {
      setConfigError(err.message || 'Error guardando clave de API');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Generate quick chips based on context
  const renderQuickChips = () => {
    if (activeContext.type === 'note') {
      return [
        { label: 'Resumir nota', prompt: 'Genera un resumen claro y conciso de los puntos clave de esta nota.', mode: 'ask' as const, icon: FileCheck2 },
        { label: 'Corregir redacción', prompt: 'Corrige la ortografía, gramática y mejora el estilo de este texto manteniendo el significado original.', mode: 'edit' as const, icon: Edit3 },
        { label: 'Extraer tareas', prompt: 'Analiza el contenido de esta nota y extrae todas las tareas o acciones pendientes mencionadas.', mode: 'ask' as const, icon: ListTodo },
        { label: 'Crear tabla', prompt: 'Organiza la información principal de esta nota en una tabla comparativa o estructurada.', mode: 'edit' as const, icon: Table },
        { label: 'Ampliar ideas', prompt: 'Amplía las ideas presentadas con ejemplos prácticos y sugerencias de profundización.', mode: 'edit' as const, icon: Zap }
      ];
    }
    if (activeContext.type === 'task') {
      return [
        { label: 'Desglosar en subtareas', prompt: 'Desglosa esta tarea en pasos y subtareas cronológicas claras para completarla.', mode: 'ask' as const, icon: ListTodo },
        { label: 'Próximos pasos', prompt: '¿Cuáles deberían ser los 3 próximos pasos inmediatos para avanzar en este trabajo?', mode: 'ask' as const, icon: Zap }
      ];
    }
    if (activeContext.type === 'object') {
      return [
        { label: 'Resumir ficha', prompt: 'Haz un resumen estructurado de los datos y notas de esta ficha.', mode: 'ask' as const, icon: FileCheck2 },
        { label: 'Proponer relaciones', prompt: 'Sugerencias de cómo conectar esta ficha con otros proyectos o notas.', mode: 'ask' as const, icon: Zap }
      ];
    }
    return [
      { label: 'Resumen semanal', prompt: '¿Cuáles son las prioridades y tareas pendientes más importantes registradas?', mode: 'ask' as const, icon: CheckSquare },
      { label: 'Buscar ideas', prompt: 'Busca en mis notas ideas sobre productividad, tecnología o proyectos.', mode: 'ask' as const, icon: FileText },
      { label: 'Explicar concepto', prompt: 'Explícame el método Segundo Cerebro de Tiago Forte y el sistema PARA.', mode: 'ask' as const, icon: HelpCircle }
    ];
  };

  if (!isAIDrawerOpen) return null;

  return (
    <div 
      className={`fixed z-50 transition-all duration-300 flex flex-col bg-[#14141f] text-gray-100 border-l border-[#272738] shadow-2xl ${
        isExpanded
          ? 'inset-y-0 right-0 w-full sm:w-[680px] lg:w-[840px]'
          : 'inset-y-0 right-0 w-full sm:w-[420px] md:w-[460px]'
      }`}
    >
      {/* 1. HEADER */}
      <div className="px-4 py-3 border-b border-[#252538] bg-[#12121b] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-white truncate">Segundo Cerebro AI</h3>
              {providerStatus?.provider && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                  providerStatus.provider === 'xiaomi_mimo'
                    ? 'bg-orange-950/60 text-orange-300 border-orange-800/40'
                    : providerStatus.provider === 'gemini'
                    ? 'bg-amber-950/60 text-amber-300 border-amber-800/40'
                    : 'bg-purple-950/60 text-purple-300 border-purple-800/40'
                }`}>
                  {providerStatus.provider === 'xiaomi_mimo'
                    ? `Xiaomi MiMo (${providerStatus.model || 'mimo-v2.6-flash'})`
                    : providerStatus.provider === 'gemini'
                    ? `Gemini (${providerStatus.model || '2.5-flash'})`
                    : `OpenRouter (${providerStatus.model?.split('/')?.pop() || 'AI'})`}
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 truncate">
              {currentConversation?.title || 'Asistente Contextual'}
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1 text-gray-400">
          <button
            type="button"
            onClick={() => setShowHistory(prev => !prev)}
            className={`p-1.5 rounded-lg hover:text-white transition ${showHistory ? 'bg-[#252538] text-white' : 'hover:bg-[#20202e]'}`}
            title="Historial de conversaciones"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleStartNewConversation}
            className="p-1.5 rounded-lg hover:text-white hover:bg-[#20202e] transition"
            title="Nueva conversación"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowSettings(prev => !prev)}
            className={`p-1.5 rounded-lg hover:text-white transition ${showSettings ? 'bg-[#252538] text-white' : 'hover:bg-[#20202e]'}`}
            title="Configuración de Proveedor AI"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="p-1.5 rounded-lg hover:text-white hover:bg-[#20202e] transition hidden sm:inline-flex"
            title={isExpanded ? 'Contraer panel' : 'Expandir panel'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setIsAIDrawerOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#20202e] transition"
            title="Cerrar panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. MODE SWITCHER & ACTIVE CONTEXT BAR */}
      <div className="px-4 py-2 border-b border-[#232334] bg-[#101018] flex items-center justify-between gap-2 shrink-0">
        {/* Two Modes: Preguntar vs Editar */}
        <div className="flex items-center p-0.5 rounded-xl bg-[#1b1b28] border border-[#2d2d42] text-xs font-medium">
          <button
            type="button"
            onClick={() => setAIMode('ask')}
            className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition ${
              aiMode === 'ask'
                ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Preguntar</span>
          </button>
          <button
            type="button"
            onClick={() => setAIMode('edit')}
            className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition ${
              aiMode === 'edit'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editar</span>
          </button>
        </div>

        {/* Context Pill with Detach Button */}
        <div className="flex items-center gap-1 min-w-0 text-xs">
          {activeContext.type !== 'general' && !isDetachedContext ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1f1f2e] border border-[#303046] text-gray-300 text-[11px] min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate max-w-[140px] font-medium" title={activeContext.title}>
                {activeContext.title || activeContext.type}
              </span>
              <button
                type="button"
                onClick={() => setIsDetachedContext(true)}
                className="text-gray-500 hover:text-gray-300 ml-1 p-0.5"
                title="Desvincular contexto (consultar en modo general)"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#181822] text-gray-400 text-[11px]">
              <span>Modo General</span>
              {activeContext.type !== 'general' && (
                <button
                  type="button"
                  onClick={() => setIsDetachedContext(false)}
                  className="text-amber-400 hover:text-amber-300 ml-1 text-[10px] underline"
                >
                  Vincular nota
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. SETTINGS OVERLAY (If user clicks settings or provider is not configured) */}
      {showSettings && (
        <div className="p-4 border-b border-[#2d2d42] bg-[#181827] space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Configuración del Proveedor de IA</span>
            </h4>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="text-gray-400 hover:text-white text-xs"
            >
              Cerrar
            </button>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Proveedor de IA:</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfigProvider('xiaomi_mimo');
                    setConfigModel('mimo-v2.6-flash');
                  }}
                  className={`p-2 rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 border transition text-center ${
                    configProvider === 'xiaomi_mimo'
                      ? 'bg-orange-500/20 text-orange-300 border-orange-500/50 shadow-sm'
                      : 'bg-[#12121b] text-gray-400 border-[#2b2b3e] hover:border-gray-600'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span className="truncate">Xiaomi MiMo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfigProvider('gemini');
                    setConfigModel('gemini-2.5-flash');
                  }}
                  className={`p-2 rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 border transition text-center ${
                    configProvider === 'gemini'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                      : 'bg-[#12121b] text-gray-400 border-[#2b2b3e] hover:border-gray-600'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Google Gemini</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfigProvider('openrouter');
                    setConfigModel('google/gemini-2.5-flash');
                  }}
                  className={`p-2 rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1.5 border transition text-center ${
                    configProvider === 'openrouter'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm'
                      : 'bg-[#12121b] text-gray-400 border-[#2b2b3e] hover:border-gray-600'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">OpenRouter</span>
                </button>
              </div>
            </div>

            {configProvider === 'xiaomi_mimo' && (
              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Modelo Xiaomi MiMo:
                  </label>
                  <select
                    value={configModel || 'mimo-v2.6-flash'}
                    onChange={e => setConfigModel(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-[#111118] border border-[#2b2b3e] text-xs text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="mimo-v2.6-flash">mimo-v2.6-flash (Predeterminado: ultra rápido, eficiente)</option>
                    <option value="mimo-v2.6-pro">mimo-v2.6-pro (Flagship: razonamiento profundo, código)</option>
                    <option value="mimo-v2.5">mimo-v2.5 (Modelo omnimodal balanceado)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Clave API de Xiaomi MiMo (MIMO_API_KEY):
                  </label>
                  <input
                    type="password"
                    value={configApiKey}
                    onChange={e => setConfigApiKey(e.target.value)}
                    placeholder="mimo-... o tu API Key de Xiaomi MiMo"
                    className="w-full px-3 py-2 rounded-xl bg-[#111118] border border-[#2b2b3e] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Base URL (Endpoint API):
                  </label>
                  <input
                    type="text"
                    value={configBaseUrl}
                    onChange={e => setConfigBaseUrl(e.target.value)}
                    placeholder="https://api.xiaomimimo.com/v1"
                    className="w-full px-3 py-1.5 rounded-xl bg-[#111118] border border-[#2b2b3e] text-xs text-gray-300 placeholder-gray-500 font-mono text-[11px] focus:outline-none focus:border-orange-500"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Compatible con el protocolo OpenAI en <code className="text-orange-400">https://api.xiaomimimo.com/v1</code>.
                  </p>
                </div>
              </div>
            )}

            {configProvider === 'gemini' && (
              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Modelo Gemini:
                  </label>
                  <select
                    value={configModel || 'gemini-2.5-flash'}
                    onChange={e => setConfigModel(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-[#111118] border border-[#2b2b3e] text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="gemini-2.5-flash">gemini-2.5-flash (Recomendado)</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Clave API de Gemini (AI Studio):
                  </label>
                  <input
                    type="password"
                    value={configApiKey}
                    onChange={e => setConfigApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2 rounded-xl bg-[#111118] border border-[#2b2b3e] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {configProvider === 'openrouter' && (
              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Modelo OpenRouter:
                  </label>
                  <select
                    value={configModel || 'google/gemini-2.5-flash'}
                    onChange={e => setConfigModel(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-[#111118] border border-[#2b2b3e] text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="google/gemini-2.5-flash">google/gemini-2.5-flash</option>
                    <option value="openai/gpt-4o-mini">openai/gpt-4o-mini</option>
                    <option value="anthropic/claude-3.5-haiku">anthropic/claude-3.5-haiku</option>
                    <option value="meta-llama/llama-3.3-70b-instruct">meta-llama/llama-3.3-70b-instruct</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Clave API de OpenRouter:
                  </label>
                  <input
                    type="password"
                    value={configApiKey}
                    onChange={e => setConfigApiKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="w-full px-3 py-2 rounded-xl bg-[#111118] border border-[#2b2b3e] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            )}

            <p className="text-[10px] text-gray-500 mt-1">
              Las claves se almacenan de forma segura exclusivamente en el servidor (archivo .env). Nunca se exponen al navegador.
            </p>

            {configError && (
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                {configError}
              </div>
            )}

            {configSuccess && (
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                ✓ Conectado exitosamente con el proveedor de IA.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="submit"
                disabled={isSavingConfig || !configApiKey.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md disabled:opacity-50 transition"
              >
                {isSavingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Guardar y Probar Conexión</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Provider Missing Warning Banner */}
      {!providerStatus?.configured && !showSettings && (
        <div className="p-3 mx-4 my-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Configura tu MIMO_API_KEY, GEMINI_API_KEY u OPENROUTER_API_KEY para comenzar.</span>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="px-2.5 py-1 rounded-lg bg-amber-500 text-black font-semibold text-[11px] shrink-0 hover:bg-amber-400 transition"
          >
            Configurar
          </button>
        </div>
      )}

      {/* 4. CONVERSATIONS HISTORY DRAWER */}
      {showHistory && (
        <div className="p-4 border-b border-[#29293e] bg-[#151522] space-y-2 max-h-72 overflow-y-auto animate-fadeIn">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Historial de Conversaciones</h4>
            <button
              type="button"
              onClick={handleStartNewConversation}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva</span>
            </button>
          </div>

          {conversations.length === 0 ? (
            <p className="text-xs text-gray-500 italic py-2">No hay conversaciones previas.</p>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`p-2.5 rounded-xl text-xs flex items-center justify-between cursor-pointer transition ${
                  currentConversation?.id === conv.id
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                    : 'bg-[#181824] hover:bg-[#1e1e2e] text-gray-300'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <p className="font-semibold truncate">{conv.title}</p>
                  <p className="text-[10px] text-gray-500">{new Date(conv.updated_at).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <button
                  type="button"
                  onClick={e => handleDeleteConversation(conv.id, e)}
                  className="p-1 text-gray-500 hover:text-red-400 transition"
                  title="Eliminar conversación"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* 5. MESSAGES TIMELINE */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500/20 via-purple-600/20 to-indigo-600/20 border border-[#3b3b55] flex items-center justify-center text-amber-400 shadow-xl">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">¿En qué puedo ayudarte hoy?</h4>
              <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1">
                {activeContext.type !== 'general' 
                  ? `Estoy sincronizado con "${activeContext.title || activeContext.type}". Puedo resumir, corregir, extraer tareas o proponer mejoras.`
                  : 'Puedo consultar tu base de conocimientos, redactar notas, organizar tareas y responder preguntas.'}
              </p>
            </div>

            {/* Quick Context Chips */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-1.5 max-w-sm mx-auto">
              {renderQuickChips().map((chip, idx) => {
                const Icon = chip.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(chip.prompt, chip.mode)}
                    className="px-2.5 py-1.5 rounded-xl bg-[#1a1a28] hover:bg-[#252538] border border-[#2d2d42] text-xs text-gray-300 hover:text-white flex items-center gap-1.5 transition shadow-sm"
                  >
                    <Icon className="w-3.5 h-3.5 text-amber-400" />
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-2 group`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-md ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-[#1a1a29] border border-[#2b2b3f] text-gray-200 rounded-bl-none'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="prose prose-invert prose-xs max-w-none space-y-2">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* References & Citations */}
                  {msg.references_used && msg.references_used.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-[#2e2e42] space-y-1.5">
                      <p className="text-[11px] font-semibold text-gray-400 flex items-center gap-1">
                        <FolderKanban className="w-3 h-3 text-amber-400" />
                        <span>Fuentes del conocimiento utilizadas:</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.references_used.map((ref, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => onNavigateToEntity && onNavigateToEntity(ref.id, ref.type)}
                            className="px-2 py-1 rounded-lg bg-[#232336] hover:bg-[#2c2c44] border border-[#35354e] text-[11px] text-indigo-300 hover:text-white flex items-center gap-1 transition"
                            title={`Abrir ${ref.title}`}
                          >
                            <span>{ref.title}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Proposed Edit Preview Card (Modo Editar) */}
                  {msg.proposed_diff && (
                    <div className="mt-3 p-3 rounded-xl bg-[#11111a] border border-indigo-500/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wide flex items-center gap-1">
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Propuesta de Cambio:</span>
                        </span>
                        <span className="text-[10px] bg-indigo-950 px-2 py-0.5 rounded text-indigo-300">
                          {msg.proposed_diff.action === 'replace_selection' ? 'En selección' : 'En el documento'}
                        </span>
                      </div>

                      {msg.proposed_diff.summary && (
                        <p className="text-xs text-gray-300 italic">
                          «{msg.proposed_diff.summary}»
                        </p>
                      )}

                      <div className="max-h-40 overflow-y-auto p-2 rounded-lg bg-[#0c0c14] border border-[#232334] text-[11px] font-mono text-gray-300 whitespace-pre-wrap">
                        {msg.proposed_diff.replacementSnippet}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleRejectProposedEdit(msg.id)}
                          className="px-2.5 py-1 rounded-lg bg-[#20202e] hover:bg-[#28283a] text-gray-300 text-xs font-medium transition"
                        >
                          Rechazar
                        </button>
                        <button
                          type="button"
                          disabled={actionLoadingId === msg.id}
                          onClick={() => handleApplyProposedEdit(msg.proposed_diff!, msg.id)}
                          className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition disabled:opacity-50"
                        >
                          {actionLoadingId === msg.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          <span>Aplicar cambios</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tool Action Execution Card */}
                  {msg.tool_calls && msg.tool_calls[0] && (
                    <div className="mt-3 p-3 rounded-xl bg-[#11111a] border border-amber-500/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5" />
                          <span>Acción sugerida para ejecutar:</span>
                        </span>
                      </div>

                      <p className="text-xs text-gray-200">
                        {msg.tool_calls[0].description}
                      </p>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, tool_calls: null } : m))}
                          className="px-2.5 py-1 rounded-lg bg-[#20202e] hover:bg-[#28283a] text-gray-300 text-xs font-medium transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={actionLoadingId === msg.id}
                          onClick={() => handleConfirmToolAction(msg.tool_calls![0], msg.id)}
                          className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition disabled:opacity-50"
                        >
                          {actionLoadingId === msg.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          <span>Confirmar y ejecutar</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Message action buttons */}
                {!isUser && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition px-1 text-gray-500">
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.content, msg.id)}
                      className="p-1 hover:text-gray-300 transition"
                      title="Copiar texto"
                    >
                      {copiedMessageId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Loading Spinner Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#181826] border border-[#2b2b3f] text-gray-400 text-xs w-fit animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            <span>Pensando y analizando contexto...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 6. INPUT TEXTAREA & CONTROLS */}
      <div className="p-3 border-t border-[#252538] bg-[#111119] shrink-0">
        {/* Suggestion Chips while typing */}
        {messages.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none text-[11px]">
            {renderQuickChips().slice(0, 3).map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(chip.prompt, chip.mode)}
                className="px-2 py-1 rounded-lg bg-[#1a1a28] hover:bg-[#252538] text-gray-400 hover:text-white shrink-0 border border-[#2b2b3e] transition"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        <div className="relative flex items-end gap-2 bg-[#171724] border border-[#2e2e44] focus-within:border-indigo-500 rounded-2xl p-2 transition shadow-inner">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputPrompt}
            onChange={handleTextareaInput}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={
              aiMode === 'edit'
                ? '¿Qué cambios o mejoras deseas realizar en este documento?...'
                : 'Haz una pregunta sobre tus notas, tareas o conocimientos...'
            }
            className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-gray-500 outline-none resize-none max-h-36 py-1 px-1"
          />

          <button
            type="button"
            disabled={!inputPrompt.trim() || isLoading}
            onClick={() => handleSendMessage()}
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition shadow-md shrink-0 active:scale-95"
            title="Enviar consulta (Enter)"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
