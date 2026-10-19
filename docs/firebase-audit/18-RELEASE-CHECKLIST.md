# Versão candidata: publicação e rollback

Implementação local concluída em 19/10/2026. **Nada publicado ou alterado em produção nesta fase.** Esta é a referência vigente para a flag do gateway; substitui o padrão anterior descrito nas etapas 2/4 e na inspeção histórica.

## Fechamento técnico

- Gateway integrado aos serviços reais do frontend para convite, código, username, autorização e alias de login. Nenhum fallback para leitura anônima do Firestore.
- `PARADS_ACCESS_GATEWAY_ENABLED` ausente: login disponível pelo backend limitado; primeiro acesso permanece suspenso com mensagem apropriada. `true`: permite também onboarding. `false` ou valor inválido: gateway fechado. Pausa geral e suspensões específicas continuam respeitadas.
- A versão atualmente publicada não foi modificada. A ausência da variável não faz o candidato retornar às permissões antigas; um cliente novo sem flag mantém login, mas não conclui novos cadastros.
- Vite carrega variáveis locais `PARADS_*` e `FIREBASE_ADMIN_*` exclusivamente no servidor, sem prefixo `VITE_`. `.env.example` contém apenas nomes, comentários e placeholders.
- Bootstrap de sessão deduplicado, protegido contra respostas tardias/logout/troca de conta; cache acompanha stats, moedas/inventário retornados pelas operações e segurança. ADM legado não tenta mais reescrever papel protegido ao entrar.
- Ativação do convidado estabelece a senha escolhida antes de consumir o convite. Provisionamento pelo ADM tenta reconciliar gravação com resposta perdida e não apaga o UID por presumir falha. Se tanto gravação quanto conferência forem indeterminadas, o erro é mantido sem exclusão automática; revisar um eventual órfão sob autorização, não apagar em massa.
- Perfis/minicards reutilizados entre atualizações de resultados; carta completa atualiza ao abrir. Listeners necessários mantidos, sem polling novo.
- Regras candidatas e proteção/limitação das duas APIs preservadas; nenhum campo de saldo/estatística/histórico foi migrado ou reescrito.

## Validação local

- `npm.cmd test`: 98 testes unitários aprovados.
- `npm.cmd run test:emulators`: 33 testes aprovados no projeto demo. Novos cenários chamam os serviços frontend reais, o handler e os SDKs emulados, incluindo login sem flag e cadastro antes/depois da substituição local de regras.
- Testes mantêm bloqueio de rede externa e credenciais reais; nenhuma operação de produção usada como teste nesta fase.
- ESLint dos arquivos funcionais alterados aprovado. Pastas de builds/emuladores foram excluídas do lint, sem alterar código gerado.
- Build normal de produção aprovado em `.firebase/build-check`; build adicional das rotas completas aprovado em `.firebase/release-build-check`, sobrescrevendo `import.meta.env.DEV` somente nessa compilação descartável. Não alterou a flag real de manutenção nem serviu o app contra produção. O bundle completo ainda emite aviso de chunk maior que 500 kB, sem falha de compilação; divisão de chunks/mídias não foi misturada à correção de segurança.
- Lint global ainda tem 27 erros e 1 aviso anteriores em `example/adminScript.js`, `ConfirmDeleteModal.jsx` e `ProfileAchievements.jsx`; não foram ocultados por desabilitação global de regras ou refatorados nesta fase. Não são falhas da suíte de integração, mas devem ser considerados se o pipeline exigir lint global verde.
- Sem teste visual autenticado em produção; disponibilidade efetiva das credenciais no deployment permanece validação de implantação. Não há garantia de teto financeiro Blaze.

## Publicar, somente após autorização

1. Revisar/stagear somente os arquivos candidatos e identificar o commit final. Não enviar `.env`, `.firebase`, `.test-tools`, credenciais, scripts temporários ou o arquivo timestamp anterior do Vite. Push para `main` pode disparar Vercel: também exige autorização.
2. Preservar o deployment anterior validado e o ruleset publicado identificado na inspeção. Manter manutenção enquanto ocorre a troca. O código atual mantém manutenção em build de produção; a liberação visual deve ser autorizada explicitamente, não esquecida como último passo.
3. Publicar APIs + frontend compatíveis no mesmo deployment, com as três credenciais existentes em Production. Habilitar `PARADS_ACCESS_GATEWAY_ENABLED=true` somente sob autorização; sem ela o login continua disponível no candidato, mas novos cadastros ficam suspensos. Não é necessário cadastrar flags de suspensão com valor falso.
4. Conferir status/commit/runtime, métodos das APIs e variáveis em execução sem expor seus valores. Validar fluxos em conta designada, com escopo autorizado, nunca redefinindo senha de jogador real só para testar.
5. Publicar as regras candidatas depois de confirmar backend/cliente/flag. A transição foi testada em emulador com as regras antigas e novas. Solicitar atualização das abas antigas, que não possuem o novo contrato de cadastro.
6. Validar membro, convidado e ADM, negar acesso externo e acompanhar a pelada. Liberar manutenção por alteração/deployment aprovados. WAF, se desejado, continua configuração separada a autorizar; não é dependência paga do código.

## Rollback

- Preferir suspender somente cadastro ou recuperação pelas flags, preservando sessões/jogo. Pausa de ambas pode impedir novos logins. Flags só afetam deployments que receberam a configuração.
- Restaurar deployment compatível conhecido se houver regressão, mantendo os contratos de API/regras. O frontend antigo depende de consultas anônimas e pode não ser compatível com regras novas: não reabrir permissões públicas automaticamente.
- Se não houver combinação segura imediata, manter manutenção e APIs suspensas conforme autorização. Não apagar contas, convites, `account_security`, moedas ou históricos para recuperar a interface.
- Nenhuma restauração de dados ou migração destrutiva é necessária para reverter este patch. Conferir métricas após propagação; alertas não são corte de cobrança.
