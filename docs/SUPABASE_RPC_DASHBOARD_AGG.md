# Supabase RPC: get_dashboard_agg

Questa RPC restituisce i dati aggregati per paese e sorgente in base ai filtri principali del dashboard (shop e intervallo di date).

## Quando utilizzare questa RPC

Utilizza questa RPC per ottenere i dati aggregati per le card "Vendite per sorgente" e "Top paesi per fatturato" che seguono i filtri principali del dashboard (anno, mese, o range di date personalizzato).

## Script SQL da eseguire in Supabase SQL Editor

**IMPORTANTE**: Copia l'intero script qui sotto, incluso il delimitatore finale `$function$;`. Non copiare solo una parte.

```sql
create or replace function get_dashboard_agg(
  p_shop text,
  p_data_inizio text,
  p_data_fine text
)
returns table(
  paese text,
  sorgente text,
  fatturato numeric
)
language plpgsql
security invoker
as $function$
declare
begin
  -- CTE per i nomi degli stati "Concluso"
  with concluso_nomi as (
    select lower(trim(coalesce(nome, ''))) as nome_norm
    from stati_ordini
    where lower(trim(coalesce(concluso, ''))) = 'concluso'
  )
  return query
  select
    coalesce(o.stato, 'N/A') as paese,
    coalesce(o.gestione, 'N/A') as sorgente,
    sum(coalesce(o.conversione_euro, 0))::numeric as fatturato
  from ordini o
  where o.negozio ilike p_shop
    and o.data_ordine::date >= p_data_inizio::date
    and o.data_ordine::date <= p_data_fine::date
    and exists (
      select 1 from concluso_nomi cn
      where cn.nome_norm = lower(trim(coalesce(o.stato_ordine, '')))
    )
  group by o.stato, o.gestione
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
