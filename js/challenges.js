// Desafios semanais (supabase/fase5.sql): progresso e resgate validados no banco.
import { supabase } from './supabase.js';
import { h, toast, busy } from './ui.js';
import { progress, announce } from './gamification.js';
import { refreshBell } from './notifications.js';

export async function myChallenges() {
  const { data, error } = await supabase.rpc('my_challenges');
  if (error) throw new Error('Não foi possível carregar os desafios.');
  return data;
}

const ERR = {
  'Desafio ainda não concluído': 'Complete o desafio antes de resgatar.',
  'Desafio já resgatado': 'Você já resgatou este desafio nesta semana.',
};

export async function claim(code) {
  const { data, error } = await supabase.rpc('claim_challenge', { p_code: code });
  if (error) throw new Error(ERR[error.message] || 'Não foi possível resgatar. Tente novamente.');
  return data;
}

const ends = (iso) => {
  const d = Math.ceil((new Date(iso) - Date.now()) / 86400000);
  return d <= 1 ? 'Termina hoje' : `Termina em ${d} dias`;
};

// Pinta a lista no elemento; onClaim é chamado após resgatar (para atualizar o cartão de nível).
export async function paintChallenges(el, onClaim) {
  const list = await myChallenges();
  if (!list.length) { el.replaceChildren(h('p', { class: 'mut' }, 'Nenhum desafio ativo nesta semana.')); return; }
  const note = h('p', { class: 'mut ch-note' }, h('i', { class: 'fa-regular fa-clock', 'aria-hidden': 'true' }), ' ', ends(list[0].week_end), ' · renova toda segunda-feira');
  el.replaceChildren(note, h('div', { class: 'ch-grid' }, ...list.map((c) => card(c))));

  function card(c) {
    const done = c.progress >= c.target;
    const pct = Math.round((c.progress / c.target) * 100);
    const btn = h('button', { type: 'button', class: 'ch-btn', disabled: c.claimed || !done ? '' : false },
      c.claimed ? 'Resgatado' : done ? `Resgatar +${c.xp_reward} XP` : `${c.progress}/${c.target}`);
    btn.onclick = async () => {
      const prev = await progress().catch(() => null);
      busy(btn, true);
      try {
        await claim(c.code);
        const now = await announce(prev);
        refreshBell();
        await paintChallenges(el, onClaim);
        onClaim?.(now);
      } catch (e) { toast(e.message, 'err'); busy(btn, false); }
    };
    return h('article', { class: 'ch' + (c.claimed ? ' claimed' : done ? ' ready' : '') },
      h('i', { class: 'fa-solid ' + c.icon, 'aria-hidden': 'true' }),
      h('div', { class: 'ch-body' },
        h('b', {}, c.name), h('p', {}, c.description),
        h('div', { class: 'bar', role: 'progressbar', 'aria-label': 'Progresso de ' + c.name, 'aria-valuemin': 0, 'aria-valuemax': c.target, 'aria-valuenow': c.progress }, h('i', { style: 'width:' + pct + '%' })),
        h('div', { class: 'ch-foot' }, h('small', {}, `+${c.xp_reward} XP`), btn)));
  }
}
