# Etapa 2: vínculo com o grupo e primeiro acesso

Nota posterior: o fechamento autorizado integrou e retestou os serviços frontend e mudou o padrão da flag ausente para permitir somente login, sem reabrir cadastro/Firestore. Ver [referência vigente de publicação](18-RELEASE-CHECKLIST.md); o capítulo abaixo registra a entrega original da etapa 2.

Implementação local em 19/10/2026, autorizada após a etapa 1. **Candidata, não publicada.** Nenhum documento real, conta, senha, configuração Firebase/Vercel ou regra publicada foi alterado. Não foi iniciado o app contra produção para testar esses fluxos.

## Contrato de acesso

- Uma identidade no Authentication não significa participação no grupo. As regras candidatas exigem usuário privado e convite habilitado, apontando para o mesmo UID e papel. Convidado provisionado pode estar pendente de primeiro acesso, como já ocorre hoje.
- Contas anteriores não precisam de `inviteId` ou `account_security` novos. São aceitos papéis `role`/`type`, celular numérico e IDs antigos com/sem 55. `inviteId` é persistido apenas no novo cadastro/ativação. Um convite primário desativado não permite fallback para duplicata habilitada.
- Dono não pode mudar `phone`, `role`, `type`, `username`, `authEmail`, `firstAccessPending` ou `inviteId` arbitrariamente. ADM mantém a gestão; primeiro acesso possui uma exceção curta e verificada. Personalização, moedas, inventário e estatísticas mantêm o modelo cliente aprovado, sem migração geral para APIs.
- Convites deixam de ser consultáveis anonimamente. ADM continua listando/gerenciando. Durante a ativação, a autorização permite ler somente o convite vinculado. Diretório de usernames deixa de ser público; o login resolve apenas um alias na API.
- Recuperação de senha também exige vínculo ativo no caminho Admin SDK. Senha obrigatória/invalidBefore continuam em vigor; bootstrap próprio necessário à recuperação permanece permitido.

## Mudança mínima no cadastro

O fluxo visual continua celular, nome, código, username e senha. A API `/api/access-gateway` faz somente:

| Ação | Entrada | Saída/efeito |
|---|---|---|
| lookup | Celular válido | ID, celular e nome de um convite pendente; não lista nem retorna hash/código/UID |
| verify | Celular + código de 6 dígitos | Prova assinada por 15 minutos e metadados mínimos necessários ao cadastro/convidado |
| username | Prova + username | Disponibilidade de um username, após revalidar convite/prova |
| authorize | Prova + username + ID token | Confere UID/email no Auth e convite atual; grava uma autorização curta em `registration_grants/{uid}` |
| login | Um username | Um email de login, preservando os aliases aleatórios de convidados existentes |

O cliente continua usando o batch/transação já existente para criar seus documentos ou ativar o convidado. As regras exigem a autorização emitida pelo servidor, os campos de identidade correspondentes e o consumo do convite. Alterar código ou desabilitar convite invalida a autorização. Trocar username/UID/role no payload não cria vínculo.

As provas usam HMAC-SHA256 com separação de domínio, derivado da chave Admin já existente; nenhuma chave nova é enviada ao cliente. Rotacionar essa credencial invalida provas ainda pendentes, não senhas ou contas. O bearer é verificado pelo SDK Admin. Não registrar corpo, senha, ticket, código ou token.

Convidado conserva UID, email Auth, senha até a alteração solicitada, moedas, compras e histórico. O novo código não apaga contas Auth quando uma resposta falha. Retry de um cadastro concluído reconhece o mesmo UID/username e não recria documentos, evitando reset de progresso. Durante `/register`, AuthContext não tenta carregar uma sessão de grupo antes da criação do vínculo. Se a autorização expirar, o formulário permite verificar o código novamente.

`registration_grants` é privada inclusive para o SDK cliente do ADM; as regras podem consultá-la internamente. Há no máximo um documento por UID autorizado. A expiração é lógica, sem habilitar TTL pago, jobs ou limpeza automática. Remoção administrativa futura desses documentos, se necessária, exige escopo/autorização próprios.

## Proteções mínimas do endpoint novo

- Somente POST JSON, corpo de até 4 KiB, campos/formatos/ações permitidos explicitamente. Requisições malformadas não inicializam Admin SDK. Provas inválidas são rejeitadas antes de consultas.
- Kill switch `PARADS_ACCESS_GATEWAY_ENABLED=true` necessário no servidor. **Padrão desligado**, inclusive localmente; não foi configurado em produção. Com a chave desligada, a API recusa requisições sem inicializar Admin ou acessar Firestore. Não usar prefixo `VITE_` para essa variável ou para credenciais.
- Consultas pontuais; fallback legado de celular limitado a dois IDs e quatro consultas de igualdade com `limit(1)`. Não existe varredura pública de coleção. O caminho comum encontra o convite em uma leitura.
- Limitação compartilhada em uma transação de `request_limits/access_gateway`: candidatos locais de 480 ações/minuto e 3.000/dia UTC globais, 240/minuto por IP e 10 verificações por celular em 10 minutos. Até 128 chaves ativas, IP/celular transformados em HMAC; não grava IP/celular em claro no limitador. Entradas vencidas são retiradas na próxima operação. Máximo de duas tentativas de transação.
- Backoff local de dois segundos após recusa apenas complementa a contagem compartilhada; não é a fonte de verdade. As APIs de Auth usadas na autorização ficam depois do limitador.
- Os limites são candidatos, não configuração WAF aprovada. 240 chamadas de um IP foram simuladas em mocks, com dois gateways compartilhando o estado; 40 cadastros completos representam aproximadamente 160 chamadas sem erros. Isso não substitui observação do tráfego nem garante comportamento sob ataque/contenção.
- O caminho existente de recuperação mantém seus cooldowns atuais; aprofundamento de limites/WAF desse endpoint continua na etapa 4. Não houve configuração de Firewall.

## Custo e riscos residuais

Cada ação aceita acrescenta normalmente uma leitura e uma gravação do limitador, além de suas consultas. Recusas podem continuar gerando leitura do contador; limites não são teto financeiro. As regras agora consultam usuário/convite além da segurança de sessão: há custo adicional de autorização, sujeito à avaliação/cache por requisição do Firestore. Não atribuir cobrança exata ao emulador.

Uma conta Auth sem convite fica sem os dados do grupo, mas ainda pode atingir serviços públicos do Authentication. A API pública ainda pode receber automações e consumir invocações/leituras de limitação. Ataques distribuídos podem esgotar o orçamento lógico e impedir cadastros/logins novos até a janela seguinte; usuários com sessão já válida não dependem dessa API para acompanhar partidas. Um contador central também tem contenção: falha fechada com 503, sem ignorar a proteção.

Não há App Check/reCAPTCHA, limite rígido de faturamento Blaze, proteção automática do Firestore pelo WAF, ou serviço pago adicional. Manutenção visual não bloqueia acessos diretos. Credencial legítima comprometida continua autorizada; o escopo não tenta impedir toda manipulação pelos membros.

O nome de um convite pendente continua sendo mostrado após informar o celular, preservando a confirmação atual. Isso admite enumeração pontual limitada pela API, não listagem irrestrita. Os hashes/códigos antigos já foram públicos pelas regras anteriores: esta alteração não desfaz exposição passada. Eventual rotação de convites pendentes deve ser proposta e autorizada separadamente, nunca executada automaticamente.

## Implantação futura: dependências, não autorização

1. Autorizar separadamente uma inspeção somente de leitura para conferir os vínculos de **todas** as contas reais, inclusive ADMs: UID, papel, celular/ID do convite, enabled e claimed/firstAccessPending. Nada foi consultado nesta etapa. As fixtures não comprovam que toda conta real tem campos consistentes. Não publicar se houver exceções sem plano aprovado.
2. Preservar o ruleset publicado registrado na baseline e o commit exato implantado. Confirmar deployment, credencial já configurada e plano Hobby. Nenhum script antigo de limpeza é migração.
3. Em janela aprovada de manutenção, publicar backend compatível e cliente novo; conferir o endpoint/flag e os controles de entrada antes de abrir. Configurar a flag exige autorização e propagação/redeploy na Vercel. Não há índice novo necessário às queries atuais de igualdade.
4. Publicar as regras candidatas **somente depois** de backend e cliente funcionarem no ambiente aprovado. Cliente antigo não possui autorização de cadastro; precisará atualizar/recarregar. Não publicar regras isoladamente e quebrar o primeiro acesso/login.
5. Validar por operador/conta designada, sem redefinir jogador real para teste. Manter a manutenção até a liberação ser autorizada; nenhuma liberação foi feita aqui. A otimização de perfis da etapa 3 é importante para compensar consumo legítimo e deve preceder avaliação final de reabertura.

Rollback: preferir suspender cadastro/API pelo kill switch e manter regras restritas. Reverter frontend exige um contrato de API compatível; não voltar automaticamente ao cadastro anônimo antigo. Restaurar as regras antigas reabre vulnerabilidades e exige decisão explícita do proprietário, não é fallback automático. Dados e UIDs não são revertidos/apagados. Há apenas novos campos/documentos nos cadastros futuros; nenhum backfill em massa foi executado ou é pressuposto para contas canônicas existentes.

## Validação local

Comandos: `npm test`, `npm run test:emulators`, lint dos arquivos funcionais alterados e build em `.firebase/build-check`. Todas as execuções de dados usam as travas da etapa 1, projeto demo e credenciais sintéticas.

Resultados da última rodada local: **68 testes unitários/mocks aprovados, 20 testes de integração emulador aprovados, lint dos arquivos funcionais alterados sem erros e build aprovado em `.firebase/build-check`**. O lint global permanece com os problemas preexistentes registrados na etapa 1; não houve refatoração desses arquivos. `git diff --check` sem erros de whitespace.

Os testes de integração incluem o batch real de sete documentos, preservação de moedas/compras/stats do convidado, retry sem reset de progresso, convite legado com ID local e papel type-only, proteção dos campos de identidade, recusa de convite desativado/UID incorreto, negativa de elevação de papel, restrição de troca de senha, entrega por listener e batch de resultado com doze stats. A simulação do limite por IP é um teste de contador em memória com store compartilhado, não benchmark de latência Vercel/Firestore. O limite por código foi exercitado em Firestore emulado com instâncias separadas do serviço.

Os emuladores foram encerrados ao fim. Não há validação visual em aparelhos nem teste de faturamento real. Etapa 2 concluída **localmente como candidata**; etapa 3 e publicação aguardam nova aprovação. Não ativar a API ou publicar regras com base somente nesses testes sem a conferência de vínculos e a sequência de implantação descritas acima.

Arquivos funcionais: `firestore.rules`, `server/accessGateway.js`, `server/groupMembership.js`, `server/passwordRecovery.js`, `api/access-gateway.js`, `src/services/accessGatewayService.js`, `firstAccessService.js`, `authServices.js`, `userService.js`, `src/pages/FirstAccessNew.jsx`, `src/contexts/AuthContext.jsx` e middleware local em `vite.config.js`. Testes novos/ampliados ficam em `tests/accessGateway.test.mjs`, `tests/emulator`, `tests/support/user-service-module.mjs`, fixtures e mocks de convidados/recuperação.
