<div align="center">
  <img src="assets/readme-logo-rounded.png" alt="Logo do OTAKU LEVEL" width="160">
  <h1>OTAKU LEVEL</h1>
  <p><strong>Organize seus animes. Acompanhe suas conquistas. Suba de nível.</strong></p>
  <p>Biblioteca pessoal de animes com catálogo Kitsu, desafios semanais e progresso em XP.</p>
  <p>
    <img src="https://img.shields.io/badge/JavaScript-ES%20Modules-ffc857?style=flat-square&amp;labelColor=15143a" alt="JavaScript ES Modules">
    <img src="https://img.shields.io/badge/Supabase-Auth%20%7C%20Database%20%7C%20Storage-3ecf8e?style=flat-square&amp;labelColor=15143a" alt="Supabase: Auth, Database e Storage">
    <img src="https://img.shields.io/badge/Cat%C3%A1logo-Kitsu-6b5ce7?style=flat-square&amp;labelColor=15143a" alt="Catálogo Kitsu">
    <img src="https://img.shields.io/badge/PWA-instal%C3%A1vel-ff7aa8?style=flat-square&amp;labelColor=15143a" alt="PWA instalável">
  </p>
  <p>
    <a href="#recursos">Recursos</a> ·
    <a href="#executar-localmente">Execução local</a> ·
    <a href="#configuração">Configuração</a> ·
    <a href="#testes">Testes</a>
  </p>
</div>

O **OTAKU LEVEL** é uma aplicação web responsiva para acompanhar animes e organizar uma biblioteca pessoal. Reúne busca, avaliações e favoritos com XP, níveis, títulos, conquistas e desafios semanais.

A interface é feita com HTML, CSS e módulos JavaScript, sem etapa de compilação. O Supabase cuida da autenticação, da persistência e das regras de progresso; a API da Kitsu fornece o catálogo de animes. A interface está em português e pode ser instalada como **Progressive Web App (PWA)** em navegadores compatíveis.

> **Para executar uma instalação própria:** configure seu projeto Supabase, aplique os scripts SQL e autorize as URLs de autenticação. O login com Google requer configuração adicional do provedor. Catálogo e dados remotos dependem de conexão.

## Sumário

- [Recursos](#recursos)
- [Tecnologias](#tecnologias)
- [Executar localmente](#executar-localmente)
- [Configuração](#configuração)
- [Primeiros passos no aplicativo](#primeiros-passos-no-aplicativo)
- [Páginas do aplicativo](#páginas-do-aplicativo)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Testes](#testes)
- [Publicação e PWA](#publicação-e-pwa)
- [Solução de problemas](#solução-de-problemas)
- [Contribuição](#contribuição)
- [Licença](#licença)

## Recursos

| Área | Funcionalidades |
| --- | --- |
| **Conta** | Cadastro e login por e-mail e senha, recuperação de senha e autenticação com Google OAuth. |
| **Catálogo** | Busca de animes na Kitsu, sinopse, gêneros, nota média e informações da obra. |
| **Biblioteca** | Organização por status, avaliações de 1 a 10 e favoritos. |
| **Progresso** | XP, níveis, histórico de atividades, títulos e conquistas de diferentes raridades. |
| **Desafios** | Objetivos semanais com acompanhamento e resgate de recompensas. |
| **Perfil** | Nome de exibição, biografia, avatar, banner e controles de privacidade. |
| **Ranking** | Classificações geral, semanal e mensal, com opção de participação. |
| **Notificações** | Avisos persistentes de conquistas, níveis e desafios. |
| **Experiência mobile** | Layout responsivo, navegação inferior, áreas seguras e feedback de toque. |
| **PWA** | Instalação no dispositivo e cache dos arquivos da interface. |

A biblioteca aceita os estados **Planejado**, **Assistindo**, **Concluído**, **Pausado** e **Abandonado**. A avaliação fica disponível para animes com acompanhamento iniciado.

As regras de XP, níveis e conquistas são calculadas no banco de dados. Eventos de progresso usam chaves únicas para impedir a repetição da mesma recompensa por anime e ação.

A interface também oferece transições entre páginas em navegadores compatíveis e respeita a preferência de movimento reduzido (`prefers-reduced-motion`).

## Tecnologias

| Tecnologia | Uso no projeto |
| --- | --- |
| HTML, CSS e JavaScript ES Modules | Interface e lógica executadas no navegador. |
| [Supabase](https://supabase.com/) | Auth, PostgreSQL, Storage, políticas de acesso por linha (RLS) e funções RPC. |
| [Kitsu API](https://kitsu.io/) | Catálogo, busca e detalhes dos animes. |
| Web App Manifest e Service Worker | Instalação como PWA e cache da interface. |
| Node.js Test Runner | Testes do adaptador Kitsu com respostas simuladas. |
| Python, pgserver e psycopg | Testes SQL em PostgreSQL temporário e descartável. |

## Executar localmente

### Pré-requisitos

- Git para clonar o repositório.
- Python 3 ou outro servidor de arquivos estáticos.
- Navegador moderno com suporte a JavaScript ES Modules.
- Um projeto Supabase configurado e conexão com a internet.

Node.js e as dependências Python de teste são necessários apenas para executar as verificações da seção [Testes](#testes).

### Clonar e iniciar

```bash
git clone https://github.com/JS171555/otaku-level.git
cd otaku-level
python3 -m http.server 5500
```

Abra [http://localhost:5500](http://localhost:5500) e conclua a configuração abaixo para usar autenticação e persistência.

Sirva o projeto por HTTP ou HTTPS. Abrir as páginas diretamente com `file://` não oferece o ambiente necessário para os módulos e o Service Worker. O endereço `localhost` permite testar recursos PWA durante o desenvolvimento.

## Configuração

### 1. Conectar ao Supabase

Crie um projeto no Supabase e copie a URL e a chave pública. Em [`js/config.js`](js/config.js), substitua os valores existentes pelos da sua instalação, mantendo os exports:

```javascript
export const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
export const SUPABASE_ANON_KEY = 'SUA_CHAVE_PUBLICA';
```

O campo `SUPABASE_ANON_KEY` recebe a chave pública `publishable` ou a chave legada `anon`. O nome é mantido por compatibilidade com o código.

**Use apenas a chave pública no frontend.** Chaves `service_role`, chaves secretas e o Client Secret do Google devem permanecer fora dos arquivos servidos ao navegador. A chave pública não substitui as políticas RLS nem as permissões do banco e do Storage.

### 2. Preparar o banco de dados

Em uma instalação nova, execute os scripts no **SQL Editor** do Supabase, nesta ordem:

| Ordem | Script | Conteúdo |
| --- | --- | --- |
| 1 | [`schema.sql`](supabase/schema.sql) | Perfis, criação automática de usuário, validações e políticas iniciais. |
| 2 | [`fase2.sql`](supabase/fase2.sql) | Biblioteca pessoal, status, avaliações e favoritos. |
| 3 | [`fase3.sql`](supabase/fase3.sql) | XP, níveis, conquistas, títulos e regras de recompensa. |
| 4 | [`fase4.sql`](supabase/fase4.sql) | Perfis, privacidade, rankings e buckets de avatar e banner. |
| 5 | [`fase5.sql`](supabase/fase5.sql) | Notificações persistentes e desafios semanais. |

Confira os comentários iniciais de cada arquivo antes de aplicá-lo. Em uma instalação existente, verifique quais fases já foram aplicadas e respeite suas dependências.

#### Migração de uma biblioteca antiga para Kitsu

O arquivo [`supabase/migrate-kitsu.sql`](supabase/migrate-kitsu.sql) é destinado a instalações com a Fase 2 antiga que ainda precisam adaptar as restrições de identificadores e imagens. Execute-o uma vez, após a Fase 2.

A versão atual de `fase2.sql` já aceita essa integração; uma instalação nova não precisa da migração separada. O script substitui duas restrições sem alterar ou apagar os registros existentes.

Por compatibilidade, o campo `mal_id` mantém os IDs antigos do MyAnimeList como números positivos; novos registros Kitsu usam o negativo do ID Kitsu. O adaptador em [`js/kitsu.js`](js/kitsu.js) trata essa diferença ao consultar o catálogo.

### 3. Configurar e-mail e redirecionamentos

Configure o provedor de e-mail, a confirmação de cadastro e o envio de mensagens no Supabase conforme sua instalação.

Em **Authentication → URL Configuration**, defina o **Site URL** e autorize as URLs completas usadas pelo aplicativo:

| Ambiente | Site URL | URLs de redirecionamento |
| --- | --- | --- |
| Desenvolvimento | `http://localhost:5500` | `http://localhost:5500/index.html` e `http://localhost:5500/reset.html` |
| Produção | `https://seu-dominio` | `https://seu-dominio/index.html` e `https://seu-dominio/reset.html` |

A página `index.html` recebe os retornos de cadastro e login social; `reset.html` recebe a recuperação de senha. Se publicar em um subdiretório, inclua esse caminho em todas as URLs, por exemplo `https://usuario.github.io/otaku-level/index.html`.

Consulte a [documentação de redirecionamentos do Supabase](https://supabase.com/docs/guides/auth/redirect-urls) para detalhes de configuração.

### 4. Habilitar login com Google (opcional)

1. No Google Cloud Console, crie um cliente OAuth do tipo **Aplicativo da Web**.
2. Nas **URIs de redirecionamento autorizados** do Google, adicione o callback exibido na configuração do provedor Google no Supabase, normalmente `https://<PROJECT_REF>.supabase.co/auth/v1/callback`.
3. No Supabase, em **Authentication → Providers → Google**, habilite o provedor e informe o Client ID e o Client Secret.
4. Confirme que a URL de `index.html` do ambiente está autorizada no Supabase.

O callback do Google aponta para o Supabase; o retorno ao aplicativo aponta para `index.html`. Após confirmar a sessão, o app encaminha o usuário para `dashboard.html`.

O botão Google atende login e criação de conta. Para contas novas, o banco cria o perfil automaticamente e gera um nome de usuário no formato `otaku_<8 caracteres>`. O nome de exibição pode ser personalizado nas configurações do perfil.

Veja também o [guia oficial de login com Google](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Primeiros passos no aplicativo

1. Crie uma conta e confirme o e-mail, se essa opção estiver habilitada.
2. Use a busca para encontrar um anime no catálogo Kitsu.
3. Adicione o anime à biblioteca, escolha um status e marque seus favoritos.
4. Avalie os títulos que começou a acompanhar e consulte seu progresso no dashboard.
5. Acompanhe conquistas e desafios semanais e personalize seu perfil.

Em `app.html`, você pode ajustar nome de exibição, biografia, imagens e privacidade. Um perfil privado fica oculto para outros usuários e deixa de aparecer nos rankings. Também existem controles separados para estatísticas, conquistas e participação no ranking.

## Páginas do aplicativo

| Página | Arquivo | Finalidade |
| --- | --- | --- |
| Autenticação | [`index.html`](index.html) | Login, cadastro e solicitação de recuperação de senha. |
| Redefinição de senha | [`reset.html`](reset.html) | Definição da nova senha pelo link recebido. |
| Dashboard | [`dashboard.html`](dashboard.html) | Visão geral do progresso e acesso aos recursos. |
| Busca | [`buscar.html`](buscar.html) | Pesquisa no catálogo Kitsu. |
| Anime | [`anime.html`](anime.html) | Detalhes da obra e ações da biblioteca. |
| Biblioteca | [`biblioteca.html`](biblioteca.html) | Consulta e organização dos animes salvos. |
| Conquistas | [`conquistas.html`](conquistas.html) | Conquistas, títulos e progresso. |
| Ranking | [`ranking.html`](ranking.html) | Classificações por período. |
| Perfil | [`perfil.html`](perfil.html) | Visualização do perfil e de suas estatísticas permitidas. |
| Configurações | [`app.html`](app.html) | Edição do perfil, imagens e privacidade. |
| Notificações | [`notificacoes.html`](notificacoes.html) | Consulta e marcação de avisos como lidos. |

## Estrutura do repositório

```text
otaku-level/
├── assets/                 # Marca, logo Google e ícones do site/PWA
├── css/
│   ├── styles.css          # Estilos das telas de autenticação
│   └── app.css             # Estilos da aplicação
├── js/
│   ├── config.js           # Configuração pública do Supabase
│   ├── auth.js             # Autenticação e sessão
│   ├── kitsu.js            # Adaptador do catálogo, cache e requisições
│   ├── library.js          # Biblioteca pessoal
│   ├── gamification.js     # Consulta de progresso e recompensas
│   ├── pages/              # Inicialização e lógica de cada página
│   └── ...                 # Perfil, navegação, desafios e notificações
├── supabase/               # Schema, fases SQL e migração para Kitsu
├── tests/                  # Testes JavaScript e SQL
├── *.html                  # Páginas do aplicativo
├── manifest.webmanifest    # Nome, ícones e modo de instalação
└── sw.js                   # Cache dos arquivos da interface
```

A marca transparente usada na autenticação está em [`assets/otaku-level-logo-transparent.png`](assets/otaku-level-logo-transparent.png). O README usa uma variante própria; favicons, ícones PWA e o símbolo Google também ficam em `assets/`.

## Testes

Execute os comandos a partir da raiz do repositório.

### Adaptador Kitsu

Use Node.js 22.12 ou mais recente para executar o teste com os módulos ES do projeto:

```bash
node --test tests/kitsu.test.mjs
```

O teste usa respostas simuladas para verificar busca, paginação, cache, detalhes e compatibilidade com IDs antigos. Ele não depende de chamadas reais à API Kitsu.

### Banco de dados

Crie um ambiente Python isolado e instale as dependências:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install pgserver "psycopg[binary]"
```

No Windows, ative o ambiente com `.venv\Scripts\activate`.

```bash
python3 tests/fase3.test.py
python3 tests/fase4.test.py
python3 tests/fase5.test.py
```

Os testes iniciam um PostgreSQL temporário e simulam os componentes necessários do Supabase, incluindo papéis e funções de autenticação. As fases 4 e 5 também simulam o esquema de Storage. Não é necessário fornecer credenciais de produção.

| Teste | Cobertura principal |
| --- | --- |
| [`fase3.test.py`](tests/fase3.test.py) | XP, níveis, conquistas, títulos e regras de recompensa. |
| [`fase4.test.py`](tests/fase4.test.py) | Perfil, privacidade, ranking e políticas de Storage. |
| [`fase5.test.py`](tests/fase5.test.py) | Notificações persistentes e desafios semanais. |

Essas verificações complementam os testes manuais de autenticação, upload e navegação na instalação real.

## Publicação e PWA

Publique a raiz do projeto em um serviço de hospedagem estática com **HTTPS**, como GitHub Pages, Netlify ou Cloudflare Pages. Preserve a estrutura dos diretórios; não há etapa de build obrigatória.

Antes de disponibilizar o site:

- Configure `js/config.js` com o projeto Supabase da instalação.
- Confirme a aplicação das fases SQL e as políticas de acesso.
- Atualize o Site URL e os redirecionamentos de `index.html` e `reset.html`.
- Confira o acesso a `manifest.webmanifest`, `sw.js` e aos ícones em `assets/`.
- Teste cadastro, login, recuperação de senha, busca, biblioteca e edição do perfil.

### Instalar no celular

- **Android:** abra o site no Chrome e use **Instalar app** ou **Adicionar à tela inicial**, quando disponível.
- **iPhone:** abra o site no Safari e selecione **Compartilhar → Adicionar à Tela de Início**.

O manifesto define `dashboard.html` como início do aplicativo instalado. Sem uma sessão autenticada, o app encaminha para o login.

### Funcionamento offline

O Service Worker armazena os arquivos da interface e recursos locais no cache do navegador. A disponibilidade desses arquivos depende de uma visita anterior e da preservação do cache.

**Autenticação, consultas ao catálogo e leitura ou atualização de dados remotos continuam dependendo de conexão.** Instalar a PWA não garante o funcionamento completo offline. O cliente Supabase e outros recursos externos também dependem de sua disponibilidade no navegador.

## Solução de problemas

| Situação | O que verificar |
| --- | --- |
| Login ou cadastro falha | URL e chave pública, scripts SQL aplicados e configuração de confirmação de e-mail. |
| E-mail de recuperação retorna à página errada | Site URL e autorização da URL completa de `reset.html`. |
| Login Google falha | Provedor habilitado, Client ID/Secret, callback do Google e URL de `index.html` autorizada no Supabase. |
| Busca fica indisponível | Conexão e disponibilidade da Kitsu; em caso de limite de requisições, aguarde antes de tentar novamente. |
| Biblioteca antiga rejeita IDs ou imagens Kitsu | Necessidade de aplicar `supabase/migrate-kitsu.sql` após a Fase 2. |
| Progresso, ranking ou desafios não carregam | Aplicação das fases 3, 4 e 5, conforme o recurso, e permissões das funções RPC. |
| Perfil não aparece no ranking | Perfil público, participação habilitada e pontuação no período selecionado. |
| Avatar ou banner não é enviado | Fase 4 aplicada, políticas de Storage e imagem JPG, PNG ou WebP de até 8 MB antes do processamento. |
| Opção de instalar não aparece | HTTPS ou `localhost`, suporte do navegador e registro do Service Worker. |

Não desative as políticas RLS para contornar falhas de acesso. Revise a configuração e as permissões da instalação.

## Contribuição

Para relatar um problema ou sugerir uma melhoria, [abra uma issue](https://github.com/JS171555/otaku-level/issues) com os passos para reproduzir, o comportamento esperado e o navegador utilizado. Evite incluir credenciais ou dados pessoais.

Para propor alterações, crie uma branch com um objetivo definido e envie um pull request explicando a mudança e como ela foi validada.

## Licença

O repositório ainda não inclui um arquivo de licença. Consulte o proprietário antes de redistribuir ou reutilizar o código e os materiais visuais.
