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

export async function generateTableImage(data: MarketData[], title: string): Promise<string | undefined> {
  try {
    logger.debug('Starting table image generation', { 
      title, 
      dataCount: data.length,
      isProduction,
      isVercel 
    })

    // Carregar puppeteer baseado no ambiente
    let puppeteer: any
    let browser: any

    if (isVercel || isProduction) {
      // Ambiente serverless - usar @sparticuz/chromium
      try {
        const puppeteerCore = await import('puppeteer-core')
        const chromium = await import('@sparticuz/chromium')
        
        browser = await puppeteerCore.default.launch({
          headless: chromium.default.headless,
          executablePath: await chromium.default.executablePath(),
          args: [
            ...chromium.default.args,
            '--hide-scrollbars',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
          ],
          defaultViewport: chromium.default.defaultViewport,
        })
      } catch (error) {
        logger.error('Failed to launch browser in production', { error })
        return undefined
      }
    } else {
      // Ambiente local - usar puppeteer normal
      try {
        const puppeteerFull = await import('puppeteer')
        browser = await puppeteerFull.default.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
      } catch (error) {
        logger.error('Failed to launch browser in development', { error })
        return undefined
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

    await browser.close()

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
  }
}

