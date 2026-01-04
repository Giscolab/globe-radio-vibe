// Engine - Media: Color extraction from favicon images using Canvas API
import type { ExtractedColors } from '@/engine/types/radio';
import { faviconColorCache } from './faviconColorCache';

// In-memory cache for session (fallback)
const sessionCache = new Map<string, ExtractedColors>();

/**
 * Extract dominant colors from a favicon URL using Canvas API
 * Uses persistent cache with 7-day TTL + session memory cache
 */
export async function extractColors(faviconUrl: string): Promise<ExtractedColors | null> {
  // Check persistent cache first
  const cachedColors = faviconColorCache.get(faviconUrl);
  if (cachedColors) {
    return cachedColors;
  }
  
  // Check session cache
  if (sessionCache.has(faviconUrl)) {
    return sessionCache.get(faviconUrl)!;
  }

  try {
    const img = await loadImage(faviconUrl);
    const colors = extractColorsFromImage(img);
    
    if (colors) {
      // Store in both caches
      faviconColorCache.set(faviconUrl, colors);
      sessionCache.set(faviconUrl, colors);
    }
    
    return colors;
  } catch (error) {
    // Fail silently - color extraction is optional
    return null;
  }
}

/**
 * Load an image from URL with CORS handling
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const timeout = setTimeout(() => {
      reject(new Error('Image load timeout'));
    }, 5000);
    
    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Extract colors from a loaded image using canvas sampling
 */
function extractColorsFromImage(img: HTMLImageElement): ExtractedColors | null {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return null;
  
  // Scale down to 20x20 for faster processing
  const size = 20;
  canvas.width = size;
  canvas.height = size;
  
  ctx.drawImage(img, 0, 0, size, size);
  
  const imageData = ctx.getImageData(0, 0, size, size);
  const pixels = imageData.data;
  
  // Collect all non-transparent pixels
  const colorBuckets = new Map<string, { r: number; g: number; b: number; count: number }>();
  
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    
    // Skip transparent or near-transparent pixels
    if (a < 128) continue;
    
    // Skip very light (near white) and very dark (near black) pixels
    const brightness = (r + g + b) / 3;
    if (brightness > 240 || brightness < 15) continue;
    
    // Quantize to reduce color space (group similar colors)
    const qr = Math.floor(r / 32) * 32;
    const qg = Math.floor(g / 32) * 32;
    const qb = Math.floor(b / 32) * 32;
    const key = `${qr},${qg},${qb}`;
    
    const existing = colorBuckets.get(key);
    if (existing) {
      existing.r += r;
      existing.g += g;
      existing.b += b;
      existing.count++;
    } else {
      colorBuckets.set(key, { r, g, b, count: 1 });
    }
  }
  
  if (colorBuckets.size === 0) {
    return null;
  }
  
  // Sort by frequency and get top 2 colors
  const sortedBuckets = Array.from(colorBuckets.values())
    .sort((a, b) => b.count - a.count);
  
  const dominant = sortedBuckets[0];
  const secondary = sortedBuckets[1] || dominant;
  
  // Calculate average color for each bucket
  const dominantColor = {
    r: Math.round(dominant.r / dominant.count),
    g: Math.round(dominant.g / dominant.count),
    b: Math.round(dominant.b / dominant.count),
  };
  
  const secondaryColor = {
    r: Math.round(secondary.r / secondary.count),
    g: Math.round(secondary.g / secondary.count),
    b: Math.round(secondary.b / secondary.count),
  };
  
  // Calculate if dominant color is dark (for text contrast)
  const luminance = (0.299 * dominantColor.r + 0.587 * dominantColor.g + 0.114 * dominantColor.b) / 255;
  
  return {
    dominant: rgbToHex(dominantColor.r, dominantColor.g, dominantColor.b),
    secondary: rgbToHex(secondaryColor.r, secondaryColor.g, secondaryColor.b),
    isDark: luminance < 0.5,
  };
}

/**
 * Convert RGB to hex color
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Clear the color cache (both persistent and session)
 */
export function clearColorCache(): void {
  sessionCache.clear();
  faviconColorCache.clear();
}

/**
 * Get cache size (session + persistent)
 */
export function getColorCacheSize(): number {
  return sessionCache.size + faviconColorCache.size();
}
