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
        const r = entry.exchangeRate || rate;
        let currM = getSummaryMetrics(entry, r);
        let dsVal = entry.totalValue;

        const next = idx < arr.length - 1 ? arr[idx + 1] : null;
        if (next) {
            const nD = new Date(next.date + 'T00:00:00').getDay();
            if (nD >= 2 && nD <= 6) { 
                const nM = getSummaryMetrics(next, next.exchangeRate || rate);
                dsVal += (nM.overseas - currM.overseas);
                currM.overseas = nM.overseas;
                currM.osStock = nM.osStock;
                currM.osIndex = nM.osIndex;
                currM.osBond = nM.osBond;
            }
        }

        const prev = idx > 0 ? arr[idx - 1] : null;
        let prevM = prev ? getSummaryMetrics(prev, prev.exchangeRate || rate) : null;
        let prevVal = prev ? prev.totalValue : 0;

        if (prev) {
            const target = arr[idx-1];
            const pNext = arr[idx]; // prev의 다음 날은 현재 entry임
            if (new Date(pNext.date + 'T00:00:00').getDay() >= 2) {
                const pNM = getSummaryMetrics(pNext, pNext.exchangeRate || rate);
                const oldPmO = prevM!.overseas;
                prevM!.overseas = pNM.overseas;
                prevVal += (pNM.overseas - oldPmO);
            }
        }
        let domPct = (prev && (twrDom[prev.date] || 0) > 0) ? (twrDom[entry.date] / twrDom[prev.date] - 1) * 100 : 0;
        
        // 해외 수익 동기화: 무조건 다음 거래일 오전의 성과를 이전 날짜의 세션 결과로 간주
        const dates = Object.keys(twrOs).sort();
        const curIdx = dates.indexOf(entry.date);
        const nextDate = (curIdx !== -1 && curIdx < dates.length - 1) ? dates[curIdx + 1] : undefined;
        
        const currentOsTWR = nextDate ? (twrOs[nextDate] || 1) : (twrOs[entry.date] || 1);
        
        const prevIdx = prev ? dates.indexOf(prev.date) : -1;
        const prevNextDate = (prevIdx !== -1 && prevIdx < dates.length - 1) ? dates[prevIdx + 1] : (prev?.date);
        const prevOsTWR = prevNextDate ? (twrOs[prevNextDate] || 1) : 1;
        
        let osPct = (prevOsTWR > 0) ? (currentOsTWR / prevOsTWR - 1) * 100 : 0;

        if ((entry.isLive || (entry as any).isWeekendSettled) && entry.holdings) {
            let dGain = 0, dPrv = 0, oGain = 0, oPrv = 0;
            const hds = Array.isArray(entry.holdings) ? entry.holdings : JSON.parse(entry.holdings as any);
            const phs = prev ? (Array.isArray(prev.holdings) ? prev.holdings : JSON.parse(prev.holdings as any)) : [];
            hds.forEach((h: any) => {
                const pr = (h.isOverMarket && h.overMarketPrice !== undefined) ? h.overMarketPrice : (h.currentPrice || h.avgPrice);
                let ch = (h.isOverMarket && h.overMarketChange !== undefined) ? h.overMarketChange : (h.change || 0);
                
                // US 장이 아직 개장하지 않았거나 닫혀있는 경우(즉, 오전/오후 정산 전) 
                // 라이브 리스트의 '변동분'은 어제의 성과이므로 오늘(미정)의 수익률로 치지 않음
                const isOs = h.marketType === 'Overseas' || !['Domestic Stock', 'Domestic Index', 'Domestic Bond'].includes(h.category);
                if (entry.isLive && isOs && h.marketStatus !== 'OPEN') {
                    ch = 0;
                }

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
            
            const syncM = (targetEnt: HistoryEntry | null) => {
                if (!targetEnt) return null;
                const m = getSummaryMetrics(targetEnt, targetEnt.exchangeRate || rate);
                
                // 해당 월/주 마감일의 다음 영업일 기록이 전체 history에 있다면 해외 자산 평가액 동기화
                const hIdx = history.findIndex(h => h.date === targetEnt.date);
                if (hIdx !== -1 && hIdx < history.length - 1) {
                    const nextH = history[hIdx + 1];
                    const nD = new Date(nextH.date + 'T00:00:00').getDay();
                    if (nD >= 2 && nD <= 6) {
                        const nM = getSummaryMetrics(nextH, nextH.exchangeRate || rate);
                        const oldOs = m.overseas;
                        m.overseas = nM.overseas;
                        m.osStock = nM.osStock;
                        m.osIndex = nM.osIndex;
                        m.osBond = nM.osBond;
                        m.total += (m.overseas - oldOs);
                    }
                }
                return m;
            };

            const cM = syncM(e)!;
            const pM = syncM(p);
            const dates = Object.keys(twrOs).sort();
            const getOsSync = (d: string) => {
                const idx = dates.indexOf(d);
                if (idx !== -1 && idx < dates.length - 1) return twrOs[dates[idx + 1]];
                return twrOs[d] || 1;
            };
            
            const pO = p ? getOsSync(p.date) : 1;
            const cO = getOsSync(e.date);
            const oR = pO > 0 ? cO / pO - 1 : 0;
            
            const pD = p ? twrDom[p.date] : 1;
            const cD = twrDom[e.date];
            const dR = pD > 0 ? cD / pD - 1 : 0;
            const start = type === 'W' ? new Date(new Date(k).setDate(new Date(k).getDate() - 5)).toISOString().substring(0,10) : '';
            return {
                [type === 'M' ? 'month' : 'period']: type === 'M' ? k : `${start.substring(2)} ~ ${k.substring(2)}`,
                date: e.date, value: cM.total, change: pM ? cM.total - pM.total : 0, changePercent: (pM && pM.total > 0) ? (cM.total / pM.total - 1) * 100 : 0,
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
