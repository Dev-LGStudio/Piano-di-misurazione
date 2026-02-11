import { useEffect, useMemo, useState } from 'react'
import { Navbar } from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { useProfiloContext } from '../context/ProfiloContext'
import { useAvailablePeriods } from '../hooks/useAvailablePeriods'
import { useKpisPeriodo } from '../hooks/useKpisPeriodo'
import { type PeriodMode, useOrdini } from '../hooks/useOrdini'
import { useStatiOrdini } from '../hooks/useStatiOrdini'
import type { Ordine } from '../types/database'

function formatEuro(n: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function computeKpis(
  ordiniConclusi: Ordine[]
): {
  fatturato: number
  volumeOrdini: number
  ticketMedio: number
  clientiRicorrenti: number
} {
  const fatturato = ordiniConclusi.reduce((s, o) => {
    const euro =
      o.conversione_euro != null
        ? Number(o.conversione_euro)
        : o.totale_tasse_escluse != null
          ? Number(o.totale_tasse_escluse)
          : 0
    return s + (Number.isFinite(euro) ? euro : 0)
  }, 0)
  const volumeOrdini = ordiniConclusi.length
  const ticketMedio =
    volumeOrdini > 0 ? fatturato / volumeOrdini : 0
  const clientiUnici = new Set(
    ordiniConclusi
      .map((o) => o.id_cliente)
      .filter((id): id is number => id != null)
  )
  return {
    fatturato,
    volumeOrdini,
    ticketMedio,
    clientiRicorrenti: clientiUnici.size,
  }
}

function lastMonthStartEnd(): { start: string; end: string } {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = new Date(end)
  start.setMonth(start.getMonth() - 1)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

const defaultRange = lastMonthStartEnd()


/** Restituisce i filtri per il periodo "precedente" (anno prima / stesso mese anno prima / stesso range anno prima). */
function previousPeriodFilters(filters: {
  selectedShop: string | null
  periodMode: PeriodMode
  selectedYear: string
  selectedMonth: string
  dateStart: string
  dateEnd: string
}): typeof filters | null {
  if (!filters.selectedShop) return null
  const y = parseInt(filters.selectedYear, 10)
  if (Number.isNaN(y)) return null
  const prevYear = y - 1
  if (filters.periodMode === 'anno') {
    return {
      ...filters,
      selectedYear: String(prevYear),
      selectedMonth: filters.selectedMonth,
      dateStart: `${prevYear}-01-01`,
      dateEnd: `${prevYear}-12-31`,
    }
  }
  if (filters.periodMode === 'mese') {
    if (!filters.selectedMonth) return null
    const lastDay = new Date(prevYear, parseInt(filters.selectedMonth, 10), 0)
    return {
      ...filters,
      selectedYear: String(prevYear),
      selectedMonth: filters.selectedMonth,
      dateStart: `${prevYear}-${filters.selectedMonth}-01`,
      dateEnd: lastDay.toISOString().slice(0, 10),
    }
  }
  const start = new Date(filters.dateStart + 'T12:00:00')
  const end = new Date(filters.dateEnd + 'T12:00:00')
  start.setFullYear(start.getFullYear() - 1)
  end.setFullYear(end.getFullYear() - 1)
  return {
    ...filters,
    selectedYear: String(prevYear),
    selectedMonth: filters.selectedMonth,
    dateStart: start.toISOString().slice(0, 10),
    dateEnd: end.toISOString().slice(0, 10),
  }
}

/** Delta % rispetto a valore precedente; null se non confrontabile (mostra "-"). */
function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

export function DashboardPage() {
  const { user } = useAuth()
  const {
    selectedShop,
    loading: profiloLoading,
    error: profiloError,
  } = useProfiloContext()
  const { availableYears, availableMonthsForYear, loading: periodsLoading } = useAvailablePeriods(selectedShop)
  const { isConcluso, loading: statiLoading } = useStatiOrdini()

  const [periodMode, setPeriodMode] = useState<PeriodMode>('anno')
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [dateStart, setDateStart] = useState(defaultRange.start)
  const [dateEnd, setDateEnd] = useState(defaultRange.end)

  const selectedYearResolved = selectedYear || (availableYears[0]?.toString() ?? '')
  const monthsForSelectedYear = useMemo(
    () => availableMonthsForYear(parseInt(selectedYearResolved, 10)),
    [availableMonthsForYear, selectedYearResolved]
  )
  const selectedMonthResolved = selectedMonth || (monthsForSelectedYear[0]?.value ?? '')

  const ordiniFilters = useMemo(
    () => ({
      selectedShop,
      periodMode,
      selectedYear: selectedYearResolved,
      selectedMonth: selectedMonthResolved,
      dateStart,
      dateEnd,
    }),
    [selectedShop, periodMode, selectedYearResolved, selectedMonthResolved, dateStart, dateEnd]
  )
  const previousFilters = useMemo(
    () => previousPeriodFilters(ordiniFilters) ?? { ...ordiniFilters, selectedShop: null },
    [ordiniFilters]
  )
  const { kpis: kpisFromRpc, loading: kpisRpcLoading, error: kpisRpcError } = useKpisPeriodo(ordiniFilters)
  const { kpis: kpisPrevious } = useKpisPeriodo(previousFilters)
  const { ordini, loading: ordiniLoading, error: ordiniError } = useOrdini(ordiniFilters)

  const ordiniConclusi = useMemo(
    () => ordini.filter((o) => isConcluso(o.stato_ordine ?? null)),
    [ordini, isConcluso]
  )

  const kpisClient = computeKpis(ordiniConclusi)
  const kpis = kpisFromRpc ?? kpisClient

  const minYear = availableYears.length > 0 ? Math.min(...availableYears) : null
  const hasNoPrevious =
    (periodMode === 'anno' || periodMode === 'mese') &&
    minYear != null &&
    selectedYearResolved === String(minYear)

  const deltas = useMemo(() => {
    const prev = kpisPrevious ?? null
    const noCompare = hasNoPrevious || prev === null
    const pct = (curr: number, prevVal: number) => (noCompare ? null : deltaPercent(curr, prevVal))
    return {
      fatturato: pct(kpis.fatturato, prev?.fatturato ?? 0),
      volumeOrdini: pct(kpis.volumeOrdini, prev?.volumeOrdini ?? 0),
      ticketMedio: pct(kpis.ticketMedio, prev?.ticketMedio ?? 0),
      clientiRicorrenti: pct(kpis.clientiRicorrenti, prev?.clientiRicorrenti ?? 0),
    }
  }, [hasNoPrevious, kpis, kpisPrevious])

  function formatDelta(pct: number | null): string {
    if (pct === null) return '–'
    const formatted = new Intl.NumberFormat('it-IT', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(pct / 100)
    return pct >= 0 ? `+${formatted}` : formatted
  }
  function deltaBadgeColor(pct: number | null): string {
    if (pct === null) return 'bg-slate-100 text-slate-600'
    return pct >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
  }

  useEffect(() => {
    if (availableYears.length > 0 && !selectedYear) {
      setSelectedYear(String(availableYears[0]))
    }
    if (availableYears.length > 0 && selectedYear && !availableYears.includes(parseInt(selectedYear, 10))) {
      setSelectedYear(String(availableYears[0]))
    }
  }, [availableYears, selectedYear])

  useEffect(() => {
    if (monthsForSelectedYear.length > 0 && periodMode === 'mese') {
      const ok = selectedMonth && monthsForSelectedYear.some((m) => m.value === selectedMonth)
      if (!ok) setSelectedMonth(monthsForSelectedYear[0]?.value ?? '')
    }
  }, [periodMode, monthsForSelectedYear, selectedMonth])

  const loading =
    profiloLoading ||
    periodsLoading ||
    statiLoading ||
    kpisRpcLoading ||
    (kpisRpcError != null ? ordiniLoading : false)
  const error = profiloError ?? ordiniError

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-7 px-4 pb-10 pt-6">
        <section className="flex flex-col gap-3 rounded-3xl bg-white px-5 py-4 shadow-sm shadow-slate-200/60">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    />
                  </svg>
                </span>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">
                    Analisi performance
                  </h2>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              {periodMode === 'anno' && (
                <select
                  value={selectedYearResolved}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="h-9 cursor-pointer rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  aria-label="Seleziona anno"
                >
                  {availableYears.length === 0 ? (
                    <option value="">Nessun anno</option>
                  ) : (
                    availableYears.map((y) => (
                      <option key={y} value={String(y)}>
                        Anno {y}
                      </option>
                    ))
                  )}
                </select>
              )}
              {periodMode === 'mese' && (
                <>
                  <select
                    value={selectedYearResolved}
                    onChange={(e) => {
                      setSelectedYear(e.target.value)
                      setSelectedMonth('')
                    }}
                    className="h-9 cursor-pointer rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    aria-label="Seleziona anno"
                  >
                    {availableYears.length === 0 ? (
                      <option value="">Nessun anno</option>
                    ) : (
                      availableYears.map((y) => (
                        <option key={y} value={String(y)}>
                          {y}
                        </option>
                      ))
                    )}
                  </select>
                  <select
                    value={selectedMonthResolved}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="h-9 cursor-pointer rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    aria-label="Seleziona mese"
                  >
                    {monthsForSelectedYear.length === 0 ? (
                      <option value="">Nessun mese</option>
                    ) : (
                      monthsForSelectedYear.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))
                    )}
                  </select>
                </>
              )}
              {periodMode === 'data' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    className="h-9 cursor-pointer rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    aria-label="Data inizio"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    className="h-9 cursor-pointer rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    aria-label="Data fine"
                  />
                </div>
              )}
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs text-slate-600">
                <button
                  type="button"
                  onClick={() => setPeriodMode('anno')}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    periodMode === 'anno'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'hover:bg-white'
                  }`}
                >
                  Anno
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodMode('mese')}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    periodMode === 'mese'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'hover:bg-white'
                  }`}
                >
                  Mese
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodMode('data')}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    periodMode === 'data'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'hover:bg-white'
                  }`}
                >
                  Data
                </button>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-slate-100 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
            Caricamento dati...
          </div>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Fatturato',
                value: formatEuro(kpis.fatturato),
                delta: deltas.fatturato,
                iconBg: 'bg-emerald-500/10 text-emerald-600',
                icon: '↗︎',
              },
              {
                label: 'Volume ordini',
                value: String(kpis.volumeOrdini),
                delta: deltas.volumeOrdini,
                iconBg: 'bg-sky-500/10 text-sky-600',
                icon: '🧾',
              },
              {
                label: 'Ticket medio',
                value: formatEuro(kpis.ticketMedio),
                delta: deltas.ticketMedio,
                iconBg: 'bg-amber-500/10 text-amber-600',
                icon: '€',
              },
              {
                label: 'Clienti ricorrenti',
                value: String(kpis.clientiRicorrenti),
                delta: deltas.clientiRicorrenti,
                iconBg: 'bg-violet-500/10 text-violet-600',
                icon: '👥',
              },
            ].map((card) => (
              <article
                key={card.label}
                className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-gradient-to-b from-white to-slate-50 px-4 py-4 shadow-sm shadow-slate-200/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {card.label}
                    </p>
                    <p className="text-xl font-semibold tracking-tight text-slate-900">
                      {card.value}
                    </p>
                  </div>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-2xl ${card.iconBg}`}
                  >
                    <span className="text-sm">{card.icon}</span>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${deltaBadgeColor(card.delta)}`}
                >
                  {card.delta === null ? '–' : `${formatDelta(card.delta)} vs prec.`}
                </span>
              </article>
            ))}
          </section>
        )}

        <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200/70 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Andamento fatturato
              </h2>
              <p className="mt-0.5 text-xs uppercase tracking-[0.18em] text-slate-400">
                Confronto anni e nazioni
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <select className="h-8 cursor-pointer rounded-full border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700">
                <option>Nessun confronto</option>
              </select>
              <select className="h-8 cursor-pointer rounded-full border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700">
                <option>Tutti i paesi</option>
              </select>
              <select className="h-8 cursor-pointer rounded-full border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700">
                <option>Tutte le sorgenti</option>
              </select>
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs text-slate-600">
                <button type="button" className="cursor-pointer rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-900 shadow-sm">
                  Barre
                </button>
                <button type="button" className="cursor-pointer rounded-full px-3 py-1 hover:bg-white">
                  Trend
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 h-52 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60" />

          <p className="mt-3 text-[11px] text-slate-400">
            Grafico basato su ordini conclusi (shop selezionato:{' '}
            <span className="font-semibold text-slate-500">
              {selectedShop ?? '—'}
            </span>
            ). Qui puoi aggiungere confronto anni/nazioni quando
            vorrai.
          </p>
        </section>
      </main>
    </div>
  )
}
