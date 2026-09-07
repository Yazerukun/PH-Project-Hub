import type { ComponentType } from 'react';
import type { Channel } from '../../types';

export type IconProp = { className?: string; size?: number };
export type Icon = ComponentType<IconProp>;

export const projectColors = [
  'bg-primary-600',
  'bg-accent-500',
  'bg-emerald-500',
  'bg-rose-500',
  'bg-amber-400',
  'bg-blue-500',
  'bg-fuchsia-500',
  'bg-teal-400',
] as const;

const skipWords = new Set(['and', 'the', 'of', 'to', 'in', 'for']);

export function formatChannelName(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function projectInitials(slug: string): string {
  const parts = slug.split('-');
  if (parts.length === 1) {
    return parts[0].toUpperCase().slice(0, 2);
  }
  const kept = parts.filter((p) => !skipWords.has(p));
  return kept
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2);
}

export function projectColor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return projectColors[h % projectColors.length];
}

export function channelLink(slug: string): string {
  return `/chat/${slug}`;
}

export function orderCommunity(channels: Channel[]): Channel[] {
  // Preserve the API's `position` ordering, but pin `general` first and
  // `announcements` second so `#general` is never duplicated or buried.
  return channels.reduce<Channel[]>((acc, c) => {
    if (c.slug === 'general') {
      acc.unshift(c);
    } else if (c.slug === 'announcements') {
      const generalIdx = acc.findIndex((x) => x.slug === 'general');
      acc.splice(generalIdx === -1 ? 0 : generalIdx + 1, 0, c);
    } else {
      acc.push(c);
    }
    return acc;
  }, []);
}
