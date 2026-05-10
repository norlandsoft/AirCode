import Database from 'better-sqlite3'
import { app, mkdirSync } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

let db: Database.Database | null = null

function getDbPath(): string {
  const dir = app.getPath('userData')
  return join(dir, 'aircode.db')
}

function ensureDir(filePath: string): void {
  const dir = filePath.substring(0, filePath.lastIndexOf('/'))
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

export function getDb(): Database.Database {
  if (db) return db

  const dbPath = getDbPath()
  ensureDir(dbPath)
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  migrate(db)
  return db
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
