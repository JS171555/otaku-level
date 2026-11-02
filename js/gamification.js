// XP, níveis, conquistas e títulos: TUDO é calculado no banco (supabase/fase3.sql).
// O cliente só lê o resultado e pede ações validadas (equipar título).
import { supabase } from './supabase.js';
import { h, toast } from './ui.js';
import { refreshBell } from './notifications.js';

export const RARITY = { comum: 'Comum', rara: 'Rara', epica: 'Épica', lendaria: 'Lendária' };
export const ACTION = { adicionar: 'Adicionou', iniciar: 'Começou', completar: 'Concluiu', avaliar: 'Avaliou', favoritar: 'Favoritou', conquista: 'Conquista', desafio: 'Desafio' };
const fail = (e) => { if (e) throw new Error('Não foi possível carregar seu progresso. Tente novamente.'); };

async function rpc(name, args) { const { data, error } = await supabase.rpc(name, args); fail(error); return data; }

export const progress = async () => (await rpc('my_progress'))[0];
export const achievements = () => rpc('list_achievements');
export const titles = () => rpc('my_titles');

export async function equipTitle(code) {
  const { error } = await supabase.rpc('equip_title', { p_code: code || null });
  if (error) throw new Error('Título indisponível.');
}

export async function history(limit = 30) {
  const { data, error } = await supabase.from('xp_events').select('action,xp,detail,created_at')
    .order('created_at', { ascending: false }).limit(limit);
  fail(error);
  return data;
}

// Cartão de nível: badge, título, barra de progresso e XP do dia.
export function paintLevel(el, p) {
  const span = p.level_next - p.level_start;
  const pct = Math.max(0, Math.min(100, Math.round(((p.xp_total - p.level_start) / span) * 100)));
  el.replaceChildren(
    h('div', { class: 'lvl-head' },
      h('span', { class: 'lvl-badge', 'aria-label': 'Nível ' + p.level }, 'Nv. ' + p.level),
      h('strong', {}, p.title_name || 'Novato')),
    h('div', { class: 'bar', role: 'progressbar', 'aria-label': 'Progresso para o próximo nível', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct }, h('i', { style: 'width:' + pct + '%' })),
    h('p', { class: 'mut' }, `${p.xp_total} XP · faltam ${p.level_next - p.xp_total} para o nível ${p.level + 1}`),
    h('p', { class: 'mut' }, `Hoje: ${p.xp_today} / ${p.daily_cap} XP`));
}

// Chame depois de salvar na biblioteca: mostra XP ganho, subida de nível e conquistas novas.
export async function announce(prev) {
  const [now, unlocked] = await Promise.all([progress(), rpc('pop_new_achievements')]);
  const gain = now.xp_total - (prev?.xp_total ?? now.xp_total);
  if (gain > 0) toast(`+${gain} XP`);
  if (prev && now.level > prev.level) toast(`Nível ${now.level}! Você agora é ${now.title_name}.`);
  unlocked.slice(0, 3).forEach((a) => toast(`Conquista ${RARITY[a.rarity].toLowerCase()}: ${a.name}`));
  if (unlocked.length > 3) toast(`+${unlocked.length - 3} conquistas desbloqueadas`);
  if (gain > 0) refreshBell();
  return now;
}
