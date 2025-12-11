---
sidebar_position: 1
---

# Overview

Ground Truth is an AI-driven commodity forecasting system designed to help Colombian traders optimize harvest sales through coffee and sugar futures price predictions.

## Mission

Deliver actionable trading recommendations through a three-agent architecture that combines automated data collection, probabilistic machine learning forecasting, and statistical validation.

**Key Insight**: Colombian traders care about `Coffee Price (USD) × COP/USD Exchange Rate`, not just USD futures prices.

## Key Achievements

### 90% Data Reduction
From 75,000 silver layer rows to 7,612 gold layer records while maintaining complete market coverage through forward-fill interpolation and array-based regional data.

### 180x Speedup Evolution
V1 (retrain-per-forecast: 24-48 hours) → V2 (train-once/inference-many: 1-2 hours) → V3 (ml_lib + gold tables: minutes) through architectural improvements and Spark parallelization.

### 70% Accuracy Threshold
Synthetic model testing revealed that 70% directional accuracy is the minimum threshold for prediction-based strategies to outperform baseline approaches.

### 93% Compute Savings
"Fit many, publish few" strategy: Test 200+ configurations in testing schema, select top ~15 diverse models, backfill only selected models (4,800 hours → 360 hours).

## System Architecture

```mermaid
graph LR
    A[Research Agent] --> B[Forecast Agent]
    B --> C[Trading Agent]

    A -->|Gold Tables| D[(Delta Lake)]
    B -->|Distributions/Forecasts| D
    C -->|Backtest Results| D

    E[AWS Lambda] --> A
    F[External APIs] --> E
    F -->|Market, Weather, FX, GDELT| E
```

## Three-Agent Architecture

### [Research Agent](/docs/research-agent/introduction)
**Data collection and ETL pipeline**
- 6 AWS Lambda functions (market, weather, VIX, FX, CFTC, GDELT)
- EventBridge daily triggers (2AM UTC)
- Bronze → Gold medallion architecture on Databricks
- 7,612 rows (Coffee + Sugar, daily from 2015-07-07)
- [📂 View Code on GitHub →](https://github.com/gibbonstony/ucberkeley-capstone/tree/main/research_agent)

### [Forecast Agent](/docs/forecast-agent/introduction)
**Machine learning forecasting engine**
- ml_lib PySpark framework with gold table integration
- Models: SARIMAX, Prophet, XGBoost, ARIMA, Random Walk
- 14-day forecasts with 2,000 Monte Carlo paths
- Testing schema (forecast_testing) for safe experimentation
- [📂 View Code on GitHub →](https://github.com/gibbonstony/ucberkeley-capstone/tree/main/forecast_agent)

### [Trading Agent](/docs/trading-agent/introduction)
**Strategy optimization and execution**
- 9 trading strategies (4 baseline + 5 prediction-based)
- Multi-model backtesting framework
- WhatsApp integration for daily recommendations
- Multi-currency support (15+ currencies including COP)
- [📂 View Code on GitHub →](https://github.com/gibbonstony/ucberkeley-capstone/tree/main/trading_agent)

## Technology Stack

| Layer | Technologies |
|:------|:------------|
| **Data Platform** | Databricks, Delta Lake, Unity Catalog, PySpark |
| **Cloud Infrastructure** | AWS Lambda, S3, EventBridge |
| **ML Frameworks** | statsmodels (SARIMAX, ARIMA), Prophet, XGBoost |
| **Analysis** | NumPy, Pandas, SciPy |
| **Deployment** | Python 3.11+, Git, Databricks Workflows |

## Quick Start

### For Researchers
Start with the [Research Agent documentation](/docs/research-agent/introduction) to understand our data architecture and ETL pipeline.

### For Data Scientists
Explore the [Forecast Agent documentation](/docs/forecast-agent/introduction) for ML model implementations and Spark parallelization strategies.

### For Traders
Review the [Trading Agent documentation](/docs/trading-agent/introduction) for trading strategies and optimization approaches.

## Project Timeline

| Phase | Duration | Lead | Deliverables |
|:------|:---------|:-----|:-------------|
| **Research & Planning** | Weeks 1-2 | All | Project scope, data sources, architecture design |
| **Data Infrastructure** | Weeks 3-6 | Stuart | Bronze→Gold pipeline, 6 Lambda functions |
| **ML Model Development** | Weeks 7-11 | Connor | ml_lib framework, model implementations |
| **Trading Strategies** | Weeks 9-13 | Francisco, Tony | 9 strategies, multi-model backtesting |
| **Integration & Testing** | Weeks 12-14 | All | End-to-end system, validation |
| **Production Deployment** | Week 15 | Tony | Daily recommendations, WhatsApp integration |

## Resources

- **Live System**: [studiomios.wixstudio.com/caramanta](https://studiomios.wixstudio.com/caramanta)
- **GitHub Repository**: [github.com/gibbonstony/ucberkeley-capstone](https://github.com/gibbonstony/ucberkeley-capstone)
- **UC Berkeley MIDS**: [ischool.berkeley.edu](https://www.ischool.berkeley.edu/programs/mids)
