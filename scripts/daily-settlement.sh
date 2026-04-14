#!/bin/bash
# 일별 정산 cron 스크립트
# 국내: KST 20:05, 해외: KST 09:05 에 실행
# 서버 포트는 환경변수 PORT 또는 기본 3000

PORT=${PORT:-3000}
SECRET=${CRON_SECRET:-}
LOG_DIR="$(dirname "$0")/../logs"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
LOG_FILE="$LOG_DIR/settlement.log"

if [ -n "$SECRET" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        "http://localhost:$PORT/api/cron/daily-settlement" \
        -H "Authorization: Bearer $SECRET" \
        -H "Content-Type: application/json")
else
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        "http://localhost:$PORT/api/cron/daily-settlement" \
        -H "Content-Type: application/json")
fi

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "[$TIMESTAMP] HTTP $HTTP_CODE — $BODY" >> "$LOG_FILE"

if [ "$HTTP_CODE" != "200" ]; then
    echo "[$TIMESTAMP] ERROR: Settlement failed with HTTP $HTTP_CODE" >&2
    exit 1
fi

echo "[$TIMESTAMP] Settlement completed successfully"
