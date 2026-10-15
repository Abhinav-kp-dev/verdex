# Verdex

**AI-powered perishable supply chain optimizer — adaptive re-routing, disruption simulation, dynamic markdown pricing, and AI-generated insights under real-world conditions.**

[![GitHub](https://img.shields.io/badge/GitHub-Abhinav--kp--dev%2Fverdex-0d1117?style=flat&logo=github)](https://github.com/Abhinav-kp-dev/verdex)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=nextdotjs)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.10+-3776ab?style=flat&logo=python)
![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-4285f4?style=flat&logo=google)
![Pages](https://img.shields.io/badge/Pages-10-10b981?style=flat)

---

## The Problem

The global food system loses **14–21% of perishable produce** before it ever reaches a retail shelf (FAO, 2019). Most of this waste does not happen at the farm or the market — it happens in transit, because supply chain plans are written once and never updated.

A static distribution plan looks like this:

> *"Farm F2 sends 2,000 kg of tomatoes to Storage S1 via Truck T3, which delivers to Market M2 by Thursday."*

That plan works under ideal conditions. But supply chains are not ideal. Trucks break down. Cold storage units lose power. Roads close after floods. Regional heatwaves compress shelf lives by 30% overnight. When any of these events hits, the static plan becomes useless — and produce that was hours away from delivery starts rotting on the side of a blocked road.

The industry response to disruptions is manual: dispatchers make phone calls, reroute trucks by instinct, and absorb the losses. For a regional distributor handling 50+ batches across dozens of routes, this process takes hours. Produce does not have hours.

---

## The Solution

Verdex treats the entire perishable supply chain as a **live, continuously solvable mathematical system** — not a static plan that gets updated once a day, but a dynamic model that responds to the real world in milliseconds.

### Optimal Allocation from the Start

Before a single truck moves, Verdex solves a **multi-objective linear program** across every batch, route, vehicle, storage facility, and market simultaneously. It balances four competing priorities — spoilage risk, delivery cost, demand fulfillment, and route safety — using configurable λ weights so operators can tune the system to their priorities. The result is not a heuristic or an approximation. It is the mathematically provable optimal allocation given the constraints.

Every constraint the real world imposes is encoded: shelf life per batch, vehicle capacity, cold storage availability, minimum shelf life on arrival at each destination, per-commodity demand caps, and route-level travel time. Nothing is assumed. Nothing is guessed.

### Disruption Recovery in Under 10ms

When something breaks — a vehicle fails, a cold storage loses power, a road closes after a flood, a regional heatwave cuts shelf lives overnight — Verdex does not start from scratch. It:

1. **Freezes** in-flight shipments that are already viable and in motion.
2. **Ages** remaining inventory by the disruption duration, recalculating spoilage risk in real time.
3. **Runs a residual LP** on only the stranded batches, finding new routes that respect remaining shelf lives, available capacity, and unmet demand.

The recovery plan is ready in under 10 milliseconds. A human dispatcher making the same calls would take hours — and likely still produce a worse result.

### Spoilage-Aware Dynamic Markdown Pricing

Not every batch can be re-routed in time. For batches approaching expiry, Verdex runs a **price elasticity engine** (ε = −1.2) that models two scenarios: a fixed emergency discount and a demand-adjusted markdown that maximizes recovered revenue. Operators see exactly how much volume they can save, at what price, and what the financial outcome is before they commit — turning what would have been a total loss into partial recovery.

### Carbon-Aware Routing

Every allocation carries a carbon cost. Verdex calculates **CO₂ emissions per route** based on distance, load weight, and vehicle type — distinguishing between refrigerated cold-chain routes and direct ambient delivery. Operators can compare the carbon footprint of the optimized plan against alternatives, and the system surfaces green routing recommendations where spoilage risk allows a lower-emission path.

### AI-Powered Decision Support

An embedded **Gemini 2.5 Flash** assistant has full visibility into the current supply chain state — batches, allocations, disruptions, re-optimization results. It can explain why a specific batch was routed a certain way, what the risk of a proposed change is, or what the highest-impact intervention would be at any point in the workflow. Every page also generates a structured AI report that can be exported as a PDF for stakeholder review.

### The Impact

For logistics managers, this replaces hours of manual calls and spreadsheet guesswork with a single optimized decision in seconds. For farmers and distributors, it means more produce reaches markets before it spoils — directly protecting revenue. For food banks and wholesale hubs, it means reliable, timely stock with accurate shelf-life data on arrival. And for the environment, it means fewer vehicles making unnecessary trips and a measurable reduction in the carbon cost of getting food to people.

India alone loses an estimated **₹92,000 crore** worth of food every year in post-harvest waste. That is not an agricultural problem. It is a logistics problem. And Verdex solves it.

---

## Platform Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Verdex Platform                                       │
│                                                                                         │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────┐   │
│  │  Dashboard  │  │ Produce Inventory│  │ Destinations &    │  │  Plan Delivery   │   │
│  │             │  │                  │  │ Demand            │  │                  │   │
│  │ Live network│  │ Batch table with │  │ Hub cards —       │  │ Run LP optimizer │   │
│  │ Leaflet map │  │ shelf-life bars  │  │ wholesale, cold   │  │ Tune λ weights   │   │
│  │ Weather     │  │ Grade, cost, lock│  │ hub, food bank    │  │ Sankey preview   │   │
│  │ overlay     │  │ Register/edit/   │  │ Per-commodity     │  │                  │   │
│  │             │  │ delete + filters │  │ demand + pricing  │  │                  │   │
│  └─────────────┘  └──────────────────┘  └───────────────────┘  └──────────────────┘   │
│                                                                                         │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Simulate   │  │   Re-Optimize    │  │   Results &  │  │  Dynamic Markdowns   │   │
│  │  Disruption  │  │                  │  │   Reports    │  │                      │   │
│  │              │  │ Stateful residual│  │              │  │ Per-batch markdown   │   │
│  │ 5 disruption │  │ flow re-routing  │  │ Sankey chart │  │ rules (<48h / <96h) │   │
│  │ scenarios    │  │ < 10 ms recovery │  │ AI Report    │  │ Fixed vs elastic     │   │
│  │ Live impact  │  │ Before/after KPIs│  │ PDF Export   │  │ demand (ε = −1.2)   │   │
│  └──────────────┘  └──────────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                                         │
│  ┌──────────────────────┐  ┌──────────────────────────────────────────────────────┐    │
│  │   Carbon Emissions   │  │               AI Chatbot (Gemini 2.5 Flash)          │    │
│  │ CO₂ per route        │  │  Context-aware Q&A · floating on all pages           │    │
│  │ Green recommendations│  │  Full supply chain state injected as system prompt   │    │
│  └──────────────────────┘  └──────────────────────────────────────────────────────┘    │
│                                                                                         │
│  Frontend: Next.js 14 · Tailwind CSS · Plotly.js · Leaflet · Zustand                   │
│  Backend:  FastAPI · SciPy HiGHS LP solver · Pydantic v2                               │
│  AI:       Gemini 2.5 Flash · jsPDF + html2canvas for PDF export                       │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## End-to-End Workflow

```
 User Opens Dashboard
        │
        ▼
 ┌─────────────────────────────────────────────────────────┐
 │  1. DASHBOARD                                           │
 │  GET /api/state → load farms, storage, markets,         │
 │  batches, routes, trucks                                │
 │  Live weather overlay via external API                  │
 │  Interactive Leaflet map — nodes & route lines          │
 └────────────────────────────┬────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
 ┌────────────────────┐ ┌────────────────────┐ ┌──────────────────────────┐
 │ 2. PRODUCE         │ │ 3. DESTINATIONS &  │ │  4. DYNAMIC MARKDOWNS    │
 │    INVENTORY       │ │    DEMAND          │ │                          │
 │                    │ │                    │ │  Per-batch markdown rules │
 │ Batch table with   │ │ Hub cards —        │ │  <48h → Critical (25%)   │
 │ shelf-life bars,   │ │ wholesale, cold    │ │  <96h → Proactive (15%)  │
 │ grade, cost, lock  │ │ hub, food bank     │ │  Fixed demand vs elastic  │
 │ Register/edit/     │ │ Per-commodity      │ │  ε = −1.2 scenarios      │
 │ delete, search,    │ │ demand + pricing   │ │  Apply → syncs with      │
 │ filter, sort       │ │ Register/edit/     │ │  optimizer               │
 │ Allocated batches  │ │ delete + search    │ │                          │
 │ locked from edit   │ │                    │ │                          │
 └────────────────────┘ └────────────────────┘ └──────────────────────────┘
              │
              ▼
 ┌─────────────────────────────────────────────────────────┐
 │  5. PLAN DELIVERY                                       │
 │  Configure λ weights (spoilage, cost, demand, risk)     │
 │  POST /api/optimize/ → SciPy HiGHS LP solver            │
 │  Returns: allocations, spoilage %, CO₂, cost, score J  │
 │  Zustand stores result for downstream pages             │
 └────────────────────────────┬────────────────────────────┘
                              │
                 ┌────────────┴────────────┐
                 ▼                         ▼
 ┌───────────────────────────┐  ┌──────────────────────────┐
 │  6. SIMULATE DISRUPTION   │  │  8. RESULTS & REPORTS    │
 │  Select disruption type   │  │  Sankey allocation chart │
 │  + target asset           │  │  Attempt log             │
 │  POST /api/simulate/      │  │  AI Report tab (Gemini)  │
 │  Scenario-specific impact │  │   → Generate report      │
 │  panel shown per type     │  │   → Download as PDF      │
 └─────────────┬─────────────┘  └──────────────────────────┘
               │
               ▼
 ┌─────────────────────────────────────────────────────────┐
 │  7. RE-OPTIMIZE                                         │
 │  POST /api/reoptimize/ with disrupted state             │
 │  Frozen in-flight shipments preserved                   │
 │  LP solves only stranded batches                        │
 │  Before/after comparison shown                          │
 └─────────────────────────────────────────────────────────┘
               │
               ▼
 ┌─────────────────────────────────────────────────────────┐
 │  9. CARBON EMISSIONS                                    │
 │  Per-route CO₂ breakdown (refrigerated vs direct)      │
 │  Green route vs express route emissions comparison      │
 │  Carbon reduction suggestions                           │
 └─────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────┐
  │  AI CHATBOT (Floating, all pages)                    │
  │  Gemini 2.5 Flash with full supply chain context     │
  │  Asks about routes, spoilage, re-routing strategies  │
  └──────────────────────────────────────────────────────┘
```

---

## System Architecture

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                     Browser (Next.js 14)                │
                    │                                                         │
                    │  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐  │
                    │  │ Dashboard  │ │   Plan   │ │Simulate  │ │Results  │  │
                    │  │  /dashboard│ │  /plan   │ │/simulate │ │/results │  │
                    │  └─────┬──────┘ └────┬─────┘ └────┬─────┘ └────┬────┘  │
                    │        │             │             │            │        │
                    │        └─────────────┴──────┬──────┴────────────┘        │
                    │                             │                            │
                    │                    ┌────────▼────────┐                  │
                    │                    │  Zustand Store  │                  │
                    │                    │  (global state) │                  │
                    │                    └────────┬────────┘                  │
                    │                             │                            │
                    │              ┌──────────────┴──────────────┐            │
                    │              │       Next.js API Routes     │            │
                    │              │  /api/chat  /api/report      │            │
                    │              └──────────────┬──────────────┘            │
                    └─────────────────────────────┼───────────────────────────┘
                                                  │
                             ┌────────────────────┼────────────────────┐
                             │                    │                    │
                             ▼                    ▼                    ▼
               ┌─────────────────────┐  ┌──────────────────┐  ┌───────────────┐
               │   FastAPI Backend   │  │  Gemini 2.5 Flash│  │  Weather API  │
               │   (port 8000)       │  │  (via /api/chat  │  │  (live temp   │
               │                     │  │   /api/report)   │  │   overlay)    │
               │  /api/state         │  └──────────────────┘  └───────────────┘
               │  /api/optimize/     │
               │  /api/simulate/     │
               │  /api/reoptimize/   │
               │  /api/reports/      │
               └──────────┬──────────┘
                          │
               ┌──────────▼──────────┐
               │   Python Core (src/)│
               │                     │
               │  optimizer.py       │
               │  (SciPy HiGHS LP)   │
               │                     │
               │  dynamic_optimizer  │
               │  (stateful residual)│
               │                     │
               │  disruption.py      │
               │  (5 event classes)  │
               │                     │
               │  spoilage_model.py  │
               │  (Arrhenius kinetics│
               └─────────────────────┘
```

---

## Disruption Engine — All 5 Scenarios

```
  SELECT DISRUPTION TYPE
         │
         ├─── truck_breakdown ──────► TruckFailureDisruption(truck_id)
         │                              marks truck unavailable
         │                              closes all routes using that truck
         │                              Frontend: shows offline trucks + blocked routes
         │
         ├─── cold_storage_failure ─► StorageOutageDisruption(storage_id)
         │                              marks storage offline
         │                              cascade-closes routes through that hub
         │                              Frontend: shows capacity lost + closed routes
         │
         ├─── demand_shock ─────────► DemandShockDisruption(market_id, ×2.5)
         │                              multiplies target market demand by 2.5×
         │                              Frontend: side-by-side demand comparison per market
         │
         ├─── heatwave ─────────────► TemperatureShockDisruption(Δ+12°C)
         │                              raises ambient temp on all batches and routes
         │                              accelerates spoilage via Arrhenius factor
         │                              Frontend: batch temp table + route risk table
         │
         └─── road_closure ─────────► RouteClosureDisruption(route_id)
                                        marks specific route unavailable
                                        Frontend: detailed route card with metrics
```

---

## AI Features

### Gemini 2.5 Flash Report Generation

After running the optimizer, the Results page generates a full supply chain report via Gemini 2.5 Flash:

```
  User clicks "Generate AI Report"
         │
         ▼
  POST /api/report
         │
         │  Context sent to Gemini:
         │  ├─ Farm availability & harvest quantities
         │  ├─ Cold storage load & capacity
         │  ├─ Market demand & priority weights
         │  ├─ All route metrics (distance, CO₂, risk factor)
         │  ├─ Optimizer results (spoilage %, cost, CO₂, score J)
         │  ├─ Batch allocations (top 10)
         │  └─ Live weather (temperature, heat risk flags)
         │
         ▼
  Gemini returns structured JSON:
  ├─ executive_summary
  ├─ kpi_highlights (color-coded: good / warning / critical)
  ├─ best_routes (green "Optimal" badges)
  ├─ worst_routes (red "Risk" badges)
  ├─ spoilage_analysis + reduction_strategies (HIGH/MEDIUM/LOW)
  ├─ carbon_insights + green_recommendations
  ├─ cost_analysis + optimization_opportunities
  ├─ weather_impact
  └─ action_items (Immediate / Short-term / Long-term)
         │
         ▼
  Rendered in browser → "Download PDF" button
         │
         ▼
  html2canvas captures rendered DOM → jsPDF multi-page A4 export
```

Report sections are color-coded: green = performing well, amber = needs attention, red = critical risk.

### AI Chatbot

A floating chat assistant (bottom-right on every page) powered by Gemini 2.5 Flash with full supply chain context injected as a system instruction. It can answer questions about current routes, spoilage causes, re-routing strategies, and disruption impacts.

---

## Project Structure

```
verdex/
├── backend/
│   ├── main.py                  # FastAPI app, CORS, router mounts
│   ├── schemas.py               # Pydantic v2 I/O schemas
│   └── routers/
│       ├── state.py             # GET  /api/state
│       ├── optimize.py          # POST /api/optimize/
│       ├── simulate.py          # POST /api/simulate/
│       ├── reoptimize.py        # POST /api/reoptimize/
│       ├── reports.py           # GET  /api/reports/
│       └── data.py              # GET  /api/data/
│
├── frontend/
│   ├── app/                     # Next.js 14 App Router
│   │   ├── dashboard/           # Live network overview, Leaflet map, weather
│   │   ├── inventory/           # Produce batch table, register/edit/delete, filters
│   │   ├── destinations/        # Hub cards, per-commodity demand, register/edit/delete
│   │   ├── plan/                # Optimizer + λ weight tuning + Sankey preview
│   │   ├── simulate/            # Disruption injection, 5 scenario panels
│   │   ├── reoptimize/          # Stateful recovery + before/after comparison
│   │   ├── results/             # Sankey chart, AI Report tab, attempt log
│   │   ├── carbon/              # CO₂ emissions breakdown per route
│   │   ├── markdown/            # Dynamic markdown pricing, elasticity scenarios
│   │   ├── research/            # Experiments and ablation
│   │   └── api/
│   │       ├── chat/route.ts    # Gemini chatbot proxy (server-side)
│   │       └── report/route.ts  # Gemini report generator (server-side)
│   ├── components/
│   │   ├── layout/              # AppShell, StepProgress, sidebar nav (10 items)
│   │   └── ui/                  # MetricCard, PageHeader, StatusBadge, ChatBot
│   └── lib/
│       ├── api.ts               # Typed fetch wrappers for FastAPI
│       ├── store.ts             # Zustand global state + markdownConfig
│       └── types.ts             # Shared TypeScript types
│
└── src/                         # Core Python optimization engine
    ├── optimizer.py             # Multi-objective LP (SciPy HiGHS)
    ├── dynamic_optimizer.py     # Stateful re-optimizer (residual flow)
    ├── disruption.py            # 5 disruption event classes
    ├── spoilage_model.py        # Arrhenius thermal kinetics
    ├── models.py                # Domain dataclasses (Farm, Route, Batch, etc.)
    ├── simulation.py
    └── experiments.py           # 100-scenario Monte Carlo benchmarks
```

---

## Mathematical Formulation

### Objective Function

Minimize total supply-chain penalty $J$:

$$\min_{x \ge 0,\; u \ge 0} \; J = \lambda_{\text{spoilage}} \sum_{p \in \mathcal{P}} s_p x_p \;+\; \lambda_{\text{cost}} \sum_{p \in \mathcal{P}} c_p x_p \;+\; \lambda_{\text{unmet}} \sum_{m \in \mathcal{M}} \pi_m u_m \;+\; \lambda_{\text{risk}} \sum_{p \in \mathcal{P}} r_p x_p$$

| Symbol | Meaning |
| :--- | :--- |
| $x_p$ | Dispatch quantity (kg) along path $p = (\text{batch},\; \text{farm} \to \text{storage} \to \text{market})$ |
| $u_m$ | Unmet demand slack at market $m$ |
| $s_p \in [0,1]$ | Spoilage fraction (Arrhenius kinetics) |
| $c_p$ | Transport cost per kg ($/kg) |
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

### Spoilage Kinetics

Spoilage fraction $s_p$ is derived from Arrhenius thermal acceleration:

$$\Delta T_{\text{excess}} = \max\!\left(0,\; \frac{T_{\text{ambient}} - T_{\text{ref}}}{T_{\text{ref}}}\right)$$

$$\text{Effective transit} = t_{\text{transit}} \cdot (1 + \beta \cdot \Delta T_{\text{excess}})$$

$$s_p = \begin{cases} 1.0 & \text{if effective transit} \ge \text{shelf\_life}_b \\[4pt] \left(\dfrac{\text{effective transit}}{\text{shelf\_life}_b}\right)^{1.8} & \text{otherwise} \end{cases}$$

Route risk uses a centered logit sigmoid:

$$\text{Risk}_p = \frac{1}{1 + \exp\!\left(-\!\left[\alpha\!\left(\frac{t_p}{\text{shelf\_life}_b} - 0.7\right) + \beta\,\Delta T_{\text{excess}} + \gamma\,\Delta t_{\text{delay}}\right]\right)}$$

---

## Produce Inventory

The `/inventory` page provides full lifecycle management for produce batches.

### Batch Table Columns

| Column | Description |
| :--- | :--- |
| Batch ID | Unique identifier; 🔒 lock icon when allocated to an optimizer run |
| Commodity | Derived from farm origin (Tomatoes / Onions / Green Chillies / etc.) |
| Category | Vegetables, Fruits, Spices, Grains, Dairy |
| Available / Total | Quantity in kg |
| Shelf Life | Color-coded progress bar: green → amber → orange → red as hours deplete |
| Arrival Date | Calculated from harvest time |
| Handling Time | Hours required at receiving dock |
| Storage °C | Required cold-chain temperature |
| Grade | A / B / C badge |
| ₹/kg | Cost per kg |
| Status | Fresh / At Risk / Low Shelf Life / Critical |

### Status Rules

| Remaining Shelf Life | Status |
| :--- | :--- |
| > 96 h | **Fresh** (green) |
| 48 – 96 h | **At Risk** (amber) |
| 24 – 48 h | **Low Shelf Life** (orange) |
| < 24 h | **Critical** (red) |

### Allocated Stock Lock

Batches that appear in the latest optimizer result (`/api/optimize/`) are automatically marked as allocated. Allocated batches:
- Display a 🔒 icon in the table
- Have Edit and Delete buttons hidden
- Cannot be double-dispatched to another route

### Register / Edit / Delete

The "Register New Produce Batch" form validates 12 fields: commodity, category, farm/origin, quantity, initial shelf life, remaining shelf life, arrival date, handling time, storage temperature, batch temperature, grade, and cost per kg. Custom batches are persisted in `localStorage` and merged with live state data.

---

## Destinations & Demand

The `/destinations` page manages delivery hubs with per-commodity demand requirements.

### Hub Types

| Type | Icon | Description |
| :--- | :---: | :--- |
| Wholesale Terminal | 🏪 | High-volume APMC-style market, early dock deadline |
| Cold Hub | 🧊 | Refrigerated distribution centre, strict shelf-life minimums |
| Food Bank | 🤝 | Community distribution, flexible timing, lower price point |

### Hub Card Metrics

Each card shows: **distance** (km), **transit time** (h), **transport rate** (₹/km), **vehicle capacity** (kg), **dock deadline** (HH:MM), **dock handling time** (h), **total demand** (kg), **priority multiplier**, and a named **contact person with phone**.

### Per-Commodity Demand

Expand any hub card to see the commodity-level demand table:

| Column | Description |
| :--- | :--- |
| Commodity | Produce type accepted by this hub |
| Price/kg | Buying price offered (₹) |
| Min Shelf Life on Arrival | Minimum remaining shelf life (hours) the hub will accept |

This minimum shelf life requirement feeds directly into the optimizer's perishability cutoff constraint — routes where transit time would leave less than the required shelf life are automatically excluded.

### Register Destination Market Form

Three sections: **Hub Information** (name, type, contact, priority), **Logistics** (distance, travel time, transport rate, vehicle capacity, dock time, dock deadline, demand), and **Per-Commodity Demand** (dynamic rows — add/remove commodities with price and minimum shelf life). Custom destinations persist in `localStorage`.

---

## Dynamic Markdowns & Spoilage Prevention

The `/markdown` page generates per-batch markdown recommendations to salvage at-risk inventory before it expires.

### Markdown Rules

| Remaining Shelf Life | Tier | Discount |
| :--- | :--- | :--- |
| < 48 h | **Critical** | 25% off |
| 48 – 96 h | **Proactive** | 15% off |
| > 96 h | Healthy | No action needed |

### Two Scenarios Per Batch

For each at-risk batch, the page computes three columns side by side:

**No Markdown (baseline)** — sell-through and revenue at full price, with full waste.

**Scenario A — Fixed Demand** — markdown applied but demand unchanged. Revenue decreases proportionally; waste stays the same as baseline. Shows the pessimistic case.

**Scenario B — Demand-Responsive (ε = −1.2)** — uses price elasticity of demand:

```
% demand increase = |ε| × discount rate
25% off  →  30% more demand
15% off  →  18% more demand
```

Each scenario shows: sell-through %, revenue, waste (kg), waste avoided (kg), and net salvage value.

### ROI Insight Bar

Every batch card includes an automatically generated insight line explaining the net salvage difference, e.g.:

> *"Proactive batch: a 15% markdown boosts demand by 18% (ε = −1.2). Net revenue increases by ₹4,200 while preventing 69 kg of spoilage."*

### Apply Markdown

Clicking **Apply Markdown** on a scenario:
- Saves the choice (`batchId → { discount, scenario }`) to the Zustand `markdownConfig` store
- Persists across page navigation
- Shows a sync banner linking back to Plan Delivery — re-running the optimizer reflects the demand-boost signal from applied markdowns
- A "Clear all markdowns" button resets the config

### Summary Cards

| Card | Description |
| :--- | :--- |
| At-Risk Volume | Total kg across all batches needing markdown |
| Projected Waste (no action) | Waste if no markdowns are applied |
| Waste Prevented (elastic) | Waste saved if all Scenario B markdowns are applied |
| Markdowns Applied | Count of batches with active markdown config |

---

## API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/state` | Load initial supply chain state (farms, routes, trucks, batches, markets, storage) |
| `POST` | `/api/optimize/` | Run multi-objective LP optimizer with user-supplied λ weights |
| `POST` | `/api/simulate/` | Apply a disruption event to the current state |
| `POST` | `/api/reoptimize/` | Run stateful residual re-optimizer on a disrupted state |
| `GET` | `/api/reports/` | Fetch stored optimization attempt history |
| `GET` | `/api/data/` | Raw data endpoints for experiments |
| `POST` | `/api/chat` | Gemini chatbot proxy — server-side, injects full state as system prompt |
| `POST` | `/api/report` | Gemini report generator — returns structured JSON report with 10 sections |

> **Inventory & Destinations** data is managed client-side (Zustand + `localStorage`) and does not require new backend endpoints. The optimizer reads batch and market data from `/api/state`; custom registered entries augment the live data in the frontend only.

### POST /api/optimize/ payload example

```json
{
  "state": { "farms": {}, "routes": {}, "trucks": {}, "storage_facilities": {}, "markets": {}, "batches": {} },
  "lambda_spoilage": 10,
  "lambda_cost": 0.15,
  "lambda_unmet": 15,
  "lambda_risk": 5
}
```

### POST /api/simulate/ payload example

```json
{
  "state": { "..." },
  "disruption_type": "truck_breakdown",
  "target_id": "T1"
}
```

Supported `disruption_type` values: `truck_breakdown`, `cold_storage_failure`, `demand_shock`, `heatwave`, `road_closure`.

---

## Benchmark Results

All figures are produced by `python -m src.experiments --scenarios 100` across seeds 1000–1100. No results are manually authored.

### Post-Disruption Comparison (100 Monte Carlo Scenarios)

| Method | Spoilage % (mean ± std) | Spoilage (kg) | Demand Fulfilled | Freight Cost | Recovery Time |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Nearest market (greedy) | 13.82% ± 3.41% | 2,840 kg | 86.18% | $4,812 | 0.3 ms |
| Cheapest route (LP) | 4.65% ± 1.82% | 1,024 kg | 95.35% | $3,618 | 7.8 ms |
| **Verdex DPSRO** | **1.84% ± 0.62%** | **413 kg** | **98.16%** | $3,892 | **5.1 ms** |

**85.5% less spoilage** than greedy. **60.3% less** than cheapest-route. Only **7.5% higher freight cost** to eliminate 610 kg of avoidable waste per scenario.

### Scalability (Problem Size vs. HiGHS Solver Time)

| Batches | Decision Variables | Verdex | Cheapest Route LP | Greedy |
| :---: | :---: | :---: | :---: | :---: |
| 10 | ~50 | 5.1 ms | 6.2 ms | 0.2 ms |
| 25 | ~125 | 9.8 ms | 5.4 ms | 0.4 ms |
| 50 | ~250 | 13.9 ms | 9.5 ms | 0.7 ms |
| 100 | ~700 | 29.5 ms | 24.9 ms | 2.0 ms |
| 250 | ~3,500 | 698.7 ms | 452.7 ms | 75.7 ms |
| 500 | ~9,000 | 1,623.5 ms | 1,352.2 ms | 541.1 ms |

At 500 batches and ~9,000 decision variables, the exact LP solves in under 1.7 seconds.

### Ablation (Component Contribution)

| Model Variant | Spoilage % | Demand Fulfilled | Freight Cost | Recovery Time |
| :--- | :---: | :---: | :---: | :---: |
| **Full Verdex** | **4.88%** | **88.64%** | **$7,295** | **5.4 ms** |
| No risk term ($\lambda_{\text{risk}}=0$) | 4.87% | 88.65% | $7,309 | 5.2 ms |
| Static restart (no state preservation) | 3.34% | 100.00% | $7,984 | 12.8 ms |
| Cost-only ($\lambda_{\text{spoil}}=\lambda_{\text{risk}}=0$) | 11.07% | 89.62% | $7,943 | 4.8 ms |

Removing spoilage from the objective spikes waste to 11.07%. Static restart achieves full demand fulfillment but at 2.4× the solver time and 9% higher freight cost due to unnecessary re-dispatch.

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

## Installation

### Prerequisites
- Python 3.10+
- Node.js 18+
- A Gemini API key (for chatbot and AI report features)

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
```

Create `frontend/.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

> **Important:** Never prefix this with `NEXT_PUBLIC_` — it must remain server-side only and is only accessed via the `/api/chat` and `/api/report` Next.js route handlers.

```bash
npm run dev
```

Open `http://localhost:3000`.

### Run Tests

```bash
pytest tests/ -v
# 73 passed in ~3.3 s  (unit, constraints, disruptions, performance, validation, security)
```

### Run Experiments

```bash
python -m src.experiments --scenarios 100
```

---

## Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| Frontend framework | Next.js 14 (App Router) | Server components, API routes, file-based routing |
| Styling | Tailwind CSS | Dark-theme UI with CSS variable theming |
| State management | Zustand | Cross-page supply chain state + markdownConfig |
| Local persistence | localStorage | Custom batches, destinations, markdown configs |
| Charts | Plotly.js | Sankey allocation diagram, line charts |
| Map | Leaflet + react-leaflet | Interactive supply chain network map |
| AI — chatbot | Gemini 2.5 Flash | Context-aware supply chain Q&A (floating, all pages) |
| AI — reports | Gemini 2.5 Flash | Structured JSON report with 10 sections |
| PDF export | jsPDF + html2canvas | Multi-page A4 PDF from rendered DOM |
| Backend framework | FastAPI | REST API, Pydantic v2 validation, CORS |
| LP solver | SciPy HiGHS | Exact multi-objective linear programming |
| Spoilage model | Custom Python | Arrhenius thermal kinetics |
| Markdown engine | Custom TypeScript | Price elasticity (ε = −1.2), shelf-life rules |
| Testing | pytest | 73 tests across unit, integration, performance |

---

## Technical FAQ

**Why not Dijkstra or shortest path?**
Dijkstra minimizes a single scalar (distance) and ignores batch-level shelf lives, thermal protection, storage capacity, and downstream demand. Verdex solves a constrained multi-commodity network flow where all variables are coupled.

**Why not pure cost minimization?**
The ablation confirms it: removing the spoilage term pushes waste to 11.07% because low-cost routes are often slower or lack refrigeration, consuming shelf life before delivery.

**What solver is used?**
The **HiGHS** simplex / interior-point solver via `scipy.optimize.linprog(method='highs')`. It is an exact LP solver with no external binary dependencies and guaranteed global optimality.

**Why does the re-optimizer not restart from scratch?**
In-flight shipments that are already en route and viable represent locked commitments. Cancelling them wastes operational resources and shelf life. The stateful re-optimizer freezes those allocations and only re-solves for the stranded residual, reducing both solver time and operational disruption.

**How does the Gemini API report work?**
The `/api/report` Next.js route handler (server-side) builds a structured prompt from the current Zustand state — farm volumes, route metrics, optimizer results, and live weather — and sends it to Gemini 2.5 Flash. Gemini returns a structured JSON object which is rendered in the browser and can be exported as a PDF.

**Is the data real?**
Network topology and volumes are generated from reproducible seeds. Spoilage kinetics and shelf-life parameters are calibrated to USDA Handbook No. 66 and FAO post-harvest benchmarks.

---

## Known Limitations & Future Work

| Limitation | Planned Work |
| :--- | :--- |
| Deterministic transit times | Stochastic travel time distributions |
| Single-period optimization | Rolling-horizon predictive re-optimization |
| Simulated network data | Live MQTT ingestion from IoT cold-chain loggers and OBD-II telematics |
| Single depot per route | Multi-depot consolidation and cross-docking |
| Gemini report regenerated on each click | Cache report in Zustand; invalidate on new optimizer run |
| PDF export captures rendered pixels | Native PDF generation with vector text for smaller file size |
| Inventory & destinations stored in localStorage | Sync to backend database for multi-user and persistence across devices |
| Markdown config not fed directly into LP | Modify market demand in optimizer payload based on applied elasticity boosts |
| Min shelf life per commodity not enforced in optimizer | Wire destination min-shelf-life requirements into the perishability cutoff constraint |
