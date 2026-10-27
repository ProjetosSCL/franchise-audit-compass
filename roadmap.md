# Acesso do SCL Audit

## Importação mensal
- [ ] Implementar parsing seguro de CSV/XLSX, descarte de PII, seriais e realinhamento.
- [ ] Persistir arquivos tratados e registros atomicamente no Supabase existente.
- [ ] Implementar /importar com seleção múltipla, resultados e associação manual.
- [ ] Testar parsing, persistência e fluxo disponível; indicar limitações da validação autenticada.

- [x] Conferir layout e navegação das seis páginas conforme ESTRUTURA e PROCESSO.
- [x] Ajustar Painel com mês de referência, oito cards vazios e Importar mês.
- [ ] Validar navegação autenticada visualmente: depende de sessão disponível no Supabase externo; endereços e proteção verificados por testes.

- [x] Conferir docs/ESTRUTURA.md, seções 2 e 5.
- [x] Garantir buckets source-files e contestation-exports privados e acesso somente autenticado.
- [x] Verificar login por e-mail/senha e proteção das seis páginas do app.
- [x] Orientar criação manual das contas dos sócios.
- [ ] Desligar cadastro público: depende do usuário salvar Allow new users to sign up desativado no painel do Supabase externo; a conexão disponível não permite alterar essa configuração.
## Motor de auditoria e revisão

- [x] Motor puro em src/lib/audit/engine.ts (9 regras, resumos, prioridade) com testes em src/test/audit-engine.test.ts.
- [x] process-audit-period como server function (audit.functions.ts / audit.server.ts): grava achados, preserva revisões e atualiza totais do período.
- [x] Processamento automático após a importação quando as duas fontes existem.
- [x] Detalhe da franquia (achados, revisão Contestar/Aceito/Pendente, retenção, equipe, prazos) e Contestação com XLSX no navegador.
- [ ] Tendência (get_trend_series), exportação XLSX/PDF no bucket contestation-exports, tabela de preços e liga/desliga de regras em Configurações, ações de IA.
- [ ] Rodar npm i && npm test && npm run build (não executado no ambiente de geração) e validar o fluxo autenticado com um mês real.
