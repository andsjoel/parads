# Simulação de consumo, cotas e custos

Base: análise estática em 18/10/2026. **Nenhuma linha desta simulação representa telemetria de produção.** Os cenários pressupõem o app reaberto; uma nova carga da versão em manutenção não monta esses fluxos.

## O que sabemos e o que não sabemos

Comprovado no código: preload normal de cinco documentos; dois alvos de listener globais; até três documentos por perfil; diretório de perfis+inventários completo; efeito de lista recarrega perfis; transações de compra/resgate; sincronização global no runtime do ADM.

Informado pelo proprietário, não validado: aproximadamente 6.500 leituras, 327 gravações, crescimento de 12.924%/1.208% e pico próximo de 16/10/2026. Não foi informado se o cartão é diário, parcial ou de um intervalo maior. Não inferir DAU ou custo a partir desses números isoladamente.

Desconhecido: região, edição e plano do banco, usuários cadastrados/ativos simultâneos, duração/reconexões, consultas cacheadas efetivas, versões abertas, bytes/documento e SKU cobrado. Não assumir São Paulo porque os usuários são brasileiros. `getFirestore(app)` não especifica localização.

## Cotas e regras de contagem

Como referência para uma base elegível ao gratuito da edição Standard: 50.000 leituras, 20.000 gravações e 20.000 exclusões por dia; 1 GiB armazenado e 10 GiB/mês de saída. A virada da cota usa horário do Pacífico, não a meia-noite de Brasília. A elegibilidade é por projeto/base; confirmar no Console. [Limites oficiais](https://firebase.google.com/docs/firestore/quotas).

Cobrança não é número de chamadas React: atualizações de listener, reconexões, consultas vazias, entradas de índice e documentos dependentes das regras podem acrescentar operações; cache local não é automaticamente nova leitura cobrada. `getDoc` online pode consultar o servidor mesmo já havendo dados. A repetição de existe/get do mesmo documento nas regras não deve ser somada mecanicamente. [Faturamento oficial](https://firebase.google.com/docs/firestore/pricing), [leitura e cache](https://firebase.google.com/docs/firestore/query-data/get-data).

Sem persistência offline web configurada, a documentação trata reconexões de listener como novas consultas para cobrança. Com persistência, desconexões prolongadas também podem recarregar. Não modelar apenas o número de inscrições inicial. Consultas locais sem resposta nova do servidor são outra situação. [Listeners e billing](https://firebase.google.com/docs/firestore/pricing#listening_to_query_results).

## Modelo geral reproduzível

```text
U  = tamanho do cadastro (não necessariamente DAU)
P  = pessoas únicas carregadas da lista/partida
V  = acessos/assinaturas da lista durante a sessão
E  = atualizações da lista observadas durante a sessão
D  = acessos ao diretório Cards
Q  = seleções de carta em Cards
F  = documentos iniciais do feed (mínimo de consulta se vazio)
K  = pessoas de ranking sem bundle embutido
G  = acessos ao guia vazio
A  = leituras transacionais das ações pessoais

R_base/sessão = 7 + F + 3K + G(2U + 3)
               + 2UD + 3Q + (V + E)(1 + 3P) + A
R_total = R_servidor_base + R_regras + R_retries + R_reconexões + R_índices
```

O termo 7 representa cinco leituras de bootstrap + dois alvos globais. É uma aproximação de solicitações/entregas: o SDK pode reutilizar trabalho. G pressupõe um ADM com perfil completo. `(V+E)` aproxima cargas e eventos distintos; não somar duas vezes o mesmo evento. Novas mudanças de stats próprios que disparam o efeito de perfis não foram incluídas separadamente.

Na implementação atual, P inclui também IDs de matchPlayers removidos se ainda presentes. No modelo, P é controlado para tornar os cenários comparáveis. O efeito `list` varia com todos os campos, não só com nomes.

## Roteiros de uso assumidos

Para expor desperdícios de lançamento, o modelo principal usa **feed vazio com guia**. Todos os perfis têm os três documentos, `UP=UI=U`; U=DAU apenas para esta tabela. Um grupo com muitos cadastrados inativos pode custar mais no diretório para o mesmo DAU. P=min(U,30), escolha de cenário, não limite do produto.

| Parâmetro por sessão | Leve | Moderado | Intenso |
|---|---:|---:|---:|
| Sessões frias/dia S | 1 | 2 | 4 |
| Feed vazio G / consulta F | 1 / 1 | 1 / 1 | 1 / 1 |
| Pessoas de ranking K | 0 | 0 | 0 |
| Diretório Cards D | 0 | 1 | 2 |
| Cartas selecionadas Q | 0 | 1 | 3 |
| Montagens lista V | 1 | 2 | 4 |
| Mudanças observadas E | 1 | 5 | 20 |
| Leituras de ações pessoais A | 2 | 5 | 10 |
| Gravações pessoais W, incluindo sync própria | 2 | 7 | 15 |

Exemplo de W leve: sync própria + entrada/saída/solicitação. W moderado: sync + presença + edição (2W) + resgate (3W). W intenso é orçamento de ações como compras/edições/resgates; não significa que uma missão possa ser resgatada infinitamente. Sem elegibilidade/saldo, as escritas são menores. O uso intenso sustentado todo dia é um teste de estresse, não previsão do grupo.

O modelo soma um **overhead hipotético de 50%** às leituras base para ilustrar regras/requisições adicionais: `R_s=ceil(1,5 × R_base)`. Não é multiplicador universal do Firebase, não foi medido e pode ser maior ou menor. Assume-se atendimento pelo servidor das leituras base online, sem economia de cache. As tabelas não contabilizam automaticamente duplicação do StrictMode em produção.

Fórmulas resultantes:

```text
R_base leve     = 13 + 2U + 2(1 + 3P)
R_base moderado = 19 + 4U + 7(1 + 3P)
R_base intenso  = 30 + 6U + 24(1 + 3P)
R_dia = DAU × S × ceil(1,5 × R_base)
W_dia = DAU × S × W_s
Mês ilustrativo = 30 dias idênticos
```

## Consumo diário e mensal no modelo

Separador `.` indica milhares. Leituras por sessão já incluem o overhead hipotético; W não inclui administração. Dias reais sem pelada terão E muito menor.

| DAU | Uso | R/sessão | W/sessão | R/dia | W/dia | R/30 dias | W/30 dias |
|---:|---|---:|---:|---:|---:|---:|---:|
| 20 | Leve | 263 | 2 | 5.260 | 40 | 157.800 | 1.200 |
| 20 | Moderado | 789 | 7 | 31.560 | 280 | 946.800 | 8.400 |
| 20 | Intenso | 2.421 | 15 | 193.680 | 1.200 | 5.810.400 | 36.000 |
| 50 | Leve | 443 | 2 | 22.150 | 100 | 664.500 | 3.000 |
| 50 | Moderado | 1.284 | 7 | 128.400 | 700 | 3.852.000 | 21.000 |
| 50 | Intenso | 3.771 | 15 | 754.200 | 3.000 | 22.626.000 | 90.000 |
| 100 | Leve | 593 | 2 | 59.300 | 200 | 1.779.000 | 6.000 |
| 100 | Moderado | 1.584 | 7 | 316.800 | 1.400 | 9.504.000 | 42.000 |
| 100 | Intenso | 4.221 | 15 | 1.688.400 | 6.000 | 50.652.000 | 180.000 |
| 250 | Leve | 1.043 | 2 | 260.750 | 500 | 7.822.500 | 15.000 |
| 250 | Moderado | 2.484 | 7 | 1.242.000 | 3.500 | 37.260.000 | 105.000 |
| 250 | Intenso | 5.571 | 15 | 5.571.000 | 15.000 | 167.130.000 | 450.000 |
| 500 | Leve | 1.793 | 2 | 896.500 | 1.000 | 26.895.000 | 30.000 |
| 500 | Moderado | 3.984 | 7 | 3.984.000 | 7.000 | 119.520.000 | 210.000 |
| 500 | Intenso | 7.821 | 15 | 15.642.000 | 30.000 | 469.260.000 | 900.000 |
| 1.000 | Leve | 3.293 | 2 | 3.293.000 | 2.000 | 98.790.000 | 60.000 |
| 1.000 | Moderado | 6.984 | 7 | 13.968.000 | 14.000 | 419.040.000 | 420.000 |
| 1.000 | Intenso | 12.321 | 15 | 49.284.000 | 60.000 | 1.478.520.000 | 1.800.000 |

As linhas que excedem 50.000R/dia não cabem nessa cota de leitura; 500/1.000 intensos também excedem 20.000W/dia. Um total mensal baixo não compensa o domingo que ultrapassou a cota. O componente `U × DAU` das varreduras leva a crescimento quadrático quando cadastro e ativos crescem juntos; não é uma propriedade obrigatória do Firestore.

Se o feed tiver publicações, substituir `1 + 2U + 3` por `F + 3K` no roteiro de uma entrada, e considerar notificações do feed separadamente. Exemplo U=50,F=3,K=5: o termo cai de 104 para 18, mas não elimina a cascata da pelada. Acesso ao próprio perfil/loja sem compras praticamente não acrescenta consultas de tela.

## Administração e um dia de jogo

Valores separados para evitar atribuir todo custo administrativo a cada usuário:

- A runtimes frios de ADM: `AU` leituras + `AU` gravações de sincronização global, além da inicialização própria.
- Montar gestão: até UR de usuários + alvo da lista; gestão de convites: I+CR por carga.
- 30 chegadas novas com UID/stats existente: cerca de 60R/60W, antes de regras e notificações.
- 20 partidas com 12 pessoas/stats existentes: cerca de 260R/260W diretos, antes de regras, retries e espectadores.
- Encerramento: 4R e 3+N W, incluindo a etapa atual de faltas.
- Publicar/remover: 1W/1D por card, mais eventos para quem acompanha o feed.

Um resultado com 30 espectadores, 30 perfis e uma mudança de L pode provocar 30 leituras do estado + até 2.700 leituras explícitas de perfis. Isso pode superar amplamente os 13R/13W diretos do comando de resultado. A multiplicação é de chamadas lógicas online; cobrança exata depende do SDK/regras. Não aplicar simultaneamente este fan-out adicional a E se ele já estiver incluído na tabela principal.

## Quantos usuários cabem no gratuito?

Resolvendo somente `R_dia <= 50.000`, sem administração, bytes ou margem:

| Overhead de leitura usado | Leve | Moderado | Intenso |
|---|---:|---:|---:|
| 0%, apenas base de solicitações | 116 | 31 | 12 |
| 50%, cenário principal | 89 | 25 | 9 |
| 100%, sensibilidade | 73 | 21 | 8 |

Esses números não são promessas de suporte, nem usuários simultâneos, nem limite técnico do Firebase. E cresce com comportamento compartilhado: um usuário parado no perfil custa muito menos que alguém acompanhando cada resultado. Fixar cadastro U em 50 em vez de fazê-lo crescer também muda as raízes.

Para operação real, usar P95 do dia de pelada, somar administração/reconexões e reservar pelo menos 30% de margem como política proposta. Sem medir os fluxos, não prometer "suporta 1.000 de graça" nem concluir "20 usuários já exigem Blaze".

## Fórmulas monetárias, sem inventar região

Confirmar na [tabela oficial por localização](https://cloud.google.com/firestore/pricing): preço sob demanda da edição/região, moeda/SKU e elegibilidade ao gratuito. A página pode abrir em uma região padrão que não é a do PARADS. Não usar seus valores como tarifa deste projeto.

Defina `pR`, `pW`, `pD` como preço regional por 100.000 operações; `pS` por GiB-mês de armazenamento; `pE` por GiB de saída aplicável. Para cada dia d:

```text
C_ops = soma_d [max(0,Rd-QR)/100000 × pR
             + max(0,Wd-QW)/100000 × pW
             + max(0,Dd-QD)/100000 × pD]
C_total = C_ops + C_armazenamento + C_saída + C_recursos_adicionais
```

QR/QW/QD só recebem 50.000/20.000/20.000 se essa base for elegível ao gratuito; senão usar as cotas aplicáveis. Índices faturáveis somam-se às leituras conforme a consulta. O custo real inclui overhead e preços regionais, impostos/conversão, eventual backup/PITR/TTL, Vercel e demais serviços, não apenas C_ops.

Coeficientes de custo **mensal de operações** para os 30 dias idênticos da tabela, após descontar cotas diariamente. Preencher pR/pW com a tarifa confirmada; `0` não significa fatura total zero:

| DAU | Leve | Moderado | Intenso |
|---:|---|---|---|
| 20 | 0 | 0 | 43,104 × pR |
| 50 | 0 | 23,52 × pR | 211,26 × pR |
| 100 | 2,79 × pR | 80,04 × pR | 491,52 × pR |
| 250 | 63,225 × pR | 357,6 × pR | 1.656,3 × pR |
| 500 | 253,95 × pR | 1.180,2 × pR | 4.677,6 × pR + 3 × pW |
| 1.000 | 972,9 × pR | 4.175,4 × pR | 14.770,2 × pR + 12 × pW |

Com só quatro domingos intensos no mês, calcular quatro dias intensos e 26 dias dos perfis efetivos, não multiplicar a linha intensa por 30. Leituras gratuitas não acumulam de segunda para domingo.

## Outros custos e limites

Tráfego Firestore pode ser aproximado por `soma(bytes das respostas)/2^30`, não por tamanho de assets locais. Repetir um documento grande da pelada para muitos espectadores aumenta saída mesmo quando a leitura continua contando como um documento. Armazenamento inclui índices e metadados, não apenas JSON. Nenhum tamanho real de produção foi medido.

GIFs e vídeos estão no site, portanto analisar tráfego Vercel/HTTP separadamente. SDK Auth e API de recuperação têm métricas e condições próprias; o fluxo ativo não é SMS. A existência de Storage/Functions apenas no Console permanece uma pendência de verificação.

## Decisão sobre Blaze

Não migrar somente por um crescimento percentual alto. Se 6.500R for um dia inteiro, esse valor isolado está dentro da referência gratuita; ainda assim, os achados precisam de correção. Migrar pode ser prudente por disponibilidade quando o consumo observado projetar exceder cotas, **depois** de restringir abuso, reduzir amplificação e definir orçamento/alertas e resposta a incidentes.

No Spark, atingir a cota pode interromper acesso; não presumir cobrança automática de excedente. No Blaze, há cobrança de consumo conforme condições, não capacidade infinita sem limites. Alertas de orçamento comuns não são um bloqueio automático; mecanismos de teto dependem da elegibilidade específica do serviço e têm atrasos. Ver [07](07-MONITORING-GUIDE.md).
