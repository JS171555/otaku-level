# OTAKU LEVEL

Plataforma web de gamificação para fãs de anime. Frontend em HTML, CSS e JavaScript (ES modules), com Supabase para autenticação e persistência e Kitsu para catálogo de animes.

## Executar localmente

Sirva esta pasta por HTTP (não abra os HTML diretamente via `file://`):

```bash
python3 -m http.server 5500
```

Acesse http://localhost:5500/.

## Publicação

A raiz deste repositório contém o site estático. Pode ser publicado em GitHub Pages, Netlify, Cloudflare Pages ou qualquer hospedagem estática, usando a raiz como diretório de publicação.

## Configuração do Supabase

Edite `js/config.js` com a URL do projeto e a chave pública `anon`/publishable do Supabase. Nunca coloque uma chave `service_role` ou secret key no frontend.

Execute os scripts SQL em `supabase/` no Supabase SQL Editor, respeitando a ordem descrita no documento original de implantação.

## Estrutura

- `*.html`: páginas do site
- `css/`: estilos
- `js/`: autenticação, integração Supabase/Kitsu, gamificação e páginas
- `supabase/`: schema e migrações SQL
- `tests/`: testes de apoio
