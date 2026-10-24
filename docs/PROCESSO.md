## 1. Visão geral

O **SCL Audit** é um aplicativo web de auditoria de apuração para um grupo que administra **8 franquias de logística** prestadoras de serviço de campo da Stone Pagamentos / Ton. Todo mês a Stone envia aos franqueados uma planilha de apuração, e hoje não há como saber, com segurança, se cada atendimento executado foi efetivamente remunerado de forma correta. O SCL Audit resolve isso: para cada franquia e mês, o usuário faz o upload de dois arquivos (o relatório operacional do Workinfinity e a apuração da Stone), e o app cruza as duas bases automaticamente, aplica 9 regras de auditoria e entrega uma lista objetiva de itens a contestar junto à Stone, já com o valor em R$ envolvido. O objetivo final é parar de perder dinheiro em atendimentos não remunerados ou remunerados a menos, transformando uma conferência manual e demorada em um processo de poucos minutos por franquia.

## 2. Papéis de usuário

- **Sócio-gestor (visão completa)**: você e os outros 3 sócios. Como você indicou que o acesso é apenas de "eu e mais 3 sócios", todos os 4 têm **visão completa das 8 franquias** — fazem uploads, revisam achados, decidem o que contestar, editam configurações e exportam os relatórios de contestação. Não há perfil de "responsável por franquia" com visão restrita, pois os únicos usuários são os sócios.

*(Não há outros papéis. Os franqueados recebem a apuração por e-mail da Stone, mas não acessam o SCL Audit — o upload é feito manualmente pelos sócios.)*

## 3. Processo passo a passo por papel

### Sócio-gestor

**A. Upload e processamento do mês**
1. O sócio acessa o SCL Audit pelo navegador no desktop e entra com e-mail e senha.
2. No Painel geral, seleciona o mês de referência que vai auditar.
3. Clica em "Importar mês" e envia **vários arquivos de uma vez**: os relatórios do Workinfinity e as apurações da Stone das franquias que já recebeu.
4. O app identifica automaticamente a qual franquia cada arquivo pertence, usando o nome do Prestador/Franquia e a tabela de equivalência (ex.: "PB - PATOS FRANQUIA" = "POLO PATOS"). Se não reconhecer algum nome, pede ao sócio para associar manualmente à franquia correta — e essa associação fica salva para os próximos meses.
5. No momento do upload, o app descarta as colunas sensíveis do Workinfinity (CPF/CNPJ, telefone, endereço do cliente final) antes de qualquer armazenamento, guardando só o que é necessário para a auditoria.
6. O app detecta e corrige automaticamente as **linhas deslocadas** da apuração da Stone (as linhas de "(Tratamento) Sem Retorno" em que as colunas vêm trocadas) e avisa ao sócio **quantas linhas foram realinhadas**.
7. O app valida se a soma dos valores pagos (após correção) bate com Stone + Ton + Bobina do Consolidado e **mostra a diferença**, se houver, como aviso de consistência.

**B. Cruzamento e geração dos achados**
8. O app cruza as duas bases pela chave Chamado (Workinfinity) = OS (apuração), comparando como texto sem espaços.
9. Aplica as 9 regras de auditoria que estiverem ligadas e gera uma lista de achados, cada um com OS, valor em R$ e nível de gravidade.
10. Opcionalmente, o sócio pede ao assistente de IA que **explique um achado em linguagem simples** (por que aquela OS está sendo contestada e qual o impacto financeiro) e que **aponte padrões ou anomalias fora das 9 regras** — como você confirmou que quer esse apoio de IA.

**C. Revisão por franquia**
11. No Painel geral, o sócio vê um card por franquia do mês selecionado, com valor base, valor pago, diferença, número de achados abertos e valor em risco.
12. Clica numa franquia para abrir o Detalhe e navega pelas abas: Resumo (reconciliação base x pago), Achados (filtrando por regra, gravidade, status, técnico, cidade e serviço), OS sem correspondência, Triagem e Bonificação.
13. Para cada achado, marca o status como **"Contestar", "Aceito" ou "Pendente"** e, se quiser, escreve uma observação. Pode pedir à IA uma **sugestão de texto de contestação** para anexar.

**D. Análise de tendência**
14. Na tela de Tendência, acompanha a evolução mês a mês por franquia e consolidada (percentual do valor base retido, valor em risco, quantidade de OS, retenção por regra) e recebe alertas de variações atípicas entre meses.

**E. Contestação para a Stone**
15. Na tela de Contestação, seleciona todos os achados marcados como "Contestar" e **exporta um XLSX e um PDF por franquia**, com OS, serviço, data, valor base, valor pago, diferença e motivo.
16. Envia manualmente esses arquivos à Stone (fora do app), conforme o fluxo atual da operação.

**F. Manutenção das configurações**
17. Quando necessário, abre as Configurações para editar a tabela de equivalência de nomes das franquias, ajustar a tabela de preços inferida e ligar/desligar regras de auditoria.

## 4. Regras de negócio

- Acesso restrito aos 4 sócios: cada um tem visão completa das 8 franquias; não há perfil com visão limitada a uma única franquia.
- Chave de cruzamento: Chamado (Workinfinity) é igual a OS (apuração) comparados como texto sem espaços — divergências de formatação não devem quebrar o cruzamento.
- Privacidade (LGPD): colunas de CPF/CNPJ, telefone e endereço do cliente final são descartadas no upload e nunca armazenadas nem exibidas.
- Correção de linhas deslocadas: em linhas com Status "(Tratamento) Sem Retorno" onde o valor pago não é numérico, o app realinha as colunas automaticamente (valor base ← Multa; valor pago ← Em auditoria; status de pagamento ← valor pago; Multa e Em auditoria ← 0) e informa a quantidade corrigida.
- Validação de total: a soma dos valores pagos corrigidos deve bater com Stone + Ton + Bobina do Consolidado; qualquer diferença é exibida como alerta.
- Regra 1 (só no Workinfinity): se Status=CANCELADA, visitas=0 e sem técnico → "Cancelado sem visita (ok)"; caso contrário → "Possível atendimento não apurado" com alta gravidade.
- Regra 2 (só na apuração): sempre gera alerta.
- Regra 3: divergência de status entre as bases e divergência no número de visitas geram achado.
- Regra 4: a diferença entre valor base e valor pago é decomposta em regra de 40%, baixa tardia (pago zero), multas e outros.
- Regra 5 (regra de visita): OS do mesmo Stonecode e mesma data de atendimento formam um grupo; exatamente 1 OS por grupo recebe 100% e deve ser a de maior valor base, as demais recebem 40% — grupos com duas OS a 100%, 100% fora da de maior valor ou 40% calculado errado são sinalizados.
- Regra 6 (anomalias de valor): valor pago negativo, Multa maior que valor base, valor base zero em OS BAIXADA/CANCELADA com visita, e multa aplicada junto com Abono geram achado.
- Regra 7 (tabela de preços inferida): o valor base típico é calculado pela moda de Produto + Grupo de serviço + Raio; OS que destoam são sinalizadas; a tabela é editável pelo usuário.
- Regra 8 (Raio x distância): o Raio (R1 a R4) deve ser coerente com a distância em Km (R1 até ~17 km, R2 20–50, R3 52–84, R4 acima de 170); distâncias absurdas (ex.: acima de 1.000 km) são sinalizadas.
- Regra 9 (Triagem): o valor de triagem esperado é R$ 5 por equipamento com status GOOD, e a soma é conferida contra a coluna Triagem do Consolidado; a aba Bonificação também é exibida.
- Cada regra pode ser ligada ou desligada nas Configurações, afetando apenas a geração de novos achados.
- Status de achado: cada achado pode ser "Contestar", "Aceito" ou "Pendente", com campo de observação livre.
- Exportação de contestação: só entram no XLSX/PDF os achados marcados como "Contestar", agrupados por franquia.
- Capacidade de volume: o app deve processar meses em que as 8 franquias somam cerca de 6 mil OS, mantendo o histórico mensal para os gráficos de tendência.
- Uso exclusivo por navegador desktop, com upload manual mensal — não há recebimento automático de arquivos por e-mail/WhatsApp nem disparo automático de processamento.

## 5. Suposições assumidas

- SUPOSIÇÃO: Como você indicou "eu e mais 3 sócios" sem distinguir permissões entre eles, assumi que os 4 sócios têm exatamente o mesmo nível de acesso (visão completa das 8 franquias e todas as ações), sem um perfil "administrador mestre" separado.
- SUPOSIÇÃO: Assumi que o histórico mensal é mantido indefinidamente (ou por um período amplo) para alimentar os gráficos de tendência, já que você citou o volume de ~6 mil OS/mês mas não definiu um limite de meses a guardar.
- SUPOSIÇÃO: Como você confirmou querer apoio de IA para explicar achados, sugerir textos de contestação e identificar padrões fora das 9 regras, assumi que esse uso é opcional e acionado pelo sócio sob demanda (e não automático em todo processamento), para manter controle sobre custo e revisão humana.
- SUPOSIÇÃO: Assumi que o envio da contestação à Stone continua sendo feito manualmente pelo sócio fora do app (apenas a geração do XLSX/PDF é responsabilidade do SCL Audit), já que você indicou não precisar de integração de envio automático.