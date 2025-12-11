---
sidebar_position: 1
---

# Trading Agent

Trading strategy backtesting framework for commodity markets.

**Source**: `trading_agent/production/strategies/` (3 files, 10 strategy classes)

---

## Baseline Strategies (4)

### 1. ImmediateSaleStrategy

**File**: `baseline.py:29-70`

**Algorithm**: Sell all inventory immediately on fixed schedule.

**Parameters**:
- `min_batch_size`: Minimum inventory required to sell (default: 5.0 tons)
- `sale_frequency_days`: Days between sales (default: 7)

**Decision Logic** (`decide()` lines 44-66):
```python
if inventory <= 0:
    return HOLD

# Check forced liquidation (approaching deadline)
if forced_liquidation:
    return SELL_ALL

# Check if ready to sell
ready_to_sell = (days_since_last_sale >= sale_frequency_days)
enough_inventory = (inventory >= min_batch_size)

if ready_to_sell and enough_inventory:
    days_since_last_sale = 0
    return SELL amount=inventory  # Sell everything
else:
    days_since_last_sale += 1
    return HOLD
```

**How it works**:
1. Tracks days since last sale
2. Every `sale_frequency_days`, sells entire inventory
3. Waits until inventory reaches `min_batch_size`
4. No price analysis - purely time-based

**Use case**: Naive baseline for comparison.

---

### 2. EqualBatchStrategy

**File**: `baseline.py:73-107`

**Algorithm**: Sell fixed percentage of inventory on regular schedule.

**Parameters**:
- `batch_size`: Percentage of inventory to sell (default: 0.25 = 25%)
- `frequency_days`: Days between sales (default: 30)

**Decision Logic** (`decide()` lines 88-103):
```python
if inventory <= 0:
    return HOLD

if forced_liquidation:
    return SELL_ALL

days_since_sale = day - last_sale_day

if days_since_sale >= frequency_days:
    amount = inventory * batch_size  # Sell 25% by default
    last_sale_day = day
    return SELL amount=amount
else:
    return HOLD
```

**How it works**:
1. Every `frequency_days`, sells `batch_size` % of inventory
2. Example: 25% every 30 days = liquidate over ~120 days
3. No price analysis - systematic time-averaging

**Use case**: Dollar-cost averaging baseline.

---

### 3. PriceThresholdStrategy

**File**: `baseline.py:110-217`

**Algorithm**: Sell when price exceeds dynamic threshold, batch size determined by technical indicators.

**Parameters**:
- `threshold_pct`: Trigger when price > MA30 × (1 + threshold_pct) (default: 0.05 = 5%)
- Batch sizes: `batch_baseline=0.25`, `batch_overbought_strong=0.35`, `batch_overbought=0.30`, `batch_strong_trend=0.20`
- RSI thresholds: `rsi_overbought=70`, `rsi_moderate=65`
- ADX threshold: `adx_strong=25`
- `cooldown_days=7`: Minimum days between trades
- `max_days_without_sale=60`: Fallback liquidation

**Decision Logic** (`decide()` lines 154-187):
```python
# Calculate dynamic threshold
if len(price_history) >= 30:
    ma_30 = price_history['price'].tail(30).mean()
    threshold = ma_30 * (1 + threshold_pct)  # e.g., MA30 * 1.05
else:
    threshold = current_price * (1 + threshold_pct)

signal_triggered = current_price > threshold

# Check conditions
if not signal_triggered:
    if days_since_sale >= max_days_without_sale:
        return SELL amount=inventory*batch_baseline  # Fallback after 60 days
    else:
        return HOLD

if days_since_sale < cooldown_days:
    return HOLD  # Cooldown period

# Analyze technical indicators to determine batch size
batch_size, reason = _analyze_historical(current_price, price_history)
return SELL amount=inventory*batch_size
```

**Technical Analysis** (`_analyze_historical()` lines 189-208):
```python
rsi = calculate_rsi(prices, period=14)  # Relative Strength Index
adx, _, _ = calculate_adx(price_history, period=14)  # Average Directional Index

if rsi > rsi_overbought and adx > adx_strong:
    # Overbought + strong trend → Sell aggressively
    batch_size = batch_overbought_strong  # 0.35 (35%)
    reason = f'overbought_strong_trend_rsi{rsi}_adx{adx}'

elif rsi > rsi_overbought:
    # Overbought → Sell more
    batch_size = batch_overbought  # 0.30 (30%)
    reason = f'overbought_rsi{rsi}'

elif adx > adx_strong and rsi < rsi_moderate:
    # Strong trend but not overbought → Sell less
    batch_size = batch_strong_trend  # 0.20 (20%)
    reason = f'strong_trend_rsi{rsi}_adx{adx}'

else:
    # Default
    batch_size = batch_baseline  # 0.25 (25%)
    reason = f'baseline_rsi{rsi}_adx{adx}'
```

**How it works**:
1. Calculates 30-day moving average
2. Triggers when current price > MA30 + threshold_pct
3. Uses RSI (momentum) and ADX (trend strength) to modulate batch size
4. Cooldown prevents rapid successive trades
5. Fallback after 60 days prevents holding too long

**Use case**: Price + technical indicator baseline.

---

### 4. MovingAverageStrategy

**File**: `baseline.py:220-340`

**Algorithm**: Sell on downward MA crossover, batch size determined by technical indicators.

**Parameters**:
- `ma_period`: Moving average period (default: 30 days)
- Batch sizes: `batch_baseline=0.25`, `batch_strong_momentum=0.20`, `batch_overbought_strong=0.35`, `batch_overbought=0.30`
- RSI thresholds: `rsi_overbought=70`, `rsi_min=45`
- ADX thresholds: `adx_strong=25`, `adx_weak=20`
- `cooldown_days=7`, `max_days_without_sale=60`

**Decision Logic** (`decide()` lines 267-310):
```python
if days_since_sale >= max_days_without_sale:
    return SELL amount=inventory*batch_baseline  # Fallback after 60 days

if len(price_history) < ma_period + 1:
    return HOLD  # Need enough history

# Calculate moving averages
recent_prices = price_history['price'].tail(ma_period + 1).values
ma_current = np.mean(recent_prices[-ma_period:])  # Today's MA
ma_prev = np.mean(recent_prices[-(ma_period+1):-1])  # Yesterday's MA
prev_price = recent_prices[-2]  # Yesterday's price

# Detect crossover
upward_cross = (prev_price <= ma_prev and current_price > ma_current)
downward_cross = (prev_price >= ma_prev and current_price < ma_current)

if upward_cross:
    # Price crossed ABOVE MA → Bullish signal → HOLD for higher prices
    return HOLD

if downward_cross:
    # Price crossed BELOW MA → Bearish signal → SELL to avoid decline
    if days_since_sale < cooldown_days:
        return HOLD  # Cooldown

    batch_size, reason = _analyze_historical(current_price, price_history)
    return SELL amount=inventory*batch_size

# No crossover
return HOLD
```

**Technical Analysis** (`_analyze_historical()` lines 312-331):
```python
rsi = calculate_rsi(prices, period=14)
adx, _, _ = calculate_adx(price_history, period=14)

if adx > adx_strong and rsi >= rsi_min and rsi <= rsi_overbought:
    # Strong momentum (not overbought) → Sell less (trend may continue)
    batch_size = batch_strong_momentum  # 0.20 (20%)
    reason = f'strong_momentum_rsi{rsi}_adx{adx}'

elif rsi > rsi_overbought and adx > adx_strong:
    # Overbought + strong trend → Sell aggressively
    batch_size = batch_overbought_strong  # 0.35 (35%)
    reason = f'overbought_strong_rsi{rsi}_adx{adx}'

elif rsi > rsi_overbought:
    # Overbought → Sell more
    batch_size = batch_overbought  # 0.30 (30%)
    reason = f'overbought_rsi{rsi}'

else:
    # Default
    batch_size = batch_baseline  # 0.25 (25%)
    reason = f'baseline_crossover_rsi{rsi}_adx{adx}'
```

**How it works**:
1. Calculates 30-day moving average each day
2. Detects crossovers:
   - **Upward cross** (price crosses ABOVE MA): Bullish → HOLD
   - **Downward cross** (price crosses BELOW MA): Bearish → SELL
3. Uses RSI and ADX to determine sell batch size
4. Cooldown prevents rapid trades
5. Fallback after 60 days

**Use case**: Classic MA crossover baseline.

---

## Prediction-Based Strategies (5)

All prediction strategies use forecast distributions (2,000 Monte Carlo paths × 14 days).

### 5. PriceThresholdPredictive

**File**: `prediction.py:46-380`

**Algorithm**: Extends PriceThresholdStrategy with 3-tier forecast integration (OVERRIDE/BLEND/BASELINE).

**Parameters**:
- All baseline parameters (same as PriceThresholdStrategy)
- **Prediction parameters**:
  - `storage_cost_pct_per_day=0.005`: Daily storage cost
  - `transaction_cost_pct=0.01`: Transaction cost
  - `high_confidence_cv=0.05`: CV < 5% = high confidence
  - `medium_confidence_cv=0.15`: CV < 15% = medium confidence
  - `strong_positive_threshold=2.0`: >2% net benefit = strong upward
  - `strong_negative_threshold=-1.0`: <-1% net benefit = strong downward
  - `batch_pred_hold=0.0`, `batch_pred_aggressive=0.40`, `batch_pred_cautious=0.15`

**Decision Hierarchy** (`decide()` lines 124-166):
```python
if inventory <= 0: return HOLD
if forced_liquidation: return SELL_ALL
if days_since_sale < cooldown_days: return HOLD

# Analyze predictions if available
if predictions is not None:
    pred_signal = _analyze_prediction_signal(current_price, price_history, predictions)

    if pred_signal['confidence'] == 'HIGH':
        # HIGH CONFIDENCE → OVERRIDE baseline completely
        return _execute_prediction_override(day, inventory, pred_signal, price_history)

    elif pred_signal['confidence'] == 'MEDIUM':
        # MEDIUM CONFIDENCE → BLEND baseline + predictions
        return _execute_blended_decision(day, inventory, current_price, price_history, pred_signal)

# LOW/NO CONFIDENCE → FOLLOW BASELINE (identical to PriceThresholdStrategy)
return _execute_baseline_logic(day, inventory, current_price, price_history)
```

**Prediction Analysis** (`_analyze_prediction_signal()` lines 168-209):
```python
# Calculate net benefit accounting for storage and transaction costs
net_benefit_pct = _calculate_net_benefit_pct(current_price, predictions)

# Calculate prediction confidence (Coefficient of Variation)
cv = calculate_prediction_confidence(predictions, horizon_day=min(13, predictions.shape[1] - 1))

# Determine confidence level
if cv < high_confidence_cv:  # CV < 5%
    confidence = 'HIGH'
elif cv < medium_confidence_cv:  # CV < 15%
    confidence = 'MEDIUM'
else:
    confidence = 'LOW'

# Determine direction and magnitude
if net_benefit_pct > strong_positive_threshold:  # >2%
    direction = 'STRONG_UPWARD'
elif net_benefit_pct > moderate_threshold:  # >0.5%
    direction = 'MODERATE_UPWARD'
elif net_benefit_pct < strong_negative_threshold:  # <-1%
    direction = 'STRONG_DOWNWARD'
elif net_benefit_pct < -moderate_threshold:  # <-0.5%
    direction = 'MODERATE_DOWNWARD'
else:
    direction = 'NEUTRAL'

return {'confidence': confidence, 'direction': direction, 'net_benefit_pct': net_benefit_pct, 'cv': cv}
```

**Net Benefit Calculation** (`_calculate_net_benefit_pct()` lines 351-371):
```python
ev_by_day = []
for h in range(predictions.shape[1]):  # For each horizon day
    future_price = np.median(predictions[:, h])  # Median of 2,000 paths
    days_to_wait = h + 1
    storage_cost = current_price * (storage_cost_pct_per_day / 100) * days_to_wait
    transaction_cost = future_price * (transaction_cost_pct / 100)
    ev = future_price - storage_cost - transaction_cost
    ev_by_day.append(ev)

# Today's expected value
transaction_cost_today = current_price * (transaction_cost_pct / 100)
ev_today = current_price - transaction_cost_today

# Optimal expected value (best future day)
optimal_ev = max(ev_by_day)

# Net benefit as percentage
net_benefit_pct = 100 * (optimal_ev - ev_today) / current_price

return net_benefit_pct
```

**HIGH Confidence Override** (`_execute_prediction_override()` lines 211-244):
```python
if direction == 'STRONG_UPWARD':
    # Strong evidence prices will rise → HOLD completely
    batch_size = batch_pred_hold  # 0.0 (HOLD)
    reason = f'OVERRIDE_hold_strong_upward_net{net_benefit}%_cv{cv}'

elif direction == 'MODERATE_UPWARD':
    # Moderate upward → Small hedge
    batch_size = batch_pred_cautious  # 0.15 (15%)
    reason = f'OVERRIDE_small_hedge_mod_upward_net{net_benefit}%_cv{cv}'

elif direction == 'STRONG_DOWNWARD':
    # Strong evidence prices will fall → SELL aggressively
    batch_size = batch_pred_aggressive  # 0.40 (40%)
    reason = f'OVERRIDE_aggressive_strong_downward_net{net_benefit}%_cv{cv}'

elif direction == 'MODERATE_DOWNWARD':
    # Moderate downward → Sell baseline
    batch_size = batch_baseline  # 0.25 (25%)
    reason = f'OVERRIDE_baseline_mod_downward_net{net_benefit}%_cv{cv}'

else:  # NEUTRAL
    batch_size = batch_baseline  # 0.25 (25%)
    reason = f'OVERRIDE_neutral_net{net_benefit}%_cv{cv}'

return SELL amount=inventory*batch_size
```

**MEDIUM Confidence Blend** (`_execute_blended_decision()` lines 246-283):
```python
# Calculate what baseline would do
baseline_action = _get_baseline_action(current_price, price_history)

if baseline_action['triggered']:  # Baseline says SELL
    if direction in ['STRONG_UPWARD', 'MODERATE_UPWARD']:
        # Predictions disagree → Reduce sell amount by 50%
        batch_size = baseline_action['batch_size'] * 0.5
        reason = f'BLEND_reduce_sell_pred_upward_net{net_benefit}%'
    else:
        # Predictions agree or neutral → Follow baseline
        batch_size = baseline_action['batch_size']
        reason = f'BLEND_follow_baseline_{baseline_action["reason"]}'

else:  # Baseline says HOLD
    if direction in ['STRONG_DOWNWARD', 'MODERATE_DOWNWARD']:
        # Predictions disagree → Cautious sell
        batch_size = batch_pred_cautious  # 0.15 (15%)
        reason = f'BLEND_cautious_sell_pred_downward_net{net_benefit}%'
    else:
        # Predictions agree → Hold
        return HOLD

return SELL amount=inventory*batch_size
```

**How it works**:
1. Analyzes 2,000 forecast paths to compute expected value by day
2. Calculates net benefit % (best future day - sell today) / current_price
3. Measures forecast confidence using Coefficient of Variation (CV)
4. **HIGH confidence** (CV < 5%): Predictions OVERRIDE baseline completely
5. **MEDIUM confidence** (CV < 15%): BLEND predictions with baseline
6. **LOW confidence** (CV >= 15%): FOLLOW baseline exactly (like PriceThresholdStrategy)
7. Net benefit determines direction (STRONG_UPWARD, MODERATE_UPWARD, NEUTRAL, MODERATE_DOWNWARD, STRONG_DOWNWARD)

**Use case**: Augments PriceThreshold with probabilistic forecasts, degrades gracefully when predictions are uncertain.

---

### 6. MovingAveragePredictive

**File**: `prediction.py:387-729`

**Algorithm**: Extends MovingAverageStrategy with 3-tier forecast integration (identical pattern to PriceThresholdPredictive).

**Parameters**: Same as PriceThresholdPredictive but with MovingAverage baseline parameters.

**Decision Hierarchy** (`decide()` lines 467-516):
- Identical 3-tier structure (HIGH → OVERRIDE, MEDIUM → BLEND, LOW → BASELINE)
- Baseline logic: MA crossover detection (lines 635-658)

**How it works**:
1. Identical to PriceThresholdPredictive but replaces baseline logic with MA crossover
2. HIGH confidence predictions override MA signals
3. MEDIUM confidence blends predictions with MA crossover
4. LOW confidence follows MA crossover exactly

**Use case**: Augments MA crossover with probabilistic forecasts.

---

### 7. ExpectedValueStrategy

**File**: `prediction.py:736-866`

**Algorithm**: Standalone prediction strategy - maximizes expected value across 14-day forecast horizon.

**Parameters**:
- `storage_cost_pct_per_day`, `transaction_cost_pct`
- `min_net_benefit_pct=0.5`: Minimum 0.5% net benefit to justify holding
- `negative_threshold_pct=-0.3`: Strong negative signal threshold
- `high_confidence_cv=0.05`, `medium_confidence_cv=0.10`
- `strong_trend_adx=25`
- Batch sizes: `batch_positive_confident=0.0` (HOLD), `batch_positive_uncertain=0.10`, `batch_marginal=0.15`, `batch_negative_mild=0.25`, `batch_negative_strong=0.35`
- `cooldown_days=7`, `baseline_batch=0.15`, `baseline_frequency=30`

**Decision Logic** (`decide()` lines 779-803):
```python
if inventory <= 0: return HOLD
if forced_liquidation: return SELL_ALL
if days_since_sale < cooldown_days: return HOLD

if predictions is None:
    # No predictions → Fallback to time-based
    if days_since_sale >= baseline_frequency:  # 30 days
        return SELL amount=inventory*baseline_batch  # 0.15 (15%)
    else:
        return HOLD

# Analyze expected value
batch_size, reason = _analyze_expected_value_pct(current_price, price_history, predictions)
return SELL amount=inventory*batch_size
```

**Expected Value Analysis** (`_analyze_expected_value_pct()` lines 805-839):
```python
# Find optimal sale day
optimal_day, net_benefit_pct = _find_optimal_sale_day_pct(current_price, predictions)

# Calculate confidence
cv_pred = calculate_prediction_confidence(predictions, horizon_day=min(13, predictions.shape[1]-1))
adx_pred, _, _ = calculate_adx(price_history, period=min(14, len(price_history)-1))

if net_benefit_pct > min_net_benefit_pct:  # >0.5%
    if cv_pred < high_confidence_cv and adx_pred > strong_trend_adx:
        # High confidence + strong trend → HOLD completely
        batch_size = batch_positive_confident  # 0.0 (HOLD)
        reason = f'net_benefit_{net_benefit_pct}%_high_conf_hold_to_day{optimal_day}'

    elif cv_pred < medium_confidence_cv:
        # Medium confidence → Small hedge
        batch_size = batch_positive_uncertain  # 0.10 (10%)
        reason = f'net_benefit_{net_benefit_pct}%_med_conf_small_hedge_day{optimal_day}'

    else:
        # Low confidence → Larger hedge
        batch_size = batch_marginal  # 0.15 (15%)
        reason = f'net_benefit_{net_benefit_pct}%_low_conf_hedge'

elif net_benefit_pct > 0:
    # Marginal benefit → Gradual liquidation
    batch_size = batch_marginal  # 0.15 (15%)
    reason = f'marginal_benefit_{net_benefit_pct}%_gradual_liquidation'

elif net_benefit_pct > negative_threshold_pct:  # >-0.3%
    # Mild negative → Avoid storage costs
    batch_size = batch_negative_mild  # 0.25 (25%)
    reason = f'mild_negative_{net_benefit_pct}%_avoid_storage'

else:
    # Strong negative → Cut losses
    batch_size = batch_negative_strong  # 0.35 (35%)
    reason = f'strong_negative_{net_benefit_pct}%_sell_to_cut_losses'

return batch_size, reason
```

**Optimal Day Finder** (`_find_optimal_sale_day_pct()` lines 841-857):
```python
ev_by_day = []
for h in range(predictions.shape[1]):  # For each horizon (0-13)
    future_price = np.median(predictions[:, h])  # Median of 2,000 paths
    days_to_wait = h + 1
    storage_cost = current_price * (storage_cost_pct_per_day / 100) * days_to_wait
    transaction_cost = future_price * (transaction_cost_pct / 100)
    ev = future_price - storage_cost - transaction_cost
    ev_by_day.append(ev)

transaction_cost_today = current_price * (transaction_cost_pct / 100)
ev_today = current_price - transaction_cost_today

optimal_day = np.argmax(ev_by_day)  # Day with best expected value
net_benefit_pct = 100 * (ev_by_day[optimal_day] - ev_today) / current_price

return optimal_day, net_benefit_pct
```

**How it works**:
1. Calculates expected value for each of 14 forecast days (median of 2,000 paths - costs)
2. Finds optimal sale day (max expected value)
3. Compares selling today vs. waiting to optimal day
4. If net benefit > 0.5% → HOLD (varies by confidence)
5. If net benefit < 0 → SELL (avoid storage costs)
6. Batch size modulated by:
   - Net benefit magnitude
   - Forecast confidence (CV)
   - Trend strength (ADX)

**Use case**: Pure optimization - no baseline, maximizes expected return from forecasts.

---

### 8. ConsensusStrategy

**File**: `prediction.py:873-1028`

**Algorithm**: Majority vote across 2,000 forecast paths.

**Parameters**:
- `storage_cost_pct_per_day`, `transaction_cost_pct`
- `consensus_threshold=0.70`: 70% agreement to act
- `very_strong_consensus=0.85`, `moderate_consensus=0.60`
- `min_return=0.03`: 3% minimum return threshold
- `min_net_benefit_pct=0.5`
- `high_confidence_cv=0.05`
- `evaluation_day=14`: Which forecast day to evaluate
- Batch sizes: `batch_strong_consensus=0.0` (HOLD), `batch_moderate=0.15`, `batch_weak=0.25`, `batch_bearish=0.35`
- `cooldown_days=7`

**Decision Logic** (`decide()` lines 938-961):
```python
if inventory <= 0: return HOLD
if forced_liquidation: return SELL_ALL
if days_since_sale < cooldown_days: return HOLD

if predictions is None:
    if days_since_sale >= 30:
        return SELL amount=inventory*0.20
    else:
        return HOLD

batch_size, reason = _analyze_consensus_pct(current_price, price_history, predictions)
return SELL amount=inventory*batch_size
```

**Consensus Analysis** (`_analyze_consensus_pct()` lines 963-1019):
```python
# Evaluate at day 14 (or last available day)
eval_day = min(evaluation_day, predictions.shape[1] - 1)
day_predictions = predictions[:, eval_day]  # All 2,000 paths for day 14

# Calculate expected return
median_future = np.median(day_predictions)
expected_return_pct = (median_future - current_price) / current_price

# Count bullish predictions (paths showing >3% return)
bullish_count = np.sum(
    (day_predictions - current_price) / current_price > min_return
)
bullish_pct = bullish_count / len(day_predictions)  # % of paths bullish

# Calculate confidence
cv = calculate_prediction_confidence(predictions, eval_day)

# Calculate net benefit
days_to_wait = eval_day + 1
storage_cost_pct = (storage_cost_pct_per_day / 100) * days_to_wait
transaction_cost_pct = transaction_cost_pct / 100
net_benefit_pct = 100 * (expected_return_pct - storage_cost_pct - transaction_cost_pct)

# Decision based on consensus strength
if bullish_pct >= very_strong_consensus and net_benefit_pct > min_net_benefit_pct:
    # >=85% bullish + positive net benefit → HOLD
    batch_size = batch_strong_consensus  # 0.0 (HOLD)
    reason = f'very_strong_consensus_{bullish_pct:.0%}_net_{net_benefit_pct}%_hold'

elif bullish_pct >= consensus_threshold and net_benefit_pct > min_net_benefit_pct:
    # >=70% bullish + positive net benefit
    if cv < high_confidence_cv:
        batch_size = batch_strong_consensus  # 0.0 (HOLD)
        reason = f'strong_consensus_{bullish_pct:.0%}_high_conf_hold'
    else:
        batch_size = batch_moderate  # 0.15 (15%)
        reason = f'strong_consensus_{bullish_pct:.0%}_med_conf_gradual'

elif bullish_pct >= moderate_consensus:  # >=60%
    # Moderate consensus → Gradual
    batch_size = batch_moderate  # 0.15 (15%)
    reason = f'moderate_consensus_{bullish_pct:.0%}_gradual'

elif bullish_pct < (1 - consensus_threshold):  # <30% bullish = >70% bearish
    # Bearish consensus → Sell aggressively
    batch_size = batch_bearish  # 0.35 (35%)
    reason = f'bearish_consensus_{bullish_pct:.0%}_sell'

else:
    # Weak/unclear consensus → Sell
    batch_size = batch_weak  # 0.25 (25%)
    reason = f'weak_consensus_{bullish_pct:.0%}_sell'

return batch_size, reason
```

**How it works**:
1. Evaluates all 2,000 forecast paths at day 14
2. Counts how many paths show >3% return
3. Calculates bullish percentage (democratic vote)
4. **Very strong consensus** (>=85% bullish): HOLD
5. **Strong consensus** (>=70% bullish): HOLD (if confident) or gradual sell
6. **Moderate consensus** (>=60% bullish): Gradual sell
7. **Bearish consensus** (<30% bullish): Aggressive sell
8. **Weak consensus** (30-60%): Default sell

**Use case**: Ensemble method - trusts majority opinion of 2,000 simulations.

---

### 9. RiskAdjustedStrategy

**File**: `prediction.py:1035-1190`

**Algorithm**: Balances expected return vs. forecast uncertainty (Sharpe ratio-like).

**Parameters**:
- `storage_cost_pct_per_day`, `transaction_cost_pct`
- `min_return=0.03`: 3% minimum return
- `min_net_benefit_pct=0.5`
- **Uncertainty (risk) thresholds**:
  - `max_uncertainty_low=0.05`: CV < 5% = low risk
  - `max_uncertainty_medium=0.10`: CV < 10% = medium risk
  - `max_uncertainty_high=0.20`: CV < 20% = high risk
- `strong_trend_adx=25`
- `evaluation_day=14`
- Batch sizes: `batch_low_risk=0.0` (HOLD), `batch_medium_risk=0.10`, `batch_high_risk=0.25`, `batch_very_high_risk=0.35`
- `cooldown_days=7`

**Decision Logic** (`decide()` lines 1100-1123):
```python
if inventory <= 0: return HOLD
if forced_liquidation: return SELL_ALL
if days_since_sale < cooldown_days: return HOLD

if predictions is None:
    if days_since_sale >= 30:
        return SELL amount=inventory*0.20
    else:
        return HOLD

batch_size, reason = _analyze_risk_adjusted_pct(current_price, price_history, predictions)
return SELL amount=inventory*batch_size
```

**Risk-Adjusted Analysis** (`_analyze_risk_adjusted_pct()` lines 1125-1181):
```python
# Evaluate at day 14
eval_day = min(evaluation_day, predictions.shape[1] - 1)
day_predictions = predictions[:, eval_day]

# Calculate expected return
median_future = np.median(day_predictions)
expected_return_pct = (median_future - current_price) / current_price

# Measure uncertainty (risk)
cv = calculate_prediction_confidence(predictions, eval_day)  # Coefficient of Variation

# Calculate net benefit
days_to_wait = eval_day + 1
storage_cost_pct = (storage_cost_pct_per_day / 100) * days_to_wait
transaction_cost_pct = transaction_cost_pct / 100
net_benefit_pct = 100 * (expected_return_pct - storage_cost_pct - transaction_cost_pct)

# Get trend strength
adx, _, _ = calculate_adx(price_history, period=min(14, len(price_history)-1))

# Decision based on risk tier
if expected_return_pct >= min_return and net_benefit_pct > min_net_benefit_pct:
    # Sufficient expected return

    if cv < max_uncertainty_low and adx > strong_trend_adx:
        # Low risk (CV < 5%) + strong trend → HOLD all
        batch_size = batch_low_risk  # 0.0 (HOLD)
        reason = f'low_risk_cv{cv:.2%}_return{expected_return_pct:.2%}_hold'

    elif cv < max_uncertainty_medium:
        # Medium risk (CV < 10%) → Small hedge
        batch_size = batch_medium_risk  # 0.10 (10%)
        reason = f'medium_risk_cv{cv:.2%}_return{expected_return_pct:.2%}_small_hedge'

    elif cv < max_uncertainty_high:
        # High risk (CV < 20%) → Larger hedge
        batch_size = batch_high_risk  # 0.25 (25%)
        reason = f'high_risk_cv{cv:.2%}_return{expected_return_pct:.2%}_hedge'

    else:
        # Very high risk (CV >= 20%) → Sell aggressively
        batch_size = batch_very_high_risk  # 0.35 (35%)
        reason = f'very_high_risk_cv{cv:.2%}_sell'

else:
    # Insufficient return or negative net benefit
    if net_benefit_pct < 0:
        batch_size = batch_very_high_risk  # 0.35 (35%)
        reason = f'negative_net_benefit_{net_benefit_pct}%_sell'
    else:
        batch_size = batch_high_risk  # 0.25 (25%)
        reason = f'insufficient_return_{expected_return_pct:.2%}_sell'

return batch_size, reason
```

**How it works**:
1. Calculates expected return at day 14 (median of 2,000 paths)
2. Measures uncertainty using Coefficient of Variation (CV = std / mean)
3. Categorizes forecast into risk tiers:
   - **Low risk** (CV < 5%): High confidence → HOLD
   - **Medium risk** (CV < 10%): Moderate confidence → Small hedge (10%)
   - **High risk** (CV < 20%): Low confidence → Larger hedge (25%)
   - **Very high risk** (CV >= 20%): Very low confidence → Aggressive sell (35%)
4. Requires minimum return (3%) AND positive net benefit
5. ADX confirms trend strength for low-risk HOLD decisions

**Use case**: Risk-averse strategy - only holds when confident AND expected return justifies risk.

---

## Model Predictive Control (1)

### 10. RollingHorizonMPC

**File**: `rolling_horizon_mpc.py:39-290`

**Algorithm**: Limited foresight optimization using Linear Programming with rolling horizon.

**Parameters**:
- `storage_cost_pct_per_day=0.3`: Daily storage cost (% of inventory value)
- `transaction_cost_pct=2.0`: Transaction cost (% of sale revenue)
- `horizon_days=14`: Forecast window
- `terminal_value_decay=0.95`: Terminal inventory value discount factor
- `shadow_price_smoothing=None`: Optional exponential smoothing for shadow prices

**Decision Logic** (`decide()` lines 77-179):
```python
if inventory <= 0:
    return HOLD

if predictions is None or len(predictions) == 0:
    return HOLD

# Determine forecast window
if len(predictions.shape) == 2:
    # predictions is (n_runs, n_horizons) matrix - use mean across runs
    available_horizon = predictions.shape[1]
    window_len = min(horizon_days, available_horizon)
    future_prices_cents = predictions[:, :window_len].mean(axis=0)  # Average 2,000 paths
else:
    # predictions is 1D array
    window_len = min(horizon_days, len(predictions))
    future_prices_cents = predictions[:window_len]

# Convert cents/lb to $/ton
future_prices_per_ton = future_prices_cents * 20  # 2000 lbs = 1 ton

# Assume no harvest in forecast window (BacktestEngine handles harvest externally)
future_harvest = np.zeros(window_len)

# Solve Linear Programming problem for this window
result = _solve_window_lp(
    current_inventory=inventory,
    future_prices=future_prices_per_ton,
    future_harvest=future_harvest
)

if result is None or result['sell_solution'] is None:
    return HOLD  # LP failed

# EXECUTE ONLY THE FIRST DECISION (Receding Horizon Control)
sell_today = result['sell_solution'][0]

# Update shadow price if using shadow pricing
if shadow_price_smoothing is not None and result.get('shadow_price') is not None:
    if smoothed_shadow_price is None:
        smoothed_shadow_price = result['shadow_price']
    else:
        # Exponential smoothing
        alpha = shadow_price_smoothing
        smoothed_shadow_price = (alpha * result['shadow_price'] +
                                 (1 - alpha) * smoothed_shadow_price)

# Threshold to avoid tiny sales
if sell_today < 0.1:
    return HOLD

# Sell amount (capped at current inventory)
sell_amount = min(sell_today, inventory)

return SELL amount=sell_amount
```

**Linear Programming Solver** (`_solve_window_lp()` lines 181-290):
```python
n_days = len(future_prices)

# Decision variables: [sell[0], sell[1], ..., sell[n-1], inv[0], inv[1], ..., inv[n-1]]
var_sell_start = 0
var_inv_start = n_days

# Objective function: minimize (negative profit)
c = np.zeros(2 * n_days)

# Revenue - transaction costs: sell[t] * price[t] * (1 - trans_cost%)
revenue_coeff = future_prices * (1 - transaction_cost_pct / 100)
c[var_sell_start:var_inv_start] = -revenue_coeff  # Negative (we minimize)

# Storage costs: inventory[t] * price[t] * storage_cost%
storage_coeff = future_prices * (storage_cost_pct_per_day / 100)
c[var_inv_start:] = storage_coeff  # Positive (cost)

# Constraints: A_eq * x = b_eq (equality constraints)
A_eq = []
b_eq = []

for t in range(n_days):
    row = np.zeros(2 * n_days)

    # Inventory balance: sell[t] + inv[t] - inv[t-1] = harvest[t]
    row[var_sell_start + t] = 1  # sell[t]
    row[var_inv_start + t] = 1   # inv[t]

    if t > 0:
        row[var_inv_start + t - 1] = -1  # inv[t-1]
        b_eq.append(future_harvest[t])
    else:
        # Day 0: sell[0] + inv[0] = current_inventory + harvest[0]
        b_eq.append(current_inventory + future_harvest[t])

    A_eq.append(row)

A_eq = np.array(A_eq)
b_eq = np.array(b_eq)

# CRITICAL: Add terminal value to objective (prevents End-of-Horizon effect)
if shadow_price_smoothing is not None and smoothed_shadow_price is not None:
    # Use smoothed shadow price as terminal value
    terminal_val_coeff = -smoothed_shadow_price
    c[var_inv_start + n_days - 1] += terminal_val_coeff
else:
    # Use simple price-based terminal value with decay
    terminal_val_coeff = -future_prices[-1] * terminal_value_decay  # 0.95
    c[var_inv_start + n_days - 1] += terminal_val_coeff

# Bounds: all variables >= 0
bounds = [(0, None) for _ in range(2 * n_days)]

# Solve LP using HiGHS solver
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
sell_solution = result.x[var_sell_start:var_inv_start]  # Sell amounts for 14 days
inv_solution = result.x[var_inv_start:]  # Inventory levels for 14 days

# Extract shadow price (dual variable for terminal inventory constraint)
shadow_price = future_prices[-1] * terminal_value_decay  # Approximation

return {
    'sell_solution': sell_solution,
    'inventory_solution': inv_solution,
    'objective_value': -result.fun,  # Negate back to profit
    'shadow_price': shadow_price
}
```

**How it works**:
1. Receives 14-day forecast (averaged across 2,000 paths)
2. Formulates Linear Programming problem:
   - **Objective**: Maximize revenue - transaction costs - storage costs
   - **Decision variables**: sell[0..13], inventory[0..13]
   - **Constraints**: Inventory balance (sell + inv_t - inv_{t-1} = harvest)
   - **Terminal value**: Assigns value to remaining inventory at day 14 (prevents myopic liquidation)
3. Solves LP to find optimal sell schedule for 14 days
4. **Executes ONLY first day's decision** (Receding Horizon Control)
5. Next day, re-solves with updated forecast (rolling window)
6. Terminal value decay factor (0.95) prevents "end-of-horizon" effect
7. Optional shadow price smoothing improves terminal value estimate

**Key insight**: Unlike other strategies that make daily decisions independently, MPC plans ahead for 14 days but re-optimizes each day with new information (Model Predictive Control).

**Use case**: Most sophisticated optimization - balances current vs. future opportunities with limited foresight.

---

## Summary

**10 strategies total**:
- **4 Baseline**: ImmediateSale, EqualBatch, PriceThreshold, MovingAverage
- **5 Predictive**: PriceThresholdPredictive, MovingAveragePredictive, ExpectedValue, Consensus, RiskAdjusted
- **1 Optimization**: RollingHorizonMPC

**Common patterns**:
- All strategies have forced liquidation (approaching deadline)
- Most use cooldown periods (7 days) to prevent rapid trading
- Batch sizes parameterized (0.0 = HOLD, 0.15-0.40 = SELL %)
- Prediction strategies use 2,000 Monte Carlo paths × 14 days
- Cost modeling: storage_cost_pct_per_day, transaction_cost_pct

**Academic foundations**:
- Marshall et al. (2008): Price threshold and MA strategies
- Wilder (1978): Technical indicators (RSI, ADX)
- Williams & Wright (1991): Expected value optimization
- Clemen (1989): Consensus forecasting
- Markowitz (1952): Risk-adjusted returns
- Secomandi (2010): Model Predictive Control

---

## Code Repository

📂 [View Code on GitHub](https://github.com/gibbonstony/ucberkeley-capstone/tree/main/trading_agent)
