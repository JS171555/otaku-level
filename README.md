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

## Instalação como aplicativo (PWA)

O site inclui um manifesto PWA, ícones Android/iOS e um service worker para disponibilizar a interface estática e os recursos já carregados quando a rede estiver indisponível. Publique em HTTPS para permitir o registro do service worker.

- **Android:** abra o site no Chrome e escolha **Instalar app** ou **Adicionar à tela inicial** no menu do navegador.
- **iPhone:** abra o site no Safari, toque em **Compartilhar** e escolha **Adicionar à Tela de Início**. O ícone exibido usa `assets/apple-touch-icon.png`.

O início do app instalado abre `dashboard.html`; sem sessão válida, a autenticação existente redireciona para a tela de login.

## Configuração do Supabase

Edite `js/config.js` com a URL do projeto e a chave pública `anon`/publishable do Supabase. Nunca coloque uma chave `service_role` ou secret key no frontend.

Execute os scripts SQL em `supabase/` no Supabase SQL Editor, respeitando a ordem descrita no documento original de implantação.

## Estrutura

- `*.html`: páginas do site
- `css/`: estilos
- `js/`: autenticação, integração Supabase/Kitsu, gamificação e páginas
- `supabase/`: schema e migrações SQL
- `tests/`: testes de apoio
