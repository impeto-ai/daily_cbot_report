export const config = {
  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || '',
    password: process.env.REDIS_PASSWORD || '',
  },
  
  // Application Configuration
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Market Data API',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
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
    imageTTL: 10 * 60 * 1000, // 10 minutes
  },
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