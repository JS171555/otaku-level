import { supabase } from '../supabase.js';
import { updatePassword, getSession, validatePassword } from '../auth.js';
import { toast, bind, check, introXP } from '../ui.js';

const $ = (id) => document.getElementById(id);
const form = $('f-reset');
let ready = false;
introXP();

function open() { ready = true; $('espera').hidden = true; form.hidden = false; form.elements.password.focus(); }

supabase?.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') open(); });
setTimeout(async () => {
  if (ready) return;
  if (await getSession()) open();
  else { $('espera').hidden = true; $('invalido').hidden = false; }
}, 2500);

bind(form, async (v) => {
  if (!check(form, { password: validatePassword(v.password), confirm: v.password === v.confirm ? '' : 'As senhas não coincidem.' })) return;
  await updatePassword(v.password);
  toast('Senha atualizada!');
  setTimeout(() => location.replace('dashboard.html'), 800);
});
