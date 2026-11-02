import { requireAuth, getProfile } from '../auth.js';
import { mountNav } from '../nav.js';
import { getPublicProfile, getPublicAchievements, avatarEl } from '../profile.js';
import { RARITY } from '../gamification.js';
import { h, toast } from '../ui.js';

const $ = (id) => document.getElementById(id);
const s = await requireAuth();

if (s) {
  const asked = new URLSearchParams(location.search).get('u');
  mountNav(asked ? 'ranking.html' : 'app.html');
  try {
    const u = asked || (await getProfile(s.user.id)).username;
    const p = /^[A-Za-z0-9_]{3,20}$/.test(u) ? await getPublicProfile(u) : null;
    if (!p) $('msg').textContent = 'Perfil não encontrado ou privado.';
    else {
      document.title = (p.display_name || p.username) + ' · OTAKU LEVEL';
      $('av').replaceChildren(...avatarEl(p).childNodes);
      $('pvb').replaceChildren(...(p.banner_url ? [h('img', { src: p.banner_url, alt: '', referrerpolicy: 'no-referrer' })] : []));
      $('nome').textContent = p.display_name || p.username;
      $('user').textContent = '@' + p.username;
      $('bio').textContent = p.bio || (p.is_self ? 'Você ainda não escreveu uma bio.' : '');
      $('editar').hidden = !p.is_self;

      if (p.level == null) {
        $('niv').textContent = '';
        $('stats').replaceChildren(h('p', { class: 'mut' }, 'Este otaku mantém as estatísticas privadas.'));
      } else {
        $('niv').textContent = `Nv. ${p.level} · ${p.title_name || 'Novato'}`;
        const st = [['Nível', p.level, 'fa-bolt'], ['XP', p.xp_total, 'fa-star'], ['Concluídos', p.n_completed, 'fa-check'],
          ['Na biblioteca', p.n_added, 'fa-book-bookmark'], ['Favoritos', p.n_favorites, 'fa-heart'],
          ['Nota média', p.avg_rating == null ? '—' : String(p.avg_rating).replace('.', ','), 'fa-star']];
        $('stats').replaceChildren(...st.map(([t, n, ic]) => h('div', { class: 'stat' }, h('i', { class: 'fa-solid ' + ic, 'aria-hidden': 'true' }), h('b', {}, String(n)), h('span', {}, t))));
        if (p.is_self && !p.show_stats) $('stats').after(h('p', { class: 'mut' }, 'Suas estatísticas estão ocultas para os outros.'));
      }

      if (!p.show_achievements && !p.is_self) $('conq').replaceChildren(h('p', { class: 'mut' }, 'As conquistas deste otaku são privadas.'));
      else {
        const list = await getPublicAchievements(u);
        $('conq').replaceChildren(...(list.length
          ? list.map((a) => h('article', { class: 'ach r-' + a.rarity },
              h('i', { class: 'fa-solid ' + a.icon, 'aria-hidden': 'true' }),
              h('div', {}, h('b', {}, a.name), h('p', {}, a.description), h('small', {}, RARITY[a.rarity]))))
          : [h('p', { class: 'mut' }, 'Nenhuma conquista desbloqueada ainda.')]));
      }
      $('msg').hidden = true;
      $('pv').hidden = false;
    }
  } catch (e) { $('msg').textContent = ''; toast(e.message, 'err'); }
}
