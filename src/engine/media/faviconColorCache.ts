// Engine - Favicon Color Cache: Persistent cache for extracted colors with TTL

import type { ExtractedColors } from '@/engine/types/radio';

const CACHE_KEY = 'favicon_color_cache';
const TTL_DAYS = 7;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

interface CacheEntry {
  colors: ExtractedColors;
  timestamp: number;
}

interface CacheData {
  version: 1;
  entries: Record<string, CacheEntry>;
}

class FaviconColorCache {
  private memoryCache: Map<string, ExtractedColors> = new Map();
  private loaded = false;

  /**
   * Generate a simple hash key from URL
   */
  private hashUrl(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'fc_' + Math.abs(hash).toString(36);
  }

  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    if (this.loaded) return;
    
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) {
        this.loaded = true;
        return;
      }
      
      const data: CacheData = JSON.parse(raw);
      const now = Date.now();
      
      // Filter out expired entries
      for (const [key, entry] of Object.entries(data.entries)) {
        if (now - entry.timestamp < TTL_MS) {
          this.memoryCache.set(key, entry.colors);
        }
      }
      
      this.loaded = true;
    } catch (error) {
      console.warn('[FaviconColorCache] Failed to load from storage:', error);
      this.loaded = true;
    }
  }

  /**
   * Save cache to localStorage
   */
  private saveToStorage(): void {
    try {
      const entries: Record<string, CacheEntry> = {};
      const now = Date.now();
      
      for (const [key, colors] of this.memoryCache.entries()) {
        entries[key] = { colors, timestamp: now };
      }
      
      const data: CacheData = { version: 1, entries };
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('[FaviconColorCache] Failed to save to storage:', error);
    }
  }

  /**
   * Get cached colors for a favicon URL
   */
  get(faviconUrl: string): ExtractedColors | null {
    this.loadFromStorage();
    const key = this.hashUrl(faviconUrl);
    return this.memoryCache.get(key) || null;
  }

  /**
   * Set colors for a favicon URL
   */
  set(faviconUrl: string, colors: ExtractedColors): void {
    this.loadFromStorage();
    const key = this.hashUrl(faviconUrl);
    this.memoryCache.set(key, colors);
    
    // Debounce save to avoid excessive writes
    this.scheduleSave();
  }

  private saveTimeoutId: ReturnType<typeof setTimeout> | null = null;
  
  private scheduleSave(): void {
    if (this.saveTimeoutId) {
      clearTimeout(this.saveTimeoutId);
    }
    this.saveTimeoutId = setTimeout(() => {
      this.saveToStorage();
      this.saveTimeoutId = null;
    }, 1000);
  }

  /**
   * Check if colors are cached for a URL
   */
  has(faviconUrl: string): boolean {
    this.loadFromStorage();
    const key = this.hashUrl(faviconUrl);
    return this.memoryCache.has(key);
  }

  /**
   * Get cache size
   */
  size(): number {
    this.loadFromStorage();
    return this.memoryCache.size;
  }

  /**
   * Clear all cached colors
   */
  clear(): void {
    this.memoryCache.clear();
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {}
  }

  /**
   * Prune expired entries and save
   */
  prune(): void {
    this.loadFromStorage();
    this.saveToStorage();
  }
}

// Singleton instance
export const faviconColorCache = new FaviconColorCache();
