import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useProfiloContext } from '../context/ProfiloContext'

export function Navbar() {
  const { user, signOut } = useAuth()
  const { shops, hasMultipleShops, selectedShop, setSelectedShop } = useProfiloContext()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await signOut()
    setMenuOpen(false)
  }

  const displayName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? 'Utente'
  const email = user?.email ?? ''

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-3 items-center gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white shadow-sm">
            Av
          </div>
          <span className="text-lg font-semibold tracking-tight text-slate-900">
            Piano di misurazione
          </span>
        </div>

        <nav className="hidden justify-center md:flex">
          <div className="inline-flex items-center gap-6 text-sm font-medium text-slate-500">
            <button type="button" className="cursor-pointer border-b-2 border-blue-600 pb-1 text-slate-900">
              Dashboard
            </button>
            <button type="button" className="cursor-pointer pb-1 hover:text-slate-800">Ordini</button>
            <button type="button" className="cursor-pointer pb-1 hover:text-slate-800">Prodotti</button>
          </div>
        </nav>

        <div className="flex items-center justify-end gap-3">
          {user && hasMultipleShops && (
            <select
              value={selectedShop ?? ''}
              onChange={(e) => setSelectedShop(e.target.value || null)}
              className="h-9 cursor-pointer rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              aria-label="Seleziona shop"
            >
              {shops.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {user && (
            <div
              className="relative"
              onMouseEnter={() => setMenuOpen(true)}
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                type="button"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 ring-2 ring-transparent hover:ring-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-expanded={menuOpen}
                aria-haspopup="true"
                aria-label="Menu account"
              >
                {user.email?.[0]?.toUpperCase() ?? 'U'}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full pt-2">
                  <div className="min-w-[220px] rounded-xl border border-slate-100 bg-white py-3 shadow-lg shadow-slate-200/80">
                    <div className="px-4 pb-3">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        Account
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {displayName}
                      </p>
                      <p className="text-sm text-slate-600">{email}</p>
                    </div>
                    <a
                      href="#profilo"
                      className="block cursor-pointer px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
                    >
                      Il mio profilo
                    </a>
                    <a
                      href="#impostazioni"
                      className="block cursor-pointer px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
                    >
                      Impostazioni
                    </a>
                    <hr className="my-2 border-slate-100" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <span>Esci</span>
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 8l4 4m0 0l-4 4m4-4H3"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

