import { getConnectionString } from '@netlify/database'
import postgres from 'postgres'

let sqlClient: ReturnType<typeof postgres> | null = null
export function db(){
  if(!sqlClient) sqlClient=postgres(getConnectionString(),{max:3,idle_timeout:20,connect_timeout:10})
  return sqlClient
}
