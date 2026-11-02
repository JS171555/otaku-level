import { requireAuth, getProfile } from '../auth.js';
import { listEntries } from '../library.js';
import { mountNav } from '../nav.js';
import { animeCard, STATUS } from '../cards.js';
import { h, toast } from '../ui.js';
import { progress, paintLevel } from '../gamification.js';
import { paintChallenges } from '../challenges.js';
import { avatarEl } from '../profile.js';

const $ = (id) => document.getElementById(id);
const s = await requireAuth();

if (s) {
  mountNav('dashboard.html');
  progress().then((p) => paintLevel($('nivel'), p)).catch(() => {});
  paintChallenges($('desafios'), (p) => paintLevel($('nivel'), p))
    .catch((e) => $('desafios').replaceChildren(h('p', { class: 'mut' }, e.message)));
  try {
    const [p, list] = await Promise.all([getProfile(s.user.id), listEntries()]);
    const avatar = avatarEl(p, 'avatar home-avatar');
    avatar.id = 'home-avatar';
    $('home-avatar').replaceWith(avatar);
    $('ola').textContent = 'Olá, ' + (p.display_name || p.username);
    const rated = list.filter((e) => e.rating);
    const avg = rated.length ? (rated.reduce((a, e) => a + e.rating, 0) / rated.length).toFixed(1).replace('.', ',') : '—';
    const stats = [
      ...Object.entries(STATUS).map(([k, [t, ic]]) => [t, list.filter((e) => e.status === k).length, ic]),
      ['Favoritos', list.filter((e) => e.is_favorite).length, 'fa-heart'],
      ['Nota média', avg, 'fa-star'],
    ];
    $('stats').replaceChildren(...stats.map(([t, n, ic]) => h('div', { class: 'stat' }, h('i', { class: 'fa-solid ' + ic, 'aria-hidden': 'true' }), h('b', {}, String(n)), h('span', {}, t))));
    const rec = list.slice(0, 6);
    $('recentes').replaceChildren(...(rec.length
      ? rec.map((e) => animeCard(e, e))
      : [h('p', { class: 'mut' }, 'Sua biblioteca está vazia. ', h('a', { href: 'buscar.html' }, 'Busque um anime'), ' para começar.')]));
  } catch (e) { toast(e.message, 'err'); }
}
