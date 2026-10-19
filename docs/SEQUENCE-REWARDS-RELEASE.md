# Sequências: tabela e ajuste retroativo

Nova tabela por marco: 2=1c, 3=1c, 4=1c, 5=2c, 6=2c, 7=3c,
8=3c, 9=4c e 10=5c. Total de 22c numa sequência de dez.
Resgatar não reinicia a sequência. Perder não apaga prêmios conquistados.
Marcos antigos de 15/20 já conquistados continuam resgatáveis, mas não são
gerados para novas partidas. A diferença de preço do marco 10 é reconhecida.

## Prévia: somente leitura

```powershell
npm.cmd run missions:sequence -- --date=2026-10-18
```

Requer credencial de servidor em `.env.local`. Consulta uma única lista pela
data e estatísticas apenas dos participantes. Salva a prévia privada em
`.firebase/sequence-rewards/2026-10-18-preview.json`, ignorada pelo Git.
Não use o script antigo `firebase-maintenance.mjs` para esse ajuste.

Conferir `blocked` vazio, nomes, novos marcos, valores pendentes e diferenças.
O cálculo usa a ordem dos resultados e o snapshot anterior à primeira vitória;
não presume que recorde ou total de vitórias representam uma sequência.
Casos ambíguos bloqueiam a aplicação inteira.

## Aplicar: somente após aprovação explícita da prévia

Manter manutenção e impedir operações de jogo/resgate durante a transição.
Publicar o cliente compatível antes de reabrir o app. Não há deploy automático.

```powershell
npm.cmd run missions:sequence -- --apply --input=.firebase/sequence-rewards/2026-10-18-preview.json --project=parads-app-26f23 --approved-sha256=HASH_APROVADO
```

A transação confere o hash aprovado, recalcula os valores e confere versões
da lista e de cada estatística. Qualquer mudança exige uma nova prévia.
Reexecutar uma prévia já aplicada não paga nem adiciona marcos novamente.
Grava somente os marcos novos, identificação do ajuste e `updatedAt` nas
estatísticas. Não altera moedas, resgates existentes, contas, inventários,
resultados, sequência atual, recordes ou relatórios. Os jogadores resgatam
a diferença pelo fluxo normal do perfil.

## Contingência

Guardar a prévia aprovada e seu hash. Se houver divergência, não aplicar;
manter manutenção e revisar o caso. Não restaurar o cliente antigo após
novos resgates sem avaliar o controle de valores já pagos. Nenhum rollback
deve apagar moedas, resgates ou sobrescrever estatísticas em bloco.
