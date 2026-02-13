import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export type DashboardAggRow = {
  paese: string
  sorgente: string
  fatturato: number
  ordini: number
  top_meteo: string | null
}

export function useDashboardAgg(params: {
  selectedShop: string | null
  dateStart: string
  dateEnd: string
}) {
  const { selectedShop, dateStart, dateEnd } = params
  const [rows, setRows] = useState<DashboardAggRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedShop || !dateStart || !dateEnd) {
      setRows([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .rpc('get_dashboard_agg', {
        p_shop: selectedShop,
        p_data_inizio: dateStart,
        p_data_fine: dateEnd,
      })
      .then(({ data, error: err }) => {
        if (cancelled) return
        setLoading(false)
        if (err) {
          setError(err.message)
          setRows([])
          return
        }
        setRows((data as DashboardAggRow[]) ?? [])
      })

    return () => {
      cancelled = true
    }
  }, [selectedShop, dateStart, dateEnd])

  return { rows, loading, error }
}
