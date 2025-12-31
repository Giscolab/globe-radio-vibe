import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use the official load-balanced API
const RADIOBROWSER_BASE = 'https://all.api.radio-browser.info';

async function fetchWithRetry(endpoint: string, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const url = `${RADIOBROWSER_BASE}${endpoint}`;
    
    try {
      console.log(`[radio-proxy] Attempt ${attempt + 1}: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'GlobeRadioEngine/1.0',
        },
      });
      
      if (response.ok) {
        return response;
      }
      
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
        console.log(`[radio-proxy] Rate limited, waiting ${retryAfter}s`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error as Error;
      console.error(`[radio-proxy] Attempt ${attempt + 1} failed:`, error);
      // Wait before retry
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const countryCode = url.searchParams.get('countrycode');
    const name = url.searchParams.get('name');
    const tag = url.searchParams.get('tag');
    const limit = url.searchParams.get('limit') || '100';
    const offset = url.searchParams.get('offset') || '0';
    const order = url.searchParams.get('order') || 'clickcount';

    let endpoint = '';

    switch (action) {
      case 'bycountry':
        if (!countryCode) {
          return new Response(
            JSON.stringify({ error: 'countrycode required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        endpoint = `/json/stations/bycountrycode/${countryCode.toUpperCase()}?limit=${limit}&offset=${offset}&hidebroken=true&order=${order}&reverse=true`;
        break;

      case 'search':
        const params = new URLSearchParams();
        if (name) params.set('name', name);
        if (tag) params.set('tag', tag);
        if (countryCode) params.set('countrycode', countryCode);
        params.set('limit', limit);
        params.set('offset', offset);
        params.set('hidebroken', 'true');
        params.set('order', order);
        params.set('reverse', 'true');
        endpoint = `/json/stations/search?${params.toString()}`;
        break;

      case 'topclick':
        endpoint = `/json/stations/topclick/${limit}`;
        break;

      case 'topvote':
        endpoint = `/json/stations/topvote/${limit}`;
        break;

      case 'byuuid':
        const uuid = url.searchParams.get('uuid');
        if (!uuid) {
          return new Response(
            JSON.stringify({ error: 'uuid required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        endpoint = `/json/stations/byuuid/${uuid}`;
        break;

      default:
        // Default: get popular stations globally
        endpoint = `/json/stations/topclick/100`;
    }

    console.log(`[radio-proxy] Fetching: ${endpoint}`);
    
    const response = await fetchWithRetry(endpoint);
    const data = await response.json();
    
    console.log(`[radio-proxy] Success: ${Array.isArray(data) ? data.length : 1} stations`);

    return new Response(
      JSON.stringify(data),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300' // Cache 5 min
        } 
      }
    );

  } catch (error) {
    console.error('[radio-proxy] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Proxy error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
