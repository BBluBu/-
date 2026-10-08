const DATABASE = 'campus-login-background'
const STORE = 'images'
const KEY = 'custom'
const ENABLED_KEY = 'campus-login:background-enabled'

export function loadBackgroundEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) !== 'false' } catch { return true }
}

export function saveBackgroundEnabled(enabled: boolean): boolean {
  try { localStorage.setItem(ENABLED_KEY, String(enabled)); return true } catch { return false }
}

async function accessBackground(write: boolean, image?: Blob | null): Promise<Blob | null> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('背景存储暂不可用'))
  })
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = database.transaction(STORE, write ? 'readwrite' : 'readonly')
      const store = transaction.objectStore(STORE)
      const request = write ? (image ? store.put(image, KEY) : store.delete(KEY)) : store.get(KEY)
      transaction.oncomplete = () => resolve(!write && request.result instanceof Blob ? request.result : null)
      transaction.onabort = () => reject(transaction.error)
      transaction.onerror = () => reject(transaction.error)
    })
  } finally { database.close() }
}

export const loadCustomBackground = (): Promise<Blob | null> => accessBackground(false)
export const saveCustomBackground = (image: Blob | null): Promise<Blob | null> => accessBackground(true, image)

export async function validateBackground(image: Blob): Promise<void> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(image.type)) throw new Error('请选择 PNG、JPG 或 WebP 图片。')
  if (image.size > 10 * 1024 * 1024) throw new Error('图片不能超过 10 MB，请换一张较小的图片。')
  try {
    const bitmap = await createImageBitmap(image)
    const pixels = bitmap.width * bitmap.height
    bitmap.close()
    if (pixels > 40_000_000) throw new Error('too large')
  } catch { throw new Error('图片无法读取或尺寸过大，请换一张图片。') }
}
