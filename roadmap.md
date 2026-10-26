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