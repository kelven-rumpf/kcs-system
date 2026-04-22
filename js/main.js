// CONTROLE DE VERSÃO DO SISTEMA
const APP_VERSION = '1.0.1';

import { 
    initAuth, 
    logout as authLogout, 
    getCurrentUser, 
    hasPermission, 
    updateUserRoleInCloud, 
    updateUserCompanyInCloud, 
    updateUserSectorInCloud, 
    createCompanyInCloud, 
    deleteUserInCloud, 
    inviteUserToSystem, 
    removeInvitedUser,
    updateCompanyPlanInCloud,
    updateCompanyDetailsInCloud,
    deleteCompanyInCloud

} from './auth.js';

import { 
    listArticles, 
    createArticle, 
    updateArticle, 
    removeArticle, 
    getArticle, 
    toggleLike as apiToggleLike, 
    toggleFavorite as apiToggleFavorite, 
    addComment, 
    flagArticle,
    initArticleNotifications,
    logArticleRead
} from './services/kcsCore.js';
import { 
    listSqlScripts, 
    createSqlScript, 
    updateSqlScript, 
    removeSqlScript, 
    getSqlScript, 
    toggleSqlLike as apiToggleSqlLike, 
    toggleSqlFavorite as apiToggleSqlFavorite, 
    addSqlComment, 
    flagSqlScript, 
    explicarScriptSQL 
} from './services/sqlLibrary.js';
import { initCategories, getCategoryTree } from './services/categories.js';
import { applyFilters } from './services/search.js';
import { 
    renderArticleGrid, 
    renderSqlGrid, 
    renderSidebar, 
    renderHeader, 
    renderDashboard, 
    toggleLoginScreen, 
    showToast, 
    showLoading, 
    computeCounts, 
    computeSqlCounts, 
    escapeHtml,
    addNotificationUI,
    renderCompanyPlanBadge
} from './ui/render.js';

import { 
    openArticleModal, 
    closeArticleModal, 
    openViewModal, 
    closeViewModal, 
    openDuplicityModal, 
    openReadmeModal, 
    asyncAlert, 
    asyncPrompt, 
    openConfirmModal, 
    openSqlModal, 
    closeSqlModal, 
    openSqlViewModal, 
    openHistoryModal, 
    openCategoryModal, 
    openSettingsModal 
} from './ui/modal.js';
import { initEditor, insertFormatting, resetEditor } from './ui/editor.js';
import { TENANT_KEYS } from './config.js';

// Alteração para quebra e mudança de CACHE
import { initChatbot } from './ui/chatbot.js?v=12';

import { initTour } from './tour.js';

import { triggerCloudBackup } from './services/cloud.js';

import { getTopAnalysts, getTopCollaborators } from './services/dashboard.js';

// ==========================================================================
// TAB MANAGER: MOTOR DE GERENCIAMENTO DE ABAS (VS CODE STYLE)
// ==========================================================================
window.TabManager = (() => {
    const tabs = new Map();
    let activeTabId = null;

    function openTab(id, title, iconClass, formContent) {
        const tabBar = document.getElementById('workbench-tabs-bar');
        const contentsContainer = document.getElementById('workbench-tab-contents');
        
        if (tabBar) tabBar.classList.remove('hidden');

        // Se a aba já existe, apenas ativa ela
        if (tabs.has(id)) {
            switchTab(id);
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
                <button type="button" class="editor-tab-btn btn-min-tab" title="Recolher Aba (Ver Dashboard)"><i class="ph-bold ph-minus"></i></button>
                <button type="button" class="editor-tab-btn btn-close-tab" title="Fechar"><i class="ph-bold ph-x"></i></button>
            </div>
        `;

        // 2. Criar o Painel de Conteúdo
        const contentPanel = document.createElement('div');
        contentPanel.className = 'tab-content-panel custom-scrollbar';
        contentPanel.id = `tab-panel-${id}`;
        contentPanel.appendChild(formContent);

        // 3. Anexar ao DOM
        if (tabBar) tabBar.appendChild(tabEl);
        if (contentsContainer) contentsContainer.appendChild(contentPanel);

        tabs.set(id, { id, title, tabEl, contentPanel, dirty: false });

        // 4. Event Listeners
        tabEl.addEventListener('click', (e) => {
            if (!e.target.closest('button')) switchTab(id);
        });

        // O botão de minimizar agora apenas "desfoca" a aba, mantendo-a no topo
        tabEl.querySelector('.btn-min-tab').addEventListener('click', (e) => {
            e.stopPropagation(); 
            minimizeTab(id);
        });

        tabEl.querySelector('.btn-close-tab').addEventListener('click', (e) => {
            e.stopPropagation(); 
            closeTab(id);
        });

        contentPanel.addEventListener('input', () => markDirty(id, true));

        switchTab(id);
    }

    function switchTab(id) {
        // Oculta a aba atual
        if (activeTabId && tabs.has(activeTabId)) {
            const prev = tabs.get(activeTabId);
            prev.tabEl.classList.remove('active');
            prev.contentPanel.classList.remove('active');
        } else {
            const home = document.getElementById('home-view-container');
            if (home) home.classList.remove('active');
        }

        activeTabId = id;

        if (id) {
            // Ativa a aba solicitada
            const curr = tabs.get(id);
            curr.tabEl.classList.add('active');
            curr.contentPanel.classList.add('active');
            curr.tabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        } else {
            // Se ID for nulo (minimizado), mostra a Home (Dashboard/Grid)
            const home = document.getElementById('home-view-container');
            if (home) home.classList.add('active');
            
            // Oculta a barra de abas inteira se não houver nenhuma aberta
            const tabBar = document.getElementById('workbench-tabs-bar');
            if (tabs.size === 0 && tabBar) {
                tabBar.classList.add('hidden');
            }
        }
    }

   function closeTab(id, force = false) {
        const tab = tabs.get(id);
        if (!tab) return;
        
        // Se a aba estiver "suja" (dirty) e não estivermos forçando o fechamento, exibe o Modal Customizado
        if (!force && tab.dirty) {
            // Prevenção de XSS no título
            const safeTitle = document.createElement('div');
            safeTitle.textContent = tab.title;
            
            // Cria o overlay e o modal dinamicamente
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm animate-fade-in';
            overlay.innerHTML = `
                <div class="kcs-modal-dialog max-w-md w-full p-6 mx-4 transform transition-all scale-100">
                    <div class="flex items-center gap-3 mb-4">
                        <i class="ph-fill ph-warning-circle text-3xl text-yellow-500"></i>
                        <h2 class="text-lg font-bold text-gray-100">Alterações não salvas</h2>
                    </div>
                    <p class="text-sm text-gray-300 mb-8 leading-relaxed">
                        O documento <strong class="text-white tracking-wide">"${safeTitle.innerHTML}"</strong> possui modificações em andamento.<br><br>
                        Deseja realmente fechar a aba e perder todas as alterações?
                    </p>
                    <div class="flex justify-end gap-3">
                        <button class="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-400 hover:text-white hover:bg-[#333333] dark:hover:bg-gray-800 transition-colors" id="btn-cancel-close">Cancelar</button>
                        <button class="px-5 py-2.5 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white shadow-md transition-colors" id="btn-confirm-close">Fechar sem salvar</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            // Ações dos botões do Modal
            overlay.querySelector('#btn-cancel-close').onclick = () => overlay.remove();
            overlay.querySelector('#btn-confirm-close').onclick = () => {
                overlay.remove();
                closeTab(id, true); // Chama a função novamente forçando o fechamento
            };
            
            return; // Interrompe o fechamento imediato
        }

        // Fluxo de fechamento padrão (Aba limpa ou fechamento forçado)
        tab.tabEl.remove();
        tab.contentPanel.remove();
        tabs.delete(id);

        if (activeTabId === id) {
            if (tabs.size > 0) {
                // Se ainda houver abas abertas, volta o foco para a última
                const remaining = Array.from(tabs.keys());
                switchTab(remaining[remaining.length - 1]);
            } else {
                // Nenhuma aba aberta, volta para a tela inicial
                switchTab(null);
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
        // A mágica acontece aqui: ao invés de destruir a aba,
        // apenas passamos 'null' para o switchTab.
        // Isso ativa o Dashboard e deixa a aba intacta e inativa no topo!
        switchTab(null);
    }

    return { openTab, switchTab, closeTab, markDirty, minimizeTab };
})();

const appState = { 
    currentView: 'dashboard', 
    currentFilter: 'all', 
    currentSqlFilter: 'all', 
    currentCategoryFilter: null, 
    searchQuery: '', 
    articles: [], 
    sqlScripts: [],
    // PAGINAÇÃO CLIENT-SIDE
    pagination: {
        currentPage: 1,
        pageSize: 12 //grids de 2, 3 ou 4 colunas
    }
};

async function init() {
    try {
        const savedTheme = localStorage.getItem('kcs_theme') || 'dark';
        if (savedTheme === 'light') { 
            document.documentElement.classList.remove('dark'); 
            document.documentElement.classList.add('light'); 
        } else { 
            document.documentElement.classList.remove('light'); 
            document.documentElement.classList.add('dark'); 
        }

        showLoading(true);
        const loadingMsg = document.getElementById('loading-msg');
        if (loadingMsg) loadingMsg.textContent = "Carregando sistema...";
        
        initCategories();

        const versionDisplay = document.getElementById('app-version-display');
        if (versionDisplay) versionDisplay.textContent = `v${APP_VERSION}`;

        bindGlobalEvents();
        exposeGlobalAPI();
        
        injectReadmeMenuButton();

        const form = document.getElementById('login-form');
        if (form) {
            form.innerHTML = `
                <div class="space-y-4 w-full">
                    <div>
                        <input type="email" id="login-email" placeholder="E-mail corporativo" class="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-500">
                    </div>
                    <div>
                        <input type="password" id="login-password" placeholder="Senha" class="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-500">
                    </div>
                    <div class="flex gap-2">
                        <button type="button" id="btn-email-login" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all">Entrar</button>
                        <button type="button" id="btn-email-register" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all border border-gray-600">Cadastrar</button>
                    </div>
                </div>
                
                <div class="flex items-center my-6 w-full">
                    <div class="flex-1 border-t border-gray-700"></div>
                    <span class="px-3 text-xs text-gray-500 uppercase tracking-wider font-semibold">Ou continuar com</span>
                    <div class="flex-1 border-t border-gray-700"></div>
                </div>
                
                <div class="flex flex-col gap-3 w-full">
                    <button type="button" id="btn-google-login" class="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-bold py-3.5 px-4 rounded-xl shadow-[0_4px_14px_0_rgba(255,255,255,0.1)] hover:-translate-y-0.5 transition-all">
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" class="w-5 h-5">
                        Google
                    </button>
                    <button type="button" id="btn-microsoft-login" class="w-full flex items-center justify-center gap-3 bg-[#2F2F2F] hover:bg-[#3F3F3F] text-[#ffffff] font-bold py-3.5 px-4 rounded-xl shadow-[0_4px_14px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5 transition-all border border-gray-700">
                        <svg class="w-5 h-5" viewBox="0 0 21 21"><path fill="#f25022" d="M1 1h9v9H1z"/><path fill="#00a4ef" d="M11 1h9v9h-9z"/><path fill="#7fba00" d="M1 11h9v9H1z"/><path fill="#ffb900" d="M11 11h9v9h-9z"/></svg>
                        Microsoft (Azure AD)
                    </button>
                </div>
            `;
            
            document.getElementById('btn-google-login').addEventListener('click', async () => {
                showLoading(true);
                if (loadingMsg) loadingMsg.textContent = "Abrindo Google...";
                const { loginWithGoogle } = await import('./auth.js');
                const res = await loginWithGoogle();
                if (!res.success) { showToast(res.message, 'error'); showLoading(false); }
            });

            document.getElementById('btn-microsoft-login').addEventListener('click', async () => {
                showLoading(true);
                if (loadingMsg) loadingMsg.textContent = "Abrindo Microsoft...";
                const { loginWithMicrosoft } = await import('./auth.js');
                const res = await loginWithMicrosoft();
                if (!res.success) { showToast(res.message, 'error'); showLoading(false); }
            });

            document.getElementById('btn-email-login').addEventListener('click', async () => {
                const email = document.getElementById('login-email').value;
                const pass = document.getElementById('login-password').value;
                if (!email || !pass) return showToast('Preencha e-mail e senha.', 'warning');
                showLoading(true);
                if (loadingMsg) loadingMsg.textContent = "Autenticando...";
                const { loginWithEmail } = await import('./auth.js');
                const res = await loginWithEmail(email, pass);
                if (!res.success) { showToast(res.message, 'error'); showLoading(false); }
            });

            document.getElementById('btn-email-register').addEventListener('click', async () => {
                const email = document.getElementById('login-email').value;
                const pass = document.getElementById('login-password').value;
                if (!email || pass.length < 6) return showToast('Insira um e-mail válido e senha maior que 6 caracteres.', 'warning');
                showLoading(true);
                if (loadingMsg) loadingMsg.textContent = "Criando conta...";
                const { registerWithEmail } = await import('./auth.js');
                const res = await registerWithEmail(email, pass);
                if (!res.success) { showToast(res.message, 'error'); showLoading(false); }
            });
        }

        if (loadingMsg) loadingMsg.textContent = "Verificando sessão...";
        
        await initAuth((user) => {
            if (user) {
                enterApp(user);
            } else {
                toggleLoginScreen(true);
                showLoading(false); 
            }
        });

    } catch (erroFatal) {
        console.error("ERRO FATAL NA INICIALIZAÇÃO:", erroFatal);
        alert("Erro ao carregar o sistema: " + erroFatal.message);
        showLoading(false);
    }
}
async function enterApp(user) { 
    try {
        toggleLoginScreen(false); 
        renderHeader(); 

        renderCompanyPlanBadge({
            maxUsers: sessionStorage.getItem('tenant_max_users') || 5,
            planName: sessionStorage.getItem('tenant_plan') || 'Bronze'
        });
        
        showLoading(true);
        const loadingMsg = document.getElementById('loading-msg');
        if (loadingMsg) loadingMsg.textContent = "Carregando base de conhecimento...";
        
        // Inicia a escuta de notificações real-time
        initArticleNotifications((title, subtitle, articleId) => {
            addNotificationUI(title, subtitle, articleId);
            showToast(title, 'info'); 
        });

        await refreshView(); 
    } catch (error) {
        console.error("Erro fatal ao carregar os dados:", error);
        showToast("Ocorreu um problema de conexão. Recarregue a página.", "error");
    } finally {
        // Garantia absoluta SRE: O spinner SEMPRE desliga no final.
        showLoading(false);
    }
    
    initChatbot();

    setTimeout(() => { 
        try { 
            initTour(); 
        } catch(e) { 
            console.warn("Tour error:", e); 
        }
    }, 1000);
}

function updateActionButtons() {
    const btnImportSql = document.getElementById('btn-import-sql'); 
    if(btnImportSql) btnImportSql.style.display = hasPermission('manage_sql') ? 'flex' : 'none';
}

function injectReadmeMenuButton() {
    const sidebar = document.getElementById('sidebar') || document.getElementById('sidebar-nav');
    if (!sidebar) return;

    document.getElementById('readme-menu-container')?.remove();

    const footerHtml = `
        <div id="readme-menu-container" class="mt-auto py-4 px-4 border-t border-border-subtle bg-surface">
            <div class="flex flex-col items-start w-full">
                
                <a href="javascript:void(0)" onclick="window.__kcs.showReadme()" 
                   class="flex items-center gap-2 text-[12px] text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors mb-3 w-full font-medium">
                    <i class="ph ph-book-open text-[16px]"></i>
                    Documentação
                </a>

                <div class="space-y-1 select-none">
                    <p class="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                        KCS Hub v${APP_VERSION}
                    </p>
                    <p class="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                        Dev: Kelven Rumpf
                    </p>
                </div>
            </div>
        </div>
    `;

    sidebar.insertAdjacentHTML('beforeend', footerHtml);
}

async function refreshView() {
    appState.articles = await listArticles();
    appState.sqlScripts = await listSqlScripts();
    updateActionButtons();
    
    const articleCounts = computeCounts(appState.articles);
    const sqlCounts = computeSqlCounts(appState.sqlScripts);
    renderSidebar(articleCounts, sqlCounts, appState.currentFilter, appState.currentSqlFilter, appState.currentView, getCategoryTree(), appState.articles, appState.sqlScripts);

    const grid = document.getElementById('articles-grid');
    const dash = document.getElementById('dashboard-container');

    if (appState.currentView === 'dashboard') {
        if(grid) grid.classList.add('hidden');
        if(dash) dash.classList.remove('hidden');
        
        try {
            const [analysts, collaborators] = await Promise.all([
                getTopAnalysts(),
                getTopCollaborators()
            ]);
            renderDashboard(appState.articles, appState.sqlScripts, analysts, collaborators);
        } catch (error) {
            console.warn("Aviso: Não foi possível carregar os Rankings do Firestore. Usando fallback dinâmico.", error);
            renderDashboard(appState.articles, appState.sqlScripts);
        }
        
    } else if (appState.currentView === 'articles') {
        if(dash) dash.classList.add('hidden');
        if(grid) grid.classList.remove('hidden');
        
        appState.pagination.currentPage = 1; 
        window.__kcs.renderPaginatedView();
        
    } else if (appState.currentView === 'sql') {
        if(dash) dash.classList.add('hidden');
        if(grid) grid.classList.remove('hidden');
        
        appState.pagination.currentPage = 1; 
        window.__kcs.renderPaginatedSqlView();
    }
}

function bindGlobalEvents() {
    document.getElementById('btn-new-article')?.addEventListener('click', () => {
        resetEditor();
        openArticleModal(null, async (data) => { 
            try {
                showLoading(true);
                await createArticle(data); 
                showToast('Salvo com sucesso!', 'success'); 
                await refreshView(); 
            } catch (e) {
                showToast(e.message, 'error');
            } finally {
                showLoading(false);
            }
        }, () => { 
            initEditor(); 
        });
    });
    
    document.getElementById('btn-new-sql')?.addEventListener('click', () => {
        openSqlModal(null, async (data) => { 
            try {
                showLoading(true);
                await createSqlScript(data); 
                showToast('Salvo com sucesso!', 'success'); 
                await refreshView(); 
            } catch (e) {
                showToast(e.message, 'error');
            } finally {
                showLoading(false);
            }
        });
    });

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            appState.searchQuery = e.target.value.trim();
            
            if (appState.searchQuery.length > 0 && appState.currentView === 'dashboard') {
                appState.currentView = 'articles';
                appState.currentFilter = 'all';
                appState.currentCategoryFilter = null;
            }
            
            clearTimeout(searchInput._timer);
            searchInput._timer = setTimeout(() => refreshView(), 500); 
        });
    }

    const viewModalNode = document.getElementById('view-modal');
    if (viewModalNode) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (viewModalNode.classList.contains('hidden')) {
                        clearTimeout(window.__kcsReadTimer);
                    }
                }
            });
        });
        observer.observe(viewModalNode, { attributes: true });
    }
    
    bindActivityBarEvents();
}
function exposeGlobalAPI() {
    window.__kcs = window.__kcs || {};

    Object.assign(window.__kcs, {
        setViewMode: (mode) => {
            localStorage.setItem('kcs_view_mode', mode);
            window.__kcs.renderPaginatedView(); 
        },

        setSqlViewMode: (mode) => {
            localStorage.setItem('kcs_sql_view_mode', mode);
            window.__kcs.renderPaginatedSqlView();
        },

        loadPage: (direction) => { 
            if (direction === 'next') appState.pagination.currentPage++;
            if (direction === 'prev') appState.pagination.currentPage--;
            
            if (appState.currentView === 'articles') {
                window.__kcs.renderPaginatedView();
            } else if (appState.currentView === 'sql') {
                window.__kcs.renderPaginatedSqlView();
            }
        },

       applyGridFilters: (type, value) => {
            if (type === 'author') window.__kcs.currentGridAuthor = value;
            if (type === 'status') window.__kcs.currentGridStatus = value;
            if (type === 'sql-author') window.__kcs.currentGridSqlAuthor = value;
            if (type === 'sql-op') window.__kcs.currentGridSqlOp = value;
            appState.pagination.currentPage = 1;
            window.__kcs.renderPaginatedView();
            window.__kcs.renderPaginatedSqlView();
        },

        renderPaginatedView: () => {
            let filtered = appState.articles;

            // Filtro da Sidebar
            if (appState.currentFilter === 'favorites') {
                const user = getCurrentUser();
                const userId = user.uid || user.id;
                filtered = filtered.filter(a => (a.favorites || []).includes(userId));
            } else if (appState.currentFilter !== 'all') { 
                filtered = filtered.filter(a => a.status === appState.currentFilter);
            }
            
            // Filtro de Categoria da Sidebar
            if (appState.currentCategoryFilter) {
                filtered = filtered.filter(a => a.categoryId === appState.currentCategoryFilter || a.category === appState.currentCategoryFilter);
            }

            // NOVO: Aplica o filtro de Autor (Dropdown do Grid)
            if (window.__kcs.currentGridAuthor && window.__kcs.currentGridAuthor !== 'all') {
                filtered = filtered.filter(a => a.createdBy === window.__kcs.currentGridAuthor);
            }
            
            // NOVO: Aplica o filtro de Status (Dropdown do Grid)
            if (window.__kcs.currentGridStatus && window.__kcs.currentGridStatus !== 'all') {
                filtered = filtered.filter(a => a.status === window.__kcs.currentGridStatus);
            }
            
            // Filtro de Busca Semântica
            if (appState.searchQuery) {
                const q = appState.searchQuery.toLowerCase();
                filtered = filtered.filter(a => 
                    (a.title || '').toLowerCase().includes(q) || 
                    (a.body || '').toLowerCase().includes(q) || 
                    (typeof a.steps === 'string' ? a.steps.toLowerCase().includes(q) : false) || 
                    String(a.articleNumber || '').includes(q)
                );
            }

            // Ordenação (Mais recentes primeiro)
            filtered.sort((a, b) => {
                const dateA = a.updatedAt || a.createdAt || 0;
                const dateB = b.updatedAt || b.createdAt || 0;
                return new Date(dateB) - new Date(dateA);
            });

            // Paginação
            const totalItems = filtered.length;
            const totalPages = Math.ceil(totalItems / appState.pagination.pageSize) || 1;

            if (appState.pagination.currentPage > totalPages) appState.pagination.currentPage = totalPages;
            if (appState.pagination.currentPage < 1) appState.pagination.currentPage = 1;

            const startIndex = (appState.pagination.currentPage - 1) * appState.pagination.pageSize;
            const paginatedItems = filtered.slice(startIndex, startIndex + appState.pagination.pageSize);

            const paginationConfig = {
                hasPrev: appState.pagination.currentPage > 1,
                hasNext: appState.pagination.currentPage < totalPages,
                currentPage: appState.pagination.currentPage,
                totalPages: totalPages,
                totalItems: totalItems
            };

            import('./ui/render.js').then(module => {
                 module.renderArticleGrid(paginatedItems, paginationConfig);
            });
        },

     renderPaginatedSqlView: () => {
            let filtered = appState.sqlScripts;

            // Filtros da Sidebar
            if (appState.currentSqlFilter === 'favorites') {
                const user = getCurrentUser();
                const userId = user.uid || user.id;
                filtered = filtered.filter(s => (s.favorites || []).includes(userId));
            } else if (appState.currentSqlFilter !== 'all') {
                filtered = filtered.filter(s => {
                    const op = s.sqlCategory || 'SELECT';
                    if (appState.currentSqlFilter === 'UPDATE') return op === 'UPDATE';
                    if (appState.currentSqlFilter === 'DELETE') return op === 'DELETE';
                    return op !== 'UPDATE' && op !== 'DELETE'; 
                });
            }

            // Filtro Dropdown do Grid (Novo!)
            if (window.__kcs.currentGridSqlAuthor && window.__kcs.currentGridSqlAuthor !== 'all') {
                filtered = filtered.filter(s => s.createdBy === window.__kcs.currentGridSqlAuthor);
            }
            if (window.__kcs.currentGridSqlOp && window.__kcs.currentGridSqlOp !== 'all') {
                filtered = filtered.filter(s => (s.sqlCategory || 'SELECT') === window.__kcs.currentGridSqlOp);
            }
            
            // Busca Semântica
            if (appState.searchQuery) {
                const q = appState.searchQuery.toLowerCase();
                filtered = filtered.filter(s => 
                    (s.name || '').toLowerCase().includes(q) || 
                    (s.description || '').toLowerCase().includes(q) || 
                    String(s.scriptNumber || '').includes(q)
                );
            }

            // Ordenação e Paginação
            filtered.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

            const totalItems = filtered.length;
            const totalPages = Math.ceil(totalItems / appState.pagination.pageSize) || 1;
            if (appState.pagination.currentPage > totalPages) appState.pagination.currentPage = totalPages;

            const startIndex = (appState.pagination.currentPage - 1) * appState.pagination.pageSize;
            const paginatedItems = filtered.slice(startIndex, startIndex + appState.pagination.pageSize);

            import('./ui/render.js').then(module => {
                module.renderSqlGrid(paginatedItems, {
                    hasPrev: appState.pagination.currentPage > 1,
                    hasNext: appState.pagination.currentPage < totalPages,
                    currentPage: appState.pagination.currentPage,
                    totalPages: totalPages,
                    totalItems: totalItems
                });
            });
        },

        openMasterPlanManager: async () => {
            const currentUser = getCurrentUser();
            if (!currentUser || currentUser.role !== 'super_admin') {
                return showToast('Acesso negado. Exclusivo para Administradores Mestres.', 'error');
            }

            const idUnico = 'tab-master-plan';
            const container = document.createElement('div');
            container.className = 'flex flex-col h-full';
            container.id = `view-container-${idUnico}`;
            container.style.backgroundColor = 'var(--color-editor-background)';
            container.innerHTML = `<div class="p-10 flex items-center gap-3 text-blue-500"><i class="ph-bold ph-spinner animate-spin text-2xl"></i> Calculando faturamento e uso...</div>`;
            window.TabManager.openTab(idUnico, 'Planos & Limites', 'ph-buildings', container);

            try {
                const { fetchCompaniesOverview, updateCompanyPlanInCloud } = await import('./auth.js');
                const companies = await fetchCompaniesOverview();

                const totalCompanies = companies.length;
                const totalUsers = companies.reduce((acc, c) => acc + c.userCount, 0);
                const premiumCompanies = companies.filter(c => c.plan.toLowerCase() !== 'starter').length;

                container.innerHTML = `
                    <div class="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                        <div class="max-w-6xl mx-auto">
                            <div class="mb-8 pb-6" style="border-bottom: 1px solid var(--color-border-subtle);">
                                <h2 class="text-3xl font-extrabold mb-2 flex items-center gap-3" style="color: var(--color-text-inverse);">
                                    <i class="ph-bold ph-buildings text-blue-500"></i> Gestão SaaS: Planos & Limites
                                </h2>
                                <p class="text-sm" style="color: var(--color-text-secondary);">Controle central de governança, locatários (tenants) e faturamento.</p>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                                <div class="p-6 rounded-xl shadow-sm" style="background-color: var(--color-sidebar-background); border: 1px solid var(--color-border-subtle);">
                                    <div class="flex justify-between items-center mb-3"><span class="text-[11px] font-bold uppercase tracking-wider" style="color: var(--color-text-muted);">Total de Tenants</span><i class="ph-bold ph-users text-gray-400 text-xl"></i></div>
                                    <div class="text-4xl font-extrabold" style="color: var(--color-text-inverse);">${totalCompanies}</div>
                                </div>
                                <div class="p-6 rounded-xl shadow-sm" style="background-color: var(--color-sidebar-background); border: 1px solid var(--color-border-subtle);">
                                    <div class="flex justify-between items-center mb-3"><span class="text-[11px] font-bold uppercase tracking-wider" style="color: var(--color-text-muted);">Usuários Ativos</span><i class="ph-bold ph-activity text-gray-400 text-xl"></i></div>
                                    <div class="text-4xl font-extrabold" style="color: var(--color-text-inverse);">${totalUsers}</div>
                                </div>
                                <div class="p-6 rounded-xl shadow-sm" style="background-color: var(--color-sidebar-background); border: 1px solid var(--color-border-subtle);">
                                    <div class="flex justify-between items-center mb-3"><span class="text-[11px] font-bold uppercase tracking-wider" style="color: var(--color-text-muted);">Contas Premium</span><i class="ph-fill ph-star text-purple-500 text-xl"></i></div>
                                    <div class="text-4xl font-extrabold" style="color: var(--color-text-inverse);">${premiumCompanies}</div>
                                </div>
                            </div>

                            <div class="rounded-xl overflow-hidden shadow-sm" style="background-color: var(--color-sidebar-background); border: 1px solid var(--color-border-subtle);">
                                <table class="w-full text-left border-collapse">
                                    <thead>
                                        <tr style="background-color: rgba(0,0,0,0.2); border-bottom: 1px solid var(--color-border-subtle);">
                                            <th class="py-4 px-6 text-[11px] font-bold uppercase tracking-wider" style="color: var(--color-text-muted);">Empresa / Tenant</th>
                                            <th class="py-4 px-6 text-[11px] font-bold uppercase tracking-wider" style="color: var(--color-text-muted);">Plano Vigente</th>
                                            <th class="py-4 px-6 text-[11px] font-bold uppercase tracking-wider" style="color: var(--color-text-muted);">Ocupação (Vagas)</th>
                                            <th class="py-4 px-6 text-[11px] font-bold uppercase tracking-wider text-right" style="color: var(--color-text-muted);">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y" style="divide-color: var(--color-border-subtle);">
                                        ${companies.map(c => {
                                            const usagePercent = Math.min((c.userCount / c.maxUsers) * 100, 100);
                                            let barColor = 'bg-blue-500';
                                            if (usagePercent > 80) barColor = 'bg-yellow-500';
                                            if (usagePercent >= 100) barColor = 'bg-red-500';
                                            return `
                                            <tr class="transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                                                <td class="py-5 px-6">
                                                    <div class="font-bold text-[15px]" style="color: var(--color-text-inverse);">${escapeHtml(c.companyName)}</div>
                                                    <div class="text-[11px] font-mono mt-1" style="color: var(--color-text-secondary);">ID: ${c.companyId}</div>
                                                </td>
                                                <td class="py-5 px-6">
                                                    <select id="plan-select-${c.companyId}" class="px-4 py-2.5 rounded-lg text-sm font-semibold outline-none cursor-pointer transition-all" style="background-color: var(--color-editor-background); color: var(--color-text-primary); border: 1px solid var(--color-border);">
                                                        <option value="Starter" ${c.plan.toLowerCase() === 'starter' ? 'selected' : ''}>STARTER (Básico)</option>
                                                        <option value="Teams" ${c.plan.toLowerCase() === 'teams' ? 'selected' : ''}>TEAMS (Profissional)</option>
                                                        <option value="Unlimited" ${c.plan.toLowerCase() === 'unlimited' ? 'selected' : ''}>UNLIMITED (Enterprise)</option>
                                                    </select>
                                                </td>
                                                <td class="py-5 px-6">
                                                    <div class="flex items-center justify-between text-[11px] mb-2 font-bold">
                                                        <span style="color: var(--color-text-primary);">${c.userCount} / ${c.maxUsers >= 9999 ? '∞' : c.maxUsers}</span>
                                                        <span style="color: var(--color-text-secondary);">${c.maxUsers >= 9999 ? '0%' : Math.round(usagePercent) + '%'}</span>
                                                    </div>
                                                    <div class="w-full rounded-full h-1.5 overflow-hidden" style="background-color: var(--color-border);">
                                                        <div class="${c.maxUsers >= 9999 ? 'bg-purple-500' : barColor} h-1.5 rounded-full transition-all duration-500" style="width: ${c.maxUsers >= 9999 ? '100' : usagePercent}%"></div>
                                                    </div>
                                                </td>
                                                <td class="py-5 px-6 text-right">
                                                    <button onclick="window.__kcs.applyPlanRules('${c.companyId}')" class="px-5 py-2.5 rounded-lg text-xs font-bold transition-colors shadow-sm" style="background-color: var(--color-editor-background); color: var(--color-text-primary); border: 1px solid var(--color-border);" onmouseover="this.style.borderColor='var(--color-focus)'; this.style.color='var(--color-focus)';" onmouseout="this.style.borderColor='var(--color-border)'; this.style.color='var(--color-text-primary)';">Salvar Alteração</button>
                                                </td>
                                            </tr>`;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;

                window.__kcs.applyPlanRules = async (tenantId) => {
                    const selectEl = document.getElementById(`plan-select-${tenantId}`);
                    const selectedPlan = selectEl.value;
                    let limit = 5; 
                    if (selectedPlan === 'Starter') limit = 5; 
                    else if (selectedPlan === 'Teams') limit = 20; 
                    else if (selectedPlan === 'Unlimited') limit = 9999; 

                    try {
                        const { updateCompanyPlanInCloud } = await import('./auth.js');
                        await updateCompanyPlanInCloud(tenantId, selectedPlan, limit);
                        showToast(`Plano ${selectedPlan} aplicado! Limite ajustado para ${limit === 9999 ? 'Ilimitado' : limit} vagas.`, 'success');
                        window.__kcs.openMasterPlanManager(); 
                    } catch (e) {
                        showToast('Erro ao atualizar: ' + e.message, 'error');
                    }
                };

            } catch (e) {
                container.innerHTML = `<div class="p-10 text-red-500 font-bold">Falha ao carregar painel SaaS: ${e.message}</div>`;
            }
        },

      openCompanySettings: async () => {
            if(!hasPermission('manage_users')) return;
            const { TENANT_KEYS } = await import('./config.js');
            const companyId = sessionStorage.getItem(TENANT_KEYS.COMPANY_ID);
            if (!companyId || companyId === 'LIMBO_TENANT') return showToast('Nenhuma empresa vinculada.', 'error');

            const idUnico = 'tab-company-settings';
            const container = document.createElement('div');
            container.className = 'flex flex-col h-full bg-editor-background';
            container.id = `view-container-${idUnico}`;
            container.style.backgroundColor = 'var(--color-editor-background)';
            
            container.innerHTML = `<div class="p-10 flex items-center gap-3 text-blue-500"><i class="ph-bold ph-spinner animate-spin text-2xl"></i> Carregando dados de faturamento...</div>`;
            window.TabManager.openTab(idUnico, 'Planos e Limites', 'ph-buildings', container);

            try {
                // Busca os dados reais da nuvem para montar o gráfico de ocupação
                const { getDoc, doc, collection, query, where, getCountFromServer } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
                const { dbCloud } = await import('./services/cloud.js');
                
                let tenantSnap = await getDoc(doc(dbCloud, "companies", companyId));
                if (!tenantSnap.exists()) tenantSnap = await getDoc(doc(dbCloud, "tenants", companyId));
                
                const tenantData = tenantSnap.exists() ? tenantSnap.data() : {};
                const currentPlan = tenantData.plan || 'Starter';
                const maxUsers = tenantData.maxUsers || 5;

                const q = query(collection(dbCloud, "users"), where("companyId", "==", companyId));
                const countSnap = await getCountFromServer(q);
                const userCount = countSnap.data().count;

                // Lógica de Cor da Barra de Progresso
                const usagePercent = Math.min((userCount / maxUsers) * 100, 100);
                let barColor = 'bg-blue-500';
                if (usagePercent > 80) barColor = 'bg-yellow-500';
                if (usagePercent >= 100) barColor = 'bg-red-500';

                container.innerHTML = `
                    <div class="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                        <div class="max-w-4xl mx-auto">
                            <div class="mb-8 pb-6" style="border-bottom: 1px solid var(--color-border-subtle);">
                                <h2 class="text-3xl font-extrabold mb-2 flex items-center gap-3" style="color: var(--color-text-inverse);">
                                    <i class="ph-bold ph-buildings text-blue-500"></i> Planos & Limites
                                </h2>
                                <p class="text-sm" style="color: var(--color-text-secondary);">Gerencie a capacidade da sua base de conhecimento e acompanhe o uso da equipe.</p>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                                <div class="p-6 rounded-xl shadow-sm" style="background-color: var(--color-sidebar-background); border: 1px solid var(--color-border-subtle);">
                                    <div class="flex justify-between items-center mb-3">
                                        <span class="text-[11px] font-bold uppercase tracking-wider" style="color: var(--color-text-muted);">Plano Vigente</span>
                                        <i class="ph-fill ph-star text-purple-500 text-xl"></i>
                                    </div>
                                    <div class="text-3xl font-extrabold uppercase tracking-tight" style="color: var(--color-text-inverse);">${currentPlan}</div>
                                </div>

                                <div class="p-6 rounded-xl shadow-sm" style="background-color: var(--color-sidebar-background); border: 1px solid var(--color-border-subtle);">
                                    <div class="flex justify-between items-center mb-3">
                                        <span class="text-[11px] font-bold uppercase tracking-wider" style="color: var(--color-text-muted);">Ocupação (Vagas)</span>
                                        <i class="ph-bold ph-users text-blue-500 text-xl"></i>
                                    </div>
                                    <div class="flex items-center justify-between text-sm mb-2 font-bold">
                                        <span style="color: var(--color-text-primary);">${userCount} / ${maxUsers >= 9999 ? '∞' : maxUsers} Usuários</span>
                                        <span style="color: var(--color-text-secondary);">${maxUsers >= 9999 ? '0%' : Math.round(usagePercent) + '%'}</span>
                                    </div>
                                    <div class="w-full rounded-full h-2 overflow-hidden" style="background-color: var(--color-border);">
                                        <div class="${maxUsers >= 9999 ? 'bg-purple-500' : barColor} h-2 rounded-full transition-all duration-500" style="width: ${maxUsers >= 9999 ? '100' : usagePercent}%"></div>
                                    </div>
                                </div>
                            </div>

                            <h3 class="text-[11px] font-bold uppercase tracking-widest mb-4" style="color: var(--color-text-muted);">Configuração de Contrato</h3>
                            <div class="p-6 rounded-xl shadow-sm space-y-6" style="background-color: var(--color-sidebar-background); border: 1px solid var(--color-border-subtle);">
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div>
                                        <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: var(--color-text-muted);">Mudar Plano</label>
                                        <select id="config-plan-${idUnico}" class="w-full px-4 py-3.5 rounded-lg text-sm font-semibold outline-none cursor-pointer focus:ring-1 focus:ring-blue-500 transition-all" style="background-color: var(--color-editor-background); color: var(--color-text-primary); border: 1px solid var(--color-border);">
                                            <option value="Starter" ${currentPlan.toLowerCase() === 'starter' ? 'selected' : ''}>STARTER (Básico)</option>
                                            <option value="Teams" ${currentPlan.toLowerCase() === 'teams' ? 'selected' : ''}>TEAMS (Profissional)</option>
                                            <option value="Unlimited" ${currentPlan.toLowerCase() === 'unlimited' ? 'selected' : ''}>UNLIMITED (Enterprise)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: var(--color-text-muted);">Novo Limite (Vagas)</label>
                                        <input type="number" id="config-limit-${idUnico}" value="${maxUsers}" class="w-full px-4 py-3.5 rounded-lg text-sm font-mono outline-none focus:ring-1 focus:ring-blue-500 transition-all" style="background-color: var(--color-editor-background); color: var(--color-text-primary); border: 1px solid var(--color-border);" placeholder="Ex: 50">
                                    </div>
                                </div>
                                <div class="pt-2 flex justify-end">
                                    <button type="button" id="btn-save-company-settings-${idUnico}" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2">
                                        <i class="ph-bold ph-floppy-disk"></i> Salvar Alterações
                                    </button>
                                </div>
                            </div>
                            
                            <div class="h-12"></div>
                        </div>
                    </div>
                `;

                container.querySelector(`#btn-save-company-settings-${idUnico}`).onclick = async () => {
                    const plan = container.querySelector(`#config-plan-${idUnico}`).value;
                    const limit = container.querySelector(`#config-limit-${idUnico}`).value;
                    if(!limit || limit <= 0) return showToast('Insira um limite válido superior a zero.', 'warning');
                    
                    try {
                        const btn = container.querySelector(`#btn-save-company-settings-${idUnico}`);
                        btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Salvando...';
                        btn.disabled = true;
                        
                        const { updateCompanyPlanInCloud } = await import('./auth.js');
                        await updateCompanyPlanInCloud(companyId, plan, limit);
                        
                        // Atualiza a sessão para refletir imediatamente a mudança global (se houver badging)
                        sessionStorage.setItem('tenant_plan', plan);
                        sessionStorage.setItem('tenant_max_users', limit);
                        
                        showToast('Plano e limite atualizados com sucesso!', 'success');
                        
                        // Recarrega a aba para renderizar o gráfico e a barra de progresso atualizados
                        window.TabManager.closeTab(idUnico, true);
                        window.__kcs.openCompanySettings();
                    } catch(e) { 
                        showToast('Erro ao salvar: ' + e.message, 'error'); 
                        btn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Salvar Alterações';
                        btn.disabled = false;
                    }
                };

            } catch(e) {
                container.innerHTML = `<div class="p-10 text-red-500 font-bold">Falha ao carregar dados do plano: ${e.message}</div>`;
            }
        },

        triggerManualBackup: async () => {
            if (!hasPermission('manage_backups')) return showToast('Você não tem permissão para realizar backups.', 'error');
            openConfirmModal('Atenção: A exportação total consome recursos de servidor. Deseja iniciar o processo agora?', async () => {
                try {
                    showLoading(true);
                    const loadingMsg = document.getElementById('loading-msg');
                    if (loadingMsg) loadingMsg.textContent = "Solicitando backup na nuvem...";
                    const { triggerCloudBackup } = await import('./services/cloud.js');
                    await triggerCloudBackup();
                    showToast('Backup iniciado em segundo plano com sucesso!', 'success');
                } catch (e) { showToast(`Falha no backup: ${e.message}`, 'error'); } finally { showLoading(false); }
            });
        },

        clearNotifs: () => {
            const list = document.getElementById('notif-list');
            if (list) list.innerHTML = '<div class="p-8 text-center text-xs text-gray-500 italic">Nenhuma atualização recente.</div>';
            const badge = document.getElementById('notif-badge');
            if (badge) badge.classList.add('hidden');
        },

        toggleTheme: () => {
            const root = document.documentElement;
            if (root.classList.contains('dark')) { 
                root.classList.remove('dark'); root.classList.add('light'); 
                localStorage.setItem('kcs_theme', 'light'); showToast('Modo Claro ativado', 'info');
            } else { 
                root.classList.remove('light'); root.classList.add('dark'); 
                localStorage.setItem('kcs_theme', 'dark'); showToast('Modo Escuro ativado', 'info');
            }
        },
        
        startTour: () => { 
            import('./tour.js').then(module => module.initTour(true)); 
        },
        
        showReadme: async () => { 
            try { 
                const r = await fetch('../README.md'); 
                const m = await r.text(); 
                import('./ui/modal.js').then(module => module.openReadmeModal(m)); 
            } catch (e) { 
                alert("README.md não encontrado."); 
            } 
        },
        
        explainSql: async (id) => { 
            try { 
                showLoading(true); 
                const { getSqlScript, explicarScriptSQL } = await import('./services/sqlLibrary.js');
                const s = await getSqlScript(id); 
                const explanation = await explicarScriptSQL(s.code); 
                showLoading(false); 
                import('./ui/modal.js').then(module => module.asyncAlert(`💡 IA: ${explanation}`)); 
            } catch (e) { showLoading(false); } 
        },
        
        openSettings: async () => { 
            if (!hasPermission('manage_users')) return; 
            import('./ui/modal.js').then(module => module.openSettingsModal()); 
        },
        
        createNewCompany: async () => { 
            const cn = document.getElementById('new-company-name')?.value; 
            const dm = document.getElementById('new-company-domain')?.value; 
            if (!cn || cn.trim().length < 3) return showToast('Nome de empresa inválido.', 'warning'); 
            try { 
                showLoading(true); 
                const { createCompanyInCloud } = await import('./auth.js');
                await createCompanyInCloud(cn.trim(), dm?.trim()); 
                showToast('Empresa criada com sucesso!', 'success'); 
                import('./ui/modal.js').then(module => { if (typeof module.openSettingsModal === "function") module.openSettingsModal(); }); 
            } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false); } 
        },

        deleteCompany: async (companyId) => {
            import('./ui/modal.js').then(module => {
                module.openConfirmModal(`Atenção: Tem certeza que deseja excluir o tenant "${companyId}" permanentemente?`, async () => {
                    try { 
                        showLoading(true); 
                        const { deleteCompanyInCloud } = await import('./auth.js');
                        await deleteCompanyInCloud(companyId); 
                        showToast('Empresa excluída com sucesso!', 'success'); 
                        if (typeof module.openSettingsModal === "function") module.openSettingsModal(); 
                    } catch(e) { showToast('Erro ao excluir: ' + e.message, 'error'); } finally { showLoading(false); }
                });
            });
        },

      promptEditCompany: (companyId, currentName, currentDomains, currentPlan) => {
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm animate-fade-in p-4';
            overlay.innerHTML = `
                <div class="kcs-modal-dialog max-w-md w-full p-6 md:p-8 transform scale-100">
                    <div class="flex items-center gap-3 mb-6">
                        <i class="ph-bold ph-buildings text-3xl text-purple-500"></i>
                        <h2 class="text-xl font-bold" style="color: var(--color-text-inverse);">Editar Cliente (SaaS)</h2>
                    </div>
                    <div class="space-y-5 mb-8">
                        <div>
                            <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: var(--color-text-muted);">Nome da Empresa</label>
                            <input type="text" id="edit-comp-name" value="${currentName}" class="kcs-form-input py-3">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: var(--color-text-muted);">Domínios (Ex: nissei.com)</label>
                            <input type="text" id="edit-comp-domains" value="${currentDomains}" class="kcs-form-input font-mono py-3">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: var(--color-text-muted);">Plano Contratado</label>
                            <select id="edit-comp-plan" class="kcs-form-input py-3 font-semibold cursor-pointer">
                                <option value="Starter" ${currentPlan === 'Starter' ? 'selected' : ''}>Starter (Básico)</option>
                                <option value="Teams" ${currentPlan === 'Teams' ? 'selected' : ''}>Teams (Profissional)</option>
                                <option value="Unlimited" ${currentPlan === 'Unlimited' ? 'selected' : ''}>Unlimited (Enterprise)</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 pt-2">
                        <button class="px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors" style="color: var(--color-text-secondary);" onmouseover="this.style.color='var(--color-text-inverse)';" onmouseout="this.style.color='var(--color-text-secondary)';" id="btn-cancel-comp-edit">Cancelar</button>
                        <button class="px-6 py-2.5 rounded-lg text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-colors" id="btn-save-comp-edit">Salvar Alterações</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            
            overlay.querySelector('#btn-cancel-comp-edit').onclick = () => overlay.remove();
            overlay.querySelector('#btn-save-comp-edit').onclick = async () => {
                const btn = overlay.querySelector('#btn-save-comp-edit');
                btn.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Salvando...';
                
                const newName = document.getElementById('edit-comp-name').value;
                const newDomains = document.getElementById('edit-comp-domains').value;
                const newPlan = document.getElementById('edit-comp-plan').value;
                try { 
                    const { updateCompanyDetailsInCloud } = await import('./auth.js');
                    await updateCompanyDetailsInCloud(companyId, newName, newDomains, newPlan); 
                    window.__kcs.showToast('Dados atualizados com sucesso!', 'success'); 
                    overlay.remove(); 
                    window.__kcs.openMasterPlanManager(); 
                } catch(e) { 
                    window.__kcs.showToast('Erro ao atualizar: ' + e.message, 'error'); 
                    btn.innerHTML = 'Salvar Alterações';
                }
            };
        },
        
        updateUserCompany: async (uid, cid) => { if(!hasPermission('manage_users')) return; try { showLoading(true); const { updateUserCompanyInCloud } = await import('./auth.js'); await updateUserCompanyInCloud(uid, cid); showToast('Empresa atualizada com sucesso', 'success'); } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false); } },
        updateUserSector: async (uid, sid) => { if(!hasPermission('manage_users')) return; try { showLoading(true); const { updateUserSectorInCloud } = await import('./auth.js'); await updateUserSectorInCloud(uid, sid); showToast('Setor atualizado com sucesso', 'success'); } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false); } },
        updateUserRole: async (uid, role) => { if(!hasPermission('manage_users')) return; try { showLoading(true); const { updateUserRoleInCloud } = await import('./auth.js'); await updateUserRoleInCloud(uid, role); showToast('Permissão de usuário atualizada', 'success'); } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false); } },
        
        deleteUser: async (uid) => { 
            if(!hasPermission('manage_users')) return; 
            import('./ui/modal.js').then(module => {
                module.openConfirmModal('Tem certeza que deseja remover este usuário permanentemente?', async () => { 
                    try { 
                        showLoading(true); 
                        const { deleteUserInCloud } = await import('./auth.js');
                        await deleteUserInCloud(uid); 
                        showToast('Usuário removido com sucesso.', 'success'); 
                        if (typeof module.openSettingsModal === "function") module.openSettingsModal(); 
                    } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false); } 
                }); 
            });
        },

        inviteUser: async (em, rl, cp, sc) => { 
            if(!hasPermission('manage_users')) return; 
            try { 
                showLoading(true); 
                const { inviteUserToSystem } = await import('./auth.js');
                await inviteUserToSystem(em, rl, cp, sc); 
                showToast('Convite adicionado com sucesso!', 'success'); 
                import('./ui/modal.js').then(module => { if (typeof module.openSettingsModal === "function") module.openSettingsModal(); }); 
            } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false); } 
        },

        removeInvite: async (em) => { 
            if(!hasPermission('manage_users')) return; 
            import('./ui/modal.js').then(module => {
                module.openConfirmModal('Deseja revogar o convite para este e-mail?', async () => { 
                    try { 
                        showLoading(true); 
                        const { removeInvitedUser } = await import('./auth.js');
                        await removeInvitedUser(em); 
                        showToast('Convite revogado com sucesso.', 'success'); 
                        if (typeof module.openSettingsModal === "function") module.openSettingsModal(); 
                    } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false); } 
                }); 
            });
        },

        openCategoryManager: () => { import('./ui/modal.js').then(module => module.openCategoryModal(() => refreshView())); },
        logout: () => { import('./auth.js').then(module => module.logout()); },
        
        switchToDashboard: () => { 
            appState.currentView = 'dashboard'; appState.searchQuery = ''; const searchInput = document.getElementById('search-input'); if (searchInput) searchInput.value = ''; refreshView(); 
        },
        switchToSqlView: () => { appState.currentView = 'sql'; refreshView(); },
        filterByStatus: (status) => { appState.currentView = 'articles'; appState.currentFilter = status; appState.currentCategoryFilter = null; refreshView(); },
        filterSqlByStatus: (status) => { appState.currentView = 'sql'; appState.currentSqlFilter = status; refreshView(); },
        filterByCategory: (categoryId) => { appState.currentView = 'articles'; appState.currentFilter = 'all'; appState.currentCategoryFilter = categoryId; refreshView(); },
        
        viewArticle: async (id) => { 
            const { getArticle, logArticleRead } = await import('./services/kcsCore.js');
            const a = await getArticle(id); 
            if (a) { 
                import('./ui/modal.js').then(module => module.openViewModal(a, getCurrentUser())); 
                clearTimeout(window.__kcsReadTimer); 
                window.__kcsReadTimer = setTimeout(() => { logArticleRead(a.id, a.title); }, 5000); 
            } 
        },

        editArticle: async (id) => { 
            const { getArticle, updateArticle } = await import('./services/kcsCore.js');
            const a = await getArticle(id); 
            import('./ui/modal.js').then(module => {
                module.closeViewModal(); 
                module.openArticleModal(a, async (data) => { 
                    try { 
                        showLoading(true); 
                        await updateArticle(id, data); 
                        await refreshView(); 
                        showToast('Atualizado com sucesso!', 'success'); 
                    } catch (e) { showToast(e.message, 'error'); } finally { showLoading(false); } 
                }, () => { import('./ui/editor.js').then(ed => ed.initEditor()); }); 
            });
        },

        deleteArticle: (id) => { 
            import('./ui/modal.js').then(module => {
                module.openConfirmModal('Tem certeza que deseja excluir este procedimento definitivamente?', async () => { 
                    try { 
                        showLoading(true); 
                        const { removeArticle } = await import('./services/kcsCore.js');
                        await removeArticle(id); 
                        await refreshView(); 
                        showToast('Procedimento excluído!', 'success'); 
                    } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false); } 
                }); 
            });
        },

        flagArticle: async (id) => { 
            import('./ui/modal.js').then(async module => {
                const reason = await module.asyncPrompt('Descreva o erro ou desatualização que encontrou:'); 
                if (reason) { 
                    try { 
                        showLoading(true); 
                        const { flagArticle } = await import('./services/kcsCore.js');
                        await flagArticle(id, reason); 
                        await refreshView(); 
                        showToast('O procedimento foi sinalizado para revisão.', 'success'); 
                        module.closeViewModal(); 
                    } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false); } 
                } 
            });
        },
        
        viewSqlScript: async (id) => { 
            const { getSqlScript } = await import('./services/sqlLibrary.js');
            const s = await getSqlScript(id); 
            if (s) import('./ui/modal.js').then(module => module.openSqlViewModal(s)); 
        },

        editSqlScript: async (id) => { 
            const { getSqlScript, updateSqlScript } = await import('./services/sqlLibrary.js');
            const s = await getSqlScript(id); 
            import('./ui/modal.js').then(module => {
                module.closeViewModal(); 
                module.openSqlModal(s, async (data) => { 
                    try { 
                        showLoading(true); 
                        await updateSqlScript(id, data); 
                        await refreshView(); 
                        showToast('Atualizado com sucesso!', 'success'); 
                    } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false); } 
                }); 
            });
        },

        deleteSqlScript: (id) => { 
            import('./ui/modal.js').then(module => {
                module.openConfirmModal('Tem certeza que deseja excluir este script?', async () => { 
                    try { 
                        showLoading(true); 
                        const { removeSqlScript } = await import('./services/sqlLibrary.js');
                        await removeSqlScript(id); 
                        await refreshView(); 
                        showToast('Script excluído!', 'success'); 
                    } catch (e) { showToast(e.message, 'error'); } finally { showLoading(false); } 
                }); 
            });
        },

        flagSqlScript: async (id) => { 
            import('./ui/modal.js').then(async module => {
                const reason = await module.asyncPrompt('Qual problema ou melhoria encontrou neste script?'); 
                if (reason) { 
                    try { 
                        showLoading(true); 
                        const { flagSqlScript } = await import('./services/sqlLibrary.js');
                        await flagSqlScript(id, reason); 
                        await refreshView(); 
                        showToast('Script enviado para revisão.', 'success'); 
                        module.closeViewModal(); 
                    } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false); } 
                } 
            });
        },
        
        toggleLike: async (id) => { 
            try { 
                showLoading(true); 
                const { toggleLike: apiToggleLike, getArticle } = await import('./services/kcsCore.js');
                await apiToggleLike(id); 
                await refreshView(); 
                const viewModal = document.getElementById('view-modal'); 
                if (viewModal && !viewModal.classList.contains('hidden')) { 
                    const art = await getArticle(id); 
                    if (art) import('./ui/modal.js').then(module => module.openViewModal(art, getCurrentUser())); 
                } 
                showLoading(false); 
                showToast('Interação registrada!', 'success'); 
            } catch(e) { showLoading(false); showToast(e.message, 'error'); } 
        },

        toggleSqlLike: async (id) => { 
            try { 
                showLoading(true); 
                const { toggleSqlLike: apiToggleSqlLike, getSqlScript } = await import('./services/sqlLibrary.js');
                await apiToggleSqlLike(id); 
                await refreshView(); 
                const viewModal = document.getElementById('view-modal'); 
                if (viewModal && !viewModal.classList.contains('hidden')) { 
                    const script = await getSqlScript(id); 
                    if (script) import('./ui/modal.js').then(module => module.openSqlViewModal(script)); 
                } 
                showLoading(false); 
                showToast('Interação registrada!', 'success'); 
            } catch(e) { showLoading(false); showToast(e.message, 'error'); } 
        },

        toggleFavorite: async (id) => { 
            try { 
                showLoading(true); 
                const { toggleFavorite: apiToggleFavorite, getArticle } = await import('./services/kcsCore.js');
                await apiToggleFavorite(id); 
                await refreshView(); 
                const viewModal = document.getElementById('view-modal'); 
                if (viewModal && !viewModal.classList.contains('hidden')) { 
                    const art = await getArticle(id); 
                    if (art) import('./ui/modal.js').then(module => module.openViewModal(art, getCurrentUser())); 
                } 
                showLoading(false); 
                showToast('Favoritos atualizados!', 'success'); 
            } catch(e) { showLoading(false); showToast(e.message, 'error'); } 
        },

        toggleSqlFavorite: async (id) => { 
            try { 
                showLoading(true); 
                const { toggleSqlFavorite: apiToggleSqlFavorite, getSqlScript } = await import('./services/sqlLibrary.js');
                await apiToggleSqlFavorite(id); 
                await refreshView(); 
                const viewModal = document.getElementById('view-modal'); 
                if (viewModal && !viewModal.classList.contains('hidden')) { 
                    const script = await getSqlScript(id); 
                    if (script) import('./ui/modal.js').then(module => module.openSqlViewModal(script)); 
                } 
                showLoading(false); 
                showToast('Favoritos atualizados!', 'success'); 
            } catch(e) { showLoading(false); showToast(e.message, 'error'); } 
        },
        
        promptComment: async (id) => { 
            import('./ui/modal.js').then(async module => {
                const text = await module.asyncPrompt('Deixe seu comentário abaixo:'); 
                if (text) { 
                    try { 
                        showLoading(true); 
                        const { addComment, getArticle } = await import('./services/kcsCore.js');
                        await addComment(id, text); 
                        await refreshView(); 
                        const viewModal = document.getElementById('view-modal'); 
                        if (viewModal && !viewModal.classList.contains('hidden')) { 
                            const art = await getArticle(id); 
                            if (art) module.openViewModal(art, getCurrentUser()); 
                        } 
                    } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false); } 
                } 
            });
        },

        promptSqlComment: async (id) => { 
            import('./ui/modal.js').then(async module => {
                const text = await module.asyncPrompt('Comente sobre a eficácia deste script:'); 
                if (text) { 
                    try { 
                        showLoading(true); 
                        const { addSqlComment, getSqlScript } = await import('./services/sqlLibrary.js');
                        await addSqlComment(id, text); 
                        await refreshView(); 
                        const viewModal = document.getElementById('view-modal'); 
                        if (viewModal && !viewModal.classList.contains('hidden')) { 
                            const script = await getSqlScript(id); 
                            if (script) module.openSqlViewModal(script); 
                        } 
                    } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false); } 
                } 
            });
        },
        
        openHistory: async (id, type) => { 
            try { 
                showLoading(true); 
                let item;
                if (type === 'articles') {
                    const { getArticle } = await import('./services/kcsCore.js');
                    item = await getArticle(id);
                } else {
                    const { getSqlScript } = await import('./services/sqlLibrary.js');
                    item = await getSqlScript(id);
                }
                showLoading(false); 
                if (item) import('./ui/modal.js').then(module => module.openHistoryModal(item, type)); 
            } catch(e) { showLoading(false); showToast('Erro ao carregar histórico.', 'error'); } 
        },

        restoreVersion: async (id, type, idx) => { 
            import('./ui/modal.js').then(module => {
                module.openConfirmModal('Atenção: A versão atual será enviada para o histórico. Confirma a restauração?', async () => { 
                    try { 
                        showLoading(true); 
                        if (type === 'articles') { 
                            const { getArticle, updateArticle } = await import('./services/kcsCore.js');
                            const a = await getArticle(id); 
                            await updateArticle(id, { ...a.history[idx] }); 
                        } else { 
                            const { getSqlScript, updateSqlScript } = await import('./services/sqlLibrary.js');
                            const s = await getSqlScript(id); 
                            await updateSqlScript(id, { ...s.history[idx] }); 
                        } 
                        await refreshView(); 
                        const historyModal = document.getElementById('history-modal'); 
                        if (historyModal) { historyModal.classList.add('hidden'); historyModal.classList.remove('flex'); } 
                        if (type === 'articles' || appState.currentView === 'favorites') { 
                            const { getArticle } = await import('./services/kcsCore.js');
                            const art = await getArticle(id); 
                            module.openViewModal(art, getCurrentUser()); 
                        } else { 
                            const { getSqlScript } = await import('./services/sqlLibrary.js');
                            const script = await getSqlScript(id); 
                            module.openSqlViewModal(script); 
                        } 
                        showToast('Versão restaurada com sucesso!', 'success'); 
                    } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false); } 
                }); 
            });
        },

        closeViewModal: () => { import('./ui/modal.js').then(module => module.closeViewModal()); },

        copyCode: async (btn) => { 
            try { 
                const t = btn.nextElementSibling.innerText; 
                await navigator.clipboard.writeText(t); 
                const originalText = btn.innerText; 
                btn.innerText = 'Copiado!'; 
                setTimeout(() => btn.innerText = originalText, 2000); 
            } catch(e) { console.error('Falha ao copiar:', e); } 
        },

        alert: (msg) => { import('./ui/modal.js').then(module => module.asyncAlert(msg)); }, 
        prompt: (msg, def) => { return import('./ui/modal.js').then(module => module.asyncPrompt(msg, def)); }, 
        escapeHtml: (str) => { return import('./ui/render.js').then(module => module.escapeHtml(str)); },
        showToast: (msg, type) => { import('./ui/render.js').then(module => module.showToast(msg, type)); }
    });
}

// ==========================================
// ACTIVITY BAR: EVENT DELEGATION & SYNC
// ==========================================

function bindActivityBarEvents() {
    const activityBar = document.querySelector('.workbench-activitybar');
    if (!activityBar) return;

    // FECHAR OS MENUS DO VS CODE AO CLICAR FORA DELES
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.vscode-context-menu') && !e.target.closest('.activitybar-btn')) {
            document.getElementById('vscode-settings-menu')?.classList.add('hidden');
            document.getElementById('vscode-account-menu')?.classList.add('hidden');
        }
    });

    activityBar.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-view]');
        if (!btn) return;
        const view = btn.dataset.view;

        switch (view) {
            case 'articles':
                if (window.__kcs.filterByStatus) window.__kcs.filterByStatus('all');
                break;
            case 'sql':
                if (window.__kcs.filterSqlByStatus) window.__kcs.filterSqlByStatus('all');
                break;
            case 'settings':
                document.getElementById('vscode-account-menu')?.classList.add('hidden');
                document.getElementById('vscode-settings-menu')?.classList.toggle('hidden');
                break;
            case 'account':
                document.getElementById('vscode-settings-menu')?.classList.add('hidden');
                document.getElementById('vscode-account-menu')?.classList.toggle('hidden');
                break;
            case 'semantic-search':
                if (window.__kcs.switchToDashboard) window.__kcs.switchToDashboard();
                setTimeout(() => document.getElementById('search-input')?.focus(), 100);
                break;
        }
    });
}

function updateActiveActivityBar() {
    const activityButtons = document.querySelectorAll('.workbench-activitybar [data-view]');
    activityButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === appState.currentView) {
            btn.classList.add('active');
        }
    });
}

// INICIALIZAÇÃO E OVERRIDE DE RENDER
if (document.readyState === 'loading') { 
    document.addEventListener('DOMContentLoaded', init); 
} else { 
    init(); 
}

const originalRefreshView = refreshView;
refreshView = async function() {
    await originalRefreshView.apply(this, arguments);
    updateActiveActivityBar(); 
};