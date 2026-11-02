// Redimensiona e recorta (cover) no navegador. Reencodar via canvas remove EXIF/localização.
export const coverRect = (bw, bh, w, h) => {
  const k = Math.max(w / bw, h / bh), sw = w / k, sh = h / k;
  return [(bw - sw) / 2, (bh - sh) / 2, sw, sh];
};

export async function prepareImage(file, w, h) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use uma imagem JPG, PNG ou WebP.');
  if (file.size > 8 * 1024 * 1024) throw new Error('A imagem é muito grande (máximo 8 MB).');
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { throw new Error('Não foi possível ler essa imagem.'); }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(bmp, ...coverRect(bmp.width, bmp.height, w, h), 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.85));
  if (!blob) throw new Error('Não foi possível processar a imagem.');
  return blob;
}
