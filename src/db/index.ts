import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type DbInstance = PostgresJsDatabase<typeof schema>

const globalForDb = globalThis as typeof globalThis & {
  __seedanceDb?: DbInstance
  __seedancePg?: ReturnType<typeof postgres>
}

function createDb(): DbInstance {
  const connectionString = process.env.DATABASE_URL?.trim()
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL 环境变量未设置，请在 .env.local 中配置 PostgreSQL 连接（参考 .env.example）',
    )
  }

  const client = postgres(connectionString, { max: 10 })
  globalForDb.__seedancePg = client
  return drizzle(client, { schema })
}

export function getDb(): DbInstance {
  if (!globalForDb.__seedanceDb)
    globalForDb.__seedanceDb = createDb()
  return globalForDb.__seedanceDb
}

export const db = getDb()

export type Db = typeof db
