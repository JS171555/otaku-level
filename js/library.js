import { supabase } from './supabase.js';

const COLS = 'mal_id,status,rating,is_favorite,title,image_url,anime_type,episodes,release_year,updated_at';
const STARTED = ['assistindo', 'concluido', 'pausado', 'abandonado'];
const fail = (e) => { if (e) throw new Error('Não foi possível acessar sua biblioteca. Tente novamente.'); };

export async function listEntries() {
  const { data, error } = await supabase.from('library_entries').select(COLS).order('updated_at', { ascending: false });
  fail(error);
  return data;
}

export async function getEntry(id) {
  const { data, error } = await supabase.from('library_entries').select(COLS).eq('mal_id', id).maybeSingle();
  fail(error);
  return data;
}

// anime = resultado de slim(); current = entrada atual (ou null); patch = {status?, rating?, is_favorite?}
export async function saveEntry(anime, current, patch) {
  const next = { status: current?.status ?? null, rating: current?.rating ?? null, is_favorite: current?.is_favorite ?? false, ...patch };
  if (!STARTED.includes(next.status)) next.rating = null;
  const t = supabase.from('library_entries');
  if (!next.status && !next.is_favorite) {
    if (current) fail((await t.delete().eq('mal_id', anime.mal_id)).error);
    return null;
  }
  const { data, error } = current
    ? await t.update({ status: next.status, rating: next.rating, is_favorite: next.is_favorite }).eq('mal_id', anime.mal_id).select(COLS).single()
    : await t.insert({ ...anime, ...next }).select(COLS).single();
  fail(error);
  return data;
}
