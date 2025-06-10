# 🚀 Deploy na Vercel - Guia Completo

Este guia te ajudará a fazer o deploy da **Market Data API** na Vercel de forma rápida e profissional.

## ✅ Pré-requisitos

- Conta na [Vercel](https://vercel.com)
- Repositório Git (GitHub, GitLab, ou Bitbucket)
- Redis instance na [Upstash](https://upstash.com) (recomendado)

## 🔧 Configuração do Redis (Upstash)

1. **Crie uma conta na Upstash**
   - Acesse [https://upstash.com](https://upstash.com)
   - Cadastre-se gratuitamente

2. **Crie um banco Redis**
   - Clique em "Create Database"
   - Nome: `market-data-api`
   - Região: `us-east-1` (ou mais próxima)
   - Tipo: `Regional` (gratuito)

3. **Anote as credenciais**
   ```
   UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your_token_here
   ```

## 📦 Deploy na Vercel

### Método 1: Via Dashboard (Recomendado)

1. **Acesse o Dashboard da Vercel**
   - Vá para [vercel.com/dashboard](https://vercel.com/dashboard)
   - Clique em "Add New Project"

2. **Import do Repositório**
   - Conecte sua conta Git (GitHub/GitLab)
   - Selecione o repositório da `market-data-api`
   - Clique em "Import"

3. **Configure o Projeto**
   - **Framework Preset**: Next.js (detectado automaticamente)
   - **Root Directory**: `.` (raiz)
   - **Build Command**: `npm run build` (padrão)
   - **Output Directory**: `.next` (padrão)
   - **Install Command**: `npm install` (padrão)

4. **Configure as Variáveis de Ambiente**
   - Clique em "Environment Variables"
   - Adicione as seguintes variáveis:

   ```env
   # Redis Configuration (Upstash)
   REDIS_URL=https://your-redis-url.upstash.io
   REDIS_PASSWORD=your_redis_password_here
   
   # Application Configuration
   NODE_ENV=production
   NEXT_PUBLIC_APP_NAME=Market Data API
   NEXT_PUBLIC_APP_VERSION=1.0.0
   
   # Monitoring
   ENABLE_LOGGING=true
   LOG_LEVEL=info
   
   # Security (opcional)
   API_SECRET_KEY=your_secure_random_key_here
   CORS_ORIGINS=*
   ```

5. **Deploy**
   - Clique em "Deploy"
   - Aguarde o build completar (≈2-3 minutos)

### Método 2: Via CLI

```bash
# 1. Instale a Vercel CLI
npm i -g vercel

# 2. Login na Vercel
vercel login

# 3. Configure o projeto
vercel

# 4. Configure environment variables
vercel env add REDIS_URL
vercel env add REDIS_PASSWORD
# ... adicione todas as outras variáveis

# 5. Deploy para produção
vercel --prod
```

## 🔍 Verificação do Deploy

Após o deploy, teste os endpoints:

### 1. Health Check
```bash
curl https://your-app.vercel.app/api/health
```

**Resposta esperada:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-09T15:30:00.000Z",
  "version": "1.0.0",
  "checks": {
    "redis": {"status": "pass"},
    "cache": {"status": "pass"},
    "memory": {"status": "pass"}
  }
}
```

### 2. Dados de Mercado
```bash
curl https://your-app.vercel.app/api/v1/market-data
```

### 3. Imagens das Tabelas (Principal)
```bash
curl https://your-app.vercel.app/api/v1/market-tables
```

## ⚙️ Configurações Avançadas

### Custom Domain

1. **No Dashboard da Vercel**
   - Vá para o projeto → Settings → Domains
   - Adicione seu domínio: `api.seudominio.com`
   - Configure os DNS conforme instruções

### Environment Variables por Ambiente

```bash
# Production
vercel env add REDIS_URL production
vercel env add LOG_LEVEL production

# Preview (staging)
vercel env add REDIS_URL preview
vercel env add LOG_LEVEL preview

# Development
vercel env add REDIS_URL development
```

### Build & Deploy Hooks

1. **Webhook para Auto-Deploy**
   - Settings → Git → Deploy Hooks
   - Copie a URL do webhook
   - Configure no seu repositório

2. **Build Command Customizado**
   ```json
   {
     "buildCommand": "npm run validate && npm run build"
   }
   ```

## 📊 Monitoramento na Vercel

### 1. Analytics
- Dashboard → Analytics
- Visualize requests, performance, top pages

### 2. Functions
- Dashboard → Functions
- Monitor execução das API routes
- Logs em tempo real

### 3. Speed Insights
- Habilite nas configurações
- Monitor Core Web Vitals

## 🐛 Troubleshooting

### Build Failures

1. **Erro de TypeScript**
   ```bash
   # Localmente, execute:
   npm run type-check
   npm run lint:fix
   ```

2. **Missing Environment Variables**
   ```
   Error: Redis configuration is missing
   ```
   - Verifique se `REDIS_URL` e `REDIS_PASSWORD` estão configurados
   - Teste localmente com as mesmas variáveis

3. **Redis Connection Failed**
   ```
   Error: Redis connection failed
   ```
   - Verifique se o Redis Upstash está ativo
   - Confirme as credenciais
   - Teste a conectividade: `curl $REDIS_URL/ping`

### Runtime Errors

1. **Function Timeout**
   ```
   Task timed out after 10.00 seconds
   ```
   - Otimize queries Redis
   - Implemente cache mais agressivo
   - Considere upgrade do plano Vercel

2. **Memory Limit**
   - Monitor no dashboard Functions
   - Otimize geração de imagens
   - Limpe cache periodicamente

## 💰 Custos na Vercel

### Free Tier (Hobby)
- ✅ **100GB** bandwidth
- ✅ **100** serverless functions executions/day
- ✅ **10s** function execution time
- ✅ Domínios customizados

### Pro Tier ($20/mês)
- ✅ **1TB** bandwidth
- ✅ **1000** serverless functions executions/day
- ✅ **60s** function execution time
- ✅ Analytics avançados

## 🔧 Otimizações para Produção

### 1. Edge Runtime (Opcional)
```typescript
// app/api/v1/market-data/route.ts
export const runtime = 'edge' // Mais rápido, menos features
```

### 2. ISR (Incremental Static Regeneration)
```typescript
// Para dados que mudam pouco
export const revalidate = 300 // 5 minutos
```

### 3. Caching Headers
```typescript
// Já implementado nas APIs
headers: {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-Response-Time': `${duration}ms`,
}
```

## 📱 Exemplo de Uso WhatsApp

Após o deploy, use a API no seu bot:

```javascript
// Bot WhatsApp - Envio diário de cotações
const API_URL = 'https://your-app.vercel.app'

async function enviarCotacoes(chatId) {
  try {
    // Buscar imagens
    const response = await fetch(`${API_URL}/api/v1/market-tables`)
    const data = await response.json()
    
    // Converter base64 para buffer
    const sojaImage = Buffer.from(data.tabelas.base64_soja, 'base64')
    const milhoImage = Buffer.from(data.tabelas.base64_milho, 'base64')
    
    // Enviar para WhatsApp
    await client.sendMessage(chatId, MessageMedia.fromBuffer(sojaImage, 'soja.png', 'Cotação Soja CBOT'))
    await client.sendMessage(chatId, MessageMedia.fromBuffer(milhoImage, 'milho.png', 'Cotação Milho CBOT'))
    
    console.log('Cotações enviadas com sucesso!')
  } catch (error) {
    console.error('Erro ao enviar cotações:', error)
  }
}

// Agendar envio diário às 8h
cron.schedule('0 8 * * *', () => {
  enviarCotacoes('grupo@c.us')
})
```

## 🎯 Próximos Passos

1. ✅ Deploy realizado
2. ✅ Health check funcionando
3. ✅ Domínio customizado configurado
4. 🔄 Integração com bot WhatsApp
5. 📊 Monitoramento configurado
6. 🚨 Alertas de erro configurados

---

## 🚀 Deploy Rápido (TL;DR)

```bash
# 1. Crie Redis na Upstash
# 2. Fork/clone o repositório
# 3. Acesse vercel.com/new
# 4. Import repositório
# 5. Configure environment variables:
#    REDIS_URL, REDIS_PASSWORD, NODE_ENV=production
# 6. Deploy!
# 7. Teste: https://your-app.vercel.app/api/health
```

**🎉 Sua API estará funcionando em menos de 10 minutos!** 