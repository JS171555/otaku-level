import { signIn, signInWithGoogle, consumeOAuthError, signUp, sendReset, redirectIfAuth, validateEmail, validatePassword, validateUsername } from '../auth.js';
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
const oauthError = consumeOAuthError();
if (oauthError) toast(oauthError, 'err');
redirectIfAuth().catch((error) => toast(error.message, 'err'));

const googleButtons = [...document.querySelectorAll('[data-google-auth]')];
googleButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    if (googleButtons.some((item) => item.disabled)) return;
    googleButtons.forEach((item) => {
      item.dataset.originalLabel = item.innerHTML;
      item.disabled = true;
      item.setAttribute('aria-busy', 'true');
      item.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Conectando ao Google…';
    });
    try {
      await signInWithGoogle();
    } catch (error) {
      toast(error.message, 'err');
    } finally {
      googleButtons.forEach((item) => {
        item.disabled = false;
        item.removeAttribute('aria-busy');
        item.innerHTML = item.dataset.originalLabel;
      });
    }
  });
});

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
