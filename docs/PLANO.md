## Visão geral do plano

Este é o plano de construção do **SCL Audit** — o app web onde você e os outros 3 sócios auditam a apuração que a Stone envia às 8 franquias de logística, cruzam com o relatório do Workinfinity e geram a lista de itens a contestar (com valor em R$). Construído no caminho **Lovable + Supabase** (React + Tailwind + shadcn/ui + Recharts no Lovable; parsing pesado, 9 regras e IA nas Edge Functions do Supabase).

O trabalho está dividido em **3 fases** em ordem de dependência: primeiro a fundação (banco, login dos 4 sócios, layout), depois a construção das funcionalidades reais (importar arquivos → cruzar bases → gerar 9 regras → revisar → tendência → contestação) e por fim o polimento e o lançamento.

---

## Fase 1 — Fundação

**Entregável:** projeto no ar com banco de dados completo, login por e-mail/senha dos 4 sócios e o esqueleto de navegação entre as telas.

**Tabelas/páginas/functions envolvidas:** todas as tabelas de `db/schemas.sql` (`franchises`, `franchise_name_aliases`, `audit_periods`, `uploaded_files`, `workinfinity_records`, `stone_os_records`, `stone_triagem_records`, `stone_bonificacao_records`, `audit_rules`, `audit_findings`, `price_table_entries`, `ai_usage_log`); buckets `source-files` e `contestation-exports`; páginas `/login`, `/` (Painel geral) e layout base com menu para `/importar`, `/franquia/:id/:month`, `/tendencia`, `/contestacao`, `/configuracoes`.

**Checklist:**
- [ ] Criar o projeto SCL Audit no Lovable conectado ao Supabase
- [ ] Rodar `db/schemas.sql` no Supabase (todas as tabelas, índices, RLS e seed das 9 regras + 8 franquias)
- [ ] Criar os buckets privados `source-files` e `contestation-exports`
- [ ] Configurar Supabase Auth por e-mail/senha com signup público desligado e criar os 4 sócios manualmente
- [ ] Montar o layout base (menu lateral/topo) com rotas das 6 telas e `/login`
- [ ] Deixar o Painel geral (`/`) com seletor de mês e grid de cards vazio pronto para receber dados

---

## Fase 2 — Construção

**Entregável:** fluxo completo funcionando — importar os arquivos do mês, cruzar as bases, aplicar as 9 regras, revisar achados por franquia, ver tendências e exportar a contestação.

**Tabelas/páginas/functions envolvidas:** Edge Functions `ingest-month-files`, `process-audit-period`, `infer-price-table`, `associate-file-franchise`, `ai-explain-finding`, `ai-suggest-contestation`, `ai-detect-anomalies`, `export-contestation`, `get-signed-upload-url`/`get-signed-download-url`; RPCs `get_dashboard_cards`, `get_franchise_reconciliation`, `get_findings`, `get_trend_series`, `get_unmatched_os`; páginas `/importar`, `/` (cards com dados), `/franquia/:id/:month`, `/tendencia`, `/contestacao`, `/configuracoes`.

**Checklist:**
- [ ] Construir `ingest-month-files`: upload múltiplo, descarte de PII, parse CSV Latin-1 + XLSX, realinhamento das linhas "Sem Retorno", associação por nome de franquia e tela `/importar`
- [ ] Construir `process-audit-period` com as 9 regras de auditoria + validação do total e gravação de `audit_findings`
- [ ] Ligar o Painel geral e o Detalhe da franquia (abas Resumo, Achados, OS sem correspondência, Triagem, Bonificação) às RPCs e permitir marcar Contestar/Aceito/Pendente
- [ ] Implementar a tela de Tendência com gráficos Recharts e detecção de variações atípicas
- [ ] Implementar a Contestação (`export-contestation` → XLSX + PDF por franquia) e as Configurações (equivalências, tabela de preços, liga/desliga das regras)
- [ ] Adicionar as ações de IA sob demanda (explicar achado, sugerir contestação, detectar anomalias) com log de uso

---

## Fase 3 — Polimento e lançamento

**Entregável:** app robusto e pronto para uso real — estados de vazio/erro/carregando, feedback claro em cada etapa, responsividade desktop e deploy final.

**Tabelas/páginas/functions envolvidas:** todas as páginas e functions das fases anteriores; foco em UX, mensagens de erro de parsing, controle de custo de IA (`ai_usage_log`) e publicação.

**Checklist:**
- [ ] Adicionar estados de carregando/vazio/erro em todas as telas (upload, processamento, achados, tendência)
- [ ] Deixar mensagens claras de avisos de consistência (linhas realinhadas, diferença de validação do total, arquivos não reconhecidos)
- [ ] Ajustar responsividade e usabilidade para navegador desktop (tabelas filtráveis, grids de cards, gráficos)
- [ ] Testar o fluxo completo com um mês real de ~6 mil OS e validar performance do processamento
- [ ] Publicar o app, confirmar os 4 logins e revisar as RLS (só autenticado acessa)
