import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  query: string;
  limit?: number;
  ambience?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, limit = 20, ambience } = await req.json() as SearchRequest;
    
    if (!query && !ambience) {
      return new Response(
        JSON.stringify({ error: 'Query or ambience required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build search prompt based on query type
    const searchText = ambience 
      ? `${ambience} music radio station atmosphere`
      : query;

    console.log(`[search-stations] Searching for: "${searchText}"`);

    // Generate embedding for the search query using Lovable AI
    const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a radio station search assistant. Given a search query, extract the key semantic features and return them as a normalized description. Focus on: genre, mood, tempo, style, region, language. Be concise.`
          },
          {
            role: 'user',
            content: `Analyze this search query for radio stations: "${searchText}". Return a semantic description suitable for matching against station descriptions.`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_search_features',
            description: 'Extract semantic features from the search query',
            parameters: {
              type: 'object',
              properties: {
                genres: { type: 'array', items: { type: 'string' }, description: 'Music genres mentioned or implied' },
                moods: { type: 'array', items: { type: 'string' }, description: 'Mood/atmosphere keywords' },
                regions: { type: 'array', items: { type: 'string' }, description: 'Geographic regions or countries' },
                languages: { type: 'array', items: { type: 'string' }, description: 'Languages mentioned' },
                quality: { type: 'string', description: 'Quality preference if mentioned' },
                keywords: { type: 'array', items: { type: 'string' }, description: 'Other relevant keywords' }
              },
              required: ['genres', 'moods', 'keywords']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_search_features' } }
      }),
    });

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error(`[search-stations] AI error: ${embeddingResponse.status} - ${errorText}`);
      
      if (embeddingResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (embeddingResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Usage limit reached. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('AI gateway error');
    }

    const aiResult = await embeddingResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.error('[search-stations] No tool call in AI response');
      throw new Error('Invalid AI response');
    }

    const features = JSON.parse(toolCall.function.arguments);
    console.log(`[search-stations] Extracted features:`, features);

    // Build search terms from extracted features
    const searchTerms = [
      ...features.genres,
      ...features.moods,
      ...(features.regions || []),
      ...(features.languages || []),
      features.quality,
      ...features.keywords
    ].filter(Boolean).map(t => t.toLowerCase());

    // Search embeddings table using text matching on descriptor
    const { data: embeddings, error: embError } = await supabase
      .from('station_embeddings')
      .select('id, descriptor')
      .limit(200);

    if (embError) {
      console.error('[search-stations] DB error:', embError);
      throw embError;
    }

    if (!embeddings || embeddings.length === 0) {
      console.log('[search-stations] No embeddings found, returning empty results');
      return new Response(
        JSON.stringify({ results: [], features }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Score each station based on term matches
    const scored = embeddings.map(emb => {
      const desc = emb.descriptor.toLowerCase();
      let score = 0;
      
      for (const term of searchTerms) {
        if (desc.includes(term)) {
          score += 1;
        }
      }
      
      // Boost for genre matches (more important)
      for (const genre of features.genres) {
        if (desc.includes(genre.toLowerCase())) {
          score += 2;
        }
      }
      
      // Boost for mood matches
      for (const mood of features.moods) {
        if (desc.includes(mood.toLowerCase())) {
          score += 1.5;
        }
      }
      
      return { id: emb.id, score };
    });

    // Sort by score and take top results
    const results = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => ({ id: s.id, score: s.score }));

    console.log(`[search-stations] Found ${results.length} matching stations`);

    return new Response(
      JSON.stringify({ results, features }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[search-stations] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
