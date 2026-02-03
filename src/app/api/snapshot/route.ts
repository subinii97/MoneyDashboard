import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { Assets, HistoryEntry } from '@/lib/types';
import { fetchQuote, fetchExchangeRate } from '@/lib/stock';

const DATA_DIR = path.join(process.cwd(), 'data');
const ASSETS_PATH = path.join(DATA_DIR, 'assets.json');
const HISTORY_PATH = path.join(DATA_DIR, 'history.json');

async function ensureDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

export async function GET() {
    try {
        const data = await fs.readFile(HISTORY_PATH, 'utf8');
        return NextResponse.json(JSON.parse(data));
    } catch (error) {
        return NextResponse.json([], { status: 200 });
    }
}

export async function POST(request: Request) {
    try {
        await ensureDir();
        const body = await request.json().catch(() => ({}));

        let assets: Assets = { investments: [], allocations: [] };
        try {
            const assetsRaw = await fs.readFile(ASSETS_PATH, 'utf8');
            assets = JSON.parse(assetsRaw);
        } catch (e) {
            // If assets.json missing, we can't take a snapshot of anything
            return NextResponse.json({ success: false, error: 'No assets found to snapshot' }, { status: 400 });
        }

        let history: HistoryEntry[] = [];
        try {
            const historyRaw = await fs.readFile(HISTORY_PATH, 'utf8');
            history = JSON.parse(historyRaw);
        } catch (e) { }

        // If it's a manual adjustment to a specific date
        if (body.date && body.manualAdjustment !== undefined) {
            const updatedHistory = history.map(h =>
                h.date === body.date
                    ? { ...h, manualAdjustment: body.manualAdjustment, totalValue: (h.snapshotValue || h.totalValue) + body.manualAdjustment }
                    : h
            );
            await fs.writeFile(HISTORY_PATH, JSON.stringify(updatedHistory, null, 2));
            return NextResponse.json({ success: true });
        }

        // Otherwise, create a new snapshot for today
        const rateInfo = await fetchExchangeRate();
        const rate = typeof rateInfo === 'object' ? rateInfo.rate : rateInfo;

        // Calculate Investment Values
        const invEntries = await Promise.all(
            assets.investments.map(async (inv) => {
                const quote = await fetchQuote(inv.symbol);
                let currentPrice = inv.avgPrice;
                let currency = inv.currency || (inv.symbol.includes('.') ? 'KRW' : 'USD');

                if (!(quote as any).error) {
                    currentPrice = (quote as any).price || currentPrice;
                    currency = (quote as any).currency || currency;
                }

                return {
                    ...inv,
                    currentPrice,
                    currency,
                    category: inv.category || (inv.marketType === 'Domestic' ? 'Domestic Stock' : 'Overseas Stock')
                };
            })
        );

        const totalInvValue = invEntries.reduce((acc, inv) => {
            const val = (inv.currentPrice || inv.avgPrice) * inv.shares;
            // Use the settlement rate for conversion
            return acc + (inv.currency === 'USD' ? val * rate : val);
        }, 0);

        // Calculate Other Allocation Values (Manual categories like Cash, Savings)
        const totalOtherValue = (assets.allocations || [])
            .filter(a => ![
                'Domestic Stock', 'Overseas Stock',
                'Domestic Index', 'Overseas Index',
                'Domestic Bond', 'Overseas Bond'
            ].includes(a.category))
            .reduce((acc, a) => {
                const val = a.value || 0;
                return acc + (a.currency === 'USD' ? val * rate : val);
            }, 0);

        const totalValue = totalOtherValue + totalInvValue;

        // Use local date for the snapshot key (yesterday: YYYY-MM-DD)
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        // If today's snapshot already exists and it's not a manual trigger, return early
        if (body.auto && history.some(h => h.date === todayStr)) {
            return NextResponse.json({ success: true, message: 'Today already recorded' });
        }

        // Create updated allocations with calculated values
        const updatedAllocations = (assets.allocations || []).map(alc => {
            const categoryValue = invEntries
                .filter(inv => inv.category === alc.category)
                .reduce((sum, inv) => {
                    const val = (inv.currentPrice || inv.avgPrice) * inv.shares;
                    return sum + (inv.currency === 'USD' ? val * rate : val);
                }, 0);

            // For Cash category, we keep the manual value from assets.allocations
            // For investment categories, we use the aggregated value
            if (alc.category === 'Domestic Stock' ||
                alc.category === 'Overseas Stock' ||
                alc.category === 'Domestic Index' ||
                alc.category === 'Overseas Index' ||
                alc.category === 'Domestic Bond' ||
                alc.category === 'Overseas Bond') {
                return { ...alc, value: categoryValue / (alc.currency === 'USD' ? rate : 1) };
            }
            return alc;
        });

        const newEntry: HistoryEntry = {
            date: todayStr,
            totalValue,
            snapshotValue: totalValue,
            manualAdjustment: 0,
            holdings: invEntries,
            allocations: updatedAllocations,
            exchangeRate: rate
        };

        const updatedHistory = [
            ...history.filter(h => h.date !== newEntry.date),
            newEntry
        ].sort((a, b) => a.date.localeCompare(b.date));

        await fs.writeFile(HISTORY_PATH, JSON.stringify(updatedHistory, null, 2));
        return NextResponse.json({ success: true, entry: newEntry });
    } catch (error) {
        console.error('Snapshot failed', error);
        return NextResponse.json({ success: false, error: 'Snapshot failed' }, { status: 500 });
    }
}
