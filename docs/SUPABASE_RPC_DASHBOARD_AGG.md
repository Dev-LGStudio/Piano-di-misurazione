# Supabase RPC: get_dashboard_agg

Questa RPC restituisce i dati aggregati per paese e sorgente in base ai filtri principali del dashboard (shop e intervallo di date).

## Quando utilizzare questa RPC

Utilizza questa RPC per ottenere i dati aggregati per le card "Vendite per sorgente" e "Top paesi per fatturato" che seguono i filtri principali del dashboard (anno, mese, o range di date personalizzato).

## Script SQL da eseguire in Supabase SQL Editor

**IMPORTANTE**: Copia l'intero script qui sotto, incluso il delimitatore finale `$function$;`. Non copiare solo una parte.

```sql
create or replace function get_dashboard_agg(
  p_shop text,
  p_data_inizio date,
  p_data_fine date
)
returns table(
  paese text,
  sorgente text,
  fatturato numeric,
  ordini bigint,
  top_meteo text
)
language plpgsql
security invoker
as $function$
declare
begin
  return query
  with concluso_nomi as (
    select lower(trim(unnest(nomi_stati)::text)) as nome_norm
    from public.stati_ordini
    where lower(trim(label_stati)) = 'concluso'
  ),
  ordini_conclusi as (
    select
      coalesce(nullif(trim(o.stato), ''), 'N/A') as paese,
      coalesce(nullif(trim(o.gestione), ''), 'N/A') as sorgente,
      nullif(trim(o.meteo), '') as meteo,
      coalesce(o.conversione_euro, 0)::numeric as euro_usato
    from public.ordini o
    where lower(trim(o.shop)) ilike lower(trim(p_shop))
      and o.data_ordine >= p_data_inizio
      and o.data_ordine <= p_data_fine
      and exists (
        select 1 from concluso_nomi cn
        where cn.nome_norm = lower(trim(coalesce(o.stato_ordine, '')))
      )
  ),
  country_orders as (
    select oc.paese, count(*)::bigint as ordini
    from ordini_conclusi oc
    group by oc.paese
  ),
  meteo_counts as (
    select oc.paese, oc.meteo, count(*) as cnt
    from ordini_conclusi oc
    where oc.meteo is not null
    group by oc.paese, oc.meteo
  ),
  top_meteo as (
    select mc.paese, mc.meteo
    from (
      select
        mc.paese,
        mc.meteo,
        row_number() over (partition by mc.paese order by mc.cnt desc) as rn
      from meteo_counts mc
    ) mc
    where mc.rn = 1
  )
  select
    o.paese,
    o.sorgente,
    sum(o.euro_usato)::numeric as fatturato,
    coalesce(co.ordini, 0) as ordini,
    coalesce(tm.meteo, '—') as top_meteo
  from ordini_conclusi o
  left join country_orders co on co.paese = o.paese
  left join top_meteo tm on tm.paese = o.paese
  group by o.paese, o.sorgente, co.ordini, tm.meteo
  order by fatturato desc;
end;
$function$;
```

## Descrizione

### Parametri
- `p_shop` (text): Nome del negozio (es. 'PAULATO')
- `p_data_inizio` (text): Data di inizio nel formato 'YYYY-MM-DD'
- `p_data_fine` (text): Data di fine nel formato 'YYYY-MM-DD'

### Output
Restituisce una tabella con:
- `paese` (text): Il paese (colonna `stato` della tabella `ordini`)
- `sorgente` (text): La sorgente (colonna `gestione` della tabella `ordini`)
- `fatturato` (numeric): Somma di `conversione_euro` per quel paese/sorgente
- `ordini` (bigint): Numero di ordini conclusi registrati per quel paese
- `top_meteo` (text): Meteo più frequente (campo `meteo`) rilevato per quel paese

### Logica
1. Trova tutti i nomi degli stati ordine considerati "Concluso" dalla tabella `stati_ordini`
2. Filtra gli ordini per:
   - Negozio (usando `ilike` per case-insensitive)
   - Range di date (`data_ordine` tra `p_data_inizio` e `p_data_fine`)
   - Stato ordine "Concluso"
3. Aggrega per paese (`stato`) e sorgente (`gestione`)
4. Somma `conversione_euro` (senza fallback a `totale_tasse_escluse`)
5. Ordina per fatturato decrescente

### Note
- Utilizza `SECURITY INVOKER` per bypassare la RLS e garantire risultati consistenti
- Allineato con la logica di `get_kpis_periodo` per definizione di "Concluso" e calcolo fatturato
- I valori null in `stato` o `gestione` vengono sostituiti con 'N/A'
