import { requireAuth } from '../auth.js';
import { listEntries } from '../library.js';
import { searchAnime, slim } from '../kitsu.js';
import { mountNav } from '../nav.js';
import { animeCard } from '../cards.js';
import { toast, debounce } from '../ui.js';

const $ = (id) => document.getElementById(id);

if (await requireAuth()) {
  mountNav('buscar.html');
  let mine = new Map(), q = '', page = 1, ctl;
  listEntries().then((l) => { mine = new Map(l.map((e) => [e.mal_id, e])); }).catch(() => {});

  async function run() {
    ctl?.abort();
    if (q.length < 3) {
      $('res').replaceChildren(); $('pager').hidden = true;
      $('msg').textContent = 'Digite pelo menos 3 letras.';
      return;
    }
    ctl = new AbortController();
    const request = ctl;
    $('msg').textContent = 'Buscando…';
    try {
      const r = await searchAnime(q, page, request.signal);
      if (request.signal.aborted || ctl !== request) return;
      $('msg').textContent = r.items.length ? '' : 'Nenhum anime encontrado. Tente outro nome.';
      $('res').replaceChildren(...r.items.map((a) => { const s = slim(a); return animeCard(s, mine.get(s.mal_id)); }));
      $('pager').hidden = !(page > 1 || r.hasNext);
      $('prev').disabled = page <= 1;
      $('next').disabled = !r.hasNext;
      $('pg').textContent = 'Página ' + page;
    } catch (e) {
      if (e.name !== 'AbortError' && ctl === request) {
        const message = e instanceof TypeError
          ? 'Não foi possível conectar à Kitsu. Verifique sua conexão e tente novamente.'
          : e.message || 'Não foi possível buscar animes. Tente novamente.';
        $('msg').textContent = message;
        toast(message, 'err');
      }
    }
  }
  $('q').addEventListener('input', debounce(() => { q = $('q').value.trim(); page = 1; run(); }, 500));
  $('prev').onclick = () => { page--; run(); scrollTo(0, 0); };
  $('next').onclick = () => { page++; run(); scrollTo(0, 0); };
}
