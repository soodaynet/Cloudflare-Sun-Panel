import type { MusicParseParams, MusicTrack } from './types'

/** 请求超时（毫秒） */
const FETCH_TIMEOUT = 3000
/** 最多解析曲目数 */
const MAX_TRACKS = 50
/** 单批并发数 */
const BATCH_SIZE = 10

/** Meting API 原始曲目项（字段可能缺失） */
interface RawMetingItem {
  id?: string | number
  name?: string
  artist?: string
  album?: string
  url_id?: string | number
  pic_id?: string | number
  /** 部分上游直接在列表项中返回 url，无需二次抓取 */
  url?: string
  /** 部分上游直接在列表项中返回 pic，无需二次抓取 */
  pic?: string
}

/** 带 3s 超时的 GET fetch */
async function fetchWithTimeout(url: string, ms = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { method: 'GET', signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/** 解析 url/pic 响应文本：去除首尾引号与空白 */
function parseMediaUrl(text: string): string {
  return text.trim().replace(/^["']|["']$/g, '')
}

/** 判断值是否为有效的曲目 ID：非空字符串或非空数字（排除 null/undefined/空串） */
function isValidId(v: unknown): boolean {
  if (v == null) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (typeof v === 'number') return !Number.isNaN(v)
  return false
}

/** https 页面下将 http:// 资源升级为 https://，避免 mixed content */
function upgradeProtocol(url: string): string {
  if (typeof window === 'undefined') return url
  if (window.location.protocol !== 'https:') return url
  if (!url) return url
  return url.replace(/^http:\/\//i, 'https://')
}

/**
 * 直连 Meting API 解析歌单/单曲为可播放曲目列表。
 * 不走后端代理，浏览器直连上游。解析逻辑（列表 → 每首 url/pic）全部在前端完成。
 * 返回裸 MusicTrack[]（不再包装为 { code, msg, data }）。
 */
export async function parseMusic(params: MusicParseParams): Promise<MusicTrack[]> {
  const { server, type, id, apiUrl } = params
  // 1. 抓取曲目列表
  const listType = type === 'playlist' ? 'playlist' : 'single'
  const listUrl = `${apiUrl}?server=${server}&type=${listType}&id=${id}`
  const listRes = await fetchWithTimeout(listUrl)
  if (!listRes.ok) throw new Error(`歌单解析失败: ${listRes.status}`)
  const list = await listRes.json()
  if (!Array.isArray(list)) return []
  const top: RawMetingItem[] = list.slice(0, MAX_TRACKS)

  // 2. 分批并发抓取每首 url 与 pic，单首失败置空串
  const tracks: MusicTrack[] = []
  for (let i = 0; i < top.length; i += BATCH_SIZE) {
    const batch = top.slice(i, i + BATCH_SIZE)
    // 跳过完全空项：所有标识/直链均缺失
    const validBatch = batch.filter(
      item => isValidId(item.id) || isValidId(item.url_id) || isValidId(item.pic_id) || item.url || item.pic,
    )
    const results = await Promise.allSettled(
      validBatch.map(async (item): Promise<MusicTrack> => {
        const urlId = item.url_id ?? item.id
        const picId = item.pic_id ?? item.id

        // 列表项直接含 url：直接用，无需二次抓取
        let url = ''
        if (item.url) {
          url = upgradeProtocol(item.url)
        } else if (isValidId(urlId)) {
          // 需要二次抓取 url
          try {
            const res = await fetchWithTimeout(`${apiUrl}?server=${server}&type=url&id=${urlId}`)
            if (res.ok) {
              const text = parseMediaUrl(await res.text())
              // 响应为空串或错误指示时，不作为有效 URL
              if (text && text !== 'no url_id' && !text.startsWith('error')) {
                url = upgradeProtocol(text)
              }
            }
          } catch (e) {
            // 仅实际 fetch 失败时 warn
            console.warn(`[music] url fetch failed (id=${urlId}):`, e)
          }
        }
        // urlId 为 undefined 时不 reject、不 warn，url 保持空串

        // 列表项直接含 pic：直接用，无需二次抓取
        let pic = ''
        if (item.pic) {
          pic = upgradeProtocol(item.pic)
        } else if (isValidId(picId)) {
          try {
            const res = await fetchWithTimeout(`${apiUrl}?server=${server}&type=pic&id=${picId}`)
            if (res.ok) {
              const text = parseMediaUrl(await res.text())
              if (text && text !== 'no url_id' && !text.startsWith('error')) {
                pic = upgradeProtocol(text)
              }
            }
          } catch (e) {
            console.warn(`[music] pic fetch failed (id=${picId}):`, e)
          }
        }

        return {
          id: String(item.id ?? ''),
          name: item.name ?? '',
          artist: item.artist ?? '',
          album: item.album ?? '',
          url,
          pic,
          source: server,
        }
      }),
    )
    for (const r of results) {
      if (r.status === 'fulfilled') {
        // 跳过 url 与 pic 均为空的无效曲目
        if (r.value.url || r.value.pic) {
          tracks.push(r.value)
        }
      } else {
        console.warn('[music] track parse rejected:', r.reason)
      }
    }
  }
  return tracks
}
