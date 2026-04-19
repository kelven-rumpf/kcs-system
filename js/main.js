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
        <div id="readme-menu-container" class="mt-auto py-6 px-4 border-t border-gray-100 dark:border-border-subtle/30 bg-gray-50/20 dark:bg-transparent">
            <div class="flex flex-col items-center justify-center text-center w-full">
                
                <a href="javascript:void(0)" onclick="window.__kcs.showReadme()" 
                   class="inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold text-blue-500/70 hover:text-blue-600 dark:text-blue-400/50 dark:hover:text-blue-400 transition-colors mb-3 w-full">
                    <i class="ph ph-book-open"></i>
                    Documentação do Sistema
                </a>

                <div class="space-y-1 select-none">
                    <p class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">
                        KCS Hub <span class="mx-0.5 opacity-30">|</span> v${APP_VERSION}
                    </p>
                    <p class="text-[9px] text-gray-400/80 dark:text-gray-600 font-medium leading-none">
                        Desenvolvido por <span class="text-gray-500/80 dark:text-gray-500">Kelven Rumpf</span>
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
}

function exposeGlobalAPI() {
    // CORREÇÃO CRÍTICA: Garante que os métodos de Docking criados no modal.js não sejam sobrescritos!
    window.__kcs = window.__kcs || {};

    Object.assign(window.__kcs, {
        // ==========================================
        // CONTROLES DE VISÃO E PAGINAÇÃO (IN-MEMORY)
        // ==========================================
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

        renderPaginatedView: () => {
            let filtered = appState.articles;

            if (appState.currentFilter === 'favorites') {
                const user = getCurrentUser();
                const userId = user.uid || user.id;
                filtered = filtered.filter(a => (a.favorites || []).includes(userId));
            } else if (appState.currentFilter !== 'all') { 
                filtered = filtered.filter(a => a.status === appState.currentFilter);
            }
            
            if (appState.currentCategoryFilter) {
                filtered = filtered.filter(a => a.categoryId === appState.currentCategoryFilter || a.category === appState.currentCategoryFilter);
            }
            
            if (appState.searchQuery) {
                const q = appState.searchQuery.toLowerCase();
                filtered = filtered.filter(a => 
                    (a.title || '').toLowerCase().includes(q) || 
                    (a.body || '').toLowerCase().includes(q) || 
                    (typeof a.steps === 'string' ? a.steps.toLowerCase().includes(q) : false) || 
                    String(a.articleNumber || '').includes(q)
                );
            }

            filtered.sort((a, b) => {
                const dateA = a.updatedAt || a.createdAt || 0;
                const dateB = b.updatedAt || b.createdAt || 0;
                return new Date(dateB) - new Date(dateA);
            });

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

            renderArticleGrid(paginatedItems, paginationConfig);
        },

        renderPaginatedSqlView: () => {
            let filtered = appState.sqlScripts;

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
            
            if (appState.searchQuery) {
                const q = appState.searchQuery.toLowerCase();
                filtered = filtered.filter(s => 
                    (s.name || '').toLowerCase().includes(q) || 
                    (s.description || '').toLowerCase().includes(q) || 
                    String(s.scriptNumber || '').includes(q)
                );
            }

            filtered.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

            const totalItems = filtered.length;
            const totalPages = Math.ceil(totalItems / appState.pagination.pageSize) || 1;
            if (appState.pagination.currentPage > totalPages) appState.pagination.currentPage = totalPages;

            const startIndex = (appState.pagination.currentPage - 1) * appState.pagination.pageSize;
            const paginatedItems = filtered.slice(startIndex, startIndex + appState.pagination.pageSize);

            renderSqlGrid(paginatedItems, {
                hasPrev: appState.pagination.currentPage > 1,
                hasNext: appState.pagination.currentPage < totalPages,
                currentPage: appState.pagination.currentPage,
                totalPages: totalPages,
                totalItems: totalItems
            });
        },

        openMasterPlanManager: async () => {
            const currentUser = getCurrentUser();
            if (!currentUser || currentUser.role !== 'super_admin') {
                return showToast('Acesso negado. Exclusivo para Administradores Mestres.', 'error');
            }

            try {
                showLoading(true);
                const { fetchCompaniesOverview, updateCompanyPlanInCloud } = await import('./auth.js');
                const companies = await fetchCompaniesOverview();
                showLoading(false);

                const totalCompanies = companies.length;
                const totalUsers = companies.reduce((acc, c) => acc + c.userCount, 0);
                const premiumCompanies = companies.filter(c => c.plan.toLowerCase() !== 'starter').length;

                const modalHtml = `
                <div id="master-plan-modal" class="fixed inset-0 z-[400] flex items-center justify-center p-4 sm:p-6 animate-fade-in bg-black/60 backdrop-blur-md">
                    
                    <div class="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden ring-1 ring-white/5">
                        
                        <div class="px-6 py-6 bg-white dark:bg-[#18181b] border-b border-gray-200 dark:border-gray-800 flex justify-between items-start">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center shrink-0 shadow-sm">
                                    <i class="ph ph-buildings text-blue-600 dark:text-blue-400 text-2xl"></i>
                                </div>
                                <div>
                                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
                                        Gestão SaaS: Planos & Limites
                                    </h2>
                                    <p class="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                                        Controle central de governança, locatários (tenants) e billing.
                                    </p>
                                </div>
                            </div>
                            <button onclick="document.getElementById('master-plan-modal').remove()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                                <i class="ph ph-x text-xl"></i>
                            </button>
                        </div>

                        <div class="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6 bg-gray-50 dark:bg-[#0f0f12]">
                            
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div class="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm transition-all hover:border-gray-300 dark:hover:border-gray-700">
                                    <div class="flex items-center justify-between mb-3">
                                        <p class="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Total de Tenants</p>
                                        <i class="ph ph-users text-gray-400"></i>
                                    </div>
                                    <p class="text-3xl font-semibold text-gray-900 dark:text-white">${totalCompanies}</p>
                                </div>
                                <div class="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm transition-all hover:border-gray-300 dark:hover:border-gray-700">
                                    <div class="flex items-center justify-between mb-3">
                                        <p class="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Usuários Ativos</p>
                                        <i class="ph ph-activity text-gray-400"></i>
                                    </div>
                                    <p class="text-3xl font-semibold text-gray-900 dark:text-white">${totalUsers}</p>
                                </div>
                                <div class="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm transition-all hover:border-gray-300 dark:hover:border-gray-700">
                                    <div class="flex items-center justify-between mb-3">
                                        <p class="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Contas Premium</p>
                                        <i class="ph ph-star text-purple-400"></i>
                                    </div>
                                    <p class="text-3xl font-semibold text-gray-900 dark:text-white">${premiumCompanies}</p>
                                </div>
                            </div>

                            <div class="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                                <div class="overflow-x-auto">
                                    <table class="w-full text-left border-collapse">
                                        <thead>
                                            <tr class="bg-gray-50/50 dark:bg-black/20 text-gray-500 dark:text-gray-400 text-[11px] uppercase tracking-widest border-b border-gray-200 dark:border-gray-800">
                                                <th class="py-4 px-5 font-semibold">Empresa / Tenant</th>
                                                <th class="py-4 px-5 font-semibold">Plano Vigente</th>
                                                <th class="py-4 px-5 font-semibold">Ocupação (Vagas)</th>
                                                <th class="py-4 px-5 font-semibold text-right">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody class="text-sm divide-y divide-gray-200 dark:divide-gray-800">
                                            ${companies.map(c => {
                                                const usagePercent = Math.min((c.userCount / c.maxUsers) * 100, 100);
                                                let barColor = 'bg-blue-500 dark:bg-blue-400';
                                                if (usagePercent > 80) barColor = 'bg-yellow-500 dark:bg-yellow-400';
                                                if (usagePercent >= 100) barColor = 'bg-red-500 dark:bg-red-400';

                                                return `
                                                <tr class="transition-colors group hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                                                    <td class="py-4 px-5">
                                                        <div class="font-semibold text-gray-900 dark:text-gray-200">${escapeHtml(c.companyName)}</div>
                                                        <div class="text-[11px] text-gray-500 dark:text-gray-500 font-mono mt-0.5">ID: ${c.companyId}</div>
                                                    </td>
                                                    <td class="py-4 px-5">
                                                        <select id="plan-select-${c.companyId}" class="bg-white dark:bg-[#111113] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-300 text-xs rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 font-medium cursor-pointer outline-none transition-all shadow-sm">
                                                            <option value="Starter" ${c.plan.toLowerCase() === 'starter' ? 'selected' : ''}>STARTER (Básico)</option>
                                                            <option value="Teams" ${c.plan.toLowerCase() === 'teams' ? 'selected' : ''}>TEAMS (Profissional)</option>
                                                            <option value="Unlimited" ${c.plan.toLowerCase() === 'unlimited' ? 'selected' : ''}>UNLIMITED (Enterprise)</option>
                                                        </select>
                                                    </td>
                                                    <td class="py-4 px-5">
                                                        <div class="flex items-center justify-between text-[11px] mb-2 font-medium">
                                                            <span class="text-gray-700 dark:text-gray-300">${c.userCount} / ${c.maxUsers >= 9999 ? '∞' : c.maxUsers}</span>
                                                            <span class="text-gray-500 dark:text-gray-500">${c.maxUsers >= 9999 ? '0%' : Math.round(usagePercent) + '%'}</span>
                                                        </div>
                                                        <div class="w-full bg-gray-100 dark:bg-gray-800/50 rounded-full h-1.5 overflow-hidden">
                                                            <div class="${c.maxUsers >= 9999 ? 'bg-purple-500 dark:bg-purple-400' : barColor} h-1.5 rounded-full transition-all duration-500" style="width: ${c.maxUsers >= 9999 ? '100' : usagePercent}%"></div>
                                                        </div>
                                                    </td>
                                                    <td class="py-4 px-5 text-right">
                                                        <button onclick="window.__kcs.applyPlanRules('${c.companyId}')" class="bg-white dark:bg-transparent border border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-sm">
                                                            Salvar
                                                        </button>
                                                    </td>
                                                </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
                
                document.body.insertAdjacentHTML('beforeend', modalHtml);

                window.__kcs.applyPlanRules = async (tenantId) => {
                    const selectEl = document.getElementById(`plan-select-${tenantId}`);
                    const selectedPlan = selectEl.value;
                    
                    let limit = 5; 
                    let sectorLimit = 1;
                    
                    if (selectedPlan === 'Starter') {
                        limit = 5;
                        sectorLimit = 1;
                    } else if (selectedPlan === 'Teams') {
                        limit = 20;
                        sectorLimit = 5;
                    } else if (selectedPlan === 'Unlimited') {
                        limit = 9999;
                        sectorLimit = 999; 
                    }

                    try {
                        showLoading(true);
                        await updateCompanyPlanInCloud(tenantId, selectedPlan, limit);
                        showToast(`Plano ${selectedPlan} aplicado! Limite ajustado para ${limit === 9999 ? 'Ilimitado' : limit} usuários.`, 'success');
                        document.getElementById('master-plan-modal').remove();
                        window.__kcs.openMasterPlanManager();
                    } catch (e) {
                        showToast('Erro ao atualizar locatário: ' + e.message, 'error');
                        showLoading(false);
                    }
                };

            } catch (e) {
                showToast('Falha ao carregar painel SaaS: ' + e.message, 'error');
                showLoading(false);
            }
        },

        openCompanySettings: async () => {
            if(!hasPermission('manage_users')) return;
            const companyId = sessionStorage.getItem(TENANT_KEYS.COMPANY_ID);
            if (!companyId || companyId === 'LIMBO_TENANT') return showToast('Nenhuma empresa vinculada.', 'error');

            const modalHtml = `
            <div id="company-settings-modal" class="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4 animate-fade-in">
                <div class="bg-surface border border-blue-500/50 rounded-3xl w-full max-w-md p-6 shadow-2xl">
                    <h2 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <i class="ph ph-buildings"></i> Configurações da Empresa
                    </h2>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm text-gray-400 mb-1 font-semibold">Plano Atual</label>
                            <select id="config-plan" class="w-full bg-bg-main border border-border-subtle rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none">
                                <option value="Bronze">Bronze (Básico)</option>
                                <option value="Prata">Prata (Profissional)</option>
                                <option value="Gold">Gold (Enterprise)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm text-gray-400 mb-1 font-semibold">Limite de Usuários (Vagas)</label>
                            <input type="number" id="config-limit" class="w-full bg-bg-main border border-border-subtle rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: 50">
                        </div>
                    </div>
                    
                    <div class="flex gap-3 mt-8">
                        <button onclick="document.getElementById('company-settings-modal').remove()" class="flex-1 bg-transparent hover:bg-bg-main text-gray-400 py-3 rounded-xl border border-border-subtle transition-colors">Cancelar</button>
                        <button id="btn-save-company-settings" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-lg transition-colors">Salvar Alterações</button>
                    </div>
                </div>
            </div>`;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            document.getElementById('btn-save-company-settings').onclick = async () => {
                const plan = document.getElementById('config-plan').value;
                const limit = document.getElementById('config-limit').value;
                
                if(!limit || limit <= 0) return showToast('Insira um limite válido superior a zero.', 'warning');
                
                try {
                    showLoading(true);
                    await updateCompanyPlanInCloud(companyId, plan, limit);
                    showToast('Plano e limite atualizados com sucesso!', 'success');
                    document.getElementById('company-settings-modal').remove();
                } catch(e) {
                    showToast('Erro ao salvar: ' + e.message, 'error');
                } finally {
                    showLoading(false);
                }
            };
        },

        triggerManualBackup: async () => {
            if (!hasPermission('manage_backups')) {
                showToast('Você não tem permissão para realizar backups.', 'error');
                return;
            }
            
            openConfirmModal('Atenção: A exportação total consome recursos de servidor. Deseja iniciar o processo agora?', async () => {
                try {
                    showLoading(true);
                    const loadingMsg = document.getElementById('loading-msg');
                    if (loadingMsg) loadingMsg.textContent = "Solicitando backup na nuvem...";
                    
                    const response = await triggerCloudBackup();
                    
                    showToast('Backup iniciado em segundo plano com sucesso!', 'success');
                } catch (e) {
                    showToast(`Falha no backup: ${e.message}`, 'error');
                } finally {
                    showLoading(false);
                }
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
                root.classList.remove('dark'); 
                root.classList.add('light'); 
                localStorage.setItem('kcs_theme', 'light'); 
                showToast('Modo Claro ativado', 'info');
            } else { 
                root.classList.remove('light'); 
                root.classList.add('dark'); 
                localStorage.setItem('kcs_theme', 'dark'); 
                showToast('Modo Escuro ativado', 'info');
            }
        },
        
        startTour: () => {
            initTour(true);
        },
        
        showReadme: async () => { 
            try { 
                const r = await fetch('../README.md'); 
                const m = await r.text(); 
                openReadmeModal(m); 
            } catch (e) { 
                alert("README.md não encontrado."); 
            } 
        },
        
        explainSql: async (id) => { 
            try { 
                showLoading(true); 
                const s = await getSqlScript(id); 
                const explanation = await explicarScriptSQL(s.code); 
                showLoading(false); 
                asyncAlert(`💡 IA: ${explanation}`); 
            } catch (e) { 
                showLoading(false); 
            } 
        },
        
        openSettings: async () => { 
            if (!hasPermission('manage_users')) return; 
            await openSettingsModal(); 
        },
        
        createNewCompany: async () => { 
            const cn = document.getElementById('new-company-name')?.value; 
            const dm = document.getElementById('new-company-domain')?.value; 
            if (!cn || cn.trim().length < 3) { 
                showToast('Nome de empresa inválido.', 'warning'); 
                return; 
            }
            try { 
                showLoading(true); 
                await createCompanyInCloud(cn.trim(), dm?.trim()); 
                showToast('Empresa criada com sucesso!', 'success');
                if (typeof openSettingsModal === "function") openSettingsModal(); 
            } catch(e) { 
                showToast(e.message, 'error'); 
            } finally { 
                showLoading(false); 
            } 
        },

        deleteCompany: async (companyId) => {
            openConfirmModal(`Atenção: Tem certeza que deseja excluir o tenant "${companyId}" permanentemente? Isso pode afetar usuários vinculados.`, async () => {
                try {
                    showLoading(true);
                    await deleteCompanyInCloud(companyId);
                    showToast('Empresa excluída com sucesso!', 'success');
                    if (typeof openSettingsModal === "function") openSettingsModal(); 
                } catch(e) {
                    showToast('Erro ao excluir: ' + e.message, 'error');
                } finally {
                    showLoading(false);
                }
            });
        },

        promptEditCompany: (companyId, currentName, currentDomains, currentPlan) => {
            document.getElementById('edit-company-modal')?.remove();

            const modalHtml = `
            <div id="edit-company-modal" class="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 animate-fade-in">
                <div class="bg-surface border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                    <h2 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <i class="ph ph-buildings"></i> Editar Cliente (SaaS)
                    </h2>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Nome da Empresa</label>
                            <input type="text" id="edit-comp-name" value="${currentName}" class="w-full bg-[#1a1a1e] border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none">
                        </div>
                        <div>
                            <label class="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Domínios (Separados por vírgula)</label>
                            <input type="text" id="edit-comp-domains" value="${currentDomains}" placeholder="exemplo.com.br, filial.com" class="w-full bg-[#1a1a1e] border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm">
                        </div>
                        <div>
                            <label class="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Plano</label>
                            <select id="edit-comp-plan" class="w-full bg-[#1a1a1e] border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none cursor-pointer">
                                <option value="Starter" ${currentPlan === 'Starter' ? 'selected' : ''}>Starter (Básico)</option>
                                <option value="Teams" ${currentPlan === 'Teams' ? 'selected' : ''}>Teams (Profissional)</option>
                                <option value="Unlimited" ${currentPlan === 'Unlimited' ? 'selected' : ''}>Unlimited (Enterprise)</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="flex gap-3 mt-8">
                        <button onclick="document.getElementById('edit-company-modal').remove()" class="flex-1 bg-transparent hover:bg-gray-800 text-gray-400 py-3 rounded-xl border border-gray-700 transition-colors">Cancelar</button>
                        <button id="btn-save-comp-edit" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold shadow-lg transition-colors">Salvar</button>
                    </div>
                </div>
            </div>`;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            document.getElementById('btn-save-comp-edit').onclick = async () => {
                const newName = document.getElementById('edit-comp-name').value;
                const newDomains = document.getElementById('edit-comp-domains').value;
                const newPlan = document.getElementById('edit-comp-plan').value;

                try {
                    showLoading(true);
                    await updateCompanyDetailsInCloud(companyId, newName, newDomains, newPlan);
                    showToast('Dados atualizados com sucesso!', 'success');
                    document.getElementById('edit-company-modal').remove();
                    if (typeof openSettingsModal === "function") openSettingsModal(); 
                } catch(e) {
                    showToast('Erro ao atualizar: ' + e.message, 'error');
                } finally {
                    showLoading(false);
                }
            };
        },
        
        updateUserCompany: async (uid, cid) => { 
            if(!hasPermission('manage_users')) return; 
            try { 
                showLoading(true); 
                await updateUserCompanyInCloud(uid, cid); 
                showToast('Empresa atualizada com sucesso', 'success'); 
            } catch(e) {
                showToast(e.message, 'error');
            } finally { 
                showLoading(false); 
            } 
        },
        
        updateUserSector: async (uid, sid) => { 
            if(!hasPermission('manage_users')) return; 
            try { 
                showLoading(true); 
                await updateUserSectorInCloud(uid, sid); 
                showToast('Setor atualizado com sucesso', 'success'); 
            } catch(e) {
                showToast(e.message, 'error');
            } finally { 
                showLoading(false); 
            } 
        },
        
        updateUserRole: async (uid, role) => { 
            if(!hasPermission('manage_users')) return; 
            try { 
                showLoading(true); 
                await updateUserRoleInCloud(uid, role); 
                showToast('Permissão de usuário atualizada', 'success'); 
            } catch(e) {
                showToast(e.message, 'error');
            } finally { 
                showLoading(false); 
            } 
        },
        
        deleteUser: async (uid) => { 
            if(!hasPermission('manage_users')) return; 
            openConfirmModal('Tem certeza que deseja remover este usuário permanentemente?', async () => { 
                try { 
                    showLoading(true); 
                    await deleteUserInCloud(uid); 
                    showToast('Usuário removido com sucesso.', 'success');
                    if (typeof openSettingsModal === "function") openSettingsModal(); 
                } catch(e) {
                    showToast(e.message, 'error');
                } finally { 
                    showLoading(false); 
                } 
            }); 
        },
        
        inviteUser: async (em, rl, cp, sc) => { 
            if(!hasPermission('manage_users')) return; 
            try { 
                showLoading(true); 
                await inviteUserToSystem(em, rl, cp, sc); 
                showToast('Convite adicionado com sucesso!', 'success');
                if (typeof openSettingsModal === "function") openSettingsModal(); 
            } catch(e) {
                showToast(e.message, 'error');
            } finally { 
                showLoading(false); 
            } 
        },
        
        removeInvite: async (em) => { 
            if(!hasPermission('manage_users')) return; 
            openConfirmModal('Deseja revogar o convite para este e-mail?', async () => { 
                try { 
                    showLoading(true); 
                    await removeInvitedUser(em); 
                    showToast('Convite revogado com sucesso.', 'success');
                    if (typeof openSettingsModal === "function") openSettingsModal(); 
                } catch(e) {
                    showToast(e.message, 'error');
                } finally { 
                    showLoading(false); 
                } 
            }); 
        },
        
        openCategoryManager: () => {
            openCategoryModal(() => refreshView());
        },
        
        logout: () => {
            authLogout();
        },
        
        switchToDashboard: () => { 
            appState.currentView = 'dashboard'; 
            appState.searchQuery = '';
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.value = '';
            refreshView(); 
        },
        
        switchToSqlView: () => { 
            appState.currentView = 'sql'; 
            refreshView(); 
        },
        
        filterByStatus: (status) => { 
            appState.currentView = 'articles'; 
            appState.currentFilter = status; 
            appState.currentCategoryFilter = null;
            refreshView(); 
        },
        
        filterSqlByStatus: (status) => { 
            appState.currentView = 'sql'; 
            appState.currentSqlFilter = status; 
            refreshView(); 
        },
        
        filterByCategory: (categoryId) => { 
            appState.currentView = 'articles'; 
            appState.currentFilter = 'all';
            appState.currentCategoryFilter = categoryId; 
            refreshView(); 
        },
        
        viewArticle: async (id) => { 
            const a = await getArticle(id); 
            if (a) {
                openViewModal(a, getCurrentUser()); 
                clearTimeout(window.__kcsReadTimer);
                window.__kcsReadTimer = setTimeout(() => {
                    logArticleRead(a.id, a.title);
                }, 5000);
            }
        },
        
        editArticle: async (id) => { 
            const a = await getArticle(id); 
            closeViewModal(); 
            openArticleModal(a, async (data) => { 
                try {
                    showLoading(true);
                    await updateArticle(id, data); 
                    await refreshView(); 
                    showToast('Atualizado com sucesso!', 'success');
                } catch (e) {
                    showToast(e.message, 'error');
                } finally {
                    showLoading(false);
                }
            }, () => { 
                initEditor(); 
            }); 
        },
        
        deleteArticle: (id) => { 
            openConfirmModal('Tem certeza que deseja excluir este procedimento definitivamente?', async () => { 
                try {
                    showLoading(true);
                    await removeArticle(id); 
                    await refreshView(); 
                    showToast('Procedimento excluído!', 'success');
                } catch(e) {
                    showToast(e.message, 'error');
                } finally {
                    showLoading(false);
                }
            }); 
        },
        
        flagArticle: async (id) => { 
            const reason = await asyncPrompt('Descreva o erro ou desatualização que encontrou:'); 
            if (reason) { 
                try {
                    showLoading(true);
                    await flagArticle(id, reason); 
                    await refreshView(); 
                    showToast('O procedimento foi sinalizado para revisão.', 'success');
                    closeViewModal(); 
                } catch(e) {
                    showToast(e.message, 'error');
                } finally {
                    showLoading(false);
                }
            } 
        },
        
        viewSqlScript: async (id) => { 
            const s = await getSqlScript(id); 
            if (s) openSqlViewModal(s); 
        },
        
        editSqlScript: async (id) => { 
            const s = await getSqlScript(id); 
            closeViewModal();
            openSqlModal(s, async (data) => { 
                try {
                    showLoading(true);
                    await updateSqlScript(id, data); 
                    await refreshView(); 
                    showToast('Atualizado com sucesso!', 'success');
                } catch(e) {
                    showToast(e.message, 'error');
                } finally {
                    showLoading(false);
                }
            }); 
        },
        
        deleteSqlScript: (id) => { 
            openConfirmModal('Tem certeza que deseja excluir este script?', async () => { 
                try {
                    showLoading(true);
                    await removeSqlScript(id); 
                    await refreshView(); 
                    showToast('Script excluído!', 'success');
                } catch (e) {
                    showToast(e.message, 'error');
                } finally {
                    showLoading(false);
                }
            }); 
        },
        
        flagSqlScript: async (id) => { 
            const reason = await asyncPrompt('Qual problema ou melhoria encontrou neste script?'); 
            if (reason) { 
                try {
                    showLoading(true);
                    await flagSqlScript(id, reason); 
                    await refreshView(); 
                    showToast('Script enviado para revisão.', 'success');
                    closeViewModal(); 
                } catch(e) {
                    showToast(e.message, 'error');
                } finally {
                    showLoading(false);
                }
            } 
        },
        
        toggleLike: async (id) => { 
            try {
                showLoading(true);
                await apiToggleLike(id); 
                await refreshView(); 
                
                const viewModal = document.getElementById('view-modal');
                if (viewModal && !viewModal.classList.contains('hidden')) {
                    const art = await getArticle(id);
                    if (art) openViewModal(art, getCurrentUser());
                }
                showLoading(false);
                showToast('Interação registrada!', 'success');
            } catch(e) { showLoading(false); showToast(e.message, 'error'); }
        },
        
        toggleSqlLike: async (id) => { 
            try {
                showLoading(true);
                await apiToggleSqlLike(id); 
                await refreshView(); 
                
                const viewModal = document.getElementById('view-modal');
                if (viewModal && !viewModal.classList.contains('hidden')) {
                    const script = await getSqlScript(id);
                    if (script) openSqlViewModal(script);
                }
                showLoading(false);
                showToast('Interação registrada!', 'success');
            } catch(e) { showLoading(false); showToast(e.message, 'error'); }
        },
        
        toggleFavorite: async (id) => { 
            try {
                showLoading(true);
                await apiToggleFavorite(id); 
                await refreshView(); 
                
                const viewModal = document.getElementById('view-modal');
                if (viewModal && !viewModal.classList.contains('hidden')) {
                    const art = await getArticle(id);
                    if (art) openViewModal(art, getCurrentUser());
                }
                showLoading(false);
                showToast('Favoritos atualizados!', 'success');
            } catch(e) { showLoading(false); showToast(e.message, 'error'); }
        },
        
        toggleSqlFavorite: async (id) => { 
            try {
                showLoading(true);
                await apiToggleSqlFavorite(id); 
                await refreshView(); 
                
                const viewModal = document.getElementById('view-modal');
                if (viewModal && !viewModal.classList.contains('hidden')) {
                    const script = await getSqlScript(id);
                    if (script) openSqlViewModal(script);
                }
                showLoading(false);
                showToast('Favoritos atualizados!', 'success');
            } catch(e) { showLoading(false); showToast(e.message, 'error'); }
        },
        
        promptComment: async (id) => { 
            const text = await asyncPrompt('Deixe seu comentário abaixo:'); 
            if (text) { 
                try {
                    showLoading(true);
                    await addComment(id, text); 
                    await refreshView(); 
                    
                    const viewModal = document.getElementById('view-modal');
                    if (viewModal && !viewModal.classList.contains('hidden')) {
                        const art = await getArticle(id);
                        if (art) openViewModal(art, getCurrentUser());
                    }
                } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false); }
            } 
        },
        
        promptSqlComment: async (id) => { 
            const text = await asyncPrompt('Comente sobre a eficácia deste script:'); 
            if (text) { 
                try {
                    showLoading(true);
                    await addSqlComment(id, text); 
                    await refreshView(); 
                    
                    const viewModal = document.getElementById('view-modal');
                    if (viewModal && !viewModal.classList.contains('hidden')) {
                        const script = await getSqlScript(id);
                        if (script) openSqlViewModal(script);
                    }
                } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false); }
            } 
        },
        
        openHistory: async (id, type) => { 
            try {
                showLoading(true);
                const item = type === 'articles' ? await getArticle(id) : await getSqlScript(id); 
                showLoading(false);
                if (item) openHistoryModal(item, type); 
            } catch(e) {
                showLoading(false);
                showToast('Erro ao carregar histórico.', 'error');
            }
        },
        
        restoreVersion: async (id, type, idx) => { 
            openConfirmModal('Atenção: A versão atual será enviada para o histórico e o texto antigo assumirá como principal. Confirma a restauração?', async () => { 
                try {
                    showLoading(true);
                    if (type === 'articles') { 
                        const a = await getArticle(id); 
                        await updateArticle(id, { ...a.history[idx] }); 
                    } else { 
                        const s = await getSqlScript(id); 
                        await updateSqlScript(id, { ...s.history[idx] }); 
                    } 
                    await refreshView(); 
                    
                    const historyModal = document.getElementById('history-modal');
                    if (historyModal) {
                        historyModal.classList.add('hidden');
                        historyModal.classList.remove('flex');
                    }
                    
                    if (type === 'articles' || appState.currentView === 'favorites') {
                        const art = await getArticle(id);
                        openViewModal(art, getCurrentUser());
                    } else {
                        const script = await getSqlScript(id);
                        openSqlViewModal(script);
                    }
                    
                    showToast('Versão restaurada com sucesso!', 'success');
                } catch(e) {
                    showToast(e.message, 'error');
                } finally {
                    showLoading(false);
                }
            }); 
        },
        
        closeViewModal: closeViewModal,
        
        copyCode: async (btn) => { 
            try {
                const t = btn.nextElementSibling.innerText; 
                await navigator.clipboard.writeText(t); 
                const originalText = btn.innerText;
                btn.innerText = 'Copiado!'; 
                setTimeout(() => btn.innerText = originalText, 2000); 
            } catch(e) {
                console.error('Falha ao copiar:', e);
            }
        },
        
        alert: asyncAlert, 
        prompt: asyncPrompt, 
        escapeHtml: escapeHtml,
        showToast: showToast
    });
}

if (document.readyState === 'loading') { 
    document.addEventListener('DOMContentLoaded', init); 
} else { 
    init(); 
}