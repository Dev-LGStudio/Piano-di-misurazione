# RLS su stati_ordini (Supabase)

La tabella `stati_ordini` viene letta dall’app per sapere quali valori di `stato_ordine` sono considerati "Concluso" (e quindi inclusi nel fatturato). Se la tabella ha **RLS attiva** ma **nessuna policy**, le SELECT non restituiscono righe e il fatturato resta a 0.

---

## Cosa fare

Hai due possibilità.

### Opzione A – Aggiungere una policy (consigliata)

Consenti la **sola lettura** a tutti gli utenti autenticati.

1. Vai su [Supabase](https://supabase.com/dashboard) → tuo progetto → **SQL Editor**.
2. Clicca **New query** e incolla:

```sql
-- Abilita RLS se non è già attiva (non fa male rieseguirlo)
alter table public.stati_ordini enable row level security;

-- Policy: gli utenti autenticati possono solo leggere (SELECT)
create policy "Utenti autenticati possono leggere stati_ordini"
  on public.stati_ordini
  for select
  to authenticated
  using (true);
```

3. Clicca **Run** (o Ctrl+Enter).

Dopo questo, l’app potrà caricare le righe di `stati_ordini` (inclusa la riga con `label_stati = 'Concluso'`) e gli ordini con stato "Spedito", "Consegnato", ecc. verranno conteggiati nel fatturato.

---

### Opzione B – Disattivare RLS

Se preferisci che la tabella sia leggibile da chiunque abbia accesso al progetto (senza policy):

1. **SQL Editor** → **New query**.
2. Incolla:

```sql
alter table public.stati_ordini disable row level security;
```

3. **Run**.

In questo caso non servono policy; la tabella è leggibile secondo i permessi di ruolo del database.

---

## Verifica

Dopo aver applicato l’**Opzione A** (o B):

1. Ricarica la dashboard dell’app.
2. Nel box **Debug fatturato** controlla che **Righe stati_ordini caricate** sia > 0 e che **Nomi "Concluso" in stati_ordini** mostri l’elenco (es. Spedito, Consegnato, …).
3. **Ordini considerati conclusi** e **Fatturato calcolato** dovrebbero non essere più 0 (per anno/shop con ordini conclusi).
