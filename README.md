# Parads App

Aplicativo mobile-first para organizar a comunidade de volei da Parads: entrada controlada por convite, perfil de jogador, personalizacao visual, conquistas e, em breve, lista de pelada, feed de atualizacoes, missoes e progresso da galera.

O projeto ainda esta em fase inicial, mas ja tem uma base importante pronta: autenticacao com Firebase, pre-cadastro por administradores, criacao de conta validada por SMS, area protegida, perfil editavel, inventario de cosmeticos, conquistas e uma primeira versao visual da lista de volei.

## Ideia do produto

A proposta e transformar a organizacao da pelada em uma experiencia de comunidade. Em vez de ser apenas uma lista de nomes, o app deve centralizar quem joga, quem foi convidado, quem confirmou presenca, o historico de participacao e pequenas recompensas que dao identidade aos membros.

Principais pilares:

- **Comunidade fechada:** so entra quem foi previamente cadastrado por um admin.
- **Identidade de jogador:** cada pessoa tem perfil, foto, background, status, estatisticas e conquistas.
- **Organizacao da pelada:** lista de volei com limites por grupo, como levantadores e jogadores.
- **Engajamento:** conquistas, missoes, streaks, moedas, titulos e itens desbloqueaveis.
- **Feed social:** espaco futuro para atualizacoes, avisos, resultados e momentos da comunidade.

## Stack

- **React 18**
- **Vite**
- **React Router**
- **Firebase Authentication**
- **Cloud Firestore**
- **Tailwind CSS v4**
- **Lucide React**
- **React Icons**
- **ESLint**

## Como rodar

Instale as dependencias:

```bash
npm install
```

Rode o ambiente de desenvolvimento:

```bash
npm run dev
```

Gere build de producao:

```bash
npm run build
```

Rode o lint:

```bash
npm run lint
```

## Fluxo atual

### 1. Admin cria um convite

Na area administrativa, o admin acessa **Convites** e cria um pre-cadastro com:

- nome completo;
- telefone;
- role: `member`, `guest` ou `admin`.

Esses dados sao salvos em `pre_registered_users`, usando o telefone com DDI do Brasil como id do documento.

### 2. Usuario cria a conta

Na tela de cadastro, o usuario informa o telefone. O app procura esse numero em `pre_registered_users` e so permite continuar se o convite existir, estiver habilitado e ainda nao tiver sido usado.

Depois disso:

- o usuario confirma que aquele convite pertence a ele;
- recebe e valida um codigo SMS via Firebase Auth;
- escolhe um nome de usuario;
- cria uma senha de 8 caracteres;
- o app cria a conta no Firebase Auth usando um e-mail tecnico no formato `usuario@parads.local`.

### 3. Base do jogador e criada no Firestore

Ao concluir o cadastro, o app cria documentos iniciais para:

- dados principais do usuario;
- reserva de username;
- estatisticas;
- inventario;
- showcase;
- marcacao do convite como usado.

### 4. Usuario acessa a area protegida

Depois de logado, o usuario entra no layout principal com navegacao inferior para:

- Feed;
- Peladas/partidas;
- Perfil;
- Admin, quando acessado pelo menu expandido.

Hoje as rotas admin ainda aparecem no menu para qualquer usuario autenticado. O contexto de autenticacao ja calcula `isAdmin`, mas as rotas administrativas ainda precisam aplicar bloqueio por permissao.

## Funcionalidades implementadas

### Autenticacao

- Login com usuario e senha.
- Usuario convertido para e-mail tecnico por `buildAuthEmail`.
- Sessao monitorada por `AuthContext`.
- Logout com modal de confirmacao.
- Protecao de rotas autenticadas por `ProtectedRoute`.

### Cadastro por convite

- Busca de pre-cadastro por telefone.
- Validacao de telefone por SMS com Firebase Auth.
- Criacao de conta somente para telefones pre-cadastrados.
- Controle de convite usado (`claimed`).
- Reserva de username em `usernames`.

### Perfil

- Header com background, foto, borda, nome, usuario, nivel e status.
- Edicao de perfil.
- Selecao de cosmeticos a partir do inventario.
- Icone de status.
- Estatisticas iniciais de jogador.
- Grade de conquistas com modal de detalhes.

### Admin

- Hub administrativo com cards de servicos.
- Gerenciamento de convites.
- Busca e filtros por tipo/status.
- Criacao de novos convites.
- Exclusao em cascata de convite e dados relacionados ao usuario.

### Lista de volei

Existe uma primeira tela em `AdminVolleyList.jsx` com comportamento local/mockado:

- criacao de lista por data;
- grupos de levantadores e jogadores;
- limite de participantes por grupo;
- entrada do usuario logado mockado;
- remocao por admin mockado;
- area futura para convidados;
- acoes futuras de administracao.

Essa tela ainda nao persiste no Firestore e usa dados mockados.

## Estrutura principal

```text
src/
  app/
    App.jsx
  components/
    admin/
    profile/
    BottomNav.jsx
    ProtectedRoute.jsx
  contexts/
    AuthContext.jsx
  data/
    achievementsCatalog.js
    profileBackgroundsCatalog.js
    profilePicBordersCatalog.js
    profilePicsCatalog.js
  firebase/
    firebase.js
  layouts/
    AppLayout.jsx
  pages/
    Admin.jsx
    AdminPreRegisters.jsx
    AdminVolleyList.jsx
    Feed.jsx
    Login.jsx
    MatchList.jsx
    Profile.jsx
    Register.jsx
  routes/
    AppRoutes.jsx
  services/
    achievementService.js
    authServices.js
    preRegisterService.js
    profileService.js
    userService.js
  styles/
    global.css
  utils/
    authEmail.js
```

## Rotas

- `/login`: entrada de usuarios cadastrados.
- `/register`: criacao de conta a partir de pre-cadastro e SMS.
- `/feed`: feed da comunidade, ainda vazio.
- `/matches`: tela futura de partidas/listas, atualmente placeholder.
- `/profile`: perfil do jogador.
- `/admin`: hub administrativo.
- `/admin/pre-registers`: gerenciamento de convites.
- `/admin/volley-list`: prototipo da lista de volei.

## Modelo de dados atual

Colecoes usadas ou esperadas pelo codigo:

- `pre_registered_users`
  - convite/pre-cadastro por telefone.
  - campos principais: `fullName`, `phone`, `type`, `role`, `enabled`, `claimed`, `userId`, `createdAt`, `updatedAt`, `claimedAt`.

- `users`
  - dados principais do jogador.
  - inclui `phone`, `fullName`, `username`, `authEmail`, `type`, `role`, `profile`, `progression`, `createdAt`, `updatedAt`.

- `usernames`
  - reserva de nomes de usuario.
  - documento com id igual ao username normalizado.

- `user_stats`
  - estatisticas iniciais como partidas, vitorias, derrotas, MVPs, presenca e sequencias.

- `user_inventory`
  - itens liberados para personalizacao.
  - inclui backgrounds, fotos, bordas, conquistas e colecoes futuras.

- `user_showcase`
  - vitrine de conquistas/titulos do usuario.

## Proximas features planejadas

### Lista de pelada de volei

Transformar o prototipo local em uma feature persistida:

- colecao para listas ativas e historicas;
- abertura/fechamento por admin;
- entrada e saida do usuario autenticado;
- limites configuraveis por grupo;
- convidados com aprovacao;
- finalizacao da pelada gerando estatisticas.

### Feed de atualizacoes

Criar um espaco para:

- avisos da organizacao;
- abertura de lista;
- fechamento de lista;
- resultados da pelada;
- conquistas desbloqueadas;
- destaques da comunidade.

### Conquistas e missoes

A base de conquistas ja existe. Os proximos passos naturais sao:

- centralizar regras de desbloqueio;
- criar missoes diarias/semanais;
- conceder XP/moedas;
- evoluir conquistas por nivel;
- ligar eventos da lista e do feed ao progresso do jogador.

### Permissoes

O `AuthContext` ja expoe `role`, `isAdmin`, `isMember` e `isGuest`. Falta aplicar essas permissoes nas rotas e acoes sensiveis, principalmente:

- bloquear paginas admin para quem nao for admin;
- esconder atalhos administrativos para membros comuns;
- validar permissoes tambem nas regras do Firestore.

## Pontos de atencao

- A configuracao do Firebase esta versionada em `src/firebase/firebase.js`. Para ambientes diferentes, vale migrar para variaveis de ambiente do Vite.
- Ha textos com caracteres acentuados quebrados em alguns arquivos, indicando possivel problema de encoding.
- `AdminVolleyList.jsx` ainda usa mocks e estado local.
- `Feed.jsx` e `MatchList.jsx` ainda sao placeholders.
- A exclusao em cascata remove dados do Firestore, mas nao remove o usuario do Firebase Auth pelo cliente.
- As regras de seguranca do Firestore nao estao neste repositorio.

## Direcao arquitetural

O app esta organizado de forma simples e boa para evoluir:

- paginas cuidam das telas;
- servicos concentram operacoes com Firebase;
- contexto de auth centraliza sessao e role;
- catalogos locais descrevem assets e conquistas;
- componentes de perfil/admin encapsulam partes maiores da UI.

Para as proximas etapas, o caminho mais saudavel e manter a regra de negocio em servicos especificos, por exemplo `volleyListService`, `feedService` e `missionService`, deixando as paginas focadas em estado de tela e composicao visual.
