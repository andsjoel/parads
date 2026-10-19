# Achados, evidências e classificação

Base: `7e70408`, 18/10/2026. Nenhuma correção aplicada. "Comprovado" significa demonstrado no código, não reproduzido em produção. Nenhum loop infinito ou custo ilimitado em uso normal foi demonstrado. Riscos de abuso pressupõem que as regras locais sejam as implantadas.

Severidades: CRÍTICO = exposição capaz de comprometer dados/custos; ALTO = desperdício relevante ou risco operacional importante; MÉDIO = impacto moderado/condicional; BAIXO = pontual/preventivo. Estimativas referem-se a documentos/operações, não a dinheiro medido.

## F01: operações privilegiadas confiadas ao cliente

- **CRÍTICO.** [firestore.rules:60](../../firestore.rules#L60), [92](../../firestore.rules#L92), [99](../../firestore.rules#L99), [111](../../firestore.rules#L111).
- Evidência: qualquer usuário aceito por `signedIn()` cria/atualiza listas sem validação de campos/status; dono altera saldo, stats e inventário. Em users, apenas role/type são protegidos na atualização própria.
- Causa: autorização de negócios implementada majoritariamente em botões e funções JavaScript, não como contrato servidor/regras.
- Consequência: alteração indevida de partidas, moedas, missões e compras; clientes alternativos podem provocar escritas e fan-out sem passar pelas telas. Manutenção/mobile-only não impedem isso.
- Recomendação: desenhar matriz de operações e mover comandos sensíveis para servidor ou regras de transição estritas. Validar membro, convidado, ADM, contas antigas, convidados provisionados e recuperação em emulador antes do deploy.
- Economia: não quantificável sem evidência de abuso; fecha um caminho de consumo arbitrário. Não há afirmação de ataque ocorrido.
- Complexidade: alta. Risco de regressão: alto se bloquear diretamente escritas atuais sem migrar os fluxos.

## F02: convite público e validação de código exclusivamente local

- **CRÍTICO.** [firestore.rules:29](../../firestore.rules#L29), [51](../../firestore.rules#L51), [86](../../firestore.rules#L86); [FirstAccessNew.jsx:249](../../src/pages/FirstAccessNew.jsx#L249); [firstAccessService.js:64](../../src/services/firstAccessService.js#L64).
- Evidência: convites e usernames permitem `read: true`, incluindo listagem. As regras de cadastro verificam vínculo/papel, mas não exigem prova de validação do código. A comparação de hash é local; especificamente para guest provisionado, o fluxo também autentica no Firebase Auth com senha derivada do código ([FirstAccessNew.jsx:330](../../src/pages/FirstAccessNew.jsx#L330)). Essa verificação remota do Auth não substitui a autorização do convite nas regras. Hash/salt e dados de convite chegam ao cliente; o código tem espaço pequeno. Reserva de username também aceita criação por qualquer `signedIn`, sem vínculo obrigatório ao UID.
- Causa: comparação local tratada como proteção suficiente para consumo de convite.
- Consequência: exposição de dados pessoais, uso indevido de convites/papéis e criação de identidades/consultas fora do fluxo esperado; possível amplificação de consumo não autenticado nas coleções públicas.
- Recomendação: validar convite/código e reserva no servidor, retornar somente dados mínimos, adicionar proteção contra tentativas automatizadas e revisar acesso público. Seguir o plano simplificado vigente, sem App Check/reCAPTCHA.
- Economia: não estimável; é prioridade de segurança antes de simples redução de leituras.
- Complexidade: alta. Risco: alto para cadastro e convidados legados; manter códigos existentes válidos até uma transição planejada. Não publicar regras incompatíveis primeiro.

## F03: cascata integral de perfis em cada atualização da pelada

- **ALTO.** [MatchList.jsx:364](../../src/pages/MatchList.jsx#L364), [publicProfileService.js:13](../../src/services/publicProfileService.js#L13), [AuthContext.jsx:133](../../src/contexts/AuthContext.jsx#L133).
- Evidência: efeito depende de list/presence/stats/inventory/user; para cada alteração busca todos os IDs, incluindo entries removidas e o próprio usuário, antes de sobrepor a sessão. Não utiliza `profilesById` para escolher somente ausentes.
- Causa: identidade/cosméticos/estatísticas e atualização de equipes acoplados na mesma carga.
- Consequência: até `3P` leituras explícitas por rodada/espectador; mudanças de stats e lista podem causar rodadas separadas. Também há concorrência de respostas.
- Recomendação: cache de projeção compartilhado por UID com dedupe in-flight; assinatura estável do conjunto de IDs; excluir removidos e aproveitar sessão; detalhes completos sob demanda. Preservar atualização de stats próprios e invalidar cosméticos após edição.
- Economia: para P estável, potencialmente eliminar quase todas as `3P × E × V` buscas repetidas; stats ao vivo exigidos devem ser contabilizados separadamente. Não prometer percentagem de fatura antes de medir cache/regras.
- Complexidade: média. Risco: médio, principalmente perfis desatualizados e tratamento de conta removida.

## F04: duas coleções completas para obter diretório ou um ADM

- **ALTO.** [publicProfileService.js:67](../../src/services/publicProfileService.js#L67), [Feed.jsx:89](../../src/pages/Feed.jsx#L89), [Cards.jsx:54](../../src/pages/Cards.jsx#L54).
- Evidência: lê todos os public_profiles e todos os user_inventory; no feed vazio usa o resultado apenas para escolher um ADM e buscar sua carta. Cards mostra no máximo dez opções após baixar o conjunto.
- Causa: inventário usado como indicador de conta ativa; ausência de projeção de diretório com status/índices adequados.
- Consequência: `UP+UI`, usualmente `2U`, por acesso; o feed de boas-vindas fica mais caro conforme o grupo cresce. Digitar não é o problema: os dados já chegaram.
- Recomendação: apontar ADM do guia por configuração/projeção mínima; diretório leve com campo de atividade e política de atualização; cache/consulta sob demanda e paginação/estratégia de busca compatível com nomes e usernames. Firestore não fornece busca textual substring arbitrária por padrão.
- Economia: guia de U=50 passa de aproximadamente 103 documentos para poucos; Cards deixa de baixar inventários de todos. Estimativa condicionada ao desenho escolhido.
- Complexidade: média. Risco: médio; evitar reintroduzir perfis excluídos e preservar busca com acentos/apelidos.

## F05: sincronização total automática a cada runtime do ADM

- **ALTO.** [AuthContext.jsx:95](../../src/contexts/AuthContext.jsx#L95), [Feed.jsx:39](../../src/pages/Feed.jsx#L39), [publicProfileService.js:112](../../src/services/publicProfileService.js#L112).
- Evidência: consulta toda users e escreve um public_profile por usuário com timestamp novo. A Promise `Once` realmente deduplica Feed/Auth no mesmo runtime; não é correto contar duas varreduras garantidas por login.
- Causa: reparação global incorporada ao caminho normal da aplicação.
- Consequência: UR+UW por carga fria administrativa; tráfego/dados desnecessários e risco de sobrescrever projeção recente com snapshot antigo se edição/compra concorrer.
- Recomendação: manter projeções nas mutações existentes e usar reparação administrativa explícita, delimitada e autorizada; condicionar sync própria à mudança efetiva.
- Economia: `A × U` leituras e gravações evitadas por dia, A runtimes frios de ADM, fora reparações realmente necessárias. Ex.: 10 recargas, 50 usuários: 500R+500W.
- Complexidade: baixa/média para remover o automatismo; média para reconciliação segura. Risco: médio, perfis antigos podem precisar de reparação controlada antes da remoção.

## F06: documento compartilhado com histórico e estado acumulados

- **ALTO, risco de escala demonstrável; limite ainda não medido.** [snapshotBefore:631](../../src/services/volleyListService.js#L631), [appendHistory:645](../../src/services/volleyListService.js#L645), [recordTeamWin:1454](../../src/services/volleyListService.js#L1454).
- Evidência: snapshots copiam times, matchPlayers, games, presenças e resumo. history/redo têm teto individual de 30, mas o conteúdo de cada snapshot cresce; players removidos ficam no array. Várias operações gravam e notificam o mesmo L.
- Causa: modelo de estado e auditoria em um único documento observado por todos.
- Consequência: mais bytes por atualização, pressão de índices/memória e contenção transacional. Há risco de exceder 1 MiB por documento ou outros limites; não foi comprovado que isso já ocorreu. Um documento grande continua sendo um documento para cobrança de leitura, mas custa mais tráfego.
- Recomendação: medir tamanho real em ambiente de teste representativo; projeção pública compacta; histórico/eventos fora do documento transmitido; revisar índices somente após obter a configuração implantada. Não recriar a base ou apagar histórico real.
- Economia: principalmente bytes, latência e retries; a redução de leituras vem também de F03. Separar em muitos documentos observados pode aumentar leituras, portanto modelar antes.
- Complexidade: alta. Risco: alto para undo/redo, estatísticas e compatibilidade de clientes antigos.

Limites e contenção: [quotas](https://firebase.google.com/docs/firestore/quotas), [transações](https://firebase.google.com/docs/firestore/transaction-data-contention). Não existe uma taxa universal de escritas por segundo segura para qualquer documento; depende da carga/índices e precisa de teste.

## F07: feed recarrega rankings já carregados

- **MÉDIO.** [Feed.jsx:58](../../src/pages/Feed.jsx#L58), [publicProfileService.js:45](../../src/services/publicProfileService.js#L45).
- Evidência: efeito exclui bundles embutidos e mocks, mas não consulta profilesById ao formar remoteIds; depende de todo posts e de publicProfilesRevision.
- Causa: hidratação do ranking sem cache compartilhado/invalidação delimitada.
- Consequência: até três leituras por ID único em cada notificação, mesmo que outro post tenha mudado. Sem loop infinito comprovado.
- Recomendação: compartilhar a solução de F03; carregar projeção leve do minicard e detalhes no clique; definir se ranking usa cosmético atual ou snapshot do dia.
- Economia: até `3K × (repetições evitadas)` por espectador. Complexidade: média. Risco: médio por semântica histórica e atualização de cartas.

## F08: inicialização lê documentos que já serão acompanhados ou não são usados

- **MÉDIO.** [sessionDataService.js:13](../../src/services/sessionDataService.js#L13), [AuthContext.jsx:114](../../src/contexts/AuthContext.jsx#L114).
- Evidência: stats/segurança lidos no preload e depois observados; showcase é carregado sem consumidor visual encontrado. Login e contexto, porém, compartilham a mesma Promise, evitando uma duplicação importante.
- Causa: bootstrap e assinatura tratados como etapas separadas; estrutura de vitrine antecipada.
- Consequência: alvos/entregas iniciais extras; parte pode ser satisfeita pelo SDK, portanto não afirmar cobrança duplicada invariável.
- Recomendação: bootstrap pelo primeiro snapshot quando adequado e remover/adiar somente dados comprovadamente dispensáveis; manter a verificação inicial de segurança antes de consultas protegidas.
- Economia: até 1-3 solicitações documentais por carga fria, a validar. Complexidade: média. Risco: médio/alto se quebrar revogação ou recuperação.

## F09: caches sem atualização e respostas assíncronas sem geração

- **MÉDIO.** [sessionDataService.js:35](../../src/services/sessionDataService.js#L35), [AuthContext.jsx:41](../../src/contexts/AuthContext.jsx#L41), [MatchList.jsx:364](../../src/pages/MatchList.jsx#L364), [Feed.jsx:58](../../src/pages/Feed.jsx#L58).
- Evidência: updateSessionData altera Context, não cachedSession; carregamentos de perfis não têm geração/cancelamento. Cards tem token de seleção, um exemplo positivo.
- Causa: duas fontes de sessão e operações concorrentes sem coordenação.
- Consequência: dados antigos podem reaparecer ao reutilizar a sessão/terminar busca atrasada; tentativas/reloads manuais podem aumentar consumo. Não foi reproduzido bug real nesta auditoria.
- Recomendação: fonte única de sessão, invalidação por UID/versão e guarda de resposta antiga; cache com TTL e erro negativo curto para perfis ausentes, sem reter dados entre contas.
- Economia: indireta/não estimável. Complexidade: média. Risco: médio, sobretudo troca de usuário e saldo exibido.

## F10: gestão baixa usuários, convites e códigos inteiros

- **MÉDIO.** [getVolleyAdminUsers:743](../../src/services/volleyListService.js#L743), [getPreRegisters:24](../../src/services/preRegisterService.js#L24), [PreRegistersManager.jsx:191](../../src/components/admin/PreRegistersManager.jsx#L191), [223](../../src/components/admin/PreRegistersManager.jsx#L223).
- Evidência: usuários completos na montagem da gestão; convites+códigos completos na entrada e após algumas mutações. Filtros/limites são locais.
- Causa: dataset pequeno assumido e código de acesso carregado antecipadamente.
- Consequência: UR ou (I+C)R por recarga; exposição desnecessária no navegador administrativo de campos não exibidos.
- Recomendação: projetar lista administrativa mínima, paginação quando volume justificar; buscar código ao expandir convite pendente; atualizar item local após mutação ou invalidar página afetada.
- Economia: recargas de I+C viram consultas pontuais; para 50 convites/códigos e cinco recargas, até 500 documentos evitáveis, conforme C real. Complexidade: média. Risco: médio para contagens/filtros globais.

## F11: salvar/sincronizar sem mudança ainda grava timestamps

- **MÉDIO.** [profileService.js:8](../../src/services/profileService.js#L8), [syncOwnPublicProfile:102](../../src/services/publicProfileService.js#L102).
- Evidência: salvar perfil grava privado+público sem comparação; sync própria sempre inclui timestamp novo. Não há autosave por tecla encontrado.
- Causa: ausência de dirty check e atualização de projeção incondicional.
- Consequência: 2W por salvar sem mudança e 1W por inicialização; pode acionar leitores que observem esses documentos em outros clientes/versões.
- Recomendação: comparação normalizada de campos e escrita somente de mudanças, mantendo compatibilidade dos campos promocionais; não presumir que batch/merge/no-op seja grátis.
- Economia: `2 × salvamentos vazios + inicializações sem necessidade de sync` gravações. Complexidade: baixa/média. Risco: baixo/médio.

## F12: criação/resultados/publicação sem identidade idempotente

- **ALTO para integridade; custo condicional.** [createVolleyList:758](../../src/services/volleyListService.js#L758), [recordTeamWin:1454](../../src/services/volleyListService.js#L1454), [AdminReports.jsx:76](../../src/pages/AdminReports.jsx#L76).
- Evidência: criação consulta ativo fora da transação e gera IDs distintos; vitória envia índice, não identidade/revisão da partida; publicação usa autoId e checa apenas posts carregados. Dois clientes podem enviar comandos independentes válidos.
- Causa: transação evita lost update, mas não identifica intenção duplicada ou estado esperado.
- Consequência: listas duplicadas ocultas por limit(1), partidas/estatísticas duplicadas ou publicação repetida; cada uma gera escritas e fan-out. Botão ocupado em um navegador não coordena dois administradores.
- Recomendação: comando com identidade/revisão esperada, índice ativo transacional e chave determinística de publicação. Preservar histórico e reversão.
- Economia: variável, apenas duplicações evitadas. Complexidade: média/alta. Risco: alto para fila, resultados e undo.

## F13: encerramento tem etapa posterior não recuperável automaticamente

- **MÉDIO.** [finishVolleyList:1760](../../src/services/volleyListService.js#L1760), [1833](../../src/services/volleyListService.js#L1833).
- Evidência: transação finaliza lista/relatório/métricas; depois relê L e grava faltas. Nova chamada retorna se já existe relatório, sem retomar batch que tenha falhado.
- Causa: finalização em duas fases sem marcador de conclusão da segunda.
- Consequência: inconsistência parcial e tentativas manuais; gravações de faltas ainda existem apesar de não serem mostradas no relatório. Adequação dessa regra deve ser confirmada com o proprietário.
- Recomendação: retorno da transação evita releitura desnecessária; etapa posterior idempotente/reconciliável, ou redesign autorizado do encerramento. Não remover/zerar faltas antigas nesta auditoria.
- Economia: até 1R por encerramento e tentativas, pequeno impacto relativo. Complexidade: média. Risco: médio/alto para presença acumulada.

## F14: script antigo de limpeza tem escopo destrutivo amplo

- **ALTO, operacional.** [firebase-maintenance.mjs:94](../../scripts/firebase-maintenance.mjs#L94), [134](../../scripts/firebase-maintenance.mjs#L134), [158](../../scripts/firebase-maintenance.mjs#L158).
- Evidência: sem argumentos já lista coleções e Auth; `--apply-tests` seleciona integralmente listas, relatórios, métricas e feed, não apenas dados provados como teste. Gera snapshots com dados pessoais.
- Causa: ferramenta de pré-lançamento permanece disponível após entrada de dados reais.
- Consequência: perda de produção se alguém aplicar a antiga rotina, além de consumo por varredura. Backup e precondição de versão não tornam a seleção apropriada.
- Recomendação: futura trava explícita por ambiente/IDs/plano aprovado e documentação operacional. Não executar ou reutilizar autorizações antigas de limpeza.
- Economia: não é otimização; evita incidente. Complexidade: baixa/média. Risco de mudar o script: baixo se não usado; risco de executá-lo hoje: alto.

## F15: mídia pesada, custo fora do Firestore

- **MÉDIO.** [profileAssets.js](../../src/utils/profileAssets.js), [ProfileBackgroundMedia.jsx](../../src/components/profile/ProfileBackgroundMedia.jsx); inspeção de tamanho dos assets locais.
- Evidência: maior GIF com 9,24 MB; assets locais somam cerca de 114,75 MB, não necessariamente baixados na primeira navegação.
- Causa: cosméticos animados com arquivos grandes e múltiplas superfícies de preview.
- Consequência: possíveis problemas de LCP, memória, bateria e tráfego Vercel; não são leituras extras de Storage/Firestore.
- Recomendação: medir waterfall/decode no celular; revisar formatos, lazy loading e poster conforme resultado, preservando os cosméticos adquiridos e IDs do catálogo.
- Economia: bytes, não R/W; depende dos acessos e do cache HTTP. Complexidade: média. Risco: médio para transparência/animações/aparência.

## F16: operações pouco visíveis e falta de atribuição por fluxo

- **BAIXO para consultas pontuais; MÉDIO para diagnóstico.** [Feed.jsx:154](../../src/pages/Feed.jsx#L154), [AdminReports.jsx:46](../../src/pages/AdminReports.jsx#L46), [AdminVolleyList.jsx:423](../../src/pages/AdminVolleyList.jsx#L423).
- Evidência: posts tipo games são filtrados depois de baixados; efeitos de algumas páginas administrativas são registrados antes do retorno de não-ADM; não há instrumentação central de contagem por serviço/tela. Guardas de interface não são guardas do efeito.
- Consequência: leituras desnecessárias em navegação direta e dificuldade de atribuir o pico. As regras continuam sendo responsáveis pela autorização; não se comprovou volume significativo aqui.
- Recomendação: só assinar após autorização, filtrar no servidor quando viável sem quebrar índices; introduzir contadores amostrados fora do Firestore e medir do antes/depois.
- Economia: pequena nas leituras pontuais; ganho principal é confiança do diagnóstico. Complexidade: baixa/média. Risco: baixo/médio.

## Hipóteses explicitamente não confirmadas

- Vazamento de listeners: cleanup existe nos principais fluxos; medir comportamento real antes de acusar.
- Leituras por render: as dependências disparam efeitos, não todos os renders.
- Pico em 16/10 causado por uma função específica: não há logs/séries para atribuir.
- Região brasileira, plano Spark e tarifas locais: não inferidos do domínio ou endereço dos usuários.
- Documento já acima de 1 MiB, índice já excedido, ataques ou duplicações ocorridas: não comprovados.
- Custos de Cloud Functions/Storage: não encontrados no fluxo ativo; serviços externos ao repo exigem Console.
