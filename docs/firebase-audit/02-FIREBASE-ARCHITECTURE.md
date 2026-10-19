# Arquitetura Firebase e fluxos de dados

Base: `7e70408`, análise estática em 18/10/2026. O estado implantado precisa ser conferido separadamente. Os caminhos abaixo são evidências do código, não conteúdo consultado no banco.

## Tecnologias confirmadas

| Camada | Implementação | Evidência |
|---|---|---|
| Interface | React 18.3, JSX, Vite 5.4, Tailwind CSS 4, Lucide e React Icons | [package.json](../../package.json) |
| Rotas | React Router 7, SPA; não há SSR implementado | [main.jsx:8](../../src/main.jsx#L8), [AppRoutes.jsx:20](../../src/routes/AppRoutes.jsx#L20) |
| Estado | Context + hooks React + estado local; sem React Query/Redux/Zustand nas dependências | [AuthContext.jsx:35](../../src/contexts/AuthContext.jsx#L35) |
| Firebase cliente | SDK modular `firebase` 12.13, `initializeApp`, `getAuth`, `getFirestore` | [firebase.js:14](../../src/firebase/firebase.js#L14) |
| Backend | Endpoint Vercel `api/password-recovery.js`, Admin SDK 13.6 | [handler:16](../../api/password-recovery.js#L16), [firebaseAdmin.js:5](../../server/firebaseAdmin.js#L5) |
| Publicação web | Preparada para Vercel, também informada pelo proprietário; rewrite SPA exclui `/api/`. Hospedagem/deploy não verificados nesta auditoria | [vercel.json](../../vercel.json) |
| Regras versionadas | Firestore, apontadas por `firebase.json`; sem índices/emuladores configurados nesse arquivo | [firebase.json](../../firebase.json), [firestore.rules](../../firestore.rules) |

Não foram encontrados Cloud Functions, gatilhos Firestore/Auth de backend, Realtime Database, chamadas de Storage, Firebase Analytics, Performance Monitoring ou inicialização de App Check no código ativo. A presença de `storageBucket` na configuração não comprova uso de Storage. Serviços existentes apenas no Console não podem ser descartados por análise local.

## Inicialização e autenticação

1. `main.jsx` monta `BrowserRouter` e `StrictMode`.
2. `App.jsx:9` verifica manutenção; em seguida aplica bloqueio de desktop. Na versão auditada, a manutenção está ativa.
3. Fora da manutenção, `AuthProvider` escuta `onAuthStateChanged`; isso é Firebase Auth, não um listener de documentos.
4. Login ativo é `LoginNew`. Ao completar usuário/senha, há debounce de 720 ms, resolução do username no Firestore e login email/senha. O botão apenas navega após a validação ([LoginNew.jsx:141](../../src/pages/LoginNew.jsx#L141)).
5. Login e contexto compartilham `preloadUserSession`. São cinco leituras explícitas na inicialização normal: segurança, usuário, stats, inventário, showcase. Em troca obrigatória: segurança + usuário.
6. Contexto tenta novamente até cinco vezes se não encontra uma sessão válida, sem polling permanente. A falta do usuário pode gerar até 25 tentativas documentais normais no caminho sem restrição ([AuthContext.jsx:20](../../src/contexts/AuthContext.jsx#L20)).
7. Abre dois listeners globais: segurança e estatísticas próprias. Troca obrigatória suspende o de estatísticas.
8. Sincroniza perfil público próprio; se ADM, sincroniza todos uma vez por runtime. São efeitos de escrita, não só autenticação.
9. `ProtectedRoute` verifica sessão e troca obrigatória. Restrições administrativas adicionais ficam nas páginas; não substituem regras.

Auth usa usuários email/senha com emails derivados/internos; o fluxo ativo não envia SMS. `Register.jsx` contém um fluxo antigo com telefone/SMS sem rota ativa. Sessão persistente de Auth e persistência de dados Firestore são coisas distintas.

Convidados podem ser provisionados pelo ADM antes do primeiro acesso. `guestAccountService.js:8` cria uma instância Auth isolada com persistência em memória, preservando a sessão do ADM; desmonta essa instância ao finalizar. A ativação posterior preserva o UID e documentos de progressão.

## Coleções identificadas

| Coleção / chave usual | Finalidade e consumidores | Escritores no repositório |
|---|---|---|
| `pre_registered_users/{telefone}` | Convites, papel, sexo, vínculo com conta; consulta no primeiro acesso e gestão | Convites, cadastro, exclusão administrativa |
| `invite_access_codes/{convite}` | Código recuperável pelo ADM | Convites, regeneração, exclusão |
| `users/{uid}` | Conta privada, perfil, saldo e elegibilidade promocional | Cadastro, edição, compras, resgates, gestão |
| `usernames/{username}` | Resolução de login e reserva | Cadastro/ativação e exclusão |
| `public_profiles/{uid}` | Projeção do perfil, papel e moedas | Cadastro, edição, compras/resgates, sincronizações |
| `user_stats/{uid}` | Presença, jogos, vitórias, sequências, missões resgatadas | Cadastro, pelada, undo/redo, encerramento, resgates |
| `user_inventory/{uid}` | Itens comprados e conquistas | Cadastro, compra, conquista |
| `user_showcase/{uid}` | Estrutura de vitrine | Cadastro; lida na sessão, sem uso visual encontrado do valor da sessão |
| `account_security/{uid}` | Troca obrigatória, invalidação de sessão, estado da recuperação | API com Admin SDK; cliente só lê |
| `password_reset_audit/{resetId}` | Histórico/estado técnico de recuperação | API com Admin SDK; cliente não lê |
| `volley_lists/{id}` | Presença, convidados/pedidos, chegada, equipes, jogos, histórico/redo, resumo | Ações de presença e gestão |
| `volley_reports/{listId}` | Relatório do dia e ranking | Encerramento |
| `app_metrics/volley` | Totais gerais de dias e jogos | Encerramento |
| `feed_posts/{autoId}` | Publicações derivadas de relatório | Publicar/remover na gestão |

As estruturas estão nos serviços e em [userDefaults.js:4](../../src/services/userDefaults.js#L4). O inventário de operações está em [03](03-FIRESTORE-OPERATIONS.md). Não há evidência de subcoleções usadas pelo fluxo ativo.

## Dados em tempo real

Há seis pontos de registro `onSnapshot` no código ativo: dois no contexto, um no serviço de listas, três no serviço de relatórios. Não são seis listeners globais por usuário.

| Tela ativa, fora da manutenção | Listeners globais | Listeners da tela | Total típico |
|---|---:|---:|---:|
| Feed | Segurança + stats | Posts, `limit(30)` | 3 |
| Lista ou partidas públicas | Segurança + stats | Lista ativa, `limit(1)` | 3 |
| Gestão lista/partidas | Segurança + stats | Lista ativa, `limit(1)` | 3 |
| Perfil, loja, cartas, menu, convites | Segurança + stats | Nenhum Firestore extra | 2 |
| Relatórios ADM | Segurança + stats | Métricas + último relatório + posts | 5 |
| Troca obrigatória | Segurança | Nenhum desses fluxos protegidos | 1 |
| Manutenção, cliente novo | Nenhum contexto montado | Nenhum | 0 |

Os retornos dos efeitos encerram os listeners de tela; os do contexto terminam no logout/desmontagem ou mudança das dependências. Não há assinatura de todas as listas ou de todos os perfis em tempo real.

Cada notificação da lista cria novo objeto `list`, e daí novo `presence`. O efeito de perfis faz leituras pontuais, não listeners de perfil. O custo dominante pode estar nessas leituras derivadas, não na consulta `limit(1)` isolada.

## Caches efetivos

| Cache | Escopo | Limitações |
|---|---|---|
| `cachedSession` / `pendingSession` | Módulo, um UID | Evita chamadas simultâneas entre login/contexto; perde no reload. Atualização do contexto não atualiza esse cache. |
| `publicProfilesSyncPromise` | Módulo | Evita duas sincronizações globais concorrentes Feed/Auth; sucesso fica memorizado até reload, falha permite repetir. |
| `profilesById` | Estado de Feed ou MatchList | Reutiliza ao clicar numa carta já carregada, mas os efeitos recarregam perfis sem consultar esse cache. Perde ao desmontar. |
| Diretório de cartas | Estado de Cards | Filtro é local, sem consultas a cada letra; coleções já foram lidas na montagem. |
| Catálogo/URLs | Imports e `useMemo` | Local, não gera custo Firestore. |
| SDK Firestore | Memória padrão web | Sem configuração de IndexedDB/offline persistente; não confundir com Auth persistente. |

Cache do SDK pode produzir eventos locais e reutilizar dados, mas `getDoc()` não é uma política de cache-only; ver [leitura oficial](https://firebase.google.com/docs/firestore/query-data/get-data). Persistência web é opt-in e tem consequências de privacidade em aparelho compartilhado; ver [offline oficial](https://firebase.google.com/docs/firestore/manage-data/enable-offline).

## Arquivos, mídia e performance não Firestore

`profileAssets.js` resolve arquivos locais importados pelo Vite; loja e cartas usam GIF/PNG/WebP/WebM. Foram encontrados 112 arquivos em `src/assets`, somando 114.747.915 bytes no disco; o maior tem 9.239.996 bytes. Isso não é o peso inicial baixado, nem o tamanho do banco.

Mídia pode pressionar rede, memória, decodificação e tráfego Vercel, mas não é uma leitura Firestore por imagem. `scripts/generate-profile-thumbnails.mjs` trabalha em arquivos locais. Não há upload implementado para Firebase Storage. O consumo visual precisa de waterfall/LCP e perfil de memória em celulares; não foi medido aqui.

## Backend e operações externas

O endpoint de recuperação valida token, autorização e segurança no servidor, escreve com Admin SDK e faz operações Firebase Auth. O Admin SDK não usa regras cliente; precisa de IAM/credenciais corretos. Não copiar credenciais para o frontend.

`scripts/firebase-maintenance.mjs` acessa REST Firestore/Auth, lista 12 coleções e gera snapshots locais mesmo no modo sem aplicação. O nome não indica uma ferramenta isenta de consumo. Não foi executado. Seu modo de exclusão tem risco para dados reais (F14).

`example/adminScript.js` usa outra configuração/protótipo, sem ligação identificada com as rotas. Seus listeners e escritas não devem ser somados automaticamente ao app atual.

## O que confirmar fora do código

- Região e edição da base `(default)`, plano e conta de faturamento.
- Conteúdo/versão das regras publicadas, índices e isenções existentes.
- App Check, logs, orçamento, jobs ou serviços habilitados externamente.
- Sessões e versões antigas ainda abertas; rotina de trabalho do ADM e do desenvolvimento.
- Distribuição real de documentos e bytes, sem exportar dados pessoais para documentação pública.
