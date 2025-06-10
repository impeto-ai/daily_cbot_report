import { NextRequest, NextResponse } from "next/server"
import { ImageResponse } from '@vercel/og'
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

export const dynamic = "force-dynamic"
export const revalidate = 0

async function generateTableSVG(data: any[], title: string): Promise<string> {
  // Criar uma tabela HTML simples que será convertida para base64
  const html = `
    <div style="
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      background: white;
      width: 1100px;
    ">
      <h1 style="
        font-size: 24px;
        color: #1a365d;
        margin-bottom: 10px;
        text-align: center;
        font-weight: bold;
      ">${title}</h1>
      
      <p style="
        color: #64748b;
        font-size: 12px;
        margin-bottom: 20px;
        text-align: center;
      ">Última atualização: ${new Date().toLocaleString('pt-BR')}</p>
      
      <table style="
        width: 100%;
        border-collapse: collapse;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        border-radius: 8px;
        overflow: hidden;
      ">
        <thead>
          <tr style="background: linear-gradient(135deg, #1a365d 0%, #2d3748 100%);">
            <th style="color: white; padding: 14px 12px; text-align: left; font-size: 13px; font-weight: 600;">Contrato</th>
            <th style="color: white; padding: 14px 12px; text-align: left; font-size: 13px; font-weight: 600;">Último</th>
            <th style="color: white; padding: 14px 12px; text-align: left; font-size: 13px; font-weight: 600;">Variação</th>
            <th style="color: white; padding: 14px 12px; text-align: left; font-size: 13px; font-weight: 600;">Volume</th>
            <th style="color: white; padding: 14px 12px; text-align: left; font-size: 13px; font-weight: 600;">Máxima</th>
            <th style="color: white; padding: 14px 12px; text-align: left; font-size: 13px; font-weight: 600;">Mínima</th>
            <th style="color: white; padding: 14px 12px; text-align: left; font-size: 13px; font-weight: 600;">Abertura</th>
            <th style="color: white; padding: 14px 12px; text-align: left; font-size: 13px; font-weight: 600;">Fechamento</th>
            <th style="color: white; padding: 14px 12px; text-align: left; font-size: 13px; font-weight: 600;">Vencimento</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((row, index) => `
            <tr style="background: ${index % 2 === 0 ? '#f8fafc' : 'white'};">
              <td style="padding: 12px; font-size: 13px;"><strong>${row.symbol}</strong></td>
              <td style="padding: 12px; font-size: 13px;">${row.lastPrice}</td>
              <td style="padding: 12px; font-size: 13px; color: ${row.change >= 0 ? '#059669' : '#dc2626'}; font-weight: 600;">
                ${row.change >= 0 ? '+' : ''}${row.change.toFixed(2)}%
              </td>
              <td style="padding: 12px; font-size: 13px;">${row.volume.toLocaleString('pt-BR')}</td>
              <td style="padding: 12px; font-size: 13px;">${row.high}</td>
              <td style="padding: 12px; font-size: 13px;">${row.low}</td>
              <td style="padding: 12px; font-size: 13px;">${row.open}</td>
              <td style="padding: 12px; font-size: 13px;">${row.close}</td>
              <td style="padding: 12px; font-size: 13px;">${row.expirationDate}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
  
  // Converter HTML para base64
  const base64 = Buffer.from(html).toString('base64')
  return `data:text/html;base64,${base64}`
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    logger.info('Market tables generation started')

    // Buscar dados em paralelo
    const [soybeanKeys, cornKeys] = await Promise.all([
      getContractKeys("ZS"),
      getContractKeys("ZC"),
    ])

    logger.debug('Contract keys fetched', {
      soybean: soybeanKeys.length,
      corn: cornKeys.length,
    })

    // Buscar dados dos contratos
    const [soybeanData, cornData] = await Promise.all([
      getContractsData(soybeanKeys),
      getContractsData(cornKeys),
    ])

    // Processar os dados
    const parsedSoybeanData = soybeanData.map(item => parseMarketData(item)).filter(item => item !== null)
    const parsedCornData = cornData.map(item => parseMarketData(item)).filter(item => item !== null)

    logger.debug('Data parsed successfully', {
      soybean: Array.isArray(parsedSoybeanData) ? parsedSoybeanData.length : 1,
      corn: Array.isArray(parsedCornData) ? parsedCornData.length : 1,
    })

    // Gerar as "imagens" (HTML em base64) em paralelo
    const soybeanArray = Array.isArray(parsedSoybeanData) ? parsedSoybeanData : [parsedSoybeanData]
    const cornArray = Array.isArray(parsedCornData) ? parsedCornData : [parsedCornData]
    
    const [sojaHTML, milhoHTML] = await Promise.all([
      generateTableSVG(soybeanArray, "SOJA - CBOT (USD/bushel)"),
      generateTableSVG(cornArray, "MILHO - CBOT (USD/bushel)"),
    ])

    const endTime = Date.now()
    const duration = endTime - startTime

    logger.info('Market tables generated successfully', {
      duration: `${duration}ms`,
      sojaSize: sojaHTML.length,
      milhoSize: milhoHTML.length,
    })

    return NextResponse.json({
      tabelas: {
        base64_soja: sojaHTML,
        base64_milho: milhoHTML,
      },
      dados: {
        soja: Array.isArray(parsedSoybeanData) ? parsedSoybeanData : [parsedSoybeanData],
        milho: Array.isArray(parsedCornData) ? parsedCornData : [parsedCornData],
      },
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300', // 5 minutos
        'Content-Type': 'application/json',
      },
    })

  } catch (error) {
    const endTime = Date.now()
    const duration = endTime - startTime
    
    logger.error('Failed to generate market tables', {
      error: error instanceof Error ? error.message : String(error),
      duration: `${duration}ms`,
      stack: error instanceof Error ? error.stack : undefined,
    })

         return handleApiError(error as Error, request)
  }
} 