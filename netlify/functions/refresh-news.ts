import type { Config } from '@netlify/functions'; import { fetchForexFactory } from './_shared/news'
export default async()=>{try{const data=await fetchForexFactory(true);console.log(JSON.stringify({event:'news_refresh',count:data.events.length,at:data.fetchedAt}));}catch(e){console.error(JSON.stringify({event:'news_refresh_failed',message:e instanceof Error?e.message:'unknown'}))}}
export const config:Config={schedule:'*/15 * * * *'}
