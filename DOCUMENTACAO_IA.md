# Documentação do Sistema: Smart Money Tracker AI 2

Este documento descreve o funcionamento do **Smart Money Tracker AI 2**, um sistema avançado de análise quantitativa e qualitativa do mercado financeiro brasileiro (B3), focado em identificar oportunidades de **Bottom Fishing** (reversão de tendência) e rastreamento de **Smart Money** (fluxo institucional).

---

## 1. O que o sistema faz?

O sistema atua como um analista de investimentos automatizado de alta precisão para **Swing e Position Trading**. Em vez de olhar aleatoriamente para os gráficos, o sistema executa um **Pipeline Inteligente de 5 Etapas**, garantindo que apenas as melhores oportunidades reais cheguem até o usuário final.

### O Pipeline Inteligente (5 Etapas)

1. **Universo Inicial (Catálogo B3):** O sistema mapeia um catálogo completo com mais de 400 ativos principais da B3, englobando todos os setores (Petróleo, Bancos, Energia, Varejo, etc.).
2. **Seleção Inteligente (Filtros e Triagem IA):** Aplica filtros técnicos para remover "lixo" (penny stocks, ativos sem liquidez) e depois usa uma IA quantitativa para triar as melhores oportunidades.
3. **Atualização Incremental:** Busca dados frescos (cotações, fundamentos, volume) apenas para as ações que passaram pela peneira inicial, economizando requisições de API.
4. **Consolidação de Dados (Supabase):** Salva e organiza todo o histórico, cotações e fundamentos de forma estruturada no banco de dados.
5. **Estratégia de IA (Análise Profunda):** A Inteligência Artificial consome esses dados estruturados para desenhar operações completas (Alvo, Stop Loss, Probabilidade de Acerto).

---

## 2. Como é feita a análise pela IA?

O grande diferencial do sistema é sua arquitetura multi-agente (várias IAs trabalhando em conjunto). A análise é dividida em "Camadas" (Layers) de Inteligência Artificial:

### Camada 1: Filtros Determinísticos (Pré-IA)
Antes de qualquer IA analisar, o código remove ativos com preço abaixo de R$ 1,00 ou volume médio abaixo de 150 mil, garantindo que a IA não perca tempo com ações não operáveis.

### Camada 2: Triagem Inteligente (IA "Luna")
- **Modelo Utilizado:** `gpt-5.6-luna` (Filtro Quantitativo)
- **Função:** Avalia o universo de ações e cria um ranking das melhores opções para "Bottom Fishing". 
- **Como analisa:** Ela avalia dinamicamente múltiplos fatores (queda acumulada, suporte, fundamentos, volume) sem usar pesos fixos matemáticos. A IA entende o momento do mercado e decide quais fatores são mais importantes, gerando uma lista reduzida de "candidatas".

### Camada 3: Analista Sênior (IA "Terra" / Gemini)
- **Modelo Utilizado:** `gpt-5.6-terra` ou `Gemini 2.5 Flash` (Estratégia Principal)
- **Função:** Atua como o especialista em *Smart Money*. 
- **Como analisa:**
  - Busca ações em **Sobrevenda Extrema** (fundo de 52 semanas) e sinais de que grandes instituições ("Smart Money") estão acumulando.
  - **Stop Loss:** Segue uma regra rígida de não usar stops curtos. O stop é posicionado com folga técnica (10% a 25%) abaixo de suportes críticos para evitar violinadas (estopagem prematura por ruído de mercado).
  - **Risco x Retorno:** Garante um alvo realista para que a proporção Risco/Retorno seja de pelo menos 1:2.
  - **Probabilidade de Sucesso:** Estima uma probabilidade percentual (ex: 82%) com base no histórico e nos fundamentos da empresa (PL, VPA, ROE, Dívida).
  - **Base de Conhecimento:** Consulta indicações passadas (lucro ou perda) no banco de dados. Se a IA recomendou uma ação antes e deu prejuízo, ela se torna mais rigorosa com esse ativo. Se encontrou um novo padrão vencedor, ela salva esse "Insight" para as próximas análises.

### Camada 4: Revisor Independente (IA "Sol")
- **Modelo Utilizado:** `gpt-5.6-sol` (Auditoria e Revisão)
- **Função:** Uma IA cética que audita as recomendações da Camada 3.
- **Como analisa:** Não propõe novas ações, apenas valida as que foram escolhidas. Ela verifica o *Score*, a *Probabilidade*, o *Nível de Suporte* e a coerência do *Risco x Retorno*. Ao final, ela define se a operação está: **APROVADA**, **APROVADA_COM_RESSALVAS**, ou **REJEITADA** (com justificativas estruturadas).

### Auditoria e Logs (AuditManager)
O sistema possui um componente poderoso de Auditoria (`AuditManager`) que registra no banco de dados cada passo da IA: quais ativos foram eliminados, por quais motivos, os tokens gastos e o tempo de execução. Isso garante total transparência sobre o motivo de uma ação ter sido escolhida em detrimento de outra.

## Resumo do Diferencial
A análise não é um simples "prompt" perguntando quais ações comprar. É um processo robusto de **eliminação progressiva**, validação por **múltiplas IAs**, regras rígidas de **gerenciamento de risco** e um sistema de **aprendizado contínuo** (Base de Conhecimento) que lembra de erros e acertos passados.
