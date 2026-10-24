# docs/FUNCTIONS.md — SCL Audit

Documentação canônica de todas as functions/endpoints do backend **Supabase** do SCL Audit. O backend é 100% Supabase (PostgreSQL + Auth e-mail/senha + Storage + Edge Functions em Deno). **Não há Make, cron jobs nem webhooks neste projeto** — todo processamento é disparado pela ação de upload do sócio no navegador. O universo de usuários é fechado: **4 sócios com visão completa idêntica das 8 franquias**.

> Convenções:
> - Edge Functions em **kebab-case** (Deno).
> - Postgres Functions/RPCs em **snake_case**.
> - Toda chamada de IA usa **Claude Sonnet 4.6 (Anthropic)**, sob demanda, logada em `ai_usage_log`.
> - Autenticação padrão = **usuário logado** (um dos 4 sócios). As Edge Functions de escrita em massa usam a `service_role` internamente (ignora RLS), mas **exigem JWT válido de sócio na borda**.
> - Como os 4 sócios têm o mesmo nível, não existe um perfil "admin" distinto; "admin" abaixo significa apenas "sócio autenticado".

---

## Edge Functions

### `ingest-month-files`
**Propósito:** Receber o upload múltiplo de arquivos do mês, identificar a franquia de cada um, descartar PII, parsear/realinhar os dados e persistir os registros criando/atualizando os períodos de auditoria.

**Autenticação:** Usuário logado (sócio). Internamente usa `service_role` para gravar em `uploaded_files`, `*_records` e `audit_periods`.

**Input (body JSON):**
```json
{
  "reference_month": "2024-05-01",
  "files": [
    { "storage_path": "source-files/<uuid>.csv",  "original_filename": "workinfinity_patos.csv",  "file_kind": "workinfinity_csv" },
    { "storage_path": "source-files/<uuid>.xlsx", "original_filename": "apuracao_patos.xlsx",     "file_kind": "stone_xlsx" }
  ]
}
```
> Os binários já foram enviados ao bucket `source-files` via `get-signed-upload-url`. `file_kind` pode vir nulo e ser autodetectado pela extensão/estrutura.

**Output (JSON):**
```json
{
  "results": [
    {
      "franchise_id": "uuid|null",
      "detected_raw_name": "PB - PATOS FRANQUIA",
      "matched": true,
      "audit_period_id": "uuid|null",
      "file_kind": "stone_xlsx",
      "row_count": 812,
      "realigned_rows_count": 7,
      "total_validation_diff": 0.00,
      "needs_manual_association": false
    }
  ],
  "unmatched_files": [ { "uploaded_file_id": "uuid", "detected_raw_name": "XX - NOVO" } ]
}
```

**Regras de negócio / validações:**
- Detecta `file_kind` (`workinfinity_csv` | `stone_xlsx`) por extensão/estrutura quando não informado.
- Extrai o nome do Prestador/Franquia do conteúdo → grava em `uploaded_files.detected_raw_name`.
- Resolve a franquia via `franchise_name_aliases` usando `raw_name_normalized` (maiúsculas, sem espaços duplos) para match tolerante. Se não encontrar, grava o arquivo com `franchise_id = null` e marca `needs_manual_association = true` (tela de associação manual).
- **LGPD:** descarta as colunas de PII do Workinfinity (CPF/CNPJ, telefone, endereço) **antes de qualquer persistência**; regrava o CSV sem PII ou descarta o original; seta `uploaded_files.dropped_pii_columns = true`. PII nunca é armazenada nem retornada.
- Parsing CSV: encoding **Latin-1**, separador `;`, ~74 colunas (só as colunas usadas são mantidas).
- Parsing XLSX (SheetJS): abas `Consolidado`, `Analítico da OS`, `Analítico Triagem`, `Bonificação`.
- Limpeza de seriais: `="ABC123"` → `ABC123` (remove `=` e aspas) em `serial_instalado`/`serial_retirado`.
- **Realinhamento das linhas deslocadas** de `(Tratamento) Sem Retorno`: detecta linhas onde `Valor_pago` não é numérico e aplica `valor_base_os ← Multa`, `valor_pago ← Em_auditoria`, `status_pagamento ← Valor_pago`, `multa ← 0`, `em_auditoria ← 0`, marcando `was_realigned = true`. Conta as correções em `audit_periods.realigned_rows_count`.
- **Validação de total:** soma de `valor_pago` (pós-correção) vs `consolidado_stone + consolidado_ton + consolidado_bobina` → grava `total_validation_diff` (exibido como aviso).
- Chave de cruzamento preparada: grava `chamado_key` / `os_key` (texto sem espaços).
- Idempotência por (`franchise_id`, `reference_month`): reprocessar substitui registros do período (CASCADE nas `*_records`).
- Ao final, dispara `process-audit-period` para cada período que ficou completo (2 arquivos presentes) e `infer-price-table`.

---

### `process-audit-period`
**Propósito:** Cruzar as duas bases de um período, executar as 9 regras habilitadas e gerar/recalcular os achados e totais do período.

**Autenticação:** Usuário logado (sócio) ou chamada interna pós-ingestão. Usa `service_role` para gravar `audit_findings` e atualizar `audit_periods`.

**Input (body JSON):**
```json
{ "audit_period_id": "uuid", "regenerate": true }
```

**Output (JSON):**
```json
{
  "audit_period_id": "uuid",
  "status": "processed",
  "findings_created": 134,
  "open_findings_count": 134,
  "value_at_risk": 18420.50,
  "total_valor_base": 92000.00,
  "total_valor_pago": 73579.50,
  "total_difference": 18420.50,
  "total_validation_diff": 0.00
}
```

**Regras de negócio / validações:**
- Revalida o total (soma `valor_pago` vs Stone+Ton+Bobina) → `total_validation_diff`.
- Cruza `workinfinity_records.chamado_key = stone_os_records.os_key` (texto sem espaços).
- Executa **apenas as regras com `audit_rules.is_enabled = true`**:
  - **R1 só no Workinfinity:** `CANCELADA` + `numero_visitas=0` + sem técnico → "Cancelado sem visita (ok)" (`info`); caso contrário "Possível atendimento não apurado" (`high`).
  - **R2 só na apuração:** sempre gera alerta.
  - **R3 divergências:** status entre bases (ex.: `CANCELADA` × "Sem Retorno") e número de visitas.
  - **R4 decomposição base × pago:** regra de 40%, baixa tardia (pago zero), multas, outros.
  - **R5 regra de visita:** grupo por (`stonecode`, `data_atendimento`); exatamente 1 OS a 100% e deve ser a de maior `valor_base_os`, demais a 40%; sinaliza duas a 100%, 100% fora da maior, 40% errado.
  - **R6 anomalias de valor:** `valor_pago` negativo, `multa > valor_base_os`, `valor_base_os=0` em BAIXADA/CANCELADA com visita, multa com Abono.
  - **R7 tabela de preços:** compara `valor_base_os` com `price_table_entries` (moda por produto+serviço+raio) e sinaliza desvios.
  - **R8 raio × distância:** coerência R1 (~≤17km), R2 (20–50), R3 (52–84), R4 (>170); sinaliza distâncias absurdas (>1.000 km).
  - **R9 triagem:** `valor_triagem` esperado R$5 por equipamento `GOOD`; confere soma contra coluna Triagem do Consolidado.
- Cada achado grava OS, valores, `diferenca`, `severity`, `title`, `detail`, `rule_id`, `franchise_id`.
- Em `regenerate=true`, apaga achados anteriores do período **preservando** campos de revisão humana reaproveitáveis quando a OS persiste (status/observação não são sobrescritos silenciosamente — findings previamente revisados e ainda válidos são reconciliados).
- Recalcula `open_findings_count` (findings `pendente`) e `value_at_risk` (soma das diferenças dos achados `pendente`/`contestar`) e demais totais; seta `status = processed` (ou `error`).

---

### `infer-price-table`
**Propósito:** Calcular a tabela de preços inferida (moda do valor base por produto+serviço+raio) sobre todo o histórico e popular `price_table_entries` sem sobrescrever edições manuais.

**Autenticação:** Usuário logado (sócio) ou chamada interna pós-ingestão. Usa `service_role`.

**Input (body JSON):**
```json
{ "scope": "all" }
```

**Output (JSON):**
```json
{ "entries_upserted": 48, "entries_skipped_manual": 6 }
```

**Regras de negócio / validações:**
- Calcula a **moda** de `stone_os_records.valor_base_os` agrupada por (`produto`, `grupo_servico`, `raio`) sobre **todos os períodos**.
- Upsert em `price_table_entries` pela UNIQUE (`produto`,`grupo_servico`,`raio`).
- **Nunca sobrescreve** linhas com `is_manual_override = true` (edição do sócio prevalece).
- Chamada após ingestão e sob demanda nas Configurações.

---

### `associate-file-franchise`
**Propósito:** Registrar manualmente a equivalência de um nome não reconhecido a uma franquia e reprocessar o arquivo pendente.

**Autenticação:** Usuário logado (sócio).

**Input (body JSON):**
```json
{ "uploaded_file_id": "uuid", "franchise_id": "uuid", "raw_name": "PB - PATOS FRANQUIA" }
```

**Output (JSON):**
```json
{ "alias_id": "uuid", "franchise_id": "uuid", "reprocessed": true, "audit_period_id": "uuid" }
```

**Regras de negócio / validações:**
- Normaliza `raw_name` → `raw_name_normalized` (maiúsculas, sem espaços duplos).
- Insere em `franchise_name_aliases` respeitando UNIQUE(`raw_name_normalized`) (evita alias duplicado); grava `created_by = auth.uid()`.
- Atualiza `uploaded_files.franchise_id` do arquivo pendente e **reprocessa** a ingestão daquele arquivo, criando/atualizando o `audit_period`.
- A associação fica salva e é reutilizada automaticamente nos próximos meses.

---

### `ai-explain-finding`
**Propósito:** Gerar, sob demanda, uma explicação em linguagem natural de um achado (por que a OS está sendo contestada e o impacto financeiro).

**Autenticação:** Usuário logado (sócio).

**Input (body JSON):**
```json
{ "finding_id": "uuid" }
```

**Output (JSON):**
```json
{ "finding_id": "uuid", "ai_explanation": "texto...", "model": "claude-sonnet-4.6", "cost_usd": 0.0032 }
```

**Regras de negócio / validações:**
- Monta prompt com o contexto do achado: regra aplicada, OS, valores (base/pago/diferença), status nas duas bases.
- Chama **Claude Sonnet 4.6** (chave protegida na Edge Function, nunca no frontend).
- Grava o resultado em `audit_findings.ai_explanation`.
- Registra a chamada em `ai_usage_log` (`action = explain_finding`, modelo, tokens, `cost_usd`, `requested_by`).
- Uso estritamente **sob demanda** (controle de custo) — nunca automático no processamento.

---

### `ai-suggest-contestation`
**Propósito:** Gerar, sob demanda, um texto de contestação formal para a Stone a partir de um achado marcado "Contestar".

**Autenticação:** Usuário logado (sócio).

**Input (body JSON):**
```json
{ "finding_id": "uuid" }
```

**Output (JSON):**
```json
{ "finding_id": "uuid", "ai_contestation_text": "texto...", "model": "claude-sonnet-4.6", "cost_usd": 0.0048 }
```

**Regras de negócio / validações:**
- Idealmente aplicável a achados com `review_status = 'contestar'` (pode ser gerado antes para apoiar a decisão).
- Redige texto formal pronto para anexar à contestação, com OS, serviço, data, valores e motivo.
- Grava em `audit_findings.ai_contestation_text`.
- Registra em `ai_usage_log` (`action = suggest_contestation`).

---

### `ai-detect-anomalies`
**Propósito:** Pedir à IA que aponte padrões/anomalias fora das 9 regras, a partir de estatísticas agregadas do período.

**Autenticação:** Usuário logado (sócio).

**Input (body JSON):**
```json
{ "audit_period_id": "uuid" }
```

**Output (JSON):**
```json
{
  "audit_period_id": "uuid",
  "findings_created": 3,
  "model": "claude-sonnet-4.6",
  "cost_usd": 0.0121
}
```

**Regras de negócio / validações:**
- Envia à IA **apenas estatísticas agregadas** (sem PII) do período: distribuições de valores, concentração por técnico/cidade/serviço, outliers de distância, etc.
- Retorna achados de severidade `info`, gravados em `audit_findings` com `rule_id` reservado para anomalias de IA (sinalizados como originados por IA no `detail`).
- Registra em `ai_usage_log` (`action = detect_anomalies`).
- Sob demanda, acionado no Detalhe/Painel.

---

### `export-contestation`
**Propósito:** Gerar o XLSX e o PDF de contestação por franquia com os achados "Contestar", salvar no bucket e retornar URLs assinadas.

**Autenticação:** Usuário logado (sócio).

**Input (body JSON):**
```json
{ "audit_period_id": "uuid" }
```
> Opcionalmente aceita `franchise_id` + `reference_month` em vez do `audit_period_id`.

**Output (JSON):**
```json
{
  "xlsx_signed_url": "https://.../contestation-exports/....xlsx?token=...",
  "pdf_signed_url": "https://.../contestation-exports/....pdf?token=...",
  "findings_count": 42
}
```

**Regras de negócio / validações:**
- Inclui **somente** achados com `review_status = 'contestar'`, **agrupados por franquia**.
- Colunas do relatório: OS, serviço, data, valor base, valor pago, diferença, motivo.
- Gera **XLSX** e **PDF**, salva em `contestation-exports` (bucket privado) e devolve **signed URLs**.
- Envio à Stone é manual (fora do app) — o SCL Audit só gera os arquivos.

---

### `get-signed-upload-url`
**Propósito:** Emitir URL assinada para upload direto ao bucket privado `source-files`.

**Autenticação:** Usuário logado (sócio).

**Input (body JSON):**
```json
{ "original_filename": "apuracao_patos.xlsx", "file_kind": "stone_xlsx", "reference_month": "2024-05-01" }
```

**Output (JSON):**
```json
{ "storage_path": "source-files/<uuid>.xlsx", "signed_url": "https://...", "expires_in": 3600 }
```

**Regras de negócio / validações:**
- Gera `storage_path` único no bucket privado `source-files`.
- URL assinada de curta duração; bucket não público.
- Valida extensão/`file_kind` permitidos (CSV/XLSX).

---

### `get-signed-download-url`
**Propósito:** Emitir URL assinada para download de arquivos privados (origem ou exports de contestação).

**Autenticação:** Usuário logado (sócio).

**Input (body JSON):**
```json
{ "bucket": "contestation-exports", "storage_path": "contestation-exports/....pdf" }
```

**Output (JSON):**
```json
{ "signed_url": "https://...", "expires_in": 3600 }
```

**Regras de negócio / validações:**
- Restringe aos buckets `source-files` e `contestation-exports`.
- URL assinada de curta duração; só usuários autenticados.

---

## Postgres Functions (RPC/triggers)

> As RPCs abaixo são chamáveis pelo client (PostgREST) e respeitam RLS (`auth.uid() IS NOT NULL`). Como os 4 sócios têm visão completa, não há filtro por franquia na RLS — todas retornam dados das 8 franquias.

### `get_dashboard_cards(p_reference_month date)`
- **Tipo:** RPC chamável pelo client (`SECURITY INVOKER`).
- **Propósito:** Alimentar o Painel geral com um card por franquia do mês selecionado.
- **Input:** `p_reference_month date` (dia 01 do mês).
- **Output (SETOF):** por franquia → `franchise_id`, `display_name`, `audit_period_id`, `status`, `total_valor_base`, `total_valor_pago`, `total_difference`, `open_findings_count`, `value_at_risk`, `total_validation_diff`.
- **Regras:** inclui as 8 franquias ativas mesmo sem período processado (campos nulos/zero quando não houve upload). Usa índice (`franchise_id`,`reference_month`) de `audit_periods`.
- **Dispara quando:** carregamento do Painel geral e troca do seletor de mês (HTTP via RPC).

### `get_franchise_reconciliation(p_audit_period_id uuid)`
- **Tipo:** RPC chamável pelo client.
- **Propósito:** Resumo base × pago da aba Resumo do Detalhe da franquia.
- **Input:** `p_audit_period_id uuid`.
- **Output:** `total_valor_base`, `total_valor_pago`, `total_difference`, `total_validation_diff`, `consolidado_stone`, `consolidado_ton`, `consolidado_bobina`, `consolidado_triagem`, `consolidado_total`, `realigned_rows_count`.
- **Regras:** retorna a reconciliação e a diferença de validação do Consolidado (aviso de consistência). Só sócio autenticado.
- **Dispara quando:** abertura da aba Resumo (HTTP via RPC).

### `get_findings(p_audit_period_id uuid, p_rule_id smallint, p_severity text, p_review_status text, p_tecnico text, p_cidade text, p_grupo_servico text)`
- **Tipo:** RPC chamável pelo client.
- **Propósito:** Listar achados filtráveis da aba Achados.
- **Input:** `p_audit_period_id` (obrigatório) + filtros opcionais (nulos = sem filtro): `p_rule_id`, `p_severity`, `p_review_status`, `p_tecnico`, `p_cidade`, `p_grupo_servico`.
- **Output (SETOF):** colunas de `audit_findings` (OS, stonecode, grupo_servico, tecnico, cidade, data_atendimento, valor_base_os, valor_pago, diferenca, severity, title, detail, review_status, observation, ai_explanation, ai_contestation_text) + `rule_key`/`name` da regra.
- **Regras:** aplica filtros por regra, gravidade, status, técnico, cidade e serviço, usando os índices correspondentes de `audit_findings`. Só sócio autenticado.
- **Dispara quando:** aba Achados e cada mudança de filtro (HTTP via RPC).

### `get_unmatched_os(p_audit_period_id uuid)`
- **Tipo:** RPC chamável pelo client.
- **Propósito:** Listar OS sem correspondência nas duas direções (apoia regras 1 e 2).
- **Input:** `p_audit_period_id uuid`.
- **Output (SETOF):** `direction` (`only_workinfinity` | `only_stone`), chave (`chamado`/`os`), status, valores disponíveis, classificação (ex.: "Cancelado sem visita (ok)" vs "Possível atendimento não apurado").
- **Regras:** cruza `chamado_key` × `os_key`; para só-Workinfinity classifica conforme R1 (CANCELADA+0 visitas+sem técnico = ok). Só sócio autenticado.
- **Dispara quando:** aba "OS sem correspondência" (HTTP via RPC).

### `get_trend_series(p_franchise_id uuid, p_consolidated boolean)`
- **Tipo:** RPC chamável pelo client.
- **Propósito:** Séries mensais para a tela de Tendência (por franquia ou consolidado) com detecção de variação atípica.
- **Input:** `p_franchise_id uuid` (ignorado quando `p_consolidated = true`), `p_consolidated boolean`.
- **Output (SETOF por mês):** `reference_month`, `pct_valor_base_retido`, `value_at_risk`, `qtd_os`, `retencao_por_regra` (jsonb por `rule_id`), `is_atypical_variation` (flag de variação atípica entre meses).
- **Regras:** calcula % do valor base retido = `total_difference / total_valor_base`; agrega por franquia ou soma das 8 quando consolidado; marca `is_atypical_variation` quando o desvio mês-a-mês excede o limiar estatístico. Mantém histórico mensal indefinido (~6 mil OS/mês somadas). Só sócio autenticado.
- **Dispara quando:** carregamento da tela de Tendência (HTTP via RPC).

---

### Triggers de tabela (integridade/consistência)

### `trg_normalize_alias_name()`
- **Tipo:** Trigger de tabela (`BEFORE INSERT OR UPDATE` em `franchise_name_aliases`).
- **Propósito:** Garantir o preenchimento de `raw_name_normalized` para o match tolerante de franquia.
- **Input/Output:** usa `NEW.raw_name` → seta `NEW.raw_name_normalized` (maiúsculas, sem espaços duplos/laterais).
- **Regras:** normalização consistente antes da UNIQUE(`raw_name_normalized`), evitando aliases duplicados com formatação diferente.
- **Dispara quando:** INSERT/UPDATE em `franchise_name_aliases` (inclui gravações via `associate-file-franchise` e edição nas Configurações).

### `trg_set_finding_reviewer()`
- **Tipo:** Trigger de tabela (`BEFORE UPDATE` em `audit_findings`).
- **Propósito:** Carimbar autoria/data da revisão quando um sócio altera status/observação/IA.
- **Input/Output:** quando `review_status`/`observation`/`ai_explanation`/`ai_contestation_text` mudam → seta `NEW.reviewed_by = auth.uid()` e `NEW.reviewed_at = now()`.
- **Regras:** valida `review_status ∈ {contestar, aceito, pendente}`; só sócio autenticado edita (reforça a RLS de UPDATE).
- **Dispara quando:** UPDATE em `audit_findings` (marcação Contestar/Aceito/Pendente, observação, ações de IA).

### `trg_touch_rules_updated()`
- **Tipo:** Trigger de tabela (`BEFORE UPDATE` em `audit_rules`).
- **Propósito:** Registrar quem ligou/desligou cada regra e quando.
- **Input/Output:** seta `NEW.updated_by = auth.uid()`, `NEW.updated_at = now()`.
- **Regras:** o estado `is_enabled` afeta apenas a **geração de novos achados** em `process-audit-period`, não os já existentes.
- **Dispara quando:** UPDATE em `audit_rules` (liga/desliga nas Configurações).

### `trg_touch_price_override()`
- **Tipo:** Trigger de tabela (`BEFORE UPDATE` em `price_table_entries`).
- **Propósito:** Marcar edição manual da tabela de preços e registrar autoria.
- **Input/Output:** quando `expected_valor_base` é editado manualmente → seta `NEW.is_manual_override = true`, `NEW.updated_by = auth.uid()`, `NEW.updated_at = now()`.
- **Regras:** linhas com `is_manual_override = true` **não são sobrescritas** por `infer-price-table`.
- **Dispara quando:** UPDATE em `price_table_entries` (edição na seção de tabela de preços das Configurações).

---

> **Extensões sinalizadas (adicionadas por este agente de documentação):** os triggers `trg_normalize_alias_name`, `trg_set_finding_reviewer`, `trg_touch_rules_updated` e `trg_touch_price_override` **não estavam explicitamente listados na ESTRUTURA**. Foram incluídos porque o PROCESSO exige: (a) match tolerante de nomes de franquia (`raw_name_normalized`), (b) rastreio de quem revisou cada achado (`reviewed_by`/`reviewed_at`), (c) auditoria de liga/desliga de regras, e (d) preservação das edições manuais da tabela de preços contra a inferência automática. São triggers simples de integridade, consistentes com as colunas já definidas no modelo de dados da ESTRUTURA.
