# Etapa 3: otimização do consumo do Firestore

Implementação local em 19/10/2026, autorizada exclusivamente para reduzir consumo.
**Não publicada.** Nenhum acesso de teste, alteração de dados, regra ou configuração de produção.
As alterações locais das etapas 1 e 2 foram preservadas; etapa 4 não iniciada.

## Alterações

- `/list`, `/matches` e rankings do feed carregam somente `public_profiles/{uid}` para minicards. Inventário e estatísticas não são necessários nesses componentes.
- O hook compartilhado usa o conjunto ordenado de UIDs. Resultados, reordenações e atualizações das estatísticas próprias não recarregam os perfis. Jogadores já carregados são mantidos durante a permanência na tela; uma chegada nova busca somente o UID novo. Removidos não provocam novas buscas.
- A carta completa busca os três documentos quando aberta, forçando atualização para não mostrar estatísticas antigas. A própria carta usa a sessão e seu listener existente; mocks e snapshots históricos completos continuam locais. Respostas atrasadas não substituem outra seleção nem reabrem cartas fechadas.
- Cache somente em memória, por aba: previews por 60 segundos, bundles/diretório/ADM por 30 segundos; ausência por 3 segundos. Requisições concorrentes compartilham a mesma Promise; falhas podem ser tentadas novamente. Limite de 256 entradas, sem timers, polling, armazenamento persistente ou cache usado para autorização.
- Logout ou troca de UID limpa o cache e descarta resultados pendentes do escopo anterior. Exclusão/edição de usuário, provisionamento de convidado e personalização invalidam os caches relacionados depois do sucesso da gravação, sem acrescentar leituras/gravações ao Firestore.
- Feed vazio localiza ADM por `role == admin`, com fallback `type == admin`, limite de 10 resultados por consulta. Valida inventário/estatísticas do candidato para não usar perfil órfão. Se o próprio usuário da sessão é ADM, utiliza o bundle da sessão sem consultas adicionais.
- `/cards` mantém busca local por nome, nome de exibição e username de todos os perfis, inclusive convidados provisionados. Continua filtrando perfis sem inventário, evitando reintroduzir contas órfãs. Inventários são consultados somente pelos IDs do diretório, em blocos de até 30; não há varredura irrestrita da coleção de inventários.
- A sincronização global automática `users -> public_profiles` foi retirada do login do ADM e do feed. A sincronização do próprio perfil ao entrar permanece. Os serviços existentes já escrevem a projeção pública ao cadastrar, editar ou personalizar. Funções manuais antigas continuam exportadas, mas sem chamadas automáticas.
- Nenhuma alteração em regras de times, resultados, recompensas, limites da lista ou autorização. Nenhuma nova API, assinatura, App Check ou reCAPTCHA.

## Comparação reproduzível

Testes executam a versão anterior real de `publicProfileService`, congelada em `tests/fixtures/publicProfileService-before.mjs`, e a implementação atual contra o mesmo SDK simulado e documentos sintéticos. Hooks executados com React 18 e seu test renderer, dependência apenas de desenvolvimento.

| Cenário equivalente, mesma aba | Antes | Depois |
|---|---:|---:|
| 30 jogadores, 7 entregas com o mesmo conjunto de UIDs | 630 gets | 30 gets (redução de 95,2%) |
| Uma chegada após carregar os 30 jogadores | Mais 93 gets | Mais 1 get |
| Estatísticas próprias mudam; mocks e próprio usuário exibidos | Refetch do conjunto anterior | 0 gets adicionais |
| Diretório com 40 perfis/40 inventários, 10 entradas em menos de 30s | 800 documentos | 80 documentos |
| Primeira entrada no diretório com 40 perfis/40 inventários | 80 documentos | 80 documentos |
| Localizar o único ADM no feed vazio, com 40 perfis | 83 documentos | 4 documentos; 0 se for o próprio ADM da sessão |
| Sincronização global automática ao entrar como ADM, 40 usuários | 40 leituras + 40 gravações | 0 globais; sincronização própria mantida |
| Abrir carta completa de outro jogador | Aproveitava bundle antigo pré-carregado | 3 gets sob demanda, atualizados |

O exemplo de 30 jogadores não desconta o próprio usuário; quando presente, seu perfil também vem da sessão. As sete entregas de resultados continuam sendo recebidas em tempo real.

**Não são medições da fatura nem promessa de economia percentual global.** Contagens instrumentadas de gets/documentos retornados (mínimo de uma leitura por consulta vazia no simulador), sem tráfego real. Dependências de regras, índices, latência, cache interno do SDK, retries, reconexões e outros fluxos podem mudar a cobrança. Não foram executados testes de carga contra produção.

## Validação

- `npm.cmd test`: **77 testes aprovados**, com bloqueio de rede externa, incluindo comparação antes/depois, deduplicação, novas chegadas, perfil próprio, mocks, TTL, falhas, troca de conta, compatibilidade legada e seleção/fechamento de cartas.
- `npm.cmd run test:emulators`: **24 testes aprovados**, projeto exclusivo `demo-parads-security`, fixtures sintéticas. Regressão das etapas 1/2 e testes novos de previews/cartas/diretório/ADM para membro, convidado e ADM; negação para anônimo/Auth sem vínculo; sete revisões do listener real da lista sem novas leituras de perfis.
- ESLint nos arquivos alterados da etapa 3 e build local Vite em `.firebase/build-check`.
- Não foi usado o app de desenvolvimento conectado ao Firebase real como ambiente de testes. Não houve teste visual autenticado em produção. ESLint global possui problemas anteriores, não corrigidos nesta etapa.

## Limites e riscos residuais

- Minicards de terceiros não acompanham cada mudança cosmética enquanto a tela permanece aberta. A carta completa é atualizada ao abrir; estatísticas próprias e partidas continuam com seus listeners originais. Voltar à tela reutiliza cache curto, sem polling.
- Falha em um preview não deixa requisição defeituosa em cache. O próximo carregamento do conjunto ou reentrada pode tentar novamente; abrir a carta tem sua própria tentativa. Não existe loop automático de retries durante o jogo.
- O diretório ainda lê todos os perfis públicos na primeira carga, pois a busca atual permite substrings em vários campos. Para cerca de 40 jogadores essa leitura é funcional e deliberada. Não foi introduzida uma busca parcial que silenciosamente escondesse pessoas.
- Consultas administrativas de usuários/convites e os listeners necessários continuam consumindo leituras legítimas. Não foram substituídos por caches permanentes que esconderiam novos convidados ou alterações na gestão.
- A consulta do ADM é limitada aos primeiros 10 candidatos por campo; se houver muitos perfis ADM órfãos, pode não encontrar um válido. Não tenta reparar ou varrer todas as contas silenciosamente.
- Retirar a sincronização global pressupõe as projeções públicas existentes. Conta legada sem projeção continua dependendo da sincronização do próprio login ou de reparo pontual autorizado; não foi executado backfill.
- Cache por aba não limita scripts externos, contas comprometidas ou consumo por outros clientes. Esta etapa otimiza o cliente normal; não cria proteção antibot nem teto de faturamento. Blaze continua sem limite financeiro rígido e alertas podem atrasar.

## Implantação e rollback futuros

1. Revisar e aprovar estes resultados locais. Não avançar para APIs/etapa 4 automaticamente.
2. Antes de qualquer publicação, decidir explicitamente o pacote das etapas anteriores: o worktree também contém mudanças de admissão/regras não publicadas. Não publicar tudo junto sem seguir as dependências descritas na etapa 2.
3. A otimização em si não requer novo campo, migração, credencial, índice composto ou alteração de regras. Validada com as regras locais candidatas; regras publicadas não foram modificadas.
4. Após publicação separadamente autorizada, comparar uma janela real de Paradão com quantidade semelhante de usuários e partidas, descontando reconexões e leitores antigos. Sem gerar tráfego artificial.
5. Se necessário, reverter somente o patch da etapa 3 ou restaurar um deployment previamente validado. Dados não precisam ser revertidos: a etapa não muda o esquema nem reescreve documentos. Considerar que restaurar o cliente antigo também restaura seus refetches e sincronizações globais.
