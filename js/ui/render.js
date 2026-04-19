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

  // RBAC: Controle para o botão de Planos e Limites (Exclusivo Super Admin)
    const btnCompanySettings = document.getElementById('btn-company-settings');
    if (btnCompanySettings) {
        if (user.role === 'super_admin') {
            btnCompanySettings.classList.remove('hidden');
            btnCompanySettings.classList.add('flex');
            
            btnCompanySettings.onclick = () => window.__kcs.openMasterPlanManager();
        } else {
            btnCompanySettings.classList.add('hidden');
            btnCompanySettings.classList.remove('flex');
            btnCompanySettings.remove(); 
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

export function renderArticleGrid(articles, paginationConfig = null) {
    const container = document.getElementById('articles-grid');
    if (!container) return;

    const currentViewMode = localStorage.getItem('kcs_view_mode') || 'grid';

    let html = `
        <div class="col-span-full flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-[#3a3b3d]">
            <h2 class="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-2">
                <i class="ph-fill ph-files"></i> Procedimentos
            </h2>
            <div class="flex items-center bg-gray-100 dark:bg-[#131314] p-1 rounded-lg border border-gray-200 dark:border-[#3a3b3d] shadow-inner">
                <button onclick="window.__kcs.setViewMode('grid')" class="px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${currentViewMode === 'grid' ? 'bg-white dark:bg-[#1e1f20] text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-gray-700' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}">
                    <i class="ph-fill ph-squares-four text-lg"></i> <span class="hidden sm:inline">Cards</span>
                </button>
                <button onclick="window.__kcs.setViewMode('table')" class="px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${currentViewMode === 'table' ? 'bg-white dark:bg-[#1e1f20] text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-gray-700' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}">
                    <i class="ph-fill ph-list-dashes text-lg"></i> <span class="hidden sm:inline">Tabela</span>
                </button>
            </div>
        </div>
    `;

    if (!articles || articles.length === 0) {
        container.innerHTML = html + `<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-500"><i class="ph ph-folder-open text-4xl mb-3 opacity-50"></i><p class="text-base font-medium">Nenhum procedimento encontrado</p></div>`; 
        return;
    }

    if (currentViewMode === 'grid') {
        html += `<div class="col-span-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 w-full">`;
        html += articles.map((article) => renderArticleCard(article)).join('');
        html += `</div>`;
    } else {
        html += renderArticleTable(articles);
    }

    if (paginationConfig) {
        html += `
            <div class="col-span-full flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-[#3a3b3d] gap-4">
                <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Mostrando <strong class="text-gray-900 dark:text-white">${articles.length}</strong> de <strong class="text-gray-900 dark:text-white">${paginationConfig.totalItems}</strong> procedimentos &mdash; Página ${paginationConfig.currentPage} de ${paginationConfig.totalPages}
                </span>
                <div class="flex gap-2">
                    <button onclick="window.__kcs.loadPage('prev')" class="px-4 py-2 bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold hover:bg-gray-50 dark:hover:bg-[#131314] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1" ${!paginationConfig.hasPrev ? 'disabled' : ''}>
                        <i class="ph-bold ph-caret-left"></i> Anterior
                    </button>
                    <button onclick="window.__kcs.loadPage('next')" class="px-4 py-2 bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold hover:bg-gray-50 dark:hover:bg-[#131314] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1" ${!paginationConfig.hasNext ? 'disabled' : ''}>
                        Próxima <i class="ph-bold ph-caret-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function renderArticleTable(articles) {
    const canEdit = hasPermission('edit_article');
    const canDelete = hasPermission('delete_article');

    let tableHtml = `
    <div class="col-span-full w-full overflow-x-auto bg-white dark:bg-[#15171b] border border-gray-200 dark:border-[#3a3b3d] rounded-xl shadow-sm">
        <table class="w-full text-left border-collapse whitespace-nowrap">
            <thead>
                <tr class="bg-gray-50 dark:bg-[#131314] border-b border-gray-200 dark:border-[#3a3b3d]">
                    <th class="px-4 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID / Ref</th>
                    <th class="px-4 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-full">Título e Categoria</th>
                    <th class="px-4 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Autor</th>
                    <th class="px-4 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Revisão</th>
                    <th class="px-4 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th class="px-4 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Ações</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800/50">
    `;

    tableHtml += articles.map(article => {
        const statusLabel = STATUS_LABELS[article.status] || article.status;
        const statusColor = STATUS_COLORS[article.status] || 'bg-gray-600 text-gray-100';
        const categoryDisplayName = getCategoryName(article.categoryId || article.category);
        const kcsNum = article.articleNumber ? `#KCS-${article.articleNumber}` : '---';
        
        // Formatação de Nome e Captura de Revisor
        const authorName = formatFullName(article.createdBy);
        const reviewerName = article.approvedBy || article.validatedBy || article.reviewedBy || (article.status === 'approved' ? article.updatedBy : null);

        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer" onclick="window.__kcs.viewArticle('${article.id}')">
                <td class="px-4 py-3">
                    <span class="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">${kcsNum}</span>
                </td>
                <td class="px-4 py-3 max-w-[300px]">
                    <p class="text-sm font-semibold text-gray-900 dark:text-white truncate" title="${escapeHtml(article.title)}">${escapeHtml(article.title)}</p>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">${categoryDisplayName !== 'Sem categoria' ? escapeHtml(categoryDisplayName) : 'Sem categoria'}</p>
                </td>
                
                <td class="px-4 py-3">
                    <div class="flex items-center gap-1.5" title="Autor original">
                        <div class="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] font-bold text-gray-600 dark:text-gray-300">${authorName.charAt(0).toUpperCase()}</div>
                        <span class="text-xs text-gray-700 dark:text-gray-300 font-medium">${escapeHtml(authorName)}</span>
                    </div>
                </td>

                <td class="px-4 py-3">
                    ${reviewerName && article.status === 'approved' 
                        ? `<div class="flex items-center gap-1.5" title="Revisado por">
                               <i class="ph-fill ph-check-circle text-green-500 dark:text-green-400 text-sm"></i>
                               <span class="text-xs text-gray-700 dark:text-gray-300 font-medium">${escapeHtml(formatFullName(reviewerName))}</span>
                           </div>` 
                        : `<span class="text-[10px] text-gray-400 dark:text-gray-500 italic flex items-center gap-1"><i class="ph ph-clock text-sm"></i> Pendente</span>`
                    }
                </td>

                <td class="px-4 py-3">
                    <span class="text-[10px] font-bold px-2.5 py-1 rounded-full ${statusColor}">${statusLabel}</span>
                </td>
                <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation()">
                        ${canEdit ? `<button onclick="window.__kcs.editArticle('${article.id}')" class="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 hover:bg-blue-50 dark:bg-[#1e1f20] dark:hover:bg-blue-900/30 rounded transition-colors" title="Editar"><i class="ph-fill ph-pencil-simple text-sm"></i></button>` : ''}
                        ${canDelete ? `<button onclick="window.__kcs.deleteArticle('${article.id}')" class="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 bg-gray-100 hover:bg-red-50 dark:bg-[#1e1f20] dark:hover:bg-red-900/30 rounded transition-colors" title="Excluir"><i class="ph-fill ph-trash text-sm"></i></button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tableHtml += `</tbody></table></div>`;
    return tableHtml;
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

  // NOVO: Formatação de Nome e Captura de Revisor
  const authorFullName = formatFullName(article.createdBy);
  const reviewerName = article.approvedBy || article.validatedBy || article.reviewedBy || (article.status === 'approved' ? article.updatedBy : null);

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
      
      <div class="flex flex-col gap-1.5 pt-3 mt-1 border-t border-border-subtle">
        <div class="flex items-center justify-between text-xs text-gray-500">
            <span><i class="ph ph-user mr-1 text-[14px] align-text-bottom"></i>${escapeHtml(authorFullName)} · ${formatDate(article.updatedAt)}</span>
            <div class="flex items-center gap-2 sm:gap-3 touch-target">
                <button onclick="event.stopPropagation(); window.__kcs.toggleLike('${article.id}')" class="transition-transform hover:scale-110 touch-target flex items-center gap-1 group">
                    <i class="${heartClass} text-[18px] align-text-bottom"></i>
                    <span class="text-[11px] font-medium group-hover:text-pink-500">${(article.likes || []).length}</span>
                </button>
                <span class="text-blue-500 dark:text-blue-400"><i class="ph-fill ph-chat-circle mr-1 align-text-bottom"></i>${(article.comments || []).length}</span>
                <button onclick="event.stopPropagation(); window.__kcs.toggleFavorite('${article.id}')" class="transition-transform hover:scale-110 ml-1 touch-target" title="Favoritar"><i class="${starClass} text-[18px] align-text-bottom"></i></button>
            </div>
        </div>
        ${reviewerName && article.status === 'approved' ? `<span class="text-[10px] text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/10 px-2 py-0.5 rounded w-max border border-green-200/50 dark:border-green-800/30"><i class="ph-bold ph-check-circle mr-1 align-text-bottom"></i>Aprovado por ${escapeHtml(formatFullName(reviewerName))}</span>` : ''}
      </div>

      ${hasPermission('edit_article') ? `
      <div class="flex flex-col sm:flex-row gap-2 pt-1" onclick="event.stopPropagation()">
        <button onclick="window.__kcs.editArticle('${article.id}')" class="flex-1 text-xs bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-600/40 py-2.5 sm:py-1.5 rounded-lg transition-colors font-medium">Editar</button>
        ${hasPermission('delete_article') ? `<button onclick="window.__kcs.deleteArticle('${article.id}')" class="flex-1 sm:flex-none text-xs bg-red-50 dark:bg-red-600/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-600/40 px-3 py-2.5 sm:py-1.5 rounded-lg transition-colors font-medium">Excluir</button>` : ''}
      </div>` : ''}
    </div>
  `;
}

// ==========================================
// RENDERIZAÇÃO DA BIBLIOTECA SQL (GRID VS TABELA)
// ==========================================
export function renderSqlGrid(scripts, paginationConfig = null) {
  const container = document.getElementById('articles-grid');
  if (!container) return;

  const currentViewMode = localStorage.getItem('kcs_sql_view_mode') || 'grid';

  let html = `
    <div class="col-span-full flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-[#3a3b3d]">
        <h2 class="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-2">
            <i class="ph-fill ph-database"></i> Biblioteca SQL
        </h2>
        <div class="flex items-center bg-gray-100 dark:bg-[#131314] p-1 rounded-lg border border-gray-200 dark:border-[#3a3b3d] shadow-inner">
            <button onclick="window.__kcs.setSqlViewMode('grid')" class="px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${currentViewMode === 'grid' ? 'bg-white dark:bg-[#1e1f20] text-purple-600 dark:text-purple-400 shadow-sm border border-gray-200 dark:border-gray-700' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}">
                <i class="ph-fill ph-squares-four text-lg"></i> <span class="hidden sm:inline">Cards</span>
            </button>
            <button onclick="window.__kcs.setSqlViewMode('table')" class="px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${currentViewMode === 'table' ? 'bg-white dark:bg-[#1e1f20] text-purple-600 dark:text-purple-400 shadow-sm border border-gray-200 dark:border-gray-700' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'}">
                <i class="ph-fill ph-list-dashes text-lg"></i> <span class="hidden sm:inline">Tabela</span>
            </button>
        </div>
    </div>
  `;

  if (!scripts || scripts.length === 0) {
    container.innerHTML = html + `<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-500"><i class="ph ph-database text-4xl mb-3 opacity-50"></i><p class="text-base font-medium">Nenhum script SQL encontrado</p></div>`; 
    return;
  }

  if (currentViewMode === 'grid') {
    html += `<div class="col-span-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 w-full">`;
    html += scripts.map((script) => renderSqlCard(script)).join('');
    html += `</div>`;
  } else {
    html += renderSqlTable(scripts);
  }

  if (paginationConfig) {
    html += `
        <div class="col-span-full flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-[#3a3b3d] gap-4">
            <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Mostrando <strong class="text-gray-900 dark:text-white">${scripts.length}</strong> de <strong class="text-gray-900 dark:text-white">${paginationConfig.totalItems}</strong> scripts &mdash; Página ${paginationConfig.currentPage} de ${paginationConfig.totalPages}
            </span>
            <div class="flex gap-2">
                <button onclick="window.__kcs.loadPage('prev')" class="px-4 py-2 bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold hover:bg-gray-50 dark:hover:bg-[#131314] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1" ${!paginationConfig.hasPrev ? 'disabled' : ''}>
                    <i class="ph-bold ph-caret-left"></i> Anterior
                </button>
                <button onclick="window.__kcs.loadPage('next')" class="px-4 py-2 bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold hover:bg-gray-50 dark:hover:bg-[#131314] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1" ${!paginationConfig.hasNext ? 'disabled' : ''}>
                    Próxima <i class="ph-bold ph-caret-right"></i>
                </button>
            </div>
        </div>
    `;
  }

  container.innerHTML = html;
}

// ==========================================
// COMPONENTE: TABELA ENTERPRISE (SQL)
// ==========================================
function renderSqlTable(scripts) {
  const user = getCurrentUser();
  
  let tableHtml = `
    <div class="col-span-full w-full overflow-x-auto bg-white dark:bg-[#15171b] border border-gray-200 dark:border-[#3a3b3d] rounded-xl shadow-sm">
        <table class="w-full text-left border-collapse whitespace-nowrap">
            <thead>
                <tr class="bg-gray-50 dark:bg-[#131314] border-b border-gray-200 dark:border-[#3a3b3d]">
                    <th class="px-4 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ref</th>
                    <th class="px-4 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-full">Nome do Script</th>
                    <th class="px-4 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Banco</th>
                    <th class="px-4 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Operação</th>
                    <th class="px-4 py-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Ações</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800/50">
  `;

  tableHtml += scripts.map(s => {
      const dbInfo = SQL_DB_TYPES.find((t) => t.value === s.dbType) || { label: s.dbType, color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' };
      const opType = s.sqlCategory || 'SELECT';
      const canManage = hasPermission('manage_sql') || (user && s.createdById === user.id);

      let badgeHtml = '<span class="shrink-0 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700/50 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">🟢 Consulta</span>';
      if (opType === 'UPDATE') badgeHtml = '<span class="shrink-0 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700/50 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">🟡 Alteração</span>';
      else if (opType === 'DELETE') badgeHtml = '<span class="shrink-0 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-700/50 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">🔴 Exclusão</span>';

      const authorName = s.createdBy ? s.createdBy.split(' ')[0] : 'Sistema';
      const sqlNum = s.scriptNumber ? `#SQL-${s.scriptNumber}` : '---';

      return `
      <tr class="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer" onclick="window.__kcs.viewSqlScript('${s.id}')">
          <td class="px-4 py-3">
              <span class="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded">${sqlNum}</span>
          </td>
          <td class="px-4 py-3 max-w-[300px]">
              <p class="text-sm font-semibold text-gray-900 dark:text-white truncate" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</p>
              <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">${escapeHtml(authorName)} · ${formatDate(s.updatedAt)}</p>
          </td>
          <td class="px-4 py-3">
              <span class="text-[9px] ${dbInfo.color} px-2 py-0.5 rounded font-bold uppercase">${dbInfo.label}</span>
          </td>
          <td class="px-4 py-3">
              ${badgeHtml}
          </td>
          <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation()">
                  <button onclick="window.__kcs.explainSql('${s.id}')" class="p-1.5 text-gray-500 hover:text-yellow-600 dark:hover:text-yellow-400 bg-gray-100 hover:bg-yellow-50 dark:bg-[#1e1f20] dark:hover:bg-yellow-900/30 rounded transition-colors" title="A IA explicará o que este script faz"><i class="ph-fill ph-lightbulb text-sm"></i></button>
                  ${canManage ? `<button onclick="window.__kcs.editSqlScript('${s.id}')" class="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 hover:bg-blue-50 dark:bg-[#1e1f20] dark:hover:bg-blue-900/30 rounded transition-colors" title="Editar"><i class="ph-fill ph-pencil-simple text-sm"></i></button>` : ''}
                  ${hasPermission('manage_sql') ? `<button onclick="window.__kcs.deleteSqlScript('${s.id}')" class="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 bg-gray-100 hover:bg-red-50 dark:bg-[#1e1f20] dark:hover:bg-red-900/30 rounded transition-colors" title="Excluir"><i class="ph-fill ph-trash text-sm"></i></button>` : ''}
              </div>
          </td>
      </tr>`;
  }).join('');

  tableHtml += `</tbody></table></div>`;
  return tableHtml;
}

// MANTENHA O SEU RENDER SQL CARD INTACTO ABAIXO DISSO
export function renderSqlCard(script) {
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
  
  // 1. TOUR WRAPPER: BASE DE CONHECIMENTO
  html += `<div id="tour-base-conhecimento">`;
  html += `<div class="mt-4 mb-2 px-2 pt-1"><span class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Base de Conhecimento</span></div>`;
  
  const articleItems = [
      { key: 'all', label: 'Todos os Artigos', icon: 'ph-books', count: articleCounts.total },
      { key: 'favorites', label: 'Meus Favoritos', icon: 'ph-star', count: allArticles.filter(a => (a.favorites || []).includes(userId)).length }
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
  html += `</div>`;

  // 2. TOUR WRAPPER: CATEGORIAS (Adicionado id="tour-categorias")
  if (categoryTree.length > 0 || hasRole('super_admin')) {
      html += `<div id="tour-categorias" class="mt-4 pt-3 border-t border-border-subtle"><div class="flex items-center justify-between px-2 mb-1"><span class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Categorias</span>${hasRole('super_admin') ? `<button onclick="window.__kcs.openCategoryManager(); ${closeSidebarMobile}" class="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors touch-target" title="Gerenciar Categorias"><i class="ph ph-gear text-[16px]"></i></button>` : ''}</div><div class="space-y-1">`;
      if (categoryTree.length > 0) {
          html += renderCategoryTree(categoryTree, activeFilter, 0, allArticles, closeSidebarMobile);
      } else {
          html += `<div class="px-2 py-1 text-[10px] text-gray-400 dark:text-gray-500 italic">Nenhuma categoria cadastrada.</div>`;
      }
      html += `</div></div>`;
  }

  // 3. TOUR WRAPPER: BIBLIOTECA SQL (Adicionado id="tour-sql")
  if (hasPermission('manage_sql') || !canEdit) {
    html += `<div id="tour-sql" class="mt-4 pt-3 border-t border-border-subtle"><div class="px-2 mb-1"><span class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Biblioteca SQL</span></div>`;
    
    const sqlItems = [
      { key: 'all', label: 'Todos os Scripts', icon: 'ph-folders', count: sqlCounts.total || 0 },
      { key: 'favorites', label: 'Meus Favoritos', icon: 'ph-star', count: (allScripts || []).filter(s => (s.favorites || []).includes(userId)).length },
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

// ==========================================
// FUNÇÃO AUXILIAR: COPIAR TABELAS PARA O EXCEL/SLACK
// ==========================================
window.copyTableToClipboard = function(tableId, btnElement) {
    const table = document.getElementById(tableId);
    if (!table) return;

    let text = '';
    // Lê as linhas da tabela
    for (let i = 0; i < table.rows.length; i++) {
        let row = [];
        for (let j = 0; j < table.rows[i].cells.length; j++) {
            const cellText = table.rows[i].cells[j].innerText.trim();
            // Ignora colunas de botões (Ação) para o texto copiado ficar limpo
            if (cellText.toLowerCase() !== 'ação' && cellText.toLowerCase() !== 'revisar') {
                // Substitui quebras de linha por espaço para não quebrar a linha do Excel
                row.push(cellText.replace(/\n/g, ' '));
            }
        }
        // Junta as colunas com "Tab" (\t) e as linhas com "Enter" (\n)
        text += row.join('\t') + '\n';
    }

    navigator.clipboard.writeText(text).then(() => {
        // Feedback visual no botão
        const originalHtml = btnElement.innerHTML;
        btnElement.innerHTML = '<i class="ph-fill ph-check-circle text-green-500"></i>';
        if (window.__kcs && window.__kcs.showToast) {
            window.__kcs.showToast('Dados copiados para a área de transferência!', 'success');
        }
        setTimeout(() => { btnElement.innerHTML = originalHtml; }, 2000);
    }).catch(err => {
        console.error('Falha ao copiar:', err);
    });
};

// ==========================================
// RENDERIZAÇÃO DO DASHBOARD KCS
// ==========================================
export function renderDashboard(articles, scripts, topAnalysts = [], topCollaborators = []) {
    const container = document.getElementById('dashboard-container');
    if (!container) return;

    // 1. DADOS BÁSICOS E KPIS
    const validArticles = articles.filter(a => a.status === 'approved' || (typeof ARTICLE_STATUS !== 'undefined' && a.status === ARTICLE_STATUS.APPROVED));
    const totalViews = articles.reduce((acc, a) => acc + (a.views || 0), 0);

    const hasReport = (a) => {
        return (a.reportCount || 0) > 0 || 
               (a.reports && a.reports.length > 0) || 
               a.flagged === true || 
               a.status === 'review' || 
               a.status === 'pendente_revisao';
    };

    // 2. INTELIGÊNCIA: Alerta de Qualidade
    const qualityAlertArticles = articles.filter(a => {
        const score = (a.useful || (a.likes || []).length || 0) - (a.notUseful || 0);
        return score < 0 || hasReport(a);
    });

    // 3. INTELIGÊNCIA: Fila de Revisão Urgente
    const now = new Date();
    const urgentArticles = articles.filter(a => {
        const isDraft = a.status === 'draft' || (typeof ARTICLE_STATUS !== 'undefined' && a.status === ARTICLE_STATUS.DRAFT);
        const isApproved = a.status === 'approved' || (typeof ARTICLE_STATUS !== 'undefined' && a.status === ARTICLE_STATUS.APPROVED);
        
        const lastUpdate = new Date(a.updatedAt || a.createdAt || Date.now());
        const daysOld = (now - lastUpdate) / (1000 * 60 * 60 * 24);
        
        const isReported = hasReport(a);
        const isHighViewDraft = isDraft && (a.views || 0) > 5;
        const isStagnantDraft = isDraft && daysOld > 3;  
        const isStale = isApproved && daysOld > 6; 
        
        if (isReported) a._alertReason = 'Reporte de Erro';
        else if (isStagnantDraft) a._alertReason = 'Rascunho Esquecido (> 3 dias)';
        else if (isHighViewDraft) a._alertReason = 'Rascunho com Alto Acesso (>5)';
        else if (isStale) a._alertReason = 'Revisão Vencida (> 6 dias)';
        
        return isReported || isHighViewDraft || isStagnantDraft || isStale;
    }).sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);

    // 4. RANKINGS (Fallback Inteligente)
    let finalAnalysts = topAnalysts;
    let finalCollaborators = topCollaborators;

    if (!finalAnalysts.length && !finalCollaborators.length) {
        const authorStats = {};
        articles.forEach(a => {
            const author = a.createdBy || 'Sistema';
            if (!authorStats[author]) authorStats[author] = { name: author, approved: 0, drafts: 0 };
            
            if (a.status === 'approved' || (typeof ARTICLE_STATUS !== 'undefined' && a.status === ARTICLE_STATUS.APPROVED)) {
                authorStats[author].approved++;
            } else {
                authorStats[author].drafts++;
            }
        });
        
        finalAnalysts = Object.values(authorStats).sort((a, b) => b.approved - a.approved).slice(0, 5);
        finalCollaborators = Object.values(authorStats).sort((a, b) => b.drafts - a.drafts).slice(0, 5);
    }

    const sortedByViews = [...articles].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
    const topScripts = [...scripts].sort((a, b) => (b.likes || []).length - (a.likes || []).length).slice(0, 5);

    // 5. RENDERIZAÇÃO DA UI
    container.innerHTML = `
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <i class="ph-fill ph-chart-line-up text-blue-600 dark:text-blue-400"></i> Dashboard de Governança KCS
        </h2>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div class="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm">
                <p class="text-xs text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1"><i class="ph ph-file-text"></i>Procedimentos</p>
                <p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">${articles.length}</p>
            </div>
            <div class="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm">
                <p class="text-xs text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1"><i class="ph ph-check-circle"></i>KCS Aprovados</p>
                <p class="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">${validArticles.length}</p>
            </div>
            <div class="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm">
                <p class="text-xs text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1"><i class="ph ph-eye"></i>Total de Acessos</p>
                <p class="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">${totalViews}</p>
            </div>
            <div class="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm border-b-4 border-b-red-500">
                <p class="text-xs text-red-500 dark:text-red-400 font-bold uppercase flex items-center gap-1"><i class="ph-fill ph-warning-octagon text-red-500"></i>Alerta de Qualidade</p>
                <p class="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">${qualityAlertArticles.length}</p>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div class="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
                <h3 class="text-sm font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-4 border-b border-border-subtle pb-2 flex items-center gap-2">
                    <i class="ph-fill ph-medal text-[18px]"></i> Top Analistas (Curadoria KCS)
                </h3>
                <div class="space-y-3">
                    ${finalAnalysts.filter(a => (a.articlesApproved || a.approved || 0) > 0).map((u, i) => `
                        <div class="flex items-center justify-between bg-bg-main p-3 rounded-lg border border-border-subtle">
                            <div class="flex items-center gap-3">
                                <div class="w-6 text-center font-bold text-gray-400 dark:text-gray-500">#${i + 1}</div>
                                <div class="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs border border-purple-200 dark:border-purple-800/50">${(u.displayName || u.name || '?').charAt(0).toUpperCase()}</div>
                                <p class="text-sm font-bold text-gray-900 dark:text-white">${escapeHtml(formatFullName(u.displayName || u.name))}</p>
                            </div>
                            <div class="text-right">
                                <span class="bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 text-xs px-2 py-1 rounded font-bold">${u.articlesApproved || u.approved || 0}</span>
                                <p class="text-[9px] text-gray-500 uppercase mt-0.5 tracking-wider">Aprovados</p>
                            </div>
                        </div>
                    `).join('') || '<p class="text-xs text-gray-500 dark:text-gray-400 text-center py-2">Nenhuma aprovação registrada.</p>'}
                </div>
            </div>

            <div class="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
                <h3 class="text-sm font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-4 border-b border-border-subtle pb-2 flex items-center gap-2">
                    <i class="ph-fill ph-hand-heart text-[18px]"></i> Top Colaboradores (Envios)
                </h3>
                <div class="space-y-3">
                    ${finalCollaborators.filter(c => (c.draftsSubmitted || c.drafts || 0) > 0).map((u, i) => `
                        <div class="flex items-center justify-between bg-bg-main p-3 rounded-lg border border-border-subtle">
                            <div class="flex items-center gap-3">
                                <div class="w-6 text-center font-bold text-gray-400 dark:text-gray-500">#${i + 1}</div>
                                <div class="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center justify-center font-bold text-xs border border-green-200 dark:border-green-800/50">${(u.displayName || u.name || '?').charAt(0).toUpperCase()}</div>
                                <p class="text-sm font-bold text-gray-900 dark:text-white">${escapeHtml(formatFullName(u.displayName || u.name))}</p>
                            </div>
                            <div class="text-right">
                                <span class="bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs px-2 py-1 rounded font-bold">${u.draftsSubmitted || u.drafts || 0}</span>
                                <p class="text-[9px] text-gray-500 uppercase mt-0.5 tracking-wider">Rascunhos</p>
                            </div>
                        </div>
                    `).join('') || '<p class="text-xs text-gray-500 dark:text-gray-400 text-center py-2">Nenhum envio registrado.</p>'}
                </div>
            </div>
        </div>

        <div class="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm mb-6 border-l-4 border-l-red-500">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border-subtle pb-3 mb-4 gap-2">
                <div class="flex items-center gap-3">
                    <h3 class="text-sm font-bold text-gray-800 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                        <i class="ph-fill ph-siren text-[18px] text-red-500"></i> Fila de Revisão Crítica
                    </h3>
                    <button onclick="window.copyTableToClipboard('dash-table-urgents', this)" class="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors px-2 py-1 rounded bg-bg-main border border-border-subtle shadow-sm" title="Copiar Tabela para Excel/Chat">
                        <i class="ph ph-copy text-[16px] align-middle"></i>
                    </button>
                </div>
                
                <div class="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 font-medium bg-bg-main px-3 py-1.5 rounded-lg border border-border-subtle">
                    <i class="ph-fill ph-info text-blue-500"></i>
                    <span><strong>Gatilhos:</strong> 1. Reporte de Erro | 2. Rascunho parado > 3 dias | 3. Rascunho com > 5 views | 4. Aprovado obsoleto > 6 dias</span>
                </div>
            </div>

            <div class="overflow-x-auto">
                <table id="dash-table-urgents" class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b border-border-subtle text-[10px] uppercase tracking-wider text-gray-500">
                            <th class="pb-2 font-bold pl-2">KCS ID</th>
                            <th class="pb-2 font-bold">Título do Procedimento</th>
                            <th class="pb-2 font-bold text-center">Acessos</th>
                            <th class="pb-2 font-bold">Gatilho Identificado</th>
                            <th class="pb-2 font-bold text-right pr-2">Ação</th>
                        </tr>
                    </thead>
                    <tbody class="text-sm divide-y divide-border-subtle">
                        ${urgentArticles.map(art => `
                            <tr class="hover:bg-gray-50 dark:hover:bg-bg-main transition-colors group cursor-pointer" onclick="window.__kcs.viewArticle('${art.id}')">
                                <td class="py-3 pl-2 pr-2 font-mono text-blue-600 dark:text-blue-400 font-bold text-xs">#${art.articleNumber || '---'}</td>
                                <td class="py-3 pr-2 font-medium text-gray-800 dark:text-gray-200 max-w-[300px] truncate" title="${escapeHtml(art.title)}">${escapeHtml(art.title)}</td>
                                <td class="py-3 pr-2 text-center text-gray-600 dark:text-gray-400"><i class="ph ph-eye mr-1"></i>${art.views || 0}</td>
                                <td class="py-3 pr-2">
                                    <span class="inline-flex items-center gap-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-tight">
                                        <i class="ph-fill ph-warning-circle"></i> ${escapeHtml(art._alertReason)}
                                    </span>
                                </td>
                                <td class="py-3 text-right pr-2">
                                    <button class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-bold px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                                        Revisar
                                    </button>
                                </td>
                            </tr>
                        `).join('') || '<tr><td colspan="5" class="py-6 text-center text-sm font-medium text-green-600 dark:text-green-500"><i class="ph-fill ph-check-circle text-xl align-middle mr-1"></i> Tudo certo! Nenhum alerta crítico na base.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div class="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
                <div class="flex items-center gap-3 border-b border-border-subtle pb-2 mb-4">
                    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <i class="ph-bold ph-trend-up text-blue-500"></i> Artigos Mais Acessados
                    </h3>
                    <button onclick="window.copyTableToClipboard('dash-table-views', this)" class="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors px-2 py-0.5 rounded bg-bg-main border border-border-subtle shadow-sm" title="Copiar Tabela para Excel/Chat">
                        <i class="ph ph-copy text-[14px] align-middle"></i>
                    </button>
                </div>
                
                <div class="overflow-x-auto">
                    <table id="dash-table-views" class="w-full text-left border-collapse">
                        <thead>
                            <tr class="border-b border-border-subtle text-[9px] uppercase tracking-wider text-gray-500">
                                <th class="pb-2 font-bold pl-1">Título</th>
                                <th class="pb-2 font-bold">Autor</th>
                                <th class="pb-2 font-bold">Revisão</th>
                                <th class="pb-2 font-bold text-right pr-1">Views</th>
                            </tr>
                        </thead>
                        <tbody class="text-sm divide-y divide-border-subtle">
                            ${sortedByViews.filter(a => (a.views || 0) > 0).map((a, i) => {
                                const authorName = formatFullName(a.createdBy);
                                const reviewerName = a.approvedBy || a.validatedBy || a.reviewedBy || (a.status === 'approved' ? a.updatedBy : null);
                                
                                return `
                                <tr class="hover:bg-gray-50 dark:hover:bg-bg-main transition-colors group cursor-pointer" onclick="window.__kcs.viewArticle('${a.id}')">
                                    <td class="py-2.5 pl-1 pr-2 font-medium text-gray-800 dark:text-gray-200 max-w-[140px] truncate" title="${escapeHtml(a.title)}">
                                        <span class="text-gray-400 dark:text-gray-500 mr-1 font-mono text-[10px]">${i+1}.</span>
                                        <span class="text-xs">${escapeHtml(a.title)}</span>
                                    </td>
                                    <td class="py-2.5 pr-2">
                                        <div class="flex items-center gap-1.5" title="Autor original">
                                            <div class="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[8px] font-bold text-gray-600 dark:text-gray-300">${authorName.charAt(0).toUpperCase()}</div>
                                            <span class="text-[11px] text-gray-700 dark:text-gray-300 font-medium">${escapeHtml(authorName)}</span>
                                        </div>
                                    </td>
                                    <td class="py-2.5 pr-2">
                                        ${reviewerName && a.status === 'approved' 
                                            ? `<div class="flex items-center gap-1" title="Revisado por">
                                                   <i class="ph-fill ph-check-circle text-green-500 dark:text-green-400 text-xs"></i>
                                                   <span class="text-[11px] text-gray-700 dark:text-gray-300 font-medium">${escapeHtml(formatFullName(reviewerName))}</span>
                                               </div>` 
                                            : `<span class="text-[10px] text-gray-400 dark:text-gray-500 italic flex items-center gap-1"><i class="ph ph-clock text-[10px]"></i> Pendente</span>`
                                        }
                                    </td>
                                    <td class="py-2.5 text-right pr-1">
                                        <span class="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[10px] px-1.5 py-0.5 rounded font-medium inline-block">${a.views}</span>
                                    </td>
                                </tr>
                                `;
                            }).join('') || '<tr><td colspan="4" class="py-4 text-xs text-gray-400 dark:text-gray-500 text-center">Nenhuma visualização registrada.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
                <div class="flex items-center gap-3 border-b border-border-subtle pb-2 mb-4">
                    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <i class="ph-bold ph-database text-purple-500"></i> Scripts SQL Mais Úteis
                    </h3>
                    <button onclick="window.copyTableToClipboard('dash-table-sql', this)" class="text-gray-400 hover:text-purple-500 dark:hover:text-purple-400 transition-colors px-2 py-0.5 rounded bg-bg-main border border-border-subtle shadow-sm" title="Copiar Tabela para Excel/Chat">
                        <i class="ph ph-copy text-[14px] align-middle"></i>
                    </button>
                </div>
                
                <div class="overflow-x-auto">
                    <table id="dash-table-sql" class="w-full text-left border-collapse">
                        <thead>
                            <tr class="border-b border-border-subtle text-[9px] uppercase tracking-wider text-gray-500">
                                <th class="pb-2 font-bold pl-1">Nome do Script</th>
                                <th class="pb-2 font-bold">Autor</th>
                                <th class="pb-2 font-bold text-right pr-1">Útil</th>
                            </tr>
                        </thead>
                        <tbody class="text-sm divide-y divide-border-subtle">
                            ${topScripts.filter(s => (s.likes||[]).length > 0).map((s, i) => {
                                const authorName = formatFullName(s.createdBy);
                                return `
                                <tr class="hover:bg-gray-50 dark:hover:bg-bg-main transition-colors group cursor-pointer" onclick="window.__kcs.viewSqlScript('${s.id}')">
                                    <td class="py-2.5 pl-1 pr-2 font-medium text-gray-800 dark:text-gray-200 max-w-[180px] truncate" title="${escapeHtml(s.name)}">
                                        <span class="text-gray-400 dark:text-gray-500 mr-1 font-mono text-[10px]">${i+1}.</span>
                                        <span class="text-xs">${escapeHtml(s.name)}</span>
                                    </td>
                                    <td class="py-2.5 pr-2">
                                        <div class="flex items-center gap-1.5" title="Autor original">
                                            <div class="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[8px] font-bold text-gray-600 dark:text-gray-300">${authorName.charAt(0).toUpperCase()}</div>
                                            <span class="text-[11px] text-gray-700 dark:text-gray-300 font-medium">${escapeHtml(authorName)}</span>
                                        </div>
                                    </td>
                                    <td class="py-2.5 text-right pr-1">
                                        <span class="text-purple-600 dark:text-purple-400 text-xs font-medium"><i class="ph-fill ph-heart mr-1 align-text-bottom"></i>${(s.likes||[]).length}</span>
                                    </td>
                                </tr>
                                `;
                            }).join('') || '<tr><td colspan="3" class="py-4 text-xs text-gray-400 dark:text-gray-500 text-center">Nenhum dado registrado.</td></tr>'}
                        </tbody>
                    </table>
                </div>
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

/**
 * Renderiza o Selo de Autenticidade (Pixel-Perfect Ghost Style)
 * @param {Object} companyData - Objeto contendo maxUsers e planName
 */
export function renderCompanyPlanBadge(companyData) {
    const badgeContainer = document.getElementById('company-plan-badge');
    const badgeContainerMobile = document.getElementById('company-plan-badge-mobile');

    if (!badgeContainer && !badgeContainerMobile) return;

    if (!companyData) {
        [badgeContainer, badgeContainerMobile].forEach(c => c && (c.innerHTML = ''));
        return;
    }

    const limit = Number(companyData.userLimit || companyData.maxUsers || 0);
    const planName = (companyData.planName || companyData.plan || '').toLowerCase();

    // 1. Extração do Nível (Sem Redundância)
    let label = 'STARTER';
    let colorVar = 'var(--kcs-starter)';

    if (limit >= 9999 || planName.includes('enterprise') || planName === 'gold') {
        label = 'UNLIMITED';
        colorVar = 'var(--kcs-unlimited)';
    } else if (limit > 5 || planName === 'prata' || planName.includes('teams')) {
        label = 'TEAMS';
        colorVar = 'var(--kcs-teams)';
    }

    // 2. Construção do Badge com Opacidade de Fundo de 8% (Selo de Vidro)
    const htmlBadge = `
        <div class="kcs-plan-badge" 
             style="color: ${colorVar}; 
                    background-color: color-mix(in srgb, ${colorVar}, transparent 92%);">
            ${label}
        </div>
    `;

    // 3. Injeção
    if (badgeContainer) badgeContainer.innerHTML = htmlBadge;
    if (badgeContainerMobile) badgeContainerMobile.innerHTML = htmlBadge;
}


export function formatFullName(nameStr) {
    if (!nameStr) return 'Sistema';
    const parts = nameStr.trim().split(' ');
    if (parts.length > 1) {
        return `${parts[0]} ${parts[parts.length - 1]}`; // Retorna Primeiro e Último nome
    }
    return parts[0];
}