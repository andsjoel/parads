# Segurança simplificada: escopo vigente

Atualização de 19/10/2026. Aplicativo privado, aproximadamente 40 pessoas conhecidas. O objetivo principal é reduzir acesso externo, abuso e consumo inesperado, não construir uma plataforma antitrapaça.

Este documento substitui a ordem e o escopo de implementação dos roteiros anteriores. Os achados históricos e a baseline publicada continuam válidos; não representam correções já implantadas.

Status posterior: etapas 1 e 2 concluídas localmente, com a candidata de admissão em [13: vínculo e cadastro](13-ADMISSION-SECURITY.md). Etapa 3 implementada em [14: otimização do Firestore](14-FIRESTORE-OPTIMIZATION.md) e etapa 4 em [15: proteção das APIs](15-API-PROTECTION.md). Após autorização de continuidade, preparação local da etapa 5 em [16: operação e portão de liberação](16-OPERATIONS-AND-RELEASE-GATE.md). Nenhuma publicação ou configuração de produção foi autorizada/executada. Calibração real e aceites operacionais da etapa 5 continuam pendentes.

## Decisões

Fechamento técnico posterior autorizado: [18: publicação e rollback](18-RELEASE-CHECKLIST.md). Login do candidato agora funciona sem a flag do gateway, enquanto cadastro permanece fechado; os capítulos anteriores registram o padrão inicial. Nenhuma implantação executada.

- App Check e reCAPTCHA completamente excluídos do planejamento. Não implementar, configurar ou contratar.
- Manter SDK direto e partidas em tempo real. Não migrar compras, missões, estatísticas e partidas em massa para APIs.
- Não contratar Vercel Pro, bancos de limitação externos ou novas assinaturas.
- Proteger o vínculo legítimo com o grupo, os papéis e os campos de identidade usados para autorização, mesmo sem reforçar todos os contratos econômicos.
- Preservar UIDs, senhas, convidados provisionados, convites, saldos, compras e históricos. Nenhum reset de produção.
- Telefone/SMS permanece desativado segundo informação do proprietário; não reconfigurado nesta etapa.

## Etapas e autorizações

| Etapa | Entrega | Critério objetivo | Autorização atual |
|---|---|---|---|
| 1 | Runner isolado, Auth/Firestore locais, fixtures sintéticas, testes de baseline e contingência | Testes existentes e emuladores passam; configurações de produção e destinos externos são rejeitados | Somente arquivos locais e execução local autorizados |
| 2 | Regras e admissão: vínculo legítimo, proteção dos campos de autorização, fechamento de leituras anônimas; adaptar apenas onboarding/login necessários | Visitante e Auth sem vínculo bloqueados; ADM/membro/convidado e ativação de convidado preservados | Concluída localmente; publicação não autorizada |
| 3 | Otimização de perfis, diretório e sincronizações redundantes | Atualização só de partida não busca todos os perfis; sem varredura de inventários para localizar ADM | Implementada localmente sob autorização; publicação não autorizada |
| 4 | Proteção das APIs: validação, autorização, consultas limitadas, cooldown/idempotência e limitação compartilhada proporcional | Repetição limitada entre instâncias; mesma rede da quadra continua funcional | Implementada localmente sob autorização; publicação/WAF não autorizados |
| 5 | Ajuste operacional de alertas e contingência com baseline real | Responsável, janela e reação definidos; sem novos serviços pagos | Preparada localmente sob autorização; calibração real, aceites e configuração de produção pendentes |

Nenhuma etapa local autoriza deploy, publicação de regras, alterações no Console ou migração. Qualquer necessidade de backfill exige apresentar antes o escopo exato, compatibilidade, custo e reversão. A implantação futura precisa ordenar backend, cliente e regras sem bloquear contas antigas ou abas abertas inadvertidamente.

## Limites da proteção escolhida

- Regras de vínculo restringem acesso aos dados; autenticar no Firebase não pode, sozinho, significar pertencer ao grupo.
- WAF protege Vercel, não chamadas diretas ao Firestore ou Authentication. Limites por IP podem afetar jogadores na mesma rede e não são um teto global de custo.
- Sem atestação de cliente, scripts e navegadores externos continuam podendo atingir endpoints públicos de login/cadastro. Código/API key do Firebase, domínio autorizado, CORS, bloqueio desktop e manutenção visual não são segredos ou barreiras suficientes.
- Credenciais legítimas roubadas e usuários autenticados podem consumir dados. Não há rate limiting rígido por segundo nativo nas regras do Firestore; não simular isso escrevendo um contador por leitura.
- Consultas vazias, reconexões, regras com get/exists, tentativas e gravações de limitadores também podem consumir recursos. Não prometer que toda negativa custa zero.
- Auth pode sofrer abuso de criação/login e esgotamento de cotas, mesmo com o banco fechado. Verificar possibilidades do projeto antes de recomendar mudança de configuração, sem habilitar provedores/serviços adicionais automaticamente.
- Alertas de orçamento não são teto financeiro. Blaze/Firestore não oferecem aqui garantia de saldo máximo; reação é sujeita a atrasos e pode exigir indisponibilidade temporária.

## Referências

- [Projetos demo e emulador Firestore](https://firebase.google.com/docs/emulator-suite/connect_firestore)
- [Testes oficiais de regras](https://firebase.google.com/docs/firestore/security/test-rules-emulator)
- [Cobrança do Firestore](https://firebase.google.com/docs/firestore/pricing)
- [Orçamentos não limitam gastos automaticamente](https://docs.cloud.google.com/billing/docs/how-to/budgets)
- [Rate limiting do WAF e limites Hobby](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
