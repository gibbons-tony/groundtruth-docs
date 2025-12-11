---
sidebar_position: 1
---

# Trading Agent

The Trading Agent converts commodity price forecasts from the Forecast Agent into actionable trading recommendations through backtesting, strategy analysis, and multi-model comparison.

## Overview

The Trading Agent implements 9 trading strategies (4 baseline + 5 prediction-based) and tests them across all forecasting models to identify which combinations perform best.

**Current Status**: Supports daily recommendations, multi-model backtesting, and WhatsApp integration with multi-currency support (15+ currencies including COP).

## Key Achievement: 70% Accuracy Threshold Discovery

**Question**: What forecast accuracy is needed for profitability?

**Approach**: Synthetic model testing with controlled accuracy levels (50%, 60%, 70%, 80%, 90%, 100%)

**Implementation**:
1. Generate synthetic forecasts at each accuracy level
2. Run backtests with all 9 trading strategies
3. Compare prediction-based strategies vs baselines

**Finding**:
- 70% directional accuracy is the minimum threshold for prediction-based strategies to outperform baseline approaches
- Below 70%: Baseline strategies (Immediate Sale, Equal Batches) perform better
- Above 70%: Prediction-based strategies show significant improvement

## 9 Trading Strategies

### Baseline Strategies (4)
1. **Immediate Sale** - Sell at regular intervals regardless of price
2. **Equal Batches** - Fixed-size periodic sales
3. **Price Threshold** - Sell when price exceeds threshold
4. **Moving Average** - Sell when price above moving average

### Prediction-Based Strategies (5)
1. **Consensus** - Follow majority of forecast paths (mode of 2,000 paths)
2. **Expected Value** - Maximize expected returns (mean of paths)
3. **Risk-Adjusted** - Balance returns vs uncertainty (Sharpe-like metric)
4. **Price Threshold Predictive** - Baseline strategy + forecast enhancement
5. **Moving Average Predictive** - Baseline strategy + forecast enhancement

## Multi-Model Analysis

### Model Coverage

**Coffee** (16 total):
- 10 real models: sarimax_auto_weather_v1, prophet_v1, xgboost_weather_v1, arima_auto_v1, random_walk_v1, etc.
- 6 synthetic models: 50%, 60%, 70%, 80%, 90%, 100% accuracy

**Sugar** (11 total):
- 5 real models: sarimax_auto_weather_v1, prophet_v1, xgboost_weather_v1, arima_auto_v1, random_walk_v1
- 6 synthetic models: 50%, 60%, 70%, 80%, 90%, 100% accuracy

### Backtest Framework

Test all strategies across all models:
- Coffee: 9 strategies × 16 models = 144 combinations
- Sugar: 9 strategies × 11 models = 99 combinations
- Total: 243 backtest scenarios

**Output**: Identify which model/strategy combinations perform best

## Performance Metrics

Backtests track:
- **Net Earnings**: Total revenue minus transaction costs
- **Total Revenue**: Gross sales revenue
- **Transaction Costs**: Costs incurred from trading
- **Number of Transactions**: How frequently strategy trades

All metrics computed across all model/strategy combinations for comparison.

## Daily Recommendations

### Real-Time Trading Signals

Generate daily recommendations using latest forecasts:

**Outputs**:
- Current market price & 7-day trend
- 14-day forecast range (min, max, mean)
- Best 3-day sale window
- Financial impact analysis (sell now vs wait)
- Multi-currency pricing (15+ currencies)

**Usage**:
```bash
python operations/daily_recommendations.py \
  --commodity coffee \
  --model sarimax_auto_weather_v1
```

**Integration**: Structured JSON output for WhatsApp/messaging services

## Architecture

### Data Sources (Unity Catalog)

All data accessed from Databricks:

**Forecasts**: `commodity.forecast.distributions`
- 2,000 Monte Carlo paths per forecast
- 14-day horizon
- All models (Coffee: 10, Sugar: 5)

**Market Data**: `commodity.bronze.market_data`
- Historical OHLCV prices
- Trading days coverage

**FX Rates**: `commodity.bronze.fx_rates`
- 24 currency pairs
- Daily rates for multi-currency support

**Zero CSV dependencies** - All data via Databricks SQL connection

### Production Framework

**Directory Structure**:
```
trading_agent/
├── production/           # Backtest engine & strategies
│   ├── runners/          # Multi-commodity backtesting
│   ├── strategies/       # 9 strategy implementations
│   └── core/             # Backtest engine
├── operations/           # Daily recommendations
├── whatsapp/             # WhatsApp integration
└── data_access/          # Unity Catalog interface
```

## Key Features

### 1. Multi-Currency Support

Automatic currency conversion for 15+ currencies:

**Major Producers**: COP (Colombia), VND (Vietnam), BRL (Brazil), INR (India), THB (Thailand), IDR (Indonesia), ETB (Ethiopia), HNL (Honduras), UGX (Uganda), MXN (Mexico), PEN (Peru)

**Major Economies**: USD, EUR, GBP, JPY, CNY, AUD, CHF, KRW, ZAR

All recommendations show local currency impact for Colombian traders.

### 2. WhatsApp Integration

Structured JSON output ready for messaging:
```json
{
  "market": {"current_price_usd": 105.50, "local_prices": {...}},
  "recommendation": {"action": "HOLD", "financial_impact": {...}}
}
```

### 3. Multi-Model Comparison

Test all forecasting models simultaneously:
- Compare model performance
- Identify best model/strategy combinations
- Statistical significance testing

### 4. Synthetic Accuracy Testing

Controlled experiments with synthetic forecasts:
- Test different accuracy levels (50%-100%)
- Determine minimum accuracy threshold
- Validate strategy logic

## Performance Metrics

### Return Metrics
- Cumulative return
- Annualized return
- Sharpe ratio
- Sortino ratio

### Risk Metrics
- Maximum drawdown
- Value at Risk (VaR)
- Expected shortfall
- Beta to market

### Trading Metrics
- Win rate
- Profit factor
- Average trade duration
- Turnover rate

## Documentation

For detailed implementation:
- **README**: [trading_agent/README.md](https://github.com/gibbonstony/ucberkeley-capstone/blob/main/trading_agent/README.md)
- **Statistical Tests**: Review statistical validation in `/production/analysis/`
- **Strategy Implementations**: Explore strategies in `/production/strategies/`

## Code Repository

📂 **[View Trading Agent Code on GitHub](https://github.com/gibbonstony/ucberkeley-capstone/tree/main/trading_agent)**

Explore the complete implementation including:
- 9 trading strategy implementations
- Rolling Horizon MPC controller
- Statistical validation framework
- Backtesting engine
- Parameter optimization
- Risk management system
