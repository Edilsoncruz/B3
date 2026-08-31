# DOCUMENTAÇÃO COMPLETA — Smart Money Tracker AI 3.2

## Sistema Inteligente de Análise do Mercado Financeiro Brasileiro — B3

**Versão:** 3.2
**Nome do sistema:** Smart Money Tracker AI 3
**Objetivo principal:** Identificar oportunidades de reversão em ativos pressionados, especialmente configurações de Bottom Fishing associadas a possíveis sinais de Smart Money, utilizando análise técnica, volume, fundamentos, valuation, risco, contexto macroeconômico e pesquisa externa — com separação rigorosa entre o que pode ser resolvido de forma determinística e o que exige interpretação por IA.

---

# 1. VISÃO GERAL

O **Smart Money Tracker AI 3.2** é um sistema inteligente de análise do mercado financeiro brasileiro, com foco em ativos negociados na **B3**.

A essência do sistema permanece:

> **Bottom Fishing + Reversão + Smart Money**

O sistema busca identificar ativos que sofreram pressão ou quedas relevantes e que apresentem sinais de possível exaustão da tendência, especialmente quando existe confluência entre:

- Região de suporte relevante;
- Proximidade de mínimas;
- Exaustão da queda;
- Estrutura de reversão;
- Anomalias de volume;
- Possível acumulação;
- Condições favoráveis de risco/retorno.

As análises fundamentalista, valuation, setorial, macroeconômica e de eventos são utilizadas para **confirmar, qualificar ou rejeitar a tese principal**.

O sistema também evolui para permitir análise de:

- Oportunidades ainda não adquiridas;
- Posições já abertas;
- Carteira do usuário;
- Informações fornecidas pelo usuário;
- Imagens;
- PDFs;
- CSVs;
- TXTs;
- Planilhas;
- Relatórios;
- Outros documentos suportados.

---

# 2. IDENTIDADE DO SISTEMA

A identidade do Smart Money Tracker AI não deve ser perdida durante sua evolução.

O sistema **não é simplesmente um screener fundamentalista**.

Sua principal vantagem competitiva está em encontrar situações onde:

```text
QUEDA / PRESSÃO
       +
REGIÃO DE SUPORTE
       +
EXAUSTÃO / REVERSÃO
       +
VOLUME / POSSÍVEL SMART MONEY
       ↓
CONFIGURAÇÃO DE BOTTOM FISHING
```

Os fundamentos e demais informações devem ajudar a responder:

> **"Essa possível reversão está acontecendo em um ativo que faz sentido acompanhar?"**

e não substituir a análise de preço e fluxo.

---

# 3. PRINCÍPIOS FUNDAMENTAIS

## 3.1 Dados antes da opinião

A IA deve primeiro analisar os dados disponíveis e somente depois construir sua interpretação.

---

## 3.2 Separação entre fato e interpretação

Toda informação deve ser classificada como:

### DADO

Informação objetiva fornecida pelo sistema.

Exemplo:

> Preço atual: R$ XX,XX.

### FONTE EXTERNA

Informação obtida através de pesquisa.

Exemplo:

> A companhia divulgou determinado fato relevante.

### CONTEXTO DO USUÁRIO

Informação fornecida diretamente pelo usuário.

Exemplo:

> Tenho 1.500 ações compradas a R$ 32,80.

### INTERPRETAÇÃO

Conclusão produzida pela IA.

Exemplo:

> A perda do suporte pode invalidar a tese de reversão.

---

# 4. REGRA ABSOLUTA — NÃO INVENTAR DADOS

A IA nunca deve inventar:

- Preços;
- Indicadores;
- Resultados;
- Notícias;
- Datas;
- Eventos;
- Informações financeiras;
- Informações sobre posição;
- Fontes;
- Dados históricos;
- Probabilidades;
- Valores de mercado.

Quando uma informação não estiver disponível:

> **DADO NÃO DISPONÍVEL**

Quando houver conflito entre fontes:

> **INFORMAÇÕES CONFLITANTES**

A IA deve informar o conflito e utilizar a fonte de maior confiabilidade.

---

# 5. HIERARQUIA DAS FONTES

Quando pesquisa externa for necessária, a prioridade deve ser:

1. Dados fornecidos diretamente pela aplicação;
2. B3;
3. CVM;
4. Relações com Investidores;
5. Documentos oficiais da companhia;
6. Fatos relevantes;
7. Comunicados;
8. Fontes financeiras reconhecidas;
9. Notícias;
10. Outras fontes.

A IA deve considerar:

- Data da informação;
- Atualidade;
- Credibilidade;
- Contexto;
- Possibilidade de confirmação;
- Eventuais divergências.

---

# 6. PRINCÍPIO ARQUITETURAL CENTRAL — DETERMINÍSTICO ANTES DE IA

Esta é a regra que organiza toda a arquitetura da versão 3.2:

> **Tudo que puder ser resolvido de forma objetiva e determinística deve ser resolvido antes de chamar a IA. Tudo que exigir interpretação deve ficar com a IA.**

Isso significa que o sistema é dividido em camadas com responsabilidades e natureza distintas:

| Camada | Responsabilidade | Usa IA? |
|---|---|---|
| **Filtros Pré-IA** | Liquidez, preço, ATR, beta etc. | ❌ |
| **Gate Bottom Fishing** | Queda + proximidade de mínima + condições mínimas | ❌ |
| **Luna** | Interpretação técnica + suporte + volume + Smart Money | ✅ |
| **Terra** | Tese completa + risco + operação | ✅ |
| **Sol** | Contestação e auditoria | ✅ |

Essa separação reduz custo de tokens, reduz variabilidade de respostas, elimina falsos candidatos antes de gastar processamento de IA e deixa cada camada com uma responsabilidade única e não ambígua.

---

# 7. ARQUITETURA GERAL

O sistema utiliza três agentes de IA:

```text
LUNA
TRIADORA (interpretação)

TERRA
ESTRATEGISTA

SOL
AUDITOR
```

E somente três Skills principais:

```text
B3_ANALYST
B3_RESEARCH
B3_CONTEXT
```

As Skills são competências compartilhadas, e não novos agentes.

**Filtros Pré-IA** e **Gate Bottom Fishing** não são agentes nem Skills — são camadas determinísticas de regras que rodam antes de qualquer chamada de IA.

---

# 8. ARQUITETURA COMPLETA

```text
                         USUÁRIO
                            │
                            ▼
                 ┌─────────────────────┐
                 │    B3_CONTEXT       │
                 │                     │
                 │ Texto               │
                 │ Posições            │
                 │ Imagens             │
                 │ PDFs                │
                 │ CSV                 │
                 │ TXT                 │
                 │ Planilhas           │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │    DADOS DO SISTEMA │
                 │                     │
                 │ B3                  │
                 │ Histórico           │
                 │ Preços              │
                 │ Volume              │
                 │ Indicadores         │
                 │ Fundamentos         │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │  FILTROS PRÉ-IA     │   ❌ sem IA
                 │                     │
                 │ Liquidez            │
                 │ Preço               │
                 │ Volatilidade        │
                 │ Beta                │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │  GATE BOTTOM        │   ❌ sem IA
                 │  FISHING            │
                 │                     │
                 │ Queda               │
                 │ Proximidade mínima  │
                 │ Estrutura básica    │
                 └──────────┬──────────┘
                            │
                 ┌──────────┴──────────┐
                 │                     │
             REJEITADO           CANDIDATO /
                 │              CANDIDATO FORTE
                 ▼                     │
                FIM                    ▼
                             ┌───────────────┐
                             │     LUNA      │   ✅ IA
                             │   TRIADORA    │
                             └───────┬───────┘
                                     │
                                     ▼
                             ┌───────────────┐
                             │     TERRA     │   ✅ IA
                             │ ESTRATEGISTA  │
                             └───────┬───────┘
                                     │
                       ┌─────────────┴─────────────┐
                       │                           │
                       ▼                           ▼
                ┌──────────────┐          ┌────────────────┐
                │ B3_ANALYST   │          │ B3_RESEARCH    │
                │              │          │                │
                │ Metodologia  │          │ B3 / CVM / RI  │
                │ financeira   │          │ Notícias       │
                └──────────────┘          └───────┬────────┘
                                                  │
                                                  ▼
                                         ┌────────────────┐
                                         │      SOL       │   ✅ IA
                                         │    AUDITOR     │
                                         └───────┬────────┘
                                                 │
                                                 ▼
                                         ┌────────────────┐
                                         │ PARECER FINAL  │
                                         └───────┬────────┘
                                                 │
                                                 ▼
                                            SUPABASE
```

---

# 9. AGENTE LUNA — TRIADORA

## Função

A Luna atua **somente sobre ativos que já passaram pelo Gate Bottom Fishing** (classificados como CANDIDATO ou CANDIDATO FORTE — ver seção 10).

Seu papel não é decidir se vale a pena olhar para o ativo — isso já foi resolvido de forma determinística. Seu papel é **interpretar** o que os dados desse candidato realmente indicam.

A Luna deve ser objetiva, mas seu trabalho é qualitativo por natureza: ela lida com aquilo que não pode ser resolvido só com um threshold numérico (qualidade do suporte, presença de exaustão, sinais compatíveis com Smart Money).

---

## 9.1 Responsabilidades

- Avaliar a **qualidade** da queda (não apenas se ela existe — isso é do Gate);
- Avaliar a **qualidade** da região de suporte;
- Classificar o nível de suporte;
- Avaliar exaustão;
- Avaliar reversão;
- Avaliar volume;
- Avaliar Smart Money;
- Identificar divergências;
- Classificar a configuração;
- Preparar candidatos para o Terra.

### Observação importante

> **A Luna não deve reavaliar critérios já resolvidos pelo Gate** (queda mínima, proximidade de mínima, liquidez, volatilidade). Sua função é interpretar o que os dados significam, não redecidir a elegibilidade quantitativa — isso evita duplicidade de responsabilidade entre as duas camadas.

---

# 10. GATE BOTTOM FISHING — ETAPA DETERMINÍSTICA

## Função

O Gate é uma etapa **100% determinística**, executada com dados quantitativos já disponíveis, **sem qualquer chamada a modelos de IA**.

Ele roda depois dos Filtros Pré-IA e antes da Luna.

A pergunta que o Gate responde é:

> **"Vale a pena gastar processamento de IA neste ativo?"**

Isso é deliberadamente diferente da pergunta que a Luna responde:

> **"O que os dados desse candidato indicam?"**

```text
GATE  →  "Vale a pena analisar?"
LUNA  →  "O que os dados indicam?"
```

---

## 10.1 Critérios do Gate

O Gate avalia apenas condições mínimas e objetivas — ele **não tenta** decidir se existe reversão confirmada nem se existe Smart Money. Isso permanece com a Luna.

| Critério | Referência inicial |
|---|---|
| Queda relevante | ≥ 15% nos últimos 60 pregões |
| Proximidade da mínima | ≤ 10% da mínima de 252 pregões |
| Volume | Média financeira ≥ R$ 20 milhões |
| Volatilidade | ATR(14) ≥ 3% |
| Suporte | Deve existir região identificável pelos dados |
| Reversão | **Não exigida no Gate** — avaliada pela Luna |
| Smart Money | **Não exigido no Gate** — avaliado pela Luna |

### Regra importante

> **O Gate não deve tentar decidir se existe Smart Money ou se a reversão está confirmada.** Ele apenas identifica se existe uma situação suficientemente interessante, do ponto de vista quantitativo, para justificar o custo de análise por IA.

---

## 10.2 Parâmetros Configuráveis do Gate

Os thresholds do Gate não devem ser fixados na lógica da IA. Devem existir como parâmetros configuráveis do sistema, permitindo testes e ajustes (inclusive via backtest) sem alterar prompts ou regras da Skill:

```text
GATE_DROP_PERCENT   = 15
GATE_DROP_PERIOD    = 60
GATE_MIN_DISTANCE   = 10
GATE_MIN_VOLUME     = 20000000
GATE_MIN_ATR        = 3
GATE_LOOKBACK_LOW   = 252
```

Isso permite testar variações como:

```text
15% / 60 dias
20% / 90 dias
25% / 120 dias
```

sem alterar a lógica de nenhum agente de IA.

---

## 10.3 Classificação do Gate

O resultado do Gate deve ser expresso como:

```text
REJEITADO
CANDIDATO
CANDIDATO FORTE
```

### Regra importante

> **A classificação do Gate é puramente quantitativa e não deve ser confundida com o Score da IA (seção 43) nem com a Confiança da análise (seção 46).** São camadas diferentes, com naturezas diferentes: o Gate mede aderência a critérios objetivos; o Score mede força de evidências interpretadas pela IA.

---

## 10.4 Exemplo de Saída do Gate

```text
PETR4

Gate: CANDIDATO FORTE

Motivos:
✓ Queda de 24% / 60 pregões
✓ 6% acima da mínima de 252 pregões
✓ Liquidez adequada
✓ Volatilidade adequada
```

Esse resultado é então encaminhado à Luna, que pode concluir, por exemplo:

```text
Suporte: MUITO FORTE
Smart Money: FORTE
Reversão: MODERADA
```

E, mais adiante, o Terra:

```text
Score: 86/100
Confiança: Alta
```

---

## 10.5 Fluxo de Decisão do Gate

```text
ATIVO
  ↓
FILTROS PRÉ-IA (liquidez, preço, ATR, beta)
  ↓
GATE BOTTOM FISHING
  ↓
REJEITADO ──────────► FIM (sem custo de IA)
  │
CANDIDATO / CANDIDATO FORTE
  ↓
LUNA
```

---

## 10.6 Consequência para Custo e Consistência

Ativos classificados como **REJEITADO** não avançam para a Luna e não geram nenhum custo de IA. Isso:

- reduz custo de tokens;
- reduz número de chamadas à IA;
- reduz variabilidade entre execuções;
- elimina falsos candidatos antes da etapa cara do pipeline;
- reduz tempo total de processamento.

---

# 11. SMART MONEY

O rastreamento de Smart Money permanece como um dos principais diferenciais do sistema.

O sistema não possui acesso direto à intenção dos participantes do mercado.

Portanto, não deve afirmar categoricamente:

> "Instituições estão comprando."

Quando não houver evidência direta.

Deve utilizar linguagem como:

> "O comportamento de preço e volume é compatível com possível acumulação."

---

## 11.1 Indicadores de interesse

- Volume financeiro;
- Volume relativo;
- Anomalias;
- Absorção;
- Divergência preço/volume;
- Preço estabilizando após queda;
- Aumento de volume em suporte;
- Rompimento com volume;
- Sequências de acumulação;
- Sequências de distribuição.

---

# 12. VOLUME / SMART MONEY NO SCORE

O componente Volume / Smart Money deve possuir **25% do Score principal**.

Isso mantém a identidade do sistema.

---

# 13. TERRA — ESTRATEGISTA

O Terra realiza a análise aprofundada.

Ele recebe:

- Dados do ativo;
- Resultado do Gate;
- Resultado da Luna;
- Indicadores;
- Histórico;
- Fundamentos;
- Valuation;
- Dados de volume;
- Contexto do usuário;
- Posição existente;
- Arquivos relevantes;
- Imagens relevantes;
- Informações pesquisadas;
- Histórico de análises.

---

# 14. RESPONSABILIDADES DO TERRA

O Terra deve:

1. Construir a tese;
2. Avaliar Bottom Fishing;
3. Avaliar suporte;
4. Avaliar Smart Money;
5. Avaliar técnica;
6. Avaliar fundamentos;
7. Avaliar valuation;
8. Avaliar setor;
9. Avaliar macro;
10. Avaliar eventos;
11. Avaliar riscos;
12. Definir cenários;
13. Definir entrada quando aplicável;
14. Definir Stop Loss quando aplicável;
15. Definir alvo quando aplicável;
16. Calcular Risco x Retorno;
17. Considerar o contexto do usuário;
18. Preparar a análise para auditoria.

---

# 15. STOP LOSS — REGRA OBRIGATÓRIA

Para operações de entrada, o Stop Loss deve ser baseado na estrutura técnica.

O Stop Loss deve:

- Ficar além da região que invalida a tese;
- Considerar a estrutura de suporte;
- Considerar a volatilidade;
- Possuir folga técnica adequada;
- Evitar ser definido simplesmente por percentual arbitrário.

A regra conceitual é:

> **O Stop Loss deve representar a região onde a tese deixa de fazer sentido.**

---

## 15.1 Ausência de Stop tecnicamente justificável

Se não for possível definir um Stop Loss tecnicamente coerente:

> **A operação não deve ser aprovada como trade.**

---

# 16. RISCO X RETORNO

## 16.1 Modo Descoberta / Trade

A relação mínima desejável é:

> **Risco : Retorno = 1 : 2**

Para novas operações, essa regra é uma **trava obrigatória**.

Se:

```text
Risco = R$ 1,00
```

o retorno potencial mínimo deve ser:

```text
R$ 2,00
```

Se não houver R:R mínimo de 1:2:

> **REJEITAR OPERAÇÃO**

O Terra não pode ignorar essa regra.

O Sol deve verificar novamente.

---

# 17. MODO POSIÇÃO

O R:R 1:2 não é obrigatório quando o sistema está analisando uma posição já existente.

Isso ocorre porque uma posição pode possuir objetivos diferentes de um trade novo.

Exemplos:

- Dividendos;
- Longo prazo;
- Position;
- Recuperação de preço;
- Acumulação patrimonial.

Nesse caso, a análise deve considerar:

- Preço médio;
- Resultado;
- Objetivo;
- Horizonte;
- Risco;
- Fundamentos;
- Valuation;
- Técnica;
- Eventos.

---

# 18. SOL — AUDITOR

O Sol deve tentar encontrar falhas na tese do Terra.

Sua função não é concordar.

Sua função é:

> **Tentar invalidar a análise.**

---

## 18.1 Perguntas do Sol

- O suporte realmente existe?
- A reversão está confirmada?
- O volume é significativo?
- Existe outra explicação para o volume?
- Existe risco fundamentalista?
- O valuation é realmente atrativo?
- Existe evento de risco?
- A pesquisa está atualizada?
- A tese depende de alguma informação incerta?
- O Stop está tecnicamente correto?
- O R:R atende 1:2 no Modo Descoberta?
- A probabilidade/confiança está exagerada?
- O contexto do usuário está influenciando indevidamente a conclusão?

---

# 19. DECISÕES DO SOL

O Sol pode retornar:

```text
APROVADO
APROVADO_COM_RESSALVAS
REJEITADO
```

---

# 20. SKILL B3_ANALYST

A Skill `B3_ANALYST` concentra todo o conhecimento financeiro necessário.

Não devem ser criadas Skills separadas para:

- RSI;
- MACD;
- ROE;
- P/L;
- Volume;
- Valuation;
- Dividendos;
- Setor;
- Macro.

Esses conhecimentos ficam dentro da mesma Skill.

---

# 21. MÓDULOS INTERNOS DA B3_ANALYST

```text
B3_ANALYST
│
├── Technical
├── Bottom Fishing
├── Smart Money
├── Fundamental
├── Valuation
├── Sector
├── Macro
├── Risk
└── Events
```

Esses módulos são competências internas e não novos agentes.

---

# 22. ANÁLISE TÉCNICA

Pode incluir:

- Tendência;
- Suporte;
- Resistência;
- Médias móveis;
- RSI;
- MACD;
- ADX;
- ATR;
- Aroon;
- VWAP;
- Momentum;
- Volatilidade;
- Gaps;
- Estrutura de candles;
- Máximas;
- Mínimas.

---

# 23. ANÁLISE FUNDAMENTALISTA

Pode incluir:

- Receita;
- EBITDA;
- EBIT;
- Lucro;
- Margens;
- ROE;
- ROIC;
- ROA;
- Dívida;
- Dívida líquida;
- Fluxo de caixa;
- FCF;
- CAPEX;
- Dividendos;
- Payout.

Os fundamentos servem como camada de confirmação, qualificação ou rejeição.

---

# 24. VALUATION

Pode incluir:

- P/L;
- P/VP;
- EV/EBITDA;
- EV/EBIT;
- EV/Receita;
- Dividend Yield;
- FCF Yield;
- PEG;
- Histórico dos múltiplos;
- Comparação com pares.

A IA não deve considerar simplesmente:

> P/L baixo = ação barata.

O indicador deve ser contextualizado.

---

# 25. ANÁLISE SETORIAL

A interpretação deve considerar o setor da empresa.

Exemplos:

### Bancos

- ROE;
- P/VP;
- P/L;
- Margem financeira;
- Inadimplência;
- Eficiência.

### Varejo

- Receita;
- Margens;
- Estoques;
- Dívida;
- Crescimento.

### Petróleo

- Produção;
- Brent;
- CAPEX;
- Custo;
- Reservas;
- FCF.

### Mineração

- Produção;
- Preço da commodity;
- Custo;
- China;
- Dólar;
- Margem.

A análise setorial deve apoiar a tese, e não substituir a estratégia principal.

---

# 26. ANÁLISE MACROECONÔMICA

Quando relevante, avaliar:

- Selic;
- IPCA;
- CDI;
- Dólar;
- Juros;
- Commodities;
- Petróleo;
- Minério;
- PIB;
- China;
- Economia internacional;
- Política monetária.

A análise macro somente deve ser aprofundada quando tiver potencial de alterar a tese.

---

# 27. ANÁLISE DE RISCO

Avaliar:

- Liquidez;
- Volatilidade;
- Drawdown;
- Beta;
- Endividamento;
- Risco operacional;
- Risco regulatório;
- Risco setorial;
- Risco macro;
- Eventos corporativos;
- Risco de governança.

---

# 28. SKILL B3_RESEARCH

A `B3_RESEARCH` é responsável pela pesquisa externa.

Ela deve ser acionada sob demanda.

Não deve pesquisar extensivamente todos os ativos automaticamente.

---

# 29. QUANDO PESQUISAR

Exemplos:

- Queda anormal;
- Alta anormal;
- Resultado recente;
- Fato relevante;
- Dividendos;
- Mudança de guidance;
- Aquisição;
- Venda de ativos;
- Mudança regulatória;
- Evento corporativo;
- Notícia relevante;
- Informação ausente nos dados internos.

---

# 30. PROCESSO DE PESQUISA

```text
PERGUNTA
   ↓
IDENTIFICAR INFORMAÇÃO NECESSÁRIA
   ↓
PESQUISAR FONTES PRIORITÁRIAS
   ↓
VALIDAR DATA
   ↓
VALIDAR FONTE
   ↓
CRUZAR INFORMAÇÕES
   ↓
ENTREGAR RESULTADO
```

---

# 31. SKILL B3_CONTEXT

A `B3_CONTEXT` é responsável por processar informações fornecidas pelo usuário.

O usuário poderá fornecer:

- Texto;
- Posições;
- Imagens;
- PDFs;
- CSVs;
- TXTs;
- XLSX;
- Relatórios;
- Prints;
- Outros arquivos suportados.

---

# 32. CAMPO DE TEXTO LIVRE

O sistema deve possuir um campo para contexto adicional.

Exemplo:

> "Estou comprado em PETR4. Tenho lucro atualmente e pretendo manter enquanto os dividendos continuarem atrativos. Estou preocupado com a queda recente."

Esse conteúdo deve ser interpretado como:

```text
FONTE: USUÁRIO
TIPO: CONTEXTO
```

Não como dado de mercado.

---

# 33. POSIÇÕES DO USUÁRIO

O sistema deve permitir registrar:

```text
Ativo
Quantidade
Preço médio
Data de entrada
Preço atual
Resultado financeiro
Resultado percentual
Objetivo
Horizonte
Observações
```

Preço atual e resultados devem ser obtidos/calculados pelo sistema quando houver dados confiáveis.

---

# 34. EXEMPLO DE POSIÇÃO

```json
{
  "ativo": "PETR4",
  "quantidade": 1500,
  "preco_medio": 32.80,
  "objetivo": "dividendos",
  "horizonte": "longo_prazo",
  "observacao": "Pretendo manter enquanto os dividendos permanecerem atrativos."
}
```

---

# 35. ANEXOS

O usuário poderá anexar:

```text
PNG
JPG
PDF
CSV
TXT
XLSX
DOCX
```

quando suportados pelo sistema.

A IA deve:

1. Identificar o conteúdo;
2. Extrair informações relevantes;
3. Classificar a origem;
4. Identificar inconsistências;
5. Cruzar com dados B3;
6. Utilizar somente informações relevantes.

---

# 36. ANÁLISE DE IMAGENS

Quando houver gráfico ou print, a IA poderá analisar:

- Estrutura de preço;
- Tendência;
- Suportes;
- Resistências;
- Candles;
- Volume;
- Indicadores visíveis;
- Padrões.

Valores ilegíveis não devem ser estimados como fatos.

---

# 37. ANÁLISE DE CSV E PLANILHAS

Arquivos estruturados podem conter:

- Carteira;
- Histórico de trades;
- Preços;
- Indicadores;
- Operações;
- Resultados;
- Logs.

A IA deve identificar a estrutura quando possível.

---

# 38. DOIS MODOS PRINCIPAIS

O sistema terá dois modos de análise:

```text
MODO DESCOBERTA
MODO POSIÇÃO
```

---

# 39. MODO DESCOBERTA

Utilizado quando o usuário não possui posição ou deseja encontrar uma nova oportunidade.

Exemplo:

> "Analise PETR4."

Pipeline:

```text
DADOS
 ↓
FILTROS PRÉ-IA
 ↓
GATE BOTTOM FISHING (determinístico)
 ↓
REJEITADO ────────► FIM
 │
CANDIDATO / CANDIDATO FORTE
 ↓
LUNA
 ↓
TÉCNICA
 ↓
SUPORTE
 ↓
SMART MONEY
 ↓
FUNDAMENTOS
 ↓
VALUATION
 ↓
SETOR
 ↓
MACRO
 ↓
EVENTOS
 ↓
RISCO
 ↓
TERRA
 ↓
STOP
 ↓
R:R
 ↓
SOL
 ↓
PARECER
```

---

# 40. MODO POSIÇÃO

Utilizado quando o usuário possui uma posição aberta.

Exemplo:

> "Tenho 2.000 VALE3 a R$ 58,20."

A pergunta passa de:

> "Vale comprar?"

para:

> **"O que fazer com minha posição atual?"**

### Observação

O Gate Bottom Fishing **não se aplica ao Modo Posição**. O Gate responde "vale a pena olhar para esse ativo?" — e essa pergunta não faz sentido quando o ativo já está na carteira do usuário. No Modo Posição, a análise sempre avança direto para Luna/Terra/Sol.

---

# 41. DECISÕES DO MODO POSIÇÃO

Possíveis resultados:

```text
MANTER
AUMENTAR
REDUZIR
REALIZAR PARCIAL
SAIR
AGUARDAR
```

A conclusão deve considerar:

- Preço médio;
- Resultado atual;
- Objetivo;
- Horizonte;
- Risco;
- Técnica;
- Fundamentos;
- Valuation;
- Setor;
- Macro;
- Eventos.

---

# 42. DIFERENÇA ENTRE DESCOBERTA E POSIÇÃO

| Característica | Descoberta | Posição |
|---|---|---|
| Objetivo | Encontrar oportunidade | Avaliar posição existente |
| Gate Bottom Fishing | **Obrigatório (determinístico)** | Não aplicável |
| Bottom Fishing (tese) | Central | Pode ser relevante |
| Smart Money | Central | Relevante |
| Stop | Obrigatório se houver trade | Pode ser recomendado |
| R:R 1:2 | **Obrigatório** | Não obrigatório |
| Preço médio | Não aplicável | Fundamental |
| Objetivo do usuário | Opcional | Importante |
| Horizonte | Opcional | Importante |

---

# 43. SCORE

O Score principal deve representar a força da configuração encontrada.

Não deve representar garantia de retorno.

### Pesos padrão

| Dimensão | Peso |
|---|---:|
| Técnica / Estrutura de Preço | **20%** |
| Volume / Smart Money | **25%** |
| Fundamentos | **15%** |
| Valuation | **10%** |
| Setor | **5%** |
| Macro | **5%** |
| Risco | **10%** |
| Eventos | **5%** |
| **Total** | **100%** |

---

# 44. INTERPRETAÇÃO DO SCORE

O Score deve responder:

> **"Qual é a força das evidências favoráveis à configuração?"**

Não:

> "Qual é a probabilidade de ganhar dinheiro?"

---

# 45. SCORE ELEGÍVEL

Um ativo somente deve receber prioridade máxima quando:

```text
GATE = CANDIDATO / CANDIDATO FORTE
        +
      SCORE
        +
RISCO CONTROLADO
```

Um Score elevado não deve sozinho transformar uma configuração inadequada em oportunidade — e um Gate favorável tampouco garante Score alto. As duas camadas são independentes e ambas precisam estar alinhadas.

---

# 46. CONFIANÇA

A confiança deve considerar:

- Qualidade dos dados;
- Quantidade de evidências;
- Atualidade;
- Concordância entre indicadores;
- Qualidade das fontes;
- Existência de conflitos;
- Robustez da tese.

Classificação:

```text
MUITO BAIXA
BAIXA
MODERADA
ALTA
MUITO ALTA
```

---

# 47. SCORE NÃO É PROBABILIDADE

O sistema deve evitar falsa precisão.

Preferir:

> **Score de Evidências: 84/100**

e:

> **Confiança: Alta**

em vez de:

> "Existe 84% de chance de subir."

---

# 48. ANÁLISE DE ANOMALIAS

A IA deve procurar divergências.

Exemplo:

```text
Receita       +8%
EBITDA        +6%
Lucro         +2%
FCF          -38%
Dívida       +22%
```

Nesse cenário, investigar:

- Capital de giro;
- CAPEX;
- Estoques;
- Contas a receber;
- Impostos;
- Dívida;
- Eventos não recorrentes.

---

# 49. ANÁLISE DE RESULTADOS

Quando houver resultado trimestral ou anual:

Comparar:

- Período atual;
- Período anterior;
- Mesmo período do ano anterior;
- Histórico;
- Expectativas disponíveis;
- Guidance.

Identificar:

- Melhoras;
- Deteriorações;
- Anomalias;
- Eventos extraordinários;
- Mudanças de tendência.

---

# 50. ANÁLISE DE EVENTOS

A IA deve investigar eventos que possam alterar a tese:

- Resultado;
- Dividendos;
- Fatos relevantes;
- Guidance;
- Aquisições;
- Desinvestimentos;
- Mudanças administrativas;
- Mudanças regulatórias;
- Processos relevantes;
- Alterações estratégicas.

---

# 51. BOTTOM FISHING — REGRA CENTRAL

O sistema procura ativos que:

- Sofreram quedas relevantes;
- Estão próximos de mínimas;
- Demonstram exaustão;
- Encontram suporte;
- Apresentam possível reversão;
- Apresentam comportamento de volume relevante.

Mas:

> **Ativo que caiu muito não é automaticamente uma oportunidade.**

O sistema deve diferenciar:

```text
QUEDA + EXAUSTÃO + SUPORTE + FLUXO
```

de:

```text
QUEDA + DETERIORAÇÃO ESTRUTURAL
```

---

# 52. EMPRESA BOA NÃO É NECESSARIAMENTE TRADE BOM

O sistema deve preservar essa distinção.

Uma empresa pode possuir:

- Excelentes fundamentos;
- Excelente valuation;

e ainda assim:

- Não estar em suporte;
- Não apresentar reversão;
- Não apresentar fluxo favorável.

Nesse caso:

> **Pode ser uma boa empresa, mas não necessariamente uma boa configuração de Bottom Fishing.**

---

# 53. MEMÓRIA

O Supabase deve armazenar:

- Análises;
- Scores;
- Decisões;
- Justificativas;
- Dados utilizados;
- Fontes;
- Contextos relevantes;
- Resultados posteriores;
- Auditorias.

---

# 54. APRENDIZADO HISTÓRICO

O sistema pode comparar:

```text
TESE
 ↓
DECISÃO
 ↓
RESULTADO POSTERIOR
 ↓
ANÁLISE DO RESULTADO
```

Isso pode ajudar a identificar:

- Falsos positivos;
- Falsos negativos;
- Padrões;
- Ativos com maior aderência;
- Setores;
- Configurações recorrentes.

A memória não deve ser utilizada como garantia de resultado futuro.

---

# 55. AUDITMANAGER

O `AuditManager` deve registrar:

```text
Data/hora
Ativo
Modo
Dados recebidos
Contexto
Arquivos
Pesquisas
Fontes
Resultado do Gate
Motivos do Gate
Resultado da Luna
Análise do Terra
Auditoria do Sol
Score
Confiança
Decisão
Stop
Alvo
R:R
Versão do sistema
Versão das Skills
```

---

# 56. PARECER FINAL

O parecer deve ser estruturado.

## Cabeçalho

```text
ATIVO:
MODO:
GATE:
PREÇO:
SCORE:
CONFIANÇA:
DECISÃO:
```

---

# 57. CAMPOS OBRIGATÓRIOS DO PARECER

### Gate Bottom Fishing (etapa determinística, somente Modo Descoberta)

```text
REJEITADO
CANDIDATO
CANDIDATO FORTE
```

### Bottom Fishing — conclusão da tese (interpretação da Luna/Terra)

```text
SIM
NÃO
AGUARDAR
```

> Os dois campos acima têm naturezas diferentes: o Gate mede aderência quantitativa mínima; a conclusão de Bottom Fishing é a interpretação final da tese, construída após Luna, Terra e Sol.

### Nível de Suporte

```text
MUITO FRACO
FRACO
MODERADO
FORTE
MUITO FORTE
EXTREMO
```

### Smart Money

```text
MUITO FRACO
FRACO
MODERADO
FORTE
MUITO FORTE
```

### Estrutura Técnica

Descrição da situação atual.

### Fundamentos

Descrição.

### Valuation

Descrição.

### Setor

Descrição.

### Macro

Descrição quando relevante.

### Eventos

Eventos relevantes.

### Riscos

Principais fatores de invalidação.

---

# 58. PARECER PARA MODO DESCOBERTA

Quando houver operação:

```text
ENTRADA:
STOP LOSS:
ALVO:
RISCO:
RETORNO:
R:R:
```

O sistema deve confirmar:

```text
R:R >= 1:2
```

Caso contrário:

> **OPERAÇÃO REJEITADA**

---

# 59. PARECER PARA MODO POSIÇÃO

```text
ATIVO:
QUANTIDADE:
PREÇO MÉDIO:
PREÇO ATUAL:
RESULTADO:
OBJETIVO:
HORIZONTE:

DECISÃO:
```

Depois:

### Situação da posição

### Pontos favoráveis

### Pontos negativos

### Riscos

### Cenários

### Condições para reavaliação

### Auditoria do Sol

---

# 60. CONTEXTO DO USUÁRIO NÃO PODE DISTORCER OS FATOS

Exemplo:

Usuário:

> "Não quero vender com prejuízo."

A IA não deve concluir:

> "Então deve manter."

Deve considerar:

> "O usuário declarou que não deseja realizar prejuízo."

Mas a análise deve continuar independente.

---

# 61. CONTROLE DE TOKENS

Os agentes não devem receber todas as informações sempre.

### Filtros Pré-IA e Gate Bottom Fishing

Não consomem tokens de IA — são 100% determinísticos e rodam antes de qualquer chamada a modelo.

### Luna

Recebe dados necessários para triagem, somente de ativos já aprovados pelo Gate.

### Terra

Recebe dados completos dos candidatos.

### B3 Research

É acionada somente quando necessário.

### Contexto

Somente documentos relevantes são encaminhados.

### Sol

Recebe a tese e os dados necessários para contestá-la.

---

# 62. NÃO CRIAR UMA INFINIDADE DE SKILLS

A arquitetura deve permanecer limitada a:

```text
B3_ANALYST
B3_RESEARCH
B3_CONTEXT
```

Não criar uma Skill para cada indicador ou área.

O Gate Bottom Fishing e os Filtros Pré-IA **não são Skills nem agentes** — são camadas de regras determinísticas que rodam antes de qualquer Skill ser acionada.

A complexidade deve estar nos módulos internos e nas regras, não na quantidade de agentes ou Skills.

---

# 63. FLUXO COMPLETO — MODO DESCOBERTA

```text
USUÁRIO
   ↓
ATIVO
   ↓
CONTEXTO OPCIONAL
   ↓
ANEXOS OPCIONAIS
   ↓
DADOS B3
   ↓
FILTROS PRÉ-IA               ❌ sem IA
   ↓
GATE BOTTOM FISHING          ❌ sem IA
   ↓
REJEITADO ─────────────► FIM
   │
CANDIDATO / CANDIDATO FORTE
   ↓
LUNA                          ✅ IA
   ↓
B3_ANALYST
   ↓
SMART MONEY
   ↓
SUPORTE
   ↓
TÉCNICA
   ↓
FUNDAMENTOS
   ↓
VALUATION
   ↓
SETOR
   ↓
MACRO
   ↓
EVENTOS
   ↓
RISCO
   ↓
TERRA                         ✅ IA
   ↓
STOP LOSS
   ↓
R:R >= 1:2
   ↓
SOL                           ✅ IA
   ↓
PARECER
   ↓
SUPABASE
```

---

# 64. FLUXO COMPLETO — MODO POSIÇÃO

```text
USUÁRIO
   ↓
POSIÇÃO
   ↓
CONTEXTO
   ↓
ANEXOS
   ↓
DADOS ATUAIS
   ↓
LUNA
   ↓
TÉCNICA
   ↓
SUPORTE
   ↓
SMART MONEY
   ↓
FUNDAMENTOS
   ↓
VALUATION
   ↓
SETOR
   ↓
MACRO
   ↓
EVENTOS
   ↓
RISCO
   ↓
TERRA
   ↓
SOL
   ↓
DECISÃO
   ↓
SUPABASE
```

> Note-se que o Gate Bottom Fishing não aparece neste fluxo — ver seção 40.

---

# 65. FILTROS PRÉ-IA

Os filtros devem continuar sendo executados programaticamente, antes do Gate Bottom Fishing.

---

## 65.1 Filtro Anti-Mico

Referência inicial:

```text
Preço >= R$ 5,00
```

Objetivo:

Reduzir ativos excessivamente baratos.

O parâmetro deve ser configurável.

---

# 66. FILTRO DE LIQUIDEZ

Referência inicial:

```text
Volume Financeiro Médio 10 dias
>= R$ 20.000.000
```

Objetivo:

Priorizar ativos com liquidez suficiente.

O parâmetro deve ser configurável.

---

# 67. FILTRO DE VOLATILIDADE

Referência inicial:

```text
ATR(14) >= 3%
```

Objetivo:

Evitar ativos excessivamente parados.

O parâmetro deve ser configurável.

---

# 68. FILTRO DE BETA

Referência inicial:

```text
Beta 5 anos >= 1,2
```

Objetivo:

Priorizar ativos com maior sensibilidade ao mercado.

O parâmetro deve ser configurável.

---

# 69. FILTROS NÃO DEVEM SER TRATADOS COMO VERDADES UNIVERSAIS

Os parâmetros acima são referências do sistema.

Devem poder ser ajustados conforme:

- Estratégia;
- Mercado;
- Backtest;
- Liquidez;
- Regime de volatilidade;
- Objetivo.

O mesmo princípio se aplica aos parâmetros do Gate Bottom Fishing (seção 10.2).

---

# 70. ANÁLISE DE CARTEIRA — EVOLUÇÃO FUTURA

O sistema deve estar preparado para futuramente analisar uma carteira completa.

Exemplo:

```text
PETR4
VALE3
ITUB4
BBDC4
...
```

A IA poderá avaliar:

- Concentração;
- Exposição setorial;
- Correlação;
- Risco;
- Resultado;
- Eventos;
- Fundamentos;
- Valuation;
- Situação técnica.

---

# 71. RESULTADO DE CARTEIRA

Exemplo:

```text
PETR4    MANTER
VALE3    MANTER COM RESSALVAS
ITUB4    AUMENTAR
BBDC4    REDUZIR
```

Cada posição deve possuir justificativa independente.

---

# 72. PRINCÍPIO DE INDEPENDÊNCIA

A IA não deve assumir que uma decisão anterior estava correta.

Cada nova análise deve reavaliar os dados atuais.

A memória serve como contexto histórico, não como verdade.

---

# 73. PRINCÍPIO DE REAVALIAÇÃO

Toda tese deve possuir condições que possam provocar nova análise.

Exemplo:

```text
Tese válida enquanto:
- suporte permanecer;
- volume continuar favorável;
- fundamento não deteriorar;
- evento X não ocorrer.
```

Quando uma condição for perdida:

> **REAVALIAR TESE**

---

# 74. CENÁRIOS

Quando relevante, o Terra deve apresentar:

### Cenário otimista

Condições necessárias.

### Cenário base

Cenário mais provável segundo as evidências disponíveis.

### Cenário pessimista

Condições que invalidariam ou enfraqueceriam a tese.

---

# 75. REGRA DE INVALIDAÇÃO

Toda tese deve, quando possível, possuir um ponto ou condição de invalidação.

Exemplo:

> "A tese de reversão perde força caso o suporte seja rompido com volume elevado."

Isso é especialmente importante para o Modo Descoberta.

---

# 76. PRINCÍPIO DE AUDITORIA

O Sol deve receber liberdade para:

- Reduzir confiança;
- Reduzir Score;
- Alterar classificação;
- Rejeitar operação.

O sistema não deve obrigar o Sol a aprovar uma tese criada pelo Terra.

---

# 77. PRINCÍPIO DE TRANSPARÊNCIA

O usuário deve conseguir entender:

> **Por que a IA chegou a essa conclusão?**

A resposta deve permitir identificar:

```text
DADOS
 ↓
GATE (quando aplicável)
 ↓
EVIDÊNCIAS
 ↓
INTERPRETAÇÃO
 ↓
RISCOS
 ↓
CONCLUSÃO
```

---

# 78. OBJETIVO FINAL

O Smart Money Tracker AI 3.2 deve ser capaz de:

```text
ENCONTRAR
     ↓
FILTRAR
     ↓
VALIDAR ELEGIBILIDADE (GATE)
     ↓
IDENTIFICAR REVERSÕES
     ↓
ANALISAR SMART MONEY
     ↓
VALIDAR FUNDAMENTOS
     ↓
AVALIAR VALUATION
     ↓
PESQUISAR EVENTOS
     ↓
CONSIDERAR CONTEXTO
     ↓
AVALIAR RISCO
     ↓
CONSTRUIR TESE
     ↓
AUDITAR TESE
     ↓
GERAR PARECER
     ↓
APRENDER COM HISTÓRICO
```

---

# 79. RESUMO DA ARQUITETURA FINAL

## Camadas determinísticas (sem IA)

```text
FILTROS PRÉ-IA
Liquidez, preço, ATR, beta

GATE BOTTOM FISHING
Queda, proximidade de mínima, condições mínimas
Classificação: REJEITADO / CANDIDATO / CANDIDATO FORTE
```

## Agentes (com IA)

```text
LUNA
Interpretação técnica + suporte + volume + Smart Money

TERRA
Análise profunda e estratégia

SOL
Auditoria e contestação
```

## Skills

```text
B3_ANALYST
Conhecimento e metodologia B3

B3_RESEARCH
Pesquisa e validação externa

B3_CONTEXT
Contexto, posições e arquivos
```

## Modos

```text
DESCOBERTA  (usa Gate)
POSIÇÃO     (não usa Gate)
```

## Identidade

```text
BOTTOM FISHING
+
SMART MONEY
+
REVERSÃO
```

## Score

```text
Técnica              20%
Smart Money          25%
Fundamentos          15%
Valuation            10%
Setor                 5%
Macro                 5%
Risco                10%
Eventos               5%
```

## Regras críticas

```text
Gate Bottom Fishing = determinístico, sem IA, roda antes da Luna

Gate ≠ Score ≠ Confiança

Bottom Fishing = Gate (quantitativo) + conclusão da tese (interpretativa)

Smart Money = 25% do Score

Suporte = classificação obrigatória

Stop = baseado em invalidação técnica

R:R >= 1:2 = obrigatório para novas operações

R:R 1:2 = não obrigatório no Modo Posição

Score ≠ probabilidade de retorno

Contexto do usuário ≠ dado de mercado

Sol pode rejeitar a tese do Terra
```

---

# 80. DEFINIÇÃO DA VERSÃO 3.2

A versão 3.2 mantém integralmente a essência original do Smart Money Tracker:

> **Identificar oportunidades de Bottom Fishing associadas a possíveis sinais de Smart Money e reversão.**

E refina a arquitetura da 3.1 em um ponto específico: a separação explícita entre o que é **determinístico** e o que exige **interpretação por IA**.

> **Tudo que puder ser resolvido de forma objetiva e determinística deve ser resolvido antes de chamar a IA. Tudo que exigir interpretação deve ficar com a IA.**

Na prática, isso significa introduzir o **Gate Bottom Fishing** como uma etapa própria, sem IA, posicionada entre os Filtros Pré-IA e a Luna — com critérios objetivos e configuráveis, e uma classificação própria (REJEITADO / CANDIDATO / CANDIDATO FORTE) que não se confunde com o Score da IA. A Luna deixa de duplicar essa checagem quantitativa e passa a se dedicar inteiramente à interpretação (qualidade do suporte, exaustão, reversão, Smart Money).

A arquitetura permanece simples:

> **2 camadas determinísticas + 3 agentes + 3 Skills + dados estruturados + contexto do usuário + pesquisa sob demanda + auditoria.**

A principal regra estratégica é:

> **Uma empresa pode ser excelente sem apresentar uma oportunidade de Bottom Fishing.**

A principal regra operacional é:

> **Uma nova operação somente pode ser aprovada quando a tese possuir invalidação técnica identificável e relação Risco:Retorno mínima de 1:2.**

E a principal regra arquitetural é:

> **Nada que possa ser resolvido com dados objetivos deve consumir uma chamada de IA.**

O Smart Money Tracker AI 3.2 deve continuar sendo, acima de tudo:

> **um caçador sistemático de reversões com evidências de fluxo, e não simplesmente um analisador genérico de ações da B3.**

**Fim da documentação — Smart Money Tracker AI 3.2**
