import { NextRequest, NextResponse } from "next/server"
import { getContractKeys, getContractsData, parseMarketData, getCurrencyKeys, parseCurrencyData } from "@/lib/redis-client"
import { generateTableImage } from "@/lib/table-generator"
import config from "@/lib/config"
import logger from "@/lib/logger"
import { handleApiError, createImageGenerationError } from "@/lib/error-handler"
import { getCachedImageTable, cacheKeys } from "@/lib/cache"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Timeout específico para geração de imagens
const IMAGE_GENERATION_TIMEOUT = 30000 // 30 segundos

async function withTimeout<T>(promise: Promise<T>, timeout: number = IMAGE_GENERATION_TIMEOUT): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Image generation timeout after ${timeout}ms`)), timeout)
    )
  ])
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    logger.info('Market table generation started')

    // Buscar dados de mercado primeiro
    const [soybeanKeys, cornKeys] = await Promise.all([
      getContractKeys("ZS"),
      getContractKeys("ZC"),
    ])

    logger.debug('Market table generation - contract keys fetched', {
      soybean: soybeanKeys.length,
      corn: cornKeys.length,
    })

    // Buscar dados dos contratos
    const [soybeanData, cornData] = await Promise.all([
      getContractsData(soybeanKeys),
      getContractsData(cornKeys),
    ])

    // Processar os dados
    const soybeanItems = soybeanData.map(item => parseMarketData(item)).filter(item => item !== null)
    const cornItems = cornData.map(item => parseMarketData(item)).filter(item => item !== null)

    // Verificar se os dados foram processados corretamente
    if (soybeanItems.length === 0 || cornItems.length === 0) {
      throw createImageGenerationError('table', 'Failed to parse market data')
    }

    logger.debug('Market table generation - data parsed', {
      soybean: soybeanItems.length,
      corn: cornItems.length,
    })

    // Função para gerar imagem com timeout
    const generateImageWithTimeout = async (data: any[], title: string): Promise<string> => {
      const result = await withTimeout(generateTableImage(data, title))
      if (!result) {
        throw createImageGenerationError('table', `Failed to generate ${title} image`)
      }
      return result
    }

    // Gerar imagens em paralelo com cache
    const [sojaImageBase64, milhoImageBase64] = await Promise.all([
      getCachedImageTable('soja', () => 
        generateImageWithTimeout(
          soybeanItems.map(item => ({
            symbol: item!.symbol,
            lastPrice: item!.lastPrice,
            change: parseFloat(item!.change.toString()),
            volume: parseInt(item!.volume.toString()),
            high: item!.high,
            low: item!.low,
            open: item!.open,
            close: item!.close,
            lastUpdate: item!.lastUpdate.toString(),
            expirationDate: item!.expirationDate
          })), 
          "SOJA - CBOT (USD/bushel)"
        )
      ),
      getCachedImageTable('milho', () => 
        generateImageWithTimeout(
          cornItems.map(item => ({
            symbol: item!.symbol,
            lastPrice: item!.lastPrice,
            change: parseFloat(item!.change.toString()),
            volume: parseInt(item!.volume.toString()),
            high: item!.high,
            low: item!.low,
            open: item!.open,
            close: item!.close,
            lastUpdate: item!.lastUpdate.toString(),
            expirationDate: item!.expirationDate
          })), 
          "MILHO - CBOT (USD/bushel)"
        )
      ),
    ])

    if (!sojaImageBase64 || !milhoImageBase64) {
      throw createImageGenerationError('table', 'Failed to generate one or both images')
    }

    const duration = Date.now() - startTime
    logger.imageGeneration('market-tables', true, duration)
    logger.apiRequest('GET', '/api/v1/market-tables', duration, 200)

    const response = {
      tabelas: {
        base64_soja: sojaImageBase64,
        base64_milho: milhoImageBase64,
      },
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${Math.floor(config.cache.imageTTL / 1000)}`,
        "X-Response-Time": `${duration}ms`,
        "X-API-Version": config.app.version,
        "X-Cache-TTL": `${config.cache.imageTTL}ms`,
      },
    })

  } catch (error) {
    const duration = Date.now() - startTime
    logger.imageGeneration('market-tables', false, duration)
    logger.apiRequest('GET', '/api/v1/market-tables', duration, 500)
    
    // Se for timeout, retornar erro específico
    if ((error as Error).message.includes('timeout')) {
      return NextResponse.json({
        error: true,
        message: "Image generation timeout - service temporarily unavailable",
        tabelas: {
          base64_soja: "",
          base64_milho: "",
        },
        timestamp: new Date().toISOString(),
        timeout: true,
      }, { status: 408 }) // Request Timeout
    }
    
    return handleApiError(error as Error, request)
  }
} 