import { supabase } from '../supabase.js';
import { requireAuth, getProfile, updateProfile, signOut } from '../auth.js';
import { uploadImage, removeImage, avatarEl } from '../profile.js';
import { mountNav } from '../nav.js';
import { h, toast, bind, check } from '../ui.js';

const $ = (id) => document.getElementById(id);
const session = await requireAuth();

if (session) {
  mountNav('app.html');
  const f = $('f-perfil');
  let cur = {};
  const paint = (p) => {
    cur = p;
    $('nome').textContent = p.display_name || p.username;
    $('user').textContent = '@' + p.username;
    $('av').replaceChildren(...avatarEl(p).childNodes);
    $('banner').replaceChildren(...(p.banner_url ? [h('img', { src: p.banner_url, alt: 'Banner do perfil', referrerpolicy: 'no-referrer' })] : []));
    for (const k of ['show_in_ranking', 'show_stats', 'show_achievements']) f.elements[k].checked = p[k];
    f.elements.display_name.value = p.display_name;
    f.elements.bio.value = p.bio;
    f.elements.is_public.checked = p.is_public;
  };
  try { paint(await getProfile(session.user.id)); $('perfil').hidden = false; }
  catch (e) { toast(e.message, 'err'); }

  bind(f, async (v) => {
    const name = (v.display_name || '').trim();
    if (!check(f, {
      display_name: name.length >= 1 && name.length <= 40 ? '' : 'Use de 1 a 40 caracteres.',
      bio: v.bio.length <= 280 ? '' : 'Máximo de 280 caracteres.',
    })) return;
    paint(await updateProfile(session.user.id, { display_name: name, bio: v.bio.trim(), is_public: f.elements.is_public.checked,
      show_in_ranking: f.elements.show_in_ranking.checked, show_stats: f.elements.show_stats.checked, show_achievements: f.elements.show_achievements.checked }));
    toast('Perfil salvo.');
  });

  // Avatar e banner: reduz/recorta no navegador, envia ao Storage e só então grava a URL (validada no banco).
  async function swap(kind, file, input) {
    if (!file) return;
    const field = kind + '_url', old = cur[field];
    input.disabled = true;
    try {
      const up = await uploadImage(kind, file, session.user.id);
      try { paint(await updateProfile(session.user.id, { [field]: up.url })); }
      catch (e) { await removeImage(kind, up.url); throw e; }
      await removeImage(kind, old);
      toast('Imagem atualizada.');
    } catch (e) { toast(e.message, 'err'); }
    input.disabled = false; input.value = '';
  }
  async function clear(kind) {
    const field = kind + '_url', old = cur[field];
    if (!old) return;
    try { paint(await updateProfile(session.user.id, { [field]: null })); await removeImage(kind, old); toast('Imagem removida.'); }
    catch (e) { toast(e.message, 'err'); }
  }
  $('f-avatar').onchange = (e) => swap('avatar', e.target.files[0], e.target);
  $('f-banner').onchange = (e) => swap('banner', e.target.files[0], e.target);
  $('rm-avatar').onclick = () => clear('avatar');
  $('rm-banner').onclick = () => clear('banner');
  $('sair').onclick = signOut;

  supabase.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.replace('index.html#login'); });
}
