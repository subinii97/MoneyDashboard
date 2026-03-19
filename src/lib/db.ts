import Database from 'better-sqlite3';
import path from 'path';
import { SettlementMeta } from './types';

const DB_PATH = path.join(process.cwd(), 'data', 'dashboard.db');

// ── Singleton pattern ─────────────────────────────────────────────────────────
// Prevents multiple DB connections during Next.js dev hot-reloads.
declare global {
    var _db: Database.Database | undefined;
}

function createDb(): Database.Database {
    const instance = new Database(DB_PATH);

    instance.pragma('journal_mode = WAL');
    instance.pragma('synchronous = NORMAL');
    instance.pragma('temp_store = MEMORY');
    instance.pragma('cache_size = -2000');

    // ── Schema ────────────────────────────────────────────────────────────────
    instance.exec(`
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
        targetWeight REAL,
        tags TEXT
      );

      CREATE TABLE IF NOT EXISTS allocations (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        value REAL NOT NULL,
        currency TEXT NOT NULL,
        targetWeight REAL NOT NULL,
        details TEXT
      );

      CREATE TABLE IF NOT EXISTS history (
        date TEXT PRIMARY KEY,
        totalValue REAL NOT NULL,
        snapshotValue REAL,
        manualAdjustment REAL,
        exchangeRate REAL,
        holdings TEXT,
        allocations TEXT,
        meta TEXT
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
        notes TEXT,
        costBasis REAL
      );

      CREATE TABLE IF NOT EXISTS currency_rates (
        date TEXT PRIMARY KEY,
        rate REAL NOT NULL,
        base_currency TEXT DEFAULT 'USD',
        target_currency TEXT DEFAULT 'KRW'
      );

      CREATE TABLE IF NOT EXISTS memos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        date TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_investments_symbol ON investments(symbol);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_memos_date ON memos(date);
    `);

    // Migrations for existing databases
    try { instance.exec(`ALTER TABLE investments ADD COLUMN tags TEXT`); } catch { }
    try { instance.exec(`ALTER TABLE history ADD COLUMN meta TEXT`); } catch { }
    try { instance.exec(`ALTER TABLE transactions ADD COLUMN costBasis REAL`); } catch { }

    return instance;
}

// Reuse existing instance in dev, create fresh in production
if (!global._db) {
    global._db = createDb();
}
const db: Database.Database = global._db;

// ── JSON helpers ──────────────────────────────────────────────────────────────

const parseJSON = <T = unknown>(str: string | null): T | undefined => {
    if (!str) return undefined;
    try { return JSON.parse(str) as T; } catch { return undefined; }
};

const stringifyJSON = (val: unknown): string | null => {
    if (val === undefined || val === null) return null;
    return JSON.stringify(val);
};

// ── Prepared statements ───────────────────────────────────────────────────────
// Defined after schema creation — safe to reference all columns.

const stmts = {
    // Investments
    getAllInvestments: db.prepare('SELECT * FROM investments'),
    upsertInvestment: db.prepare(`
        INSERT OR REPLACE INTO investments
          (id, symbol, name, shares, avgPrice, currency, exchange, marketType, category, purchaseDate, targetWeight, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    deleteAllInvestments: db.prepare('DELETE FROM investments'),

    // Allocations
    getAllAllocations: db.prepare('SELECT * FROM allocations'),
    upsertAllocation: db.prepare(`
        INSERT OR REPLACE INTO allocations (id, category, value, currency, targetWeight, details)
        VALUES (?, ?, ?, ?, ?, ?)
    `),
    deleteAllAllocations: db.prepare('DELETE FROM allocations'),

    // History
    getHistoryByDate: db.prepare('SELECT * FROM history WHERE date = ?'),
    getAllHistory: db.prepare('SELECT * FROM history ORDER BY date ASC'),
    getHistoryInRange: db.prepare('SELECT * FROM history WHERE date >= ? AND date <= ? ORDER BY date ASC'),
    upsertHistory: db.prepare(`
        INSERT OR REPLACE INTO history
          (date, totalValue, snapshotValue, manualAdjustment, exchangeRate, holdings, allocations, meta)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    updateHistoryAdjustment: db.prepare(
        'UPDATE history SET manualAdjustment = ?, totalValue = ? WHERE date = ?'
    ),

    // Transactions
    getTransactionsByDate: db.prepare('SELECT * FROM transactions WHERE date = ? ORDER BY id DESC'),
    getTransactionsByTypeInRange: db.prepare(
        'SELECT * FROM transactions WHERE type = ? AND date >= ? AND date <= ? ORDER BY date ASC'
    ),
    getAllTransactions: db.prepare('SELECT * FROM transactions ORDER BY date DESC'),
    upsertTransaction: db.prepare(`
        INSERT OR REPLACE INTO transactions
          (id, date, type, symbol, amount, shares, price, currency, notes, costBasis)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    deleteTransaction: db.prepare('DELETE FROM transactions WHERE id = ?'),

    // Memos
    getAllMemos: db.prepare('SELECT * FROM memos ORDER BY date DESC'),
    getMemoById: db.prepare('SELECT * FROM memos WHERE id = ?'),
    upsertMemo: db.prepare('INSERT OR REPLACE INTO memos (id, title, content, date) VALUES (?, ?, ?, ?)'),
    deleteMemo: db.prepare('DELETE FROM memos WHERE id = ?'),

    // Currency rates
    getLatestRate: db.prepare('SELECT rate FROM currency_rates WHERE date = ?'),
    upsertRate: db.prepare('INSERT OR REPLACE INTO currency_rates (date, rate) VALUES (?, ?)'),
};

// ── Repository ────────────────────────────────────────────────────────────────

export const repo = {
    investments: {
        getAll: () => {
            try {
                return stmts.getAllInvestments.all().map((r: any) => ({
                    ...r,
                    tags: parseJSON<string[]>(r.tags),
                }));
            } catch (error) {
                console.error('repo.investments.getAll failed:', error);
                throw error;
            }
        },
        saveAll: (investments: any[]) => {
            try {
                return db.transaction(() => {
                    stmts.deleteAllInvestments.run();
                    for (const inv of investments) {
                        stmts.upsertInvestment.run(
                            inv.id, inv.symbol, inv.name ?? null, inv.shares, inv.avgPrice,
                            inv.currency ?? null, inv.exchange ?? null, inv.marketType,
                            inv.category ?? null, inv.purchaseDate ?? null, inv.targetWeight ?? 0,
                            stringifyJSON(inv.tags)
                        );
                    }
                })();
            } catch (error) {
                console.error('repo.investments.saveAll failed:', error);
                throw error;
            }
        },
    },

    allocations: {
        getAll: () => {
            try {
                return stmts.getAllAllocations.all().map((r: any) => ({
                    ...r,
                    details: parseJSON(r.details),
                }));
            } catch (error) {
                console.error('repo.allocations.getAll failed:', error);
                throw error;
            }
        },
        saveAll: (allocations: any[]) => {
            try {
                return db.transaction(() => {
                    stmts.deleteAllAllocations.run();
                    for (const alc of allocations) {
                        stmts.upsertAllocation.run(
                            alc.id, alc.category, alc.value, alc.currency,
                            alc.targetWeight, stringifyJSON(alc.details)
                        );
                    }
                })();
            } catch (error) {
                console.error('repo.allocations.saveAll failed:', error);
                throw error;
            }
        },
    },

    history: {
        getByDate: (date: string) => {
            try {
                const r = stmts.getHistoryByDate.get(date) as any;
                if (!r) return null;
                return {
                    ...r,
                    holdings: parseJSON(r.holdings),
                    allocations: parseJSON(r.allocations),
                    meta: parseJSON<SettlementMeta>(r.meta),
                };
            } catch (error) {
                console.error('repo.history.getByDate failed:', error);
                throw error;
            }
        },
        getAll: (includeHoldings = false) => {
            try {
                return stmts.getAllHistory.all().map((r: any) => ({
                    ...r,
                    holdings: includeHoldings ? parseJSON(r.holdings) : undefined,
                    allocations: parseJSON(r.allocations),
                    meta: parseJSON<SettlementMeta>(r.meta),
                }));
            } catch (error) {
                console.error('repo.history.getAll failed:', error);
                throw error;
            }
        },
        getInRange: (start: string, end: string) => {
            try {
                return stmts.getHistoryInRange.all(start, end).map((r: any) => ({
                    ...r,
                    holdings: parseJSON(r.holdings),
                    allocations: parseJSON(r.allocations),
                    meta: parseJSON<SettlementMeta>(r.meta),
                }));
            } catch (error) {
                console.error('repo.history.getInRange failed:', error);
                throw error;
            }
        },
        upsert: (entry: any) => {
            try {
                stmts.upsertHistory.run(
                    entry.date, entry.totalValue, entry.snapshotValue ?? null,
                    entry.manualAdjustment ?? 0, entry.exchangeRate ?? null,
                    stringifyJSON(entry.holdings), stringifyJSON(entry.allocations),
                    stringifyJSON(entry.meta)
                );
            } catch (error) {
                console.error('repo.history.upsert failed:', error);
                throw error;
            }
        },
        updateAdjustment: (date: string, adjustment: number, total: number) => {
            try {
                stmts.updateHistoryAdjustment.run(adjustment, total, date);
            } catch (error) {
                console.error('repo.history.updateAdjustment failed:', error);
                throw error;
            }
        },
    },

    transactions: {
        getByDate: (date: string) => {
            try {
                return stmts.getTransactionsByDate.all(date);
            } catch (error) {
                console.error('repo.transactions.getByDate failed:', error);
                throw error;
            }
        },
        getTypeInRange: (type: string, start: string, end: string) => {
            try {
                return stmts.getTransactionsByTypeInRange.all(type, start, end);
            } catch (error) {
                console.error('repo.transactions.getTypeInRange failed:', error);
                throw error;
            }
        },
        getAll: () => {
            try {
                return stmts.getAllTransactions.all();
            } catch (error) {
                console.error('repo.transactions.getAll failed:', error);
                throw error;
            }
        },
        save: (tx: any) => {
            try {
                stmts.upsertTransaction.run(
                    tx.id, tx.date, tx.type, tx.symbol ?? null, tx.amount,
                    tx.shares ?? null, tx.price ?? null, tx.currency,
                    tx.notes ?? null, tx.costBasis ?? null
                );
            } catch (error) {
                console.error('repo.transactions.save failed:', error);
                throw error;
            }
        },
        delete: (id: string) => {
            try {
                stmts.deleteTransaction.run(id);
            } catch (error) {
                console.error('repo.transactions.delete failed:', error);
                throw error;
            }
        },
    },

    memos: {
        getAll: () => {
            try {
                return stmts.getAllMemos.all();
            } catch (error) {
                console.error('repo.memos.getAll failed:', error);
                throw error;
            }
        },
        getById: (id: string) => {
            try {
                return stmts.getMemoById.get(id);
            } catch (error) {
                console.error('repo.memos.getById failed:', error);
                throw error;
            }
        },
        save: (memo: { id: string; title: string; content: string; date: string }) => {
            try {
                stmts.upsertMemo.run(memo.id, memo.title, memo.content, memo.date);
            } catch (error) {
                console.error('repo.memos.save failed:', error);
                throw error;
            }
        },
        delete: (id: string) => {
            try {
                stmts.deleteMemo.run(id);
            } catch (error) {
                console.error('repo.memos.delete failed:', error);
                throw error;
            }
        },
    },

    rates: {
        getLatest: (date: string): number | null => {
            try {
                const r = stmts.getLatestRate.get(date) as any;
                return r ? r.rate : null;
            } catch (error) {
                console.error('repo.rates.getLatest failed:', error);
                throw error;
            }
        },
        save: (date: string, rate: number) => {
            try {
                stmts.upsertRate.run(date, rate);
            } catch (error) {
                console.error('repo.rates.save failed:', error);
                throw error;
            }
        },
    },
};

export default db;
