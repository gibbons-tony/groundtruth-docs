---
sidebar_position: 1
---

# Trading Agent

Trading strategy backtesting framework for commodity markets.

---

## Overview

**Total Python files**: 648

**Production system structure**:
- `strategies/` - 9 files (base, baseline, prediction, rolling_horizon_mpc, + utilities)
- `runners/` - 6 files (2,172 total lines)

---

## Strategy Implementations

### Strategy Classes: 10 Concrete + 1 Base = 11 Total

**Base Class**:
- **Strategy** (base.py:11) - Abstract base class for all trading strategies

**Baseline Strategies (4)** - File: `baseline.py`

1. **ImmediateSaleStrategy** (line 29)
   - Sell entire harvest immediately each week
   - No forecasting, no waiting for better prices

2. **EqualBatchStrategy** (line 73)
   - Divide harvest into equal batches
   - Sell on fixed schedule (e.g., weekly, bi-weekly)

3. **PriceThresholdStrategy** (line 110)
   - Sell when price exceeds threshold
   - Uses technical indicators (RSI, Bollinger Bands)
   - Fallback: sell remaining at deadline

4. **MovingAverageStrategy** (line 220)
   - Buy/sell signals from MA crossover
   - Uses short-term and long-term moving averages

**Prediction-Based Strategies (5)** - File: `prediction.py`

5. **PriceThresholdPredictive** (line 46)
   - Extends PriceThresholdStrategy with forecast-based thresholds
   - Uses probabilistic forecasts to set dynamic thresholds

6. **MovingAveragePredictive** (line 387)
   - Extends MovingAverageStrategy with forecasts
   - Combines MA signals with forecast direction

7. **ExpectedValueStrategy** (line 736)
   - Maximizes expected return using forecast distributions
   - Sells when expected value of selling > expected value of holding

8. **ConsensusStrategy** (line 873)
   - Majority vote across forecast paths
   - Sells when majority of 2,000 paths predict up-trend

9. **RiskAdjustedStrategy** (line 1035)
   - Balances returns vs. forecast uncertainty
   - Uses Sharpe ratio / risk-adjusted return metrics

**Model Predictive Control (1)** - File: `rolling_horizon_mpc.py`

10. **RollingHorizonMPC** (line 39)
    - Rolling horizon optimization
    - Re-optimizes selling schedule at each time step
    - Uses linear programming for multi-period decisions

---

## File Details

### Strategies

#### base.py (2,459 bytes)
**What it implements**:
- **Strategy** abstract base class (line 11)
- Defines interface: `execute()`, `get_metrics()`, `get_name()`

**Code evidence**:
```python
# Line 11
class Strategy(ABC):
```

---

#### baseline.py (12,719 bytes)
**What it implements**:
- 4 baseline strategies (no forecasting)
- Technical indicators support (RSI, Bollinger Bands, Moving Averages)

**Line numbers**:
- ImmediateSaleStrategy: 29
- EqualBatchStrategy: 73
- PriceThresholdStrategy: 110
- MovingAverageStrategy: 220

---

#### prediction.py (50,018 bytes)
**What it implements**:
- 5 prediction-based strategies
- Uses probabilistic forecasts (2,000 Monte Carlo paths)
- Expected value calculations
- Consensus voting logic
- Risk-adjusted decision making

**Line numbers**:
- PriceThresholdPredictive: 46
- MovingAveragePredictive: 387
- ExpectedValueStrategy: 736
- ConsensusStrategy: 873
- RiskAdjustedStrategy: 1035

---

#### rolling_horizon_mpc.py (11,548 bytes)
**What it implements**:
- Rolling horizon Model Predictive Control
- Re-optimization at each time step
- Linear programming solver integration

**Line numbers**:
- RollingHorizonMPC: 39

---

#### indicators.py (4,624 bytes)
**What it implements**:
- Technical indicator calculations
- RSI (Relative Strength Index)
- Bollinger Bands
- Moving Averages

---

#### brute_force_optimizer.py (10,094 bytes)
**What it implements**:
- Brute force parameter search
- Grid search for strategy hyperparameters

---

#### lp_optimizer.py (7,069 bytes)
**What it implements**:
- Linear programming optimization
- Sells schedule optimization using LP solver

---

#### theoretical_max_calculator.py (10,684 bytes)
**What it implements**:
- Perfect foresight benchmark calculator
- Theoretical maximum return (upper bound)

---

## Runner Files (2,172 total lines)

### 1. data_loader.py (353 lines)
**What it does**:
- Loads historical price data and forecasts from Databricks
- Loads forecast distributions (2,000 Monte Carlo paths)
- Handles multi-commodity data

**Key methods**:
- `load_price_data()`: Historical prices from gold tables
- `load_forecast_data()`: Forecast distributions
- `load_multi_commodity_data()`: Multiple commodities at once

---

### 2. strategy_runner.py (391 lines)
**What it does**:
- Runs individual strategy backtests
- Executes strategy logic across historical periods
- Collects execution metrics (return, timing, quantity sold)

**Key methods**:
- `run_backtest()`: Execute strategy on historical data
- `calculate_metrics()`: Compute performance metrics
- `save_execution_log()`: Log trading decisions

---

### 3. multi_commodity_runner.py (526 lines)
**What it does**:
- Orchestrates backtesting across multiple commodities
- Parallel strategy execution
- Aggregates results across commodities

**Key methods**:
- `run_all_strategies()`: Execute all strategies
- `run_multi_commodity()`: Coffee + Sugar backtests
- `aggregate_results()`: Combine metrics

---

### 4. result_saver.py (346 lines)
**What it does**:
- Saves backtest results to Databricks
- Schema: strategy_name, commodity, metrics, execution_log
- Supports incremental updates

**Key methods**:
- `save_to_databricks()`: Write results to Delta Lake
- `save_execution_details()`: Save trade-level details
- `save_comparison_matrix()`: Strategy comparison table

---

### 5. visualization.py (510 lines)
**What it does**:
- Creates charts for backtest analysis
- Price evolution vs. strategy decisions
- Performance comparison charts
- Return distribution visualizations

**Key methods**:
- `plot_strategy_execution()`: Trade timing on price chart
- `plot_performance_comparison()`: Bar charts of returns
- `plot_forecast_distributions()`: Monte Carlo path visualization

---

### 6. __init__.py (46 lines)
**What it does**:
- Package initialization
- Exports key classes and functions

---

## Runner File Line Counts (Verified)

```
__init__.py:                 46 lines
data_loader.py:             353 lines
multi_commodity_runner.py:  526 lines
result_saver.py:            346 lines
strategy_runner.py:         391 lines
visualization.py:           510 lines
-----------------------------------
TOTAL:                    2,172 lines
```

**Code evidence**:
```bash
$ wc -l production/runners/*.py
      46 __init__.py
     353 data_loader.py
     526 multi_commodity_runner.py
     346 result_saver.py
     391 strategy_runner.py
     510 visualization.py
    2172 total
```

---

## Summary

**Strategies**: 10 concrete implementations (4 baseline + 5 prediction-based + 1 MPC)

**Baseline (4)**:
1. ImmediateSaleStrategy - Weekly liquidation
2. EqualBatchStrategy - Fixed schedule batches
3. PriceThresholdStrategy - Price trigger + technical indicators
4. MovingAverageStrategy - MA crossover signals

**Prediction-Based (5)**:
5. PriceThresholdPredictive - Baseline + probabilistic forecasts
6. MovingAveragePredictive - MA + forecast direction
7. ExpectedValueStrategy - Maximize expected returns from 2,000 paths
8. ConsensusStrategy - Majority vote of forecast paths
9. RiskAdjustedStrategy - Balance returns vs. uncertainty (Sharpe ratio)

**MPC (1)**:
10. RollingHorizonMPC - Model Predictive Control with LP optimization

**Runners**: 2,172 total lines across 6 files
- Data loading
- Strategy execution
- Multi-commodity backtesting
- Result persistence (Databricks Delta Lake)
- Visualization

**Forecast integration**: Uses 2,000 Monte Carlo paths per forecast for probabilistic decision making

**Multi-currency support**: Handles 15+ currencies including COP (Colombian Peso)

---

**Analysis complete**. All 3 phases finished. Ready to write final documentation.
