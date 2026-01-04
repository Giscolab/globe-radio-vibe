import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  stations: Array<{
    id: string;
    descriptor: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json() as Partial<SyncRequest>;
    const stations = payload.stations ?? [];
    
    if (!Array.isArray(stations) || stations.length === 0) {
      return new Response(
        JSON.stringify({ error: 'stations array required (build from stationRepository.getAll())' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-embeddings] Syncing ${stations.length} stations`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get existing embeddings
    const { data: existing } = await supabase
      .from('station_embeddings')
      .select('id');

    const existingIds = new Set(existing?.map(e => e.id) || []);
    
    // Filter to only new stations
    const newStations = stations.filter(s => !existingIds.has(s.id));
    
    if (newStations.length === 0) {
      console.log('[sync-embeddings] No new stations to sync');
      return new Response(
        JSON.stringify({ synced: 0, total: stations.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-embeddings] Inserting ${newStations.length} new stations`);

    // Insert in batches of 100
    const BATCH_SIZE = 100;
    let synced = 0;

    for (let i = 0; i < newStations.length; i += BATCH_SIZE) {
      const batch = newStations.slice(i, i + BATCH_SIZE);
      
      const { error } = await supabase
        .from('station_embeddings')
        .upsert(
          batch.map(s => ({
            id: s.id,
            descriptor: s.descriptor,
            updated_at: new Date().toISOString()
          })),
          { onConflict: 'id' }
        );

      if (error) {
        console.error(`[sync-embeddings] Batch error:`, error);
      } else {
        synced += batch.length;
      }
    }

    console.log(`[sync-embeddings] Synced ${synced}/${newStations.length} new stations`);

    return new Response(
      JSON.stringify({ synced, total: stations.length, existing: existingIds.size }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-embeddings] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
