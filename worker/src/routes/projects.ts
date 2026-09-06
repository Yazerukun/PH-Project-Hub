import { Env } from '../types';
import { ok, badRequest, notFound, forbidden, created, error } from '../utils/http';
import { requireAuth, isAdmin } from '../auth/session';
import { safeBody, safeStringEnum, validateUrl, FieldError, validateRequiredFields, SLUG_RE } from '../validation';

const PROJECT_STATUSES = ['LIVE', 'BETA', 'IN DEVELOPMENT', 'MAINTENANCE', 'ARCHIVED'] as const;
type ProjectStatus = (typeof PROJECT_STATUSES)[number];

function parseTechStack(v: unknown): string[] | null {
  if (v === undefined || v === null || v === '') return [''];
  if (!Array.isArray(v)) return null;
  if (v.some((x) => typeof x !== 'string' || x.length > 80)) return null;
  return v;
}

function validateProjectBody(body: Record<string, unknown>): { errors: FieldError[]; slug: string; name: string; description: string } {
  const errors: FieldError[] = validateRequiredFields(body, [
    ['name', 100],
    ['description', 10000],
  ]);
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = safeBody(body.description, 'description', 10000) ?? '';

  if (!slug && body.slug === undefined && body.slug === null) {
    // auto-generate from name
  }
  if (typeof body.slug === 'string') {
    if (!SLUG_RE.test(slug)) {
      errors.push({ field: 'slug', message: 'Slug must be lowercase letters, numbers, hyphens' });
    }
  }
  return { errors, slug, name, description };
}

export async function listProjects(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('q')?.trim();

  let sql = 'SELECT p.*, (SELECT COUNT(*) FROM followers f WHERE f.project_id = p.id) AS follower_count, (SELECT COUNT(*) FROM project_updates u WHERE u.project_id = p.id) AS update_count FROM projects p';
  const clauses: string[] = [];
  const binds: unknown[] = [];

  if (status) {
    clauses.push('p.status = ?');
    binds.push(status);
  }
  if (search) {
    clauses.push('(p.name LIKE ? OR p.description LIKE ?)');
    binds.push(`%${search}%`, `%${search}%`);
  }
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY p.updated_at DESC';

  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  return ok(results);
}

export async function getProject(slug: string, env: Env): Promise<Response> {
  const project = await env.DB.prepare(
    `SELECT p.*,
      (SELECT COUNT(*) FROM followers f WHERE f.project_id = p.id) AS follower_count,
      (SELECT COUNT(*) FROM project_updates u WHERE u.project_id = p.id) AS update_count,
      (SELECT COUNT(*) FROM bug_reports b WHERE b.project_id = p.id) AS bug_count,
      (SELECT COUNT(*) FROM suggestions s WHERE s.project_id = p.id) AS suggestion_count
     FROM projects p WHERE p.slug = ?`
  ).bind(slug).first();
  if (!project) return notFound('Project not found');
  return ok(project);
}

export async function createProject(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return forbidden('Authentication required');
  if (!isAdmin(auth.user)) return forbidden('Only admins can create projects');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON');
  }

  const { errors, slug, name, description } = validateProjectBody(body);
  const status = safeStringEnum<ProjectStatus>(body.status, PROJECT_STATUSES, 'IN DEVELOPMENT');
  const version = typeof body.version === 'string' ? body.version.slice(0, 30) : null;
  const techStack = parseTechStack(body.tech_stack);
  if (techStack === null) errors.push({ field: 'tech_stack', message: 'tech_stack must be an array of strings' });
  const urlError = validateUrl(body.github_url, 'github_url');
  if (urlError) errors.push(urlError);
  const liveUrlError = validateUrl(body.live_url, 'live_url');
  if (liveUrlError) errors.push(liveUrlError);

  if (errors.length) return badRequest(errors.map((e) => e.message).join('; '));

  const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const github_url = typeof body.github_url === 'string' && body.github_url ? body.github_url : null;
  const live_url = typeof body.live_url === 'string' && body.live_url ? body.live_url : null;
  const category = typeof body.category === 'string' ? body.category.slice(0, 50) : 'OTHER';

  try {
    const { meta } = await env.DB.prepare(
      `INSERT INTO projects (slug, name, description, category, status, version, tech_stack, github_url, live_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(finalSlug, name, description, category, status, version, JSON.stringify(techStack ?? []), github_url, live_url).run();
    const createdProject = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(Number(meta.last_row_id)).first();
    return created(createdProject);
  } catch (e) {
    if (String((e as Error).message).includes('UNIQUE')) return badRequest('A project with that slug already exists');
    return error('Failed to create project', 500);
  }
}

export async function updateProject(request: Request, env: Env, slug: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return forbidden('Authentication required');
  if (!isAdmin(auth.user)) return forbidden('Only admins can update projects');

  const existing = await env.DB.prepare('SELECT * FROM projects WHERE slug = ?').bind(slug).first();
  if (!existing) return notFound('Project not found');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON');
  }

  const name = typeof body.name === 'string' ? body.name.trim() : existing.name;
  const description = typeof body.description === 'string' ? body.description.trim() : existing.description;
  const status = safeStringEnum<ProjectStatus>(body.status, PROJECT_STATUSES) ?? existing.status;
  const version = body.version !== undefined ? (typeof body.version === 'string' ? body.version.slice(0, 30) : null) : existing.version;
  const category = typeof body.category === 'string' ? body.category.slice(0, 50) : existing.category;
  const cover = typeof body.cover === 'string' ? body.cover : existing.cover;
  const github_url = body.github_url !== undefined ? (typeof body.github_url === 'string' ? body.github_url : null) : existing.github_url;
  const live_url = body.live_url !== undefined ? (typeof body.live_url === 'string' ? body.live_url : null) : existing.live_url;

  let tech_stack = existing.tech_stack;
  if (body.tech_stack !== undefined) {
    const parsed = parseTechStack(body.tech_stack);
    if (parsed === null) return badRequest('tech_stack must be an array of strings');
    tech_stack = JSON.stringify(parsed);
  }

  if (validateUrl(github_url, 'github_url')) {
    return badRequest('Invalid github_url');
  }
  if (validateUrl(live_url, 'live_url')) {
    return badRequest('Invalid live_url');
  }

  await env.DB.prepare(
    `UPDATE projects SET name=?, description=?, status=?, version=?, category=?, cover=?, github_url=?, live_url=?, tech_stack=?, updated_at=unixepoch() WHERE id=?`
  ).bind(name, description, status, version, category, cover, github_url, live_url, tech_stack, existing.id).run();

  const updated = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(existing.id).first();
  return ok(updated);
}

export async function deleteProject(request: Request, env: Env, slug: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (!auth) return forbidden('Authentication required');
  if (!isAdmin(auth.user)) return forbidden('Only admins can delete projects');

  const existing = await env.DB.prepare('SELECT * FROM projects WHERE slug = ?').bind(slug).first();
  if (!existing) return notFound('Project not found');
  await env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(existing.id).run();
  return ok({ success: true, deleted: existing.id });
}
