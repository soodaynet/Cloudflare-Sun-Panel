import { z } from 'zod'

const envSchema = z.object({
  JWT_SECRET: z.string().optional(),
})

export type EnvVars = z.infer<typeof envSchema>

export function validateEnv(env: Partial<{ JWT_SECRET?: string }>) {
  const result = envSchema.safeParse(env)
  if (!result.success) {
    console.warn('[Env] Environment variable validation warnings:', result.error.format())
  }
  return result.data
}
