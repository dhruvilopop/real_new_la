/**
 * In-memory cache utility to reduce database queries and prevent connection limit issues
 * This is especially useful for shared MySQL hosting with limited connections per hour
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private hits: number = 0;
  private misses: number = 0;

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data;
  }

  /**
   * Set a value in cache
   */
  set<T>(key: string, data: T, ttlMs: number = 60000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  /**
   * Delete a value from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Delete all keys matching a pattern
   */
  deletePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; hits: number; misses: number; hitRate: string } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? `${Math.round((this.hits / total) * 100)}%` : '0%'
    };
  }

  /**
   * Get or set a value with a fetcher function
   * This is the recommended way to use cache
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 60000
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttlMs);
    return data;
  }
}

// Singleton instance
export const cache = new MemoryCache();

// Cache key generators for common queries
export const CacheKeys = {
  // User related
  user: (userId: string) => `user:${userId}`,
  userByEmail: (email: string) => `user:email:${email}`,
  usersByRole: (role: string) => `users:role:${role}`,
  usersList: () => 'users:list',
  
  // Loan related
  loan: (loanId: string) => `loan:${loanId}`,
  loansByStatus: (status: string) => `loans:status:${status}`,
  loansByRole: (role: string, userId?: string) => `loans:${role}${userId ? `:${userId}` : ''}`,
  loanDetails: (loanId: string) => `loan:details:${loanId}`,
  allActiveLoans: () => 'loans:active:all',
  
  // EMI related
  emiSchedule: (loanId: string) => `emi:schedule:${loanId}`,
  emiCalendar: (userId: string, date: string) => `emi:calendar:${userId}:${date}`,
  pendingEMIs: (userId: string) => `emi:pending:${userId}`,
  
  // Company related
  company: (companyId: string) => `company:${companyId}`,
  companiesList: () => 'companies:list',
  
  // Settings
  systemSettings: () => 'settings:system',
  paymentSettings: () => 'settings:payment',
  
  // Credit related
  creditSummary: (userId: string) => `credit:summary:${userId}`,
  
  // Dashboard stats
  dashboardStats: (role: string, userId?: string) => `dashboard:stats:${role}${userId ? `:${userId}` : ''}`,
  
  // CMS related (static keys)
  CMS_SERVICES: 'cms:services',
  CMS_BANNERS: 'cms:banners',
  CMS_TESTIMONIALS: 'cms:testimonials',
  LOAN_STATS: 'stats:loans',
  USER_COUNT: 'stats:user_count',
  COMPANY_COUNT: 'stats:company_count',
};

// Default TTL values (in milliseconds)
export const CacheTTL = {
  SHORT: 30000,      // 30 seconds - for frequently changing data
  MEDIUM: 60000,     // 1 minute - for normal data
  LONG: 300000,      // 5 minutes - for rarely changing data
  VERY_LONG: 900000, // 15 minutes - for static data
};

// Invalidate cache for related data when changes occur
export function invalidateUserCache(userId?: string) {
  if (userId) {
    cache.deletePattern(`user:${userId}`);
    cache.deletePattern(`credit:summary:${userId}`);
    cache.deletePattern(`emi:pending:${userId}`);
    cache.deletePattern(`emi:calendar:${userId}`);
  }
  cache.delete('users:list');
  cache.deletePattern('users:role:');
  cache.deletePattern('dashboard:stats:');
}

export function invalidateLoanCache(loanId?: string) {
  if (loanId) {
    cache.deletePattern(`loan:${loanId}`);
    cache.deletePattern(`emi:schedule:${loanId}`);
  }
  cache.deletePattern('loans:');
  cache.deletePattern('dashboard:stats:');
}

export function invalidatePaymentCache() {
  cache.delete('settings:payment');
  cache.deletePattern('emi:');
  cache.deletePattern('credit:');
  cache.deletePattern('dashboard:stats:');
}

export default cache;
