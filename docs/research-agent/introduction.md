---
sidebar_position: 1
---

# Research Agent

Data infrastructure for commodity forecasting, transforming raw market data into production-ready ML tables on Databricks.

## Gold Layer Architecture

Two production tables with different NULL handling strategies:

### `commodity.gold.unified_data` (Production)
Forward-filled features for immediate use. SQL implementation uses `LAST_VALUE` with `ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` pattern.

### `commodity.gold.unified_data_raw` (Experimental)
Preserves NULLs for custom imputation strategies. Includes missingness indicator flags.

**DRY Design**: Production table is derived from raw table (not parallel builds). Single source of truth for transformations.

**Source**: `research_agent/sql/create_gold_unified_data.sql` (118 lines), `create_gold_unified_data_raw.sql` (326 lines)

## Data Features

**Market Data**: OHLCV (open, high, low, close, volume)
**Volatility**: VIX
**Currency**: 24 FX pairs (vnd_usd, cop_usd, idr_usd, etb_usd, hnl_usd, ugx_usd, pen_usd, xaf_usd, gtq_usd, gnf_usd, nio_usd, crc_usd, tzs_usd, kes_usd, lak_usd, pkr_usd, php_usd, egp_usd, ars_usd, rub_usd, try_usd, uah_usd, irr_usd, byn_usd)
**Regional**: weather_data (array), gdelt_themes (array)

**Source**: Verified in `create_gold_unified_data.sql` lines 71-94 (FX), 99 (weather), 108 (GDELT)

## Validation

Python validation script: `tests/data_quality/gold/validate_gold_unified_data.py`

Tests schema, completeness, array structures, and data quality.

## Code Repository

📂 [View Code on GitHub](https://github.com/gibbonstony/ucberkeley-capstone/tree/main/research_agent)
