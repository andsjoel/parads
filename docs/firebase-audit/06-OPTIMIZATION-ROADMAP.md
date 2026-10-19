# Plano de otimização e implantação segura

> Roteiro histórico da auditoria inicial, substituído no escopo e na ordem de execução pelo [plano simplificado](10-SIMPLIFIED-SECURITY-PLAN.md). Não autoriza implementação. Não serão implementados App Check ou reCAPTCHA, nem migração geral das operações para APIs.

Proposta, não autorização de implementação. Base `7e70408`, 18/10/2026. Preservar contas, convites, UID de convidados, compras, saldos, estatísticas e históricos reais. Nenhuma etapa exige zerar a base.

## Sequência recomendada

| Ordem | Trabalho | Achados | Impacto / esforço / regressão | Critério de aceitação |
|---|---|---|---|---|
| 0 | Confirmar Console, versão implantada, regras e linha de base | Todos | Alto diagnóstico / baixo / baixo | Região/plano/períodos conhecidos; roteiro repetível sem dados reais |
| 1 | Autorizar comandos, proteger economia e validar convite no servidor | F01/F02 | Crítico segurança / alto / alto | Matriz allow/deny em emulador; fluxos existentes e convidados provisionados funcionando |
| 2 | Desacoplar perfis da atualização da pelada, cache compartilhado | F03/F07/F09 | Muito alto leitura / médio / médio | Mudança só de times não refaz todos os perfis; stats continuam corretos |
| 3 | Diretório leve, guia busca somente ADM, busca/paginação | F04/F10 | Alto leitura / médio / médio | Guia independente de U; Cards não lê inventário global |
| 4 | Tirar reparação global do login e sync desnecessária | F05/F11 | Alto escrita / médio / médio | Login ADM não altera perfis de todos; projeções permanecem corretas |
| 5 | Bootstrap/listeners e gestão: carregar só o necessário | F08/F10/F16 | Moderado / médio / médio | Menos chamadas iniciais/recargas, sem perder revogação ou filtros |
| 6 | Identidade/idempotência de comandos e fechamento retomável | F12/F13 | Alto integridade / médio-alto / alto | Dois ADMs/retry não duplicam resultado ou finalização |
| 7 | Projeção compacta de pelada, histórico fora do documento público | F06 | Alto escala/bytes / alto / alto | Tamanho/tráfego limitados; undo/redo e versões compatíveis |
| 8 | Travas de ferramenta operacional e mídia | F14/F15 | Proteção/UX / baixo-médio / baixo-médio | Sem seleção destrutiva implícita; mídia avaliada em aparelho real |

Instrumentação mínima da etapa 0 pode começar localmente; instrumentação permanente/alterações de Console também precisam de aprovação. Resolver autorização antes de reabrir é recomendação, não uma mudança realizada.

## Cache e consultas compartilhadas: desenho justificado

O problema não pede uma biblioteca de estado por moda. É possível começar com um serviço de cache explícito, aproveitando a organização existente. Adotar uma biblioteca só se remover complexidade real.

- Separar dado de minicard (nome/URLs/seleções) de detalhe completo da carta (inventário/stats).
- Chave por UID, TTL explícito e promessa em andamento compartilhada; cache não deve ser uma Promise global que mistura contas.
- Atualizar apenas IDs novos e revalidar cosméticos quando a política de frescor exigir, não em todo resultado de partida.
- Aproveitar imediatamente a sessão para o usuário atual; não consultar para depois sobrescrever.
- Invalidar após editar/comprar/excluir e limpar dados administrativos/privados no logout.
- Erro transitório não vira null permanente. Conta removida usa cache negativo curto, sem ressuscitar órfãos.
- Carga atrasada de lista antiga não deve sobrescrever a atual; reaproveitar a ideia de geração já usada em Cards.

Alvo de economia: de `3P` leituras a cada atualização com conjunto estável para apenas o necessário ao estado da partida; a primeira carga continua existindo. Não cachear indefinidamente saldo ou autorização. Métricas de sucesso: bundles iniciados por evento, cache hit e documentos solicitados por espectador/minuto.

## Diretório e paginação

O guia precisa de um ADM, não de todos os inventários. Uma referência de ADM/projeção mínima elimina a varredura da tela mais acessada.

Para Cards e gestão, começar por diretório leve com atividade explícita, paginação por cursor e busca com semântica definida. Uma consulta por prefixo não substitui automaticamente a busca substring atual. Decidir se são necessários tokens de nome, prefixos por username ou serviço de busca; para um grupo pequeno, cache de diretório leve pode ser suficiente e menos complexo.

Os números dos filtros administrativos devem continuar representando o grupo inteiro, não só a página atual. Agregações ou métricas mantidas no servidor podem resolver isso, mas adicionam operações e precisam de reconciliação. Não sugerir um contador escrito a cada busca.

## Persistência offline: considerar depois, não como correção universal

Há benefício potencial em navegação/reconexão, mas ela não impede consultas online repetidas por efeitos. Não é substituta de F03/F04.

Antes de optar por persistência: consentimento/política de dispositivo confiável, múltiplas abas, limpeza no logout, conta trocada no mesmo aparelho, limites de armazenamento e erros de IndexedDB em Safari/Android. Transações de compra, resgate e resultado exigem confirmação online; não tratar saldo cacheado como garantia de sucesso. [Documentação offline](https://firebase.google.com/docs/firestore/manage-data/enable-offline).

## Listeners: manter os necessários

Lista/times precisam de realtime durante a pelada; segurança precisa invalidar a sessão. Reduzir efeitos derivados tem melhor retorno imediato que remover esses listeners.

Stats próprios podem permanecer globais se a atualização de missões for requisito, mas não devem obrigar a recarga dos outros atletas. Relatórios ADM podem usar refresh explícito em vez de três listeners se isso for aceito na UX. Compartilhar a assinatura da lista entre telas só se navegação real justificar; uma assinatura global mantida no perfil/loja pode custar mais do que a atual limpeza.

## Projeções, agregados e consistência

O projeto já atualiza perfil público nas compras, resgates e edição, e já agrega relatório/métricas no encerramento. Reutilizar esses contratos em vez de acrescentar outro ciclo global de sincronização.

Ao separar dados da pelada, manter documento de leitura pública pequeno e eventos administrativos autorizados. Não colocar em dez listeners aquilo que hoje sai em um documento sem modelar o número de documentos cobrados. Histórico detalhado pode ser carregado só quando o ADM desfizer/consultar; prever retenção sem exclusão automática de dados reais.

## Compatibilidade, dependências e migração

1. Catalogar campos ausentes e tipos legados com fixtures sintéticas: role/type, firstAccessPending, convidados antigos, ausência de segurança, stats e compras existentes.
2. Se houver novo endpoint, publicar backend validado antes do cliente que depende dele; manter a manutenção enquanto necessário.
3. Publicar cliente que compreenda o contrato novo e possa lidar com permissão/versão incompatível com mensagem clara.
4. Só então ativar regras finais estritas e retirar caminhos antigos conforme plano aprovado. Uma aba antiga pode continuar aberta; não assumir que push atualiza todos imediatamente.
5. Se precisar backfill, apresentar coleção/campos/IDs, custo, dry-run e reversão para aprovação específica. Preferir atualização incremental e idempotente. Não usar o script antigo como migração genérica.
6. Tratar índices como dependência de deploy, aguardando construção antes de usar nova query em produção.

Decisão atual do proprietário: App Check e reCAPTCHA estão fora do planejamento. Não configurar ou contratar esses recursos.

## Validação proposta, sem produção

Montar Emulator Suite/projeto de teste isolado em etapa autorizada. Os testes atuais usam mocks; não bastam para regras e cobrança.

Roteiro: login normal e restrito; guia vazio; feed publicado; lista crescendo; convidados pedem/ADM aceita; chegada e sorteio; marcações/trocas livres; resultado e undo/redo; edição/compra/resgate; exclusão; relatório/publicação; navegação repetida, duas abas, desconexão e dois ADMs.

Fixtures: 20/50/100/250/500/1.000 perfis sintéticos, 30 jogadores por pelada para comparação e casos maiores separados. Não criar milhares de contas Auth de produção para teste. Verificar tanto igualdade de resultados/estatísticas quanto contagem de operações e bytes.

Critérios quantitativos propostos, não garantias: uma primeira carga por UID/TTL em vez de toda atualização; zero varredura global no login; zero inventário global no guia; documentos públicos da pelada com orçamento de tamanho definido após medição; ausência de crescimento contínuo de listeners após navegar.

## Rollback e operação

- Cliente: reverter somente os commits da otimização, preservando dados. Não voltar a uma versão com permissões perigosas como solução automática de disponibilidade.
- Regras: manter versão anterior para diagnóstico, mas rollback exige avaliar exposição; não abrir `allow read/write: true` para corrigir uma tela.
- Backend: suportar contrato anterior por período planejado ou exigir atualização de versão com aviso.
- Migração: plano reversível de campos, não reset do banco; guardar backup com acesso restrito se autorizado.
- Manutenção: manter independente das alterações econômicas. Desligá-la somente após validar rotas e APIs com contas de teste designadas.

Não há mudanças de código, regras, configuração, plano ou banco executadas por este roteiro.
