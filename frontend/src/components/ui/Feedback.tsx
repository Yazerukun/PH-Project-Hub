type Tone = 'error' | 'info' | 'warning' | 'success';

const tones: Record<Tone, string> = {
  error: 'border-red-500/30 bg-red-500/10 text-red-200',
  info: 'border-accent-500/30 bg-accent-500/10 text-accent-200',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  success: 'border-live/30 bg-live/10 text-live',
};

interface BannerProps {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}

export function Banner({ tone = 'info', children, className = '' }: BannerProps) {
  return (
    <div role="alert" className={`rounded-lg border px-3.5 py-2.5 text-sm ${tones[tone]} ${className}`}>
      {children}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-600 px-6 py-12 text-center">
      <p className="text-sm font-medium text-gray-300">{title}</p>
      {description && <p className="max-w-sm text-xs text-gray-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Failed to load', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-6 py-10 text-center">
      <p className="text-sm text-red-200">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg border border-ink-500 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-ink-600"
        >
          Retry
        </button>
      )}
    </div>
  );
}