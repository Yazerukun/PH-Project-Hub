import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

const base = `w-full rounded-lg border border-ink-500 bg-ink-800 px-3.5 py-2.5 text-sm text-gray-200
  placeholder:text-gray-500 transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none`;

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
}

export function Field({ label, hint, error, children }: FieldProps & { children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-gray-300">{label}</span>}
      {children}
      {hint && !error && <span className="block text-xs text-gray-500">{hint}</span>}
      {error && <span className="block text-xs text-red-400">{error}</span>}
    </label>
  );
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${base} ${className}`} {...rest} />;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${base} ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${base} appearance-none pr-8 ${className}`} {...rest}>
      {children}
    </select>
  );
}