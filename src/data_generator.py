"""Synthetic Supply-Chain Network and Batch Data Generator.

Uses real Indian city coordinates for a geographically accurate network.
Farms in agricultural belts, cold storage hubs at logistics centres,
markets at major urban consumption centres.
"""

import math
import random
from typing import Dict, List, Tuple, Optional
from src.models import (
    Farm,
    Batch,
    StorageFacility,
    Market,
    TransportRoute,
    Truck,
    SupplyChainState,
)


COMMODITY_PROFILES = {
    "Berries":      {"shelf_life_min": 24.0,  "shelf_life_max": 48.0,  "ideal_temp": 2.0},
    "Leafy Greens": {"shelf_life_min": 36.0,  "shelf_life_max": 72.0,  "ideal_temp": 4.0},
    "Tomatoes":     {"shelf_life_min": 72.0,  "shelf_life_max": 144.0, "ideal_temp": 12.0},
    "Peaches":      {"shelf_life_min": 48.0,  "shelf_life_max": 96.0,  "ideal_temp": 4.0},
    "Apples":       {"shelf_life_min": 168.0, "shelf_life_max": 336.0, "ideal_temp": 4.0},
}

# Fixed Indian city coordinates: (lat, lon, city_name, state)
FARM_NODES = [
    (20.0059, 73.7898, "Nashik",  "Maharashtra"),   # grapes, onions, leafy greens
    (13.1357, 78.1294, "Kolar",   "Karnataka"),      # tomatoes, berries
    (16.3067, 80.4365, "Guntur",  "Andhra Pradesh"), # chillies, leafy greens
]

STORAGE_NODES = [
    (18.5204, 73.8567, "Pune",      "Maharashtra"),  # hub between Nashik and Mumbai
    (12.9716, 77.5946, "Bengaluru", "Karnataka"),    # hub between Kolar and Chennai
]

MARKET_NODES = [
    (19.0760, 72.8777, "Mumbai",    "Maharashtra"),
    (13.0827, 80.2707, "Chennai",   "Tamil Nadu"),
    (17.3850, 78.4867, "Hyderabad", "Telangana"),
]

# CO2 emission factors (kg per km)
CO2_REFRIGERATED = 0.9   # cold-chain refrigerated truck
CO2_AMBIENT      = 0.35  # ambient / express van (direct routes)


def haversine_km(loc1: Tuple[float, float], loc2: Tuple[float, float]) -> float:
    """Great-circle distance in km between two (lat, lon) points."""
    R = 6371.0
    lat1, lon1 = math.radians(loc1[0]), math.radians(loc1[1])
    lat2, lon2 = math.radians(loc2[0]), math.radians(loc2[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def road_km(loc1: Tuple[float, float], loc2: Tuple[float, float]) -> float:
    """Approximate road distance: haversine × 1.3 (Indian highway winding factor)."""
    return haversine_km(loc1, loc2) * 1.3


def generate_supply_chain(
    num_farms: int = 3,
    num_storage: int = 2,
    num_markets: int = 3,
    num_batches: int = 10,
    num_trucks: int = 5,
    seed: int = 42,
    area_size_km: float = 300.0,   # unused — kept for API compatibility
    avg_speed_kmh: float = 55.0,
) -> SupplyChainState:
    """Generates a supply chain network using real Indian city coordinates.

    Farms  : agricultural belts (Nashik, Kolar, Guntur)
    Storage: logistics hubs    (Pune, Bengaluru)
    Markets: urban centres     (Mumbai, Chennai, Hyderabad)
    """
    rng = random.Random(seed)

    # ── 1. Farms ──────────────────────────────────────────────────────────────
    farms: Dict[str, Farm] = {}
    for i in range(min(num_farms, len(FARM_NODES))):
        fid = f"F{i + 1}"
        lat, lon, city, state = FARM_NODES[i]
        farms[fid] = Farm(
            farm_id=fid,
            location=(lat, lon),
            available_quantity=0.0,
            harvest_time=0.0,
        )
    # Extra farms beyond the fixed list get random offsets around known agricultural zones
    for i in range(len(FARM_NODES), num_farms):
        fid = f"F{i + 1}"
        base = FARM_NODES[i % len(FARM_NODES)]
        lat = base[0] + rng.uniform(-1.5, 1.5)
        lon = base[1] + rng.uniform(-1.5, 1.5)
        farms[fid] = Farm(farm_id=fid, location=(lat, lon), available_quantity=0.0, harvest_time=0.0)

    # ── 2. Storage Facilities ─────────────────────────────────────────────────
    storages: Dict[str, StorageFacility] = {}
    for j in range(min(num_storage, len(STORAGE_NODES))):
        sid = f"S{j + 1}"
        lat, lon, city, state = STORAGE_NODES[j]
        storages[sid] = StorageFacility(
            storage_id=sid,
            location=(lat, lon),
            capacity=round(rng.uniform(8000.0, 20000.0), -2),
            current_load=0.0,
            temperature_capacity=4.0,
            available=True,
        )
    for j in range(len(STORAGE_NODES), num_storage):
        sid = f"S{j + 1}"
        base = STORAGE_NODES[j % len(STORAGE_NODES)]
        lat = base[0] + rng.uniform(-1.0, 1.0)
        lon = base[1] + rng.uniform(-1.0, 1.0)
        storages[sid] = StorageFacility(
            storage_id=sid, location=(lat, lon),
            capacity=round(rng.uniform(8000.0, 20000.0), -2),
            current_load=0.0, temperature_capacity=4.0, available=True,
        )

    # ── 3. Markets ────────────────────────────────────────────────────────────
    markets: Dict[str, Market] = {}
    total_est_supply = num_batches * 1200.0
    demand_per_market = round(total_est_supply / max(1, num_markets), -1)

    for k in range(min(num_markets, len(MARKET_NODES))):
        mid = f"M{k + 1}"
        lat, lon, city, state = MARKET_NODES[k]
        m_demand = max(500.0, round(rng.uniform(0.7, 1.3) * demand_per_market, -1))
        markets[mid] = Market(
            market_id=mid,
            location=(lat, lon),
            demand=m_demand,
            priority=round(rng.choice([1.0, 1.2, 1.5]), 1),
        )
    for k in range(len(MARKET_NODES), num_markets):
        mid = f"M{k + 1}"
        base = MARKET_NODES[k % len(MARKET_NODES)]
        lat = base[0] + rng.uniform(-1.0, 1.0)
        lon = base[1] + rng.uniform(-1.0, 1.0)
        m_demand = max(500.0, round(rng.uniform(0.7, 1.3) * demand_per_market, -1))
        markets[mid] = Market(
            market_id=mid, location=(lat, lon),
            demand=m_demand, priority=round(rng.choice([1.0, 1.2, 1.5]), 1),
        )

    # ── 4. Batches ────────────────────────────────────────────────────────────
    batches: Dict[str, Batch] = {}
    farm_ids = list(farms.keys())
    commodities = list(COMMODITY_PROFILES.keys())

    for b in range(num_batches):
        bid = f"B{b + 1:02d}"
        fid = farm_ids[b % len(farm_ids)]
        comm = rng.choice(commodities)
        prof = COMMODITY_PROFILES[comm]

        initial_shelf = rng.uniform(prof["shelf_life_min"], prof["shelf_life_max"])
        age_hours = rng.uniform(0.0, initial_shelf * 0.4)
        rem_shelf = max(4.0, initial_shelf - age_hours)
        qty = round(rng.uniform(500.0, 2500.0), -1)
        ambient_temp = round(rng.uniform(18.0, 30.0), 1)

        batches[bid] = Batch(
            batch_id=bid,
            farm_id=fid,
            commodity=comm,
            quantity=qty,
            harvest_time=round(age_hours, 1),
            initial_shelf_life_hours=round(initial_shelf, 1),
            remaining_shelf_life_hours=round(rem_shelf, 1),
            temperature=ambient_temp,
            quality_level=round(rem_shelf / initial_shelf, 2),
        )
        farms[fid].available_quantity += qty

    # ── 5. Routes ─────────────────────────────────────────────────────────────
    routes: Dict[str, TransportRoute] = {}

    # (a) Farm → Storage (refrigerated cold-chain)
    for fid, farm in farms.items():
        for sid, storage in storages.items():
            dist = road_km(farm.location, storage.location)
            tt = dist / avg_speed_kmh
            cost = round(0.0008 * dist + rng.uniform(0.02, 0.05), 4)
            rid = f"R_{fid}_S{sid[-1]}"
            routes[rid] = TransportRoute(
                route_id=rid, source=fid, destination=sid,
                distance_km=round(dist, 1), travel_time_hours=round(tt, 2),
                transport_cost_per_unit=cost, available=True,
                risk_factor=round(rng.uniform(0.05, 0.20), 2),
                co2_kg_per_km=CO2_REFRIGERATED,
            )

    # (b) Storage → Market (refrigerated last-mile)
    for sid, storage in storages.items():
        for mid, market in markets.items():
            dist = road_km(storage.location, market.location)
            tt = dist / avg_speed_kmh
            cost = round(0.0008 * dist + rng.uniform(0.02, 0.05), 4)
            rid = f"R_S{sid[-1]}_{mid}"
            routes[rid] = TransportRoute(
                route_id=rid, source=sid, destination=mid,
                distance_km=round(dist, 1), travel_time_hours=round(tt, 2),
                transport_cost_per_unit=cost, available=True,
                risk_factor=round(rng.uniform(0.05, 0.20), 2),
                co2_kg_per_km=CO2_REFRIGERATED,
            )

    # (c) Direct Farm → Market (express, ambient, lower CO2)
    for fid, farm in farms.items():
        for mid, market in markets.items():
            dist = road_km(farm.location, market.location)
            tt = dist / (avg_speed_kmh * 1.1)
            cost = round(0.0012 * dist + rng.uniform(0.05, 0.10), 4)
            rid = f"R_DIR_{fid}_{mid}"
            routes[rid] = TransportRoute(
                route_id=rid, source=fid, destination=mid,
                distance_km=round(dist, 1), travel_time_hours=round(tt, 2),
                transport_cost_per_unit=cost, available=True,
                risk_factor=round(rng.uniform(0.12, 0.35), 2),
                co2_kg_per_km=CO2_AMBIENT,
            )

    # ── 6. Trucks ─────────────────────────────────────────────────────────────
    trucks: Dict[str, Truck] = {}
    for t in range(num_trucks):
        tid = f"T{t + 1}"
        trucks[tid] = Truck(
            truck_id=tid,
            capacity=round(rng.choice([4000.0, 6000.0, 8000.0, 10000.0]), -2),
            available=True,
            current_location=rng.choice(list(farms.keys()) + list(storages.keys())),
            travel_time_factor=round(rng.choice([1.0, 1.0, 1.0, 1.15]), 2),
        )

    return SupplyChainState(
        farms=farms,
        storage_facilities=storages,
        markets=markets,
        routes=routes,
        batches=batches,
        trucks=trucks,
        current_time_hours=0.0,
    )
