import { z } from 'zod'

const envSchema = z.object({
  JWT_SECRET: z.string().min(1, 'JWT_SECRET 未配置，请通过 wrangler secret put JWT_SECRET 设置。'),
})

type EnvVars = z.infer<typeof envSchema>

export function validateEnv(env: Partial<{ JWT_SECRET?: string }>): EnvVars {
  const result = envSchema.safeParse(env)
  if (!result.success) {
    const msg = result.error.errors[0]?.message || 'Environment variable validation failed'
    throw new Error(msg)
  }
  return result.data
}
