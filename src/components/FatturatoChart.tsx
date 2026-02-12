import { useMemo, useState } from 'react'

function formatEuro(n: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

export type BarMonth = {
  monthIndex: number // 0..11
  bars: {
    year: number
    stacks: { key: string; value: number; color: string }[]
  }[]
}

export type TrendSeries = {
  label: string
  color: string
  values: number[] // 12
}

function niceMax(value: number): number {
  if (value <= 0) return 0
  const exp = Math.floor(Math.log10(value))
  const base = 10 ** exp
  const scaled = value / base
  const rounded =
    scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return rounded * base
}

export function FatturatoChart(props: {
  mode: 'bar' | 'trend'
  barData: BarMonth[]
  trendSeries: TrendSeries[]
  height?: number
  barTitlePrefix?: string
}) {
  const { mode, barData, trendSeries, height = 300, barTitlePrefix } = props

  const [tooltip, setTooltip] = useState<null | {
    x: number
    y: number
    title: string
    rows: { label: string; value: number; color?: string }[]
  }>(null)

  const width = 920
  const padding = { top: 10, right: 14, bottom: 28, left: 44 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const yMax = useMemo(() => {
    if (mode === 'bar') {
      const max = Math.max(
        0,
        ...barData.flatMap((m) =>
          m.bars.map((b) => b.stacks.reduce((sum, st) => sum + st.value, 0))
        )
      )
      return niceMax(max)
    }
    const max = Math.max(
      0,
      ...trendSeries.flatMap((s) => s.values)
    )
    return niceMax(max)
  }, [mode, barData, trendSeries])

  const yTicks = useMemo(() => {
    if (yMax === 0) return [0]
    const steps = 4
    return Array.from({ length: steps + 1 }, (_, i) => (yMax / steps) * i)
  }, [yMax])

  const xForMonth = (i: number) => padding.left + (innerW * (i + 0.5)) / 12
  const yForValue = (v: number) => padding.top + innerH - (innerH * v) / (yMax || 1)

  const clearTooltip = () => setTooltip(null)

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        onMouseLeave={clearTooltip}
      >
        {/* grid + y labels */}
        {yTicks.map((t, idx) => {
          const y = yForValue(t)
          const isZero = idx === 0
          return (
            <g key={t}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke={isZero ? '#E2E8F0' : '#EEF2F7'}
                strokeDasharray={isZero ? undefined : '3 4'}
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#94A3B8"
              >
                {t === 0 ? '€0' : `€${Math.round(t / 1000)}k`}
              </text>
            </g>
          )
        })}

        {/* x labels */}
        {MESI.map((m, i) => (
          <text
            key={m}
            x={xForMonth(i)}
            y={height - 8}
            textAnchor="middle"
            fontSize="11"
            fill="#94A3B8"
          >
            {m}
          </text>
        ))}

        {mode === 'bar' ? (
          <BarLayer
            barData={barData}
            xForMonth={xForMonth}
            yForValue={yForValue}
            innerH={innerH}
            padding={padding}
            height={height}
            barTitlePrefix={barTitlePrefix}
            onHover={(p) => setTooltip(p)}
          />
        ) : (
        <TrendLayer
          series={trendSeries}
          xForMonth={xForMonth}
          yForValue={yForValue}
          padding={padding}
          height={height}
          onHover={(p) => setTooltip(p)}
        />
        )}
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg shadow-slate-200/70 backdrop-blur"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="mb-1 font-semibold text-slate-900">{tooltip.title}</div>
          <div className="space-y-0.5">
            {tooltip.rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  {r.color && (
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: r.color }}
                    />
                  )}
                  <span className="text-slate-600">{r.label}</span>
                </div>
                <span className="font-medium tabular-nums text-slate-900">{formatEuro(r.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BarLayer(props: {
  barData: BarMonth[]
  xForMonth: (i: number) => number
  yForValue: (v: number) => number
  innerH: number
  padding: { top: number; right: number; bottom: number; left: number }
  height: number
  barTitlePrefix?: string
  onHover: (t: { x: number; y: number; title: string; rows: { label: string; value: number; color?: string }[] } | null) => void
}) {
  const { barData, xForMonth, yForValue, padding, height, barTitlePrefix, onHover } = props
  const maxBarsInGroup = Math.max(1, ...barData.map((m) => m.bars.length))
  const groupW = 54
  const gap = 6
  const barW = Math.max(10, Math.floor((groupW - gap * (maxBarsInGroup - 1)) / maxBarsInGroup))

  return (
    <g>
      {barData.map((m) => {
        const xCenter = xForMonth(m.monthIndex)
        return (
          <g key={m.monthIndex}>
            {m.bars.map((b, idx) => {
              const groupLeft = xCenter - groupW / 2
              const x = groupLeft + idx * (barW + gap)
              let yAcc = 0
              const total = b.stacks.reduce((s, st) => s + st.value, 0)
              return (
                <g
                  key={b.year}
                  onMouseMove={(e) => {
                    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                    const rows: { label: string; value: number; color?: string }[] = b.stacks
                      .slice()
                      .sort((a, b2) => b2.value - a.value)
                      .filter((s) => s.value > 0)
                      .map((s) => ({ label: s.key, value: s.value, color: s.color }))
                    if (total > 0) rows.push({ label: 'Totale', value: total })
                    onHover({
                      x: e.clientX - rect.left + 12,
                      y: e.clientY - rect.top + 12,
                      title: `${barTitlePrefix ? `${barTitlePrefix} • ` : `Anno ${b.year} • `}${MESI[m.monthIndex]}`,
                      rows,
                    })
                  }}
                >
                  {b.stacks.map((st) => {
                    const y0 = yForValue(yAcc + st.value)
                    const y1 = yForValue(yAcc)
                    const h = Math.max(0, y1 - y0)
                    yAcc += st.value
                    return (
                      <rect
                        key={st.key}
                        x={x}
                        y={y0}
                        width={barW}
                        height={h}
                        fill={st.color}
                        opacity={0.95}
                      />
                    )
                  })}

                  {/* hit area */}
                  <rect
                    x={x}
                    y={padding.top}
                    width={barW}
                    height={height - padding.top - padding.bottom}
                    fill="transparent"
                  />
                </g>
              )
            })}
          </g>
        )
      })}
    </g>
  )
}

function TrendLayer(props: {
  series: TrendSeries[]
  xForMonth: (i: number) => number
  yForValue: (v: number) => number
  padding: { top: number; right: number; bottom: number; left: number }
  height: number
  onHover: (t: { x: number; y: number; title: string; rows: { label: string; value: number; color?: string }[] } | null) => void
}) {
  const { series, xForMonth, yForValue, padding, height, onHover } = props

  const currentMonthLine = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const hasCurrentYear = series.some((s) => s.label.includes(String(currentYear)))

    if (!hasCurrentYear) return null

    const x = xForMonth(currentMonth)
    return (
      <line
        x1={x}
        x2={x}
        y1={padding.top}
        y2={height - padding.bottom}
        stroke="#94A3B8"
        strokeDasharray="4 4"
        strokeWidth={1.5}
        opacity={0.6}
      />
    )
  }, [series, xForMonth, padding, height])

  const paths = useMemo(() => {
    return series.map((s) => {
      const pts = s.values.map((v, i) => ({ x: xForMonth(i), y: yForValue(v), v }))
      const d = pts
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(' ')
      return { ...s, pts, d }
    })
  }, [series, xForMonth, yForValue])

  return (
    <g>
      {currentMonthLine}
      {paths.map((p) => (
        <path
          key={p.label}
          d={p.d}
          fill="none"
          stroke={p.color}
          strokeWidth={3.2}
          opacity={0.95}
        />
      ))}

      {/* hover points */}
      {Array.from({ length: 12 }, (_, i) => (
        <g
          key={i}
          onMouseMove={(e) => {
            const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
            onHover({
              x: e.clientX - rect.left + 12,
              y: e.clientY - rect.top + 12,
              title: MESI[i],
              rows: paths
                .map((p) => ({
                  label: p.label,
                  value: p.pts[i]?.v ?? 0,
                  color: p.color,
                }))
                .sort((a, b) => b.value - a.value),
            })
          }}
        >
          <rect x={xForMonth(i) - 22} y={0} width={44} height={height} fill="transparent" />
        </g>
      ))}
    </g>
  )
}

