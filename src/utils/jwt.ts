/**
 * JWT 工具 - 使用 Web Crypto API
 *
 * Cloudflare Workers 中 process 对象不存在，JWT_SECRET 需要通过 c.env.JWT_SECRET 获取。
 * 调用方应将 secret 通过 signToken/verifyToken 的 options/secret 参数传入。
 */

const DEFAULT_SECRET = 'sun-panel-jwt-secret-key-change-in-production'

function getSecretKey(customSecret?: string): string {
  // 优先使用调用方传入的 secret（从 c.env.JWT_SECRET 获取）
  if (customSecret) return customSecret
  // 回退到默认值，仅用于开发环境
  return DEFAULT_SECRET
}

async function getKey(secret?: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(getSecretKey(secret))
  return crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** JWT 载荷类型 */
export interface JwtPayload {
  userId: number
  username: string
  role: number
  iat?: number
  exp?: number
  [key: string]: unknown
}

/** JWT 签名选项 */
export interface SignOptions {
  secret?: string
  expiresInSeconds?: number
}

export async function signToken(payload: Record<string, unknown>, options: SignOptions = {}): Promise<string> {
  const key = await getKey(options.secret)
  const encoder = new TextEncoder()

  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = options.expiresInSeconds ?? 7 * 24 * 60 * 60

  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  }

  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)).buffer as ArrayBuffer)
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(fullPayload)).buffer as ArrayBuffer)
  const signingInput = `${headerB64}.${payloadB64}`

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput))
  const signatureB64 = base64UrlEncode(signature)

  return `${signingInput}.${signatureB64}`
}

export async function verifyToken(token: string, secret?: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const key = await getKey(secret)
    const encoder = new TextEncoder()
    const signingInput = `${parts[0]}.${parts[1]}`
    const signature = base64UrlDecode(parts[2])

    const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(signingInput))
    if (!valid) return null

    const payloadBytes = base64UrlDecode(parts[1])
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes))

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
