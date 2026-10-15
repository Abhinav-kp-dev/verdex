import { NextRequest, NextResponse } from 'next/server'

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite']

function buildReportPrompt(context: any): string {
  const state = context?.state
  const result = context?.optimizeResult?.result ?? context?.optimizeResult
  const weather = context?.weather ?? []

  const farms = state
    ? Object.values(state.farms).map((f: any) =>
        `${f.farm_id} (${f.farm_id === 'F1' ? 'Nashik' : f.farm_id === 'F2' ? 'Kolar' : 'Guntur'}): ${f.available_quantity.toLocaleString()} kg`
      ).join('; ')
    : 'N/A'

  const storage = state
    ? Object.values(state.storage_facilities).map((s: any) =>
        `${s.storage_id} (${s.storage_id === 'S1' ? 'Pune' : 'Bengaluru'}): ${s.current_load}/${s.capacity} kg${s.available ? '' : ' [OFFLINE]'}`
      ).join('; ')
    : 'N/A'

  const markets = state
    ? Object.values(state.markets).map((m: any) =>
        `${m.market_id} (${m.market_id === 'M1' ? 'Mumbai' : m.market_id === 'M2' ? 'Chennai' : 'Hyderabad'}): demand ${m.demand.toLocaleString()} kg, priority ${m.priority}x`
      ).join('; ')
    : 'N/A'

  const offlineRoutes = state
    ? Object.values(state.routes)
        .filter((r: any) => !r.available)
        .map((r: any) => `${r.route_id} (${r.source}→${r.destination})`)
        .join(', ') || 'None'
    : 'N/A'

  const allRoutes = state
    ? Object.values(state.routes).map((r: any) =>
        `${r.route_id}: ${r.source}→${r.destination}, ${r.distance_km}km, CO₂ ${r.co2_kg_per_km}kg/km, risk ${(r.risk_factor * 100).toFixed(0)}%, ${r.available ? 'available' : 'OFFLINE'}`
      ).join('\n  ')
    : 'N/A'

  const allocations = result?.allocations
    ? result.allocations.slice(0, 10).map((a: any) =>
        `${a.batch_id} via ${a.route_id}: ${a.quantity_allocated}kg, spoilage ${(a.spoilage_fraction * 100).toFixed(1)}%`
      ).join('\n  ')
    : 'N/A'

  const weatherSummary = weather.length
    ? weather.map((w: any) => `${w.node_id} (${w.city ?? w.node_id}): ${w.current_temp_c?.toFixed(1)}°C${w.heat_risk ? ' ⚠ HEAT RISK' : ''}`).join('; ')
    : 'Not available'

  return `You are Verdex, an expert supply chain optimization AI for perishable goods in India.

Generate a comprehensive, data-driven supply chain optimization report based on the following real data.

NETWORK STATE:
Farms: ${farms}
Cold Storage: ${storage}
Markets: ${markets}
Offline Routes: ${offlineRoutes}

ALL ROUTES:
  ${allRoutes}

OPTIMIZATION RESULTS:
- Total Dispatched: ${result?.total_dispatched?.toLocaleString() ?? 'N/A'} kg
- Total Delivered: ${result?.total_delivered?.toLocaleString() ?? 'N/A'} kg
- Spoilage: ${result?.spoilage_percentage?.toFixed(2) ?? 'N/A'}%
- Transport Cost: $${result?.total_transport_cost?.toLocaleString() ?? 'N/A'}
- CO₂ Emissions: ${result?.total_co2_kg?.toFixed(1) ?? 'N/A'} kg
- Demand Fulfillment: ${result?.demand_fulfillment_percentage?.toFixed(2) ?? 'N/A'}%
- Objective Score J: ${result?.objective_score?.toFixed(4) ?? 'N/A'}

BATCH ALLOCATIONS (sample):
  ${allocations}

LIVE WEATHER:
${weatherSummary}

CONTEXT:
- Refrigerated routes (R-prefix): 0.9 kg CO₂/km, slower, better for shelf-life
- Direct express (DIR-prefix): 0.35 kg CO₂/km, faster, higher spoilage risk
- Spoilage accelerates significantly above 32°C ambient temperature
- Lambda weights used: spoilage (10), cost (0.15), unmet demand (15), risk (5)

INSTRUCTIONS:
Generate a professional report. Be concise — keep each text field under 80 words. Return ONLY valid JSON matching this exact schema (no extra text, no markdown fences):
{
  "executive_summary": "2-3 paragraph overview of the optimization run, key performance numbers, and overall supply chain health",
  "kpi_highlights": [
    { "label": "string", "value": "string", "status": "good|warning|critical", "insight": "string" }
  ],
  "best_routes": [
    { "route_id": "string", "reason": "string", "metrics": "string" }
  ],
  "worst_routes": [
    { "route_id": "string", "issue": "string", "recommendation": "string" }
  ],
  "spoilage_analysis": {
    "summary": "paragraph",
    "top_risks": ["string"],
    "reduction_strategies": [
      { "strategy": "string", "expected_impact": "string", "priority": "high|medium|low" }
    ]
  },
  "carbon_insights": {
    "summary": "paragraph",
    "emission_breakdown": "paragraph",
    "green_recommendations": ["string"]
  },
  "cost_analysis": {
    "summary": "paragraph",
    "optimization_opportunities": ["string"]
  },
  "weather_impact": "paragraph about how current weather affects operations",
  "action_items": [
    { "action": "string", "urgency": "immediate|short_term|long_term", "expected_benefit": "string" }
  ],
  "generated_at": "ISO 8601 timestamp placeholder"
}`
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  const body = await req.json()
  const { context } = body

  const prompt = buildReportPrompt(context)

  const payload = JSON.stringify({
    systemInstruction: {
      parts: [{ text: 'You are a supply chain AI that outputs only valid JSON reports. No markdown, no commentary — pure JSON.' }],
    },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
  })

  let lastErr = ''
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    })

    if (res.ok) {
      const data = await res.json()
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      // Strip markdown code fences if present
      text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      try {
        const report = JSON.parse(text)
        report.generated_at = new Date().toISOString()
        return NextResponse.json({ report, model })
      } catch {
        return NextResponse.json({ error: 'Failed to parse AI response as JSON', raw: text }, { status: 500 })
      }
    }

    const errText = await res.text()
    lastErr = `[${res.status}] ${model}: ${errText.slice(0, 300)}`
    if (res.status === 401 || res.status === 403) break
  }

  return NextResponse.json({ error: lastErr }, { status: 400 })
}
