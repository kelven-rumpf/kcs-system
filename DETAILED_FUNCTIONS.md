# Funções Completas Alteradas/Adicionadas

## 1. Função Global de Filtros (ADICIONADA)

```javascript
// ==========================================
// FUNÇÃO GLOBAL DE FILTROS PARA ADMIN
// ==========================================
window.__kcsAdminFilters = window.__kcsAdminFilters || {
    companyId: '',
    sectorId: '',
    role: ''
};

function applyAdminUserFilters() {
    const companyFilter = window.__kcsAdminFilters.companyId;
    const sectorFilter = window.__kcsAdminFilters.sectorId;
    const roleFilter = window.__kcsAdminFilters.role;

    const rows = document.querySelectorAll('[data-user-row="true"]');
    let visibleCount = 0;

    rows.forEach(row => {
        const company = row.dataset.companyId || '';
        const sector = row.dataset.sectorId || '';
        const role = row.dataset.role || '';

        const matchCompany = !companyFilter || company === companyFilter;
        const matchSector = !sectorFilter || sector === sectorFilter;
        const matchRole = !roleFilter || role === roleFilter;

        const isVisible = matchCompany && matchSector && matchRole;
        row.style.display = isVisible ? '' : 'none';
        if (isVisible) visibleCount++;
    });

    // Mostrar mensagem se nenhum usuário visível
    const emptyMsg = document.querySelector('[id$="admin-users-empty-msg"]');
    if (rows.length > 0) {
        if (!emptyMsg && visibleCount === 0) {
            const tbody = document.querySelector('#admin-users-tbody');
            if (tbody) {
                const msg = document.createElement('tr');
                msg.id = 'admin-users-empty-msg';
                msg.innerHTML = `<td colspan="6" class="py-6 text-center text-sm italic" style="color: var(--color-text-muted);">Nenhum usuário encontrado com os filtros aplicados.</td>`;
                tbody.appendChild(msg);
            }
        } else if (emptyMsg && visibleCount > 0) {
            emptyMsg.remove();
        }
    }
}

window.__kcsApplyUserFilters = applyAdminUserFilters;
```

---

## 2. Função handleToggleUserGroup (ALTERADA)

```javascript
async function handleToggleUserGroup(userId, groupId, checked) {
    if (!userId || !groupId) return;

    const currentUser = users.find(u => u.id === userId || u.uid === userId);
    if (!currentUser) return;

    const currentGroupIds = Array.isArray(currentUser.group_ids)
        ? [...currentUser.group_ids]
        : currentUser.group_id
            ? [currentUser.group_id]
            : [];

    const nextGroupIds = checked
        ? [...new Set([...currentGroupIds, groupId])]
        : currentGroupIds.filter(id => id !== groupId);

    // Salvar no Firestore
    await updateUserGroupsInCloud(userId, nextGroupIds);

    // Atualizar localmente em vez de recarregar
    currentUser.group_ids = nextGroupIds;
    currentUser.group_id = nextGroupIds[0] || null;

    // Atualizar apenas o contador do usuário no DOM
    const countEl = document.querySelector(`[data-user-group-count="${userId}"]`);
    if (countEl) {
        countEl.textContent = `${nextGroupIds.length} selecionado${nextGroupIds.length === 1 ? '' : 's'}`;
    }
}
```

**Mudanças**:
- ✅ Removido `window.TabManager.closeTab('tab-admin-panel', false)`
- ✅ Removido `await openSettingsModal()`
- ✅ Adicionada atualização local do objeto user: `currentUser.group_ids = nextGroupIds`
- ✅ Adicionada atualização do contador no DOM com `data-user-group-count`

---

## 3. Função openSettingsModal - Início (ALTERADA)

```javascript
export async function openSettingsModal() {
    const idUnico = 'tab-admin-panel';
    const container = document.createElement('div');
    container.className = 'flex flex-col h-full bg-editor-background';
    container.id = `view-container-${idUnico}`;
    container.style.backgroundColor = 'var(--color-editor-background)';
    
    // Garantir que a aba não seja marcada como dirty ANTES de renderizar
    if (window.TabManager?.markDirty) {
        window.TabManager.markDirty('tab-admin-panel', false);
    }
    
    function adminSection(title, icon, colorClass, contentHtml, defaultOpen = true) {
        // ... resto da função
    }
    
    // ... resto do código
}
```

---

## 4. HTML da Tabela de Usuários (ALTERADA)

### Data attributes adicionados:

```html
<tr class="transition-colors hover:bg-black/5 dark:hover:bg-white/5" 
    data-user-row="true"
    data-user-id="${u.id}" 
    data-company-id="${userCompanyId}" 
    data-sector-id="${userSectorId}" 
    data-role="${userRole}">
    <!-- ... outras colunas ... -->
    <td class="py-3 px-5">
        <details class="rounded-lg overflow-hidden transition-colors" style="background-color: var(--color-editor-background); border: 1px solid var(--color-border);">
            <summary class="flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5" style="color: var(--color-text-primary); list-style:none;">
                <span class="flex items-center gap-1.5">
                    <i class="ph-bold ph-caret-right text-xs"></i>
                    <span>Grupos <strong>(<span data-user-group-count="${u.id}">${selectedCount}</span>)</strong></span>
                </span>
            </summary>
            <!-- ... resto dos checkboxes ... -->
        </details>
    </td>
</tr>
```

**Data attributes importantes**:
- `data-user-row="true"` - Identifica linhas de usuário (para filtros)
- `data-company-id="${userCompanyId}"` - Para filtro de empresa
- `data-sector-id="${userSectorId}"` - Para filtro de setor
- `data-role="${userRole}"` - Para filtro de cargo
- `data-user-group-count="${u.id}"` - Para atualizar contador dinamicamente

---

## 5. Event Listeners dos Filtros (REORGANIZADOS)

```javascript
// Inicializar filtros de usuários
requestAnimationFrame(() => {
    // Vincular eventos de filtros
    ['filter-company', 'filter-sector', 'filter-role'].forEach(id => {
        const element = container.querySelector(`#${id}`);
        if (element) {
            element.addEventListener('change', (e) => {
                window.__kcsAdminFilters = window.__kcsAdminFilters || {};
                if (id === 'filter-company') window.__kcsAdminFilters.companyId = e.target.value;
                if (id === 'filter-sector') window.__kcsAdminFilters.sectorId = e.target.value;
                if (id === 'filter-role') window.__kcsAdminFilters.role = e.target.value;
                applyAdminUserFilters();
            });
        }
    });

    // Aplicar filtros iniciais
    if (window.__kcsApplyUserFilters) {
        window.__kcsApplyUserFilters();
    }
});

// Garantir que a aba não seja marcada como dirty
if (window.TabManager?.markDirty) {
    window.TabManager.markDirty('tab-admin-panel', false);
}
```

**Melhorias**:
- ✅ Removido script inline do template HTML
- ✅ Adicionado em `requestAnimationFrame()` para garantir que o DOM está pronto
- ✅ Escopo dos listeners limitado ao `container` específico
- ✅ Chamada final de `markDirty(false)` garante que admin nunca será dirty

---

## 6. Modificação em main.js - openTab()

```javascript
// Adicionar listener de input para marcar dirty, EXCETO para a aba de Administração
contentPanel.addEventListener('input', () => {
    if (id !== 'tab-admin-panel') {
        markDirty(id, true);
    }
});
```

**Mudança**:
- ✅ Adicionada verificação `if (id !== 'tab-admin-panel')` para evitar marcar admin como dirty por inputs genéricos

---

## 🔑 Pontos-Chave das Implementações

1. **Atualização Local**: `handleToggleUserGroup()` atualiza o objeto local `currentUser` e o DOM, sem recarregar
2. **Data Attributes**: `data-user-row`, `data-company-id`, `data-sector-id`, `data-role`, `data-user-group-count`
3. **Filtros Globais**: `window.__kcsAdminFilters` mantém estado dos filtros
4. **Proteção Dirty**: Três camadas de proteção contra marcar admin como dirty
5. **Sem Reload**: Nenhuma chamada a `openSettingsModal()` após checkbox

