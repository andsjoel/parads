# Etapa 1: testes isolados

Resultados abaixo são o registro da etapa 1. Na etapa 2, casos `KNOWN GAP` foram transformados em negativas esperadas e a matriz foi ampliada; ver [entrega da etapa 2](13-ADMISSION-SECURITY.md). O runner e as travas continuam obrigatórios.

Somente preparação local. Nenhuma mudança em regras de autorização ou código funcional do app. O `firebase.json` de produção, `firestore.rules`, inicializadores cliente/Admin e `.env` existentes não são modificados por esta etapa.

## Executar

Requisitos: Node 24.12+ (hooks síncronos de isolamento), dependências do lockfile e Java 21+ para o emulador Firestore. No PowerShell com política restrita, usar `npm.cmd` no lugar de `npm`.

```sh
npm ci --ignore-scripts
npm test
npm run test:emulators
```

`npm test` executa os testes de mocks existentes e os testes das travas de segurança, sem rede. `test:emulators` inicia Auth/Firestore, executa os testes de integração e encerra os serviços. Não há servidor de desenvolvimento, deploy, export/import de produção ou teste de carga nesses comandos.

O primeiro uso pode baixar o binário oficial do emulador. A instalação npm e o processo Firebase CLI são ferramentas de preparação, fora do bloqueio de rede do processo de testes; não executar esses comandos com credenciais de produção. A CLI recebe projeto demo explícito e diretório de configuração isolado. As chamadas feitas pelos testes Node, incluindo SDK/Admin e subprocessos Node que herdam o ambiente, recebem o bloqueio antes dos imports.

No ambiente desta entrega foi usado OpenJDK 21 portátil em `.test-tools/jdk-21...`, sem instalar no sistema. O runner detecta essa pasta, ou usa `JAVA_HOME`/Java do PATH. Esse download não é automático no runner. Java antigo faz o comando falhar antes de iniciar emuladores. Obter Java apenas de fonte oficial, por exemplo [Microsoft OpenJDK](https://learn.microsoft.com/java/openjdk/download).

## Travas

- Projeto único `demo-parads-security`, sem recursos reais. Não há `.firebaserc` apontando testes a produção.
- Configuração separada `firebase.emulators.json`; Auth `127.0.0.1:19099`, Firestore `127.0.0.1:18080`, hub `127.0.0.1:14400`. Escuta somente loopback, UI desativada.
- Rejeita credenciais Admin/ADC/tokens por variáveis, configuração Firebase real, projetos diferentes, endpoints inesperados e opções Node injetadas. Aceita somente o `FIREBASE_CONFIG` demo exato gerado pela CLI. Não lê `.env` nem apaga valores perigosos silenciosamente: aborta sem exibir seus conteúdos. Só repassa variáveis de plataforma necessárias aos subprocessos, sem segredos de outros serviços ou DEBUG herdado.
- Testes unitários sem rede; testes de integração somente nos endereços/portas fixos. Bloqueia fetch externo/redirecionamento, sockets TCP externos, TLS e transporte UDP. Import do inicializador cliente real e ferramenta antiga de limpeza bloqueado.
- `NODE_OPTIONS` com o preload fixo transmite a trava aos subprocessos Node. O runner rejeita opções extras de projeto, host ou comando.
- Antes de semear, verifica explicitamente os dois emuladores e os destinos. Admin SDK de fixtures usa certificado sintético efêmero gerado em memória, não registrado em projeto algum, sem ler certificados reais ou ADC. Os emuladores dispensam OAuth; a rede externa permanece bloqueada. Não há fallback para serviços reais.
- Dados e binários locais ficam em `.firebase/` e `.test-tools/`, ignorados pelo Git. Logs também ignorados. Fixtures são pequenas e sintéticas; não copiar backups ou exportações reais para os testes.

Essas travas evitam erros acidentais no caminho suportado; não são um sandbox do sistema operacional contra código malicioso que deliberadamente as remova, limpe o ambiente de subprocessos ou chame executáveis externos. Não usar `node --test` ou Vite como substituto do runner isolado. **O `npm run dev` normal continua conectado à configuração real existente e não é um ambiente de teste seguro.**

## Cobertura e significado

- Regressões existentes: convidados provisionados e ativação, preservação de UID/saldo/histórico, lista/solicitações, missões/compras em mocks, recuperação de senha em mocks, catálogo e manutenção.
- Integração: permissões de ADM/membro/convidado, negativa de leitura privada/elevação de papel, Auth com usuário sintético e entrega de alteração de partida por listener real do emulador.
- Fixtures incluem convite desabilitado, Auth sem convite e membro legado sem `account_security`, além do convidado ainda não ativado.
- Casos `KNOWN GAP` comprovam **permissões inseguras atuais**, não proteção concluída: listagem pública de convites/usernames, leitura por Auth sem vínculo e acesso com convite desabilitado. Eles passam ao reproduzir a baseline; na etapa 2 serão substituídos por negativas esperadas junto das mudanças de regras aprovadas.
- Emulador não calcula fatura, não reproduz WAF/cotas/latência de produção nem prova funcionamento visual em todos os celulares. O login por convite e a recuperação ponta a ponta precisarão de testes locais adicionais quando seus caminhos forem alterados.

## Aprovação e próximos passos

Registrar resultados desta execução abaixo. Nenhum resultado autoriza publicar regras. Parar ao concluir a etapa 1 e aguardar autorização para a etapa 2. Não usar o script antigo de limpeza como fixture, migração ou contingência.

## Resultado da execução local em 19/10/2026

| Verificação | Resultado |
|---|---|
| `npm.cmd test` | 61 testes aprovados, incluindo 9 testes de isolamento; sem rede externa |
| `npm.cmd run test:emulators` | 9 testes aprovados em Auth/Firestore; serviços encerrados automaticamente |
| Emuladores ausentes | Execução de integração recusada com `ECONNREFUSED`, antes de semear dados; sem fallback |
| Build Vite | Aprovado em `.firebase/build-check`, pasta local ignorada; primeira tentativa em `dist` encontrou `EPERM` ao copiar favicon |
| `npm.cmd run lint` | 27 erros e 1 aviso preexistentes em `example/adminScript.js`, `ConfirmDeleteModal.jsx` e `ProfileAchievements.jsx`; não corrigidos nesta etapa |
| Sintaxe Node | Arquivos de testes/runner verificados com `node --check` |
| Configurações funcionais | `firestore.rules`, `firebase.json` e inicializadores cliente/Admin preservados em conteúdo; diferenças de CRLF/LF normalizadas na comparação |
| Dependências | Somente ferramentas de desenvolvimento adicionadas: rules-unit-testing 5.0.2 e firebase-tools 15.34.0, fixadas no lockfile; versões de runtime preservadas |

O npm também atualizou duas dependências transitivas exclusivamente de desenvolvimento (`js-yaml` e `side-channel`); não houve atualização do SDK Firebase do app. Não foi iniciado o Vite contra produção para testar os fluxos. O build é compilação local, não teste visual ou validação completa em celulares.

Os avisos `PERMISSION_DENIED` nos testes de regras são esperados nos casos negativos; o encerramento do Java por SIGINT faz parte da parada normal dos emuladores. Testes `KNOWN GAP` verdes significam que a vulnerabilidade atual foi reproduzida, não corrigida. A etapa 2 não foi iniciada.

Arquivos desta etapa: `.gitignore`, `README.md`, `package.json`/lockfile, `firebase.emulators.json`, `scripts/test-isolated.mjs`, `tests/isolation.test.mjs`, `tests/support/*`, `tests/fixtures/*`, `tests/emulator/baseline.test.mjs`, documentos 10/11/12 e referências atualizadas nos documentos 01/04/06/09. Alterações anteriores de manutenção e seu teste foram preservadas, não produzidas por esta entrega.
