import { requireAuth } from '../auth.js';
import { mountNav } from '../nav.js';
import { getRanking, myRank, avatarEl } from '../profile.js';
import { h, toast } from '../ui.js';

const $ = (id) => document.getElementById(id);
const PERIODS = [
  ['geral', 'Geral', 'Todo o XP acumulado.'],
  ['semanal', 'Semanal', 'XP ganho desde segunda-feira (horário de Brasília).'],
  ['mensal', 'Mensal', 'XP ganho neste mês (horário de Brasília).'],
];

if (await requireAuth()) {
  mountNav('ranking.html');
  let cur = location.hash.slice(1), seq = 0;
  if (!PERIODS.some(([k]) => k === cur)) cur = 'geral';

  async function load() {
    const mine = ++seq;
    $('tabs').replaceChildren(...PERIODS.map(([k, t]) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(k === cur) }, t);
      b.onclick = () => { cur = k; history.replaceState(null, '', '#' + k); load(); };
      return b;
    }));
    $('nota').textContent = PERIODS.find(([k]) => k === cur)[2];
    $('lista').replaceChildren();
    $('eu').textContent = 'Carregando…';
    try {
      const [rows, me] = await Promise.all([getRanking(cur), myRank(cur)]);
      if (mine !== seq) return;
      $('lista').replaceChildren(...rows.map((r) => h('li', { class: 'rank-row' + (r.is_me ? ' me' : '') },
        h('span', { class: 'pos' }, r.pos + 'º'),
        avatarEl(r, 'avatar sm'),
        h('a', { href: 'perfil.html?u=' + encodeURIComponent(r.username) }, r.display_name || r.username, h('small', {}, ' @' + r.username)),
        h('span', { class: 'lv' }, 'Nv. ' + r.level),
        h('b', {}, r.xp + ' XP'))));
      $('eu').textContent = !rows.length ? 'Ninguém pontuou neste período ainda.'
        : me ? `Sua posição: ${me.pos}º com ${me.xp} XP.`
        : 'Você ainda não pontuou neste período ou está fora do ranking pela sua privacidade.';
    } catch (e) { if (mine === seq) { $('eu').textContent = ''; toast(e.message, 'err'); } }
  }
  load();
}
