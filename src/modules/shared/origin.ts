export function isAllowedOrigin(origin: string, host: string): boolean {
  if (!origin) return false

  try {
    const originUrl = new URL(origin)
    const originHost = originUrl.hostname

    // Allow localhost with any port (development)
    if (originHost === 'localhost' || originHost === '127.0.0.1') {
      return true
    }

    // Allow same origin (production)
    if (originHost === host) {
      return true
    }

    return false
  } catch {
    return false
  }
}
