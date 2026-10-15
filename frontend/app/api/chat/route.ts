import { NextRequest, NextResponse } from 'next/server'

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
]

function buildSystemPrompt(context: any): string {
  const state = context?.state
  const result = context?.optimizeResult?.result
  const weather = context?.weather

  const farms = state ? Object.values(state.farms).map((f: any) =>
    `${f.farm_id} (${f.farm_id === 'F1' ? 'Nashik' : f.farm_id === 'F2' ? 'Kolar' : 'Guntur'}): ${f.available_quantity.toLocaleString()} kg available`
  ).join(', ') : 'N/A'

  const storage = state ? Object.values(state.storage_facilities).map((s: any) =>
    `${s.storage_id} (${s.storage_id === 'S1' ? 'Pune' : 'Bengaluru'}): ${s.current_load}/${s.capacity} kg${s.available ? '' : ' [OFFLINE]'}`
  ).join(', ') : 'N/A'

  const markets = state ? Object.values(state.markets).map((m: any) =>
    `${m.market_id} (${m.market_id === 'M1' ? 'Mumbai' : m.market_id === 'M2' ? 'Chennai' : 'Hyderabad'}): demand ${m.demand.toLocaleString()} kg, priority ${m.priority}x`
  ).join(', ') : 'N/A'

  const routes = state ? Object.values(state.routes).filter((r: any) => !r.available).map((r: any) =>
    `${r.route_id} (${r.source}→${r.destination}) OFFLINE`
  ).join(', ') || 'all routes available' : 'N/A'

  const optSummary = result ? `
- Dispatched: ${result.total_dispatched?.toLocaleString()} kg
- Delivered: ${result.total_delivered?.toLocaleString()} kg
- Spoilage: ${result.spoilage_percentage?.toFixed(1)}%
- Transport cost: $${result.total_transport_cost?.toLocaleString()}
- CO₂ emissions: ${result.total_co2_kg?.toFixed(0)} kg
- Demand fulfillment: ${result.demand_fulfillment_percentage?.toFixed(1)}%` : 'No optimization run yet.'

  const weatherSummary = weather?.length ? weather.map((w: any) =>
    `${w.node_id} (${w.city}): ${w.current_temp_c?.toFixed(1)}°C${w.heat_risk ? ' ⚠ HEAT RISK' : ''}`
  ).join(', ') : 'Not fetched.'

  return `You are Verdex Assistant, an expert AI for perishable supply chain optimization in India.
You have real-time access to the Verdex network state. Be concise, actionable, and data-specific.

NETWORK STATE:
Farms: ${farms}
Cold Storage: ${storage}
Markets: ${markets}
Offline routes: ${routes}

LATEST OPTIMIZATION RESULT:${optSummary}

LIVE WEATHER (Open-Meteo):
${weatherSummary}

SUPPLY CHAIN CONTEXT:
- Refrigerated routes: 0.9 kg CO₂/km | Direct express: 0.35 kg CO₂/km
- Spoilage accelerates above 32°C ambient temperature
- LP optimizer weights: spoilage (λ₁), cost (λ₂), unmet demand (λ₃), risk (λ₄), carbon (λ₅)
- Farms grow tomatoes/mangoes/leafy greens with 48-72h shelf life

When asked about routes, emissions, risks, or decisions — reference the actual numbers above.
If asked to suggest an action, be specific (e.g. "reroute B03 via S2 to reduce spoilage by ~2%").
Keep answers under 120 words unless the user asks for detail.`
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  const body = await req.json()
  const { messages, context } = body

  const systemPrompt = buildSystemPrompt(context)

  const contents = messages.map((m: { role: string; content: string }) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
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
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response.'
      return NextResponse.json({ reply: text, model })
    }

    const errText = await res.text()
    lastErr = `[${res.status}] ${model}: ${errText.slice(0, 300)}`
    if (res.status === 401 || res.status === 403) break
  }

  return NextResponse.json({ error: lastErr }, { status: 400 })
}
