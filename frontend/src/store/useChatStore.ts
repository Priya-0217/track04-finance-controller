import { create } from 'zustand';
import type { ChatMessage } from '../types/api';

interface ChatStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  activeMessageId: string | null;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, update: Partial<ChatMessage>) => void;
  appendChunk: (id: string, chunk: string) => void;
  setStreaming: (isStreaming: boolean, activeMessageId?: string | null) => void;
  clearMessages: () => void;
}

const STORAGE_KEY = 'fc_chat_messages_v1';
const MAX_MESSAGES = 50;

function loadStoredMessages(): ChatMessage[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(-MAX_MESSAGES);
      }
    }
  } catch {
    // Ignore corrupt localStorage
  }

  return [
    {
      id: 'welcome-0',
      sender: 'ai',
      text: 'Hello! I am your autonomous **Razorpay AI Finance Controller Agent** (Operations OS). I have direct live read/write access to your 4-tier reconciliation records, contract fee audit matrices, and forward cash forecasting pipelines.',
      tool_called: '11 Tools Armed',
      timestamp: new Date().toISOString(),
    },
  ];
}

function saveMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_MESSAGES)));
  } catch {
    // Ignore storage quota errors
  }
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: loadStoredMessages(),
  isStreaming: false,
  activeMessageId: null,

  addMessage: (msg) => {
    const id = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newMsg: ChatMessage = {
      ...msg,
      id,
      timestamp: new Date().toISOString(),
    };

    set((state) => {
      const next = [...state.messages, newMsg].slice(-MAX_MESSAGES);
      saveMessages(next);
      return { messages: next };
    });

    return id;
  },

  updateMessage: (id, update) => {
    set((state) => {
      const next = state.messages.map((m) => (m.id === id ? { ...m, ...update } : m));
      saveMessages(next);
      return { messages: next };
    });
  },

  appendChunk: (id, chunk) => {
    set((state) => {
      const next = state.messages.map((m) =>
        m.id === id ? { ...m, text: m.text + chunk } : m
      );
      saveMessages(next);
      return { messages: next };
    });
  },

  setStreaming: (isStreaming, activeMessageId = null) => {
    set({ isStreaming, activeMessageId });
  },

  clearMessages: () => {
    const defaultWelcome: ChatMessage[] = [
      {
        id: `welcome-${Date.now()}`,
        sender: 'ai',
        text: 'Conversation cleared. How can I assist with your financial operations?',
        tool_called: '11 Tools Armed',
        timestamp: new Date().toISOString(),
      },
    ];
    set({ messages: defaultWelcome, isStreaming: false, activeMessageId: null });
    saveMessages(defaultWelcome);
  },
}));
