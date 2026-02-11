import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { OrdiniFilters } from './useOrdini'

function lastDayOfMonth(year: number, month: string): string {
  const m = parseInt(month, 10)
  const d = new Date(year, m, 0)
  return d.toISOString().slice(0, 10)
}

function getDateRange(filters: OrdiniFilters): { dataInizio: string; dataFine: string } | null {
  const { selectedShop, periodMode, selectedYear, selectedMonth, dateStart, dateEnd } = filters
  if (!selectedShop) return null
  if (periodMode === 'anno') {
    const y = parseInt(selectedYear, 10)
    if (Number.isNaN(y)) return null
    return { dataInizio: `${y}-01-01`, dataFine: `${y}-12-31` }
  }
  if (periodMode === 'mese') {
    const y = parseInt(selectedYear, 10)
    if (Number.isNaN(y) || !selectedMonth) return null
    return {
      dataInizio: `${y}-${selectedMonth}-01`,
      dataFine: lastDayOfMonth(y, selectedMonth),
    }
  }
  return { dataInizio: dateStart, dataFine: dateEnd }
}

type KpisRow = {
  volume_ordini: number
  fatturato: number
  clienti_distinti: number
}

/**
 * KPI (volume, fatturato, clienti) dal DB tramite RPC get_kpis_periodo.
 * Rispetta la RLS: i numeri coincidono con ciò che l’utente può vedere.
 * Richiede che la funzione get_kpis_periodo esista in Supabase (vedi docs/SUPABASE_QUERY_VERIFICA_FATTURATO.md).
 */
export function useKpisPeriodo(filters: OrdiniFilters) {
  const [kpis, setKpis] = useState<{
    volumeOrdini: number
    fatturato: number
    ticketMedio: number
    clientiRicorrenti: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const range = getDateRange(filters)

  useEffect(() => {
    if (!range || !filters.selectedShop) {
      setKpis(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .rpc('get_kpis_periodo', {
        p_shop: filters.selectedShop,
        p_data_inizio: range.dataInizio,
        p_data_fine: range.dataFine,
      })
      .then(({ data, error: err }) => {
        if (cancelled) return
        setLoading(false)
        if (err) {
          setError(err.message)
          setKpis(null)
          return
        }
        const row = (Array.isArray(data) ? data[0] : data) as KpisRow | null
        if (!row) {
          setKpis({
            volumeOrdini: 0,
            fatturato: 0,
            ticketMedio: 0,
            clientiRicorrenti: 0,
          })
          return
        }
        const volume = Number(row.volume_ordini) || 0
        const fatturato = Number(row.fatturato) || 0
        setKpis({
          volumeOrdini: volume,
          fatturato,
          ticketMedio: volume > 0 ? fatturato / volume : 0,
          clientiRicorrenti: Number(row.clienti_distinti) || 0,
        })
      })

    return () => {
      cancelled = true
    }
  }, [
    filters.selectedShop,
    filters.periodMode,
    filters.selectedYear,
    filters.selectedMonth,
    filters.dateStart,
    filters.dateEnd,
  ])

  return { kpis, loading, error }
}
