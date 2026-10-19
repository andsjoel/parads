# Etapa 0: baseline de segurança publicada

Nota posterior: a etapa 2 alterou as regras **locais candidatas**. A comparação abaixo registra a inspeção histórica, não igualdade atual entre workspace e produção. Nenhuma regra foi publicada nesta implementação. Ver [13](13-ADMISSION-SECURITY.md).

Inspeção autorizada pelo proprietário em 18/10/2026. Observações entre 23:28 e 23:30, horário de Brasília (`19/10/2026 02:28-02:30 UTC`).

Status: **inspeção Firebase concluída; Firewall Vercel informado pelo proprietário; deployment parcialmente verificado**. A atualização posterior do painel e a desativação de telefone/SMS estão registradas abaixo, com sua origem. O critério de aprovação completo da etapa 0 ainda depende da inspeção administrativa do deployment e de sua configuração de execução. Nenhuma etapa de implementação foi iniciada.

## Escopo e segurança da inspeção

- Consultados somente metadados/configurações administrativos e HTML/JavaScript públicos do site.
- Não foram lidos documentos de usuários, convites, listas, saldos, inventários ou históricos. Não foi realizada listagem de contas Auth.
- Não foram enviados SMS, criadas contas, redefinidas senhas ou executados testes de exploração contra produção.
- Não houve PATCH/PUT/DELETE, publicação de regras, migração, alteração de billing, alteração de provedor, deploy ou push. O Firebase CLI existente foi usado somente para autenticar as consultas, com eventual renovação OAuth de credencial local.
- Somente este documento de baseline foi criado nesta etapa. As alterações locais anteriores em `appStatus.js` e `appAccess.test.mjs` foram preservadas sem modificação.
- Não se executou `scripts/firebase-maintenance.mjs`: a consulta de metadados foi independente da ferramenta antiga de limpeza.

## Resultados e grau de confirmação

| Item | Resultado | Evidência / limite |
|---|---|---|
| Projeto Firebase | `parads-app-26f23`, estado ACTIVE | GET Firebase Management API |
| Banco | `(default)`, FIRESTORE_NATIVE, edição STANDARD | GET do recurso de banco, sem `/documents` |
| Região | `southamerica-east1`, São Paulo | Campo `locationId` do banco |
| Concorrência configurada | PESSIMISTIC | Campo do recurso de banco; não implica que transações web usem locking pessimista |
| Faturamento | `billingEnabled=true` | Cloud Billing API; confirma faturamento habilitado, compatível com Blaze informado pelo proprietário |
| Orçamentos/avisos | Configurados segundo o proprietário | Não inspecionados os destinatários, valores ou alertas efetivos |
| Regras publicadas | Iguais às locais, incluindo hash bruto | Firebase Rules API; ver comparação abaixo |
| App Check Firestore | OFF, estado padrão não configurado | Lista de serviços vazia; GET individual sem enforcementMode e updateTime de 1970; esquema oficial define OFF como padrão |
| App Check Auth | OFF, mesma condição | Mesma verificação para `identitytoolkit.googleapis.com` |
| Auth email/senha | Habilitado, senha requerida | GET da configuração Auth |
| Auth telefone/SMS | Desativado posteriormente pelo proprietário | A inspeção API inicial encontrou habilitado com allowlist BR; a desativação foi informada depois, sem nova consulta API nesta atualização |
| Provedores anônimos / limites adicionais de Auth | Campos selecionados não retornaram configurações explícitas | Não inferir valores de limites de projeto a partir de objetos vazios |
| Domínio público | `https://parads.com.br/` redireciona para `https://www.parads.com.br/`, HTTP 200 | GET público, header Server: Vercel |
| Artefato público | Bundle contém a tela de manutenção e referência ao bg-manutencao | GET do asset; não houve login/navegação autenticada |
| Plano Vercel | Hobby | Informado diretamente pelo proprietário; não verificado por API autenticada |
| Firewall Vercel | Ativo; System Mitigations Active; Custom Rules 0; Bot Protection Inactive | Verificação do painel relatada pelo proprietário; sem acesso administrativo local à Vercel |
| Commit exato publicado / região das funções | Pendentes | Fingerprint de asset não demonstra o commit; não inferir região de execução pelo ponto de presença do CDN |

A auditoria inicial descrevia regras locais e região desconhecida. Esta baseline acrescenta evidência remota de igualdade e localização; não modifica retroativamente o escopo somente estático dos capítulos anteriores.

## Comparação de regras

Recurso publicado: `projects/parads-app-26f23/releases/cloud.firestore`.

Ruleset: `projects/parads-app-26f23/rulesets/e64a8787-2479-4b53-8c2c-2209f3043cde`.

- Ruleset criado em `2026-10-13T20:58:20.862495Z`.
- Release atualizado em `2026-10-13T20:58:22.239504Z` (13/10/2026 17:58:22, Brasília).
- Arquivo remoto: `firestore.rules`.
- SHA-256 bruto local e remoto: `e48289570d98c921e02799eee9a5b210fc32e39c7d91383cc80d444d497cf2e0`.
- SHA-256 normalizado para LF/sem quebra final: `94b55027a0283ad14b600478b01ce6b90adf98ccbf2f97275703cbeaa3447477`.
- Resultado: nenhuma diferença de conteúdo; a igualdade não depende da normalização.

Consequências verificadas **pela configuração publicada**, sem executar manipulações:

1. [firestore.rules:29](../../firestore.rules#L29): coleção de convites permite leitura sem autenticação.
2. [firestore.rules:51](../../firestore.rules#L51): criação cliente não exige prova de validação de código na regra.
3. [firestore.rules:60](../../firestore.rules#L60): dono pode atualizar users, exceto role/type; isso não protege saldo e demais campos sensíveis.
4. [firestore.rules:86](../../firestore.rules#L86): usernames têm leitura pública e criação sem validação completa do vínculo.
5. [firestore.rules:92](../../firestore.rules#L92) e [99](../../firestore.rules#L99): dono pode escrever stats/inventário sem contrato econômico validado no servidor.
6. [firestore.rules:111](../../firestore.rules#L111): criação/atualização de listas autorizada por signedIn, sem a separação de comandos ADM/membro/convidado da interface.

Essas exposições deixam de ser apenas hipóteses sobre regras não publicadas. Isso **não** comprova exploração, adulteração ou incidente ocorrido. Não foram inspecionados dados ou logs para procurar vítimas/alterações.

## App Check e Auth

Os recursos individuais de App Check retornaram somente name/updateTime/etag, com updateTime `1970-01-01T00:00:00Z`; não houve configuração registrada na listagem. O esquema de descoberta oficial define enforcement não configurado como OFF, diferente de UNENFORCED (monitoramento) e ENFORCED (exigência de token).

Referências: [API Service](https://firebase.google.com/docs/reference/appcheck/rest/v1/projects.services), [esquema oficial da API](https://firebaseappcheck.googleapis.com/$discovery/rest?version=v1). Não foram copiados etags ou credenciais de acesso para a documentação.

Impacto: não contar com proteção/monitoramento App Check. Decisão posterior do proprietário: App Check e reCAPTCHA estão excluídos do planejamento; o registro acima é apenas a evidência histórica da inspeção, não uma recomendação de ativação.

Na inspeção inicial, o provedor de telefone estava ligado e SMS limitado ao Brasil. Posteriormente, o proprietário informou que desativou esse provedor no Firebase. Registrar o risco identificado e sua ação de contenção sem afirmar uma nova verificação independente: nenhuma consulta API adicional ou teste de SMS foi feito nesta atualização. O código ativo de cadastro usa convite/email-senha; desativar o provedor de telefone não equivale a bloquear acesso pelo navegador do celular. Nenhuma alteração de provedor foi executada pelo agente.

A lista de domínios autorizados Auth retornou localhost, os dois domínios padrão Firebase e `parads.vercel.app`; não incluiu `parads.com.br` ou `www.parads.com.br`. Isso não demonstra falha no login email/senha atual. Revisar antes de introduzir redirecionamentos/links Auth. Nenhum domínio foi acrescentado.

## Proteção e recuperação do banco

O recurso do banco informa:

- `pointInTimeRecoveryEnablement=POINT_IN_TIME_RECOVERY_DISABLED`.
- `deleteProtectionState=DELETE_PROTECTION_DISABLED`.

Não foi inspecionada a existência de backup agendado ou externo; PITR desligado não comprova ausência de todo backup. Delete protection protege a exclusão do recurso de banco, não cada exclusão de documento. Avaliar plano de recuperação antes de uma migração futura; habilitar proteção/backup/PITR não faz parte da autorização desta etapa e pode ter consequências operacionais/financeiras.

## Fingerprint público observado

Em `2026-10-19T02:29:45.113Z`, a página pública respondeu em www com header `Server: Vercel` e referenciou:

- Asset: `/assets/index-C3aIBOtO.js`, HTTP 200.
- Tamanho recebido: 442.835 bytes de texto JavaScript, sem equivaler ao tamanho transferido com compressão.
- SHA-256: `7f46e5e0854c90080fbbe698f46fe535ba6e882b8a72bb94e5dfae8eb605fa7e`.
- Contém a classe `maintenance-screen` e referência ao asset `bg-manutencao`.

Isso identifica o arquivo servido e confirma que a manutenção está incluída no artefato. Não substitui inspeção visual, comprovação do commit pelo painel nem teste de rotas autenticadas. Nenhum endpoint de mutação foi chamado.

## Implicações do Hobby para o plano

Plano informado pelo proprietário, confrontado com documentação oficial atual:

- WAF admite uma regra de rate limiting por projeto Hobby, com janela fixa; chaves IP/JA4. O limite é regional, não uma cota global exata. Até três custom rules no total. [WAF oficial](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).
- O proprietário relatou Custom Rules 0 e nenhum registro de Rate Limited. Não há evidência fornecida de regra personalizada de rate limiting configurada. Não configurar a regra disponível antes da inspeção do deployment e definição de limites adequados. A proposta continua sendo uma barreira comum em `/api/`, complementada por limitação compartilhada no backend, não uma regra WAF por operação.
- O gratuito da Vercel tem limites próprios de invocações, CPU, memória e tráfego; exceder uso pode suspender recursos em vez de acompanhar automaticamente o crescimento do Firestore Blaze. Verificar uso restante, configuração de Fluid Compute e região da função. [Hobby](https://vercel.com/docs/plans/hobby), [Functions](https://vercel.com/docs/functions/usage-and-pricing).
- Hobby é destinado a uso pessoal/não comercial segundo os termos do plano. Não se concluiu aqui a classificação jurídica/comercial do grupo; revisar se houver cobrança/comercialização do produto.
- Não foi decidido upgrade de Vercel, contratação de armazenamento de rate limit, mudança de região ou configuração de firewall. Nenhum desses itens é consequência automática da aprovação arquitetural.

## Atualização do painel Firewall fornecida pelo proprietário

Dados relatados após a inspeção inicial, referentes às últimas 24 horas exibidas no painel. O horário exato de início/fim dessa janela não foi fornecido; não tratar como uma data civil completa ou período idêntico ao gráfico do Firestore.

| Indicador | Estado/quantidade informada |
|---|---|
| Plano | Hobby |
| Firewall | Ativo |
| System Mitigations | Active |
| Custom Rules | 0 |
| Bot Protection | Inactive |
| Requisições permitidas | Aproximadamente 3,7 mil |
| Requisições negadas | 524 |
| Requisições desafiadas | 1 |
| Rate Limited | Nenhum registro |
| Associação dos bloqueios | Principalmente mitigação DDoS |

Esses dados confirmam a observação do proprietário no painel, não uma consulta autenticada realizada pelo agente. Não inferir que todas as requisições negadas sejam ataques comprovados, que nenhuma proteção automática exista ou que a ausência de eventos Rate Limited seja um teste completo de todas as proteções.

**Fronteira de proteção:** o WAF da Vercel filtra tráfego que passa pela Vercel. Chamadas diretas ao Firestore/Auth não passam automaticamente por essa barreira. Portanto, os bloqueios reportados não demonstram redução equivalente de leituras/gravações Firebase, e o fechamento das permissões publicadas continua prioritário. App Check, regras e autorização de negócios são controles separados.

Os totais de requisições não são DAU, chamadas de API ou leituras Firestore. Podem incluir assets, navegação, bots e outros caminhos. Não usá-los isoladamente para definir limites por jogador.

Antes de escolher qualquer valor de rate limit, separar caminhos de API, observar picos de ações legítimas, considerar jogadores na mesma rede/IP, tentativas/retries e múltiplos ADMs. Limitação por usuário/operação no backend deve complementar a proteção de entrada; não depender somente de um limite rígido de IP que prejudique a quadra inteira. Nenhum limite ou regra foi definido/aplicado nesta atualização.

## Ajustes de prioridade decorrentes desta inspeção

1. Manter a restrição de produção até corrigir os caminhos críticos; lembrar que a manutenção visual não altera as permissões agora confirmadas.
2. Etapa 1 deve isolar completamente testes do projeto real: tanto SDK cliente quanto Admin SDK. Hoje há configuração de produção no código local e projeto fixo no inicializador Admin.
3. Projetar rate limiting sem presumir limitador compartilhado em memória ou múltiplas regras WAF disponíveis. App Check e reCAPTCHA não serão implementados.
4. Registrar telefone/SMS desativado pelo proprietário como contenção informada; não reativar nem executar testes de emissão. Isso não altera a prioridade das permissões do banco.
5. Usar `southamerica-east1` para a avaliação financeira do Firestore e confirmar a região Vercel antes de projetar latência/egress. As fórmulas anteriores continuam válidas; tarifas reais ainda devem ser extraídas do SKU/região aplicável.
6. Planejar recuperação/rollback preservando dados; não usar o script antigo de limpeza ou restauração integral como rollback de código.

## Pendências para fechar a etapa 0

Sem solicitar tokens/chaves pelo chat, obter leitura administrativa ou evidências do painel Vercel sobre:

- Projeto/deployment de produção, commit publicado e configuração de execução da API existente.
- Região/runtime/Fluid Compute e uso atual de invocações/CPU/memória/tráfego.
- Firewall básico e ausência de custom rules: informados pelo proprietário nesta atualização. Se a inspeção do deployment/painel expuser exceções/bypasses adicionais, registrá-los antes de configurar qualquer regra. Nenhum novo limite será escolhido apenas pelos totais das últimas 24 horas.
- Escopo dos limites/orçamentos informados e quem receberá os alertas, sem necessidade de valores privados em documentação pública.

O proprietário pode fornecer capturas sanitizadas desses painéis, sem variáveis, tokens ou dados pessoais, ou autenticar uma ferramenta local para inspeção somente leitura. Nenhuma autenticação interativa foi iniciada automaticamente.

## Critério de saída e autorizações

Comparação de regras e metadados Firebase: atendida. Identificação pública da hospedagem/asset: atendida com os limites descritos. Plano e indicadores Firewall Vercel: informados pelo proprietário, com origem e janela registradas. Desativação do provedor de telefone: informada pelo proprietário. Deployment administrativo, configuração de execução e uso de funções: pendentes. Limites de rate limiting permanecem deliberadamente indefinidos.

Não marcar a etapa 0 como totalmente aprovada até obter as evidências pendentes ou o proprietário aceitar explicitamente a limitação. Não iniciar etapa 1, publicar regras, executar migração, alterar provedor/backup ou fazer deploy como continuação automática desta inspeção.
