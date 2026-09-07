import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ProjectUpdate, UpdateComment } from '../types';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../stores/auth';
import { Avatar } from '../components/ui/Avatar';
import { Badge, RoleBadge } from '../components/ui/Badge';
import { OwnerBadge, OfficialBadge } from '../components/ui/OwnerBadge';
import { Banner, ErrorState } from '../components/ui/Feedback';
import { ReactionBar } from '../components/UpdateCard';
import { Skeleton } from '../components/ui/Skeleton';
import { timeAgo, renderText } from '../lib/format';
import { updateTypeLabel } from '../lib/updates';
import { BackIcon, GithubIcon, LinkIcon, ReplyIcon, SendIcon, ChatIcon } from '../components/ui/icons';

const typeTone: Record<string, 'primary' | 'accent' | 'live' | 'warn' | 'danger' | 'gray'> = {
  ANNOUNCEMENT: 'primary',
  RELEASE: 'live',
  FEATURE: 'accent',
  IMPROVEMENT: 'accent',
  FIX: 'warn',
  MAINTENANCE: 'gray',
};

export function UpdateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [update, setUpdate] = useState<ProjectUpdate | null>(null);
  const [comments, setComments] = useState<UpdateComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api<ProjectUpdate & { reactions: Record<string, number>; comments: UpdateComment[] }>(
          `/api/updates/${id}`,
          { auth: false }
        );
        if (!active) return;
        setUpdate(data);
        setComments(data.comments ?? []);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load update');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  const handleReact = async (reaction: string) => {
    if (!user || !update) return;
    try {
      const reactions = await api<Record<string, number>>(`/api/updates/${update.id}/reactions`, {
        method: 'POST',
        body: { reaction },
      });
      setUpdate((prev) => (prev ? { ...prev, reactions } : prev));
    } catch {
      // ignore
    }
  };

  const submitComment = async () => {
    if (!user || !commentBody.trim()) return;
    setSending(true);
    setCommentError(null);
    try {
      const comment = await api<UpdateComment>(`/api/updates/${update?.id}/comments`, {
        method: 'POST',
        body: { body: commentBody, parent_id: replyTo },
      });
      setComments((prev) => [...prev, comment]);
      setCommentBody('');
      setReplyTo(null);
    } catch (e) {
      setCommentError(e instanceof ApiError ? e.message : 'Failed to post comment');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <Link to="/updates" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200">
        <BackIcon size={14} /> All updates
      </Link>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-14" />
          <Skeleton className="h-64" />
          <Skeleton className="h-40" />
        </div>
      ) : error || !update ? (
        <ErrorState message={error ?? 'Update not found'} />
      ) : (
        <>
          <article className="overflow-hidden rounded-xl border border-ink-600 bg-ink-800/60">
            <div className="flex flex-wrap items-center gap-2 border-b border-ink-600/60 bg-ink-900/50 px-4 py-3">
              <Link to={`/projects/${update.project_slug}`} className="text-xs font-bold uppercase tracking-widest text-primary-400 hover:text-primary-300">
                {update.project_name}
              </Link>
              <OfficialBadge />
              {update.author_role === 'OWNER' && <OwnerBadge role="OWNER" showIcon={false} />}
              <Badge tone={typeTone[update.update_type] ?? 'gray'}>{updateTypeLabel(update.update_type)}</Badge>
              {update.version && <Badge tone="gray">v{update.version}</Badge>}
              {update.pinned === 1 && <Badge tone="gold">PINNED</Badge>}
              <span className="ml-auto flex items-center gap-2 text-xs text-gray-500">
                <Avatar name={update.author_name} src={update.author_avatar} size="xs" />
                {update.author_name} · {timeAgo(update.published_at)}
              </span>
            </div>

            <div className="px-4 py-5 sm:px-6">
              <h1 className="text-2xl font-bold text-white">{update.title}</h1>

              {update.image && (
                <img src={update.image} alt="" className="mt-4 max-h-96 rounded-xl object-cover" loading="lazy" />
              )}

              {(() => {
                try {
                  const changelog = JSON.parse(update.changelog);
                  if (Array.isArray(changelog) && changelog.length) {
                    return (
                      <ul className="mt-4 space-y-2">
                        {changelog.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary-400" />
                            <span>{renderText(item)}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  }
                } catch {
                  // not an array
                }
                return update.body && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{renderText(update.body)}</p>;
              })()}

              <div className="mt-5 flex flex-wrap gap-3">
                {update.live_url && (
                  <a href={update.live_url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-500">
                    <LinkIcon size={14} /> View Project
                  </a>
                )}
                {update.github_url && (
                  <a href={update.github_url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink-500 px-4 text-sm font-medium text-gray-300 hover:bg-ink-600">
                    <GithubIcon size={14} /> GitHub
                  </a>
                )}
              </div>
            </div>

            <div className="border-t border-ink-600/50 px-4 py-3 sm:px-6">
              <ReactionBar reactions={update.reactions ?? {}} onReact={handleReact} />
            </div>

            {/* Discuss this update */}
            <div className="flex flex-wrap items-center gap-2 border-t border-ink-600/50 bg-ink-900/40 px-4 py-3 sm:px-6">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Discuss this update</span>
              <a
                href="#comments"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink-500 px-3.5 text-xs font-medium text-gray-300 hover:bg-ink-600"
              >
                <ReplyIcon size={13} /> Comments
              </a>
              {update.project_slug && (
                <Link
                  to={`/chat/${update.project_slug}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent-500/15 px-3.5 text-xs font-medium text-accent-300 hover:bg-accent-500/25"
                >
                  <ChatIcon size={13} /> Open #{update.project_slug} chat
                </Link>
              )}
            </div>
          </article>

          {/* Comments */}
          <section id="comments" className="scroll-mt-20 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-300">
              Comments ({comments.length})
            </h2>

            {user ? (
              <div className="rounded-xl border border-ink-600 bg-ink-800/60 p-4">
                {replyTo && (
                  <div className="mb-2 flex items-center justify-between rounded-lg bg-ink-700/60 px-3 py-2 text-xs text-gray-400">
                    <span>Replying to a comment…</span>
                    <button onClick={() => setReplyTo(null)} className="text-primary-400 hover:text-primary-300">
                      Cancel
                    </button>
                  </div>
                )}
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder="Share your thoughts…"
                  className="w-full resize-none rounded-lg border border-ink-500 bg-ink-900 px-3.5 py-2.5 text-sm text-gray-200 placeholder:text-gray-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
                {commentError && <p className="mt-1 text-xs text-red-400">{commentError}</p>}
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => void submitComment()}
                    disabled={sending || !commentBody.trim()}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50"
                  >
                    <SendIcon size={14} /> {sending ? 'Posting…' : 'Comment'}
                  </button>
                </div>
              </div>
            ) : (
              <Banner tone="info">
                <Link to="/login" className="font-medium text-primary-300 hover:underline">
                  Log in
                </Link>{' '}
                to join the discussion.
              </Banner>
            )}

            <div className="space-y-3">
              {comments.length === 0 && (
                <p className="rounded-xl border border-dashed border-ink-600 px-6 py-8 text-center text-sm text-gray-500">
                  No comments yet. Be the first to react.
                </p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="rounded-xl border border-ink-600 bg-ink-800/60 p-4" style={{ marginLeft: c.parent_id ? 32 : 0 }}>
                  <div className="flex items-center gap-2">
                    <Avatar name={c.display_name} src={c.avatar} size="sm" />
                    <span className="text-sm font-semibold text-white">{c.display_name}</span>
                    <RoleBadge role={c.role} />
                    <span className="ml-auto text-xs text-gray-500">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{renderText(c.body)}</p>
                  {user && (
                    <button
                      onClick={() => setReplyTo(c.id)}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-primary-300"
                    >
                      <ReplyIcon size={12} /> Reply
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}