import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary-600 text-white hover:bg-primary-500 focus-visible:ring-primary-500',
  secondary: 'bg-ink-600 text-gray-200 hover:bg-ink-500 focus-visible:ring-ink-400',
  ghost: 'bg-transparent text-gray-300 hover:bg-ink-600 focus-visible:ring-ink-400',
  danger: 'bg-red-600/90 text-white hover:bg-red-500 focus-visible:ring-red-500',
  success: 'bg-live/90 text-ink-900 hover:bg-live focus-visible:ring-live/60',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg font-medium transition-colors duration-150
        focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 focus-visible:outline-none
        disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}