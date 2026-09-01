const memoryCache = new Map<string, {
  value: unknown
  expires: number
}>()

export function cacheGet(key: string) {
  const item = memoryCache.get(key)

  if (!item) {
    return undefined
  }

  if (Date.now() > item.expires) {
    memoryCache.delete(key)
    return undefined
  }

  return item.value
}


export function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = 300
) {
  memoryCache.set(key, {
    value,
    expires: Date.now() + ttlSeconds * 1000
  })
}


export function cacheDelete(key: string) {
  memoryCache.delete(key)
}


export function cacheClear() {
  memoryCache.clear()
}
