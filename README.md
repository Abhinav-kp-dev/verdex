# Verdex

> **Adaptive allocation of perishable agricultural inventory under acute supply-chain disruption.**

[![GitHub Repo](https://img.shields.io/badge/GitHub-Abhinav--kp--dev%2Fverdex-blue.svg)](https://github.com/Abhinav-kp-dev/verdex)

---

## Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | Next.js 14 (App Router), React, Tailwind CSS |
| Backend | FastAPI (Python 3.10+) |
| Optimization | SciPy HiGHS LP solver |
| State management | Zustand |
| Charts | Plotly.js (react-plotly.js) |
| Styling | CSS custom properties, dark/light mode |

---

## Running locally

### 1. Backend

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-backend.txt
uvicorn backend.main:app --port 8000 --reload
```

API is available at `http://localhost:8000`. Health check: `GET /health`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App is available at `http://localhost:3000`.

---

## Project structure

```
verdex/
├── backend/
│   ├── main.py          # FastAPI app, CORS, router mounts
│   ├── schemas.py       # Pydantic v2 request/response models
│   └── routers/
│       ├── state.py     # GET /api/state — load demo network
│       ├── optimize.py  # POST /api/optimize/
│       ├── simulate.py  # POST /api/simulate/
│       ├── reoptimize.py# POST /api/reoptimize/
│       ├── reports.py   # GET /api/reports/
│       └── data.py      # GET /api/data/
├── frontend/
│   ├── app/             # Next.js App Router pages
│   │   ├── dashboard/   # Live network overview
│   │   ├── plan/        # Run optimizer, tune lambda weights
│   │   ├── simulate/    # Inject disruptions
│   │   ├── reoptimize/  # Dynamic re-routing after disruption
│   │   ├── results/     # Reports and Sankey charts
│   │   └── research/    # Experiments and ablation
│   ├── components/
│   │   ├── layout/      # AppShell (sidebar + theme toggle), StepProgress
│   │   └── ui/          # MetricCard, PageHeader, StatusBadge
│   └── lib/
│       ├── api.ts        # Typed fetch wrappers for all endpoints
│       ├── store.ts      # Zustand global state
│       └── types.ts      # Shared TypeScript types
└── src/                 # Core Python optimization engine (unchanged)
    ├── optimizer.py     # Multi-objective LP (SciPy HiGHS)
    ├── dynamic_optimizer.py
    ├── disruption.py
    ├── spoilage_model.py
    ├── models.py
    └── ...
```

---

## How it works

Verdex solves a multi-objective linear program that minimizes a weighted penalty:

$$J = \lambda_{\text{spoilage}} \sum s_p x_p + \lambda_{\text{cost}} \sum c_p x_p + \lambda_{\text{unmet}} \sum \pi_m u_m + \lambda_{\text{risk}} \sum r_p x_p$$

subject to batch supply bounds, cold storage capacity limits, demand fulfillment constraints, and a perishability cutoff that prohibits routing a batch past its remaining shelf life.

Spoilage fraction $s_p$ is derived from Arrhenius thermal kinetics — transit time is accelerated by ambient temperature excess relative to a reference cold-chain temperature, then raised to a power decay exponent.

When a disruption is injected (truck breakdown, cold storage failure, demand shock, heatwave, road closure), the re-optimizer preserves valid in-flight allocations, ages remaining inventory by the disruption duration, and solves a residual LP for stranded batches — typically in under 10 ms.

---

## Benchmark results (100 Monte Carlo scenarios)

| Method | Spoilage % | Demand fulfillment % | Freight cost ($) | Recovery time |
| :--- | :---: | :---: | :---: | :---: |
| Nearest market (greedy) | 13.82% ± 3.41% | 86.18% | $4,812 | 0.3 ms |
| Cheapest route (LP) | 4.65% ± 1.82% | 95.35% | $3,618 | 7.8 ms |
| **Verdex DPSRO** | **1.84% ± 0.62%** | **98.16%** | $3,892 | **5.1 ms** |

85.5% less spoilage than the greedy baseline. 60.3% less than cheapest-route. Scales to 500 batches / 9,000 decision variables in under 1.7 s.

---

## Tests

```bash
pytest tests/ -v
# 73 passed
```

---

## Known limitations

- Transit times are deterministic (fixed average velocity). Stochastic travel time distributions are a planned extension.
- Single-period optimization. Rolling-horizon multi-period planning is future work.
- No live telemetry. Production deployment would ingest IoT cold-chain and OBD-II streams.
