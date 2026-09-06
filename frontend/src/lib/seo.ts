const DEFAULT_TITLE = 'PH Project Hub — Project Updates & Community Chat';
const DEFAULT_DESCRIPTION =
  'PH Project Hub is the community hub for Filipino builders. Explore projects, get release updates, and chat with fellow builders.';

function setHeadContent(selector: string, content: string | null) {
  const el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) return;
  if (content) {
    el.setAttribute('content', content);
  } else {
    el.remove();
  }
}

/**
 * Updates the browser tab title and description meta tags for dynamic routes.
 * Additive only — it never touches canonical/OG/twitter tags.
 */
export function applyPageMeta(title: string, description?: string) {
  document.title = title || DEFAULT_TITLE;
  if (description) {
    setHeadContent('meta[name="description"]', description);
    setHeadContent('meta[property="og:description"]', description);
  }
}

export function resetPageMeta() {
  document.title = DEFAULT_TITLE;
  setHeadContent('meta[name="description"]', DEFAULT_DESCRIPTION);
  setHeadContent('meta[property="og:description"]', DEFAULT_DESCRIPTION);
}