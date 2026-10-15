# Verdex

**Perishable supply chain optimizer — adaptive re-routing under real-world disruptions.**

[![GitHub](https://img.shields.io/badge/GitHub-Abhinav--kp--dev%2Fverdex-0d1117?style=flat&logo=github)](https://github.com/Abhinav-kp-dev/verdex)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=nextdotjs)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.10+-3776ab?style=flat&logo=python)

---

## The Problem

The global food system loses **14–21% of perishable produce** before it ever reaches a retail shelf (FAO, 2019). Most of this waste does not happen at the farm or the market — it happens in transit, because supply chain plans are written once and never updated.

A static distribution plan looks like this:

> *"Farm F2 sends 2,000 kg of tomatoes to Storage S1 via Truck T3, which delivers to Market M2 by Thursday."*

That plan works under ideal conditions. But supply chains are not ideal. Trucks break down. Cold storage units lose power. Roads close after floods. Regional heatwaves compress shelf lives by 30% overnight. When any of these events hits, the static plan becomes useless — and produce that was hours away from delivery starts rotting on the side of a blocked road.

The industry response to disruptions is manual: dispatchers make phone calls, reroute trucks by instinct, and absorb the losses. For a regional distributor handling 50+ batches across dozens of routes, this process takes hours. Produce does not have hours.

---

## The Idea

Treat supply chain re-routing as a **mathematical optimization problem that can be solved in milliseconds**.

Every batch of perishable produce has a shelf life. Every route has a travel time and a thermal profile. Every storage facility has a capacity. Every market has a demand. These are not soft preferences — they are hard constraints that can be encoded precisely into a linear program.

When a disruption occurs, the system does not start over. It:
1. **Freezes** allocations that are already in motion and still viable.
2. **Ages** the remaining inventory by the disruption duration.
3. **Solves a residual LP** for the stranded batches only — finding new routes that respect remaining shelf lives, available capacity, and market demand.

The result is a globally optimal re-allocation in under 10 milliseconds, delivered through a live dashboard that shows exactly what changed, what was saved, and what was lost.

---

## Solution Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Verdex Platform                              │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   Dashboard  │    │ Plan & Tune  │    │  Simulate & Recover  │  │
│  │              │    │              │    │                      │  │
│  │ Live network │    │ Run the LP   │    │ Inject disruption →  │  │
│  │ overview     │    │ Tune λ       │    │ dynamic re-optimize  │  │
│  │ Batch status │    │ weights      │    │ in < 10 ms           │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│                                                                     │
│  Frontend: Next.js 14 · Tailwind CSS · Plotly.js · Zustand         │
│  Backend:  FastAPI · SciPy HiGHS LP solver · Pydantic v2           │
└─────────────────────────────────────────────────────────────────────┘
```

The workflow follows four stages:

| Stage | Page | What happens |
| :---: | :--- | :--- |
| 1 | **Dashboard** | Load the supply network. Inspect farms, storage hubs, markets, and batch statuses. |
| 2 | **Plan Delivery** | Run the multi-objective optimizer. Tune spoilage, cost, unmet demand, and risk weights. Review the Sankey allocation chart. |
| 3 | **Simulate Disruption** | Inject a truck breakdown, cold storage failure, demand shock, heatwave, or road closure. See which nodes go offline. |
| 4 | **Re-Optimize** | Run the stateful re-optimizer. Stranded batches are rerouted; in-flight valid shipments are preserved. |

---

## Key Differentiators

**vs. static allocation dashboards**
Most supply chain tools visualize what happened. Verdex computes what should happen next, in real time, under the current network state.

**vs. greedy heuristics**
Nearest-market and cheapest-route approaches optimize one variable in isolation. Verdex balances spoilage, cost, unmet demand, and route risk simultaneously through a single exact LP.

**vs. re-running the full optimizer from scratch**
A full restart after a disruption ignores in-flight shipments that are still viable, wastes solver time on already-settled allocations, and produces plans that contradict reality. Verdex's stateful re-optimizer only acts on what is actually stranded.

**Zero fabrication policy**
Every benchmark figure in this repository is produced by running `python -m src.experiments --scenarios 100` with fixed seeds. No numbers were written by hand.

---

## System Architecture

```
                  ┌──────────────────────────────────────────────┐
                  │          Supply-Chain Data Layer             │
                  │  Farms | Storage Hubs | Markets | Batches    │
                  └──────────────────────┬───────────────────────┘
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │    Biophysical Spoilage Kinetics Engine      │
                  │ Arrhenius Thermal Acceleration & Decay Power │
                  └──────────────────────┬───────────────────────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                           ▼
   ┌──────────────────┐       ┌──────────────────┐       ┌─────────────────────┐
   │ Nearest Market   │       │ Cheapest Route   │       │    Verdex DPSRO     │
   │ Baseline (Greedy)│       │ Baseline (LP)    │       │ Multi-Objective MIP │
   └──────────────────┘       └──────────────────┘       └──────────┬──────────┘
                                                                     │
                                                                     ▼
                                                          ┌──────────────────────┐
                                                          │  Disruption Engine   │
                                                          │ Truck / Storage /    │
                                                          │ Heatwave / Road /    │
                                                          │ Demand Shock         │
                                                          └──────────┬───────────┘
                                                                     │
                                                                     ▼
                                                          ┌──────────────────────┐
                                                          │  Dynamic Reoptimizer │
                                                          │  Stateful Residual   │
                                                          │  Flow Re-routing     │
                                                          └──────────┬───────────┘
                                                                     │
                                                                     ▼
                                                          ┌──────────────────────┐
                                                          │   Next.js Dashboard  │
                                                          │   FastAPI · Plotly   │
                                                          └──────────────────────┘
```

### Project structure

```
verdex/
├── backend/
│   ├── main.py              # FastAPI app, CORS, router mounts
│   ├── schemas.py           # Pydantic v2 I/O schemas
│   └── routers/
│       ├── state.py         # GET  /api/state
│       ├── optimize.py      # POST /api/optimize/
│       ├── simulate.py      # POST /api/simulate/
│       ├── reoptimize.py    # POST /api/reoptimize/
│       ├── reports.py       # GET  /api/reports/
│       └── data.py          # GET  /api/data/
│
├── frontend/
│   ├── app/                 # Next.js 14 App Router
│   │   ├── dashboard/       # Live network overview
│   │   ├── plan/            # Optimizer + lambda weight tuning
│   │   ├── simulate/        # Disruption injection
│   │   ├── reoptimize/      # Stateful recovery
│   │   ├── results/         # Reports and Sankey charts
│   │   └── research/        # Experiments and ablation
│   ├── components/
│   │   ├── layout/          # AppShell, StepProgress
│   │   └── ui/              # MetricCard, PageHeader, StatusBadge
│   └── lib/
│       ├── api.ts            # Typed fetch wrappers
│       ├── store.ts          # Zustand global state
│       └── types.ts          # Shared TypeScript types
│
└── src/                     # Core Python optimization engine
    ├── optimizer.py          # Multi-objective LP (SciPy HiGHS)
    ├── dynamic_optimizer.py  # Stateful re-optimizer
    ├── disruption.py         # Disruption event handlers
    ├── spoilage_model.py     # Arrhenius kinetics
    ├── models.py             # Domain dataclasses
    ├── simulation.py
    ├── experiments.py
    └── ...
```

---

## Mathematical Formulation

### Objective function

Minimize total supply-chain penalty $J$:

$$\min_{x \ge 0,\; u \ge 0} \; J = \lambda_{\text{spoilage}} \sum_{p \in \mathcal{P}} s_p x_p \;+\; \lambda_{\text{cost}} \sum_{p \in \mathcal{P}} c_p x_p \;+\; \lambda_{\text{unmet}} \sum_{m \in \mathcal{M}} \pi_m u_m \;+\; \lambda_{\text{risk}} \sum_{p \in \mathcal{P}} r_p x_p$$

| Symbol | Meaning |
| :--- | :--- |
| $x_p$ | Dispatch quantity (kg) along path $p = (\text{batch},\; \text{farm} \to \text{storage} \to \text{market})$ |
| $u_m$ | Unmet demand slack at market $m$ |
| $s_p \in [0,1]$ | Spoilage fraction (Arrhenius kinetics) |
| $c_p$ | Transport cost per kg (\$/kg) |
| $r_p \in [0,1]$ | Composite corridor and thermal risk |
| $\pi_m$ | Market priority weight |
| $\lambda_{1..4}$ | User-configurable penalty weights |

### Constraints

**1. Batch supply bound** — cannot ship more than available harvest:
$$\sum_{p \in \mathcal{P}(b)} x_p \;\le\; Q_b \qquad \forall b \in \mathcal{B}$$

**2. Storage capacity** — volume through hub $s$ cannot exceed operational capacity:
$$\sum_{p \;\text{via}\; s} x_p \;\le\; C_s \cdot \mathbb{I}[s\text{ available}] \qquad \forall s \in \mathcal{S}$$

**3. Demand fulfillment** — usable fresh produce plus slack equals market demand:
$$\sum_{p \to m} (1 - s_p)\, x_p \;+\; u_m = D_m \qquad \forall m \in \mathcal{M}$$

**4. Perishability cutoff** — routing is prohibited if transit time exceeds remaining shelf life:
$$x_p = 0 \qquad \text{if } t_p > \text{shelf\_life}_b$$

**5. Non-negativity:**
$$x_p \ge 0, \quad u_m \ge 0$$

### Spoilage kinetics

Spoilage fraction $s_p$ is derived from Arrhenius thermal acceleration:

$$\Delta T_{\text{excess}} = \max\!\left(0,\; \frac{T_{\text{ambient}} - T_{\text{ref}}}{T_{\text{ref}}}\right)$$

$$\text{Effective transit} = t_{\text{transit}} \cdot (1 + \beta \cdot \Delta T_{\text{excess}})$$

$$s_p = \begin{cases} 1.0 & \text{if effective transit} \ge \text{shelf\_life}_b \\[4pt] \left(\dfrac{\text{effective transit}}{\text{shelf\_life}_b}\right)^{1.8} & \text{otherwise} \end{cases}$$

Route risk uses a centered logit sigmoid:

$$\text{Risk}_p = \frac{1}{1 + \exp\!\left(-\!\left[\alpha\!\left(\frac{t_p}{\text{shelf\_life}_b} - 0.7\right) + \beta\,\Delta T_{\text{excess}} + \gamma\,\Delta t_{\text{delay}}\right]\right)}$$

---

## Benchmark Results

All figures are produced by `python -m src.experiments --scenarios 100` across seeds 1000–1100. No results are manually authored.

### Post-disruption comparison (100 Monte Carlo scenarios)

| Method | Spoilage % (mean ± std) | Spoilage (kg) | Demand fulfilled | Freight cost | Recovery time |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Nearest market (greedy) | 13.82% ± 3.41% | 2,840 kg | 86.18% | $4,812 | 0.3 ms |
| Cheapest route (LP) | 4.65% ± 1.82% | 1,024 kg | 95.35% | $3,618 | 7.8 ms |
| **Verdex DPSRO** | **1.84% ± 0.62%** | **413 kg** | **98.16%** | $3,892 | **5.1 ms** |

**85.5% less spoilage** than greedy. **60.3% less** than cheapest-route. Only **7.5% higher freight cost** to eliminate 610 kg of avoidable waste per scenario.

### Scalability (problem size vs. HiGHS solver time)

| Batches | Decision variables | Verdex | Cheapest route LP | Greedy |
| :---: | :---: | :---: | :---: | :---: |
| 10 | ~50 | 5.1 ms | 6.2 ms | 0.2 ms |
| 25 | ~125 | 9.8 ms | 5.4 ms | 0.4 ms |
| 50 | ~250 | 13.9 ms | 9.5 ms | 0.7 ms |
| 100 | ~700 | 29.5 ms | 24.9 ms | 2.0 ms |
| 250 | ~3,500 | 698.7 ms | 452.7 ms | 75.7 ms |
| 500 | ~9,000 | 1,623.5 ms | 1,352.2 ms | 541.1 ms |

At 500 batches and ~9,000 decision variables, the exact LP solves in under 1.7 seconds.

### Ablation (component contribution)

| Model variant | Spoilage % | Demand fulfilled | Freight cost | Recovery time |
| :--- | :---: | :---: | :---: | :---: |
| **Full Verdex** | **4.88%** | **88.64%** | **$7,295** | **5.4 ms** |
| No risk term ($\lambda_{\text{risk}}=0$) | 4.87% | 88.65% | $7,309 | 5.2 ms |
| Static restart (no state preservation) | 3.34% | 100.00% | $7,984 | 12.8 ms |
| Cost-only ($\lambda_{\text{spoil}}=\lambda_{\text{risk}}=0$) | 11.07% | 89.62% | $7,943 | 4.8 ms |

Removing spoilage from the objective spikes waste to 11.07%. Static restart achieves full demand fulfillment but at 2.4× the solver time and 9% higher freight cost due to unnecessary re-dispatch.

---

## Installation

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend

```bash
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

Open `http://localhost:3000`.

### Run tests

```bash
pytest tests/ -v
# 73 passed in ~3.3 s  (unit, constraints, disruptions, performance, validation, security)
```

### Run experiments

```bash
python -m src.experiments --scenarios 100
```

---

## Technical FAQ

**Why not Dijkstra or shortest path?**
Dijkstra minimizes a single scalar (distance) and ignores batch-level shelf lives, thermal protection, storage capacity, and downstream demand. Verdex solves a constrained multi-commodity network flow where all variables are coupled.

**Why not pure cost minimization?**
The ablation confirms it: removing the spoilage term pushes waste to 11.07% because low-cost routes are often slower or lack refrigeration, consuming shelf life before delivery.

**What solver is used?**
The **HiGHS** simplex / interior-point solver via `scipy.optimize.linprog(method='highs')`. It is an exact LP solver with no external binary dependencies and guaranteed global optimality.

**Is the data real?**
Network topology and volumes are generated from reproducible seeds. Spoilage kinetics and shelf-life parameters are calibrated to USDA Handbook No. 66 and FAO post-harvest benchmarks.

---

## Known Limitations & Future Work

| Limitation | Planned work |
| :--- | :--- |
| Deterministic transit times | Stochastic travel time distributions |
| Single-period optimization | Rolling-horizon predictive re-optimization |
| Simulated network data | Live MQTT ingestion from IoT cold-chain loggers and OBD-II telematics |
| Single depot per route | Multi-depot consolidation and cross-docking |
