import { insforge } from './insforge';
import { AIConversation, AIMessage } from './types';

const LOCAL_STORAGE_CONVERSATIONS_KEY = 'segundo_cerebro_ai_conversations';
const LOCAL_STORAGE_MESSAGES_KEY_PREFIX = 'segundo_cerebro_ai_messages_';

export const aiConversationService = {
  /**
   * Retrieves all conversations
   */
  async getConversations(): Promise<AIConversation[]> {
    try {
      const { data, error } = await insforge.database
        .from('app_ai_conversations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      if (data && Array.isArray(data)) {
        localStorage.setItem(LOCAL_STORAGE_CONVERSATIONS_KEY, JSON.stringify(data));
        return data as unknown as AIConversation[];
      }
    } catch (e) {
      console.warn('InsForge getConversations fallback to localStorage:', e);
    }

    // LocalStorage fallback
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_CONVERSATIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /**
   * Creates a new conversation
   */
  async createConversation(params: {
    title: string;
    context_type?: string;
    context_id?: string | null;
    context_title?: string | null;
  }): Promise<AIConversation> {
    const newId = crypto.randomUUID ? crypto.randomUUID() : `conv_${Date.now()}`;
    const newConv: AIConversation = {
      id: newId,
      title: params.title || 'Nueva conversación',
      context_type: params.context_type || 'general',
      context_id: params.context_id || null,
      context_title: params.context_title || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const { data, error } = await insforge.database
        .from('app_ai_conversations')
        .insert([{
          id: newConv.id,
          title: newConv.title,
          context_type: newConv.context_type,
          context_id: newConv.context_id,
          context_title: newConv.context_title
        }])
        .select();

      if (error) throw error;
      if (data && data[0]) {
        return data[0] as unknown as AIConversation;
      }
    } catch (e) {
      console.warn('InsForge createConversation fallback to localStorage:', e);
    }

    // Update local cache
    try {
      const convs = await this.getConversations();
      convs.unshift(newConv);
      localStorage.setItem(LOCAL_STORAGE_CONVERSATIONS_KEY, JSON.stringify(convs));
    } catch {}

    return newConv;
  },

  /**
   * Renames a conversation
   */
  async updateConversationTitle(id: string, title: string): Promise<void> {
    try {
      await insforge.database
        .from('app_ai_conversations')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', id);
    } catch (e) {
      console.warn('InsForge updateConversationTitle fallback:', e);
    }

    try {
      const convs = await this.getConversations();
      const updated = convs.map(c => c.id === id ? { ...c, title, updated_at: new Date().toISOString() } : c);
      localStorage.setItem(LOCAL_STORAGE_CONVERSATIONS_KEY, JSON.stringify(updated));
    } catch {}
  },

  /**
   * Deletes a conversation and its messages
   */
  async deleteConversation(id: string): Promise<void> {
    try {
      await insforge.database
        .from('app_ai_conversations')
        .delete()
        .eq('id', id);
    } catch (e) {
      console.warn('InsForge deleteConversation fallback:', e);
    }

    try {
      const convs = await this.getConversations();
      const filtered = convs.filter(c => c.id !== id);
      localStorage.setItem(LOCAL_STORAGE_CONVERSATIONS_KEY, JSON.stringify(filtered));
      localStorage.removeItem(`${LOCAL_STORAGE_MESSAGES_KEY_PREFIX}${id}`);
    } catch {}
  },

  /**
   * Retrieves messages for a conversation
   */
  async getMessages(conversationId: string): Promise<AIMessage[]> {
    try {
      const { data, error } = await insforge.database
        .from('app_ai_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data && Array.isArray(data)) {
        localStorage.setItem(`${LOCAL_STORAGE_MESSAGES_KEY_PREFIX}${conversationId}`, JSON.stringify(data));
        return data as unknown as AIMessage[];
      }
    } catch (e) {
      console.warn('InsForge getMessages fallback to localStorage:', e);
    }

    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_MESSAGES_KEY_PREFIX}${conversationId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /**
   * Appends a message to a conversation
   */
  async addMessage(message: Omit<AIMessage, 'id' | 'created_at'>): Promise<AIMessage> {
    const newId = crypto.randomUUID ? crypto.randomUUID() : `msg_${Date.now()}`;
    const newMsg: AIMessage = {
      ...message,
      id: newId,
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await insforge.database
        .from('app_ai_messages')
        .insert([{
          id: newMsg.id,
          conversation_id: newMsg.conversation_id,
          role: newMsg.role,
          content: newMsg.content,
          mode: newMsg.mode || 'ask',
          tool_calls: newMsg.tool_calls || null,
          tool_call_id: newMsg.tool_call_id || null,
          proposed_diff: newMsg.proposed_diff || null,
          references_used: newMsg.references_used || null
        }])
        .select();

      if (error) throw error;
      if (data && data[0]) {
        return data[0] as unknown as AIMessage;
      }
    } catch (e) {
      console.warn('InsForge addMessage fallback to localStorage:', e);
    }

    try {
      const msgs = await this.getMessages(newMsg.conversation_id);
      msgs.push(newMsg);
      localStorage.setItem(`${LOCAL_STORAGE_MESSAGES_KEY_PREFIX}${newMsg.conversation_id}`, JSON.stringify(msgs));

      // Also update conversation updated_at
      this.touchConversation(newMsg.conversation_id);
    } catch {}

    return newMsg;
  },

  async touchConversation(id: string) {
    try {
      await insforge.database
        .from('app_ai_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', id);
    } catch {}
  }
};
