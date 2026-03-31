import { HistoryEntry, DailySettlement, WeeklySettlement, MonthlySettlement, INVESTMENT_CATEGORIES } from './types';
import { getSummaryMetrics, calculateTWRMultipliers, syncOverseasFriday } from './settlement';
import { convertToKRW } from './utils';

export function processHistoryData(history: HistoryEntry[], transactions: any[], rate: number) {
    if (!history.length) return { daily: [], weekly: [], monthly: [], grouped: {} };

    const twrDom = calculateTWRMultipliers(history, 'Domestic', rate, transactions);
    const twrOs = calculateTWRMultipliers(history, 'Overseas', rate, transactions);
    const filtered = history.filter(e => e.holdings && e.holdings.length > 0);

    // 1. Daily
    const dispHist = filtered.filter(e => { const d = new Date(e.date + 'T00:00:00').getDay(); return d !== 0 && d !== 6; });
    const daily = dispHist.map((entry, idx, arr) => {
        const r = entry.exchangeRate || rate; let currM = getSummaryMetrics(entry, r); let dsVal = entry.totalValue;
        const next = idx < arr.length - 1 ? arr[idx + 1] : null;
        let didLook = false;
        if (next && (next.isLive || (next as any).isWeekendSettled)) {
            const nD = new Date(next.date + 'T00:00:00').getDay();
            if (nD >= 2 && nD <= 6) { 
                const nM = getSummaryMetrics(next, next.exchangeRate || rate);
                dsVal += (nM.overseas - currM.overseas); currM.overseas = nM.overseas; didLook = true;
            }
        }
        const prev = idx > 0 ? arr[idx - 1] : null; let prevM = prev ? getSummaryMetrics(prev, prev.exchangeRate || rate) : null; let prevVal = prev ? prev.totalValue : 0;
        if (prev && didLook) {
            const pN = arr[idx];
            if (new Date(pN.date + 'T00:00:00').getDay() >= 2) {
                const pNM = getSummaryMetrics(pN, pN.exchangeRate || rate);
                if (prevM) { prevVal += (pNM.overseas - prevM.overseas); prevM.overseas = pNM.overseas; }
            }
        }
        let domPct = (prev && (twrDom[prev.date] || 0) > 0) ? (twrDom[entry.date] / twrDom[prev.date] - 1) * 100 : 0;
        let osPct = (prev && !prev.meta?.overseasSettled) ? (syncOverseasFriday(entry.date, twrOs) / syncOverseasFriday(prev.date, twrOs) - 1) * 100 : (prev ? (twrOs[entry.date] / twrOs[prev.date] - 1) * 100 : 0);

        if ((entry.isLive || (entry as any).isWeekendSettled) && entry.holdings) {
            let dGain = 0, dPrv = 0, oGain = 0, oPrv = 0;
            const hds = Array.isArray(entry.holdings) ? entry.holdings : JSON.parse(entry.holdings as any);
            const phs = prev ? (Array.isArray(prev.holdings) ? prev.holdings : JSON.parse(prev.holdings as any)) : [];
            hds.forEach((h: any) => {
                const pr = (h.isOverMarket && h.overMarketPrice !== undefined) ? h.overMarketPrice : (h.currentPrice || h.avgPrice);
                let ch = (h.isOverMarket && h.overMarketChange !== undefined) ? h.overMarketChange : (h.change || 0);
                const p = phs.find((x: any) => x.symbol === h.symbol);
                if (p && ((p.isOverMarket && p.overMarketPrice !== undefined) ? p.overMarketPrice : (p.currentPrice || p.avgPrice)) === pr) ch = 0;
                const vC = convertToKRW(ch * h.shares, h.currency || 'USD', r), vP = convertToKRW((pr - ch) * h.shares, h.currency || 'USD', r);
                if (h.marketType === 'Domestic' || INVESTMENT_CATEGORIES.slice(0,3).includes(h.category)) { dGain += vC; dPrv += vP; } else { oGain += vC; oPrv += vP; }
            });
            if (dPrv > 0) domPct = (dGain / dPrv) * 100; if (oPrv > 0) osPct = (oGain / oPrv) * 100;
        }
        const isWk = new Date(entry.date + 'T00:00:00').getDay() % 6 === 0;
        return {
            ...entry, totalValue: dsVal, change: prev ? dsVal - prevVal : 0, changePercent: (prev && prevVal > 0) ? (dsVal / prevVal - 1) * 100 : 0,
            metrics: {
                cash: { current: currM.cash, change: prevM ? currM.cash - prevM.cash : 0, percent: (prevM && prevM.cash > 0) ? (currM.cash / prevM.cash - 1) * 100 : 0 },
                domestic: { current: currM.domestic, change: (prevM && !isWk) ? prevM.domestic * domPct / 100 : 0, percent: isWk ? 0 : domPct },
                overseas: { current: currM.overseas, change: (prevM && !isWk) ? prevM.overseas * osPct / 100 : 0, percent: isWk ? 0 : osPct },
                domStock: { current: currM.domStock }, domIndex: { current: currM.domIndex }, domBond: { current: currM.domBond },
                osStock: { current: currM.osStock }, osIndex: { current: currM.osIndex }, osBond: { current: currM.osBond }
            }
        } as DailySettlement;
    }).reverse();

    const grouped: Record<string, DailySettlement[]> = {};
    daily.forEach(d => { const m = d.date.substring(0, 7); if (!grouped[m]) grouped[m] = []; grouped[m].push(d); });

    // 2. Weekly & 3. Monthly
    const syMap: Record<string, string> = {}; filtered.forEach(h => h.holdings?.forEach(inv => { if (inv.symbol && inv.name) syMap[inv.symbol] = inv.name; }));
    
    const getAgg = (type: 'W' | 'M') => {
        const map: Record<string, HistoryEntry> = {};
        history.forEach(e => {
            const d = new Date(e.date);
            const k = type === 'M' ? e.date.substring(0, 7) : (() => {
                const s = new Date(d); s.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
                const end = new Date(s); end.setDate(s.getDate() + 5); return end.toISOString().substring(0,10);
            })();
            if (!map[k] || e.date > map[k].date) map[k] = e;
        });
        const keys = Object.keys(map).sort();
        return keys.map((k, i) => {
            const e = map[k], p = i > 0 ? map[keys[i-1]] : null, r = e.exchangeRate || rate;
            const cM = getSummaryMetrics(e, r), pM = p ? getSummaryMetrics(p, p.exchangeRate || rate) : null;
            const pD = p ? twrDom[p.date] : 1, cD = twrDom[e.date], dR = pD > 0 ? cD / pD - 1 : 0;
            const pO = p ? syncOverseasFriday(p.date, twrOs) : 1, cO = syncOverseasFriday(e.date, twrOs), oR = pO > 0 ? cO / pO - 1 : 0;
            const start = type === 'W' ? new Date(new Date(k).setDate(new Date(k).getDate() - 5)).toISOString().substring(0,10) : '';
            return {
                [type === 'M' ? 'month' : 'period']: type === 'M' ? k : `${start.substring(2)} ~ ${k.substring(2)}`,
                date: e.date, value: e.totalValue, change: p ? e.totalValue - p.totalValue : 0, changePercent: (p && p.totalValue > 0) ? (e.totalValue / p.totalValue - 1) * 100 : 0,
                transactions: type === 'W' ? transactions.filter(t => t.date >= start && t.date <= k).map(t => ({ ...t, name: syMap[t.symbol!] })) : undefined,
                metrics: {
                    cash: { current: cM.cash, change: pM ? cM.cash - pM.cash : 0, percent: 0 },
                    domestic: { current: cM.domestic, change: (pM?.domestic || 0) * dR, percent: dR * 100 },
                    overseas: { current: cM.overseas, change: (pM?.overseas || 0) * oR, percent: oR * 100 },
                    domStock: { current: cM.domStock }, domIndex: { current: cM.domIndex }, domBond: { current: cM.domBond },
                    osStock: { current: cM.osStock }, osIndex: { current: cM.osIndex }, osBond: { current: cM.osBond }
                }
            };
        }).reverse();
    };

    return { daily, weekly: getAgg('W') as any[], monthly: getAgg('M') as any[], grouped };
}
