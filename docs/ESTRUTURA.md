## 1. Modelo de dados

> Todos os nomes de tabela/coluna em `snake_case` (inglês). Chaves de valor em R$ usam `numeric(14,2)`. Datas de atendimento usam `timestamptz`. O histórico mensal é mantido indefinidamente (alimenta os gráficos de tendência com ~6 mil OS/mês).

### `franchises`
Cadastro fixo das 8 franquias de logística do grupo.
- `id` uuid PK default `gen_random_uuid()`
- `code` text NOT NULL UNIQUE — código curto interno (ex.: `POLO_PATOS`)
- `display_name` text NOT NULL — nome canônico exibido (ex.: "POLO PATOS")
- `is_active` boolean NOT NULL default true
- `created_at` timestamptz NOT NULL default `now()`
- Índices: UNIQUE(`code`).

### `franchise_name_aliases`
Tabela de equivalência editável que mapeia o nome do Prestador/Franquia vindo dos arquivos para a franquia canônica.
- `id` uuid PK default `gen_random_uuid()`
- `franchise_id` uuid NOT NULL FK → `franchises(id)`
- `raw_name` text NOT NULL — texto como aparece nos arquivos (ex.: "PB - PATOS FRANQUIA")
- `raw_name_normalized` text NOT NULL — `raw_name` em maiúsculas sem espaços duplos, para match tolerante
- `created_by` uuid FK → `auth.users(id)`
- `created_at` timestamptz NOT NULL default `now()`
- Índices: UNIQUE(`raw_name_normalized`), FK `franchise_id`.

### `audit_periods`
Representa um mês de referência auditado de uma franquia (unidade de processamento = franquia + mês).
- `id` uuid PK default `gen_random_uuid()`
- `franchise_id` uuid NOT NULL FK → `franchises(id)`
- `reference_month` date NOT NULL — sempre dia 01 do mês de referência
- `status` text NOT NULL default `'pending'` — `pending | processing | processed | error`
- `workinfinity_file_id` uuid FK → `uploaded_files(id)`
- `stone_file_id` uuid FK → `uploaded_files(id)`
- `realigned_rows_count` int NOT NULL default 0 — nº de linhas deslocadas corrigidas (regra de "Sem Retorno")
- `consolidado_stone` numeric(14,2), `consolidado_ton` numeric(14,2), `consolidado_bobina` numeric(14,2), `consolidado_triagem` numeric(14,2), `consolidado_total` numeric(14,2)
- `total_valor_base` numeric(14,2), `total_valor_pago` numeric(14,2), `total_difference` numeric(14,2)
- `total_validation_diff` numeric(14,2) — diferença entre soma de valor_pago e (Stone+Ton+Bobina)
- `open_findings_count` int NOT NULL default 0, `value_at_risk` numeric(14,2) NOT NULL default 0
- `processed_at` timestamptz, `created_by` uuid FK → `auth.users(id)`, `created_at` timestamptz NOT NULL default `now()`
- Índices: UNIQUE(`franchise_id`,`reference_month`), FK `franchise_id`, `reference_month` (filtro do seletor de mês).

### `uploaded_files`
Metadados dos arquivos enviados (o binário fica no Storage). Rastreia de onde veio cada apuração.
- `id` uuid PK default `gen_random_uuid()`
- `franchise_id` uuid FK → `franchises(id)` — pode ser null até associação manual
- `reference_month` date NOT NULL
- `file_kind` text NOT NULL — `workinfinity_csv | stone_xlsx`
- `storage_path` text NOT NULL — caminho no bucket `source-files`
- `original_filename` text NOT NULL, `detected_raw_name` text — nome de Prestador/Franquia extraído
- `row_count` int, `dropped_pii_columns` boolean NOT NULL default false — confirma descarte LGPD
- `uploaded_by` uuid FK → `auth.users(id)`, `created_at` timestamptz NOT NULL default `now()`
- Índices: FK `franchise_id`, (`reference_month`,`file_kind`).

### `workinfinity_records`
Linhas tratadas do relatório Workinfinity (SEM colunas de PII — CPF/CNPJ, telefone, endereço jamais armazenados).
- `id` uuid PK default `gen_random_uuid()`
- `audit_period_id` uuid NOT NULL FK → `audit_periods(id)` ON DELETE CASCADE
- `chamado` text NOT NULL — chave de cruzamento
- `chamado_key` text NOT NULL — `chamado` sem espaços, para o join com `os_key`
- `status` text — BAIXADA / CANCELADA
- `contratante` text — TON / STONE PAGAMENTOS
- `grupo_servico` text — INSTALAÇÃO / DESINSTALAÇÃO / TROCA / ENVIO DE SUPRIMENTOS
- `prestador` text, `tecnico` text, `cidade` text
- `numero_visitas` int, `abono` text, `descricao_motivo` text
- `data_atendimento` timestamptz
- `serial_instalado` text, `serial_retirado` text — já com aspas e `=` removidos
- `created_at` timestamptz NOT NULL default `now()`
- Índices: FK `audit_period_id`, (`audit_period_id`,`chamado_key`), `status`.

### `stone_os_records`
Linhas da aba "Analítico da OS" já realinhadas (correção das linhas deslocadas de "Sem Retorno").
- `id` uuid PK default `gen_random_uuid()`
- `audit_period_id` uuid NOT NULL FK → `audit_periods(id)` ON DELETE CASCADE
- `os` text NOT NULL, `os_key` text NOT NULL — `os` sem espaços
- `stonecode` text, `cidade` text, `uf` text
- `produto` text — STONE / TON / BOBINA
- `grupo_servico` text, `data_abertura` timestamptz, `data_limite_atendimento` timestamptz, `data_atendimento` timestamptz
- `distancia_km` numeric(10,2), `nome_tecnico` text
- `status` text — BAIXADA / CANCELADA / "(Tratamento) Sem Retorno"
- `motivo_cancelamento` text, `visitas` int, `atraso` text, `abono` text
- `raio` text — R1..R4
- `dias_ate_atendimento` int, `atraso_dias_uteis` int
- `multa` numeric(14,2), `valor_base_os` numeric(14,2), `em_auditoria` numeric(14,2), `valor_pago` numeric(14,2)
- `status_pagamento` text, `was_realigned` boolean NOT NULL default false
- `created_at` timestamptz NOT NULL default `now()`
- Índices: FK `audit_period_id`, (`audit_period_id`,`os_key`), (`stonecode`,`data_atendimento`) (regra 5), `raio`, `produto`.

### `stone_triagem_records`
Linhas da aba "Analítico Triagem" (regra 9).
- `id` uuid PK default `gen_random_uuid()`
- `audit_period_id` uuid NOT NULL FK → `audit_periods(id)` ON DELETE CASCADE
- `mes_ref` date, `serial` text, `status_triagem` text — ex.: GOOD/BAD
- `valor_triagem` numeric(14,2)
- Índices: FK `audit_period_id`, `status_triagem`.

### `stone_bonificacao_records`
Linha(s) da aba "Bonificação" exibida no detalhe da franquia.
- `id` uuid PK default `gen_random_uuid()`
- `audit_period_id` uuid NOT NULL FK → `audit_periods(id)` ON DELETE CASCADE
- `tma_stone` numeric(10,2), `tma_ton` numeric(10,2), `ciclo` text
- `retirados` int, `triados` int, `triados_good` int, `aproveitamento_triagem` numeric(6,2)
- `rv_payload` jsonb — guarda os campos RV_* variáveis
- Índices: FK `audit_period_id`.

### `audit_rules`
Catálogo das 9 regras com estado ligado/desligado (editável nas Configurações).
- `id` smallint PK — 1..9
- `rule_key` text NOT NULL UNIQUE — ex.: `only_in_workinfinity`, `visit_rule_40pct`
- `name` text NOT NULL, `description` text
- `is_enabled` boolean NOT NULL default true
- `updated_by` uuid FK → `auth.users(id)`, `updated_at` timestamptz default `now()`

### `audit_findings`
Cada achado gerado pelas regras, com OS, valor e gravidade; é a tabela central da revisão.
- `id` uuid PK default `gen_random_uuid()`
- `audit_period_id` uuid NOT NULL FK → `audit_periods(id)` ON DELETE CASCADE
- `franchise_id` uuid NOT NULL FK → `franchises(id)`
- `rule_id` smallint NOT NULL FK → `audit_rules(id)`
- `os` text, `stonecode` text, `grupo_servico` text, `tecnico` text, `cidade` text
- `data_atendimento` timestamptz
- `valor_base_os` numeric(14,2), `valor_pago` numeric(14,2), `diferenca` numeric(14,2)
- `severity` text NOT NULL — `high | medium | low | info`
- `title` text NOT NULL, `detail` text — descrição do porquê
- `review_status` text NOT NULL default `'pendente'` — `contestar | aceito | pendente`
- `observation` text — observação livre do sócio
- `ai_explanation` text, `ai_contestation_text` text — preenchidos sob demanda pela IA
- `reviewed_by` uuid FK → `auth.users(id)`, `reviewed_at` timestamptz
- `created_at` timestamptz NOT NULL default `now()`
- Índices: FK `audit_period_id`, FK `franchise_id`, `rule_id`, `severity`, `review_status`, (`audit_period_id`,`review_status`), `tecnico`, `cidade`, `grupo_servico` (filtros da aba Achados).

### `price_table_entries`
Tabela de preços inferida (moda por Produto + Grupo_de_serviço + Raio), editável (regra 7).
- `id` uuid PK default `gen_random_uuid()`
- `produto` text NOT NULL, `grupo_servico` text NOT NULL, `raio` text NOT NULL
- `expected_valor_base` numeric(14,2) NOT NULL
- `is_manual_override` boolean NOT NULL default false — true quando o sócio editou
- `updated_by` uuid FK → `auth.users(id)`, `updated_at` timestamptz default `now()`
- Índices: UNIQUE(`produto`,`grupo_servico`,`raio`).

### `ai_usage_log`
Registro de chamadas de IA sob demanda (controle de custo, já que IA é opcional).
- `id` uuid PK default `gen_random_uuid()`
- `finding_id` uuid FK → `audit_findings(id)`, `audit_period_id` uuid FK → `audit_periods(id)`
- `action` text NOT NULL — `explain_finding | suggest_contestation | detect_anomalies`
- `model` text NOT NULL, `input_tokens` int, `output_tokens` int, `cost_usd` numeric(10,4)
- `requested_by` uuid FK → `auth.users(id)`, `created_at` timestamptz NOT NULL default `now()`
- Índices: FK `finding_id`, `created_at`.

---

## 2. RLS e autenticação

**Autenticação:** Supabase Auth por **e-mail + senha** (conforme a ideia). Signup público desligado — os 4 sócios são criados manualmente (convite/admin). Não há OAuth nem magic link, pois o universo de usuários é fechado e pequeno.

**Modelo de permissão:** os 4 sócios têm **visão completa idêntica das 8 franquias** (sem perfil restrito por franquia). RLS é usada essencialmente como "só usuário autenticado acessa", não para particionar por franquia. Toda política exige `auth.uid() IS NOT NULL`. As Edge Functions que escrevem em massa (ingestão/geração de achados) usam a `service_role`, que ignora RLS.

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `franchises` | autenticado | service_role | autenticado (editar nome/ativo) | service_role |
| `franchise_name_aliases` | autenticado | autenticado | autenticado | autenticado |
| `audit_periods` | autenticado | service_role (ingestão) | service_role | autenticado (reprocessar/apagar mês) |
| `uploaded_files` | autenticado | service_role | service_role | autenticado |
| `workinfinity_records` | autenticado | service_role | — | service_role (cascade) |
| `stone_os_records` | autenticado | service_role | — | service_role (cascade) |
| `stone_triagem_records` | autenticado | service_role | — | service_role |
| `stone_bonificacao_records` | autenticado | service_role | — | service_role |
| `audit_rules` | autenticado | service_role (seed) | autenticado (ligar/desligar) | — |
| `audit_findings` | autenticado | service_role (geração) | autenticado (status/observação/IA) | service_role |
| `price_table_entries` | autenticado | service_role (inferência) | autenticado (override manual) | autenticado |
| `ai_usage_log` | autenticado | service_role | — | — |

**Storage:** bucket privado `source-files` (CSV/XLSX de origem) e bucket privado `contestation-exports` (XLSX/PDF gerados). Acesso de leitura/escrita apenas a usuários autenticados via signed URLs geradas por Edge Function. Os arquivos de origem contêm dados operacionais; as colunas de PII já foram descartadas **antes** de qualquer persistência (nem o binário bruto com PII é mantido — a Edge Function de ingestão regrava o CSV sem as colunas sensíveis ou descarta o original).

---

## 3. Functions/endpoints

### Edge Functions (Deno, kebab-case)

- **`ingest-month-files`** — Recebe os arquivos do upload múltiplo. Para cada arquivo: detecta `file_kind`, extrai o nome do Prestador/Franquia, resolve a franquia via `franchise_name_aliases` (ou marca para associação manual), **descarta as colunas de PII do Workinfinity (LGPD)**, parseia CSV Latin-1 (`;`) e XLSX (abas Consolidado/Analítico da OS/Triagem/Bonificação), limpa seriais (`="ABC123"` → `ABC123`), **detecta e realinha as linhas deslocadas de "(Tratamento) Sem Retorno"** contando quantas foram corrigidas, grava em `uploaded_files` + `*_records` e cria/atualiza `audit_periods`. Chamada no clique de "Importar mês".
- **`process-audit-period`** — Para um `audit_period_id`: valida total (soma `valor_pago` vs Stone+Ton+Bobina), cruza `workinfinity_records.chamado_key` = `stone_os_records.os_key`, executa as **9 regras habilitadas** (`audit_rules.is_enabled`), grava `audit_findings`, recalcula `open_findings_count`/`value_at_risk`/totais do período. Chamada automaticamente após `ingest-month-files` ou manualmente em "reprocessar".
- **`infer-price-table`** — Calcula a moda de `valor_base_os` por `produto`+`grupo_servico`+`raio` sobre todos os períodos e popula `price_table_entries` (sem sobrescrever `is_manual_override`). Chamada após ingestão e sob demanda nas Configurações.
- **`associate-file-franchise`** — Quando o nome não é reconhecido, grava a associação em `franchise_name_aliases` e reprocessa o arquivo pendente. Chamada na tela de associação manual.
- **`ai-explain-finding`** — Monta prompt com o contexto do achado (regra, OS, valores, status das duas bases) e chama a API de IA para gerar `ai_explanation`; registra em `ai_usage_log`. Chamada sob demanda num achado.
- **`ai-suggest-contestation`** — Gera `ai_contestation_text` (texto de contestação para a Stone) a partir do achado marcado "Contestar". Chamada sob demanda.
- **`ai-detect-anomalies`** — Envia estatísticas agregadas do período à IA para apontar padrões/anomalias fora das 9 regras; retorna findings `info`. Chamada sob demanda no Detalhe/Painel.
- **`export-contestation`** — Gera, por franquia, o **XLSX e o PDF** com os achados `review_status = 'contestar'` (OS, serviço, data, valor base, valor pago, diferença, motivo), salva em `contestation-exports` e retorna signed URLs. Chamada na tela de Contestação.
- **`get-signed-upload-url`** / **`get-signed-download-url`** — Emitem URLs assinadas para os buckets privados.

### Postgres RPCs

- **`get_dashboard_cards(p_reference_month date)`** — Retorna por franquia: valor base, valor pago, diferença, achados abertos, valor em risco (Painel geral).
- **`get_franchise_reconciliation(p_audit_period_id uuid)`** — Resumo base × pago + diferença + diff de validação (aba Resumo).
- **`get_findings(p_audit_period_id uuid, filtros…)`** — Achados filtráveis por regra, gravidade, status, técnico, cidade, serviço.
- **`get_trend_series(p_franchise_id uuid, p_consolidated bool)`** — Séries mensais (% do valor base retido, valor em risco, qtd OS, retenção por regra) e flag de variação atípica entre meses.
- **`get_unmatched_os(p_audit_period_id uuid)`** — OS sem correspondência nas duas direções (abas regra 1 e 2).

---

## 4. Páginas do frontend

> Caminho de build: **Lovable + Supabase**. Embora o SCL Audit tenha parsing de CSV/XLSX e muitas regras, o grupo são 4 sócios gestores **sem time de TI dedicado citado** e o escopo é um app interno de telas React + Tailwind + shadcn/ui + Recharts — exatamente a stack que o Lovable gera nativamente com integração ao Supabase. Lovable leva do zero ao app no ar pelo caminho mais rápido e é mantível pelos próprios sócios. O parsing pesado (Latin-1, realinhamento de linhas, 9 regras, 6 mil OS/mês) fica nas Edge Functions do Supabase, não no cliente, mantendo o frontend simples.

- **`/login`** — Autenticação por e-mail/senha dos 4 sócios.
- **`/`** (Painel geral) — Seletor de mês + cards por franquia (8) com valor base, valor pago, diferença, achados abertos e valor em risco; botão "Importar mês".
- **`/importar`** — Upload múltiplo de arquivos; mostra detecção automática de franquia, nº de linhas realinhadas, diferença de validação do total e tela de associação manual quando o nome não é reconhecido.
- **`/franquia/:franchiseId/:month`** (Detalhe da franquia) — Abas: **Resumo** (reconciliação base × pago), **Achados** (tabela filtrável por regra/gravidade/status/técnico/cidade/serviço, com marcação Contestar/Aceito/Pendente, observação e ações de IA), **OS sem correspondência**, **Triagem**, **Bonificação**.
- **`/tendencia`** — Gráficos Recharts mensais por franquia e consolidados (% do valor base retido, valor em risco, qtd OS, retenção por regra) e destaque de variações atípicas entre meses.
- **`/contestacao`** — Seleção dos achados "Contestar" e exportação de XLSX + PDF por franquia, prontos para enviar à Stone manualmente.
- **`/configuracoes`** — Três seções: equivalência de nomes das franquias (`franchise_name_aliases`), tabela de preços inferida/editável (`price_table_entries`) e liga/desliga das 9 regras (`audit_rules`).

---

## 5. Integrações externas

Todas chamadas **via Supabase Edge Functions** (nunca direto do frontend), para proteger chaves e centralizar lógica.

- **API de IA — Claude Sonnet 4.6 (Anthropic)** via `ai-explain-finding`, `ai-suggest-contestation` e `ai-detect-anomalies`. Motivo: o sócio confirmou querer IA para explicar achados em linguagem simples, sugerir textos de contestação à Stone e apontar padrões fora das 9 regras. Sonnet 4.6 dá o melhor equilíbrio qualidade/custo (~US$3/Mtok in, US$15/Mtok out) para redigir contestações formais e raciocinar sobre anomalias financeiras; como o uso é sob demanda e logado em `ai_usage_log`, o custo fica controlado.
- **Supabase Storage** (buckets privados `source-files` e `contestation-exports`): guarda os arquivos de origem já sem PII e os XLSX/PDF de contestação gerados.

**Não há outras integrações.** O usuário confirmou que **não** precisa de API do Workinfinity, envio automático por e-mail/WhatsApp, nem armazenamento em Drive/ERP externo — a apuração chega por e-mail aos franqueados e o upload é 100% manual pelo navegador desktop. Por isso **não há Make, cron jobs nem webhooks** neste projeto: todo processamento é disparado pela ação de upload do sócio.
