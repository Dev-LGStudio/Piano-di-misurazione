import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Ordine } from '../types/database'

const COLONNE_ORDINI_CHART =
  'id, data_ordine, stato_ordine, conversione_euro, totale_tasse_escluse, shop, stato, gestione'

function escapeForIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function shopMatches(shop: string | null, selectedShop: string): boolean {
  if (shop == null) return false
  return shop.trim().toLowerCase() === selectedShop.trim().toLowerCase()
}

export function useOrdiniChart(params: {
  selectedShop: string | null
  years: number[]
}) {
  const { selectedShop, years } = params
  const [ordini, setOrdini] = useState<Ordine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const yearsKey = useMemo(() => years.slice().sort((a, b) => b - a).join(','), [years])

  useEffect(() => {
    if (!selectedShop || years.length === 0) {
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

    const fetchYear = async (y: number): Promise<Ordine[]> => {
      const all: Ordine[] = []
      let from = 0
      while (true) {
        const { data, error: err } = await supabase
          .from('ordini')
          .select(COLONNE_ORDINI_CHART)
          .ilike('shop', shopPattern)
          .gte('data_ordine', `${y}-01-01`)
          .lte('data_ordine', `${y}-12-31`)
          .range(from, from + PAGE_SIZE - 1)
        if (err) throw err
        const batch = (data as Ordine[]) ?? []
        all.push(...batch)
        if (batch.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }
      return all
    }

    Promise.all(years.map((y) => fetchYear(y)))
      .then((chunks) => {
        if (cancelled) return
        setLoading(false)
        const merged = chunks.flat()
        const filtered = merged.filter((o) => shopMatches(o.shop, selectedShop))
        setOrdini(filtered)
      })
      .catch((err: { message?: string }) => {
        if (cancelled) return
        setLoading(false)
        setError(err?.message ?? 'Errore nel caricamento del grafico')
        setOrdini([])
      })

    return () => {
      cancelled = true
    }
  }, [selectedShop, yearsKey])

  return { ordini, loading, error }
}

