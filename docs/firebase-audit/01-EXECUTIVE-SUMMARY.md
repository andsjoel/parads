# Auditoria Firebase do PARADS: resumo executivo

Data: 18/10/2026. Base: commit `7e70408`, aplicação já lançada e dados reais.

Atualizações posteriores: [baseline publicada e origem das evidências](09-SECURITY-BASELINE.md), [plano simplificado vigente](10-SIMPLIFIED-SECURITY-PLAN.md), [testes isolados da etapa 1](11-ISOLATED-TESTS.md) e [contingência](12-CONTINGENCY-RUNBOOK.md). As recomendações iniciais abaixo não substituem esse escopo aprovado.

## Escopo e limites

Auditoria estática do código, dependências, rotas, serviços, regras versionadas, API, scripts e testes. Consultadas fontes oficiais para faturamento e limites. Somente estes documentos foram criados. Não foram executados o app contra produção, scripts de manutenção, consultas ao banco, mudanças de regras ou migrações. Nenhuma credencial ou dado pessoal é necessário para reproduzir a análise.

O banco implantado, região, edição, plano, índices, quantidade de documentos, usuários simultâneos e fatura não foram inspecionados. Regras locais não comprovam quais regras estão publicadas. Os números de 6.500 leituras, 327 gravações e os crescimentos percentuais foram informados pelo proprietário; não são medições desta auditoria.

## Diagnóstico

**O Firebase é adequado ao produto, mas o uso atual precisa de correções antes de crescer e de uma revisão de autorização antes da reabertura.** Há desperdícios demonstráveis, não evidência de que o Firestore seja inadequado ou de que seja necessário trocar de banco.

Pontos positivos: consultas principais têm `limit`, listeners principais retornam limpeza, sessão tem deduplicação de promessas, compras/resgates usam transações e catálogo/mídia não dependem de consultas Firestore. Não foi encontrado um loop infinito comprovado nem um vazamento generalizado de listeners.

Pontos frágeis: perfis completos são buscados repetidamente em resposta a mudanças não relacionadas; feed vazio e busca de cartas varrem duas coleções; ADM sincroniza todos os perfis ao carregar a aplicação; listas concentram estado e histórico; regras permitem operações além das autorizadas pela interface.

## Cinco maiores riscos

| Prioridade | Achado | Evidência | Efeito |
|---|---|---|---|
| 1 | F01/F02, CRÍTICO: autorização insuficiente | [firestore.rules:29](../../firestore.rules#L29), [49](../../firestore.rules#L49), [92](../../firestore.rules#L92), [111](../../firestore.rules#L111) | Consumo abusivo, alteração de economia/listas e cadastro sem prova do código validada pelo servidor. Exposição depende das regras implantadas. |
| 2 | F03, ALTO: cascata lista -> perfis | [MatchList.jsx:364](../../src/pages/MatchList.jsx#L364) | Até três leituras explícitas por pessoa em cada rodada de atualização, para cada espectador. |
| 3 | F04, ALTO: diretório completo no feed vazio e cartas | [publicProfileService.js:67](../../src/services/publicProfileService.js#L67), [Feed.jsx:89](../../src/pages/Feed.jsx#L89) | Aproximadamente `2U` documentos por acesso, antes da carta selecionada. |
| 4 | F05, ALTO: sincronização global automática do ADM | [AuthContext.jsx:95](../../src/contexts/AuthContext.jsx#L95), [publicProfileService.js:112](../../src/services/publicProfileService.js#L112) | `U` leituras + `U` gravações por runtime administrativo com sucesso. |
| 5 | F06, ALTO: documento de pelada com snapshots completos | [volleyListService.js:631](../../src/services/volleyListService.js#L631) | Tráfego crescente, contenção e risco de exceder limites; atualizações acionam F03. |

Não confundir ALTO por desperdício comprovado com volume faturado comprovado. Tamanho real do documento, cache, reconexões e simultaneidade precisam de medição.

## Funcionalidade potencialmente mais cara

**Acompanhamento público de lista/partidas durante uma pelada movimentada.** O listener retorna um documento; o efeito dependente de `list` busca novamente todos os perfis, inventários e estatísticas. Alteração das estatísticas do próprio usuário pode disparar outra rodada. A tela administrativa usa nomes simples, mas suas ações provocam atualizações recebidas pelos espectadores.

Modelo de chamadas: `V × E × (1 + 3P)`, onde `V` são espectadores, `E` alterações recebidas e `P` pessoas únicas. Para `V=10`, `E=7`, `P=30`: 6.370 leituras lógicas, antes de inicialização e regras. Isso demonstra plausibilidade, não explica comprovadamente o pico observado nem equivale automaticamente à cobrança.

## Pico e cotas

As causas candidatas são F03, feed vazio com diretório completo, navegação/remontagem, sincronizações administrativas e desenvolvimento usando o mesmo projeto. A abertura de contas também gera gravações legítimas. O StrictMode só explica repetição extra no desenvolvimento; não explica, sozinho, produção.

Se 6.500/327 forem totais de um único dia de cota, representam 13% das 50.000 leituras e cerca de 1,64% das 20.000 gravações gratuitas diárias. O painel e o período precisam ser confirmados. Crescimento percentual sobre uma base quase vazia não comprova anomalia. [Cotas oficiais](https://firebase.google.com/docs/firestore/quotas).

Não existe um número fixo de usuários suportados no gratuito. No modelo de sensibilidade documentado em [05](05-USAGE-AND-COST-SIMULATION.md), incluindo hipótese de 50% de overhead de leitura: até 89 usuários leves, 25 moderados ou 9 intensos antes de acrescentar administração e folga. São limites matemáticos desse roteiro pessimista de onboarding, não capacidade real medida nem recomendação de operação. O roteiro intenso simula múltiplos acessos durante muitas mudanças, todos os dias.

## Blaze

**Os dados fornecidos não justificam uma migração imediata por volume.** Primeiro confirmar consumo diário, região, regras e reduzir amplificações. Se o dia de jogo realmente exceder a cota, Blaze pode preservar disponibilidade, mas não corrige desperdício ou autorização. O orçamento deve considerar operações, tráfego, armazenamento, Auth e Vercel separadamente. Tarifas regionais não foram inferidas do domínio brasileiro; ver fórmulas em [05](05-USAGE-AND-COST-SIMULATION.md).

## Cinco otimizações prioritárias

1. Fechar autorização de escrita/cadastro no servidor, com testes de compatibilidade em emulador antes de publicar regras.
2. Desacoplar atualização da pelada da busca de perfis: cache compartilhado, deduplicação e busca apenas dos ausentes; estatísticas completas sob demanda.
3. Substituir as varreduras do diretório por projeção leve e paginação; no guia, buscar somente um ADM.
4. Retirar sincronização global do login; manter projeções por evento alterado e reparação manual autorizada.
5. Enxugar o documento transmitido da pelada e separar histórico/eventos, após medir seu tamanho.

Ordem: linha de base observável -> autorização compatível -> cascata de perfis -> diretórios -> sincronização -> modelo da pelada. Cada etapa precisa de autorização de implementação. Nenhuma foi aplicada.

## Estado de manutenção

[App.jsx:9](../../src/app/App.jsx#L9) retorna a manutenção antes de montar `AuthProvider`; uma abertura nova desta versão não inicia os fluxos de leitura descritos. A inicialização do SDK por import não é, por si só, consulta Firestore. Clientes já abertos, versões antigas, API e scripts não são bloqueados por essa tela. Os capítulos analisam os fluxos que voltam a operar quando ela for desativada.

## Documentos

- [02: arquitetura](02-FIREBASE-ARCHITECTURE.md)
- [03: inventário de operações e fluxos](03-FIRESTORE-OPERATIONS.md)
- [04: achados e evidências](04-PERFORMANCE-FINDINGS.md)
- [05: simulações e custos](05-USAGE-AND-COST-SIMULATION.md)
- [06: plano de otimização](06-OPTIMIZATION-ROADMAP.md)
- [07: monitoramento](07-MONITORING-GUIDE.md)
- [08: perguntas técnicas](08-TECHNICAL-QA.md)
