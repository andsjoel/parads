# Inspeção de produção antes da implantação

Nota posterior: esta inspeção registra o candidato naquele momento. A implementação local subsequente mudou a flag ausente para permitir somente login, mantendo cadastro fechado; ver [checklist vigente](18-RELEASE-CHECKLIST.md). Nenhuma configuração da Vercel foi alterada por essa mudança local.

Inspeção somente leitura autorizada explicitamente pelo proprietário em 19/10/2026.
Coleta principal iniciada em `2026-10-19T13:43:27Z` (10:43:27 em Brasília).
**Nenhuma publicação, migração, alteração de conta, senha, documento, regra, configuração ou variável foi executada.**

## Escopo e método

- Credencial da sessão existente do Firebase CLI usada somente em memória; não copiada para o relatório ou código versionável. Eventual renovação OAuth local não muda os dados/configurações do app.
- Operações de inspeção dos recursos foram GET, com paginação limitada a duas páginas de 100 registros por coleção/lista Auth. Nenhum teste de carga, login de membro, tentativa de cadastro ou reset de senha.
- Firestore: projeções de campos de vínculo em `users` e `pre_registered_users`, e somente flags/estado em `account_security`. Não consultados nomes, moedas, compras, estatísticas, inventários, partidas ou relatórios.
- Authentication: projeção somente de UID e estado disabled. Sem emails, senhas, hashes, salts ou tokens de usuários.
- Dados de vínculo e UIDs processados em memória; saída somente agregada. Cerca de 90 documentos Firestore retornados nas três coleções, além das consultas de metadados/Auth. Isso não é uma medição exata de cobrança.
- Comparação dos vínculos com o predicado da regra candidata e com a função real `hasGroupMembership` do servidor, alimentada pelos registros em memória, sem novas leituras por jogador. Não foram carregados documentos reais no emulador.
- Metadados e conteúdo do ruleset publicados consultados separadamente do arquivo local.
- GET público do site e asset principal, mais um GET sem token/corpo em cada rota de API. Nenhum POST nas APIs da aplicação.

## Contas e vínculos

| Verificação | Resultado |
|---|---:|
| Perfis privados em `users` | 43 |
| Membros | 32 |
| Convidados | 6 |
| ADMs | 5 |
| Contas Authentication | 43 |
| Contas Auth sem perfil | 0 |
| Perfis sem conta Auth | 0 |
| Contas Auth desabilitadas | 0 |
| Convites | 46 |
| Convites habilitados | 46 |
| Convites utilizados | 43 |
| Convites pendentes | 3 |
| Convites utilizados sem perfil correspondente | 0 |
| Convidados pendentes sem perfil provisionado | 0 |
| Grupos de convites duplicados para o mesmo UID | 0 |
| Contas exigindo troca de senha | 0 |
| Vínculos compatíveis com o predicado candidato | 43/43 |
| Vínculos aceitos pelo predicado real do servidor | 43/43 |
| Divergências entre os dois predicados nesta amostra | 0 |
| ADMs com vínculo e conta Auth ativos | 5 |

Não encontrados celular inválido, convite ausente/desabilitado, UID/papel divergente ou convite não utilizado sem flag de primeiro acesso nos 43 perfis examinados.

**Conclusão limitada:** não foi identificada necessidade de corrigir ou migrar vínculos dessas contas para o novo critério de participação. Isso não comprova todos os fluxos da aplicação, consistência de cada campo não consultado ou ausência de abuso passado. Não é um teste de autorização executado com as identidades reais. Cinco ADMs foram encontrados; não houve alteração ou avaliação discricionária de quem deveria ter esse papel.

Os três convites pendentes foram contados, não utilizados. Códigos/hashes de convite não foram lidos nem renovados; seu uso futuro ainda depende da validação de onboarding no ambiente aprovado e da ordem correta de implantação. Nenhuma conta órfã foi apagada ou criada nesta inspeção.

## Regras efetivamente publicadas

Recurso: `projects/parads-app-26f23/releases/cloud.firestore`.
Ruleset: `projects/parads-app-26f23/rulesets/e64a8787-2479-4b53-8c2c-2209f3043cde`.
Atualização da release: `2026-10-13T20:58:22.239504Z`.

SHA-256 com CRLF normalizado para LF e whitespace final removido:

| Origem | Hash |
|---|---|
| Publicado | `94b55027a0283ad14b600478b01ce6b90adf98ccbf2f97275703cbeaa3447477` |
| Candidato local | `becb6e221914d8ba59d8b8be741bcc234e0f30a1bf4c1f6b48264051b5411083` |

O ruleset publicado permanece o da baseline da etapa 0 e **não é o candidato local**. Continua sem o predicado `groupMember`, com leituras públicas de convites e usernames. A inspeção não explorou essas permissões sem autenticação e não confirma que houve exploração por terceiros.

As proteções locais das etapas anteriores não devem ser apresentadas como já ativas. A compatibilidade dos vínculos é uma condição atendida para implantação futura, não autorização para publicar as regras isoladamente.

## Configuração Authentication

- Email/senha habilitado.
- Telefone/SMS desabilitado, agora confirmado por GET de configuração.
- Provedor anônimo desabilitado.
- `parads.com.br` e `www.parads.com.br` não aparecem entre os domínios autorizados do Auth.

A ausência dos domínios customizados não demonstra falha no login atual email/senha nem exige adicionar domínios para o gateway candidato, que não usa login com redirect. Revisar se forem adotados fluxos com redirects/links Auth. Nenhum domínio ou provedor foi alterado.

## Deployment público e Vercel

| Verificação pública | Resultado e limite |
|---|---|
| `https://parads.com.br/` | Redireciona para `https://www.parads.com.br/`, HTTP 200, servidor Vercel |
| Asset principal | `/assets/index-C3aIBOtO.js` |
| Referência ao novo gateway no bundle observado | Não encontrada |
| Referência a `bg-manutencao` | Encontrada; presença do asset não prova estado de todas as rotas/abas |
| GET `/api/password-recovery` | 405, JSON, `Allow: POST`; confirma handler acessível, não valida credencial ou reset |
| GET `/api/access-gateway` | 404; rota candidata ainda não disponível nesse domínio |

Não encontrada sessão CLI Vercel nas localizações usuais nem token Vercel no ambiente. Não foi iniciada autenticação interativa ou solicitado envio de credenciais.

### Evidências anteriores reiteradas pelo proprietário

Após esta inspeção, o proprietário forneceu os metadados abaixo, levantados anteriormente. São evidências relatadas, não uma nova consulta autenticada realizada pelo agente; a permanência da configuração no deployment atual ainda precisa de confirmação.

| Item | Informação fornecida |
|---|---|
| Deployment Production | Branch `main`, commit `7e70408`, status Ready / Current |
| Domínio | `www.parads.com.br` |
| Plano | Vercel Hobby |
| Runtime das Functions | Node.js 24.x |
| Região das Functions | `iad1`, Northern Virginia, EUA |
| Function existente | `/api/password-recovery` |
| Credencial: projeto | `FIREBASE_ADMIN_PROJECT_ID`, Production, Secret |
| Credencial: conta de serviço | `FIREBASE_ADMIN_CLIENT_EMAIL`, Production, Secret |
| Credencial: chave privada | `FIREBASE_ADMIN_PRIVATE_KEY`, Production, Secret |

Nenhum valor de credencial foi solicitado, compartilhado ou registrado. O commit informado corresponde ao prefixo do HEAD local `7e7040879bbc98137ea97d2ff208555d25d39519`; essa correspondência não publica as alterações do worktree nem reconfirma o deployment atual.

### Inspeção visual atual das variáveis, relatada pelo proprietário

O proprietário concluiu a inspeção visual solicitada no projeto `parads`, plano Hobby, e confirmou:

- `FIREBASE_ADMIN_PRIVATE_KEY`, `FIREBASE_ADMIN_CLIENT_EMAIL` e `FIREBASE_ADMIN_PROJECT_ID` existem em Production e estão protegidas como Secret.
- Nenhuma variável `PARADS_*` está cadastrada atualmente.
- A opção **Enable access to System Environment Variables** está marcada e habilitada no projeto.
- A captura atual confirma somente as variáveis/configuração de ambiente. Deployment `main`/`7e70408`, Ready / Current, Node.js 24.x e região `iad1` permanecem evidências anteriores, não reconfirmadas pela captura atual.

A inspeção visual das configurações solicitadas está concluída com base no relato do proprietário. Não houve acesso aos valores de credenciais nem consulta autenticada adicional pelo agente.

**Consequência do código candidato, não teste de produção:** sem `PARADS_ACCESS_GATEWAY_ENABLED=true`, o gateway permanece desabilitado por padrão, inclusive para resolução do alias de login. A variável precisará de configuração explicitamente autorizada na sequência de implantação, antes de depender do cliente novo. Não mudar esse padrão nem publicar as regras restritas isoladamente para contornar a ausência da flag.

As flags de suspensão `PARADS_REGISTRATION_DISABLED`, `PARADS_PASSWORD_RECOVERY_DISABLED` e `PARADS_API_OPERATIONS_PAUSED`, ausentes, não ativam suspensão no candidato. Sua ausência não comprova funcionamento de credenciais, autorização ou acesso ao Firebase; a recuperação depende da validação segura do runtime. A opção de sistema habilitada é evidência de configuração, não de que `VERCEL`/credenciais chegaram a uma instância específica.

**Permanecem explicitamente pendentes para a implantação:**

- Disponibilidade efetiva das variáveis em execução, inclusive `VERCEL`, e funcionamento das credenciais no deployment que será validado, sem imprimir seus valores.
- Confirmação do deployment/commit, runtime e região efetivamente ativos na janela de publicação; não reaproveitar a captura de variáveis como prova desses itens.
- Uso administrativo atual das Functions e condições atuais do Firewall; a baseline relatada anteriormente não substitui observação recente.

O Firestore está em São Paulo e a região de Functions informada é nos EUA: considerar a comunicação inter-regional na observação de latência/consumo. Não foi medido custo de saída nem latência, e não se propõe mudança automática de região.

Não solicitar novamente os valores das credenciais ou presumir variáveis a partir de referências no código. Qualquer teste de runtime deve ter escopo aprovado, usar dados sintéticos/conta designada quando necessário e não criar endpoint público de diagnóstico que exponha ambiente ou segredos. Não armazenar capturas sensíveis no repositório.

## Decisão e próximo passo

1. Compatibilidade dos 43 vínculos: verificada, sem proposta de alteração de dados.
2. Estado publicado: regras antigas e gateway indisponível; manter distinção entre candidato e produção.
3. Inspeção visual Vercel das variáveis concluída; preparar a validação de runtime e a reconfirmação do deployment acima para a janela autorizada, sem exigir nova assinatura ou pedir valores de credenciais.
4. Fechar os demais aceites do [portão de liberação](16-OPERATIONS-AND-RELEASE-GATE.md), incluindo destinatários dos avisos e operador disponível.
5. Apresentar/aprovar a janela e sequência de implantação descritas na [etapa 2](13-ADMISSION-SECURITY.md): backend compatível, cliente/flags e validação antes de restringir regras. Não publicar regras sozinhas e interromper o onboarding antigo.

**A implantação continua não autorizada.** Nenhum push, deploy, configuração WAF, ativação de flag, alteração de regra ou migração foi realizado. Esta inspeção foi leitura administrativa, não execução dos testes isolados contra produção.
