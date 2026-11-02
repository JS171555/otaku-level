import { requireAuth } from '../auth.js';
import { listEntries } from '../library.js';
import { mountNav } from '../nav.js';
import { animeCard, STATUS } from '../cards.js';
import { h, toast } from '../ui.js';

const $ = (id) => document.getElementById(id);
const FILTERS = [['todos', 'Todos'], ['favoritos', 'Favoritos'], ...Object.entries(STATUS).map(([k, [t]]) => [k, t])];
const PAGE = 24;

if (await requireAuth()) {
  mountNav('biblioteca.html');
  let list = [], f = location.hash.slice(1), shown = PAGE;
  if (!FILTERS.some(([k]) => k === f)) f = 'todos';
  const match = (k, e) => k === 'todos' || (k === 'favoritos' ? e.is_favorite : e.status === k);

  function render() {
    $('tabs').replaceChildren(...FILTERS.map(([k, t]) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(k === f) }, `${t} (${list.filter((e) => match(k, e)).length})`);
      b.onclick = () => { f = k; shown = PAGE; history.replaceState(null, '', '#' + k); render(); };
      return b;
    }));
    const items = list.filter((e) => match(f, e));
    $('grid').replaceChildren(...items.slice(0, shown).map((e) => animeCard(e, e)));
    $('vazio').hidden = items.length > 0;
    $('mais').hidden = items.length <= shown;
  }
  $('mais').onclick = () => { shown += PAGE; render(); };
  try { list = await listEntries(); } catch (e) { toast(e.message, 'err'); }
  render();
}
