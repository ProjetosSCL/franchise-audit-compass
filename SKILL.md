| # SKILL.md — SCL Audit

Guia operacional para construir o **SCL Audit**: app web interno onde você e mais 3 sócios auditam a apuração que a Stone Pagamentos / Ton envia às **8 franquias de logística**, cruzando o relatório do **Workinfinity** (CSV Latin-1, ~74 colunas) com a apuração da Stone (XLSX de 4 abas), executando **9 regras de auditoria** e gerando a lista de itens a contestar com valor em R$.

Este documento ensina a IA de desenvolvimento **COMO** construir o SCL Audit usando os outros documentos do pacote. Não é teoria genérica: são as regras obrigatórias **deste** projeto.

---

## Convenções

**Stack (não negociável):**
- **Backend: SEMPRE Supabase** — PostgreSQL + Auth (e-mail/senha) + Storage + Edge Functions (Deno) + Realtime. **Não há Cron, Make, N8N, Zapier nem webhooks** neste projeto: todo processamento é disparado pela ação de **upload manual mensal** do sócio no navegador (confirmado na resposta 4). Não introduza automação por e-mail/WhatsApp — a apuração vai para o e-mail dos franqueados fora do app.
- **Frontend: Lovable + Supabase** (React + TypeScript + Tailwind + shadcn/ui + Recharts). Caminho escolhido porque os usuários são **4 sócios-gestores sem time de TI dedicado** — Lovable entrega o app no ar pelo caminho mais rápido. **Não** troque por Next.js/Vue/Angular, **não** troque o banco por Firebase/Mongo.
- **Parsing no navegador:** PapaParse (CSV com `encoding: 'latin1'` e `delimiter: ';'`) + SheetJS (XLSX). Parsing pesado, realinhamento e as 9 regras rodam em **Edge Functions**, não no cliente.
- **IA generativa (resposta 2 = "quero sim"):** usar **Claude Sonnet 4.6 (Anthropic)** via Edge Function para explicar achados em linguagem natural, sugerir textos de contestação à Stone e apontar padrões fora das 9 regras. Nunca expor a API key no frontend.

**Nomenclatura (idêntica a docs/ESTRUTURA.md e docs/DEPARA.md):**
- Tabelas e colunas do Postgres: **inglês, snake_case** (`audit_periods`, `franchise_name_aliases`, `finding_status`).
- Edge Functions: **kebab-case** (`ingest-month-files`, `associate-file-franchise`).
- RPCs/Postgres Functions: **snake_case** (`get_dashboard_cards`).
- Rotas do frontend: **kebab-case** com `/`.
- Se um nome divergir entre documentos, o item está órfão → corrija antes de seguir.

---

## Ordem de implementação recomendada

Siga as **3 fases de docs/PLANO.md** em ordem de dependência:

**Fase 1 — Fundação**
1. Criar o schema completo a partir de **db/schemas.sql**: `franchises` (8 fixas), `franchise_name_aliases`, `audit_periods` (franquia + mês = unidade de processamento), tabelas de linhas importadas, `findings`, tabela de preços inferida e configuração de regras.
2. Habilitar **RLS em TODAS as tabelas**. Como os 4 sócios têm **visão completa idêntica das 8 franquias** (resposta 1), a policy é `auth.uid() IS NOT NULL` — **sem** filtro por franquia. Não criar perfil restrito por franquia.
3. Configurar **Auth por e-mail/senha** restrito aos 4 sócios. Desabilitar signup público.
4. Layout base (shell, navegação, seletor de mês global).

**Fase 2 — Funcionalidades (núcleo)**
5. Páginas conforme **docs/PAGINAS.md**, na ordem: Upload/ingestão → Painel geral → Detalhe da franquia → Tendência → Contestação → Configurações.
6. Edge Functions conforme **docs/FUNCTIONS.md**: `ingest-month-files` (parse + descarte de PII + realinhamento + validação de total + cruzamento + 9 regras), `associate-file-franchise`, RPCs de dashboard/tendência, export XLSX/PDF, e a função de IA (Claude Sonnet 4.6).
7. Integração de IA (explicação de achados + sugestão de contestação).

**Fase 3 — Polimento**
8. Gráficos Recharts de tendência, detecção de variações atípicas entre meses, filtros, estados vazio/erro/loading, export final.

Consulte **docs/DEPARA.md** a cada item para saber exatamente quais tabelas/functions/páginas se tocam.

---

## Como usar cada documento durante o desenvolvimento

- **docs/PRD.md** — Leia **antes de começar qualquer fase** para fixar o objetivo de negócio (conferir se cada atendimento do Workinfinity foi remunerado certo). Volte a ele quando tiver dúvida de "para que serve isto".
- **docs/PRS.md** — Consulte antes de implementar cada RF. Ex.: antes de mexer no upload, releia **RF-02/RF-03** (upload múltiplo + descarte de PII); antes do parsing, **RF-04/RF-05** (CSV Latin-1 e realinhamento "(Tratamento) Sem Retorno"); antes das regras, **RF-08**.
- **db/schemas.sql** — **Fonte única do modelo de dados.** Antes de criar qualquer tabela/coluna, confira se já existe aqui. Nada de tabela improvisada fora deste arquivo.
- **docs/DEPARA.md** — Consulte **antes de criar uma tabela, função ou página nova** para não duplicar e garantir que o nome bate com o resto do pacote. É a matriz banco ↔ functions ↔ páginas.
- **docs/FUNCTIONS.md** — Releia a seção da function **antes de codar cada Edge Function/RPC**: contrato de entrada/saída, qual tabela toca, e o uso de Claude Sonnet 4.6. Lembre: **sem cron/webhook**, tudo disparado por upload.
- **docs/PAGINAS.md** — Releia a seção da página **antes de montá-la**: componentes, permissões (iguais para os 4 sócios) e dados consumidos. As 5 telas: Painel geral, Detalhe da franquia (abas Resumo/Achados/OS sem correspondência/Triagem/Bonificação), Tendência, Contestação, Configurações.
- **docs/PLANO.md** — Seu roteiro de fases. Consulte ao iniciar/encerrar cada etapa para saber o que vem a seguir.

---

## Gates de qualidade

Antes de considerar uma etapa "pronta", verifique:

- [ ] **RLS habilitado** em toda tabela nova, com policy `auth.uid() IS NOT NULL` (visão completa dos 4 sócios).
- [ ] **Nomenclatura** bate exatamente com docs/DEPARA.md (snake_case / kebab-case).
- [ ] Nenhuma tabela/coluna criada fora de **db/schemas.sql**.
- [ ] **PII descartada no upload** (CPF/CNPJ, telefone, endereço do cliente final) — nunca armazenada nem exibida (LGPD). Só as colunas necessárias persistem.
- [ ] **Parsing correto:** CSV com Latin-1 + separador `;`; seriais no formato `="ABC123"` limpos (remover `=` e aspas).
- [ ] **Realinhamento** das linhas "(Tratamento) Sem Retorno" aplicado (Valor_base_OS ← Multa; Valor_pago ← Em_auditoria; Status_pagamento ← Valor_pago; Multa/Em_auditoria ← 0) e **quantidade de linhas corrigidas avisada ao usuário**.
- [ ] **Validação do total:** soma de Valor_pago (pós-correção) × (Stone + Ton + Bobina do Consolidado), com a diferença exibida.
- [ ] **Cruzamento Chamado = OS** como texto sem espaços.
- [ ] Cada uma das **9 regras** aplicada conforme docs/PRD/PRS, gerando achado com OS, valor em R$ e gravidade; cada regra **ligável/desligável**; cada achado marcável como **Contestar/Aceito/Pendente** com observação.
- [ ] **Regra 5 (visita)** testada com grupos de mesmo Stonecode + mesma Data_atendimento (1 OS a 100%, demais a 40%).
- [ ] Volume suportado: **~6.000 OS/mês** para as 8 franquias juntas — paginação e processamento em Edge Function, sem travar o navegador.
- [ ] Estados **vazio / loading / erro** implementados em cada página.
- [ ] Export de contestação gera **XLSX e PDF por franquia** com OS, serviço, data, valor base, valor pago, diferença e motivo.
- [ ] Chamada de IA usa **Claude Sonnet 4.6** via Edge Function (key nunca no frontend).

---

## O que NÃO fazer

- ❌ **Não** usar outro banco (Firebase, Mongo, PlanetScale). Backend é **sempre Supabase**.
- ❌ **Não** trocar o frontend por Next.js/Vue/Angular — é **Lovable (React + Tailwind + shadcn/ui)**.
- ❌ **Não** criar tabela/coluna fora de **db/schemas.sql** nem nome fora de **docs/DEPARA.md**.
- ❌ **Não** pular RLS "por enquanto" — habilite desde a criação de cada tabela.
- ❌ **Não** inventar papéis de usuário: existe **um único papel** (sócio-gestor, 4 pessoas, visão idêntica das 8 franquias). Sem perfil restrito por franquia, sem admin mestre separado.
- ❌ **Não** adicionar Make, N8N, Zapier, cron jobs, webhooks ou integração por e-mail/WhatsApp/API do Workinfinity (resposta 5 = "não"). O gatilho é **só o upload manual**.
- ❌ **Não** armazenar ou exibir PII do cliente final (CPF/CNPJ, telefone, endereço) — descarte no upload.
- ❌ **Não** fazer parsing pesado nem executar as 9 regras no navegador — isso vai para Edge Functions.
- ❌ **Não** ler CSV em UTF-8 nem assumir separador `,` — é **Latin-1** com `;`.
- ❌ **Não** chamar a API da Anthropic direto do cliente — sempre via Edge Function.
- ❌ **Não** ignorar o realinhamento das linhas deslocadas — sem ele, a validação de total e as regras de valor ficam erradas.