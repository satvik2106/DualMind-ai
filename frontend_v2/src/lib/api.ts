import type { ChatMessage } from '@/lib/store/chatStore';

export interface Chat {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isPinned?: boolean;
}

const isStaticFirebaseHosting = typeof window !== 'undefined' && 
  (window.location.hostname.endsWith('web.app') || window.location.hostname.endsWith('firebaseapp.com')) &&
  !window.location.hostname.includes('backend');

function getLocalChats(): Chat[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('dualmind_local_chats');
  return stored ? JSON.parse(stored) : [];
}

function saveLocalChats(chats: Chat[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('dualmind_local_chats', JSON.stringify(chats));
}

function getLocalMessages(chatId: string): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(`dualmind_local_msgs_${chatId}`);
  return stored ? JSON.parse(stored) : [];
}

function saveLocalMessages(chatId: string, msgs: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`dualmind_local_msgs_${chatId}`, JSON.stringify(msgs));
}

export async function createConversation(title: string = "New Conversation"): Promise<string> {
  if (isStaticFirebaseHosting) {
    const newChat: Chat = {
      id: Math.random().toString(36).substring(7),
      userId: 'dualmind_static_user',
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPinned: false
    };
    const chats = getLocalChats();
    chats.unshift(newChat);
    saveLocalChats(chats);
    return newChat.id;
  }

  const res = await fetch('/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });
  if (!res.ok) throw new Error('Failed to create chat');
  const chat = await res.json();
  return chat.id;
}

export async function getUserConversations(): Promise<Chat[]> {
  if (isStaticFirebaseHosting) {
    return getLocalChats();
  }

  const res = await fetch('/api/chats');
  if (!res.ok) return [];
  return res.json();
}

/**
 * Fetches messages from PostgreSQL and normalizes them into ChatMessage format.
 * The DB returns raw Prisma rows — we must ensure the shape matches the Zustand model.
 */
export async function getConversationMessages(chatId: string): Promise<ChatMessage[]> {
  if (isStaticFirebaseHosting) {
    return getLocalMessages(chatId);
  }

  const res = await fetch(`/api/messages/${chatId}`);
  if (!res.ok) return [];
  const raw: any[] = await res.json();
  return raw.map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content || '',
    status: (m.status || 'complete') as ChatMessage['status'],
    toolRecords: Array.isArray(m.toolRecords) ? m.toolRecords : [],
    plan: m.plan || undefined,
    verifierScore: m.verifierScore ?? undefined,
    executionTime: m.executionTime ?? undefined,
  }));
}

export async function deleteConversation(chatId: string): Promise<void> {
  if (isStaticFirebaseHosting) {
    const chats = getLocalChats().filter((c) => c.id !== chatId);
    saveLocalChats(chats);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`dualmind_local_msgs_${chatId}`);
    }
    return;
  }

  const res = await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete chat');
}

export async function saveMessageToDB(chatId: string, message: ChatMessage): Promise<void> {
  if (!chatId || message.status === 'streaming') return;
  
  if (isStaticFirebaseHosting) {
    const msgs = getLocalMessages(chatId);
    const existingIdx = msgs.findIndex((m) => m.id === message.id);
    if (existingIdx >= 0) {
      msgs[existingIdx] = message;
    } else {
      msgs.push(message);
    }
    saveLocalMessages(chatId, msgs);
    
    // Update chat timestamp
    const chats = getLocalChats();
    const chat = chats.find((c) => c.id === chatId);
    if (chat) {
      chat.updatedAt = new Date().toISOString();
      saveLocalChats(chats);
    }
    return;
  }

  try {
    const res = await fetch(`/api/messages/${chatId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: message.id,
        role: message.role,
        content: message.content,
        status: message.status || 'complete',
        toolRecords: message.toolRecords ?? [],
        plan: message.plan ?? null,
        verifierScore: message.verifierScore ?? null,
        executionTime: message.executionTime ?? null,
      })
    });
    if (!res.ok) {
      console.error('[DualMind] Failed to save message:', await res.text());
    }
  } catch (err) {
    console.error('[DualMind] Error saving message:', err);
  }
}

export async function togglePinConversation(chatId: string, isPinned: boolean): Promise<void> {
  if (isStaticFirebaseHosting) {
    const chats = getLocalChats();
    const chat = chats.find((c) => c.id === chatId);
    if (chat) {
      chat.isPinned = isPinned;
      saveLocalChats(chats);
    }
    return;
  }

  const res = await fetch(`/api/chats/${chatId}/pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isPinned })
  });
  if (!res.ok) throw new Error('Failed to toggle pin');
}

export async function updateChatTitle(chatId: string, title: string): Promise<void> {
  if (isStaticFirebaseHosting) {
    const chats = getLocalChats();
    const chat = chats.find((c) => c.id === chatId);
    if (chat) {
      chat.title = title;
      saveLocalChats(chats);
    }
    return;
  }

  const res = await fetch(`/api/chats/${chatId}/title`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });
  if (!res.ok) throw new Error('Failed to rename chat');
}
