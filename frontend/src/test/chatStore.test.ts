import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from '../store/useChatStore';

describe('Chat Store & Reducer Tests (store/useChatStore.ts)', () => {
  beforeEach(() => {
    localStorage.clear();
    useChatStore.getState().clearMessages();
  });

  it('adds user and ai messages to store with timestamps', () => {
    const id = useChatStore.getState().addMessage({
      sender: 'user',
      text: 'Project 7 day cash forecast',
    });

    expect(id).toBeDefined();
    const messages = useChatStore.getState().messages;
    const added = messages.find((m) => m.id === id);
    expect(added).toBeDefined();
    expect(added?.text).toBe('Project 7 day cash forecast');
    expect(added?.sender).toBe('user');
  });

  it('appends streaming chunks progressively to an active message', () => {
    const id = useChatStore.getState().addMessage({
      sender: 'ai',
      text: 'Starting forecast: ',
    });

    useChatStore.getState().appendChunk(id, 'Day 1 balance ₹5,000. ');
    useChatStore.getState().appendChunk(id, 'Day 2 balance ₹8,000.');

    const updated = useChatStore.getState().messages.find((m) => m.id === id);
    expect(updated?.text).toBe('Starting forecast: Day 1 balance ₹5,000. Day 2 balance ₹8,000.');
  });

  it('clears conversation history and restores welcome prompt', () => {
    useChatStore.getState().addMessage({ sender: 'user', text: 'Hello' });
    useChatStore.getState().clearMessages();

    const messages = useChatStore.getState().messages;
    expect(messages.length).toBe(1);
    expect(messages[0].sender).toBe('ai');
    expect(messages[0].text).toContain('Conversation cleared');
  });
});
