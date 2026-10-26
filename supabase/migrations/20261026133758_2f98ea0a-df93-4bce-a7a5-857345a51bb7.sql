CREATE OR REPLACE FUNCTION public.commit_month_import(p_file jsonb, p_data jsonb, p_franchise_id uuid, p_user_id uuid, p_save_alias boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_file uuid := (p_file->>'id')::uuid; v_month date := (p_file->>'reference_month')::date; v_kind text := p_data->>'file_kind'; v_period uuid; v_existing uuid; v_raw text := p_data->>'detected_raw_name'; v_normal text := upper(regexp_replace(trim(v_raw), '\s+', ' ', 'g'));
BEGIN
IF v_kind NOT IN ('workinfinity_csv','stone_xlsx') OR extract(day from v_month) <> 1 THEN RAISE EXCEPTION 'Invalid import'; END IF;
IF p_franchise_id IS NOT NULL THEN
 IF NOT EXISTS (SELECT 1 FROM public.franchises WHERE id=p_franchise_id AND is_active) THEN RAISE EXCEPTION 'Invalid franchise'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_franchise_id::text || v_month::text, 0));
END IF;
IF p_save_alias AND nullif(v_normal,'') IS NOT NULL THEN
 SELECT franchise_id INTO v_existing FROM public.franchise_name_aliases WHERE raw_name_normalized=v_normal;
 IF v_existing IS NOT NULL AND v_existing <> p_franchise_id THEN RAISE EXCEPTION 'Alias already associated'; END IF;
 INSERT INTO public.franchise_name_aliases(franchise_id,raw_name,raw_name_normalized,created_by) VALUES(p_franchise_id,v_raw,v_normal,p_user_id) ON CONFLICT(raw_name_normalized) DO NOTHING;
END IF;
INSERT INTO public.uploaded_files(id,franchise_id,reference_month,file_kind,storage_path,original_filename,detected_raw_name,row_count,dropped_pii_columns,uploaded_by)
VALUES(v_file,p_franchise_id,v_month,v_kind,p_file->>'storage_path',p_file->>'original_filename',nullif(v_raw,''),(p_data->>'row_count')::int,true,p_user_id)
ON CONFLICT(id) DO UPDATE SET franchise_id=excluded.franchise_id;
IF p_franchise_id IS NULL THEN RETURN NULL; END IF;
INSERT INTO public.audit_periods(franchise_id,reference_month,created_by) VALUES(p_franchise_id,v_month,p_user_id) ON CONFLICT(franchise_id,reference_month) DO NOTHING;
SELECT id INTO v_period FROM public.audit_periods WHERE franchise_id=p_franchise_id AND reference_month=v_month FOR UPDATE;
IF v_kind='workinfinity_csv' THEN
 DELETE FROM public.workinfinity_records WHERE audit_period_id=v_period;
 INSERT INTO public.workinfinity_records(audit_period_id,chamado,chamado_key,status,contratante,grupo_servico,prestador,tecnico,cidade,numero_visitas,abono,descricao_motivo,data_atendimento,serial_instalado,serial_retirado)
 SELECT v_period,r.chamado,r.chamado_key,r.status,r.contratante,r.grupo_servico,r.prestador,r.tecnico,r.cidade,r.numero_visitas,r.abono,r.descricao_motivo,r.data_atendimento,r.serial_instalado,r.serial_retirado FROM jsonb_populate_recordset(NULL::public.workinfinity_records,p_data->'workinfinity') r;
 UPDATE public.audit_periods SET workinfinity_file_id=v_file,status='pending',processed_at=NULL WHERE id=v_period;
ELSE
 DELETE FROM public.stone_os_records WHERE audit_period_id=v_period;
 DELETE FROM public.stone_triagem_records WHERE audit_period_id=v_period;
 DELETE FROM public.stone_bonificacao_records WHERE audit_period_id=v_period;
 INSERT INTO public.stone_os_records(audit_period_id,os,os_key,stonecode,cidade,uf,produto,grupo_servico,data_abertura,data_limite_atendimento,data_atendimento,distancia_km,nome_tecnico,status,motivo_cancelamento,visitas,atraso,abono,raio,dias_ate_atendimento,atraso_dias_uteis,multa,valor_base_os,em_auditoria,valor_pago,status_pagamento,was_realigned)
 SELECT v_period,r.os,r.os_key,r.stonecode,r.cidade,r.uf,r.produto,r.grupo_servico,r.data_abertura,r.data_limite_atendimento,r.data_atendimento,r.distancia_km,r.nome_tecnico,r.status,r.motivo_cancelamento,r.visitas,r.atraso,r.abono,r.raio,r.dias_ate_atendimento,r.atraso_dias_uteis,r.multa,r.valor_base_os,r.em_auditoria,r.valor_pago,r.status_pagamento,r.was_realigned FROM jsonb_populate_recordset(NULL::public.stone_os_records,p_data->'stone') r;
 INSERT INTO public.stone_triagem_records(audit_period_id,mes_ref,serial,status_triagem,valor_triagem)
 SELECT v_period,r.mes_ref,r.serial,r.status_triagem,r.valor_triagem FROM jsonb_populate_recordset(NULL::public.stone_triagem_records,p_data->'triagem') r;
 INSERT INTO public.stone_bonificacao_records(audit_period_id,tma_stone,tma_ton,ciclo,retirados,triados,triados_good,aproveitamento_triagem,rv_payload)
 SELECT v_period,r.tma_stone,r.tma_ton,r.ciclo,r.retirados,r.triados,r.triados_good,r.aproveitamento_triagem,r.rv_payload FROM jsonb_populate_recordset(NULL::public.stone_bonificacao_records,p_data->'bonificacao') r;
 UPDATE public.audit_periods SET stone_file_id=v_file,status='pending',processed_at=NULL,
 realigned_rows_count=(p_data->>'realigned_rows_count')::int,
 consolidado_stone=(p_data->'totals'->>'consolidado_stone')::numeric,
 consolidado_ton=(p_data->'totals'->>'consolidado_ton')::numeric,
 consolidado_bobina=(p_data->'totals'->>'consolidado_bobina')::numeric,
 consolidado_triagem=(p_data->'totals'->>'consolidado_triagem')::numeric,
 consolidado_total=(p_data->'totals'->>'consolidado_total')::numeric,
 total_valor_base=(p_data->'totals'->>'total_valor_base')::numeric,
 total_valor_pago=(p_data->'totals'->>'total_valor_pago')::numeric,
 total_difference=(p_data->'totals'->>'total_difference')::numeric,
 total_validation_diff=(p_data->'totals'->>'total_validation_diff')::numeric WHERE id=v_period;
END IF;
RETURN v_period;
END;
$$;
REVOKE ALL ON FUNCTION public.commit_month_import(jsonb,jsonb,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_month_import(jsonb,jsonb,uuid,uuid,boolean) TO service_role;