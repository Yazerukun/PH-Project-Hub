import { useState, type FormEvent } from 'react';
import { useAuth } from '../stores/auth';
import { usePresence } from '../stores/presence';
import { useCountryFlag } from '../hooks/useCountryFlag';
import { Avatar } from '../components/ui/Avatar';
import { RoleBadge } from '../components/ui/Badge';
import { Card } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { Field, Input, Textarea } from '../components/ui/Input';
import { formatDate } from '../lib/format';
import { GithubIcon, LinkIcon, EditIcon, CancelIcon } from '../components/ui/icons';

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const selfOnline = usePresence((s) => s.selfOnline);
  const { code, flagUrl } = useCountryFlag();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ display_name: '', bio: '', avatar: '', github_url: '', website: '', status_message: '', current_password: '', new_password: '' });

  if (!user) return null;

  const startEdit = () => {
    setForm({
      display_name: user.display_name,
      bio: user.bio ?? '',
      avatar: user.avatar ?? '',
      github_url: user.github_url ?? '',
      website: user.website ?? '',
      status_message: user.status_message ?? '',
      current_password: '',
      new_password: '',
    });
    setError(null);
    setSaved(false);
    setShowPassword(false);
    setEditing(true);
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const patch: Record<string, unknown> = {
        display_name: form.display_name,
        bio: form.bio,
        avatar: form.avatar,
        github_url: form.github_url,
        website: form.website,
        status_message: form.status_message,
      };
      if (form.new_password) {
        patch.current_password = form.current_password;
        patch.new_password = form.new_password;
      }
      await updateProfile(patch);
      setSaved(true);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <Avatar name={user.display_name} src={user.avatar} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-white">{user.display_name}</h1>
            <p className="text-sm text-gray-500">@{user.username}</p>
            <div className="mt-2"><RoleBadge role={user.role} /></div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <img
              src={flagUrl}
              alt={`${code} flag`}
              title={`Detected location: ${code}`}
              className="h-7 w-10 shrink-0 rounded-sm object-cover shadow ring-1 ring-ink-500"
              loading="eager"
            />
            {!editing && (
              <Button variant="secondary" size="sm" icon={<EditIcon size={14} />} onClick={startEdit}>
                Edit profile
              </Button>
            )}
          </div>
        </div>

        {user.bio && <p className="mt-4 text-sm text-gray-300">{user.bio}</p>}
        {user.status_message && !editing && (
          <p className="mt-1 text-xs italic text-gray-500">"{user.status_message}"</p>
        )}

        {editing && (
          <form onSubmit={onSubmit} className="mt-5 space-y-4 border-t border-ink-600 pt-5">
            <Field label="Display name">
              <Input value={form.display_name} onChange={set('display_name')} maxLength={50} required />
            </Field>
            <Field label="Bio" hint="Up to 200 characters">
              <Textarea value={form.bio} onChange={set('bio')} rows={3} maxLength={200} />
            </Field>
            <Field label="Status message" hint="A short line shown on your profile">
              <Input value={form.status_message} onChange={set('status_message')} maxLength={120} placeholder="e.g. Building PH software" />
            </Field>
            <Field label="Avatar URL">
              <Input value={form.avatar} onChange={set('avatar')} placeholder="https://…" />
            </Field>
            <Field label="GitHub URL">
              <Input value={form.github_url} onChange={set('github_url')} placeholder="https://github.com/…" />
            </Field>
            <Field label="Website">
              <Input value={form.website} onChange={set('website')} placeholder="https://…" />
            </Field>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="text-xs font-medium text-primary-400 hover:text-primary-300"
              >
                {showPassword ? 'Hide password change' : 'Change password'}
              </button>
            </div>
            {showPassword && (
              <div className="space-y-3 rounded-lg border border-ink-600 bg-ink-800 p-4">
                <Field label="Current password">
                  <Input type="password" value={form.current_password} onChange={set('current_password')} />
                </Field>
                <Field label="New password" hint="At least 8 characters">
                  <Input type="password" value={form.new_password} onChange={set('new_password')} />
                </Field>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" loading={saving}>Save changes</Button>
              <Button type="button" variant="ghost" size="md" icon={<CancelIcon size={14} />} onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {saved && !editing && <p className="mt-4 text-sm text-live">Profile updated</p>}

        <div className="mt-4 flex flex-wrap gap-3">
          {user.github_url && (
            <a href={user.github_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200">
              <GithubIcon size={14} /> {user.github_url.replace('https://', '')}
            </a>
          )}
          {user.website && (
            <a href={user.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200">
              <LinkIcon size={14} /> {user.website.replace('https://', '')}
            </a>
          )}
        </div>

        <div className="mt-5 flex items-center gap-4 border-t border-ink-600 pt-4 text-xs text-gray-500">
          <span>Member since {user.created_at ? formatDate(user.created_at) : '—'}</span>
          <span className="inline-flex items-center gap-1">
            <span className={`size-1.5 rounded-full ${selfOnline ? 'bg-live' : 'bg-gray-600'}`} />
            {selfOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-300">About PH PROJECT HUB</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-400">
          You're part of a community of builders from the Philippines. Find projects to follow, join discussions in
          real time, report bugs, suggest features, and watch roadmaps come to life.
        </p>
        <p className="mt-3 text-[11px] text-gray-600">Build · Update · Discuss · Grow</p>
      </Card>
    </div>
  );
}