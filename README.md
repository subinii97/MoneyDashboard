# MoneyDashboard 📈

A modern, glassmorphic financial dashboard built with Next.js 15, React 19, and Tailwind CSS. Track your domestic (KRX/KOSDAQ) and overseas (NASDAQ/NYSE/etc.) investments in one place with real-time price updates and asset allocation insights.

## Features
- **Investment Manager**: Add and manage stocks, indices, and bonds.
- **Real-time Updates**: Scraped data from Naver Finance and Google Finance.
- **Portfolio Allocation**: Visualize and management your asset weights.
- **Privacy Mode**: Quickly hide amounts with a blur effect.
- **Transaction History**: Log buys/sells and track total net worth over time.
- **Zero-Config Sharing**: Data is stored locally in `data/` and excluded from Git for privacy.

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
Your financial data is stored locally in JSON files within the `data/` directory. This folder is ignored by Git to ensure your personal information remains on your machine.
- `assets.json`: Current holdings and allocations.
- `history.json`: Daily snapshots of total net worth.
- `transactions.json`: Logs of all buy/sell activities.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, Vanilla CSS (Glassmorphism), Lucide-React
- **Charts**: Recharts
- **Scraping**: Cheerio

## License
MIT
