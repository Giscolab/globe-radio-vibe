const explicitImageProxyUrl = import.meta.env.VITE_IMAGE_PROXY_URL?.trim();

export const IMAGE_PROXY_URL =
  explicitImageProxyUrl || (import.meta.env.DEV ? '/api/image-proxy' : '');
