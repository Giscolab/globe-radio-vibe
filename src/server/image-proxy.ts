import type { ViteDevServer } from 'vite';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const PROXY_TIMEOUT_MS = 8000;

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
          'User-Agent': 'radio-image-proxy'
        }
      });

      if (!response.ok) {
        res.statusCode = response.status;
        res.end();
        return;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.startsWith('image/')) {
        res.statusCode = 415;
        res.end('Unsupported media type');
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
        res.statusCode = 504;
        res.end('Upstream timeout');
        return;
      }

      res.statusCode = 502;
      res.end('Upstream error');
    } finally {
      clearTimeout(timeoutId);
    }
  });
}
