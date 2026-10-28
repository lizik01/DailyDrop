import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const globalForDb = globalThis as unknown as { sql?: postgres.Sql }

// prepare: false so it also works through Neon's pooled (PgBouncer) connection string on Vercel.
const sql = globalForDb.sql ?? postgres(process.env.DATABASE_URL!, { max: 10, prepare: false })
if (process.env.NODE_ENV !== 'production') globalForDb.sql = sql

export const db = drizzle(sql, { schema })
export * from './schema'
