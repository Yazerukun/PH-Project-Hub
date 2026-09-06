import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { Project } from '../types';
import { api } from '../lib/api';
import { Input, Field, Textarea, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Banner } from '../components/ui/Feedback';
import { ApiError } from '../lib/api';
import { BackIcon } from '../components/ui/icons';

export function NewSuggestionPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void api<Project[]>('/api/projects', { auth: false }).then((data) => {
      if (active) setProjects(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const suggestion = await api<{ id: number }>('/api/suggestions', {
        method: 'POST',
        body: { project_id: Number(projectId), title, description },
      });
      void suggestion;
      navigate('/suggestions');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit suggestion');
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link to="/suggestions" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200">
        <BackIcon size={14} /> All suggestions
      </Link>

      <div>
        <h1 className="text-xl font-bold text-white">Submit a Feature Suggestion</h1>
        <p className="text-sm text-gray-500">Help make the projects you use better.</p>
      </div>

      <form onSubmit={(e) => void submit(e)} className="space-y-4 rounded-xl border border-ink-600 bg-ink-800/60 p-5">
        <Field label="Project">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A short, clear title" required maxLength={200} />
        </Field>

        <Field label="Description" hint="Explain the feature and why it matters.">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder="Describe your idea…" required maxLength={10000} />
        </Field>

        {error && <Banner tone="error">{error}</Banner>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate('/suggestions')}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={!title || !description || !projectId}>
            Submit suggestion
          </Button>
        </div>
      </form>
    </div>
  );
}