import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'dashboard.db');

const db = new Database(DB_PATH);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS investments (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    name TEXT,
    shares REAL NOT NULL,
    avgPrice REAL NOT NULL,
    currency TEXT,
    exchange TEXT,
    marketType TEXT NOT NULL,
    category TEXT,
    purchaseDate TEXT,
    targetWeight REAL
  );

  CREATE TABLE IF NOT EXISTS allocations (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    value REAL NOT NULL,
    currency TEXT NOT NULL,
    targetWeight REAL NOT NULL,
    details TEXT -- JSON string
  );

  CREATE TABLE IF NOT EXISTS history (
    date TEXT PRIMARY KEY,
    totalValue REAL NOT NULL,
    snapshotValue REAL,
    manualAdjustment REAL,
    exchangeRate REAL,
    holdings TEXT, -- JSON string
    allocations TEXT -- JSON string
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    symbol TEXT,
    amount REAL NOT NULL,
    shares REAL,
    price REAL,
    currency TEXT NOT NULL,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS currency_rates (
    date TEXT PRIMARY KEY,
    rate REAL NOT NULL,
    base_currency TEXT DEFAULT 'USD',
    target_currency TEXT DEFAULT 'KRW'
  );
`);

export default db;
