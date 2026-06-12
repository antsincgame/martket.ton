// Генерация tonconnect-manifest.json с origin запроса (dev) или VITE_APP_ORIGIN (build), чтобы кошелёк не отклонял манифест.
import type { Plugin } from 'vite';
import { writeFileSync } from 'fs';
import { join } from 'path';

function buildManifestJson(origin: string): string {
  const o = origin.replace(/\/$/, '');
  return `${JSON.stringify(
    {
      url: o,
      name: 'TonForge',
      iconUrl: `${o}/app-icon.png`,
      termsOfUseUrl: `${o}/`,
      privacyPolicyUrl: `${o}/`,
    },
    null,
    2
  )}\n`;
}

export function tonconnectManifestPlugin(): Plugin {
  return {
    name: 'tonconnect-manifest',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathOnly = req.url?.split('?')[0];
        if (pathOnly !== '/tonconnect-manifest.json') {
          next();
          return;
        }
        const host = req.headers.host ?? 'localhost:8080';
        const xfProto = req.headers['x-forwarded-proto'];
        const encrypted = (req.socket as { encrypted?: boolean })?.encrypted;
        const proto = xfProto === 'https' || encrypted ? 'https' : 'http';
        const origin = `${proto}://${host}`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }
        res.end(buildManifestJson(origin));
      });
    },
    writeBundle(options) {
      const outDir = options.dir ?? 'dist';
      const origin =
        process.env.VITE_APP_ORIGIN?.replace(/\/$/, '') ||
        process.env.VITE_PUBLIC_APP_URL?.replace(/\/$/, '') ||
        'http://localhost:8080';
      writeFileSync(join(outDir, 'tonconnect-manifest.json'), buildManifestJson(origin));
    },
  };
}
