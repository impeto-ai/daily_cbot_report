import { z } from 'zod'

// Market Data Schemas
export const MarketDataSchema = z.object({
  symbol: z.string(),
  lastPrice: z.string(),
  adjustment: z.string(),
  change: z.union([z.string(), z.number()]),
  monthChange: z.union([z.string(), z.number()]),
  yearChange: z.union([z.string(), z.number()]),
  volume: z.union([z.string(), z.number()]),
  contractsTraded: z.union([z.string(), z.number()]),
  high: z.string(),
  low: z.string(),
  open: z.string(),
  close: z.string(),
  lastUpdate: z.union([z.string(), z.number()]),
  expirationDate: z.string(),
  timestamp: z.number(),
})

export const CurrencyDataSchema = z.object({
  symbol: z.string(),
  lastPrice: z.string(),
  change: z.string(),
  percentChange: z.string(),
  lastUpdate: z.union([z.string(), z.number()]),
})

export const ApiResponseSchema = z.object({
  error: z.boolean(),
  message: z.string(),
  soybean: z.array(MarketDataSchema),
  corn: z.array(MarketDataSchema),
  currency: z.object({
    dollar: CurrencyDataSchema.nullable(),
    euro: CurrencyDataSchema.nullable(),
  }),
  timestamp: z.string(),
})

export const MarketTablesResponseSchema = z.object({
  tabelas: z.object({
    base64_soja: z.string(),
    base64_milho: z.string(),
  }),
  timestamp: z.string(),
})

// Request validation schemas
export const QueryParamsSchema = z.object({
  symbol: z.enum(['ZS', 'ZC']).optional(),
  format: z.enum(['json', 'image']).optional(),
  cache: z.enum(['true', 'false']).optional(),
})

// Environment validation
export const EnvironmentSchema = z.object({
  REDIS_URL: z.string().url(),
  REDIS_PASSWORD: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_SECRET_KEY: z.string().optional(),
  ENABLE_LOGGING: z.enum(['true', 'false']).default('true'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

// Validation utility functions
export function validateMarketData(data: unknown): z.infer<typeof MarketDataSchema> {
  return MarketDataSchema.parse(data)
}

export function validateCurrencyData(data: unknown): z.infer<typeof CurrencyDataSchema> {
  return CurrencyDataSchema.parse(data)
}

export function validateApiResponse(data: unknown): z.infer<typeof ApiResponseSchema> {
  return ApiResponseSchema.parse(data)
}

export function validateQueryParams(params: unknown): z.infer<typeof QueryParamsSchema> {
  return QueryParamsSchema.parse(params)
}

export function validateEnvironment(env: unknown): z.infer<typeof EnvironmentSchema> {
  return EnvironmentSchema.parse(env)
}

// Safe validation (returns result with success flag)
export function safeValidateMarketData(data: unknown) {
  return MarketDataSchema.safeParse(data)
}

export function safeValidateCurrencyData(data: unknown) {
  return CurrencyDataSchema.safeParse(data)
}

export function safeValidateApiResponse(data: unknown) {
  return ApiResponseSchema.safeParse(data)
}

// Type exports
export type MarketData = z.infer<typeof MarketDataSchema>
export type CurrencyData = z.infer<typeof CurrencyDataSchema>
export type ApiResponse = z.infer<typeof ApiResponseSchema>
export type MarketTablesResponse = z.infer<typeof MarketTablesResponseSchema>
export type QueryParams = z.infer<typeof QueryParamsSchema>
export type Environment = z.infer<typeof EnvironmentSchema> 