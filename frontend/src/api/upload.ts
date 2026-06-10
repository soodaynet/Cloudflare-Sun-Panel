/**
 * 上传图片到 R2 存储
 * 返回 { url: '/media/...' } 或报错
 */
export async function uploadImage(file: File): Promise<{ code: number; msg: string; data: { url: string } }> {
  const formData = new FormData()
  formData.append('file', file)

  const token = localStorage.getItem('sun-panel-token')
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`/api/upload/image`, {
    method: 'POST',
    body: formData,
    headers,
  })

  const data = await res.json() as { code: number; msg: string; data: { url: string } }
  return data
}