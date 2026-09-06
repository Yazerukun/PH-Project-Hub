import { describe, expect, it } from 'vitest';
import { createSuggestion, voteSuggestion, updateSuggestion, createBug, updateBug } from '../src/routes/community';
import { createSessionToken } from '../src/auth/session';
import { FakeD1, makeEnv, authedRequest, jsonBody } from './helpers';

async function sessionFor(db: FakeD1, env: ReturnType<typeof makeEnv>, userId: number): Promise<string> {
  const token = await createSessionToken(userId, 3600, env);
  db.sessions.push({ token, user_id: userId, expires_at: Math.floor(Date.now() / 1000) + 3600 });
  return token;
}

describe('createSuggestion', () => {
  it('requires authentication', async () => {
    const res = await createSuggestion(authedRequest('/api/suggestions', { method: 'POST', body: { title: 'x', description: 'y', project_id: 1 } }), makeEnv());
    expect(res.status).toBe(401);
  });

  it('rejects a missing title or description', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const token = await sessionFor(db, env, 3);
    const res = await createSuggestion(authedRequest('/api/suggestions', { method: 'POST', body: { description: 'y', project_id: 1 }, token }), env);
    expect(res.status).toBe(400);
    expect(String((await jsonBody(res)).error)).toContain('Title');
  });

  it('rejects a missing project', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const token = await sessionFor(db, env, 3);
    const res = await createSuggestion(authedRequest('/api/suggestions', { method: 'POST', body: { title: 'x', description: 'y', project_id: 999 }, token }), env);
    expect(res.status).toBe(400);
    expect(String((await jsonBody(res)).error)).toContain('project');
  });

  it('creates a suggestion with zero votes', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const token = await sessionFor(db, env, 3);
    const res = await createSuggestion(authedRequest('/api/suggestions', { method: 'POST', body: { title: 'Offline mode', description: 'Allow offline reading', project_id: 1 }, token }), env);
    expect(res.status).toBe(201);
    const data = (await jsonBody(res)).data as { votes: number; has_voted: boolean; title: string };
    expect(data.votes).toBe(0);
    expect(data.has_voted).toBe(false);
    expect(data.title).toBe('Offline mode');
  });
});

describe('voteSuggestion', () => {
  it('requires authentication', async () => {
    const res = await voteSuggestion(authedRequest('/api/suggestions/1/vote', { method: 'POST' }), makeEnv(), 1);
    expect(res.status).toBe(401);
  });

  it('returns 404 for a missing suggestion', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const token = await sessionFor(db, env, 3);
    const res = await voteSuggestion(authedRequest('/api/suggestions/999/vote', { method: 'POST', token }), env, 999);
    expect(res.status).toBe(404);
  });

  it('adds a vote on the first tap and removes it on the second', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const token = await sessionFor(db, env, 3);
    const base = await makeEnv({ db: new FakeD1() });
    void base;

    const first = await voteSuggestion(authedRequest('/api/suggestions/1/vote', { method: 'POST', token }), env, 1);
    expect(first.status).toBe(200);
    const a = (await jsonBody(first)).data as { votes: number; has_voted: boolean };
    expect(a.votes).toBe(1);
    expect(a.has_voted).toBe(true);

    const second = await voteSuggestion(authedRequest('/api/suggestions/1/vote', { method: 'POST', token }), env, 1);
    const b = (await jsonBody(second)).data as { votes: number; has_voted: boolean };
    expect(b.votes).toBe(0);
    expect(b.has_voted).toBe(false);
  });

  it('counts distinct voters, not votes', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const admin = await sessionFor(db, env, 1);
    const member = await sessionFor(db, env, 3);
    await voteSuggestion(authedRequest('/api/suggestions/1/vote', { method: 'POST', token: admin }), env, 1);
    const res = await voteSuggestion(authedRequest('/api/suggestions/1/vote', { method: 'POST', token: member }), env, 1);
    const data = (await jsonBody(res)).data as { votes: number; has_voted: boolean };
    expect(data.votes).toBe(2);
  });
});

describe('updateSuggestion (status)', () => {
  it('lets only moderators set status', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const member = await sessionFor(db, env, 3);
    const memberRes = await updateSuggestion(authedRequest('/api/suggestions/1', { method: 'PATCH', body: { status: 'PLANNED' }, token: member }), env, 1);
    expect(memberRes.status).toBe(403);

    const admin = await sessionFor(db, env, 1);
    const adminRes = await updateSuggestion(authedRequest('/api/suggestions/1', { method: 'PATCH', body: { status: 'PLANNED' }, token: admin }), env, 1);
    expect(adminRes.status).toBe(200);
    const data = (await jsonBody(adminRes)).data as { status: string };
    expect(data.status).toBe('PLANNED');
  });

  it('rejects an invalid status value', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const admin = await sessionFor(db, env, 1);
    const res = await updateSuggestion(authedRequest('/api/suggestions/1', { method: 'PATCH', body: { status: 'NOPE' }, token: admin }), env, 1);
    expect(res.status).toBe(400);
  });
});

describe('createBug', () => {
  it('requires authentication', async () => {
    const res = await createBug(authedRequest('/api/bugs', { method: 'POST', body: { title: 'x', description: 'y', project_id: 1 } }), makeEnv());
    expect(res.status).toBe(401);
  });

  it('validates title, description, and project', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const token = await sessionFor(db, env, 3);

    const noTitle = await createBug(authedRequest('/api/bugs', { method: 'POST', body: { description: 'y', project_id: 1 }, token }), env);
    expect(noTitle.status).toBe(400);

    const badProject = await createBug(authedRequest('/api/bugs', { method: 'POST', body: { title: 'x', description: 'y', project_id: 999 }, token }), env);
    expect(badProject.status).toBe(400);
  });

  it('defaults severity to MEDIUM when omitted', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const token = await sessionFor(db, env, 3);
    const res = await createBug(authedRequest('/api/bugs', { method: 'POST', body: { title: 'Crash on load', description: 'App crashes', project_id: 1 }, token }), env);
    expect(res.status).toBe(201);
    const data = (await jsonBody(res)).data as { severity: string; status: string };
    expect(data.severity).toBe('MEDIUM');
    expect(data.status).toBe('OPEN');
  });
});

describe('updateBug (ownership + status rules)', () => {
  it('rejects a member editing someone else’s bug', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const token = await sessionFor(db, env, 3);
    db.bugs.push({ id: 10, project_id: 1, reporter_id: 1, title: 't', description: 'd', severity: 'LOW', status: 'OPEN', created_at: 0, updated_at: 0 });
    const res = await updateBug(authedRequest('/api/bugs/10', { method: 'PATCH', body: { title: 'x' }, token }), env, 10);
    expect(res.status).toBe(403);
  });

  it('lets the reporter edit their own bug but not its status', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const token = await sessionFor(db, env, 3);
    db.bugs.push({ id: 11, project_id: 1, reporter_id: 3, title: 't', description: 'd', severity: 'LOW', status: 'OPEN', created_at: 0, updated_at: 0 });

    const editBody = await updateBug(authedRequest('/api/bugs/11', { method: 'PATCH', body: { description: 'new desc' }, token }), env, 11);
    expect(editBody.status).toBe(200);

    const editStatus = await updateBug(authedRequest('/api/bugs/11', { method: 'PATCH', body: { status: 'FIXED' }, token }), env, 11);
    expect(editStatus.status).toBe(403);
  });

  it('lets a moderator change status on any bug', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const mod = await sessionFor(db, env, 2);
    db.bugs.push({ id: 12, project_id: 1, reporter_id: 3, title: 't', description: 'd', severity: 'HIGH', status: 'OPEN', created_at: 0, updated_at: 0 });
    const res = await updateBug(authedRequest('/api/bugs/12', { method: 'PATCH', body: { status: 'INVESTIGATING' }, token: mod }), env, 12);
    expect(res.status).toBe(200);
    const data = (await jsonBody(res)).data as { status: string };
    expect(data.status).toBe('INVESTIGATING');
  });

  it('returns 400 when nothing to update', async () => {
    const db = new FakeD1();
    const env = makeEnv({ db });
    const token = await sessionFor(db, env, 3);
    db.bugs.push({ id: 13, project_id: 1, reporter_id: 3, title: 't', description: 'd', severity: 'LOW', status: 'OPEN', created_at: 0, updated_at: 0 });
    const res = await updateBug(authedRequest('/api/bugs/13', { method: 'PATCH', body: {}, token }), env, 13);
    expect(res.status).toBe(400);
  });
});