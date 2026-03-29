import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const FALLBACK_SUPABASE_URL = 'http://127.0.0.1:54321';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'public-anon-key';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

const supabaseUrl = isSupabaseConfigured ? SUPABASE_URL : FALLBACK_SUPABASE_URL;
const supabasePublishableKey = isSupabaseConfigured
  ? SUPABASE_PUBLISHABLE_KEY
  : FALLBACK_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
