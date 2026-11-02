// Kitsu JSON:API. IDs Kitsu são guardados como negativos para coexistir
// com os IDs MAL positivos que já existem em library_entries.
const BASE = 'https://kitsu.io/api/edge';
const GAP = 1100;
let last = 0, chain = Promise.resolve();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function throttled(fn) {
  const run = chain.then(async () => {
    const wait = last + GAP - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    return fn();
  });
  chain = run.catch(() => {});
  return run;
}

const memory = new Map();
function cacheGet(key) {
  const value = memory.get(key);
  if (value && value.exp > Date.now()) return value.data;
  try {
    const stored = JSON.parse(sessionStorage.getItem('kitsu:' + key));
    if (stored && stored.exp > Date.now()) {
      memory.set(key, stored);
      return stored.data;
    }
  } catch {}
  return undefined;
}
function cacheSet(key, data, ttl) {
  const value = { data, exp: Date.now() + ttl };
  memory.set(key, value);
  try { sessionStorage.setItem('kitsu:' + key, JSON.stringify(value)); } catch {}
}

function apiError(response) {
  if (response.status === 404) return new Error('Anime não encontrado na Kitsu.');
  if (response.status === 429) return new Error('A Kitsu limitou as requisições. Aguarde um pouco e tente novamente.');
  if (response.status === 403) return new Error('A Kitsu recusou a requisição. Tente novamente mais tarde.');
  return new Error('A Kitsu está instável. Tente novamente em instantes.');
}

async function get(path, ttl, signal) {
  const cached = cacheGet(path);
  if (cached !== undefined) return cached;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal?.aborted) throw new DOMException('Requisição cancelada.', 'AbortError');
    const response = await throttled(() => {
      if (signal?.aborted) throw new DOMException('Requisição cancelada.', 'AbortError');
      return fetch(BASE + path, {
        signal,
        headers: {
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
        },
      });
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt === 2) throw apiError(response);
      const retryAfter = Number(response.headers.get('Retry-After'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1500 * (attempt + 1));
      continue;
    }
    if (!response.ok) throw apiError(response);

    const json = await response.json();
    cacheSet(path, json, ttl);
    return json;
  }
  throw new Error('Não foi possível concluir a requisição à Kitsu. Tente novamente.');
}

const SEARCH_TTL = 10 * 60 * 1000;
const DETAIL_TTL = 24 * 60 * 60 * 1000;
const MAX_PAGE_SIZE = 20;
const MAX_DB_ID = 2147483647;

function titleOf(attributes = {}) {
  const titles = attributes.titles || {};
  return attributes.canonicalTitle || titles.en || titles.en_jp || Object.values(titles).find((value) => typeof value === 'string' && value) || '';
}

function appAnime(record, included = [], legacyMalId = null) {
  const attributes = record?.attributes || {};
  const kitsuId = Number(record?.id);
  if (!Number.isSafeInteger(kitsuId) || kitsuId < 1 || kitsuId > MAX_DB_ID) {
    throw new Error('A Kitsu retornou um identificador de anime inválido.');
  }
  const genreIds = record?.relationships?.genres?.data || [];
  const genres = genreIds
    .map((relation) => included.find((item) => item.type === 'genres' && item.id === relation.id)?.attributes?.name)
    .filter(Boolean)
    .map((name) => ({ name }));
  const average = Number(attributes.averageRating);
  const year = Number(String(attributes.startDate || '').slice(0, 4));
  return {
    mal_id: legacyMalId ?? -kitsuId,
    kitsu_id: kitsuId,
    legacy_mal_id: legacyMalId,
    title: titleOf(attributes) || 'Título indisponível',
    title_japanese: attributes.titles?.ja_jp || attributes.titles?.en_jp || '',
    synopsis: attributes.synopsis || attributes.description || '',
    image_url: attributes.posterImage?.large || attributes.posterImage?.medium || attributes.posterImage?.original || null,
    anime_type: attributes.showType || attributes.subtype || null,
    episodes: Number.isInteger(attributes.episodeCount) ? attributes.episodeCount : null,
    release_year: Number.isInteger(year) && year >= 1900 && year <= 2100 ? year : null,
    score: Number.isFinite(average) && average > 0 ? Math.round((average / 10) * 100) / 100 : null,
    genres,
  };
}

// Normaliza resultados tanto da busca quanto do detalhe ao snapshot do Supabase.
export function slim(anime) {
  if (anime?.kitsu_id && anime?.mal_id) {
    return {
      mal_id: anime.mal_id,
      title: String(anime.title || '').slice(0, 300),
      image_url: anime.image_url || null,
      anime_type: anime.anime_type || null,
      episodes: anime.episodes ?? null,
      release_year: anime.release_year ?? null,
    };
  }
  const normalized = appAnime(anime);
  return slim(normalized);
}

export async function searchAnime(query, page = 1, signal) {
  const term = String(query ?? '').trim();
  if (term.length < 3) return { items: [], hasNext: false };
  const pageNumber = Math.max(1, Math.floor(Number(page) || 1));
  const limit = MAX_PAGE_SIZE;
  const params = new URLSearchParams();
  params.set('filter[text]', term);
  params.set('page[limit]', String(limit));
  params.set('page[offset]', String((pageNumber - 1) * limit));
  const path = `/anime?${params.toString()}`;
  const payload = await get(path, SEARCH_TTL, signal);
  const items = (payload.data || []).map((anime) => appAnime(anime, payload.included || []));
  return { items, hasNext: Boolean(payload.links?.next) };
}

async function getByKitsuId(kitsuId, signal) {
  const payload = await get(`/anime/${kitsuId}?include=genres`, DETAIL_TTL, signal);
  if (!payload.data) throw new Error('Anime não encontrado na Kitsu.');
  return appAnime(payload.data, payload.included || []);
}

async function resolveLegacyMalId(malId, signal) {
  const params = new URLSearchParams();
  params.set('filter[externalSite]', 'myanimelist/anime');
  params.set('filter[externalId]', String(malId));
  params.set('include', 'item');
  params.set('page[limit]', '1');
  params.set('page[offset]', '0');
  const payload = await get(`/mappings?${params.toString()}`, DETAIL_TTL, signal);
  const mapping = (payload.data || []).find((item) =>
    item.attributes?.externalSite === 'myanimelist/anime' && item.attributes?.externalId === String(malId));
  const relation = mapping?.relationships?.item?.data;
  const included = (payload.included || []).find((item) => item.type === 'anime' && item.id === relation?.id);
  if (!relation || !included) return null;
  return Number(included.id);
}

export async function getAnime(id, signal) {
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId) || numericId === 0 || Math.abs(numericId) > MAX_DB_ID) {
    throw new Error('Anime inválido.');
  }
  if (numericId < 0) return getByKitsuId(Math.abs(numericId), signal);

  // Compatibilidade: IDs positivos são registros MAL salvos antes da migração.
  const kitsuId = await resolveLegacyMalId(numericId, signal);
  if (!kitsuId) return null;
  const anime = await getByKitsuId(kitsuId, signal);
  return { ...anime, mal_id: numericId, legacy_mal_id: numericId };
}
