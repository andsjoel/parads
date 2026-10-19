# Perguntas e respostas técnicas

Referência: auditoria estática do commit `7e70408`, 18/10/2026. Respostas sobre o código local; medições reais e estado de implantação permanecem pendentes.

## O Firebase está inadequado para o PARADS?

Não há evidência disso. Auth, documentos pequenos e realtime de equipes são compatíveis com o produto. O principal problema é como consultas e autorização foram organizadas. Trocar de banco sem corrigir o fan-out, a projeção de perfis e a validação de comandos transfere os problemas para outra plataforma.

## 6.500 leituras é muito?

Depende do intervalo, usuários e ações. Se for um dia inteiro de uma base elegível à cota Standard, é 13% da referência diária de 50.000. Mas só dez espectadores recebendo sete alterações com 30 perfis podem gerar 6.370 solicitações/entregas lógicas no modelo atual. Os números fornecidos não comprovam erro nem comprovam eficiência; [05](05-USAGE-AND-COST-SIMULATION.md) explicita as hipóteses.

## O aumento de 12.924% prova um bug?

Não. Crescer a partir de uma base quase vazia produz percentuais grandes. É necessário olhar valores absolutos, janela do painel, abertura do grupo, testes locais e ações administrativas. A auditoria encontrou amplificações concretas, mas não uma causa comprovada para o dia 16/10.

## Um listener fica lendo a cada segundo ou renderização?

Não por definição. Inscrição, documentos alterados, reconexão, cache e avaliação de regras precisam ser separados. O código não faz polling por segundo. No PARADS, o callback da lista atualiza estado e um efeito dependente dele faz novas leituras pontuais de perfis. Essa etapa derivada é a amplificação comprovada.

## Os listeners estão vazando?

Os principais retornam unsubscribe e os componentes retornam esse cleanup. AuthContext mantém segurança/stats entre telas de propósito. Não foi constatado vazamento generalizado. Validação dinâmica futura deve verificar listeners ativos após várias navegações, múltiplas abas e logout.

## Por que mostrar só uma lista pode custar tantos documentos?

`subscribeActiveVolleyList` tem limit(1), mas `loadProfiles` busca até três documentos para cada pessoa: perfil público, inventário e stats. Um único snapshot da lista pode iniciar 90 leituras explícitas para 30 pessoas, em cada celular aberto. Alteração de regra, solicitação de convidado e resultado têm o mesmo potencial de disparar o efeito, mesmo sem trocar o conjunto de atletas.

## O próprio perfil é consultado de novo?

Em MatchList, sim: ele entra nos IDs remotos e só depois o bundle é substituído pelo da sessão. Isso desperdiça a oportunidade de reutilizar dados já carregados. No perfil/loja, por outro lado, a renderização usa o Context e não faz consulta de tela adicional.

## O feed vazio é gratuito por não ter posts?

Não. Além do mínimo da consulta vazia, o guia chama `getPublicProfileDirectory`, que lê todos os perfis públicos e inventários para encontrar um ADM; depois busca a carta dele. Aproximadamente 2U+3 documentos antes de sessão/regras. A animação de mensagens e o carrossel são locais e não são o motivo do custo.

## A busca consulta a cada letra?

Cards e busca administrativa filtram arrays já baixados. O desperdício ali é baixar coleções completas na montagem/recarga, não digitar. Login e primeiro acesso têm efeitos com debounce; tentativas completas podem repetir consultas pontuais. Reduzir debounce não conserta diretório integral.

## Há cache?

Sim: sessão e promessa em andamento, sincronização global por runtime, estados de perfis por tela e memória do SDK. Mas não há cache compartilhado/in-flight para bundles; os efeitos não consultam o próprio estado antes de refazer a busca. Reload perde caches de módulo. `updateSessionData` não atualiza `cachedSession`, o que exige atenção à consistência.

## Ativar IndexedDB resolveria tudo?

Não. Persistência pode ajudar em reconexão/navegação e modo offline, mas não elimina efeitos que continuam solicitando dados online. Deve ser avaliada com privacidade, logout, aparelho compartilhado, Safari, múltiplas abas e confirmação online de compras. [Referência offline](https://firebase.google.com/docs/firestore/manage-data/enable-offline).

## Há dois logins consultando tudo ao mesmo tempo?

LoginNew e AuthContext podem pedir a sessão, mas `pendingSession` compartilha a promessa normalmente. Não contar duas cargas completas automaticamente. O StrictMode pode repetir setup de efeitos no desenvolvimento; isso não é comportamento extra da build de produção. [Referência React](https://react.dev/reference/react/StrictMode).

## Entrar como ADM altera dados sem clicar em nada?

Sim, fora da manutenção e da recuperação restrita. O contexto sincroniza seu perfil público e chama sincronização de todos os perfis. Feed chama a mesma função `Once`, mas a Promise de módulo deduplica no mesmo runtime após sucesso. Recarregar o documento web recomeça o runtime e a varredura. Isso é trabalho automático real, não apenas uma verificação de permissão.

## As três escritas de compra/resgate são todas desnecessárias?

Não. Elas atualizam saldo privado, projeção pública e inventário/controle de resgate de forma transacional. Reduzir escritas sem revisar o contrato pode corromper economia ou interface. Há proteções locais contra compra/resgate repetido que retornam sem escrever; o problema de segurança é que as regras permitem alterações diretas mais amplas que esses serviços.

## Um batch custa uma escrita?

Não. Agrupa entrega/atomicidade, mas cada documento escrito/excluído continua contando. A sincronização de U perfis em batches de 400 é UW, não ceil(U/400)W. Um resultado com 12 stats e uma lista é usualmente 13W, sem contar as leituras/notificações associadas.

## As regras também podem consumir leituras?

Sim. `signedIn` depende de account_security; isAdmin também de users; cadastro usa convite/usuário com getAfter. Documentos necessários à avaliação podem ser cobrados, mas referências repetidas ao mesmo documento por requisição não são cobradas como acessos distintos independentes. Não usar as 11 expressões do arquivo como multiplicador 11. [Faturamento das regras](https://firebase.google.com/docs/firestore/pricing#cloud_firestore_security_rules).

## Remover as verificações de segurança reduziria custos?

Pode diminuir verificações, mas não é uma otimização aceitável. As regras já permitem operações indevidas. Primeiro definir autorização correta, medir overhead e avaliar alternativas seguras, como claims para papéis estáveis com revogação apropriada. Não colocar validade de saldo/convite apenas no cliente.

## Esconder uma rota ou bloquear desktop protege o banco?

Não. Endereço oculto, user agent e botões não autorizam operações. Manutenção também é apenas gate de interface. Regras/API são a barreira para quem usa um cliente alternativo. Não publicar na documentação credenciais ou instruções operacionais de ataque para demonstrar esse ponto; as condições das regras já são evidência suficiente.

## O código do convite está protegido no servidor?

No fluxo auditado, a comparação do hash é local. O guest já provisionado também passa por autenticação Firebase Auth com senha derivada do código; portanto existe verificação remota nessa etapa específica. As regras de criação/consumo, contudo, validam convite habilitado, tipo e vínculo, mas não uma prova de validação do código. Além disso, a coleção de convites permite leitura pública. Essa é uma prioridade crítica, especialmente com convites ADM e convidados provisionados. A correção deve preservar convites existentes e colocar a validação/autorização de convite no servidor antes de endurecer o caminho cliente.

## App Check resolve permissão de ADM e saldo?

Não. Ajuda a atestar solicitações de clientes esperados e reduzir algumas formas de abuso; não substitui Auth, regras ou validação de negócio. Não foi encontrada inicialização no código, e configuração/enforcement externo não foi verificado. [Referência oficial](https://firebase.google.com/docs/app-check).

## O documento da pelada já está grande demais?

Não foi medido. O código copia estado/jogos em até 30 snapshots de history e 30 de redo, além do estado atual. Isso cresce em bytes e contém campos não necessários à tela pública. O limite de documento é 1 MiB, mas não se concluiu que já foi alcançado. Também não existe uma taxa fixa universal que determine capacidade de escrita nesse documento; índices e contenção importam. [Limites](https://firebase.google.com/docs/firestore/quotas), [boas práticas](https://firebase.google.com/docs/firestore/best-practices).

## Transações impedem toda duplicação?

Não. Protegem contra atualizações concorrentes conflitantes por tentativa, mas dois comandos de vitória distintos podem ser aplicados sequencialmente. O pedido leva um índice de time, não identidade/revisão esperada da partida. Criação de lista verifica ativo antes da transação; publicação usa autoId. Precisam de idempotência semântica, não só botão disabled.

## Finalizar a pelada é totalmente atômico?

Lista, relatório e métricas são finalizados juntos. O código depois relê a lista e grava faltas em outro batch. Se a segunda etapa falhar, o serviço não a retoma simplesmente ao finalizar de novo. Isso merece revisão de consistência; não é motivo para apagar dados reais ou repetir manualmente incrementos sem plano.

## Precisamos de mais índices para economizar?

Não há evidência estática de uma query ativa com múltiplos ranges custosos. As consultas conhecidas são simples e as principais têm limite. Índices/isenções implantados não estão no repo; obter configuração e usar Query Explain, em contexto autorizado, se houver dúvida. O maior desperdício encontrado é quantidade de documentos e frequência, não um índice comprovadamente ausente. [Query Explain](https://firebase.google.com/docs/firestore/query-explain).

## Há custo Firebase por cada GIF ou vídeo?

Não no modelo implementado: são arquivos do site, não objetos baixados via Firebase Storage. Podem custar tráfego Vercel e performance no celular. O inventário local de assets não representa peso inicial ou armazenamento Firestore. Catálogos locais também não são uma coleção consultada ao filtrar a loja.

## O app usa Cloud Functions ou SMS hoje?

Não foram encontradas Functions no fluxo ativo. A recuperação é uma API Vercel com Admin SDK. O cadastro roteado usa convite e Auth email/senha; o arquivo legado Register tem SMS, mas não é a rota atual. Serviços existentes fora do repositório precisam de verificação no Console.

## Migrar para Blaze agora resolve o problema?

Resolve disponibilidade por cota somente se essa for a causa e o uso estiver autorizado; não corrige amplificação nem permissões. Os números fornecidos não bastam para exigir migração. Medir dia de jogo, corrigir F01-F05 e decidir com tarifa/região/orçamento. Custo estimado regional não foi inventado: [05](05-USAGE-AND-COST-SIMULATION.md) fornece coeficientes e fórmulas.

## Um orçamento impede gasto inesperado?

Alertas comuns não bloqueiam. Há spend caps para serviços elegíveis, mas Firestore não consta da lista Firebase consultada, e mesmo serviços cobertos têm atraso. Proteger consultas e autorização, monitorar e estabelecer resposta operacional continuam necessários. [Guia de orçamento](https://docs.cloud.google.com/billing/docs/how-to/budgets), [serviços elegíveis](https://firebase.google.com/docs/projects/billing/spend-caps).

## Quanto o PARADS suporta de graça?

Depende principalmente de visitantes, cadastro total, telas e mudanças observadas. A tabela do capítulo 05 vai de cenários leves a estresse; os limiares de 89/25/9 DAU com overhead hipotético não são limites reais do produto. As otimizações podem mudar bastante essas curvas. Não confundir capacidade do Firestore com uma cota diária gratuita.

## Podemos usar o script de limpeza para medir os dados?

Não como rotina automática desta auditoria. Mesmo sem aplicação ele acessa serviços e cria snapshots sensíveis; o modo antigo de testes seleciona coleções inteiras de dados que agora são reais. Qualquer inspeção ou migração futura precisa de escopo exato aprovado e ferramenta adequada. Autorizações antigas não se transferem para produção atual.

## O que falta para transformar hipóteses em diagnóstico de produção?

Região/plano/edição, versão de regras, séries diárias por janela/fuso, número agregado de sessões/espectadores, eventos administrativos e origem dos testes. Instrumentação futura por nome lógico de operação, sem PII e fora de uma coleção de logs por leitura, ajuda a atribuir consumo. Cruzar com Billing/Monitoring, não apenas contador de chamadas React.

## O que foi alterado nesta auditoria?

Somente os oito arquivos Markdown de `docs/firebase-audit/`. Nenhuma alteração em código, regras, configurações, dados, plano, índices ou implantação; nenhum push. Não se desativou a manutenção. Scripts, testes de negócio e navegação contra Firebase de produção não foram executados.

## Como implementar depois com segurança?

Seguir [06](06-OPTIMIZATION-ROADMAP.md): autorização explícita, fixtures/emulador, compatibilidade com contas antigas/convidados, backend antes do cliente dependente, regras testadas, implantação gradual e rollback sem reset. A otimização deve manter resultados, saldos e inventários, não apenas reduzir contadores.
