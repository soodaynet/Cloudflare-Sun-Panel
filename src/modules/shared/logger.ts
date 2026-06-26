/**
 * 轻量级日志工具 — 统一日志输出，生产环境可配置日志级别
 *
 * 替代裸 console.log/error，支持：
 * - 生产环境自动过滤 debug 日志
 * - 统一日志格式 `[module] message`
 * - 错误日志包含堆栈信息
 *
 * @example
 * ```ts
 * import { logger } from './utils/logger'
 * logger.info('DB', 'Initialized successfully')
 * logger.error('Auth', 'Token verification failed', err)
 * ```
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/** 生产环境最低日志级别 */
const MIN_LEVEL: LogLevel = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') ? 'info' : 'debug'

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL]
}

function format(module: string, message: string): string {
  return `[${module}] ${message}`
}

export const logger = {
  debug(module: string, message: string, ...args: unknown[]): void {
    if (shouldLog('debug')) {
      console.debug(format(module, message), ...args)
    }
  },

  info(module: string, message: string, ...args: unknown[]): void {
    if (shouldLog('info')) {
      console.info(format(module, message), ...args)
    }
  },

  warn(module: string, message: string, ...args: unknown[]): void {
    if (shouldLog('warn')) {
      console.warn(format(module, message), ...args)
    }
  },

  error(module: string, message: string, err?: unknown): void {
    if (shouldLog('error')) {
      if (err instanceof Error) {
        console.error(`${format(module, message)}: ${err.message}`, err.stack)
      } else if (err !== undefined) {
        console.error(format(module, message), err)
      } else {
        console.error(format(module, message))
      }
    }
  },
}
