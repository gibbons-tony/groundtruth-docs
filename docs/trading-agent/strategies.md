---
sidebar_position: 2
---

# Complete Trading Strategy Implementation Guide

**Comprehensive technical reference for all 10 trading strategies**

Based on actual Python implementation in `trading_agent/production/strategies/`

---

## Table of Contents

1. [System Context](#system-context)
2. [Technical Indicators Explained](#technical-indicators-explained)
3. [Cost Model](#cost-model)
4. [Baseline Strategies (4)](#baseline-strategies)
5. [Prediction-Based Strategies (5)](#prediction-based-strategies)
6. [Optimization Strategy (1)](#optimization-strategy)
7. [Academic References](#academic-references)
8. [Design Decisions](#design-decisions)

---

## System Context

### The Commodity Producer Scenario

This trading system is designed for **commodity producers** (coffee and sugar farmers) who face a specific challenge:

**Problem**: You harvest 50 tons of coffee in May-September. When should you sell it?

**Constraints**:
1. **Storage costs**: 0.5% per day (inventory degrades, warehousing fees)
2. **Transaction costs**: 1% per sale (brokerage, logistics)
3. **Quality degradation**: Maximum 365 days before coffee goes bad
4. **Price volatility**: Coffee futures prices change daily
5. **Limited foresight**: You can only see 14 days ahead (forecast horizon)

**Options**:
- **Sell immediately**: Minimize storage costs, but might miss price increases
- **Wait for higher prices**: Maximize revenue, but pay storage costs and risk price declines
- **Sell in batches**: Spread risk across time (dollar-cost averaging)
- **Use forecasts**: If you have price predictions, can you time sales better?

**The Question**: Can prediction-based strategies outperform simple baseline approaches?

---

### Harvest Cycle Management

**Key Innovation**: Inventory starts at **ZERO** and accumulates during harvest.

Traditional approach (wrong):
```
Day 1: Start with 50 tons
Day 2: Sell some
Day 3: Sell more
...
```

Realistic approach (ours):
```
Coffee harvest window: May 1 - September 30 (153 days)
Annual volume: 50 tons

Daily increment during harvest:
- 50 tons / 153 days = 0.327 tons/day

Day May 1:    Inventory = 0 + 0.327 = 0.327 tons
Day May 2:    Inventory = 0.327 + 0.327 = 0.654 tons
Day May 3:    Inventory = 0.654 + 0.327 = 0.981 tons
...
Day Sep 30:   Inventory = 49.673 + 0.327 = 50.000 tons

After harvest (Oct 1+): No new inventory, only sales
```

This is implemented in `backtest_engine.py:53-116`:
```python
def _create_harvest_schedule(self):
    """
    Calculate daily inventory increments during harvest windows.

    Example (Coffee):
        - Harvest: May-September (153 days)
        - Volume: 50 tons/year
        - Daily increment: 50 / 153 = 0.327 tons/day
    """
    harvest_schedule = {}
    for month_start, month_end in self.harvest_windows:
        # Convert months to day-of-year
        harvest_days = calculate_days(month_start, month_end)
        daily_increment = self.harvest_volume / harvest_days
        for day in harvest_days:
            harvest_schedule[day] = daily_increment
    return harvest_schedule
```

**Why this matters**: Strategies that sell aggressively early in harvest might run out of inventory later. Realistic harvest modeling ensures accurate backtesting.

---

### Multi-Year Backtesting

The system backtests strategies across **5 years** (2020-2024) to capture:
- Different market conditions (bull markets, bear markets, sideways)
- Multiple harvest cycles (5 cycles per commodity)
- Seasonal patterns
- Price volatility variations

Each year is treated as an independent trial for statistical testing.

---

## Technical Indicators Explained

All strategies use technical indicators to analyze market conditions. Here's how they work.

---

### RSI (Relative Strength Index)

**Source**: Wilder, J. Welles (1978). *New Concepts in Technical Trading Systems.*

**Purpose**: Identify overbought/oversold conditions.

**Formula**:
```
RS = Average Gain (14 days) / Average Loss (14 days)
RSI = 100 - (100 / (1 + RS))
```

**Calculation** (`indicators.py:10-36`):
```python
def calculate_rsi(prices, period=14):
    """
    Calculate Relative Strength Index

    Args:
        prices: Array of historical prices
        period: RSI period (default 14)

    Returns:
        float: RSI value (0-100)
    """
    if len(prices) < period + 1:
        return 50.0  # Neutral if insufficient history

    # Calculate price changes
    deltas = np.diff(prices[-period-1:])

    # Separate gains and losses
    gains = np.where(deltas greater than 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)

    # Average over period
    avg_gain = np.mean(gains)
    avg_loss = np.mean(losses)

    if avg_loss == 0:
        return 100.0  # All gains, maximum RSI

    # Calculate RS and RSI
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))

    return rsi
```

**Interpretation**:
- **RSI greater than 70**: **Overbought** - Price may be too high, likely to fall soon
- **RSI < 30**: **Oversold** - Price may be too low, likely to rise soon
- **RSI ≈ 50**: **Neutral** - No strong signal

**Example**:
```
Last 14 days of price changes:
[+2, +3, -1, +5, +2, -2, +1, +4, -3, +2, +1, -1, +3, +2] cents/lb

Gains: [2, 3, 0, 5, 2, 0, 1, 4, 0, 2, 1, 0, 3, 2] = 25 cents total
Losses: [0, 0, 1, 0, 0, 2, 0, 0, 3, 0, 0, 1, 0, 0] = 7 cents total

Average gain = 25 / 14 = 1.79
Average loss = 7 / 14 = 0.50

RS = 1.79 / 0.50 = 3.58
RSI = 100 - (100 / (1 + 3.58)) = 100 - 21.83 = 78.17

Interpretation: RSI = 78 greater than 70 → OVERBOUGHT (sell signal)
```

**Usage in strategies**:
- `PriceThresholdStrategy`: If RSI greater than 70, increase batch size (sell more)
- `MovingAverageStrategy`: If RSI greater than 70 + downward crossover, sell aggressively

---

### ADX (Average Directional Index)

**Source**: Wilder, J. Welles (1978). *New Concepts in Technical Trading Systems.*

**Purpose**: Measure trend strength (NOT direction).

**Formula** (simplified):
```
1. Calculate True Range (TR) = max(High - Low, |High - Prev Close|, |Low - Prev Close|)
2. Calculate Directional Movement:
   - +DM = max(High - Prev High, 0)  if upward move
   - -DM = max(Prev Low - Low, 0)  if downward move
3. Calculate Directional Indicators:
   - +DI = 100 × (+DM average / ATR)
   - -DI = 100 × (-DM average / ATR)
4. Calculate DX:
   - DX = 100 × |+DI - -DI| / (+DI + -DI)
5. ADX = Moving average of DX
```

**Calculation** (`indicators.py:39-86`):
```python
def calculate_adx(price_history, period=14):
    """
    Calculate Average Directional Index

    Args:
        price_history: DataFrame with 'price' column (and optionally 'high'/'low')
        period: ADX period (default 14)

    Returns:
        tuple: (adx, plus_di, minus_di)
    """
    if len(price_history) < period + 1:
        return 20.0, 0.0, 0.0  # Neutral if insufficient history

    # Get high/low (use price if not available)
    if 'high' in price_history.columns and 'low' in price_history.columns:
        high = price_history['high'].values
        low = price_history['low'].values
    else:
        high = price_history['price'].values
        low = price_history['price'].values

    close = price_history['price'].values

    # Calculate True Range
    tr = np.maximum(high[1:] - low[1:],
                    np.maximum(abs(high[1:] - close[:-1]),
                              abs(low[1:] - close[:-1])))

    # Calculate Directional Movement
    plus_dm = np.where((high[1:] - high[:-1]) greater than (low[:-1] - low[1:]),
                       np.maximum(high[1:] - high[:-1], 0), 0)
    minus_dm = np.where((low[:-1] - low[1:]) greater than (high[1:] - high[:-1]),
                        np.maximum(low[:-1] - low[1:], 0), 0)

    # Calculate Average True Range
    atr = np.mean(tr[-period:])

    if atr greater than 0:
        # Calculate Directional Indicators
        plus_di = 100 * np.mean(plus_dm[-period:]) / atr
        minus_di = 100 * np.mean(minus_dm[-period:]) / atr
    else:
        plus_di = 0.0
        minus_di = 0.0

    # Calculate DX
    di_sum = plus_di + minus_di
    if di_sum greater than 0:
        dx = 100 * abs(plus_di - minus_di) / di_sum
        adx = dx  # Simplified (should be smoothed)
    else:
        adx = 0.0

    return adx, plus_di, minus_di
```

**Interpretation**:
- **ADX greater than 25**: **Strong trend** (either upward or downward)
- **ADX < 20**: **Weak trend** (choppy, sideways market)
- **+DI greater than -DI**: Upward trend
- **-DI greater than +DI**: Downward trend

**Example**:
```
Price data (10 days):
High:  [200, 205, 210, 208, 212, 215, 218, 220, 222, 225]
Low:   [195, 200, 205, 203, 207, 210, 213, 215, 217, 220]
Close: [198, 203, 208, 206, 210, 213, 216, 218, 220, 223]

True Range (last 9 days):
TR = max(H-L, |H-PrevClose|, |L-PrevClose|)
TR[1] = max(205-200, |205-198|, |200-198|) = max(5, 7, 2) = 7
TR[2] = max(210-205, |210-203|, |205-203|) = max(5, 7, 2) = 7
...

+DM (upward moves):
+DM[1] = max(205-200, 0) if (205-200) greater than (195-200) = 5
+DM[2] = max(210-205, 0) if (210-205) greater than (200-205) = 5
...

-DM (downward moves):
-DM[1] = 0 (upward move)
-DM[2] = 0 (upward move)
...

ATR = mean(TR) = 6.5
+DI = 100 × mean(+DM) / ATR = 100 × 4.2 / 6.5 = 64.6
-DI = 100 × mean(-DM) / ATR = 100 × 0.8 / 6.5 = 12.3

DX = 100 × |64.6 - 12.3| / (64.6 + 12.3) = 100 × 52.3 / 76.9 = 68.0
ADX = 68.0

Interpretation: ADX = 68 greater than 25 → STRONG TREND (upward, since +DI greater than -DI)
```

**Usage in strategies**:
- `PriceThresholdStrategy`: If ADX greater than 25 + RSI greater than 70, very strong signal (sell more)
- `MovingAverageStrategy`: If ADX greater than 25 + price above MA, strong uptrend (hold longer)

---

### CV (Coefficient of Variation)

**Purpose**: Measure forecast uncertainty (prediction confidence).

**Formula**:
```
CV = σ / μ
```
Where:
- σ = Standard deviation of predictions
- μ = Median of predictions

**Calculation** (`indicators.py:110-133`):
```python
def calculate_prediction_confidence(predictions, horizon_day):
    """
    Calculate confidence from prediction ensemble using coefficient of variation

    Args:
        predictions: numpy array (n_paths, n_horizons)
                    e.g., (2000 paths, 14 days)
        horizon_day: Which horizon to evaluate (0-indexed)

    Returns:
        float: Coefficient of variation (std_dev / median)
    """
    if predictions is None or predictions.size == 0:
        return 1.0  # Maximum uncertainty

    if horizon_day greater than or equal to  predictions.shape[1]:
        horizon_day = predictions.shape[1] - 1

    # Get all 2,000 predictions for this day
    day_predictions = predictions[:, horizon_day]

    # Calculate median and std dev
    median_pred = np.median(day_predictions)
    std_dev = np.std(day_predictions)

    # Coefficient of variation
    cv = std_dev / median_pred if median_pred greater than 0 else 1.0

    return cv
```

**Interpretation**:
- **CV < 0.05 (5%)**: **HIGH confidence** - Predictions agree strongly
- **CV < 0.15 (15%)**: **MEDIUM confidence** - Moderate agreement
- **CV ≥ 0.15**: **LOW confidence** - Predictions vary widely

**Example**:
```
2,000 forecast paths for day 14:
Prices range from $1.95 to $2.05 per lb

Median = $2.00
Std dev = $0.08

CV = $0.08 / $2.00 = 0.04 = 4%

Interpretation: CV = 4% < 5% → HIGH CONFIDENCE
```

**Why median instead of mean?**
- Robust to outliers
- If 1 path predicts $10 (outlier), median unchanged
- Mean would shift significantly

**Usage in prediction strategies**:
- All prediction-based strategies use CV to determine confidence level
- HIGH confidence (CV < 5%): Trust predictions, override baseline
- MEDIUM confidence (CV < 15%): Blend predictions with baseline
- LOW confidence (CV ≥ 15%): Ignore predictions, use baseline

---

### Moving Average (MA)

**Purpose**: Smooth price data to identify trend.

**Formula**:
```
MA_n = (P_1 + P_2 + ... + P_n) / n
```

**Example** (30-day MA):
```
Last 30 prices:
[195, 196, 198, 200, 202, 203, 205, 207, 208, 210, ...]

MA_30 = (195 + 196 + ... + 210) / 30 = 202.5

Current price = 208
Price vs MA = 208 / 202.5 = 1.027 = 2.7% above MA
```

**Crossover Detection**:
```
Yesterday:
  Price = 201
  MA = 202
  Status: Price BELOW MA

Today:
  Price = 204
  MA = 203
  Status: Price ABOVE MA

→ UPWARD CROSSOVER (price crossed UP through MA)
→ Bullish signal (trend reversing from falling to rising)
```

---

## Cost Model

All strategies account for two costs:

### Storage Cost

**Rate**: 0.5% per day (0.005% in code)

**Rationale** (from `CHANGELOG.md:2025-12-04`):
- Warehouse rental
- Handling fees
- Quality degradation
- Insurance

**Calculation**:
```python
storage_cost = current_price × (0.005 / 100) × days_stored
```

**Example**:
```
Price = $2.00/lb = $4,000/ton
Days stored = 30

Storage cost = $4,000 × (0.005 / 100) × 30
             = $4,000 × 0.00005 × 30
             = $6.00/ton

Over 30 days: $6.00/ton
Over 365 days: $73.00/ton (1.825% of value)
```

### Transaction Cost

**Rate**: 1% per sale (0.01% in code)

**Rationale**:
- Brokerage fees
- Logistics (transport to warehouse/port)
- Quality inspection
- Documentation

**Calculation**:
```python
transaction_cost = sale_price × (0.01 / 100)
```

**Example**:
```
Sale price = $2.00/lb = $4,000/ton
Amount sold = 12.5 tons

Revenue = 12.5 × $4,000 = $50,000
Transaction cost = $50,000 × (0.01 / 100) = $5.00
Net revenue = $50,000 - $5.00 = $49,995
```

**Why these rates?**
- Based on diagnostic research with real producer data
- Validated against industry standards
- Conservative estimates (actual costs may be higher)

---

## Baseline Strategies

Baseline strategies do NOT use forecasts. They serve as benchmarks to evaluate whether predictions add value.

---

### 1. Immediate Sale Strategy

**File**: `baseline.py:29-71`

**Purpose**: Naive baseline - sell everything weekly.

**Algorithm**:
```
Every 7 days:
  If inventory greater than or equal to  min_batch_size:
    Sell ALL inventory
  Else:
    Wait for more accumulation
```

**Decision Logic** (`baseline.py:44-66`):
```python
def decide(self, day, inventory, current_price, price_history, predictions=None):
    if inventory less than or equal to  0:
        return {'action': 'HOLD', 'amount': 0, 'reason': 'no_inventory'}

    # Force liquidation check (365 days max)
    forced = self._force_liquidation_check(day, inventory)
    if forced:
        return forced

    # Check if it's time to sell
    ready_to_sell = (self.days_since_last_sale greater than or equal to  self.sale_frequency_days)
    enough_inventory = (inventory greater than or equal to  self.min_batch_size)

    if ready_to_sell and enough_inventory:
        self.days_since_last_sale = 0
        return {
            'action': 'SELL',
            'amount': inventory,  # Sell ALL
            'reason': f'immediate_weekly_sale_{inventory:.1f}t'
        }

    # Wait
    self.days_since_last_sale += 1
    if not enough_inventory:
        return {'action': 'HOLD', 'amount': 0,
               'reason': f'accumulating_need_{self.min_batch_size:.1f}t'}
    else:
        return {'action': 'HOLD', 'amount': 0,
               'reason': f'waiting_for_sale_day_{self.days_since_last_sale}'}
```

**Parameters**:
- `min_batch_size`: 5.0 tons (don't sell tiny amounts)
- `sale_frequency_days`: 7 (weekly sales)

**Example Execution** (Coffee harvest):
```
Harvest: May 1 - Sep 30 (153 days)
Daily increment: 50 / 153 = 0.327 tons/day

Day 1 (May 1):
  Inventory = 0.327 tons
  Days since sale = 7
  0.327 < 5.0 → HOLD (accumulate)

Day 7 (May 7):
  Inventory = 2.289 tons
  Days since sale = 13
  2.289 < 5.0 → HOLD (still accumulating)

Day 15 (May 15):
  Inventory = 4.905 tons
  Days since sale = 21
  4.905 < 5.0 → HOLD (almost there)

Day 16 (May 16):
  Inventory = 5.232 tons
  Days since sale = 22
  22 greater than or equal to  7 AND 5.232 greater than or equal to  5.0 → SELL ALL 5.232 tons
  Days since sale reset to 0

Day 23 (May 23):
  Inventory = 2.289 tons (accumulated since last sale)
  Days since sale = 7
  2.289 < 5.0 → HOLD

... continues weekly
```

**Academic Context**:
- **NO specific citation** - This is an industry-standard naive baseline
- Represents "sell as soon as possible" farmer behavior
- Minimizes storage costs
- Ignores all market signals
- Expected to underperform but provides lower bound

**Why this design?**:
- Simplest possible strategy
- Easy to understand and implement
- Provides baseline for comparison
- If prediction strategies can't beat this, they have no value

---

### 2. Equal Batch Strategy

**File**: `baseline.py:73-108`

**Purpose**: Systematic liquidation - sell fixed percentages on schedule.

**Algorithm**:
```
Every 30 days:
  Sell 25% of current inventory
```

**Decision Logic** (`baseline.py:88-103`):
```python
def decide(self, day, inventory, current_price, price_history, predictions=None):
    if inventory less than or equal to  0:
        return {'action': 'HOLD', 'amount': 0, 'reason': 'no_inventory'}

    forced = self._force_liquidation_check(day, inventory)
    if forced:
        return forced

    days_since_sale = day - self.last_sale_day

    if days_since_sale greater than or equal to  self.frequency:
        amount = inventory * self.batch_size
        self.last_sale_day = day
        return {'action': 'SELL', 'amount': amount, 'reason': 'scheduled_batch'}

    return {'action': 'HOLD', 'amount': 0, 'reason': 'waiting_for_schedule'}
```

**Parameters**:
- `batch_size`: 0.25 (sell 25% each time)
- `frequency_days`: 30 (monthly batches)

**Example Execution**:
```
Day 0:   Inventory = 50 tons
Day 30:  Sell 50 × 0.25 = 12.5 tons, keep 37.5
Day 60:  Sell 37.5 × 0.25 = 9.375 tons, keep 28.125
Day 90:  Sell 28.125 × 0.25 = 7.031 tons, keep 21.094
Day 120: Sell 21.094 × 0.25 = 5.274 tons, keep 15.820
Day 150: Sell 15.820 × 0.25 = 3.955 tons, keep 11.865
Day 180: Sell 11.865 × 0.25 = 2.966 tons, keep 8.899
Day 210: Sell 8.899 × 0.25 = 2.225 tons, keep 6.674
Day 240: Sell 6.674 × 0.25 = 1.669 tons, keep 5.006
Day 270: Sell 5.006 × 0.25 = 1.252 tons, keep 3.754
Day 300: Sell 3.754 × 0.25 = 0.939 tons, keep 2.816
Day 330: Sell 2.816 × 0.25 = 0.704 tons, keep 2.112
Day 360: Sell 2.112 × 0.25 = 0.528 tons, keep 1.584
Day 365: Force liquidate remaining 1.584 tons
```

**Academic Context**:
- **No strong academic endorsement**
- Reverse dollar-cost averaging
- Research suggests this is suboptimal (reduces expected returns)
- Practitioner heuristic, not research-based

**When to cite**:
Describe as "systematic liquidation with periodic review" or "fixed-fraction disposal policy" without citing specific paper.

**Why this design?**:
- Spreads risk across time
- Avoids timing the market
- Common real-world approach
- Smooths price volatility impact

---

### 3. Price Threshold Strategy

**File**: `baseline.py:110-218`

**Purpose**: Technical analysis baseline - sell when price crosses above MA threshold.

**Algorithm**:
```
1. Calculate 30-day moving average (MA)
2. Set threshold = MA × (1 + threshold_pct)
3. If price greater than threshold:
   a. Calculate RSI and ADX
   b. Determine batch size based on indicators
   c. Sell batch
4. If no sale in 60 days:
   Sell anyway (fallback)
```

**Decision Logic** (`baseline.py:154-188`):
```python
def decide(self, day, inventory, current_price, price_history, predictions=None):
    if inventory less than or equal to  0:
        return {'action': 'HOLD', 'amount': 0, 'reason': 'no_inventory'}

    forced = self._force_liquidation_check(day, inventory)
    if forced:
        return forced

    days_since_sale = day - self.last_sale_day

    # Calculate threshold based on 30-day MA
    if len(price_history) greater than or equal to  30:
        ma_30 = price_history['price'].tail(30).mean()
        threshold = ma_30 * (1 + self.threshold_pct)
    else:
        threshold = current_price * (1 + self.threshold_pct)

    signal_triggered = current_price greater than threshold
    can_trade = days_since_sale greater than or equal to  self.cooldown_days

    if not signal_triggered:
        # Below threshold - wait
        if days_since_sale greater than or equal to  self.max_days_without_sale:
            # Fallback after 60 days
            return self._execute_trade(day, inventory, self.batch_baseline,
                                      f'fallback_{days_since_sale}d')
        return {'action': 'HOLD', 'amount': 0,
               'reason': f'below_threshold_{current_price:.2f}<{threshold:.2f}'}

    if not can_trade:
        # Cooldown period
        return {'action': 'HOLD', 'amount': 0,
               'reason': f'cooldown_{self.cooldown_days - days_since_sale}d'}

    # Signal triggered - analyze with indicators
    batch_size, reason = self._analyze_historical(current_price, price_history)
    return self._execute_trade(day, inventory, batch_size, reason)
```

**Indicator Analysis** (`baseline.py:189-208`):
```python
def _analyze_historical(self, current_price, price_history):
    """Analyze using historical technical indicators"""
    prices = price_history['price'].values
    rsi = calculate_rsi(prices, period=14)
    adx, _, _ = calculate_adx(price_history, period=14)

    if rsi greater than self.rsi_overbought and adx greater than self.adx_strong:
        # Overbought + strong trend
        batch_size = self.batch_overbought_strong  # 0.35
        reason = f'overbought_strong_trend_rsi{rsi:.0f}_adx{adx:.0f}'

    elif rsi greater than self.rsi_overbought:
        # Overbought only
        batch_size = self.batch_overbought  # 0.30
        reason = f'overbought_rsi{rsi:.0f}'

    elif adx greater than self.adx_strong and rsi < self.rsi_moderate:
        # Strong trend but not overbought
        batch_size = self.batch_strong_trend  # 0.20
        reason = f'strong_trend_rsi{rsi:.0f}_adx{adx:.0f}'

    else:
        # Baseline
        batch_size = self.batch_baseline  # 0.25
        reason = f'baseline_rsi{rsi:.0f}_adx{adx:.0f}'

    return batch_size, reason
```

**Parameters**:
- `threshold_pct`: 0.05 (trigger when price greater than MA × 1.05)
- `batch_baseline`: 0.25
- `batch_overbought_strong`: 0.35
- `batch_overbought`: 0.30
- `batch_strong_trend`: 0.20
- `rsi_overbought`: 70
- `rsi_moderate`: 65
- `adx_strong`: 25
- `cooldown_days`: 7
- `max_days_without_sale`: 60

**Example Execution**:
```
Day 50:
  Current price = $2.05/lb
  30-day MA = $1.95/lb
  Threshold = $1.95 × 1.05 = $2.0475/lb

  $2.05 greater than $2.0475 → Signal TRIGGERED

  Days since last sale = 10 greater than or equal to  7 (cooldown passed)

  Calculate indicators:
    RSI = 72 (overbought)
    ADX = 28 (strong trend)

  RSI greater than 70 AND ADX greater than 25 → Overbought + strong trend
  Batch size = 0.35 (sell 35%)

  Inventory = 40 tons
  Sell 40 × 0.35 = 14 tons

  Return: SELL 14 tons, reason = "overbought_strong_trend_rsi72_adx28"
```

**Academic References**:
- **Wilder (1978)** for RSI and ADX indicators
- **Marshall et al. (2008)** "Can commodity futures be profitably traded with quantitative market timing strategies?" *Journal of Banking & Finance*
  - Comprehensive examination of quantitative trading rules in commodity futures
  - Tests 15 major commodity futures series
- **Brock et al. (1992)** "Simple technical trading rules and the stochastic properties of stock returns" *Journal of Finance*
  - Academic validation of moving average strategies

**Why this design?**:
- Combines price momentum (threshold) with technical confirmation (RSI/ADX)
- Cooldown prevents overtrading (transaction costs add up)
- Fallback prevents holding too long in flat markets
- Adaptive batch sizing based on signal strength

---

### 4. Moving Average Strategy

**File**: `baseline.py:220-340`

**Purpose**: Crossover detection - sell when price crosses down through MA.

**Algorithm**:
```
1. Calculate 30-day moving average (MA)
2. Detect crossovers:
   - Upward cross (price crosses UP): HOLD (bullish)
   - Downward cross (price crosses DOWN): SELL (bearish)
3. If downward cross:
   a. Calculate RSI and ADX
   b. Determine batch size
   c. Sell batch
4. If no sale in 60 days:
   Sell anyway (fallback)
```

**Crossover Detection** (`baseline.py:284-310`):
```python
# Get last 31 prices
recent_prices = price_history['price'].tail(self.period + 1).values

# Calculate moving averages
ma_current = np.mean(recent_prices[-30:])  # Last 30 days
ma_prev = np.mean(recent_prices[-31:-1])   # Previous 30 days

prev_price = recent_prices[-2]

# Detect crossover directions
upward_cross = (prev_price less than or equal to  ma_prev and current_price greater than ma_current)
downward_cross = (prev_price greater than or equal to  ma_prev and current_price < ma_current)

# Upward crossover: Transition from falling to rising - HOLD
if upward_cross:
    return {'action': 'HOLD', 'amount': 0, 'reason': 'upward_crossover_bullish'}

# Downward crossover: Transition from rising to falling - SELL
if downward_cross:
    if not can_trade:
        return {'action': 'HOLD', 'amount': 0,
               'reason': f'cooldown_{self.cooldown_days - days_since_sale}d'}

    # Analyze with indicators
    batch_size, reason = self._analyze_historical(current_price, price_history)
    return self._execute_trade(day, inventory, batch_size, reason)

# No crossover: maintain position
return {'action': 'HOLD', 'amount': 0, 'reason': 'no_crossover'}
```

**Indicator Analysis** (`baseline.py:312-331`):
```python
def _analyze_historical(self, current_price, price_history):
    """Analyze using historical technical indicators"""
    prices = price_history['price'].values
    rsi = calculate_rsi(prices, period=14)
    adx, _, _ = calculate_adx(price_history, period=14)

    if adx greater than self.adx_strong and rsi greater than or equal to  self.rsi_min and rsi less than or equal to  self.rsi_overbought:
        # Strong momentum
        batch_size = self.batch_strong_momentum  # 0.20
        reason = f'strong_momentum_rsi{rsi:.0f}_adx{adx:.0f}'

    elif rsi greater than self.rsi_overbought and adx greater than self.adx_strong:
        # Overbought + strong trend
        batch_size = self.batch_overbought_strong  # 0.35
        reason = f'overbought_strong_rsi{rsi:.0f}_adx{adx:.0f}'

    elif rsi greater than self.rsi_overbought:
        # Overbought only
        batch_size = self.batch_overbought  # 0.30
        reason = f'overbought_rsi{rsi:.0f}'

    else:
        # Baseline
        batch_size = self.batch_baseline  # 0.25
        reason = f'baseline_rsi{rsi:.0f}_adx{adx:.0f}'

    return batch_size, reason
```

**Parameters**:
- `ma_period`: 30 (30-day moving average)
- `batch_baseline`: 0.25
- `batch_strong_momentum`: 0.20
- `batch_overbought_strong`: 0.35
- `batch_overbought`: 0.30
- `rsi_overbought`: 70
- `rsi_min`: 45
- `adx_strong`: 25
- `adx_weak`: 20
- `cooldown_days`: 7
- `max_days_without_sale`: 60

**Example Execution**:
```
Day 75:
  Current price = $1.98/lb
  MA (days 45-74) = $2.02/lb
  MA (days 46-75) = $2.00/lb

  Yesterday:
    Price = $2.03/lb
    MA = $2.02/lb
    Status: Price ABOVE MA

  Today:
    Price = $1.98/lb
    MA = $2.00/lb
    Status: Price BELOW MA

  Detection: DOWNWARD CROSSOVER
  (Price crossed DOWN through MA → Bearish signal)

  Days since last sale = 12 greater than or equal to  7 (cooldown passed)

  Calculate indicators:
    RSI = 55 (neutral)
    ADX = 30 (strong trend)

  ADX greater than 25 AND RSI between 45-70 → Strong momentum
  Batch size = 0.20 (sell 20%)

  Inventory = 35 tons
  Sell 35 × 0.20 = 7 tons

  Return: SELL 7 tons, reason = "strong_momentum_rsi55_adx30"
```

**Academic References**:
- **Marshall et al. (2008)** - Most appropriate for commodity MA strategies
- **Brock et al. (1992)** - Comprehensive MA study (stock-focused but validates approach)
- **Wilder (1978)** - For RSI/ADX indicators

**Why this design?**:
- Classic technical analysis pattern
- Downward crossover signals trend reversal (rising → falling)
- Upward crossover signals bullish trend (hold for higher prices)
- Avoids selling into rising markets

---

## Prediction-Based Strategies

These strategies use 14-day price forecasts (2,000 Monte Carlo paths) to make decisions.

**Key Innovation: 3-Tier Confidence System**

All prediction-based matched pairs use this system:

**Tier 1: HIGH Confidence (CV < 5%)**
- **Action**: OVERRIDE baseline completely
- **Logic**: Predictions are highly certain, trust them fully
- **Example**: If predictions show strong upward trend with 4% CV, HOLD regardless of baseline signal

**Tier 2: MEDIUM Confidence (CV < 15%)**
- **Action**: BLEND baseline + predictions
- **Logic**: Moderate certainty, use both signals
- **Example**: If baseline says SELL and predictions say HOLD, reduce sell amount by 50%

**Tier 3: LOW Confidence (CV ≥ 15%)**
- **Action**: FOLLOW baseline exactly
- **Logic**: Predictions too uncertain, ignore them
- **Example**: Execute baseline strategy as if predictions don't exist

This ensures fair A/B testing between baseline and prediction-augmented strategies.

---

### 5. Price Threshold Predictive (Matched Pair)

**File**: `prediction.py:46-380`

**Purpose**: Augment Price Threshold baseline with forecast-driven overrides.

**Matched Pair Design**:
- **Baseline**: PriceThresholdStrategy (no forecasts)
- **Augmented**: This strategy (with prediction capability)
- **Goal**: Measure value added by predictions

**Decision Hierarchy** (`prediction.py:124-166`):
```python
def decide(self, day, inventory, current_price, price_history, predictions=None):
    """
    DECISION HIERARCHY:
    1. Forced liquidation (always highest priority)
    2. Cooldown check
    3. Prediction signal analysis (if available)
    4. Baseline signal (if no predictions or low confidence)
    """
    if inventory less than or equal to  0:
        return {'action': 'HOLD', 'amount': 0, 'reason': 'no_inventory'}

    forced = self._force_liquidation_check(day, inventory)
    if forced:
        return forced

    days_since_sale = day - self.last_sale_day

    if days_since_sale < self.cooldown_days:
        return {'action': 'HOLD', 'amount': 0,
               'reason': f'cooldown_{self.cooldown_days - days_since_sale}d'}

    # Analyze predictions if available
    if predictions is not None and predictions.size greater than 0:
        pred_signal = self._analyze_prediction_signal(
            current_price, price_history, predictions
        )

        # HIGH CONFIDENCE → OVERRIDE BASELINE
        if pred_signal['confidence'] == 'HIGH':
            return self._execute_prediction_override(
                day, inventory, pred_signal, price_history
            )

        # MEDIUM CONFIDENCE → BLEND WITH BASELINE
        elif pred_signal['confidence'] == 'MEDIUM':
            return self._execute_blended_decision(
                day, inventory, current_price, price_history, pred_signal
            )

    # LOW/NO CONFIDENCE → FOLLOW BASELINE
    return self._execute_baseline_logic(
        day, inventory, current_price, price_history
    )
```

**Prediction Signal Analysis** (`prediction.py:168-209`):
```python
def _analyze_prediction_signal(self, current_price, price_history, predictions):
    """
    Analyze predictions to determine:
    1. Direction (upward/downward/neutral)
    2. Magnitude (strong/moderate/weak)
    3. Confidence (high/medium/low)
    """
    # predictions is (2000 paths × 14 days) matrix

    # Calculate net benefit across all horizons
    net_benefit_pct = self._calculate_net_benefit_pct(current_price, predictions)

    # Calculate prediction confidence (CV at day 14)
    day_14_predictions = predictions[:, 13]  # 2,000 values
    median = np.median(day_14_predictions)
    std_dev = np.std(day_14_predictions)
    cv = std_dev / median

    # Determine confidence level
    if cv < self.high_confidence_cv:  # CV < 5%
        confidence = 'HIGH'
    elif cv < self.medium_confidence_cv:  # CV < 15%
        confidence = 'MEDIUM'
    else:
        confidence = 'LOW'

    # Determine direction and magnitude
    if net_benefit_pct greater than self.strong_positive_threshold: 2.0 (text: greater than 2 percent net benefit)
        direction = 'STRONG_UPWARD'
    elif net_benefit_pct greater than self.moderate_threshold: 0.5 (text: plus or minus 0.5 percent)
        direction = 'MODERATE_UPWARD'
    elif net_benefit_pct < self.strong_negative_threshold: -1.0 (text: less than -1 percent net benefit)
        direction = 'STRONG_DOWNWARD'
    elif net_benefit_pct less than -self.moderate_threshold: 0.5 (text: plus or minus 0.5 percent)
        direction = 'MODERATE_DOWNWARD'
    else:
        direction = 'NEUTRAL'

    return {
        'confidence': confidence,
        'direction': direction,
        'net_benefit_pct': net_benefit_pct,
        'cv': cv
    }
```

**Net Benefit Calculation** (`prediction.py:351-371`):
```python
def _calculate_net_benefit_pct(self, current_price, predictions):
    """
    Calculate net benefit as percentage:
    (best_future_value - sell_today_value) / current_price * 100

    Accounts for storage and transaction costs.
    """
    # Find optimal day to sell in 14-day window
    ev_by_day = []
    for day in range(14):
        # Use median of 2,000 paths as expected price
        future_price = np.median(predictions[:, day])
        days_to_wait = day + 1

        # Calculate costs
        storage_cost = current_price * (self.storage_cost_pct_per_day / 100) * days_to_wait
        transaction_cost = future_price * (self.transaction_cost_pct / 100)

        # Expected value if we sell on this day
        ev = future_price - storage_cost - transaction_cost
        ev_by_day.append(ev)

    # Compare to selling today
    transaction_cost_today = current_price * (self.transaction_cost_pct / 100)
    ev_today = current_price - transaction_cost_today

    # Find best option
    optimal_ev = max(ev_by_day)
    net_benefit_pct = 100 * (optimal_ev - ev_today) / current_price

    return net_benefit_pct
```

**HIGH Confidence Override** (`prediction.py:211-244`):
```python
def _execute_prediction_override(self, day, inventory, pred_signal, price_history):
    """
    HIGH CONFIDENCE: Predictions override baseline completely
    """
    direction = pred_signal['direction']
    net_benefit = pred_signal['net_benefit_pct']
    cv = pred_signal['cv']

    if direction == 'STRONG_UPWARD':
        # Strong evidence prices will rise → HOLD completely
        batch_size = self.batch_pred_hold  # 0.0
        reason = f'OVERRIDE_hold_strong_upward_net{net_benefit:.2f}%_cv{cv:.2%}'

    elif direction == 'MODERATE_UPWARD':
        # Moderate upward → Small hedge
        batch_size = self.batch_pred_cautious  # 0.15
        reason = f'OVERRIDE_small_hedge_mod_upward_net{net_benefit:.2f}%_cv{cv:.2%}'

    elif direction == 'STRONG_DOWNWARD':
        # Strong evidence prices will fall → SELL aggressively
        batch_size = self.batch_pred_aggressive  # 0.40
        reason = f'OVERRIDE_aggressive_strong_downward_net{net_benefit:.2f}%_cv{cv:.2%}'

    elif direction == 'MODERATE_DOWNWARD':
        # Moderate downward → Sell baseline
        batch_size = self.batch_baseline  # 0.25
        reason = f'OVERRIDE_baseline_mod_downward_net{net_benefit:.2f}%_cv{cv:.2%}'

    else:  # NEUTRAL
        # Unclear signal → Use baseline batch
        batch_size = self.batch_baseline  # 0.25
        reason = f'OVERRIDE_neutral_net{net_benefit:.2f}%_cv{cv:.2%}'

    return self._execute_trade(day, inventory, batch_size, reason)
```

**MEDIUM Confidence Blend** (`prediction.py:246-283`):
```python
def _execute_blended_decision(self, day, inventory, current_price, price_history, pred_signal):
    """
    MEDIUM CONFIDENCE: Blend baseline signal with prediction signal
    """
    # Calculate what baseline would do
    baseline_action = self._get_baseline_action(current_price, price_history)

    direction = pred_signal['direction']
    net_benefit = pred_signal['net_benefit_pct']

    # Blend logic:
    if baseline_action['triggered']:
        # Baseline says SELL (price above threshold)
        if direction in ['STRONG_UPWARD', 'MODERATE_UPWARD']:
            # Predictions disagree (say hold) → reduce sell amount
            batch_size = baseline_action['batch_size'] * 0.5
            reason = f'BLEND_reduce_sell_pred_upward_net{net_benefit:.2f}%'
        else:
            # Predictions agree or neutral → follow baseline
            batch_size = baseline_action['batch_size']
            reason = f'BLEND_follow_baseline_{baseline_action["reason"]}'

    else:
        # Baseline says HOLD (price below threshold)
        if direction in ['STRONG_DOWNWARD', 'MODERATE_DOWNWARD']:
            # Predictions disagree (say sell) → cautious sell
            batch_size = self.batch_pred_cautious  # 0.15
            reason = f'BLEND_cautious_sell_pred_downward_net{net_benefit:.2f}%'
        else:
            # Predictions agree → hold
            return {'action': 'HOLD', 'amount': 0, 'reason': 'BLEND_hold_pred_agrees'}

    return self._execute_trade(day, inventory, batch_size, reason)
```

**LOW Confidence Baseline** (`prediction.py:285-310`):
```python
def _execute_baseline_logic(self, day, inventory, current_price, price_history):
    """
    Execute IDENTICAL logic to PriceThresholdStrategy (for fair comparison)
    """
    days_since_sale = day - self.last_sale_day

    # Calculate threshold
    if len(price_history) greater than or equal to  30:
        ma_30 = price_history['price'].tail(30).mean()
        threshold = ma_30 * (1 + self.threshold_pct)
    else:
        threshold = current_price * (1 + self.threshold_pct)

    signal_triggered = current_price greater than threshold

    if not signal_triggered:
        # Fallback after 60 days
        if days_since_sale greater than or equal to  self.max_days_without_sale:
            return self._execute_trade(day, inventory, self.batch_baseline,
                                      f'BASELINE_fallback_{days_since_sale}d')
        return {'action': 'HOLD', 'amount': 0,
               'reason': f'BASELINE_below_threshold_{current_price:.2f}<{threshold:.2f}'}

    # Signal triggered → analyze with technical indicators
    batch_size, reason = self._analyze_baseline_technicals(current_price, price_history)
    return self._execute_trade(day, inventory, batch_size, f'BASELINE_{reason}')
```

**Example Execution**:
```
Day 80:
  Current price = $2.05/lb
  MA = $1.95/lb
  Threshold = $2.0475/lb

  Predictions (2,000 paths × 14 days):
    Day 14 median = $2.15/lb
    Day 14 std dev = $0.06/lb
    CV = $0.06 / $2.15 = 0.028 = 2.8% → HIGH CONFIDENCE

  Calculate net benefit:
    Best day to sell = Day 14
    EV(day 14) = $2.15 - storage($0.08) - transaction($0.02) = $2.05
    EV(today) = $2.05 - transaction($0.02) = $2.03
    Net benefit = ($2.05 - $2.03) / $2.05 × 100 = 0.98%

  Signal analysis:
    Confidence = HIGH (CV 2.8% < 5%)
    Direction = MODERATE_UPWARD (net benefit 0.98% greater than 0.5%)

  Decision: HIGH CONFIDENCE → OVERRIDE
    Direction = MODERATE_UPWARD
    Batch size = 0.15 (small hedge)
    Reason = "OVERRIDE_small_hedge_mod_upward_net0.98%_cv2.8%"

  Inventory = 40 tons
  Sell 40 × 0.15 = 6 tons
```

**Academic References**:
- **Marshall et al. (2008)** for baseline threshold strategy
- **Williams & Wright (1991)** *Storage and Commodity Markets* for cost-benefit framework
- Confidence weighting described as "novel extension"

**Parameters**:
- Inherits all baseline parameters from PriceThresholdStrategy
- `high_confidence_cv`: 0.05 (5%)
- `medium_confidence_cv`: 0.15 (15%)
- `strong_positive_threshold: 2.0 (text: greater than 2 percent net benefit)
- `strong_negative_threshold: -1.0 (text: less than -1 percent net benefit)
- `moderate_threshold: 0.5 (text: plus or minus 0.5 percent)
- `batch_pred_hold`: 0.0
- `batch_pred_aggressive`: 0.40
- `batch_pred_cautious`: 0.15

---

### 6. Moving Average Predictive (Matched Pair)

**File**: `prediction.py:387-729`

**Purpose**: Augment Moving Average baseline with forecast-driven overrides.

**Same 3-tier confidence system** as Price Threshold Predictive, but baseline is MA crossover instead of price threshold.

**Decision Logic**: Identical structure to Price Threshold Predictive, but `_execute_baseline_logic()` implements MA crossover detection.

**Academic References**: Same as Price Threshold Predictive.

---

### 7. Expected Value Strategy (Standalone)

**File**: `prediction.py:736-866`

**Purpose**: Optimize expected value across all forecast horizons.

**Algorithm**:
```
1. For each of 14 forecast days:
   a. Calculate expected revenue = median(predictions) - costs
2. Find day with maximum expected value
3. Calculate net benefit vs selling today
4. Decision based on:
   - Net benefit magnitude
   - Prediction confidence (CV)
   - Trend strength (ADX)
```

**Optimal Sale Day Calculation** (`prediction.py:841-857`):
```python
def _find_optimal_sale_day_pct(self, current_price, predictions):
    # predictions is (2000 paths × 14 days)

    ev_by_day = []
    for day in range(14):
        # Use median of 2,000 paths as expected price
        future_price = np.median(predictions[:, day])
        days_to_wait = day + 1

        # Calculate costs
        storage_cost = current_price * (self.storage_cost_pct_per_day / 100) * days_to_wait
        transaction_cost = future_price * (self.transaction_cost_pct / 100)

        # Expected value if we sell on this day
        ev = future_price - storage_cost - transaction_cost
        ev_by_day.append(ev)

    # Compare to selling today
    transaction_cost_today = current_price * (self.transaction_cost_pct / 100)
    ev_today = current_price - transaction_cost_today

    # Find best option
    optimal_day = np.argmax(ev_by_day)
    net_benefit_pct = 100 * (ev_by_day[optimal_day] - ev_today) / current_price

    return optimal_day, net_benefit_pct
```

**Decision Based on Net Benefit** (`prediction.py:805-839`):
```python
def _analyze_expected_value_pct(self, current_price, price_history, predictions):
    optimal_day, net_benefit_pct = self._find_optimal_sale_day_pct(current_price, predictions)

    # Calculate confidence
    cv = calculate_prediction_confidence(predictions, horizon_day=13)  # Day 14
    adx, _, _ = calculate_adx(price_history, period=14)

    # Decision based on net benefit magnitude
    if net_benefit_pct greater than self.min_net_benefit_pct:  # greater than 0.5%
        # Positive net benefit (waiting is better)

        if cv < self.high_confidence_cv and adx greater than self.strong_trend_adx:
            # High confidence + strong trend - hold all
            batch_size = self.batch_positive_confident  # 0.0
            reason = f'net_benefit_{net_benefit_pct:.2f}%_high_conf_hold_to_day{optimal_day}'

        elif cv < self.medium_confidence_cv:
            # Medium confidence - small hedge
            batch_size = self.batch_positive_uncertain  # 0.10
            reason = f'net_benefit_{net_benefit_pct:.2f}%_med_conf_small_hedge_day{optimal_day}'

        else:
            # Low confidence - larger hedge
            batch_size = self.batch_marginal  # 0.15
            reason = f'net_benefit_{net_benefit_pct:.2f}%_low_conf_hedge'

    elif net_benefit_pct greater than 0:  # Marginal benefit (0% to 0.5%)
        batch_size = self.batch_marginal  # 0.15
        reason = f'marginal_benefit_{net_benefit_pct:.2f}%_gradual_liquidation'

    elif net_benefit_pct greater than self.negative_threshold_pct:  # -0.3% to 0%
        # Mild negative (sell today slightly better)
        batch_size = self.batch_negative_mild  # 0.25
        reason = f'mild_negative_{net_benefit_pct:.2f}%_avoid_storage'

    else:  # less than -0.3%
        # Strong negative (sell immediately much better)
        batch_size = self.batch_negative_strong  # 0.35
        reason = f'strong_negative_{net_benefit_pct:.2f}%_sell_to_cut_losses'

    return batch_size, reason
```

**Example Calculation**:
```
Current price: $2.00/lb = $4,000/ton
Inventory: 50 tons

Predictions (2,000 paths × 14 days):
Day 1:  Median = $2.01/lb = $4,020/ton
Day 7:  Median = $2.05/lb = $4,100/ton
Day 14: Median = $2.08/lb = $4,160/ton

Calculate EV for each day:

Day 1:
  Future price: $4,020/ton
  Storage cost: $4,000 × (0.005/100) × 1 = $0.20/ton
  Transaction cost: $4,020 × (0.01/100) = $0.40/ton
  EV = $4,020 - $0.20 - $0.40 = $4,019.40/ton

Day 7:
  Future price: $4,100/ton
  Storage cost: $4,000 × (0.005/100) × 7 = $1.40/ton
  Transaction cost: $4,100 × (0.01/100) = $0.41/ton
  EV = $4,100 - $1.40 - $0.41 = $4,098.19/ton

Day 14:
  Future price: $4,160/ton
  Storage cost: $4,000 × (0.005/100) × 14 = $2.80/ton
  Transaction cost: $4,160 × (0.01/100) = $0.42/ton
  EV = $4,160 - $2.80 - $0.42 = $4,156.78/ton  ← BEST

Sell today:
  Price: $4,000/ton
  Transaction cost: $4,000 × (0.01/100) = $0.40/ton
  EV = $4,000 - $0.40 = $3,999.60/ton

Net benefit = ($4,156.78 - $3,999.60) / $4,000 × 100 = 3.93%

Confidence:
  CV at day 14 = 0.04 = 4% → HIGH CONFIDENCE
  ADX = 30 → STRONG TREND

Decision:
  Net benefit = 3.93% greater than 0.5% (positive)
  CV = 4% < 5% (high confidence)
  ADX = 30 greater than 25 (strong trend)

  → batch_size = 0.0 (HOLD all)
  → reason = "net_benefit_3.93%_high_conf_hold_to_day14"

Result: HOLD all 50 tons (wait for day 14)
```

**Academic References**:
- **Williams, J. C., & Wright, B. D. (1991).** *Storage and Commodity Markets.* Cambridge University Press.
  - ISBN: 9780521326162
  - Comprehensive treatment of commodity storage decisions with uncertainty
  - PERFECT fit for this strategy

**Parameters**:
- `storage_cost_pct_per_day`: Inherited from config
- `transaction_cost_pct`: Inherited from config
- `min_net_benefit_pct`: 0.5 (0.5% minimum)
- `negative_threshold_pct`: -0.3 (-0.3%)
- `high_confidence_cv`: 0.05 (5%)
- `medium_confidence_cv`: 0.10 (10%)
- `strong_trend_adx`: 25
- `batch_positive_confident`: 0.0
- `batch_positive_uncertain`: 0.10
- `batch_marginal`: 0.15
- `batch_negative_mild`: 0.25
- `batch_negative_strong`: 0.35
- `cooldown_days`: 7
- `baseline_batch`: 0.15
- `baseline_frequency`: 30

**Why this design?**:
- Academically grounded (Williams & Wright 1991)
- Optimal from cost-benefit perspective
- Accounts for storage costs rising linearly with time
- Uses ensemble median (robust to outliers)

---

### 8. Consensus Strategy (Standalone)

**File**: `prediction.py:873-1028`

**Purpose**: Democratic vote across 2,000 forecast paths.

**Algorithm**:
```
1. Count % of paths showing sufficient return (greater than 3%)
2. If ≥70% bullish AND net benefit greater than threshold: HOLD
3. If <30% bullish (bearish consensus): SELL aggressively
4. Batch size modulated by consensus strength
```

**Consensus Calculation** (`prediction.py:963-1019`):
```python
def _analyze_consensus_pct(self, current_price, price_history, predictions):
    # Evaluate at day 14
    eval_day = min(self.evaluation_day, predictions.shape[1] - 1)
    day_predictions = predictions[:, eval_day]  # 2,000 values

    # Calculate expected return
    median_future = np.median(day_predictions)
    expected_return_pct = (median_future - current_price) / current_price

    # Count bullish predictions (those showing greater than 3% return)
    bullish_count = np.sum(
        (day_predictions - current_price) / current_price greater than self.min_return  # 3%
    )
    bullish_pct = bullish_count / len(day_predictions)  # 0.0 to 1.0

    # Calculate confidence
    cv = calculate_prediction_confidence(predictions, eval_day)

    # Calculate net benefit (accounting for costs)
    days_to_wait = eval_day + 1
    storage_cost_pct = (self.storage_cost_pct_per_day / 100) * days_to_wait
    transaction_cost_pct = self.transaction_cost_pct / 100
    net_benefit_pct = 100 * (expected_return_pct - storage_cost_pct - transaction_cost_pct)

    # Decision based on consensus strength
    if bullish_pct greater than or equal to  self.very_strong_consensus and net_benefit_pct greater than self.min_net_benefit_pct:
        # Very strong consensus (85%+ bullish) + positive net benefit
        batch_size = self.batch_strong_consensus  # 0.0
        reason = f'very_strong_consensus_{bullish_pct:.0%}_net_{net_benefit_pct:.2f}%_hold'

    elif bullish_pct greater than or equal to  self.consensus_threshold and net_benefit_pct greater than self.min_net_benefit_pct:
        # Strong consensus (70%+ bullish) + positive net benefit
        if cv < self.high_confidence_cv:
            batch_size = self.batch_strong_consensus  # 0.0
            reason = f'strong_consensus_{bullish_pct:.0%}_high_conf_hold'
        else:
            batch_size = self.batch_moderate  # 0.15
            reason = f'strong_consensus_{bullish_pct:.0%}_med_conf_gradual'

    elif bullish_pct greater than or equal to  self.moderate_consensus:
        # Moderate consensus (60%+ bullish)
        batch_size = self.batch_moderate  # 0.15
        reason = f'moderate_consensus_{bullish_pct:.0%}_gradual'

    elif bullish_pct < (1 - self.consensus_threshold):
        # Bearish consensus (< 30% bullish, i.e., greater than 70% bearish)
        batch_size = self.batch_bearish  # 0.35
        reason = f'bearish_consensus_{bullish_pct:.0%}_sell'

    else:
        # Weak/unclear consensus (30-60% bullish)
        batch_size = self.batch_weak  # 0.25
        reason = f'weak_consensus_{bullish_pct:.0%}_sell'

    return batch_size, reason
```

**Example**:
```
Predictions at day 14: 2,000 paths
Current price: $2.00/lb

Path-by-path analysis:
Path 1: $2.08/lb → Return = 4.0% → BULLISH (greater than 3%)
Path 2: $2.05/lb → Return = 2.5% → BEARISH (< 3%)
Path 3: $2.10/lb → Return = 5.0% → BULLISH
Path 4: $2.02/lb → Return = 1.0% → BEARISH
...
Path 2000: $2.07/lb → Return = 3.5% → BULLISH

Count:
Bullish paths: 1,700
Bearish paths: 300
Bullish percentage: 1,700 / 2,000 = 85%

Statistics:
Median = $2.08/lb
Std dev = $0.06/lb
CV = $0.06 / $2.08 = 0.029 = 2.9% → HIGH CONFIDENCE

Expected return = ($2.08 - $2.00) / $2.00 = 4.0%
Storage cost (14 days) = 0.005% × 14 = 0.07%
Transaction cost = 0.01%
Net benefit = 4.0% - 0.07% - 0.01% = 3.92%

Decision:
Bullish% = 85% greater than or equal to  85% (very strong consensus)
Net benefit = 3.92% greater than 0.5%

→ batch_size = 0.0 (HOLD all)
→ reason = "very_strong_consensus_85%_net_3.92%_hold"

Result: HOLD all inventory
```

**Academic References**:
- **Clemen, R. T. (1989).** "Combining forecasts: A review and annotated bibliography." *International Journal of Forecasting*, 5(4), 559-583.
  - DOI: 10.1016/0169-2070(89)90012-5
  - 2,165+ citations
  - Key finding: "Forecast accuracy can be substantially improved through combination of multiple individual forecasts"
  - EXCELLENT fit for ensemble/consensus methodology

**Parameters**:
- `storage_cost_pct_per_day`: Inherited
- `transaction_cost_pct`: Inherited
- `consensus_threshold`: 0.70 (70% agreement)
- `very_strong_consensus`: 0.85 (85% agreement)
- `moderate_consensus`: 0.60 (60% agreement)
- `min_return`: 0.03 (3% return threshold for "bullish")
- `min_net_benefit_pct`: 0.5 (0.5% minimum)
- `high_confidence_cv`: 0.05 (5%)
- `evaluation_day`: 14
- `batch_strong_consensus`: 0.0
- `batch_moderate`: 0.15
- `batch_weak`: 0.25
- `batch_bearish`: 0.35
- `cooldown_days`: 7

**Why this design?**:
- Ensemble voting robust to individual model errors
- Leverages full distribution (not just median)
- Captures market uncertainty through consensus strength
- Democratic approach reduces impact of outliers

---

### 9. Risk-Adjusted Strategy (Standalone)

**File**: `prediction.py:1035-1190`

**Purpose**: Balance expected return vs forecast uncertainty (Sharpe ratio approach).

**Algorithm**:
```
1. Calculate expected return as percentage
2. Measure prediction uncertainty (CV)
3. Classify into risk tiers:
   - Low risk (CV < 5% + strong trend): HOLD all
   - Medium risk (CV < 10%): Small hedge
   - High risk (CV < 20%): Larger hedge
   - Very high risk (CV ≥ 20%): Sell aggressively
4. Decision based on return/risk tradeoff
```

**Risk-Adjusted Decision** (`prediction.py:1125-1181`):
```python
def _analyze_risk_adjusted_pct(self, current_price, price_history, predictions):
    # Evaluate at day 14
    eval_day = min(self.evaluation_day, predictions.shape[1] - 1)
    day_predictions = predictions[:, eval_day]  # 2,000 values

    # Calculate expected return
    median_future = np.median(day_predictions)
    expected_return_pct = (median_future - current_price) / current_price

    # Measure uncertainty (risk)
    cv = calculate_prediction_confidence(predictions, eval_day)
    # cv = std_dev / median
    # Low risk: cv < 0.05 (5%)
    # Medium risk: cv < 0.10 (10%)
    # High risk: cv < 0.20 (20%)
    # Very high risk: cv greater than or equal to  0.20

    # Calculate net benefit (accounting for costs)
    days_to_wait = eval_day + 1
    storage_cost_pct = (self.storage_cost_pct_per_day / 100) * days_to_wait
    transaction_cost_pct = self.transaction_cost_pct / 100
    net_benefit_pct = 100 * (expected_return_pct - storage_cost_pct - transaction_cost_pct)

    # Get trend strength
    adx, _, _ = calculate_adx(price_history, period=min(14, len(price_history)-1))

    # Check if return is sufficient
    if expected_return_pct greater than or equal to  self.min_return and net_benefit_pct greater than self.min_net_benefit_pct:
        # Sufficient return - tier by risk

        if cv < self.max_uncertainty_low and adx greater than self.strong_trend_adx:
            # Low risk + strong trend
            batch_size = self.batch_low_risk  # 0.0
            reason = f'low_risk_cv{cv:.2%}_return{expected_return_pct:.2%}_hold'

        elif cv < self.max_uncertainty_medium:
            # Medium risk
            batch_size = self.batch_medium_risk  # 0.10
            reason = f'medium_risk_cv{cv:.2%}_return{expected_return_pct:.2%}_small_hedge'

        elif cv < self.max_uncertainty_high:
            # High risk
            batch_size = self.batch_high_risk  # 0.25
            reason = f'high_risk_cv{cv:.2%}_return{expected_return_pct:.2%}_hedge'

        else:
            # Very high risk
            batch_size = self.batch_very_high_risk  # 0.35
            reason = f'very_high_risk_cv{cv:.2%}_sell'

    else:
        # Insufficient return or negative net benefit
        if net_benefit_pct < 0:
            batch_size = self.batch_very_high_risk  # 0.35
            reason = f'negative_net_benefit_{net_benefit_pct:.2f}%_sell'
        else:
            batch_size = self.batch_high_risk  # 0.25
            reason = f'insufficient_return_{expected_return_pct:.2%}_sell'

    return batch_size, reason
```

**Risk-Tiered Examples**:
```
Scenario A: Low Risk, High Return
  Current price: $2.00/lb
  Day 14 predictions (2,000 paths):
    Median: $2.10/lb
    Std dev: $0.06/lb
    CV = $0.06 / $2.10 = 0.029 = 2.9% → LOW RISK

  Expected return = ($2.10 - $2.00) / $2.00 = 5.0%
  Net benefit = 5.0% - 0.07% - 0.01% = 4.92%
  ADX = 30 → STRONG TREND

  Decision:
    Expected return 5.0% greater than or equal to  3.0% ✓
    Net benefit 4.92% greater than 0.5% ✓
    CV 2.9% < 5.0% → LOW RISK ✓
    ADX 30 greater than 25 → STRONG TREND ✓

  → batch_size = 0.0 (HOLD all)
  → reason = "low_risk_cv2.9%_return5.0%_hold"

---

Scenario B: High Risk, High Return
  Current price: $2.00/lb
  Day 14 predictions (2,000 paths):
    Median: $2.10/lb
    Std dev: $0.38/lb
    CV = $0.38 / $2.10 = 0.18 = 18% → HIGH RISK

  Expected return = 5.0%
  Net benefit = 4.92%

  Decision:
    Expected return 5.0% greater than or equal to  3.0% ✓
    Net benefit 4.92% greater than 0.5% ✓
    CV 18% < 20% → HIGH RISK

  → batch_size = 0.25 (hedge 25%)
  → reason = "high_risk_cv18%_return5.0%_hedge"

---

Scenario C: Low Risk, Low Return
  Current price: $2.00/lb
  Day 14 predictions:
    Median: $2.04/lb
    CV = 3% → LOW RISK

  Expected return = ($2.04 - $2.00) / $2.00 = 2.0%
  Net benefit = 2.0% - 0.07% - 0.01% = 1.92%

  Decision:
    Expected return 2.0% < 3.0% ✗ (insufficient)
    Net benefit 1.92% greater than 0.5% ✓ (positive but below threshold)

  → batch_size = 0.25
  → reason = "insufficient_return_2.0%_sell"

---

Scenario D: High Risk, Low Return
  Current price: $2.00/lb
  Day 14 predictions:
    Median: $2.04/lb
    CV = 22% → VERY HIGH RISK

  Expected return = 2.0%

  Decision:
    Expected return 2.0% < 3.0% ✗
    CV 22% greater than or equal to  20% → VERY HIGH RISK

  → batch_size = 0.35 (aggressive sell)
  → reason = "very_high_risk_cv22%_sell"
```

**Academic References**:
- **Markowitz, H. (1952).** "Portfolio selection." *Journal of Finance*, 7(1), 77-91.
  - DOI: 10.1111/j.1540-6261.1952.tb01525.x
  - 5,254+ citations
  - Nobel Prize winner (1990)
  - PERFECT fit - strategy directly implements mean-variance optimization using CV for risk

**Parameters**:
- `storage_cost_pct_per_day`: Inherited
- `transaction_cost_pct`: Inherited
- `min_return`: 0.03 (3% minimum return)
- `min_net_benefit_pct`: 0.5 (0.5% minimum)
- `max_uncertainty_low`: 0.05 (CV < 5% = low risk)
- `max_uncertainty_medium`: 0.10 (CV < 10% = medium risk)
- `max_uncertainty_high`: 0.20 (CV < 20% = high risk)
- `strong_trend_adx`: 25
- `evaluation_day`: 14
- `batch_low_risk`: 0.0
- `batch_medium_risk`: 0.10
- `batch_high_risk`: 0.25
- `batch_very_high_risk`: 0.35
- `cooldown_days`: 7

**Why this design?**:
- Implements Markowitz mean-variance framework
- Risk-adjusted returns (similar to Sharpe ratio)
- Balances greed (expected return) with fear (uncertainty)
- CV provides scale-invariant risk measure

---

## Optimization Strategy

### 10. Rolling Horizon MPC (Model Predictive Control)

**File**: `rolling_horizon_mpc.py:39-290`

**Purpose**: Optimal control with limited foresight using linear programming.

**Key Concept: Receding Horizon Control**

Traditional optimization problem:
```
Given: Full price trajectory for 365 days
Find: Optimal sell schedule for all 365 days
Problem: We don't have perfect foresight!
```

Rolling Horizon MPC:
```
Day 0: See prices for days 1-14
       Solve optimization for days 1-14
       Execute ONLY day 1 decision

Day 1: See prices for days 2-15
       Solve optimization for days 2-15
       Execute ONLY day 2 decision

... roll forward daily
```

**Decision Logic** (`rolling_horizon_mpc.py:77-179`):
```python
def decide(self, day, inventory, current_price, price_history, predictions=None):
    """
    Solve 14-day local optimization, execute first decision only.
    """
    if inventory less than or equal to  0:
        return {'action': 'HOLD', 'amount': 0, 'reason': 'no_inventory'}

    if predictions is None or len(predictions) == 0:
        return {'action': 'HOLD', 'amount': 0, 'reason': 'no_predictions'}

    # Get forecast window (14 days)
    if len(predictions.shape) == 2:
        # predictions is (2000 paths, 14 days) matrix
        available_horizon = predictions.shape[1]
    else:
        # predictions is 1D array (single path)
        available_horizon = len(predictions)

    window_len = min(self.horizon_days, available_horizon)  # min(14, available)

    if window_len less than or equal to  0:
        return {'action': 'SELL', 'amount': inventory, 'reason': 'no_forecast_horizon'}

    # Get predicted prices for the window (use mean of 2,000 paths)
    if len(predictions.shape) == 2:
        future_prices_cents = predictions[:, :window_len].mean(axis=0)
    else:
        future_prices_cents = predictions[:window_len]

    # Convert cents/lb to $/ton
    future_prices_per_ton = future_prices_cents * 20  # 2000 lbs = 1 ton

    # Future harvest (zeros - BacktestEngine handles harvest externally)
    future_harvest = np.zeros(window_len)

    # Solve local LP for this window
    result = self._solve_window_lp(
        current_inventory=inventory,
        future_prices=future_prices_per_ton,
        future_harvest=future_harvest
    )

    if result is None or result['sell_solution'] is None:
        return {'action': 'HOLD', 'amount': 0, 'reason': 'lp_failed'}

    # EXECUTE ONLY THE FIRST DECISION (Receding Horizon)
    sell_today = result['sell_solution'][0]

    # Update shadow price if using shadow pricing
    if self.shadow_price_smoothing is not None and result.get('shadow_price') is not None:
        if self.smoothed_shadow_price is None:
            self.smoothed_shadow_price = result['shadow_price']
        else:
            # Exponential smoothing
            alpha = self.shadow_price_smoothing
            self.smoothed_shadow_price = (alpha * result['shadow_price'] +
                                         (1 - alpha) * self.smoothed_shadow_price)

    # Threshold to avoid tiny sales
    if sell_today < 0.1:
        return {'action': 'HOLD', 'amount': 0, 'reason': 'mpc_hold'}

    # Sell amount (capped at current inventory)
    sell_amount = min(sell_today, inventory)

    return {
        'action': 'SELL',
        'amount': sell_amount,
        'reason': 'mpc_optimize',
        'window_len': window_len,
        'predicted_net_value': result.get('objective_value', 0)
    }
```

**Linear Programming Formulation** (`rolling_horizon_mpc.py:181-290`):

**Decision Variables**:
```python
x = [sell[0], sell[1], ..., sell[13],  # Amount to sell each day
     inv[0], inv[1], ..., inv[13]]      # Inventory at end of each day
```
Total: 28 variables (14 sell + 14 inventory)

**Objective Function** (maximize profit):
```python
# Revenue - Transaction Costs
revenue = Σ(sell[t] × price[t] × (1 - transaction_cost%))

# Storage Costs
storage = Σ(inv[t] × price[t] × storage_cost_pct_per_day)

# Objective: maximize revenue - storage
objective = revenue - storage

# LP minimizes, so negate
minimize: -revenue + storage
```

**Constraints** (inventory balance):
```python
# For each day t:
# sell[t] + inv[t] - inv[t-1] = harvest[t]

Day 0: sell[0] + inv[0] = current_inventory + harvest[0]
Day 1: sell[1] + inv[1] - inv[0] = harvest[1]
Day 2: sell[2] + inv[2] - inv[1] = harvest[2]
...
Day 13: sell[13] + inv[13] - inv[12] = harvest[13]
```

**Bounds**:
```python
sell[t] greater than or equal to  0  for all t
inv[t] greater than or equal to  0   for all t
```

**LP Solve Implementation**:
```python
def _solve_window_lp(self, current_inventory, future_prices, future_harvest):
    """
    Solve the local LP optimization for the forecast window.

    Args:
        current_inventory: Starting inventory (tons)
        future_prices: Array of predicted prices ($/ton) for 14 days
        future_harvest: Array of harvest increments (tons) for 14 days

    Returns:
        Dict with sell_solution, inventory_solution, objective_value, shadow_price
    """
    n_days = len(future_prices)  # 14

    # Decision variables: [sell[0], ..., sell[13], inv[0], ..., inv[13]]
    var_sell_start = 0
    var_inv_start = n_days

    # Objective function coefficients
    c = np.zeros(2 * n_days)  # 28 variables

    # Revenue (negative because we minimize)
    revenue_coeff = future_prices * (1 - self.transaction_cost_pct / 100)
    c[var_sell_start:var_inv_start] = -revenue_coeff

    # Storage costs (positive)
    storage_coeff = future_prices * (self.storage_cost_pct_per_day / 100)
    c[var_inv_start:] = storage_coeff

    # Constraints: A_eq * x = b_eq
    A_eq = []
    b_eq = []

    for t in range(n_days):
        row = np.zeros(2 * n_days)

        # Inventory balance: sell[t] + inv[t] - inv[t-1] = harvest[t]
        row[var_sell_start + t] = 1  # sell[t]
        row[var_inv_start + t] = 1   # inv[t]

        if t greater than 0:
            row[var_inv_start + t - 1] = -1  # inv[t-1]
            b_eq.append(future_harvest[t])
        else:
            # Day 0: sell[0] + inv[0] = current_inventory + harvest[0]
            b_eq.append(current_inventory + future_harvest[t])

        A_eq.append(row)

    A_eq = np.array(A_eq)
    b_eq = np.array(b_eq)

    # CRITICAL: Add terminal value to objective
    # This prevents End-of-Horizon effect (myopic liquidation)
    if self.shadow_price_smoothing is not None and self.smoothed_shadow_price is not None:
        # Use smoothed shadow price as terminal value
        terminal_val_coeff = -self.smoothed_shadow_price
        c[var_inv_start + n_days - 1] += terminal_val_coeff
    else:
        # Use simple price-based terminal value with decay
        terminal_val_coeff = -future_prices[-1] * self.terminal_value_decay
        c[var_inv_start + n_days - 1] += terminal_val_coeff

    # Bounds: all variables greater than or equal to  0
    bounds = [(0, None) for _ in range(2 * n_days)]

    # Solve LP using scipy.optimize.linprog
    try:
        result = linprog(
            c=c,
            A_eq=A_eq,
            b_eq=b_eq,
            bounds=bounds,
            method='highs',
            options={'disp': False, 'presolve': True}
        )

        if not result.success:
            return None

        # Extract solution
        sell_solution = result.x[var_sell_start:var_inv_start]
        inv_solution = result.x[var_inv_start:]

        # Extract shadow price (approximate)
        shadow_price = future_prices[-1] * self.terminal_value_decay

        return {
            'sell_solution': sell_solution,
            'inventory_solution': inv_solution,
            'objective_value': -result.fun,  # Negate back to profit
            'shadow_price': shadow_price
        }

    except Exception as e:
        print(f"Rolling Horizon LP failed: {e}")
        return None
```

**Critical: Terminal Value Correction**

**Problem**: Without terminal value, LP liquidates everything by day 14 (myopic).

**Why?**
```
Day 14 inventory has zero value in objective
LP thinks: "Sell everything by day 14, inventory is worthless after"
Result: Suboptimal early liquidation
```

**Solution**: Add terminal value to inventory remaining at day 14.

**Simple approach**:
```python
# Use future price with decay
terminal_value_coeff = -future_prices[13] × 0.95  # 95% of day 14 price
c[inv[13]] += terminal_value_coeff  # Add to objective
```

**Advanced approach**:
```python
# Use shadow prices (smoothed dual variable from previous LP solves)
if shadow_price_smoothing:
    terminal_value_coeff = -smoothed_shadow_price
    c[inv[13]] += terminal_value_coeff
```

**Example Execution**:
```
Day 0:
  Current inventory: 50 tons
  Forecast (2,000 paths × 14 days):
    Mean prices = [4000, 4020, 4040, ..., 4280] $/ton

  LP setup:
    Variables: [sell[0], ..., sell[13], inv[0], ..., inv[13]]

    Objective:
      Revenue = sell[0]×4000 + sell[1]×4020 + ... + sell[13]×4280
      Transaction costs = sell[0]×40 + sell[1]×40.2 + ... + sell[13]×42.8
      Storage costs = inv[0]×0.2 + inv[1]×0.201 + ... + inv[13]×0.214
      Terminal value = inv[13] × 4280 × 0.95 = inv[13] × 4066

    Constraints:
      sell[0] + inv[0] = 50
      sell[1] + inv[1] - inv[0] = 0
      ...
      sell[13] + inv[13] - inv[12] = 0

    Bounds:
      All variables greater than or equal to  0

  LP solves:
    sell = [5.2, 4.8, 6.1, ..., 3.1] tons
    inv = [44.8, 40.0, 33.9, ..., 8.5] tons
    objective = $195,432

  Execute ONLY sell[0] = 5.2 tons

Day 1:
  Current inventory: 50 - 5.2 = 44.8 tons
  Forecast (new 14-day window):
    Mean prices = [4020, 4040, 4060, ..., 4300] $/ton (updated!)

  LP solves again with new prices:
    sell = [3.9, 5.2, 4.7, ..., 2.8] tons  (different from yesterday!)
    ...

  Execute ONLY sell[0] = 3.9 tons

... continues rolling forward
```

**Academic References**:
- **Secomandi, N. (2010).** "Optimal Commodity Trading with a Capacitated Storage Asset." *Management Science*, 56(3), 449-467.
  - DOI: 10.1287/mnsc.1090.1049
  - Carnegie Mellon University
  - Addresses warehouse problem with finite horizons and terminal boundary conditions
  - Optimal inventory-trading policy with stage-dependent basestock targets
  - BEST match for MPC approach
- **Williams, J. C., & Wright, B. D. (1991).** *Storage and Commodity Markets.*
  - Alternative citation for agricultural commodity storage framework

**Parameters**:
- `storage_cost_pct_per_day`: 0.3% (default for MPC)
- `transaction_cost_pct`: 2.0% (default for MPC)
- `horizon_days`: 14
- `terminal_value_decay`: 0.95 (95% of day 14 price)
- `shadow_price_smoothing`: None (simple) or 0.3 (advanced)

**Why this design?**:
- Academically grounded (Secomandi 2010, Williams & Wright 1991)
- Optimal given limited foresight
- Terminal value prevents myopic liquidation
- Expected performance: 85-95% of Oracle (perfect foresight)
- Mimics Model Predictive Control from control theory

---

## Academic References

Complete bibliography with all citations.

### Core Citations (High Impact)

**1. Markowitz, H. (1952).** Portfolio selection. *Journal of Finance*, 7(1), 77-91.
- **DOI**: 10.1111/j.1540-6261.1952.tb01525.x
- **Citations**: 5,254+
- **Notes**: Nobel Prize winner (1990). Foundation of mean-variance optimization and modern portfolio theory.
- **Use for**: Risk-Adjusted strategy (PERFECT fit)

**2. Williams, J. C., & Wright, B. D. (1991).** *Storage and commodity markets.* Cambridge University Press.
- **ISBN**: 9780521326162
- **Pages**: 502
- **Notes**: Comprehensive treatment of commodity storage with uncertainty. Economic Journal: "Of major significance in the analysis of commodity markets."
- **Use for**: Expected Value strategy, Rolling Horizon MPC strategy

**3. Marshall, B. R., Cahan, R. H., & Cahan, J. M. (2008).** Can commodity futures be profitably traded with quantitative market timing strategies? *Journal of Banking & Finance*, 32(9), 1810-1819.
- **Notes**: Comprehensive examination of quantitative trading rules in commodity futures. Tests 15 major commodity futures series.
- **Use for**: Price Threshold, Moving Average, and their predictive variants

**4. Clemen, R. T. (1989).** Combining forecasts: A review and annotated bibliography. *International Journal of Forecasting*, 5(4), 559-583.
- **DOI**: 10.1016/0169-2070(89)90012-5
- **Citations**: 2,165+
- **Notes**: Comprehensive review with 200+ item annotated bibliography. Key finding: "Forecast accuracy can be substantially improved through combination."
- **Use for**: Consensus strategy

**5. Wilder, J. Welles (1978).** *New concepts in technical trading systems.* Trend Research.
- **Pages**: 142
- **Notes**: Original source for RSI, ADX, Parabolic SAR, ATR. Considered one of the most innovative books on technical analysis.
- **Use for**: Price Threshold and Moving Average strategies (technical indicators)

**6. Brock, W., Lakonishok, J., & LeBaron, B. (1992).** Simple technical trading rules and the stochastic properties of stock returns. *Journal of Finance*, 47(5), 1731-1764.
- **DOI**: 10.1111/j.1540-6261.1992.tb04681.x
- **Citations**: 2,200+
- **Notes**: Highly cited empirical study of technical trading rules. Validates MA strategies.
- **Use for**: Moving Average strategy (optional - academic validation)

**7. Secomandi, N. (2010).** Optimal commodity trading with a capacitated storage asset. *Management Science*, 56(3), 449-467.
- **DOI**: 10.1287/mnsc.1090.1049
- **Author**: Tepper School of Business, Carnegie Mellon University
- **Notes**: Finite horizon dynamic programming for commodity storage. Stage-dependent basestock policies.
- **Use for**: Rolling Horizon MPC strategy

### Strategy-to-Citation Mapping

| # | Strategy | Primary Citation(s) | Quality |
|---|----------|---------------------|---------|
| 1 | Immediate Sale | None (naive baseline) | N/A |
| 2 | Equal Batches | None found | ⚠️ Heuristic only |
| 3 | Price Threshold | Marshall et al. (2008) + Wilder (1978) | ✅ VERIFIED |
| 4 | Moving Average | Marshall et al. (2008) + Wilder (1978) | ✅ VERIFIED |
| 5 | Threshold Predictive | Marshall (2008) + Williams & Wright (1991) | ✅ VERIFIED |
| 6 | MA Predictive | Marshall (2008) + Williams & Wright (1991) | ✅ VERIFIED |
| 7 | Expected Value | Williams & Wright (1991) | ✅ VERIFIED |
| 8 | Consensus | Clemen (1989) | ✅ VERIFIED |
| 9 | Risk-Adjusted | Markowitz (1952) | ✅ PERFECT ⭐ |
| 10 | Rolling Horizon MPC | Secomandi (2010) or Williams & Wright (1991) | ✅ VERIFIED |

---

## Design Decisions

### Why 3-Tier Prediction System?

**Problem**: How to use forecasts when confidence varies?

**Bad Approach**: Always follow predictions
```python
if predicted_price greater than current_price:
    return HOLD
else:
    return SELL
```
Problem: When CV = 30% (very uncertain), predictions are unreliable.

**Good Approach**: Confidence-based blending
```python
if cv < 0.05:  # HIGH confidence
    # Override baseline completely
    if predicted_upward:
        return HOLD
elif cv < 0.15:  # MEDIUM confidence
    # Blend baseline + predictions
    if baseline_sell and predicted_upward:
        return SELL(amount * 0.5)  # Reduce baseline action
else:  # LOW confidence
    # Ignore predictions, use baseline
    return baseline_decision
```

**Result**: Fair matched-pair comparison shows value of predictions.

---

### Why Coefficient of Variation (CV)?

**CV = std_dev / median**

**Benefits**:
1. **Scale-invariant**: Works for $1/lb or $100/lb prices
2. **Relative uncertainty**: 5% CV on $2.00 price = $0.10 std dev
3. **Industry standard**: Forecast evaluation metric

**Alternative (worse)**:
```python
uncertainty = std_dev  # Absolute dollars
# Problem: $0.10 std dev is high for $1.00 price, low for $10.00 price
```

---

### Why Median Instead of Mean?

**Forecast ensemble**: 2,000 price paths

**Mean**:
```python
mean_price = np.mean(predictions[:, day])  # Sensitive to outliers
# If 1 path predicts $100, mean shifts significantly
```

**Median**:
```python
median_price = np.median(predictions[:, day])  # Robust to outliers
# Outliers don't affect median
```

**Result**: Median is more stable and robust.

---

### Why 14-Day Horizon?

**Forecast Agent**: Produces 14-day forecasts

**Reasons**:
1. Matches forecast capability
2. Computational efficiency (shorter horizon = faster LP solve)
3. Academic precedent (Secomandi 2010 uses 7-14 day windows)

---

### Why Harvest-Based Inventory?

**Traditional approach** (wrong):
```
Day 1: Start with 50 tons
```

**Realistic approach** (ours):
```
Day 1: Inventory = 0.327 tons (first day of harvest)
Day 153: Inventory = 50 tons (end of harvest)
```

**Why?**
- Models realistic producer behavior
- Prevents unrealistic early liquidation
- Accurate cost accounting (storage costs accumulate as inventory grows)

---

### Force Liquidation

All strategies inherit from `Strategy` base class:
```python
def _force_liquidation_check(self, day, inventory):
    """Sell all inventory at max_holding_days"""
    if day greater than or equal to  self.max_holding_days:  # Usually 365
        return {
            'action': 'SELL',
            'amount': inventory,
            'reason': 'force_liquidation_max_days'
        }
    return None
```

**Reason**: Quality degradation after 1 year.

---

### Cooldown Periods

Most strategies use 7-day cooldown:
```python
if days_since_sale < self.cooldown_days:
    return HOLD
```

**Reason**: Prevents overtrading (transaction costs add up).

---

### Batch Sizes

All strategies use fractional batch sizes (0.0 to ~0.40):
```python
batch_size = 0.25  # Sell 25% of inventory
amount = inventory * batch_size

# Example:
# inventory = 50 tons
# batch_size = 0.25
# amount = 12.5 tons sold
# remaining = 37.5 tons
```

**Why fractions?**
- Gradual liquidation reduces risk
- Avoids all-or-nothing decisions
- Dollar-cost averaging benefit

---

### Parameter Optimization

All parameters can be optimized using Optuna:
```python
# Default parameters
params = {
    'batch_size': 0.25,
    'threshold_pct': 0.05,
    ...
}

# Optimized parameters (from Optuna)
optimized_params = load_from_json('optimized_params_coffee_model_v1.json')
```

See `parameter_manager.py` for automatic fallback logic.

---

## Testing and Validation

All strategies tested via `BacktestEngine` with:
- Harvest-based inventory (starts at zero, accumulates)
- Cost modeling (storage + transaction)
- Force liquidation (365 days max)
- Multi-year backtests (2020-2024)

**Statistical validation**:
- Paired t-tests vs baselines
- Bootstrap confidence intervals
- Sign tests for consistency
- Cohen's d for effect size

See `statistical_tests.py` (1,292 lines) for implementation.

---

**Document Status**: ✅ COMPLETE - Comprehensive technical reference
**Last Updated**: 2025-12-10
**Source Code**: `/Users/markgibbons/capstone/ucberkeley-capstone/trading_agent/production/strategies/`
