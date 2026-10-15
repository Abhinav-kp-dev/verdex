'use client'

import { useEffect, useRef } from 'react'
import type { SupplyChainState, NodeWeather } from '@/lib/types'

interface Props {
  state: SupplyChainState
  weather?: NodeWeather[]
  height?: string
}

const CITY_LABELS: Record<string, string> = {
  F1: 'Nashik', F2: 'Kolar', F3: 'Guntur',
  S1: 'Pune', S2: 'Bengaluru',
  M1: 'Mumbai', M2: 'Chennai', M3: 'Hyderabad',
}

export default function NetworkMapInner({ state, weather, height = '420px' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return

    // Dynamic import to avoid SSR
    import('leaflet').then((LModule) => {
      const L = LModule.default ?? LModule

      // Destroy previous map if re-mounting
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(containerRef.current!, {
        center: [16.0, 77.5],
        zoom: 6,
        zoomControl: true,
        attributionControl: false,
      })
      mapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        subdomains: 'abc',
        maxZoom: 19,
      }).addTo(map)

      const weatherMap = new Map(weather?.map(w => [w.node_id, w]) ?? [])

      function isValidCoord(lat: any, lon: any): boolean {
        return typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon)
      }

      function nodeLatLon(id: string): [number, number] | null {
        const f = state.farms[id]
        if (f && isValidCoord(f.lat, f.lon)) return [f.lat, f.lon]
        const s = state.storage_facilities[id]
        if (s && isValidCoord(s.lat, s.lon)) return [s.lat, s.lon]
        const m = state.markets[id]
        if (m && isValidCoord(m.lat, m.lon)) return [m.lat, m.lon]
        return null
      }

      // Draw route lines
      Object.values(state.routes).forEach((route) => {
        const src = nodeLatLon(route.source)
        const dst = nodeLatLon(route.destination)
        if (!src || !dst) return
        const color = !route.available ? '#ef4444' : route.route_id.includes('DIR') ? '#6b8c70' : '#22c55e'
        const line = L.polyline([L.latLng(src[0], src[1]), L.latLng(dst[0], dst[1])], {
          color,
          weight: route.available ? 1.5 : 2.5,
          opacity: route.available ? 0.5 : 0.9,
          dashArray: route.available ? undefined : '6 4',
        }).addTo(map)
        line.bindPopup(
          `<div style="font-size:12px;font-family:monospace;line-height:1.5">
            <strong>${route.route_id}</strong><br/>
            ${route.source} → ${route.destination}<br/>
            ${route.distance_km} km · ${route.travel_time_hours.toFixed(1)}h<br/>
            CO₂: ${route.co2_kg_per_km} kg/km<br/>
            Risk: ${(route.risk_factor * 100).toFixed(0)}%
            ${!route.available ? '<br/><span style="color:#ef4444">⚠ OFFLINE</span>' : ''}
          </div>`
        )
      })

      // Farm markers (green)
      Object.values(state.farms).forEach((farm) => {
        if (!isValidCoord(farm.lat, farm.lon)) return
        const w = weatherMap.get(farm.farm_id)
        const heatRing = w?.heat_risk
        const marker = L.circleMarker(L.latLng(farm.lat, farm.lon), {
          radius: heatRing ? 10 : 8,
          color: heatRing ? '#f59e0b' : '#22c55e',
          fillColor: '#22c55e',
          fillOpacity: 0.9,
          weight: heatRing ? 3 : 1.5,
        }).addTo(map)
        marker.bindPopup(
          `<div style="font-size:12px;font-family:monospace;line-height:1.5">
            <strong>Farm ${farm.farm_id}</strong> — ${CITY_LABELS[farm.farm_id] ?? ''}<br/>
            Stock: ${farm.available_quantity.toLocaleString()} kg
            ${w ? `<br/>🌡 ${w.current_temp_c.toFixed(1)}°C (max 24h: ${w.max_24h_temp_c.toFixed(1)}°C)` : ''}
            ${heatRing ? '<br/><span style="color:#f59e0b">⚠ Heat Risk</span>' : ''}
          </div>`
        )
      })

      // Storage markers (blue / red if offline)
      Object.values(state.storage_facilities).forEach((sf) => {
        if (!isValidCoord(sf.lat, sf.lon)) return
        const w = weatherMap.get(sf.storage_id)
        const heatRing = w?.heat_risk
        const fillColor = sf.available ? '#3b82f6' : '#ef4444'
        const marker = L.circleMarker(L.latLng(sf.lat, sf.lon), {
          radius: heatRing ? 10 : 8,
          color: heatRing ? '#f59e0b' : fillColor,
          fillColor,
          fillOpacity: 0.9,
          weight: heatRing ? 3 : 1.5,
        }).addTo(map)
        marker.bindPopup(
          `<div style="font-size:12px;font-family:monospace;line-height:1.5">
            <strong>Storage ${sf.storage_id}</strong> — ${CITY_LABELS[sf.storage_id] ?? ''}<br/>
            Capacity: ${sf.capacity.toLocaleString()} kg<br/>
            Load: ${sf.current_load.toLocaleString()} kg<br/>
            Temp: ${sf.temperature_capacity}°C
            ${w ? `<br/>🌡 Ambient: ${w.current_temp_c.toFixed(1)}°C` : ''}
            ${!sf.available ? '<br/><span style="color:#ef4444">⚠ OFFLINE</span>' : ''}
          </div>`
        )
      })

      // Market markers (amber)
      Object.values(state.markets).forEach((market) => {
        if (!isValidCoord(market.lat, market.lon)) return
        const w = weatherMap.get(market.market_id)
        const heatRing = w?.heat_risk
        const marker = L.circleMarker(L.latLng(market.lat, market.lon), {
          radius: heatRing ? 11 : 9,
          color: '#f59e0b',
          fillColor: '#f59e0b',
          fillOpacity: 0.9,
          weight: heatRing ? 3 : 1.5,
        }).addTo(map)
        marker.bindPopup(
          `<div style="font-size:12px;font-family:monospace;line-height:1.5">
            <strong>Market ${market.market_id}</strong> — ${CITY_LABELS[market.market_id] ?? ''}<br/>
            Demand: ${market.demand.toLocaleString()} kg<br/>
            Priority: ${market.priority}×
            ${w ? `<br/>🌡 ${w.current_temp_c.toFixed(1)}°C (max: ${w.max_24h_temp_c.toFixed(1)}°C)` : ''}
            ${heatRing ? '<br/><span style="color:#f59e0b">⚠ Heat Risk</span>' : ''}
          </div>`
        )
      })
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [state, weather]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%', background: '#0f1610' }}
    />
  )
}
