import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { Project } from '../types';
import { api } from '../lib/api';
import { Input, Field, Textarea, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Banner, ErrorState } from '../components/ui/Feedback';
import { ApiError } from '../lib/api';
import { useAuth } from '../stores/auth';
import { BackIcon, PlusIcon, TrashIcon } from '../components/ui/icons';

export function NewUpdatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [updateType, setUpdateType] = useState('RELEASE');
  const [body, setBody] = useState('');
  const [image, setImage] = useState('');
  const [changelog, setChangelog] = useState<string[]>(['']);
  const [liveUrl, setLiveUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void api<Project[]>('/api/projects', { auth: false })
      .then((data) => {
        if (active) setProjects(data);
      })
      .catch((e) => {
        if (active) setLoadError(e instanceof Error ? e.message : 'Failed to load projects');
      });
    return () => {
      active = false;
    };
  }, []);

  const canPublish = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/updates', {
        method: 'POST',
        body: {
          project_id: Number(projectId),
          title,
          version: version || null,
          update_type: updateType,
          body,
          image: image || null,
          changelog: changelog.map((c) => c.trim()).filter(Boolean),
          pinned,
          live_url: liveUrl || null,
          github_url: githubUrl || null,
        },
      });
      navigate('/updates');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to publish update');
      setSubmitting(false);
    }
  };

  if (!canPublish) {
    return (
      <ErrorState message="Only the Owner or an Admin can publish official project updates." />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link to="/updates" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200">
        <BackIcon size={14} /> All updates
      </Link>

      <div>
        <h1 className="text-xl font-bold text-white">Publish Official Update</h1>
        <p className="text-sm text-gray-500">This will be visible to every follower and on the project's Updates tab.</p>
      </div>

      {loadError ? (
        <ErrorState message={loadError} />
      ) : (
        <form onSubmit={(e) => void submit(e)} className="space-y-4 rounded-xl border border-ink-600 bg-ink-800/60 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Project">
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Update type">
              <Select value={updateType} onChange={(e) => setUpdateType(e.target.value)}>
                <option value="ANNOUNCEMENT">Announcement</option>
                <option value="RELEASE">Release</option>
                <option value="FEATURE">Feature</option>
                <option value="IMPROVEMENT">Improvement</option>
                <option value="FIX">Fix</option>
                <option value="MAINTENANCE">Maintenance</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Yomikaze v2.4.0 — New vertical reader" required maxLength={200} />
            </Field>
            <Field label="Version" hint="Optional">
              <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="2.4.0" maxLength={30} />
            </Field>
          </div>

          <Field label="Changelog items" hint="One per line">
            <div className="space-y-2">
              {changelog.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={item}
                    onChange={(e) => setChangelog((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
                    placeholder="✨ New vertical reader"
                    maxLength={400}
                  />
                  <button
                    type="button"
                    onClick={() => setChangelog((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))}
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-ink-500 text-gray-400 hover:bg-ink-700"
                    aria-label="Remove changelog item"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setChangelog((prev) => [...prev, ''])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-ink-500 px-3 py-1.5 text-xs text-gray-400 hover:bg-ink-700"
              >
                <PlusIcon size={13} /> Add item
              </button>
            </div>
          </Field>

          <Field label="Details (optional)">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Longer description, context, or notes…" maxLength={20000} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Cover / screenshot URL (optional)">
              <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…/screenshot.png" />
            </Field>
            <Field label="Live URL (optional)">
              <Input value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} placeholder="https://example.ph" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="GitHub URL (optional)">
              <Input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/…/releases/tag/v2.4.0" />
            </Field>
            <label className="flex items-center gap-2 pt-6 text-sm text-gray-400">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-primary-600" />
              Pin this update
            </label>
          </div>

          {error && <Banner tone="error">{error}</Banner>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate('/updates')}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={!title || !projectId}>
              Publish update
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}