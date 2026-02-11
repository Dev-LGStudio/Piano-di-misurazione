import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Ordine } from '../types/database'

/**
 * Carica ordini. RLS su ordini già filtra per shops_abilitati dell'utente.
 * Il filtro per shop selezionato (case insensitive) va fatto lato client.
 */
export function useOrdini() {
  const [ordini, setOrdini] = useState<Ordine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    supabase
      .from('ordini')
      .select(
        'id, id_ordine, data_ordine, ora_ordine, nome_giorno, stato_ordine, totale_tasse_escluse, rimborso_tasse_escluse, totale_spese_spedizione, valuta, shop, tipo_cliente, id_cliente, citta, provincia, stato, gestione, marketplace'
      )
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
          setOrdini([])
          setLoading(false)
          return
        }
        setOrdini((data as Ordine[]) ?? [])
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { ordini, loading, error }
}

/** Filtra ordini per shop (case insensitive). */
export function filterOrdiniByShop(
  ordini: Ordine[],
  shop: string | null
): Ordine[] {
  if (!shop) return ordini
  const lower = shop.toLowerCase()
  return ordini.filter(
    (o) => (o.shop ?? '').toLowerCase() === lower
  )
}
