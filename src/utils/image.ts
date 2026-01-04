import { IMAGE_PROXY_URL } from '@/config/env';

const passthroughPrefixes = ['data:', 'blob:', '/'];

export const proxify = (url?: string | null) => {
  if (!url) return null;
  if (passthroughPrefixes.some((prefix) => url.startsWith(prefix))) {
    return url;
  }
  if (!IMAGE_PROXY_URL) {
    return url;
  }
  return `${IMAGE_PROXY_URL}?url=${encodeURIComponent(url)}`;
};
