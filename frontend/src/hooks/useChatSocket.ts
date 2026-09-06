import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import { getToken, wsUrl } from '../lib/api';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'closed';

interface PresenceState {
  online: Array<{ userId: number; username: string; displayName: string; status: string }>;
  count: number;
}

interface UseChatSocketResult {
  status: ConnectionStatus;
  messages: ChatMessage[];
  hasMore: boolean;
  presence: PresenceState;
  typingUsers: string[];
  sendMessage: (body: string, replyTo?: number | null) => boolean;
  sendTyping: () => void;
  toggleReaction: (messageId: number, reaction: string) => void;
  deleteMessage: (messageId: number) => void;
  editMessage: (messageId: number, body: string) => void;
  pinMessage: (messageId: number, pinned: boolean) => void;
  loadOlder: () => void;
  clearError: () => void;
  lastError: string | null;
}

const RECONNECT_BASE_MS = 800;
const RECONNECT_MAX_MS = 8000;
const TYPING_TIMEOUT_MS = 3000;

function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => a.id - b.id);
}

export function useChatSocket(channelId: number | null, channelSlug: string): UseChatSocketResult {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingInFlight = useRef(false);
  const closedByUser = useRef(false);

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [presence, setPresence] = useState<PresenceState>({ online: [], count: 0 });
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const channelKeyRef = useRef(channelId);
  channelKeyRef.current = channelId;

  const applyMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === message.id);
      if (idx === -1) return sortMessages([...prev, message]);
      const next = [...prev];
      next[idx] = message;
      return next;
    });
  }, []);

  const clearChannel = useCallback(() => {
    setMessages([]);
    setHasMore(false);
    setPresence({ online: [], count: 0 });
    setTypingUsers([]);
    setLastError(null);
  }, []);

  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    if (!channelId) return;
    closedByUser.current = false;
    reconnectAttempt.current = 0;

    const connect = () => {
      const token = getToken();
      if (!token) {
        setStatus('closed');
        return;
      }
      setStatus(reconnectAttempt.current === 0 ? 'connecting' : 'reconnecting');
      const url = wsUrl(`/api/chat/${channelId}/ws?token=${encodeURIComponent(token)}&channel=${encodeURIComponent(channelSlug)}`);
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempt.current = 0;
        setStatus('connected');
        setLastError(null);
        typingInFlight.current = false;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as {
            type: string;
            message?: ChatMessage;
            messages?: ChatMessage[];
            hasMore?: boolean;
            online?: PresenceState['online'];
            count?: number;
            messageId?: number;
            reactions?: Record<string, number>;
            id?: number;
            users?: string[];
            pinned?: boolean;
          };

          switch (data.type) {
            case 'history':
              setMessages((prev) => {
                if (data.messages) {
                  const incoming = data.messages;
                  const ids = new Set(prev.map((m) => m.id));
                  const merged = [...incoming.filter((m) => !ids.has(m.id)), ...prev];
                  return sortMessages(merged);
                }
                return prev;
              });
              setHasMore(data.hasMore ?? false);
              break;
            case 'message':
              if (data.message) applyMessage(data.message);
              break;
            case 'presence':
              setPresence({ online: data.online ?? [], count: data.count ?? data.online?.length ?? 0 });
              break;
            case 'typing':
              setTypingUsers(data.users ?? []);
              break;
            case 'message_deleted':
              setMessages((prev) => prev.map((m) => (m.id === data.id ? { ...m, is_deleted: 1 } : m)));
              break;
            case 'message_edited':
              if (data.message) applyMessage(data.message);
              break;
            case 'reaction_updated':
              setMessages((prev) =>
                prev.map((m) => (m.id === data.messageId ? { ...m, reactions: data.reactions ?? {} } : m))
              );
              break;
            case 'message_pinned':
              setMessages((prev) => prev.map((m) => (m.id === data.messageId ? { ...m, is_pinned: data.pinned ? 1 : 0 } : m)));
              break;
            case 'error':
              setLastError(typeof data.message === 'string' ? data.message : 'An error occurred');
              break;
            default:
              break;
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!closedByUser.current) {
          scheduleReconnect();
        } else {
          setStatus('closed');
        }
      };

      ws.onerror = () => {
        // onclose will handle reconnect
      };
    };

    const scheduleReconnect = () => {
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt.current, RECONNECT_MAX_MS);
      reconnectAttempt.current += 1;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(connect, delay);
    };

    connect();
    return () => {
      closedByUser.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus('closed');
    };
  }, [channelId, channelSlug, applyMessage, clearChannel]);

  const send = useCallback((payload: Record<string, unknown>): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  const sendMessage = useCallback(
    (body: string, replyTo?: number | null) => send({ type: 'message', body, reply_to: replyTo ?? null }),
    [send]
  );

  const sendTyping = useCallback(() => {
    if (typingInFlight.current) return;
    typingInFlight.current = true;
    send({ type: 'typing' });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      typingInFlight.current = false;
    }, TYPING_TIMEOUT_MS);
  }, [send]);

  const toggleReaction = useCallback((messageId: number, reaction: string) => {
    send({ type: 'reaction', message_id: messageId, reaction });
  }, [send]);

  const deleteMessage = useCallback((messageId: number) => {
    send({ type: 'delete', message_id: messageId });
  }, [send]);

  const editMessage = useCallback((messageId: number, body: string) => {
    send({ type: 'edit', message_id: messageId, body });
  }, [send]);

  const pinMessage = useCallback((messageId: number, pinned: boolean) => {
    send({ type: 'pin', message_id: messageId, pinned });
  }, [send]);

  const loadOlder = useCallback(() => {
    send({ type: 'load_older', before: messages[0]?.id ?? Number.MAX_SAFE_INTEGER, limit: 50 });
  }, [send, messages]);

  const clearError = useCallback(() => setLastError(null), []);

  return {
    status,
    messages,
    hasMore,
    presence,
    typingUsers,
    sendMessage,
    sendTyping,
    toggleReaction,
    deleteMessage,
    editMessage,
    pinMessage,
    loadOlder,
    clearError,
    lastError,
  };
}