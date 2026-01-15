-- Fix RLS policy on station_embeddings table
-- The current "Service role can manage embeddings" policy uses USING(true) which allows any user to write

-- First, drop the permissive policy
DROP POLICY IF EXISTS "Service role can manage embeddings" ON public.station_embeddings;

-- Create a restrictive policy that only allows service role to write
-- Service role requests have role='service_role' in the JWT
CREATE POLICY "Service role manages embeddings"
ON public.station_embeddings
FOR ALL
USING (
  (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
)
WITH CHECK (
  (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
);

-- Keep the public SELECT policy (embeddings are not sensitive)
-- The "Anyone can read embeddings" policy already exists and is correct