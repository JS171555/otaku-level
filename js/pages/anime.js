import { requireAuth } from '../auth.js';
import { getEntry, saveEntry } from '../library.js';
import { getAnime, slim } from '../kitsu.js';
import { mountNav } from '../nav.js';
import { STATUS } from '../cards.js';
import { h, toast } from '../ui.js';
import { progress, announce } from '../gamification.js';

const $ = (id) => document.getElementById(id);
const STARTED = ['assistindo', 'concluido', 'pausado', 'abandonado'];
const id = Number(new URLSearchParams(location.search).get('id'));

if (await requireAuth()) {
  mountNav('buscar.html');
  if (!Number.isSafeInteger(id) || id === 0) $('msg').textContent = 'Anime inválido.';
  else {
    try {
      const [a, first] = await Promise.all([getAnime(id), getEntry(id)]);
      let entry = first;
      let before = await progress().catch(() => null);
      if (!a && first) {
        // Se a Kitsu não tiver mapping para um anime antigo, mantenha acessível
        // o snapshot salvo e as ações da biblioteca sem inventar metadados.
        Object.assign(first, { title_japanese: '', synopsis: '', genres: [], score: null });
      }
      if (!a && !first) throw new Error('Anime não encontrado na Kitsu.');
      const details = a || first;
      const s = details.kitsu_id ? slim(details) : details;
      document.title = s.title + ' · OTAKU LEVEL';
      $('cover').src = s.image_url || '';
      $('cover').alt = 'Capa de ' + s.title;
      $('tt').textContent = s.title;
      $('jp').textContent = details.title_japanese || '';
      const meta = [s.anime_type, s.episodes ? s.episodes + ' episódios' : null, s.release_year, details.score ? '★ ' + details.score + ' (Kitsu)' : null, details.genres?.map((g) => g.name).join(', ')].filter(Boolean);
      $('meta').replaceChildren(...meta.map((m) => h('li', {}, String(m))));
      $('sin').textContent = details.synopsis || 'Sem sinopse disponível.';
      $('st').append(...Object.entries(STATUS).map(([k, [t]]) => h('option', { value: k }, t)));
      $('rt').append(...Array.from({ length: 10 }, (_, i) => h('option', { value: i + 1 }, String(i + 1))));

      const sync = () => {
        $('st').value = entry?.status || '';
        $('rt').value = entry?.rating || '';
        $('rt').disabled = !STARTED.includes(entry?.status);
        const on = !!entry?.is_favorite;
        $('fav').setAttribute('aria-pressed', String(on));
        $('fav').replaceChildren(h('i', { class: (on ? 'fa-solid' : 'fa-regular') + ' fa-heart', 'aria-hidden': 'true' }), on ? ' Favorito' : ' Favoritar');
      };
      async function apply(patch) {
        const els = [$('st'), $('rt'), $('fav')];
        els.forEach((x) => (x.disabled = true));
        try { entry = await saveEntry(s, entry, patch); toast('Salvo.'); try { before = await announce(before); } catch {} }
        catch (err) { toast(err.message, 'err'); }
        els.forEach((x) => (x.disabled = false));
        sync();
      }
      $('st').onchange = (ev) => apply({ status: ev.target.value || null });
      $('rt').onchange = (ev) => apply({ rating: ev.target.value ? Number(ev.target.value) : null });
      $('fav').onclick = () => apply({ is_favorite: !entry?.is_favorite });
      sync();
      $('msg').hidden = true;
      $('det').hidden = false;
    } catch (e) { $('msg').textContent = e.message; }
  }
}
