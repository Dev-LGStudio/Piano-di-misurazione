import { useEffect, useMemo, useState } from 'react'
import { Navbar } from '../components/Navbar'
import { FatturatoChart } from '../components/FatturatoChart'
import { useAuth } from '../context/AuthContext'
import { useProfiloContext } from '../context/ProfiloContext'
import { useAvailablePeriods } from '../hooks/useAvailablePeriods'
import { useKpisPeriodo } from '../hooks/useKpisPeriodo'
import { type PeriodMode } from '../hooks/useOrdini'
import { useFatturatoChartAgg } from '../hooks/useFatturatoChartAgg'
import { useDashboardAgg } from '../hooks/useDashboardAgg'

function formatEuro(n: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function toYMDLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function lastMonthStartEnd(): { start: string; end: string } {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = new Date(end)
  start.setMonth(start.getMonth() - 1)
  return {
    start: toYMDLocal(start),
    end: toYMDLocal(end),
  }
}

const defaultRange = lastMonthStartEnd()


/** Stesso giorno un anno fa (per confronto “stesso periodo” quando anno/mese in corso). */
function todayLastYear(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return toYMDLocal(d)
}

/** Restituisce i filtri per il periodo "precedente". Se anno o mese è in corso, confronta stesso periodo (da inizio a oggi vs da inizio a oggi anno prima). */
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
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0')

  if (filters.periodMode === 'anno') {
    const isYearInProgress = y === currentYear
    return {
      ...filters,
      selectedYear: String(prevYear),
      selectedMonth: filters.selectedMonth,
      dateStart: `${prevYear}-01-01`,
      dateEnd: isYearInProgress ? todayLastYear() : `${prevYear}-12-31`,
    }
  }
  if (filters.periodMode === 'mese') {
    if (!filters.selectedMonth) return null
    const isMonthInProgress = y === currentYear && filters.selectedMonth === currentMonth
    const lastDay = new Date(prevYear, parseInt(filters.selectedMonth, 10), 0)
    return {
      ...filters,
      selectedYear: String(prevYear),
      selectedMonth: filters.selectedMonth,
      dateStart: `${prevYear}-${filters.selectedMonth}-01`,
      dateEnd: isMonthInProgress ? todayLastYear() : toYMDLocal(lastDay),
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
    dateStart: toYMDLocal(start),
    dateEnd: toYMDLocal(end),
  }
}

/** Delta % rispetto a valore precedente; null se non confrontabile (mostra "-"). */
function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

export function DashboardPage() {
  useAuth()
  const {
    selectedShop,
    loading: profiloLoading,
    error: profiloError,
  } = useProfiloContext()
  const { availableYears, availableMonthsForYear, loading: periodsLoading } = useAvailablePeriods(selectedShop)

  const [periodMode, setPeriodMode] = useState<PeriodMode>('anno')
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [dateStart, setDateStart] = useState(defaultRange.start)
  const [dateEnd, setDateEnd] = useState(defaultRange.end)

  // Filtri interni del box “Andamento fatturato”
  const [chartMode, setChartMode] = useState<'bar' | 'trend'>('bar')
  const [chartYears, setChartYears] = useState<number[]>([])
  const [chartYearsOpen, setChartYearsOpen] = useState(false)
  const [chartCountries, setChartCountries] = useState<string[]>([])
  const [chartCountriesOpen, setChartCountriesOpen] = useState(false)
  const [chartSources, setChartSources] = useState<string[]>([])
  const [chartSourcesOpen, setChartSourcesOpen] = useState(false)

  // Stati per inizializzazione filtri
  const [didInitYears, setDidInitYears] = useState(false)
  const [didInitCountries, setDidInitCountries] = useState(false)
  const [didInitSources, setDidInitSources] = useState(false)

  // Reset dei filtri e dei flag quando cambia lo shop
  useEffect(() => {
    setDidInitYears(false)
    setDidInitCountries(false)
    setDidInitSources(false)
    setChartYears([])
    setChartCountries([])
    setChartSources([])
  }, [selectedShop])

  // Chiude i filtri cliccando fuori
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.relative')) {
        setChartYearsOpen(false)
        setChartCountriesOpen(false)
        setChartSourcesOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
      dateStart: periodMode === 'data' ? dateStart : '',
      dateEnd: periodMode === 'data' ? dateEnd : '',
    }),
    [selectedShop, periodMode, selectedYearResolved, selectedMonthResolved, dateStart, dateEnd]
  )
  const previousFilters = useMemo(
    () => previousPeriodFilters(ordiniFilters) ?? { ...ordiniFilters, selectedShop: null },
    [ordiniFilters]
  )
  const { kpis: kpisFromRpc, loading: kpisRpcLoading, error: kpisRpcError } = useKpisPeriodo(ordiniFilters)
  const { kpis: kpisPrevious } = useKpisPeriodo(previousFilters)

  // Calcola dateStart/dateEnd per le card "Vendite per sorgente" e "Top paesi"
  const dashboardDateRange = useMemo(() => {
    if (periodMode === 'anno') {
      const year = parseInt(selectedYearResolved, 10)
      if (!Number.isFinite(year)) return { start: '', end: '' }
      return {
        start: `${year}-01-01`,
        end: `${year}-12-31`,
      }
    }
    if (periodMode === 'mese') {
      const year = parseInt(selectedYearResolved, 10)
      const month = parseInt(selectedMonthResolved, 10)
      if (!Number.isFinite(year) || !Number.isFinite(month)) return { start: '', end: '' }
      const lastDay = new Date(year, month, 0).getDate()
      const m = String(month).padStart(2, '0')
      const d = String(lastDay).padStart(2, '0')
      return {
        start: `${year}-${m}-01`,
        end: `${year}-${m}-${d}`,
      }
    }
    return { start: dateStart, end: dateEnd }
  }, [periodMode, selectedYearResolved, selectedMonthResolved, dateStart, dateEnd])

  const { rows: dashboardAggRows } = useDashboardAgg({
    selectedShop,
    dateStart: dashboardDateRange.start,
    dateEnd: dashboardDateRange.end,
  })

  // Inizializzazione automatica anni grafico (solo una volta all'inizio)
  useEffect(() => {
    if (!didInitYears && availableYears.length > 0) {
      setChartYears([availableYears[0]])
      setDidInitYears(true)
    }
  }, [availableYears, didInitYears])

  // Mantieni chartYears validi se availableYears cambia (es. cambio shop)
  useEffect(() => {
    if (availableYears.length > 0 && chartYears.length > 0) {
      const valid = chartYears.filter((y) => availableYears.includes(y))
      if (valid.length !== chartYears.length) {
        setChartYears(valid)
      }
    }
  }, [availableYears, chartYears])

  const effectiveChartYears = useMemo(() => {
    return Array.from(new Set(chartYears)).sort((a, b) => b - a)
  }, [chartYears])

  const baseChartYear = effectiveChartYears.length > 0 ? Math.max(...effectiveChartYears) : null
  const {
    rows: chartAggRows,
    loading: ordiniChartLoading,
    error: ordiniChartError,
  } = useFatturatoChartAgg({ selectedShop, years: effectiveChartYears })

  const availableCountries = useMemo(() => {
    const set = new Set<string>()
    chartAggRows.forEach((r) => set.add(r.paese))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'it'))
  }, [chartAggRows])

  const availableSources = useMemo(() => {
    const set = new Set<string>()
    chartAggRows.forEach((r) => set.add(r.sorgente))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'it'))
  }, [chartAggRows])

  useEffect(() => {
    setChartCountries((prev) => {
      const filtered = prev.filter((c) => availableCountries.includes(c))
      if (filtered.length > 0) return filtered
      if (availableCountries.length > 0) return availableCountries
      return []
    })
  }, [availableCountries])

  useEffect(() => {
    setChartSources((prev) => {
      const filtered = prev.filter((s) => availableSources.includes(s))
      if (filtered.length > 0) return filtered
      if (availableSources.length > 0) return availableSources
      return []
    })
  }, [availableSources])

  // Inizializzazione automatica (tutti selezionati al primo carico)
  useEffect(() => {
    if (!didInitCountries && availableCountries.length > 0) {
      setChartCountries(availableCountries)
      setDidInitCountries(true)
    }
  }, [availableCountries, didInitCountries])

  useEffect(() => {
    if (!didInitSources && availableSources.length > 0) {
      setChartSources(availableSources)
      setDidInitSources(true)
    }
  }, [availableSources, didInitSources])

  const ordiniChartFiltered = useMemo(() => {
    const selectedCountrySet = new Set(chartCountries)
    const selectedSourceSet = new Set(chartSources)
    return chartAggRows.filter((r) => {
      const okCountry = selectedCountrySet.has(r.paese)
      const okSource = selectedSourceSet.has(r.sorgente)
      return okCountry && okSource
    })
  }, [chartAggRows, chartCountries, chartSources])

  const sourceSummary = useMemo(() => {
    const totals = new Map<string, number>()
    dashboardAggRows.forEach((r) => {
      totals.set(r.sorgente, (totals.get(r.sorgente) ?? 0) + Number(r.fatturato))
    })
    return Array.from(totals.entries())
      .map(([sorgente, fatturato]) => ({ sorgente, fatturato }))
      .sort((a, b) => b.fatturato - a.fatturato)
  }, [dashboardAggRows])

  const countrySummary = useMemo(() => {
    const totals = new Map<string, number>()
    dashboardAggRows.forEach((r) => {
      totals.set(r.paese, (totals.get(r.paese) ?? 0) + Number(r.fatturato))
    })
    return Array.from(totals.entries())
      .map(([paese, fatturato]) => ({ paese, fatturato }))
      .sort((a, b) => b.fatturato - a.fatturato)
      .slice(0, 5)
  }, [chartAggRows, chartSources])

  const colors = ['#2563EB', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#22C55E', '#06B6D4']

  const trendSeries = useMemo(() => {
    const byYearMonth = new Map<string, number>()
    ordiniChartFiltered.forEach((r) => {
      const y = Number(r.year)
      const m = Number(r.month)
      if (!Number.isFinite(y) || !Number.isFinite(m)) return
      const key = `${y}-${String(m).padStart(2, '0')}`
      const v = Number(r.fatturato) || 0
      byYearMonth.set(key, (byYearMonth.get(key) ?? 0) + v)
    })

    return effectiveChartYears.map((y, idx) => {
      const values = Array.from({ length: 12 }, (_, i) => {
        const key = `${y}-${String(i + 1).padStart(2, '0')}`
        return byYearMonth.get(key) ?? 0
      })
      return { label: `Anno ${y}`, color: colors[idx % colors.length], values }
    })
  }, [effectiveChartYears, ordiniChartFiltered])

  const barData = useMemo(() => {
    if (effectiveChartYears.length === 0) return []

    const selectedCountrySet = new Set(chartCountries)
    const useExplicitCountries = selectedCountrySet.size > 0

    // Determina i paesi da visualizzare come stack:
    // - se l'utente ha selezionato paesi specifici: usa quelli
    // - altrimenti: top N paesi per fatturato (sui dati filtrati e sugli anni selezionati) + Altro
    const totalsByCountry = new Map<string, number>()
    ordiniChartFiltered.forEach((r) => {
      const country = r.paese
      const v = Number(r.fatturato) || 0
      totalsByCountry.set(country, (totalsByCountry.get(country) ?? 0) + v)
    })

    const maxStacks = 6
    const allCountriesByTotal = Array.from(totalsByCountry.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c)

    const stackCountries = useExplicitCountries
      ? Array.from(selectedCountrySet)
      : allCountriesByTotal.slice(0, maxStacks)

    const hasOther = !useExplicitCountries && allCountriesByTotal.length > maxStacks

    const colorByCountry = new Map<string, string>()
    stackCountries.forEach((c, i) => colorByCountry.set(c, colors[(i + 1) % colors.length]))
    if (hasOther) colorByCountry.set('Altro', '#94A3B8')

    const yearsSorted = effectiveChartYears.slice().sort((a, b) => b - a)
    const monthBars = Array.from({ length: 12 }, () => new Map<number, Map<string, number>>())

    ordiniChartFiltered.forEach((r) => {
      const y = Number(r.year)
      const m = Number(r.month)
      if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return
      if (!yearsSorted.includes(y)) return

      const v = Number(r.fatturato) || 0

      const rawCountry = r.paese
      const bucket = useExplicitCountries
        ? rawCountry
        : stackCountries.includes(rawCountry)
          ? rawCountry
          : hasOther
            ? 'Altro'
            : rawCountry

      if (useExplicitCountries && !selectedCountrySet.has(rawCountry)) return

      const monthIdx = m - 1
      const byYear = monthBars[monthIdx]
      const byCountry = byYear.get(y) ?? new Map<string, number>()
      byCountry.set(bucket, (byCountry.get(bucket) ?? 0) + v)
      byYear.set(y, byCountry)
    })

    return monthBars.map((byYear, monthIdx) => ({
      monthIndex: monthIdx,
      bars: yearsSorted.map((y) => {
        const mm = byYear.get(y) ?? new Map<string, number>()
        return {
          year: y,
          stacks: Array.from(mm.entries())
            .map(([key, value]) => ({ key, value, color: colorByCountry.get(key) ?? '#CBD5E1' }))
            .sort((a, b) => a.key.localeCompare(b.key, 'it')),
        }
      }),
    }))
  }, [chartCountries, colors, effectiveChartYears, ordiniChartFiltered])

  const kpis = kpisFromRpc ?? {
    fatturato: 0,
    volumeOrdini: 0,
    ticketMedio: 0,
    clientiRicorrenti: 0,
  }

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
    kpisRpcLoading ||
    (kpisFromRpc == null && kpisRpcError == null)
  const error = profiloError ?? kpisRpcError

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
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setChartYearsOpen((v) => !v)
                    setChartCountriesOpen(false)
                    setChartSourcesOpen(false)
                  }}
                  className="inline-flex h-8 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700"
                  aria-label="Seleziona anni"
                >
                  {effectiveChartYears.length === 0
                    ? 'Nessun anno'
                    : effectiveChartYears.length === availableYears.length
                      ? 'Tutti gli anni'
                      : effectiveChartYears.length === 1
                        ? `Anno ${effectiveChartYears[0]}`
                        : `${effectiveChartYears.length} anni`}
                  <span className="text-slate-400">▾</span>
                </button>
                {chartYearsOpen && (
                  <div className="absolute left-0 top-10 z-10 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/70">
                    <div className="flex items-center justify-between px-2 pb-1">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Anni
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-[10px] font-semibold text-blue-600 hover:text-blue-700"
                          onClick={() => setChartYears(availableYears)}
                        >
                          Tutti
                        </button>
                        <button
                          type="button"
                          className="text-[10px] font-semibold text-slate-500 hover:text-slate-600"
                          onClick={() => setChartYears([])}
                        >
                          Nessuno
                        </button>
                      </div>
                    </div>
                    <div className="max-h-44 overflow-auto">
                      {availableYears.map((y) => {
                        const checked = effectiveChartYears.includes(y)
                        return (
                          <label key={y} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setChartYears((prev) => {
                                  const has = prev.includes(y)
                                  const next = has ? prev.filter((v) => v !== y) : [...prev, y]
                                  return next
                                })
                              }}
                            />
                            {y}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setChartCountriesOpen((v) => !v)
                    setChartYearsOpen(false)
                    setChartSourcesOpen(false)
                  }}
                  className="inline-flex h-8 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700"
                  aria-label="Seleziona paesi"
                >
                  {chartCountries.length === 0
                    ? 'Nessun paese'
                    : chartCountries.length === availableCountries.length
                      ? 'Tutti i paesi'
                      : `${chartCountries.length} paesi`}
                  <span className="text-slate-400">▾</span>
                </button>
                {chartCountriesOpen && (
                  <div className="absolute left-0 top-10 z-10 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/70">
                    <div className="flex items-center justify-between px-2 pb-1">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Paese
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-[10px] font-semibold text-blue-600 hover:text-blue-700"
                          onClick={() => setChartCountries(availableCountries)}
                        >
                          Tutti
                        </button>
                        <button
                          type="button"
                          className="text-[10px] font-semibold text-slate-500 hover:text-slate-600"
                          onClick={() => setChartCountries([])}
                        >
                          Nessuno
                        </button>
                      </div>
                    </div>
                    <div className="max-h-44 overflow-auto">
                      {availableCountries.map((c) => {
                        const checked = chartCountries.includes(c)
                        return (
                          <label key={c} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setChartCountries((prev) => {
                                  const has = prev.includes(c)
                                  return has ? prev.filter((v) => v !== c) : [...prev, c]
                                })
                              }}
                            />
                            {c}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setChartSourcesOpen((v) => !v)
                    setChartYearsOpen(false)
                    setChartCountriesOpen(false)
                  }}
                  className="inline-flex h-8 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700"
                  aria-label="Seleziona sorgenti"
                >
                  {chartSources.length === 0
                    ? 'Nessuna sorgente'
                    : chartSources.length === availableSources.length
                      ? 'Tutte le sorgenti'
                      : `${chartSources.length} sorgenti`}
                  <span className="text-slate-400">▾</span>
                </button>
                {chartSourcesOpen && (
                  <div className="absolute left-0 top-10 z-10 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/70">
                    <div className="flex items-center justify-between px-2 pb-1">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Sorgente
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-[10px] font-semibold text-blue-600 hover:text-blue-700"
                          onClick={() => setChartSources(availableSources)}
                        >
                          Tutti
                        </button>
                        <button
                          type="button"
                          className="text-[10px] font-semibold text-slate-500 hover:text-slate-600"
                          onClick={() => setChartSources([])}
                        >
                          Nessuno
                        </button>
                      </div>
                    </div>
                    <div className="max-h-44 overflow-auto">
                      {availableSources.map((s) => {
                        const checked = chartSources.includes(s)
                        return (
                          <label key={s} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setChartSources((prev) => {
                                  const has = prev.includes(s)
                                  return has ? prev.filter((v) => v !== s) : [...prev, s]
                                })
                              }}
                            />
                            {s}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs text-slate-600">
                <button
                  type="button"
                  onClick={() => setChartMode('bar')}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    chartMode === 'bar' ? 'bg-white text-slate-900 shadow-sm' : 'hover:bg-white'
                  }`}
                >
                  Barre
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('trend')}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    chartMode === 'trend' ? 'bg-white text-slate-900 shadow-sm' : 'hover:bg-white'
                  }`}
                >
                  Trend
                </button>
              </div>
            </div>
          </div>

          {ordiniChartError && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {ordiniChartError}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-slate-100 bg-white">
            <div className="px-3 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {chartMode === 'bar'
                ? baseChartYear
                  ? `Anno ${baseChartYear} • dettaglio per mese`
                  : '—'
                : 'Trend mensile per anno selezionato'}
            </div>
            <div className="px-2 pb-2 pt-2">
              {ordiniChartLoading ? (
                <div className="h-52 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60" />
              ) : (
                <FatturatoChart mode={chartMode} barData={barData} trendSeries={trendSeries} />
              )}
            </div>
            {chartMode === 'trend' && (
              <div className="flex flex-wrap items-center gap-4 px-4 pb-3 text-xs text-slate-500">
                {trendSeries.map((s) => (
                  <div key={s.label} className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="font-semibold">{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </section>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200/60">
            <h3 className="text-sm font-semibold text-slate-900">Vendite per sorgente</h3>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Intervallo selezionato (sorgenti tutte)
            </p>
            <div className="mt-3 space-y-3">
              {sourceSummary.map((source) => {
                const percent =
                  sourceSummary[0]?.fatturato === 0
                    ? 0
                    : (source.fatturato / sourceSummary[0].fatturato) * 100
                return (
                  <div key={source.sorgente}>
                    <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                      <span>{source.sorgente}</span>
                      <span>{formatEuro(source.fatturato)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                      <div
                        className="h-1.5 rounded-full bg-sky-500"
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200/60">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Top paesi per fatturato</h3>
              <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Riflette il filtro temporale principale
              </p>
            </div>
            <div className="mt-3 space-y-3">
              {countrySummary.map((country) => (
                <div key={country.paese}>
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                    <span>{country.paese}</span>
                    <span>{formatEuro(country.fatturato)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                    <div
                      className="h-1.5 rounded-full bg-emerald-500"
                      style={{
                        width: `${
                          Math.min(
                            (country.fatturato / (countrySummary[0]?.fatturato ?? 1)) * 100,
                            100,
                          )
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </main>
    </div>
  )
}
