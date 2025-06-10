import puppeteer from "puppeteer-core"
import chromium from "@sparticuz/chromium"
import logger from './logger'

interface MarketData {
  symbol: string
  lastPrice: string
  change: number
  volume: number
  high: string
  low: string
  open: string
  close: string
  lastUpdate: string
  expirationDate: string
}

// Configuração específica para ambientes serverless
const isProduction = process.env.NODE_ENV === 'production'
const isVercel = process.env.VERCEL === '1'

async function getBrowserConfig() {
  if (isVercel || isProduction) {
    // Configuração otimizada para Vercel/serverless
    return {
      headless: chromium.headless,
      executablePath: await chromium.executablePath(),
      args: [
        ...chromium.args,
        '--hide-scrollbars',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
      ],
      defaultViewport: chromium.defaultViewport,
    }
  } else {
    // Configuração para desenvolvimento local
    try {
      // Tentar usar puppeteer normal em desenvolvimento
      const { default: puppeteerFull } = await import('puppeteer')
      const executablePath = await puppeteerFull.executablePath()
      
      return {
        headless: true,
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      }
    } catch (error) {
      logger.warn('Puppeteer full not available, using puppeteer-core with system Chrome')
      
      // Fallback para puppeteer-core se puppeteer não estiver disponível
      return {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        // Tentar encontrar Chrome no sistema (macOS/Linux/Windows)
        executablePath: process.env.CHROME_PATH || 
                       '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' || // macOS
                       '/usr/bin/google-chrome' || // Linux
                       'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' // Windows
      }
    }
  }
}

export async function generateTableImage(data: MarketData[], title: string): Promise<string | undefined> {
  let browser
  
  try {
    logger.debug('Starting table image generation', { 
      title, 
      dataCount: data.length,
      isProduction,
      isVercel 
    })

    const config = await getBrowserConfig()
    
    // Usar o puppeteer apropriado baseado no ambiente
    if (isVercel || isProduction) {
      browser = await puppeteer.launch(config)
    } else {
      try {
        // Tentar usar puppeteer normal em desenvolvimento
        const { default: puppeteerFull } = await import('puppeteer')
        browser = await puppeteerFull.launch(config)
      } catch (error) {
        // Fallback para puppeteer-core
        browser = await puppeteer.launch(config)
      }
    }
    
    const page = await browser.newPage()
    
    // Definir viewport para controlar o tamanho da imagem
    await page.setViewport({ width: 1200, height: 800 })

    const html = `
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
              padding: 20px;
              background: white;
              margin: 0;
              width: 1160px;
            }
            
            .market-table {
              width: 100%;
              border-collapse: collapse;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              border-radius: 8px;
              overflow: hidden;
            }
            
            .market-table th {
              background: linear-gradient(135deg, #1a365d 0%, #2d3748 100%);
              color: white;
              padding: 14px 12px;
              text-align: left;
              font-size: 13px;
              font-weight: 600;
              border: none;
            }
            
            .market-table td {
              padding: 12px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 13px;
              border: none;
            }
            
            .market-table tr:nth-child(even) {
              background: #f8fafc;
            }
            
            .market-table tr:hover {
              background: #f1f5f9;
            }
            
            .positive {
              color: #059669;
              font-weight: 600;
            }
            
            .negative {
              color: #dc2626;
              font-weight: 600;
            }
            
            .title {
              font-size: 28px;
              color: #1a365d;
              margin-bottom: 8px;
              font-weight: bold;
              text-align: center;
            }

            .timestamp {
              color: #64748b;
              font-size: 12px;
              margin-bottom: 20px;
              text-align: center;
            }

            .container {
              max-width: 1200px;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="title">${title}</div>
            <div class="timestamp">Última atualização: ${new Date().toLocaleString('pt-BR')}</div>
            <table class="market-table">
              <thead>
                <tr>
                  <th>Contrato</th>
                  <th>Último</th>
                  <th>Variação</th>
                  <th>Volume</th>
                  <th>Máxima</th>
                  <th>Mínima</th>
                  <th>Abertura</th>
                  <th>Fechamento</th>
                  <th>Vencimento</th>
                </tr>
              </thead>
              <tbody>
                ${data
                  .map(
                    (row) => `
                  <tr>
                    <td><strong>${row.symbol}</strong></td>
                    <td>${row.lastPrice}</td>
                    <td class="${row.change >= 0 ? "positive" : "negative"}">
                      ${row.change >= 0 ? "+" : ""}${row.change.toFixed(2)}%
                    </td>
                    <td>${row.volume.toLocaleString('pt-BR')}</td>
                    <td>${row.high}</td>
                    <td>${row.low}</td>
                    <td>${row.open}</td>
                    <td>${row.close}</td>
                    <td>${row.expirationDate}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `

    await page.setContent(html, { waitUntil: 'networkidle0' })
    
    // Aguardar que o conteúdo seja totalmente renderizado
    await page.waitForSelector('.market-table')

    const element = await page.$(".container")
    if (!element) {
      throw new Error('Could not find container element')
    }

    const imageBuffer = await element.screenshot({
      encoding: "base64",
      type: 'png',
      quality: 100
    })

    logger.debug('Table image generated successfully', { 
      title,
      imageSizeBytes: imageBuffer ? imageBuffer.length : 0
    })

    return imageBuffer ? `data:image/png;base64,${imageBuffer}` : undefined

  } catch (error) {
    logger.error('Failed to generate table image', { 
      title, 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    
    // Em caso de erro, retornar undefined para que a API possa continuar
    return undefined
    
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        logger.warn('Failed to close browser', { 
          error: closeError instanceof Error ? closeError.message : String(closeError)
        })
      }
    }
  }
}

