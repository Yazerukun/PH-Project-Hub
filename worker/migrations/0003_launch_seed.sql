-- v1.0 launch seed: hub profile, #announcements channel, welcome + PinoyTools posts

-- 1. PH Project Hub project (the hub itself)
INSERT OR IGNORE INTO projects (slug, name, description, category, status, version, tech_stack, github_url, live_url) VALUES
('ph-project-hub', 'PH Project Hub', 'The community hub for Filipino builders: project updates, releases, bug reports, suggestions, roadmap, and real-time community chat.', 'COMMUNITY', 'LIVE', '1.0.0', '["React","TypeScript","Cloudflare","D1","Durable Objects"]', NULL, NULL);

-- 2. #announcements locked channel, right after #general
UPDATE channels SET position = position + 1
WHERE position >= 2 AND NOT EXISTS (SELECT 1 FROM channels WHERE slug = 'announcements');

INSERT OR IGNORE INTO channels (slug, name, description, type, project_id, is_locked, position) VALUES
('announcements', 'Announcements', 'Official announcements from the owner and moderators', 'COMMUNITY', NULL, 1, 2);

-- 2b. PH Project Hub project discussion channel (matches the one-per-project pattern)
INSERT OR IGNORE INTO channels (slug, name, description, type, project_id, is_locked, position)
SELECT 'ph-project-hub', 'PH Project Hub', 'PH Project Hub project discussion', 'PROJECT', id, 0, 17
FROM projects WHERE slug = 'ph-project-hub';

-- 3. Welcome announcement pinned on the hub project (author = owner user id 4)
INSERT INTO project_updates (project_id, author_id, version, title, body, update_type, changelog, pinned, live_url, github_url)
SELECT p.id, 4, '1.0.0', 'Welcome to PH Project Hub 🎉',
       'PH Project Hub v1.0 is now live — the official home for project updates, releases, bug reports, suggestions, roadmap, and real-time community chat for the Filipino builder community.\n\nHere''s what you can do:\n\n• Explore the projects and follow the ones you care about\n• Follow official updates, releases, and announcements\n• Join the live community chat in #general\n• Report bugs or suggest features for each project\n• Follow the roadmap and see what''s coming next\n\nStart by introducing yourself in #introductions, then join the conversation in #general. The community guidelines are just a click away in the sidebar. Build · Update · Discuss · Grow.',
       'ANNOUNCEMENT', '[]', 1, NULL, NULL
FROM projects p WHERE p.slug = 'ph-project-hub'
AND NOT EXISTS (SELECT 1 FROM project_updates u WHERE u.project_id = p.id AND u.title = 'Welcome to PH Project Hub 🎉');

-- 4. PinoyTools listing announcement (verified info only)
INSERT INTO project_updates (project_id, author_id, version, title, body, update_type, changelog, pinned, live_url, github_url)
SELECT p.id, 4, '1.1.0', 'PinoyTools is now on PH Project Hub',
       'PinoyTools is an official project on PH Project Hub: a collection of everyday web tools built for Filipino users. Current release: v1.1.0.\n\nSubscribe to the project to get notified about new tools and improvements. For feedback and feature requests, open the #pinoytools channel or the Suggestions tab.',
       'ANNOUNCEMENT', '[]', 0, NULL, NULL
FROM projects p WHERE p.slug = 'pinoytools'
AND NOT EXISTS (SELECT 1 FROM project_updates u WHERE u.project_id = p.id AND u.title = 'PinoyTools is now on PH Project Hub');