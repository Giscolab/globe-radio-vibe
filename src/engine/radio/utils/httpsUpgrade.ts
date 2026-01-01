// Utility - HTTPS Upgrade and Proxy URL generation for audio streams

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Comprehensive list of domains known to support HTTPS
 * Organized by region/type for maintainability
 */
const HTTPS_COMPATIBLE_DOMAINS = [
  // === European Public Broadcasters ===
  // France
  'radiofrance.fr', 'icecast.radiofrance.fr', 'stream.radiofrance.fr',
  'nrj.fr', 'stream.nrj.fr', 'cdn.nrjaudio.fm',
  'skyrock.fm', 'stream.skyrock.com',
  'funradio.fr', 'rtl.fr', 'rtl2.fr', 'rfi.fr',
  'stream.rfi.fr', 'europe1.fr', 'rmc.bfmtv.com',
  
  // Germany
  'swr.de', 'br.de', 'ndr.de', 'wdr.de', 'mdr.de', 'hr.de', 'sr.de',
  'rbb-online.de', 'deutschlandradio.de', 'dlf.de', 'sslstream.dlf.de',
  'rndfnk.com', 'laut.fm', 'stream.laut.fm',
  
  // UK
  'bbc.co.uk', 'bbcmedia.co.uk', 'as-hls-ww-live.akamaized.net',
  'stream.live.vc.bbcmedia.co.uk', 'classicfm.com', 'absoluteradio.co.uk',
  'planetradio.co.uk', 'radiox.co.uk', 'capital.co.uk', 'heart.co.uk',
  
  // Austria, Switzerland, Netherlands
  'orf.at', 'stream.orf.at', 'srf.ch', 'stream.srg-ssr.ch',
  'npo.nl', 'icecast.omroep.nl',
  
  // Italy, Spain, Portugal
  'rai.it', 'stream.rai.it', 'rtve.es', 'rtp.pt', 'stream.rtp.pt',
  
  // Belgium, Nordic
  'rtbf.be', 'vrt.be', 'dr.dk', 'nrk.no', 'svt.se', 'yle.fi',
  
  // Eastern Europe
  'polskieradio.pl', 'rozhlas.cz', 'rtvs.sk',
  
  // === North American Broadcasters ===
  'npr.org', 'stream.npr.org', 'kqed.org',
  'cbc.ca', 'streaming.cbc.ca',
  
  // === Global CDN and Streaming Platforms ===
  // Akamai
  'akamaized.net', 'akamaihd.net', 'akamai.net',
  
  // AWS/Cloudfront
  'cloudfront.net', 'amazonaws.com',
  
  // Fastly
  'fastly.net', 'fastlylb.net',
  
  // iHeartRadio / StreamTheWorld
  'streamtheworld.com', 'iheart.com', 'ihrcloud.com',
  'playerservices.streamtheworld.com',
  
  // TuneIn
  'tunein.com', 'stream.tunein.com',
  
  // Triton Digital
  'tritoncontent.com', 'tritondigital.com',
  
  // === Streaming Hosts and Platforms ===
  'shoutcast.com', 'stream.shoutcast.com',
  'icecast.org',
  'live365.com', 'streaming.live365.com',
  'radionomy.com', 'stream.radionomy.com',
  'azuracast.com',
  'radiojar.com',
  'caster.fm', 'streams.caster.fm',
  'securenetsystems.net',
  'zeno.fm', 'stream.zeno.fm',
  'streamerr.co',
  'myradiostream.com',
  'listen2myradio.com',
  
  // === Radio Network Aggregators ===
  'radio.de', 'stream.radio.de',
  'radio.net',
  'radio.garden',
  'onlineradiobox.com',
  
  // === International Broadcasters ===
  // Asia
  'radiko.jp', 'jcbasimul.com', 'nhk.or.jp',
  
  // Australia/NZ
  'abc.net.au', 'stream.abc.net.au', 'sbs.com.au', 'rnz.co.nz',
  
  // Latin America
  'rfrancais.com', 'dw.com', 'stream.dw.com',
  
  // === Additional Known HTTPS Streams ===
  'radioparadise.com', 'stream.radioparadise.com',
  'somafm.com', 'ice.somafm.com',
  'di.fm', 'listen.di.fm',
  'jazzradio.com', 'classicalradio.com', 'rockradio.com',
  'zenolive.com', 'streamingv2.shoutcast.com',
  'securestreams.net', 'ssl-proxy.icastcenter.com',
  'audio-edge.spotify.com', 'audio.dotphoto.com',
];

// Cache for URL checks to avoid repeated parsing
const httpsCache = new Map<string, boolean>();

/**
 * Check if a domain is known to support HTTPS
 */
export function canUpgradeToHttps(url: string): boolean {
  if (!url || url.startsWith('https://')) return true;
  
  const cached = httpsCache.get(url);
  if (cached !== undefined) return cached;
  
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const canUpgrade = HTTPS_COMPATIBLE_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
    httpsCache.set(url, canUpgrade);
    return canUpgrade;
  } catch {
    return false;
  }
}

/**
 * Upgrade HTTP URL to HTTPS
 */
export function upgradeToHttps(url: string): string {
  if (!url || url.startsWith('https://')) return url;
  
  try {
    const urlObj = new URL(url);
    urlObj.protocol = 'https:';
    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * Get a secure playable URL for a stream
 * - Returns original if already HTTPS
 * - Upgrades to HTTPS if domain supports it
 * - Returns proxy URL for HTTP-only streams
 */
export function getSecureStreamUrl(url: string): string {
  if (!url) return url;
  
  // Already secure
  if (url.startsWith('https://')) {
    return url;
  }
  
  // Try HTTPS upgrade for known domains
  if (canUpgradeToHttps(url)) {
    return upgradeToHttps(url);
  }
  
  // Use proxy for HTTP-only streams
  return buildProxyUrl(url);
}

/**
 * Build the audio proxy URL
 */
export function buildProxyUrl(streamUrl: string): string {
  if (!SUPABASE_URL) {
    console.warn('[httpsUpgrade] SUPABASE_URL not set, cannot build proxy URL');
    return streamUrl;
  }
  
  const encodedUrl = encodeURIComponent(streamUrl);
  return `${SUPABASE_URL}/functions/v1/audio-stream-proxy?url=${encodedUrl}`;
}

/**
 * Check if a URL needs proxying
 */
export function needsProxy(url: string): boolean {
  if (!url || url.startsWith('https://')) return false;
  return !canUpgradeToHttps(url);
}

/**
 * Clear the HTTPS cache (useful for testing)
 */
export function clearHttpsCache(): void {
  httpsCache.clear();
}
