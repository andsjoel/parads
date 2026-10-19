# Etapa 5: acompanhamento, contingência e liberação

Atualização técnica posterior: [publicação e rollback vigentes](18-RELEASE-CHECKLIST.md). A ausência de `PARADS_ACCESS_GATEWAY_ENABLED` permite login no candidato, mas não onboarding; `true` habilita também cadastro e `false` fecha o gateway. Este ajuste é local, não uma alteração das variáveis de produção.

Preparação operacional local em 19/10/2026, autorizada por continuidade. **Não é autorização de publicação.**
Entrega desta etapa: rotina manual, responsáveis propostos, sinais de investigação, exercício isolado e critérios de liberação. Sem telemetria nova, assinaturas, automação de cobrança, consultas a produção ou alterações de configurações. A calibração com uso real e a aprovação do proprietário continuam pendentes.

## O que está confirmado

| Item | Evidência | Limite da confirmação |
|---|---|---|
| Grupo privado de aproximadamente 40 jogadores | Proprietário | Não corresponde automaticamente a usuários ativos simultâneos |
| Firebase com faturamento habilitado, banco Standard em São Paulo | Inspeção de metadados da etapa 0 | Histórico de 18/10; não reconsultado nesta etapa |
| Orçamento mensal e avisos em 25%, 50%, 70% e 90% | Proprietário, confirmado após a preparação da etapa 5 | Valor mantido fora do repositório; escopo, destinatários e recebimento não conferidos no painel |
| Provedor telefone/SMS desativado | Proprietário | Sem envio de SMS ou nova alteração de provedor |
| Vercel Hobby; Firewall e mitigação de sistema ativos | Painel relatado pelo proprietário | Não houve acesso administrativo Vercel nesta etapa |
| Cerca de 3,7 mil requests permitidos, 524 negados e 1 desafiado em 24h | Painel histórico relatado na etapa 0 | São requests HTTP, não leituras Firebase; não são baseline atual |
| Aproximadamente 6.500 leituras e 327 gravações em cartão anterior | Proprietário, auditoria inicial | Janela indefinida: não usar como total diário ou teto de normalidade |
| Melhorias e proteções das etapas 1 a 4 | Código/testes isolados | Ainda não publicadas; resultados não medem cobrança real |

Regras publicadas, commit/runtime/região da função e uso atual precisam ser reconferidos antes da implantação, com escopo somente leitura autorizado. Não tratar o arquivo local de regras como o que já protege produção. Ver [baseline histórica](09-SECURITY-BASELINE.md).

Inspeção posterior autorizada em 19/10: os 43 vínculos/contas foram conferidos e as regras publicadas continuam antigas, diferentes da candidata. O proprietário reiterou evidências anteriores de Production `main`/`7e70408` Ready / Current, Node.js 24.x e região `iad1`. Concluiu a inspeção visual atual de ambiente: três variáveis `FIREBASE_ADMIN_*` Secret em Production, nenhuma `PARADS_*` e opção de acesso às variáveis de sistema habilitada. Persistem pendentes a validação efetiva em runtime e a reconfirmação do deployment na janela de implantação; ver [resultado somente leitura](17-READONLY-PRODUCTION-INSPECTION.md). Sem a flag de habilitação, o gateway candidato fica desligado por padrão. Não houve implantação ou alteração de configuração.

## Responsáveis e canal

- Responsável proposto: proprietário do PARADS, com acesso aos painéis Firebase/Cloud Billing/Vercel. Confirma valores e destinatários, acompanha alertas e aprova contenção/reabertura. Esta proposta não confirma disponibilidade ou compromisso de atendimento.
- Substituto: ADM indicado pelo proprietário, se houver. Não atribuir acesso IAM/faturamento automaticamente aos ADMs do aplicativo: são permissões diferentes. Enquanto não houver substituto confirmado, registrar que a resposta depende do proprietário.
- Canal externo proposto: contato direto/WhatsApp do responsável; usar o grupo para comunicar indisponibilidade. Não depender das notificações do próprio app durante um incidente.
- Codex prepara/revisa arquivos e interpreta dados agregados quando solicitado. Não permanece monitorando em segundo plano e não desliga serviços por conta própria.
- Definir disponibilidade para o próximo Paradão antes da reabertura. A rotina abaixo não garante resposta imediata; na ausência de responsável, discutir com o proprietário o risco de abrir o app sem acompanhamento.

## Rotina sem novos serviços

Utilizar painéis e alertas existentes, sem habilitar exportação BigQuery, logs de auditoria detalhados, Pub/Sub, funções agendadas ou coletores de eventos por requisição.

| Momento proposto | Conferir e registrar |
|---|---|
| Antes de uma publicação autorizada | Deployment/commit, regras realmente publicadas, região/runtime das APIs, flags, escopo/destinatários dos avisos e contas com vínculo válido |
| Após publicação e validação autorizadas | Estado das APIs e acesso designado; observar métricas atualizadas após a latência do painel. Não gerar carga para testar alertas |
| Primeiros 7 dias de uso | Uma revisão diária de Firestore, Billing e Vercel; marcar se houve pelada, campanha de cadastro ou testes locais |
| Primeiro e segundo Paradão | Revisão antes do início, em intervalos aproximados de 30 minutos se o responsável estiver disponível, e ao terminar |
| Dia seguinte ao jogo | Reconciliar gráficos com Billing/SKUs; anotar diferenças de janela e atraso. Faturamento pode ser atualizado posteriormente |
| Depois de estabilizar | Revisão semanal e após release que mude consultas, listeners ou APIs, mantendo os avisos de orçamento |
| A qualquer alerta ou relato de falha geral | Investigar a origem e a janela; não aguardar o próximo horário previsto |

Não abrir listas, diretórios ou o editor de documentos repetidamente para monitorar consumo: isso também pode gerar operações. Preferir totais dos painéis. Não ativar logging integral de corpos das APIs; senhas, códigos, tokens e telefones nunca devem ser copiados para evidências.

## Painel mínimo e interpretação

1. Firestore `(default)`: leituras/gravações/exclusões por janela, erros de regras, listeners/conexões e, se disponíveis no painel atual, erros/latência. Comparar períodos com duração igual.
2. Authentication: agregados de atividade, erros/cotas quando expostos nos painéis existentes; verificar se SMS continua desligado. Não listar/exportar usuários só para contar acessos, nem confundir login com DAU. Se uma métrica não estiver disponível, registrar a lacuna, sem ligar um serviço pago.
3. Vercel: separar as duas rotas de API de navegação e assets, e separar 2xx/4xx/429/5xx. CDN/Firewall negado não prova que o Firestore direto está protegido. Vídeos/GIFs consomem tráfego, não leituras de documentos.
4. Cloud Billing: projeto correto, moeda, período, serviço/SKU, gasto real e previsão. Não somar valores de serviços ou janelas incompatíveis.

O dashboard de uso estima operações; em divergência, o relatório de faturamento prevalece. Métricas de Firestore são amostradas e podem levar alguns minutos para aparecer. Não reverter uma correção por o gráfico não mudar imediatamente. [Monitoramento oficial](https://firebase.google.com/docs/firestore/monitor-usage).

Conexões não equivalem a pessoas ou listeners. Uma aba na lista costuma manter os dois listeners globais de segurança/stats e o listener da tela; mais abas, relatórios e reconexões mudam essa relação. O número não deve virar regra automática de bloqueio.

## Orçamento e avisos

Usar `B` para o orçamento mensal que o proprietário já configurou. **Valor informado privadamente pelo proprietário, com avisos em 25%, 50%, 70% e 90%.** O valor não é reproduzido no repositório. Isso é confirmação do proprietário, não inspeção direta de escopo, destinatários, tipo de aviso (gasto real/previsão) ou recebimento. Não inferir tarifa regional nem compromisso de gasto máximo.

Resposta operacional proposta para os avisos existentes; nenhuma configuração alterada:

| Sinal financeiro | Resposta proposta |
|---|---|
| 25% de B | Conferir consumo acumulado, período e serviço; distinguir uso esperado de crescimento inesperado |
| 50% de B | Revisar serviços/SKUs, ritmo de gasto e calendário de jogos restantes |
| 70% de B, ou previsão acima de B quando disponível | Investigar no mesmo dia quando possível e combinar uma eventual contenção com o proprietário |
| 90% de B, ou crescimento anormal sustentado | Contatar o proprietário e solicitar decisão de contenção direcionada antes de atingir B; não esperar uma trava automática |

Manter a configuração existente até revisão/aprovação. Conferir que o orçamento seja do projeto correto e que os destinatários tenham acesso ao email; não registrar endereços pessoais ou valores privados no repositório. Não gerar gasto artificial para provocar um aviso. Vercel e Firebase são acompanhados separadamente.

**Orçamento com alertas não corta consumo.** Atingir um percentual não suspende o Firestore nem constitui teto rígido do Blaze. Não há desligamento automático de billing neste projeto; notificações e gastos têm atrasos. [Orçamentos oficiais](https://docs.cloud.google.com/billing/docs/how-to/budgets).

Não dividir B por 30 e bloquear todo domingo acima desse valor diário: a atividade do grupo é concentrada em dias de jogo. Comparar dias com e sem pelada separadamente.

## Limiares provisórios de investigação

Os valores abaixo são **hipóteses operacionais locais**, não limites técnicos do Firebase, configuração publicada, previsão de custo ou prova de ataque. Servem para olhar o painel e contextualizar, nunca para bloquear automaticamente os 40 jogadores. Aprovação/calibração pendentes.

| Sinal | Investigação sugerida |
|---|---|
| Mais de 2.000 leituras em 15 minutos fora do período de jogo | Conferir cadastros, acesso a cartas, release, localhost, reconexões e possibilidade de abuso |
| Mais de 10.000 leituras ou 500 gravações em 15 minutos durante a pelada | Conferir número aproximado de espectadores, chegadas/resultados, várias abas e clientes antigos; observar a janela seguinte |
| Após baseline suficiente: mais de 3 vezes a mediana de uma janela comparável | Investigar mesmo abaixo dos números acima; só usar com volume/contexto suficientes, sem dividir por mediana zero |
| Dez ou mais respostas 429 em 5 minutos numa rota, ou jogadores legítimos bloqueados | Distinguir cota lógica esgotada, IP compartilhado e ataque. Não aumentar tetos sem diagnóstico |
| Cinco ou mais respostas 5xx em 5 minutos numa rota, ou falha geral de login/recuperação | Conferir indisponibilidade do provedor, configuração, contenção nas transações e deployment; 503 é falha fechada, não necessariamente ataque |
| Exclusões inesperadas, SMS habilitado/uso não reconhecido, salto sem uso conhecido ou alerta financeiro | Investigar imediatamente quando detectado; não esperar atingir um total de leituras |

Usar janelas completas e painel atualizado. Confirmar tendência em duas janelas consecutivas quando não houver urgência ou falha geral. Não ignorar anomalia menor apenas por estar abaixo desses valores.

Depois de **dois dias de jogo e dias comuns observados**, revisar medianas/picos de janelas comparáveis e aprovar novos limiares. Não calcular P95 confiável de duas partidas, nem usar o ensaio de 630 -> 30 gets como taxa real de cobrança. Registrar amostra, reconexões, versão e limitações antes de atribuir economia à etapa 3.

## Decisão de contenção

Somente o proprietário ou operador explicitamente autorizado executa ações de produção. Este roteiro não pré-autoriza mudanças futuras. Ver [procedimento completo](12-CONTINGENCY-RUNBOOK.md) e [limites das APIs](15-API-PROTECTION.md).

| Origem provável | Primeira ação a propor | Limitação/impacto |
|---|---|---|
| Cadastro/consulta pública pela API | Suspender cadastro, mantendo alias de login | Flag candidata só funciona após implantação autorizada; não bloqueia Auth direto |
| Recuperação de senha | Suspender somente recuperação | Trocas obrigatórias pendentes aguardam; não apagar o estado de segurança |
| Abuso das duas APIs | Bloqueio WAF direcionado ou pausa de ambas | Pode impedir novo login; não desloga sessões já válidas, não bloqueia Firestore direto |
| Leituras/gravações diretas ao Firestore | Regras de contingência com escopo mínimo, após revisão | Pode interromper jogos; negação cliente não bloqueia Admin SDK |
| Authentication direto | Revisar configuração/cotas e opções de restrição disponíveis | WAF do site não resolve. Desativar email/senha pode bloquear o grupo; requer decisão específica |
| Cliente antigo/bug de consumo | Correção ou rollback de código seguro e aviso para atualizar | Manutenção visual não interrompe abas antigas. Não reabrir permissões inseguras como rollback |
| Suspeita de credencial servidor comprometida | Contenção da API e avaliação de revogação/rotação | Regras cliente não limitam Admin SDK; exige reposição controlada de credencial, nunca envio da chave pelo chat |

Antes de reabrir: observar a contenção após propagação e atraso de métricas, validar causa no emulador, conferir o deployment/regras seguros e obter aprovação. Se a pelada precisar seguir offline, o ADM registra provisoriamente a ordem/resultados fora do app; eventual reconciliação posterior de dados precisa de escopo e autorização, não de um script de limpeza.

## Exercício de mesa e regressão isolada

| Cenário sintético | Resultado esperado / evidência |
|---|---|
| 40 jogadores compartilham Wi-Fi | Orçamento testado da API comporta o grupo; 429 exige investigar caminho/IP, não bloquear site inteiro |
| Rajada no reset acima do limite local | Teste da etapa 4: excessos na instância não fazem novas verificações Auth nem leituras Firestore; outras instâncias ainda exigem contador compartilhado |
| Regras emergenciais negam clientes | Teste do emulador: todos os papéis cliente são negados; restauração local das regras recupera acesso sem apagar dados. Admin SDK exige contenção própria |
| Suspeita de pico em Firebase sem pico nas APIs | Investigar SDK/Auth direto, regras, reconexões e clientes antigos; WAF/flag da API não são apresentados como solução suficiente |
| Último aviso em 90%, ou orçamento já alcança 100% | Acionar responsável e propor contenção autorizada; não pressupor aviso configurado em 100% nem corte automático de cobrança |

Não provocar nenhum desses cenários em produção. Comandos de regressão continuam `npm.cmd test` e `npm.cmd run test:emulators`, com as travas da etapa 1. Nenhum novo teste consulta painéis reais, liga serviços ou modifica configuração remota.

Reexecução nesta etapa: **92 testes unitários e 29 testes nos emuladores aprovados**, incluindo negação emergencial/restauração sem apagar dados e flags de suspensão. Os emuladores foram encerrados. Onze links locais nos documentos alterados foram verificados e `git diff --check` passou. Como a entrega é somente documental, não houve alteração de código do app nem necessidade de novo build; esses ensaios não calibram limites de produção.

## Registro operacional sanitizado

Preencher manualmente apenas com agregados, em local privado escolhido pelo proprietário; não versionar dados reais ou capturas sensíveis:

```text
Data/janela e fuso:
Dia de jogo? Campanha de cadastro? Uso de localhost?
Deployment/commit e versão das regras:
Participantes/espectadores aproximados e fonte da estimativa:
Firestore: leituras / gravações / exclusões; atraso e janela do painel:
Auth: agregado disponível ou lacuna:
APIs: totais por rota/status; demais requests/assets separados:
Billing: serviço/SKU, janela/moeda; configuração privada de avisos conferida?
Sinal observado e hipótese (não conclusão antecipada):
Ação proposta, impacto e quem autorizou; horário/resultado:
Critério e aprovação de reabertura:
```

## Portão de liberação

Preparação local não equivale a prontidão operacional confirmada. Antes de publicar, registrar:

- [ ] Valor/percentuais/escopo e destinatários do orçamento conferidos privadamente pelo proprietário.
- [ ] Responsável e eventual substituto, canal e disponibilidade confirmados.
- [ ] Inspeção somente leitura de deployment/runtime/uso e regras realmente publicadas autorizada e realizada; nenhuma credencial exposta.
- [x] Inspeção visual das variáveis/configuração de ambiente concluída pelo proprietário: credenciais Secret em Production, nenhuma `PARADS_*`, acesso às variáveis de sistema habilitado. Disponibilidade efetiva em execução ainda não validada.
- [x] Compatibilidade dos vínculos dos 43 perfis/contas conferida em inspeção somente leitura autorizada de 19/10, sem reset ou correção em massa. Revalidar se houver mudanças antes da publicação.
- [ ] Commit/patch candidato revisado: worktree contém etapas 1 a 4 ainda não publicadas e mudanças anteriores; não executar push automático que dispare deploy.
- [ ] Sequência backend/cliente/flag/regras da [etapa 2](13-ADMISSION-SECURITY.md) aprovada, com manutenção e atualização de clientes antigos consideradas.
- [ ] Limites candidatos e eventual regra WAF aprovados separadamente; WAF não foi configurado aqui.
- [ ] Deployment/ruleset seguros anteriores identificados; rollback de código não apaga dados nem reabre regras públicas automaticamente.
- [ ] Conta de validação designada ou roteiro de operador aprovado; não redefinir senha de jogador real para testar.
- [ ] Acompanhamento inicial e risco residual de faturamento aceitos pelo proprietário.

**Conclusão:** documentação e rotina da etapa 5 preparadas localmente. Calibração com consumo real, aceites operacionais e implantação continuam pendentes; não foram simulados como concluídos. As cinco entregas locais estão preparadas, mas publicação/liberação depende das verificações e autorizações acima.
