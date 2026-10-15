'use client'

import dynamic from 'next/dynamic'
import type { SupplyChainState, NodeWeather } from '@/lib/types'

const NetworkMapInner = dynamic(() => import('./NetworkMapInner'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '420px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 14 }}>
      Loading map…
    </div>
  ),
})

interface Props {
  state: SupplyChainState
  weather?: NodeWeather[]
  height?: string
}

export default function NetworkMap({ state, weather, height }: Props) {
  return <NetworkMapInner state={state} weather={weather} height={height} />
}
