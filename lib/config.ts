export const config = {
  // Redis Configuration
  redis: {
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    password: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  },
  
  // Application Configuration
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Market Data API',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    environment: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
    debug: process.env.NODE_ENV === 'development',
    port: Number(process.env.PORT) || 3000,
  },
  
  // API Configuration
  api: {
    rateLimit: {
      requests: parseInt(process.env.API_RATE_LIMIT_REQUESTS || '100'),
      windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    },
    timeout: 30000, // 30 seconds
  },
  
  // Monitoring
  monitoring: {
    enableLogging: process.env.ENABLE_LOGGING === 'true',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  
  // Security
  security: {
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
    apiSecretKey: process.env.API_SECRET_KEY || '',
  },
  
  // Cache Configuration
  cache: {
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    imageTTL: 60 * 60 * 1000, // 1 hour
    marketDataTTL: 2 * 60 * 1000, // 2 minutes for market data
    contractKeysTTL: 10 * 60 * 1000, // 10 minutes for contract keys
    currencyTTL: 5 * 60 * 1000, // 5 minutes for currency data
    maxSize: 1000, // Maximum entries in cache
  },
  
  logging: {
    level: (process.env.LOG_LEVEL || 'info') as 'error' | 'warn' | 'info' | 'debug',
    enableRedisLogs: process.env.NODE_ENV === 'development',
    enableApiLogs: true,
    enableMarketDataLogs: true,
  },
  
  timeouts: {
    redis: 10000, // 10 seconds
    api: 30000, // 30 seconds for API requests
    marketData: 15000, // 15 seconds for market data search
  },
  
  performance: {
    enablePipelineOptimization: true,
    maxConcurrentRequests: 10,
    enableMemoryOptimization: true,
  }
} as const

// Validation
export function validateConfig() {
  const errors: string[] = []
  
  if (!config.redis.url) {
    errors.push('REDIS_URL is required')
  }
  
  if (!config.redis.password) {
    errors.push('REDIS_PASSWORD is required')
  }
  
  if (config.app.environment === 'production' && !config.security.apiSecretKey) {
    errors.push('API_SECRET_KEY is required in production')
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`)
  }
}

export default config 