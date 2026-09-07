import { Link } from 'react-router-dom';
import type { ProjectUpdate } from '../types';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { OwnerBadge, OfficialBadge } from './ui/OwnerBadge';
import { timeAgo, renderText } from '../lib/format';
import { updateTypeLabel } from '../lib/updates';
import { GithubIcon, LinkIcon, PinIcon, ChatIcon, HeartIcon, ThumbsUpIcon, FireIcon, PartyIcon } from './ui/icons';

const typeTone: Record<string, 'primary' | 'accent' | 'live' | 'warn' | 'danger' | 'gray'> = {
  ANNOUNCEMENT: 'primary',
  RELEASE: 'live',
  FEATURE: 'accent',
  IMPROVEMENT: 'accent',
  FIX: 'warn',
  MAINTENANCE: 'gray',
};

const typeIcon: Record<string, React.ReactNode> = {
  ANNOUNCEMENT: <PinIcon size={12} />,
  RELEASE: <FireIcon size={12} />,
  FEATURE: <PartyIcon size={12} />,
  IMPROVEMENT: <ThumbsUpIcon size={12} />,
  FIX: <HeartIcon size={12} />,
  MAINTENANCE: <PinIcon size={12} />,
};

const REACTION_EMOJIS = ['❤️', '👍', '🔥', '🎉'];

function parseChangelog(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').map(renderText) : [];
  } catch {
    return [];
  }
}

export function ReactionBar({
  reactions,
  onReact,
  size = 'md',
}: {
  reactions: Record<string, number>;
  onReact?: (reaction: string) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="flex items-center gap-1.5">
      {REACTION_EMOJIS.map((emoji) => {
        const count = reactions?.[emoji] ?? 0;
        return (
          <button
            key={emoji}
            onClick={() => onReact?.(emoji)}
            disabled={!onReact}
            className={`inline-flex items-center gap-1 rounded-full border transition-colors disabled:cursor-default ${
              count > 0
                ? 'border-primary-600/40 bg-primary-600/10 hover:bg-primary-600/20'
                : 'border-ink-500 bg-ink-700/40 hover:bg-ink-600'
            } ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}`}
            aria-label={`React ${emoji}`}
          >
            <span aria-hidden="true">{emoji}</span>
            {count > 0 && <span className="text-xs font-medium text-gray-300">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function UpdateCard({ update, onReact }: { update: ProjectUpdate; onReact?: (reaction: string) => void }) {
  const changelog = parseChangelog(update.changelog);
  const reactions = update.reactions ?? {};

  return (
    <article
      className={`animate-fade-in-up overflow-hidden rounded-xl border bg-ink-800/60 ${
        update.pinned === 1 ? 'border-primary-600/40 shadow-lg shadow-primary-900/20' : 'border-ink-600'
      }`}
    >
      {/* Project header strip */}
      <div className="flex items-center gap-2 border-b border-ink-600/60 bg-ink-900/40 px-4 py-2.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary-300">{update.project_name}</span>
        {(update.author_role === 'OWNER' || update.author_role === 'ADMIN') && <OfficialBadge />}
        {update.author_role === 'OWNER' && <OwnerBadge role="OWNER" showIcon={false} />}
        <Badge tone={typeTone[update.update_type] ?? 'gray'}>
          {typeIcon[update.update_type]}
          {updateTypeLabel(update.update_type)}
        </Badge>
        {update.version && <span className="text-meta text-gray-500">v{update.version}</span>}
        {update.pinned === 1 && (
          <Badge tone="gold" className="ml-auto">
            <PinIcon size={11} /> PINNED
          </Badge>
        )}
      </div>

      <div className="px-4 py-4 sm:px-5">
        <h3 className="text-card-title text-white">
          <Link to={`/updates/${update.id}`} className="hover:text-primary-300">
            {update.title}
          </Link>
        </h3>

        {changelog.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {changelog.slice(0, 5).map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}

        {update.body && !changelog.length && (
          <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-400">{renderText(update.body)}</p>
        )}

        {update.image && (
          <img src={update.image} alt="" className="mt-3 max-h-72 w-full rounded-lg object-cover" loading="lazy" />
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {update.live_url && (
            <a
              href={update.live_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 text-xs font-semibold text-white hover:bg-primary-500"
            >
              <LinkIcon size={13} /> View Project
            </a>
          )}
          {update.github_url && (
            <a
              href={update.github_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink-500 px-3.5 text-xs font-medium text-gray-300 hover:bg-ink-600"
            >
              <GithubIcon size={13} /> GitHub
            </a>
          )}

          <span className="ml-auto flex items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <ChatIcon size={13} /> {update.comment_count ?? 0}
            </span>
            <span>
              {timeAgo(update.published_at)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={update.author_name} src={update.author_avatar} size="xs" />
              {update.author_name}
            </span>
          </span>
        </div>

        {/* Reactions */}
        <div className="mt-3 border-t border-ink-600/50 pt-3">
          <ReactionBar reactions={reactions} onReact={onReact} />
        </div>
      </div>
    </article>
  );
}