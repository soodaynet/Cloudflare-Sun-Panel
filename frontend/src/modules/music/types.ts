/** 音乐数据源 */
export type MusicServer = 'netease' | 'tencent' | 'kugou' | 'baidu' | 'kuwo'

/** 资源类型：单曲或歌单 */
export type MusicType = 'song' | 'playlist'

/** 音乐解析请求参数 */
export interface MusicParseParams {
  server: MusicServer
  type: MusicType
  id: string
  /** Meting API 地址 */
  apiUrl: string
}

/** 标准化音乐曲目（与后端 MusicTrack 对齐） */
export interface MusicTrack {
  id: string
  name: string
  artist: string
  album: string
  url: string
  pic: string
  source: string
}
