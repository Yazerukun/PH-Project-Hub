-- v1.0.38-era catalog refresh (2026-09-24): current versions, live/github links,
-- two new TINDA projects (Web + Android Free) with their channels.

-- 1. Refresh existing project facts to current GitHub reality
UPDATE projects SET
  version = '1.0.27',
  description = 'Offline Point-of-Sale for Philippine Sari-Sari Stores & Small Businesses. Sell products, track inventory, manage customer utang, reconcile cash — all in one focused desktop app. No internet required.',
  tech_stack = '["Electron","React","TypeScript","SQLite"]',
  github_url = 'https://github.com/Yazerukun/TINDA-POS',
  status = 'LIVE',
  updated_at = unixepoch()
WHERE slug = 'tinda-pos';

UPDATE projects SET
  github_url = 'https://github.com/Yazerukun/yomikaze',
  updated_at = unixepoch()
WHERE slug = 'yomikaze';

UPDATE projects SET
  github_url = 'https://github.com/Yazerukun/pinoysofthub',
  updated_at = unixepoch()
WHERE slug = 'pinoysofthub';

UPDATE projects SET
  github_url = 'https://github.com/Yazerukun/PCVault',
  version = '0.5.0',
  updated_at = unixepoch()
WHERE slug = 'pcvault';

-- 2. New projects: TINDA POS Web (browser, live) + TINDA POS Android Free
INSERT OR IGNORE INTO projects (slug, name, description, category, status, version, tech_stack, github_url, live_url) VALUES
('tinda-pos-web', 'TINDA POS Web', 'Fast, 100% offline, sign-language & touch-friendly Point of Sale and Inventory System for Philippine sari-sari stores on any browser (Desktop, iPad, Tablet, Mobile).', 'POS', 'LIVE', '1.0.1', '["React","TypeScript","Vite","Dexie","Cloudflare"]', 'https://github.com/Yazerukun/TINDA-POS-Web', 'https://tindapos-web.pages.dev'),
('tinda-pos-android', 'TINDA POS Android', 'TINDA POS Free for Android — fast, 100% offline, sign-language-friendly Point of Sale and Inventory System for Philippine sari-sari stores on Android phones and tablets.', 'POS', 'LIVE', '1.0.38', '["Android","TypeScript","Dexie","Capacitor"]', 'https://github.com/Yazerukun/TINDA-POS-Android-Free', NULL);

-- 3. New project channels (after tinda-pos at 15)
INSERT OR IGNORE INTO channels (slug, name, description, type, project_id, position)
SELECT 'tinda-pos-web', 'TINDA POS Web', 'TINDA POS Web project discussion', 'PROJECT', id, 16
FROM projects WHERE slug = 'tinda-pos-web';

INSERT OR IGNORE INTO channels (slug, name, description, type, project_id, position)
SELECT 'tinda-pos-android', 'TINDA POS Android', 'TINDA POS Android project discussion', 'PROJECT', id, 17
FROM projects WHERE slug = 'tinda-pos-android';