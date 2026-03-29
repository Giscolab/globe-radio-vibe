import type { ViteDevServer } from 'vite';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const PROXY_TIMEOUT_MS = 8000;
const FALLBACK_IMAGE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180" fill="none">
  <rect width="180" height="180" rx="24" fill="#1f2937"/>
  <circle cx="90" cy="90" r="52" fill="#111827"/>
  <circle cx="90" cy="90" r="34" fill="#4b5563"/>
  <rect x="122" y="44" width="12" height="44" rx="6" fill="#9ca3af"/>
  <circle cx="128" cy="38" r="14" fill="#d1d5db"/>
</svg>`;

function sendFallbackImage(res: Parameters<ViteDevServer['middlewares']['use']>[1], reason?: string) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (reason) {
    res.setHeader('X-Proxy-Fallback', reason);
  }
  res.end(FALLBACK_IMAGE_SVG);
}

export function registerImageProxy(server: ViteDevServer) {
  server.middlewares.use('/api/image-proxy', async (req, res) => {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.end('Method not allowed');
      return;
    }

    const requestUrl = new URL(req.url ?? '', 'http://localhost');
    const target = requestUrl.searchParams.get('url');

    if (!target) {
      res.statusCode = 400;
      res.end('Missing url parameter');
      return;
    }

    let remoteUrl: URL;
    try {
      remoteUrl = new URL(target);
    } catch {
      res.statusCode = 400;
      res.end('Invalid url');
      return;
    }

    if (!ALLOWED_PROTOCOLS.has(remoteUrl.protocol)) {
      res.statusCode = 400;
      res.end('Unsupported protocol');
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    try {
      const response = await fetch(remoteUrl.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'radio-image-proxy',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'fr,en;q=0.8',
          Referer: remoteUrl.origin,
        }
      });

      if (!response.ok) {
        sendFallbackImage(res, `upstream-${response.status}`);
        return;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.startsWith('image/')) {
        sendFallbackImage(res, 'unsupported-media-type');
        return;
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(buffer);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        sendFallbackImage(res, 'upstream-timeout');
        return;
      }

      sendFallbackImage(res, 'upstream-error');
    } finally {
      clearTimeout(timeoutId);
    }
  });
}
