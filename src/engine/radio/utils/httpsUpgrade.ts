function isSecureRuntime(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.location.protocol === 'https:';
}

const HTTPS_COMPATIBLE_DOMAINS = [
  'radiofrance.fr',
  'icecast.radiofrance.fr',
  'stream.radiofrance.fr',
  'nrj.fr',
  'stream.nrj.fr',
  'cdn.nrjaudio.fm',
  'skyrock.fm',
  'stream.skyrock.com',
  'funradio.fr',
  'rtl.fr',
  'rtl2.fr',
  'rfi.fr',
  'stream.rfi.fr',
  'europe1.fr',
  'rmc.bfmtv.com',
  'swr.de',
  'br.de',
  'ndr.de',
  'wdr.de',
  'mdr.de',
  'hr.de',
  'sr.de',
  'rbb-online.de',
  'deutschlandradio.de',
  'dlf.de',
  'sslstream.dlf.de',
  'rndfnk.com',
  'laut.fm',
  'stream.laut.fm',
  'bbc.co.uk',
  'bbcmedia.co.uk',
  'as-hls-ww-live.akamaized.net',
  'stream.live.vc.bbcmedia.co.uk',
  'classicfm.com',
  'absoluteradio.co.uk',
  'planetradio.co.uk',
  'radiox.co.uk',
  'capital.co.uk',
  'heart.co.uk',
  'orf.at',
  'stream.orf.at',
  'srf.ch',
  'stream.srg-ssr.ch',
  'npo.nl',
  'icecast.omroep.nl',
  'rai.it',
  'stream.rai.it',
  'rtve.es',
  'rtp.pt',
  'stream.rtp.pt',
  'rtbf.be',
  'vrt.be',
  'dr.dk',
  'nrk.no',
  'svt.se',
  'yle.fi',
  'polskieradio.pl',
  'rozhlas.cz',
  'rtvs.sk',
  'npr.org',
  'stream.npr.org',
  'kqed.org',
  'cbc.ca',
  'streaming.cbc.ca',
  'akamaized.net',
  'akamaihd.net',
  'akamai.net',
  'cloudfront.net',
  'amazonaws.com',
  'fastly.net',
  'fastlylb.net',
  'streamtheworld.com',
  'iheart.com',
  'ihrcloud.com',
  'playerservices.streamtheworld.com',
  'tunein.com',
  'stream.tunein.com',
  'tritoncontent.com',
  'tritondigital.com',
  'shoutcast.com',
  'stream.shoutcast.com',
  'icecast.org',
  'live365.com',
  'streaming.live365.com',
  'radionomy.com',
  'stream.radionomy.com',
  'azuracast.com',
  'radiojar.com',
  'caster.fm',
  'streams.caster.fm',
  'securenetsystems.net',
  'zeno.fm',
  'stream.zeno.fm',
  'streamerr.co',
  'myradiostream.com',
  'listen2myradio.com',
  'radio.de',
  'stream.radio.de',
  'radio.net',
  'radio.garden',
  'onlineradiobox.com',
  'radiko.jp',
  'jcbasimul.com',
  'nhk.or.jp',
  'abc.net.au',
  'stream.abc.net.au',
  'sbs.com.au',
  'rnz.co.nz',
  'rfrancais.com',
  'dw.com',
  'stream.dw.com',
  'radioparadise.com',
  'stream.radioparadise.com',
  'somafm.com',
  'ice.somafm.com',
  'di.fm',
  'listen.di.fm',
  'jazzradio.com',
  'classicalradio.com',
  'rockradio.com',
  'zenolive.com',
  'streamingv2.shoutcast.com',
  'securestreams.net',
  'ssl-proxy.icastcenter.com',
];

const httpsCache = new Map<string, boolean>();

export function canUpgradeToHttps(url: string): boolean {
  if (!url || url.startsWith('https://')) {
    return true;
  }

  const cached = httpsCache.get(url);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const result = HTTPS_COMPATIBLE_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
    httpsCache.set(url, result);
    return result;
  } catch {
    return false;
  }
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
  if (!url) {
    return url;
  }

  if (url.startsWith('https://')) {
    return url;
  }

  if (canUpgradeToHttps(url)) {
    return upgradeToHttps(url);
  }

  return url;
}

export function isHlsStream(url: string): boolean {
  if (!url) {
    return false;
  }

  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith('.m3u8') || pathname.includes('.m3u8');
  } catch {
    return url.toLowerCase().includes('.m3u8');
  }
}

export function browserSupportsHls(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes('safari') && !userAgent.includes('chrome');
}

export function buildCandidateUrls(station: { url?: string; urlResolved?: string }): string[] {
  const rawUrls = [station.urlResolved, station.url].filter(Boolean) as string[];
  const candidates: string[] = [];
  const seen = new Set<string>();
  const secureRuntime = isSecureRuntime();

  for (const rawUrl of rawUrls) {
    if (isHlsStream(rawUrl) && !browserSupportsHls()) {
      continue;
    }

    if (secureRuntime && rawUrl.startsWith('http://') && !canUpgradeToHttps(rawUrl)) {
      continue;
    }

    const candidate = getSecureStreamUrl(rawUrl);
    if (seen.has(candidate)) {
      continue;
    }

    candidates.push(candidate);
    seen.add(candidate);
  }

  return candidates;
}

export function needsProxy(url: string): boolean {
  if (!url) {
    return false;
  }

  return isSecureRuntime() && url.startsWith('http://') && !canUpgradeToHttps(url);
}
