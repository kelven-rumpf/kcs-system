/**
 * ui/render.js — Renderização da Interface
 */

import { STATUS_LABELS, STATUS_COLORS, ARTICLE_STATUS } from '../config.js';
import { getCurrentUser, hasPermission, hasRole } from '../auth.js';
import { getCategoryName } from '../services/categories.js';

const SQL_DB_TYPES = [
    { value: 'mysql', label: 'MySQL', color: 'bg-blue-100 dark:bg-blue-600/30 text-blue-700 dark:text-blue-300' },
    { value: 'postgres', label: 'PostgreSQL', color: 'bg-indigo-100 dark:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300' },
    { value: 'sqlserver', label: 'SQL Server', color: 'bg-red-100 dark:bg-red-600/30 text-red-700 dark:text-red-300' },
    { value: 'oracle', label: 'Oracle DB', color: 'bg-orange-100 dark:bg-orange-600/30 text-orange-700 dark:text-orange-300' },
    { value: 'sqlite', label: 'SQLite', color: 'bg-cyan-100 dark:bg-cyan-600/30 text-cyan-700 dark:text-cyan-300' }
];

export function renderHeader() {
    const user = getCurrentUser();
    if (!user) return;

    const avatar = document.getElementById('user-avatar');
    const nameDisplay = document.getElementById('user-name-display');
    const roleDisplay = document.getElementById('user-role-display');

    if (avatar) {
        avatar.textContent = user.displayName ? user.displayName.charAt(0).toUpperCase() : '?';
    }
    
    if (nameDisplay) {
        nameDisplay.textContent = user.displayName || 'Usuário';
    }
    
    const roleLabels = { 
        'super_admin': 'Administrador KCS',
        'admin': 'Admin/Gerente', 
        'analyst': 'Analista KCS', 
        'user': 'Colaborador' 
    };
    
    if (roleDisplay) {
        roleDisplay.textContent = roleLabels[user.role] || user.role;
    }

    // RBAC: Lógica dura que revela o botão de Administração SE E SOMENTE SE o usuário for super_admin
    const btnAdminPanel = document.getElementById('btn-admin-panel');
    if (btnAdminPanel) {
        if (user.role === 'super_admin') {
            btnAdminPanel.classList.remove('hidden');
            btnAdminPanel.classList.add('flex'); // Volta o display: flex exigido pelo Tailwind
        } else {
            btnAdminPanel.classList.add('hidden');
            btnAdminPanel.classList.remove('flex');
            // Medida extrema: Se alguém tentar forçar o display no DOM, destrói o nó.
            btnAdminPanel.remove(); 
        }
    }

    window.addEventListener('click', (event) => {
        const profileDropdown = document.getElementById('profile-dropdown');
        const notifDropdown = document.getElementById('notif-dropdown');
        
        if (!event.target.closest('#profile-dropdown-container')) {
            if (profileDropdown) profileDropdown.classList.add('hidden');
        }
        if (!event.target.closest('#notif-dropdown-container')) {
            if (notifDropdown) notifDropdown.classList.add('hidden');
        }
    });

    const btnProfile = document.getElementById('btn-profile');
    if (btnProfile) {
        btnProfile.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('profile-dropdown')?.classList.toggle('hidden');
            document.getElementById('notif-dropdown')?.classList.add('hidden');
        });
    }

    const btnNotif = document.getElementById('btn-notif');
    if (btnNotif) {
        btnNotif.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('notif-dropdown')?.classList.toggle('hidden');
            document.getElementById('profile-dropdown')?.classList.add('hidden');
            document.getElementById('notif-badge')?.classList.add('hidden');
        });
    }
}

export function addNotificationUI(title, subtitle, articleId) {
    const list = document.getElementById('notif-list');
    const badge = document.getElementById('notif-badge');
    const btnNotif = document.getElementById('btn-notif');

    if (badge) badge.classList.remove('hidden');
    
    // Pequeno pulso de atenção no ícone quando a notificação chega via Firestore Real-Time
    if (btnNotif) {
        btnNotif.classList.add('animate-pulse');
        setTimeout(() => btnNotif.classList.remove('animate-pulse'), 3000);
    }
    
    const notificationHtml = `
        <div onclick="window.__kcs.viewArticle('${articleId}')" class="p-3 border-b border-border-subtle hover:bg-gray-50 dark:hover:bg-bg-main cursor-pointer transition-colors flex gap-3 animate-fade-in">
            <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <i class="ph-fill ph-sparkle text-blue-600 dark:text-blue-400"></i>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-gray-900 dark:text-white truncate">${title}</p>
                <p class="text-[10px] text-gray-500 truncate">${subtitle}</p>
            </div>
        </div>
    `;
    
    if (list) {
        if (list.innerText.includes('Nenhuma atualização')) {
            list.innerHTML = '';
        }
        list.insertAdjacentHTML('afterbegin', notificationHtml);
    }
}

export function renderArticleGrid(articles) {
  const container = document.getElementById('articles-grid');
  if (!container) return;
  if (!articles || articles.length === 0) {
    container.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-500"><p class="text-base font-medium">Nenhum artigo encontrado</p></div>`; return;
  }
  container.innerHTML = articles.map((article) => renderArticleCard(article)).join('');
}

function renderArticleCard(article) {
  const statusLabel = STATUS_LABELS[article.status] || article.status;
  const statusColor = STATUS_COLORS[article.status] || 'bg-gray-600 text-gray-100';
  const categoryDisplayName = getCategoryName(article.categoryId || article.category);
  
  const stepsPreviewText = Array.isArray(article.steps) ? article.steps.map(s => s.description).join(' ') : article.steps;
  const previewText = truncate(stripHtml(article.symptom || article.body || stepsPreviewText || ''), 120);
  
  const kcsNumHtml = article.articleNumber ? `<div class="text-blue-600 dark:text-blue-500 text-[11px] font-bold mb-1.5 tracking-wider uppercase">#KCS-${article.articleNumber}</div>` : '';

  const user = getCurrentUser();
  const userId = user?.uid || user?.id;
  const isFav = (article.favorites || []).includes(userId);
  const starClass = isFav ? 'ph-fill ph-star text-yellow-500 dark:text-yellow-400' : 'ph ph-star text-gray-400 dark:text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400';
  const isLiked = (article.likes || []).includes(userId);
  const heartClass = isLiked ? 'ph-fill ph-heart text-pink-500 dark:text-pink-400' : 'ph ph-heart text-gray-400 hover:text-pink-500 dark:hover:text-pink-400';

  return `
    <div class="article-card bg-surface border border-border-subtle rounded-xl p-5 hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer flex flex-col gap-3 shadow-sm h-full" onclick="window.__kcs.viewArticle('${article.id}')">
      <div>
          ${kcsNumHtml}
          <div class="flex items-start justify-between gap-2">
            <h3 class="text-gray-900 dark:text-white font-semibold text-base leading-snug flex-1 line-clamp-2">${escapeHtml(article.title)}</h3>
            <span class="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor}">${statusLabel}</span>
          </div>
      </div>
      <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed line-clamp-3">${escapeHtml(previewText)}</p>
      <div class="flex flex-wrap gap-1.5 mt-auto">
        ${(article.tags || []).map(t => `<span class="inline-block bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full">${escapeHtml(t)}</span>`).join(' ')}
        ${categoryDisplayName && categoryDisplayName !== 'Sem categoria' ? `<span class="inline-block bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] px-2 py-0.5 rounded-full">${escapeHtml(categoryDisplayName)}</span>` : ''}
      </div>
      <div class="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-border-subtle">
        <span><i class="ph ph-user mr-1 text-[14px] align-text-bottom"></i>${escapeHtml((article.createdBy || 'Sistema').split(' ')[0])} · ${formatDate(article.updatedAt)}</span>
        <div class="flex items-center gap-2 sm:gap-3 touch-target">
            <button onclick="event.stopPropagation(); window.__kcs.toggleLike('${article.id}')" class="transition-transform hover:scale-110 touch-target flex items-center gap-1 group">
                <i class="${heartClass} text-[18px] align-text-bottom"></i>
                <span class="text-[11px] font-medium group-hover:text-pink-500">${(article.likes || []).length}</span>
            </button>
            <span class="text-blue-500 dark:text-blue-400"><i class="ph-fill ph-chat-circle mr-1 align-text-bottom"></i>${(article.comments || []).length}</span>
            <button onclick="event.stopPropagation(); window.__kcs.toggleFavorite('${article.id}')" class="transition-transform hover:scale-110 ml-1 touch-target" title="Favoritar"><i class="${starClass} text-[18px] align-text-bottom"></i></button>
        </div>
      </div>
      ${hasPermission('edit_article') ? `
      <div class="flex flex-col sm:flex-row gap-2 pt-1 mt-1" onclick="event.stopPropagation()">
        <button onclick="window.__kcs.editArticle('${article.id}')" class="flex-1 text-xs bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-600/40 py-2.5 sm:py-1.5 rounded-lg transition-colors font-medium">Editar</button>
        ${hasPermission('delete_article') ? `<button onclick="window.__kcs.deleteArticle('${article.id}')" class="flex-1 sm:flex-none text-xs bg-red-50 dark:bg-red-600/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-600/40 px-3 py-2.5 sm:py-1.5 rounded-lg transition-colors font-medium">Excluir</button>` : ''}
      </div>` : ''}
    </div>
  `;
}

export function renderSqlGrid(scripts) {
  const container = document.getElementById('articles-grid');
  if (!container) return;
  if (!scripts || scripts.length === 0) {
    container.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-500"><p>Nenhum script SQL</p></div>`; return;
  }
  container.innerHTML = scripts.map((script) => renderSqlCard(script)).join('');
}

function renderSqlCard(script) {
  const dbInfo = SQL_DB_TYPES.find((t) => t.value === script.dbType) || { label: script.dbType, color: 'bg-gray-100 dark:bg-gray-600/30 text-gray-700 dark:text-gray-300' };
  const canManage = hasPermission('manage_sql') || script.createdById === getCurrentUser().id;

  const opType = script.sqlCategory || 'SELECT';
  let badgeHtml = '<span class="shrink-0 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700/50 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">🟢 Consulta</span>';
  if (opType === 'UPDATE') badgeHtml = '<span class="shrink-0 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700/50 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">🟡 Alteração</span>';
  else if (opType === 'DELETE') badgeHtml = '<span class="shrink-0 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700/50 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">🔴 Exclusão</span>';

  const sqlNumHtml = script.scriptNumber ? `<div class="text-purple-600 dark:text-purple-500 text-[11px] font-bold mb-1.5 tracking-wider uppercase">#SQL-${script.scriptNumber}</div>` : '';

  const user = getCurrentUser();
  const userId = user?.uid || user?.id;
  const isFav = (script.favorites || []).includes(userId);
  const starClass = isFav ? 'ph-fill ph-star text-yellow-500 dark:text-yellow-400' : 'ph ph-star text-gray-400 dark:text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400';
  const isLiked = (script.likes || []).includes(userId);
  const heartClass = isLiked ? 'ph-fill ph-heart text-pink-500 dark:text-pink-400' : 'ph ph-heart text-gray-400 hover:text-pink-500 dark:hover:text-pink-400';

  return `
    <div class="article-card bg-surface border border-border-subtle rounded-xl p-5 hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer flex flex-col gap-3 shadow-sm h-full" onclick="window.__kcs.viewSqlScript('${script.id}')">
      <div>
          ${sqlNumHtml}
          <div class="flex items-start justify-between gap-2">
            <h3 class="text-gray-900 dark:text-white font-semibold text-base flex-1 line-clamp-2">${escapeHtml(script.name)}</h3>
            ${badgeHtml}
          </div>
      </div>
      <div class="flex gap-2"><span class="text-[10px] ${dbInfo.color} px-2 py-0.5 rounded uppercase font-semibold">${dbInfo.label}</span></div>
      <pre class="bg-gray-50 dark:bg-bg-main rounded-lg p-3 text-[10px] text-green-600 dark:text-green-400 font-mono overflow-hidden max-h-20 line-clamp-3 border border-border-subtle">${escapeHtml(truncate(script.code || '', 150))}</pre>
      <div class="flex items-center justify-between text-xs text-gray-500 pt-2 mt-auto border-t border-border-subtle">
        <span><i class="ph ph-user mr-1 text-[14px] align-text-bottom"></i>${escapeHtml((script.createdBy || 'Sistema').split(' ')[0])} · ${formatDate(script.updatedAt)}</span>
        <div class="flex items-center gap-2 sm:gap-3 touch-target">
            <button onclick="event.stopPropagation(); window.__kcs.toggleSqlLike('${script.id}')" class="transition-transform hover:scale-110 touch-target flex items-center gap-1 group">
                <i class="${heartClass} text-[18px] align-text-bottom"></i>
                <span class="text-[11px] font-medium group-hover:text-pink-500">${(script.likes || []).length}</span>
            </button>
            <span class="text-blue-500 dark:text-blue-400"><i class="ph-fill ph-chat-circle mr-1 align-text-bottom"></i>${(script.comments || []).length}</span>
            <button onclick="event.stopPropagation(); window.__kcs.toggleSqlFavorite('${script.id}')" class="transition-transform hover:scale-110 ml-1 touch-target" title="Favoritar"><i class="${starClass} text-[18px] align-text-bottom"></i></button>
        </div>
      </div>
      
      <div class="flex flex-col sm:flex-row gap-2 pt-1 mt-1" onclick="event.stopPropagation()">
        <button onclick="window.__kcs.explainSql('${script.id}')" class="flex-1 text-xs bg-yellow-50 dark:bg-yellow-600/20 text-yellow-600 dark:text-yellow-400 py-2.5 sm:py-1.5 hover:bg-yellow-100 dark:hover:bg-yellow-600/40 rounded-lg transition-colors font-medium" title="A IA explicará o que este script faz"><i class="ph-fill ph-lightbulb mr-1"></i>Explicar</button>
        ${canManage ? `<button onclick="window.__kcs.editSqlScript('${script.id}')" class="flex-1 text-xs bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 py-2.5 sm:py-1.5 hover:bg-blue-100 dark:hover:bg-blue-600/40 rounded-lg transition-colors font-medium">Editar</button>` : ''}
        ${hasPermission('manage_sql') ? `<button onclick="window.__kcs.deleteSqlScript('${script.id}')" class="flex-1 sm:flex-none text-xs bg-red-50 dark:bg-red-600/20 text-red-600 dark:text-red-400 px-3 py-2.5 sm:py-1.5 hover:bg-red-100 dark:hover:bg-red-600/40 rounded-lg transition-colors font-medium">Excluir</button>` : ''}
      </div>
    </div>
  `;
}

function getIconHtml(iconRaw, isGroup = false) {
    if (!iconRaw) return `<i class="ph ph-folder text-[18px] ${isGroup ? 'text-gray-500 dark:text-gray-400 group-hover:text-yellow-500 dark:group-hover:text-yellow-400 transition-colors' : 'text-gray-500 dark:text-gray-600'}"></i>`;
    if (iconRaw.startsWith('ph-')) return `<i class="ph ${iconRaw} text-[18px] ${isGroup ? 'text-gray-500 dark:text-gray-400 group-hover:text-yellow-500 dark:group-hover:text-yellow-400 transition-colors' : 'text-gray-500 dark:text-gray-600'}"></i>`;
    return `<span class="text-[16px] leading-none ${isGroup ? 'mr-1' : ''}">${iconRaw}</span>`;
}

export function renderSidebar(articleCounts, sqlCounts, activeFilter = 'all', activeSqlFilter = 'all', activeView = 'articles', categoryTree = [], allArticles = [], allScripts = []) {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;
  const canEdit = hasPermission('edit_article');
  const user = getCurrentUser();
  const userId = user?.uid || user?.id;
  
  const closeSidebarMobile = "if(window.innerWidth < 1024) { document.getElementById('sidebar').classList.add('-translate-x-full'); document.getElementById('sidebar-overlay').classList.add('hidden'); }";
  
  let html = `<div class="mb-2 px-2 pt-1"><span class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Visão Geral</span></div>`;
  html += `<button onclick="window.__kcs.switchToDashboard(); ${closeSidebarMobile}" class="sidebar-item w-full flex items-center gap-3 px-4 py-2.5 sm:py-2 rounded-lg text-sm transition-colors ${activeView === 'dashboard' ? 'bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'}"><i class="ph ph-chart-pie-slice text-[18px]"></i><span class="text-xs">Dashboard</span></button>`;
  html += `<button onclick="window.__kcs.startTour(); ${closeSidebarMobile}" class="sidebar-item w-full flex items-center gap-3 px-4 py-2.5 sm:py-2 rounded-lg text-sm transition-colors text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white mt-1"><i class="ph ph-rocket text-[18px] text-purple-500 dark:text-purple-400"></i><span class="text-xs font-semibold">Rever Tour</span></button>`;
  
  html += `<div class="mt-4 mb-2 px-2 pt-1"><span class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Base de Conhecimento</span></div>`;
  
  const articleItems = [
      { key: 'all', label: 'Todos os Artigos', icon: 'ph-books', count: articleCounts.total },
      { key: 'favorites', label: '⭐ Meus Favoritos', icon: 'ph-star', count: allArticles.filter(a => (a.favorites || []).includes(userId)).length }
  ];
  if (canEdit) {
      articleItems.push(
          { key: ARTICLE_STATUS.DRAFT, label: 'Rascunhos', icon: 'ph-file-dashed', count: articleCounts.draft }, 
          { key: ARTICLE_STATUS.PENDING, label: 'Em Revisão', icon: 'ph-warning-circle', count: articleCounts.review }
      );
  }
  articleItems.push(
      { key: ARTICLE_STATUS.APPROVED, label: 'Publicados', icon: 'ph-seal-check', count: articleCounts.approved || 0 }
  );

  html += articleItems.map((item) => `<button onclick="window.__kcs.filterByStatus('${item.key}'); ${closeSidebarMobile}" class="sidebar-item w-full flex items-center gap-3 px-4 py-2.5 sm:py-2 rounded-lg text-sm transition-colors mt-1 ${activeView === 'articles' && activeFilter === item.key ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'}"><i class="ph ${item.icon} text-[18px]"></i><span class="flex-1 text-left text-xs">${item.label}</span><span class="text-[10px] bg-gray-200 dark:bg-gray-700/60 text-gray-700 dark:text-white px-1.5 py-0.5 rounded-full">${item.count}</span></button>`).join('');

  if (categoryTree.length > 0 || hasRole('super_admin')) {
      html += `<div class="mt-4 pt-3 border-t border-border-subtle"><div class="flex items-center justify-between px-2 mb-1"><span class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Categorias</span>${hasRole('super_admin') ? `<button onclick="window.__kcs.openCategoryManager(); ${closeSidebarMobile}" class="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors touch-target" title="Gerenciar Categorias"><i class="ph ph-gear text-[16px]"></i></button>` : ''}</div><div class="space-y-1">`;
      if (categoryTree.length > 0) {
          html += renderCategoryTree(categoryTree, activeFilter, 0, allArticles, closeSidebarMobile);
      } else {
          html += `<div class="px-2 py-1 text-[10px] text-gray-400 dark:text-gray-500 italic">Nenhuma categoria cadastrada.</div>`;
      }
      html += `</div></div>`;
  }

  if (hasPermission('manage_sql') || !canEdit) {
    html += `<div class="mt-4 pt-3 border-t border-border-subtle"><div class="px-2 mb-1"><span class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Biblioteca SQL</span></div>`;
    
    const sqlItems = [
      { key: 'all', label: 'Todos os Scripts', icon: 'ph-folders', count: sqlCounts.total || 0 },
      { key: 'favorites', label: '⭐ Meus Favoritos', icon: 'ph-star', count: (allScripts || []).filter(s => (s.favorites || []).includes(userId)).length },
      { key: 'SELECT', label: 'Consultas', icon: 'ph-magnifying-glass', count: sqlCounts.select || 0 },
      { key: 'UPDATE', label: 'Alterações', icon: 'ph-pencil-simple', count: sqlCounts.update || 0 },
      { key: 'DELETE', label: 'Exclusões', icon: 'ph-trash', count: sqlCounts.delete || 0 }
    ];

    html += sqlItems.map((item) => `
      <button onclick="window.__kcs.filterSqlByStatus('${item.key}'); ${closeSidebarMobile}" class="sidebar-item w-full flex items-center gap-3 px-4 py-2.5 sm:py-2 rounded-lg text-sm transition-colors mt-1 ${activeView === 'sql' && activeSqlFilter === item.key ? 'bg-purple-50 dark:bg-purple-600/20 text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'}">
        <i class="ph ${item.icon} text-[18px]"></i>
        <span class="flex-1 text-left text-xs">${item.label}</span>
        <span class="text-[10px] bg-gray-200 dark:bg-gray-700/60 text-gray-700 dark:text-white px-1.5 py-0.5 rounded-full">${item.count}</span>
      </button>
    `).join('');

    html += `</div>`;
  }

  nav.innerHTML = html;
}

function renderCategoryTree(nodes, activeFilter, depth = 0, allArticles = [], closeScript = '') {
  return nodes.map((node) => {
    const hasChildren = node.children && node.children.length > 0;
    const nodeArticles = allArticles.filter(a => a.categoryId === node.id || a.category === node.id);
    const hasArticles = nodeArticles.length > 0;
    const paddingLeft = depth * 12;

    let html = '';

    const articlesHtml = nodeArticles.map(a => `
        <div onclick="window.__kcs.viewArticle('${a.id}'); ${closeScript}" class="flex items-center gap-2 py-2 px-2 rounded-lg text-xs cursor-pointer transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 ml-4 group">
            <i class="ph ph-file-text text-[18px] text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors"></i>
            <span class="flex-1 text-left truncate" title="${escapeHtml(a.title)}">${a.articleNumber ? `<span class="text-gray-400 dark:text-gray-500 mr-1">#${a.articleNumber}</span>` : ''}${escapeHtml(a.title)}</span>
        </div>
    `).join('');

    const childrenHtml = hasChildren ? renderCategoryTree(node.children, activeFilter, depth + 1, allArticles, closeScript) : '';

    if (hasChildren || hasArticles) {
        html += `
            <details class="group mb-1" style="margin-left: ${paddingLeft}px;">
                <summary class="flex items-center gap-2 py-2.5 sm:py-2 px-2 rounded-lg text-sm cursor-pointer list-none transition-colors text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white select-none">
                    ${getIconHtml(node.icon, true)}
                    <span class="flex-1 text-xs font-medium">${escapeHtml(node.name)}</span>
                    <span class="transform transition-transform group-open:rotate-90 text-xs text-gray-400 dark:text-gray-500 p-1">▶</span>
                </summary>
                <div class="mt-1 border-l border-border-subtle ml-3 pl-1">
                    ${childrenHtml}
                    ${articlesHtml}
                </div>
            </details>
        `;
    } else if (depth === 0) {
         html += `
            <div class="flex items-center gap-2 py-2 px-2 rounded-lg text-sm transition-colors text-gray-400 dark:text-gray-500 mb-1 select-none">
                ${getIconHtml(node.icon, false)}
                <span class="flex-1 text-xs font-medium">${escapeHtml(node.name)} (Vazia)</span>
            </div>
        `;
    }

    return html;
  }).join('');
}

export function renderDashboard(articles, scripts) {
  const container = document.getElementById('dashboard-container');
  if (!container) return;

  const validArticles = articles.filter(a => a.status === ARTICLE_STATUS.APPROVED);
  
  const authors = {};
  articles.forEach(a => { authors[a.createdBy] = (authors[a.createdBy] || 0) + 1; });
  scripts.forEach(s => { authors[s.createdBy] = (authors[s.createdBy] || 0) + 1; });
  const topAuthors = Object.entries(authors).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const sortedByViews = [...articles].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
  const sortedByQuality = [...articles].sort((a, b) => {
      const aGood = a.useful || (a.likes || []).length || 0;
      const bGood = b.useful || (b.likes || []).length || 0;
      return bGood - aGood;
  }).slice(0, 5);
  const sortedByAlert = [...articles].sort((a, b) => (b.notUseful || 0) - (a.notUseful || 0)).slice(0, 5);
  const topScripts = [...scripts].sort((a, b) => (b.likes || []).length - (a.likes || []).length).slice(0, 5);

  container.innerHTML = `
    <h2 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">Dashboard de Governança KCS</h2>
    
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <div class="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm"><p class="text-xs text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1"><i class="ph ph-file-text"></i>Procedimentos</p><p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">${articles.length}</p></div>
      <div class="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm"><p class="text-xs text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1"><i class="ph ph-check-circle"></i>KCS Aprovados</p><p class="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">${validArticles.length}</p></div>
      <div class="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm"><p class="text-xs text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1"><i class="ph ph-eye"></i>Total de Acessos</p><p class="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">${articles.reduce((acc, a) => acc + (a.views || 0), 0)}</p></div>
      <div class="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm border-b-4 border-b-red-500"><p class="text-xs text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1"><i class="ph ph-warning-circle text-red-500"></i>Alerta de Qualidade</p><p class="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">${articles.filter(a => (a.notUseful || 0) > 0).length}</p></div>
    </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div class="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 border-b border-border-subtle pb-2 flex items-center gap-2"><i class="ph-bold ph-trend-up text-blue-500"></i> Top Mais Acessados</h3>
        <ul class="space-y-3">${sortedByViews.filter(a => (a.views || 0) > 0).map((a, i) => `<li class="flex items-center justify-between text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-bg-main transition-colors p-2 -mx-2 rounded-lg touch-target" onclick="window.__kcs.viewArticle('${a.id}')"><span class="text-gray-900 dark:text-white truncate flex-1 pr-2"><span class="text-gray-400 dark:text-gray-500 mr-2">${i+1}.</span>${escapeHtml(a.title)}</span><span class="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[10px] px-2 py-0.5 rounded font-medium shrink-0">${a.views} views</span></li>`).join('') || '<p class="text-xs text-gray-400 dark:text-gray-500">Nenhuma visualização registrada ainda.</p>'}</ul>
      </div>

      <div class="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 border-b border-border-subtle pb-2 flex items-center gap-2"><i class="ph-bold ph-thumbs-up text-green-500"></i> Termômetro de Qualidade</h3>
        <ul class="space-y-3">${sortedByQuality.filter(a => (a.useful || (a.likes||[]).length) > 0).map((a, i) => `<li class="flex items-center justify-between text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-bg-main transition-colors p-2 -mx-2 rounded-lg touch-target" onclick="window.__kcs.viewArticle('${a.id}')"><span class="text-gray-900 dark:text-white truncate flex-1 pr-2"><span class="text-gray-400 dark:text-gray-500 mr-2">${i+1}.</span>${escapeHtml(a.title)}</span><span class="text-green-600 dark:text-green-400 text-xs shrink-0 font-medium flex items-center gap-1"><i class="ph-fill ph-thumbs-up"></i>${a.useful || (a.likes||[]).length}</span></li>`).join('') || '<p class="text-xs text-gray-400 dark:text-gray-500">Nenhuma avaliação positiva.</p>'}</ul>
      </div>
      
      <div class="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm border-l-4 border-l-red-500">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 border-b border-border-subtle pb-2 flex items-center gap-2"><i class="ph-bold ph-warning-circle text-red-500"></i> Lista de Alerta (Revisão Urgente)</h3>
        <ul class="space-y-3">${sortedByAlert.filter(a => (a.notUseful || 0) > 0).map((a, i) => `<li class="flex items-center justify-between text-sm cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors p-2 -mx-2 rounded-lg touch-target" onclick="window.__kcs.viewArticle('${a.id}')"><span class="text-gray-900 dark:text-white truncate flex-1 pr-2"><span class="text-gray-400 dark:text-gray-500 mr-2">${i+1}.</span>${escapeHtml(a.title)}</span><span class="text-red-600 dark:text-red-400 text-xs shrink-0 font-medium flex items-center gap-1"><i class="ph-fill ph-thumbs-down"></i>${a.notUseful}</span></li>`).join('') || '<p class="text-xs text-green-600 dark:text-green-500 font-medium flex items-center gap-1"><i class="ph-fill ph-check-circle"></i> Tudo certo! Nenhum alerta.</p>'}</ul>
      </div>
    </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 border-b border-border-subtle pb-2">Top Colaboradores</h3>
        <ul class="space-y-3">${topAuthors.map(([name, count], i) => `<li class="flex items-center justify-between text-sm"><span class="text-gray-900 dark:text-white"><span class="text-gray-400 dark:text-gray-500 mr-2">${i+1}.</span>${escapeHtml(name)}</span><span class="bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-xs font-medium">${count} contribs.</span></li>`).join('') || '<p class="text-xs text-gray-400 dark:text-gray-500">Nenhum dado.</p>'}</ul>
      </div>

      <div class="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 border-b border-border-subtle pb-2">Scripts SQL Mais Úteis</h3>
        <ul class="space-y-3">${topScripts.filter(s => (s.likes||[]).length > 0).map((s, i) => `<li class="flex items-center justify-between text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-bg-main transition-colors p-2 -mx-2 rounded-lg touch-target w-full" onclick="window.__kcs.viewSqlScript('${s.id}')"><span class="text-gray-900 dark:text-white truncate flex-1 pr-2"><span class="text-gray-400 dark:text-gray-500 mr-2">${i+1}.</span>${escapeHtml(s.name)}</span><span class="text-purple-600 dark:text-purple-400 text-xs shrink-0 font-medium"><i class="ph-fill ph-heart mr-1 align-text-bottom"></i>${(s.likes||[]).length}</span></li>`).join('') || '<p class="text-xs text-gray-400 dark:text-gray-500">Nenhum dado.</p>'}</ul>
      </div>
    </div>
  `;
}

export function toggleLoginScreen(show) {
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app-screen');
  if (loginScreen) loginScreen.classList.toggle('hidden', !show);
  if (appScreen) appScreen.classList.toggle('hidden', show);
}

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const iconMap = { success: 'ph-check-circle', error: 'ph-warning-circle', info: 'ph-info', warning: 'ph-warning' };
  const colors = { success: 'bg-green-600/95', error: 'bg-red-600/95', info: 'bg-blue-600/95', warning: 'bg-yellow-600/95' };
  
  const toast = document.createElement('div');
  toast.className = `flex items-center gap-3 px-4 py-3 sm:py-3.5 rounded-xl border border-white/10 text-white text-sm shadow-xl font-medium ${colors[type] || colors.info} animate-slide-in backdrop-blur-md z-[9999]`;
  toast.innerHTML = `<i class="ph ${iconMap[type] || iconMap.info} text-[22px]"></i><span>${escapeHtml(message)}</span>`;
  
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('animate-slide-out'); setTimeout(() => toast.remove(), 300); }, 3500);
}

export function showLoading(show) {
    const oldLoader = document.getElementById('loading-overlay');
    if (oldLoader) oldLoader.classList.add('hidden');
    
    let topBar = document.getElementById('kcs-top-loader');
    if (!topBar) {
        topBar = document.createElement('div');
        topBar.id = 'kcs-top-loader';
        topBar.className = 'fixed top-0 left-0 h-1 bg-blue-500 z-[9999] transition-all duration-500 ease-out shadow-[0_0_10px_rgba(59,130,246,0.7)]';
        topBar.style.width = '0%';
        document.body.appendChild(topBar);
    }
    
    if (show) {
        topBar.style.display = 'block';
        topBar.style.opacity = '1';
        topBar.style.width = '15%';
        setTimeout(() => { if(topBar.style.opacity === '1') topBar.style.width = '65%'; }, 100);
        setTimeout(() => { if(topBar.style.opacity === '1') topBar.style.width = '85%'; }, 2000);
    } else {
        topBar.style.width = '100%';
        setTimeout(() => {
            topBar.style.opacity = '0';
            setTimeout(() => { 
                topBar.style.display = 'none'; 
                topBar.style.width = '0%'; 
            }, 300);
        }, 400);
    }
}

export function computeCounts(articles) {
  return {
    total: articles.length,
    draft: articles.filter((a) => a.status === ARTICLE_STATUS.DRAFT).length,
    review: articles.filter((a) => a.status === ARTICLE_STATUS.PENDING).length,
    approved: articles.filter((a) => a.status === ARTICLE_STATUS.APPROVED).length,
  };
}

export function computeSqlCounts(scripts) {
    const counts = { total: 0, select: 0, update: 0, delete: 0 };
    if (!scripts) return counts;

    scripts.forEach(s => {
        counts.total++; 
        const op = s.sqlCategory || 'SELECT'; 
        if (op === 'UPDATE') counts.update++;
        else if (op === 'DELETE') counts.delete++;
        else counts.select++; 
    });
    
    return counts;
}

export function escapeHtml(str) { if (!str) return ''; const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
function formatDate(isoDate) { if (!isoDate) return '—'; try { return new Date(isoDate).toLocaleDateString('pt-BR'); } catch { return '—'; } }
function truncate(text, maxLength) { if (!text) return ''; if (text.length <= maxLength) return text; return text.substring(0, maxLength).trim() + '…'; }
function stripHtml(html) { if (!html) return ''; return html.replace(/<[^>]*>?/gm, '').replace(/\n/g, ' ').trim(); }

export function formatContentForView(content) {
    if (!content) return '';

    if (Array.isArray(content)) {
        let html = '<div class="space-y-4 mt-2">';
        content.forEach(step => {
            html += `<div class="flex gap-3 items-start group">`;
            html += `<div class="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-bold text-[11px] mt-0.5 border border-blue-200 dark:border-blue-800 shadow-sm">${step.stepNumber}</div>`;
            html += `<div class="flex-1 min-w-0">`;
            if (step.description) {
                html += `<div class="text-[13px] sm:text-sm text-gray-800 dark:text-gray-200 leading-relaxed pt-0.5">${escapeHtml(step.description).replace(/\n/g, '<br>')}</div>`;
            }
            if (step.images && step.images.length > 0) {
                html += `<div class="mt-2.5 flex flex-wrap gap-3">` + 
                    step.images.map(url => `<img src="${url}" style="max-height: 240px; width: auto; max-width: 100%; border-radius: 6px; border: 1px solid #d1d5db; object-fit: contain;" class="dark:border-gray-700 shadow-sm cursor-pointer hover:opacity-90 transition-opacity">`).join('') 
                + `</div>`;
            }
            html += `</div></div>`;
        });
        html += '</div>';
        return html;
    }

    return content;
}


