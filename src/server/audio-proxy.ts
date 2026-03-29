import http from "http";
import https from "https";
import { URL } from "url";

const PORT = 7070;

function follow(streamUrl: string, res: http.ServerResponse, depth = 0) {
  if (depth > 10) {
    res.writeHead(502);
    res.end("Too many redirects");
    return;
  }

  let target: URL;
  try {
    target = new URL(streamUrl);
  } catch {
    res.writeHead(400);
    res.end("Invalid url parameter");
    return;
  }

  const client = target.protocol === "https:" ? https : http;

  const req = client.get(
    {
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      path: target.pathname + target.search,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*",
        "Connection": "keep-alive",
      },
    },
    (proxyRes) => {
      // 🔥 Correction : redirections suivies côté serveur
      if (
        proxyRes.statusCode &&
        proxyRes.statusCode >= 300 &&
        proxyRes.statusCode < 400 &&
        proxyRes.headers.location
      ) {
        const next = new URL(proxyRes.headers.location, target).toString();
        console.log("[audio-proxy] redirect →", next);
        proxyRes.resume();
        follow(next, res, depth + 1);
        return;
      }

      // 🔥 On ne renvoie JAMAIS 302 au navigateur
      res.writeHead(proxyRes.statusCode || 200, {
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Cross-Origin-Embedder-Policy": "unsafe-none",
        "Content-Type": proxyRes.headers["content-type"] || "audio/mpeg",
        "Cache-Control": "no-store",
      });

      res.socket?.setTimeout(0);
      proxyRes.pipe(res);
    }
  );

  req.on("error", (err) => {
    console.error("[audio-proxy] error:", err.message);
    if (!res.headersSent) {
      res.writeHead(502);
    }
    res.end("Proxy error");
  });
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end("Missing URL");
    return;
  }

  const incoming = new URL(req.url, "http://localhost");
  const streamUrl = incoming.searchParams.get("url");

  if (!streamUrl) {
    res.writeHead(400);
    res.end("Missing url parameter");
    return;
  }

  follow(streamUrl, res);
});

server.listen(PORT, () => {
  console.log(`[audio-proxy] listening on http://localhost:${PORT}`);
});
