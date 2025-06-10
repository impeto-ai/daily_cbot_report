import { NextResponse } from 'next/server'
import logger from './logger'

export class AppError extends Error {
  public statusCode: number
  public isOperational: boolean
  public context?: Record<string, any>

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.context = context
    
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 400, true, context)
  }
}

export class RedisError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 503, true, context)
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, true)
  }
}

export class ImageGenerationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 500, true, context)
  }
}

// Error response formatter
export function formatErrorResponse(error: Error | AppError, includeStack: boolean = false) {
  const isAppError = error instanceof AppError
  
  const response = {
    error: true,
    message: error.message,
    type: error.constructor.name,
    timestamp: new Date().toISOString(),
    ...(isAppError && error.context && { context: error.context }),
    ...(includeStack && { stack: error.stack }),
  }

  return response
}

// Error handler middleware
export function handleApiError(error: Error, request?: Request): NextResponse {
  const isAppError = error instanceof AppError
  const statusCode = isAppError ? error.statusCode : 500
  const includeStack = process.env.NODE_ENV === 'development'
  
  // Log the error
  logger.error('API Error', {
    message: error.message,
    statusCode,
    path: request?.url,
    method: request?.method,
    userAgent: request?.headers.get('user-agent'),
    ...(isAppError && error.context && { context: error.context }),
  }, error)

  // Format response
  const errorResponse = formatErrorResponse(error, includeStack)
  
  return NextResponse.json(errorResponse, { status: statusCode })
}

// Async error wrapper for API routes
export function asyncHandler(fn: Function) {
  return async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (error) {
      return handleApiError(error as Error, args[0])
    }
  }
}

// Error boundary for React components
export function createErrorBoundary() {
  return class ErrorBoundary extends Error {
    constructor(message: string, public componentStack?: string) {
      super(message)
    }
  }
}

// Validation error helper
export function createValidationError(field: string, value: any, expected: string) {
  return new ValidationError(
    `Invalid ${field}: expected ${expected}, received ${typeof value === 'object' ? JSON.stringify(value) : value}`,
    { field, value, expected }
  )
}

// Redis connection error helper
export function createRedisConnectionError(operation: string, details?: string) {
  return new RedisError(
    `Redis ${operation} failed${details ? `: ${details}` : ''}`,
    { operation, details }
  )
}

// Image generation error helper
export function createImageGenerationError(type: string, details?: string) {
  return new ImageGenerationError(
    `Failed to generate ${type} image${details ? `: ${details}` : ''}`,
    { type, details }
  )
}

// Health check for error monitoring
export function isHealthy(): { status: string; errors: any[] } {
  const errors: any[] = []
  
  // Add health checks here
  // e.g., Redis connection, external APIs, etc.
  
  return {
    status: errors.length === 0 ? 'healthy' : 'unhealthy',
    errors,
  }
} 