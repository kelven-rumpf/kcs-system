import { getCurrentUser, hasPermission, hasRole, getAllUsersFromCloud, getAllCompaniesFromCloud, getAllInvitedUsers } from '../auth.js';
import { initEditor } from './editor.js'; 
import { formatContentForView, isAppBooting } from './render.js'; 
import { getFlatCategories, addCategory, removeCategory, updateCategory } from '../services/categories.js';
import { VISIBILITY, SECTORS } from '../config.js';

window.__kcs = window.__kcs || {};

const SQL_DB_TYPES = [
    { value: 'mysql', label: 'MySQL', color: 'db-mysql' },
    { value: 'postgres', label: 'PostgreSQL', color: 'db-postgres' },
    { value: 'sqlserver', label: 'SQL Server', color: 'db-sqlserver' },
    { value: 'oracle', label: 'Oracle DB', color: 'db-oracle' }
];

// ==========================================
// WORKBENCH MANAGER (OVERLAY & DOCKING)
// ==========================================

function attachToOverlay(modal) {
    if (isAppBooting()) {
        console.warn('Modal render blocked while app is booting.');
        return;
    }

    const overlayRoot = document.getElementById('overlay-root');
    if (!overlayRoot) {
        console.warn('overlay-root não encontrado');
        return;
    }
    
    Array.from(overlayRoot.children).forEach(child => {
        if (child.id !== modal.id && !child.classList.contains('lightbox-overlay')) {
            if (window.__kcs.toggleMinimize) {
                window.__kcs.toggleMinimize(child.id);
            }
        }
    });

    overlayRoot.appendChild(modal);
    modal.classList.remove('hidden', 'kcs-minimized');
    modal.classList.add('kcs-active-overlay');
}

window.__kcs.toggleMinimize = (modalId) => {
    const modal = document.getElementById(modalId);
    const dock = document.getElementById('kcs-dock');
    const overlayRoot = document.getElementById('overlay-root');
    
    if (!modal || !dock || !overlayRoot) return;
    
    const isMinimized = modal.classList.contains('kcs-minimized');
    
    if (isMinimized) {
        Array.from(overlayRoot.children).forEach(child => {
            if (child.id !== modalId && !child.classList.contains('lightbox-overlay')) {
                window.__kcs.toggleMinimize(child.id);
            }
        });

        overlayRoot.appendChild(modal);
        modal.classList.remove('kcs-minimized');
        modal.classList.add('kcs-active-overlay');
    } else {
        dock.appendChild(modal);
        modal.classList.remove('kcs-active-overlay');
        modal.classList.add('kcs-minimized');
    }
};

window.__kcs.toggleMaximize = (modalId) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    if (modal.classList.contains('kcs-minimized')) window.__kcs.toggleMinimize(modalId);
    
    const maxBtnIcon = modal.querySelector('.btn-max i') || document.getElementById(`icon-max-${modalId}`);
    
    if (modal.classList.contains('kcs-maximized')) {
        modal.classList.remove('kcs-maximized');
        if (maxBtnIcon) maxBtnIcon.className = 'ph-bold ph-arrows-out-simple';
    } else {
        modal.classList.add('kcs-maximized');
        if (maxBtnIcon) maxBtnIcon.className = 'ph-bold ph-arrows-in-simple';
    }
};

window.__kcs.closeModal = (modalId, isDynamic = false) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.remove('kcs-active-overlay', 'kcs-minimized', 'kcs-maximized');
    
    if (isDynamic) {
        modal.remove();
    } else {
        modal.classList.add('hidden');
        const overlayRoot = document.getElementById('overlay-root');
        if (overlayRoot && modal.parentElement !== overlayRoot) {
            overlayRoot.appendChild(modal);
        }
    }
};

window.copyFieldText = function(btn) {
    const container = btn.closest('.field-group');
    const contentDiv = container.querySelector('.field-content');
    if (!contentDiv) return;

    let textToCopy = contentDiv.innerText.trim();
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<i class="ph-fill ph-check-circle icon-success"></i>';
        if (window.__kcs && window.__kcs.showToast) window.__kcs.showToast('Texto copiado!', 'success');
        setTimeout(() => { btn.innerHTML = originalIcon; }, 2000);
    }).catch(err => console.error('Erro ao copiar', err));
};

// Singleton para o evento do Lightbox
if (!window.__kcsZoomInit) {
    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG' && e.target.closest('.modal-zoomable')) {
            const src = e.target.src;
            const lb = document.createElement('div');
            lb.className = 'lightbox-overlay';
            lb.innerHTML = `
                <img src="${src}" class="lightbox-image">
                <button class="btn-icon btn-lightbox-close"><i class="ph-bold ph-x"></i></button>`;
            
            lb.addEventListener('click', () => lb.remove());
            
            const overlayRoot = document.getElementById('overlay-root');
            if (overlayRoot) {
                overlayRoot.appendChild(lb);
            }
        }
    });
    window.__kcsZoomInit = true;
}

// Utilitário interno para vincular eventos sem duplicar (Singletons)
function safeBindEvent(element, eventType, handler) {
    if (!element) return;
    const propName = `_${eventType}Handler`;
    if (element[propName]) {
        element.removeEventListener(eventType, element[propName]);
    }
    element[propName] = handler;
    element.addEventListener(eventType, handler);
}

// ==========================================
// MDI TAB: NOVA DOCUMENTAÇÃO (CRIAÇÃO/EDIÇÃO)
// ==========================================
export function openArticleModal(article = null, onSave, rebindToolbar) {
    const user = getCurrentUser();
    const authorName = article ? article.createdBy : user.displayName;
    const kcsNum = article?.articleNumber ? `KCS-${article.articleNumber}` : 'Gerado ao salvar';

    const flatCategories = getFlatCategories();
    const categoryOptions = flatCategories.map(c => 
        `<option value="${c.id}" ${article?.categoryId === c.id || article?.category === c.id ? 'selected' : ''}>${c.path}</option>`
    ).join('');

    const idUnico = article?.id || `novo-${Date.now()}`;
    const tituloAba = article?.title ? `Edit: ${article.title}` : 'Novo Procedimento';

    // 1. Criar o Contêiner do Formulário (Aba de Conteúdo)
    const formContainer = document.createElement('form');
    formContainer.className = 'flex flex-col h-full';
    formContainer.id = `form-${idUnico}`;

    // 2. Montar o HTML com IDs ÚNICOS para permitir múltiplas abas abertas
    formContainer.innerHTML = `
        <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
            <div class="form-row-metadata">
                <div class="form-group meta-block">
                    <p class="meta-label">Número do Procedimento</p>
                    <p class="meta-value id-highlight">${kcsNum}</p>
                </div>
                <div class="form-group meta-block meta-divider">
                    <p class="meta-label">Autor Original</p>
                    <p class="meta-value">${authorName}</p>
                </div>
            </div>

            <div class="alert-box alert-indigo">
                <div class="alert-icon"><i class="ph-fill ph-magic-wand"></i></div>
                <div class="alert-content">
                    <h4 class="alert-title">Piloto Automático KCS</h4>
                    <p class="alert-text">Conte o cenário completo no <strong>Procedimento Detalhado</strong> e clique em <strong class="badge-indigo">✨ Refinar</strong> para que a IA aperfeiçoe o procedimento.</p>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Título *</label>
                <input type="text" id="article-title-${idUnico}" placeholder="Ex: Resetar Senha de Usuário" class="form-input" value="${article?.title || ''}" />
            </div>
            
            <div class="form-row-split">
                <div class="form-group">
                    <label class="form-label">Sintoma / Problema</label>
                    <textarea id="article-symptom-${idUnico}" rows="2" placeholder="Descreva o erro ou situação relatada" class="form-textarea">${article?.symptom || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Ambiente</label>
                    <textarea id="article-environment-${idUnico}" rows="2" placeholder="Ex: Windows 10, Chrome 120, SQL Server 2019" class="form-textarea">${article?.environment || ''}</textarea>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Causa</label>
                <textarea id="article-cause-${idUnico}" rows="2" placeholder="O que causou o problema" class="form-textarea">${article?.cause || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Solução</label>
                <textarea id="article-solution-${idUnico}" rows="2" placeholder="Descreva o passo a passo da resolução" class="form-textarea">${article?.solution || ''}</textarea>
            </div>
            
            <div class="form-group editor-container">
                <label class="form-label">Procedimento Detalhado / Captura de Rascunho</label>
                <div class="editor-toolbar">
                    <div class="toolbar-actions-left">
                        <button type="button" data-format="undo" class="btn-tool"><i class="ph ph-arrow-u-up-left"></i></button>
                        <button type="button" data-format="redo" class="btn-tool"><i class="ph ph-arrow-u-up-right"></i></button>
                        <div class="toolbar-divider"></div>
                        <button type="button" data-format="bold" class="btn-tool tool-bold">B</button>
                        <button type="button" data-format="italic" class="btn-tool tool-italic">I</button>
                        <button type="button" data-format="underline" class="btn-tool tool-underline">U</button>
                        <div class="toolbar-divider"></div>
                        <button type="button" data-format="h3" class="btn-tool tool-h3">H3</button>
                        <button type="button" data-format="insertUnorderedList" class="btn-tool"><i class="ph ph-list-bullets"></i></button>
                        <button type="button" data-format="insertOrderedList" class="btn-tool"><i class="ph ph-list-numbers"></i></button>
                        <div class="toolbar-divider"></div>
                        <button type="button" data-format="image" class="btn-tool tool-image" title="Anexar Imagem"><i class="ph ph-camera"></i></button>
                    </div>
                    <div class="toolbar-actions-right">
                        <button type="button" class="btn-ia btn-ia-reescrever"><i class="ph-fill ph-magic-wand"></i> Refinar</button>
                    </div>
                </div>
                <div id="article-body-${idUnico}" contenteditable="true" class="editor-content modal-zoomable"></div>
            </div>
            
            <div class="form-row-multi">
                <div class="form-group">
                    <label class="form-label">Categoria</label>
                    <select id="article-category-${idUnico}" class="form-select">${categoryOptions}</select>
                </div>
                <div class="form-group">
                    <label class="form-label">Visibilidade</label>
                    <select id="article-visibility-${idUnico}" class="form-select">
                        <option value="${VISIBILITY.PUBLIC}" ${article?.visibility === VISIBILITY.PUBLIC ? 'selected' : ''}>🌍 Público</option>
                        <option value="${VISIBILITY.PRIVATE}" ${article?.visibility === VISIBILITY.PRIVATE ? 'selected' : ''}>🔒 Privado</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Tags (Vírgula)</label>
                    <input type="text" id="article-tags-${idUnico}" class="form-input" value="${(article?.tags || []).join(', ')}" />
                </div>
            </div>
        </div>

        <div class="flex flex-col sm:flex-row justify-end gap-3 px-4 sm:px-6 py-4 border-t border-border-subtle bg-bg-main/50 pb-4 shrink-0">
            <button type="button" class="btn-secondary btn-cancel-tab">Cancelar</button>
            <button type="submit" class="btn-neutral btn-draft-tab">Salvar Rascunho</button>
            ${hasPermission('validate_article') ? `<button type="submit" class="btn-primary btn-publish-tab">Salvar e Aprovar</button>` : ''}
        </div>
    `;

    // 3. Preencher o Editor (HTML Body)
    const editorCorpo = formContainer.querySelector(`#article-body-${idUnico}`);
    if (editorCorpo) {
        let htmlParaCarregar = article?.steps || article?.body || '';
        if (Array.isArray(htmlParaCarregar)) {
            htmlParaCarregar = htmlParaCarregar.map(step => {
                let txt = step.description ? `<p>${step.description}</p>` : '';
                if(step.images) txt += step.images.map(img => `<br><img src="${img}" class="editor-image-preview" /><br>`).join('');
                return txt;
            }).join('');
        }
        editorCorpo.innerHTML = htmlParaCarregar;
    }

    // 4. Lógica de Ações e Botões do Rodapé
    let submitAction = 'draft';
    const btnDraft = formContainer.querySelector('.btn-draft-tab');
    const btnPublish = formContainer.querySelector('.btn-publish-tab');
    const btnCancel = formContainer.querySelector('.btn-cancel-tab');

    if (btnDraft) btnDraft.addEventListener('click', () => { submitAction = 'draft'; });
    if (btnPublish) btnPublish.addEventListener('click', () => { submitAction = 'approved'; });
    if (btnCancel) btnCancel.addEventListener('click', () => window.TabManager.closeTab(idUnico));

    // 5. Interceptador do Formulário (Salvar)
    formContainer.addEventListener('submit', (e) => {
        e.preventDefault();
        const titleValue = document.getElementById(`article-title-${idUnico}`)?.value?.trim();
        if (!titleValue) return alert("Por favor, preencha o Título."); 
        
        // Remove a Flag de "Não salvo" para que a aba feche sem pedir confirmação
        window.TabManager.markDirty(idUnico, false);

        onSave({ 
            title: titleValue, 
            symptom: document.getElementById(`article-symptom-${idUnico}`)?.value?.trim() || '', 
            environment: document.getElementById(`article-environment-${idUnico}`)?.value?.trim() || '', 
            cause: document.getElementById(`article-cause-${idUnico}`)?.value?.trim() || '', 
            solution: document.getElementById(`article-solution-${idUnico}`)?.value?.trim() || '', 
            steps: document.getElementById(`article-body-${idUnico}`)?.innerHTML || '', 
            categoryId: document.getElementById(`article-category-${idUnico}`)?.value || '', 
            visibility: document.getElementById(`article-visibility-${idUnico}`)?.value || VISIBILITY.PUBLIC,
            tags: (document.getElementById(`article-tags-${idUnico}`)?.value || '').split(',').map(t => t.trim()).filter(Boolean), 
            statusRequest: submitAction 
        }, article?.id || null);
        
        window.TabManager.closeTab(idUnico, true);
    });

    // 6. Conecta o Formulário Gerado ao TabManager
    window.TabManager.openTab(idUnico, tituloAba, 'ph-file-text', formContainer);

    // 7. Inicializa o Editor (deve ser após injetar no DOM via requestAnimationFrame)
    requestAnimationFrame(() => {
        initEditor(`article-body-${idUnico}`);
        if (rebindToolbar) rebindToolbar();
        
        // Foca automaticamente no campo de título para acelerar a digitação
        document.getElementById(`article-title-${idUnico}`)?.focus();
    });
}

// ==========================================
// MDI TAB: VISUALIZADOR DE PROCEDIMENTOS (FULL WIDTH + GRID LAYOUT)
// ==========================================
export function openViewModal(article, currentUser) {
    const idUnico = `view-${article.id}`;
    const tituloAba = article.articleNumber ? `#${article.articleNumber} - ${article.title}` : article.title;
    
    const safeText = (str) => { 
        if(!str) return ''; 
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); 
    };

    const userId = currentUser?.uid || currentUser?.id;
    const isFav = (article.favorites || []).includes(userId);
    const isLiked = (article.likes || []).includes(userId);

    // 1. Criar o Contêiner da Aba
    const container = document.createElement('div');
    container.className = 'flex flex-col h-full';
    container.id = `view-container-${idUnico}`;
    container.style.backgroundColor = 'var(--color-editor-background)';

    // 2. Montar o HTML com Layout Full Width e Grid
 // 2. Montar o HTML com Layout Full Width e Grid
    container.innerHTML = `
        <div class="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar modal-zoomable relative">
            
            ${article.status === 'review' || article.status === 'pendente_revisao' ? `
            <div class="w-full mb-8 kcs-badge-warning px-5 py-4 rounded-lg flex items-center gap-3 text-sm shadow-sm" data-html2pdf-ignore>
                <i class="ph-fill ph-warning-circle text-2xl"></i>
                <span><strong>Atenção:</strong> Este procedimento está em revisão ou foi sinalizado pela equipe.</span>
            </div>` : ''}

            <div id="kcs-print-area-${article.id}" class="print-area w-full">
                
                <div class="mb-8 pb-6 border-b border-border-subtle">
                    <h1 class="text-3xl sm:text-4xl font-extrabold mb-5 leading-tight tracking-tight" style="color: var(--color-text-primary);">${safeText(article.title)}</h1>
                    
                    <div class="flex flex-wrap items-center gap-2.5">
                        ${article.articleNumber ? `<span class="kcs-badge-id px-2.5 py-1 text-[12px] rounded">#KCS-${article.articleNumber}</span>` : ''}
                        ${article.categoryId || article.category ? `<span class="kcs-badge-tag px-3 py-1 text-[11px] rounded-full uppercase tracking-wider" style="color: var(--color-focus); border-color: var(--color-focus);">${safeText(article.categoryId || article.category)}</span>` : ''}
                        ${article.visibility === VISIBILITY.PRIVATE ? `<span class="kcs-badge-warning px-2.5 py-1 text-[12px] rounded flex items-center gap-1.5"><i class="ph-bold ph-lock"></i> Privado</span>` : `<span class="kcs-badge-success px-2.5 py-1 text-[12px] rounded flex items-center gap-1.5"><i class="ph-bold ph-globe"></i> Público</span>`}
                        ${article.tags ? article.tags.map(t => `<span class="kcs-badge-tag px-3 py-1 text-[11px] rounded-full">${safeText(t)}</span>`).join('') : ''}
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-6 mb-12">
                    ${article.symptom ? `
                    <div class="kcs-view-field-box border-l-4 border-red-500 pl-4 pr-3 py-3 relative group rounded-r-lg h-full">
                        <h4 class="text-[12px] font-bold text-red-500 uppercase tracking-widest mb-2 flex items-center gap-2"><i class="ph-fill ph-warning-circle text-base"></i> Sintoma</h4>
                        <div class="text-[13.5px] leading-relaxed flex-1">${safeText(article.symptom)}</div>
                        <button class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10" style="color: var(--color-text-muted);" title="Copiar" data-action="copy-field"><i class="ph ph-copy text-lg"></i></button>
                    </div>` : ''}
                    
                    ${article.environment ? `
                    <div class="kcs-view-field-box border-l-4 border-blue-500 pl-4 pr-3 py-3 relative group rounded-r-lg h-full">
                        <h4 class="text-[12px] font-bold text-blue-500 uppercase tracking-widest mb-2 flex items-center gap-2"><i class="ph-fill ph-desktop text-base"></i> Ambiente</h4>
                        <div class="text-[13.5px] leading-relaxed flex-1">${safeText(article.environment)}</div>
                        <button class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10" style="color: var(--color-text-muted);" title="Copiar" data-action="copy-field"><i class="ph ph-copy text-lg"></i></button>
                    </div>` : ''}
                    
                    ${article.cause ? `
                    <div class="kcs-view-field-box border-l-4 border-yellow-500 pl-4 pr-3 py-3 relative group rounded-r-lg h-full">
                        <h4 class="text-[12px] font-bold text-yellow-500 uppercase tracking-widest mb-2 flex items-center gap-2"><i class="ph-fill ph-magnifying-glass text-base"></i> Causa</h4>
                        <div class="text-[13.5px] leading-relaxed flex-1">${safeText(article.cause)}</div>
                        <button class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10" style="color: var(--color-text-muted);" title="Copiar" data-action="copy-field"><i class="ph ph-copy text-lg"></i></button>
                    </div>` : ''}
                    
                    ${article.solution ? `
                    <div class="kcs-view-field-box border-l-4 border-green-500 pl-4 pr-3 py-3 relative group rounded-r-lg h-full">
                        <h4 class="text-[12px] font-bold text-green-500 uppercase tracking-widest mb-2 flex items-center gap-2"><i class="ph-fill ph-check-circle text-base"></i> Solução</h4>
                        <div class="text-[13.5px] leading-relaxed flex-1">${safeText(article.solution)}</div>
                        <button class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10" style="color: var(--color-text-muted);" title="Copiar" data-action="copy-field"><i class="ph ph-copy text-lg"></i></button>
                    </div>` : ''}
                </div>

                ${article.steps || article.body ? `
                <div class="pt-8 border-t border-border-subtle">
                    <h4 class="text-[12px] font-bold uppercase tracking-widest mb-6 flex items-center gap-2" style="color: var(--color-text-muted);"><i class="ph-bold ph-list-numbers text-base"></i> Passo a Passo Detalhado</h4>
                    <div class="markdown-body max-w-none text-[15px] leading-relaxed" style="color: var(--color-text-primary);">${formatContentForView(article.steps || article.body)}</div>
                </div>` : ''}
            </div>

            <div class="w-full mt-16 pt-8 border-t border-border-subtle" data-html2pdf-ignore>
                <h4 class="text-[12px] font-bold uppercase tracking-widest mb-6 flex items-center gap-2" style="color: var(--color-text-muted);"><i class="ph-fill ph-chats text-base text-blue-500"></i> Comentários da Equipe</h4>
                
                <div class="kcs-surface-elevated mb-8 rounded-xl overflow-hidden shadow-sm focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                    <textarea id="inline-comment-input-${idUnico}" rows="2" placeholder="Adicione uma observação, dúvida ou sugestão de melhoria..." class="w-full bg-transparent p-4 outline-none resize-y min-h-[70px] text-[14px]" style="color: var(--color-text-inverse);"></textarea>
                    <div class="flex justify-end p-3 border-t border-border-subtle" style="background-color: rgba(0,0,0,0.05);">
                        <button type="button" id="btn-send-comment-${idUnico}" class="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors">
                            <i class="ph-bold ph-paper-plane-right"></i> Publicar Comentário
                        </button>
                    </div>
                </div>

                <div id="inline-comments-list-${idUnico}" class="space-y-4">
                    ${article.comments && article.comments.length > 0 ? article.comments.map(c => `
                        <div class="kcs-surface-elevated p-5 rounded-xl shadow-sm">
                            <div class="flex items-center justify-between mb-3">
                                <span class="text-[13px] font-bold" style="color: var(--color-text-inverse);">${safeText(c.userName)}</span>
                                <span class="text-[11px]" style="color: var(--color-text-muted);">${new Date(c.date).toLocaleString('pt-BR')}</span>
                            </div>
                            <p class="text-[14px] leading-relaxed" style="color: var(--color-text-primary);">${safeText(c.text)}</p>
                        </div>
                    `).join('') : '<p class="text-[13px] italic empty-comment-msg" style="color: var(--color-text-muted);">Nenhum comentário ainda. Seja o primeiro a contribuir!</p>'}
                </div>
            </div>
            
            <div class="h-12"></div>
        </div>

        <div class="kcs-surface-elevated flex flex-col sm:flex-row justify-between items-center gap-3 px-6 py-3.5 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] border-l-0 border-r-0 border-b-0" data-html2pdf-ignore>
            <div class="flex items-center gap-2">
                <button class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors" style="color: var(--color-text-primary);" onmouseover="this.style.backgroundColor='var(--color-hover)'" onmouseout="this.style.backgroundColor='transparent'" data-action="toggle-like">
                    <i class="${isLiked ? 'ph-fill text-red-500' : 'ph text-gray-400'} ph-heart text-lg"></i> Curtir (<span id="like-count-${idUnico}">${(article.likes || []).length}</span>)
                </button>
                <button class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors" style="color: var(--color-text-primary);" onmouseover="this.style.backgroundColor='var(--color-hover)'" onmouseout="this.style.backgroundColor='transparent'" data-action="focus-comment">
                    <i class="ph-fill ph-chat-circle text-blue-500 text-lg"></i> Comentar (<span id="comment-count-${idUnico}">${(article.comments || []).length}</span>)
                </button>
                <button class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors" style="color: var(--color-text-primary);" onmouseover="this.style.backgroundColor='var(--color-hover)'" onmouseout="this.style.backgroundColor='transparent'" data-action="toggle-fav">
                    <i class="${isFav ? 'ph-fill text-yellow-500' : 'ph text-gray-400'} ph-star text-lg"></i> ${isFav ? 'Salvo' : 'Favoritar'}
                </button>
            </div>

            <div class="flex items-center gap-2">
                <button class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors" style="color: var(--color-text-primary);" onmouseover="this.style.backgroundColor='var(--color-hover)'" onmouseout="this.style.backgroundColor='transparent'" data-action="export-pdf" data-num="${article.articleNumber || 'DOC'}" data-title="${safeText(article.title).replace(/"/g, '&quot;')}">
                    <i class="ph-bold ph-download-simple text-gray-400 text-lg"></i> PDF
                </button>
                <button class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors" style="color: var(--color-text-primary);" onmouseover="this.style.backgroundColor='var(--color-hover)'" onmouseout="this.style.backgroundColor='transparent'" data-action="open-history">
                    <i class="ph-bold ph-clock-counter-clockwise text-gray-400 text-lg"></i> Histórico
                </button>
                <button class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors" data-action="flag-article">
                    <i class="ph-bold ph-warning-circle text-lg"></i> Reportar
                </button>
                ${hasPermission('edit_article') ? `
                    <div class="w-px h-5 mx-2" style="background-color: var(--color-border);"></div>
                    <button class="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors" data-action="edit-article">
                        <i class="ph-bold ph-pencil-simple text-lg"></i> Editar
                    </button>
                ` : ''}
            </div>
        </div>
    `;

    // 3. Lógica do Novo Comentário Inline
    const btnSendComment = container.querySelector(`#btn-send-comment-${idUnico}`);
    const inputComment = container.querySelector(`#inline-comment-input-${idUnico}`);
    const commentsList = container.querySelector(`#inline-comments-list-${idUnico}`);

    btnSendComment.addEventListener('click', async () => {
        const text = inputComment.value.trim();
        if (!text) return;

        try {
            const originalHtml = btnSendComment.innerHTML;
            btnSendComment.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Publicando...';
            btnSendComment.disabled = true;

            // Salva no banco de dados (Importando o módulo do Firebase)
            const { addComment } = await import('../services/kcsCore.js');
            await addComment(article.id, text);

            const emptyMsg = commentsList.querySelector('.empty-comment-msg');
            if (emptyMsg) emptyMsg.remove();

            const newCommentHtml = `
                <div class="p-5 rounded-xl shadow-sm animate-fade-in" style="background-color: var(--color-sidebar-background); border: 1px solid var(--color-border-subtle);">
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-[13px] font-bold" style="color: var(--color-text-inverse);">${safeText(currentUser?.displayName || 'Você')}</span>
                        <span class="text-[11px] text-blue-500 font-semibold">Agora mesmo</span>
                    </div>
                    <p class="text-[14px] leading-relaxed" style="color: var(--color-text-primary);">${safeText(text)}</p>
                </div>
            `;
            
            commentsList.insertAdjacentHTML('beforeend', newCommentHtml);
            inputComment.value = ''; 

            const countSpan = container.querySelector(`#comment-count-${idUnico}`);
            if (countSpan) countSpan.innerText = parseInt(countSpan.innerText) + 1;

            window.__kcs.showToast('Comentário publicado!', 'success');
            
        } catch(e) {
            window.__kcs.showToast('Erro ao salvar comentário.', 'error');
        } finally {
            btnSendComment.innerHTML = '<i class="ph-bold ph-paper-plane-right"></i> Publicar Comentário';
            btnSendComment.disabled = false;
        }
    });

    container.querySelector('[data-action="focus-comment"]').addEventListener('click', () => {
        inputComment.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => inputComment.focus(), 300);
    });

    // 4. Vincular Demais Eventos
    container.querySelectorAll('[data-action="copy-field"]').forEach(btn => btn.addEventListener('click', (e) => window.copyFieldText(e.currentTarget)));
    container.querySelector('[data-action="toggle-like"]').addEventListener('click', () => window.__kcs.toggleLike(article.id));
    container.querySelector('[data-action="toggle-fav"]').addEventListener('click', () => window.__kcs.toggleFavorite(article.id));
    
    container.querySelector('[data-action="export-pdf"]').addEventListener('click', (e) => {
        const ds = e.currentTarget.dataset;
        window.exportArticleToPDF(ds.num, ds.title, e.currentTarget, article.id);
    });

    container.querySelector('[data-action="open-history"]').addEventListener('click', () => window.__kcs.openHistory(article.id, 'articles'));
    container.querySelector('[data-action="flag-article"]').addEventListener('click', () => window.__kcs.flagArticle(article.id));
    
    const btnEdit = container.querySelector('[data-action="edit-article"]');
    if (btnEdit) {
        btnEdit.addEventListener('click', () => {
            window.TabManager.closeTab(idUnico, true);
            window.__kcs.editArticle(article.id);
        });
    }

    // 5. Injetar na Barra de Abas
    window.TabManager.openTab(idUnico, tituloAba, 'ph-book-open', container);
}

// ==========================================
// FUNÇÃO GERADORA DE PDF 
// ==========================================
window.exportArticleToPDF = async function(articleNumber, title, btnElement, articleId = '') {
    const originalHtml = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="ph ph-spinner spinner-icon"></i> Exportando...';
    btnElement.disabled = true;

    if (!window.html2pdf) {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    const printElement = document.getElementById(`kcs-print-area-${articleId}`) || document.getElementById('kcs-print-area');
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
    
    const opt = {
        margin:       [15, 15, 15, 15],
        filename:     `KCS_${articleNumber}_${safeTitle}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        await window.html2pdf().set(opt).from(printElement).save();
    } catch (error) {
        console.error("Erro na geração do PDF:", error);
    } finally {
        btnElement.innerHTML = originalHtml;
        btnElement.disabled = false;
    }
};

export function openDuplicityModal(dupArticle, onContinue) {
    const modal = document.createElement('div');
    modal.id = 'duplicity-modal';
    modal.className = 'modal-container';
    modal.dataset.title = 'Aviso de Governança';

    modal.innerHTML = `
        <div class="modal-content-box alert-box">
            <div class="alert-icon-large">⚠️</div>
            <h2 class="alert-title">Aviso de Governança</h2>
            <p class="alert-text">Já existe um artigo similar a este (ID: <strong>#${dupArticle.articleNumber}</strong>). Por favor, verifique se não é melhor editar o existente.</p>
            <div class="alert-actions">
                <button id="btn-dup-view" class="btn-primary">[Ver Existente]</button>
                <button id="btn-dup-continue" class="btn-secondary">[Continuar Criando]</button>
            </div>
        </div>
    `;
    
    attachToOverlay(modal);
    
    document.getElementById('btn-dup-view').addEventListener('click', () => { 
        window.__kcs.closeModal('duplicity-modal', true);
        window.__kcs.closeModal('article-modal', false); 
        if(window.__kcs) window.__kcs.viewArticle(dupArticle.id); 
    });
    
    document.getElementById('btn-dup-continue').addEventListener('click', () => { 
        window.__kcs.closeModal('duplicity-modal', true);
        if(onContinue) onContinue(); 
    });
}

export function openReadmeModal(readmeMarkdown) {
    const modal = document.createElement('div');
    modal.id = 'readme-modal';
    modal.className = 'modal-container document-box';
    modal.dataset.title = 'README';

    modal.innerHTML = `
        <div class="modal-content-box">
            <div class="modal-header">
                <h2 class="modal-title">📖 Documentação (README)</h2>
                <div class="modal-controls">
                    <button id="btn-readme-close" class="btn-icon btn-close"><i class="ph ph-x"></i></button>
                </div>
            </div>
            <div class="modal-body markdown-body">
                ${readmeMarkdown}
            </div>
        </div>
    `;
    
    attachToOverlay(modal);
    document.getElementById('btn-readme-close').addEventListener('click', () => window.__kcs.closeModal('readme-modal', true));
}

// ==========================================
// MÓDULOS DE SQL
// ==========================================

// ==========================================
// MDI TAB: BIBLIOTECA SQL (CRIAÇÃO/EDIÇÃO)
// ==========================================
export function openSqlModal(script = null, onSave) {
    const idUnico = script?.id || `sql-novo-${Date.now()}`;
    const tituloAba = script ? `SQL: ${script.name}` : 'Novo Script SQL';

    // 1. Definição das opções de Banco de Dados (Mantendo a lógica original)
    const SQL_DB_TYPES = [
        { value: 'mysql', label: 'MySQL' },
        { value: 'postgres', label: 'PostgreSQL' },
        { value: 'sqlserver', label: 'SQL Server' },
        { value: 'oracle', label: 'Oracle DB' }
    ];

    const typeOptions = SQL_DB_TYPES.map(t => 
        `<option value="${t.value}" ${script?.dbType === t.value ? 'selected' : ''}>${t.label}</option>`
    ).join('');

    // 2. Criar o Contêiner do Formulário dinâmico
    const formContainer = document.createElement('form');
    formContainer.className = 'flex flex-col h-full';
    formContainer.id = `form-${idUnico}`;

    // 3. Montar o HTML do formulário com IDs escopados por aba
    formContainer.innerHTML = `
        <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
            <div class="form-group">
                <label class="form-label">Nome do Script *</label>
                <input type="text" id="sql-name-${idUnico}" placeholder="Ex: Corrige CFOP Nulo na Tabela Produtos" class="form-input" required value="${script?.name || ''}" />
            </div>
            
            <div class="form-row-split">
                <div class="form-group">
                    <label class="form-label">Banco de Dados</label>
                    <select id="sql-db-type-${idUnico}" class="form-select">${typeOptions}</select>
                </div>
                <div class="form-group">
                    <label class="form-label">Operação</label>
                    <select id="sql-category-${idUnico}" class="form-select">
                        <option value="SELECT" ${script?.sqlCategory === 'SELECT' ? 'selected' : ''}>Consulta (SELECT)</option>
                        <option value="UPDATE" ${script?.sqlCategory === 'UPDATE' ? 'selected' : ''}>Alteração (UPDATE/INSERT)</option>
                        <option value="DELETE" ${script?.sqlCategory === 'DELETE' ? 'selected' : ''}>Exclusão (DELETE/DROP)</option>
                    </select>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Descrição</label>
                <input type="text" id="sql-desc-${idUnico}" placeholder="O que esse script resolve na prática?" class="form-input" value="${script?.description || ''}" />
            </div>
            
            <div class="form-group">
                <label class="form-label">Código SQL *</label>
                <textarea id="sql-code-${idUnico}" rows="12" placeholder="SELECT * FROM table..." class="form-textarea code-editor font-mono text-sm bg-[#1e1e1e] text-[#d4d4d4] border-border-subtle" required>${script?.code || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label class="form-label">Visibilidade</label>
                <select id="sql-visibility-${idUnico}" class="form-select">
                    <option value="${VISIBILITY.PUBLIC}" ${script?.visibility === VISIBILITY.PUBLIC ? 'selected' : ''}>🌍 Público (Empresa)</option>
                    <option value="${VISIBILITY.PRIVATE}" ${script?.visibility === VISIBILITY.PRIVATE ? 'selected' : ''}>🔒 Privado (Setor)</option>
                </select>
            </div>
        </div>

        <div class="flex flex-col sm:flex-row justify-end gap-3 px-4 sm:px-6 py-4 border-t border-border-subtle bg-bg-main/50 pb-4 shrink-0">
            <button type="button" class="btn-secondary btn-cancel-sql-tab">Cancelar</button>
            <button type="submit" class="btn-primary">Salvar Script</button>
        </div>
    `;

    // 4. Lógica de Cancelamento
    formContainer.querySelector('.btn-cancel-sql-tab').addEventListener('click', () => {
        window.TabManager.closeTab(idUnico);
    });

    // 5. Interceptador de Envio (Submit)
    formContainer.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Remove o estado de "não salvo" antes de fechar
        window.TabManager.markDirty(idUnico, false);

        onSave({ 
            name: document.getElementById(`sql-name-${idUnico}`).value, 
            description: document.getElementById(`sql-desc-${idUnico}`).value, 
            code: document.getElementById(`sql-code-${idUnico}`).value, 
            dbType: document.getElementById(`sql-db-type-${idUnico}`).value, 
            sqlCategory: document.getElementById(`sql-category-${idUnico}`).value, 
            visibility: document.getElementById(`sql-visibility-${idUnico}`).value, 
            statusRequest: 'approved' 
        });

        window.TabManager.closeTab(idUnico, true);
    });

    // 6. Abrir na Interface de Abas
    window.TabManager.openTab(idUnico, tituloAba, 'ph-database', formContainer);

    // Foco automático no título para melhorar a experiência
    requestAnimationFrame(() => {
        document.getElementById(`sql-name-${idUnico}`)?.focus();
    });
}

// ==========================================
// MDI TAB: VISUALIZADOR DE SCRIPT SQL (DESIGN IDE)
// ==========================================
export function openSqlViewModal(script) {
    const idUnico = `view-sql-${script.id}`;
    const tituloAba = script.scriptNumber ? `#SQL-${script.scriptNumber}` : script.name;
    
    const safeText = (str) => { 
        if(!str) return ''; 
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); 
    };
    
    const currentUser = getCurrentUser();
    const userId = currentUser?.uid || currentUser?.id;
    const isFav = (script.favorites || []).includes(userId);
    const isLiked = (script.likes || []).includes(userId);

    const container = document.createElement('div');
    container.className = 'flex flex-col h-full bg-editor-background';
    container.id = `view-container-${idUnico}`;
    container.style.backgroundColor = 'var(--color-editor-background)';

    container.innerHTML = `
        <div class="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar modal-zoomable relative">
            
            ${script.status === 'review' || script.status === 'pendente_revisao' ? `
            <div class="w-full mb-8 kcs-badge-warning px-5 py-4 rounded-lg flex items-center gap-3 text-sm shadow-sm">
                <i class="ph-fill ph-warning-circle text-2xl"></i>
                <span><strong>Atenção:</strong> Este script foi sinalizado ou está em revisão. Execute com cautela.</span>
            </div>` : ''}

            <div class="w-full">
                
                <div class="mb-8 pb-6 border-b border-border-subtle">
                    <div class="flex items-center gap-3 mb-4">
                        <i class="ph-bold ph-database text-purple-500 text-3xl"></i>
                        <h1 class="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight" style="color: var(--color-text-primary);">${safeText(script.name)}</h1>
                    </div>
                    
                    <div class="flex flex-wrap items-center gap-2.5 mb-4">
                        ${script.scriptNumber ? `<span class="kcs-badge-id px-2.5 py-1 text-[12px] rounded">#SQL-${script.scriptNumber}</span>` : ''}
                        <span class="kcs-badge-tag px-3 py-1 text-[11px] rounded-full">${safeText(script.dbType)}</span>
                        ${script.visibility === VISIBILITY.PRIVATE ? `<span class="kcs-badge-warning px-2.5 py-1 text-[12px] rounded flex items-center gap-1.5"><i class="ph-bold ph-lock"></i> Privado</span>` : `<span class="kcs-badge-success px-2.5 py-1 text-[12px] rounded flex items-center gap-1.5"><i class="ph-bold ph-globe"></i> Público</span>`}
                    </div>
                    <p class="text-[14.5px] leading-relaxed" style="color: var(--color-text-secondary);">${safeText(script.description)}</p>
                </div>
                
                <div class="kcs-surface-elevated rounded-xl overflow-hidden shadow-sm mb-12">
                    <div class="flex justify-between items-center px-4 py-2 border-b border-border-subtle" style="background-color: rgba(0,0,0,0.05);">
                        <div class="flex items-center gap-2">
                            <i class="ph-fill ph-file-code text-gray-400"></i>
                            <span class="text-xs font-mono text-gray-500">query.sql</span>
                        </div>
                        <button id="btn-copy-code-${idUnico}" class="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-500 transition-colors">
                            <i class="ph-bold ph-copy"></i> Copiar Código
                        </button>
                    </div>
                    <pre class="p-6 overflow-x-auto text-sm font-mono leading-relaxed" style="color: var(--color-text-primary);"><code>${safeText(script.code)}</code></pre>
                </div>
            </div>

            <div class="w-full mt-16 pt-8 border-t border-border-subtle">
                <h4 class="text-[12px] font-bold uppercase tracking-widest mb-6 flex items-center gap-2" style="color: var(--color-text-muted);"><i class="ph-fill ph-chats text-base text-purple-500"></i> Observações Técnicas</h4>
                
                <div class="kcs-surface-elevated mb-8 rounded-xl overflow-hidden shadow-sm focus-within:ring-1 focus-within:ring-purple-500 transition-all">
                    <textarea id="inline-sql-comment-${idUnico}" rows="2" placeholder="Comente sobre a eficácia, segurança ou melhorias nesta query..." class="w-full bg-transparent p-4 outline-none resize-y min-h-[70px] text-[14px]" style="color: var(--color-text-inverse);"></textarea>
                    <div class="flex justify-end p-3 border-t border-border-subtle" style="background-color: rgba(0,0,0,0.05);">
                        <button type="button" id="btn-send-sql-comment-${idUnico}" class="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors">
                            <i class="ph-bold ph-paper-plane-right"></i> Publicar Observação
                        </button>
                    </div>
                </div>

                <div id="inline-sql-list-${idUnico}" class="space-y-4">
                    ${script.comments && script.comments.length > 0 ? script.comments.map(c => `
                        <div class="kcs-surface-elevated p-5 rounded-xl shadow-sm">
                            <div class="flex items-center justify-between mb-3">
                                <span class="text-[13px] font-bold" style="color: var(--color-text-inverse);">${safeText(c.userName)}</span>
                                <span class="text-[11px]" style="color: var(--color-text-muted);">${new Date(c.date).toLocaleString('pt-BR')}</span>
                            </div>
                            <p class="text-[14px] leading-relaxed font-mono" style="color: var(--color-text-primary);">${safeText(c.text)}</p>
                        </div>
                    `).join('') : '<p class="text-[13px] italic empty-comment-msg" style="color: var(--color-text-muted);">Nenhuma anotação sobre esta query.</p>'}
                </div>
            </div>
            
            <div class="h-12"></div>
        </div>

        <div class="kcs-surface-elevated flex flex-col sm:flex-row justify-between items-center gap-3 px-6 py-3.5 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] border-l-0 border-r-0 border-b-0">
            <div class="flex items-center gap-2">
                <button class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors" style="color: var(--color-text-primary);" onmouseover="this.style.backgroundColor='var(--color-hover)'" onmouseout="this.style.backgroundColor='transparent'" data-action="toggle-sql-like">
                    <i class="${isLiked ? 'ph-fill text-red-500' : 'ph text-gray-400'} ph-heart text-lg"></i> Útil (<span id="sql-like-count-${idUnico}">${(script.likes || []).length}</span>)
                </button>
                <button class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors" style="color: var(--color-text-primary);" onmouseover="this.style.backgroundColor='var(--color-hover)'" onmouseout="this.style.backgroundColor='transparent'" data-action="focus-sql-comment">
                    <i class="ph-fill ph-chat-circle text-purple-500 text-lg"></i> Anotar (<span id="sql-comment-count-${idUnico}">${(script.comments || []).length}</span>)
                </button>
                <button class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors" style="color: var(--color-text-primary);" onmouseover="this.style.backgroundColor='var(--color-hover)'" onmouseout="this.style.backgroundColor='transparent'" data-action="toggle-sql-fav">
                    <i class="${isFav ? 'ph-fill text-yellow-500' : 'ph text-gray-400'} ph-star text-lg"></i> ${isFav ? 'Salvo' : 'Favoritar'}
                </button>
            </div>

            <div class="flex items-center gap-2">
                <button class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-yellow-500 hover:bg-yellow-500/10 border border-yellow-500/20 transition-colors" data-action="explain-sql">
                    <i class="ph-fill ph-lightbulb text-lg"></i> Explicar Código
                </button>
                <button class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors" style="color: var(--color-text-primary);" onmouseover="this.style.backgroundColor='var(--color-hover)'" onmouseout="this.style.backgroundColor='transparent'" data-action="open-sql-history">
                    <i class="ph-bold ph-clock-counter-clockwise text-gray-400 text-lg"></i> Histórico
                </button>
                <button class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors" data-action="flag-sql">
                    <i class="ph-bold ph-warning-circle text-lg"></i> Reportar
                </button>
                ${hasPermission('manage_sql') || script.createdById === userId ? `
                    <div class="w-px h-5 mx-2" style="background-color: var(--color-border);"></div>
                    <button class="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-sm transition-colors" data-action="edit-sql">
                        <i class="ph-bold ph-pencil-simple text-lg"></i> Editar
                    </button>
                ` : ''}
            </div>
        </div>
    `;

    // Botão de Copiar (Comportamento realocado e blindado)
    container.querySelector(`#btn-copy-code-${idUnico}`).addEventListener('click', async (e) => {
        try {
            await navigator.clipboard.writeText(script.code);
            const btn = e.currentTarget;
            btn.innerHTML = '<i class="ph-fill ph-check-circle text-green-500"></i> Copiado!';
            setTimeout(() => btn.innerHTML = '<i class="ph-bold ph-copy"></i> Copiar Código', 2000);
        } catch (err) {
            window.__kcs.showToast('Falha ao copiar.', 'error');
        }
    });

    // Lógica do Comentário SQL
    const btnSendSqlComment = container.querySelector(`#btn-send-sql-comment-${idUnico}`);
    const inputSqlComment = container.querySelector(`#inline-sql-comment-${idUnico}`);
    const sqlCommentsList = container.querySelector(`#inline-sql-list-${idUnico}`);

    btnSendSqlComment.addEventListener('click', async () => {
        const text = inputSqlComment.value.trim();
        if (!text) return;

        try {
            btnSendSqlComment.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Publicando...';
            btnSendSqlComment.disabled = true;

            const { addSqlComment } = await import('../services/sqlLibrary.js');
            await addSqlComment(script.id, text);

            const emptyMsg = sqlCommentsList.querySelector('.empty-comment-msg');
            if (emptyMsg) emptyMsg.remove();

            sqlCommentsList.insertAdjacentHTML('beforeend', `
                <div class="p-5 rounded-xl shadow-sm animate-fade-in" style="background-color: var(--color-sidebar-background); border: 1px solid var(--color-border-subtle);">
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-[13px] font-bold" style="color: var(--color-text-inverse);">${safeText(currentUser?.displayName || 'Você')}</span>
                        <span class="text-[11px] text-purple-500 font-semibold">Agora mesmo</span>
                    </div>
                    <p class="text-[14px] leading-relaxed font-mono" style="color: var(--color-text-primary);">${safeText(text)}</p>
                </div>
            `);
            inputSqlComment.value = ''; 

            const countSpan = container.querySelector(`#sql-comment-count-${idUnico}`);
            if (countSpan) countSpan.innerText = parseInt(countSpan.innerText) + 1;

            window.__kcs.showToast('Observação salva!', 'success');
        } catch(e) {
            window.__kcs.showToast('Erro ao salvar.', 'error');
        } finally {
            btnSendSqlComment.innerHTML = '<i class="ph-bold ph-paper-plane-right"></i> Publicar Observação';
            btnSendSqlComment.disabled = false;
        }
    });

    // Focus Comentário
    container.querySelector('[data-action="focus-sql-comment"]').addEventListener('click', () => {
        inputSqlComment.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => inputSqlComment.focus(), 300);
    });

    // Demais ações
    container.querySelector('[data-action="explain-sql"]').addEventListener('click', () => window.__kcs.explainSql(script.id));
    container.querySelector('[data-action="toggle-sql-like"]').addEventListener('click', () => window.__kcs.toggleSqlLike(script.id));
    container.querySelector('[data-action="toggle-sql-fav"]').addEventListener('click', () => window.__kcs.toggleSqlFavorite(script.id));
    container.querySelector('[data-action="open-sql-history"]').addEventListener('click', () => window.__kcs.openHistory(script.id, 'sql'));
    container.querySelector('[data-action="flag-sql"]').addEventListener('click', () => window.__kcs.flagSqlScript(script.id));

    const btnEdit = container.querySelector('[data-action="edit-sql"]');
    if (btnEdit) {
        btnEdit.addEventListener('click', () => {
            window.TabManager.closeTab(idUnico, true);
            window.__kcs.editSqlScript(script.id);
        });
    }

    // Injetar na Aba com ícone diferente
    window.TabManager.openTab(idUnico, tituloAba, 'ph-database', container);
}

export function openHistoryModal(item, type) {
    const safeText = (str) => str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') : '';
    
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm animate-fade-in p-4';
    
    let historyListHtml = '<p class="text-gray-400 text-sm italic">Nenhum histórico de versões disponível.</p>';
    
    if (item.history && item.history.length > 0) {
        const reversedHistory = [...item.history].reverse();
        const totalVersions = item.history.length;
        
        historyListHtml = reversedHistory.map((h, reversedIndex) => {
            const originalIndex = totalVersions - 1 - reversedIndex;
            return `
            <div class="kcs-card-base mb-4 p-4 hover:border-blue-500/50">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="text-sm font-bold text-gray-200">Versão ${originalIndex + 1}</h4>
                        <p class="text-[11px] text-gray-500 mt-0.5">Salvo por <span class="text-gray-300 font-semibold">${safeText(h.updatedBy || 'Sistema')}</span> em ${new Date(h.updatedAt).toLocaleString()}</p>
                    </div>
                    <button class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded shadow-sm transition-colors" data-action="restore-history" data-index="${originalIndex}">
                        <i class="ph-bold ph-clock-counter-clockwise mr-1"></i> Restaurar
                    </button>
                </div>
                <div class="text-[13px] text-gray-400 line-clamp-2 leading-relaxed border-t border-[#3c3c3c] pt-2 mt-2">${safeText(h.title || h.name)}</div>
            </div>
            `;
        }).join('');
    }

    overlay.innerHTML = `
            <div class="kcs-modal-history max-w-2xl w-full h-[85vh] flex flex-col transform scale-100 transition-transform">
            <div class="p-5 border-b border-[#3c3c3c] flex justify-between items-center shrink-0 bg-[#2d2d2d] rounded-t-xl">
                <h2 class="text-lg font-bold text-gray-100 flex items-center gap-2"><i class="ph-bold ph-clock-counter-clockwise text-blue-500 text-xl"></i> Histórico de Versões</h2>
                <button class="text-gray-400 hover:text-red-500 transition-colors" id="btn-close-history"><i class="ph-bold ph-x text-xl"></i></button>
            </div>
            <div class="p-6 overflow-y-auto flex-1 custom-scrollbar rounded-b-xl">
                ${historyListHtml}
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);

    overlay.querySelector('#btn-close-history').onclick = () => overlay.remove();
    
    overlay.querySelectorAll('[data-action="restore-history"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            overlay.remove();
            window.__kcs.restoreVersion(item.id, type, btn.dataset.index);
        });
    });
}

// ==========================================
// MDI TAB: GERENCIADOR DE CATEGORIAS (BLINDADO E MINIMALISTA)
// ==========================================
export async function openCategoryModal(refreshCallback) {
    const idUnico = 'tab-category-manager';
    const container = document.createElement('div');
    container.className = 'flex flex-col h-full';
    container.id = `view-container-${idUnico}`;
    container.style.backgroundColor = 'var(--color-editor-background)';
    
    // Abre a aba imediatamente para feedback visual
    container.innerHTML = `<div class="p-10 flex items-center gap-3 text-orange-500"><i class="ph-bold ph-spinner animate-spin text-2xl"></i> Carregando estrutura de categorias...</div>`;
    window.TabManager.openTab(idUnico, 'Categorias', 'ph-folders', container);

    try {
        const { getFlatCategories, addCategory, removeCategory, updateCategory } = await import('../services/categories.js');

        // Montagem do HTML com Layout aprimorado e formulário enxuto
        container.innerHTML = `
            <div class="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                <div class="max-w-4xl mx-auto">
                    <div class="mb-8 pb-6" style="border-bottom: 1px solid var(--color-border-subtle);">
                        <h2 class="text-3xl font-extrabold mb-2 flex items-center gap-3" style="color: var(--color-text-inverse);">
                            <i class="ph-bold ph-folders text-orange-500"></i> Gerenciar Categorias
                        </h2>
                        <p class="text-sm" style="color: var(--color-text-secondary);">Organize a árvore de navegação lateral da sua base de conhecimento.</p>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-5 gap-8">
                        
                        <div class="md:col-span-3 space-y-3">
                            <h3 class="text-[11px] font-bold uppercase tracking-widest mb-4" style="color: var(--color-text-muted);">Categorias Existentes</h3>
                            <div id="category-list-${idUnico}" class="space-y-2"></div>
                        </div>

                        <div class="md:col-span-2">
                            <form id="category-form-${idUnico}" class="p-6 rounded-xl sticky top-0 shadow-sm flex flex-col gap-6" style="background-color: var(--color-sidebar-background); border: 1px solid var(--color-border-subtle);">
                                <div class="flex items-center gap-2" style="color: var(--color-text-muted);">
                                    <i class="ph-bold ph-folder-plus text-lg"></i>
                                    <h3 class="text-[12px] font-bold uppercase tracking-widest">Nova Categoria</h3>
                                </div>
                                
                                <div class="space-y-5">
                                    <div>
                                        <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: var(--color-text-muted);">Nome da Categoria *</label>
                                        <input type="text" id="cat-name-${idUnico}" placeholder="Ex: Financeiro" required class="w-full px-4 py-2.5 rounded-lg text-sm font-semibold outline-none focus:ring-1 focus:ring-orange-500 transition-all" style="background-color: var(--color-editor-background); color: var(--color-text-primary); border: 1px solid var(--color-border);" />
                                    </div>
                                    
                                    <div>
                                        <label class="block text-[11px] font-bold uppercase tracking-wider mb-2" style="color: var(--color-text-muted);">Hierarquia (Onde ela ficará?)</label>
                                        <select id="cat-parent-${idUnico}" class="w-full px-4 py-2.5 rounded-lg text-sm font-semibold outline-none focus:ring-1 focus:ring-orange-500 transition-all cursor-pointer" style="background-color: var(--color-editor-background); color: var(--color-text-primary); border: 1px solid var(--color-border);">
                                            <option value="">Raiz (Categoria Principal)</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <button type="submit" class="w-full mt-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold py-3 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2">
                                    Adicionar Categoria
                                </button>
                            </form>
                        </div>

                    </div>
                    <div class="h-12"></div>
                </div>
            </div>
        `;

        function renderList() {
            const select = container.querySelector(`#cat-parent-${idUnico}`);
            const list = container.querySelector(`#category-list-${idUnico}`);
            const categories = getFlatCategories();
            
            select.innerHTML = '<option value="">Raiz (Categoria Principal)</option>' + categories.map(c => `<option value="${c.id}">${c.path}</option>`).join('');
            
            list.innerHTML = categories.map(c => `
                <div class="flex items-center justify-between px-4 py-3 rounded-lg transition-colors group" style="background-color: var(--color-sidebar-background); border: 1px solid var(--color-border-subtle);" onmouseover="this.style.borderColor='var(--color-border)'" onmouseout="this.style.borderColor='var(--color-border-subtle)'">
                    <span class="text-[13.5px] font-bold flex items-center gap-3" style="color: var(--color-text-inverse);"><i class="ph-fill ph-folder text-orange-500 text-lg"></i> ${c.path}</span>
                    <div class="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="px-3 py-1.5 text-xs font-bold rounded transition-colors" style="color: var(--color-text-primary); background-color: var(--color-editor-background); border: 1px solid var(--color-border);" onmouseover="this.style.borderColor='var(--color-focus)'; this.style.color='var(--color-focus)';" onmouseout="this.style.borderColor='var(--color-border)'; this.style.color='var(--color-text-primary)';" data-action="edit-category" data-id="${c.id}" data-name="${c.name}" data-icon="${c.icon || ''}">Editar</button>
                        <button class="px-3 py-1.5 text-xs font-bold rounded text-red-500 transition-colors" style="background-color: var(--color-editor-background); border: 1px solid var(--color-border);" onmouseover="this.style.backgroundColor='rgba(239,68,68,0.1)';" onmouseout="this.style.backgroundColor='var(--color-editor-background)';" data-action="delete-category" data-id="${c.id}">Excluir</button>
                    </div>
                </div>
            `).join('') || '<p class="text-sm italic" style="color: var(--color-text-muted);">Nenhuma categoria cadastrada.</p>';

            list.querySelectorAll('[data-action="edit-category"]').forEach(btn => {
                btn.addEventListener('click', () => window.__kcs.editCategory(btn.dataset.id, btn.dataset.name, btn.dataset.icon));
            });
            list.querySelectorAll('[data-action="delete-category"]').forEach(btn => {
                btn.addEventListener('click', () => window.__kcs.deleteCategory(btn.dataset.id));
            });
        }

        // Funções atreladas ao objeto global para evitar vazamento
        window.__kcs.deleteCategory = (id) => { removeCategory(id); renderList(); if (refreshCallback) refreshCallback(); };
        window.__kcs.editCategory = async (id, currentName, currentIcon) => { 
            const newName = await window.__kcs.prompt('Novo nome da categoria:', currentName); 
            if (!newName) return; 
            // O ícone do prompt foi removido, preseramos o atual ou setamos o folder.
            updateCategory(id, { name: newName, icon: currentIcon || 'ph-folder' }); 
            renderList(); 
            if (refreshCallback) refreshCallback(); 
        };

        renderList();

        const form = container.querySelector(`#category-form-${idUnico}`);
        form.addEventListener('submit', (e) => { 
            e.preventDefault(); 
            const name = container.querySelector(`#cat-name-${idUnico}`).value; 
            const parentId = container.querySelector(`#cat-parent-${idUnico}`).value || null; 
            // Fixamos o ícone como ph-folder na criação
            const res = addCategory(parentId, name, 'ph-folder'); 
            
            if (res.success) { 
                container.querySelector(`#cat-name-${idUnico}`).value = ''; 
                renderList(); 
                if (refreshCallback) refreshCallback(); 
            } else { 
                window.__kcs.alert(res.message); 
            } 
        });

    } catch (e) {
        container.innerHTML = `<div class="p-10 text-red-500 font-bold">Erro fatal ao carregar o módulo de Categorias: <br><br>${e.message}</div>`;
        console.error(e);
    }
}

// ==========================================
// MDI TAB: ADMINISTRAÇÃO GERAL (COM OVERVIEW SAAS COMPLETO)
// ==========================================
export async function openSettingsModal() {
    const idUnico = 'tab-admin-panel';
    const container = document.createElement('div');
    container.className = 'flex flex-col h-full bg-editor-background';
    container.id = `view-container-${idUnico}`;
    container.style.backgroundColor = 'var(--color-editor-background)';

    container.innerHTML = `<div class="p-10 flex items-center gap-3 text-blue-500"><i class="ph-bold ph-spinner animate-spin text-2xl"></i> Buscando dados...</div>`;
    window.TabManager.openTab(idUnico, 'Administração', 'ph-gear-six', container);

    const safeText = (str) => str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';

    try {
        const isSuperAdmin = hasRole('super_admin');
        const currentUser = getCurrentUser();
        const users = await getAllUsersFromCloud();
        const invites = await getAllInvitedUsers();
        
        let companies = [];
        if (isSuperAdmin) {
            // Alteração Chave: Usar fetchCompaniesOverview para trazer o plano e a contagem de usuários
            const { fetchCompaniesOverview } = await import('../auth.js');
            companies = await fetchCompaniesOverview();
        }

        let companiesSelectOptions = '';
        if (isSuperAdmin) companiesSelectOptions = companies.map(c => `<option value="${c.companyId}">${c.companyName}</option>`).join('');
        else companiesSelectOptions = `<option value="${currentUser.companyId}">${currentUser.companyName}</option>`;
        
        const sectorsOptionsHtml = (userSector) => SECTORS.map(s => `<option value="${s.id}" ${userSector === s.id ? 'selected' : ''}>${s.name}</option>`).join('');

        let companiesHtml = '';
        if (isSuperAdmin) {
            companiesHtml = `
            <div class="mb-10">
                <h3 class="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style="color: var(--color-text-muted);"><i class="ph-fill ph-buildings text-purple-500 text-lg"></i> Painel Master (Empresas Clientes)</h3>
                
                <div class="flex gap-3 mb-4">
                    <input type="text" id="new-company-name" placeholder="Nome da Empresa" class="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none focus:ring-1 focus:ring-purple-500 transition-all" style="background-color: var(--color-sidebar-background); color: var(--color-text-primary); border: 1px solid var(--color-border);" />
                    <input type="text" id="new-company-domain" placeholder="Domínios (ex: nissei.com)" class="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono" style="background-color: var(--color-sidebar-background); color: var(--color-text-primary); border: 1px solid var(--color-border);" />
                    <button class="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors" data-action="create-company">Cadastrar Cliente</button>
                </div>
                
                <div class="rounded-xl overflow-hidden shadow-sm" style="background-color: var(--color-sidebar-background); border: 1px solid var(--color-border-subtle);">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr style="background-color: rgba(0,0,0,0.2); border-bottom: 1px solid var(--color-border-subtle);">
                                <th class="py-3 px-5 text-[11px] font-bold uppercase tracking-wider" style="color: var(--color-text-muted);">Empresa / Tenant</th>
                                <th class="py-3 px-5 text-[11px] font-bold uppercase tracking-wider" style="color: var(--color-text-muted);">Domínios</th>
                                <th class="py-3 px-5 text-[11px] font-bold uppercase tracking-wider" style="color: var(--color-text-muted);">Plano & Ocupação</th>
                                <th class="py-3 px-5 text-[11px] font-bold uppercase tracking-wider text-right" style="color: var(--color-text-muted);">Ações</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y" style="divide-color: var(--color-border-subtle);">
                            ${companies.map(c => {
                                const domainsLabel = (Array.isArray(c.domains) ? c.domains : (c.domains ? String(c.domains).split(',') : [])).join(', ') || 'Nenhum';
                                
                                // Lógica de cores para os Planos
                                let badgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                                if (c.plan?.toLowerCase() === 'teams') badgeClass = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
                                if (c.plan?.toLowerCase() === 'unlimited') badgeClass = 'bg-purple-500/10 text-purple-400 border-purple-500/20';

                                return `
                                <tr class="transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                                    <td class="py-4 px-5">
                                        <div class="font-bold text-[14px]" style="color: var(--color-text-inverse);">${safeText(c.companyName)}</div>
                                        <div class="text-[11px] font-mono mt-1" style="color: var(--color-text-secondary);">ID: ${c.companyId.toUpperCase()}</div>
                                    </td>
                                    <td class="py-4 px-5 text-sm" style="color: var(--color-text-primary);"><i class="ph ph-globe mr-1 text-gray-500"></i> ${safeText(domainsLabel)}</td>
                                    <td class="py-4 px-5">
                                        <div class="flex items-center gap-2 mb-1.5">
                                            <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${badgeClass}">${c.plan || 'Starter'}</span>
                                        </div>
                                        <div class="text-[11px] font-medium" style="color: var(--color-text-secondary);">
                                            <i class="ph-fill ph-users mr-1"></i> ${c.userCount} / ${c.maxUsers >= 9999 ? '∞' : c.maxUsers} vagas
                                        </div>
                                    </td>
                                    <td class="py-4 px-5 text-right">
                                        <button class="px-3 py-1.5 rounded text-xs font-semibold mr-2 transition-colors" style="background-color: var(--color-editor-background); color: var(--color-text-primary); border: 1px solid var(--color-border);" onmouseover="this.style.borderColor='var(--color-focus)'; this.style.color='var(--color-focus)';" onmouseout="this.style.borderColor='var(--color-border)'; this.style.color='var(--color-text-primary)';" data-action="edit-company" data-id="${c.companyId}" data-name="${safeText(c.companyName)}" data-domains="${safeText(domainsLabel)}" data-plan="${c.plan || 'Starter'}">Editar</button>
                                        <button class="p-1.5 rounded text-red-500 transition-colors" style="background-color: var(--color-editor-background); border: 1px solid var(--color-border);" onmouseover="this.style.backgroundColor='rgba(239,68,68,0.1)';" onmouseout="this.style.backgroundColor='var(--color-editor-background)';" data-action="delete-company" data-id="${c.companyId}"><i class="ph-bold ph-trash text-sm"></i></button>
                                    </td>
                                </tr>`;
                            }).join('') || `<tr><td colspan="4" class="py-6 text-center text-sm italic" style="color: var(--color-text-muted);">Nenhuma empresa cadastrada.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>`;
        }

        const invitesHtml = `
        <div class="mb-10">
            <h3 class="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style="color: var(--color-text-muted);"><i class="ph-fill ph-envelope-simple text-blue-500 text-lg"></i> Whitelist de Exceção (Convites)</h3>
            
            <form id="form-invite-user" class="flex flex-wrap gap-3 mb-4">
                <input type="email" id="invite-email" placeholder="E-mail (ex: nome@gmail.com)" class="flex-[2] px-4 py-2.5 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all" style="background-color: var(--color-sidebar-background); color: var(--color-text-primary); border: 1px solid var(--color-border);" required />
                ${isSuperAdmin ? `<select id="invite-company" class="flex-1 px-3 py-2.5 rounded-lg text-sm cursor-pointer" style="background-color: var(--color-sidebar-background); color: var(--color-text-primary); border: 1px solid var(--color-border);">${companiesSelectOptions}</select>` : `<input type="hidden" id="invite-company" value="${currentUser.companyId}" />`}
                <select id="invite-sector" class="flex-1 px-3 py-2.5 rounded-lg text-sm cursor-pointer" style="background-color: var(--color-sidebar-background); color: var(--color-text-primary); border: 1px solid var(--color-border);">${sectorsOptionsHtml('')}</select>
                <select id="invite-role" class="flex-1 px-3 py-2.5 rounded-lg text-sm cursor-pointer" style="background-color: var(--color-sidebar-background); color: var(--color-text-primary); border: 1px solid var(--color-border);">
                    ${isSuperAdmin ? `<option value="super_admin">Super Admin</option>` : ''}
                    <option value="admin">Admin</option>
                    <option value="analyst">Analista KCS</option>
                    <option value="user" selected>Usuário Base</option>
                </select>
                <button type="submit" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors">Autorizar</button>
            </form>
            
            <div class="rounded-xl overflow-hidden shadow-sm" style="background-color: var(--color-sidebar-background); border: 1px solid var(--color-border-subtle);">
                <table class="w-full text-left border-collapse">
                    <tbody class="divide-y" style="divide-color: var(--color-border-subtle);">
                        ${invites.map(inv => `
                            <tr class="transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                                <td class="py-3 px-5 flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center"><i class="ph-fill ph-envelope"></i></div>
                                    <div>
                                        <p class="font-bold text-[13px]" style="color: var(--color-text-inverse);">${safeText(inv.email)}</p>
                                        <p class="text-[11px] font-medium uppercase tracking-wider" style="color: var(--color-text-secondary);">${inv.role} | Setor: ${inv.sectorId}</p>
                                    </div>
                                </td>
                                <td class="py-3 px-5 text-right">
                                    <button class="px-3 py-1.5 rounded text-xs font-semibold text-red-500 transition-colors" style="background-color: var(--color-editor-background); border: 1px solid var(--color-border);" onmouseover="this.style.backgroundColor='rgba(239,68,68,0.1)';" onmouseout="this.style.backgroundColor='var(--color-editor-background)';" data-action="remove-invite" data-email="${inv.email}">Revogar</button>
                                </td>
                            </tr>
                        `).join('') || `<tr><td class="py-6 text-center text-sm italic" style="color: var(--color-text-muted);">Nenhum convite pendente.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>`;

        const activeUsersHtml = `
        <div class="mb-10">
            <h3 class="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style="color: var(--color-text-muted);"><i class="ph-fill ph-users text-green-500 text-lg"></i> Usuários Registrados</h3>
            <div class="rounded-xl overflow-hidden shadow-sm" style="background-color: var(--color-sidebar-background); border: 1px solid var(--color-border-subtle);">
                <table class="w-full text-left border-collapse">
                    <tbody class="divide-y" style="divide-color: var(--color-border-subtle);">
                        ${users.map(u => {
                            const safeName = (u.displayName && String(u.displayName) !== 'undefined') ? u.displayName : 'Usuário KCS';
                            const safeEmail = (u.email && String(u.email) !== 'undefined') ? u.email : 'Sem e-mail';
                            return `
                            <tr class="transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                                <td class="py-3 px-5 flex items-center gap-3">
                                    <img src="${u.photoURL || 'https://via.placeholder.com/40'}" class="w-8 h-8 rounded-full border" style="border-color: var(--color-border);" onerror="this.style.display='none'">
                                    <div>
                                        <p class="font-bold text-[13px]" style="color: var(--color-text-inverse);">${safeText(safeName)}</p>
                                        <p class="text-[12px]" style="color: var(--color-text-secondary);">${safeText(safeEmail)}</p>
                                    </div>
                                </td>
                                <td class="py-3 px-5 text-right">
                                    <div class="flex items-center justify-end gap-2">
                                        ${isSuperAdmin ? `
                                        <select class="px-2 py-1.5 rounded text-xs outline-none cursor-pointer" style="background-color: var(--color-editor-background); color: var(--color-text-primary); border: 1px solid var(--color-border);" data-action="update-company" data-id="${u.id}">
                                            <option value="LIMBO_TENANT" ${u.companyId === 'LIMBO_TENANT' ? 'selected' : ''}>⚠️ Pendente</option>
                                            ${companiesSelectOptions.replace(`value="${u.companyId}"`, `value="${u.companyId}" selected`)}
                                        </select>` : ''}
                                        <select class="px-2 py-1.5 rounded text-xs outline-none cursor-pointer" style="background-color: var(--color-editor-background); color: var(--color-text-primary); border: 1px solid var(--color-border);" data-action="update-sector" data-id="${u.id}">
                                            ${sectorsOptionsHtml(u.sectorId || 'TI')}
                                        </select>
                                        <select class="px-2 py-1.5 rounded text-xs outline-none cursor-pointer" style="background-color: var(--color-editor-background); color: var(--color-text-primary); border: 1px solid var(--color-border);" data-action="update-role" data-id="${u.id}">
                                            ${isSuperAdmin ? `<option value="super_admin" ${u.role === 'super_admin' ? 'selected' : ''}>Super Admin</option>` : ''}
                                            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                                            <option value="analyst" ${u.role === 'analyst' ? 'selected' : ''}>Analista</option>
                                            <option value="user" ${u.role === 'user' ? 'selected' : ''}>Usuário</option>
                                        </select>
                                        <button class="p-1.5 rounded text-red-500 transition-colors" style="background-color: var(--color-editor-background); border: 1px solid var(--color-border);" onmouseover="this.style.backgroundColor='rgba(239,68,68,0.1)';" onmouseout="this.style.backgroundColor='var(--color-editor-background)';" data-action="delete-user" data-id="${u.id}"><i class="ph-bold ph-trash text-sm"></i></button>
                                    </div>
                                </td>
                            </tr>`;
                        }).join('') || `<tr><td colspan="2" class="py-6 text-center text-sm italic" style="color: var(--color-text-muted);">Nenhum usuário ativo.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>`;

        const backupHtml = isSuperAdmin ? `
        <div class="mb-10 p-6 rounded-xl border border-green-500/20 bg-green-500/5">
            <h3 class="text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2 text-green-500"><i class="ph-fill ph-hard-drives text-lg"></i> Proteção de Dados e Backup</h3>
            <p class="text-sm text-gray-400 mb-4 leading-relaxed">O backup exporta toda a base para o Bucket isolado de Cloud Storage.</p>
            <button class="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2" data-action="trigger-backup">
                <i class="ph-bold ph-cloud-arrow-down"></i> Disparar Backup
            </button>
        </div>` : '';

        // Juntar tudo e atualizar o Container
        container.innerHTML = `
            <div class="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                <div class="max-w-6xl mx-auto">
                    <div class="mb-8 pb-6" style="border-bottom: 1px solid var(--color-border-subtle);">
                        <h2 class="text-3xl font-extrabold mb-2 flex items-center gap-3" style="color: var(--color-text-inverse);">
                            <i class="ph-bold ph-gear-six text-blue-500"></i> Administração do Sistema
                        </h2>
                        <p class="text-sm" style="color: var(--color-text-secondary);">Gerencie permissões, usuários e configurações estruturais da plataforma.</p>
                    </div>
                    ${companiesHtml}
                    ${invitesHtml}
                    ${activeUsersHtml}
                    ${backupHtml}
                    <div class="h-12"></div>
                </div>
            </div>
        `;

        // Ligar Eventos
        container.querySelectorAll('[data-action="create-company"]').forEach(btn => btn.addEventListener('click', () => window.__kcs.createNewCompany()));
        container.querySelectorAll('[data-action="edit-company"]').forEach(btn => btn.addEventListener('click', (e) => {
            const ds = e.currentTarget.dataset;
            window.__kcs.promptEditCompany(ds.id, ds.name, ds.domains, ds.plan);
        }));
        container.querySelectorAll('[data-action="delete-company"]').forEach(btn => btn.addEventListener('click', (e) => window.__kcs.deleteCompany(e.currentTarget.dataset.id)));
        container.querySelectorAll('[data-action="remove-invite"]').forEach(btn => btn.addEventListener('click', (e) => window.__kcs.removeInvite(e.currentTarget.dataset.email)));
        container.querySelectorAll('[data-action="update-company"]').forEach(sel => sel.addEventListener('change', (e) => window.__kcs.updateUserCompany(e.currentTarget.dataset.id, e.target.value)));
        container.querySelectorAll('[data-action="update-sector"]').forEach(sel => sel.addEventListener('change', (e) => window.__kcs.updateUserSector(e.currentTarget.dataset.id, e.target.value)));
        container.querySelectorAll('[data-action="update-role"]').forEach(sel => sel.addEventListener('change', (e) => window.__kcs.updateUserRole(e.currentTarget.dataset.id, e.target.value)));
        container.querySelectorAll('[data-action="delete-user"]').forEach(btn => btn.addEventListener('click', (e) => window.__kcs.deleteUser(e.currentTarget.dataset.id)));
        container.querySelectorAll('[data-action="trigger-backup"]').forEach(btn => btn.addEventListener('click', () => window.__kcs.triggerManualBackup()));

        const formInvite = container.querySelector('#form-invite-user');
        if (formInvite) {
            formInvite.addEventListener('submit', async (e) => {
                e.preventDefault();
                const em = container.querySelector('#invite-email').value;
                const cp = container.querySelector('#invite-company')?.value || currentUser.companyId;
                const sc = container.querySelector('#invite-sector').value;
                const rl = container.querySelector('#invite-role').value;
                await window.__kcs.inviteUser(em, rl, cp, sc);
            });
        }

    } catch (e) { 
        container.innerHTML = `<div class="p-10 text-red-500 font-bold">Erro de permissão ou conexão: ${e.message}</div>`; 
    }
}

export function asyncAlert(message) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm animate-fade-in p-4';
    overlay.innerHTML = `
            <div class="kcs-modal-dialog max-w-sm w-full p-6 text-center transform scale-100">
            <i class="ph-fill ph-info text-5xl text-blue-500 mb-4 drop-shadow-lg"></i>
            <h2 class="text-lg font-bold text-gray-100 mb-2">Aviso</h2>
            <p class="text-[14px] text-gray-300 mb-8 leading-relaxed">${message}</p>
            <button class="w-full py-2.5 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors" id="btn-alert-ok">Entendi</button>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#btn-alert-ok').onclick = () => overlay.remove();
}

export function asyncPrompt(message, defaultVal = '') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm animate-fade-in p-4';
        overlay.innerHTML = `
                <div class="kcs-modal-dialog max-w-md w-full p-6 transform scale-100">    
                <div class="flex items-center gap-3 mb-4">
                    <i class="ph-fill ph-pencil-simple text-2xl text-blue-500"></i>
                    <h2 class="text-base font-bold text-gray-100">Entrada Necessária</h2>
                </div>
                <label class="block text-sm text-gray-300 mb-3">${message}</label>
                <input type="text" id="dynamic-prompt-input" class="kcs-form-input px-4 py-3 mb-6" value="${defaultVal}">
                <div class="flex justify-end gap-3">
                    <button class="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-400 hover:text-white hover:bg-[#333333] transition-colors" id="btn-prompt-cancel">Cancelar</button>
                    <button class="px-5 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors" id="btn-prompt-confirm">Confirmar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        const input = overlay.querySelector('#dynamic-prompt-input');
        // Pequeno delay para garantir que a renderização terminou antes de focar
        setTimeout(() => input.focus(), 50);

        const cleanup = () => overlay.remove();

        overlay.querySelector('#btn-prompt-cancel').onclick = () => { cleanup(); resolve(null); };
        overlay.querySelector('#btn-prompt-confirm').onclick = () => { cleanup(); resolve(input.value); };
        
        input.onkeydown = (e) => {
            if (e.key === 'Enter') { cleanup(); resolve(input.value); }
            if (e.key === 'Escape') { cleanup(); resolve(null); }
        };
    });
}

export function openConfirmModal(msg, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-sm animate-fade-in p-4';
    overlay.innerHTML = `
        <div class="kcs-modal-dialog max-w-md w-full p-6 transform scale-100">  
            <div class="flex items-center gap-3 mb-4">
                <i class="ph-fill ph-warning-circle text-3xl text-yellow-500"></i>
                <h2 class="text-lg font-bold text-gray-100">Confirmação</h2>
            </div>
            <p class="text-[14px] text-gray-300 mb-8 leading-relaxed">${msg}</p>
            <div class="flex justify-end gap-3">
                <button class="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-400 hover:text-white hover:bg-[#333333] transition-colors" id="btn-confirm-no">Cancelar</button>
                <button class="px-5 py-2.5 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white shadow-md transition-colors" id="btn-confirm-yes">Confirmar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    const cleanup = () => overlay.remove();
    
    overlay.querySelector('#btn-confirm-no').onclick = cleanup;
    overlay.querySelector('#btn-confirm-yes').onclick = async () => { 
        cleanup(); 
        await onConfirm(); 
    };
}


// ==========================================
// BRIDGES DE COMPATIBILIDADE (ES MODULES)
// Garante que o main.js consiga importar as funções de fechamento
// redirecionando-as para a nova API unificada do Overlay-root.
// ==========================================

export function closeArticleModal() {
    if (window.__kcs && window.__kcs.closeModal) {
        window.__kcs.closeModal('article-modal', false);
    }
}

export function closeSqlModal() {
    if (window.__kcs && window.__kcs.closeModal) {
        window.__kcs.closeModal('sql-modal', false);
    }
}

export function closeViewModal(modalId = 'view-modal') {
    if (window.__kcs && window.__kcs.closeModal) {
        // Se o modal for dinâmico, ele repassará o ID, senão tenta fechar o estático antigo
        window.__kcs.closeModal(modalId, modalId !== 'view-modal');
    }
}