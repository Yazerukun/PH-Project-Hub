import type { Role } from '../../types';
import { Badge } from './Badge';

/**
 * Subtle OWNER / OFFICIAL identity marker for posts, messages and authors.
 * Gold-tinted, small, and never obnoxious.
 */
export function OwnerBadge({ role, showIcon = true }: { role?: Role | string | null; showIcon?: boolean }) {
  if (role !== 'OWNER') return null;
  return (
    <Badge tone="gold" className="gap-0.5 !px-1.5">
      {showIcon && <span aria-hidden="true">👑</span>}
      OWNER
    </Badge>
  );
}

/**
 * Label for official project updates (ADMIN/OWNER authored).
 */
export function OfficialBadge() {
  return (
    <Badge tone="gold" className="gap-1">
      <span aria-hidden="true">◆</span>
      OFFICIAL
    </Badge>
  );
}
