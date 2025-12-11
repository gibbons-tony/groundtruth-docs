---
sidebar_position: 1
---

# Forecast Agent

The Forecast Agent is the machine learning forecasting engine for Ground Truth, delivering probabilistic price predictions for coffee and sugar futures through a PySpark-based model framework.

## Overview

The Forecast Agent uses the ml_lib PySpark framework to generate 14-day forecasts with 2,000 Monte Carlo paths per prediction. It implements a "fit many, publish few" strategy: test 200+ model configurations, then backfill and publish only the top ~15 diverse models.

**Output**: `commodity.forecast.distributions` (2,000 paths) and `commodity.forecast.point_forecasts` (mean, median, quantiles)

## Key Achievement: 180x Speedup Evolution

**V1: Retrain-Per-Forecast** (24-48 hours)
- Train model for every forecast date
- Sequential processing
- No persistence

**V2: Train-Once/Inference-Many** (1-2 hours)
- Train once, predict many dates
- Model persistence to DBFS
- 180x faster than V1

**V3: ml_lib + Gold Tables** (minutes)
- 90% fewer rows (7,612 vs 75,000)
- forecast_testing schema for safe experimentation
- "Fit many, publish few" compute savings

**Result**: From days to minutes through architectural evolution

## Model Suite

### Implemented Models

| Model Family | Implementation | Use Case |
|:------------|:---------------|:---------|
| **Statistical** | ARIMA, SARIMAX | Seasonal patterns, weather/FX exogenous variables |
| **Prophet** | Prophet (additive/multiplicative) | Holiday effects, trend changes |
| **Tree-Based** | XGBoost | Feature interactions, non-linear relationships |
| **Baseline** | Random Walk | Benchmark comparison |

**Coffee**: 10 real models (sarimax_auto_weather_v1, prophet_v1, xgboost_weather_v1, etc.)
**Sugar**: 5 real models (sarimax_auto_weather_v1, prophet_v1, xgboost_weather_v1, arima_auto_v1, random_walk_v1)

## "Fit Many, Publish Few" Strategy

### Problem
Fitting 200+ configurations and publishing all would create testing explosion for Trading Agent (testing 200 forecasts is impractical).

### Solution: Three-Phase Approach

**Phase 1: Experiment** (commodity.forecast_testing)
- Test 200+ model configurations
- Vary hyperparameters, exogenous features
- Safe isolated schema

**Phase 2: Evaluate**
- Measure directional accuracy (DA), MAE, stability
- SQL-based selection criteria
- Select top ~15 diverse models

**Phase 3: Backfill & Publish** (commodity.forecast)
- Backfill only selected 15 models
- Compute savings: 4,800 hours → 360 hours (93% reduction)
- Trading Agent tests curated set of 15, not 200

## Architecture

### Data Sources

The Forecast Agent consumes gold tables from the Research Agent:

**Production**: `commodity.gold.unified_data`
- Forward-filled features (no NULLs)
- 7,612 rows (Coffee + Sugar, 2015-2024)
- Ready for immediate use

**Experimental**: `commodity.gold.unified_data_raw`
- NULLs preserved (~30% market data, ~73% GDELT)
- Requires `ImputationTransformer` from ml_lib
- For testing custom imputation strategies

### Testing Schema

`commodity.forecast_testing.*` - Isolated experimentation:
- distributions
- point_forecasts
- model_metadata
- validation_results

Test configurations here before promoting to production (`commodity.forecast.*`)

### ml_lib Framework

**Key Components**:

1. **GoldDataLoader** - Load production or experimental tables
2. **ImputationTransformer** - 4 imputation strategies (forward-fill, mean, median, zero)
3. **TimeSeriesForecastCV** - Cross-validation framework
4. **Model Implementations** - SARIMAX, Prophet, XGBoost, ARIMA, Random Walk

**Example Usage**:
```python
from forecast_agent.ml_lib.cross_validation.data_loader import GoldDataLoader

loader = GoldDataLoader()  # Defaults to unified_data
df = loader.load(commodity='Coffee')

# Or use raw table with imputation
loader_raw = GoldDataLoader(table_name='commodity.gold.unified_data_raw')
df_raw = loader_raw.load(commodity='Coffee')
```

## Forecast Output

All tables in `commodity.forecast` schema:

### `commodity.forecast.distributions`
- 2,000 Monte Carlo paths per forecast
- Columns: forecast_date, commodity, region, model_name, path_id, day_1...day_14, actual_close
- Used by Trading Agent for risk analysis

### `commodity.forecast.point_forecasts`
- 14-day forecasts with prediction intervals
- Columns: forecast_date, commodity, region, model_name, day_1...day_14, actual_close
- Mean, median, quantiles computed from distributions

### `commodity.forecast.model_metadata`
- Model performance metrics
- Columns: model_name, commodity, MAE, RMSE, Dir Day0 (directional accuracy)
- Tracks which models are deployed

## Key Metrics

**MAE** (Mean Absolute Error): Average prediction error in dollars
**RMSE** (Root Mean Squared Error): Penalizes large errors
**Dir Day0**: Directional accuracy from day 0 - measures if day i > day 0 (trading signal quality)

**Metric tracked in**: `commodity.forecast.model_metadata` table

## Key Innovations

### 1. Gold Table Integration

**Innovation**: 90% row reduction through array-based regional data

**Impact**:
- 7,612 rows vs 75,000 (faster model training)
- Flexible NULL handling (production vs experimental)
- Simplified data grain

### 2. Testing Schema Isolation

**Innovation**: Separate `commodity.forecast_testing` schema for safe experimentation

**Impact**:
- Test 200+ configs without polluting production
- SQL-based model selection
- Clean promotion workflow

### 3. "Fit Many, Publish Few"

**Innovation**: Comprehensive testing, selective backfilling

**Impact**:
- 93% compute savings (4,800 → 360 hours)
- Trading Agent tests curated 15 models, not 200
- Freedom to experiment without production impact

## Implementation Patterns

### Baseline Model
Simple moving average and trend-based forecasts as benchmarks.

### Linear Models
SARIMAX with exogenous variables (weather, economic indicators).

### Tree-Based Models
XGBoost and LightGBM with feature engineering.

### Deep Learning
LSTM and Temporal Fusion Transformer (TFT) for complex patterns.

### Multi-Horizon
Forecast 1, 7, 14, and 30 days ahead simultaneously.

## Documentation

For detailed implementation:
- **Architecture**: [ARCHITECTURE.md](https://github.com/gibbonstony/ucberkeley-capstone/blob/main/forecast_agent/docs/ARCHITECTURE.md)
- **Spark Backfill Guide**: [SPARK_BACKFILL_GUIDE.md](https://github.com/gibbonstony/ucberkeley-capstone/blob/main/forecast_agent/docs/SPARK_BACKFILL_GUIDE.md)
- **Model Patterns**: Review model implementations in `/ml_lib/models/`

## Code Repository

📂 **[View Forecast Agent Code on GitHub](https://github.com/gibbonstony/ucberkeley-capstone/tree/main/forecast_agent)**

Explore the complete implementation including:
- 15+ model implementations
- Spark parallelization patterns
- Model persistence layer
- Forecast manifest system
- Backtesting framework
