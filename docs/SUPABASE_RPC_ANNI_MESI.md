# Supabase: funzione RPC per anni e mesi disponibili

Questa guida spiega come creare in Supabase una funzione che restituisce **solo** gli anni e i mesi distinti per uno shop, senza scaricare tutte le date. Utile quando hai molte righe in `ordini` (es. 100.000+).

---

## Passo 1: Aprire l’SQL Editor in Supabase

1. Vai su [https://supabase.com/dashboard](https://supabase.com/dashboard) e accedi.
2. Seleziona il tuo **progetto** (quello usato dall’app Piano di misurazione).
3. Nel menu a sinistra clicca su **SQL Editor**.

---

## Passo 2: Creare la funzione

1. Clicca su **New query** (nuova query).
2. Incolla il seguente SQL nel riquadro:

```sql
-- Restituisce anni e mesi distinti per lo shop (case-insensitive).
-- La RLS su ordini continua a valere: l’utente vede solo i propri shop.
create or replace function public.get_available_periods(p_shop text)
returns table (year int, month int)
language sql stable
security invoker
set search_path = public
as $$
  select distinct
    extract(year from data_ordine)::int as year,
    extract(month from data_ordine)::int as month
  from public.ordini
  where lower(trim(shop)) = lower(trim(p_shop))
  order by 1 desc, 2;
$$;
```

3. Clicca **Run** (o Ctrl+Enter).
4. Controlla che in basso compaia un messaggio di successo (es. “Success. No rows returned”). La funzione è stata creata.

**Nota:** `security invoker` fa sì che la funzione giri con i permessi di chi chiama (il tuo utente autenticato), quindi la **RLS** sulla tabella `ordini` resta attiva e l’utente vede solo i periodi dei propri shop.

---

## Passo 3: Verificare che la funzione esista

1. Nel menu a sinistra apri **Database** → **Functions**.
2. Cerca la funzione **get_available_periods** nello schema `public`.
3. Se la vedi, la creazione è andata a buon fine.

---

## Passo 4: (Opzionale) Provare la funzione dall’SQL Editor

1. Torna in **SQL Editor** → **New query**.
2. Incolla (sostituisci `'PAULATO'` con uno shop che hai nei dati):

```sql
select * from public.get_available_periods('PAULATO');
```

3. Clicca **Run**.
4. Dovresti vedere una tabella con colonne `year` e `month` (es. 2026, 1; 2026, 2; 2025, 1; …). Se vedi righe, la funzione funziona.

---

## Passo 5: Usare la funzione dall’app

L’app usa già la RPC: in `src/hooks/useAvailablePeriods.ts` viene chiamata `supabase.rpc('get_available_periods', { p_shop: selectedShop })` e il risultato `{ year, month }[]` viene mappato in `availableYears` e `availableMonthsForYear`.

---

## Riepilogo

| Passo | Dove | Cosa fare |
|-------|------|-----------|
| 1 | Dashboard → SQL Editor | Aprire una nuova query |
| 2 | SQL Editor | Incollare lo script `create or replace function ...` e Run |
| 3 | Database → Functions | Verificare che esista `get_available_periods` |
| 4 | SQL Editor | (Opzionale) Test con `select * from get_available_periods('PAULATO')` |
| 5 | App | Già fatto: `useAvailablePeriods` chiama la RPC |

---

## Altre funzioni Supabase

Quando serviranno altre RPC (es. report aggregati, filtri complessi), creale in Supabase come questa: **SQL Editor** → script `create or replace function ...` → **Run**. Poi indicami nome e parametri e adeguo l’app per chiamarle.
