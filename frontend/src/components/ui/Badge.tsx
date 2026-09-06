import type { ReactNode } from 'react';
import type { Role } from '../../types';

type Tone = 'primary' | 'accent' | 'live' | 'warn' | 'orange' | 'danger' | 'gray' | 'gold';

const tones: Record<Tone, string> = {
  primary: 'bg-primary-600/15 text-primary-300 border-primary-600/30',
  accent: 'bg-accent-500/10 text-accent-300 border-accent-500/30',
  live: 'bg-live/10 text-live border-live/30',
  warn: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  orange: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  danger: 'bg-red-500/10 text-red-300 border-red-500/30',
  gray: 'bg-ink-600 text-gray-400 border-ink-500',
  gold: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
};

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'gray', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

const roleTone: Record<Role, Tone> = {
  OWNER: 'gold',
  ADMIN: 'danger',
  MODERATOR: 'accent',
  MEMBER: 'gray',
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge tone={roleTone[role]}>
      {role === 'OWNER' && '👑 OWNER'}
      {role === 'ADMIN' && 'ADMIN'}
      {role === 'MODERATOR' && 'MOD'}
      {role === 'MEMBER' && 'MEMBER'}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Tone =
    status === 'LIVE' ? 'live' :
    status === 'BETA' ? 'primary' :
    status === 'IN DEVELOPMENT' ? 'warn' :
    status === 'MAINTENANCE' ? 'orange' : 'gray';
  return <Badge tone={tone}>{status}</Badge>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const tone: Tone =
    severity === 'CRITICAL' ? 'danger' :
    severity === 'HIGH' ? 'warn' :
    severity === 'LOW' ? 'gray' : 'accent';
  return <Badge tone={tone}>{severity}</Badge>;
}