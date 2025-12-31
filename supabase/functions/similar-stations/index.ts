import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SimilarRequest {
  stationId: string;
  limit?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stationId, limit = 10 } = await req.json() as SimilarRequest;
    
    if (!stationId) {
      return new Response(
        JSON.stringify({ error: 'stationId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[similar-stations] Finding stations similar to: ${stationId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the source station's descriptor
    const { data: sourceStation, error: sourceError } = await supabase
      .from('station_embeddings')
      .select('id, descriptor')
      .eq('id', stationId)
      .single();

    if (sourceError || !sourceStation) {
      console.log(`[similar-stations] Source station not found: ${stationId}`);
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract key terms from source descriptor
    const sourceTerms = sourceStation.descriptor
      .toLowerCase()
      .split(/[\s—,]+/)
      .filter((t: string) => t.length > 2);

    // Get all other stations
    const { data: allStations, error: allError } = await supabase
      .from('station_embeddings')
      .select('id, descriptor')
      .neq('id', stationId)
      .limit(500);

    if (allError) {
      console.error('[similar-stations] DB error:', allError);
      throw allError;
    }

    if (!allStations || allStations.length === 0) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Score each station by term overlap
    const scored = allStations.map(station => {
      const stationTerms = station.descriptor
        .toLowerCase()
        .split(/[\s—,]+/)
        .filter((t: string) => t.length > 2);
      
      // Count matching terms
      const matches = sourceTerms.filter((t: string) => stationTerms.includes(t)).length;
      const score = matches / Math.max(sourceTerms.length, 1);
      
      return { id: station.id, score };
    });

    // Sort by similarity and take top results
    const results = scored
      .filter(s => s.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => ({ id: s.id, score: Math.round(s.score * 100) / 100 }));

    console.log(`[similar-stations] Found ${results.length} similar stations`);

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[similar-stations] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
