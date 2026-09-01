import { getStore } from '@netlify/blobs'
export const cacheStore=()=>getStore('gold-signal-pro-cache')
export async function cacheGet<T>(key:string):Promise<T|null>{try{return await cacheStore().get(key,{type:'json'}) as T|null}catch{return null}}
export async function cacheSet(key:string,value:unknown){try{await cacheStore().setJSON(key,value)}catch(e){console.warn('cache write failed',e instanceof Error?e.message:'unknown')}}
