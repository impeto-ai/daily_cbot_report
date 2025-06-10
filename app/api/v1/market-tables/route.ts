import { NextResponse } from "next/server"
import { ImageResponse } from "@vercel/og"
import {
  getContractKeys,
  getContractsData,
  parseMarketData,
  getCurrencyKeys,
  parseCurrencyData,
} from "@/lib/redis-client"

export const dynamic = "force_dynamic"
export const revalidate = 0

const imageOptions = {
  width: 2048,
  height: undefined,
  emoji: "twemoji",
  debug: false,
}

export async function GET() {
  try {
    // Buscar chaves de câmbio
    const currencyKeys = await getCurrencyKeys()
    const currencyData = await getContractsData(currencyKeys)
    const parsedCurrencyData = currencyData
      .map((data) => parseCurrencyData(data))
      .filter((data): data is NonNullable<typeof data> => data !== null)

    // Separar dados de dólar e euro
    const dollarData = parsedCurrencyData.find((data) => data.symbol.includes("DOL"))
    const euroData = parsedCurrencyData.find((data) => data.symbol.includes("EURO"))

    // Buscar e processar dados em paralelo
    const [[soybeanKeys, cornKeys], soybeanImage, cornImage] = await Promise.all([
      Promise.all([getContractKeys("ZS"), getContractKeys("ZC")]),
      generateMarketTable("ZS", "SOJA", dollarData, euroData),
      generateMarketTable("ZC", "MILHO", dollarData, euroData),
    ])

    // Nova estrutura da resposta
    return NextResponse.json(
      {
        tabelas: {
          base64_soja: soybeanImage,
          base64_milho: cornImage,
        },
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    )
  } catch (error) {
    console.error("Error generating market data tables:", error)
    return NextResponse.json(
      {
        error: true,
        message: error instanceof Error ? error.message : "Unknown error occurred",
        details: JSON.stringify(error),
      },
      { status: 500 },
    )
  }
}

async function generateMarketTable(symbol: "ZS" | "ZC", title: string, dollarData: any, euroData: any) {
  try {
    // Buscar dados
    const keys = await getContractKeys(symbol)
    const rawData = await getContractsData(keys)

    // Processar dados
    const parsedData = rawData
      .map((data) => parseMarketData(data))
      .filter((data): data is NonNullable<typeof data> => data !== null)
      .sort((a, b) => a.timestamp - b.timestamp)

    // Gerar imagem
    const image = await new ImageResponse(generateTableStructure(parsedData, title, dollarData, euroData), imageOptions)

    // Converter para base64
    return Buffer.from(await image.arrayBuffer()).toString("base64")
  } catch (error) {
    console.error(`Error generating ${title} table:`, error)
    return ""
  }
}

// Função para formatar data no fuso horário GMT-3 (Brasília)
function formatDateBRT(date: Date): string {
  // Ajustar para GMT-3 (Brasília)
  const brazilTime = new Date(date.getTime() - 3 * 60 * 60 * 1000)

  // Formatar a data no padrão brasileiro
  return brazilTime.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  })
}

function generateTableStructure(data: any[], title: string, dollarData: any, euroData: any) {
  // Função para formatar números com 4 casas decimais para câmbio
  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? Number.parseFloat(value) : value
    return num.toLocaleString("pt-BR", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })
  }

  // Remover duplicatas mantendo a ordem
  const uniqueData = data.reduce((acc: any[], current) => {
    const exists = acc.find((item) => item.timestamp === current.timestamp)
    if (!exists) acc.push(current)
    return acc
  }, [])

  const rows = [
    {
      label: "Último",
      key: "lastPrice",
      transform: (v: string) => v.replace("S", ""), // Remove 'S' suffix
    },
    { label: "Ajuste", key: "adjustment" },
    { label: "Máximo", key: "high" },
    { label: "Mínimo", key: "low" },
    { label: "Abertura", key: "open" },
    { label: "Fech. Anterior", key: "close" },
    { label: "Contr. Aberto", key: "volume" },
    { label: "Contr. Negoc.", key: "contractsTraded" },
    {
      label: "Var. Dia",
      key: "change",
      color: (v: string) => (Number(v) >= 0 ? "#00ff00" : "#ff4444"),
    },
    {
      label: "Var. Mês (%)",
      key: "monthChange",
      color: (item: any) => (Number(item.monthChange) >= 0 ? "#00ff00" : "#ff4444"),
      value: (item: any) => {
        const value = Number(item.monthChange)
        return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
      },
    },
    {
      label: "Var. Ano (%)",
      key: "yearChange",
      color: (item: any) => (Number(item.yearChange) >= 0 ? "#00ff00" : "#ff4444"),
      value: (item: any) => {
        const value = Number(item.yearChange)
        return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
      },
    },
  ]

  // Obter a data atual no fuso horário de Brasília (GMT-3)
  const currentDate = new Date()
  const formattedDate = formatDateBRT(currentDate)

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        backgroundColor: "#1a1a1a",
        padding: 40,
      },
      children: [
        // Header
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 30,
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    color: "#ffffff",
                    fontSize: 42,
                    fontWeight: "700",
                  },
                  children: `${title} - CBOT (USD / bushel)`,
                },
              },
              {
                type: "img",
                props: {
                  src: "https://gwakkxqrbqiezvrsnzhb.supabase.co/storage/v1/object/public/images_innovagro//f2d1ae35-b222-47c4-af8c-c70811e249f9.png",
                  width: 240,
                  height: 90,
                  style: {
                    objectFit: "contain",
                  },
                },
              },
            ],
          },
        },
        // Informações de câmbio
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "flex-start",
              gap: 24,
              marginBottom: 30,
            },
            children: [
              // Dólar
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "#1f1f1f",
                    padding: "16px 20px",
                    borderRadius: 8,
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontWeight: "600",
                          fontSize: 28,
                          marginRight: 16,
                          color: "#ffffff",
                        },
                        children: "USD/BRL:",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontWeight: "700",
                          fontSize: 28,
                          fontFamily: "monospace",
                          color: "#ffd700",
                        },
                        children: dollarData ? formatCurrency(dollarData.lastPrice) : "N/A",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          marginLeft: 12,
                          fontWeight: "600",
                          fontSize: 24,
                          color: dollarData && Number(dollarData.change) >= 0 ? "#00ff00" : "#ff4444",
                          fontFamily: "monospace",
                        },
                        children: dollarData ? `(${dollarData.percentChange})` : "",
                      },
                    },
                  ],
                },
              },
              // Euro
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "#1f1f1f",
                    padding: "16px 20px",
                    borderRadius: 8,
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontWeight: "600",
                          fontSize: 28,
                          marginRight: 16,
                          color: "#ffffff",
                        },
                        children: "EUR/BRL:",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontWeight: "700",
                          fontSize: 28,
                          fontFamily: "monospace",
                          color: "#ffd700",
                        },
                        children: euroData ? formatCurrency(euroData.lastPrice) : "N/A",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          marginLeft: 12,
                          fontWeight: "600",
                          fontSize: 24,
                          color: euroData && Number(euroData.change) >= 0 ? "#00ff00" : "#ff4444",
                          fontFamily: "monospace",
                        },
                        children: euroData ? `(${euroData.percentChange})` : "",
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        // Tabela
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              width: "100%",
              border: "1px solid #2a2a2a",
              borderRadius: 8,
              overflow: "hidden",
            },
            children: [
              // Cabeçalho da tabela
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    backgroundColor: "#0f291e",
                    width: "100%",
                    padding: "20px 0",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          flex: "0 0 220px",
                          padding: "20px 24px",
                          color: "#ffffff",
                          textAlign: "left",
                          fontSize: 22,
                          fontWeight: "600",
                        },
                        children: `Data: ${formatDateBRT(new Date()).split(" ")[0]}`,
                      },
                    },
                    ...uniqueData.map((item) => ({
                      type: "div",
                      props: {
                        style: {
                          flex: 1,
                          padding: "20px 24px",
                          color: "#ffffff",
                          textAlign: "center",
                          fontSize: 22,
                          fontWeight: "600",
                        },
                        children: item.expirationDate,
                      },
                    })),
                  ],
                },
              },
              // Linhas de dados
              ...rows.map((row, rowIndex) => ({
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    width: "100%",
                    backgroundColor: "#1a1a1a",
                    borderBottom: rowIndex === rows.length - 1 ? "none" : "1px solid #2a2a2a",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          flex: "0 0 220px",
                          padding: "20px 24px",
                          color: "#ffffff",
                          fontWeight: "500",
                          fontSize: 22,
                        },
                        children: row.label,
                      },
                    },
                    ...uniqueData.map((item) => {
                      const value = row.value
                        ? row.value(item)
                        : row.transform
                          ? row.transform(item[row.key])
                          : item[row.key]

                      const color = row.color
                        ? typeof row.color === "function"
                          ? row.color(item)
                          : row.color
                        : rowIndex === 0
                          ? "#ffd700"
                          : rowIndex === 1 || rowIndex === 4 || rowIndex === 5
                            ? "#00b4d8"
                            : "#ffffff"

                      return {
                        type: "div",
                        props: {
                          style: {
                            flex: 1,
                            padding: "20px 24px",
                            textAlign: "center",
                            fontSize: 24,
                            fontWeight: "500",
                            color,
                            fontFamily: "monospace",
                          },
                          children: value,
                        },
                      }
                    }),
                  ],
                },
              })),
            ],
          },
        },
        // Footer
        {
          type: "div",
          props: {
            style: {
              fontSize: 18,
              color: "#666666",
              marginTop: 20,
              padding: "16px 0",
            },
            children: `Fonte: Broadcast | Última Atualização: ${formattedDate} (GMT-3)`,
          },
        },
      ],
    },
  }
}

