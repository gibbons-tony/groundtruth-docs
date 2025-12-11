---
sidebar_position: 1
---

# Trading Agent

Commodity trading strategy backtesting and optimization framework.

**Source Code**: `trading_agent/production/` (9,105 lines across 3 subsystems)

---

## System Architecture

### Three-Tier Design

```
┌─────────────────────────────────────────────────────────────┐
│ 1. BACKTESTING ENGINE (Core Logic)                          │
│    - BacktestEngine: 400 lines                              │
│    - Harvest cycle management                               │
│    - Cost modeling (storage + transaction)                  │
│    - Force liquidation logic                                │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 2. STRATEGY IMPLEMENTATIONS (Trading Logic)                 │
│    - 10 strategies: 2,916 lines total                       │
│    - Base class: Strategy (ABC)                             │
│    - 4 baseline strategies: 340 lines                       │
│    - 5 prediction-based: 1,190 lines                        │
│    - 1 MPC optimization: 290 lines                          │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 3. EXECUTION FRAMEWORK (Orchestration)                      │
│    - Runners: 2,172 lines                                   │
│    - Data loading, strategy execution, results storage      │
│    - Multi-commodity support                                │
│    - Visualization (220+ charts)                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Code Structure

### Production System (9,105 lines)

```
production/
├── core/                         400 lines
│   └── backtest_engine.py        Harvest-aware backtesting
│
├── strategies/                 2,916 lines
│   ├── base.py                    76 lines - Abstract base class
│   ├── baseline.py               340 lines - 4 baseline strategies
│   ├── prediction.py           1,190 lines - 5 prediction strategies
│   ├── rolling_horizon_mpc.py    290 lines - MPC optimization
│   ├── indicators.py             174 lines - Technical indicators
│   ├── lp_optimizer.py           213 lines - Linear programming
│   └── theoretical_max.py        269 lines - Perfect foresight benchmark
│
├── runners/                    2,172 lines
│   ├── data_loader.py            353 lines - Load prices + forecasts
│   ├── strategy_runner.py        391 lines - Execute single strategy
│   ├── multi_commodity_runner.py 526 lines - Orchestrate all combinations
│   ├── result_saver.py           346 lines - Save to Delta Lake
│   └── visualization.py          510 lines - Generate 220+ charts
│
├── analysis/                   4,017 lines
│   ├── statistical_tests.py    1,292 lines - Paired t-tests, bootstrap CI
│   ├── strategy_analysis.py      379 lines - Efficiency ratios
│   └── trade_level_stats.py      408 lines - Per-trade analysis
│
├── config.py                     277 lines - Central configuration
├── parameter_manager.py          700 lines - Parameter optimization
└── run_backtest_workflow.py      800 lines - Orchestration
```

---

## Configuration System

### Centralized Parameters (`config.py`)

**Commodity Configuration**:
```python
COMMODITY_CONFIGS = {
    'coffee': {
        'harvest_volume': 50,  # tons/year
        'harvest_windows': [(5, 9)],  # May-September
        'storage_cost_pct_per_day': 0.005,  # 0.5% per day
        'transaction_cost_pct': 0.01,       # 1% per transaction
        'max_holding_days': 365
    },
    'sugar': {
        'harvest_volume': 50,
        'harvest_windows': [(10, 12)],  # Oct-Dec
        'storage_cost_pct_per_day': 0.005,
        'transaction_cost_pct': 0.01,
        'max_holding_days': 365
    }
}
```

**Why These Parameters?**
- **0.5% storage/day**: Based on diagnostic research (`CHANGELOG.md:2025-12-04`)
- **1% transaction**: Industry standard for commodity futures
- **365-day max**: Quality degradation after 1 year

### Strategy Parameters

**Baseline Strategies** (no predictions):
```python
BASELINE_PARAMS = {
    'immediate_sale': {},  # Sell immediately, no params

    'equal_batch': {
        'batch_size': 0.25,      # 25% per batch
        'frequency_days': 30      # Monthly sales
    },

    'price_threshold': {
        'threshold_pct': 0.05     # Sell when price above MA + 5%
    },

    'moving_average': {
        'ma_period': 30          # 30-day moving average
    }
}
```

**Prediction-Based Strategies** (use forecasts):
```python
PREDICTION_PARAMS = {
    'consensus': {
        'consensus_threshold': 0.70,  # 70% paths bullish to hold
        'evaluation_day': 14          # Check 14-day forecast
    },

    'expected_value': {
        'min_net_benefit_pct': 0.5   # 0.5% minimum gain to wait
    },

    'risk_adjusted': {
        'min_return': 0.03,              # 3% minimum return
        'max_uncertainty_low': 0.05,     # CV below 5% = low risk
        'max_uncertainty_medium': 0.10,  # CV below 10% = med risk
        'max_uncertainty_high': 0.20     # CV below 20% = high risk
    }
}
```

### Parameter Management System

**Automatic Optimization Integration** (`parameter_manager.py`):

```python
class ParameterManager:
    """
    Intelligent parameter management with automatic optimization fallback.

    Design:
        1. Try loading optimized parameters (from Optuna)
        2. Fall back to defaults if not found
        3. Log parameter source for transparency
    """

    def get_params(self, source='auto'):
        # source='optimized' → Use Optuna results only
        # source='default'   → Use hardcoded defaults
        # source='auto'      → Try optimized, fall back to default
```

**Optimization Storage**:
- Path: `/dbfs/production/files/optimized_params_{commodity}_{model}_v{version}.json`
- Format: JSON with all strategy parameters
- Versioning: Multiple optimization runs tracked

---

## Backtesting Engine

### Core Design (`backtest_engine.py`)

**Harvest-Based Inventory** (lines 12-116):

```python
class BacktestEngine:
    """
    Key Innovation: Inventory starts at ZERO and accumulates during harvest.

    Traditional approach: Start with full inventory
    Our approach: Model realistic harvest accumulation
    """

    def _create_harvest_schedule(self):
        """
        Calculate daily inventory increments during harvest windows.

        Example (Coffee):
            - Harvest: May-September (153 days)
            - Volume: 50 tons/year
            - Daily increment: 50 / 153 = 0.327 tons/day
        """
```

**Price Conversion** (line 18):
```python
# CRITICAL: Futures prices in cents/lb, need $/ton
price_per_ton = price * 20  # 1 ton = 2000 lbs, cents→dollars
```

**Cost Modeling** (lines 200-230):

**Storage Costs**:
```python
# Percentage-based (scales with commodity value)
daily_storage_cost = inventory * price_per_ton * storage_cost_pct_per_day
total_storage += daily_storage_cost
```

**Transaction Costs**:
```python
# Applied when selling
transaction_cost = sale_value * transaction_cost_pct
```

**Force Liquidation** (lines 56-76):

```python
def _force_liquidation_check(self, day, inventory):
    """
    Two-tier liquidation to prevent quality loss:

    1. Days 345-364: Gradual sell (5%/day)
    2. Day 365: Force sell ALL remaining
    """
    days_since_harvest = day - harvest_start

    if days_since_harvest >= 365:
        return SELL_ALL  # Hard deadline
    elif days_since_harvest >= 345:
        return SELL(inventory * 0.05)  # Gradual liquidation
```

---

## Trading Strategies

### Design Pattern

All strategies inherit from `Strategy` base class:

```python
class Strategy(ABC):
    @abstractmethod
    def decide(self, day, inventory, current_price, price_history, predictions=None):
        """
        Args:
            day: Current day index
            inventory: Current inventory (tons)
            current_price: Price (cents/lb)
            price_history: DataFrame with date + price
            predictions: numpy array (n_paths, 14_days) for forecast strategies

        Returns:
            dict: {'action': 'SELL'|'HOLD', 'amount': float, 'reason': str}
        """
```

### Baseline Strategies (4)

**1. ImmediateSaleStrategy** (`baseline.py:29-70`)

Sell all inventory immediately at regular intervals.

**Parameters**:
- `min_batch_size`: 5.0 tons
- `sale_frequency_days`: 7 days

**Logic**:
```python
if days_since_last_sale >= 7 and inventory >= 5.0:
    return SELL(inventory)  # Liquidate everything
```

**2. EqualBatchStrategy** (`baseline.py:73-107`)

Divide harvest into equal batches, sell on fixed schedule.

**Parameters**:
- `batch_size`: 0.25 (25%)
- `frequency_days`: 30

**Logic**:
```python
if days_since_sale >= 30:
    return SELL(inventory * 0.25)  # Sell quarter each month
```

**3. PriceThresholdStrategy** (`baseline.py:110-218`)

Sell when price exceeds 30-day moving average by threshold %.

**Parameters**:
- `threshold_pct`: 0.05 (5%)
- Batch sizes modulated by RSI + ADX

**Technical Indicators** (`indicators.py`):
- **RSI** (Relative Strength Index): Momentum oscillator
- **ADX** (Average Directional Index): Trend strength

**Logic**:
```python
ma_30 = price_history[-30:].mean()
threshold = ma_30 * (1 + 0.05)

if current_price > threshold:
    # Modulate batch size by indicators
    if rsi > 70 and adx > 25:
        return SELL(inventory * 0.35)  # Overbought + strong trend
    elif rsi > 70:
        return SELL(inventory * 0.30)  # Overbought
    else:
        return SELL(inventory * 0.25)  # Baseline
```

**4. MovingAverageStrategy** (`baseline.py:220-340`)

Sell on moving average crossover signals.

**Parameters**:
- `ma_period`: 30 days

**Logic**:
```python
ma_current = price_history[-30:].mean()
ma_previous = price_history[-31:-1].mean()

# Upward crossover
if prev_price <= ma_previous and current_price > ma_current:
    if rsi >= 40 and rsi <= 70 and adx > 25:
        return SELL(inventory * 0.30)  # Strong signal
```

### Prediction-Based Strategies (5)

All prediction strategies use **2,000 Monte Carlo forecast paths × 14 days** from `commodity.forecast.distributions`.

**5. PriceThresholdPredictive** (`prediction.py:46-380`)

Baseline PriceThreshold + forecast overlay with 3-tier confidence system.

**Three-Tier Prediction Integration**:

```python
cv = coefficient_of_variation(predictions)  # Forecast uncertainty

if cv < 0.05:
    # HIGH confidence (CV below 5%): OVERRIDE baseline
    if strong_upward_signal:
        return HOLD  # Wait for better price
    elif strong_downward:
        return SELL(inventory * 0.40)  # Aggressive sell

elif cv < 0.15:
    # MEDIUM confidence (CV below 15%): BLEND with baseline
    baseline_decision = run_baseline_logic()
    if upward_prediction:
        reduce_sell_amount(baseline_decision * 0.6)
    else:
        return baseline_decision

else:
    # LOW confidence (CV above 15%): FOLLOW baseline exactly
    return run_price_threshold_baseline()
```

**6. MovingAveragePredictive** (`prediction.py:387-732`)

Baseline MovingAverage + forecast direction confirmation.

**Logic**:
```python
ma_signal = check_ma_crossover()
forecast_direction = analyze_14day_trend(predictions)

if ma_signal == BUY and forecast_direction == UPWARD:
    return HOLD  # Both agree, wait
elif ma_signal == SELL and forecast_direction == DOWNWARD:
    return SELL(inventory * batch_size)  # Both agree, sell
else:
    return HOLD  # Conflicting signals, wait
```

**7. ExpectedValueStrategy** (`prediction.py:736-868`)

Maximize expected return using forecast distribution.

**Expected Value Calculation**:
```python
# For each of 14 forecast days
expected_values = []
for day in range(1, 15):
    # Median of 2,000 paths
    median_price = np.median(predictions[:, day-1])

    # Subtract costs
    storage_cost = (day * storage_cost_pct_per_day * median_price)
    transaction_cost = transaction_cost_pct * median_price

    net_value = median_price - storage_cost - transaction_cost
    expected_values.append(net_value)

optimal_day = argmax(expected_values)
best_ev = max(expected_values)
sell_today_ev = current_price - transaction_cost

if best_ev > sell_today_ev * (1 + min_net_benefit_pct):
    return HOLD  # Waiting has positive expected value
else:
    return SELL(inventory * batch_size)
```

**8. ConsensusStrategy** (`prediction.py:873-1029`)

Democratic vote across 2,000 forecast paths.

**Consensus Voting**:
```python
# At 14-day horizon
final_prices = predictions[:, 13]  # All paths at day 14
current_price = price_history.iloc[-1]

# Count bullish paths (above 3% return)
bullish_paths = (final_prices > current_price * 1.03).sum()
bullish_pct = bullish_paths / 2000

if bullish_pct >= 0.85:
    # Very strong consensus (85%+ bullish)
    return HOLD
elif bullish_pct >= 0.70:
    # Strong consensus (70%+ bullish)
    if cv < 0.05:
        return HOLD  # High confidence, hold
    else:
        return SELL(inventory * 0.15)  # Gradual sell
elif bullish_pct < 0.30:
    # Bearish consensus (below 30% bullish)
    return SELL(inventory * 0.35)  # Aggressive sell
else:
    # Weak consensus (30-60%)
    return SELL(inventory * 0.25)  # Default sell
```

**9. RiskAdjustedStrategy** (`prediction.py:1035-1190`)

Balance expected return vs forecast uncertainty (Sharpe ratio approach).

**Risk-Adjusted Decision**:
```python
expected_return = calculate_expected_value(predictions)
uncertainty = std_dev(predictions) / mean(predictions)  # Coefficient of variation

# Sharpe-like ratio
risk_adjusted_return = expected_return / (1 + uncertainty)

if uncertainty < 0.05 and expected_return > 0.03:
    # Low risk, decent return
    return HOLD
elif uncertainty > 0.20:
    # High uncertainty, sell to reduce risk
    return SELL(inventory * batch_size)
```

### Model Predictive Control (1)

**10. RollingHorizonMPC** (`rolling_horizon_mpc.py:39-290`)

Rolling horizon optimization using linear programming.

**Linear Programming Formulation**:

**Decision Variables**:
```python
x = [x_1, x_2, ..., x_14]  # Amount to sell each day
```

**Objective Function**:
```python
maximize: Σ(price_t * x_t - storage_cost_t - transaction_cost_t)
          for t in 1..14
```

**Constraints**:
```python
# 1. Non-negativity
x_t >= 0  for all t

# 2. Inventory conservation
Σ(x_t) <= current_inventory

# 3. Daily bounds
x_t <= inventory * 0.40  # Max 40% per day
```

**Implementation** (using scipy.optimize.linprog):
```python
from scipy.optimize import linprog

# Coefficients (negative for minimization)
c = [-price_1, -price_2, ..., -price_14] + storage_costs + transaction_costs

# Inequality constraints (A_ub @ x <= b_ub)
A_ub = [[1, 1, ..., 1]]  # Sum constraint
b_ub = [inventory]

# Bounds
bounds = [(0, inventory*0.40) for _ in range(14)]

result = linprog(c, A_ub=A_ub, b_ub=b_ub, bounds=bounds, method='highs')

# Execute first day's decision
return SELL(result.x[0])
```

---

## Execution Framework

### Runners System (`runners/`)

**Data Flow**:
```
data_loader.py
    ↓ (prices + forecasts)
strategy_runner.py
    ↓ (backtest results)
multi_commodity_runner.py
    ↓ (aggregate results)
result_saver.py → Delta Lake
    ↓
visualization.py → 220+ charts
```

**1. DataLoader** (`data_loader.py:353 lines`)

```python
class DataLoader:
    def load_price_data(commodity, start_date=None):
        """
        Load from commodity.silver.unified_data
        Returns: DataFrame with date + price
        """

    def load_forecast_distributions(commodity, model_version):
        """
        Load from commodity.forecast.distributions
        Returns: Dict mapping date → numpy array (2000 paths × 14 days)
        """
```

**2. StrategyRunner** (`strategy_runner.py:391 lines`)

```python
class StrategyRunner:
    def run_backtest(strategy, prices, predictions, config):
        """
        Execute single strategy across all historical dates.

        Returns:
            - Daily state DataFrame
            - Trade log
            - Performance metrics (earnings, Sharpe, trades)
        """
```

**3. MultiCommodityRunner** (`multi_commodity_runner.py:526 lines`)

Orchestrates all combinations:
- 2 commodities (Coffee, Sugar)
- 10+ models per commodity
- 10 strategies
- = 200+ backtest runs

**4. ResultSaver** (`result_saver.py:346 lines`)

Saves to Delta Lake:
```python
# Summary table
commodity.trading_agent.results_{commodity}_{model}
    - strategy, net_earnings, sharpe_ratio, n_trades, ...

# Detailed results (pickle files)
/Volumes/commodity/trading_agent/files/results_detailed_*.pkl
    - Daily state
    - Trade-by-trade log
```

**5. Visualization** (`visualization.py:510 lines`)

Generates 220+ charts:
- Cumulative earnings by strategy
- Inventory timeline
- Price vs sale timing
- Strategy heatmaps
- Performance comparisons

---

## Statistical Analysis

### Statistical Testing Framework (`analysis/statistical_tests.py:1,292 lines`)

**Primary Comparison**: Prediction strategies vs Immediate Sale baseline

**Tests Applied**:

**1. Paired t-test**:
```python
# Compare SAME years for both strategies
years = [2020, 2021, 2022, 2023, 2024]
strategy_earnings = [125k, 130k, 128k, 135k, 132k]
baseline_earnings = [98k, 102k, 100k, 105k, 103k]

t_stat, p_value = ttest_rel(strategy_earnings, baseline_earnings)

# Significant if p < 0.05
```

**2. Effect Size (Cohen's d)**:
```python
mean_diff = mean(strategy) - mean(baseline)
pooled_std = sqrt((std(strategy)² + std(baseline)²) / 2)
cohens_d = mean_diff / pooled_std

# Interpretation:
# Small: |d| = 0.2
# Medium: |d| = 0.5
# Large: |d| = 0.8+
```

**3. Bootstrap Confidence Intervals**:
```python
# 10,000 resamples
bootstrap_diffs = []
for _ in range(10000):
    sample = resample(year_differences)
    bootstrap_diffs.append(mean(sample))

ci_95 = percentile(bootstrap_diffs, [2.5, 97.5])
```

**4. Sign Test** (non-parametric):
```python
# How many years did strategy beat baseline?
wins = sum(strategy > baseline)
p_value = binomial_test(wins, n_years, p=0.5)
```

**Output Example**:
```
Rolling Horizon MPC vs Immediate Sale

Sample Size: 5 years (2020-2024)

Paired t-test:
  t-statistic: 4.23
  p-value: 0.014 ✓ SIGNIFICANT

Effect Size:
  Cohen's d: 3.22 (Very large)

95% CI: [$11,450, $42,990]
  ✓ Does not include zero

Sign Test:
  Years positive: 5/5
  p-value: 0.031 ✓ SIGNIFICANT
```

---

## Technology Stack

### Core Technologies

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Compute** | Databricks (PySpark) | Distributed backtesting |
| **Storage** | Delta Lake | Results storage |
| **Catalog** | Unity Catalog | Data governance |
| **Optimization** | scipy.optimize | Linear programming (MPC) |
| **Statistics** | NumPy, Pandas, SciPy | Analysis, metrics |
| **Orchestration** | Python subprocess | Workflow management |

### Data Tables

**Input Tables**:
```
commodity.silver.unified_data           # Historical prices
commodity.forecast.distributions        # Monte Carlo forecasts (2K paths)
commodity.bronze.fx_rates               # Exchange rates (15+ currencies)
```

**Output Tables**:
```
commodity.trading_agent.results_{commodity}_{model}
commodity.trading_agent.results_{commodity}_by_year_{model}
commodity.trading_agent.statistical_tests_{commodity}_{model}
```

---

## Workflows

### Periodic Backtesting (Monthly)

**Purpose**: Evaluate strategy performance, identify best approaches

**Orchestrator**: `run_backtest_workflow.py`

**Steps**:
1. Load latest forecasts from `commodity.forecast.distributions`
2. Run backtests: 10 strategies × 10+ models × 2 commodities
3. Calculate metrics (earnings, Sharpe, trades)
4. Run statistical tests
5. Identify best strategy per commodity-model
6. Save results to Delta Lake
7. Generate 220+ visualization charts

**Duration**: 30-45 minutes for all commodities

### Daily Operations

**Purpose**: Generate trading recommendations

**Script**: `operations/daily_recommendations.py`

**Steps**:
1. Load today's forecast for specified model
2. Load current state (inventory, price history)
3. Apply active strategy
4. Generate SELL/HOLD recommendation
5. Output JSON for WhatsApp integration

**Duration**: Less than 1 minute

---

## Design Decisions

### Why Harvest-Based Inventory?

**Traditional**: Start with full inventory at year start
**Our approach**: Inventory accumulates during harvest windows

**Rationale**:
- More realistic for agricultural producers
- Models actual harvest timing
- Prevents unrealistic pre-harvest sales

### Why 70% Accuracy Threshold?

**Research**: Synthetic model testing at 60%, 70%, 80%, 90%, 100% accuracy

**Finding**: Below 70% directional accuracy, prediction-based strategies DO NOT beat baselines

**Source**: `archive/notebooks/diagnostics/SYNTHETIC_PREDICTION_TEST_PLAN.md`

### Why 0.5% Storage Cost Per Day?

**Research**: Diagnostic parameter sensitivity analysis

**Source**: `CHANGELOG.md:2025-12-04` - "Critical parameter alignment fixes applied"

**Calculation**:
- 0.5% per day × 365 days = 182.5% annual storage cost
- Reflects warehouse fees, insurance, quality degradation

### Why 2,000 Monte Carlo Paths?

**Tradeoff**: Accuracy vs compute cost

- 100 paths: Too noisy
- 1,000 paths: Good but still variance
- 2,000 paths: Stable percentile estimates
- 10,000 paths: Diminishing returns

**Source**: `forecast_agent/docs/DESIGN_DECISIONS.md`

---

## Performance Metrics

### Line Counts (Verified)

**Production System**: 9,105 lines
- Core: 400 lines
- Strategies: 2,916 lines
- Runners: 2,172 lines
- Analysis: 4,017 lines
- Config: 277 lines
- Orchestration: 800 lines

### Execution Performance

**Backtest Speed**: 30-45 minutes for full analysis
- 2 commodities
- 10+ models each
- 10 strategies
- 200+ total combinations

**Statistical Tests**: 5-10 minutes
- Paired t-tests
- Bootstrap CI (10,000 iterations)
- Effect sizes
- Sign tests

---

## Future Enhancements

### Planned Features

**1. Strategy Selection Automation**
- Store best strategy per commodity-model in config table
- Daily operations auto-select active strategy

**2. Performance Tracking**
- Log recommendations vs actual outcomes
- Calculate recommendation accuracy over time

**3. Multi-Objective Optimization**
- Optimize for earnings AND Sharpe ratio
- Pareto frontier analysis

**4. Real-Time Monitoring**
- Dashboard for live strategy performance
- Alert system for anomalies

---

## Related Documentation

- **System Overview**: `MASTER_SYSTEM_PLAN.md`
- **Statistical Testing**: `STATISTICAL_TESTING_REVIEW.md`
- **Configuration**: `production/README.md`
- **Changelog**: `production/CHANGELOG.md`

---

**Last Updated**: 2025-12-10
**Source Code**: [GitHub](https://github.com/gibbonstony/ucberkeley-capstone/tree/main/trading_agent)
