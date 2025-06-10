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
import { getCachedData, cacheKeys } from "@/lib/cache"

export const dynamic = "force-dynamic"
export const revalidate = 0

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

    const fetchMarketData = async () => {
      // Buscar chaves dos contratos e câmbio
      const [soybeanKeys, cornKeys, currencyKeys] = await Promise.all([
        getContractKeys("ZS"),
        getContractKeys("ZC"),
        getCurrencyKeys(),
      ])

      logger.debug('Contract keys fetched', {
        soybean: soybeanKeys.length,
        corn: cornKeys.length,
        currency: currencyKeys.length,
      })

      // Buscar dados dos contratos e câmbio
      const [soybeanData, cornData, currencyData] = await Promise.all([
        getContractsData(soybeanKeys),
        getContractsData(cornKeys),
        getContractsData(currencyKeys),
      ])

      logger.debug('Raw data fetched', {
        soybeanCount: soybeanData.length,
        cornCount: cornData.length,
        currencyCount: currencyData.length,
      })

      // Processar dados
      const parsedSoybeanData = soybeanData
        .map((data) => parseMarketData(data))
        .filter((data): data is NonNullable<typeof data> => data !== null)

      const parsedCornData = cornData
        .map((data) => parseMarketData(data))
        .filter((data): data is NonNullable<typeof data> => data !== null)

      const parsedCurrencyData = currencyData
        .map((data) => parseCurrencyData(data))
        .filter((data): data is NonNullable<typeof data> => data !== null)

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
    }

    // Use cache unless bypassed
    const response = bypassCache 
      ? await fetchMarketData()
      : await getCachedData(
          cacheKeys.apiResponse('market-data'),
          fetchMarketData,
          config.cache.defaultTTL
        )

    const duration = Date.now() - startTime
    logger.apiRequest('GET', '/api/v1/market-data', duration, 200)

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Response-Time": `${duration}ms`,
        "X-API-Version": config.app.version,
      },
    })
  } catch (error) {
    const duration = Date.now() - startTime
    logger.apiRequest('GET', '/api/v1/market-data', duration, 500)
    return handleApiError(error as Error, request)
  }
}

