# MoneyDashboard 📈

**MoneyDashboard**는 개인의 자산 현황을 한눈에 파악하고, 체계적으로 리밸런싱 전략을 세울 수 있도록 돕는 프리미엄 개인 자산 관리 대시보드입니다. Next.js 15와 SQLite를 기반으로 하며, 모든 데이터는 사용자의 로컬 환경에만 안전하게 저장됩니다.

---

## ✨ 주요 특징 (Key Features)

### 1. 실시간 시장 데이터 (Real-time Market Pulse)
*   **30초 자동 갱신**: 코스피, 코스닥은 물론 나스닥, 다우존스 등 주요 지수와 환율 정보를 30초마다 자동으로 새로고침합니다.
*   **지능형 시간 표기**: 데이터의 신선도에 따라 '실시간' 또는 정확한 데이터 시점(예: 해외 지수 종가)을 구분하여 표시합니다.
*   **환율 자동 연동**: 원달러, 원엔(100엔 기준), 달러유로 등 주요 환율 정보를 실시간으로 추적하여 외화 자산 가치를 즉시 원화로 환산합니다.

### 2. 고도화된 투자 관리 (Investment Management)
*   **글로벌 포트폴리오**: 국내 주식(KRX/KOSDAQ)과 해외 주식(NASDAQ/NYSE/NYSE Arca)을 통합 관리합니다.
*   **프리/애프터마켓 가격**: 해외 주식의 경우 정규장 외 시간의 가격 추이까지 정밀하게 반영합니다.
*   **정돈된 레이아웃**: 평단가, 현재가, 평가액, 수익 등 핵심 정보를 동일한 너비로 배치하여 비교 가독성을 극대화했습니다.

### 3. 지능형 리밸런싱 및 자산배분 (Smart Rebalancing)
*   **시각적 리밸런싱 가이드**: 목표 비중과의 차이를 색상으로 직관적으로 알 수 있습니다.
    *   **±2% 이내**: 안정적인 **초록색**
    *   **±5% 이내**: 오차에 따라 부드럽게 변하는 **그라데이션**
    *   **±5% 초과**: 즉각적인 대응이 필요한 **강렬한 색상**
*   **인터랙티브 차트**: 현재 비중과 목표 비중을 파이 차트로 대조하며 전략을 시뮬레이션할 수 있습니다.

### 4. 사생활 보호 모드 (Private Mode)
*   **원클릭 블러/숨김**: 민감한 자산 금액과 수량을 한 번의 클릭으로 완벽하게 숨길 수 있습니다.
*   **지능형 정보 노출**: 절대적인 금액은 숨기되, 수익률(%)이나 자산 비중 정보는 유지하여 프라이버시와 가시성의 균형을 맞췄습니다.

---

## 🛠 기술 스택 (Tech Stack)

*   **Framework**: Next.js 15 (App Router)
*   **Language**: TypeScript / React 19
*   **Styling**: Vanilla CSS (Custom Glassmorphism Design System)
*   **Database**: SQLite (via `better-sqlite3`)
*   **Icons**: Lucide React
*   **Charts**: Recharts
*   **Market Data**: Naver Finance API Integration

---

## 🚀 시작하기 (Quick Start)

### 필수 요구사항
*   **Node.js**: 18 버전 이상 (23 버전 권장)
*   **Package Manager**: npm 또는 yarn

### 설치 및 실행

1.  **저장소 클론**:
    ```bash
    git clone https://github.com/subinii97/MoneyDashboard.git
    cd MoneyDashboard
    ```
2.  **의존성 설치**:
    ```bash
    npm install
    ```
3.  **개발 서버 실행**:
    ```bash
    npm run dev
    ```
4.  브라우저에서 `http://localhost:3000`에 접속하여 대시보드를 확인하세요!

---

## 🔒 데이터 보안 (Data Privacy)

**MoneyDashboard**는 클라우드 서버가 아닌 사용자의 컴퓨터에 데이터를 저장하는 **Local-First** 원칙을 준수합니다.
*   `data/dashboard.db`: 데이터베이스 파일은 로컬에 생성되며, `.gitignore`를 통해 Git에 커밋되지 않도록 보호됩니다.
*   사용자의 금융 정보가 외부 서버로 전송되거나 공유되지 않습니다.

---

## 📄 라이선스 (License)

MIT License. 자유롭게 커스터마이징하여 나만의 대시보드를 만들어보세요!
