interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  online?: boolean;
  className?: string;
}

const sizes = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-16 text-2xl',
};

const ringSizes = {
  xs: 'size-2 border-2',
  sm: 'size-2.5 border-2',
  md: 'size-3 border-2',
  lg: 'size-4 border-[3px]',
};

const palette = ['bg-primary-600', 'bg-accent-500', 'bg-purple-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-blue-500', 'bg-fuchsia-500'];

function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

export function Avatar({ name, src, size = 'md', online, className = '' }: AvatarProps) {
  const fallback = name?.trim().charAt(0).toUpperCase() ?? '?';
  const bg = palette[nameHash(name ?? '?') % palette.length];
  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      {src ? (
        <img src={src} alt={name ?? 'avatar'} className={`${sizes[size]} rounded-full object-cover`} loading="lazy" />
      ) : (
        <span className={`${sizes[size]} ${bg} inline-flex items-center justify-center rounded-full font-semibold text-white`}>
          {fallback}
        </span>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ${online ? 'bg-live' : 'bg-gray-500'} ${ringSizes[size]}`}
          style={{ borderColor: '#14141f' }}
          title={online ? 'Online' : 'Offline'}
        />
      )}
    </span>
  );
}