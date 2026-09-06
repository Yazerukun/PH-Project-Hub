-- Seed production projects and channels

INSERT OR IGNORE INTO projects (slug, name, description, category, status, version, tech_stack, github_url, live_url) VALUES
('yomikaze', 'Yomikaze', 'A modern manga reader for the Filipino community. Fast, beautiful, and free.', 'READER', 'LIVE', '2.4.0', '["React","TypeScript","Vite","Cloudflare"]', NULL, 'https://yomikaze.vercel.app/'),
('pinoytools', 'PinoyTools', 'A collection of everyday web tools built for Filipino users.', 'TOOLS', 'LIVE', '1.1.0', '["React","TypeScript","Tailwind","Cloudflare"]', NULL, NULL),
('pinoysofthub', 'PinoySoftHub', 'Free and safe software application downloads for Windows, curated for the Philippines.', 'DOWNLOADS', 'LIVE', '0.9.0', '["React","TypeScript","Cloudflare","D1"]', NULL, 'https://pinoysofthub.pages.dev'),
('pcvault', 'PCVault', 'Your personal PC game and software vault. Curated and verified.', 'GAMES', 'LIVE', '0.5.0', '["Python","React","TypeScript","Cloudflare"]', NULL, 'https://pcvault.pages.dev'),
('ai-and-tools', 'AI & Tools', 'AI resources, prompts, and developer tools hub.', 'AI', 'IN DEVELOPMENT', '1.0.0', '["React","TypeScript","OpenAI","Cloudflare"]', NULL, NULL),
('tinda-pos', 'TINDA POS', 'A point-of-sale app for sari-sari stores and small businesses. Track sales, manage inventory, and keep all records local with SQLite.', 'POS', 'LIVE', 'v1.0.2-hotfix.1', '["Python","SQLite"]', 'https://github.com/Yazerukun/TINDA-POS', NULL);

INSERT OR IGNORE INTO channels (slug, name, description, type, project_id, position) VALUES
('general', 'General', 'Welcome and general discussion', 'COMMUNITY', NULL, 1),
('introductions', 'Introductions', 'Introduce yourself to the community', 'COMMUNITY', NULL, 2),
('showcase', 'Showcase', 'Show off your work', 'COMMUNITY', NULL, 3),
('collaboration', 'Collaboration', 'Find collaborators and join projects', 'COMMUNITY', NULL, 4),
('help-and-support', 'Help & Support', 'Get help with the hub and projects', 'COMMUNITY', NULL, 5),
('feedback', 'Feedback', 'Give feedback on the hub', 'COMMUNITY', NULL, 6),
('bug-reports', 'Bug Reports', 'Report bugs you''ve found', 'COMMUNITY', NULL, 7),
('suggestions', 'Suggestions', 'Suggest features and improvements', 'COMMUNITY', NULL, 8),
('off-topic', 'Off-Topic', 'Anything goes', 'COMMUNITY', NULL, 9),
('yomikaze', 'Yomikaze', 'Yomikaze project discussion', 'PROJECT', (SELECT id FROM projects WHERE slug='yomikaze'), 10),
('pinoytools', 'PinoyTools', 'PinoyTools project discussion', 'PROJECT', (SELECT id FROM projects WHERE slug='pinoytools'), 11),
('pinoysofthub', 'PinoySoftHub', 'PinoySoftHub project discussion', 'PROJECT', (SELECT id FROM projects WHERE slug='pinoysofthub'), 12),
('pcvault', 'PCVault', 'PCVault project discussion', 'PROJECT', (SELECT id FROM projects WHERE slug='pcvault'), 13),
('ai-and-tools', 'AI & Tools', 'AI & Tools project discussion', 'PROJECT', (SELECT id FROM projects WHERE slug='ai-and-tools'), 14),
('tinda-pos', 'TINDA POS', 'TINDA POS project discussion', 'PROJECT', (SELECT id FROM projects WHERE slug='tinda-pos'), 15);
