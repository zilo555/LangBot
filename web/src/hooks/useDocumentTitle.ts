import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const APP_NAME = 'LangBot';

// Map a route path to the i18n key used for its document title. Detail routes
// reuse the section key (e.g. /home/bots and any future /home/bots/:id both
// resolve to bots.title). Reuses existing translation keys so titles stay in
// sync with the sidebar and page headers across all locales.
const ROUTE_TITLE_KEYS: { match: (path: string) => boolean; key: string }[] = [
  { match: (p) => p === '/login', key: 'common.login' },
  { match: (p) => p === '/register', key: 'register.title' },
  { match: (p) => p === '/reset-password', key: 'resetPassword.title' },
  { match: (p) => p === '/wizard', key: 'sidebar.quickStart' },
  { match: (p) => p.startsWith('/home/monitoring'), key: 'monitoring.title' },
  { match: (p) => p.startsWith('/home/bots'), key: 'bots.title' },
  { match: (p) => p.startsWith('/home/pipelines'), key: 'pipelines.title' },
  {
    match: (p) => p.startsWith('/home/add-extension'),
    key: 'sidebar.addExtension',
  },
  { match: (p) => p.startsWith('/home/extensions'), key: 'plugins.title' },
  { match: (p) => p.startsWith('/home/mcp'), key: 'mcp.title' },
  { match: (p) => p.startsWith('/home/knowledge'), key: 'knowledge.title' },
  { match: (p) => p.startsWith('/home/skills'), key: 'skills.title' },
  {
    match: (p) => p.startsWith('/home/plugin-pages'),
    key: 'sidebar.pluginPages',
  },
  // /home (and anything else under it) falls back to the dashboard.
  { match: (p) => p.startsWith('/home'), key: 'monitoring.title' },
];

/**
 * Keeps document.title in sync with the current route, formatted as
 * "<page> · LangBot". On routes with no specific mapping (or before i18n is
 * ready) it falls back to the bare app name. Re-runs on navigation and on
 * language change so the title is always localized.
 */
export function useDocumentTitle() {
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const entry = ROUTE_TITLE_KEYS.find((e) => e.match(pathname));
    if (!entry) {
      document.title = APP_NAME;
      return;
    }
    const pageName = t(entry.key);
    // Guard against an unresolved key (returns the key itself) leaking into the
    // title; fall back to the bare app name in that case.
    document.title =
      pageName && pageName !== entry.key
        ? `${pageName} · ${APP_NAME}`
        : APP_NAME;
  }, [pathname, t, i18n.language]);
}
