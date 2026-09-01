const store = new Map<string, {value:any, expires:number}>()

export function getCache<T>(key:string):T|undefined{
  const item = store.get(key)

  if(!item) return undefined

  if(Date.now() > item.expires){
    store.delete(key)
    return undefined
  }

  return item.value as T
}


export function setCache<T>(
  key:string,
  value:T,
  ttlMs:number = 300000
){
  store.set(key,{
    value,
    expires:Date.now()+ttlMs
  })
}


export function clearCache(key?:string){
  if(key){
    store.delete(key)
  }else{
    store.clear()
  }
}
