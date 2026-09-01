import { json, rateLimit } from './_shared/http'
export default async (req:Request)=>{
  if(rateLimit(req,120)) return json({ok:false,error:'Rate limit exceeded'},429)
  return json({ok:true,name:'Gold Signal Pro',marketDataConfigured:Boolean(process.env.MARKET_DATA_API_KEY&&process.env.MARKET_DATA_PROVIDER),marketDataProvider:process.env.MARKET_DATA_PROVIDER||null,forexFactoryConfigured:Boolean(process.env.FOREX_FACTORY_FEED_URL||true),pushConfigured:Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT),vapidPublicKey:process.env.VAPID_PUBLIC_KEY||null,timeZone:process.env.APP_TIMEZONE||'Asia/Kuala_Lumpur',database:'Netlify Database / managed Postgres'})
}
