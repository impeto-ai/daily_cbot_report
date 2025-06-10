import config from './config'
import logger from './logger'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>()
  private maxSize: number = 1000

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize
  }

  set<T>(key: string, data: T, ttl?: number): void {
    // Clean up expired entries if cache is getting full
    if (this.cache.size >= this.maxSize) {
      this.cleanup()
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || config.cache.defaultTTL,
    }

    this.cache.set(key, entry)
    logger.debug('Cache SET', { key, ttl: entry.ttl })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined

    if (!entry) {
      logger.debug('Cache MISS', { key })
      return null
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      logger.debug('Cache EXPIRED', { key })
      return null
    }

    logger.debug('Cache HIT', { key })
    return entry.data
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      logger.debug('Cache DELETE', { key })
    }
    return deleted
  }

  clear(): void {
    const size = this.cache.size
    this.cache.clear()
    logger.info('Cache cleared', { previousSize: size })
  }

  private cleanup(): void {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        cleanedCount++
      }
    }

    logger.debug('Cache cleanup completed', { cleanedCount })
  }

  getStats() {
    const now = Date.now()
    let validEntries = 0
    let expiredEntries = 0

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredEntries++
      } else {
        validEntries++
      }
    }

    return {
      total: this.cache.size,
      valid: validEntries,
      expired: expiredEntries,
      maxSize: this.maxSize,
    }
  }
}

// Global cache instance
export const cache = new MemoryCache(100)

// Cache key generators
export const cacheKeys = {
  marketData: (symbol: string) => `market-data:${symbol}`,
  currencyData: (symbol: string) => `currency-data:${symbol}`,
  contractKeys: (symbol: string) => `contract-keys:${symbol}`,
  imageTable: (symbol: string, timestamp: string) => `image-table:${symbol}:${timestamp}`,
  apiResponse: (endpoint: string, params?: string) => `api-response:${endpoint}${params ? `:${params}` : ''}`,
}

// Cache wrapper functions
export async function getCachedData<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try to get from cache first
  const cached = cache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // Cache miss - fetch data
  const startTime = Date.now()
  try {
    const data = await fetchFn()
    const duration = Date.now() - startTime
    
    // Cache the result
    cache.set(key, data, ttl)
    
    logger.debug('Data fetched and cached', { 
      key, 
      duration: `${duration}ms`,
      ttl: ttl || config.cache.defaultTTL,
    })
    
    return data
  } catch (error) {
    logger.error('Failed to fetch data for cache', { key }, error as Error)
    throw error
  }
}

// Market data specific cache functions
export async function getCachedMarketData<T>(
  symbol: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  const key = cacheKeys.marketData(symbol)
  return getCachedData(key, fetchFn, config.cache.defaultTTL)
}

export async function getCachedImageTable(
  symbol: string,
  fetchFn: () => Promise<string>
): Promise<string> {
  // Use current hour as part of key to ensure images are regenerated hourly
  const hourKey = new Date().toISOString().slice(0, 13) // YYYY-MM-DDTHH
  const key = cacheKeys.imageTable(symbol, hourKey)
  return getCachedData(key, fetchFn, config.cache.imageTTL)
}

// Cache invalidation
export function invalidateCache(pattern?: string): void {
  if (!pattern) {
    cache.clear()
    return
  }

  // Simple pattern matching (supports wildcards at the end)
  const keys = Array.from(cache['cache'].keys())
  const isWildcard = pattern.endsWith('*')
  const basePattern = isWildcard ? pattern.slice(0, -1) : pattern

  let deletedCount = 0
  for (const key of keys) {
    const matches = isWildcard ? key.startsWith(basePattern) : key === pattern
    if (matches) {
      cache.delete(key)
      deletedCount++
    }
  }

  logger.info('Cache invalidated', { pattern, deletedCount })
}

// Scheduled cache cleanup (call this periodically)
export function scheduledCacheCleanup(): void {
  const stats = cache.getStats()
  logger.info('Scheduled cache cleanup', stats)
  
  // Force cleanup if too many expired entries or cache is getting full
  if (stats.expired > stats.total * 0.2 || stats.total > 80) {
    cache['cleanup']()
    
    // Force garbage collection if available (development only)
    if (global.gc && process.env.NODE_ENV === 'development') {
      global.gc()
      logger.debug('Forced garbage collection')
    }
  }
}

// Auto-cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(scheduledCacheCleanup, 5 * 60 * 1000)
}

export default cache 