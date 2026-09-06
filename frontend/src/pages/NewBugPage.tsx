import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import type { Project } from '../types';
import { api } from '../lib/api';
import { Input, Field, Textarea, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Banner } from '../components/ui/Feedback';
import { ApiError } from '../lib/api';
import { BackIcon } from '../components/ui/icons';

export function NewBugPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [browser, setBrowser] = useState('');
  const [device, setDevice] = useState('');
  const [screenshot, setScreenshot] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void api<Project[]>('/api/projects', { auth: false }).then((data) => {
      if (!active) return;
      setProjects(data);
      const slug = params.get('project');
      if (slug) {
        const match = data.find((p) => p.slug === slug);
        if (match) setProjectId(String(match.id));
      }
    });
    return () => {
      active = false;
    };
  }, [params]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api('/api/bugs', {
        method: 'POST',
        body: {
          project_id: Number(projectId),
          title,
          description,
          steps_to_reproduce: steps,
          expected_behavior: expected,
          actual_behavior: actual,
          browser,
          device,
          screenshot: screenshot || null,
          severity,
        },
      });
      navigate('/bugs');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit bug report');
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link to="/bugs" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200">
        <BackIcon size={14} /> All bug reports
      </Link>

      <div>
        <h1 className="text-xl font-bold text-white">Report a Bug</h1>
        <p className="text-sm text-gray-500">Help us fix things faster with a clear report.</p>
      </div>

      <form onSubmit={(e) => void submit(e)} className="space-y-4 rounded-xl border border-ink-600 bg-ink-800/60 p-5">
        <Field label="Project" error={projectId ? undefined : 'Project is required'}>
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short, clear summary" required maxLength={200} />
        </Field>

        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What happened?" required maxLength={10000} />
        </Field>

        <Field label="Steps to reproduce">
          <Textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={3} placeholder={'1. Go to…\n2. Click…\n3. See error'} maxLength={10000} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Expected behavior">
            <Textarea value={expected} onChange={(e) => setExpected(e.target.value)} rows={2} placeholder="What should happen?" maxLength={10000} />
          </Field>
          <Field label="Actual behavior">
            <Textarea value={actual} onChange={(e) => setActual(e.target.value)} rows={2} placeholder="What actually happened?" maxLength={10000} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Browser">
            <Input value={browser} onChange={(e) => setBrowser(e.target.value)} placeholder="e.g. Chrome 120" maxLength={200} />
          </Field>
          <Field label="Device">
            <Input value={device} onChange={(e) => setDevice(e.target.value)} placeholder="e.g. Samsung Galaxy S24" maxLength={200} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Severity">
            <Select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </Select>
          </Field>
          <Field label="Screenshot URL (optional)" hint="Link to an image URL">
            <Input value={screenshot} onChange={(e) => setScreenshot(e.target.value)} placeholder="https://…/screenshot.png" />
          </Field>
        </div>

        {error && <Banner tone="error">{error}</Banner>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate('/bugs')}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={!title || !description || !projectId}>
            Submit bug report
          </Button>
        </div>
      </form>
    </div>
  );
}