import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
  || 'https://aboyzijhjcnkeouppsbn.supabase.co'

const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'sb_publishable_k9fdoipXj5N2-zqH9JaL-w_zlOGOgNo'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: false },
})

const PROJECT_KEY = 'galpao-piracema-v1'
const LS_KEY      = 'rzv-obra-v4'

// ─── Carregar estado ──────────────────────────────────────────────────────────
export async function loadState() {
  try {
    const { data, error } = await supabase
      .from('obra_state')
      .select('phases, medicoes, pagamentos, config, saved_at')
      .eq('project_key', PROJECT_KEY)
      .maybeSingle()

    if (error) {
      console.error('[RZV] ❌ Erro ao carregar:', error.message)
      throw error
    }

    if (data && Array.isArray(data.phases) && data.phases.length > 0) {
      const state = {
        phases:     data.phases,
        medicoes:   data.medicoes   || [],
        pagamentos: data.pagamentos || [],
        config:     data.config     || {},
      }
      // Atualiza cache local com dados do banco
      localStorage.setItem(LS_KEY, JSON.stringify(state))
      console.log('[RZV] ✅ Carregado do Supabase:', {
        fases: state.phases.length,
        medicoes: state.medicoes.length,
        pagamentos: state.pagamentos.length,
      })
      return state
    }

    // Supabase retornou fases vazias — usa localStorage se tiver dados
    console.warn('[RZV] ⚠️ Supabase com fases vazias, tentando localStorage...')
  } catch (e) {
    console.warn('[RZV] ⚠️ Supabase falhou:', e.message)
  }

  // Fallback: localStorage
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const cached = JSON.parse(raw)
      if (Array.isArray(cached.phases) && cached.phases.length > 0) {
        console.log('[RZV] 📦 Carregado do localStorage')
        // Tenta sincronizar o cache de volta para o Supabase
        saveState(cached).catch(e => console.warn('[RZV] Sync falhou:', e.message))
        return cached
      }
    }
  } catch {}

  console.log('[RZV] 🆕 Iniciando com dados padrão')
  return null
}

// ─── Salvar estado — usa UPDATE direto (linha sempre existe) ──────────────────
export async function saveState(state) {
  // Salva local imediatamente
  localStorage.setItem(LS_KEY, JSON.stringify(state))

  const { error } = await supabase
    .from('obra_state')
    .update({
      phases:     state.phases      || [],
      medicoes:   state.medicoes    || [],
      pagamentos: state.pagamentos  || [],
      config:     state.config      || {},
      saved_at:   new Date().toISOString(),
    })
    .eq('project_key', PROJECT_KEY)

  if (error) {
    console.error('[RZV] ❌ Erro ao salvar:', error.message, error.code)
    throw new Error(error.message)
  }

  console.log('[RZV] ✅ Salvo no Supabase:', {
    fases: (state.phases||[]).length,
    pagamentos: (state.pagamentos||[]).length,
  })
}
