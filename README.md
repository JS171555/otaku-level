<p align="center">
  <img src="assets/readme-logo-bordered.png" alt="Logo do OTAKU LEVEL com borda dourada e contorno escuro" width="176">
</p>

<h1 align="center">OTAKU LEVEL</h1>

<p align="center">
  Acompanhe seus animes, organize sua biblioteca e transforme cada conquista em progresso.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Interface-HTML%20%2F%20CSS%20%2F%20JavaScript-15143a?style=for-the-badge&logo=javascript&logoColor=ffc857" alt="Interface em HTML, CSS e JavaScript">
  <img src="https://img.shields.io/badge/Backend-Supabase-3ecf8e?style=for-the-badge&logo=supabase&logoColor=white" alt="Backend Supabase">
  <img src="https://img.shields.io/badge/Catálogo-Kitsu-6b5ce7?style=for-the-badge" alt="Catálogo Kitsu">
  <img src="https://img.shields.io/badge/Aplicativo-PWA-ff7aa8?style=for-the-badge&logo=pwa&logoColor=15143a" alt="Aplicativo web progressivo">
</p>

<p align="center">
  <a href="https://github.com/JS171555/otaku-level">Repositório</a>
  · HTML, CSS e JavaScript nativo
  · Interface em português
</p>

---

## Sobre o projeto

OTAKU LEVEL é uma aplicação web responsiva para quem acompanha animes. Ela combina catálogo e biblioteca pessoal com recursos de gamificação. A interface é feita com HTML, CSS e módulos JavaScript, sem etapa de compilação; autenticação, dados e regras de progresso são integrados ao Supabase, e as informações de anime vêm da API da Kitsu.

O projeto também pode ser instalado como PWA em dispositivos Android e iPhone. A interface estática e os recursos já carregados podem ser disponibilizados pelo cache do navegador; autenticação, catálogo e dados remotos continuam dependendo de conexão.

## Recursos

- Cadastro, login, recuperação e redefinição de senha.
- Busca e consulta de animes com informações do catálogo Kitsu.
- Biblioteca pessoal com estados de acompanhamento, avaliação e favoritos.
- Progresso de XP, níveis, títulos, conquistas e desafios semanais.
- Perfil com avatar, banner e opções de privacidade.
- Ranking por período e notificações persistentes.
- Layout adaptável para desktop e dispositivos móveis.
- Instalação PWA com ícones próprios para Android e iOS.

## Tecnologias

| Área | Tecnologia |
| --- | --- |
| Interface | HTML, CSS e JavaScript ES modules |
| Autenticação e dados | Supabase Auth, PostgreSQL, Storage e funções RPC |
| Catálogo de animes | Kitsu API |
| Instalação e cache da interface | Web App Manifest e Service Worker |
| Testes | Node.js Test Runner, Python e PostgreSQL descartável |

## Começar

### Requisitos

- Python 3 para servir o site localmente.
- Um projeto Supabase para autenticação e persistência.
- Navegador moderno com suporte a JavaScript ES modules.

### Clonar e executar

```bash
git clone https://github.com/JS171555/otaku-level.git
cd otaku-level
python3 -m http.server 5500
```

Abra [http://localhost:5500](http://localhost:5500). Sirva o projeto por HTTP ou HTTPS; não abra as páginas diretamente com `file://`, pois os módulos JavaScript e o service worker precisam de um servidor.

## Configuração do Supabase

1. Crie ou selecione um projeto Supabase.
2. Em `js/config.js`, configure a URL do projeto e a chave pública `anon` ou `publishable`.
3. No Supabase, configure a URL do site e as URLs de redirecionamento de autenticação para os endereços de desenvolvimento e produção que você utilizar.
4. No SQL Editor do Supabase, aplique os arquivos em ordem:
   1. `supabase/schema.sql` — tabelas e estrutura inicial.
   2. `supabase/fase2.sql` — biblioteca de animes.
   3. `supabase/migrate-kitsu.sql` — migração das restrições de identificadores para a integração com Kitsu; execute após a Fase 2 quando necessário.
   4. `supabase/fase3.sql` — XP, níveis e conquistas.
   5. `supabase/fase4.sql` — perfis públicos, privacidade, armazenamento e rankings.
   6. `supabase/fase5.sql` — notificações e desafios semanais.

Os scripts das fases indicam suas dependências nos comentários iniciais. A migração `migrate-kitsu.sql` destina-se a projetos que já possuem a Fase 2 e precisam adaptar a biblioteca existente à integração com Kitsu.

A chave `anon`/`publishable` é destinada ao uso no cliente e não substitui as políticas de segurança do banco. Nunca coloque uma chave `service_role`, secret key ou outra credencial privilegiada no código frontend.

## Instalar no celular

O site deve estar publicado em HTTPS para que o service worker seja ativado.

- **Android:** abra o site no Chrome e escolha **Instalar app** ou **Adicionar à tela inicial** no menu do navegador.
- **iPhone:** abra o site no Safari, toque em **Compartilhar** e selecione **Adicionar à Tela de Início**.

O manifesto define `dashboard.html` como início do aplicativo instalado. Se não houver uma sessão autenticada, o fluxo existente direciona a pessoa para a tela de login.

## Testes

Os testes SQL criam um PostgreSQL temporário. Instale as dependências Python:

```bash
python3 -m pip install pgserver "psycopg[binary]"
```

Execute os testes das fases do banco:

```bash
python3 tests/fase3.test.py
python3 tests/fase4.test.py
python3 tests/fase5.test.py
```

O projeto também contém testes do adaptador Kitsu em `tests/kitsu.test.mjs`, executados com o Node.js Test Runner.

## Estrutura do projeto

```text
.
├── assets/                 # Logo e ícones do site e da PWA
├── css/                    # Estilos das páginas públicas e da aplicação
├── js/                     # Autenticação, integração, navegação e lógica do app
│   └── pages/              # Inicialização das páginas
├── supabase/               # Schema, fases SQL e migração para Kitsu
├── tests/                  # Testes da integração e das fases do banco
├── *.html                  # Páginas da aplicação
├── manifest.webmanifest    # Nome, ícones e modo de exibição da PWA
└── sw.js                   # Cache da interface e recursos estáticos
```

## Publicação

O repositório é estático. Publique a raiz do projeto em GitHub Pages, Netlify, Cloudflare Pages ou outro provedor de hospedagem estática com suporte a HTTPS. Antes de liberar o site, confira as URLs de autenticação do Supabase e confirme que os arquivos do manifesto, os ícones e `sw.js` estão acessíveis no domínio publicado.

## Marca

A logo com fundo, usada no ícone instalado, está em `assets/pwa-icon-512.png`. A versão transparente para as telas de autenticação está em `assets/otaku-level-logo-transparent.png`.
