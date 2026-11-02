import { supabase } from './supabase.js';
import { h } from './ui.js';
import { prepareImage } from './image.js';

const fail = (e) => { if (e) throw new Error('Não foi possível carregar os dados. Tente novamente.'); };
async function rpc(name, args) { const { data, error } = await supabase.rpc(name, args); fail(error); return data; }

export const getPublicProfile = async (u) => (await rpc('get_public_profile', { p_username: u }))[0] ?? null;
export const getPublicAchievements = (u) => rpc('public_achievements', { p_username: u });
export const getRanking = (period) => rpc('get_ranking', { p_period: period, p_limit: 50 });
export const myRank = async (period) => (await rpc('my_rank', { p_period: period }))[0] ?? null;

const KIND = { avatar: ['avatars', 256, 256], banner: ['banners', 1200, 400] };
const EXT = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' };

// Envia para <bucket>/<uid>/<uuid>.<ext> (política do Storage só permite a própria pasta).
export async function uploadImage(kind, file, uid) {
  const [bucket, w, hgt] = KIND[kind];
  const blob = await prepareImage(file, w, hgt);
  const path = `${uid}/${crypto.randomUUID()}.${EXT[blob.type] || 'webp'}`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
  if (error) throw new Error('Não foi possível enviar a imagem.');
  return { path, url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl };
}

// Apaga arquivo antigo (melhor esforço) a partir da URL pública.
export async function removeImage(kind, url) {
  if (!url) return;
  const bucket = KIND[kind][0], mark = `/object/public/${bucket}/`, i = url.indexOf(mark);
  if (i < 0) return;
  try { await supabase.storage.from(bucket).remove([url.slice(i + mark.length)]); } catch {}
}

export function avatarEl(p, cls = 'avatar') {
  const name = p.display_name || p.username || '?';
  return p.avatar_url
    ? h('div', { class: cls }, h('img', { src: p.avatar_url, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }))
    : h('div', { class: cls, 'aria-hidden': 'true' }, name.charAt(0).toUpperCase());
}
