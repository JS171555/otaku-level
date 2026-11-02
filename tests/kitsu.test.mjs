import test from 'node:test';
import assert from 'node:assert/strict';
import { getAnime, searchAnime, slim } from '../js/kitsu.js';

const originalFetch = globalThis.fetch;
const cache = new Map();
globalThis.sessionStorage = {
  getItem: (key) => cache.get(key) ?? null,
  setItem: (key, value) => cache.set(key, value),
};
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const record = (id = '901', extra = {}) => ({
  id,
  type: 'anime',
  attributes: {
    canonicalTitle: 'Exemplo Kitsu',
    titles: { en: 'Exemplo Kitsu', ja_jp: '例' },
    synopsis: 'Sinopse real do fixture de teste.',
    averageRating: '84.20',
    posterImage: { large: 'https://media.kitsu.app/anime/poster_images/901/large.jpg' },
    episodeCount: 24,
    showType: 'TV',
    startDate: '2024-01-10',
    ...extra,
  },
  relationships: { genres: { data: [{ type: 'genres', id: '7' }] } },
});

test.after(() => { globalThis.fetch = originalFetch; });

test('adapta resultado Kitsu ao snapshot interno e usa ID negativo', () => {
  const item = slim(record());
  assert.deepEqual(item, {
    mal_id: -901,
    title: 'Exemplo Kitsu',
    image_url: 'https://media.kitsu.app/anime/poster_images/901/large.jpg',
    anime_type: 'TV',
    episodes: 24,
    release_year: 2024,
  });
});

test('busca usa filter[text], 20 itens por página e offset correto; cacheia resultado', async () => {
  let calls = 0;
  let requested;
  globalThis.fetch = async (url) => {
    calls++;
    requested = new URL(url);
    return json({ data: [record()], links: { next: 'https://kitsu.io/api/edge/anime?page[offset]=20' } });
  };
  const first = await searchAnime(' teste anime ', 2);
  assert.equal(requested.searchParams.get('filter[text]'), 'teste anime');
  assert.equal(requested.searchParams.get('page[limit]'), '20');
  assert.equal(requested.searchParams.get('page[offset]'), '20');
  assert.equal(first.items[0].mal_id, -901);
  assert.equal(first.hasNext, true);
  const second = await searchAnime('teste anime', 2);
  assert.equal(second.items[0].title, 'Exemplo Kitsu');
  assert.equal(calls, 1);
});

test('detalhe inclui gêneros, nota média, sinopse e metadados', async () => {
  globalThis.fetch = async () => json({
    data: record('902'),
    included: [{ id: '7', type: 'genres', attributes: { name: 'Drama' } }],
  });
  const anime = await getAnime(-902);
  assert.equal(anime.title, 'Exemplo Kitsu');
  assert.equal(anime.synopsis, 'Sinopse real do fixture de teste.');
  assert.equal(anime.score, 8.42);
  assert.equal(anime.episodes, 24);
  assert.deepEqual(anime.genres, [{ name: 'Drama' }]);
  assert.equal(anime.mal_id, -902);
});

test('mapeia ID MAL antigo para Kitsu sem alterar a chave legada', async () => {
  const requests = [];
  globalThis.fetch = async (url) => {
    const parsed = new URL(url);
    requests.push(parsed);
    if (parsed.pathname.endsWith('/mappings')) {
      return json({
        data: [{
          id: 'map-1', type: 'mappings',
          attributes: { externalSite: 'myanimelist/anime', externalId: '123' },
          relationships: { item: { data: { type: 'anime', id: '903' } } },
        }],
        included: [{ id: '903', type: 'anime' }],
      });
    }
    return json({ data: record('903'), included: [] });
  };
  const anime = await getAnime(123);
  assert.equal(anime.kitsu_id, 903);
  assert.equal(anime.mal_id, 123);
  assert.equal(anime.legacy_mal_id, 123);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].searchParams.get('filter[externalSite]'), 'myanimelist/anime');
  assert.equal(requests[0].searchParams.get('filter[externalId]'), '123');
});
