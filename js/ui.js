const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches || !window.gsap;

export function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  document.getElementById('toasts').append(t);
  if (!calm()) gsap.from(t, { y: 16, opacity: 0, duration: 0.25 });
  setTimeout(() => t.remove(), 5000);
}

export function busy(btn, on) {
  btn.dataset.label ??= btn.innerHTML;
  btn.disabled = on;
  btn.setAttribute('aria-busy', on);
  btn.innerHTML = on ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Aguarde…' : btn.dataset.label;
}

export function fieldError(form, name, msg) {
  form.elements[name].setAttribute('aria-invalid', 'true');
  form.querySelector(`[data-err="${name}"]`).textContent = msg;
}

export function clearErrors(form) {
  form.querySelectorAll('[data-err]').forEach((e) => (e.textContent = ''));
  form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
}

// checks = { campo: mensagemDeErro | '' }. Retorna true se tudo estiver ok.
export function check(form, checks) {
  let ok = true;
  for (const [name, msg] of Object.entries(checks)) if (msg) { fieldError(form, name, msg); ok = false; }
  if (!ok) form.querySelector('[aria-invalid]')?.focus();
  return ok;
}

// Liga o submit com loading e tratamento de erro.
export function bind(form, handler) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const btn = form.querySelector('button[type=submit]');
    busy(btn, true);
    try { await handler(Object.fromEntries(new FormData(form))); }
    catch (err) { toast(err.message, 'err'); }
    finally { busy(btn, false); }
  });
}

// Único momento animado de entrada: a barra de XP da marca enche.
export function introXP() {
  const bar = document.querySelector('.xp i');
  if (bar && !calm()) gsap.fromTo(bar, { width: '0%' }, { width: '100%', duration: 1.4, ease: 'power3.out' });
}

// Fase 2: criar elementos sem innerHTML (dados da API nunca viram HTML) e debounce.
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== false && v != null) e.setAttribute(k, v);
  e.append(...kids.flat().filter((x) => x != null && x !== false));
  return e;
}
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
