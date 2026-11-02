// Notificações persistentes (supabase/fase5.sql): geradas só por triggers no banco.
// O cliente apenas lê as próprias e marca como lidas via RPC.
import { supabase } from './supabase.js';

const fail = (e) => { if (e) throw new Error('Não foi possível carregar suas notificações. Tente novamente.'); };

export const KIND = {
  conquista: ['Conquista', 'fa-trophy'],
  nivel: ['Nível', 'fa-arrow-up'],
  desafio: ['Desafio', 'fa-bullseye'],
  sistema: ['Aviso', 'fa-circle-info'],
};

export async function listNotifications(limit = 50) {
  const { data, error } = await supabase.from('notifications')
    .select('id,kind,title,body,link,read_at,created_at').order('created_at', { ascending: false }).limit(limit);
  fail(error);
  return data;
}

export async function unreadCount() {
  const { data, error } = await supabase.rpc('unread_notifications');
  fail(error);
  return data ?? 0;
}

// ids nulo = todas.
export async function markRead(ids = null) {
  const { error } = await supabase.rpc('mark_notifications_read', { p_ids: ids });
  fail(error);
  refreshBell();
}

// Atualiza o contador do sino (montado por nav.js). Silencioso se a Fase 5 não estiver no banco.
export async function refreshBell() {
  const badge = document.querySelector('.bell .count');
  if (!badge) return;
  try {
    const n = await unreadCount();
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.hidden = n === 0;
    badge.closest('.bell').setAttribute('aria-label', n ? `Notificações: ${n} não lidas` : 'Notificações');
  } catch { badge.hidden = true; }
}

export const relTime = (iso) => {
  const s = Math.round((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 604800) return `há ${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
};
