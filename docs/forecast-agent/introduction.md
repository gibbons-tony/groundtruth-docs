---
sidebar_position: 1
---

# Forecast Agent

Machine learning framework for commodity price forecasting built on PySpark.

## ml_lib Framework

PySpark-based forecasting pipeline located in `forecast_agent/ml_lib/`.

### Core Components

**ImputationTransformer** (`transformers/imputation.py`)
- 4 strategies: forward_fill, mean_7d, zero, keep_null
- Handles NULLs in commodity.gold.unified_data_raw
- Wildcard pattern matching for feature groups
- Date-conditional logic for historical data gaps

**Source**: Lines 58-76 document strategies, implementation in `imputation.py`

**GoldDataLoader** (`cross_validation/data_loader.py`)
- Loads commodity.gold tables
- Filters by commodity and date range
- Returns PySpark DataFrame

**TimeSeriesForecastCV** (`cross_validation/time_series_cv.py`)
- Cross-validation for time series
- Walk-forward validation

### Models

Implemented in `ml_lib/models/`:
- baseline.py - Baseline forecasting methods
- linear.py - Linear model implementations
- multi_horizon.py - Multi-horizon forecasting

**Source**: Verified by `ls ml_lib/models/`

## Code Repository

📂 [View Code on GitHub](https://github.com/gibbonstony/ucberkeley-capstone/tree/main/forecast_agent)
