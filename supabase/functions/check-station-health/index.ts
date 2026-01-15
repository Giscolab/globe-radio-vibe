// Edge Function - Check Station Health: proxy health checks to bypass CORS
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthCheckRequest {
  urls: Array<{ id: string; url: string }>;
  timeoutMs?: number;
}

interface StationHealthResult {
  id: string;
  ok: boolean;
  latency: number | null;
  lastChecked: number;
  error?: string;
  statusCode?: number;
}

// Validate URL format and protocol
function isValidStreamUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

async function checkUrl(url: string, timeoutMs: number): Promise<Omit<StationHealthResult, 'id'>> {
  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Try HEAD first (lighter)
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'RadioGlobe/1.0 HealthCheck',
        },
      });
    } catch {
      // HEAD might not be supported, try GET with range
      response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'RadioGlobe/1.0 HealthCheck',
          'Range': 'bytes=0-0',
        },
      });
    }

    clearTimeout(timeoutId);
    const latency = Math.round(performance.now() - startTime);

    return {
      ok: response.ok || response.status === 206, // 206 = Partial Content (valid for Range requests)
      latency,
      lastChecked: Date.now(),
      statusCode: response.status,
    };

  } catch (error) {
    clearTimeout(timeoutId);
    const latency = Math.round(performance.now() - startTime);
    
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Timeout';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      ok: false,
      latency: latency < timeoutMs ? latency : null,
      lastChecked: Date.now(),
      error: errorMessage,
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Verify the user's token
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { urls, timeoutMs = 5000 }: HealthCheckRequest = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'urls array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit batch size
    const MAX_BATCH = 10;
    const urlsToCheck = urls
      .slice(0, MAX_BATCH)
      .filter(item => item && typeof item.id === 'string' && typeof item.url === 'string')
      .filter(item => isValidStreamUrl(item.url));

    if (urlsToCheck.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid URLs to check', results: [] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-station-health] User ${user.id} checking ${urlsToCheck.length} URLs`);

    // Check all URLs in parallel
    const results: StationHealthResult[] = await Promise.all(
      urlsToCheck.map(async ({ id, url }) => {
        const health = await checkUrl(url, timeoutMs);
        return { id, ...health };
      })
    );

    console.log(`[check-station-health] Completed: ${results.filter(r => r.ok).length}/${results.length} healthy`);

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-station-health] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', results: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
