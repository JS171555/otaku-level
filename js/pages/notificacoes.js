import { requireAuth } from '../auth.js';
import { mountNav } from '../nav.js';
import { listNotifications, markRead, KIND, relTime } from '../notifications.js';
import { h, toast, busy } from '../ui.js';

const $ = (id) => document.getElementById(id);
const FILTERS = [['todas', 'Todas'], ['nao_lidas', 'Não lidas'], ...Object.entries(KIND).filter(([k]) => k !== 'sistema').map(([k, [t]]) => [k, t])];

if (await requireAuth()) {
  mountNav('notificacoes.html');
  let all = [], cur = 'todas';

  const paint = () => {
    $('filtro').replaceChildren(...FILTERS.map(([k, t]) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(k === cur) }, t);
      b.onclick = () => { cur = k; paint(); };
      return b;
    }));
    const list = all.filter((n) => cur === 'todas' || (cur === 'nao_lidas' ? !n.read_at : n.kind === cur));
    $('todas').hidden = !all.some((n) => !n.read_at);
    $('msg').hidden = list.length > 0;
    $('msg').textContent = list.length ? '' : (all.length ? 'Nada neste filtro.' : 'Você ainda não tem notificações. Conquistas, níveis e desafios aparecerão aqui.');
    $('lista').replaceChildren(...list.map((n) => {
      const [label, icon] = KIND[n.kind] || KIND.sistema;
      const open = async (e) => {
        if (!n.read_at) { e.preventDefault(); try { await markRead([n.id]); } catch {} location.href = n.link || 'dashboard.html'; }
      };
      const a = h('a', { href: n.link || 'dashboard.html', class: 'notif' + (n.read_at ? '' : ' unread') },
        h('i', { class: 'fa-solid ' + icon + ' k-' + n.kind, 'aria-hidden': 'true' }),
        h('span', { class: 'notif-body' }, h('b', {}, n.title), n.body ? h('span', { class: 'mut' }, n.body) : null,
          h('small', {}, label + ' · ' + relTime(n.created_at))),
        n.read_at ? null : h('span', { class: 'dot', 'aria-label': 'Não lida' }));
      a.onclick = open;
      return h('li', {}, a);
    }));
  };

  $('todas').onclick = async (e) => {
    const btn = e.currentTarget; busy(btn, true);
    try { await markRead(null); const t = new Date().toISOString(); all.forEach((n) => (n.read_at ??= t)); paint(); toast('Tudo lido.'); }
    catch (err) { toast(err.message, 'err'); }
    finally { busy(btn, false); }
  };

  try { all = await listNotifications(); paint(); }
  catch (e) { $('msg').textContent = e.message; }
}
