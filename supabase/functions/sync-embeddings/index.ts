import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_STATIONS_PER_REQUEST = 500;
const MAX_DESCRIPTOR_LENGTH = 500;

interface SyncRequest {
  stations: Array<{
    id: string;
    descriptor: string;
  }>;
}

// Validate UUID format
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// Sanitize descriptor
function sanitizeDescriptor(descriptor: string): string {
  return descriptor
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim()
    .slice(0, MAX_DESCRIPTOR_LENGTH);
}

serve(async (req) => {
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
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

    const payload = await req.json() as Partial<SyncRequest>;
    const stations = payload.stations ?? [];
    
    if (!Array.isArray(stations) || stations.length === 0) {
      return new Response(
        JSON.stringify({ error: 'stations array required (build from stationRepository.getAll())' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit the number of stations per request
    if (stations.length > MAX_STATIONS_PER_REQUEST) {
      return new Response(
        JSON.stringify({ error: `Too many stations (max ${MAX_STATIONS_PER_REQUEST} per request)` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and sanitize stations
    const validStations = stations
      .filter(s => s && typeof s.id === 'string' && typeof s.descriptor === 'string')
      .filter(s => isValidUUID(s.id))
      .map(s => ({
        id: s.id,
        descriptor: sanitizeDescriptor(s.descriptor)
      }))
      .filter(s => s.descriptor.length > 0);

    if (validStations.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid stations provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-embeddings] User ${user.id} syncing ${validStations.length} stations`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get existing embeddings
    const { data: existing } = await supabase
      .from('station_embeddings')
      .select('id');

    const existingIds = new Set(existing?.map(e => e.id) || []);
    
    // Filter to only new stations
    const newStations = validStations.filter(s => !existingIds.has(s.id));
    
    if (newStations.length === 0) {
      console.log('[sync-embeddings] No new stations to sync');
      return new Response(
        JSON.stringify({ synced: 0, total: validStations.length }),
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
      JSON.stringify({ synced, total: validStations.length, existing: existingIds.size }),
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
