# docs/PAGINAS.md — SCL Audit

> Documentação de todas as páginas do frontend do **SCL Audit**, conforme a ESTRUTURA. Caminho de build: **Lovable + Supabase** (React + TypeScript + Tailwind + shadcn/ui + Recharts). Todas as páginas, exceto `/login`, exigem usuário autenticado (`auth.uid() IS NOT NULL`).
>
> **Papel único de usuário:** os 4 **sócios-gestores** têm **visão completa idêntica das 8 franquias** e acesso a todas as ações. Não existe perfil restrito por franquia nem "administrador mestre" separado. Portanto, em todas as páginas abaixo, as permissões são as mesmas para os 4 sócios — não há diferença de tela por papel. Usuários não autenticados são redirecionados para `/login`.

---

### `/login`

- **Rota:** `/login`
- **Propósito:** Autenticar os 4 sócios por e-mail e senha para acessar o SCL Audit.
- **Seções da tela:**
  - Logo / título "SCL Audit".
  - Formulário de login (campo e-mail, campo senha, botão "Entrar").
  - Link "Esqueci minha senha" (fluxo de recuperação via Supabase Auth).
  - Nota de rodapé informando que o acesso é restrito aos sócios (signup público desligado).
- **Estados:**
  - **Vazio/inicial:** formulário limpo pronto para preenchimento.
  - **Carregando:** botão "Entrar" com spinner e campos desabilitados durante a validação.
  - **Erro:** mensagem clara para credenciais inválidas ("E-mail ou senha incorretos") ou falha de rede; não revela se o e-mail existe.
- **Permissões:** Pública (única página sem autenticação). Após login bem-sucedido, redireciona para `/` (Painel geral). Usuários já logados que acessam `/login` são enviados direto para `/`.

---

### `/` (Painel geral)

- **Rota:** `/`
- **Propósito:** Dar a visão consolidada do mês selecionado com um card por franquia, mostrando valor base, valor pago, diferença, achados abertos e valor em risco.
- **Seções da tela:**
  - **Barra superior:** seletor de mês de referência (dropdown/date picker por mês) e botão de destaque **"Importar mês"** (leva a `/importar`).
  - **Faixa de totais consolidados** das 8 franquias para o mês (soma de valor base, valor pago, diferença total, total de achados abertos, valor em risco total).
  - **Grade de cards por franquia (8):** cada card mostra nome da franquia, status do período (`pending/processing/processed/error`), valor base, valor pago, diferença, nº de achados abertos e valor em risco; indicador visual quando há diferença de validação do total (Stone+Ton+Bobina) ou linhas realinhadas. Clique no card abre `/franquia/:franchiseId/:month`.
  - **Atalho opcional de IA:** botão "Detectar anomalias" (aciona `ai-detect-anomalies`) para o mês/consolidado.
- **Estados:**
  - **Vazio:** quando o mês selecionado ainda não tem nenhuma franquia importada — mensagem "Nenhuma apuração importada para este mês" com CTA "Importar mês". Franquias sem arquivo aparecem como cards "não importado".
  - **Carregando:** skeletons nos cards enquanto `get_dashboard_cards` responde.
  - **Erro:** banner de erro ao buscar os cards, com botão "Tentar novamente"; cards de franquias com `status = 'error'` no processamento destacam um alerta e link para reprocessar no Detalhe.
- **Permissões:** Todos os 4 sócios, visão completa das 8 franquias. Sem diferença por papel.

---

### `/importar`

- **Rota:** `/importar`
- **Propósito:** Fazer o upload múltiplo dos arquivos do mês, disparar a ingestão/processamento e resolver a associação de arquivos a franquias quando o nome não é reconhecido.
- **Seções da tela:**
  - **Seletor de mês de referência** (pré-preenchido com o mês vindo do Painel).
  - **Área de upload múltiplo** (drag & drop + seletor de arquivos) aceitando vários CSV (Workinfinity) e XLSX (Stone) de uma vez.
  - **Lista de arquivos enviados** com, por arquivo: nome original, tipo detectado (`workinfinity_csv` / `stone_xlsx`), franquia detectada (via `franchise_name_aliases`), nº de linhas e status de ingestão.
  - **Painel de resultado do processamento** por franquia/período: nº de **linhas realinhadas** ("Sem Retorno"), **diferença de validação do total** (soma valor pago vs Stone+Ton+Bobina) e confirmação de descarte das colunas de PII (LGPD).
  - **Tela/bloco de associação manual:** quando o nome do Prestador/Franquia não é reconhecido, lista o `detected_raw_name` e oferece dropdown das 8 franquias para associar; salva a equivalência (aciona `associate-file-franchise`) e reprocessa o arquivo.
  - **Botão "Importar mês"** (dispara `ingest-month-files` → `process-audit-period`) e link para voltar ao Painel após concluir.
- **Estados:**
  - **Vazio:** área de upload sem arquivos, com instruções sobre os 2 tipos de arquivo esperados por franquia.
  - **Carregando:** barra de progresso por arquivo (upload → parsing → realinhamento → geração de achados); bloqueia novo clique em "Importar mês" enquanto processa.
  - **Erro:** por arquivo, mensagem específica (ex.: encoding inválido, aba XLSX ausente, franquia não reconhecida pendente de associação, falha de validação de total) sem interromper os demais arquivos; itens com erro ficam marcados e podem ser reenviados.
- **Permissões:** Todos os 4 sócios. Qualquer sócio pode importar, associar nomes e reprocessar. Sem diferença por papel.

---

### `/franquia/:franchiseId/:month` (Detalhe da franquia)

- **Rota:** `/franquia/:franchiseId/:month`
- **Propósito:** Mostrar a auditoria completa de uma franquia num mês, com reconciliação, achados revisáveis, OS sem correspondência, triagem e bonificação.
- **Seções da tela:**
  - **Cabeçalho:** nome da franquia + mês, status do período, botão "Reprocessar mês" (service_role via Edge Function) e atalho para `/contestacao`.
  - **Aba Resumo:** reconciliação base × pago (via `get_franchise_reconciliation`): valor base total, valor pago total, diferença, diferença de validação do total, nº de linhas realinhadas e cards de valor em risco / achados abertos.
  - **Aba Achados:** tabela filtrável (via `get_findings`) por **regra, gravidade, status, técnico, cidade e serviço**; cada linha mostra OS, Stonecode, serviço, data, valor base, valor pago, diferença, gravidade, título e detalhe. Ações por achado: marcar **Contestar / Aceito / Pendente**, campo de **observação**, e botões de IA **"Explicar achado"** (`ai-explain-finding`) e **"Sugerir contestação"** (`ai-suggest-contestation`), exibindo `ai_explanation` / `ai_contestation_text`.
  - **Aba OS sem correspondência:** duas listas (via `get_unmatched_os`) — "só no Workinfinity" (com classificação da regra 1: "Cancelado sem visita (ok)" vs "Possível atendimento não apurado") e "só na apuração" (regra 2).
  - **Aba Triagem:** registros de triagem (serial, status GOOD/BAD, valor), valor esperado (R$ 5 por equipamento GOOD) e conferência contra a coluna Triagem do Consolidado (regra 9).
  - **Aba Bonificação:** TMA Stone/Ton, ciclo, retirados, triados, triados good, aproveitamento de triagem e campos RV_* (do `rv_payload`).
- **Estados:**
  - **Vazio:** quando a franquia/mês não foi importada — aviso "Período não processado" com CTA "Importar mês"; abas individuais vazias mostram "Nenhum achado"/"Sem OS sem correspondência"/"Sem dados de triagem/bonificação".
  - **Carregando:** skeletons na tabela de achados e nos cards de resumo; indicador de carregamento ao aplicar filtros.
  - **Erro:** banner por aba em caso de falha de RPC; se `status = 'error'`, exibe mensagem de falha de processamento com botão "Reprocessar".
- **Permissões:** Todos os 4 sócios, acesso total a todas as abas e ações (marcar status, observação, IA, reprocessar). Sem diferença por papel.

---

### `/tendencia`

- **Rota:** `/tendencia`
- **Propósito:** Acompanhar a evolução mês a mês, por franquia e consolidada, dos principais indicadores de auditoria e destacar variações atípicas.
- **Seções da tela:**
  - **Filtros:** seletor de franquia (ou "Consolidado das 8") e janela de meses.
  - **Gráficos Recharts (via `get_trend_series`):** % do valor base retido ao longo dos meses, valor em risco por mês, quantidade de OS por mês e retenção por regra (quais regras mais geram achados/valor).
  - **Destaque de variações atípicas:** cards/alertas para meses com flag de variação atípica entre períodos.
  - **Atalho opcional de IA:** "Analisar padrões" (`ai-detect-anomalies`) sobre a série agregada.
- **Estados:**
  - **Vazio:** quando há menos de 2 meses de histórico — mensagem "Histórico insuficiente para tendência" e indicação de importar mais meses.
  - **Carregando:** skeletons nos gráficos enquanto as séries carregam.
  - **Erro:** banner de erro com "Tentar novamente"; gráficos individuais mostram estado de falha isolado.
- **Permissões:** Todos os 4 sócios, visão de qualquer franquia e do consolidado. Sem diferença por papel.

---

### `/contestacao`

- **Rota:** `/contestacao`
- **Propósito:** Selecionar os achados marcados como "Contestar" e exportar um XLSX e um PDF por franquia, prontos para envio manual à Stone.
- **Seções da tela:**
  - **Filtros:** seletor de mês e de franquia (ou todas).
  - **Lista de achados "Contestar"** agrupada por franquia, com OS, serviço, data, valor base, valor pago, diferença, motivo e eventual texto de contestação sugerido pela IA; checkbox para incluir/excluir cada item.
  - **Totalizador:** soma do valor a contestar por franquia e geral.
  - **Botões de exportação:** "Exportar XLSX" e "Exportar PDF" por franquia (acionam `export-contestation`), com retorno de signed URLs para download.
  - **Histórico/retorno dos arquivos gerados** (links de download recentes do bucket `contestation-exports`).
- **Estados:**
  - **Vazio:** quando nenhum achado está marcado como "Contestar" no filtro escolhido — mensagem "Nenhum achado marcado para contestar" com link para o Detalhe da franquia.
  - **Carregando:** spinner nos botões de exportação durante a geração do XLSX/PDF; lista com skeleton ao carregar achados.
  - **Erro:** mensagem caso a geração do arquivo falhe ("Não foi possível gerar o arquivo, tente novamente"); itens que não puderam ser incluídos são sinalizados.
- **Permissões:** Todos os 4 sócios podem selecionar e exportar. O envio à Stone é feito manualmente fora do app. Sem diferença por papel.

---

### `/configuracoes`

- **Rota:** `/configuracoes`
- **Propósito:** Manter a equivalência de nomes das franquias, a tabela de preços inferida/editável e o estado ligado/desligado das 9 regras de auditoria.
- **Seções da tela:**
  - **Seção Equivalência de nomes (`franchise_name_aliases`):** tabela com `raw_name` → franquia canônica; ações de adicionar, editar e remover aliases (match tolerante por `raw_name_normalized`).
  - **Seção Tabela de preços (`price_table_entries`):** grade por Produto + Grupo de serviço + Raio com o valor base esperado (moda inferida); edição manual marca `is_manual_override`; botão "Recalcular/inferir" (aciona `infer-price-table`) sem sobrescrever overrides manuais.
  - **Seção Regras de auditoria (`audit_rules`):** lista das 9 regras com nome, descrição e toggle liga/desliga (`is_enabled`), afetando apenas a geração de novos achados.
  - **Bloco informativo opcional:** resumo de uso/custo de IA (a partir de `ai_usage_log`).
- **Estados:**
  - **Vazio:** seções exibem estado inicial — aliases vazio ("Nenhuma equivalência cadastrada"), tabela de preços sem entradas ("Rode a inferência após importar meses"), regras sempre presentes (seed 1..9).
  - **Carregando:** skeletons por seção e spinners nos botões de salvar/recalcular.
  - **Erro:** mensagem por seção em caso de falha ao salvar alias, override de preço ou toggle de regra; mantém os valores anteriores até confirmação.
- **Permissões:** Todos os 4 sócios podem editar aliases, preços e ligar/desligar regras. Sem diferença por papel.
