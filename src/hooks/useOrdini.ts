import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Ordine } from '../types/database'

const COLONNE_ORDINI =
  'id, id_ordine, data_ordine, ora_ordine, nome_giorno, stato_ordine, totale_tasse_escluse, rimborso_tasse_escluse, totale_spedizione, conversione_euro, valuta, shop, tipo_cliente, id_cliente, citta, provincia, stato, gestione, marketplace'

export type PeriodMode = 'anno' | 'mese' | 'data'

export type OrdiniFilters = {
  selectedShop: string | null
  periodMode: PeriodMode
  selectedYear: string
  selectedMonth: string
  dateStart: string
  dateEnd: string
}

function toYMDLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function lastDayOfMonth(year: number, month: string): string {
  const m = parseInt(month, 10)
  const d = new Date(year, m, 0)
  // NON usare toISOString(): può slittare di 1 giorno per timezone
  return toYMDLocal(d)
}

/** Escapa % e _ per ilike; usiamo poi %pattern% per includere eventuali spazi in DB. */
function escapeForIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** Stesso criterio della RPC get_available_periods: lower(trim(shop)) = lower(trim(p_shop)). */
function shopMatches(shop: string | null, selectedShop: string): boolean {
  if (shop == null) return false
  return shop.trim().toLowerCase() === selectedShop.trim().toLowerCase()
}

/**
 * Carica ordini con filtri lato database (shop + periodo).
 * Filtro shop allineato alla RPC get_available_periods: trim + lower (così spazi in DB non escludono righe).
 */
export function useOrdini(filters: OrdiniFilters) {
  const { selectedShop, periodMode, selectedYear, selectedMonth, dateStart, dateEnd } = filters
  const [ordini, setOrdini] = useState<Ordine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedShop) {
      setOrdini([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const shopPattern = '%' + escapeForIlike(selectedShop.trim()) + '%'
    const PAGE_SIZE = 1000

    const buildBaseQuery = () => {
      let query = supabase
        .from('ordini')
        .select(COLONNE_ORDINI)
        .ilike('shop', shopPattern)

      if (periodMode === 'anno') {
        const y = parseInt(selectedYear, 10)
        if (!Number.isNaN(y)) {
          query = query
            .gte('data_ordine', `${y}-01-01`)
            .lte('data_ordine', `${y}-12-31`)
        }
      } else if (periodMode === 'mese') {
        const y = parseInt(selectedYear, 10)
        if (!Number.isNaN(y) && selectedMonth) {
          const start = `${y}-${selectedMonth}-01`
          const end = lastDayOfMonth(y, selectedMonth)
          query = query.gte('data_ordine', start).lte('data_ordine', end)
        }
      } else {
        query = query.gte('data_ordine', dateStart).lte('data_ordine', dateEnd)
      }

      return query
    }

    ;(async () => {
      const all: Ordine[] = []
      let from = 0

      while (true) {
        const { data, error: err } = await buildBaseQuery().range(from, from + PAGE_SIZE - 1)
        if (cancelled) return
        if (err) {
          setError(err.message)
          setOrdini([])
          setLoading(false)
          return
        }
        const batch = (data as Ordine[]) ?? []
        all.push(...batch)
        if (batch.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }

      const filtered = all.filter((o) => shopMatches(o.shop, selectedShop))
      setOrdini(filtered)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [selectedShop, periodMode, selectedYear, selectedMonth, dateStart, dateEnd])

  return { ordini, loading, error }
}
