import { requireAuth } from '../auth.js';
import { mountNav } from '../nav.js';
import { progress, achievements, titles, equipTitle, history, paintLevel, RARITY, ACTION } from '../gamification.js';
import { h, toast } from '../ui.js';

const $ = (id) => document.getElementById(id);

if (await requireAuth()) {
  mountNav('conquistas.html');
  try {
    const [p, ach, tit, hist] = await Promise.all([progress(), achievements(), titles(), history()]);
    paintLevel($('nivel'), p);

    const sel = $('titulo');
    let atual = tit.find((t) => t.equipped)?.code || '';
    sel.append(h('option', { value: '' }, 'Automático (pelo nível)'),
      ...tit.map((t) => h('option', { value: t.code, disabled: !t.unlocked }, t.unlocked ? t.name : `${t.name} — ${t.requirement}`)));
    sel.value = atual;
    sel.onchange = async () => {
      try { await equipTitle(sel.value); atual = sel.value; paintLevel($('nivel'), await progress()); toast('Título atualizado.'); }
      catch (e) { sel.value = atual; toast(e.message, 'err'); }
    };

    $('resumo').textContent = `${ach.filter((a) => a.unlocked).length} de ${ach.length} desbloqueadas`;
    $('conq').replaceChildren(...Object.keys(RARITY).map((r) => {
      const items = ach.filter((a) => a.rarity === r);
      return h('section', { class: 'rar r-' + r },
        h('h3', {}, `${RARITY[r]} (${items.filter((a) => a.unlocked).length}/${items.length})`),
        h('div', { class: 'ach-grid' }, ...items.map((a) => h('article', { class: 'ach' + (a.unlocked ? '' : ' locked') },
          h('i', { class: 'fa-solid ' + a.icon, 'aria-hidden': 'true' }),
          h('div', {}, h('b', {}, a.name), h('p', {}, a.description),
            h('small', {}, [a.is_secret ? 'Secreta' : null, a.xp_reward != null ? `+${a.xp_reward} XP` : null, a.unlocked ? 'Desbloqueada' : 'Bloqueada'].filter(Boolean).join(' · ')))))));
    }));

    $('hist').replaceChildren(...(hist.length
      ? hist.map((e) => h('li', {}, h('b', {}, `+${e.xp} XP`), ` ${ACTION[e.action] || e.action}${e.detail ? ': ' + e.detail : ''} `, h('small', {}, new Date(e.created_at).toLocaleDateString('pt-BR'))))
      : [h('li', { class: 'mut' }, 'Nenhum XP ainda. Adicione e conclua animes na sua biblioteca!')]));
  } catch (e) { toast(e.message, 'err'); }
}
