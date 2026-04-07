/**
 * 장 세션 경계 유틸리티 — 전체 앱의 단일 진실 공급원 (Single Source of Truth)
 *
 * ─── 국내주식 (KST 기준) ─────────────────────────────────────────────
 *   프리장(예상체결가): 08:00 ~ 09:00 KST
 *   정규장:           09:00 ~ 15:30 KST
 *   넥스트레이드:      15:30 ~ 20:00 KST
 *   ✅ 정산 완료:      20:00 KST 이후 (당일 KST 날짜로 기록)
 *
 * ─── 해외주식 (미국 ET 기준 → KST 변환) ──────────────────────────────
 *   프리장:     ET  04:00 ~ 09:30  =  KST 17:00 ~ 22:30
 *   정규장:     ET  09:30 ~ 16:00  =  KST 22:30 ~ 05:00+1
 *   애프터마켓: ET  16:00 ~ 20:00  =  KST 05:00 ~ 09:00+1
 *   ✅ 정산 완료: KST 09:00+1 이후 (미국 ET 세션 날짜로 기록)
 *
 *   KST 시간 → 해외 세션 날짜 매핑:
 *   - KST 00:00 ~ 09:00: 전날 ET 세션. 애프터마켓 진행 중이거나 방금 종료
 *   - KST 09:00 ~ 17:00: 전날 ET 세션 완전히 종료됨 (정산 완료)
 *   - KST 17:00 ~ 24:00: 오늘 ET 세션 시작 (프리장)
 */

import { toLocalDateStr } from './utils';

export interface SessionInfo {
    /** 국내 자산이 귀속되는 KST 날짜 */
    domesticSessionDate: string;
    /** 해외 자산이 귀속되는 KST 날짜 (미국 ET 세션 날짜에 대응) */
    overseasSessionDate: string;
    /** 국내 장이 완전히 마감됐는지 (KST 20:00 이후) */
    isDomesticSettled: boolean;
    /** 해외 장이 완전히 마감됐는지 (KST 09:00 이후, 17:00 전) */
    isOverseasSettled: boolean;
    /** 현재 KST 시간 (소수: 시+분/60) */
    kstTime: number;
    /** 현재 KST 날짜 문자열 */
    todayKST: string;
    /** 어제 KST 날짜 문자열 */
    yesterdayKST: string;
}

/**
 * 주어진 시각(기본값: 지금)을 기준으로 세션 경계 정보를 반환합니다.
 */
export function getSessionInfo(now: Date = new Date()): SessionInfo {
    const kstOffset = 9 * 60 * 60 * 1000;
    const kst = new Date(now.getTime() + kstOffset);
    const kstHour = kst.getUTCHours();
    const kstMin = kst.getUTCMinutes();
    const kstTime = kstHour + kstMin / 60;

    const todayKST = toLocalDateStr(now);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterdayKST = toLocalDateStr(yesterdayDate);

    // 해외 세션 날짜: KST 17:00 이전이면 '어제', 이후면 '오늘'
    // (17:00 KST = 04:00 ET = 미국 프리장 시작)
    const overseasSessionDate = kstTime < 17 ? yesterdayKST : todayKST;

    // 해외 정산 완료: 어제 ET 세션이 완전히 끝난 경우
    // (KST 09:00 = ET 20:00 = 애프터마켓 종료, 그리고 아직 오늘 ET 세션 시작 전인 17:00 전)
    const isOverseasSettled = kstTime >= 9 && kstTime < 17;

    // 국내 정산 완료: KST 20:00 이후 (넥스트레이드 종료)
    const isDomesticSettled = kstTime >= 20;

    return {
        domesticSessionDate: todayKST,
        overseasSessionDate,
        isDomesticSettled,
        isOverseasSettled,
        kstTime,
        todayKST,
        yesterdayKST,
    };
}

/**
 * 특정 날짜의 해외 자산이 정산 완료됐는지를 판단합니다. 
 * (일별 정산 테이블, TWR 계산에서 사용)
 */
export function isOverseasDateSettled(dateStr: string, now: Date = new Date()): boolean {
    const { overseasSessionDate, isOverseasSettled, todayKST } = getSessionInfo(now);

    // 기준 날짜보다 과거 → 확실히 완료
    if (dateStr < overseasSessionDate) return true;

    // 현재 해외 세션 날짜이고 세션이 종료됐으면 완료
    if (dateStr === overseasSessionDate && isOverseasSettled) return true;

    // 오늘 KST 날짜인데 해외 세션 날짜가 어제라면 → 오늘 해외는 아직 미시작
    if (dateStr === todayKST && overseasSessionDate !== todayKST) return false;

    return false;
}

/**
 * 특정 날짜의 국내 자산이 정산 완료됐는지를 판단합니다.
 */
export function isDomesticDateSettled(dateStr: string, now: Date = new Date()): boolean {
    const { todayKST, isDomesticSettled } = getSessionInfo(now);

    if (dateStr < todayKST) return true;
    if (dateStr === todayKST && isDomesticSettled) return true;

    return false;
}
