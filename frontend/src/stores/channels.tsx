import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Channel, ChatMessage } from '../types';
import { api } from '../lib/api';

interface ChannelsContextValue {
  channels: Channel[];
  communityChannels: Channel[];
  projectChannels: Channel[];
  loading: boolean;
  onlineUsers: Array<{ username: string; displayName: string; status: string; userId: number }>;
  typingIn: Record<string, string[]>;
  setTypingIn: (channelKey: string, users: string[]) => void;
  liveMessages: Record<string, ChatMessage[]>;
  pushLiveMessage: (channelKey: string, message: ChatMessage) => void;
  clearChannel: (channelKey: string) => void;
}

const ChannelsContext = createContext<ChannelsContextValue | null>(null);

export function channelKey(channel: Channel): string {
  return channel.type === 'PROJECT' ? `project:${channel.slug}` : `community:${channel.slug}`;
}

export function ChannelsProvider({ children }: { children: ReactNode }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineUsers] = useState<ChannelsContextValue['onlineUsers']>([]);
  const [typingIn, setTypingInState] = useState<Record<string, string[]>>({});
  const [liveMessages, setLiveMessages] = useState<Record<string, ChatMessage[]>>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await api<Channel[]>('/api/channels', { auth: false });
        if (active) setChannels(data.sort((a, b) => a.position - b.position));
      } catch {
        // channels will be empty; UI shows offline state
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const communityChannels = channels.filter((c) => c.type === 'COMMUNITY');
  const projectChannels = channels.filter((c) => c.type === 'PROJECT');

  const setTypingIn = (key: string, users: string[]) =>
    setTypingInState((prev) => ({ ...prev, [key]: users }));

  const pushLiveMessage = (key: string, message: ChatMessage) =>
    setLiveMessages((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), message] }));

  const clearChannel = (key: string) =>
    setLiveMessages((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

  return (
    <ChannelsContext.Provider
      value={{
        channels,
        communityChannels,
        projectChannels,
        loading,
        onlineUsers,
        typingIn,
        setTypingIn,
        liveMessages,
        pushLiveMessage,
        clearChannel,
      }}
    >
      {children}
    </ChannelsContext.Provider>
  );
}

export function useChannels(): ChannelsContextValue {
  const ctx = useContext(ChannelsContext);
  if (!ctx) throw new Error('useChannels must be used within ChannelsProvider');
  return ctx;
}