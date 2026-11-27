import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Link previews need absolute URLs. Netlify sets `URL` (the site's primary URL) during
 * builds; set SITE_URL to override, e.g. for a custom domain. Falls back to root-relative.
 */
function siteUrl(): Plugin {
  const url = (process.env.SITE_URL || process.env.URL || '').replace(/\/$/, '');
  return {
    name: 'site-url',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', url),
  };
}

export default defineConfig({
  plugins: [react(), siteUrl()],
  test: { include: ['src/**/*.test.ts'] },
} as never);
