create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table franchises (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_franchises_updated_at
before update on franchises
for each row execute function set_updated_at();

create table franchise_name_aliases (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references franchises(id) on delete cascade,
  raw_name text not null,
  raw_name_normalized text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_franchise_name_aliases_franchise_id on franchise_name_aliases(franchise_id);

create trigger trg_franchise_name_aliases_updated_at
before update on franchise_name_aliases
for each row execute function set_updated_at();

create table uploaded_files (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid references franchises(id) on delete set null,
  reference_month date not null,
  file_kind text not null,
  storage_path text not null,
  original_filename text not null,
  detected_raw_name text,
  row_count int,
  dropped_pii_columns boolean not null default false,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_uploaded_files_franchise_id on uploaded_files(franchise_id);
create index idx_uploaded_files_month_kind on uploaded_files(reference_month, file_kind);

create trigger trg_uploaded_files_updated_at
before update on uploaded_files
for each row execute function set_updated_at();

create table audit_periods (
  id uuid primary key default gen_random_uuid(),
  franchise_id uuid not null references franchises(id) on delete cascade,
  reference_month date not null,
  status text not null default 'pending',
  workinfinity_file_id uuid references uploaded_files(id) on delete set null,
  stone_file_id uuid references uploaded_files(id) on delete set null,
  realigned_rows_count int not null default 0,
  consolidado_stone numeric(14,2),
  consolidado_ton numeric(14,2),
  consolidado_bobina numeric(14,2),
  consolidado_triagem numeric(14,2),
  consolidado_total numeric(14,2),
  total_valor_base numeric(14,2),
  total_valor_pago numeric(14,2),
  total_difference numeric(14,2),
  total_validation_diff numeric(14,2),
  open_findings_count int not null default 0,
  value_at_risk numeric(14,2) not null default 0,
  processed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (franchise_id, reference_month)
);

create index idx_audit_periods_franchise_id on audit_periods(franchise_id);
create index idx_audit_periods_reference_month on audit_periods(reference_month);

create trigger trg_audit_periods_updated_at
before update on audit_periods
for each row execute function set_updated_at();

create table workinfinity_records (
  id uuid primary key default gen_random_uuid(),
  audit_period_id uuid not null references audit_periods(id) on delete cascade,
  chamado text not null,
  chamado_key text not null,
  status text,
  contratante text,
  grupo_servico text,
  prestador text,
  tecnico text,
  cidade text,
  numero_visitas int,
  abono text,
  descricao_motivo text,
  data_atendimento timestamptz,
  serial_instalado text,
  serial_retirado text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_workinfinity_records_audit_period_id on workinfinity_records(audit_period_id);
create index idx_workinfinity_records_period_key on workinfinity_records(audit_period_id, chamado_key);
create index idx_workinfinity_records_status on workinfinity_records(status);

create trigger trg_workinfinity_records_updated_at
before update on workinfinity_records
for each row execute function set_updated_at();

create table stone_os_records (
  id uuid primary key default gen_random_uuid(),
  audit_period_id uuid not null references audit_periods(id) on delete cascade,
  os text not null,
  os_key text not null,
  stonecode text,
  cidade text,
  uf text,
  produto text,
  grupo_servico text,
  data_abertura timestamptz,
  data_limite_atendimento timestamptz,
  data_atendimento timestamptz,
  distancia_km numeric(10,2),
  nome_tecnico text,
  status text,
  motivo_cancelamento text,
  visitas int,
  atraso text,
  abono text,
  raio text,
  dias_ate_atendimento int,
  atraso_dias_uteis int,
  multa numeric(14,2),
  valor_base_os numeric(14,2),
  em_auditoria numeric(14,2),
  valor_pago numeric(14,2),
  status_pagamento text,
  was_realigned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_stone_os_records_audit_period_id on stone_os_records(audit_period_id);
create index idx_stone_os_records_period_key on stone_os_records(audit_period_id, os_key);
create index idx_stone_os_records_stonecode_data on stone_os_records(stonecode, data_atendimento);
create index idx_stone_os_records_raio on stone_os_records(raio);
create index idx_stone_os_records_produto on stone_os_records(produto);

create trigger trg_stone_os_records_updated_at
before update on stone_os_records
for each row execute function set_updated_at();

create table stone_triagem_records (
  id uuid primary key default gen_random_uuid(),
  audit_period_id uuid not null references audit_periods(id) on delete cascade,
  mes_ref date,
  serial text,
  status_triagem text,
  valor_triagem numeric(14,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_stone_triagem_records_audit_period_id on stone_triagem_records(audit_period_id);
create index idx_stone_triagem_records_status on stone_triagem_records(status_triagem);

create trigger trg_stone_triagem_records_updated_at
before update on stone_triagem_records
for each row execute function set_updated_at();

create table stone_bonificacao_records (
  id uuid primary key default gen_random_uuid(),
  audit_period_id uuid not null references audit_periods(id) on delete cascade,
  tma_stone numeric(10,2),
  tma_ton numeric(10,2),
  ciclo text,
  retirados int,
  triados int,
  triados_good int,
  aproveitamento_triagem numeric(6,2),
  rv_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_stone_bonificacao_records_audit_period_id on stone_bonificacao_records(audit_period_id);

create trigger trg_stone_bonificacao_records_updated_at
before update on stone_bonificacao_records
for each row execute function set_updated_at();

create table audit_rules (
  id smallint primary key,
  rule_key text not null unique,
  name text not null,
  description text,
  is_enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_audit_rules_updated_at
before update on audit_rules
for each row execute function set_updated_at();

create table audit_findings (
  id uuid primary key default gen_random_uuid(),
  audit_period_id uuid not null references audit_periods(id) on delete cascade,
  franchise_id uuid not null references franchises(id) on delete cascade,
  rule_id smallint not null references audit_rules(id) on delete restrict,
  os text,
  stonecode text,
  grupo_servico text,
  tecnico text,
  cidade text,
  data_atendimento timestamptz,
  valor_base_os numeric(14,2),
  valor_pago numeric(14,2),
  diferenca numeric(14,2),
  severity text not null,
  title text not null,
  detail text,
  review_status text not null default 'pendente',
  observation text,
  ai_explanation text,
  ai_contestation_text text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_audit_findings_audit_period_id on audit_findings(audit_period_id);
create index idx_audit_findings_franchise_id on audit_findings(franchise_id);
create index idx_audit_findings_rule_id on audit_findings(rule_id);
create index idx_audit_findings_severity on audit_findings(severity);
create index idx_audit_findings_review_status on audit_findings(review_status);
create index idx_audit_findings_period_review on audit_findings(audit_period_id, review_status);
create index idx_audit_findings_tecnico on audit_findings(tecnico);
create index idx_audit_findings_cidade on audit_findings(cidade);
create index idx_audit_findings_grupo_servico on audit_findings(grupo_servico);

create trigger trg_audit_findings_updated_at
before update on audit_findings
for each row execute function set_updated_at();

create table price_table_entries (
  id uuid primary key default gen_random_uuid(),
  produto text not null,
  grupo_servico text not null,
  raio text not null,
  expected_valor_base numeric(14,2) not null,
  is_manual_override boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (produto, grupo_servico, raio)
);

create trigger trg_price_table_entries_updated_at
before update on price_table_entries
for each row execute function set_updated_at();

create table ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid references audit_findings(id) on delete set null,
  audit_period_id uuid references audit_periods(id) on delete set null,
  action text not null,
  model text not null,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10,4),
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ai_usage_log_finding_id on ai_usage_log(finding_id);
create index idx_ai_usage_log_created_at on ai_usage_log(created_at);

create trigger trg_ai_usage_log_updated_at
before update on ai_usage_log
for each row execute function set_updated_at();

alter table franchises enable row level security;
alter table franchise_name_aliases enable row level security;
alter table uploaded_files enable row level security;
alter table audit_periods enable row level security;
alter table workinfinity_records enable row level security;
alter table stone_os_records enable row level security;
alter table stone_triagem_records enable row level security;
alter table stone_bonificacao_records enable row level security;
alter table audit_rules enable row level security;
alter table audit_findings enable row level security;
alter table price_table_entries enable row level security;
alter table ai_usage_log enable row level security;

create policy franchises_select on franchises for select to authenticated using (auth.uid() is not null);
create policy franchises_update on franchises for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);

create policy franchise_name_aliases_select on franchise_name_aliases for select to authenticated using (auth.uid() is not null);
create policy franchise_name_aliases_insert on franchise_name_aliases for insert to authenticated with check (auth.uid() is not null);
create policy franchise_name_aliases_update on franchise_name_aliases for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy franchise_name_aliases_delete on franchise_name_aliases for delete to authenticated using (auth.uid() is not null);

create policy uploaded_files_select on uploaded_files for select to authenticated using (auth.uid() is not null);
create policy uploaded_files_delete on uploaded_files for delete to authenticated using (auth.uid() is not null);

create policy audit_periods_select on audit_periods for select to authenticated using (auth.uid() is not null);
create policy audit_periods_delete on audit_periods for delete to authenticated using (auth.uid() is not null);

create policy workinfinity_records_select on workinfinity_records for select to authenticated using (auth.uid() is not null);

create policy stone_os_records_select on stone_os_records for select to authenticated using (auth.uid() is not null);

create policy stone_triagem_records_select on stone_triagem_records for select to authenticated using (auth.uid() is not null);

create policy stone_bonificacao_records_select on stone_bonificacao_records for select to authenticated using (auth.uid() is not null);

create policy audit_rules_select on audit_rules for select to authenticated using (auth.uid() is not null);
create policy audit_rules_update on audit_rules for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);

create policy audit_findings_select on audit_findings for select to authenticated using (auth.uid() is not null);
create policy audit_findings_update on audit_findings for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);

create policy price_table_entries_select on price_table_entries for select to authenticated using (auth.uid() is not null);
create policy price_table_entries_update on price_table_entries for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy price_table_entries_delete on price_table_entries for delete to authenticated using (auth.uid() is not null);

create policy ai_usage_log_select on ai_usage_log for select to authenticated using (auth.uid() is not null);

-- Seed the eight canonical franchises provided by the project owner.
insert into franchises (code, display_name) values
  ('CE_LIMOEIRO_DO_NORTE', 'CE - LIMOEIRO DO NORTE'),
  ('CE_TRAIRI', 'CE - TRAIRI'),
  ('MG_PARACATU', 'MG - PARACATU'),
  ('PB_PATOS', 'PB - PATOS'),
  ('RN_APODI', 'RN - APODI'),
  ('RN_JOAO_CAMARA', 'RN - JOAO CAMARA'),
  ('RN_MACAU', 'RN - MACAU'),
  ('RN_PARELHAS', 'RN - PARELHAS')
on conflict (code) do update set
  display_name = excluded.display_name;

-- Seed the documented audit rules. Keep these keys stable: findings reference rule ids.
insert into audit_rules (id, rule_key, name, description) values
  (1, 'only_in_workinfinity', 'OS somente no Workinfinity', 'Sinaliza atendimentos registrados no Workinfinity sem correspondência na apuração Stone, exceto cancelamentos sem visita e sem técnico.'),
  (2, 'only_in_stone', 'OS somente na apuração Stone', 'Sinaliza OS presentes na apuração Stone sem correspondência no Workinfinity.'),
  (3, 'status_or_visits_mismatch', 'Divergência de status ou visitas', 'Sinaliza divergências de status ou número de visitas entre Workinfinity e Stone.'),
  (4, 'payment_difference', 'Diferença entre valor base e pago', 'Decompõe diferenças por regra de 40%, baixa tardia, multas e outros motivos.'),
  (5, 'visit_rule_40pct', 'Regra de visitas 100% / 40%', 'Agrupa OS pelo mesmo Stonecode e data: a OS de maior valor base recebe 100% e as demais 40%.'),
  (6, 'payment_anomalies', 'Anomalias de valores', 'Sinaliza valor pago negativo, multa acima do valor base, valor base zero em OS com visita e multa aplicada junto com abono.'),
  (7, 'price_table_deviation', 'Divergência da tabela de preços', 'Sinaliza valor base divergente da moda por produto, grupo de serviço e raio, respeitando ajustes manuais.'),
  (8, 'radius_distance_mismatch', 'Divergência entre raio e distância', 'Sinaliza incompatibilidade entre raio e distância, incluindo distâncias absurdas.'),
  (9, 'triage_payment_mismatch', 'Divergência de pagamento da triagem', 'Confere R$ 5 por equipamento GOOD e compara a soma com o Consolidado.')
on conflict (id) do update set
  rule_key = excluded.rule_key,
  name = excluded.name,
  description = excluded.description;

-- Private Storage buckets; access is issued through authenticated signed-URL functions.
insert into storage.buckets (id, name, public) values
  ('source-files', 'source-files', false),
  ('contestation-exports', 'contestation-exports', false)
on conflict (id) do update set public = false;
