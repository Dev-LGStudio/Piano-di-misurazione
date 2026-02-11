import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const MESI: { value: string; label: string }[] = [
  { value: '01', label: 'Gennaio' }, { value: '02', label: 'Febbraio' }, { value: '03', label: 'Marzo' },
  { value: '04', label: 'Aprile' }, { value: '05', label: 'Maggio' }, { value: '06', label: 'Giugno' },
  { value: '07', label: 'Luglio' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Settembre' },
  { value: '10', label: 'Ottobre' }, { value: '11', label: 'Novembre' }, { value: '12', label: 'Dicembre' },
]

type PeriodRow = { year: number; month: number }

/**
 * Usa la RPC get_available_periods su Supabase per ottenere anni e mesi distinti per lo shop.
 * Una sola richiesta, poche righe, scalabile anche con 100k+ ordini.
 * La funzione va creata in Supabase (vedi docs/SUPABASE_RPC_ANNI_MESI.md).
 */
export function useAvailablePeriods(selectedShop: string | null) {
  const [rows, setRows] = useState<PeriodRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedShop) {
      setRows([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .rpc('get_available_periods', { p_shop: selectedShop })
      .then(({ data, error: err }) => {
        if (cancelled) return
        setLoading(false)
        if (err) {
          setError(err.message)
          setRows([])
          return
        }
        setRows((data as PeriodRow[]) ?? [])
      })

    return () => {
      cancelled = true
    }
  }, [selectedShop])

  const availableYears = useMemo(() => {
    const set = new Set<number>()
    rows.forEach((r) => set.add(r.year))
    return Array.from(set).sort((a, b) => b - a)
  }, [rows])

  const availableMonthsForYear = useMemo(() => {
    return (year: number) => {
      const set = new Set<number>()
      rows.forEach((r) => {
        if (r.year === year) set.add(r.month)
      })
      return MESI.filter((m) => set.has(parseInt(m.value, 10)))
    }
  }, [rows])

  return { availableYears, availableMonthsForYear, loading, error }
}
