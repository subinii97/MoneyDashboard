import { HistoryEntry, DailySettlement, WeeklySettlement, MonthlySettlement, INVESTMENT_CATEGORIES } from './types';
import { getSummaryMetrics, calculateTWRMultipliers, syncOverseasFriday } from './settlement';
import { convertToKRW } from './utils';
import { getSessionInfo } from './session';

export function processHistoryData(history: HistoryEntry[], transactions: any[], rate: number) {
    if (!history.length) return { daily: [], weekly: [], monthly: [], grouped: {} };

    const twrDom = calculateTWRMultipliers(history, 'Domestic', rate, transactions);
    const twrOs = calculateTWRMultipliers(history, 'Overseas', rate, transactions);

    const session = getSessionInfo();

    // 포트폴리오 전체(국내+해외 투자자산)의 통합 TWR 계산
    const twrAgg: Record<string, number> = {};
    let aggTWR = 1;
    twrAgg[history[0]?.date || ''] = 1;
    const filtered = history.filter(e => e.holdings && (Array.isArray(e.holdings) ? e.holdings.length > 0 : JSON.parse(e.holdings as any).length > 0));

    // 1. Daily
    // Calculate metrics and TWR for ALL days with holdings to ensure weekly/monthly aggregation can find any date's return
    const allDaysWithHoldings = filtered.map((entry, idx, arr) => {
        const r = entry.exchangeRate || rate;
        let currM = getSummaryMetrics(entry, r);
        let dsVal = currM.total;

        const isSettled = entry.meta?.overseasSettled;
        const next = idx < arr.length - 1 ? arr[idx + 1] : null;
        const isNextDayLiveInSession = next?.isLive && new Date().getHours() >= 17;
        
        if (next && !isSettled && !isNextDayLiveInSession) {
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
            const isPrevSettled = prev.meta?.overseasSettled;
            const pNext = arr[idx];
            const isPNextDayLiveInSession = pNext.isLive && new Date().getHours() >= 17;

            if (!isPrevSettled && !isPNextDayLiveInSession && new Date(pNext.date + 'T00:00:00').getDay() >= 2) {
                const pNM = getSummaryMetrics(pNext, pNext.exchangeRate || rate);
                const oldPmO = prevM!.overseas;
                prevM!.overseas = pNM.overseas;
                prevVal += (pNM.overseas - oldPmO);
            }
        }
        let domPct = (prev && (twrDom[prev.date] || 0) > 0) ? (twrDom[entry.date] / twrDom[prev.date] - 1) * 100 : 0;

        const currentOsTWR = twrOs[entry.date] || 1;
        const prevOsTWR = twrOs[prev?.date || ''] || 1;
        let osPct = (prevOsTWR > 0) ? (currentOsTWR / prevOsTWR - 1) * 100 : 0;

        if ((entry.isLive || (entry as any).isWeekendSettled) && entry.holdings) {
            let dGain = 0, dPrv = 0, oGain = 0, oPrv = 0;
            const hds = Array.isArray(entry.holdings) ? entry.holdings : JSON.parse(entry.holdings as any);
            const phs = prev ? (Array.isArray(prev.holdings) ? prev.holdings : JSON.parse(prev.holdings as any)) : [];
            hds.forEach((h: any) => {
                const pr = (h.isOverMarket && h.overMarketPrice !== undefined) ? h.overMarketPrice : (h.currentPrice || h.avgPrice);
                let ch = (h.isOverMarket && h.overMarketChange !== undefined) ? h.overMarketChange : (h.change || 0);
                
                const isOs = h.marketType === 'Overseas' || !['Domestic Stock', 'Domestic Index', 'Domestic Bond'].includes(h.category);
                if (entry.isLive && isOs && h.marketStatus !== 'OPEN' && !h.isOverMarket) {
                    ch = 0;
                }

                const p = phs.find((x: any) => x.symbol === h.symbol);
                if (p && ((p.isOverMarket && p.overMarketPrice !== undefined) ? p.overMarketPrice : (p.currentPrice || h.avgPrice)) === pr) ch = 0;
                const vC = convertToKRW(ch * h.shares, h.currency || 'USD', r), vP = convertToKRW((pr - ch) * h.shares, h.currency || 'USD', r);
                if (h.marketType === 'Domestic' || INVESTMENT_CATEGORIES.slice(0,3).includes(h.category)) { dGain += vC; dPrv += vP; } else { oGain += vC; oPrv += vP; }
            });

            // Account for sold assets (Realized profit)
            phs.forEach((ph: any) => {
                const currentH = hds.find((h: any) => h.symbol === ph.symbol);
                const prevShares = ph.shares || 0;
                const currShares = currentH ? currentH.shares : 0;
                
                // Only account for shares that were held yesterday and sold today
                const soldFromYesterday = Math.max(0, prevShares - currShares);
                
                if (soldFromYesterday > 0) {
                    const sellTxs = (transactions || []).filter((t: any) => t.date === entry.date && t.type === 'SELL' && t.symbol === ph.symbol);
                    if (sellTxs.length > 0) {
                        const totalProceeds = sellTxs.reduce((sum, t) => sum + (t.shares * t.price), 0);
                        const totalSoldQty = sellTxs.reduce((sum, t) => sum + t.shares, 0);
                        const avgSellPrice = totalProceeds / totalSoldQty;
                        const yesterdayPrice = (ph.isOverMarket && ph.overMarketPrice !== undefined) ? ph.overMarketPrice : (ph.currentPrice || ph.avgPrice);
                        
                        // We only take the gain for the portion that was held yesterday
                        const realizedGain = (avgSellPrice - yesterdayPrice) * soldFromYesterday;
                        const vC = convertToKRW(realizedGain, ph.currency || 'USD', r);
                        const vP = convertToKRW(yesterdayPrice * soldFromYesterday, ph.currency || 'USD', r);
                        
                        if (ph.marketType === 'Domestic' || INVESTMENT_CATEGORIES.slice(0,3).includes(ph.category)) { 
                            dGain += vC; dPrv += vP; 
                        } else { 
                            oGain += vC; oPrv += vP; 
                        }
                    }
                }
            });
            if (dPrv > 0) domPct = (dGain / dPrv) * 100; if (oPrv > 0) osPct = (oGain / oPrv) * 100;
        }

        const dObj = new Date(entry.date + 'T00:00:00');
        const isWkDay = dObj.getDay() === 0 || dObj.getDay() === 6;
        const metricGainDom = (prevM && !isWkDay) ? prevM.domestic * domPct / 100 : 0;
        const metricGainOs = (prevM && !isWkDay) ? prevM.overseas * osPct / 100 : 0;

        const prevInvVal = (prevM?.domestic || 0) + (prevM?.overseas || 0);
        if (prevInvVal > 0) {
            aggTWR *= (1 + (metricGainDom + metricGainOs) / prevInvVal);
        }
        twrAgg[entry.date] = aggTWR;

        return {
            ...entry, totalValue: dsVal, change: prev ? dsVal - prevVal : 0, changePercent: (prev && prevVal > 0) ? (dsVal / prevVal - 1) * 100 : 0,
            metrics: {
                cash: { current: currM.cash, change: prevM ? currM.cash - prevM.cash : 0, percent: (prevM && prevM.cash > 0) ? (currM.cash / prevM.cash - 1) * 100 : 0 },
                domestic: { current: currM.domestic, change: metricGainDom, percent: isWkDay ? 0 : domPct },
                overseas: { current: currM.overseas, change: metricGainOs, percent: isWkDay ? 0 : osPct },
                domStock: { current: currM.domStock }, domIndex: { current: currM.domIndex }, domBond: { current: currM.domBond },
                osStock: { current: currM.osStock }, osIndex: { current: currM.osIndex }, osBond: { current: currM.osBond }
            }
        } as DailySettlement;
    });

    const daily = allDaysWithHoldings
        .filter(d => {
            const day = new Date(d.date + 'T00:00:00').getDay();
            return day !== 0 && day !== 6;
        })
        .reverse();

    const grouped: Record<string, DailySettlement[]> = {};
    daily.forEach(d => { const m = d.date.substring(0, 7); if (!grouped[m]) grouped[m] = []; grouped[m].push(d); });

    // 2. Weekly & 3. Monthly
    const syMap: Record<string, string> = {}; filtered.forEach(h => h.holdings?.forEach(inv => { if (inv.symbol && inv.name) syMap[inv.symbol] = inv.name; }));
    
    const getAgg = (type: 'W' | 'M') => {
        const map: Record<string, DailySettlement> = {};
        allDaysWithHoldings.forEach(e => {
            const d = new Date(e.date);
            const k = type === 'M' ? e.date.substring(0, 7) : (() => {
                const s = new Date(d); s.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
                const end = new Date(s); end.setDate(s.getDate() + 5); return end.toISOString().substring(0,10);
            })();
            if (!map[k] || e.date > map[k].date) map[k] = e;
        });
        const keys = Object.keys(map).sort();
        return keys.map((k, i) => {
            const e = map[k], p = i > 0 ? map[keys[i-1]] : null;
            
            const cM = {
                total: e.totalValue,
                cash: e.metrics.cash.current,
                domestic: e.metrics.domestic.current,
                overseas: e.metrics.overseas.current,
                domStock: e.metrics.domStock.current,
                domIndex: e.metrics.domIndex.current,
                domBond: e.metrics.domBond.current,
                osStock: e.metrics.osStock.current,
                osIndex: e.metrics.osIndex.current,
                osBond: e.metrics.osBond.current
            };
            const pM = p ? {
                cash: p.metrics.cash.current,
                domestic: p.metrics.domestic.current,
                overseas: p.metrics.overseas.current
            } : null;

            const pO = p ? (twrOs[p.date] || 1) : 1;
            const cO = twrOs[e.date] || 1;
            const oR = pO > 0 ? cO / pO - 1 : 0;

            const pD = p ? (twrDom[p.date] || 1) : 1;
            const cD = twrDom[e.date] || 1;
            const dR = pD > 0 ? cD / pD - 1 : 0;
            const pA = p ? (twrAgg[p.date] || 1) : 1;
            const cA = twrAgg[e.date] || aggTWR;
            const aR = pA > 0 ? cA / pA - 1 : 0;

            const periodDaily = allDaysWithHoldings.filter(d => {
                if (type === 'M') return d.date.substring(0, 7) === k;
                const start = new Date(new Date(k).setDate(new Date(k).getDate() - 5)).toISOString().substring(0,10);
                return d.date >= start && d.date <= k;
            });

            const domProfit = periodDaily.reduce((sum, d) => sum + (d.metrics.domestic.change || 0), 0);
            const osProfit = periodDaily.reduce((sum, d) => sum + (d.metrics.overseas.change || 0), 0);
            const totalProfit = domProfit + osProfit;

            const start = type === 'W' ? new Date(new Date(k).setDate(new Date(k).getDate() - 5)).toISOString().substring(0,10) : '';
            return {
                [type === 'M' ? 'month' : 'period']: type === 'M' ? k : `${start.substring(2)} ~ ${k.substring(2)}`,
                date: e.date, value: cM.total, change: p ? e.totalValue - p.totalValue : 0, changePercent: (p && p.totalValue > 0) ? (e.totalValue / p.totalValue - 1) * 100 : 0,
                transactions: type === 'W' ? transactions.filter(t => t.date >= start && t.date <= k).map(t => ({ ...t, name: syMap[t.symbol!] })) : undefined,
                metrics: {
                    cash: { current: cM.cash, change: pM ? cM.cash - pM.cash : 0, percent: 0 },
                    domestic: { current: cM.domestic, change: domProfit, percent: dR * 100 },
                    overseas: { current: cM.overseas, change: osProfit, percent: oR * 100 },
                    domStock: { current: cM.domStock }, domIndex: { current: cM.domIndex }, domBond: { current: cM.domBond },
                    osStock: { current: cM.osStock }, osIndex: { current: cM.osIndex }, osBond: { current: cM.osBond }
                }
            };
        }).reverse();
    };

    return { daily, weekly: getAgg('W') as any[], monthly: getAgg('M') as any[], grouped };
}
