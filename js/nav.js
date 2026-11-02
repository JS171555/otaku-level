import { h } from './ui.js';
import { signOut } from './auth.js';
import { refreshBell } from './notifications.js';

const LINKS = [
  ['dashboard.html', 'fa-house', 'Início'],
  ['buscar.html', 'fa-magnifying-glass', 'Buscar'],
  ['biblioteca.html', 'fa-book-bookmark', 'Biblioteca'],
  ['conquistas.html', 'fa-trophy', 'Conquistas'],
  ['ranking.html', 'fa-ranking-star', 'Ranking'],
  ['app.html', 'fa-user', 'Perfil'],
];

export function mountNav(active) {
  const nav = document.getElementById('nav');
  nav.setAttribute('aria-label', 'Principal');
  const out = h('button', { type: 'button', class: 'out' }, h('i', { class: 'fa-solid fa-right-from-bracket', 'aria-hidden': 'true' }), h('span', {}, 'Sair'));
  out.onclick = signOut;
  nav.append(
    h('strong', { class: 'logo' }, 'OTAKU LEVEL'),
    ...LINKS.map(([href, ic, t]) => h('a', { href, 'aria-current': href === active ? 'page' : false }, h('i', { class: 'fa-solid ' + ic, 'aria-hidden': 'true' }), h('span', {}, t))),
    out,
  );
  // Sino de notificações (Fase 5): fixo no topo, fora do <nav> para não depender do layout da barra.
  const bell = h('a', { class: 'bell', href: 'notificacoes.html', 'aria-label': 'Notificações', 'aria-current': active === 'notificacoes.html' ? 'page' : false },
    h('i', { class: 'fa-solid fa-bell', 'aria-hidden': 'true' }), h('span', { class: 'count', hidden: '' }, '0'));
  document.body.append(bell);
  refreshBell();
}
