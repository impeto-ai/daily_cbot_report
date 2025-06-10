import config from './config'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, any>
  error?: Error
}

class Logger {
  private isEnabled: boolean
  private logLevel: LogLevel

  constructor() {
    this.isEnabled = config.monitoring.enableLogging
    this.logLevel = config.monitoring.logLevel as LogLevel
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.isEnabled) return false
    
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    }
    
    return levels[level] >= levels[this.logLevel]
  }

  private formatLog(entry: LogEntry): string {
    const { timestamp, level, message, context, error } = entry
    let logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`
    
    if (context && Object.keys(context).length > 0) {
      logMessage += ` | Context: ${JSON.stringify(context)}`
    }
    
    if (error) {
      logMessage += ` | Error: ${error.message}`
      if (error.stack) {
        logMessage += ` | Stack: ${error.stack}`
      }
    }
    
    return logMessage
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
    }

    const formattedLog = this.formatLog(entry)

    // In production, you might want to send logs to external service
    if (config.app.environment === 'production') {
      // TODO: Send to external logging service (e.g., Sentry, LogRocket, etc.)
      console.log(formattedLog)
    } else {
      // Development logging with colors
      const colors = {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m',  // Green
        warn: '\x1b[33m',  // Yellow
        error: '\x1b[31m', // Red
      }
      const reset = '\x1b[0m'
      
      console.log(`${colors[level]}${formattedLog}${reset}`)
    }
  }

  debug(message: string, context?: Record<string, any>) {
    this.log('debug', message, context)
  }

  info(message: string, context?: Record<string, any>) {
    this.log('info', message, context)
  }

  warn(message: string, context?: Record<string, any>) {
    this.log('warn', message, context)
  }

  error(message: string, context?: Record<string, any>, error?: Error) {
    this.log('error', message, context, error)
  }

  // API Request logging
  apiRequest(method: string, path: string, duration?: number, statusCode?: number) {
    this.info('API Request', {
      method,
      path,
      duration: duration ? `${duration}ms` : undefined,
      statusCode,
    })
  }

  // Redis operation logging
  redisOperation(operation: string, key?: string, duration?: number, success: boolean = true) {
    const level = success ? 'debug' : 'error'
    this.log(level, `Redis ${operation}`, {
      key,
      duration: duration ? `${duration}ms` : undefined,
      success,
    })
  }

  // Market data processing
  marketDataProcessing(symbol: string, contractsCount: number, duration?: number) {
    this.info('Market data processed', {
      symbol,
      contractsCount,
      duration: duration ? `${duration}ms` : undefined,
    })
  }

  // Image generation
  imageGeneration(type: string, success: boolean, duration?: number, size?: string) {
    const level = success ? 'info' : 'error'
    this.log(level, `Image generation ${success ? 'completed' : 'failed'}`, {
      type,
      duration: duration ? `${duration}ms` : undefined,
      size,
    })
  }
}

export const logger = new Logger()
export default logger 