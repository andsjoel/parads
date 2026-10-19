# Etapa 4: proteção proporcional das APIs

Nota posterior de implementação: o padrão de ausência da flag mudou no fechamento autorizado. Agora permite somente alias de login e mantém cadastro suspenso; `false` fecha o gateway. Ver [checklist vigente](18-RELEASE-CHECKLIST.md). As descrições abaixo preservam a entrega original da etapa 4, não substituem essa atualização.

Implementação **somente local**, em 19/10/2026, após autorização de continuidade.
Nenhum deploy, configuração Vercel/Firebase, regra publicada, conta ou documento real foi alterado.
As etapas anteriores foram preservadas. Não há App Check, reCAPTCHA, Redis, Pro, nova assinatura ou migração de operações do app para APIs.

## Escopo e ordem das verificações

Foram revisadas as duas APIs existentes: `/api/access-gateway` e `/api/password-recovery`.

1. Somente POST; resposta JSON sem cache. Recuperação exige bearer com formato/tamanho limitado.
2. JSON válido, tamanho medido em bytes, inclusive em objetos já parseados, buffers e streams. Limites: 4 KiB no acesso e 2 KiB na recuperação.
3. Ação, campos e formatos estritamente permitidos. Campos adicionais como UID, papel ou email não são aceitos para escolher o alvo de uma troca de senha. Essas rejeições não inicializam Admin SDK nem consultam Firebase.
4. Chaves de suspensão do servidor, antes do acesso ao SDK. Cadastro pode ser suspenso separadamente do login.
5. Limitador barato em memória por instância/IP; não depende de Firestore, mas não substitui a proteção compartilhada.
6. Contador compartilhado em transação Firestore, com no máximo duas tentativas. Falha do contador retorna 503; nunca libera a operação sem limitar.
7. Verificação real do token e revogação pelo Admin SDK, depois do orçamento de requisições. Conferir o formato JWT não autentica ninguém. Tokens sem assinatura são aceitos apenas pelo próprio SDK quando conectado ao Auth Emulator; não há bypass de autenticação no código de produção.
8. Vínculo/permissões e transações da operação. Reset continua exclusivo do ADM com convite ativo; conclusão exige a própria sessão e a redefinição pendente.

No acesso, provas HMAC inválidas continuam sendo recusadas antes das consultas. Autorização de cadastro continua vinculada ao UID/email/convite e não recria conta ou progresso em retry de cadastro concluído. Login mantém aliases existentes, inclusive o email aleatório de convidados.

## Limites candidatos locais

| Endpoint | Por IP | Global por minuto | Global por dia UTC | Proteção adicional |
|---|---:|---:|---:|---|
| Acesso/cadastro/login | 240/min | 480 | 3.000 | 10 verificações de código por celular em 10 minutos |
| Recuperação de senha | 60/min | 120 | 300 | Cooldown existente de 60s por conta alvo; transição transacional da conclusão |

São orçamentos lógicos para uma comunidade pequena, não limites de faturamento. O limitador local usa os mesmos tetos por IP/minuto e global/minuto; os limites globais/dia e por código são compartilhados entre instâncias.

- Quarenta cadastros completos representam aproximadamente 160 chamadas sem erros, abaixo de 240/min no mesmo Wi-Fi. O teste legado de 240 chamadas em duas instâncias continua passando.
- Foram simuladas 60 conclusões de recuperação na mesma rede por duas instâncias: as 60 chegam ao serviço; a 61ª recebe 429 antes de verificar o token. Há margem para 40 pessoas e 20 tentativas extras; isso não representa 60 trocas de senhas reais.
- Nenhum limite foi aplicado aos listeners, leituras diretas das partidas, assets, feed ou ao site inteiro.
- IP vem de `x-vercel-forwarded-for` apenas quando `VERCEL=1`; fora da Vercel, do socket. Não usar `X-Forwarded-For` arbitrário enviado pelo cliente. Ausência de endereço válido cai em um bucket conservador comum. [Headers oficiais](https://vercel.com/docs/headers/request-headers).
- Buckets persistidos usam HMAC, sem IP/celular em claro. Até 128 chaves ativas por contador; expiração lógica é removida durante a próxima requisição. Não há TTL pago ou job de limpeza. O mapa local é limitado a 256 IPs/minuto.
- `request_limits/access_gateway` preserva documento, campos, domínio HMAC e valores existentes da etapa 2. O novo contador é `request_limits/password_recovery`, criado somente no uso futuro autorizado da API.
- A recusa compartilhada é memorizada por dois segundos na instância. Bloqueio por IP/celular afeta somente aquele bucket; não pausa os demais jogadores. Limite global ou tabela cheia recusa o endpoint como um todo.
- 429 inclui `Retry-After: 60` como espera inicial. Limites de código/dia podem continuar recusando depois desse minuto, até a própria janela encerrar. O cliente não faz loop automático de tentativas.

Um atacante distribuído pode esgotar a cota lógica e impedir novos logins/cadastros/recuperações temporariamente. Sessões já válidas e partidas via SDK não dependem continuamente desses endpoints. Essa disponibilidade residual deve ser observada antes de aumentar tetos; não reduzir por IP sem considerar NAT de operadoras e Wi-Fi compartilhado.

## Repetição e senhas

- Foram preservadas as travas existentes: reset registra a preparação antes de modificar Auth, cooldown impede reset duplicado imediato, conclusão muda `ready -> updating -> completed` em transações.
- Sessão invalidada do ADM é conferida dentro da mesma transação que já lê `account_security`, retirando a leitura separada do handler. Não há janela entre aquela leitura separada e a preparação.
- Testes concorrentes em duas instâncias, com Auth/Firestore emulados reais, modificaram a senha uma única vez no reset e uma única vez na conclusão. Repetições posteriores são recusadas, sem zerar perfil, saldo, compras ou estatísticas.
- Não foi criada uma tabela para guardar/reexibir senha temporária em texto claro. A resposta ainda mostra a senha temporária somente quando gerada. Se essa resposta se perder, não repetir requisições indefinidamente: ADM pode gerar outra após o cooldown, respeitando o estado e os limites.
- Não há promessa de exactly-once distribuído entre Auth e Firestore, nem replay da resposta original. Falha/interrupção entre serviços continua exigindo conferir o estado; os tratamentos existentes de falha e a restrição de senha permanecem. Após falha parcial, não apagar `account_security` para liberar uma conta sem análise/autorização.
- Operações em andamento não são canceladas por trocar uma variável. Chaves de suspensão afetam as novas requisições no deployment que recebeu a configuração.

## Contingência preparada, não ativada

Variáveis **somente no servidor**, nunca `VITE_`. Só possuem efeito depois de publicar o código candidato e a configuração, ambos com autorização separada.

| Variável/valor | Efeito |
|---|---|
| `PARADS_ACCESS_GATEWAY_ENABLED=true` | Habilita o gateway candidato; padrão continua desligado, como definido na etapa 2 |
| `PARADS_REGISTRATION_DISABLED=true` | Suspende lookup, código, disponibilidade de username e autorização; mantém resolução de alias/login |
| `PARADS_PASSWORD_RECOVERY_DISABLED=true` | Suspende reset/conclusão; usuários com troca obrigatória pendente precisarão aguardar |
| `PARADS_API_OPERATIONS_PAUSED=true` | Suspende ambas as APIs, inclusive o alias de login; não desloga sessões nem bloqueia SDK direto |

Suspensões são verificadas antes de inicializar serviços/acessar o banco. A recuperação permanece ligada por padrão para preservar o comportamento atual; não exige ativar nova flag. Nenhuma variável foi criada/alterada na Vercel ou em arquivos locais de segredos. Não há painel novo de configuração ou listener para flags no Firestore.

## WAF Hobby: proposta para aprovação futura

A documentação consultada lista **uma regra de rate limit por projeto Hobby**, até três regras customizadas no total, janela fixa e franquia de 1 milhão de requisições permitidas. Contadores do WAF são regionais, não um limite global absoluto. Confirmar as condições e a indicação de custos no painel antes de qualquer ativação; não contratar excedentes/serviços. [Limites e cobrança oficiais](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).

Proposta não configurada: uma regra que corresponda **somente** às duas rotas de API, com chave IP, janela fixa de 60s, candidato inicial de 360 requests por IP e ação 429. Não aplicar ao site inteiro, não somar assets/listeners e não usar challenge de navegador em respostas de fetch da API. Começar observando o tráfego/log quando o recurso estiver disponível, confirmar caminhos/aliases e compartilhar resultados antes de bloquear. Ajustar ao tráfego legítimo, não a um teste de carga em produção.

As duas regras restantes podem ser reservadas para métodos indevidos nas rotas exatas e um bloqueio emergencial direcionado. Não foi editado `vercel.json`, instalado SDK de firewall, acessado o painel autenticado nem publicado WAF. DDoS já ativo continua sendo a baseline informada pelo proprietário, não uma configuração feita nesta etapa.

**WAF não protege URLs diretas do Firestore/Authentication.** Regras de vínculo da etapa 2 continuam sendo a barreira dos dados; sua publicação ainda depende da inspeção/autorização descrita naquela etapa.

## Custo e limites financeiros

- Chamada admitida pelo contador compartilhado normalmente custa uma leitura e uma gravação extras, além da operação. Na recuperação `reset`, o contador substitui a antiga leitura separada de segurança do ADM: o caminho comum acrescenta uma gravação, sem acrescentar aquela leitura líquida. Na conclusão, acrescenta normalmente uma leitura e uma gravação. Retries de transação podem ampliar esses números.
- Os tetos lógicos admitem no máximo 3.000 ações/dia no gateway e 300/dia na recuperação. Isso **não** limita o número de invocações, consultas recusadas, tentativas de transação, tráfego HTTP ou custos do Auth/Firestore direto.
- Requisições malformadas e suspensões evitam Firebase; continuam atingindo a função quando não bloqueadas antes pelo WAF. Ataques com payload válido ainda gastam leituras do contador, principalmente com instâncias frias/distribuídas. Backoff/local gate ajudam somente nas instâncias que já conhecem o excesso.
- Dois documentos fixos de limitação; sem gravação de telemetria por request, jobs, novas coleções por IP ou serviço externo. Auditoria de reset existente permanece; não apagar histórico para economizar.
- Nenhum preço em reais ou economia da fatura foi inferido do emulador. A etapa 3 reduz amplificação legítima; esta etapa reduz operação abusiva das APIs, mas não substitui monitoramento.
- Blaze continua sem teto financeiro rígido. Alertas têm atraso. Manutenção visual não interrompe abas antigas/scripts. Chaves de API públicas, CORS e bloqueio desktop não são mecanismos antibot.
- Sem atestação de cliente, alguém de fora ainda pode tentar cadastrar/login no Auth público, consumir cotas, consultar APIs limitadas e provocar avaliações de regras negadas. Credenciais válidas comprometidas continuam podendo consumir dados do grupo. Não migramos todo o app para servidor nem tentamos controlar toda ação dos membros.

## Validação e arquivos

- `npm.cmd test`: 92 testes aprovados, rede externa bloqueada, incluindo JSON em bytes, campos/métodos, assinatura delegada ao SDK, limites compartilhados, falha fechada, flags, mesma rede, backoff por bucket e manutenção dos contadores anteriores.
- `npm.cmd run test:emulators`: 29 testes aprovados no projeto `demo-parads-security`. Inclui tokens reais do Auth Emulator, recusas a membro/convidado/externo, sessão ADM antiga, reset/conclusão concorrentes, preservação dos documentos e contadores inacessíveis ao cliente. Emuladores encerrados ao terminar.
- ESLint nos arquivos funcionais/testes desta etapa e build local. O lint global possui problemas anteriores registrados; não foram corrigidos por refatoração não relacionada.
- A primeira execução identificou a assinatura vazia dos tokens do emulador na validação de formato. Foi ajustada somente a checagem sintática; a verificação pelo Admin SDK continua obrigatória e foi exercitada. Nenhum teste foi redirecionado a produção para contornar isso.

Arquivos funcionais: `server/apiProtection.js`, `server/requestLimits.js`, `server/accessGateway.js`, `server/passwordRecovery.js`, `api/access-gateway.js` e `api/password-recovery.js`.
Testes: `tests/apiProtection.test.mjs`, `tests/emulator/apiProtection.test.mjs` e `tests/support/api-fixture.mjs`. Nenhuma dependência nova nesta etapa, nem alteração de regras, telas ou esquema dos usuários.

## Implantação e rollback

1. Aprovar os resultados locais e os limites candidatos antes de publicar. A etapa 5/inspeção operacional de produção não foi iniciada automaticamente.
2. Conferir vínculos reais e sequência backend/cliente/regras da etapa 2, com autorização específica. O worktree contém todas as etapas locais; não publicar tudo automaticamente.
3. Publicação futura precisa levar os módulos novos junto com os dois handlers. A credencial existente continua exclusivamente no servidor. A otimização independe de uma nova assinatura; a recuperação não exige novas variáveis para funcionar.
4. Configuração WAF/flags e qualquer validação real precisam de autorização própria. Não redefinir senha de jogador real para testar; usar conta explicitamente designada ou seguir com emuladores.
5. Sob anomalia, preferir a suspensão direcionada e o procedimento de contingência, preservando dados. Reverter somente o patch da API para deployment validado continua possível, mas reabre as limitações anteriores. Não afrouxar regras de grupo como rollback automático.
6. Nenhum UID, senha real, convite, moeda, compra ou histórico precisa ser migrado/revertido. Não há limpeza de dados para fazer antes da implantação.
