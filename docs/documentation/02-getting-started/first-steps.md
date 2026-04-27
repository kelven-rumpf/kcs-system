# Seus Primeiros Passos

**Tempo de Leitura:** 8 minutos | **Nível:** Iniciante | **Atualizado:** 27 de abril de 2026 | **Autor:** Equipe de Documentação

> **Breadcrumb:** [Documentação](../../INDEX.md) > [Guia de Início Rápido](./getting-started.md) > Esta Página

---

## 🎯 Bem-vindo ao KCS Hub!

Este guia rápido vai te colocar produtivo em menos de 10 minutos. Se é seu primeiro dia, você está no lugar certo.

---

## 📑 O que Você Aprenderá

- ✅ Fazer login no sistema
- ✅ Conhecer a interface principal
- ✅ Navegar entre módulos
- ✅ Executar sua primeira ação (criar artigo/ver dashboard)
- ✅ Encontrar ajuda quando precisar

---

## 1️⃣ Fazer Login

### Via SSO (Single Sign-On)

**Recomendado para a maioria das organizações**

1. Acesse: `https://kcshub.com`
2. Clique em **\"Fazer Login com SSO\"**
3. Selecione sua organização
4. Autentique com suas credenciais corporativas (Google, Azure, Okta, etc.)
5. ✅ Você será redirecionado para o Dashboard

> 💡 **Dica:** Marque \"Lembrar este navegador\" para não precisar autenticar novamente

### Via Email (Se SSO Não Disponível)

1. Acesse: `https://kcshub.com/login`
2. Digite seu email corporativo
3. Clique em **\"Enviar Link de Login\"**
4. Verifique seu email
5. Clique no link recebido
6. ✅ Você será logado automaticamente

> ⓘ **Nota:** Links de email expiram em 24 horas

---

## 2️⃣ Sua Primeira Visualização

### O Layout Principal

```
┌─────────────────────────────────────────┐
│ Header: Logo | Busca | Avatar           │
├────────────┬──────────────────────────┤
│  Menu      │  CONTEÚDO PRINCIPAL      │
│  Lateral   │                          │
│            │  (Muda por módulo)       │
│  - Home    │                          │
│  - Base    │                          │
│  - Dash    │                          │
│  - Admin   │                          │
│            │                          │
└────────────┴──────────────────────────┘
```

### Componentes-Chave

| Elemento | O que Faz | Dica |
|----------|-----------|------|
| **Logo (canto superior esquerdo)** | Clique para voltar à página inicial | Sempre disponível |
| **Busca (topo centro)** | Pesquisa rápida em artigos/categorias | Atalho: `Ctrl+K` |
| **Seu Avatar (canto superior direito)** | Menu pessoal: Perfil, Preferências, Logout | Clique para ver opções |
| **Menu Lateral** | Navegação principal entre módulos | Pode ser recolhido |
| **Área Principal** | Conteúdo do módulo selecionado | Muda conforme você navega |

---

## 3️⃣ Conhecendo os Módulos

### 📊 Dashboard (Sua Primeira Parada)

**O que é:** Visão geral de saúde e métricas da base

**Acesse:** Clique em **Dashboard** no menu lateral

**O que você vê:**
- 4 números principais: Criados, Publicados, Em Revisão, Reutilização
- Gráfico do fluxo de artigos (Funil)
- Gráfico de evolução temporal
- Alertas de qualidade

**Ação para experimentar:**
1. Veja o número de artigos em sua base
2. Compare com filtro \"7 dias\" vs \"90 dias\"
3. Note: crescimento está acelerando ou desacelerando?

> 👉 Para dominar o Dashboard, veja [Dashboard Executivo - Guia Completo](../../03-modules/01-dashboard/dashboard-guide.md) ⭐

---

### 📚 Base de Conhecimento

**O que é:** Biblioteca centralizada de todos os artigos

**Acesse:** Clique em **Base de Conhecimento** no menu lateral

**Abas Disponíveis:**
- **Todos os Artigos** - Visão completa, com filtros
- **Meus Favoritos** - Artigos que você favoritou (❤️)
- **Rascunhos** - Artigos que você está criando
- **Em Revisão** - Artigos aguardando aprovação
- **Publicados** - Artigos live e ativos

**Ação para experimentar:**
1. Clique em **Todos os Artigos**
2. Digite uma palavra na busca (ex: \"senha\", \"erro\", \"como\")
3. Veja os resultados
4. Clique em um artigo para lê-lo

---

### 📂 Categorias

**O que é:** Estrutura de organização dos artigos

**Acesse:** Clique em **Categorias** no menu lateral

**O que você vê:**
- Árvore de categorias da sua organização
- Número de artigos em cada categoria
- Saúde de cada categoria

**Ação para experimentar:**
1. Explore a estrutura de categorias
2. Clique em uma categoria
3. Veja artigos dentro dela
4. Note: qual categoria tem mais artigos?

---

### 🔧 Biblioteca SQL (Se Disponível)

**O que é:** Repositório de scripts SQL reutilizáveis

**Acesse:** Clique em **Biblioteca SQL** no menu lateral

**Ação para experimentar:**
1. Veja scripts disponíveis (se houver)
2. Veja descrição de um script
3. Copie e utilize em sua ferramenta de BD

---

### ⚙️ Administração (Se Você for Admin)

**O que é:** Configurações avançadas do sistema

**Acesse:** Clique em **Administração** no menu lateral

**Ação para experimentar:**
1. Veja usuários do sistema
2. Veja configurações de segurança
3. Se mudou algo acidentalmente, contate seu admin

---

## 4️⃣ Sua Primeira Ação Prática

### Opção A: Criar Seu Primeiro Artigo

**Tempo:** 5 minutos

**Passos:**

1. Vá para **Base de Conhecimento**
2. Clique em **Rascunhos** (aba)
3. Clique em **+ Novo Artigo** (botão azul)
4. Preencha:
   - **Título:** Ex: \"Como Redefinir Minha Senha\"
   - **Categoria:** Selecione uma (ex: \"FAQ\" ou \"Gestão de Conta\")
   - **Descrição:** Uma linha breve
5. Clique em **Criar**
6. ✅ Seu artigo foi criado!

**Próximas ações:**
- Escrever conteúdo (clique em **Editar**)
- Submeter para revisão (clique em **Enviar para Revisão**)

> 👉 Para um guia detalhado, veja [Criando seu Primeiro Artigo](./create-first-article.md)

---

### Opção B: Explorar um Artigo Existente

**Tempo:** 3 minutos

1. Vá para **Base de Conhecimento**
2. Clique em **Publicados**
3. Clique em qualquer artigo
4. Leia o conteúdo
5. Note:
   - Como é estruturado?
   - Como podia ser melhorado?
   - Este tipo de artigo será seu modelo

> 💡 **Dica:** Estude artigos bem avaliados como referência para seus próprios

---

### Opção C: Ver o Dashboard e Entender as Métricas

**Tempo:** 5 minutos

1. Vá para **Dashboard**
2. Procure as 4 métricas:
   - **Criados:** Quantos artigos foram criados este período?
   - **Publicados:** Quantos foram publicados?
   - **Em Revisão:** Quantos esperam aprovação?
   - **Reutilização:** Qual % dos artigos está sendo usado?
3. Interprete: a base está saudável?

> 👉 Para detalhar cada métrica, veja [Dashboard Executivo - Guia Completo](../../03-modules/01-dashboard/dashboard-guide.md) ⭐

---

## 5️⃣ Atalhos Essenciais

Economize tempo com estes comandos de teclado:

| Atalho | O que Faz |
|--------|-----------|
| `Ctrl+K` | Abre busca global (procura artigos, categorias) |
| `Ctrl+S` | Salva o artigo que está editando |
| `Ctrl+B` | Negrito no editor de artigo |
| `Ctrl+I` | Itálico no editor de artigo |
| `Escape` | Fecha diálogos/modais |
| `/` | Menu rápido (quando em edição) |

> 💡 **Dica:** Use `Ctrl+K` como seu atalho principal - pesquisa tudo no sistema

---

## 6️⃣ Configurar Seu Perfil

**Tempo:** 2 minutos

1. Clique em seu **Avatar** (canto superior direito)
2. Clique em **Meu Perfil**
3. Complete:
   - **Foto:** Adicione sua foto (melhora reconhecimento)
   - **Departamento:** Onde você trabalha
   - **Função:** Qual é sua função/role
   - **Idioma:** Preferência de idioma
4. Clique **Salvar**

**Benefício:** Outros sabem com quem estão colaborando

---

## 7️⃣ Explorar Recursos de Ajuda

### 🔍 Quando Você Tiver Dúvida

| Situação | Acesse |
|----------|--------|
| Dúvida sobre Dashboard | [Dashboard Executivo - Guia Completo](../../03-modules/01-dashboard/dashboard-guide.md) |
| Erro específico | [Referência de Mensagens de Erro](../../07-support/error-messages.md) |
| Como criar artigos | [Como Escrever Artigos Efetivos](../../05-best-practices/writing-guide.md) |
| Dúvida geral | [FAQ - Perguntas Frequentes](../../07-support/faq.md) |
| Precisa de suporte urgente | [Contato com Suporte](../../07-support/contact.md) |

### 📚 Toda Documentação

Acesse o **Índice Completo:** [Documentação KCS Hub](../../INDEX.md)

---

## ✅ Checklist de Primeiros Passos

Você completou este guia? Marque:

- [ ] Fiz login no sistema
- [ ] Visitei o Dashboard
- [ ] Explorei cada módulo (Base, Categorias, etc.)
- [ ] Criei OU exploreiuma artigo
- [ ] Configurei meu perfil
- [ ] Salvei o link da documentação como favorito
- [ ] Testei o atalho `Ctrl+K` (busca)

**Se marcou tudo:** ✅ Você está pronto para usar o KCS Hub!

---

## 🚀 Próximos Passos Recomendados

### Para Analistas / Criadores de Conteúdo
→ [Como Escrever Artigos Efetivos](../../05-best-practices/writing-guide.md)  
→ [Ciclo de Vida de um Artigo](../../04-workflows/article-lifecycle.md)  

### Para Revisores / Aprovadores
→ [Processo de Revisão e Aprovação](../../04-workflows/review-process.md)  
→ [Padrões de Qualidade](../../05-best-practices/quality-standards.md)  

### Para Gestores / Executivos
→ [Dashboard Executivo - Guia Completo](../../03-modules/01-dashboard/dashboard-guide.md) ⭐  
→ [Métricas de Sucesso e KPIs](../../05-best-practices/metrics-kpis.md)  

### Para Administradores
→ [Gestão de Usuários e Permissões](../../06-admin/user-management.md)  
→ [Configurações do Sistema](../../06-admin/system-settings.md)  

---

## 💬 Dúvida?

- **Não consigo logar:** [FAQ - Problemas de Login](../../07-support/faq.md#problemas-de-login)
- **Mensagem de erro:** [Referência de Mensagens de Erro](../../07-support/error-messages.md)
- **Outra dúvida:** [Perguntas Frequentes](../../07-support/faq.md)
- **Suporte direto:** [Entre em Contato](../../07-support/contact.md)

---

## 🔗 Ver Também

- [O que é KCS Hub?](../01-introduction/overview.md) - Entenda a plataforma
- [Tour Interativa da Interface](./interface-tour.md) - Exploração guiada
- [Criando seu Primeiro Artigo](./create-first-article.md) - Próximo passo
- [Atalhos e Dicas Práticas](./shortcuts-tips.md) - Domine o sistema

---

## ✅ Esta página foi útil?

[👍 Sim - Comecei rápido](#) | [👎 Não - Tive dificuldade](#) | [💬 Deixar feedback](#)

---

**Última atualização:** 27 de abril de 2026  
**Próxima revisão:** 31 de maio de 2026  
**Versão:** 1.0 | **Autor:** Equipe de Documentação KCS Hub
