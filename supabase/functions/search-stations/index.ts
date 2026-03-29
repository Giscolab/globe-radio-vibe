import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_QUERY_LENGTH = 200;
const MAX_RESULTS_LIMIT = 50;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "avec",
  "by",
  "de",
  "des",
  "du",
  "for",
  "fm",
  "in",
  "la",
  "le",
  "les",
  "music",
  "of",
  "radio",
  "station",
  "stations",
  "the",
  "to",
  "une",
]);
const GENRE_KEYWORDS = [
  "acoustic",
  "ambient",
  "blues",
  "classical",
  "country",
  "dance",
  "drum and bass",
  "dub",
  "edm",
  "electro",
  "electronic",
  "folk",
  "funk",
  "hip hop",
  "house",
  "indie",
  "jazz",
  "latin",
  "lofi",
  "metal",
  "news",
  "pop",
  "r&b",
  "rap",
  "reggae",
  "rock",
  "soul",
  "talk",
  "techno",
  "trance",
];
const MOOD_KEYWORDS = [
  "calm",
  "chill",
  "dark",
  "energetic",
  "focus",
  "late night",
  "night",
  "party",
  "peaceful",
  "relax",
  "relaxing",
  "smooth",
  "soft",
  "study",
  "upbeat",
];
const LANGUAGE_KEYWORDS = [
  "arabic",
  "english",
  "french",
  "german",
  "hindi",
  "italian",
  "japanese",
  "portuguese",
  "spanish",
];
const REGION_KEYWORDS = [
  "africa",
  "asia",
  "brazil",
  "canada",
  "europe",
  "france",
  "germany",
  "india",
  "italy",
  "japan",
  "latin america",
  "morocco",
  "spain",
  "uk",
  "usa",
];
const QUALITY_KEYWORDS = ["128kbps", "320kbps", "aac", "flac", "hd", "high quality", "lossless"];

interface SearchRequest {
  query: string;
  limit?: number;
  ambience?: string;
}

interface SearchFeatures {
  genres: string[];
  moods: string[];
  regions: string[];
  languages: string[];
  quality: string | null;
  keywords: string[];
}

function sanitizeInput(input: string): string {
  const withoutControlChars = Array.from(input)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");

  return withoutControlChars.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

function normalizeInput(input: string): string {
  return sanitizeInput(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function collectMatches(normalizedInput: string, dictionary: string[]): string[] {
  return dictionary.filter((keyword) => normalizedInput.includes(keyword));
}

function extractFeatures(searchText: string): SearchFeatures {
  const normalizedInput = normalizeInput(searchText);
  const keywords = dedupe(
    normalizedInput
      .split(/[^a-z0-9&+]+/)
      .map((token) => token.trim())
      .filter((token) => token && !STOP_WORDS.has(token))
  ).slice(0, 12);

  return {
    genres: collectMatches(normalizedInput, GENRE_KEYWORDS),
    moods: collectMatches(normalizedInput, MOOD_KEYWORDS),
    regions: collectMatches(normalizedInput, REGION_KEYWORDS),
    languages: collectMatches(normalizedInput, LANGUAGE_KEYWORDS),
    quality: collectMatches(normalizedInput, QUALITY_KEYWORDS)[0] ?? null,
    keywords,
  };
}

function buildSearchTerms(features: SearchFeatures): string[] {
  return dedupe([
    ...features.genres,
    ...features.moods,
    ...features.regions,
    ...features.languages,
    ...(features.quality ? [features.quality] : []),
    ...features.keywords,
  ]);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error("Supabase environment is incomplete");
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query, limit = 20, ambience } = (await req.json()) as SearchRequest;

    if (!query && !ambience) {
      return new Response(JSON.stringify({ error: "Query or ambience required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawInput = ambience || query || "";
    if (rawInput.length > MAX_QUERY_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Query too long (max ${MAX_QUERY_LENGTH} chars)` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const sanitizedInput = sanitizeInput(rawInput);
    if (!sanitizedInput) {
      return new Response(JSON.stringify({ error: "Invalid query" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const searchText = ambience
      ? `${sanitizedInput} music radio station atmosphere`
      : sanitizedInput;
    const features = extractFeatures(searchText);
    const searchTerms = buildSearchTerms(features);
    const safeLimit = Math.min(Math.max(limit, 1), MAX_RESULTS_LIMIT);

    console.log(`[search-stations] User ${user.id} searching for: "${searchText}"`);
    console.log("[search-stations] Extracted features:", features);

    const { data: embeddings, error: embError } = await supabase
      .from("station_embeddings")
      .select("id, descriptor")
      .limit(200);

    if (embError) {
      console.error("[search-stations] DB error:", embError);
      throw embError;
    }

    if (!embeddings || embeddings.length === 0) {
      return new Response(JSON.stringify({ results: [], features }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scored = embeddings
      .map((embedding) => {
        const descriptor = embedding.descriptor.toLowerCase();
        let score = 0;

        for (const term of searchTerms) {
          if (descriptor.includes(term)) {
            score += 1;
          }
        }

        for (const genre of features.genres) {
          if (descriptor.includes(genre.toLowerCase())) {
            score += 2;
          }
        }

        for (const mood of features.moods) {
          if (descriptor.includes(mood.toLowerCase())) {
            score += 1.5;
          }
        }

        return { id: embedding.id, score };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, safeLimit);

    return new Response(JSON.stringify({ results: scored, features }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[search-stations] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
