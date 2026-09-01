const memory = new Map<string, { value: unknown; expires: number }>()

export function cacheGet(key: string) {
  const item = memory.get(key)

  if (!item) return undefined

  if (Date.now() > item.expires) {
    memory.delete(key)
    return undefined
  }

  return item.value
}

export function cacheSet(
  key: string,
  value: unknown,
  ttlMs = 300000
) {
  memory.set(key, {
    value,
    expires: Date.now() + ttlMs
  })
}
