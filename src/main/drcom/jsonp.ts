/** 只解析回调包装内的 JSON，不执行服务器返回的 JavaScript。 */
export function parseJsonp(text: string): unknown {
  const match = /^\s*[$A-Z_a-z][$\w]*(?:\.[$A-Z_a-z][$\w]*)*\s*\(([\s\S]*)\)\s*;?\s*$/.exec(text.replace(/^\uFEFF/, ''))
  if (!match) throw new Error('响应不是有效的 JSONP')
  return JSON.parse(match[1]) as unknown
}

export function parseResultResponse(text: string): 0 | 1 {
  const payload = parseJsonp(text)
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('响应必须是对象')
  }
  const result = (payload as Record<string, unknown>).result
  if (result === 1 || result === 0) return result
  throw new Error('响应缺少有效的 result 字段')
}

export function parseLoginResponse(text: string): { result: 0 | 1; uid?: string } {
  const result = parseResultResponse(text)
  const payload = parseJsonp(text) as Record<string, unknown>
  const uid = payload.uid
  return typeof uid === 'string' && uid.trim()
    ? { result, uid: uid.trim() }
    : { result }
}

export function parseStatusResponse(text: string): 'online' | 'offline' {
  return parseResultResponse(text) === 1 ? 'online' : 'offline'
}
