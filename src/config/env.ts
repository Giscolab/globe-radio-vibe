const explicitImageProxyUrl = import.meta.env.VITE_IMAGE_PROXY_URL?.trim();
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();

export const IMAGE_PROXY_URL =
  explicitImageProxyUrl ||
  (import.meta.env.DEV
    ? '/api/image-proxy'
    : supabaseUrl
      ? `${supabaseUrl}/functions/v1/image-proxy`
      : '/api/image-proxy');
