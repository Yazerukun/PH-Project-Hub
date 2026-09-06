import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import { Input, Field } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Banner } from '../components/ui/Feedback';
import { ApiError } from '../lib/api';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { login, register, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === 'register';
  const next = searchParams.get('next') ?? '/';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isRegister) {
      if (password !== confirm) {
        setError('Passwords do not match');
        return;
      }
      if (username.length < 3 || username.length > 24) {
        setError('Username must be 3-24 characters');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
    }

    try {
      if (isRegister) {
        await register(username, email, password, displayName || undefined);
      } else {
        await login(email, password);
      }
      navigate(next.startsWith('/') ? next : '/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center py-10">
      <div className="rounded-2xl border border-ink-600 bg-ink-800/60 p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-white">
          {isRegister ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isRegister ? (
            <>Join the community of Filipino builders. 🇵🇭</>
          ) : (
            <>Log in to continue to PH PROJECT HUB.</>
          )}
        </p>

        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
          {isRegister && (
            <Field label="Username">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="e.g. builder_pinoy"
                required
                minLength={3}
                maxLength={24}
              />
            </Field>
          )}

          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </Field>

          {isRegister && (
            <Field label="Display name (optional)" hint="Defaults to your username">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                maxLength={50}
              />
            </Field>
          )}

          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              required
              minLength={8}
              maxLength={128}
            />
          </Field>

          {isRegister && (
            <Field label="Confirm password">
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                required
              />
            </Field>
          )}

          {error && <Banner tone="error">{error}</Banner>}

          <Button type="submit" loading={loading} className="w-full">
            {isRegister ? 'Create account' : 'Log in'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          {isRegister ? (
            <>
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-primary-400 hover:text-primary-300">
                Log in
              </Link>
            </>
          ) : (
            <>
              New here?{' '}
              <Link to="/register" className="font-medium text-primary-400 hover:text-primary-300">
                Create an account
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}