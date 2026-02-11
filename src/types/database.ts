/**
 * Tipi allineati alle tabelle Supabase.
 * profili: RLS "Utenti vedono solo se stessi" (auth.uid() = id).
 * ordini: RLS "Utenti vedono solo ordini dei propri shop" (shop in shops_abilitati, case insensitive).
 */

export type Profilo = {
  id: string
  shops_abilitati: string[]
  nome: string | null
  logo_url: string | null
}

export type StatoOrdineRow = {
  id: number
  label_stati: string
  nomi_stati: string[]
}

/** Ordine: colonne usate per KPI e filtri. RLS già filtra per shops_abilitati. */
export type Ordine = {
  id: number
  id_ordine: number | null
  data_ordine: string
  ora_ordine: string | null
  nome_giorno: string | null
  stato_ordine: string | null
  totale_tasse_escluse: number | null
  rimborso_tasse_escluse: number | null
  totale_spese_spedizione: number | null
  valuta: string | null
  shop: string | null
  tipo_cliente: string | null
  id_cliente: number | null
  citta: string | null
  provincia: string | null
  stato: string | null
  gestione: string | null
  marketplace: string | null
}
