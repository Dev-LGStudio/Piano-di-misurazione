# Query Supabase per verificare il fatturato (stessa logica dell’app)

Esegui nel **SQL Editor** di Supabase per controllare cosa restituisce il DB con la **stessa logica** della dashboard (shop, anno, solo ordini “Concluso”, somma `conversione_euro`).

---

## Perché la query dà numeri diversi dall’app? (RLS)

Le query **SELECT** che trovi sotto, quando le esegui nel **SQL Editor** di Supabase, di solito girano con un ruolo che **non applica la RLS** (es. `postgres` o service role). Quindi vedono **tutti** gli ordini nel DB per quello shop/periodo (es. 3164).

L’**app** invece usa la sessione dell’utente loggato: sulla tabella `ordini` si applica la **Row Level Security**, quindi ogni utente vede solo gli ordini che le policy gli consentono (es. solo gli shop in `shops_abilitati` nel profilo). Per questo in dashboard vedi un numero minore (es. 940).

- **Query in SQL Editor** → conta/somma su tutto il DB (senza RLS).
- **App** → conta/somma solo sui dati che l’utente può vedere (con RLS).

Per avere gli **stessi numeri** dell’app (volume, fatturato, clienti) puoi usare la **RPC** `get_kpis_periodo` (vedi sotto): chiamata dall’app con i filtri attuali (shop + date), rispetta la RLS e restituisce gli stessi valori delle card.

---

## RPC che rispetta la RLS (stessi numeri dell’app)

Crea in Supabase (**SQL Editor** → New query) questa funzione. Quando la chiami **dall’app** (con `supabase.rpc('get_kpis_periodo', { ... })`) usa i permessi dell’utente, quindi la RLS su `ordini` si applica e i risultati coincidono con le card.

```sql
-- KPI periodo: volume ordini conclusi, fatturato, clienti distinti e clienti ricorrenti.
-- Versione corretta: calcola correttamente il numero di clienti ricorrenti.
create or replace function public.get_kpis_periodo(
  p_shop text,
  p_data_inizio date,
  p_data_fine date
)
returns table (
  volume_ordini bigint,
  fatturato numeric,
  clienti_distinti bigint,
  clienti_ricorrenti bigint
)
language sql stable
security invoker
set search_path = public
as $
  with concluso_nomi as (
    select unnest(nomi_stati) as nome
    from public.stati_ordini
    where label_stati = 'Concluso'
  ),
  ordini_conclusi as (
    select
      o.id,
      o.id_cliente,
      coalesce(o.conversione_euro, 0) as euro_usato
    from public.ordini o
    where lower(trim(o.shop)) = lower(trim(p_shop))
      and o.data_ordine::date >= p_data_inizio
      and o.data_ordine::date <= p_data_fine
      and exists (
        select 1 from concluso_nomi c
        where lower(trim(c.nome::text)) = lower(trim(coalesce(o.stato_ordine, '')))
      )
  ),
  -- Calcola i KPI principali
  kpis_base as (
    select
      count(*)::bigint as volume_ordini,
      coalesce(sum(euro_usato), 0) as fatturato,
      count(distinct id_cliente)::bigint as clienti_distinti
    from ordini_conclusi
  ),
  -- Calcola i clienti ricorrenti (clienti con > 1 ordine nel periodo)
  ricorrenti as (
    select count(*)::bigint as numero_ricorrenti
    from (
      select 1
      from ordini_conclusi
      group by id_cliente
      having count(*) > 1
    ) as subquery_ricorrenti
  )
  -- Unisce i risultati (una riga da kpis_base, una riga da ricorrenti)
  select
    k.volume_ordini,
    k.fatturato,
    k.clienti_distinti,
    r.numero_ricorrenti as clienti_ricorrenti
  from kpis_base k, ricorrenti r;
$;
```


**Chiamata dall’app** (es. per anno 2024 e shop selezionato):

```ts
const { data, error } = await supabase.rpc('get_kpis_periodo', {
  p_shop: selectedShop,
  p_data_inizio: '2024-01-01',
  p_data_fine: '2024-12-31',
})
// data[0] => { volume_ordini: 940, fatturato: ..., clienti_distinti: ..., clienti_ricorrenti: ... }
```

I filtri (shop, date inizio/fine) vanno impostati in base alla modalità periodo: **anno** → `yyyy-01-01` / `yyyy-12-31`, **mese** → primo / ultimo giorno del mese, **data** → `dateStart` / `dateEnd`.

---

## 1. Sostituisci shop e anno (query senza RLS)

In cima alla query ci sono due variabili (usa **Replace** nel editor):

- **`p_shop`**: stesso valore che scegli nella dashboard (es. `'PAULATO'`).
- **`p_anno`**: anno da verificare (es. `2025`).

---

## 2. Query da incollare e eseguire

```sql
-- Stessa logica dell'app: shop (trim+lower), anno, solo "Concluso", fatturato da conversione_euro
do $$
declare
  p_shop text := 'PAULATO';   -- cambia con il tuo shop
  p_anno int  := 2025;        -- anno da verificare
  v_fatturato numeric;
  v_volume int;
  v_clienti_distinti int;
begin
  with concluso_nomi as (
    select unnest(nomi_stati) as nome
    from public.stati_ordini
    where label_stati = 'Concluso'
  ),
  ordini_conclusi as (
    select
      o.id,
      o.data_ordine,
      o.stato_ordine,
      o.conversione_euro,
      o.totale_tasse_escluse,
      o.id_cliente,
      coalesce(o.conversione_euro, 0) as euro_usato
    from public.ordini o
    where lower(trim(o.shop)) = lower(trim(p_shop))
      and o.data_ordine >= (p_anno || '-01-01')::date
      and o.data_ordine <= (p_anno || '-12-31')::date
      and exists (
        select 1 from concluso_nomi c
        where lower(trim(c.nome::text)) = lower(trim(coalesce(o.stato_ordine, '')))
      )
  )
  select
    coalesce(sum(euro_usato), 0),
    count(*),
    count(distinct id_cliente)
  into v_fatturato, v_volume, v_clienti_distinti
  from ordini_conclusi;

  raise notice 'Shop: %, Anno: %', p_shop, p_anno;
  raise notice 'Fatturato: % €', v_fatturato;
  raise notice 'Volume ordini (conclusi): %', v_volume;
  raise notice 'Clienti distinti: %', v_clienti_distinti;
end $$;
```

Il risultato compare nel pannello **Messages** (non in Results): vedrai Fatturato, Volume ordini e Clienti distinti.

---

## 3. Versione “solo SELECT” (tabella in Results)

Se preferisci una query che restituisce una **tabella** nel tab Results (e magari il dettaglio riga per riga):

```sql
-- Sostituisci 'PAULATO' e 2025 con shop e anno da verificare
with concluso_nomi as (
  select unnest(nomi_stati) as nome
  from public.stati_ordini
  where label_stati = 'Concluso'
),
ordini_conclusi as (
  select
    o.id,
    o.data_ordine,
    o.stato_ordine,
    o.conversione_euro,
    o.totale_tasse_escluse,
    coalesce(o.conversione_euro, 0) as euro_usato
  from public.ordini o
  where lower(trim(o.shop)) = lower(trim('PAULATO'))
    and o.data_ordine >= '2025-01-01'
    and o.data_ordine <= '2025-12-31'
    and exists (
      select 1 from concluso_nomi c
      where lower(trim(c.nome::text)) = lower(trim(coalesce(o.stato_ordine, '')))
    )
)
select
  count(*) as volume_ordini,
  count(distinct id_cliente) as clienti_distinti,
  sum(euro_usato) as fatturato_totale
from ordini_conclusi;
```

Per vedere il **dettaglio** degli ordini inclusi nel calcolo:

```sql
-- Stessi parametri: shop e anno
with concluso_nomi as (
  select unnest(nomi_stati) as nome
  from public.stati_ordini
  where label_stati = 'Concluso'
)
select
  o.id,
  o.data_ordine,
  o.stato_ordine,
  o.conversione_euro,
  o.totale_tasse_escluse,
  coalesce(o.conversione_euro, 0) as euro_usato
from public.ordini o
where lower(trim(o.shop)) = lower(trim('PAULATO'))
  and o.data_ordine >= '2025-01-01'
  and o.data_ordine <= '2025-12-31'
  and exists (
    select 1 from concluso_nomi c
    where lower(trim(c.nome::text)) = lower(trim(coalesce(o.stato_ordine, '')))
  )
order by o.data_ordine, o.id;
```

---

## Confronto con l’app

- **Fatturato** in dashboard = `fatturato_totale` / output “Fatturato” della query.
- **Volume ordini** = `volume_ordini` / “Volume ordini (conclusi)”.
- **Clienti ricorrenti** = `clienti_distinti` / “Clienti distinti”.

Se i numeri non tornano, controlla:

1. **RLS**: la query in Supabase gira con i tuoi permessi; l’app usa l’utente loggato. Se la policy su `ordini` filtra per `shops_abilitati`, assicurati che lo shop usato sia quello abilitato per l’utente.
2. **Shop**: stesso identico valore (inclusi spazi/caratteri) tra profilo e valore in `ordini.shop`.
3. **Stati “Concluso”**: che in `stati_ordini` la riga con `label_stati = 'Concluso'` contenga in `nomi_stati` tutti gli stati che vuoi considerare conclusi (es. Spedito, Consegnato, ecc.).
