# Daily CBOT Report 📈

Uma API profissional para geração automatizada de imagens de cotações de commodities (soja e milho) e câmbio, desenvolvida para grupos de WhatsApp do mercado financeiro/agronegócio.

![Market Data API](https://img.shields.io/badge/Next.js-15.2.4-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Redis](https://img.shields.io/badge/Redis-latest-red?style=for-the-badge&logo=redis)

## 🚀 Características

- **Geração de Imagens Automática**: Cria imagens PNG profissionais das tabelas de mercado
- **Dados em Tempo Real**: Cotações da CBOT (Chicago Board of Trade) e câmbio da B3
- **Cache Inteligente**: Sistema de cache em memória com TTL configurável
- **Logging Avançado**: Sistema de logs estruturados para monitoramento
- **Health Checks**: Endpoints para monitoramento de saúde da aplicação
- **Rate Limiting**: Proteção contra abuso de recursos
- **Tratamento de Erros**: Sistema robusto de tratamento e logging de erros

## 📊 Dados Disponíveis

### Commodities (CBOT)
- **Soja (ZS)**: Contratos futuros com vencimentos diversos
- **Milho (ZC)**: Contratos futuros com vencimentos diversos

### Câmbio (B3)
- **USD/BRL**: Dólar comercial
- **EUR/BRL**: Euro comercial

### Informações por Contrato
- Último preço, ajuste, máximo, mínimo
- Abertura, fechamento anterior
- Contratos abertos, contratos negociados
- Variações: diária, mensal (%), anual (%)

## 🛠 Tecnologias

- **Framework**: Next.js 15.2.4 com App Router
- **Linguagem**: TypeScript 5.0
- **Banco de Dados**: Redis (Upstash)
- **UI**: Tailwind CSS + Radix UI
- **Geração de Imagens**: @vercel/og
- **Validação**: Zod
- **Logging**: Sistema customizado com contexto

## 📋 Pré-requisitos

- Node.js 18.0+
- pnpm (recomendado) ou npm
- Redis instance (Upstash recomendado)

## ⚙️ Instalação

1. **Clone o repositório**
```bash
git clone <repository-url>
cd market-data-api
```

2. **Instale as dependências**
```bash
pnpm install
```

3. **Configure as variáveis de ambiente**
```bash
cp .env.example .env.local
```

Edite `.env.local`:
```env
# Redis Configuration
REDIS_URL=your_redis_url_here
REDIS_PASSWORD=your_redis_password_here

# Application Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=Market Data API
NEXT_PUBLIC_APP_VERSION=1.0.0

# API Configuration
API_RATE_LIMIT_REQUESTS=100
API_RATE_LIMIT_WINDOW_MS=900000

# Monitoring
ENABLE_LOGGING=true
LOG_LEVEL=info

# Security
CORS_ORIGINS=*
API_SECRET_KEY=your_secret_key_here
```

4. **Execute a aplicação**
```bash
# Desenvolvimento
pnpm dev

# Produção
pnpm build
pnpm start
```

## 🔌 Endpoints da API

### Health Check
```http
GET /api/health
```
Retorna status de saúde da aplicação, Redis e cache.

**Resposta:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-09T15:30:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "redis": { "status": "pass", "duration": 45 },
    "cache": { "status": "pass", "details": {...} },
    "memory": { "status": "pass", "details": {...} }
  }
}
```

### Dados de Mercado (JSON)
```http
GET /api/v1/market-data?cache=false
```

**Parâmetros de Query:**
- `cache` (opcional): `false` para bypass do cache

**Resposta:**
```json
{
  "error": false,
  "message": "Success",
  "soybean": [...],
  "corn": [...],
  "currency": {
    "dollar": { "symbol": "DOL", "lastPrice": "5.45", ... },
    "euro": { "symbol": "EUR", "lastPrice": "5.85", ... }
  },
  "timestamp": "2024-01-09T15:30:00.000Z"
}
```

### Imagens das Tabelas (Principal)
```http
GET /api/v1/market-tables
```

**Resposta:**
```json
{
  "tabelas": {
    "base64_soja": "iVBORw0KGgoAAAANS...",
    "base64_milho": "iVBORw0KGgoAAAANS..."
  },
  "timestamp": "2024-01-09T15:30:00.000Z"
}
```

### Versículos Bíblicos
```http
GET /api/verse
```

### Contador de Requisições
```http
GET /api/count
```

## 📈 Uso para WhatsApp

A API foi projetada para integração com bots de WhatsApp:

```javascript
// Exemplo de uso
const response = await fetch('https://your-api.com/api/v1/market-tables')
const data = await response.json()

// Enviar imagens para WhatsApp
const sojaImage = Buffer.from(data.tabelas.base64_soja, 'base64')
const milhoImage = Buffer.from(data.tabelas.base64_milho, 'base64')

// Use sua biblioteca de WhatsApp preferida
await whatsapp.sendImage(chatId, sojaImage, 'Cotação Soja CBOT')
await whatsapp.sendImage(chatId, milhoImage, 'Cotação Milho CBOT')
```

## 🏗 Arquitetura

```
market-data-api/
├── app/
│   ├── api/
│   │   ├── health/         # Health checks
│   │   ├── v1/
│   │   │   ├── market-data/    # Dados JSON
│   │   │   └── market-tables/  # Geração de imagens
│   │   ├── verse/          # Versículos
│   │   └── count/          # Contador
│   ├── layout.tsx          # Layout principal
│   └── page.tsx           # Interface web
├── lib/
│   ├── config.ts          # Configurações centralizadas
│   ├── logger.ts          # Sistema de logging
│   ├── error-handler.ts   # Tratamento de erros
│   ├── cache.ts           # Sistema de cache
│   ├── validation.ts      # Esquemas de validação
│   └── redis-client.ts    # Cliente Redis
└── components/            # Componentes React
```

## 🔧 Configurações

### Cache
- **TTL Padrão**: 5 minutos
- **TTL Imagens**: 10 minutos
- **Tamanho Máximo**: 500 entradas

### Logging
- **Desenvolvimento**: Logs coloridos no console
- **Produção**: Logs estruturados (JSON)
- **Níveis**: debug, info, warn, error

### Rate Limiting
- **Requests**: 100 por janela
- **Janela**: 15 minutos (900s)

## 📊 Monitoramento

### Métricas Disponíveis
- Status Redis (conectividade, latência)
- Status Cache (hit ratio, entradas expiradas)
- Uso de Memória (heap, RSS)
- Tempo de resposta das APIs
- Contadores de erro por tipo

### Logs Estruturados
```json
{
  "timestamp": "2024-01-09T15:30:00.000Z",
  "level": "INFO",
  "message": "API Request",
  "context": {
    "method": "GET",
    "path": "/api/v1/market-data",
    "duration": "245ms",
    "statusCode": 200
  }
}
```

## 🚀 Deploy

### Vercel (Recomendado)

**Deploy em 5 minutos:**

1. **Prepare o Redis (Upstash)**
   ```bash
   # Crie uma conta gratuita em https://upstash.com
   # Anote REDIS_URL e REDIS_PASSWORD
   ```

2. **Deploy na Vercel**
   ```bash
   # Método 1: Dashboard (mais fácil)
   # 1. Acesse vercel.com/new
   # 2. Import seu repositório GitHub
   # 3. Configure environment variables
   # 4. Deploy!
   
   # Método 2: CLI
   npm i -g vercel
   vercel login
   vercel --prod
   ```

3. **Variáveis de Ambiente Obrigatórias**
   ```env
   REDIS_URL=https://your-redis.upstash.io
   REDIS_PASSWORD=your_password
   NODE_ENV=production
   ENABLE_LOGGING=true
   LOG_LEVEL=info
   ```

4. **Teste o Deploy**
   ```bash
   curl https://your-app.vercel.app/api/health
   ```

📖 **Guia completo**: Ver `VERCEL_DEPLOY.md`

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables para Produção
```env
NODE_ENV=production
REDIS_URL=redis://your-production-redis
REDIS_PASSWORD=your-secure-password
API_SECRET_KEY=your-secure-api-key
ENABLE_LOGGING=true
LOG_LEVEL=info
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 📞 Suporte

- **Issues**: [GitHub Issues](link-to-issues)
- **Email**: your-email@domain.com
- **Documentação**: [API Docs](link-to-docs)

## 🔗 Links Úteis

- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel OG Documentation](https://vercel.com/docs/functions/edge-functions/og-image-generation)
- [Upstash Redis](https://upstash.com/)
- [Tailwind CSS](https://tailwindcss.com/)

---

**Market Data API** - Desenvolvido com ❤️ para o agronegócio brasileiro 