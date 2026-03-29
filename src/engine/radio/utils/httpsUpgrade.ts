function isSecureRuntime(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  return window.location.protocol === 'https:';
}

// =======================
// PROXY
// =======================

function proxify(url: string): string {
  return `http://localhost:7070/?url=${encodeURIComponent(url)}`;
}

// =======================
// HTTPS UPGRADE (désactivé sauf cas trivial)
// =======================

const httpsCache = new Map<string, boolean>();

export function canUpgradeToHttps(url: string): boolean {
  if (!url || url.startsWith('https://')) {
    return true;
  }

  // Désactivation du filtrage par domaine : on laisse tout passer
  httpsCache.set(url, true);
  return true;
}

export function upgradeToHttps(url: string): string {
  if (!url || url.startsWith('https://')) {
    return url;
  }

  try {
    const urlObject = new URL(url);
    urlObject.protocol = 'https:';
    return urlObject.toString();
  } catch {
    return url;
  }
}

export function getSecureStreamUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('https://')) return url;
  if (canUpgradeToHttps(url)) return upgradeToHttps(url);
  return url;
}

// =======================
// HLS DETECTION (informative only)
// =======================

export function isHlsStream(url: string): boolean {
  if (!url) return false;
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith('.m3u8') || pathname.includes('.m3u8');
  } catch {
    return url.toLowerCase().includes('.m3u8');
  }
}

export function browserSupportsHls(): boolean {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes('safari') && !userAgent.includes('chrome');
}

// =======================
// URL BUILDER (zéro blocage)
// =======================

export function buildCandidateUrls(station: { url?: string; urlResolved?: string }): string[] {
  const rawUrls = [station.urlResolved, station.url].filter(Boolean) as string[];
  const candidates: string[] = [];
  const seen = new Set<string>();

  for (const rawUrl of rawUrls) {
    // ❌ suppression totale du filtre HLS
    // ❌ suppression totale du filtre HTTP
    // ❌ suppression totale du filtrage par domaine

    const candidate = getSecureStreamUrl(rawUrl);
    if (seen.has(candidate)) continue;

    candidates.push(candidate);
    seen.add(candidate);
  }

  // 100% des URLs passent dans le proxy
  return candidates.map(proxify);
}

// =======================
// PROXY REQUIREMENT (toujours vrai)
// =======================

export function needsProxy(url: string): boolean {
  return true;
}
