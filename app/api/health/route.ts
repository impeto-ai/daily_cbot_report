import { NextResponse } from 'next/server'
import config from '@/lib/config'
import logger from '@/lib/logger'
import { cache } from '@/lib/cache'

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  version: string
  uptime: number
  checks: {
    redis: HealthCheck
    cache: HealthCheck
    memory: HealthCheck
  }
}

interface HealthCheck {
  status: 'pass' | 'fail' | 'warn'
  message?: string
  duration?: number
  details?: Record<string, any>
}

export async function GET() {
  const startTime = Date.now()
  
  try {
    // Test Redis connection
    const redisCheck = await checkRedis()
    
    // Check cache status
    const cacheCheck = checkCache()
    
    // Check memory usage
    const memoryCheck = checkMemory()
    
    // Determine overall status
    const checks = { redis: redisCheck, cache: cacheCheck, memory: memoryCheck }
    const overallStatus = determineOverallStatus(checks)
    
    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: config.app.version,
      uptime: process.uptime(),
      checks,
    }
    
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503
    
    // Log health check
    logger.info('Health check completed', {
      status: overallStatus,
      duration: `${Date.now() - startTime}ms`,
      redis: redisCheck.status,
      cache: cacheCheck.status,
      memory: memoryCheck.status,
    })
    
    return NextResponse.json(healthStatus, { status: statusCode })
  } catch (error) {
    logger.error('Health check failed', {}, error as Error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: config.app.version,
      uptime: process.uptime(),
      error: (error as Error).message,
    }, { status: 503 })
  }
}

async function checkRedis(): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    // Try to import Redis client dynamically to avoid import errors
    const { createRedisClient } = await import('@/lib/redis-client')
    const redis = createRedisClient?.()
    
    if (!redis) {
      return {
        status: 'fail',
        message: 'Redis client not available',
        duration: Date.now() - startTime,
      }
    }
    
    // Test Redis connection with a simple ping
    await redis.ping()
    
    return {
      status: 'pass',
      message: 'Redis connection successful',
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      status: 'fail',
      message: `Redis connection failed: ${(error as Error).message}`,
      duration: Date.now() - startTime,
    }
  }
}

function checkCache(): HealthCheck {
  try {
    const stats = cache.getStats()
    
    // Warn if cache hit ratio is low or too many expired entries
    const hitRatio = stats.valid / (stats.valid + stats.expired || 1)
    const expiredRatio = stats.expired / (stats.total || 1)
    
    let status: 'pass' | 'warn' = 'pass'
    let message = 'Cache operating normally'
    
    if (hitRatio < 0.7) {
      status = 'warn'
      message = 'Low cache hit ratio detected'
    } else if (expiredRatio > 0.3) {
      status = 'warn'
      message = 'High expired entry ratio'
    }
    
    return {
      status,
      message,
      details: {
        ...stats,
        hitRatio: Math.round(hitRatio * 100) / 100,
        expiredRatio: Math.round(expiredRatio * 100) / 100,
      },
    }
  } catch (error) {
    return {
      status: 'fail',
      message: `Cache check failed: ${(error as Error).message}`,
    }
  }
}

function checkMemory(): HealthCheck {
  try {
    const memUsage = process.memoryUsage()
    const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024)
    const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024)
    const memoryPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100
    
    let status: 'pass' | 'warn' | 'fail' = 'pass'
    let message = 'Memory usage normal'
    
    if (memoryPercent > 90) {
      status = 'fail'
      message = 'Critical memory usage'
    } else if (memoryPercent > 80) {
      status = 'warn'
      message = 'High memory usage'
    }
    
    return {
      status,
      message,
      details: {
        usedMB,
        totalMB,
        percentage: Math.round(memoryPercent),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      },
    }
  } catch (error) {
    return {
      status: 'fail',
      message: `Memory check failed: ${(error as Error).message}`,
    }
  }
}

function determineOverallStatus(checks: HealthStatus['checks']): 'healthy' | 'unhealthy' | 'degraded' {
  const statuses = Object.values(checks).map(check => check.status)
  
  if (statuses.includes('fail')) {
    return 'unhealthy'
  }
  
  if (statuses.includes('warn')) {
    return 'degraded'
  }
  
  return 'healthy'
} 