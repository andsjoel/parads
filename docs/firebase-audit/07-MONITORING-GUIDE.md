# Guia de monitoramento e controle de consumo

Proposta operacional em 18/10/2026. Nenhum painel, log, orçamento ou serviço foi configurado durante a auditoria.

Atualização de 19/10: este capítulo registra a proposta inicial. O procedimento vigente, limiares provisórios, distinção entre baseline histórica e dados ainda pendentes, responsáveis propostos e checklist de liberação estão na [etapa 5](16-OPERATIONS-AND-RELEASE-GATE.md). Os refetches e a sincronização global descritos abaixo foram tratados somente no código candidato da etapa 3; não presumir implantação em produção.

## Primeiro: estabelecer a referência correta

No Firebase/Google Cloud Console, confirmar projeto e banco `(default)`, edição/região, plano, regras publicadas e intervalo de cada gráfico. Registrar somente totais agregados, sem exportar convites, telefones, senhas ou documentos de usuários.

Anotar: release/commit, período e fuso, DAU estimado com origem dessa estimativa, número máximo de espectadores, ações do ADM, dia com/sem pelada e se houve uso do localhost no mesmo projeto. O código usa a mesma configuração Firebase independentemente de origem web; desenvolvimento pode consumir a base real.

Os painéis de uso são estimativas e podem divergir da cobrança; comparar também Cloud Billing/SKUs. Consultas vazias, no-ops e outros detalhes podem não aparecer da mesma forma no cartão de uso. [Monitoramento oficial](https://firebase.google.com/docs/firestore/monitor-usage).

## Painel mínimo recomendado

| Métrica | Onde / objetivo | Interpretação no PARADS |
|---|---|---|
| Leituras, gravações e exclusões por período | Firestore Usage + Cloud Monitoring | Comparar por release e por dia de pelada, não apenas % contra o início do projeto |
| Requisições/erros e latência p50/p95 | Cloud Monitoring/API | Aumento de permission-denied, resource-exhausted ou aborted sinaliza regras/cota/contenção; erros podem mascarar consumo |
| Conexões ativas e snapshot listeners | Firestore/Cloud Monitoring | Esperados 2 globais + 1 da tela usual, 5 em relatórios; várias abas/dispositivos mudam a relação |
| Avaliações/recusas de regras | Painel de Security Rules / Monitoring | Investigar crescimento de recusas e dependências, sem pressupor número fixo de reads por avaliação |
| Armazenamento, índices e saída | Usage/Billing | Crescimento de history/games e documentos grandes pode pressionar bytes sem aumento proporcional no número de docs |
| Operações e custos por SKU/dia | Cloud Billing | Fonte para custo real regional, moeda e consumo não visível no gráfico de app |
| API de recuperação: volume, status e duração | Logs Vercel | Separar custo da função/Auth e Firestore; nunca registrar senha temporária, corpo da requisição ou token |
| Tráfego e cache HTTP | Vercel | GIF/vídeo não são leituras Firestore; controlar egress e latência de assets |

Um SDK web pode compartilhar uma conexão entre vários listeners, então conexão não é sinônimo de listener ou usuário. Métricas de Firestore são amostradas e chegam com atraso; não exigir que o gráfico mude no instante do clique. [Detalhes das métricas](https://firebase.google.com/docs/firestore/monitor-usage).

Não há Analytics inicializado no código. Não presumir DAU pronto por tela. Contagem de logins também não equivale a DAU: sessão persistente pode dispensar novo login. Usar dados agregados já disponíveis de Auth quando apropriados e declarar suas limitações; qualquer nova medição de sessão deve ter objetivo e política de privacidade.

## Investigar o pico próximo de 16/10

1. Confirmar janela, total/dia e o fuso do painel; salvar somente o gráfico agregado e seu contexto.
2. Correlacionar com deploys, abertura do grupo, cadastros e testes locais; não atribuir causalidade só por coincidência.
3. Verificar se o feed estava vazio: cada acesso podia carregar perfis+inventários inteiros para o guia.
4. Observar quantas recargas de ADM ocorreram: cada runtime bem-sucedido pode varrer/escrever todos os perfis.
5. Contar ações de lista/resultados e espectadores aproximados; confrontar com `V × E × (1+3P)` como hipótese de fan-out.
6. Examinar reconexões móveis e sessões/abas antigas; StrictMode é uma hipótese somente para localhost/desenvolvimento.
7. Conferir automações/scripts/Console usados nesse intervalo. Não rodar a limpeza antiga para tentar descobrir consumo.
8. Só concluir depois de testar o fluxo suspeito em ambiente isolado e observar correlação reproduzível.

Sem histórico por função, parte da atribuição passada será impossível. Não inventar que um número de reads veio exatamente de um serviço.

## Instrumentação viável com baixo custo

Implementação futura proposta: wrapper de serviços com contadores locais e amostragem, não um documento Firestore escrito por leitura.

Campos possíveis: release, ambiente, nome lógico da operação (R06/L20 etc.), categoria da tela, quantidade de documentos, quantidade de IDs únicos, duração, origem cache/servidor quando a API expuser metadata, código de erro e contagem de inscrições/limpezas. Não incluir UID, nomes, telefone, username, query de busca, payload, token, código de acesso ou senha.

Separar métricas:

- **Tentativas da aplicação:** chamadas getDoc/getDocs/transações iniciadas.
- **Entregas SDK:** snapshot callbacks/docChanges, metadata.fromCache e mudanças pendentes; eventos locais não são prova de faturamento.
- **Rede/servidor:** solicitações observáveis e reconexões; HTTP/stream não corresponde um-para-um a documento.
- **Cobrança:** métricas/SKUs do provedor, incluindo regras e custos externos.

Começar com painel em memória/log local em build de teste. Se for enviar a endpoint de telemetria, agregar por janela e amostrar; definir teto, retenção curta e custo. Endpoint precisa de controles para não virar coletor abusável. Não armazenar um evento por operação no Firestore: isso cria leituras/escritas para observar leituras/escritas.

Para listeners, registrar subscribe/cleanup e máximo simultâneo por categoria. Para bundles, medir cache hit, miss, número de chamadas concorrentes deduplicadas e IDs reutilizados. Não contar só renderizações React.

## Ferramentas e limitações

- React Profiler identifica renders/efeitos, não leituras cobradas; usar em build de teste.
- DevTools Network ajuda a localizar consultas e repetição; exports HAR podem conter credenciais/dados. Não anexar sem sanitizar.
- Emulator Suite permite validar regras, fluxos e contagens de aplicação sem produção, mas não reproduz faturamento, latência regional ou todos os índices/limites de carga.
- Query Explain pode analisar as queries e uso de índices pelo SDK servidor. Tem custo próprio: opção default cobra uma leitura; analyze executa a consulta. Requer IAM e não foi executado nesta auditoria. [Fonte oficial](https://firebase.google.com/docs/firestore/query-explain).
- Logs de acesso/auditoria e export de Billing podem ajudar a atribuir consumo, mas trazem custo, retenção e dados sensíveis. Habilitar com escopo aprovado, não como logging irrestrito de todos os documentos.
- Recursos como Query Insights/Key Visualizer dependem de disponibilidade, volume/edição e permissões; não presumir que ofereçam nome de componente React automaticamente.

## Alertas propostos

No Spark ou para acompanhar o gratuito, propor avisos em 50%, 75% e 90% da cota diária observada, mais alerta por taxa de crescimento e projeção até a virada. São políticas propostas, não limites oficiais. Considerar atraso das métricas e a virada no horário do Pacífico.

No Blaze, orçamento monetário mensal baixo, escolhido pelo proprietário, escopado ao projeto e com avisos de gasto real/previsão em múltiplos níveis. Usar contatos que realmente respondam no domingo. Conferir região/SKUs e serviços fora do Firestore. [Orçamentos e alertas oficiais](https://docs.cloud.google.com/billing/docs/how-to/budgets).

**Um orçamento alerts-only não interrompe consumo.** A documentação atual tem spend cap budgets para serviços elegíveis, mas a lista Firebase consultada inclui AI Logic, App Hosting, Functions e Extensions, não Firestore. Não prometer teto automático de gasto do banco; mesmo nos serviços elegíveis, há atraso e excedente possível. [Elegibilidade Firebase](https://firebase.google.com/docs/projects/billing/spend-caps), [limitações Cloud Billing](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps).

Não confundir Firebase App Hosting com a configuração Vercel deste repositório, hospedagem também informada pelo proprietário, mas não verificada nesta auditoria. Um spend cap de serviço Google não limita a fatura Vercel. Confirmar futuras mudanças de elegibilidade no momento da implantação.

Automação de resposta (Pub/Sub, restrição de tráfego, modo restrito) exige implementação e testes, pode gerar indisponibilidade e não oferece garantia de custo exato. Desabilitar billing automaticamente pode afetar vários serviços e não deve ser a primeira resposta nem ser ativado sem aprovação. A tela atual de manutenção não é um kill switch de banco.

## Resposta a incidente

1. Confirmar se é uso legítimo, bug, reconexão ou abuso; guardar só evidências agregadas e versão afetada.
2. Avisar o responsável; manter meios de comunicação externos ao app.
3. Conter o fluxo com rollback/limitação autorizada; lembrar que aba antiga continua executando código antigo.
4. Se precisar mudar regras/APIs para conter, usar escopo mínimo e avaliar contas/recuperação. Não abrir permissões para eliminar erros.
5. Reavaliar métricas após o atraso do painel, verificar integridade sem resetar dados e registrar causa/ações.

Nenhuma operação de limpeza/redefinição de senha de usuário real deve ser usada como teste de observabilidade.

## Validar que uma otimização funcionou

Roteiro sintético fixo, mesmo dataset, mesmo número de participantes, espectadores e ações; separar cold/warm cache e desenvolvimento/produção. Executar antes/depois no emulador/projeto de teste, não contra usuários reais.

Registrar por roteiro: chamadas por ID de operação, docs retornados, cache hit, listeners máximos/ao sair, bytes, latência e resultados funcionais. Para F03, uma alteração só de time deve manter atualizada a quadra sem recarregar todos os inventários. Para F05, abrir ADM não deve gravar U perfis.

Depois de deploy autorizado, comparar dias equivalentes e normalizar por sessões/ações/espectador-minuto. Uma queda durante manutenção ou com menos pessoas não prova economia da correção. Combinar dashboard e Billing; não concluir a partir de um único cartão percentual.

## Dados que o proprietário pode fornecer com segurança

Região/edição/plano, quantidade agregada de cadastrados/DAU, gráficos com janela/fuso, totais por dia e SKU, versão das regras e horários de deploy. Não enviar chave privada, tokens, lista de telefones, senhas, códigos de convites ou export completo de usuários.
