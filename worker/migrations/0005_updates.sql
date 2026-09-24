-- v1.0.38-era official updates (2026-09-24): refresh release posts to current
-- real versions; unpin stale TINDA POS v1.0.2/v1.0.4; add Web + Android releases.

-- 1. Unpin stale TINDA POS release posts (now superseded by v1.0.27)
UPDATE project_updates SET pinned = 0
WHERE project_id = (SELECT id FROM projects WHERE slug = 'tinda-pos')
  AND title LIKE 'TINDA POS v1.0.2%';

UPDATE project_updates SET pinned = 0
WHERE project_id = (SELECT id FROM projects WHERE slug = 'tinda-pos')
  AND title LIKE 'TINDA POS v1.0.4%';

-- 2. TINDA POS v1.0.27 — TINDA BANTAY complete 172-item market catalog
INSERT INTO project_updates (project_id, author_id, version, title, body, update_type, changelog, pinned, github_url)
SELECT p.id, (SELECT id FROM users WHERE role = 'OWNER' ORDER BY id LIMIT 1), '1.0.27',
  'TINDA POS v1.0.27 — TINDA BANTAY: Complete 172-Item Market Catalog',
  'TINDA POS v1.0.27 Stable is out — the complete 172-item Philippine grocery & sari-sari store market price catalog across all 12 key retail categories, built in as a 100% offline seed and synced in real time from the live GitHub feed.\n\n• 172 staple commodities: instant noodles, canned fish & meat, dairy, coffee, cooking oil, seasonings, snacks, personal care, laundry, rice & sugar, liquor & tobacco\n• Offline-first: full catalog works with zero internet on fresh installs\n• Real-time online sync from the live price catalog feed\n• Powered by the upgraded TINDA SCOUT harvester (Scrapling v0.4.15)\n\nSeamless auto-update from v1.0.19 through v1.0.26. Download Setup / Portable editions from the GitHub release.',
  'RELEASE', '["172-item market price catalog bundled offline","Real-time catalog sync from live GitHub feed","TINDA SCOUT harvester upgraded to Scrapling v0.4.15"]', 1, 'https://github.com/Yazerukun/TINDA-POS/releases/tag/v1.0.27'
FROM projects p WHERE p.slug = 'tinda-pos'
AND NOT EXISTS (SELECT 1 FROM project_updates u WHERE u.project_id = p.id AND u.version = '1.0.27');

-- 3. TINDA POS Web v1.0.1 — live on the browser
INSERT INTO project_updates (project_id, author_id, version, title, body, update_type, changelog, pinned, live_url, github_url)
SELECT p.id, (SELECT id FROM users WHERE role = 'OWNER' ORDER BY id LIMIT 1), '1.0.1',
  'TINDA POS Web v1.0.1 — now live in your browser',
  'TINDA POS Web is live — the fast, 100% offline, sign-language & touch-friendly Point of Sale and Inventory System for Philippine sari-sari stores, built for any browser (Desktop, iPad, Tablet, Mobile).\n\n• 100% offline storage (Dexie) — no internet required at the counter\n• Sign-language and touch-friendly checkout designed for retail counters\n• Runs anywhere: desktop browsers, iPad, tablets, phones\n\nTry it now at tindapos-web.pages.dev.',
  'RELEASE', '["100% offline (Dexie v4)","Touch & sign-language friendly counter","Cloudflare Pages edge deployment"]', 1, 'https://tindapos-web.pages.dev', 'https://github.com/Yazerukun/TINDA-POS-Web'
FROM projects p WHERE p.slug = 'tinda-pos-web'
AND NOT EXISTS (SELECT 1 FROM project_updates u WHERE u.project_id = p.id AND u.version = '1.0.1');

-- 4. TINDA POS Android Free v1.0.38 — dual photo mode
INSERT INTO project_updates (project_id, author_id, version, title, body, update_type, changelog, pinned, github_url)
SELECT p.id, (SELECT id FROM users WHERE role = 'OWNER' ORDER BY id LIMIT 1), '1.0.38',
  'TINDA POS Android v1.0.38 — Dual Photo Mode & fast counter thumbnails',
  'TINDA POS Free for Android v1.0.38 Stable is out — the 100% offline, sign-language-friendly POS for Philippine sari-sari stores on Android phones and tablets.\n\n• Dual Photo Mode: add product photos via camera capture or from your gallery (Google Photos / file manager)\n• Auto-compression on-device (up to 320×320px, ~15–30KB) — zero lag, zero database bloat\n• Product thumbnails on the POS grid and Inventory tables for rapid ring-ups\n• 100% offline Dexie storage with photos included in `.tinda-backup` exports\n\nDownload the APK from the GitHub release, or update via the in-app updater.',
  'RELEASE', '["Dual Photo Mode: camera + gallery upload","Client-side auto-compression (320x320, WebP/JPEG)","POS grid & inventory thumbnails","Photos included in .tinda-backup"]', 1, 'https://github.com/Yazerukun/TINDA-POS-Android-Free/releases/tag/v1.0.38'
FROM projects p WHERE p.slug = 'tinda-pos-android'
AND NOT EXISTS (SELECT 1 FROM project_updates u WHERE u.project_id = p.id AND u.version = '1.0.38');