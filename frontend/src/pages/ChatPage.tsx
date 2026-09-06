import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Channel, ChatMessage } from '../types';
import { useChannels } from '../stores/channels';
import { useAuth } from '../stores/auth';
import { useChatSocket } from '../hooks/useChatSocket';
import { Avatar } from '../components/ui/Avatar';
import { RoleBadge } from '../components/ui/Badge';
import { Banner } from '../components/ui/Feedback';
import { SendIcon, PinIcon, ReplyIcon, EditIcon, TrashIcon, MoreIcon, ChevronDownIcon, LockIcon, CheckIcon } from '../components/ui/icons';
import { formatTime } from '../lib/format';

type ConnectionText = { text: string; tone: 'error' | 'warning' | 'success' };

const STATUS_TEXT: Record<string, ConnectionText> = {
  connecting: { text: 'Connecting…', tone: 'warning' },
  connected: { text: 'Connected', tone: 'success' },
  reconnecting: { text: 'Connection lost — reconnecting…', tone: 'warning' },
  closed: { text: 'Disconnected', tone: 'error' },
};

const REACTION_EMOJIS = ['❤️', '👍', '🔥', '🎉', '👀', '💯'];

export function ChatPage() {
  const { channel: channelParam } = useParams<{ channel: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { channels, loading: channelsLoading } = useChannels();

  const channel = useMemo<Channel | undefined>(
    () => channels.find((c) => c.slug === channelParam),
    [channels, channelParam]
  );

  const chat = useChatSocket(channel?.id ?? null, channelParam ?? '');

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const canModerate = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'MODERATOR';

  // Auto-scroll to bottom on new messages
  const atBottom = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom.current || isNearBottom) {
      el.scrollTop = el.scrollHeight;
      atBottom.current = true;
    }
  }, [chat.messages.length, chat.messages[chat.messages.length - 1]?.id]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 30 && chat.hasMore) {
      chat.loadOlder();
    }
  }, [chat]);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text || !user) return;
    const ok = chat.sendMessage(text, replyTo?.id ?? null);
    if (ok) {
      setDraft('');
      setReplyTo(null);
      setShowEmoji(false);
      atBottom.current = true;
      if (inputRef.current) inputRef.current.focus();
    }
  }, [draft, user, chat, replyTo]);

  const submitEdit = useCallback(() => {
    if (!editing || !editDraft.trim()) return;
    chat.editMessage(editing, editDraft.trim());
    setEditing(null);
    setEditDraft('');
  }, [editing, editDraft, chat]);

  const rendered = useMemo(() => {
    const grouped: Array<ChatMessage | 'divider'> = [];
    let lastDay = '';
    for (const m of chat.messages) {
      const day = new Date(m.created_at * 1000).toDateString();
      if (day !== lastDay) {
        grouped.push('divider');
        lastDay = day;
      }
      grouped.push(m);
    }
    return grouped;
  }, [chat.messages]);

  const typingNames = useMemo(
    () => chat.typingUsers.filter((n) => n !== user?.username),
    [chat.typingUsers, user]
  );

  if (channelsLoading) {
    return <div className="flex h-full items-center justify-center text-sm text-gray-500">Loading channels…</div>;
  }

  if (!channel) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-semibold text-gray-300">Channel not found</p>
        <p className="text-sm text-gray-500">The channel <code className="rounded bg-ink-700 px-1.5 py-0.5 text-xs">#{channelParam}</code> doesn&apos;t exist.</p>
        <button onClick={() => navigate('/chat/general')} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500">
          Go to #general
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-xl border border-ink-600 bg-ink-800/40 lg:h-[calc(100vh-8.5rem)]">
      {/* Channel header */}
      <div className="border-b border-ink-600 bg-ink-900/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-primary-400">#</span>
          <span className="text-sm font-bold text-white">{channel.name}</span>
          {channel.is_locked === 1 && <LockIcon size={13} className="text-gray-500" />}
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 text-gray-400">
              <span className={`size-2 rounded-full ${chat.presence.count > 0 ? 'bg-live' : 'bg-gray-600'}`} />
              {chat.presence.count} online
            </span>
            {channel.description && <span className="hidden max-w-[200px] truncate text-gray-500 sm:block">{channel.description}</span>}
          </div>
        </div>
        {/* Quick channel switch (mobile) */}
        <div className="scrollbar-none -mx-1 mt-2 flex gap-1.5 overflow-x-auto pb-0.5 lg:hidden">
          {channels.map((c) => (
            <button
              key={c.slug}
              onClick={() => navigate(`/chat/${c.slug}`)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                c.slug === channelParam
                  ? 'bg-primary-600/20 text-primary-300'
                  : 'bg-ink-700/60 text-gray-400 hover:bg-ink-700 hover:text-gray-200'
              }`}
            >
              #{c.slug}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea onScroll={onScroll} scrollRef={scrollRef} messages={chat.messages}>
        {chat.hasMore && (
          <button
            onClick={chat.loadOlder}
            className="mx-auto mb-2 flex items-center gap-1 rounded-full border border-ink-500 px-3 py-1 text-xs text-gray-400 hover:bg-ink-700"
          >
            <ChevronDownIcon size={12} className="rotate-180" /> Load older messages
          </button>
        )}

        {rendered.map((item, idx) =>
          item === 'divider' ? (
            <DayDivider key={`d-${idx}`} ts={rendered[idx + 1] !== 'divider' && typeof rendered[idx + 1] === 'object' ? (rendered[idx + 1] as ChatMessage).created_at : 0} />
          ) : (
            <MessageRow
              key={item.id}
              message={item}
              mine={item.user_id === user?.id}
              canModerate={canModerate}
              onReply={() => setReplyTo(item)}
              onReact={(r) => chat.toggleReaction(item.id, r)}
              onEdit={() => { setEditing(item.id); setEditDraft(item.body); setMenuFor(null); }}
              onDelete={() => chat.deleteMessage(item.id)}
              onPin={() => chat.pinMessage(item.id, item.is_pinned === 1)}
              menuOpen={menuFor === item.id}
              setMenuOpen={(v) => setMenuFor(v ? item.id : null)}
              channelName={channel.name}
            />
          )
        )}
      </ScrollArea>

      {typingNames.length > 0 && (
        <div className="border-t border-ink-600/40 bg-ink-900/30 px-4 py-1 text-xs text-gray-500">
          {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing…
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-ink-600 bg-ink-900/60 p-3">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-lg border border-primary-600/30 bg-primary-600/5 px-3 py-1.5">
            <span className="min-w-0 flex-1 truncate text-xs text-gray-400">
              <span className="font-medium text-primary-300">Replying to {replyTo.display_name}:</span> {replyTo.body}
            </span>
            <button onClick={() => setReplyTo(null)} className="ml-2 text-gray-500 hover:text-gray-300" aria-label="Cancel reply">
              <TrashIcon size={13} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="relative">
            <button
              onClick={() => setShowEmoji((v) => !v)}
              className="flex size-9 items-center justify-center rounded-lg text-gray-400 hover:bg-ink-700"
              aria-label="Add reaction / emoji"
            >
              <span className="text-lg">🙂</span>
            </button>
            {showEmoji && (
              <div className="absolute bottom-11 left-0 z-30 flex gap-1 rounded-xl border border-ink-500 bg-ink-800 p-2 shadow-xl">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => { setDraft((d) => d + emoji); setShowEmoji(false); inputRef.current?.focus(); }}
                    className="rounded-lg px-1.5 py-1 text-lg hover:bg-ink-700"
                    aria-label={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              chat.sendTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={`Message #${channel.slug}`}
            className="max-h-32 min-h-[38px] flex-1 resize-none rounded-lg border border-ink-500 bg-ink-800 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            aria-label={`Message ${channel.name}`}
          />

          <button
            onClick={send}
            disabled={!draft.trim() || !user}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-40"
            aria-label="Send message"
          >
            <SendIcon size={16} />
          </button>
        </div>

        {!user && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Banner tone="info" className="m-0 flex-1">
              Log in or register to send messages in #{channel.name}.
            </Banner>
            <Link
              to={`/login?next=/chat/${channel.slug}`}
              className="inline-flex h-8 items-center rounded-lg border border-ink-500 px-3 text-xs font-medium text-gray-300 hover:bg-ink-600"
            >
              Log in
            </Link>
            <Link
              to={`/register?next=/chat/${channel.slug}`}
              className="inline-flex h-8 items-center rounded-lg bg-primary-600 px-3 text-xs font-semibold text-white hover:bg-primary-500"
            >
              Create account
            </Link>
          </div>
        )}

        {user && (
          <p className="mt-1 hidden text-right text-[10px] text-gray-600 sm:block">
            Enter to send · Shift+Enter for a new line
          </p>
        )}

        <ConnectionBanner chat={chat} />
      </div>

      {/* Editing bar */}
      {editing !== null && (
        <div className="border-t border-ink-600 bg-ink-900/70 px-3 py-2">
          <div className="flex items-end gap-2">
            <input
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitEdit();
                }
              }}
              className="flex-1 rounded-lg border border-primary-600/40 bg-ink-800 px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
              maxLength={2000}
              aria-label="Edit message"
            />
            <button onClick={submitEdit} className="flex size-9 items-center justify-center rounded-lg bg-live/20 text-live hover:bg-live/30" aria-label="Save edit">
              <CheckIcon size={16} />
            </button>
            <button onClick={() => setEditing(null)} className="flex size-9 items-center justify-center rounded-lg text-gray-500 hover:bg-ink-700" aria-label="Cancel edit">
              <TrashIcon size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScrollArea({ children, onScroll, scrollRef, messages }: { children: React.ReactNode; onScroll: () => void; scrollRef: React.RefObject<HTMLDivElement | null>; messages: ChatMessage[] }) {
  void messages;
  return (
    <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
      {children}
    </div>
  );
}

function DayDivider({ ts }: { ts: number }) {
  if (!ts) return <div className="py-1" />;
  return (
    <div className="my-3 flex items-center gap-3">
      <div className="h-px flex-1 bg-ink-600" />
      <span className="text-[11px] font-medium text-gray-500">{new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      <div className="h-px flex-1 bg-ink-600" />
    </div>
  );
}

function MessageRow({
  message,
  mine,
  canModerate,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onPin,
  menuOpen,
  setMenuOpen,
  channelName,
}: {
  message: ChatMessage;
  mine: boolean;
  canModerate: boolean;
  onReply: () => void;
  onReact: (r: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  channelName: string;
}) {
  void channelName;

  if (message.is_deleted === 1) {
    return (
      <div className="rounded-lg px-2 py-1 text-xs italic text-gray-600">
        This message was deleted{mine ? ' by you' : ''}.
      </div>
    );
  }

  const reactions = message.reactions ?? {};

  return (
    <div className={`group flex gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
      message.role === 'OWNER' ? 'bg-amber-400/5 ring-1 ring-inset ring-amber-400/15 hover:bg-ink-700/30' : 'hover:bg-ink-700/30'
    } ${mine ? 'flex-row-reverse' : ''}`}>
      <Avatar name={message.display_name} src={message.avatar} size="sm" className="mt-0.5" />
      <div className={`min-w-0 flex-1 ${mine ? 'text-right' : ''}`}>
        <div className={`flex items-center gap-2 ${mine ? 'justify-end' : ''}`}>
          <span className="text-sm font-semibold text-gray-200">{message.display_name}</span>
          <RoleBadge role={message.role} />
          <span className="text-[11px] text-gray-600">{formatTime(message.created_at)}</span>
          {message.is_pinned === 1 && <PinIcon size={11} className="text-amber-400" />}
          <span className="absolute -top-2 right-0 hidden group-hover:block">            
            <span className="relative inline-flex items-center gap-0.5 rounded-md border border-ink-600 bg-ink-800 px-1 py-0.5 shadow">
              <ReactionQuickActions onReact={onReact} />
              <button onClick={onReply} title="Reply" className="rounded p-1 text-gray-400 hover:bg-ink-700 hover:text-gray-200"><ReplyIcon size={12} /></button>
              {(mine || canModerate) && (
                <button onClick={() => setMenuOpen(!menuOpen)} title="More actions" className="rounded p-1 text-gray-400 hover:bg-ink-700 hover:text-gray-200"><MoreIcon size={12} /></button>
              )}
            </span>
          </span>
        </div>
        {message.reply_to && <div className="text-[11px] text-gray-600">↪ in reply to message #{message.reply_to}</div>}
        {menuOpen && (
          <div className="absolute right-0 top-5 z-20 w-40 rounded-lg border border-ink-600 bg-ink-800 p-1 shadow-xl">
            {mine && <button onClick={onEdit} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-gray-300 hover:bg-ink-700"><EditIcon size={12} /> Edit</button>}
            {(mine || canModerate) && <button onClick={onDelete} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-red-300 hover:bg-red-500/10"><TrashIcon size={12} /> Delete</button>}
            {canModerate && <button onClick={onPin} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-amber-300 hover:bg-amber-500/10"><PinIcon size={12} /> {message.is_pinned ? 'Unpin' : 'Pin'}</button>}
          </div>
        )}
        <p className={`mt-0.5 whitespace-pre-wrap text-sm text-gray-300 ${mine ? 'bg-primary-600/10' : ''} inline-block rounded-lg px-1.5 py-0.5 text-left`}>
          {message.body}
          {message.edited_at && <span className="ml-1.5 text-[10px] text-gray-600">(edited)</span>}
        </p>
        {Object.keys(reactions).length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${mine ? 'justify-end' : ''}`}>
            {Object.entries(reactions).map(([emoji, count]) => (
              <button key={emoji} onClick={() => onReact(emoji)} className="inline-flex items-center gap-1 rounded-full border border-primary-600/30 bg-primary-600/10 px-1.5 py-0.5 text-xs text-gray-300 hover:bg-primary-600/20">
                <span>{emoji}</span>
                {count > 1 && <span>{count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReactionQuickActions({ onReact }: { onReact: (r: string) => void }) {
  return (
    <>
      {REACTION_EMOJIS.map((emoji) => (
        <button key={emoji} onClick={() => onReact(emoji)} title={`React ${emoji}`} className="rounded p-1 text-xs hover:bg-ink-700">
          {emoji}
        </button>
      ))}
    </>
  );
}

function ConnectionBanner({ chat }: { chat: ReturnType<typeof useChatSocket> }) {
  if (chat.status === 'connected') return null;
  const status = STATUS_TEXT[chat.status] ?? STATUS_TEXT.closed;
  return (
    <div className={`mt-2 flex items-center gap-2 text-[11px] ${status.tone === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
      <span className={`size-1.5 animate-pulse rounded-full ${status.tone === 'error' ? 'bg-red-400' : 'bg-amber-400'}`} />
      {status.text}
    </div>
  );
}