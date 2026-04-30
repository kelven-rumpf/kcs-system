/**
 * ui/render.js — Renderização da Interface
 * Refatorado para Arquitetura Semântica Baseada no Design System e Sincronismo de Overlay/Dock
 */

import { canUseFeature, FEATURE_FLAGS } from '../services/featureAccess.js';
import { STATUS_LABELS, STATUS_COLORS, ARTICLE_STATUS, SECTORS } from '../config.js';
import { getSectorDisplayName } from '../services/sectorDirectory.js';
import { getCurrentUser, hasPermission, hasRole } from '../auth.js';
import { getCategoryName } from '../services/categories.js';

export function isAppBooting() {
    return typeof window !== 'undefined' && window.__APP_BOOTING__ === true;
}

const SQL_DB_TYPES = [
    { value: 'mysql', label: 'MySQL', color: 'db-mysql' },
    { value: 'postgres', label: 'PostgreSQL', color: 'db-postgres' },
    { value: 'sqlserver', label: 'SQL Server', color: 'db-sqlserver' },
    { value: 'oracle', label: 'Oracle DB', color: 'db-oracle' },
    { value: 'sqlite', label: 'SQLite', color: 'db-sqlite' }
];

export function renderHeader() {
    const user = getCurrentUser();
    if (!user) return;

    const avatar = document.getElementById('user-avatar');
    const nameDisplay = document.getElementById('user-name-display');
    const roleDisplay = document.getElementById('user-role-display');
    const sectorDisplay = document.getElementById('user-sector-display');

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

// Buscar nome do setor pelo ID (versão definitiva com Firebase + fallback)
if (sectorDisplay) {
    (async () => {
        try {
            const sectorName = await getSectorDisplayName(user.sectorId);
            sectorDisplay.textContent = `Setor: ${sectorName}`;
        } catch (error) {
            console.warn('Erro ao resolver nome do setor:', error);
            sectorDisplay.textContent = `Setor: ${user.sectorId || 'Não informado'}`;
        }
    })();
}

    const btnAdminPanel = document.getElementById('btn-admin-panel');
    if (btnAdminPanel) {
        if (['super_admin', 'admin'].includes(user.role)) {
            btnAdminPanel.classList.remove('hidden');
        } else {
            btnAdminPanel.classList.add('hidden');
            btnAdminPanel.remove(); 
        }
    }

    const btnCompanySettings = document.getElementById('btn-company-settings');
    if (btnCompanySettings) {
        if (user.role === 'super_admin') {
            btnCompanySettings.classList.remove('hidden');
            btnCompanySettings.onclick = () => window.__kcs.openMasterPlanManager();
        } else {
            btnCompanySettings.classList.add('hidden');
            btnCompanySettings.remove(); 
        }
    }

    const settingsAdminItem = document.getElementById('settings-admin-item');
    if (settingsAdminItem && !hasPermission('manage_users')) {
        settingsAdminItem.classList.add('hidden');
    }

    const activitySettingsButton = document.querySelector('.workbench-activitybar [data-view="settings"]');
    if (activitySettingsButton && user.role === 'user') {
        activitySettingsButton.classList.add('hidden');
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
    
    if (btnNotif) {
        btnNotif.classList.add('animate-pulse');
        setTimeout(() => btnNotif.classList.remove('animate-pulse'), 3000);
    }
    
    const notificationHtml = `
        <div onclick="window.__kcs.viewArticle('${articleId}')" class="notif-item animate-fade-in">
            <div class="notif-icon-wrapper">
                <i class="ph ph-sparkle notif-icon"></i>
            </div>
            <div class="notif-content">
                <p class="notif-title">${title}</p>
                <p class="notif-subtitle">${subtitle}</p>
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

export function renderArticleGrid(articles, allArticles, paginationConfig = null) {
    const container = document.getElementById('articles-grid');
    if (!container) return;

    const currentViewMode = localStorage.getItem('kcs_view_mode') || 'grid';

    // Extrai autores de TODA a base para que o filtro nunca fique vazio
    const uniqueAuthors = [...new Set(allArticles.map(a => a.createdBy).filter(Boolean))].sort();

    let html = `
        <div class="view-header" style="flex-wrap: wrap; gap: 16px;">
            <h2 class="view-title">
                <i class="ph ph-files"></i> PROCEDIMENTOS
            </h2>
            
            <div style="display: flex; align-items: center; gap: 12px; margin-left: auto;">
                
                <div style="display: flex; gap: 8px; border-right: 1px solid var(--color-border-subtle); padding-right: 12px;">
                    <select id="grid-filter-author" class="vscode-select">
                        <option value="all">Todos os Autores</option>
                        ${uniqueAuthors.map(author => `<option value="${escapeHtml(author)}">${escapeHtml(author)}</option>`).join('')}
                    </select>
                    
                    <select id="grid-filter-status" class="vscode-select">
                        <option value="all">Todos os Status</option>
                        <option value="approved">Aprovados</option>
                        <option value="pendente_revisao">Em Revisão</option>
                        <option value="draft">Rascunhos</option>
                    </select>
                </div>

                <div class="view-toggles">
                    <button onclick="window.__kcs.setViewMode('grid')" class="view-toggle-btn ${currentViewMode === 'grid' ? 'active-view' : ''}">
                        <i class="ph ph-squares-four"></i> <span>Cards</span>
                    </button>
                    <button onclick="window.__kcs.setViewMode('table')" class="view-toggle-btn ${currentViewMode === 'table' ? 'active-view' : ''}">
                        <i class="ph ph-list-dashes"></i> <span>Tabela</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    // CORREÇÃO: Removido o "return;" para que o código continue e reative os filtros!
    if (!articles || articles.length === 0) {
        html += `<div class="empty-state"><i class="ph ph-folder-open empty-icon"></i><p>Nenhum procedimento encontrado</p></div>`; 
    } else {
        if (currentViewMode === 'grid') {
            html += `<div class="content-grid">`;
            html += articles.map((article) => renderArticleCard(article)).join('');
            html += `</div>`;
        } else {
            html += renderArticleTable(articles);
        }

        if (paginationConfig) {
            html += `
                <div class="pagination-footer">
                    <span class="pagination-info">
                        Mostrando <strong>${articles.length}</strong> de <strong>${paginationConfig.totalItems}</strong> &mdash; Página ${paginationConfig.currentPage} de ${paginationConfig.totalPages}
                    </span>
                    <div class="pagination-controls">
                        <button onclick="window.__kcs.loadPage('prev')" class="btn-pagination" ${!paginationConfig.hasPrev ? 'disabled' : ''}>
                            <i class="ph ph-caret-left"></i> Anterior
                        </button>
                        <button onclick="window.__kcs.loadPage('next')" class="btn-pagination" ${!paginationConfig.hasNext ? 'disabled' : ''}>
                            Próxima <i class="ph ph-caret-right"></i>
                        </button>
                    </div>
                </div>
            `;
        }
    }

    container.innerHTML = html;
    
    // Vinculação de eventos garantida (mesmo se a tela estiver vazia)
    setTimeout(() => {
        const authorFilter = document.getElementById('grid-filter-author');
        const statusFilter = document.getElementById('grid-filter-status');
        
        if (authorFilter && window.__kcs.applyGridFilters) {
            authorFilter.value = window.__kcs.currentGridAuthor || 'all';
            authorFilter.onchange = (e) => window.__kcs.applyGridFilters('author', e.target.value);
        }
        
        if (statusFilter && window.__kcs.applyGridFilters) {
            statusFilter.value = window.__kcs.currentGridStatus || 'all';
            statusFilter.onchange = (e) => window.__kcs.applyGridFilters('status', e.target.value);
        }
    }, 10);
}

export function renderSqlGrid(scripts, allScripts, paginationConfig = null) {
  const container = document.getElementById('articles-grid');
  if (!container) return;

  const currentViewMode = localStorage.getItem('kcs_sql_view_mode') || 'grid';
  const uniqueAuthors = [...new Set(allScripts.map(s => s.createdBy).filter(Boolean))].sort();

  let html = `
    <div class="view-header" style="flex-wrap: wrap; gap: 16px;">
        <h2 class="view-title">
            <i class="ph ph-database text-purple-500"></i> BIBLIOTECA SQL
        </h2>
        <div style="display: flex; align-items: center; gap: 12px; margin-left: auto;">
            
            <div style="display: flex; gap: 8px; border-right: 1px solid var(--color-border-subtle); padding-right: 12px;">
                <select id="grid-sql-filter-author" class="vscode-select">
                    <option value="all">Todos os Autores</option>
                    ${uniqueAuthors.map(author => `<option value="${escapeHtml(author)}">${escapeHtml(author)}</option>`).join('')}
                </select>
                
                <select id="grid-sql-filter-op" class="vscode-select">
                    <option value="all">Todas as Operações</option>
                    <option value="SELECT">Consultas (SELECT)</option>
                    <option value="UPDATE">Alterações (UPDATE)</option>
                    <option value="DELETE">Exclusões (DELETE)</option>
                </select>
            </div>

            <div class="view-toggles">
                <button onclick="window.__kcs.setSqlViewMode('grid')" class="view-toggle-btn ${currentViewMode === 'grid' ? 'active-view' : ''}">
                    <i class="ph ph-squares-four"></i> <span>Cards</span>
                </button>
                <button onclick="window.__kcs.setSqlViewMode('table')" class="view-toggle-btn ${currentViewMode === 'table' ? 'active-view' : ''}">
                    <i class="ph ph-list-dashes"></i> <span>Tabela</span>
                </button>
            </div>
        </div>
    </div>
  `;

  // CORREÇÃO: Removido o "return;"
  if (!scripts || scripts.length === 0) {
    html += `<div class="empty-state"><i class="ph ph-database empty-icon text-purple-500/50"></i><p>Nenhum script SQL encontrado</p></div>`; 
  } else {
      if (currentViewMode === 'grid') {
        html += `<div class="content-grid">`;
        html += scripts.map((script) => renderSqlCard(script)).join('');
        html += `</div>`;
      } else {
        html += renderSqlTable(scripts);
      }

      if (paginationConfig) {
        html += `
            <div class="pagination-footer">
                <span class="pagination-info">
                    Mostrando <strong>${scripts.length}</strong> de <strong>${paginationConfig.totalItems}</strong> &mdash; Página ${paginationConfig.currentPage} de ${paginationConfig.totalPages}
                </span>
                <div class="pagination-controls">
                    <button onclick="window.__kcs.loadPage('prev')" class="btn-pagination" ${!paginationConfig.hasPrev ? 'disabled' : ''}><i class="ph ph-caret-left"></i> Anterior</button>
                    <button onclick="window.__kcs.loadPage('next')" class="btn-pagination" ${!paginationConfig.hasNext ? 'disabled' : ''}>Próxima <i class="ph ph-caret-right"></i></button>
                </div>
            </div>
        `;
      }
  }

  container.innerHTML = html;

  // Vinculação de eventos garantida
  setTimeout(() => {
      const authorFilter = document.getElementById('grid-sql-filter-author');
      const opFilter = document.getElementById('grid-sql-filter-op');
      
      if (authorFilter && window.__kcs.applyGridFilters) {
          authorFilter.value = window.__kcs.currentGridSqlAuthor || 'all';
          authorFilter.onchange = (e) => window.__kcs.applyGridFilters('sql-author', e.target.value);
      }
      
      if (opFilter && window.__kcs.applyGridFilters) {
          opFilter.value = window.__kcs.currentGridSqlOp || 'all';
          opFilter.onchange = (e) => window.__kcs.applyGridFilters('sql-op', e.target.value);
      }
  }, 10);
}

function renderArticleTable(articles) {
    const canEdit = hasPermission('edit_article');
    const canDelete = hasPermission('delete_article');

    let tableHtml = `
    <div class="kcs-table-wrapper">
        <table class="kcs-table-base">
            <thead>
                <tr>
                    <th>ID / Ref</th>
                    <th>Título e Categoria</th>
                    <th>Autor</th>
                    <th>Revisão</th>
                    <th>Status</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
    `;

    tableHtml += articles.map(article => {
        const categoryDisplayName = getCategoryName(article.categoryId || article.category);
        const kcsNum = article.articleNumber ? `#KCS-${article.articleNumber}` : '---';
        const authorName = formatFullName(article.createdBy);
        const reviewerName = article.approvedBy || article.validatedBy || article.reviewedBy || (article.status === 'approved' ? article.updatedBy : null);

        return `
            <tr class="table-row" onclick="window.__kcs.viewArticle('${article.id}')">
                <td>
                    <span class="id-badge">${kcsNum}</span>
                </td>
                <td class="title-cell">
                    <p class="cell-title" title="${escapeHtml(article.title)}">${escapeHtml(article.title)}</p>
                    <p class="cell-subtitle">${categoryDisplayName !== 'Sem categoria' ? escapeHtml(categoryDisplayName) : 'Sem categoria'}</p>
                </td>
                <td>
                    <div class="user-badge" title="Autor original">
                        <div class="avatar-mini">${authorName.charAt(0).toUpperCase()}</div>
                        <span class="user-name">${escapeHtml(authorName)}</span>
                    </div>
                </td>
                <td>
                    ${reviewerName && article.status === 'approved' 
                        ? `<div class="user-badge" title="Revisado por">
                               <i class="ph ph-check-circle status-icon-approved"></i>
                               <span class="user-name">${escapeHtml(formatFullName(reviewerName))}</span>
                           </div>` 
                        : `<span class="status-pending"><i class="ph ph-clock"></i> Pendente</span>`
                    }
                </td>
                <td>
                    <span class="status-badge status-${article.status}">${article.status}</span>
                </td>
                <td class="actions-cell">
                    <div class="table-actions" onclick="event.stopPropagation()">
                        ${canEdit ? `<button onclick="window.__kcs.editArticle('${article.id}')" class="btn-icon" title="Editar"><i class="ph ph-pencil-simple"></i></button>` : ''}
                        ${canDelete ? `<button onclick="window.__kcs.deleteArticle('${article.id}')" class="btn-icon btn-delete" title="Excluir"><i class="ph ph-trash"></i></button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tableHtml += `</tbody></table></div>`;
    return tableHtml;
}
export function renderArticleCard(article) {
  const categoryDisplayName = getCategoryName(article.categoryId || article.category);
  const stepsPreviewText = Array.isArray(article.steps) ? article.steps.map(s => s.description).join(' ') : article.steps;
  const previewText = truncate(stripHtml(article.symptom || article.body || stepsPreviewText || ''), 120);
  
  // Tag do ID KCS (Refatorado)
  const kcsNumHtml = article.articleNumber ? `<span class="kcs-badge-id px-2 py-0.5">#KCS-${article.articleNumber}</span>` : '<span></span>';

  // Interações e Favoritos
  const user = getCurrentUser();
  const userId = user?.uid || user?.id;
  const isFav = (article.favorites || []).includes(userId);
  const starClass = isFav ? 'ph-fill ph-star text-yellow-500' : 'ph ph-star text-gray-400 hover:text-yellow-500';
  const isLiked = (article.likes || []).includes(userId);
  const heartClass = isLiked ? 'ph-fill ph-heart text-red-500' : 'ph ph-heart text-gray-400 hover:text-red-500';

  const authorFullName = formatFullName(article.createdBy);
  
  // Lógica inteligente de cor do Status (Design System)
  let statusBadge = '';
  if (article.status === 'approved') statusBadge = '<span class="kcs-badge-success px-2 py-0.5">APROVADO</span>';
  else if (article.status === 'pendente_revisao' || article.status === 'review') statusBadge = '<span class="kcs-badge-warning px-2 py-0.5">EM REVISÃO</span>';
  else statusBadge = '<span class="kcs-badge-neutral px-2 py-0.5">RASCUNHO</span>';

  return `
    <div class="kcs-card-content p-4 flex flex-col gap-3 relative group" onclick="window.__kcs.viewArticle('${article.id}')">
        
        <div class="flex justify-between items-start">
            ${kcsNumHtml}
            ${statusBadge}
        </div>
        
        <div>
            <h3 class="text-[13px] font-bold text-gray-900 dark:text-gray-100 leading-snug mb-1 line-clamp-2" title="${escapeHtml(article.title)}">${escapeHtml(article.title)}</h3>
            <p class="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">${escapeHtml(previewText)}</p>
        </div>

        <div class="flex flex-wrap gap-1.5 mt-auto pt-2">
            ${categoryDisplayName && categoryDisplayName !== 'Sem categoria' ? `<span class="kcs-badge-tag px-3 py-0.5" style="color: var(--color-focus); border-color: var(--color-focus);">${escapeHtml(categoryDisplayName)}</span>` : ''}
            ${(article.tags || []).slice(0, 2).map(t => `<span class="kcs-badge-tag px-3 py-0.5">${escapeHtml(t)}</span>`).join('')}
        </div>

        <div class="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-border-subtle mt-1">
            
            <div class="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                <div class="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] font-bold text-gray-700 dark:text-gray-300">${authorFullName.charAt(0).toUpperCase()}</div>
                <span class="truncate max-w-[90px]">${escapeHtml(authorFullName)}</span>
            </div>
            
            <div class="flex items-center gap-3" onclick="event.stopPropagation()">
                <div class="flex items-center gap-2 mr-2">
                    <button onclick="window.__kcs.toggleLike('${article.id}')" class="flex items-center gap-1 text-[11px] text-gray-400 transition-colors"><i class="${heartClass} text-sm"></i> ${(article.likes || []).length || ''}</button>
                    <button onclick="window.__kcs.toggleFavorite('${article.id}')" class="flex items-center text-[11px] transition-colors"><i class="${starClass} text-sm"></i></button>
                </div>
                
                ${hasPermission('edit_article') ? `
                    <button onclick="window.__kcs.editArticle('${article.id}')" class="text-gray-400 hover:text-blue-500 transition-colors" title="Editar Procedimento"><i class="ph-bold ph-pencil-simple text-[14px]"></i></button>
                    ${hasPermission('delete_article') ? `<button onclick="window.__kcs.deleteArticle('${article.id}')" class="text-gray-400 hover:text-red-500 transition-colors" title="Excluir"><i class="ph-bold ph-trash text-[14px]"></i></button>` : ''}
                ` : ''}
            </div>

        </div>
    </div>
  `;
}



function renderSqlTable(scripts) {
  const user = getCurrentUser();
  
  let tableHtml = `
    <div class="kcs-table-wrapper">
        <table class="kcs-table-base">
            <thead>
                <tr>
                    <th>Ref</th>
                    <th>Nome do Script</th>
                    <th>Banco</th>
                    <th>Operação</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
  `;

  tableHtml += scripts.map(s => {
      const dbInfo = SQL_DB_TYPES.find((t) => t.value === s.dbType) || { label: s.dbType, color: '' };
      const opType = s.sqlCategory || 'SELECT';
      const canManage = hasPermission('manage_sql') || (user && s.createdById === user.id);

      const authorName = s.createdBy ? s.createdBy.split(' ')[0] : 'Sistema';
      const sqlNum = s.scriptNumber ? `#SQL-${s.scriptNumber}` : '---';

      return `
      <tr class="table-row" onclick="window.__kcs.viewSqlScript('${s.id}')">
          <td>
              <span class="id-badge">${sqlNum}</span>
          </td>
          <td class="title-cell">
              <p class="cell-title" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</p>
              <p class="cell-subtitle">${escapeHtml(authorName)} · ${formatDate(s.updatedAt)}</p>
          </td>
          <td>
              <span class="db-badge ${dbInfo.color}">${dbInfo.label}</span>
          </td>
          <td>
              <span class="op-badge op-${opType.toLowerCase()}">${opType}</span>
          </td>
          <td class="actions-cell">
              <div class="table-actions" onclick="event.stopPropagation()">
                  <button onclick="window.__kcs.explainSql('${s.id}')" class="btn-icon btn-explain" title="A IA explicará o que este script faz"><i class="ph ph-lightbulb"></i></button>
                  ${canManage ? `<button onclick="window.__kcs.editSqlScript('${s.id}')" class="btn-icon" title="Editar"><i class="ph ph-pencil-simple"></i></button>` : ''}
                  ${hasPermission('manage_sql') ? `<button onclick="window.__kcs.deleteSqlScript('${s.id}')" class="btn-icon btn-delete" title="Excluir"><i class="ph ph-trash"></i></button>` : ''}
              </div>
          </td>
      </tr>`;
  }).join('');

  tableHtml += `</tbody></table></div>`;
  return tableHtml;
}

export function renderSqlCard(script) {
  const dbInfo = SQL_DB_TYPES.find((t) => t.value === script.dbType) || { label: script.dbType, color: '' };
  const canManage = hasPermission('manage_sql') || script.createdById === getCurrentUser().id;

  const opType = script.sqlCategory || 'SELECT';
  const sqlNumHtml = script.scriptNumber ? `<span class="kcs-badge-id px-2 py-0.5">#SQL-${script.scriptNumber}</span>` : '<span></span>';

  const user = getCurrentUser();
  const userId = user?.uid || user?.id;
  const isFav = (script.favorites || []).includes(userId);
  const starClass = isFav ? 'ph-fill ph-star text-yellow-500' : 'ph ph-star text-gray-400 hover:text-yellow-500';
  const isLiked = (script.likes || []).includes(userId);
  const heartClass = isLiked ? 'ph-fill ph-heart text-red-500' : 'ph ph-heart text-gray-400 hover:text-red-500';

  const authorFullName = formatFullName(script.createdBy);

  let opBadge = '';
  if (opType === 'SELECT') opBadge = '<span class="kcs-badge-tag px-2 py-0.5" style="color: #3b82f6;">SELECT</span>';
  else if (opType === 'UPDATE') opBadge = '<span class="kcs-badge-warning px-2 py-0.5">UPDATE</span>';
  else if (opType === 'DELETE') opBadge = '<span class="kcs-badge-tag px-2 py-0.5" style="color: #ef4444; border-color: #ef4444;">DELETE</span>';
  else opBadge = `<span class="kcs-badge-neutral px-2 py-0.5">${escapeHtml(opType)}</span>`;

  return `
    <div class="kcs-card-content p-4 flex flex-col gap-3 relative group" onclick="window.__kcs.viewSqlScript('${script.id}')">
        
        <div class="flex justify-between items-start">
            ${sqlNumHtml}
            ${opBadge}
        </div>
        
        <div>
            <h3 class="text-[13px] font-bold text-gray-900 dark:text-gray-100 leading-snug mb-1 line-clamp-2" title="${escapeHtml(script.name)}">${escapeHtml(script.name)}</h3>
            <div class="kcs-surface-base text-[10px] text-gray-500 line-clamp-3 leading-relaxed font-mono mt-2 p-2 rounded border border-gray-200 dark:border-border-subtle">
                ${escapeHtml(truncate(script.code || '', 100))}
            </div>
        </div>

        <div class="flex flex-wrap gap-1.5 mt-auto pt-2">
            <span class="kcs-badge-tag px-3 py-0.5 flex items-center gap-1"><i class="ph-bold ph-database"></i> ${escapeHtml(dbInfo.label)}</span>
            ${script.visibility === 'private' ? `<span class="kcs-badge-tag px-2 py-0.5" style="color: #ef4444;" title="Privado"><i class="ph-bold ph-lock"></i></span>` : ''}
        </div>

        <div class="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-border-subtle mt-1">
            <div class="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                <div class="w-5 h-5 rounded-full bg-purple-500/10 flex items-center justify-center text-[9px] font-bold text-purple-600 dark:text-purple-400">${authorFullName.charAt(0).toUpperCase()}</div>
                <span class="truncate max-w-[80px]">${escapeHtml(authorFullName)}</span>
            </div>
            
            <div class="flex items-center gap-2.5" onclick="event.stopPropagation()">
                <button onclick="window.__kcs.explainSql('${script.id}')" class="text-yellow-500 hover:text-yellow-400 transition-colors" title="Explicar com IA"><i class="ph-fill ph-lightbulb text-[14px]"></i></button>
                <div class="flex items-center gap-2 mx-1 border-l border-r border-gray-200 dark:border-gray-700 px-2">
                    <button onclick="window.__kcs.toggleSqlLike('${script.id}')" class="flex items-center gap-1 text-[11px] text-gray-400 transition-colors"><i class="${heartClass} text-sm"></i> ${(script.likes || []).length || ''}</button>
                    <button onclick="window.__kcs.toggleSqlFavorite('${script.id}')" class="flex items-center text-[11px] transition-colors"><i class="${starClass} text-sm"></i></button>
                </div>
                ${canManage ? `<button onclick="window.__kcs.editSqlScript('${script.id}')" class="text-gray-400 hover:text-purple-500 transition-colors" title="Editar"><i class="ph-bold ph-pencil-simple text-[14px]"></i></button>` : ''}
                ${hasPermission('manage_sql') ? `<button onclick="window.__kcs.deleteSqlScript('${script.id}')" class="text-gray-400 hover:text-red-500 transition-colors" title="Excluir"><i class="ph-bold ph-trash text-[14px]"></i></button>` : ''}
            </div>
        </div>
    </div>
  `;
}

/* ==========================================================================
   FUNÇÃO: getIconHtml (Refatorada para ícones monocromáticos)
   ========================================================================== */
function getIconHtml(iconRaw) {
    // Bloqueia emojis e força o padrão monocromático da biblioteca Phosphor
    if (iconRaw && typeof iconRaw === 'string' && iconRaw.startsWith('ph-')) {
        return `<i class="ph ${iconRaw.replace('ph-fill', 'ph')} tree-icon"></i>`;
    }
    // Ícone de pasta padrão do VS Code para categorias
    return `<i class="ph ph-folder tree-icon"></i>`;
}

/* ==========================================================================
   FUNÇÃO: renderSidebar (Com secções expandidas por defeito)
   ========================================================================== */
export function renderSidebar(articleCounts, sqlCounts, activeFilter = 'all', activeSqlFilter = 'all', activeView = 'articles', categoryTree = [], allArticles = [], allScripts = []) {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;
  const canEdit = hasPermission('edit_article');
  const user = getCurrentUser();
  const userId = user?.uid || user?.id;
  
  const closeSidebarMobile = "if(window.innerWidth < 1024) { document.getElementById('sidebar').classList.add('-translate-x-full'); }";
  
  // 1. Visão Geral (Agora com 'open')
  let html = `
    <details class="sidebar-section-group" open>
        <summary class="sidebar-section-title">
            <div class="flex items-center gap-1.5">
                <span class="section-indicator">▶</span>
                <span>Visão Geral</span>
            </div>
        </summary>
        <div class="section-children">
            <button onclick="window.__kcs.switchToDashboard(); ${closeSidebarMobile}" class="sidebar-item ${activeView === 'dashboard' ? 'active' : ''}"><i class="ph ph-chart-pie-slice"></i><span class="sidebar-item-label">Dashboard</span></button>
            <button onclick="window.__kcs.startTour(); ${closeSidebarMobile}" class="sidebar-item"><i class="ph ph-rocket icon-highlight"></i><span class="sidebar-item-label">Rever Tour</span></button>
        </div>
    </details>`;
  
  // 2. Base de Conhecimento (Agora com 'open')
  html += `
    <details id="tour-base-conhecimento" class="sidebar-section-group" open>
        <summary class="sidebar-section-title">
            <div class="flex items-center gap-1.5">
                <span class="section-indicator">▶</span>
                <span>Base de Conhecimento</span>
            </div>
        </summary>
        <div class="section-children">`;
  
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

  html += articleItems.map((item) => `<button onclick="window.__kcs.filterByStatus('${item.key}'); ${closeSidebarMobile}" class="sidebar-item ${activeView === 'articles' && activeFilter === item.key ? 'active' : ''}"><i class="ph ${item.icon}"></i><span class="sidebar-item-label">${item.label}</span><span class="count-badge">${item.count}</span></button>`).join('');
  html += `</div></details>`;

  // 3. Categorias (Agora com 'open')
  if (categoryTree.length > 0 || hasRole('super_admin')) {
      html += `
        <details id="tour-categorias" class="sidebar-section-group sidebar-separator" open>
            <summary class="sidebar-section-title">
                <div class="flex items-center gap-1.5">
                    <span class="section-indicator">▶</span>
                    <span>Categorias</span>
                </div>
            </summary>
            <div class="tree-container section-children">`;
      if (categoryTree.length > 0) {
          // As subcategorias continuam a respeitar a sua própria lógica de abertura (geralmente fechadas)
          html += renderCategoryTree(categoryTree, activeFilter, 0, allArticles, closeSidebarMobile);
      } else {
          html += `<div class="tree-empty-state px-4 py-2 text-xs text-gray-500 italic">Nenhuma categoria cadastrada.</div>`;
      }
      html += `</div></details>`;
  }
  
  // 4. Biblioteca SQL (Agora com 'open')
  if (canUseFeature(FEATURE_FLAGS.SQL_LIBRARY) && (hasPermission('manage_sql') || !canEdit)) {
    html += `
    <details id="tour-sql" class="sidebar-section-group sidebar-separator" open>
        <summary class="sidebar-section-title">
            <div class="flex items-center gap-1.5">
                <span class="section-indicator">▶</span>
                <span>Biblioteca SQL</span>
            </div>
        </summary>
        <div class="section-children">`;
    
    const sqlItems = [
      { key: 'all', label: 'Todos os Scripts', icon: 'ph-folders', count: sqlCounts.total || 0 },
      { key: 'favorites', label: 'Meus Favoritos', icon: 'ph-star', count: (allScripts || []).filter(s => (s.favorites || []).includes(userId)).length },
      { key: 'SELECT', label: 'Consultas', icon: 'ph-magnifying-glass', count: sqlCounts.select || 0 },
      { key: 'UPDATE', label: 'Alterações', icon: 'ph-pencil-simple', count: sqlCounts.update || 0 },
      { key: 'DELETE', label: 'Exclusões', icon: 'ph-trash', count: sqlCounts.delete || 0 }
    ];

    html += sqlItems.map((item) => `
      <button onclick="window.__kcs.filterSqlByStatus('${item.key}'); ${closeSidebarMobile}" class="sidebar-item ${activeView === 'sql' && activeSqlFilter === item.key ? 'active sql-active' : ''}">
        <i class="ph ${item.icon}"></i>
        <span class="sidebar-item-label">${item.label}</span>
        <span class="count-badge">${item.count}</span>
      </button>
    `).join('');

    html += `</div></details>`;
  }

  nav.innerHTML = html;
}

/* ==========================================================================
   FUNÇÃO: renderCategoryTree (Ajustada para o novo Design System)
   ========================================================================== */
function renderCategoryTree(nodes, activeFilter, depth = 0, allArticles = [], closeScript = '') {
  return nodes.map((node) => {
    const hasChildren = node.children && node.children.length > 0;
    const nodeArticles = allArticles.filter(a => a.categoryId === node.id || a.category === node.id);
    const hasArticles = nodeArticles.length > 0;

    let html = '';

    const articlesHtml = nodeArticles.map(a => `
        <div onclick="window.__kcs.viewArticle('${a.id}'); ${closeScript}" class="tree-article">
            <i class="ph ph-file-text"></i>
            <span class="tree-article-title" title="${escapeHtml(a.title)}">${a.articleNumber ? `<span class="tree-article-id">#${a.articleNumber}</span> ` : ''}${escapeHtml(a.title)}</span>
        </div>
    `).join('');

    const childrenHtml = hasChildren ? renderCategoryTree(node.children, activeFilter, depth + 1, allArticles, closeScript) : '';

    if (hasChildren || hasArticles) {
        html += `
            <details class="tree-details">
                <summary class="tree-summary">
                    <span class="tree-indicator">▶</span>
                    ${getIconHtml(node.icon)}
                    <span class="tree-summary-title">${escapeHtml(node.name)}</span>
                </summary>
                <div class="tree-children">
                    ${childrenHtml}
                    ${articlesHtml}
                </div>
            </details>
        `;
    } else {
         html += `
            <div class="tree-article tree-empty">
                ${getIconHtml(node.icon)}
                <span class="tree-empty-title italic opacity-60">${escapeHtml(node.name)} (vazia)</span>
            </div>
        `;
    }

    return html;
  }).join('');
}

window.copyTableToClipboard = function(tableId, btnElement) {
    const table = document.getElementById(tableId);
    if (!table) return;

    let text = '';
    for (let i = 0; i < table.rows.length; i++) {
        let row = [];
        for (let j = 0; j < table.rows[i].cells.length; j++) {
            const cellText = table.rows[i].cells[j].innerText.trim();
            if (cellText.toLowerCase() !== 'ação' && cellText.toLowerCase() !== 'revisar') {
                row.push(cellText.replace(/\n/g, ' '));
            }
        }
        text += row.join('\t') + '\n';
    }

    navigator.clipboard.writeText(text).then(() => {
        const originalHtml = btnElement.innerHTML;
        btnElement.innerHTML = '<i class="ph ph-check-circle copy-success"></i>';
        if (window.__kcs && window.__kcs.showToast) {
            window.__kcs.showToast('Dados copiados para a área de transferência!', 'success');
        }
        setTimeout(() => { btnElement.innerHTML = originalHtml; }, 2000);
    }).catch(err => {
        console.error('Falha ao copiar:', err);
    });
};

export function renderDashboard(articles, scripts, topAnalysts = [], topCollaborators = []) {
    const container = document.getElementById('dashboard-container');
    if (!container) return;

    window.__kcsDashboardArticles = articles || [];
    window.__kcsDashboardScripts = scripts || [];
    window.__kcsDashboardTopAnalysts = topAnalysts || [];
    window.__kcsDashboardTopCollaborators = topCollaborators || [];

if (!window.__kcsDashboardDateRange) {
    const today = new Date();
    // Força o início para o primeiro dia do mês atual
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1); 
    
    window.__kcsDashboardDateRange = {
        start: firstDayOfMonth.toISOString().slice(0, 10),
        end: today.toISOString().slice(0, 10)
    };
}

    window.__kcsSetDashboardDateRange = (start, end) => {
        window.__kcsDashboardDateRange = { start, end };
        renderDashboard(
            window.__kcsDashboardArticles || [],
            window.__kcsDashboardScripts || [],
            window.__kcsDashboardTopAnalysts || [],
            window.__kcsDashboardTopCollaborators || []
        );
    };

    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    const selectedDateRange = window.__kcsDashboardDateRange || {};
    const periodStart = selectedDateRange.start ? new Date(`${selectedDateRange.start}T00:00:00`) : null;
    const periodEnd = selectedDateRange.end ? new Date(`${selectedDateRange.end}T23:59:59`) : null;

    const normalizedArticles = (articles || []).map(article => ({
        ...article,
        _createdAt: dashboardToDate(article.createdAt),
        _updatedAt: dashboardToDate(article.updatedAt),
        _approvedAt: dashboardToDate(article.approvedAt || article.publishedAt || article.updatedAt),
        _lastReviewedAt: dashboardToDate(article.lastReviewedAt || article.reviewedAt || article.updatedAt),
        _status: dashboardNormalizeStatus(article.status)
    }));

    const normalizedScripts = scripts || [];

    const approvedArticles = normalizedArticles.filter(article => article._status === 'approved');
    const draftArticles = normalizedArticles.filter(article => article._status === 'draft');
    const reviewArticles = normalizedArticles.filter(article => article._status === 'review');
    const pendingArticles = normalizedArticles.filter(article => article._status !== 'approved');

    const isDateInRange = (date) => {
        if (!date) return false;
        if (periodStart && date < periodStart) return false;
        if (periodEnd && date > periodEnd) return false;
        return true;
    };
    const articlesInPeriod = normalizedArticles.filter(article => isDateInRange(article._createdAt));
    const approvedInPeriod = approvedArticles.filter(article => isDateInRange(article._approvedAt));

    const totalViews = normalizedArticles.reduce((acc, article) => acc + (article.views || 0), 0);
    const totalKnowledgeAccess = totalViews;

    const approvalRate = normalizedArticles.length > 0
        ? Math.round((approvedArticles.length / normalizedArticles.length) * 100)
        : 0;

    const periodApprovalRate = articlesInPeriod.length > 0
        ? Math.round((approvedInPeriod.length / articlesInPeriod.length) * 100)
        : 0;

    let totalReviewTime = 0;
    let reviewedCount = 0;

    approvedArticles.forEach(article => {
        if (article._createdAt && article._approvedAt && article._approvedAt >= article._createdAt) {
            totalReviewTime += (article._approvedAt - article._createdAt) / msPerDay;
            reviewedCount++;
        }
    });

    const avgReviewDays = reviewedCount > 0 ? Math.round(totalReviewTime / reviewedCount) : 0;

    const outdatedArticles = approvedArticles.filter(article => {
        const baseDate = article._lastReviewedAt || article._updatedAt || article._createdAt || now;
        const ageDays = (now - baseDate) / msPerDay;
        return ageDays > 90;
    });

    const neverReviewedArticles = approvedArticles.filter(article =>
        !article.approvedBy &&
        !article.reviewedBy &&
        !article.validatedBy &&
        !article.lastReviewedAt &&
        !article.reviewedAt
    );

    const hasReport = (article) => {
        return (
            (article.reportCount || 0) > 0 ||
            (Array.isArray(article.reports) && article.reports.length > 0) ||
            article.flagged === true ||
            article._status === 'review'
        );
    };

    const qualityAlertArticles = normalizedArticles.filter(article => {
        const score = (article.useful || (article.likes || []).length || 0) - (article.notUseful || 0);
        return score < 0 || hasReport(article);
    });

    const noCategoryArticles = normalizedArticles.filter(article =>
        (!article.categoryId && !article.category) ||
        article.category === 'Sem categoria'
    );

    const lowAccessArticles = approvedArticles.filter(article => (article.views || 0) < 10);

    const titleCounts = {};
    normalizedArticles.forEach(article => {
        if (!article.title) return;
        const title = article.title.trim().toLowerCase();
        titleCounts[title] = (titleCounts[title] || 0) + 1;
    });

    const duplicateArticles = normalizedArticles.filter(article =>
        article.title &&
        titleCounts[article.title.trim().toLowerCase()] > 1
    );

    const reuseRate = totalViews + normalizedArticles.length > 0
        ? Math.round((totalViews / Math.max(totalViews + normalizedArticles.length, 1)) * 100)
        : 0;

    const healthyArticles = approvedArticles.filter(article => {
        const baseDate = article._lastReviewedAt || article._updatedAt || article._createdAt || now;
        const ageDays = (now - baseDate) / msPerDay;
        return ageDays <= 90 && !hasReport(article) && (article.views || 0) >= 1;
    });

    const healthRate = approvedArticles.length > 0
        ? Math.round((healthyArticles.length / approvedArticles.length) * 100)
        : 0;

    const urgentArticles = normalizedArticles
        .filter(article => {
            const ageDays = Math.floor((now - (article._updatedAt || article._createdAt || now)) / msPerDay);
            const isReported = hasReport(article);
            const isHighViewDraft = article._status === 'draft' && (article.views || 0) > 5;
            const isStagnantDraft = article._status === 'draft' && ageDays > 3;
            const isLongReview = article._status === 'review' && ageDays > 2;
            const isStaleApproved = article._status === 'approved' && ageDays > 90;

            if (!isReported && !isHighViewDraft && !isStagnantDraft && !isLongReview && !isStaleApproved) {
                return false;
            }

            article._ageDays = ageDays;

            let score = 0;

            if (isReported) {
                article._alertReason = 'Reporte de erro';
                article._priority = 'Alta';
                score += 100;
            } else if (isHighViewDraft) {
                article._alertReason = 'Rascunho com alto acesso';
                article._priority = 'Alta';
                score += 80;
            } else if (isLongReview) {
                article._alertReason = 'Revisão parada';
                article._priority = 'Média';
                score += 60 + ageDays;
            } else if (isStaleApproved) {
                article._alertReason = 'Base desatualizada';
                article._priority = 'Média';
                score += 50 + ageDays;
            } else if (isStagnantDraft) {
                article._alertReason = 'Rascunho parado';
                article._priority = 'Baixa';
                score += 20 + ageDays;
            }

            article._criticalityScore = score;
            return true;
        })
        .sort((a, b) => b._criticalityScore - a._criticalityScore)
        .slice(0, 8);

    const agingBuckets = dashboardBuildAgingBuckets(approvedArticles, now, msPerDay);
    const rangeDays = periodStart && periodEnd
        ? Math.max(1, Math.ceil((periodEnd - periodStart) / msPerDay) + 1)
        : 30;
    const timeline = dashboardBuildTimeline(normalizedArticles, Math.min(rangeDays, 90), now, msPerDay, periodStart, periodEnd);
    const funnel = dashboardBuildFunnel(normalizedArticles);

    const sortedByViews = [...approvedArticles]
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 5);

    const topScripts = [...normalizedScripts]
        .sort((a, b) => ((b.likes || []).length || 0) - ((a.likes || []).length || 0))
        .slice(0, 5);

    let finalAnalysts = topAnalysts || [];
    let finalCollaborators = topCollaborators || [];

    if (!finalAnalysts.length && !finalCollaborators.length) {
        const authorStats = {};

        normalizedArticles.forEach(article => {
            const author = article.createdBy || 'Sistema';

            if (!authorStats[author]) {
                authorStats[author] = {
                    name: author,
                    approved: 0,
                    drafts: 0,
                    views: 0,
                    score: 0
                };
            }

            if (article._status === 'approved') {
                authorStats[author].approved++;
            } else {
                authorStats[author].drafts++;
            }

            authorStats[author].views += article.views || 0;
            authorStats[author].score =
                authorStats[author].approved * 10 +
                authorStats[author].drafts * 3 +
                authorStats[author].views;
        });

        const authors = Object.values(authorStats);

        finalAnalysts = authors
            .sort((a, b) => b.approved - a.approved)
            .slice(0, 5);

        finalCollaborators = authors
            .sort((a, b) => b.drafts - a.drafts)
            .slice(0, 5);
    }

    const impactRanking = dashboardBuildImpactRanking(normalizedArticles).slice(0, 5);
    const isValidDashboardActorName = (value) => {
        const name = String(value || '').trim();
        if (!name) return false;
        const normalized = name.toLowerCase();
        return !['sistema', 'system', 'admin', 'undefined', 'null'].includes(normalized);
    };
    const analystNameSet = new Set((topAnalysts || []).map(user =>
        String(user.displayName || user.name || '').trim().toLowerCase()
    ).filter(Boolean));
    const analystApprovals = {};
    approvedArticles.forEach(article => {
        const approvalDate = article._approvedAt;
        if (!approvalDate) return;
        if (periodStart && approvalDate < periodStart) return;
        if (periodEnd && approvalDate > periodEnd) return;
        const approverName = String(article.approvedBy || article.validatedBy || article.reviewedBy || article.updatedBy || '').trim();
        if (!isValidDashboardActorName(approverName)) return;
        const normalizedApprover = approverName.toLowerCase();
        if (!analystApprovals[approverName]) {
            analystApprovals[approverName] = { name: approverName, approvals: 0 };
        }
        analystApprovals[approverName].approvals += 1;
    });
    const topAnalystsByPeriod = Object.values(analystApprovals)
        .sort((a, b) => b.approvals - a.approvals)
        .slice(0, 5);

    const collaboratorSource = normalizedArticles.filter(article => {
        const submittedDate = article._createdAt || dashboardToDate(article.submittedAt) || article._updatedAt;
        return isDateInRange(submittedDate);
    });
    const collaboratorsByPeriod = Object.values(collaboratorSource.reduce((acc, article) => {
        const rawAuthor = article.createdBy || article.author || article.submittedBy || article.createdById || article.authorId || article.submittedById;
        if (!rawAuthor) return acc;
        const name = String(rawAuthor).trim();
        if (!isValidDashboardActorName(name)) return acc;
        if (!acc[name]) acc[name] = { name, drafts: 0 };
        acc[name].drafts += 1;
        return acc;
    }, {})).sort((a, b) => b.drafts - a.drafts).slice(0, 5);

    container.innerHTML = `
       <div class="dash-saas-header-wrapper">
            <div class="dash-saas-header-top">
                <div class="dash-header-titles">
                    <p class="dash-saas-eyebrow">Governança KCS</p>
                    <h2 class="dash-title dash-title-saas">
                        <i class="ph ph-chart-line-up dash-icon-main"></i>
                        Dashboard Executivo
                    </h2>
                </div>

                <div class="dash-period-calendar dashboard-period-control" role="group" aria-label="Filtro de período do dashboard">
                    <label for="dash-period-range">Período</label>
                    <input type="text" id="dash-period-range" class="dash-period-range-input" data-coreui-range="true" placeholder="Selecione um período" aria-label="Selecionar período do dashboard" readonly>
                </div>
            </div>

            <div class="dash-saas-subtitle-row dash-content-row">
                <p class="dash-saas-subtitle">
                    Visão de produção, qualidade, reutilização e gargalos da base de conhecimento.
                </p>
                <span class="dash-inline-access" aria-label="Total de acessos à base"><i class="ph ph-eye"></i> Acessos à base: <strong>${totalKnowledgeAccess}</strong></span>
            </div>
        </div>

        <div class="dash-saas-grid">
        
            ${dashboardMetricCard({
                icon: 'ph-file-plus',
                label: `Criados no período`,
                value: articlesInPeriod.length,
                hint: `${selectedDateRange.start || '--'} até ${selectedDateRange.end || '--'}`,
                tone: 'blue'
            })}

            ${dashboardMetricCard({
                icon: 'ph-seal-check',
                label: `Publicados no período`,
                value: approvedInPeriod.length,
                hint: `${periodApprovalRate}% aprovação`,
                tone: 'green'
            })}

            ${dashboardMetricCard({
                icon: 'ph-git-pull-request',
                label: 'Em revisão / pendentes',
                value: pendingArticles.length,
                hint: `${draftArticles.length} rascunhos`,
                tone: pendingArticles.length > 0 ? 'amber' : 'green'
            })}

            ${dashboardMetricCard({
                icon: 'ph-recycle',
                label: 'Taxa de reutilização',
                value: `${reuseRate}%`,
                hint: 'proxy por acessos',
                tone: 'purple'
            })}

            ${dashboardMetricCard({
                icon: 'ph-clock',
                label: 'Tempo médio até publicação',
                value: `${avgReviewDays}d`,
                hint: `${reviewedCount} itens medidos`,
                tone: avgReviewDays > 5 ? 'amber' : 'blue'
            })}

            ${dashboardMetricCard({
                icon: 'ph-heartbeat',
                label: 'Base saudável',
                value: `${healthRate}%`,
                hint: `${healthyArticles.length}/${approvedArticles.length} aprovados`,
                tone: healthRate < 70 ? 'red' : 'green'
            })}
        </div>

        <div class="dash-saas-section-grid mt-6">
            <div class="dash-widget dash-saas-card dash-wide">
                <div class="widget-header-row">
                    <div>
                        <h3 class="widget-header header-blue">
                            <i class="ph ph-activity"></i>
                            Evolução KCS
                        </h3>
                        <p class="dash-widget-subtitle">Criados x publicados no período selecionado.</p>
                    </div>
                </div>

                <div class="dash-timeline">
                    ${timeline.map(day => {
                        const max = Math.max(...timeline.map(item => Math.max(item.created, item.approved)), 1);
                        const createdHeight = Math.max((day.created / max) * 100, day.created > 0 ? 8 : 0);
                        const approvedHeight = Math.max((day.approved / max) * 100, day.approved > 0 ? 8 : 0);

                        return `
                            <div class="dash-timeline-item" title="${day.label}: ${day.created} criados / ${day.approved} publicados">
                                <div class="dash-timeline-bars">
                                    <span class="dash-bar dash-bar-created" style="height:${createdHeight}%"></span>
                                    <span class="dash-bar dash-bar-approved" style="height:${approvedHeight}%"></span>
                                </div>
                                <div class="dash-timeline-values"><span>${day.created}/${day.approved}</span></div>
                                <span class="dash-timeline-label">${day.shortLabel}</span>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="dash-chart-legend">
                    <span><i class="legend-dot created"></i> Criados</span>
                    <span><i class="legend-dot approved"></i> Publicados</span>
                </div>
            </div>

            <div class="dash-widget dash-saas-card">
                <h3 class="widget-header header-purple">
                    <i class="ph ph-funnel"></i>
                    Funil de Governança
                </h3>
                <p class="dash-widget-subtitle">Distribuição atual por etapa do ciclo KCS.</p>

                <div class="dash-funnel">
                    ${funnel.map(item => `
                        <div class="dash-funnel-row">
                            <div class="dash-funnel-label">
                                <span>${item.label}</span>
                                <strong>${item.value}</strong>
                            </div>
                            <div class="dash-funnel-track">
                                <div class="dash-funnel-fill ${item.tone}" style="width:${item.percent}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <div class="dash-saas-section-grid mt-6">
            <div class="dash-widget dash-saas-card">
                <h3 class="widget-header header-green">
                    <i class="ph ph-shield-check"></i>
                    Saúde da Base
                </h3>
                <p class="dash-widget-subtitle">Idade dos artigos aprovados por última revisão/atualização.</p>

                <div class="dash-aging">
                    ${agingBuckets.map(bucket => `
                        <div class="dash-aging-row">
                            <div class="dash-aging-label">
                                <span>${bucket.label}</span>
                                <strong>${bucket.value}</strong>
                            </div>
                            <div class="dash-aging-track">
                                <div class="dash-aging-fill ${bucket.tone}" style="width:${bucket.percent}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="dash-widget dash-saas-card">
                <h3 class="widget-header header-red">
                    <i class="ph ph-warning-octagon"></i>
                    Alertas de Qualidade
                </h3>
                <p class="dash-widget-subtitle">Itens que exigem saneamento da base.</p>

                <div class="dash-alert-grid">
                    ${dashboardAlertMiniCard('Sem categoria', noCategoryArticles.length, 'ph-folder-notch-minus')}
                    ${dashboardAlertMiniCard('Duplicados', duplicateArticles.length, 'ph-copy')}
                    ${dashboardAlertMiniCard('Baixo acesso', lowAccessArticles.length, 'ph-trend-down')}
                    ${dashboardAlertMiniCard('Desatualizados', outdatedArticles.length, 'ph-calendar-x')}
                    ${dashboardAlertMiniCard('Nunca revisados', neverReviewedArticles.length, 'ph-shield-warning')}
                    ${dashboardAlertMiniCard('Reportados', qualityAlertArticles.length, 'ph-flag')}
                </div>
            </div>
        </div>

        <div class="dash-widget widget-urgent mt-6">
            <div class="widget-header-row">
                <div class="widget-title-group">
                    <h3 class="widget-header header-red">
                        <i class="ph ph-siren"></i>
                        Fila de Revisão Crítica
                    </h3>
                    <button onclick="window.copyTableToClipboard('dash-table-urgents', this)" class="copy-btn" title="Copiar tabela">
                        <i class="ph ph-copy"></i>
                    </button>
                </div>

                <div class="info-box hidden sm:flex">
                    <i class="ph ph-info"></i>
                    <span><strong>Criticidade:</strong> reportes, idade, rascunhos parados e base vencida elevam prioridade.</span>
                </div>
            </div>

            <div class="table-wrapper">
                <table id="dash-table-urgents" class="table-default">
                    <thead>
                        <tr>
                            <th>KCS ID</th>
                            <th>Título do procedimento</th>
                            <th class="col-center">Idade</th>
                            <th class="col-center">Prioridade</th>
                            <th>Gatilho</th>
                            <th class="col-right">Ação</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${urgentArticles.map(article => `
                            <tr class="table-row" onclick="window.__kcs.viewArticle('${article.id}')">
                                <td class="id-cell">#${article.articleNumber || '---'}</td>
                                <td class="title-cell-truncate" title="${escapeHtml(article.title || '')}">
                                    ${escapeHtml(article.title || 'Sem título')}
                                </td>
                                <td class="col-center stat-muted">
                                    <i class="ph ph-clock"></i>
                                    ${article._ageDays || 0}d
                                </td>
                                <td class="col-center">
                                    <span class="${article._priority === 'Alta' ? 'badge-alert' : article._priority === 'Média' ? 'badge-purple' : 'badge-green'}">
                                        ${article._priority}
                                    </span>
                                </td>
                                <td>
                                    <span class="badge-alert">
                                        <i class="ph ph-warning-circle"></i>
                                        ${escapeHtml(article._alertReason || 'Atenção')}
                                    </span>
                                </td>
                                <td class="col-right">
                                    <button class="btn-review">Revisar</button>
                                </td>
                            </tr>
                        `).join('') || `
                            <tr>
                                <td colspan="6" class="empty-cell-success">
                                    <i class="ph ph-check-circle"></i>
                                    Nenhum alerta crítico ativo na base.
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="dash-tables-row mt-6">
            <div class="dash-widget dash-saas-card">
                <h3 class="widget-header header-purple">
                    <i class="ph ph-medal"></i>
                    Ranking de Impacto KCS
                </h3>
                <p class="dash-widget-subtitle">Score combina publicações, acessos e contribuição.</p>

                <div class="table-wrapper">
                    <table class="table-default">
                        <tbody>
                            ${impactRanking.map((user, index) => `
                                <tr class="table-row">
                                    <td class="user-cell">
                                        <div class="rank-number">#${index + 1}</div>
                                        <div class="avatar-mini">${(user.name || '?').charAt(0).toUpperCase()}</div>
                                        <p class="user-name">${escapeHtml(formatFullName(user.name || 'Usuário'))}</p>
                                    </td>
                                    <td class="stat-cell">
                                        <span class="badge-purple">${user.score}</span>
                                    </td>
                                </tr>
                            `).join('') || `
                                <tr>
                                    <td colspan="2" class="empty-cell">Nenhum impacto registrado.</td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="dash-widget dash-saas-card">
                <h3 class="widget-header header-green">
                    <i class="ph ph-hand-heart"></i>
                    Top Colaboradores
                </h3>
                <p class="dash-widget-subtitle">Top 5 usuários com maior envio de procedimentos para a base.</p>

                <div class="table-wrapper">
                    <table class="table-default">
                        <tbody>
                            ${(collaboratorsByPeriod.length ? collaboratorsByPeriod : finalCollaborators)
                            .filter(user => (user.draftsSubmitted || user.drafts || 0) > 0).map((user, index) => `
                                <tr class="table-row">
                                    <td class="user-cell">
                                        <div class="rank-number">#${index + 1}</div>
                                        <div class="avatar-mini">${(user.displayName || user.name || '?').charAt(0).toUpperCase()}</div>
                                        <p class="user-name">${escapeHtml(formatFullName(user.displayName || user.name || 'Usuário'))}</p>
                                    </td>
                                    <td class="stat-cell">
                                        <span class="badge-green">${user.draftsSubmitted || user.drafts || 0}</span>
                                    </td>
                                </tr>
                            `).join('') || `
                                <tr>
                                    <td colspan="2" class="empty-cell">Nenhum envio registrado.</td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="dash-widget dash-saas-card">
                <h3 class="widget-header header-blue">
                    <i class="ph ph-user-check"></i>
                    Top Analistas (aprovações)
                </h3>
                <p class="dash-widget-subtitle">Top 5 analistas que aprovaram procedimentos no período selecionado.</p>
                <div class="table-wrapper">
                    <table class="table-default">
                        <tbody>
                            ${topAnalystsByPeriod.map((user, index) => `
                                <tr class="table-row">
                                    <td class="user-cell">
                                        <div class="rank-number">#${index + 1}</div>
                                        <div class="avatar-mini">${(user.name || '?').charAt(0).toUpperCase()}</div>
                                        <p class="user-name">${escapeHtml(formatFullName(user.name || 'Analista'))}</p>
                                    </td>
                                    <td class="stat-cell">
                                        <span class="badge-blue">${user.approvals || 0}</span>
                                    </td>
                                </tr>
                            `).join('') || `
                                <tr>
                                    <td colspan="2" class="empty-cell">Nenhuma aprovação encontrada neste período.</td>
                  </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="dash-widget dash-saas-card">
                <div class="widget-header-row">
                    <div>
                        <h3 class="widget-header header-blue">
                            <i class="ph ph-trend-up"></i>
                            Top Acessados
                        </h3>
                        <p class="dash-widget-subtitle">Conteúdos com maior reutilização operacional.</p>
                    </div>

                    <button onclick="window.copyTableToClipboard('dash-table-views', this)" class="copy-btn" title="Copiar tabela">
                        <i class="ph ph-copy"></i>
                    </button>
                </div>

                <div class="table-wrapper">
                    <table id="dash-table-views" class="table-default">
                        <thead>
                            <tr>
                                <th>Título</th>
                                <th>Autor</th>
                                <th class="col-right">Views</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedByViews.filter(article => (article.views || 0) > 0).map((article, index) => {
                                const authorName = formatFullName(article.createdBy || 'Sistema');

                                return `
                                    <tr class="table-row" onclick="window.__kcs.viewArticle('${article.id}')">
                                        <td class="title-cell-truncate" title="${escapeHtml(article.title || '')}">
                                            <span class="rank-muted">${index + 1}.</span>
                                            <span class="truncate-text">${escapeHtml(article.title || 'Sem título')}</span>
                                        </td>
                                        <td>
                                            <div class="user-badge">
                                                <div class="avatar-mini">${authorName.charAt(0).toUpperCase()}</div>
                                                <span class="user-name">${escapeHtml(authorName)}</span>
                                            </div>
                                        </td>
                                        <td class="col-right">
                                            <span class="badge-neutral">${article.views || 0}</span>
                                        </td>
                                    </tr>
                                `;
                            }).join('') || `
                                <tr>
                                    <td colspan="3" class="empty-cell">Nenhum acesso registrado.</td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>

            ${normalizedScripts.length > 0 ? `
                <div class="dash-widget dash-saas-card" style="grid-column: 1 / -1;">
                    <div class="widget-header-row">
                        <div>
                            <h3 class="widget-header header-purple">
                                <i class="ph ph-database"></i>
                                Scripts Úteis
                            </h3>
                            <p class="dash-widget-subtitle">SQLs mais curtidos pela operação.</p>
                        </div>

                        <button onclick="window.copyTableToClipboard('dash-table-sql', this)" class="copy-btn" title="Copiar tabela">
                            <i class="ph ph-copy"></i>
                        </button>
                    </div>

                    <div class="table-wrapper">
                        <table id="dash-table-sql" class="table-default">
                            <thead>
                                <tr>
                                    <th>Nome do script</th>
                                    <th>Autor</th>
                                    <th class="col-right">Útil</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${topScripts.filter(script => (script.likes || []).length > 0).map((script, index) => {
                                    const authorName = formatFullName(script.createdBy || 'Sistema');

                                    return `
                                        <tr class="table-row" onclick="window.__kcs.viewSqlScript('${script.id}')">
                                            <td class="title-cell-truncate" title="${escapeHtml(script.name || '')}">
                                                <span class="rank-muted">${index + 1}.</span>
                                                <span class="truncate-text">${escapeHtml(script.name || 'Sem nome')}</span>
                                            </td>
                                            <td>
                                                <div class="user-badge">
                                                    <div class="avatar-mini">${authorName.charAt(0).toUpperCase()}</div>
                                                    <span class="user-name">${escapeHtml(authorName)}</span>
                                                </div>
                                            </td>
                                            <td class="col-right">
                                                <span class="stat-highlight">
                                                    <i class="ph ph-heart"></i>
                                                    ${(script.likes || []).length}
                                                </span>
                                            </td>
                                        </tr>
                                    `;
                                }).join('') || `
                                    <tr>
                                        <td colspan="3" class="empty-cell">Nenhum script útil registrado.</td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : `
                <div class="dash-widget dash-saas-card" style="grid-column: 1 / -1;">
                    <h3 class="widget-header header-purple">
                        <i class="ph ph-lock-key"></i>
                        Biblioteca SQL
                    </h3>
                    <p class="dash-widget-subtitle">Funcionalidade indisponível ou sem dados para este setor.</p>
                    <div class="empty-cell" style="padding: 2rem;">
                        Nenhum dado SQL disponível.
                    </div>
                </div>
            `}
        </div>

        <style>
           .dash-saas-header-wrapper {
                display: flex;
                flex-direction: column;
                gap: 0 !important; /* Matamos o gap duplo aqui */
                margin-bottom: 1.5rem;
                /* Removemos o padding-bottom daqui para não interferir */
            }

            .dash-saas-header-top {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 1rem;
                flex-wrap: wrap;
                width: 100%;
                
                border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
                padding-bottom: 14px !important; /* Respiro exato ACIMA da linha */
                margin-bottom: 10px !important;  /* Respiro exato e mais curto ABAIXO da linha */
            }

            /* 2. Aproximando o Eyebrow do Título principal */
            .dash-header-titles {
                display: flex;
                flex-direction: column;
                gap: 0; /* Removemos o gap para controlar na margem */
            }

            .dash-saas-subtitle-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: .7rem 1rem;
                flex-wrap: wrap;
                width: 100%; /* Garante que ocupe 100% da tela */
            }

           .dash-saas-eyebrow {
                color: var(--color-focus, #3b82f6);
                font-size: 10px; /* Menor e mais delicado */
                font-weight: 700;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                margin-bottom: 2px; /* Bem colado ao título */
                opacity: 0.9;
            }

           /* 3. Refinando o Título e o Ícone */
            .dash-title-saas {
                font-size: 18px !important; /* Tamanho exato */
                font-weight: 800 !important;
                margin: 0 !important;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .dash-saas-subtitle-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: .7rem 1rem;
                flex-wrap: wrap;
            }

            dash-title-saas i {
                font-size: 20px; /* Ícone levemente menor para não gritar */
                color: var(--color-text-secondary); /* Ícone mais neutro dá um ar sofisticado */
            }


           /* 4. Subtítulo levemente mais legível */
            .dash-saas-subtitle {
                color: var(--color-text-secondary, #9ca3af);
                font-size: 13px;
                line-height: 1.4;
                margin: 0;
            }

            .dash-header-content {
                display: flex;
                flex: 1 1 auto;
                min-width: 0;
                flex-direction: column;
                gap: .2rem;
            }
            .dash-inline-access {
                color: #cbd5e1;
                font-size: .76rem;
                display: inline-flex;
                align-items: center;
                justify-content: flex-end;
                gap: .4rem;
                white-space: nowrap;
                margin-left: auto;
                flex-shrink: 0;
                text-align: right;
            }
            .dash-inline-access strong {
                color: #f8fafc;
            }
            .dash-inline-access i {
                color: #93c5fd;
                font-size: 15px;
            }
 .dash-period-calendar {
                display: flex;
                flex-direction: column;
                align-items: stretch;
                justify-content: center;
                gap: 4px;
                margin-left: auto;
                min-width: 220px;
                max-width: 256px;
                width: min(24vw, 256px);
                position: relative;
            }
            .dash-period-calendar label {
                font-size: 11px;
                color: var(--color-text-secondary);
                font-weight: 600;
                margin-bottom: 2px;
                line-height: 1;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            .dash-period-calendar input {
                height: 28px;
                font-size: 12px;
                font-family: var(--font-family-base);
                background-color: var(--color-editor-background) !important;
                border: 1px solid var(--color-border) !important;
                border-radius: var(--border-radius-sm) !important;
                color: var(--color-text-primary) !important;
                width: 100%;
                padding: 0 10px;
                box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);
                cursor: pointer;
                transition: border-color 0.15s ease;
            }
            .dash-period-calendar input:focus, .dash-period-calendar input.active {
                outline: none;
                border-color: var(--color-focus) !important;
                box-shadow: 0 0 0 1px var(--color-focus) !important;
            }

.flatpickr-calendar {
    font-family: var(--font-family-base);
    background: #0f172a;
    border: 1px solid rgba(100, 116, 139, 0.2);
    color: #cbd5e1;
    box-shadow: 0 6px 14px rgba(2, 6, 23, 0.24);
    border-radius: 7px;
    padding: 8px;
    max-width: 280px;
    transform: scale(0.88);
    transform-origin: top right;
    z-index: 70;
    right: 0 !important;
    left: auto !important;
    margin-top: 4px;
}

.flatpickr-calendar.arrowTop:before,
.flatpickr-calendar.arrowTop:after {
    left: auto !important;
    right: 20px !important;
}

    padding: 8px;  /* aumentar padding interno */
    max-width: 280px;  /* adicionar limite de largura */
    transform: scale(0.85);  /* reduzir escala geral */
    transform-origin: top right;
}

.flatpickr-days {
    padding: 0 4px 4px;
}

.flatpickr-day {
    color: #cbd5e1;
    border-radius: 4px;
    width: 28px;
    height: 28px;
    line-height: 28px;
    font-size: 11px;
    font-weight: 400;
}
    
.flatpickr-day.selected,
.flatpickr-day.selected:hover,
.flatpickr-day.startRange,
.flatpickr-day.endRange {
    background: rgba(71, 85, 105, 0.32);
    border-color: rgba(71, 85, 105, 0.28);
    color: #f1f5f9;
}           

.flatpickr-day.inRange {
    background: rgba(71, 85, 105, 0.16);
    border-color: transparent;
    box-shadow: none;
}

.flatpickr-day:hover {
    background: rgba(71, 85, 105, 0.18);
}

            .flatpickr-months {
    background: transparent;
    margin-bottom: 4px;
    padding: 4px 8px 0;
}
       .flatpickr-monthDropdown-months,
.numInputWrapper .numInput {
    color: #d4dbe7;
}

.flatpickr-weekday {
    color: #64748b;
    font-size: 9px;
    font-weight: 500;
    padding-bottom: 2px;
}
            
   .flatpickr-month {
    height: 24px;
}

.flatpickr-current-month .flatpickr-monthDropdown-months,
.flatpickr-current-month input.cur-year {
    font-weight: 700;
}

    .flatpickr-prev-month,
.flatpickr-next-month {
    padding: 4px 6px;
    color: #64748b !important;
    fill: #64748b !important;
}

.flatpickr-prev-month:hover,
.flatpickr-next-month:hover {
    color: #94a3b8 !important;
    fill: #94a3b8 !important;
    background: rgba(100, 116, 139, 0.12);
    border-radius: 4px;
}

            .flatpickr-calendar.rightMost:before,
            .flatpickr-calendar.arrowRight:before,
            .flatpickr-calendar.rightMost:after,
            .flatpickr-calendar.arrowRight:after {
                left: auto;
                right: 12px;
            }
            .flatpickr-current-month .flatpickr-monthDropdown-months,
            .flatpickr-current-month input.cur-year {
                font-weight: 700;
            }

            .dash-saas-grid {
                display: grid;
                grid-template-columns: repeat(6, minmax(0, 1fr));
                gap: .9rem;
            }

            .dash-saas-metric {
                position: relative;
                overflow: hidden;
                background: rgba(255,255,255,.04);
                border: 1px solid rgba(255,255,255,.08);
                border-radius: .9rem;
                padding: 1rem;
                min-height: 118px;
            }

            .dash-saas-metric::after {
                content: "";
                position: absolute;
                inset: auto -30px -45px auto;
                width: 110px;
                height: 110px;
                border-radius: 999px;
                background: rgba(0,122,204,.12);
                filter: blur(18px);
            }

            .dash-metric-top {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: .75rem;
                margin-bottom: 1rem;
            }

            .dash-metric-icon {
                display: grid;
                place-items: center;
                width: 34px;
                height: 34px;
                border-radius: .7rem;
                background: rgba(255,255,255,.06);
                border: 1px solid rgba(255,255,255,.08);
            }

            .dash-metric-icon i {
                font-size: 1.05rem;
            }

            .dash-metric-icon.blue i { color: #60a5fa; }
            .dash-metric-icon.green i { color: #10b981; }
            .dash-metric-icon.purple i { color: #8b5cf6; }
            .dash-metric-icon.amber i { color: #f59e0b; }
            .dash-metric-icon.red i { color: #ef4444; }

            .dash-metric-label {
                color: #9ca3af;
                font-size: .72rem;
                text-transform: uppercase;
                letter-spacing: .04em;
                margin: 0;
            }

            .dash-metric-value {
                color: #f9fafb;
                font-size: 1.65rem;
                font-weight: 900;
                margin: 0;
                line-height: 1;
            }

            .dash-metric-hint {
                color: #6b7280;
                font-size: .72rem;
                margin-top: .45rem;
            }

            .dash-saas-section-grid {
                display: grid;
                grid-template-columns: 1.4fr .9fr;
                gap: .9rem;
            }

            .dash-saas-card {
                background: rgba(255,255,255,.035);
                border: 1px solid rgba(255,255,255,.08);
                border-radius: .9rem;
                padding: 1rem;
            }

            .dash-wide {
                min-height: 300px;
            }

            .dash-widget-subtitle {
                color: #8b949e;
                font-size: .76rem;
                margin: .15rem 0 .9rem;
            }

             .dash-timeline {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(14px, 1fr);
    align-items: end;
    gap: .28rem;
    width: 100%;
    max-width: 100%;
    height: 190px;
    padding: 1rem .25rem .2rem;
    border-radius: .75rem;
    background:
        linear-gradient(to top, rgba(255,255,255,.05) 1px, transparent 1px);
    background-size: 100% 38px;
    overflow-x: auto;
    overflow-y: hidden;
    contain: layout paint;
}

.dash-timeline-item {
    min-width: 14px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: end;
    align-items: center;
    gap: .4rem;
}            
    
.dash-widget {
    min-width: 0;
}

.dash-saas-section-grid > * {
    min-width: 0;
}

           

            .dash-timeline-bars {
                width: 100%;
                height: 150px;
                display: flex;
                justify-content: center;
                align-items: end;
                gap: 3px;
            }

            .dash-bar {
                display: block;
                width: 7px;
                min-height: 0;
                border-radius: 999px 999px 0 0;
            }

            .dash-bar-created {
                background: #3b82f6;
            }

            .dash-bar-approved {
                background: #10b981;
            }

            .dash-timeline-label {
                color: #6b7280;
                font-size: .62rem;
                white-space: nowrap;
            }
            .dash-timeline-values {
                display: flex;
                align-items: center;
                font-size: .61rem;
                line-height: 1.05;
                color: #9ca3af;
            }

            .dash-chart-legend {
                display: flex;
                align-items: center;
                gap: 1rem;
                margin-top: .75rem;
                color: #9ca3af;
                font-size: .74rem;
            }

            .legend-dot {
                display: inline-block;
                width: .55rem;
                height: .55rem;
                border-radius: 999px;
                margin-right: .3rem;
            }

            .legend-dot.created { background: #3b82f6; }
            .legend-dot.approved { background: #10b981; }

            .dash-funnel,
            .dash-aging {
                display: grid;
                gap: .85rem;
            }

            .dash-funnel-label,
            .dash-aging-label {
                display: flex;
                justify-content: space-between;
                color: #cbd5e1;
                font-size: .78rem;
                margin-bottom: .35rem;
            }

            .dash-funnel-label strong,
            .dash-aging-label strong {
                color: #fff;
            }

            .dash-funnel-track,
            .dash-aging-track {
                height: .55rem;
                background: rgba(255,255,255,.07);
                border-radius: 999px;
                overflow: hidden;
            }

            .dash-funnel-fill,
            .dash-aging-fill {
                height: 100%;
                border-radius: inherit;
            }

            .dash-funnel-fill.blue,
            .dash-aging-fill.blue { background: #3b82f6; }

            .dash-funnel-fill.amber,
            .dash-aging-fill.amber { background: #f59e0b; }

            .dash-funnel-fill.green,
            .dash-aging-fill.green { background: #10b981; }

            .dash-funnel-fill.red,
            .dash-aging-fill.red { background: #ef4444; }

            .dash-alert-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: .75rem;
            }

            .dash-alert-mini {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: .75rem;
                padding: .8rem;
                border-radius: .75rem;
                background: rgba(255,255,255,.035);
                border: 1px solid rgba(255,255,255,.07);
            }

            .dash-alert-mini-left {
                display: flex;
                align-items: center;
                gap: .55rem;
                color: #9ca3af;
                font-size: .75rem;
            }

            .dash-alert-mini-left i {
                color: #f87171;
            }

            .dash-alert-mini-value {
                color: #fff;
                font-weight: 900;
            }

            @media (max-width: 1280px) {
                .dash-saas-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }

                .dash-saas-section-grid {
                    grid-template-columns: 1fr;
                }
            }

            @media (max-width: 768px) {
                .dash-saas-header-top {
                    flex-direction: column;
                }

                .dash-saas-subtitle-row {
                    align-items: flex-start;
                }

                .dash-period-calendar {
                    width: 100%;
                    margin-left: 0;
                }
                .dash-inline-access {
                    margin-left: 0;
                }

                .dash-saas-grid {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }

                .dash-alert-grid {
                    grid-template-columns: 1fr;
                }
            }
            @media (max-width: 560px) {
                .dash-saas-grid {
                    grid-template-columns: 1fr;
                }
                .dash-period-calendar input {
                    min-width: 100%;
                    width: 100%;
                }
                .dash-inline-access {
                    white-space: normal;
                    width: 100%;
                    justify-content: flex-start;
                }
            }
        </style>
    `;

    dashboardInitFlatpickrRange(selectedDateRange);
}

function buildDashboardRangePickerConfig(defaultDate) {
    return {
        mode: 'range',
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'd/m/Y',
        allowInput: false,
        showMonths: 1,
        inline: false,
        monthSelectorType: 'static',
        position: 'auto right',
        defaultDate,
        locale: {
            firstDayOfWeek: 1,
            rangeSeparator: ' até '
        },
        onClose: (selectedDates) => {
            if (!selectedDates || selectedDates.length < 2) return;
            const toIso = (d) => d.toISOString().slice(0, 10);
            window.__kcsSetDashboardDateRange(toIso(selectedDates[0]), toIso(selectedDates[1]));
        }
    };
}

function dashboardInitFlatpickrRange(selectedDateRange) {
    const input = document.getElementById('dash-period-range');
    if (!input) return;

    const applyPicker = () => {
        if (!window.flatpickr) return;
        const defaultDate = selectedDateRange.start && selectedDateRange.end
            ? [selectedDateRange.start, selectedDateRange.end]
            : null;
        if (input._flatpickr) {
            input._flatpickr.destroy();
        }

        window.flatpickr(input, buildDashboardRangePickerConfig(defaultDate));
    };

    if (!document.getElementById('flatpickr-lib-css')) {
        const link = document.createElement('link');
        link.id = 'flatpickr-lib-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
        document.head.appendChild(link);
    }

    if (!document.getElementById('flatpickr-lib-js')) {
        const script = document.createElement('script');
        script.id = 'flatpickr-lib-js';
        script.src = 'https://cdn.jsdelivr.net/npm/flatpickr';
        script.onload = applyPicker;
        document.head.appendChild(script);
    } else {
        applyPicker();
    }
}

function dashboardToDate(value) {
    if (!value) return null;

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value?.toDate === 'function') {
        const date = value.toDate();
        return Number.isNaN(date.getTime()) ? null : date;
    }

    if (typeof value === 'object' && typeof value.seconds === 'number') {
        const date = new Date(value.seconds * 1000);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function dashboardNormalizeStatus(status) {
    const normalized = String(status || '').toLowerCase();

    if (normalized === 'approved' || normalized === 'publicado' || normalized === 'published') {
        return 'approved';
    }

    if (
        normalized === 'review' ||
        normalized === 'pending' ||
        normalized === 'pendente' ||
        normalized === 'pendente_revisao' ||
        normalized === 'in_review'
    ) {
        return 'review';
    }

    return 'draft';
}

function dashboardIsInPeriod(date, periodStart) {
    if (!periodStart) return true;
    if (!date) return false;

    return date >= periodStart;
}

function dashboardMetricCard({ icon, label, value, hint, tone = 'blue' }) {
    return `
        <div class="dash-saas-metric">
            <div class="dash-metric-top">
                <p class="dash-metric-label">${escapeHtml(label)}</p>
                <div class="dash-metric-icon ${tone}">
                    <i class="ph ${icon}"></i>
                </div>
            </div>
            <p class="dash-metric-value">${value}</p>
            <div class="dash-metric-hint">${escapeHtml(hint || '')}</div>
        </div>
    `;
}

function dashboardAlertMiniCard(label, value, icon) {
    return `
        <div class="dash-alert-mini">
            <div class="dash-alert-mini-left">
                <i class="ph ${icon}"></i>
                <span>${escapeHtml(label)}</span>
            </div>
            <strong class="dash-alert-mini-value">${value}</strong>
        </div>
    `;
}

function dashboardBuildFunnel(articles) {
    const total = Math.max(articles.length, 1);

    const draft = articles.filter(article => article._status === 'draft').length;
    const review = articles.filter(article => article._status === 'review').length;
    const approved = articles.filter(article => article._status === 'approved').length;

    return [
        {
            label: 'Rascunhos',
            value: draft,
            percent: Math.round((draft / total) * 100),
            tone: 'amber'
        },
        {
            label: 'Em revisão',
            value: review,
            percent: Math.round((review / total) * 100),
            tone: 'blue'
        },
        {
            label: 'Publicados',
            value: approved,
            percent: Math.round((approved / total) * 100),
            tone: 'green'
        }
    ];
}

function dashboardBuildAgingBuckets(approvedArticles, now, msPerDay) {
    const total = Math.max(approvedArticles.length, 1);

    const buckets = [
        { label: '0–30 dias', value: 0, tone: 'green' },
        { label: '31–60 dias', value: 0, tone: 'blue' },
        { label: '61–90 dias', value: 0, tone: 'amber' },
        { label: '+90 dias', value: 0, tone: 'red' }
    ];

    approvedArticles.forEach(article => {
        const baseDate = article._lastReviewedAt || article._updatedAt || article._createdAt || now;
        const ageDays = Math.floor((now - baseDate) / msPerDay);

        if (ageDays <= 30) {
            buckets[0].value++;
        } else if (ageDays <= 60) {
            buckets[1].value++;
        } else if (ageDays <= 90) {
            buckets[2].value++;
        } else {
            buckets[3].value++;
        }
    });

    return buckets.map(bucket => ({
        ...bucket,
        percent: Math.round((bucket.value / total) * 100)
    }));
}

function dashboardBuildTimeline(articles, daysInput, now, msPerDay, startDate = null, endDate = null) {
    const days = Math.max(1, Number(daysInput) || 30);
    const timeline = [];

    for (let index = days - 1; index >= 0; index--) {
        const anchor = endDate || now;
        const date = new Date(anchor.getTime() - index * msPerDay);
        if (startDate && date < new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())) continue;
        const key = date.toISOString().slice(0, 10);

        timeline.push({
            key,
            label: date.toLocaleDateString('pt-BR'),
            shortLabel: date.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit'
            }),
            created: 0,
            approved: 0
        });
    }

    const timelineMap = Object.fromEntries(timeline.map(item => [item.key, item]));

    articles.forEach(article => {
        if (article._createdAt) {
            const createdKey = article._createdAt.toISOString().slice(0, 10);
            if (timelineMap[createdKey]) {
                timelineMap[createdKey].created++;
            }
        }

        if (article._status === 'approved' && article._approvedAt) {
            const approvedKey = article._approvedAt.toISOString().slice(0, 10);
            if (timelineMap[approvedKey]) {
                timelineMap[approvedKey].approved++;
            }
        }
    });

    return timeline;
}

function dashboardBuildImpactRanking(articles) {
    const stats = {};

    articles.forEach(article => {
        const author = article.createdBy || 'Sistema';

        if (!stats[author]) {
            stats[author] = {
                name: author,
                approved: 0,
                drafts: 0,
                views: 0,
                score: 0
            };
        }

        if (article._status === 'approved') {
            stats[author].approved++;
        } else {
            stats[author].drafts++;
        }

        stats[author].views += article.views || 0;

        stats[author].score =
            stats[author].approved * 10 +
            stats[author].drafts * 3 +
            stats[author].views;
    });

    return Object.values(stats)
        .sort((a, b) => b.score - a.score);
}

export function toggleLoginScreen(show) {
  const body = document.body;
  if (!body) return;

  body.classList.remove('auth-checking', 'auth-authenticated', 'auth-unauthenticated');
  body.classList.add(show ? 'auth-unauthenticated' : 'auth-authenticated');

  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app-screen');

  if (show) {
    loginScreen?.removeAttribute('aria-hidden');
    loginScreen?.removeAttribute('inert');
    appScreen?.setAttribute('aria-hidden', 'true');
    appScreen?.setAttribute('inert', '');
  } else {
    appScreen?.removeAttribute('aria-hidden');
    appScreen?.removeAttribute('inert');
    loginScreen?.setAttribute('aria-hidden', 'true');
    loginScreen?.setAttribute('inert', '');
  }
}

export function showToast(message, type = 'info') {
  if (typeof window !== 'undefined' && window.__APP_BOOTING__ === true) return;

  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const iconMap = { success: 'ph-check-circle', error: 'ph-warning-circle', info: 'ph-info', warning: 'ph-warning' };
  
  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type} animate-slide-in`;
  toast.innerHTML = `<i class="ph ${iconMap[type] || iconMap.info} toast-icon"></i><span>${escapeHtml(message)}</span>`;
  
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('animate-slide-out'); setTimeout(() => toast.remove(), 300); }, 3500);
}

export function showLoading(show, message = 'Processando...') {
    try {
        const booting = typeof window !== 'undefined' && (window.__APP_BOOTING__ === true || window.__AUTH_CHECKING__ === true);
        if (booting) {
            console.debug('[showLoading suppressed during boot/auth]', message);
            if (!show) {
                const oldLoader = document.getElementById('loading-overlay');
                if (oldLoader) oldLoader.classList.add('hidden');
                const existingTopBar = document.getElementById('kcs-top-loader');
                if (existingTopBar) {
                    existingTopBar.style.display = 'none';
                    existingTopBar.style.opacity = '0';
                    existingTopBar.style.width = '0%';
                }
            }
            return;
        }

        const oldLoader = document.getElementById('loading-overlay');
        if (oldLoader) oldLoader.classList.add('hidden');
        
        let topBar = document.getElementById('kcs-top-loader');
        if (!topBar) {
            topBar = document.createElement('div');
            topBar.id = 'kcs-top-loader';
            topBar.className = 'loading-bar';
            topBar.style.width = '0%';
            
            const overlayRoot = document.getElementById('overlay-root');
            if (overlayRoot) {
                overlayRoot.appendChild(topBar);
            }
        }
        
        if (show) {
            topBar.style.display = 'block';
            topBar.style.opacity = '1';
            topBar.style.width = '15%';
            setTimeout(() => { if (topBar.style.opacity === '1') topBar.style.width = '65%'; }, 100);
            setTimeout(() => { if (topBar.style.opacity === '1') topBar.style.width = '85%'; }, 2000);
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
    } catch (error) {
        console.warn('[showLoading] suppressed error:', error);
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
        let html = '<div class="content-steps">';
        content.forEach(step => {
            html += `<div class="step-item">`;
            html += `<div class="step-number">${step.stepNumber}</div>`;
            html += `<div class="step-desc">`;
            if (step.description) {
                html += `<div class="step-text">${escapeHtml(step.description).replace(/\n/g, '<br>')}</div>`;
            }
            if (step.images && step.images.length > 0) {
                html += `<div class="step-images">` + 
                    step.images.map(url => `<img src="${url}" class="image-preview">`).join('') 
                + `</div>`;
            }
            html += `</div></div>`;
        });
        html += '</div>';
        return html;
    }

    return content;
}

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

    let label = 'STARTER';
    if (limit >= 9999 || planName.includes('enterprise') || planName === 'gold') label = 'UNLIMITED';
    else if (limit > 5 || planName === 'prata' || planName.includes('teams')) label = 'TEAMS';

    const htmlBadge = `<div class="kcs-plan-badge badge-${label.toLowerCase()}">${label}</div>`;

    if (badgeContainer) badgeContainer.innerHTML = htmlBadge;
    if (badgeContainerMobile) badgeContainerMobile.innerHTML = htmlBadge;
}

export function formatFullName(nameStr) {
    if (!nameStr) return 'Sistema';
    const parts = nameStr.trim().split(' ');
    if (parts.length > 1) {
        return `${parts[0]} ${parts[parts.length - 1]}`; 
    }
    return parts[0];
}

// ==========================================
// OVERLAY & DOCK SYNCHRONIZATION (VISUAL RENDER)
// ==========================================

export function updateOverlayState() {
    const overlayRoot = document.getElementById('overlay-root');
    if (!overlayRoot) return;
    
    const hasActiveModals = overlayRoot.querySelectorAll('.kcs-active-overlay').length > 0;
    if (hasActiveModals) {
        overlayRoot.classList.add('overlay-visible');
    } else {
        overlayRoot.classList.remove('overlay-visible');
    }
}

export function updateDockState() {
    const dockRoot = document.getElementById('kcs-dock');
    if (!dockRoot) return;
    
    const hasTabs = dockRoot.querySelectorAll('.kcs-minimized-tab').length > 0;
    if (hasTabs) {
        dockRoot.classList.add('dock-visible');
    } else {
        dockRoot.classList.remove('dock-visible');
    }
}

export function mountModalToOverlay(modalNode) {
    const overlayRoot = document.getElementById('overlay-root');
    if (!overlayRoot || !modalNode) {
        console.warn('overlay-root ou modalNode não encontrado');
        return;
    }

    if (!overlayRoot.contains(modalNode)) {
        overlayRoot.appendChild(modalNode);
    }
    
    modalNode.classList.remove('hidden', 'kcs-minimized');
    modalNode.classList.add('kcs-active-overlay');
    
    updateOverlayState();
}

export function renderMinimizedTab(modalId, title, onRestore, onClose) {
    const dockRoot = document.getElementById('kcs-dock');
    if (!dockRoot) {
        console.warn('kcs-dock não encontrado');
        return;
    }

    if (dockRoot.querySelector(`.kcs-minimized-tab[data-modal="${modalId}"]`)) return;

    const tabNode = document.createElement('div');
    tabNode.className = 'kcs-minimized-tab dock-tab';
    tabNode.dataset.modal = modalId;

    tabNode.innerHTML = `
        <span class="dock-tab-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
        <div class="dock-tab-actions">
            <button type="button" class="btn-restore" title="Restaurar">⤢</button>
            <button type="button" class="btn-close" title="Fechar">✕</button>
        </div>
    `;

    tabNode.addEventListener('click', (e) => {
        if (!e.target.closest('button') && onRestore) onRestore(modalId);
    });

    tabNode.querySelector('.btn-restore').addEventListener('click', (e) => {
        e.stopPropagation();
        if (onRestore) onRestore(modalId);
    });

    tabNode.querySelector('.btn-close').addEventListener('click', (e) => {
        e.stopPropagation();
        if (onClose) onClose(modalId);
    });

    dockRoot.appendChild(tabNode);
    updateDockState();
}

export function removeModalElements(modalId) {
    const modalNode = document.getElementById(modalId);
    if (modalNode) {
        modalNode.remove();
    }

    const dockRoot = document.getElementById('kcs-dock');
    if (dockRoot) {
        const tabNode = dockRoot.querySelector(`.kcs-minimized-tab[data-modal="${modalId}"]`);
        if (tabNode) tabNode.remove();
    }

    updateOverlayState();
    updateDockState();
}

