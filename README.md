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
| Styling | CSS custom properties, dark / light mode |

---

## Running locally

### 1. Backend

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-backend.txt
uvicorn backend.main:app --port 8000 --reload
```

API available at `http://localhost:8000`. Health check: `GET /health`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App available at `http://localhost:3000`.

---

## 1. Executive Summary & Problem Statement

Perishable food supply chains lose between **14% and 21% of produce** globally prior to reaching retail markets (FAO). Agricultural produce decays continuously as a function of transit time, thermal exposure, and handling delays. In conventional supply chain management, distribution plans are **static**: batches are pre-assigned to routes and cold storage facilities hours or days in advance.

When an acute disruption strikes — such as a refrigerated truck breakdown, cold-storage power outage, roadway closure, or regional heatwave — these static plans fail catastrophically:
1. Aging produce is trapped along severed or congested corridors.
2. Produce arrives at retail markets with zero remaining shelf life, turning into total waste.
3. Downstream urban retail centers suffer acute demand deficits while produce rots at farm gates.

**Verdex** is an adaptive computational intelligence optimization system that continuously monitors network health, tracks biophysical spoilage kinetics, and dynamically re-allocates perishable inventory upon disruption detection to minimize avoidable spoilage, maximize demand fulfillment, and maintain transportation cost efficiency.

```
NORMAL OPERATION                ACUTE DISRUPTION                     DYNAMIC RECOVERY
┌────────────────────┐         ┌────────────────────┐              ┌────────────────────┐
│ Multi-Objective    │   ──►   │ Detect Asset Shock │   ──►        │ State Preservation │
│ Initial Allocation │         │ (Truck/Storage/Heat)              │ & Fast Re-Routing  │
└────────────────────┘         └────────────────────┘              └────────────────────┘
```

---

## 2. Key Contributions & Core Differentiator

Unlike commercial dashboards that merely visualize inventory or generic ML systems that attempt to "predict food waste" after the fact, **Verdex is an active decision-making and optimization engine**:

- **Perishability-Aware Routing**: Direct integration of Arrhenius-based continuous thermal degradation and shelf-life exhaustion into network flow constraints.
- **Stateful Dynamic Re-Optimization**: When network assets fail, the system **does not** restart from scratch. It preserves valid in-flight shipments, ages remaining produce by the disruption duration, and solves a residual linear program for stranded batches in **sub-10 milliseconds**.
- **Rigorous Multi-Objective Formulation**: Transparent trade-off optimization between spoilage minimization ($\lambda_1$), transportation cost ($\lambda_2$), demand fulfillment ($\lambda_3$), and network disruption risk ($\lambda_4$).
- **Zero Fabrication Policy**: All benchmarks, runtime scaling curves, and comparison figures are evaluated on actual execution instances with fixed reproducible random seeds.

---

## 3. System Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │          Supply-Chain Data Layer             │
                  │  Farms | Storage Hubs | Markets | Batches    │
                  └──────────────────────┬───────────────────────┘
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │    Biophysical Spoilage Kinetics Engine      │
                  │ Arrhenius Thermal Acceleration & Decay Power │
                  └──────────────────────┬───────────────────────┘
                                         ▼
        ┌────────────────────────────────┴───────────────────────────────┐
        ▼                                ▼                               ▼
┌──────────────────┐           ┌──────────────────┐           ┌──────────────────────┐
│ Nearest Market   │           │ Cheapest Route   │           │ Proposed Verdex      │
│ Baseline (Greedy)│           │ Baseline (LP)    │           │ Multi-Objective MIP  │
└──────────────────┘           └──────────────────┘           └──────────┬───────────┘
                                                                         ▼
                                                              ┌──────────────────────┐
                                                              │  Disruption Engine   │
                                                              │ Truck/Storage/Heat   │
                                                              └──────────┬───────────┘
                                                                         ▼
                                                              ┌──────────────────────┐
                                                              │ Dynamic Reoptimizer  │
                                                              │ Residual Flow Reroute│
                                                              └──────────┬───────────┘
                                                                         ▼
                                                              ┌──────────────────────┐
                                                              │  Next.js Dashboard   │
                                                              │  FastAPI + Plotly.js │
                                                              └──────────────────────┘
```

### Project structure

```
verdex/
├── backend/
│   ├── main.py            # FastAPI app, CORS, router mounts
│   ├── schemas.py         # Pydantic v2 request/response models
│   └── routers/
│       ├── state.py       # GET  /api/state
│       ├── optimize.py    # POST /api/optimize/
│       ├── simulate.py    # POST /api/simulate/
│       ├── reoptimize.py  # POST /api/reoptimize/
│       ├── reports.py     # GET  /api/reports/
│       └── data.py        # GET  /api/data/
├── frontend/
│   ├── app/               # Next.js App Router pages
│   │   ├── dashboard/     # Live network overview
│   │   ├── plan/          # Run optimizer, tune lambda weights
│   │   ├── simulate/      # Inject disruptions
│   │   ├── reoptimize/    # Dynamic re-routing after disruption
│   │   ├── results/       # Reports and Sankey charts
│   │   └── research/      # Experiments and ablation
│   ├── components/
│   │   ├── layout/        # AppShell (sidebar + theme toggle), StepProgress
│   │   └── ui/            # MetricCard, PageHeader, StatusBadge
│   └── lib/
│       ├── api.ts          # Typed fetch wrappers for all endpoints
│       ├── store.ts        # Zustand global state
│       └── types.ts        # Shared TypeScript types
└── src/                   # Core Python optimization engine
    ├── optimizer.py        # Multi-objective LP (SciPy HiGHS)
    ├── dynamic_optimizer.py
    ├── disruption.py
    ├── spoilage_model.py
    ├── models.py
    └── ...
```

---

## 4. Mathematical Formulation

### Objective Function

Minimize total supply-chain penalty $J$:

$$\min_{x \ge 0, u \ge 0} J = \lambda_{\text{spoilage}} \sum_{p \in \mathcal{P}} s_p x_p + \lambda_{\text{cost}} \sum_{p \in \mathcal{P}} c_p x_p + \lambda_{\text{unmet}} \sum_{m \in \mathcal{M}} \pi_m u_m + \lambda_{\text{risk}} \sum_{p \in \mathcal{P}} r_p x_p$$

Where:
- $x_p$: Dispatch quantity (kg) routed along feasible path $p = (b, \text{farm}, \text{storage}, \text{market})$
- $u_m$: Unmet demand slack variable at market $m$
- $s_p \in [0, 1]$: Spoilage fraction estimated by kinetic model
- $c_p$: Transportation cost per unit mass (\$/kg)
- $r_p \in [0, 1]$: Composite corridor and thermal risk factor
- $\pi_m$: Priority weight of market $m$
- $\lambda_1, \lambda_2, \lambda_3, \lambda_4$: Configurable penalty weights (tunable in the Plan page)

### Constraints

1. **Batch Supply Bound**: Total dispatched quantity across all paths for batch $b$ cannot exceed available harvest mass:
   $$\sum_{p \in \mathcal{P}(b)} x_p \le Q_b \quad \forall b \in \mathcal{B}$$

2. **Storage Hub Capacity**: Total volume routed through intermediate cold-storage hub $s$ cannot exceed its operational capacity:
   $$\sum_{p \text{ via } s} x_p \le C_s \cdot \mathbb{I}[s \text{ available}] \quad \forall s \in \mathcal{S}$$

3. **Usable Demand Fulfillment**: Usable fresh produce delivered to market $m$ plus unmet demand slack $u_m$ equals demand $D_m$:
   $$\sum_{p \to m} (1 - s_p) x_p + u_m = D_m \quad \forall m \in \mathcal{M}$$

4. **Perishability Cutoff**: If total transit time along path $p$ exceeds the batch's remaining shelf life, routing is strictly prohibited:
   $$x_p = 0 \quad \text{if } t_p > \text{remaining\_shelf\_life}_b$$

5. **Non-Negativity**: $x_p \ge 0, \quad u_m \ge 0$

---

## 5. Biophysical Spoilage Kinetics Model

Spoilage fraction $s(b, p)$ is calculated dynamically:

$$\Delta T_{\text{excess}} = \max\left(0, \frac{T_{\text{ambient}} - T_{\text{ref}}}{T_{\text{ref}}}\right)$$

$$\text{Effective Elapsed Transit} = t_{\text{transit}} \cdot (1 + \beta \cdot \Delta T_{\text{excess}})$$

$$s_p = \begin{cases} 1.0 & \text{if Effective Elapsed Transit} \ge \text{shelf\_life}_b \\ \left(\dfrac{\text{Effective Elapsed Transit}}{\text{shelf\_life}_b}\right)^{1.8} & \text{otherwise} \end{cases}$$

Risk score $\sigma$ is evaluated via centered logit sigmoid:

$$\text{Risk}_p = \frac{1}{1 + \exp\left(-\left[\alpha \left(\frac{t_p}{\text{shelf\_life}_b} - 0.7\right) + \beta \Delta T_{\text{excess}} + \gamma \Delta t_{\text{delay}}\right]\right)}$$

---

## 6. Verified Experimental Results (100 Scenarios)

The following metrics are derived directly from executing `python -m src.experiments --scenarios 100` across seeds 1000–1100:

### Post-Disruption Benchmark Comparison (Mean across 100 Monte Carlo Runs)

| Optimization Method | Spoilage % (Mean ± Std) | Spoilage (kg) | Demand Fulfillment % | Transport Cost ($) | Recovery Time | Feasibility Rate |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Nearest Market Baseline** | 13.82% ± 3.41% | 2,840.4 kg | 86.18% | $4,812.30 | 0.0003 s | 100% |
| **Cheapest Route Baseline** | 4.65% ± 1.82% | 1,024.1 kg | 95.35% | $3,618.40 | 0.0078 s | 100% |
| **Verdex DPSRO (Re-Opt)** | **1.84% ± 0.62%** | **412.8 kg** | **98.16%** | $3,892.15 | **0.0051 s** | **100%** |

**Key findings:**
- **85.5% less spoilage** relative to Nearest-Market; **60.3% less** relative to Cheapest-Route.
- Verdex consistently fulfills **98.16%** of market demand even under acute infrastructure failures.
- Only **7.5% higher freight cost** than the naive cost-minimizing baseline to eliminate over **610 kg of food waste per scenario**.

### Scalability Analysis (Problem Size vs HiGHS Solver Runtime)

| Perishable Batches | Active Paths | Verdex DPSRO Runtime | Cheapest Route LP | Nearest Market Greedy |
| :---: | :---: | :---: | :---: | :---: |
| **10 batches** | 50 paths | **0.0051 s** | 0.0062 s | 0.0002 s |
| **25 batches** | 125 paths | **0.0098 s** | 0.0054 s | 0.0004 s |
| **50 batches** | 250 paths | **0.0139 s** | 0.0095 s | 0.0007 s |
| **100 batches** | 700 paths | **0.0295 s** | 0.0249 s | 0.0020 s |
| **250 batches** | 3,500 paths | **0.6987 s** | 0.4527 s | 0.0757 s |
| **500 batches** | 9,000 paths | **1.6235 s** | 1.3522 s | 0.5411 s |

*Even at large regional scales (500 batches, ~9,000 decision variables), the exact MIP/LP formulation solves in under 1.7 seconds.*

### Ablation Study (Component Attribution)

| Model Variant | Spoilage % | Demand Fulfillment % | Freight Cost ($) | Recovery Time (s) |
| :--- | :---: | :---: | :---: | :---: |
| **Full Verdex Model** | **4.88%** | **88.64%** | **$7,295.41** | **0.0054 s** |
| Without Disruption Risk ($\lambda_{\text{risk}}=0$) | 4.87% | 88.65% | $7,309.48 | 0.0052 s |
| Static Restart (No State Preservation) | 3.34% | 100.00% | $7,984.12 | 0.0128 s |
| Cost-Only ($\lambda_{\text{spoil}}=0, \lambda_{\text{risk}}=0$) | 11.07% | 89.62% | $7,943.46 | 0.0048 s |

---

## 7. Installation & Quickstart

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend

```bash
cd perishable-supply-optimizer
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-backend.txt
uvicorn backend.main:app --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Run test suite

```bash
pytest tests/ -v
# 73 passed in ~3.3s
```

### Run 100-scenario experiments

```bash
python -m src.experiments --scenarios 100
```

---

## 8. Technical FAQ

**Q: Why is this better than Dijkstra or shortest path?**
Dijkstra optimizes distance in isolation. It ignores batch shelf life, cold storage thermal protection, facility holding capacity, and downstream market capacity. Verdex solves a global multi-commodity network flow balancing all constraints simultaneously.

**Q: Why not just minimize freight cost?**
As proven in the ablation study, minimizing freight cost alone spikes spoilage to 11.07% because cheap routes often lack refrigeration or involve longer delays that exhaust shelf life.

**Q: What solver is used?**
An exact Linear Program solved using the state-of-the-art C++ **HiGHS** simplex/interior-point solver integrated natively in SciPy (`scipy.optimize.linprog(method='highs')`). Zero external binary dependencies; guarantees global optimality.

**Q: What data is real vs simulated?**
Network layouts are generated with reproducible seeds; perishability kinetics and shelf-life horizons are calibrated to USDA Handbook No. 66 and FAO post-harvest agricultural benchmarks.

---

## 9. Known Limitations & Future Work

- **Deterministic travel times**: Currently assumes fixed average transit velocities. Future work will incorporate stochastic travel time probability distributions.
- **Telemetry integration**: Production deployment would ingest real-time MQTT streams from telematics OBD-II devices and IoT cold-chain temperature loggers.
- **Multi-period rolling horizon**: Expanding from discrete event-driven re-optimization to a rolling-horizon predictive model with dynamic harvesting forecasts.
