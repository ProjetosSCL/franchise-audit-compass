## 1. Requisitos de sistema

> Convenção de RFs inferida do PROCESSO/ESTRUTURA do SCL Audit:
> **RF-01** Autenticação restrita aos 4 sócios · **RF-02** Upload múltiplo e associação de arquivos à franquia · **RF-03** Descarte de PII (LGPD) no upload · **RF-04** Parsing CSV Latin-1 (`;`) e XLSX (4 abas) · **RF-05** Realinhamento de linhas "(Tratamento) Sem Retorno" · **RF-06** Validação do total (valor pago × Consolidado) · **RF-07** Cruzamento Chamado = OS · **RF-08** Execução das 9 regras de auditoria · **RF-09** Geração/revisão de achados (Contestar/Aceito/Pendente + observação) · **RF-10** Painel geral com cards por franquia · **RF-11** Detalhe da franquia (Resumo/Achados/Sem correspondência/Triagem/Bonificação) · **RF-12** Tendência mensal/consolidada com variações atípicas · **RF-13** Exportação XLSX + PDF de contestação por franquia · **RF-14** Configurações (equivalência de nomes, tabela de preços, liga/desliga de regras) · **RF-15** Apoio de IA sob demanda (explicar achado, sugerir contestação, detectar anomalias).

**RS-01:** o `/login` deve autenticar exclusivamente via Supabase Auth e-mail+senha, com signup público desligado; apenas as 4 contas de sócio criadas manualmente podem autenticar. Qualquer tentativa de acesso a rotas internas sem `auth.uid()` deve ser rejeitada e redirecionada para `/login`.
Rastreia: RF-01

**RS-02:** a Edge Function `ingest-month-files` deve aceitar upload de múltiplos arquivos numa única operação e, para cada um, detectar `file_kind` (`workinfinity_csv` | `stone_xlsx`) por estrutura/extensão, gravando `uploaded_files.file_kind` corretamente.
Rastreia: RF-02

**RS-03:** `ingest-month-files` deve extrair o nome do Prestador/Franquia do arquivo e resolver a franquia consultando `franchise_name_aliases.raw_name_normalized` (uppercase, sem espaços duplos). Quando não houver match, o arquivo deve ficar com `franchise_id = null` e ser listado na tela de associação manual, sem gerar achados.
Rastreia: RF-02

**RS-04:** `associate-file-franchise` deve persistir o novo mapeamento em `franchise_name_aliases` e reprocessar o arquivo pendente; o alias gravado deve passar a resolver automaticamente nos meses seguintes (testável: segundo upload do mesmo `raw_name` resolve sem intervenção).
Rastreia: RF-02

**RS-05:** no parsing do Workinfinity, `ingest-month-files` deve descartar as colunas de PII (CPF/CNPJ, telefone, endereço do cliente final) **antes de qualquer persistência**; nenhuma linha de `workinfinity_records` pode conter esses campos e o binário bruto com PII não pode ser mantido no Storage. `uploaded_files.dropped_pii_columns` deve ser gravado como `true`.
Rastreia: RF-03

**RS-06:** o parser de CSV deve ler o Workinfinity com encoding **Latin-1** e separador `;`, e limpar seriais no formato `="ABC123"` para `ABC123` (remoção de `=` e aspas) nos campos `serial_instalado`/`serial_retirado`.
Rastreia: RF-04

**RS-07:** o parser de XLSX deve ler as abas **Consolidado**, **Analítico da OS**, **Analítico Triagem** e **Bonificação**, populando respectivamente os totais em `audit_periods`, `stone_os_records`, `stone_triagem_records` e `stone_bonificacao_records` (campos `RV_*` variáveis em `rv_payload` jsonb).
Rastreia: RF-04

**RS-08:** para linhas com Status `(Tratamento) Sem Retorno` em que `Valor_pago` não é numérico, o sistema deve realinhar automaticamente (`valor_base_os ← Multa`; `valor_pago ← Em_auditoria`; `status_pagamento ← Valor_pago`; `multa ← 0`; `em_auditoria ← 0`), marcar `stone_os_records.was_realigned = true` e gravar a contagem em `audit_periods.realigned_rows_count`, exibindo-a ao sócio na tela `/importar`.
Rastreia: RF-05

**RS-09:** `process-audit-period` deve calcular `total_validation_diff = soma(valor_pago corrigido) − (consolidado_stone + consolidado_ton + consolidado_bobina)` e exibi-la como alerta quando diferente de zero.
Rastreia: RF-06

**RS-10:** o cruzamento deve comparar `workinfinity_records.chamado_key` = `stone_os_records.os_key` (ambos como texto sem espaços), de forma que divergências de formatação não quebrem o join.
Rastreia: RF-07

**RS-11:** `process-audit-period` deve executar somente as regras com `audit_rules.is_enabled = true`; desligar uma regra nas Configurações não deve afetar achados já gerados, apenas os de novos processamentos.
Rastreia: RF-08, RF-14

**RS-12:** a Regra 1 deve classificar OS presente só no Workinfinity como "Cancelado sem visita (ok)" quando `status=CANCELADA AND numero_visitas=0 AND tecnico IS NULL`; caso contrário gerar achado "Possível atendimento não apurado" com `severity='high'`.
Rastreia: RF-08

**RS-13:** a Regra 5 deve agrupar `stone_os_records` por (`stonecode`, `data_atendimento`) e sinalizar grupos com duas OS a 100%, com a OS de 100% não sendo a de maior `valor_base_os`, ou com 40% calculado incorretamente.
Rastreia: RF-08

**RS-14:** a Regra 7 deve inferir, via `infer-price-table`, a moda de `valor_base_os` por (`produto`,`grupo_servico`,`raio`) e sinalizar OS que destoem; valores com `price_table_entries.is_manual_override = true` nunca podem ser sobrescritos pela reinferência.
Rastreia: RF-08, RF-14

**RS-15:** a Regra 8 deve validar coerência entre `raio` e `distancia_km` (R1 ≤ ~17 km; R2 20–50; R3 52–84; R4 > 170) e sinalizar distâncias absurdas (> 1.000 km).
Rastreia: RF-08

**RS-16:** a Regra 9 deve esperar `valor_triagem = R$ 5` por serial com `status_triagem = GOOD` e conferir a soma contra `consolidado_triagem`, gerando achado na divergência.
Rastreia: RF-08

**RS-17:** cada achado em `audit_findings` deve permitir atualização de `review_status` ∈ {`contestar`,`aceito`,`pendente`} e `observation` por qualquer sócio autenticado, registrando `reviewed_by`/`reviewed_at`.
Rastreia: RF-09

**RS-18:** `get_dashboard_cards(p_reference_month)` deve retornar, por franquia, `total_valor_base`, `total_valor_pago`, `total_difference`, `open_findings_count` e `value_at_risk` do mês selecionado.
Rastreia: RF-10

**RS-19:** `get_findings` deve suportar filtros combináveis por regra, gravidade, status, técnico, cidade e serviço sobre um `audit_period_id`.
Rastreia: RF-11

**RS-20:** `get_trend_series` deve retornar séries mensais (% do valor base retido, valor em risco, qtd de OS, retenção por regra) por franquia e consolidadas, com flag de variação atípica entre meses.
Rastreia: RF-12

**RS-21:** `export-contestation` deve gerar, por franquia, um **XLSX** e um **PDF** contendo apenas achados com `review_status='contestar'` (OS, serviço, data, valor base, valor pago, diferença, motivo), salvá-los no bucket privado `contestation-exports` e retornar signed URLs.
Rastreia: RF-13

**RS-22:** as Configurações devem persistir edições em `franchise_name_aliases`, `price_table_entries` (`is_manual_override=true`) e `audit_rules.is_enabled`, todas restritas a usuário autenticado.
Rastreia: RF-14

**RS-23:** as funções `ai-explain-finding`, `ai-suggest-contestation` e `ai-detect-anomalies` devem ser acionadas **somente sob demanda**, chamar o modelo de IA server-side e registrar `model`, `input_tokens`, `output_tokens` e `cost_usd` em `ai_usage_log`; os resultados devem gravar `ai_explanation`/`ai_contestation_text` no achado.
Rastreia: RF-15

---

## 2. Arquitetura

O SCL Audit é um app web interno de 3 camadas. O parsing pesado e as 9 regras rodam em Edge Functions (Deno) com `service_role`, nunca no cliente — o frontend React apenas aciona, filtra e visualiza.

```
┌───────────────────────────────────────────────────────────────┐
│  FRONTEND (Lovable → React + TS + Tailwind + shadcn/ui)        │
│  /login /  /importar  /franquia/:id/:mes  /tendencia            │
│  /contestacao  /configuracoes      (Recharts p/ gráficos)      │
└───────────────┬───────────────────────────────┬───────────────┘
                │ Supabase JS (Auth + RPC)       │ invoke Edge Fn
                ▼                                 ▼
┌───────────────────────────────────────────────────────────────┐
│  SUPABASE (backend único)                                      │
│  • Auth e-mail/senha (signup off, 4 sócios)                    │
│  • Postgres + RLS (franchises, audit_periods, *_records,       │
│    audit_findings, audit_rules, price_table_entries, ai_log)   │
│  • RPCs: get_dashboard_cards / get_findings / get_trend_series │
│          / get_franchise_reconciliation / get_unmatched_os     │
│  • Edge Functions (service_role):                              │
│    ingest-month-files → process-audit-period → infer-price     │
│    associate-file-franchise · export-contestation              │
│    ai-explain-finding · ai-suggest-contestation · ai-detect    │
│    get-signed-upload-url / get-signed-download-url             │
│  • Storage (buckets privados): source-files, contestation-exports │
└───────────────┬───────────────────────────────────────────────┘
                │ HTTPS (chaves em env, server-side)
                ▼
┌───────────────────────────────────────────────────────────────┐
│  INTEGRAÇÃO EXTERNA                                            │
│  • API Anthropic — Claude Sonnet 4.6 (IA sob demanda)         │
└───────────────────────────────────────────────────────────────┘
```

Fluxo principal: o sócio sobe os arquivos em `/importar` → `ingest-month-files` descarta PII, parseia, realinha e grava os `*_records` + `audit_periods` → `process-audit-period` cruza as bases e gera `audit_findings` → o frontend lê via RPCs → o sócio revisa, aciona IA opcional e exporta a contestação. Não há cron, webhook nem Make: tudo é disparado pela ação manual de upload do sócio (confirmado nas respostas 4 e 5).

---

## 3. Stack tecnológica

**Backend — Supabase (não negociável):**
- **Postgres + RLS:** armazena franquias, aliases, períodos mensais, registros Workinfinity/Stone (sem PII), achados, regras, tabela de preços e log de IA. Histórico mantido indefinidamente para a Tendência.
- **Auth:** e-mail + senha, signup público desligado — os 4 sócios criados manualmente (resposta 1: "eu e mais 3 sócios"). Sem OAuth/magic link, pois o universo é fechado.
- **Storage:** buckets privados `source-files` e `contestation-exports`, acessados só via signed URLs.
- **Edge Functions (Deno):** parsing Latin-1/XLSX, realinhamento, 9 regras, inferência de preços, exportação e chamadas de IA — toda a lógica pesada server-side.
- **Realtime/Cron:** não utilizados — não há processamento automático nem recorrência (respostas 4 e 5).

**Frontend — Lovable + Supabase:**
Caminho escolhido pelo nível técnico: o grupo são **4 sócios-gestores sem time de TI dedicado** (resposta 1). O Lovable gera nativamente exatamente a stack descrita na ideia — **React + TypeScript + Tailwind + shadcn/ui + Recharts** — com integração nativa ao Supabase e deploy com preview, levando do zero ao app no ar pelo caminho mais rápido e mantível pelos próprios sócios. Todo o processamento complexo (encoding Latin-1, realinhamento de linhas, 9 regras, ~6 mil OS/mês) fica nas Edge Functions, mantendo o frontend gerado pelo Lovable simples e estável. Por isso não se justifica o caminho Claude Code, que exigiria time técnico para manter.

**Integração externa:** **Claude Sonnet 4.6 (Anthropic)** via Edge Functions — melhor equilíbrio qualidade/custo (~US$3/Mtok in, US$15/Mtok out) para redigir contestações formais à Stone e raciocinar sobre anomalias financeiras; uso sob demanda e logado (resposta 2: "QUERO SIM").

---

## 4. Segurança

**Autenticação:** Supabase Auth e-mail/senha, signup desligado; as 4 contas de sócio são provisionadas manualmente. Toda rota do frontend exige sessão ativa; sem sessão → `/login`.

**RLS por tabela (todas exigem `auth.uid() IS NOT NULL`; sem partição por franquia, pois os 4 sócios têm visão completa idêntica):**
- `franchises` — SELECT/UPDATE autenticado; INSERT/DELETE service_role.
- `franchise_name_aliases`, `audit_rules`, `price_table_entries` — SELECT/UPDATE autenticado; INSERT de seed/inferência via service_role.
- `audit_periods`, `uploaded_files` — SELECT autenticado; INSERT/UPDATE via service_role (ingestão); DELETE autenticado (reprocessar/apagar mês).
- `workinfinity_records`, `stone_os_records`, `stone_triagem_records`, `stone_bonificacao_records` — SELECT autenticado; escrita só via service_role (ingestão) e DELETE em cascade.
- `audit_findings` — SELECT autenticado; INSERT via service_role (geração); UPDATE autenticado (status/observação/campos de IA); DELETE service_role.
- `ai_usage_log` — SELECT autenticado; INSERT via service_role.

As Edge Functions de ingestão/geração usam a `service_role` (ignora RLS) para escrita em massa; o frontend nunca recebe a `service_role`.

**LGPD / dados sensíveis:** o relatório do Workinfinity contém CPF/CNPJ, telefone e endereço de clientes finais. A Edge Function `ingest-month-files` **descarta essas colunas antes de qualquer persistência** — elas jamais entram em `workinfinity_records`, jamais são exibidas, e o binário bruto com PII não é mantido no Storage (`dropped_pii_columns=true`). Guardam-se apenas as colunas necessárias à auditoria.

**Storage:** buckets `source-files` e `contestation-exports` privados; acesso só por signed URLs emitidas por `get-signed-upload-url`/`get-signed-download-url` a usuários autenticados.

**Segredos e API keys:** a chave da API Anthropic e a `service_role` ficam **exclusivamente em variáveis de ambiente das Edge Functions**, nunca no código do frontend nem versionadas. O frontend usa apenas a `anon key`. Toda chamada de IA é server-side.

---

## 5. Performance

**Carga/volume (ancorada nas respostas):** pico informado de **~6 mil OS somadas nas 8 franquias por mês** (resposta 3), ou seja ~750 OS por franquia/mês. O processamento é por unidade **franquia + mês**, então cada execução de `process-audit-period` lida com centenas (não milhares) de linhas — leve para uma Edge Function. O histórico é mantido indefinidamente para alimentar a Tendência, acumulando poucos milhares de linhas por mês (bem dentro do free/Pro tier do Supabase).

**Índices críticos:**
- `workinfinity_records(audit_period_id, chamado_key)` e `stone_os_records(audit_period_id, os_key)` — join do cruzamento (RS-10).
- `stone_os_records(stonecode, data_atendimento)` — agrupamento da Regra 5 (RS-13).
- `stone_os_records(raio)`, `(produto)` — Regras 7 e 8.
- `audit_findings(audit_period_id, review_status)`, `severity`, `tecnico`, `cidade`, `grupo_servico` — filtros da aba Achados (RS-19).
- `audit_periods(franchise_id, reference_month)` UNIQUE e `reference_month` — seletor de mês e cards (RS-18).

**Limites conhecidos e mitigação:**
- **Timeout de Edge Function (~60s) e payload:** o parsing de ~6 mil OS é dividido por arquivo/franquia na ingestão, nunca processado num único payload gigante; cada arquivo é tratado individualmente, mantendo o tempo por invocação baixo.
- **Parsing no cliente evitado:** encoding Latin-1, realinhamento e as 9 regras rodam nas Edge Functions, não no navegador, evitando travar o desktop do sócio.
- **Custo de IA controlado:** as três funções de IA são sob demanda (nunca em todo processamento) e cada chamada é registrada em `ai_usage_log` com tokens e `cost_usd`, permitindo acompanhamento de gasto (resposta 2).
- **Free tier do Supabase** (500 MB, 500K edge invocations) é suficiente para o volume descrito; a passagem para Pro (R$125/mês) só se justifica ao crescer o histórico ou o número de execuções mensais.