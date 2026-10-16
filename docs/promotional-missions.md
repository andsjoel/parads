# Missões especiais de personalização

Quatro missões permanentes nesta primeira campanha, com 1c por missão e um único
resgate por conta (máximo de 4c): comprar uma pic normal, comprar uma capa normal,
alterar o nome de exibição e personalizar a mensagem do status. Itens de outras
raridades e os assets padrão gratuitos não contam como compra normal.

## Compatibilidade e retroatividade

- Não há migração, reset ou crédito automático de moedas na abertura do perfil.
- Contas antigas qualificam pelas pics/capas normais do inventário, por um nome
  de exibição diferente do nome completo e por um status preenchido.
- Não existe histórico suficiente para recuperar uma alteração de nome/status
  antiga que já tenha sido desfeita antes desta versão.
- Novas compras e personalizações salvam indicadores em `users.promotionalProgress`.
  Esses indicadores preservam a conclusão se a personalização for desfeita depois.
- Cada resgate grava seu ID em `user_stats.claimedPromotionalMissionIds`, separado
  das missões esportivas. Ausência desses campos é tratada como estado inicial.
- Os IDs da campanha não devem ser reutilizados para uma campanha futura.

## Operação

O resgate lê usuário, inventário e estatísticas em uma transação, verifica o
objetivo e o resgate anterior, soma apenas 1c e atualiza o saldo público. A UI
atualiza o saldo imediatamente e mantém os alertas das outras missões disponíveis.
O resgate segue o modelo de transações do cliente já utilizado no app; não
substitui um futuro endurecimento das permissões e da validação no servidor.

Não são necessárias novas variáveis de ambiente ou alterações nas rules atuais.
O rollback do código não exige apagar os novos campos: versões anteriores ignoram
os indicadores e os IDs promocionais, que devem permanecer para evitar novos
créditos quando a campanha for reativada.

## Testes

```sh
node --experimental-vm-modules --test tests/promotionalMissions.test.mjs
```

Os testes usam apenas dados simulados. Validam retroatividade, exclusão de outras
raridades, duplicação de resgate, saldo público, preservação de estatísticas e
conclusão persistente após reverter nome/status.
