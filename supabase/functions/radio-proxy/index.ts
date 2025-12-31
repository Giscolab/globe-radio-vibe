// supabase/functions/radio-proxy/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import RadioBrowser from "npm:radio-browser";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "topclick";
    const countryCode = url.searchParams.get("countrycode");
    const name = url.searchParams.get("name");
    const tag = url.searchParams.get("tag");
    const limit = Number(url.searchParams.get("limit") || 100);
    const offset = Number(url.searchParams.get("offset") || 0);

    // Initialise le client RadioBrowser (choix automatique du serveur)
    await RadioBrowser.init();

    let stations = [];

    switch (action) {
      case "bycountry":
        if (!countryCode) {
          return new Response(JSON.stringify({ error: "countrycode required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        stations = await RadioBrowser.getStations({
          by: "countrycode",
          searchterm: countryCode,
          limit,
          offset,
          hidebroken: true,
          order: "clickcount",
          reverse: true,
        });
        break;

      case "search":
        stations = await RadioBrowser.searchStations({
          name,
          tag,
          countrycode: countryCode,
          limit,
          offset,
          hidebroken: true,
          order: "clickcount",
          reverse: true,
        });
        break;

      case "topclick":
        stations = await RadioBrowser.getStations({
          by: "topclick",
          limit,
        });
        break;

      case "topvote":
        stations = await RadioBrowser.getStations({
          by: "topvote",
          limit,
        });
        break;

      case "byuuid":
        const uuid = url.searchParams.get("uuid");
        if (!uuid) {
          return new Response(JSON.stringify({ error: "uuid required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        stations = await RadioBrowser.getStations({
          by: "uuid",
          searchterm: uuid,
        });
        break;

      default:
        stations = await RadioBrowser.getStations({
          by: "topclick",
          limit: 100,
        });
    }

    return new Response(JSON.stringify(stations), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("[radio-proxy] ERROR:", err);
    return new Response(JSON.stringify({ error: err.message || "Proxy error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
