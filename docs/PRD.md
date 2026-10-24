## 1. Contexto

O **SCL Audit** é um aplicativo web interno de um grupo que administra **8 franquias de logística** prestadoras de serviço de campo da Stone Pagamentos / Ton. Todo mês a Stone envia aos franqueados uma planilha de apuração com o que foi pago por cada atendimento, mas hoje não há como saber com segurança se cada atendimento executado (registrado no sistema Workinfinity) foi efetivamente remunerado de forma correta. Para cada franquia e mês, os sócios fazem upload de dois arquivos — o relatório operacional do Workinfinity (CSV Latin-1, ~74 colunas) e a apuração da Stone (XLSX com as abas Consolidado, Analítico da OS, Analítico Triagem e Bonificação) — e o SCL Audit cruza as bases, aplica 9 regras de auditoria e entrega uma lista objetiva de itens a contestar, já com o valor em R$ envolvido. O objetivo final é parar de perder dinheiro em atendimentos não remunerados ou pagos a menos, transformando uma conferência manual e demorada em um processo de poucos minutos por franquia.

## 2. Problema

Hoje a conferência da apuração da Stone é manual, inviável no volume real (já houve meses em que **as 8 franquias somaram cerca de 6 mil OS**) e sujeita a erros, fazendo o grupo perder dinheiro em atendimentos que foram executados mas não remunerados, ou remunerados abaixo do devido. O trabalho é agravado por particularidades concretas dos arquivos citadas pelos sócios: o Workinfinity vem em **CSV com separador ";" e encoding Latin-1**, com seriais no formato `="ABC123"` que precisam ser limpos, e **contém CPF/CNPJ, telefone e endereço de clientes finais** que não podem ser armazenados (LGPD); a apuração da Stone às vezes vem com **linhas deslocadas** nas OS de "(Tratamento) Sem Retorno", em que o valor base, o valor pago e o status de pagamento aparecem em colunas trocadas. Sem uma ferramenta que faça o realinhamento automático, o cruzamento Chamado = OS, a decomposição das diferenças de valor e a validação da regra de 40%/100%, os sócios não conseguem identificar com confiança o que contestar nem quanto dinheiro está em risco a cada mês.

## 3. Objetivos

1. **Reduzir o tempo de auditoria** de cada franquia/mês de horas de conferência manual para poucos minutos após o upload dos dois arquivos.
2. **Tornar visível o valor em risco**: exibir, por franquia e mês, valor base, valor pago, diferença, número de achados abertos e R$ em risco, consolidando ~6 mil OS/mês.
3. **Aumentar a recuperação financeira** junto à Stone, gerando por franquia um XLSX e um PDF de contestação com OS, serviço, data, valores, diferença e motivo, prontos para envio manual.
4. **Garantir integridade e conformidade dos dados**: realinhar 100% das linhas deslocadas de "Sem Retorno", validar a soma de valor pago contra Stone+Ton+Bobina do Consolidado, e descartar as colunas de PII no upload (nunca armazenadas).
5. **Dar explicabilidade às contestações** via IA sob demanda, ajudando a explicar achados e redigir textos formais de contestação.

## 4. Personas

### Marcos — Sócio-gestor (visão completa)
- **Papel:** Um dos 4 sócios do grupo; tem visão completa das 8 franquias, faz uploads, revisa achados, decide o que contestar, edita configurações e exporta os relatórios.
- **Dor:** Perde dinheiro porque não consegue conferir manualmente, mês a mês, se cada um dos milhares de atendimentos foi pago corretamente, e ainda precisa lidar com planilhas da Stone que vêm com colunas trocadas.
- **Objetivo:** Saber em poucos minutos, por franquia, exatamente o que contestar e quanto dinheiro está em risco, com um relatório pronto para mandar à Stone.
- **Citação:** "Já teve meses que as 8 franquias juntas somaram 6 mil OSs — preciso de algo que confira isso por mim e me diga o que contestar."

## 5. Requisitos funcionais

- **RF-01** — O sistema deve permitir que o sócio-gestor faça login com e-mail e senha, com signup público desligado (os 4 sócios são criados manualmente).
- **RF-02** — O sistema deve permitir que o sócio-gestor selecione o mês de referência a auditar no Painel geral.
- **RF-03** — O sistema deve permitir que o sócio-gestor faça upload de vários arquivos de uma vez (relatórios Workinfinity e apurações Stone de múltiplas franquias) na tela de importação.
- **RF-04** — O sistema deve identificar automaticamente a qual franquia cada arquivo pertence, usando o nome do Prestador/Franquia e a tabela de equivalência editável (ex.: "PB - PATOS FRANQUIA" = "POLO PATOS").
- **RF-05** — O sistema deve permitir que o sócio-gestor associe manualmente um arquivo a uma franquia quando o nome não for reconhecido, salvando a associação para os meses seguintes.
- **RF-06** — O sistema deve descartar as colunas de PII do Workinfinity (CPF/CNPJ, telefone, endereço do cliente final) no momento do upload, nunca as armazenando nem exibindo.
- **RF-07** — O sistema deve parsear o CSV do Workinfinity com separador ";" e encoding Latin-1, e limpar os seriais no formato `="ABC123"` removendo aspas e sinal de igual.
- **RF-08** — O sistema deve ler as abas Consolidado, Analítico da OS, Analítico Triagem e Bonificação do XLSX da Stone.
- **RF-09** — O sistema deve detectar e realinhar automaticamente as linhas deslocadas de OS "(Tratamento) Sem Retorno" (Valor_base_OS ← Multa; Valor_pago ← Em_auditoria; Status_pagamento ← Valor_pago; Multa e Em_auditoria ← 0) e informar ao sócio quantas linhas foram corrigidas.
- **RF-10** — O sistema deve validar se a soma de Valor_pago (após correção) bate com Stone + Ton + Bobina do Consolidado e exibir a diferença, se houver.
- **RF-11** — O sistema deve cruzar as duas bases pela chave Chamado (Workinfinity) = OS (apuração), comparadas como texto sem espaços.
- **RF-12** — O sistema deve aplicar as 9 regras de auditoria que estiverem habilitadas e gerar achados, cada um com OS, valor em R$ e gravidade.
- **RF-13** — O sistema deve classificar chamados só no Workinfinity como "Cancelado sem visita (ok)" (Status=CANCELADA, visitas=0, sem técnico) ou "Possível atendimento não apurado" (alta gravidade) — Regra 1.
- **RF-14** — O sistema deve gerar alerta para chamados que existem só na apuração — Regra 2.
- **RF-15** — O sistema deve sinalizar divergência de status e de número de visitas entre as duas bases — Regra 3.
- **RF-16** — O sistema deve decompor a diferença entre Valor_base_OS e Valor_pago em regra de 40%, baixa tardia (pago zero), multas e outros — Regra 4.
- **RF-17** — O sistema deve validar a regra de visita (grupo por mesmo Stonecode e Data_atendimento; 1 OS a 100% na de maior valor base, demais a 40%) e sinalizar duas OS a 100%, 100% fora da de maior valor e 40% calculado errado — Regra 5.
- **RF-18** — O sistema deve sinalizar anomalias de valor (Valor_pago negativo, Multa > Valor_base_OS, Valor_base_OS = 0 em OS BAIXADA/CANCELADA com visita, multa com Abono) — Regra 6.
- **RF-19** — O sistema deve inferir a tabela de preços típica pela moda de Produto + Grupo_de_serviço + Raio, sinalizar OS que destoam e permitir que o sócio edite a tabela — Regra 7.
- **RF-20** — O sistema deve conferir a coerência entre Raio (R1–R4) e Distancia_em_Km e sinalizar distâncias absurdas (ex.: acima de 1.000 km) — Regra 8.
- **RF-21** — O sistema deve validar a triagem (R$ 5 por equipamento GOOD, soma conferida contra a coluna Triagem do Consolidado) e exibir a aba Bonificação — Regra 9.
- **RF-22** — O sistema deve permitir que o sócio-gestor ligue e desligue cada uma das 9 regras nas Configurações, afetando a geração de novos achados.
- **RF-23** — O sistema deve exibir no Painel geral um card por franquia (8) do mês selecionado com valor base, valor pago, diferença, achados abertos e valor em risco.
- **RF-24** — O sistema deve exibir o Detalhe da franquia com abas Resumo (reconciliação base × pago), Achados (filtrável por regra, gravidade, status, técnico, cidade e serviço), OS sem correspondência, Triagem e Bonificação.
- **RF-25** — O sistema deve permitir que o sócio-gestor marque cada achado como "Contestar", "Aceito" ou "Pendente" e registre uma observação livre.
- **RF-26** — O sistema deve permitir que o sócio-gestor solicite à IA, sob demanda, a explicação de um achado em linguagem simples.
- **RF-27** — O sistema deve permitir que o sócio-gestor solicite à IA, sob demanda, uma sugestão de texto de contestação para a Stone a partir de um achado "Contestar".
- **RF-28** — O sistema deve permitir que o sócio-gestor solicite à IA, sob demanda, a detecção de padrões/anomalias fora das 9 regras, retornando achados informativos.
- **RF-29** — O sistema deve registrar cada chamada de IA (ação, modelo, tokens e custo) para controle de custo.
- **RF-30** — O sistema deve exibir na tela de Tendência gráficos mensais por franquia e consolidados (% do valor base retido, valor em risco, qtd de OS, retenção por regra) e destacar variações atípicas entre meses.
- **RF-31** — O sistema deve permitir que o sócio-gestor selecione os achados marcados como "Contestar" e exporte, por franquia, um XLSX e um PDF com OS, serviço, data, valor base, valor pago, diferença e motivo.
- **RF-32** — O sistema deve permitir que o sócio-gestor edite nas Configurações a tabela de equivalência de nomes das franquias, a tabela de preços inferida e o estado ligado/desligado das regras.
- **RF-33** — O sistema deve permitir que o sócio-gestor reprocesse ou apague um mês já importado de uma franquia.
- **RF-34** — O sistema deve manter o histórico mensal indefinidamente para alimentar os gráficos de tendência.

## 6. Requisitos não-funcionais

- **Performance:** o sistema deve processar meses com cerca de 6 mil OS somando as 8 franquias; o parsing pesado (Latin-1, realinhamento de linhas, 9 regras) roda em Edge Functions do Supabase (não no cliente), mantendo o frontend responsivo. As consultas de painel/achados/tendência usam índices por `audit_period_id`, `reference_month`, `severity`, `review_status`, `stonecode`+`data_atendimento`, `tecnico`, `cidade` e `grupo_servico`.
- **Disponibilidade:** aplicação web acessível por navegador desktop durante o horário de trabalho dos sócios; hospedagem gerenciada (Supabase + frontend Lovable) sem necessidade de operação de infraestrutura pelos sócios.
- **Segurança:** autenticação por e-mail/senha com signup público desligado; universo fechado de 4 sócios. RLS exige `auth.uid() IS NOT NULL` em todas as tabelas; escritas em massa (ingestão/geração de achados) usam `service_role`. Buckets de Storage privados (`source-files`, `contestation-exports`) acessíveis apenas via signed URLs geradas por Edge Function. Chaves de API de IA ficam só nas Edge Functions, nunca no frontend.
- **LGPD / dados pessoais:** o relatório do Workinfinity contém CPF/CNPJ, telefone e endereço de clientes finais; essas colunas são **descartadas no momento do upload**, antes de qualquer persistência, e **nunca são armazenadas nem exibidas**. A Edge Function de ingestão regrava/descartada o original sem as colunas sensíveis; apenas as colunas necessárias à auditoria são mantidas. O flag `dropped_pii_columns` confirma o descarte em cada arquivo.
- **Integridade de dados:** o realinhamento de linhas deslocadas é determinístico e auditável (contagem registrada em `realigned_rows_count` e flag `was_realigned` por registro); a validação do total (soma de valor pago vs Consolidado) é sempre exibida como alerta de consistência.
- **Permissão:** os 4 sócios têm visão completa idêntica das 8 franquias; não há perfil restrito por franquia.

## 7. Métricas de sucesso

1. **Tempo por franquia/mês:** reduzir a conferência de uma franquia para menos de 5 minutos após o upload dos dois arquivos.
2. **Cobertura de realinhamento:** 100% das linhas de "(Tratamento) Sem Retorno" deslocadas detectadas e corrigidas automaticamente, com contagem informada ao sócio.
3. **Consistência do total:** em 100% dos meses processados, exibir a diferença entre a soma de valor pago corrigido e Stone+Ton+Bobina do Consolidado.
4. **Valor contestado recuperado:** acompanhar o R$ em risco identificado versus o R$ efetivamente recuperado junto à Stone ao longo dos meses.
5. **Zero PII armazenada:** nenhuma coluna de CPF/CNPJ, telefone ou endereço de cliente final persistida no banco ou no Storage (verificável por auditoria do schema e dos buckets).

## 8. Fora de escopo

- **Integração com a API do Workinfinity** ou com qualquer sistema da Stone — o upload é 100% manual pelo navegador desktop.
- **Recebimento automático de arquivos** por e-mail ou WhatsApp e disparo automático de processamento — a apuração chega por e-mail aos franqueados e o upload é feito manualmente pelos sócios; não há Make, cron jobs nem webhooks neste projeto.
- **Envio automático da contestação à Stone** — o SCL Audit apenas gera o XLSX e o PDF por franquia; o envio é feito manualmente pelos sócios fora do app.
- **Armazenamento em Drive/ERP externo** dos relatórios gerados — os arquivos ficam nos buckets privados do Supabase.
- **Perfis de acesso restrito por franquia** (ex.: responsável por franquia com visão parcial) — todos os 4 sócios têm visão completa idêntica.
- **Aplicativo mobile nativo** — o uso previsto é exclusivamente via navegador desktop.
- **Automação da IA em todo processamento** — as ações de IA (explicar achado, sugerir contestação, detectar anomalias) são sempre sob demanda, para controle de custo e revisão humana.
