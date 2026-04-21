/**
 * ui/render.js — Renderização da Interface
 * Refatorado para Arquitetura Semântica Baseada no Design System e Sincronismo de Overlay/Dock
 */

import { STATUS_LABELS, STATUS_COLORS, ARTICLE_STATUS } from '../config.js';
import { getCurrentUser, hasPermission, hasRole } from '../auth.js';
import { getCategoryName } from '../services/categories.js';

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

    const btnAdminPanel = document.getElementById('btn-admin-panel');
    if (btnAdminPanel) {
        if (user.role === 'super_admin') {
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

export function renderArticleGrid(articles, paginationConfig = null) {
    const container = document.getElementById('articles-grid');
    if (!container) return;

    const currentViewMode = localStorage.getItem('kcs_view_mode') || 'grid';

    // Extrai autores únicos para o filtro (ignorando vazios/nulos)
    const uniqueAuthors = [...new Set(articles.map(a => a.createdBy).filter(Boolean))].sort();

    // NOVO CABEÇALHO: Inclui o Título, Filtros (Dropdowns) e os Botões (Cards/Tabela)
    let html = `
        <div class="view-header" style="flex-wrap: wrap; gap: 16px;">
            <h2 class="view-title">
                <i class="ph ph-files"></i> PROCEDIMENTOS
            </h2>
            
            <div style="display: flex; align-items: center; gap: 12px; margin-left: auto;">
                
                <div style="display: flex; gap: 8px; border-right: 1px solid var(--color-border-subtle); padding-right: 12px;">
                    <select id="grid-filter-author" class="vscode-select hidden sm:block">
                        <option value="all">Todos os Autores</option>
                        ${uniqueAuthors.map(author => `<option value="${escapeHtml(author)}">${escapeHtml(author)}</option>`).join('')}
                    </select>
                    
                    <select id="grid-filter-status" class="vscode-select hidden sm:block">
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

    if (!articles || articles.length === 0) {
        container.innerHTML = html + `<div class="empty-state"><i class="ph ph-folder-open empty-icon"></i><p>Nenhum procedimento encontrado</p></div>`; 
        return;
    }

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
                    Mostrando <strong>${articles.length}</strong> de <strong>${paginationConfig.totalItems}</strong> procedimentos &mdash; Página ${paginationConfig.currentPage} de ${paginationConfig.totalPages}
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

    container.innerHTML = html;
    
    // --- LIGAÇÃO DOS EVENTOS DE FILTRO ---
    // Após injetar o HTML, conectamos a função que vai recarregar a lista quando o usuário mudar a opção
    setTimeout(() => {
        const authorFilter = document.getElementById('grid-filter-author');
        const statusFilter = document.getElementById('grid-filter-status');
        
        if (authorFilter && window.__kcs.applyGridFilters) {
            // Mantém a seleção atual caso já exista filtro aplicado
            if (window.__kcs.currentGridAuthor) authorFilter.value = window.__kcs.currentGridAuthor;
            authorFilter.addEventListener('change', (e) => window.__kcs.applyGridFilters('author', e.target.value));
        }
        
        if (statusFilter && window.__kcs.applyGridFilters) {
            if (window.__kcs.currentGridStatus) statusFilter.value = window.__kcs.currentGridStatus;
            statusFilter.addEventListener('change', (e) => window.__kcs.applyGridFilters('status', e.target.value));
        }
    }, 50);
}

function renderArticleTable(articles) {
    const canEdit = hasPermission('edit_article');
    const canDelete = hasPermission('delete_article');

    let tableHtml = `
    <div class="table-wrapper">
        <table class="table-default">
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
function renderArticleCard(article) {
  const categoryDisplayName = getCategoryName(article.categoryId || article.category);
  const stepsPreviewText = Array.isArray(article.steps) ? article.steps.map(s => s.description).join(' ') : article.steps;
  const previewText = truncate(stripHtml(article.symptom || article.body || stepsPreviewText || ''), 120);
  
  // Tag do ID KCS
  const kcsNumHtml = article.articleNumber ? `<span class="bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 text-[10px] font-mono font-bold px-2 py-0.5 rounded">#KCS-${article.articleNumber}</span>` : '<span></span>';

  // Interações e Favoritos
  const user = getCurrentUser();
  const userId = user?.uid || user?.id;
  const isFav = (article.favorites || []).includes(userId);
  const starClass = isFav ? 'ph-fill ph-star text-yellow-500' : 'ph ph-star text-gray-400 hover:text-yellow-500';
  const isLiked = (article.likes || []).includes(userId);
  const heartClass = isLiked ? 'ph-fill ph-heart text-red-500' : 'ph ph-heart text-gray-400 hover:text-red-500';

  const authorFullName = formatFullName(article.createdBy);
  
  // Lógica inteligente de cor do Status
  let statusBadge = '';
  if (article.status === 'approved') statusBadge = '<span class="badge-green text-[9px]">APROVADO</span>';
  else if (article.status === 'pendente_revisao' || article.status === 'review') statusBadge = '<span class="badge-alert text-[9px] text-orange-500 bg-orange-500/10">EM REVISÃO</span>';
  else statusBadge = '<span class="badge-neutral text-[9px] border border-gray-600">RASCUNHO</span>';

  return `
    <div class="bg-white dark:bg-surface border border-gray-200 dark:border-border-subtle rounded-xl p-4 flex flex-col gap-3 hover:border-blue-500/50 hover:shadow-md transition-all cursor-pointer relative group" onclick="window.__kcs.viewArticle('${article.id}')">
        
        <div class="flex justify-between items-start">
            ${kcsNumHtml}
            ${statusBadge}
        </div>
        
        <div>
            <h3 class="text-[13px] font-bold text-gray-900 dark:text-gray-100 leading-snug mb-1 line-clamp-2" title="${escapeHtml(article.title)}">${escapeHtml(article.title)}</h3>
            <p class="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">${escapeHtml(previewText)}</p>
        </div>

        <div class="flex flex-wrap gap-1.5 mt-auto pt-2">
            ${categoryDisplayName && categoryDisplayName !== 'Sem categoria' ? `<span class="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">${escapeHtml(categoryDisplayName)}</span>` : ''}
            ${(article.tags || []).slice(0, 2).map(t => `<span class="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-[10px] px-2 py-0.5 rounded-full">${escapeHtml(t)}</span>`).join('')}
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

export function renderSqlGrid(scripts, paginationConfig = null) {
  const container = document.getElementById('articles-grid');
  if (!container) return;

  const currentViewMode = localStorage.getItem('kcs_sql_view_mode') || 'grid';
  const uniqueAuthors = [...new Set(scripts.map(s => s.createdBy).filter(Boolean))].sort();

  let html = `
    <div class="view-header" style="flex-wrap: wrap; gap: 16px;">
        <h2 class="view-title">
            <i class="ph ph-database text-purple-500"></i> BIBLIOTECA SQL
        </h2>
        <div style="display: flex; align-items: center; gap: 12px; margin-left: auto;">
            
            <div style="display: flex; gap: 8px; border-right: 1px solid var(--color-border-subtle); padding-right: 12px;">
                <select id="grid-sql-filter-author" class="vscode-select hidden sm:block">
                    <option value="all">Todos os Autores</option>
                    ${uniqueAuthors.map(author => `<option value="${escapeHtml(author)}">${escapeHtml(author)}</option>`).join('')}
                </select>
                
                <select id="grid-sql-filter-op" class="vscode-select hidden sm:block">
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

  if (!scripts || scripts.length === 0) {
    container.innerHTML = html + `<div class="empty-state"><i class="ph ph-database empty-icon text-purple-500/50"></i><p>Nenhum script SQL encontrado</p></div>`; 
    return;
  }

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
                Mostrando <strong>${scripts.length}</strong> de <strong>${paginationConfig.totalItems}</strong> scripts &mdash; Página ${paginationConfig.currentPage} de ${paginationConfig.totalPages}
            </span>
            <div class="pagination-controls">
                <button onclick="window.__kcs.loadPage('prev')" class="btn-pagination" ${!paginationConfig.hasPrev ? 'disabled' : ''}><i class="ph ph-caret-left"></i> Anterior</button>
                <button onclick="window.__kcs.loadPage('next')" class="btn-pagination" ${!paginationConfig.hasNext ? 'disabled' : ''}>Próxima <i class="ph ph-caret-right"></i></button>
            </div>
        </div>
    `;
  }

  container.innerHTML = html;

  setTimeout(() => {
      const authorFilter = document.getElementById('grid-sql-filter-author');
      const opFilter = document.getElementById('grid-sql-filter-op');
      
      if (authorFilter && window.__kcs.applyGridFilters) {
          if (window.__kcs.currentGridSqlAuthor) authorFilter.value = window.__kcs.currentGridSqlAuthor;
          authorFilter.addEventListener('change', (e) => window.__kcs.applyGridFilters('sql-author', e.target.value));
      }
      
      if (opFilter && window.__kcs.applyGridFilters) {
          if (window.__kcs.currentGridSqlOp) opFilter.value = window.__kcs.currentGridSqlOp;
          opFilter.addEventListener('change', (e) => window.__kcs.applyGridFilters('sql-op', e.target.value));
      }
  }, 50);
}

function renderSqlTable(scripts) {
  const user = getCurrentUser();
  
  let tableHtml = `
    <div class="table-wrapper">
        <table class="table-default">
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
  const sqlNumHtml = script.scriptNumber ? `<span class="bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/20 text-[10px] font-mono font-bold px-2 py-0.5 rounded">#SQL-${script.scriptNumber}</span>` : '<span></span>';

  const user = getCurrentUser();
  const userId = user?.uid || user?.id;
  const isFav = (script.favorites || []).includes(userId);
  const starClass = isFav ? 'ph-fill ph-star text-yellow-500' : 'ph ph-star text-gray-400 hover:text-yellow-500';
  const isLiked = (script.likes || []).includes(userId);
  const heartClass = isLiked ? 'ph-fill ph-heart text-red-500' : 'ph ph-heart text-gray-400 hover:text-red-500';

  const authorFullName = formatFullName(script.createdBy);

  let opBadge = '';
  if (opType === 'SELECT') opBadge = '<span class="bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full">SELECT</span>';
  else if (opType === 'UPDATE') opBadge = '<span class="bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full">UPDATE</span>';
  else if (opType === 'DELETE') opBadge = '<span class="bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full">DELETE</span>';
  else opBadge = `<span class="bg-gray-500/10 text-gray-500 border border-gray-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full">${escapeHtml(opType)}</span>`;

  return `
    <div class="bg-white dark:bg-surface border border-gray-200 dark:border-border-subtle rounded-xl p-4 flex flex-col gap-3 hover:border-purple-500/50 hover:shadow-md transition-all cursor-pointer relative group" onclick="window.__kcs.viewSqlScript('${script.id}')">
        
        <div class="flex justify-between items-start">
            ${sqlNumHtml}
            ${opBadge}
        </div>
        
        <div>
            <h3 class="text-[13px] font-bold text-gray-900 dark:text-gray-100 leading-snug mb-1 line-clamp-2" title="${escapeHtml(script.name)}">${escapeHtml(script.name)}</h3>
            <div class="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed font-mono mt-2 bg-gray-50 dark:bg-[#1e1e1e] p-2 rounded border border-gray-200 dark:border-[#3c3c3c]">
                ${escapeHtml(truncate(script.code || '', 100))}
            </div>
        </div>

        <div class="flex flex-wrap gap-1.5 mt-auto pt-2">
            <span class="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"><i class="ph-bold ph-database"></i> ${escapeHtml(dbInfo.label)}</span>
            ${script.visibility === 'private' ? `<span class="bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] px-2 py-0.5 rounded-full" title="Privado"><i class="ph-bold ph-lock"></i></span>` : ''}
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
  if (hasPermission('manage_sql') || !canEdit) {
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

    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;

    // ==========================================
    // 1. CÁLCULOS DOS KPIs PRINCIPAIS E SAÚDE
    // ==========================================
    const validArticles = articles.filter(a => a.status === 'approved' || (typeof ARTICLE_STATUS !== 'undefined' && a.status === ARTICLE_STATUS.APPROVED));
    const totalViews = articles.reduce((acc, a) => acc + (a.views || 0), 0);

    // Taxa de Aprovação
    const approvalRate = articles.length > 0 ? Math.round((validArticles.length / articles.length) * 100) : 0;

    // Tempo Médio de Revisão (Aprovados que possuem data de criação e atualização distintas)
    let totalReviewTime = 0;
    let reviewedCount = 0;
    validArticles.forEach(a => {
        if (a.createdAt && a.updatedAt && a.createdAt !== a.updatedAt) {
            totalReviewTime += (new Date(a.updatedAt) - new Date(a.createdAt)) / msPerDay;
            reviewedCount++;
        }
    });
    const avgReviewDays = reviewedCount > 0 ? Math.round(totalReviewTime / reviewedCount) : 0;

    // Artigos Desatualizados (> 90 dias sem atualização)
    const outdatedCount = validArticles.filter(a => {
        const age = (now - new Date(a.updatedAt || a.createdAt || now)) / msPerDay;
        return age > 90;
    }).length;

    // Nunca Revisados (Aprovados sem registro de autoridade revisora)
    const neverReviewedCount = articles.filter(a => a.status === 'approved' && !a.approvedBy && !a.reviewedBy && !a.validatedBy).length;

    const hasReport = (a) => {
        return (a.reportCount || 0) > 0 || (a.reports && a.reports.length > 0) || a.flagged === true || a.status === 'review' || a.status === 'pendente_revisao';
    };

    const qualityAlertArticles = articles.filter(a => {
        const score = (a.useful || (a.likes || []).length || 0) - (a.notUseful || 0);
        return score < 0 || hasReport(a);
    });

    // ==========================================
    // 2. CÁLCULOS DE QUALIDADE DA BASE
    // ==========================================
    const noCategoryCount = articles.filter(a => !a.categoryId && !a.category || a.category === 'Sem categoria').length;
    const lowAccessCount = validArticles.filter(a => (a.views || 0) < 10).length;
    
    // Detector de Duplicatas (Títulos idênticos)
    const titleCounts = {};
    articles.forEach(a => {
        if (!a.title) return;
        const t = a.title.trim().toLowerCase();
        titleCounts[t] = (titleCounts[t] || 0) + 1;
    });
    const duplicateCount = articles.filter(a => a.title && titleCounts[a.title.trim().toLowerCase()] > 1).length;

    // ==========================================
    // 3. FILA DE REVISÃO CRÍTICA (Com Scoring)
    // ==========================================
    const urgentArticles = articles.filter(a => {
        const isDraft = a.status === 'draft' || (typeof ARTICLE_STATUS !== 'undefined' && a.status === ARTICLE_STATUS.DRAFT);
        const isApproved = a.status === 'approved' || (typeof ARTICLE_STATUS !== 'undefined' && a.status === ARTICLE_STATUS.APPROVED);
        
        const ageDays = Math.floor((now - new Date(a.updatedAt || a.createdAt || now)) / msPerDay);
        const isReported = hasReport(a);
        const isHighViewDraft = isDraft && (a.views || 0) > 5;
        const isStagnantDraft = isDraft && ageDays > 3;  
        const isStale = isApproved && ageDays > 6; 
        
        if (!isReported && !isHighViewDraft && !isStagnantDraft && !isStale) return false;

        a._ageDays = ageDays;
        let score = 0;

        // Atribuição de Prioridade e Peso Crítico
        if (isReported) { 
            a._alertReason = 'Reporte de Erro'; a._priority = 'Alta'; score += 100; 
        } else if (isHighViewDraft) { 
            a._alertReason = 'Alto Acesso (>5)'; a._priority = 'Alta'; score += 80; 
        } else if (isStale) { 
            a._alertReason = 'Revisão Vencida (> 6d)'; a._priority = 'Média'; score += 50 + ageDays; 
        } else if (isStagnantDraft) { 
            a._alertReason = 'Rascunho Parado (> 3d)'; a._priority = 'Baixa'; score += 20 + ageDays; 
        }
        
        a._criticalityScore = score;
        return true;
    }).sort((a, b) => b._criticalityScore - a._criticalityScore).slice(0, 8); // Top 8 mais críticos

    // ==========================================
    // 4. RANKINGS GERAIS
    // ==========================================
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

    // ==========================================
    // 5. INJEÇÃO DO DOM
    // ==========================================
    container.innerHTML = `
        <h2 class="dash-title">
            <i class="ph ph-chart-line-up dash-icon-main"></i> Dashboard de Governança
        </h2>
        
        <div class="dash-metrics">
            <div class="metric-card">
                <p class="metric-label"><i class="ph ph-file-text"></i>Procedimentos</p>
                <p class="metric-value">${articles.length}</p>
            </div>
            <div class="metric-card">
                <p class="metric-label"><i class="ph ph-check-circle"></i>Aprovados</p>
                <p class="metric-value value-approved">${validArticles.length}</p>
            </div>
            <div class="metric-card">
                <p class="metric-label"><i class="ph ph-percent"></i>Taxa de Aprovação</p>
                <p class="metric-value value-views">${approvalRate}%</p>
            </div>
            <div class="metric-card">
                <p class="metric-label"><i class="ph ph-clock"></i>Tempo Méd. Revisão</p>
                <p class="metric-value">${avgReviewDays}d</p>
            </div>
            
            <div class="metric-card">
                <p class="metric-label"><i class="ph ph-eye"></i>Total de Acessos</p>
                <p class="metric-value value-views">${totalViews}</p>
            </div>
            <div class="metric-card">
                <p class="metric-label"><i class="ph ph-calendar-blank"></i>Desatualizados (>90d)</p>
                <p class="metric-value ${outdatedCount > 0 ? 'value-alert' : ''}">${outdatedCount}</p>
            </div>
            <div class="metric-card">
                <p class="metric-label"><i class="ph ph-shield-warning"></i>Nunca Revisados</p>
                <p class="metric-value ${neverReviewedCount > 0 ? 'value-alert' : ''}">${neverReviewedCount}</p>
            </div>
            <div class="metric-card alert-metric">
                <p class="metric-label label-alert"><i class="ph ph-warning-octagon"></i>Alerta Qualidade</p>
                <p class="metric-value value-alert">${qualityAlertArticles.length}</p>
            </div>
        </div>

        <h2 class="dash-title" style="margin-top: 2rem;">
            <i class="ph ph-heartbeat dash-icon-main"></i> Qualidade da Base
        </h2>

        <div class="dash-metrics">
            <div class="metric-card">
                <p class="metric-label"><i class="ph ph-folder-notch-minus"></i>Sem Categoria</p>
                <p class="metric-value ${noCategoryCount > 0 ? 'value-alert' : ''}">${noCategoryCount}</p>
            </div>
            <div class="metric-card">
                <p class="metric-label"><i class="ph ph-copy"></i>Duplicados (Nomes)</p>
                <p class="metric-value ${duplicateCount > 0 ? 'value-alert' : ''}">${duplicateCount}</p>
            </div>
            <div class="metric-card">
                <p class="metric-label"><i class="ph ph-trend-down"></i>Baixo Acesso (< 10)</p>
                <p class="metric-value">${lowAccessCount}</p>
            </div>
            <div class="metric-card">
                <p class="metric-label"><i class="ph ph-user-minus"></i>Pendentes/Drafts</p>
                <p class="metric-value">${articles.length - validArticles.length}</p>
            </div>
        </div>

        <div class="dash-widget widget-urgent mt-6">
            <div class="widget-header-row">
                <div class="widget-title-group">
                    <h3 class="widget-header header-red">
                        <i class="ph ph-siren"></i> Fila de Revisão Crítica
                    </h3>
                    <button onclick="window.copyTableToClipboard('dash-table-urgents', this)" class="copy-btn" title="Copiar Tabela">
                        <i class="ph ph-copy"></i>
                    </button>
                </div>
                <div class="info-box hidden sm:flex">
                    <i class="ph ph-info"></i>
                    <span><strong>Ordenado por Criticidade:</strong> Reportes e Idade do rascunho elevam a prioridade.</span>
                </div>
            </div>

            <div class="table-wrapper">
                <table id="dash-table-urgents" class="table-default">
                    <thead>
                        <tr>
                            <th>KCS ID</th>
                            <th>Título do Procedimento</th>
                            <th class="col-center">Idade</th>
                            <th class="col-center">Prioridade</th>
                            <th>Gatilho</th>
                            <th class="col-right">Ação</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${urgentArticles.map(art => `
                            <tr class="table-row" onclick="window.__kcs.viewArticle('${art.id}')">
                                <td class="id-cell">#${art.articleNumber || '---'}</td>
                                <td class="title-cell-truncate" title="${escapeHtml(art.title)}">${escapeHtml(art.title)}</td>
                                <td class="col-center stat-muted"><i class="ph ph-clock"></i> ${art._ageDays}d</td>
                                <td class="col-center">
                                    <span class="${art._priority === 'Alta' ? 'badge-alert' : art._priority === 'Média' ? 'badge-purple' : 'badge-green'}">${art._priority}</span>
                                </td>
                                <td>
                                    <span class="badge-alert">
                                        <i class="ph ph-warning-circle"></i> ${escapeHtml(art._alertReason)}
                                    </span>
                                </td>
                                <td class="col-right">
                                    <button class="btn-review">
                                        Revisar
                                    </button>
                                </td>
                            </tr>
                        `).join('') || '<tr><td colspan="6" class="empty-cell-success"><i class="ph ph-check-circle"></i> Nenhum alerta crítico ativo na base.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="dash-tables-row mt-6">
            <div class="dash-widget">
                <h3 class="widget-header header-purple">
                    <i class="ph ph-medal"></i> Top Analistas (Curadoria)
                </h3>
                <div class="table-wrapper">
                    <table class="table-default">
                        <tbody>
                            ${finalAnalysts.filter(a => (a.articlesApproved || a.approved || 0) > 0).map((u, i) => `
                                <tr class="table-row">
                                    <td class="user-cell">
                                        <div class="rank-number">#${i + 1}</div>
                                        <div class="avatar-mini">${(u.displayName || u.name || '?').charAt(0).toUpperCase()}</div>
                                        <p class="user-name">${escapeHtml(formatFullName(u.displayName || u.name))}</p>
                                    </td>
                                    <td class="stat-cell">
                                        <span class="badge-purple">${u.articlesApproved || u.approved || 0}</span>
                                    </td>
                                </tr>
                            `).join('') || '<tr><td colspan="2" class="empty-cell">Nenhuma aprovação registrada.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="dash-widget">
                <h3 class="widget-header header-green">
                    <i class="ph ph-hand-heart"></i> Top Colaboradores (Envios)
                </h3>
                <div class="table-wrapper">
                    <table class="table-default">
                        <tbody>
                            ${finalCollaborators.filter(c => (c.draftsSubmitted || c.drafts || 0) > 0).map((u, i) => `
                                <tr class="table-row">
                                    <td class="user-cell">
                                        <div class="rank-number">#${i + 1}</div>
                                        <div class="avatar-mini">${(u.displayName || u.name || '?').charAt(0).toUpperCase()}</div>
                                        <p class="user-name">${escapeHtml(formatFullName(u.displayName || u.name))}</p>
                                    </td>
                                    <td class="stat-cell">
                                        <span class="badge-green">${u.draftsSubmitted || u.drafts || 0}</span>
                                    </td>
                                </tr>
                            `).join('') || '<tr><td colspan="2" class="empty-cell">Nenhum envio registrado.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="dash-tables-row mt-6">
            <div class="dash-widget">
                <div class="widget-header-row">
                    <h3 class="widget-header header-blue">
                        <i class="ph ph-trend-up"></i> Top Acessados
                    </h3>
                    <button onclick="window.copyTableToClipboard('dash-table-views', this)" class="copy-btn" title="Copiar Tabela">
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
                            ${sortedByViews.filter(a => (a.views || 0) > 0).map((a, i) => {
                                const authorName = formatFullName(a.createdBy);
                                return `
                                <tr class="table-row" onclick="window.__kcs.viewArticle('${a.id}')">
                                    <td class="title-cell-truncate" title="${escapeHtml(a.title)}">
                                        <span class="rank-muted">${i+1}.</span>
                                        <span class="truncate-text">${escapeHtml(a.title)}</span>
                                    </td>
                                    <td>
                                        <div class="user-badge">
                                            <div class="avatar-mini">${authorName.charAt(0).toUpperCase()}</div>
                                            <span class="user-name">${escapeHtml(authorName)}</span>
                                        </div>
                                    </td>
                                    <td class="col-right">
                                        <span class="badge-neutral">${a.views}</span>
                                    </td>
                                </tr>`;
                            }).join('') || '<tr><td colspan="3" class="empty-cell">Nenhum dado.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="dash-widget">
                <div class="widget-header-row">
                    <h3 class="widget-header header-purple">
                        <i class="ph ph-database"></i> Scripts Úteis
                    </h3>
                    <button onclick="window.copyTableToClipboard('dash-table-sql', this)" class="copy-btn" title="Copiar Tabela">
                        <i class="ph ph-copy"></i>
                    </button>
                </div>
                
                <div class="table-wrapper">
                    <table id="dash-table-sql" class="table-default">
                        <thead>
                            <tr>
                                <th>Nome do Script</th>
                                <th>Autor</th>
                                <th class="col-right">Útil</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${topScripts.filter(s => (s.likes||[]).length > 0).map((s, i) => {
                                const authorName = formatFullName(s.createdBy);
                                return `
                                <tr class="table-row" onclick="window.__kcs.viewSqlScript('${s.id}')">
                                    <td class="title-cell-truncate" title="${escapeHtml(s.name)}">
                                        <span class="rank-muted">${i+1}.</span>
                                        <span class="truncate-text">${escapeHtml(s.name)}</span>
                                    </td>
                                    <td>
                                        <div class="user-badge">
                                            <div class="avatar-mini">${authorName.charAt(0).toUpperCase()}</div>
                                            <span class="user-name">${escapeHtml(authorName)}</span>
                                        </div>
                                    </td>
                                    <td class="col-right">
                                        <span class="stat-highlight"><i class="ph ph-heart"></i> ${(s.likes||[]).length}</span>
                                    </td>
                                </tr>`;
                            }).join('') || '<tr><td colspan="3" class="empty-cell">Nenhum dado.</td></tr>'}
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
  
  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type} animate-slide-in`;
  toast.innerHTML = `<i class="ph ${iconMap[type] || iconMap.info} toast-icon"></i><span>${escapeHtml(message)}</span>`;
  
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