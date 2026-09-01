const memoryCache = new Map<string, {
  value: unknown
  expires: number
}>()

export function cacheGet<T>(key: string): T | undefined {
  const item = memoryCache.get(key)

  if (!item) {
    return undefined
  }

  if (Date.now() > item.expires) {
    memoryCache.delete(key)
    return undefined
  }

  return item.value as T
}


export function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds = 300
): void {

  memoryCache.set(key, {
    value,
    expires: Date.now() + ttlSeconds * 1000
  })

}


export function cacheDelete(key: string): void {
  memoryCache.delete(key)
}


export function cacheClear(): void {
  memoryCache.clear()
}
