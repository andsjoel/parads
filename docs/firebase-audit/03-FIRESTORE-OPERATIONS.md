# Inventário de operações e análise por funcionalidade

Base `7e70408`, 18/10/2026. Análise somente de código. Nesta revisão local, `MAINTENANCE_ENABLED=true` impede a montagem do contexto e das rotas da interface. Isso não comprova implantação nem bloqueia API, scripts ou clientes alternativos.

## Como interpretar as contagens

`R` = documento solicitado/lido explicitamente; `W` = gravação de documento; `D` = exclusão. São contagens lógicas de uma tentativa bem-sucedida, não leituras faturadas medidas. Excluem dependências de regras, novas tentativas transacionais, reconexões e notificações derivadas. Um batch não transforma várias escritas em uma única escrita faturável.

`U`: usuários; `UP`: perfis públicos; `UI`: inventários; `I`: convites; `C`: códigos; `P`: pessoas únicas em um carregamento de perfis; `F`: posts retornados, até 30; `K`: participantes com UID de uma partida; `A`: presenças alteradas no undo/redo; `N`: faltantes no encerramento. Coleções vazias não implicam custo zero de consulta.

Para todas as transações abaixo: há reexecução possível em conflito; operações só acontecem ao comando/efeito indicado, não a cada render. A frequência exata depende do uso. Sem cache explícito na tabela significa sem reutilização no serviço, embora exista o cache interno do SDK.

## Sessão, login e listeners globais

| ID | Local e função | Gatilho / tela | Destino e potencial | Frequência, cache e duplicação | Tempo real |
|---|---|---|---|---|---|
| R01 | [authServices.js:6](../../src/services/authServices.js#L6), `resolveLoginEmail` | Tentativa automática de login após debounce | `usernames/{nome}`, 1R | Por tentativa; sem cache de serviço; editar credenciais pode repetir | Não necessário |
| R02 | [sessionDataService.js:8](../../src/services/sessionDataService.js#L8), `preloadUserSession` | Auth restaurado/login | `account_security`, `users`, `user_stats`, `user_inventory`, `user_showcase`: 5R; recuperação restrita: 2R | Uma carga fria por UID; cache e Promise em andamento evitam duplicação Login/Auth | Leitura inicial; dois documentos depois são acompanhados |
| R03 | [AuthContext.jsx:20](../../src/contexts/AuthContext.jsx#L20), `getUserSessionWithRetry` | Sessão não encontrada | Repete R02 até 5 vezes | Intervalos finitos 0/250/500/1.000/1.500 ms; não é loop permanente | Não |
| R04 | [AuthContext.jsx:114](../../src/contexts/AuthContext.jsx#L114), efeito segurança | UID autenticado | Listener `account_security/{uid}`, 1 documento | Ativo entre telas; cleanup retornado; inicia após R02 que já leu esse documento | Justificado para revogar sessão/troca obrigatória |
| R05 | [AuthContext.jsx:133](../../src/contexts/AuthContext.jsx#L133), efeito stats | UID e sem troca obrigatória | Listener `user_stats/{uid}`, 1 documento | Ativo entre telas; cleanup retornado; R02 já leu stats; atualizações disparam consumidores do contexto | Útil durante a pelada; não precisa propagar recarga de outros perfis |
| W01 | [AuthContext.jsx:70](../../src/contexts/AuthContext.jsx#L70) | Admin legado com `role/type` divergentes | 1W `users/{uid}` | Condicional; não é gravação em todo login normal | Não |
| W02 | [publicProfileService.js:102](../../src/services/publicProfileService.js#L102), `syncOwnPublicProfile` | Auth carregou usuário sem troca obrigatória | 1W `public_profiles/{uid}` | Em cada execução da inicialização; sempre muda timestamp, sem comparação | Não é necessário repetir se nada mudou |
| R/W03 | [publicProfileService.js:112](../../src/services/publicProfileService.js#L112), `syncAllPublicProfiles` / `Once:133` | Auth ADM e Feed ADM | Consulta completa `users`: UR; UW em `public_profiles` | Promise compartilhada evita dois trabalhos no mesmo runtime após sucesso; reload repete; falha libera retry; batches de 400 | Não é um requisito de realtime |

Em inicialização normal: cinco leituras pontuais + dois alvos de listener = até sete entregas/solicitações documentais lógicas, antes da tela. Login manual acrescenta R01. Não afirmar sete novas leituras faturadas se o SDK reutilizar um alvo/cache. Não existe listener global em `users/{uid}` ou inventário.

## Perfis, diretório e consumo derivado

| ID | Local / função | Tela e gatilho | Operações | Cache, frequência e necessidade |
|---|---|---|---|---|
| R06 | [publicProfileService.js:13](../../src/services/publicProfileService.js#L13), `getPublicProfileBundle` | Ver carta; efeitos de lista/feed; seleção em Cards | 1R `public_profiles/{uid}`; se existe, mais 1R inventário e 1R stats. Até 3R; se incompleto retorna null | Sem cache/in-flight compartilhado; stats e inventário são carregados mesmo quando se quer apenas minicard |
| R07 | [publicProfileService.js:45](../../src/services/publicProfileService.js#L45), `getPublicProfileBundles` | Efeitos de lista/feed e clique sem bundle | Deduplica IDs da chamada e executa R06 em paralelo: até 3PR | Não deduplica chamadas concorrentes entre telas/efeitos; `Promise.allSettled` não é batch de cobrança |
| R08 | [publicProfileService.js:67](../../src/services/publicProfileService.js#L67), `getPublicProfileDirectory` | Cards ao montar; guia do Feed vazio | 2 consultas completas: `public_profiles` + `user_inventory`; `UP+UI` documentos, usualmente 2U | Filtra no cliente inventário existente; sem cache de serviço, paginação ou limite. Não consulta a cada letra |
| E01 | [MatchList.jsx:364](../../src/pages/MatchList.jsx#L364), `loadProfiles` | Montagem, nova `list/presence`, mudança de stats/inventário/user da sessão | R07 para todos os IDs presentes e de `matchPlayers` | IDs removidos ainda podem entrar; usuário próprio é consultado antes de sobrepor com sessão; não verifica `profilesById`. Realtime só é necessário para estado da partida, não cosméticos a cada alteração |
| E02 | [Feed.jsx:58](../../src/pages/Feed.jsx#L58), efeito ranking | Nova lista de posts ou revisão da sincronização ADM | R07 para IDs sem bundle embutido no post | Deduplica dentro dos posts, mas não exclui os já presentes em `profilesById`. Cada atualização pode repetir |
| E03 | [Feed.jsx:89](../../src/pages/Feed.jsx#L89), guia vazio | Listener terminou e não há posts/ADM carregado | R08 + R06 de um ADM: usualmente 2U+3R | Guarda `isCurrent` evita aplicar resposta antiga, mas não desfaz leituras já iniciadas. Estado perde ao sair da tela |
| E04 | [Cards.jsx:54](../../src/pages/Cards.jsx#L54), diretório | Cada montagem de `/cards` | R08, usualmente 2UR | Corte de resultados em dez é local, não reduz o download. Digitação/limpar busca não consulta |
| E05 | [Cards.jsx:88](../../src/pages/Cards.jsx#L88), `selectMember` | Cada seleção, inclusive repetir a mesma pessoa | R06, até 3R | Token de geração evita resposta antiga alterar tela, mas não cancela consulta ou mantém cache reutilizável |
| E06 | [Feed.jsx:120](../../src/pages/Feed.jsx#L120), `openProfile`; [MatchList.jsx:461](../../src/pages/MatchList.jsx#L461), `handleOpenProfile` | Clique no minicard | Zero se bundle no estado; senão até 3R | Reutilização local é efetiva neste clique; modal em si não faz nova consulta |

Nenhuma dessas funções mantém listener de perfil. O risco N+1 é a expansão de um conjunto de IDs em três leituras por ID, repetida por efeitos. Paralelismo melhora latência, não reduz número de documentos.

## Lista e partidas: leituras e escritas por comando

Abreviações: `L=volley_lists/{id}`, `S=user_stats/{uid}`. As ações vêm de botões/modais em `AdminVolleyList`, salvo presença/solicitação pública. Os serviços não possuem cache próprio de lista transacional; lê-se estado corrente para consistência. Não eliminar essas leituras de validação só para economizar.

| ID | Função e linha em `volleyListService.js` | Gatilho / dados | R / W por tentativa | Duplicação e observações |
|---|---|---|---|---|
| L01 | [getActiveVolleyList:700](../../src/services/volleyListService.js#L700) | Criar pelada: query status `in [open,in_progress]`, `limit(1)` | Até 1 documento; consulta vazia tem mínimo | Sem ordenação; validação ocorre fora da transação de criação |
| L02 | [subscribeActiveVolleyList:718](../../src/services/volleyListService.js#L718) | Montagem pública/ADM | Listener da query L01, até 1 documento inicial e atualizações | Retorna unsubscribe, telas o retornam. Realtime é necessário; recebe documento inteiro |
| L03 | [getVolleyAdminUsers:743](../../src/services/volleyListService.js#L743) | Montar gestão, se ADM | UR `users` | Coleção completa; ordenação e corte de busca em oito no cliente; sem cache entre gestões |
| L04 | [createVolleyList:758](../../src/services/volleyListService.js#L758) | Abrir pelada | L01 + 1W L | Transação só cria documento, sem lock da lista ativa |
| L05 | [requirePresenceActor:270](../../src/services/volleyListService.js#L270) | Helper das ações abaixo | 1R `users/ator` | Contado nos totais seguintes; regras são adicionais |
| L06 | [joinVolleyList:810](../../src/services/volleyListService.js#L810) | Membro entra/troca grupo | 2R, 1W L | Ator + lista; capacidade e lista aberta; duplicada rejeita |
| L07 | [leaveVolleyList:843](../../src/services/volleyListService.js#L843) | Membro sai | 2R, 1W L | `removeVolleyListParticipant:863` delega; wrapper sem uso atual encontrado |
| L08 | [requestVolleyListGuest:867](../../src/services/volleyListService.js#L867) | Convidado solicita | 2R, 0/1W L | Pedido repetido retorna sem escrita |
| L09 | [adminAddVolleyListParticipant:890](../../src/services/volleyListService.js#L890) | ADM adiciona; `acceptVolleyListGuest:886` delega | 3R, 1W L | Ator/lista/alvo; limpa pedido. Inclusão não conta presença esportiva ainda |
| L10 | [adminRemoveVolleyListParticipant:923](../../src/services/volleyListService.js#L923) | ADM remove da presença | 2R, 1W L | Normaliza grupos; preserva equipes |
| L11 | [swapVolleyListParticipants:937](../../src/services/volleyListService.js#L937) | ADM confirma troca da presença | 2R, 1W L | Ator + lista |
| L12 | [addVolleyMatchPlayer:971](../../src/services/volleyListService.js#L971) | ADM adiciona chegada | 1-2R, 1-2W | Lista e stats se há UID; stats só incrementa presença se ainda não contada |
| L13 | [updateMatchPlayerFlags:1144](../../src/services/volleyListService.js#L1144) | Marcar levantador/mulher | 1R, 1W L | Atualiza times, resumo e histórico; não grava perfil do usuário |
| L14 | [startVolleyMatch:1224](../../src/services/volleyListService.js#L1224) | Iniciar | 1R, 1W L | Congela presença e inicia chegada vazia; não é custo por todos os confirmados |
| L15 | [formInitialVolleyTeams:1253](../../src/services/volleyListService.js#L1253) | Confirmar sorteio | 1R, 1W L | Sorteio local; não consulta cada nome |
| L16 | [toggleVolleyRule:1283](../../src/services/volleyListService.js#L1283) | Mudar regra | 1R, 1W L | Computa redistribuição local |
| L17 | [swapMatchPlayers:1312](../../src/services/volleyListService.js#L1312) | Confirmar troca de jogadores | 1R, 1W L | Atualiza estado e histórico |
| L18 | [moveMatchPlayerToTeamVacancy:1365](../../src/services/volleyListService.js#L1365) | Confirmar troca com vaga | 1R, 1W L | Mesmo padrão; nenhuma busca de perfil |
| L19 | [removeMatchPlayer:1428](../../src/services/volleyListService.js#L1428) | Confirmar exclusão de chegada | 1R, 1W L | Remoção lógica; entry permanece em matchPlayers |
| L20 | [recordTeamWin:1454](../../src/services/volleyListService.js#L1454) | Confirmar vencedor | (1+K)R, (1+K existente)W | Lista + stats de até 12 participantes nas equipes usuais; número depende dos dados válidos. Transação atualiza stats e lista |
| L21 | [undoVolleyListAction:1665](../../src/services/volleyListService.js#L1665) | Desfazer | Base 1R/1W L; + helpers L23/L24 | Sem histórico, lança erro após 1R, sem escrita; snapshots são compartilhados por administradores |
| L22 | [redoVolleyListAction:1713](../../src/services/volleyListService.js#L1713) | Refazer | Base 1R/1W L; + helpers L23/L24 | Mesmo padrão |
| L23 | [syncPersistedAttendance:214](../../src/services/volleyListService.js#L214) | Helper undo/redo | AR + A existente W em S | Apenas diferenças de presenças; não somar ao comando se não houve diferença |
| L24 | [syncPersistedGameStats:144](../../src/services/volleyListService.js#L144) | Helper undo/redo com diferença de um game | KR + K existente W em S | Estatísticas de quem participou daquele game |
| L25 | [finishVolleyList:1760](../../src/services/volleyListService.js#L1760) | Confirmar finalizar pelada | 3R/3W na transação; +1R L e NW em batch depois | Total normal 4R+(3+N)W. Repetir já encerrada: 3R, sem reexecutar batch de faltas |
| L26 | [seedMockVolleyPlayers:1042](../../src/services/volleyListService.js#L1042) | Export remanescente, sem chamador ativo | 1R/1W L se invocada | Não contabilizar como uso normal nem executar em produção |

Cada W de L pode notificar todos os espectadores L02 e iniciar E01. Ao contar um comando completo, acrescentar esse fan-out; não confundir 1W com somente uma operação total no ecossistema.

## Feed e relatórios

| ID | Função / local | Gatilho / destino | Operações e reutilização | Realtime / cleanup |
|---|---|---|---|---|
| T01 | [subscribeFeedPosts:61](../../src/services/volleyReportService.js#L61) | Feed e relatórios ao montar | `feed_posts`, `orderBy(createdAt,desc)`, `limit(30)`; até FR inicial e alterações | Sim; efeito retorna unsubscribe. Posts antigos não são paginados |
| T02 | [subscribeVolleyDashboard:15](../../src/services/volleyReportService.js#L15) | Relatórios ADM | `app_metrics/volley` e `volley_reports orderBy(closedAt,desc) limit(1)`: 2 alvos | Retorno fecha os dois. Pode virar leitura pontual/atualização explícita se UX permitir |
| T03 | [publishVolleyReportCard:44](../../src/services/volleyReportService.js#L44) | Botão publicar | `addDoc(feed_posts)`, 1W; payload já existe no estado | Nenhuma leitura direta; IDs automáticos não garantem publicação única |
| T04 | [removeVolleyReportCard:56](../../src/services/volleyReportService.js#L56) | Botão remover | `deleteDoc`, 1D | Validação de publicação usa somente posts carregados |

Os relatórios já usam agregados calculados no encerramento; não varrem o histórico inteiro para mostrar dias/jogos. Isso é um padrão positivo. A consulta de posts escondidos por `post.type !== 'games'` acontece antes desse filtro visual ([Feed.jsx:154](../../src/pages/Feed.jsx#L154)).

## Perfil, economia e missões

| ID | Função / evidência | Gatilho / documentos | R / W e duplicação |
|---|---|---|---|
| M01 | [updateUserProfile:5](../../src/services/profileService.js#L5) | Salvar edição de perfil | 1R users + 2W users/public_profiles; mesmo sem alteração muda timestamps; sem comparação prévia |
| M02 | [purchaseProfileItem:17](../../src/services/profileStoreService.js#L17) | Comprar na loja ou picker do perfil | 2R users/inventory; 3W users/public_profiles/inventory. Já comprado: lê, mas retorna sem escrever. Sem saldo: falha sem escrita |
| M03 | [claimProfileMissionRewards:9](../../src/services/profileMissionService.js#L9) | Resgatar categoria de estatística | 2R users/stats, 3W users/public_profiles/stats se há prêmio; sem prêmio, sem escrita. Agrupa recompensas elegíveis da categoria, não de todas as categorias |
| M04 | [claimPromotionalMission:5](../../src/services/promotionalMissionService.js#L5) | Resgatar uma missão especial | 3R users/stats/inventory, 3W users/public_profiles/stats se elegível; resgate repetido retorna sem escrever |
| M05 | [unlockAchievement:11](../../src/services/achievementService.js#L11) | Serviço exportado, sem chamador ativo encontrado | 1R inventory + 0/1W com arrayUnion; não somar a todas as vitórias |

Perfil e loja leem a sessão/estado local, não iniciam nova consulta ao abrir. Catálogos, filtros por raridade e cálculo de elegibilidade de missões são locais. A contagem de missões não consulta uma coleção por missão. Os três documentos escritos em compra/resgate mantêm saldo, projeção pública e inventário/controle de resgate consistentes; não é correto remover escritas aleatoriamente.

## Convites, cadastro e exclusão

Os botões de gestão usam os serviços abaixo e, após criar/editar, recarregam a coleção inteira. Regeneração de código atualiza o item no estado local, sem releitura integral. Busca, filtros e accordion são locais; não há listener dessa listagem.

| ID | Função / evidência | Gatilho / potencial | R / W / D e cache |
|---|---|---|---|
| C01 | [getPreRegisters:24](../../src/services/preRegisterService.js#L24) | Montar gestão; recargas explícitas | Consulta ordenada completa de convites + completa de códigos: I+CR; sem paginação/cache de serviço; códigos de convites cadastrados também são lidos e depois escondidos |
| C02 | [createPreRegister:44](../../src/services/preRegisterService.js#L44) | Criar membro/ADM | 1R convite + 2W convite/código, transação |
| C03 | [createPreRegister:110](../../src/services/preRegisterService.js#L110) | Criar guest provisionado | 2R, 7W: convite/código e cinco documentos base; Auth separado; checagem antes de criar Auth e dentro da transação |
| C04 | [updatePreRegister:132](../../src/services/preRegisterService.js#L132) | Editar nome/papel/sexo | Sem UID: 2R/1W; com usuário existente: 3R/3W convite/usuário/perfil público |
| C05 | [provisionExistingGuestInvite:164](../../src/services/preRegisterService.js#L164) | Converter pendente para guest | Incluindo leitura inicial de edição: 3R/7W, mais criação Auth; sem reset de stats de quem já tem UID |
| C06 | [regenerateInviteAccessCode:194](../../src/services/preRegisterService.js#L194) | Gerar código pendente | Comum 2R/2W; guest 3R/2W + login/troca de senha na instância isolada |
| C07 | [findFirstAccessInvite:15](../../src/services/firstAccessService.js#L15) | Telefone completo no primeiro acesso após debounce | 1-2 getDoc por IDs normalizado/legado; se ausentes, até quatro queries `phone == valor`, `limit(1)`; máximo seis chamadas, todas limitadas |
| C08 | [validateFirstAccessCode:64](../../src/services/firstAccessService.js#L64) | Código digitado | Zero operações Firestore: comparação local; não é validação de posse/código no servidor |
| C09 | [isUsernameAvailable:12](../../src/services/userService.js#L12) | Confirmar nome de usuário | 1R `usernames/{username}`, sem escrita |
| C10 | [createUserBaseData:62](../../src/services/userService.js#L62) | Finalizar cadastro comum | 7W em batch, zero R explícita nessa função; usuários, perfil público, username, stats, inventory, showcase, convite. Acrescentar C07/C09 e sessão |
| C11 | [activateGuestBaseData:191](../../src/services/userService.js#L191) | Primeiro acesso de guest já provisionado | 3R/4W, preserva stats/inventário/showcase; Auth troca a senha |
| C12 | [deleteUserCascadeByPreRegister:20](../../src/services/userService.js#L20) | Excluir pela gestão | Sem UID 1R/2D; com UID 2R/7-8D; não exclui usuário Auth, segurança ou referências históricas |
| C13 | [deletePreRegister:125](../../src/services/preRegisterService.js#L125) | Export sem chamador ativo encontrado | 2D em batch, sem leitura própria |

Geração/verificação de hash em `accessCodeService`/`utils/accessCode`, normalização de telefone e criação de defaults não consultam banco por si. `serverTimestamp()` é um valor de escrita, não consulta de relógio faturada.

## API de recuperação e serviços externos

| ID | Local / fluxo | Documentos / contagem |
|---|---|---|
| B01 | [api/password-recovery.js:30](../../api/password-recovery.js#L30), reset | 1R segurança do ator antes do serviço |
| B02 | [prepareReset:67](../../server/passwordRecovery.js#L67) | Transação: 5R ator/segurança/convite/alvo/segurança alvo; 2W segurança/auditoria |
| B03 | [markReady:95](../../server/passwordRecovery.js#L95) | Batch de 2W segurança/auditoria. Reset completo normal B01+B02+B03 = 6R/4W |
| B04 | [prepareCompletion:111](../../server/passwordRecovery.js#L111) | 2R segurança/auditoria, 1W segurança |
| B05 | [complete:126](../../server/passwordRecovery.js#L126) | 2W segurança/auditoria. Completar troca = 2R/3W normal |
| B06 | [resetFailed:101](../../server/passwordRecovery.js#L101) | Compensação: +1R e até 2W/D conforme estado |
| B07 | [completionFailed:135](../../server/passwordRecovery.js#L135) | Compensação: +1R e até 1W |

Verificar token, atualizar senha e revogar refresh tokens são operações Firebase Auth, não leituras de documento Firestore. A chamada ao endpoint pode consumir execução/tráfego Vercel. Cada etapa pode falhar depois das anteriores; não assumir transação distribuída Auth+Firestore. O Admin SDK ignora regras cliente.

## Regras e faturamento indireto

Evidências: [signedIn:5](../../firestore.rules#L5), [isAdmin:23](../../firestore.rules#L23), [claim convite:33](../../firestore.rules#L33), [create usuário:51](../../firestore.rules#L51).

- `signedIn` acessa o mesmo `account_security/{uid}` por exists/get.
- `isAdmin` também acessa `users/{uid}`.
- Cadastro/consumo de convite usa get/getAfter no usuário/convite envolvido.
- Há 11 expressões documentais escritas nas regras: duas exists, seis get e três getAfter. Isso **não** significa 11 leituras adicionais por operação.
- Dependências necessárias são cobradas; referências repetidas ao mesmo documento são deduplicadas por requisição. Consultas/listeners, recusas e alterações de dependências podem gerar avaliações adicionais. Não multiplicar regras por todo documento retornado sem considerar o limite da requisição.

[Regra oficial de cobrança](https://firebase.google.com/docs/firestore/pricing#cloud_firestore_security_rules). O overhead deve ser medido, não eliminado removendo controles de segurança.

## Saída de tela, duplicação e ausência de loops

| Fluxo | Ao sair | O que repete ao voltar |
|---|---|---|
| Feed | Encerra listener de posts; timers do guia têm cleanup; consultas iniciadas podem terminar | Posts + perfis; se vazio, diretório/ADM. Estado do guia persistido no módulo não é cache de consultas |
| Lista / partidas | Encerra listener ativo; requisições de perfis já disparadas não são canceladas | Assinatura e perfis; React pode reutilizar a mesma instância entre os dois modos, portanto nem toda troca de URL é uma remontagem |
| Gestão lista / partidas | Encerra listener; busca de usuários não tem cancelamento | Assinatura e UR se remontar; também pode reutilizar componente por modo |
| Perfil / loja | Sem listener próprio; continuam os globais | Reutiliza sessão do contexto; abrir picker/filtrar não lê Firestore |
| Cards | Busca em andamento pode terminar; token protege seleção, não montagem do diretório | Diretório completo e seleções sem cache |
| Convites | Nenhum listener próprio | C01 novamente |
| Relatórios | Encerra os três listeners de tela | Métricas, último relatório e até 30 posts |
| Logout | Contexto limpa sessão e efeitos desmontam/reavaliam | Próximo login recarrega; módulo da sincronização global pode continuar memorizado no mesmo runtime |

Os efeitos de perfis não dependem do próprio `profilesById`, então atualizar esse estado não prova loop infinito. A repetição comprovada vem das dependências de lista, stats, posts e remontagem. `StrictMode` pode repetir montagem/efeito no desenvolvimento; não adicionar automaticamente fator 2 à produção. [Referência React](https://react.dev/reference/react/StrictMode).

## Operações encontradas fora do caminho ativo

- `Register.jsx`, `FirstAccess.jsx`, `FirstAccessExperience.jsx`, `Login.jsx`, `LoginExperience.jsx`: versões sem rota ativa; não somar às rotas New. Em Register, `searchPreRegister:131` lê 1R do convite ao completar telefone (`getDoc:156`); somente no fallback de email já usado, após login bem-sucedido, lê 1R de users (`:403`), além dos serviços de username/cadastro já inventariados e Auth/SMS. Os demais reutilizam serviços inventariados, sem um listener Firestore próprio.
- `example/adminScript.js:60`: listener `teams/currentTeams`; `saveTeamsToFirestore:81` faz 1R/1W por salvamento em outro protótipo. Sem import na aplicação atual.
- `scripts/firebase-maintenance.mjs:56`: listagens REST paginadas de 12 coleções, mais listagem Auth. `:94` executa snapshots; `:172` pode excluir até 450 documentos por commit autorizado e relistar depois. Nunca executar para medir o app sem revisar escopo/dados.
- `scripts/generate-profile-thumbnails.mjs`: arquivos locais, zero Firebase.
- Testes: usam mocks; não constituem prova de faturamento, segurança das regras implantadas ou carga real.

Essa distinção evita atribuir o pico atual a ferramentas ou código legado cuja execução não foi comprovada.
