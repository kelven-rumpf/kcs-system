# Guia de Estilo - Documentação KCS Hub

**Versão:** 2.0  
**Data:** 27 de abril de 2026  
**Responsável:** Equipe de Documentação  

---

## 📋 Propósito

Este guia garante consistência, clareza e profissionalismo em toda a documentação do KCS Hub. Todos os autores e contribuidores devem seguir estas diretrizes.

---

## 🎯 Tom e Voz

### Princípios
- ✅ **Profissional mas Acessível** - Evite jargão desnecessário, explique conceitos complexos simplesmente
- ✅ **Ativo e Direto** - Use voz ativa, comandos imperativos quando apropriado
- ✅ **Empático** - Reconheça desafios do usuário, ofereça soluções claras
- ✅ **Consistente** - Mantenha o mesmo tom em todas as seções

### Exemplos

❌ **Ruim:** \"A possibilidade de criar artigos pode ser realizada pelos utilizadores através do módulo de base de conhecimento.\"

✅ **Bom:** \"Você pode criar artigos no módulo Base de Conhecimento.\"

❌ **Ruim:** \"É recomendado que os analistas talvez devessem considerar a implementação de processos de revisão.\"

✅ **Bom:** \"Implemente um processo de revisão formal para garantir qualidade.\"

---

## 📝 Estrutura de Página

### Ordem Padrão
1. **Título H1** (única por página)
2. **Breadcrumb/Navegação** (opcional, para páginas aninhadas)
3. **Metadados** (tempo de leitura, data, autor)
4. **Introdução/Visão Geral** (1-2 parágrafos)
5. **Índice Interno** (para páginas > 5 min de leitura)
6. **Conteúdo Principal** (H2, H3)
7. **Exemplos Práticos** (caso de uso real)
8. **Próximos Passos** (links relacionados)
9. **Feedback Widget** (ao final)

### Exemplo de Estrutura

```markdown
# Título da Página

**Tempo de Leitura:** 8 minutos | **Nível:** Intermediário | **Atualizado:** 27/04/2026

> Breadcrumb: [Documentação](INDEX.md) > [Módulos](03-modules/overview.md) > Esta Página

## Visão Geral
Parágrafo explicativo claro sobre o que a página aborda.

## Índice
- [Seção A](#seção-a)
- [Seção B](#seção-b)

## Seção A
Conteúdo aqui.

### Subseção A.1
Mais conteúdo.

## Ver Também
- [Página Relacionada 1](link)
- [Página Relacionada 2](link)
```

---

## 🔤 Tipografia e Formatação

### Títulos
```markdown
# H1: Título da Página (único, use uma vez)
## H2: Seção Principal
### H3: Subseção
#### H4: Detalhes (usar raramente)
```

### Ênfase
- **Negrito** para termos importantes ou ações críticas
- *Itálico* para referências, nomes de interfaces, ou conceitos
- `Código` para nomes de botões, campos, comandos
- ***Negrito e itálico*** para avisos críticos

### Exemplos
- Acesse a guia **Todos os Artigos**
- O termo *artigo publicado* significa...
- Clique no botão `Criar Novo`
- ***⚠️ Dados não podem ser recuperados após exclusão permanente***

---

## 📌 Elementos Especiais

### Caixas de Informação

#### 💡 Dica
```markdown
> 💡 **Dica:** Você pode usar atalhos para agilizar seu trabalho. 
> Pressione `Ctrl+K` para abrir o painel de busca.
```

#### ⓘ Nota Informativa
```markdown
> ⓘ **Nota:** Este recurso requer permissão de Revisor ou superior.
```

#### ⚠️ Aviso
```markdown
> ⚠️ **Aviso:** Alterações não publicadas serão perdidas ao fechar 
> sem salvar. Use `Ctrl+S` para salvar frequentemente.
```

#### 🚨 Crítico
```markdown
> 🚨 **Crítico:** Apenas administradores podem alterar estas configurações.
> Mudanças incorretas podem afetar todos os usuários do sistema.
```

#### ✅ Sucesso/Bom Resultado
```markdown
> ✅ **Sucesso:** Seu artigo foi publicado com sucesso e está 
> disponível para toda a organização.
```

### Blocos de Código
```markdown
Para código/SQL:
\`\`\`sql
SELECT * FROM articles WHERE status = 'published'
\`\`\`

Para comandos:
\`\`\`bash
npm install kcs-client
\`\`\`

Para snippets genéricos:
\`\`\`
Seu código aqui
\`\`\`
```

### Listas

#### Lista com Marcadores
```markdown
- Item principal
  - Subitem
  - Outro subitem
- Segundo item
```

#### Lista Numerada
```markdown
1. Primeiro passo
2. Segundo passo
   - Detalhe do segundo
   - Outro detalhe
3. Terceiro passo
```

#### Lista de Definições
```markdown
**Termo:** Definição do termo

**Outro Termo:** Sua definição aqui
```

---

## 📊 Tabelas

### Formato
```markdown
| Coluna 1 | Coluna 2 | Coluna 3 |
|----------|----------|----------|
| Valor A  | Valor B  | Valor C  |
| Valor D  | Valor E  | Valor F  |
```

### Boas Práticas
- Mantenha linhas concisas
- Máximo 4-5 colunas (considere dividir se precisar mais)
- Alinhe números à direita, texto à esquerda
- Use cabeçalhos descritivos

---

## 🔗 Links

### Link Interno
```markdown
[Texto do Link](../caminho/arquivo.md#seção-específica)
```

### Link Externo
```markdown
[Visite nosso blog](https://blog.kcshub.com)
```

### Links de Referência
```markdown
Veja a [documentação de integração][1] para mais detalhes.

[1]: 06-admin/integrations.md
```

### Boas Práticas
- Use URLs descritivas, não "clique aqui"
- Relate links internos a seções relevantes
- Valide se os links funcionam antes de publicar
- Links para seções: use hashtags minúsculas com hífen

---

## 🖼️ Imagens e Diagramas

### Convenção de Imagens
- Pasta: `/assets/screenshots/` ou `/assets/diagrams/`
- Nomenclatura: `modulo-funcionalidade-descricao.png`
- Tamanho: máximo 1MB, resolução mínima 800px largura
- Formato: PNG para screenshots, SVG para diagramas

### Sintaxe
```markdown
![Descrição alternativa](../assets/screenshots/dashboard-metrics.png)
```

### Descrição Obrigatória
```markdown
**Figura 1: Dashboard Executivo - Seção de Métricas**
![Dashboard mostrando 4 métricas principais](../assets/screenshots/dashboard-metrics.png)
```

### Diagramas
```markdown
Use Mermaid para diagramas:

\`\`\`mermaid
graph TD
    A[Rascunho] --> B[Em Revisão]
    B --> C[Publicado]
    B --> D[Rejeitado]
\`\`\`
```

---

## 📈 Exemplos Práticos

Toda página com procedimentos deve incluir **ao menos 1 exemplo prático**:

```markdown
## Exemplo: Criando seu Primeiro Artigo

Suponha que você é um analista de suporte criando um artigo 
sobre "Como redefinir senha de usuário".

1. Acesse **Base de Conhecimento** > **Rascunhos**
2. Clique em **+ Novo Artigo**
3. Defina:
   - **Título:** "Como Redefinir Senha de Usuário"
   - **Categoria:** "Gestão de Conta"
   - **Descrição:** "Procedimento para usuários que esqueceram a senha"
4. Clique em **Salvar**

✅ Seu artigo foi criado e está pronto para edição.
```

---

## 🎯 Exemplos de Métricas/Dados

Use dados realistas mas genéricos:

```markdown
**❌ Ruim:** "Havia muitos artigos"

**✅ Bom:** "A base cresceu de 245 para 892 artigos em 90 dias"

**✅ Ainda Melhor:** "Crescimento de 264% em 90 dias 
(245 → 892 artigos), mantendo taxa de qualidade em 94%"
```

---

## ✍️ Checklist de Escrita

Antes de publicar uma página, verifique:

- [ ] Título H1 é único e descritivo
- [ ] Metadados (tempo de leitura, data) foram adicionados
- [ ] Introdução deixa claro do que se trata
- [ ] Nenhum parágrafo tem > 4 linhas
- [ ] Todas as listas estão formatadas corretamente
- [ ] Nenhuma sigla usada sem explicação (primeira menção: explique)
- [ ] Todos os links internos funcionam
- [ ] Imagens têm descrição alternativa
- [ ] Ao menos um exemplo prático foi incluído
- [ ] Seção \"Ver Também\" ou \"Próximos Passos\" está presente
- [ ] Nenhum jargão desnecessário
- [ ] Voz ativa predomina sobre passiva
- [ ] Revisto para erros ortográficos e gramaticais
- [ ] Feedback widget está no final

---

## 🔄 Versionamento

### Mudanças Que Requerem Atualização de Versão

**Patch (0.0.X):** Correções menores, ortografia, exemplos  
**Minor (0.X.0):** Nova seção, conteúdo adicional substancial  
**Major (X.0.0):** Reestruturação, mudanças significativas de conteúdo  

### Formato de Cabeçalho com Versão
```markdown
# Título da Página

**Versão:** 2.1.3 | **Atualizado:** 27/04/2026 | **Autor:** [Nome]
```

---

## 🌐 Responsividade

Documentação deve funcionar em:
- Desktop (1920px+)
- Tablet (768px - 1024px)
- Mobile (320px - 767px)

Evite:
- Tabelas muito largas (considere versão mobile)
- Imagens muito grandes sem redimensionamento
- Blocos de código > 80 caracteres sem quebra

---

## 📞 Perguntas ou Dúvidas?

Contate a equipe de documentação:
- 📧 Email: docs@kcshub.com
- 💬 Slack: #documentation
- 🐛 GitHub: github.com/kcshub/documentation/issues

---

**Data de Revisão Anterior:** 15 de março de 2026  
**Próxima Revisão:** 31 de maio de 2026
