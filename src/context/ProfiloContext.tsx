import { createContext, useContext, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useProfilo } from '../hooks/useProfilo'

type ProfiloContextValue = ReturnType<typeof useProfilo>

const ProfiloContext = createContext<ProfiloContextValue | null>(null)

export function ProfiloProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const value = useProfilo(user?.id ?? undefined)

  return (
    <ProfiloContext.Provider value={value}>
      {children}
    </ProfiloContext.Provider>
  )
}

export function useProfiloContext() {
  const ctx = useContext(ProfiloContext)
  if (!ctx) {
    throw new Error('useProfiloContext deve essere usato dentro <ProfiloProvider>')
  }
  return ctx
}
