// supabase/functions/radio-proxy/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const BASE_URL = "https://all.api.radio-browser.info";

async function fetchWithRetry(path: string, retries = 3): Promise<Response> {
  const url = `${BASE_URL}${path}`;
  
  for (let i = 0; i < retries; i++) {
    console.log(`[radio-proxy] Attempt ${i + 1}: ${url}`);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "RadioGlobe/1.0" },
      });
      if (response.ok) {
        return response;
      }
      console.log(`[radio-proxy] HTTP ${response.status} on attempt ${i + 1}`);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.log(`[radio-proxy] Fetch error on attempt ${i + 1}:`, errMsg);
    }
  }
  throw new Error(`Failed after ${retries} attempts`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "topclick";
    const countryCode = url.searchParams.get("countrycode");
    const name = url.searchParams.get("name");
    const tag = url.searchParams.get("tag");
    const limit = url.searchParams.get("limit") || "100";
    const offset = url.searchParams.get("offset") || "0";

    let apiPath = "";

    switch (action) {
      case "bycountry":
        if (!countryCode) {
          return new Response(JSON.stringify({ error: "countrycode required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Use search endpoint with countrycode filter for reliability
        apiPath = `/json/stations/search?countrycode=${countryCode}&limit=${limit}&offset=${offset}&hidebroken=true&order=clickcount&reverse=true`;
        break;

      case "search": {
        const params = new URLSearchParams();
        if (name) params.set("name", name);
        if (tag) params.set("tag", tag);
        if (countryCode) params.set("countrycode", countryCode);
        params.set("limit", limit);
        params.set("offset", offset);
        params.set("hidebroken", "true");
        params.set("order", "clickcount");
        params.set("reverse", "true");
        apiPath = `/json/stations/search?${params.toString()}`;
        break;
      }

      case "topclick":
        apiPath = `/json/stations/topclick/${limit}`;
        break;

      case "topvote":
        apiPath = `/json/stations/topvote/${limit}`;
        break;

      case "byuuid": {
        const uuid = url.searchParams.get("uuid");
        if (!uuid) {
          return new Response(JSON.stringify({ error: "uuid required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        apiPath = `/json/stations/byuuid/${uuid}`;
        break;
      }

      default:
        apiPath = `/json/stations/topclick/100`;
    }

    console.log(`[radio-proxy] Fetching: ${apiPath}`);
    const response = await fetchWithRetry(apiPath);
    const stations = await response.json();
    console.log(`[radio-proxy] Success: ${stations.length} stations`);

    return new Response(JSON.stringify(stations), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Proxy error";
    console.error("[radio-proxy] Error:", errMsg);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
