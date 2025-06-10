import { NextRequest, NextResponse } from "next/server"
import {
  getContractKeys,
  getContractsData,
  parseMarketData,
  getCurrencyKeys,
  parseCurrencyData,
} from "@/lib/redis-client"
import config from "@/lib/config"
import logger from "@/lib/logger"
import { handleApiError } from "@/lib/error-handler"
import { cacheKeys, cache } from "@/lib/cache"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Timeout para operações do endpoint
const ENDPOINT_TIMEOUT = config.timeouts.marketData

async function withTimeout<T>(promise: Promise<T>, timeout: number = ENDPOINT_TIMEOUT): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timeout after ${timeout}ms`)), timeout)
    )
  ])
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const url = new URL(request.url)
  const cacheParam = url.searchParams.get('cache')
  const bypassCache = cacheParam === 'false'
  
  try {
    logger.info('Market data API request started', {
      url: request.url,
      method: request.method,
      userAgent: request.headers.get('user-agent'),
      bypassCache,
    })

    // Validate configuration
    if (!config.redis.url || !config.redis.password) {
      logger.error('Redis configuration missing')
      return NextResponse.json({
        error: true,
        message: "Redis configuration is missing",
        soybean: [],
        corn: [],
        currency: { dollar: null, euro: null },
        timestamp: new Date().toISOString(),
      }, { status: 503 })
    }

    // Use cache com TTL específico para dados de mercado
    let response
    const cacheKey = cacheKeys.apiResponse('market-data')
    
    if (!bypassCache) {
      const cached = cache.get(cacheKey)
      if (cached) {
        response = cached
        logger.debug('Using cached market data response')
      }
    }
    
    if (!response) {
      const fetchPromise = (async () => {
        // Buscar chaves dos contratos e câmbio em paralelo para melhor performance
        const [soybeanKeys, cornKeys, currencyKeys] = await Promise.all([
          getContractKeys("ZS"),
          getContractKeys("ZC"),
          getCurrencyKeys(),
        ])

        if (config.logging.enableMarketDataLogs) {
          logger.debug('Contract keys fetched', {
            soybean: soybeanKeys.length,
            corn: cornKeys.length,
            currency: currencyKeys.length,
          })
        }

        // Buscar dados dos contratos e câmbio em paralelo
        const [soybeanData, cornData, currencyData] = await Promise.all([
          getContractsData(soybeanKeys),
          getContractsData(cornKeys),
          getContractsData(currencyKeys),
        ])

        if (config.logging.enableMarketDataLogs) {
          logger.debug('Raw data fetched', {
            soybeanCount: soybeanData.length,
            cornCount: cornData.length,
            currencyCount: currencyData.length,
          })
        }

        // Processar dados em paralelo
        const [parsedSoybeanData, parsedCornData, parsedCurrencyData] = await Promise.all([
          Promise.resolve(soybeanData
            .map((data) => parseMarketData(data))
            .filter((data): data is NonNullable<typeof data> => data !== null)),
          Promise.resolve(cornData
            .map((data) => parseMarketData(data))
            .filter((data): data is NonNullable<typeof data> => data !== null)),
          Promise.resolve(currencyData
            .map((data) => parseCurrencyData(data))
            .filter((data): data is NonNullable<typeof data> => data !== null))
        ])

        // Separar dados de dólar e euro
        const dollarData = parsedCurrencyData.find((data) => data.symbol.includes("DOL"))
        const euroData = parsedCurrencyData.find((data) => data.symbol.includes("EURO"))

        logger.marketDataProcessing('all', parsedSoybeanData.length + parsedCornData.length)

        return {
          error: false,
          message: "Success",
          soybean: parsedSoybeanData,
          corn: parsedCornData,
          currency: { dollar: dollarData, euro: euroData },
          timestamp: new Date().toISOString(),
        }
      })()
      
      response = await withTimeout(fetchPromise)

      // Cache the response if not bypassing cache
      if (!bypassCache) {
        cache.set(cacheKey, response, config.cache.marketDataTTL)
      }
    }

    const duration = Date.now() - startTime
    logger.apiRequest('GET', '/api/v1/market-data', duration, 200)

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${Math.floor(config.cache.marketDataTTL / 1000)}`,
        "X-Response-Time": `${duration}ms`,
        "X-API-Version": config.app.version,
        "X-Cache-TTL": `${config.cache.marketDataTTL}ms`,
      },
    })
  } catch (error) {
    const duration = Date.now() - startTime
    logger.apiRequest('GET', '/api/v1/market-data', duration, 500)
    
    // Se for timeout, retornar erro específico
    if ((error as Error).message.includes('timeout')) {
      return NextResponse.json({
        error: true,
        message: "Request timeout - market data service temporarily unavailable",
        soybean: [],
        corn: [],
        currency: { dollar: null, euro: null },
        timestamp: new Date().toISOString(),
        timeout: true,
      }, { status: 408 }) // Request Timeout
    }
    
    return handleApiError(error as Error, request)
  }
}

