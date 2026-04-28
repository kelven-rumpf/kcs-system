/**
 * TabManager — Gerenciador de Abas MDI (VS Code Style)
 */
export const TabManager = (() => {
    const tabs = new Map();
    let activeTabId = null;

    /**
     * Cria e abre uma nova Aba no Workspace.
     * @param {string} id - ID único do documento (ex: artigo.id ou 'novo-123')
     * @param {string} title - Título que vai na Aba
     * @param {string} iconClass - Classe Phosphor do ícone (ex: 'ph-file-text')
     * @param {HTMLElement} formContent - O DOM Node contendo o formulário/visualizador
     */
    function openTab(id, title, iconClass, formContent) {
        const tabBar = document.getElementById('workbench-tabs-bar');
        const contentsContainer = document.getElementById('workbench-tab-contents');
        
        tabBar.classList.remove('hidden');

        // Se a aba já existe, apenas a ativamos (ou restauramos do dock)
        if (tabs.has(id)) {
            const tab = tabs.get(id);
            if (tab.minimized) restoreTab(id);
            else switchTab(id);
            return;
        }

        // 1. Criar a interface da Aba
        const tabEl = document.createElement('div');
        tabEl.className = 'editor-tab group';
        tabEl.id = `tab-${id}`;
        tabEl.innerHTML = `
            <i class="ph ${iconClass} text-blue-500"></i>
            <span class="editor-tab-title" title="${title}">${title}</span>
            <div class="editor-tab-actions">
                <button type="button" class="editor-tab-btn btn-min-tab" title="Minimizar para o Dock"><i class="ph-bold ph-minus"></i></button>
                <button type="button" class="editor-tab-btn btn-close-tab" title="Fechar (Unsaved)"><i class="ph-bold ph-x"></i></button>
            </div>
        `;

        // 2. Criar o Painel de Conteúdo
        const contentPanel = document.createElement('div');
        contentPanel.className = 'tab-content-panel custom-scrollbar';
        contentPanel.id = `tab-panel-${id}`;
        contentPanel.appendChild(formContent); // Injeta o formulário preservando os listeners

        // 3. Anexar ao DOM
        tabBar.appendChild(tabEl);
        contentsContainer.appendChild(contentPanel);

        // 4. Registrar Estado
        tabs.set(id, { id, title, tabEl, contentPanel, minimized: false, dirty: false });

        // 5. Event Listeners da Aba
        tabEl.addEventListener('click', (e) => {
            if (!e.target.closest('button')) switchTab(id);
        });

        tabEl.querySelector('.btn-min-tab').addEventListener('click', (e) => {
            e.stopPropagation(); minimizeTab(id);
        });

        tabEl.querySelector('.btn-close-tab').addEventListener('click', (e) => {
            e.stopPropagation(); closeTab(id);
        });

        // 6. Monitor de "Dirty State" (Qualquer input dispara a bolinha), com exceções de abas gerenciais
        contentPanel.addEventListener('input', () => {
            if (id === 'tab-admin-panel' || id === 'tab-category-manager') return;
            markDirty(id, true);
        });

        switchTab(id);
    }

    function switchTab(id) {
        // Desativa a atual
        if (activeTabId && tabs.has(activeTabId)) {
            const prev = tabs.get(activeTabId);
            prev.tabEl.classList.remove('active');
            prev.contentPanel.classList.remove('active');
        } else {
            // Se veio da Home, esconde a Home
            document.getElementById('home-view-container').classList.remove('active');
        }

        activeTabId = id;

        if (id) {
            const curr = tabs.get(id);
            curr.tabEl.classList.add('active');
            curr.contentPanel.classList.add('active');
            
            // Rola a barra de abas para focar a aba atual
            curr.tabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        } else {
            // Nenhuma aba ativa (todas fechadas ou minimizadas), volta para a Home (Grid/Dash)
            document.getElementById('home-view-container').classList.add('active');
            
            // Esconde a barra de abas se estiver vazia
            const activeOrVisibleTabs = Array.from(tabs.values()).filter(t => !t.minimized);
            if (activeOrVisibleTabs.length === 0) {
                document.getElementById('workbench-tabs-bar').classList.add('hidden');
            }
        }
    }

    function closeTab(id, force = false) {
        const tab = tabs.get(id);
        if (!tab) return;
        
        if (!force && tab.dirty) {
            if (!confirm(`O documento "${tab.title}" possui alterações não salvas. Deseja realmente fechá-lo?`)) return;
        }

        tab.tabEl.remove();
        tab.contentPanel.remove();
        tabs.delete(id);
        removeFromDock(id);

        if (activeTabId === id) {
            const remaining = Array.from(tabs.values()).filter(t => !t.minimized);
            if (remaining.length > 0) {
                switchTab(remaining[remaining.length - 1].id); // Foca na aba anterior
            } else {
                switchTab(null); // Vai pra Home
            }
        }
    }

    function markDirty(id, isDirty) {
        const tab = tabs.get(id);
        if (tab && tab.dirty !== isDirty) {
            tab.dirty = isDirty;
            tab.tabEl.classList.toggle('is-dirty', isDirty);
        }
    }

    function minimizeTab(id) {
        const tab = tabs.get(id);
        if (!tab) return;

        tab.minimized = true;
        tab.tabEl.style.display = 'none'; // Esconde a aba superior
        tab.contentPanel.classList.remove('active');

        createDockItem(id, tab.title);

        if (activeTabId === id) {
            const remaining = Array.from(tabs.values()).filter(t => !t.minimized);
            if (remaining.length > 0) switchTab(remaining[remaining.length - 1].id);
            else switchTab(null);
        }
    }

    function restoreTab(id) {
        const tab = tabs.get(id);
        if (!tab) return;

        tab.minimized = false;
        tab.tabEl.style.display = 'flex';
        removeFromDock(id);
        switchTab(id);
    }

    // --- Integração com o KCS Dock Inferior (Gmail Style) ---
    function createDockItem(id, title) {
        const dock = document.getElementById('kcs-dock');
        if (!dock || document.getElementById(`dock-${id}`)) return;

        const dockTab = document.createElement('div');
        dockTab.className = 'kcs-minimized-tab dock-tab';
        dockTab.id = `dock-${id}`;
        dockTab.innerHTML = `
            <span class="dock-tab-title" title="${title}">${title}</span>
            <div class="dock-tab-actions">
                <button type="button" class="btn-restore" title="Restaurar Aba">⤢</button>
                <button type="button" class="btn-close" title="Fechar">✕</button>
            </div>
        `;
        
        dockTab.addEventListener('click', (e) => {
            if (!e.target.closest('button')) restoreTab(id);
        });
        dockTab.querySelector('.btn-restore').addEventListener('click', (e) => {
            e.stopPropagation(); restoreTab(id);
        });
        dockTab.querySelector('.btn-close').addEventListener('click', (e) => {
            e.stopPropagation(); closeTab(id);
        });

        dock.appendChild(dockTab);
        dock.classList.add('dock-visible'); // Força abertura do dock
    }

    function removeFromDock(id) {
        const dockItem = document.getElementById(`dock-${id}`);
        if (dockItem) dockItem.remove();

        const dock = document.getElementById('kcs-dock');
        if (dock && dock.querySelectorAll('.dock-tab').length === 0) {
            dock.classList.remove('dock-visible');
        }
    }

    return { openTab, switchTab, closeTab, markDirty, minimizeTab };
})();

// Expor para o Window para acesso global
window.TabManager = TabManager;
