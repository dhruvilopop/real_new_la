// Simple in-memory cache for faster API responses
// Cache expires after 30 seconds by default

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SimpleCache {
  private cache = new Map<string, CacheItem<unknown>>();
  private defaultTTL = 30000; // 30 seconds

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  set<T>(key: string, data: T, ttl = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Get or set pattern
  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttl);
    return data;
  }
}

export const cache = new SimpleCache();

// Cache keys
export const CACHE_KEYS = {
  SETTINGS: 'settings',
  CMS_SERVICES: 'cms_services',
  CMS_BANNERS: 'cms_banners',
  CMS_TESTIMONIALS: 'cms_testimonials',
  USER_COUNT: 'user_count',
  COMPANY_COUNT: 'company_count',
  LOAN_STATS: 'loan_stats',
};
