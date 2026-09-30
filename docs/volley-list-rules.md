# Operação da lista de vôlei

Este documento registra as regras observadas no sistema legado `parads-list` e a adaptação para o app atual.

## Fases da pelada

1. **Lista aberta:** membros confirmam interesse como levantador ou jogador.
2. **Chegada:** ao iniciar, a lista de confirmações é congelada apenas para consulta e a presença real começa vazia. O admin busca qualquer usuário cadastrado e o inclui conforme ele chega à quadra.
3. **Formação inicial:** o botão para formar times é liberado com 12 presentes. Somente os 12 primeiros são sorteados em dois times de seis, respeitando as regras de composição.
4. **Jogos:** os dois primeiros times ficam em quadra. Os demais são exibidos como próximos.
5. **Encerramento:** resultados e presença são consolidados nos stats dos membros.

## Composição dos times

- Cada time possui até 6 jogadores.
- Cada time pode ter no máximo 1 levantador.
- A regra feminina permite no máximo 1 ou 2 mulheres por time, conforme a configuração da lista.
- A ordem de chegada define os 12 participantes do primeiro sorteio, mas não a divisão entre os dois times.
- Jogadores que chegam após a formação inicial entram nos próximos times disponíveis.

## Resultado e rotação

- Apenas os dois primeiros times disputam a partida atual.
- Ao registrar um vencedor, todos os jogadores dos dois times contabilizam uma partida.
- Jogadores do vencedor contabilizam vitória e mantêm/incrementam a sequência.
- Jogadores do perdedor contabilizam derrota e têm a sequência zerada.
- O time perdedor sai da quadra e seus jogadores são redistribuídos na fila.
- Na redistribuição, levantador e mulher têm prioridade para preservar a composição; os demais jogadores são embaralhados antes da realocação.

## Regra “sai 2”

- Quando ativa, um time que vence duas partidas seguidas sai temporariamente para a posição **Volta**.
- Se já existe um time em **Volta**, ele retorna quando houver uma nova derrota em quadra.
- Ao retornar, o contador de vitórias do time é reiniciado.

## Operações administrativas

- Buscar e adicionar membro por nome na ordem de chegada.
- Adicionar jogador temporário (ghost), definindo sexo e se é levantador.
- Remover jogador.
- Alternar levantador e sexo.
- Trocar jogadores entre posições.
- Desfazer a última alteração estrutural.
- Encerrar a pelada e consolidar presença e resultados.
