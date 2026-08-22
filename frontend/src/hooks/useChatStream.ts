import { useRef, useCallback } from 'react';
import { useChatStore } from '../store/useChatStore';

export function useChatStream() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const { addMessage, updateMessage, appendChunk, setStreaming, isStreaming } = useChatStore();

  const sendMessage = useCallback(async (text: string, merchantId = 'merch_001', role = 'finance_admin') => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    // 1. Append User Message
    addMessage({
      sender: 'user',
      text: trimmed,
    });

    // 2. Append Empty AI Message Placeholder
    const aiMessageId = addMessage({
      sender: 'ai',
      text: '',
    });

    setStreaming(true, aiMessageId);
    abortControllerRef.current = new AbortController();
    const t0 = performance.now();

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, merchant_id: merchantId, role }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      }

      if (!res.body) {
        throw new Error('ReadableStream not supported by response');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(String.fromCharCode(10));
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const payload = JSON.parse(line.trim());
            if (payload.type === 'meta') {
              updateMessage(aiMessageId, {
                intent: payload.intent,
                tool_called: payload.tool_called,
              });
            } else if (payload.type === 'chunk') {
              appendChunk(aiMessageId, payload.content);
            } else if (payload.type === 'actions') {
              updateMessage(aiMessageId, {
                action_cards: payload.actions,
              });
            }
          } catch {
            // raw chunk fallback
            appendChunk(aiMessageId, line);
          }
        }
      }

      const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
      updateMessage(aiMessageId, { latencySec: `${elapsed}s` });
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'AbortError') {
        appendChunk(aiMessageId, '\n\n*[Generation stopped by user]*');
      } else {
        updateMessage(aiMessageId, {
          text: `**Error:** ${error.message || 'Failed to stream response.'}`,
        });
      }
    } finally {
      setStreaming(false, null);
      abortControllerRef.current = null;
    }
  }, [addMessage, updateMessage, appendChunk, setStreaming, isStreaming]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    sendMessage,
    stopStreaming,
    isStreaming,
  };
}
