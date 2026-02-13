import { useEffect } from 'react'
import { Navbar } from '../components/Navbar'

export function OrdiniPage() {
  useEffect(() => {
    document.title = "Ordini - Piano di Misurazione";
  }, []);
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-4 py-16">
        <div className="w-full rounded-3xl border border-dashed border-slate-300 bg-white px-8 py-12 text-center shadow-sm shadow-slate-200/60">
          <p className="text-lg font-semibold text-slate-700">Lavori in corso</p>
        </div>
      </main>
    </div>
  )
}
