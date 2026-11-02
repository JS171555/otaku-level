import { signIn, signUp, sendReset, redirectIfAuth, validateEmail, validatePassword, validateUsername } from '../auth.js';
import { toast, bind, check, introXP } from '../ui.js';

const views = ['login', 'cadastro', 'recuperar'];
const $ = (id) => document.getElementById(id);

function show() {
  const h = location.hash.slice(1);
  const v = views.includes(h) ? h : 'login';
  views.forEach((n) => ($('v-' + n).hidden = n !== v));
  $('v-' + v).querySelector('input')?.focus({ preventScroll: true });
}
addEventListener('hashchange', show);
show();
introXP();
redirectIfAuth().catch(() => {});

bind($('f-login'), async (v) => {
  if (!check($('f-login'), { email: validateEmail(v.email), password: v.password ? '' : 'Informe sua senha.' })) return;
  await signIn(v);
  location.replace('dashboard.html');
});

bind($('f-cadastro'), async (v) => {
  const f = $('f-cadastro');
  if (!check(f, {
    username: validateUsername(v.username),
    email: validateEmail(v.email),
    password: validatePassword(v.password),
    confirm: v.password === v.confirm ? '' : 'As senhas não coincidem.',
  })) return;
  const { needsConfirm } = await signUp(v);
  if (needsConfirm) { toast('Conta criada! Confirme seu e-mail para entrar.'); location.hash = '#login'; f.reset(); }
  else location.replace('dashboard.html');
});

bind($('f-recuperar'), async (v) => {
  if (!check($('f-recuperar'), { email: validateEmail(v.email) })) return;
  await sendReset(v.email);
  toast('Se o e-mail existir, enviamos o link de recuperação.');
});
