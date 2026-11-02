import { supabase, configured } from './supabase.js';

const url = (p) => new URL(p, location.href).href;
const need = () => { if (!configured) throw new Error('Configure SUPABASE_URL e SUPABASE_ANON_KEY em js/config.js.'); };

const MSG = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
  'User already registered': 'Este e-mail já está cadastrado.',
  'New password should be different from the old password.': 'A nova senha precisa ser diferente da atual.',
};
function fail(error) {
  if (!error) return;
  if (MSG[error.message]) throw new Error(MSG[error.message]);
  if (/provider.*not enabled|unsupported provider/i.test(error.message || '')) {
    throw new Error('O acesso com Google ainda não está habilitado no Supabase.');
  }
  if (/redirect_uri_mismatch|redirect.*uri|redirect.*url/i.test(error.message || '')) {
    throw new Error('A URL de retorno do Google não está autorizada. Confira as URLs de redirecionamento no Supabase e no Google Cloud.');
  }
  if (error.status === 429) throw new Error('Muitas tentativas. Aguarde um minuto e tente de novo.');
  throw new Error('Não foi possível concluir. Tente novamente.');
}

export const validateEmail = (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '') ? '' : 'Informe um e-mail válido.');
export const validatePassword = (v) => ((v || '').length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v) ? '' : 'Use 8 ou mais caracteres, com letras e números.');
export const validateUsername = (v) => (/^[A-Za-z0-9_]{3,20}$/.test(v || '') ? '' : 'Use 3 a 20 caracteres: letras, números e _.');

export async function signUp({ email, password, username }) {
  need();
  const { data: livre, error: e1 } = await supabase.rpc('username_disponivel', { p_username: username });
  fail(e1);
  if (!livre) throw new Error('Este nome de usuário já está em uso.');
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { username }, emailRedirectTo: url('index.html') },
  });
  fail(error);
  return { needsConfirm: !data.session };
}

export async function signIn({ email, password }) {
  need();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  fail(error);
}

export async function signInWithGoogle() {
  need();
  const redirectTo = new URL('index.html', location.href).href;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, queryParams: { prompt: 'select_account' } },
  });
  fail(error);
}

export function consumeOAuthError() {
  const current = new URL(location.href);
  const query = current.searchParams;
  const hashParams = new URLSearchParams(current.hash.slice(1));
  const code = query.get('error') || hashParams.get('error');
  if (!code) return '';

  const description = (query.get('error_description') || hashParams.get('error_description') || '').toLowerCase();
  const message = code === 'access_denied'
    ? 'A entrada com Google foi cancelada. Você pode tentar novamente.'
    : /redirect_uri_mismatch|redirect.*uri/.test(description)
      ? 'A URL de retorno do Google não está autorizada. Confira as configurações no Supabase e no Google Cloud.'
      : 'Não foi possível entrar com Google. Tente novamente.';

  for (const key of ['error', 'error_code', 'error_description', 'error_uri']) current.searchParams.delete(key);
  if (hashParams.has('error')) current.hash = '';
  history.replaceState(history.state, '', current.pathname + current.search + current.hash);
  return message;
}

export async function sendReset(email) {
  need();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: url('reset.html') });
  fail(error);
}

export async function updatePassword(password) {
  need();
  const { error } = await supabase.auth.updateUser({ password });
  fail(error);
}

export async function signOut() {
  await supabase?.auth.signOut();
  location.replace('index.html#login');
}

export async function getSession() {
  if (!configured) return null;
  return (await supabase.auth.getSession()).data.session;
}

export async function requireAuth() {
  const s = await getSession();
  if (!s) location.replace('index.html#login');
  return s;
}

export async function redirectIfAuth() {
  if (await getSession()) location.replace('dashboard.html');
}

export async function getProfile(id) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
  fail(error);
  return data;
}

export async function updateProfile(id, fields) {
  const { data, error } = await supabase.from('profiles').update(fields).eq('id', id).select().single();
  fail(error);
  return data;
}
