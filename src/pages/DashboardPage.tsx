import { Navbar } from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import { filterOrdiniByShop } from '../hooks/useOrdini'
import { useOrdini } from '../hooks/useOrdini'
import { useProfilo } from '../hooks/useProfilo'
import { useStatiOrdini } from '../hooks/useStatiOrdini'
import type { Ordine } from '../types/database'

function formatEuro(n: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function computeKpis(
  ordiniConclusi: Ordine[]
): {
  fatturato: number
  volumeOrdini: number
  ticketMedio: number
  clientiRicorrenti: number
} {
  const fatturato = ordiniConclusi.reduce(
    (s, o) => s + (Number(o.totale_tasse_escluse) || 0),
    0
  )
  const volumeOrdini = ordiniConclusi.length
  const ticketMedio =
    volumeOrdini > 0 ? fatturato / volumeOrdini : 0
  const clientiUnici = new Set(
    ordiniConclusi
      .map((o) => o.id_cliente)
      .filter((id): id is number => id != null)
  )
  return {
    fatturato,
    volumeOrdini,
    ticketMedio,
    clientiRicorrenti: clientiUnici.size,
  }
}

export function DashboardPage() {
  const { user } = useAuth()
  const {
    shops,
    hasMultipleShops,
    selectedShop,
    setSelectedShop,
    loading: profiloLoading,
    error: profiloError,
  } = useProfilo(user?.id)
  const { ordini, loading: ordiniLoading, error: ordiniError } = useOrdini()
  const { isConcluso, loading: statiLoading } = useStatiOrdini()

  const ordiniForShop = filterOrdiniByShop(ordini, selectedShop)
  const ordiniConclusi = ordiniForShop.filter((o) =>
    isConcluso(o.stato_ordine ?? null)
  )
  const kpis = computeKpis(ordiniConclusi)

  const loading = profiloLoading || ordiniLoading || statiLoading
  const error = profiloError ?? ordiniError

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-7 px-4 pb-10 pt-6">
        <section className="flex flex-col gap-3 rounded-3xl bg-white px-5 py-4 shadow-sm shadow-slate-200/60">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    />
                  </svg>
                </span>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">
                    Analisi performance
                  </h2>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              {hasMultipleShops && (
                <select
                  value={selectedShop ?? ''}
                  onChange={(e) =>
                    setSelectedShop(e.target.value || null)
                  }
                  className="h-9 cursor-pointer rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm"
                >
                  {shops.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
              <select className="h-9 cursor-pointer rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-sm">
                <option>Anno 2026</option>
                <option>Anno 2025</option>
              </select>
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs text-slate-600">
                <button type="button" className="cursor-pointer rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm">
                  Anno
                </button>
                <button type="button" className="cursor-pointer rounded-full px-3 py-1 hover:bg-white">
                  Mese
                </button>
                <button type="button" className="cursor-pointer rounded-full px-3 py-1 hover:bg-white">
                  Data
                </button>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-slate-100 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
            Caricamento dati...
          </div>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Fatturato',
                value: formatEuro(kpis.fatturato),
                delta: '-83,8%',
                badgeColor: 'bg-red-50 text-red-700',
                iconBg: 'bg-emerald-500/10 text-emerald-600',
                icon: '↗︎',
              },
              {
                label: 'Volume ordini',
                value: String(kpis.volumeOrdini),
                delta: '-83,0%',
                badgeColor: 'bg-red-50 text-red-700',
                iconBg: 'bg-sky-500/10 text-sky-600',
                icon: '🧾',
              },
              {
                label: 'Ticket medio',
                value: formatEuro(kpis.ticketMedio),
                delta: '-83,0%',
                badgeColor: 'bg-red-50 text-red-700',
                iconBg: 'bg-amber-500/10 text-amber-600',
                icon: '€',
              },
              {
                label: 'Clienti ricorrenti',
                value: String(kpis.clientiRicorrenti),
                delta: '-93,0%',
                badgeColor: 'bg-red-50 text-red-700',
                iconBg: 'bg-violet-500/10 text-violet-600',
                icon: '👥',
              },
            ].map((card) => (
              <article
                key={card.label}
                className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-gradient-to-b from-white to-slate-50 px-4 py-4 shadow-sm shadow-slate-200/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {card.label}
                    </p>
                    <p className="text-xl font-semibold tracking-tight text-slate-900">
                      {card.value}
                    </p>
                  </div>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-2xl ${card.iconBg}`}
                  >
                    <span className="text-sm">{card.icon}</span>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${card.badgeColor}`}
                >
                  {card.delta} vs prec.
                </span>
              </article>
            ))}
          </section>
        )}

        <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200/70 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Andamento fatturato
              </h2>
              <p className="mt-0.5 text-xs uppercase tracking-[0.18em] text-slate-400">
                Confronto anni e nazioni
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <select className="h-8 cursor-pointer rounded-full border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700">
                <option>Nessun confronto</option>
              </select>
              <select className="h-8 cursor-pointer rounded-full border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700">
                <option>Tutti i paesi</option>
              </select>
              <select className="h-8 cursor-pointer rounded-full border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700">
                <option>Tutte le sorgenti</option>
              </select>
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs text-slate-600">
                <button type="button" className="cursor-pointer rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-900 shadow-sm">
                  Barre
                </button>
                <button type="button" className="cursor-pointer rounded-full px-3 py-1 hover:bg-white">
                  Trend
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 h-52 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60" />

          <p className="mt-3 text-[11px] text-slate-400">
            Grafico basato su ordini conclusi (shop selezionato:{' '}
            <span className="font-semibold text-slate-500">
              {selectedShop ?? '—'}
            </span>
            ). Qui puoi aggiungere confronto anni/nazioni quando
            vorrai.
          </p>
        </section>
      </main>
    </div>
  )
}
