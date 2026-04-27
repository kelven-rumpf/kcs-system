# Dashboard Executivo - Guia Completo

**Tempo de Leitura:** 12 minutos | **Nível:** Intermediário | **Atualizado:** 27 de abril de 2026 | **Autor:** Equipe de Documentação

> **Breadcrumb:** [Documentação](../../INDEX.md) > [Módulos](../modules-overview.md) > Dashboard Executivo > Esta Página

---

## 📊 Visão Geral

O Dashboard Executivo é o centro de inteligência do KCS Hub, fornecendo métricas estratégicas em tempo real sobre a saúde, produção e qualidade da sua base de conhecimento. 

Este guia completo mostra como:
- ✅ Acessar e navegar pelo Dashboard
- ✅ Interpretar cada métrica disponível
- ✅ Usar filtros de período para análise comparativa
- ✅ Agir sobre os dados apresentados
- ✅ Configurar alertas de qualidade

Ao final, você será capaz de usar o Dashboard para tomar decisões estratégicas sobre governança de conhecimento.

---

## 📑 Índice da Página

- [Acessando o Dashboard](#acessando-o-dashboard)
- [Anatomia do Dashboard](#anatomia-do-dashboard)
- [As Quatro Métricas Principais](#as-quatro-métricas-principais)
- [Entendendo o Funil de Governança](#entendendo-o-funil-de-governança)
- [Análise de Evolução KCS](#análise-de-evolução-kcs)
- [Filtros de Período - Quando Usar](#filtros-de-período---quando-usar)
- [Alertas de Qualidade](#alertas-de-qualidade)
- [Casos de Uso Prático](#casos-de-uso-prático)
- [Boas Práticas de Análise](#boas-práticas-de-análise)
- [Troubleshooting](#troubleshooting)
- [Próximos Passos](#próximos-passos)

---

## 🚀 Acessando o Dashboard

### Primeiro Acesso

1. Faça login no KCS Hub com sua conta corporativa
2. Você será redirecionado automaticamente para o **Dashboard Executivo** (página padrão)
3. Alternativamente, clique em **Dashboard** no menu lateral esquerdo

### Permissões Necessárias

| Nível de Acesso | O que Pode Fazer |
|-----------------|------------------|
| **Analista** | Visualizar todas as métricas; aplicar filtros |
| **Revisor** | Visualizar métricas + acesso a dados de revisão |
| **Gestor** | Visualizar métricas + alertas personalizados |
| **Administrador** | Visualizar tudo + configurar alertas globais |

> ⓘ **Nota:** Usuários básicos podem visualizar apenas suas próprias contribuições no Dashboard. Solicite acesso elevado ao seu administrador se precisar de visibilidade completa.

---

## 🎯 Anatomia do Dashboard

O Dashboard está organizado em 4 zonas principais:

```
┌─────────────────────────────────────────────────────────┐
│ CABEÇALHO: Controles de Período e Filtros              │
│ [7 dias] [30 dias] [90 dias] [Customizado] [⟳ Atualizar]│
├─────────────────────────────────────────────────────────┤
│ ZONA 1: Quatro Métricas                                 │
│ ┌──────────┬──────────┬──────────┬──────────┐          │
│ │ Criados  │Publicados│ Em Revisão│Reutiliz.│          │
│ │    245   │   198    │    32    │   75%   │          │
│ └──────────┴──────────┴──────────┴──────────┘          │
├─────────────────────────────────────────────────────────┤
│ ZONA 2: Funil de Governança (Gráfico de Fluxo)         │
│ Rascunho → Revisão → Publicação (com dropoff)         │
├─────────────────────────────────────────────────────────┤
│ ZONA 3: Evolução KCS (Gráfico de Linha)                │
│ Série temporal de criação vs publicação                │
├─────────────────────────────────────────────────────────┤
│ ZONA 4: Alertas de Qualidade                           │
│ Artigos abaixo do padrão, sem atualização, etc.       │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 As Quatro Métricas Principais

### 1️⃣ Artigos Criados

**O que Mede:** Total de novos artigos rascunho criados no período

**Exemplo Visual:**
```
┌─────────────────────┐
│  📝 CRIADOS        │
│      245           │
│   ↑ 32% vs período │
│      anterior       │
└─────────────────────┘
```

**Como Interpretar:**
- **Crescimento de 0-10%:** Base estável, criação normal
- **Crescimento de 10-30%:** Aumento saudável de produção
- **Crescimento > 30%:** Pico de criação (pode indicar novo projeto ou sprint)
- **Redução:** Investigue possíveis motivos (férias, redirecionamento, etc.)

**O Que Fazer:**
- Use como **leading indicator** de atividade
- Compare com período anterior para trend
- Se baixo demais, promova criação de conteúdo
- Se alto demais, verifique qualidade (métrica \"Publicados\")

> 💡 **Dica:** Se há crescimento em \"Criados\" mas não em \"Publicados\", pode haver gargalo no processo de revisão.

---

### 2️⃣ Artigos Publicados

**O que Mede:** Total de artigos que completaram revisão e estão live

**Exemplo Visual:**
```
┌─────────────────────┐
│  ✅ PUBLICADOS     │
│      198           │
│   ↑ 15% vs período │
│      anterior       │
└─────────────────────┘
```

**Como Interpretar:**
- **Taxa de Publicação Alta (>80% de criados):** Bom fluxo de revisão
- **Taxa de Publicação Média (50-80%):** Processo normal, alguns artigos em revisão
- **Taxa de Publicação Baixa (<50%):** Possível gargalo de qualidade/revisão

**Fórmula:** `Taxa de Publicação = (Publicados / Criados) × 100`

**O Que Fazer:**
- Monitore a comparação **Criados vs Publicados**
- Se a diferença crescer, há backlog na revisão
- Aumente revisores ou agilize o processo
- Celebre marcos (ex: \"1.000 artigos publicados\")

> 🎯 **Meta Recomendada:** 70-85% de artigos criados eventualmente publicados (após revisão)

---

### 3️⃣ Em Revisão

**O que Mede:** Artigos em estado transitório, aguardando aprovação

**Exemplo Visual:**
```
┌─────────────────────┐
│  🔄 EM REVISÃO     │
│       32           │
│  ⚠️ +5 novos hoje  │
│  Tempo médio: 3d   │
└─────────────────────┘
```

**Como Interpretar:**
- **Números Baixos (0-5):** Sistema fluindo bem
- **Números Moderados (5-20):** Normal dependendo do tamanho da equipe
- **Números Altos (>30):** Possível congestionamento

**Indicadores Importantes:**
- **Tempo Médio de Revisão:** Quanto tempo os artigos ficam em revisão?
  - Ideal: 1-2 dias
  - Aceitável: 3-5 dias
  - Preocupante: > 1 semana

**O Que Fazer:**
- Se tempo médio está crescendo, aloque mais revisores
- Se há muitos artigos aguardando, estabeleça SLA de revisão
- Implemente notificações de revisão urgente
- Considere revisão automática para artigos de qualidade alta

---

### 4️⃣ Taxa de Reutilização

**O que Mede:** Percentual de artigos que foram utilizados em resoluções de tickets

**Exemplo Visual:**
```
┌─────────────────────┐
│  🔗 REUTILIZAÇÃO   │
│       75%          │
│   ↑ 8% vs período  │
│      anterior       │
└─────────────────────┘
```

**Como Interpretar:**
- **> 70%:** Excelente - Base bem alinhada com demanda
- **50-70%:** Bom - Maioria dos artigos está sendo usada
- **30-50%:** Aceitável - Mas há artigos desnecessários ou mal indexados
- **< 30%:** Crítico - Base não alinha com necessidade real

**Análise Complementar:**
- Veja **quais artigos** estão sendo mais reutilizados
- Identifique artigos com **0% reutilização** (candidatos a revisão)
- Procure padrões (artigos novos vs antigos, certas categorias, etc.)

**O Que Fazer:**
- Se baixa: revisite a estratégia de escrita e categorização
- Se alta: é sinal de base saudável
- Qualidade de escrita afeta diretamente reutilização
- Aprenda com artigos de alto uso - estude o padrão

> ✅ **Sucesso:** 75%+ de reutilização indica base estratégica bem estruturada

---

## 🔀 Entendendo o Funil de Governança

O **Funil de Governança** mostra visualmente o ciclo de vida dos artigos.

### Exemplo de Funil

```
                Rascunhos
              245 artigos
                   |
                   ↓ (alguns não progridem)
                   
        Em Revisão  ←─ 32 artigos
                   |
                   ↓ (alguns são rejeitados)
                   
            Publicados
            198 artigos
```

### Interpretando o Fluxo

**Leitura Horizontal (boa saúde):**
```
Rascunho (250) ⟶ Revisão (30) ⟶ Publicado (220)
Fluxo saudável: 88% taxa de conclusão
```

**Leitura com Gargalo (problema):**
```
Rascunho (250) ⟶ Revisão (80) ⟶ Publicado (40)
Problema: Muitos travados em revisão, 16% de conclusão
```

**Indicadores de Problema:**

| Situação | Causa Provável | Ação |
|----------|---|---|
| Muitos em \"Em Revisão\" | Gargalo de revisores | Aumentar revisores ou agilizar processo |
| Muitos rejeitados (vê no histórico) | Padrão de qualidade alto | OK se intencional, revise critério se não |
| Criação não corresponde a publicação | Qualidade baixa de rascunho | Forme criadores com melhor padrão |

---

## 📈 Análise de Evolução KCS

Este gráfico mostra a **série temporal** - como a base evoluiu ao longo do período selecionado.

### Componentes do Gráfico

```
ARTIGOS PUBLICADOS POR DIA
|
|        ✓ ✓
|      ✓ ✓ ✓ ✓
|    ✓ ✓ ✓ ✓ ✓ ✓
|  ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓
|___________________|__
Dias do Período
```

### O Que Observar

**Padrão Saudável:**
- Crescimento consistente ao longo do tempo
- Pequenas variações normais (fins de semana, férias)
- Picos ocasionais (lançamentos de funcionalidade, eventos)

**Padrão Preocupante:**
- Linhas planas (nenhuma criação)
- Quedas súbitas (mudança de prioridade? problema?)
- Sazonalidade extrema (criação só em certos períodos)

### Usos Práticos

**Comparar Periódos:**
- Selecione \"30 dias\" e veja última semana
- Selecione \"90 dias\" e compare mês a mês
- Identificar tendências e sazonalidades

**Identificar Oportunidades:**
- Quando a criação cai, pergunte: por quê?
- Quando sobe, replicar o sucesso
- Correlacione com eventos (launches, treinamentos, etc.)

---

## ⏱️ Filtros de Período - Quando Usar

O Dashboard oferece 4 filtros de período. Cada um serve um propósito:

### 📅 Últimos 7 Dias

**Use Para:**
- Acompanhamento operacional diário
- Identificar problema imediato
- Validar implementação de mudança (\"funcionou nos últimos dias?\")
- Check-in rápido de saúde

**Exemplo:**
\"Apenas ontem criamos 15 artigos e publicamos 8. Ritmo acelerado mas saudável.\"

---

### 📆 Últimos 30 Dias

**Use Para:**
- Análise mensal padrão (mais comum)
- Relatório para gestores
- Trend de curto-prazo
- Comparar com mês anterior

**Exemplo:**
\"No mês, criamos 245 artigos mas apenas publicamos 198. Precisamos acelerar revisão.\"

> 💡 **Dica:** Use isto como seu \"view padrão\" para análises rotineiras

---

### 📊 Últimos 90 Dias

**Use Para:**
- Análise estratégica e de tendências
- Relatórios executivos trimestrais
- Identificar padrões sazonais
- Metas de longo-prazo

**Exemplo:**
\"Nos últimos 90 dias crescemos de 500 para 892 publicados. Evolução de 79%, muito acima da meta de 30%.\"

---

### 📋 Período Customizado

**Use Para:**
- Análise de período específico (entre duas datas)
- Comparar antes/depois de mudança
- Investigar anomalias (\"o que aconteceu em julho?\")
- Períodos fiscais ou de projeto

**Como Usar:**
1. Clique em **Período Customizado**
2. Selecione data inicial e final
3. Clique **Aplicar**

**Exemplo:**
\"Seleciono 01/01 a 31/01 e comparo com 01/02 a 28/02 para avaliar impacto de treinamento.\"

---

## 🚨 Alertas de Qualidade

Os **Alertas** destacam problemas que requerem atenção.

### Tipos de Alertas

#### ⚠️ Alertas Amarelos (Atenção)
- Artigos sem atualização por 6+ meses
- Artigos com taxa de reutilização 0%
- Revisão demorando > 5 dias

**Ação:** Revise, atualize ou documente inatividade

#### 🔴 Alertas Vermelhos (Crítico)
- Artigos com informação desatualizada (sinalizado manualmente)
- Taxa de publicação < 40% (gargalo)
- Muitos artigos rejeitados consecutivamente

**Ação:** Intervenção imediata necessária

### Configurar Alertas

1. Clique em **⚙️ Alertas** (canto superior direito)
2. Customize limiares:
   - Dias sem atualização: [defina]
   - Taxa mínima de reutilização: [%]
   - Tempo máximo de revisão: [dias]
3. Clique **Salvar**

> 🚨 **Crítico:** Administradores devem configurar alertas apropriados para sua organização

---

## 🎯 Casos de Uso Prático

### Caso 1: Gestor Acompanhando Produção

**Persona:** Gestor de Conhecimento  
**Frequência:** Diária  
**Tempo:** 3 minutos

**Ação:**
1. Faça login e vá a Dashboard
2. Verifique **últimos 7 dias**
3. Procure por:
   - ✅ Artigos publicados aumentando? (meta: 5/dia mínimo)
   - ✅ Revisão fluindo? (meta: < 3 dias médio)
   - ⚠️ Alertas vermelhos? (requer ação)

**Se Problema:**
- Muitos em revisão → conversa com revisores
- Poucos criados → incentive produção
- Alertas → resolva a causa

---

### Caso 2: Analista Investigando Qualidade

**Persona:** Analista Sênior  
**Frequência:** Semanal  
**Tempo:** 20 minutos

**Ação:**
1. Selecione **últimos 30 dias**
2. Analise:
   - Taxa de reutilização por categoria
   - Qual % de artigos está em uso?
   - Quais artigos têm 0% reutilização?
3. Clique em artigos com baixa reutilização
4. Pergunte: por quê? (título ruim? conteúdo impreciso? categoria errada?)

**Insight Gerado:**
\"Artigos da categoria 'Billing' têm 95% reutilização vs 'Advanced' com 30%. Reescrever padrão de 'Advanced' seguindo padrão de 'Billing'.\"

---

### Caso 3: Executivo Apresentando Progresso

**Persona:** Diretor / C-level  
**Frequência:** Mensal  
**Tempo:** 10 minutos + 5 min apresentação

**Ação:**
1. Selecione **últimos 90 dias**
2. Capture dados:
   - Total publicado (meta vs realizado)
   - Taxa de reutilização (evolução)
   - Alertas resolvidos (melhoria de qualidade)
3. Crie screenshot ou export de gráfico
4. Prepare narrativa (contexto de business)

**Apresentação:**
\"Base cresceu 79% em 90 dias atingindo 892 artigos, com 75% reutilização. Suportou 45% redução em tempo de resolução de tickets.\"

---

### Caso 4: Pesquisador Identificando Padrões

**Persona:** Especialista em KCS  
**Frequência:** Trimestral  
**Tempo:** 30+ minutos

**Ação:**
1. Use período customizado: últimos 12 meses
2. Observe:
   - Sazonalidade (quando picos de criação?)
   - Crescimento acelerado vs desacelerado
   - Correlação com eventos organizacionais
3. Combine com dados externos (ticket volume, releases de produto, etc.)

**Análise:**
\"Picos de criação coincidem com releases de produto. Sugerimos implementar processo proativo de documentação 2 semanas antes de launch.\"

---

## ✅ Boas Práticas de Análise

### 1. Estabeleça Baselines

Antes de tomar ações, saiba o que é \"normal\":
- Primeira semana: capture números padrão
- Primeira semana: defina metas (ex: 80% publicação, 70%+ reutilização)
- Compare sempre contra baseline

```
Baseline (Semana 1):
- Criados/dia: 8
- Publicados/dia: 6
- Taxa de revisão: 2 dias médio
- Reutilização: 65%

Semana 2 vs Baseline:
- Criados: 8 (OK, mantém ritmo)
- Publicados: 4 (⚠️ -33%, investigar!)
- Revisão: 4 dias (⚠️ +100%, problema)
- Reutilização: 64% (OK, mantém)
```

### 2. Investigue Anomalias

Números atípicos? Não assuma. Investigue:

| Anomalia | Investigação |
|----------|---|
| Criação súbita ↑ | Novo projeto? Nova equipe? Sprint planejada? |
| Publicação ↓ | Revisores ausentes? Critério de qualidade elevou? |
| Reutilização ↓ | Base desatualizada? Categorização confusa? |
| Alertas ↑ | Mudança de processo? Negligência? Escopo mudou? |

### 3. Use Comparação Temporal

Sempre que possível, compare períodos:

✅ **Bom:**
- \"Publicamos 198 esse mês vs 156 mês passado (27% crescimento)\"

❌ **Ruim:**
- \"Publicamos 198\"

### 4. Contextualize com Negócio

Número puro é inútil sem contexto:

✅ **Bom:**
- \"92% reutilização = base estratégica que reduz tempo de resolução 35%\"

❌ **Ruim:**
- \"92% reutilização\"

### 5. Crie Alertas para KPIs Críticos

Configure alertas para suas métricas mais importantes:
- Se reutilização cai abaixo de 65% → alerta
- Se revisão fica > 5 dias → alerta
- Se em revisão > 50 artigos → alerta

---

## 🔧 Troubleshooting

### Problema: Dashboard Não Atualiza

**Sintomas:**
- Números estão desatualizado
- Gráfico não muda após nova criação

**Solução:**
1. Clique no botão **⟳ Atualizar** (canto superior direito)
2. Aguarde 5 segundos
3. Se persistir, faça F5 ou recarregue página
4. Se ainda não funcionar, limpe cache: Ctrl+Shift+Del

**Resultado:** Dashboard deve atualizar em < 10 segundos após refresh

---

### Problema: Permissão Negada

**Sintomas:**
- Mensagem: \"Você não tem permissão para visualizar o Dashboard\"
- Dashboard vazio ou cinzento

**Causas Possíveis:**
- Seu perfil não tem acesso (role muito básico)
- Organização não liberou acesso
- Conta foi desativada

**Solução:**
1. Verifique seu perfil: clique seu avatar → **Meu Perfil**
2. Veja role (deve ser \"Analista\" ou superior)
3. Se baixo, contate administrador: [support@kcshub.com](mailto:support@kcshub.com)

---

### Problema: Números Não Fazem Sentido

**Sintomas:**
- Taxa > 100%?
- Números negativos?
- Totais não batem

**Causa Provável:**
- Filtro aplicado incorretamente
- Dados de teste não foram limpos
- Período customizado com data errada

**Solução:**
1. Verifique período selecionado (canto superior)
2. Clique **Limpar Filtros**
3. Selecione período padrão (30 dias)
4. Se problema persiste, contate support

---

### Problema: Gráfico Não Aparece

**Sintomas:**
- Vê números mas sem gráficos visuais
- Gráfico carrega infinitamente

**Solução (1° tentativa):**
1. Atualize página (F5)
2. Aguarde 30 segundos

**Solução (2° tentativa):**
1. Limpe cache: Ctrl+Shift+Del
2. Selecione \"Todas as cookies e dados\"
3. Feche e reabra navegador

**Solução (3° tentativa):**
1. Tente navegador diferente
2. Se funciona em outro navegador, é problema de compatibilidade
3. Se não funciona em nenhum, contate support

---

## 🎓 Próximos Passos

Você agora domina o Dashboard! Para continuar aprendendo:

1. **Nível 1 - Básico ✅** (você completou)
   - Compreender cada métrica
   - Usar filtros de período
   - Ler o funil de governança

2. **Nível 2 - Intermediário**
   → [Entendendo as Métricas em Profundidade](./metrics-guide.md)
   - Análises avançadas
   - Correlações e padrões
   - Exportar dados

3. **Nível 3 - Avançado**
   → [Administração & Alertas Customizados](../../06-admin/system-settings.md)
   - Configurar alertas personalizados
   - Integrar com BI tools
   - Automações

4. **Próximo Módulo**
   → [Base de Conhecimento - Gerenciamento de Artigos](../02-knowledge-base/overview.md)
   - Criar sua primeira base estratégica
   - Processos de revisão
   - Governo

---

## 📞 Precisa de Ajuda?

Seções relevantes:
- **Mais sobre Métricas:** [Entendendo as Métricas](./metrics-guide.md)
- **Análise Avançada:** [Análise de Evolução KCS](./kcs-evolution.md)
- **Alertas:** [Sistema de Alertas](./quality-alerts.md)
- **FAQ:** [Perguntas Frequentes](../../07-support/faq.md)
- **Erro Específico:** [Referência de Mensagens de Erro](../../07-support/error-messages.md)
- **Contato com Suporte:** [Abra um Ticket](../../07-support/contact.md)

---

## 🔗 Ver Também

Páginas relacionadas:
- [Base de Conhecimento - Visão Geral](../02-knowledge-base/overview.md) - Próximo módulo após dominar Dashboard
- [Funil de Governança - Análise Profunda](./governance-funnel.md) - Mergulho profundo no fluxo de artigos
- [Métricas de Sucesso e KPIs](../../05-best-practices/metrics-kpis.md) - Definindo metas para sua organização
- [Como Escrever Artigos Efetivos](../../05-best-practices/writing-guide.md) - Para melhorar qualidade e reutilização

---

## ✅ Esta página foi útil?

Sua opinião nos ajuda a melhorar. Obrigado!

[👍 Sim - Compreendi o Dashboard](#) | [👎 Não - Precisa de esclarecimentos](#) | [💬 Deixar feedback detalhado](#)

---

**Última atualização:** 27 de abril de 2026  
**Próxima revisão:** 31 de maio de 2026  
**Versão:** 2.0.1 | **Autor:** Equipe de Documentação KCS Hub
