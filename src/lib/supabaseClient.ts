import { createClient } from '@supabase/supabase-js'

// TODO: incolla qui le credenziali del tuo progetto Supabase.
// Puoi trovare questi valori nella dashboard Supabase:
// Settings → API → Project URL e anon public.
const SUPABASE_URL = 'https://yjiovrmlfnndvgfpxges.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqaW92cm1sZm5uZHZnZnB4Z2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMDIyMzgsImV4cCI6MjA4NTc3ODIzOH0.q32Zu1Jca0qZ9Q4TjvYnUm4W6uif-kWHpcyeC5ZH6gI'

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Nota: questo serve solo come promemoria in fase di sviluppo.
  // L'app continuerà a compilare, ma le chiamate a Supabase falliranno
  // finché non imposterai i valori corretti.
  // eslint-disable-next-line no-console
  console.warn(
    '[Supabase] SUPABASE_URL o SUPABASE_ANON_KEY non sono impostati. ' +
      'Inserisci i valori reali in src/lib/supabaseClient.ts.',
  )
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

