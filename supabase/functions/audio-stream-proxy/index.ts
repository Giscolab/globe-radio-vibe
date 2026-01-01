// Edge Function - Audio Stream Proxy
// Proxies HTTP audio streams via HTTPS to resolve mixed content and CORS issues

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Type, Content-Length, Accept-Ranges, Content-Range, X-Proxied-From',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const streamUrl = url.searchParams.get('url');

  if (!streamUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(streamUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid URL' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(`[audio-stream-proxy] Proxying: ${streamUrl}`);

  try {
    // Forward range header for seeking support
    const headers: HeadersInit = {
      'User-Agent': 'GlobeRadioProxy/1.0',
      'Accept': '*/*',
    };

    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    // Fetch the stream with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response: Response;

    // HEAD requests are used by health checks; some streams don't support HEAD,
    // so we fall back to a minimal GET with Range.
    if (req.method === 'HEAD') {
      try {
        response = await fetch(streamUrl, {
          method: 'HEAD',
          headers,
          signal: controller.signal,
        });
      } catch {
        response = await fetch(streamUrl, {
          method: 'GET',
          headers: { ...headers, Range: headers['Range'] ?? 'bytes=0-0' },
          signal: controller.signal,
        });
      }
    } else {
      response = await fetch(streamUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
    }

    clearTimeout(timeoutId);

    if (!response.ok && response.status !== 206) {
      console.error(`[audio-stream-proxy] Upstream error: ${response.status}`);
      return new Response(JSON.stringify({ error: `Upstream error: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get content type from response or infer from URL
    let contentType = response.headers.get('content-type') || 'audio/mpeg';
    
    // Ensure it's recognized as audio
    if (!contentType.startsWith('audio/') && !contentType.includes('application/octet-stream')) {
      const ext = parsedUrl.pathname.split('.').pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        'mp3': 'audio/mpeg',
        'aac': 'audio/aac',
        'ogg': 'audio/ogg',
        'opus': 'audio/opus',
        'flac': 'audio/flac',
        'm4a': 'audio/mp4',
      };
      contentType = mimeMap[ext || ''] || 'audio/mpeg';
    }

    // Build response headers
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store',
      'X-Proxied-From': parsedUrl.hostname,
    };

    // Forward content-length if available
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength;
    }

    // Forward accept-ranges
    const acceptRanges = response.headers.get('accept-ranges');
    if (acceptRanges) {
      responseHeaders['Accept-Ranges'] = acceptRanges;
    }

    // Forward content-range for partial content
    const contentRange = response.headers.get('content-range');
    if (contentRange) {
      responseHeaders['Content-Range'] = contentRange;
    }

    // For HEAD requests, return headers only (no body)
    if (req.method === 'HEAD') {
      return new Response(null, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Stream the response body
    console.log(`[audio-stream-proxy] Streaming ${contentType} from ${parsedUrl.hostname}`);

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[audio-stream-proxy] Error: ${message}`);
    
    if (message.includes('aborted')) {
      return new Response(JSON.stringify({ error: 'Request timeout' }), {
        status: 504,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
