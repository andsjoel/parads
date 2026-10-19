# Contingência de consumo anormal

Procedimento preparado na etapa 1, não executado. Toda operação de produção abaixo exige autorização explícita do proprietário para a ação e o escopo. Não há automação de deploy, desligamento de billing, exclusão de contas ou dados.

A rotina de revisão, sinais provisórios de investigação, responsáveis propostos e critérios de liberação foram consolidados na [etapa 5](16-OPERATIONS-AND-RELEASE-GATE.md). Não há monitoramento autônomo ativo; valores/recebimento dos avisos e disponibilidade do responsável ainda precisam de confirmação.

## Detectar e distinguir

1. Usar os alertas de orçamento já existentes. Consultar Firestore Usage, Auth, Cloud Billing por SKU e Vercel Firewall/Functions; registrar janela/fuso, release e totais agregados, sem tokens, telefones ou senhas.
2. Separar Pico de Paradão/reconexões, bug de consultas e tráfego externo. O WAF informado pelo proprietário bloqueou parte do tráfego HTTP, mas isso não prova proteção do Firebase. Não fazer carga para tentar reproduzir em produção.
3. Definir limiares após medir consumo legítimo e tentativas por endpoint. Não aplicar limites baseados no total de requests HTTP do site nem penalizar 40 jogadores pelo mesmo IP.

## Conter, da menor à maior interrupção

| Origem | Ação a autorizar | Efeito e limite |
|---|---|---|
| API Vercel | Regra Hobby direcionada ao endpoint, rate limiting ou bloqueio temporário; suspender endpoint não essencial | Reduz chamadas à função/Admin SDK; não protege Firebase direto. Confirmar hosts/aliases e testar uma chamada legítima após mudança |
| Leituras/gravações Firestore diretas | Publicar regras de contingência previamente revisadas: primeiro bloquear coleção/operação afetada; último recurso negar todo acesso cliente | Pode interromper partidas e telas. Não apaga dados. Não bloqueia Admin SDK, Console/IAM ou credenciais de serviço |
| API com Admin SDK | Suspender especificamente a função/rota ou impedir sua execução no ingresso; avaliar credencial comprometida se houver evidência | Regras Firestore não bastam. Alterar segredo exige plano de reposição e reinício das instâncias; não registrar a chave |
| Auth público | Limitar os endpoints próprios; avaliar configuração/quotas disponíveis do Authentication e suspensão temporária de cadastro | WAF não bloqueia chamadas diretas ao Auth. Desativar email/senha pode impedir novos logins; não fazer sem avaliar e autorizar o impacto |
| Consumo legítimo amplificado | Suspender funcionalidade secundária ou disponibilizar correção validada; manter jogo ao vivo se seguro | Requer cliente compatível. Manutenção visual não interrompe SDK de abas antigas/scripts |

Regras emergenciais de negação total estão em `tests/fixtures/emergency-deny.rules`, somente para revisão e teste local. Não fazem parte do arquivo publicado ou da configuração Firebase de produção. Não publicar automaticamente nem abrir `allow read/write: true` para recuperar uma tela.

## Suspensão das APIs no código candidato

A etapa 4 preparou flags de servidor: `PARADS_REGISTRATION_DISABLED=true` suspende somente cadastro e mantém login; `PARADS_PASSWORD_RECOVERY_DISABLED=true` suspende a recuperação; `PARADS_API_OPERATIONS_PAUSED=true` suspende ambas as APIs, inclusive alias de login. Não apagam dados nem bloqueiam SDK direto; suspender recuperação afeta quem estiver com troca obrigatória pendente. Só funcionam no deployment com o código candidato e configuração propagada/redeploy autorizado. Não foram configuradas em produção. Ver [15: proteção das APIs](15-API-PROTECTION.md) antes de operar; nunca prefixar com `VITE_`.

## Recuperar

1. Confirmar redução nos painéis considerando atrasos; não atribuir negativa de permissão a custo zero.
2. Corrigir/validar causa em emulador. Se necessário, preservar somente evidências agregadas e logs sem segredos. Não limpar listas/convites para reduzir o tráfego.
3. Restaurar o ruleset seguro previamente identificado e endpoints, com autorização. Não reabrir permissões vulneráveis como rollback automático. O histórico da baseline registra a versão inicial, mas não a torna segura.
4. Verificar no ambiente isolado login, convidado pendente, lista, listener de partida e recuperação; validação de produção só por operador/conta designada e escopo autorizado, sem alterar jogador real para teste.
5. Anotar início/fim, ação, aprovador, release/ruleset e efeitos. Reabrir por etapas e observar próximo Paradão.

## Limites financeiros e operacionais

- Orçamento e alertas não são trava de cobrança. O Firestore no Blaze não tem aqui limite financeiro rígido configurável por este procedimento.
- Painéis/avisos possuem atraso; pode haver gasto até a detecção e propagação do bloqueio. Controles disponíveis no Console devem ser confirmados antes de cada ação.
- Regras que usam get/exists podem gerar leituras auxiliares, inclusive em recusas. WAF, limitação e suspensão protegem caminhos diferentes, não um teto global.
- Sem App Check/reCAPTCHA, requisições externas aos serviços públicos continuam possíveis. Vínculo legítimo nas regras será a barreira principal para os dados na etapa 2.
- Não contratar nova observabilidade/Redis/Pro. Não adicionar gravação de telemetria por requisição. Não desligar billing ou excluir o projeto como reação automática.

Referências: [Firestore pricing](https://firebase.google.com/docs/firestore/pricing), [Budget alerts](https://docs.cloud.google.com/billing/docs/how-to/budgets), [WAF Hobby](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).
