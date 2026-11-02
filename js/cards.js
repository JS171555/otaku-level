import { h } from './ui.js';

export const STATUS = {
  planejado: ['Planejado', 'fa-bookmark'],
  assistindo: ['Assistindo', 'fa-play'],
  concluido: ['Concluído', 'fa-check'],
  pausado: ['Pausado', 'fa-pause'],
  abandonado: ['Abandonado', 'fa-ban'],
};

// a = {mal_id,title,image_url}; IDs Kitsu negativos coexistem com registros MAL legados positivos.
export function animeCard(a, entry) {
  const tags = [];
  if (entry?.status) tags.push(h('span', { class: 'tag' }, STATUS[entry.status][0]));
  if (entry?.rating) tags.push(h('span', { class: 'tag' }, '★ ' + entry.rating));
  if (entry?.is_favorite) tags.push(h('span', { class: 'tag fav', 'aria-label': 'Favorito' }, h('i', { class: 'fa-solid fa-heart', 'aria-hidden': 'true' })));
  return h('a', { class: 'acard', href: 'anime.html?id=' + Number(a.mal_id) },
    h('img', { src: a.image_url || '', alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }),
    h('span', { class: 'ttl' }, a.title),
    h('span', { class: 'tags' }, ...tags));
}
