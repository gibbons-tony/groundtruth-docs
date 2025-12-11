---
sidebar_position: 10
---

# Team

Ground Truth is a collaborative capstone project by four UC Berkeley Master of Information and Data Science (MIDS) students, completed in 2024.

## Team Members

### Connor Watson
**Forecast Agent Lead**

Connor led the development of the Forecast Agent, implementing the ml_lib PySpark framework and achieving the 180x speedup evolution from V1 to V3 architecture.

**Key Contributions**:
- ml_lib PySpark forecasting framework
- Model implementations: SARIMAX, Prophet, XGBoost, ARIMA, Random Walk
- "Fit many, publish few" strategy (93% compute savings)
- Gold table integration and testing schema (forecast_testing)
- ImputationTransformer for flexible NULL handling

**Background**: Software engineering with focus on distributed systems and ML infrastructure.

---

### Stuart Holland
**Research Agent Lead**

Stuart architected the gold layer data platform that serves as the foundation for all forecasting and trading operations. His array-based regional data approach achieved 90% row reduction while maintaining complete market coverage.

**Key Contributions**:
- Gold layer architecture (commodity.gold.unified_data)
- Array-based regional data (weather, GDELT)
- 90% data reduction (75,000 → 7,612 rows)
- 6 AWS Lambda functions for automated data collection
- Bronze → Gold medallion architecture on Databricks

**Background**: Data engineering expertise with experience in cloud infrastructure and ETL pipelines.

---

### Francisco Munoz
**Trading Agent Specialist**

Francisco developed the trading strategy framework and conducted the synthetic model experiments that discovered the 70% accuracy threshold for profitability.

**Key Contributions**:
- 9 trading strategy implementations (4 baseline + 5 prediction-based)
- Synthetic model testing (50%-100% accuracy levels)
- 70% accuracy threshold discovery
- Multi-model backtesting framework

**Background**: Quantitative finance with expertise in algorithmic trading and risk management.

---

### Tony Gibbons
**Trading Agent Lead & Integration**

Tony led the Trading Agent development and orchestrated the integration of all three agents into a cohesive end-to-end system, including production deployment with WhatsApp integration.

**Key Contributions**:
- Daily recommendations system (operations framework)
- WhatsApp integration with multi-currency support (15+ currencies)
- Multi-model backtesting framework
- End-to-end system integration
- Unity Catalog data access layer

**Background**: Software engineering and quantitative methods with focus on optimization and control systems.

---

## Project Timeline

| Phase | Duration | Lead | Deliverables |
|:------|:---------|:-----|:-------------|
| **Research & Planning** | Weeks 1-2 | All | Project scope, data sources, architecture design |
| **Data Infrastructure** | Weeks 3-6 | Stuart | Bronze→Silver→Gold pipeline, unified data |
| **ML Model Development** | Weeks 7-11 | Connor | 15+ models, Spark parallelization |
| **Trading Strategies** | Weeks 9-13 | Francisco, Tony | 9 strategies, statistical validation |
| **Integration & Testing** | Weeks 12-14 | All | End-to-end system, performance tuning |
| **Production Deployment** | Week 15 | Tony | Live system, monitoring, documentation |

## Technology Stack

| Layer | Technologies | Primary Owner |
|:------|:------------|:--------------|
| **Data Collection** | AWS Lambda, S3, EventBridge | Stuart |
| **Data Platform** | Databricks, Delta Lake, Unity Catalog, PySpark | Stuart |
| **ML Framework** | statsmodels (SARIMAX, ARIMA), Prophet, XGBoost | Connor |
| **Analysis** | NumPy, Pandas, SciPy | All |
| **Trading Logic** | Python, Databricks SQL, Backtesting Framework | Francisco, Tony |
| **Deployment** | Databricks Workflows, WhatsApp Integration | Tony |

## Key Achievements by Agent

### Research Agent (Stuart)

**Data Architecture Innovation**:
- Gold layer with array-based regional data
- 90% data reduction (75,000 → 7,612 rows)
- Flexible NULL handling (production vs experimental tables)
- Grain optimization: (date, commodity, region) → (date, commodity)

**Infrastructure Excellence**:
- 6 AWS Lambda functions with EventBridge scheduling (2AM UTC daily)
- Bronze → Gold medallion architecture
- Delta Lake with Unity Catalog integration
- Forward-fill interpolation for continuous daily coverage

### Forecast Agent (Connor)

**ML Performance Breakthrough**:
- 180x speedup evolution: V1 (24-48h) → V2 (1-2h) → V3 (minutes)
- ml_lib PySpark framework
- Gold table integration (90% fewer rows for faster training)
- Testing schema (forecast_testing) for safe experimentation

**Model Selection Innovation**:
- "Fit many, publish few" strategy (93% compute savings: 4,800 → 360 hours)
- Test 200+ configs, backfill only top ~15
- ImputationTransformer for flexible NULL handling
- Statistical model implementations: SARIMAX, Prophet, XGBoost, ARIMA, Random Walk

### Trading Agent (Francisco & Tony)

**Strategy Development**:
- 9 trading strategies (4 baseline + 5 prediction-based)
- Synthetic model testing (50%-100% accuracy levels)
- 70% accuracy threshold discovery through controlled experiments
- Multi-model backtesting (243 scenarios: Coffee + Sugar)

**Production Deployment**:
- Daily recommendations system with WhatsApp integration
- Multi-currency support (15+ currencies including COP for Colombian traders)
- Unity Catalog integration (zero CSV dependencies)
- Multi-model comparison framework

## Academic Supervision

**Program**: Master of Information and Data Science (MIDS)

**Institution**: UC Berkeley School of Information

**Capstone Year**: 2024

## Acknowledgments

We would like to thank:

- **UC Berkeley MIDS Faculty** for guidance and mentorship throughout the capstone project
- **Industry Mentors** who provided domain expertise in commodity trading and quantitative finance
- **Databricks** for providing the cloud platform that enabled our scalable ML infrastructure
- **Open Source Community** for the excellent libraries (Prophet, XGBoost, PyTorch) that powered our models

## Contact & Links

### Project Resources

- **GitHub Repository**: [github.com/gibbonstony/ucberkeley-capstone](https://github.com/gibbonstony/ucberkeley-capstone)
- **Live System**: [studiomios.wixstudio.com/caramanta](https://studiomios.wixstudio.com/caramanta)
- **Technical Documentation**: This site

### UC Berkeley MIDS

- **School of Information**: [ischool.berkeley.edu](https://www.ischool.berkeley.edu/)
- **MIDS Program**: [ischool.berkeley.edu/programs/mids](https://www.ischool.berkeley.edu/programs/mids)

---

**Project Status**: Complete ✅

**Completion Date**: December 2024

**Team**: Connor Watson, Stuart Holland, Francisco Munoz, Tony Gibbons

Built as a UC Berkeley MIDS Capstone Project
