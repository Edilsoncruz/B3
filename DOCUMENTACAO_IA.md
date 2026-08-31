# Documentação Completa: Smart Money Tracker AI 2

Este documento descreve o funcionamento detalhado do **Smart Money Tracker AI 2**, um sistema avançado de análise quantitativa e qualitativa do mercado financeiro brasileiro (B3). O foco do sistema é identificar oportunidades de **Bottom Fishing** (reversão de tendência em ativos sobrevendidos) e rastreamento de **Smart Money** (fluxo institucional).

---

## 1. O Que o Sistema Faz e Em Que Ordem (O Pipeline)

O sistema atua como um analista de investimentos automatizado e sistemático. A execução ocorre em uma ordem estrita (Pipeline) para garantir eficiência e precisão:

### Etapa 1: Definição do Universo Inicial
O sistema carrega um catálogo com os principais ativos da B3, mapeando empresas de todos os setores. Esta é a base de dados bruta.

### Etapa 2: Triagem e Filtros Pré-IA (Screener Técnico)
Antes de gastar processamento e tokens de IA, o sistema aplica filtros matemáticos e técnicos rigorosos. O objetivo é remover "ruído" e ativos inoperáveis. *(Veja a seção 5 para as sugestões de implementação técnica destes filtros).*

### Etapa 3: Atualização de Dados (Data Fetching)
Para os ativos que sobreviveram aos filtros iniciais, o sistema busca os dados mais recentes de mercado (cotações, volume, indicadores técnicos) e de fundamentos (P/L, ROE, VPA) através de APIs financeiras.

### Etapa 4: Análise Multi-Agente (Processamento IA)
Os dados atualizados são enviados para a arquitetura de Inteligência Artificial, onde diferentes "agentes" (modelos) assumem papéis específicos para analisar, pontuar e revisar cada ativo.

### Etapa 5: Consolidação e Auditoria (Banco de Dados)
Todas as análises, pontuações (scores), decisões e justificativas são salvas no Supabase. O módulo `AuditManager` registra o histórico completo do que a IA pensou, garantindo total transparência.

---

## 2. Papéis de Cada Componente IA (Arquitetura Multi-Agente)

A análise não é feita por um único "cérebro", mas dividida em "Camadas" (Layers) com papéis definidos:

*   **Agente 1: A Triadora (IA "Luna" - Filtro Quantitativo)**
    *   **Papel:** Reduzir a lista de dezenas de papéis para os "Top Candidatos".
    *   **Ação:** Analisa o contexto geral (queda, suporte, volume) e descarta ativos que não apresentam sinais claros de oportunidade imediata.
*   **Agente 2: O Estrategista (IA "Terra" / Gemini - Análise Profunda)**
    *   **Papel:** Desenhar o trade (operação) completo.
    *   **Ação:** Define o *Score* final, traça o alvo de lucro, posiciona o *Stop Loss* (sempre com folga técnica abaixo de suportes para evitar violinadas) e calcula a probabilidade de acerto com base no histórico e fundamentos.
*   **Agente 3: O Auditor (IA "Sol" - Revisor Cético)**
    *   **Papel:** Validar e auditar as operações propostas pelo Estrategista.
    *   **Ação:** Não cria ideias novas. Apenas verifica se a relação Risco x Retorno faz sentido e se a probabilidade não está otimista demais. Pode classificar o trade como: **APROVADO**, **APROVADA_COM_RESSALVAS**, ou **REJEITADA**.

---

## 3. Como a IA Pensa e Age

A inteligência do sistema baseia-se em combinar **análise técnica** (gráficos) com **análise fundamentalista** (saúde da empresa) e **fluxo** (Smart Money).

1.  **Identificação do Fundo (Bottom Fishing):** A IA busca ativos que sofreram quedas fortes (geralmente próximos à mínima de 52 semanas ou de períodos dinâmicos) e que pararam de cair.
2.  **Rastreio do Smart Money:** A IA procura divergências: o preço parou de cair, mas o volume de negociação aumentou significativamente. Isso indica que "mãos fortes" (instituições) estão acumulando o ativo silenciosamente.
3.  **Gerenciamento de Risco Rígido:** A IA é programada para rejeitar operações onde o risco é maior que a metade do retorno esperado (Risco:Retorno mínimo de 1:2).
4.  **Memória e Contexto (Base de Conhecimento):** A IA consulta o banco de dados de operações passadas. Se um padrão falhou no passado para um ativo específico, ela se torna mais rigorosa antes de recomendá-lo novamente.

---

## 4. Classificação, Scoring e Probabilidade

Cada ativo analisado recebe uma classificação estruturada gerada pela IA "Terra":

*   **Score (0 a 100):** Uma pontuação agregada que reflete a atratividade do ativo.
    *   *Fatores de peso:* Proximidade de suportes fortes, anomalias de volume (Smart Money), valuation atrativo (P/L baixo) e qualidade da empresa (ROE).
*   **Nível de Suporte:** Classificado de Fraco a Extremo. A IA identifica se o preço está em uma região histórica onde os compradores costumam defender posições.
*   **Probabilidade de Sucesso (%):** Uma estimativa de confiança da IA baseada na convergência de sinais. Exemplo: um ativo no suporte técnico + P/L descontado + aumento de volume recebe uma probabilidade muito maior (ex: 85%) do que um ativo caindo sem volume (ex: 40%).

---

## 5. Sugestão de Implementação: Filtros Iniciais (Screener Otimizado)

Para garantir que a IA analise apenas os ativos mais promissores e evitar que o capital fique "preso" em operações estagnadas, propõe-se a implementação dos seguintes **Filtros Determinísticos (Pré-IA)** na Etapa 2 do pipeline.

Estes filtros devem ser aplicados programaticamente *antes* do envio de dados para os modelos LLM:

1.  **Filtro Anti-Mico (Penny Stocks):**
    *   `Preço >= 5 BRL`
    *   **Objetivo:** Eliminar ativos excessivamente manipuláveis e com volatilidade matemática irreal, protegendo o gerenciamento de risco.
2.  **Filtro de Liquidez Profunda:**
    *   `Volume Financeiro Médio (10 Dias) >= 20.000.000 BRL` (20 milhões de Reais)
    *   **Objetivo:** Garantir que o sistema só recomende ativos institucionais, permitindo entradas e saídas rápidas sem sofrer com *slippage* (spread do book).
3.  **Filtro de Amplitude / Volatilidade:**
    *   `ATR (Average True Range, 14 períodos) >= 3%`
    *   **Objetivo:** Filtrar ações "mortas" ou lateralizadas. O ativo precisa ter um range médio de movimentação diária de pelo menos 3% para que os alvos da operação sejam atingidos em um tempo razoável.
4.  **Filtro de Agressividade / Momentum:**
    *   `Beta (5 Anos) >= 1.2`
    *   **Objetivo:** Selecionar ações que tendem a se mover com mais força que o Ibovespa (benchmarking). Ações com alto beta respondem mais rápido às reversões de mercado.
