# MoneyDashboard: Integrated Personal Asset & Investment Tracker

A high-performance, real-time financial dashboard built with Next.js, TypeScript, and SQLite, designed for professional-grade portfolio management and market monitoring.

---

## 1. Real-Time Market Monitoring (Dashboard)
- **Global Index Tracking**: Live feeds for KOSPI, KOSDAQ, NASDAQ, S&P 500, Dow Jones, and PHLX Semiconductor Index.
- **Financial Market Context**: Dynamic exchange rates (USD/KRW, JPY/KRW, EUR/USD) and real-time commodity prices (Gold, WTI Crude Oil).
- **Crypto & Alt Assets**: Tracking major cryptocurrencies like Bitcoin and Ethereum.
- **Market Status Indicators**: Session-aware status dots (● Open / ○ Close / NXT After-hours) for global exchanges.
- **Automatic Sync**: 5-second polling for live market data with smart caching.

## 2. Professional Portfolio Management (Investment)
- **Multi-Currency Support**: Unified tracking for Domestic (KRW) and Overseas (USD) assets with automatic exchange rate conversion.
- **Dynamic Asset Table**:
    - **Real-time Evaluation**: Displays current price vs. average purchase price.
    - **Profit/Loss (P/L)**: Accurate calculation of unrealized gains/losses in both original and base (KRW) currencies.
    - **Portfolio Weight**: Automatic calculation of each asset's percentage within the sub-total or grand total.
- **Performance Metrics**:
    - **Daily Market Change**: Shows the asset's percentage change from the previous close.
    - **Intraday Internal Return**: For newly bought stocks, calculates performance relative to the purchase price.
- **Asset Categorization**: Tagging system for grouping assets (e.g., "AI", "Dividends", "Growth") and filtering.

## 3. Sophisticated Settlement Engine (History)
- **Multi-Period Snapshots**: Daily, Weekly (Mon-Sat), and Monthly settlement views.
- **Performance Measurement (TWR)**: 
    - Implements **Time-Weighted Return (TWR)** multipliers to accurately measure portfolio performance.
    - Isolates market performance from the impact of cash inflows/outflows (deposits/withdrawals).
- **Cash-Flow Adjusted Growth**: Tracks actual wealth growth while providing a "settled" view of net performance.
- **Historical Accuracy**: Supports manual adjustment of historical entries to capture data prior to system adoption.

## 4. Transaction & Asset Lifecycle
- **Activity Logging**: Detailed records of Buy/Sell transactions with specific timestamps, exchange rates, and quantities.
- **Automated Rebalancing Tools**: Tracking target weights vs. current weights to assist in rebalancing decisions.
- **Dynamic Allocation**: Management of non-investment assets like Cash, Savings, and Fixed Deposits.

## 5. Modern UI/UX & Architecture
- **Tech Stack**: 
    - **Frontend**: Next.js 14 (App Router), React, Tailwind CSS.
    - **Backend**: Local SQLite database via `better-sqlite3` for privacy and speed.
    - **Logic**: Custom hooks for real-time asset syncing (`useAssets`) and history computation (`useHistoryData`).
- **Premium Aesthetics**:
    - Glassmorphism design system.
    - Spotlight card effects and smooth hover micro-animations.
    - High-quality Dark Mode optimized for financial readability.
- **Data Sovereignty**: All transaction and portfolio data is stored locally on the user's system.
- **Safe Editing**: Auto-refresh pauses during data editing to prevent conflicts and data loss.

---

## 6. Technical Specifications & Features
- **Project Structure**: Organized by domain-driven components (Dashboard, History, Investment, Portfolio).
- **Symbol Resolution**: Centralized `isDomesticSymbol` utility for consistent market type detection (.KS, .KQ, .KOR).
- **Rate Extraction**: Standardized `extractExchangeRate` for handling varied API responses.
- **Responsive Navigation**: Sidebar-based navigation for quick switching between views.
- **Privacy Controls**: Private mode to hide raw amounts while keeping percentage data visible.
