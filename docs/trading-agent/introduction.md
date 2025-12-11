---
sidebar_position: 1
---

# Trading Agent

Trading strategy backtesting framework for commodity markets.

## Strategy Implementations

10 strategy classes in `production/strategies/`:

### Baseline (4 strategies)
**File**: `baseline.py`
1. ImmediateSaleStrategy - Weekly liquidation
2. EqualBatchStrategy - Fixed schedule batches
3. PriceThresholdStrategy - Price trigger + technical indicators
4. MovingAverageStrategy - MA crossover

**Source**: Lines 5-9 list strategies, implementations at lines 29, 73, 110, 220

### Prediction-Based (5 strategies)
**File**: `prediction.py`
1. PriceThresholdPredictive - Baseline + predictions
2. MovingAveragePredictive - Baseline + predictions
3. ExpectedValueStrategy - Maximize expected returns
4. ConsensusStrategy - Majority vote of paths
5. RiskAdjustedStrategy - Balance returns vs uncertainty

**Source**: Class definitions at lines 46, 387, 736, 873, 1035

### MPC (1 strategy)
**File**: `rolling_horizon_mpc.py`
- RollingHorizonMPC - Model Predictive Control

## Production System

**Runners**: `production/runners/*.py` - 2,172 total lines

**Source**: Verified by `wc -l production/runners/*.py`

## Code Repository

📂 [View Code on GitHub](https://github.com/gibbonstony/ucberkeley-capstone/tree/main/trading_agent)
