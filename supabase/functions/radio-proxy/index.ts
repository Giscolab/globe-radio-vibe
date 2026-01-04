import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  // --- CORS PRE-FLIGHT ---
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: {
        ...corsHeaders,
      },
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

    const upstream = await fetch(`https://all.api.radio-browser.info${apiPath}`, {
      headers: { "User-Agent": "RadioGlobe/1.0" },
    });

    const data = await upstream.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
