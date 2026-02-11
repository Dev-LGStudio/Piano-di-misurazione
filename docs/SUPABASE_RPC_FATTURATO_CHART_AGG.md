# RPC Supabase: `get_fatturato_chart_agg`

Obiettivo: ottenere i dati del box **“Andamento fatturato”** già **aggregati** dal DB, così il frontend non deve scaricare tutti gli ordini.

- **RLS**: la funzione è `SECURITY INVOKER` → rispetta le policy (numeri coerenti con ciò che l’utente può vedere).
- **Solo ordini conclusi**: usa `stati_ordini` (label_stati = 'Concluso') e match case/space-insensitive su `stato_ordine`.
- **Fatturato**: `coalesce(conversione_euro, 0)`.
- **Dimensioni**: anno, mese, paese (`stato`), sorgente (`gestione`).

## 1) Crea la funzione

Esegui in Supabase SQL editor:

> Nota: esegui **tutto** lo script (non selezioni parziali) e assicurati di includere anche la riga finale di chiusura del blocco (`$function$;`).

```sql
create or replace function public.get_fatturato_chart_agg(
  p_shop text,
  p_years int[]
)
returns table (
  year int,
  month int,
  paese text,
  sorgente text,
  fatturato numeric
)
language sql
security invoker
as $function$
with concluso_nomi as (
  select unnest(nomi_stati) as nome
  from public.stati_ordini
  where label_stati = 'Concluso'
),
conclusi as (
  select
    extract(year from o.data_ordine)::int as year,
    extract(month from o.data_ordine)::int as month,
    coalesce(nullif(trim(o.stato), ''), '—') as paese,
    coalesce(nullif(trim(o.gestione), ''), '—') as sorgente,
    coalesce(o.conversione_euro, 0)::numeric as fatt
  from public.ordini o
  where
    lower(trim(o.shop)) = lower(trim(p_shop))
    and extract(year from o.data_ordine)::int = any(p_years)
    and exists (
      select 1 from concluso_nomi c
      where lower(trim(c.nome::text)) = lower(trim(coalesce(o.stato_ordine, '')))
    )
)
select
  year,
  month,
  paese,
  sorgente,
  sum(fatt) as fatturato
from conclusi
group by year, month, paese, sorgente
order by year desc, month asc, paese asc, sorgente asc;
$function$;
```

## 2) Permessi (se necessario)

In genere basta la RLS (security invoker). Se la tua istanza richiede grant espliciti:

```sql
grant execute on function public.get_fatturato_chart_agg(text, int[]) to authenticated;
```

## 3) Esempio di chiamata

```sql
select * from public.get_fatturato_chart_agg('PAULATO', array[2026,2025,2024]);
```

## 4) Debug: confronto 1:1 con la card (Gennaio 2026)

Questa query confronta direttamente le **due RPC** (quella delle card e quella del grafico) per lo stesso mese:

```sql
with kpis as (
  select * from public.get_kpis_periodo('PAULATO', '2026-01-01'::date, '2026-01-31'::date)
),
chart as (
  select coalesce(sum(fatturato),0) as fatturato
  from public.get_fatturato_chart_agg('PAULATO', array[2026])
  where year = 2026 and month = 1
)
select
  kpis.fatturato as fatturato_card,
  chart.fatturato as fatturato_grafico,
  (chart.fatturato - kpis.fatturato) as diff
from kpis cross join chart;
```

