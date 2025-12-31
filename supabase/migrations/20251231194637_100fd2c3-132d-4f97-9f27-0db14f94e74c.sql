-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create station_embeddings table for AI search
CREATE TABLE public.station_embeddings (
  id TEXT PRIMARY KEY,
  embedding vector(768),
  descriptor TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX station_embeddings_embedding_idx ON public.station_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable RLS
ALTER TABLE public.station_embeddings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (embeddings are not sensitive)
CREATE POLICY "Anyone can read embeddings" 
ON public.station_embeddings 
FOR SELECT 
USING (true);

-- Only backend functions can insert/update embeddings
CREATE POLICY "Service role can manage embeddings" 
ON public.station_embeddings 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_embedding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_station_embeddings_updated_at
BEFORE UPDATE ON public.station_embeddings
FOR EACH ROW
EXECUTE FUNCTION public.update_embedding_updated_at();