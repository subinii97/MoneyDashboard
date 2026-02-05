# MoneyDashboard 📈

A sophisticated, glassmorphic financial dashboard built with Next.js 15+, React 19, and SQLite. Track your domestic (KRX/KOSDAQ) and overseas (NASDAQ/NYSE/NYSE Arca) investments in one place with real-time price updates and professional-grade asset allocation insights.

## Features

- **Investment Manager**: 
    - Support for domestic and overseas stocks, ETFs, and indices.
    - Real-time price tracking via Naver Finance and Google Finance.
    - Pre-market and after-market price visibility for overseas stocks.
    - Aggregated (symbol-wise) and Detailed (transaction-wise) views.
- **Privacy Mode (금액 숨기기)**: 
    - Instantly blur sensitive financial data with one click.
    - **Refined Security**: Prevents text selection and dragging of hidden information.
    - **Balanced Insight**: Automatically reveals return percentages (yields) and asset weights while keeping absolute amounts hidden.
- **Portfolio Allocation & Rebalancing**: 
    - Visualize current vs. target asset allocation with interactive pie charts.
    - Track various asset classes: Cash, Savings, Stocks, Index Funds, Bonds, etc.
- **Transaction Logs**: Log buys/sells and track total net worth growth over time.
- **Historical Analysis**: Automatic daily snapshots for trend tracking and history settlement.
- **Local-First Storage**: Securely stores your data in a local SQLite database (`data/dashboard.db`).

## Getting Started

### Prerequisites

- Node.js 18+ (tested on Node 23)
- npm or yarn

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/subinii97/MoneyDashboard.git
    cd MoneyDashboard
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Run in development mode**:
    ```bash
    npm run dev
    ```
4.  Open [http://localhost:3000](http://localhost:3000) in your browser.

## Data Storage

Your financial data is stored locally in a SQLite database:
- `data/dashboard.db`: This file is automatically created on first run and is ignored by Git to ensure your personal information remains strictly on your machine.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: SQLite (via `better-sqlite3`)
- **UI**: React 19, Vanilla CSS (Custom Glassmorphism Design System), Lucide-React
- **Charts**: Recharts
- **Scraping**: Cheerio

## License

MIT
