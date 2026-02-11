import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { StatoOrdineRow } from '../types/database'

/**
 * Mappa stato_ordine (es. "Spedito", "Annullato") -> label_stati (es. "Concluso", "Annullato").
 * Usare per filtrare gli ordini "conclusi" (label === 'Concluso').
 */
export function useStatiOrdini() {
  const [stati, setStati] = useState<StatoOrdineRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    supabase
      .from('stati_ordini')
      .select('id, label_stati, nomi_stati')
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
          setLoading(false)
          return
        }
        setStati((data as StatoOrdineRow[]) ?? [])
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const getLabel = (statoOrdine: string | null): string | null => {
    if (!statoOrdine) return null
    const row = stati.find((s) =>
      s.nomi_stati.some(
        (n) => n.toLowerCase() === statoOrdine.toLowerCase()
      )
    )
    return row?.label_stati ?? null
  }

  const isConcluso = (statoOrdine: string | null): boolean =>
    getLabel(statoOrdine) === 'Concluso'

  return { stati, getLabel, isConcluso, loading, error }
}
