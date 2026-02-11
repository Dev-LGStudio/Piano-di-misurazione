import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Profilo } from '../types/database'

const STORAGE_KEY_PREFIX = 'piano-selected-shop'

export function useProfilo(userId: string | undefined) {
  const [profilo, setProfilo] = useState<Profilo | null>(null)
  const [loading, setLoading] = useState(!!userId)
  const [error, setError] = useState<string | null>(null)

  const shops = profilo?.shops_abilitati ?? []
  const hasMultipleShops = shops.length > 1
  const firstShop = shops[0] ?? null

  const [selectedShop, setSelectedShopState] = useState<string | null>(null)

  // Carica profilo (RLS: solo la propria riga)
  useEffect(() => {
    if (!userId) {
      setProfilo(null)
      setLoading(false)
      setSelectedShopState(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .from('profili')
      .select('id, shops_abilitati, nome, logo_url')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return
        setLoading(false)
        if (err) {
          setError(err.message)
          setProfilo(null)
          return
        }
        const p = data as Profilo | null
        setProfilo(p ?? null)
        const list = p?.shops_abilitati ?? []
        const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}-${userId}`)
        const initial =
          list.length > 0
            ? list.includes(stored ?? '')
              ? stored
              : list[0]
            : null
        setSelectedShopState(initial)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  const setSelectedShop = (shop: string | null) => {
    setSelectedShopState(shop)
    if (userId && shop) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}-${userId}`, shop)
    }
  }

  const effectiveShop = selectedShop ?? firstShop

  return {
    profilo,
    shops,
    hasMultipleShops,
    selectedShop: effectiveShop,
    setSelectedShop,
    loading,
    error,
  }
}
