# Recuperação de senha pelo administrador

O botão **redefinir senha** aparece nos convites cadastrados. O servidor gera uma
senha temporária de oito números, invalida as sessões anteriores e exige a troca
antes de liberar os dados normais do aplicativo. O UID, o histórico, as moedas e
o inventário são preservados. Para redefinir a própria senha, um admin precisa
pedir a outro admin.

## Configuração na Vercel

1. No Firebase Console do projeto `parads-app-26f23`, abra **Configurações do
   projeto > Contas de serviço > Firebase Admin SDK > Gerar nova chave privada**.
2. Em **Vercel > projeto > Settings > Environment Variables**, adicione estas
   variáveis para o ambiente de produção usando os valores do JSON baixado:

   | Variável | Campo do JSON |
   | --- | --- |
   | `FIREBASE_ADMIN_PROJECT_ID` | `project_id` |
   | `FIREBASE_ADMIN_CLIENT_EMAIL` | `client_email` |
   | `FIREBASE_ADMIN_PRIVATE_KEY` | `private_key` |

3. A chave privada deve conter os marcadores `BEGIN PRIVATE KEY` e
   `END PRIVATE KEY`, com as quebras de linha. O servidor aceita também `\n`
   literais. Não use prefixo `VITE_`, não envie a chave pelo chat e não coloque
   o JSON no Git. Mantenha o arquivo baixado fora do repositório.
4. Publique a versão do app contendo a API e faça um novo deploy após definir
   as variáveis.
5. As regras de `firestore.rules` precisam estar publicadas antes de testar.

Sem essas variáveis, a API retorna uma mensagem de configuração pendente e não
altera senhas. Para desenvolvimento local, use as mesmas variáveis em
`.env.local`, ignorado pelo Git, e reinicie o Vite. O middleware local atende
`/api/password-recovery`; no deploy, esse caminho é uma Vercel Function.

## Fluxo e armazenamento

- Somente um admin autenticado, com sessão válida e cargo verificado no
  Firestore, pode redefinir a senha de uma conta vinculada a convite cadastrado.
- Há confirmação, bloqueio de requisições simultâneas e intervalo de um minuto
  entre redefinições da mesma conta.
- A senha temporária aparece apenas na resposta ao admin e não é persistida
  em texto puro. O hash temporário fica em `password_reset_audit`, sem acesso
  pelo SDK cliente, e é removido ao concluir.
- `account_security` controla a troca obrigatória e o instante mínimo de
  autenticação. Apenas o backend escreve nessa coleção.
- O login com senha temporária leva a `/change-password`. A pessoa escolhe oito
  números diferentes da senha temporária, confirma e entra novamente.
- `password_reset_audit` registra o admin responsável, a conta e o resultado.
- Regras do Firestore negam acesso normal durante a troca e a sessões anteriores
  à redefinição, inclusive após a troca ser concluída.
- As regras também impedem que alguém altere seu próprio cargo para admin ou
  crie uma conta com cargo diferente daquele definido no convite.

## Verificação

O backend fixa `firebase-admin` em `13.6.0` para evitar a cadeia
`jwks-rsa@4` / `jose@6`, que falhou na inicialização da função na Vercel com
`ERR_REQUIRE_ESM`. O teste de inicialização desabilita `require(ESM)` para
reproduzir essa restrição sem acessar contas reais.

```sh
node --test tests/passwordRecovery.test.mjs
```

Após configurar a Vercel, teste com uma conta controlada: confirme que a senha
antiga deixa de funcionar, a temporária abre somente a troca, a nova permite
entrar normalmente e o histórico permanece. Não use uma conta real de membro
para esse teste sem combinar previamente com a pessoa.
