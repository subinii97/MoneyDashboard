/**
 * /api/cron/daily-settlement
 *
 * 매일 두 번 호출:
 *   1) KST 20:05 — 국내 정산 (당일 종가 확정 후)
 *   2) KST 09:05 — 해외 정산 (미국 애프터마켓 종료 후)
 *
 * 동작 방식:
 *   - DB에 기록되지 않은(또는 미정산인) 평일 날짜들을 3개월 이내에서 탐색
 *   - 각 날짜의 보유 수량은 DB에 저장된 전날 holdings를 기준으로 함
 *   - 현금(allocations 중 비투자 항목)은 전일과 동일하게 유지
 *   - 종가는 fetchHistoricalClosePrice 로 가져옴
 *   - 나중에 해당 날짜 매매내역 추가 시 /api/snapshot POST 로 덮어씀
 */
import { NextResponse } from 'next/server';
import { repo } from '@/lib/db';
import { fetchExchangeRate } from '@/lib/stock';
import { fetchHistoricalClosePrice } from '@/lib/stock/history';
import { toLocalDateStr } from '@/lib/utils';
import { isDomesticDateSettled, isOverseasDateSettled, getSessionInfo } from '@/lib/session';
import { HistoryEntry, SettlementMeta } from '@/lib/types';

const INVESTMENT_CATEGORIES = [
    'Domestic Stock', 'Domestic Index', 'Domestic Bond',
    'Overseas Stock', 'Overseas Index', 'Overseas Bond',
];

/** YYYY-MM-DD 형태의 평일 날짜 목록을 생성합니다 (start ~ end 포함) */
function getWeekdaysBetween(start: Date, end: Date): string[] {
    const days: string[] = [];
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    while (cur <= end) {
        const dow = cur.getDay();
        if (dow !== 0 && dow !== 6) {
            days.push(toLocalDateStr(cur));
        }
        cur.setDate(cur.getDate() + 1);
    }
    return days;
}

export async function POST(request: Request) {
    try {
        // 간단한 secret 체크 (환경변수 CRON_SECRET 설정 시 활성화)
        const secret = process.env.CRON_SECRET;
        if (secret) {
            const authHeader = request.headers.get('authorization');
            if (authHeader !== `Bearer ${secret}`) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const now = new Date();
        const session = getSessionInfo(now);

        const rateInfo = await fetchExchangeRate();
        const rate = typeof rateInfo === 'object' ? rateInfo.rate : rateInfo;

        // 현재 investments (최신 보유 종목 마스터)
        const masterInvestments = repo.investments.getAll();

        // 처리 대상 날짜: 최근 90일 평일 중 미정산 날짜
        const ninetyDaysAgo = new Date(now);
        ninetyDaysAgo.setDate(now.getDate() - 90);
        const allWeekdays = getWeekdaysBetween(ninetyDaysAgo, now);

        // DB에 있는 기록 모두 가져오기
        const allHistory = repo.history.getAll(true) as HistoryEntry[];
        const historyByDate = new Map(allHistory.map(h => [h.date, h]));

        let processed = 0;
        let skipped = 0;

        for (const dateStr of allWeekdays) {
            const dbRow = historyByDate.get(dateStr);
            let meta: SettlementMeta = dbRow?.meta ?? { domesticSettled: false, overseasSettled: false };

            // 이미 완전히 정산됐으면 스킵 (최근 7일은 재계산 허용)
            const dayDate = new Date(dateStr + 'T00:00:00');
            const isRecent = (now.getTime() - dayDate.getTime()) < 7 * 24 * 3600 * 1000;
            if (meta.domesticSettled && meta.overseasSettled && !isRecent) {
                skipped++;
                continue;
            }

            // 이 날짜가 아직 정산 가능한 상태인지 확인
            const canSettleDomestic = isDomesticDateSettled(dateStr, now);
            const canSettleOverseas = isOverseasDateSettled(dateStr, now);

            if (!canSettleDomestic && !canSettleOverseas) {
                skipped++;
                continue;
            }

            // ── 전날 DB 레코드(holdings, allocations) 가져오기 ──────────────────
            const prevDate = new Date(dateStr + 'T12:00:00Z');
            prevDate.setDate(prevDate.getDate() - 1);
            // 전날 평일 찾기 (주말이면 더 이전으로)
            while ([0, 6].includes(prevDate.getDay())) {
                prevDate.setDate(prevDate.getDate() - 1);
            }
            const prevDateStr = toLocalDateStr(prevDate);
            const prevRow = historyByDate.get(prevDateStr);

            // ── Holdings 결정: 전날 DB → 없으면 마스터 investments ──────────────
            // 수량은 전날 기준, 매매내역은 나중에 접속 시 덮어쓸 수 있음
            const baseHoldings: any[] = prevRow?.holdings
                ? (prevRow.holdings as any[])
                : masterInvestments.map(inv => ({ ...inv, currentPrice: inv.avgPrice }));

            // 이미 DB에 이 날짜의 holdings가 있으면 수량만 전날 기준으로 유지
            const existingHoldings: any[] = (dbRow?.holdings as any[]) ?? [];

            // ── 각 종목별 종가 조회 및 holdings 구성 ─────────────────────────────
            const mergedHoldings = await Promise.all(baseHoldings.map(async (holding: any) => {
                const isDomestic = holding.marketType === 'Domestic' ||
                    ['Domestic Stock', 'Domestic Index', 'Domestic Bond'].includes(holding.category);

                // 이미 이 날짜의 holdings에 해당 종목이 있고 해당 마켓이 정산됐으면 그대로 사용
                const existing = existingHoldings.find((e: any) => e.symbol === holding.symbol);
                if (existing) {
                    if (isDomestic && meta.domesticSettled) return existing;
                    if (!isDomestic && meta.overseasSettled) return existing;
                }

                if (isDomestic && canSettleDomestic) {
                    const price = await fetchHistoricalClosePrice(holding.symbol, dateStr, true);
                    if (price !== null) {
                        return {
                            ...holding,
                            currentPrice: price,
                            isOverMarket: false,
                            overMarketPrice: undefined,
                            overMarketChange: undefined,
                            marketStatus: 'CLOSED',
                        };
                    }
                } else if (!isDomestic && canSettleOverseas) {
                    const price = await fetchHistoricalClosePrice(holding.symbol, dateStr, false);
                    if (price !== null) {
                        return {
                            ...holding,
                            currentPrice: price,
                            isOverMarket: false,
                            overMarketPrice: undefined,
                            overMarketChange: undefined,
                            marketStatus: 'CLOSED',
                        };
                    }
                }

                // 종가를 못 가져온 경우: 전날 가격 유지
                return { ...holding, marketStatus: 'CLOSED' };
            }));

            // ── 투자 평가액 계산 ─────────────────────────────────────────────────
            const totalInvValue = mergedHoldings.reduce((acc, inv) => {
                const val = (inv.currentPrice ?? inv.avgPrice) * inv.shares;
                return acc + (inv.currency === 'USD' ? val * rate : val);
            }, 0);

            // ── Allocations 구성: 투자 카테고리는 재계산, 현금은 전일 그대로 ─────
            const masterAllocations = repo.allocations.getAll();

            const updatedAllocations = masterAllocations.map((alc: any) => {
                if (INVESTMENT_CATEGORIES.includes(alc.category)) {
                    // 투자 항목: 이 날 holdings 기준으로 재계산
                    const categoryValue = mergedHoldings
                        .filter(inv => inv.category === alc.category)
                        .reduce((sum, inv) => {
                            const val = (inv.currentPrice ?? inv.avgPrice) * inv.shares;
                            return sum + (inv.currency === 'USD' ? val * rate : val);
                        }, 0);
                    return { ...alc, value: categoryValue / (alc.currency === 'USD' ? rate : 1) };
                }

                // 비투자 항목(현금 등): 전날 DB 값 유지 → 없으면 마스터 값
                const prevAlc = (prevRow?.allocations as any[])?.find((a: any) => a.category === alc.category);
                if (prevAlc) return prevAlc;

                // 전날도 없으면 그 날짜의 기존 DB 값 → 없으면 마스터
                const existingAlc = (dbRow?.allocations as any[])?.find((a: any) => a.category === alc.category);
                return existingAlc ?? alc;
            });

            const totalCashValue = updatedAllocations
                .filter((a: any) => !INVESTMENT_CATEGORIES.includes(a.category))
                .reduce((acc: number, a: any) => {
                    const val = a.value ?? 0;
                    return acc + (a.currency === 'USD' ? val * rate : val);
                }, 0);

            const totalValue = totalInvValue + totalCashValue;

            // ── 정산 플래그 업데이트 ─────────────────────────────────────────────
            if (canSettleDomestic) meta = { ...meta, domesticSettled: true };
            if (canSettleOverseas) meta = { ...meta, overseasSettled: true };

            const newEntry: HistoryEntry = {
                date: dateStr,
                totalValue,
                snapshotValue: totalValue,
                manualAdjustment: dbRow?.manualAdjustment ?? 0,
                holdings: mergedHoldings,
                allocations: updatedAllocations,
                exchangeRate: rate,
                meta,
            };

            repo.history.upsert(newEntry);
            processed++;
        }

        const today = toLocalDateStr(now);
        console.log(`[cron/daily-settlement] ${today} — processed: ${processed}, skipped: ${skipped}`);

        return NextResponse.json({
            success: true,
            processedDate: today,
            processed,
            skipped,
            session: {
                isDomesticSettled: session.isDomesticSettled,
                isOverseasSettled: session.isOverseasSettled,
                overseasSessionDate: session.overseasSessionDate,
            },
        });
    } catch (error) {
        console.error('[cron/daily-settlement] Failed:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

// GET — 헬스체크 및 미정산 날짜 현황 조회
export async function GET() {
    try {
        const now = new Date();
        const session = getSessionInfo(now);

        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        const weekdays = getWeekdaysBetween(thirtyDaysAgo, now);

        const allHistory = repo.history.getAll(false) as HistoryEntry[];
        const historyByDate = new Map(allHistory.map(h => [h.date, h]));

        const unsettled = weekdays.filter(d => {
            const row = historyByDate.get(d);
            if (!row) return true;
            const meta = row.meta ?? { domesticSettled: false, overseasSettled: false };
            return !meta.domesticSettled || !meta.overseasSettled;
        });

        return NextResponse.json({
            now: toLocalDateStr(now),
            session,
            unsettledCount: unsettled.length,
            unsettledDates: unsettled.slice(-10), // 최근 10개만 표시
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
