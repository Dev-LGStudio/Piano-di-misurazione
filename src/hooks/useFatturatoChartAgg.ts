import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export type FatturatoChartRow = {
  year: number
  month: number
  paese: string
  sorgente: string
  fatturato: number
}

export function useFatturatoChartAgg(params: {
  selectedShop: string | null
  years: number[]
}) {
  const { selectedShop, years } = params
  const [rows, setRows] = useState<FatturatoChartRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const yearsKey = useMemo(() => years.slice().sort((a, b) => b - a).join(','), [years])

  useEffect(() => {
    if (!selectedShop || years.length === 0) {
      setRows([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .rpc('get_fatturato_chart_agg', { p_shop: selectedShop, p_years: years })
      .then(({ data, error: err }) => {
        if (cancelled) return
        setLoading(false)
        if (err) {
          setError(err.message)
          setRows([])
          return
        }
        setRows((data as FatturatoChartRow[]) ?? [])
      })

    return () => {
      cancelled = true
    }
  }, [selectedShop, yearsKey])

  return { rows, loading, error }
}

