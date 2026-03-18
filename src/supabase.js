import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
  || 'https://aboyzijhjcnkeouppsbn.supabase.co'

const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'sb_publishable_k9fdoipXj5N2-zqH9JaL-w_zlOGOgNo'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

const PROJECT_KEY = 'galpao-piracema-v1'
const LS_KEY      = 'rzv-obra-v4'

export async function loadState() {
  try {
    const { data, error } = await supabase
      .from('obra_state')
      .select('phases, medicoes, pagamentos, config, saved_at')
      .eq('project_key', PROJECT_KEY)
      .single()

    if (!error && data) {
      const state = {
        phases:     data.phases     || [],
        medicoes:   data.medicoes   || [],
        pagamentos: data.pagamentos || [],
        config:     data.config     || {},
      }
      localStorage.setItem(LS_KEY, JSON.stringify(state))
      return state
    }
  } catch (e) {
    console.warn('[RZV] Supabase offline, usando cache local.', e)
  }

  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}

  return null
}

export async function saveState(state) {
  const payload = {
    project_key: PROJECT_KEY,
    phases:      state.phases      || [],
    medicoes:    state.medicoes    || [],
    pagamentos:  state.pagamentos  || [],
    config:      state.config      || {},
    saved_at:    new Date().toISOString(),
  }

  // Salva localmente primeiro (instantâneo)
  localStorage.setItem(LS_KEY, JSON.stringify(state))

  // Persiste no Supabase
  const { error } = await supabase
    .from('obra_state')
    .upsert(payload, { onConflict: 'project_key' })

  if (error) throw error
}
