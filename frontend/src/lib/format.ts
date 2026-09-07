export function timeAgo(ts: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - ts);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 365) return `${Math.floor(diff / (86400 * 30))}mo ago`;
  return `${Math.floor(diff / (86400 * 365))}y ago`;
}

export function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(ts: number): string {
  return `${formatDate(ts)} ${formatTime(ts)}`;
}

export function parseTechStack(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

/** Renders stored content that contains escaped newlines (`\n`) as real line breaks. */
export function renderText(text: string): string {
  return text.replace(/\\n/g, '\n').replace(/\\r/g, '');
}