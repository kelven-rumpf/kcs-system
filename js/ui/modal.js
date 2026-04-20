import { getCurrentUser, hasPermission, hasRole, getAllUsersFromCloud, getAllCompaniesFromCloud, getAllInvitedUsers } from '../auth.js';
import { initEditor } from './editor.js'; 
import { formatContentForView } from './render.js'; 
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
// MODAL: NOVA DOCUMENTAÇÃO (CRIAÇÃO/EDIÇÃO)
// ==========================================
export function openArticleModal(article = null, onSave, rebindToolbar) {
    const modal = document.getElementById('article-modal');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('article-form');
    const formBody = document.getElementById('article-form-body');
    const footer = document.getElementById('article-form-footer');
    
    if (!modal || !form || !formBody) return;

    attachToOverlay(modal);

    if (title && !document.getElementById('btn-controls-article')) {
        const headerDiv = title.parentElement;
        if (headerDiv) {
            headerDiv.className = 'modal-header';
            safeBindEvent(headerDiv, 'click', (e) => {
                if (e.target.closest('button')) return;
                if (modal.classList.contains('kcs-minimized')) window.__kcs.toggleMinimize('article-modal');
            });

            title.className = 'modal-title';
            if (!title.querySelector('i')) {
                const originalText = title.textContent || 'Nova Documentação KCS';
                title.innerHTML = `<i class="ph-fill ph-pencil-simple text-blue-500"></i> <span>${originalText}</span>`;
            }

            const closeBtn = headerDiv.querySelector('button'); 
            const controlsDiv = document.createElement('div');
            controlsDiv.id = 'btn-controls-article';
            controlsDiv.className = 'modal-controls';

            const minBtn = document.createElement('button');
            minBtn.innerHTML = '<i class="ph-bold ph-minus"></i>';
            minBtn.className = 'btn-icon';
            minBtn.title = "Minimizar";
            minBtn.type = 'button';
            minBtn.addEventListener('click', (e) => { e.stopPropagation(); window.__kcs.toggleMinimize('article-modal'); });
            
            const maxBtn = document.createElement('button');
            maxBtn.innerHTML = '<i class="ph-bold ph-arrows-out-simple"></i>';
            maxBtn.className = 'btn-icon btn-max';
            maxBtn.title = "Expandir";
            maxBtn.type = 'button';
            maxBtn.addEventListener('click', (e) => { e.stopPropagation(); window.__kcs.toggleMaximize('article-modal'); });

            if (closeBtn) {
                closeBtn.className = 'btn-icon btn-close';
                closeBtn.innerHTML = '<i class="ph-bold ph-x"></i>';
                closeBtn.addEventListener('click', (e) => { e.stopPropagation(); window.__kcs.closeModal('article-modal', false); });
                
                controlsDiv.appendChild(minBtn);
                controlsDiv.appendChild(maxBtn);
                controlsDiv.appendChild(closeBtn);
                headerDiv.appendChild(controlsDiv);
            }
        }
    }

    const user = getCurrentUser();
    const authorName = article ? article.createdBy : user.displayName;
    const kcsNum = article?.articleNumber ? `KCS-${article.articleNumber}` : 'Gerado ao salvar';

    const flatCategories = getFlatCategories();
    const categoryOptions = flatCategories.map(c => 
        `<option value="${c.id}" ${article?.categoryId === c.id || article?.category === c.id ? 'selected' : ''}>${c.path}</option>`
    ).join('');

    modal.dataset.title = article?.title ? `Edit: ${article.title}` : 'Novo Procedimento';

   formBody.innerHTML = `
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
                <p class="alert-text">Não perca tempo preenchendo caixas. Descreva o problema, a causa, a solução e as imagens na caixa de <strong>Passo a Passo</strong> e clique em <strong class="badge-indigo">✨ Refinar Conteúdo</strong>.</p>
            </div>
        </div>
        
        <div class="form-group">
            <label class="form-label">Título *</label>
            <input type="text" id="article-title" placeholder="Deixe em branco e a IA deduzirá para você..." class="form-input" value="${article?.title || ''}" />
        </div>
        
        <div class="form-row-split">
            <div class="form-group">
                <label class="form-label">Sintoma / Problema</label>
                <textarea id="article-symptom" rows="2" placeholder="Auto-preenchido via IA..." class="form-textarea">${article?.symptom || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Ambiente</label>
                <textarea id="article-environment" rows="2" placeholder="Auto-preenchido via IA..." class="form-textarea">${article?.environment || ''}</textarea>
            </div>
        </div>
        
        <div class="form-group">
            <label class="form-label">Causa</label>
            <textarea id="article-cause" rows="2" placeholder="Auto-preenchido via IA..." class="form-textarea">${article?.cause || ''}</textarea>
        </div>
        <div class="form-group">
            <label class="form-label">Solução</label>
            <textarea id="article-solution" rows="2" placeholder="Auto-preenchido via IA..." class="form-textarea">${article?.solution || ''}</textarea>
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
                    <button id="btn-ia-reescrever" type="button" class="btn-ia btn-ia-reescrever"><i class="ph-fill ph-magic-wand"></i> Refinar</button>
                    <button id="btn-ia-corrigir" type="button" class="btn-ia btn-ia-corrigir"><i class="ph-fill ph-text-aa"></i> Gramática</button>
                </div>
            </div>
            <div id="article-body" contenteditable="true" class="editor-content modal-zoomable"></div>
        </div>
        
        <div class="form-row-multi">
            <div class="form-group">
                <label class="form-label">Categoria</label>
                <select id="article-category" class="form-select">${categoryOptions}</select>
            </div>
            <div class="form-group">
                <label class="form-label">Visibilidade</label>
                <select id="article-visibility" class="form-select">
                    <option value="${VISIBILITY.PUBLIC}" ${article?.visibility === VISIBILITY.PUBLIC ? 'selected' : ''}>🌍 Público</option>
                    <option value="${VISIBILITY.PRIVATE}" ${article?.visibility === VISIBILITY.PRIVATE ? 'selected' : ''}>🔒 Privado</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Tags (Vírgula)</label>
                <input type="text" id="article-tags" class="form-input" value="${(article?.tags || []).join(', ')}" />
            </div>
        </div>
    `;

    const editorCorpo = document.getElementById('article-body');
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
    
    initEditor('article-body');

    const canPublish = hasPermission('validate_article');
    footer.innerHTML = `
        <button type="button" id="btn-cancel-article-footer" class="btn-secondary">Cancelar</button>
        <button type="submit" id="btn-draft-direct" class="btn-neutral">Salvar Rascunho</button>
        ${canPublish ? `<button type="submit" id="btn-publish-direct" class="btn-primary">Salvar e Aprovar</button>` : ''}
    `;

    let submitAction = 'draft';
    safeBindEvent(document.getElementById('btn-draft-direct'), 'click', () => { submitAction = 'draft'; });
    if (canPublish) safeBindEvent(document.getElementById('btn-publish-direct'), 'click', () => { submitAction = 'approved'; });

    safeBindEvent(form, 'submit', (e) => {
        e.preventDefault();
        const titleValue = document.getElementById('article-title')?.value?.trim();
        if (!titleValue) return alert("Por favor, preencha o Título."); 
        
        onSave({ 
            title: titleValue, 
            symptom: document.getElementById('article-symptom')?.value?.trim() || '', 
            environment: document.getElementById('article-environment')?.value?.trim() || '', 
            cause: document.getElementById('article-cause')?.value?.trim() || '', 
            solution: document.getElementById('article-solution')?.value?.trim() || '', 
            steps: document.getElementById('article-body')?.innerHTML || '', 
            categoryId: document.getElementById('article-category')?.value || '', 
            visibility: document.getElementById('article-visibility')?.value || VISIBILITY.PUBLIC,
            tags: (document.getElementById('article-tags')?.value || '').split(',').map(t => t.trim()).filter(Boolean), 
            statusRequest: submitAction 
        }, article?.id || null);
        window.__kcs.closeModal('article-modal', false);
    });

    if (rebindToolbar) rebindToolbar();
    safeBindEvent(document.getElementById('btn-cancel-article'), 'click', () => window.__kcs.closeModal('article-modal', false));
    safeBindEvent(document.getElementById('btn-cancel-article-footer'), 'click', () => window.__kcs.closeModal('article-modal', false));
}

// ==========================================
// MODAL: VISUALIZADOR MULTI-JANELAS
// ==========================================
export function openViewModal(article, currentUser) {
    const modalId = `dynamic-view-${article.id}`;
    let modal = document.getElementById(modalId);
    
    if (modal) {
        if (modal.classList.contains('kcs-minimized')) {
            window.__kcs.toggleMinimize(modalId);
        }
        return;
    }
    
    const safeText = (str) => { 
        if(!str) return ''; 
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); 
    };

    const userId = currentUser?.uid || currentUser?.id;
    const isFav = (article.favorites || []).includes(userId);

    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal-container';
    modal.dataset.title = article.articleNumber ? `#${article.articleNumber}` : article.title;

    modal.innerHTML = `
        <div class="modal-content-box">
            <div class="modal-header" data-action="header-min">
                <h2 class="modal-title">
                    <i class="ph-fill ph-file-text icon-blue"></i>
                    ${article.articleNumber ? `<span class="id-badge">#${article.articleNumber}</span>` : ''} 
                    <span class="title-text">${safeText(article.title)}</span>
                </h2>
                
                <div class="modal-controls">
                    <button class="btn-icon" title="Minimizar" data-action="minimize"><i class="ph-bold ph-minus"></i></button>
                    <button class="btn-icon btn-max" title="Expandir/Restaurar" data-action="maximize"><i id="icon-max-${modalId}" class="ph-bold ph-arrows-out-simple"></i></button>
                    <button class="btn-icon btn-close" title="Fechar" data-action="close"><i class="ph-bold ph-x"></i></button>
                </div>
            </div>

            <div class="modal-body modal-zoomable">
                
                ${article.status === 'review' || article.status === 'pendente_revisao' ? `
                <div class="alert-box alert-warning" data-html2pdf-ignore>
                    <i class="ph-fill ph-warning-circle alert-icon"></i>
                    <span class="alert-text"><strong>Atenção:</strong> Este procedimento está em revisão.</span>
                </div>` : ''}

                <div id="kcs-print-area-${article.id}" class="print-area">
                    <div class="view-header-meta">
                        <h2 class="view-main-title">${safeText(article.title)}</h2>
                        <div class="view-tags">
                            ${article.tags ? article.tags.map(t => `<span class="tag-badge">${safeText(t)}</span>`).join('') : ''}
                            ${article.categoryId || article.category ? `<span class="tag-badge tag-category">${safeText(article.categoryId || article.category)}</span>` : ''}
                            ${article.visibility === VISIBILITY.PRIVATE ? `<span class="tag-badge tag-private"><i class="ph-bold ph-lock"></i> Privado</span>` : `<span class="tag-badge tag-public"><i class="ph-bold ph-globe"></i> Público</span>`}
                        </div>
                    </div>

                    <div class="view-content-grid">
                        ${article.symptom ? `
                        <div class="field-group">
                            <div class="field-header">
                                <h4 class="field-title"><i class="ph-fill ph-warning-circle icon-red"></i> Sintoma</h4>
                                <button class="btn-icon btn-copy" title="Copiar conteúdo" data-action="copy-field"><i class="ph ph-copy"></i></button>
                            </div>
                            <div class="field-content">${safeText(article.symptom)}</div>
                        </div>` : ''}
                        
                        ${article.environment ? `
                        <div class="field-group">
                            <div class="field-header">
                                <h4 class="field-title"><i class="ph-fill ph-desktop icon-blue"></i> Ambiente</h4>
                                <button class="btn-icon btn-copy" title="Copiar conteúdo" data-action="copy-field"><i class="ph ph-copy"></i></button>
                            </div>
                            <div class="field-content">${safeText(article.environment)}</div>
                        </div>` : ''}
                        
                        ${article.cause ? `
                        <div class="field-group">
                            <div class="field-header">
                                <h4 class="field-title"><i class="ph-fill ph-magnifying-glass icon-yellow"></i> Causa</h4>
                                <button class="btn-icon btn-copy" title="Copiar conteúdo" data-action="copy-field"><i class="ph ph-copy"></i></button>
                            </div>
                            <div class="field-content">${safeText(article.cause)}</div>
                        </div>` : ''}
                        
                        ${article.solution ? `
                        <div class="field-group">
                            <div class="field-header">
                                <h4 class="field-title"><i class="ph-fill ph-check-circle icon-green"></i> Solução</h4>
                                <button class="btn-icon btn-copy" title="Copiar conteúdo" data-action="copy-field"><i class="ph ph-copy"></i></button>
                            </div>
                            <div class="field-content">${safeText(article.solution)}</div>
                        </div>` : ''}
                    </div>

                    ${article.steps || article.body ? `<div class="view-steps-container"><h4 class="field-title steps-title"><i class="ph-fill ph-list-numbers icon-gray"></i> Procedimento Detalhado</h4><div class="markdown-body">${formatContentForView(article.steps || article.body)}</div></div>` : ''}
                </div>

                <div class="view-footer-actions" data-html2pdf-ignore>
                    <div class="action-group">
                        <button class="btn-interaction btn-like" data-action="toggle-like">
                            <i class="ph-fill ph-heart"></i> Curtiu (${(article.likes || []).length})
                        </button>
                        <button class="btn-interaction btn-comment" data-action="prompt-comment">
                            <i class="ph-fill ph-chat-circle"></i> Comentar (${(article.comments || []).length})
                        </button>
                        <button class="btn-interaction btn-fav" data-action="toggle-fav">
                            <i class="${isFav ? 'ph-fill' : 'ph'} ph-star"></i> ${isFav ? 'Desfavoritar' : 'Favoritar'}
                        </button>
                        <button class="btn-interaction btn-export" data-action="export-pdf" data-num="${article.articleNumber || 'DOC'}" data-title="${safeText(article.title).replace(/"/g, '&quot;')}">
                            <i class="ph-fill ph-download-simple"></i> PDF
                        </button>
                    </div>

                    <div class="action-group">
                        <button class="btn-secondary" data-action="open-history">
                            <i class="ph-bold ph-clock-counter-clockwise"></i> Histórico
                        </button>
                        <button class="btn-danger" data-action="flag-article">
                            <i class="ph-bold ph-warning-circle"></i> Reportar
                        </button>
                    </div>
                </div>

                ${article.comments && article.comments.length > 0 ? `
                <div class="comments-section" data-html2pdf-ignore>
                    <h4 class="comments-title"><i class="ph-fill ph-chats"></i> Comentários da Equipe</h4>
                    ${article.comments.map(c => `
                        <div class="comment-card">
                            <div class="comment-header">
                                <span class="comment-author">${safeText(c.userName)}</span>
                                <span class="comment-date">${new Date(c.date).toLocaleDateString()}</span>
                            </div>
                            <p class="comment-text">${safeText(c.text)}</p>
                        </div>
                    `).join('')}
                </div>` : ''}
            </div>
        </div>
    `;
    
    modal.querySelector('[data-action="header-min"]').addEventListener('click', (e) => {
        if (!e.target.closest('button')) window.__kcs.toggleMinimize(modalId);
    });
    modal.querySelector('[data-action="minimize"]').addEventListener('click', (e) => { e.stopPropagation(); window.__kcs.toggleMinimize(modalId); });
    modal.querySelector('[data-action="maximize"]').addEventListener('click', (e) => { e.stopPropagation(); window.__kcs.toggleMaximize(modalId); });
    modal.querySelector('[data-action="close"]').addEventListener('click', (e) => { e.stopPropagation(); window.__kcs.closeModal(modalId, true); });

    modal.querySelectorAll('[data-action="copy-field"]').forEach(btn => btn.addEventListener('click', (e) => window.copyFieldText(e.currentTarget)));
    
    modal.querySelector('[data-action="toggle-like"]').addEventListener('click', () => window.__kcs.toggleLike(article.id));
    modal.querySelector('[data-action="prompt-comment"]').addEventListener('click', () => window.__kcs.promptComment(article.id));
    modal.querySelector('[data-action="toggle-fav"]').addEventListener('click', () => window.__kcs.toggleFavorite(article.id));
    modal.querySelector('[data-action="export-pdf"]').addEventListener('click', (e) => {
        const ds = e.currentTarget.dataset;
        window.exportArticleToPDF(ds.num, ds.title, e.currentTarget, article.id);
    });

    modal.querySelector('[data-action="open-history"]').addEventListener('click', () => window.__kcs.openHistory(article.id, 'articles'));
    modal.querySelector('[data-action="flag-article"]').addEventListener('click', () => window.__kcs.flagArticle(article.id));

    attachToOverlay(modal);
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

export function openSqlModal(script = null, onSave) {
    const modal = document.getElementById('sql-modal');
    const form = document.getElementById('sql-form');
    const title = document.getElementById('sql-modal-title');
    const formBody = document.getElementById('sql-form-body');
    const footer = document.getElementById('sql-form-footer');
    
    if (!modal || !form || !formBody) return;
    
    attachToOverlay(modal);
    
    title.textContent = script ? 'Editar Script SQL' : 'Novo Script SQL';
    modal.dataset.title = script ? `SQL: ${script.name}` : 'Novo Script SQL';

    const typeOptions = SQL_DB_TYPES.map(t => `<option value="${t.value}" ${script?.dbType === t.value ? 'selected' : ''}>${t.label}</option>`).join('');

    formBody.innerHTML = `
        <div class="form-group">
            <label class="form-label">Nome do Script *</label>
            <input type="text" id="sql-name" placeholder="Ex: Corrige CFOP Nulo na Tabela Produtos" class="form-input" required value="${script?.name || ''}" />
        </div>
        
        <div class="form-row-split">
            <div class="form-group">
                <label class="form-label">Banco de Dados</label>
                <select id="sql-db-type" class="form-select">${typeOptions}</select>
            </div>
            <div class="form-group">
                <label class="form-label">Operação</label>
                <select id="sql-category" class="form-select">
                    <option value="SELECT" ${script?.sqlCategory === 'SELECT'?'selected':''}>Consulta (SELECT)</option>
                    <option value="UPDATE" ${script?.sqlCategory === 'UPDATE'?'selected':''}>Alteração (UPDATE/INSERT)</option>
                    <option value="DELETE" ${script?.sqlCategory === 'DELETE'?'selected':''}>Exclusão (DELETE/DROP)</option>
                </select>
            </div>
        </div>
        
        <div class="form-group">
            <label class="form-label">Descrição</label>
            <input type="text" id="sql-desc" placeholder="O que esse script resolve na prática?" class="form-input" value="${script?.description || ''}" />
        </div>
        
        <div class="form-group">
            <label class="form-label">Código SQL *</label>
            <textarea id="sql-code" rows="6" placeholder="SELECT * FROM table..." class="form-textarea code-editor" required>${script?.code || ''}</textarea>
        </div>
        
        <div class="form-group">
            <label class="form-label">Visibilidade</label>
            <select id="sql-visibility" class="form-select">
                <option value="${VISIBILITY.PUBLIC}" ${script?.visibility === VISIBILITY.PUBLIC ? 'selected' : ''}>🌍 Público (Empresa)</option>
                <option value="${VISIBILITY.PRIVATE}" ${script?.visibility === VISIBILITY.PRIVATE ? 'selected' : ''}>🔒 Privado (Setor)</option>
            </select>
        </div>
    `;

    if(footer) {
        footer.innerHTML = `
            <button type="button" id="btn-cancel-sql-footer" class="btn-secondary">Cancelar</button>
            <button type="submit" class="btn-primary">Salvar Script</button>
        `;
        safeBindEvent(document.getElementById('btn-cancel-sql-footer'), 'click', () => window.__kcs.closeModal('sql-modal', false));
    }
    
    safeBindEvent(document.getElementById('btn-cancel-sql'), 'click', () => window.__kcs.closeModal('sql-modal', false));
    
    safeBindEvent(form, 'submit', (e) => { 
        e.preventDefault(); 
        onSave({ 
            name: document.getElementById('sql-name').value, 
            description: document.getElementById('sql-desc').value, 
            code: document.getElementById('sql-code').value, 
            dbType: document.getElementById('sql-db-type').value, 
            sqlCategory: document.getElementById('sql-category').value, 
            visibility: document.getElementById('sql-visibility').value, 
            statusRequest: 'approved' 
        }); 
        window.__kcs.closeModal('sql-modal', false); 
    });
}

export function openSqlViewModal(script) {
    const modalId = `sql-view-${script.id}`;
    let modal = document.getElementById(modalId);
    
    if (modal) {
        if (modal.classList.contains('kcs-minimized')) {
            window.__kcs.toggleMinimize(modalId);
        }
        return;
    }
    
    const safeText = (str) => { 
        if(!str) return ''; 
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); 
    };
    
    const currentUser = getCurrentUser();
    const userId = currentUser?.uid || currentUser?.id;
    const isFav = (script.favorites || []).includes(userId);

    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal-container';
    modal.dataset.title = script.scriptNumber ? `SQL-${script.scriptNumber}` : script.name;

    modal.innerHTML = `
        <div class="modal-content-box">
            <div class="modal-header" data-action="header-min">
                <h2 class="modal-title">
                    <i class="ph-fill ph-database icon-purple"></i>
                    ${script.scriptNumber ? `<span class="id-badge">#SQL-${script.scriptNumber}</span>` : ''} 
                    <span class="title-text">${safeText(script.name)}</span>
                </h2>
                
                <div class="modal-controls">
                    <button class="btn-icon" title="Minimizar" data-action="minimize"><i class="ph-bold ph-minus"></i></button>
                    <button class="btn-icon btn-max" title="Expandir/Restaurar" data-action="maximize"><i class="ph-bold ph-arrows-out-simple"></i></button>
                    <button class="btn-icon btn-close" title="Fechar" data-action="close"><i class="ph-bold ph-x"></i></button>
                </div>
            </div>

            <div class="modal-body">
                ${script.status === 'review' || script.status === 'pendente_revisao' ? `
                <div class="alert-box alert-warning">
                    <i class="ph-fill ph-warning-circle alert-icon"></i>
                    <span class="alert-text"><strong>Atenção:</strong> Este script foi sinalizado ou está em revisão.</span>
                </div>` : ''}
                
                <div class="view-header-meta">
                    <div class="view-tags">
                        ${script.visibility === VISIBILITY.PRIVATE ? `<span class="tag-badge tag-private"><i class="ph ph-lock"></i> Setor: ${safeText(script.sectorId)}</span>` : `<span class="tag-badge tag-public"><i class="ph ph-globe"></i> Público</span>`}
                        <button class="btn-interaction btn-explain" data-action="explain-sql"><i class="ph-fill ph-lightbulb"></i>Explicar IA</button>
                    </div>
                    <p class="view-description">${safeText(script.description)}</p>
                </div>
                
                <div class="code-container">
                    <button class="btn-secondary btn-copy-code" data-action="copy-code">Copiar</button>
                    <pre class="code-preview"><code>${script.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                </div>
                
                <div class="view-footer-actions">
                    <div class="action-group">
                        <button class="btn-interaction btn-like" data-action="toggle-sql-like"><i class="ph-fill ph-heart"></i> Curtiu (${(script.likes || []).length})</button>
                        <button class="btn-interaction btn-comment" data-action="prompt-sql-comment"><i class="ph-fill ph-chat-circle"></i> Comentar (${(script.comments || []).length})</button>
                        <button class="btn-interaction btn-fav" data-action="toggle-sql-fav"><i class="${isFav ? 'ph-fill' : 'ph'} ph-star"></i> ${isFav ? 'Desfavoritar' : 'Favoritar'}</button>
                    </div>
                    <div class="action-group">
                        <button class="btn-secondary" data-action="open-sql-history"><i class="ph-fill ph-clock-counter-clockwise"></i> Histórico</button>
                        <button class="btn-danger" data-action="flag-sql"><i class="ph-fill ph-warning-circle"></i> Reportar Erro</button>
                    </div>
                </div>
                
                ${script.comments && script.comments.length > 0 ? `
                <div class="comments-section">
                    <h4 class="comments-title">Comentários da Comunidade</h4>
                    ${script.comments.map(c => `
                        <div class="comment-card">
                            <div class="comment-header">
                                <span class="comment-author">${safeText(c.userName)}</span>
                                <span class="comment-date">${new Date(c.date).toLocaleDateString()}</span>
                            </div>
                            <p class="comment-text">${safeText(c.text)}</p>
                        </div>
                    `).join('')}
                </div>` : '<p class="empty-state-text">Seja o primeiro a adicionar uma observação!</p>'}
            </div>
        </div>
    `;

    modal.querySelector('[data-action="header-min"]').addEventListener('click', (e) => {
        if (!e.target.closest('button')) window.__kcs.toggleMinimize(modalId);
    });
    modal.querySelector('[data-action="minimize"]').addEventListener('click', (e) => { e.stopPropagation(); window.__kcs.toggleMinimize(modalId); });
    modal.querySelector('[data-action="maximize"]').addEventListener('click', (e) => { e.stopPropagation(); window.__kcs.toggleMaximize(modalId); });
    modal.querySelector('[data-action="close"]').addEventListener('click', (e) => { e.stopPropagation(); window.__kcs.closeModal(modalId, true); });

    modal.querySelector('[data-action="explain-sql"]').addEventListener('click', () => window.__kcs.explainSql(script.id));
    modal.querySelector('[data-action="copy-code"]').addEventListener('click', (e) => window.__kcs.copyCode(e.currentTarget));
    
    modal.querySelector('[data-action="toggle-sql-like"]').addEventListener('click', () => window.__kcs.toggleSqlLike(script.id));
    modal.querySelector('[data-action="prompt-sql-comment"]').addEventListener('click', () => window.__kcs.promptSqlComment(script.id));
    modal.querySelector('[data-action="toggle-sql-fav"]').addEventListener('click', () => window.__kcs.toggleSqlFavorite(script.id));
    
    modal.querySelector('[data-action="open-sql-history"]').addEventListener('click', () => window.__kcs.openHistory(script.id, 'sql'));
    modal.querySelector('[data-action="flag-sql"]').addEventListener('click', () => window.__kcs.flagSqlScript(script.id));

    attachToOverlay(modal);
}

export function openHistoryModal(item, type) {
    const modal = document.getElementById('history-modal');
    const content = document.getElementById('history-list');
    if (!modal || !content) return;
    
    attachToOverlay(modal);
    modal.dataset.title = 'Histórico de Versões';

    const safeText = (str) => { 
        if(!str) return ''; 
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); 
    };
    
    if (!item.history || item.history.length === 0) {
        content.innerHTML = '<p class="empty-state-text">Nenhum histórico de versões disponível.</p>';
    } else {
        const reversedHistory = [...item.history].reverse();
        const totalVersions = item.history.length;
        
        content.innerHTML = reversedHistory.map((h, reversedIndex) => {
            const originalIndex = totalVersions - 1 - reversedIndex;
            return `
            <details class="history-item">
                <summary class="history-summary">
                    <div class="history-meta">
                        <i class="ph ph-caret-right history-caret"></i>
                        <div>
                            <p class="history-version-title">Versão ${originalIndex + 1}</p>
                            <p class="history-author">Salvo por <span>${safeText(h.updatedBy || 'Sistema')}</span> em ${new Date(h.updatedAt).toLocaleString()}</p>
                        </div>
                    </div>
                    <button class="btn-primary btn-restore" data-action="restore-history" data-index="${originalIndex}">Restaurar</button>
                </summary>
                <div class="history-body">
                    <div class="history-field">
                        <span class="history-label">Título Registrado:</span>
                        <p class="history-value">${safeText(h.title || h.name)}</p>
                    </div>
                    <div class="history-field">
                        <span class="history-label">Conteúdo Principal:</span>
                        <div class="history-content markdown-body">
                            ${formatContentForView(h.steps || h.body || h.code)}
                        </div>
                    </div>
                </div>
            </details>
        `}).join('');

        content.querySelectorAll('[data-action="restore-history"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                window.__kcs.restoreVersion(item.id, type, btn.dataset.index);
            });
        });
    }
}

export function openCategoryModal(refreshCallback) {
    const modal = document.getElementById('category-modal');
    const list = document.getElementById('category-list');
    const select = document.getElementById('cat-parent');
    const form = document.getElementById('category-form');
    const btnClose = document.getElementById('btn-close-category-modal');
    
    if (!modal || !list || !form) return;

    attachToOverlay(modal);
    modal.dataset.title = 'Gerenciar Categorias';

    function renderList() {
        const categories = getFlatCategories();
        select.innerHTML = '<option value="">Raiz (Sem Pai)</option>' + categories.map(c => `<option value="${c.id}">${c.path}</option>`).join('');
        
        list.innerHTML = categories.map(c => `
            <div class="category-list-item">
                <span class="category-name"><i class="ph ${c.icon || 'ph-folder'}"></i> ${c.path}</span>
                <div class="category-actions">
                    <button class="btn-secondary btn-small" data-action="edit-category" data-id="${c.id}" data-name="${c.name}" data-icon="${c.icon || ''}">Editar</button>
                    <button class="btn-danger btn-small" data-action="delete-category" data-id="${c.id}">Excluir</button>
                </div>
            </div>
        `).join('') || '<p class="empty-state-text">Nenhuma categoria cadastrada.</p>';

        list.querySelectorAll('[data-action="edit-category"]').forEach(btn => {
            btn.addEventListener('click', () => window.__kcs.editCategory(btn.dataset.id, btn.dataset.name, btn.dataset.icon));
        });
        list.querySelectorAll('[data-action="delete-category"]').forEach(btn => {
            btn.addEventListener('click', () => window.__kcs.deleteCategory(btn.dataset.id));
        });
    }

    window.__kcs.deleteCategory = (id) => { 
        removeCategory(id); 
        renderList(); 
        if (refreshCallback) refreshCallback(); 
    };
    
    window.__kcs.editCategory = async (id, currentName, currentIcon) => { 
        const newName = await asyncPrompt('Novo nome da categoria:', currentName); 
        if (!newName) return; 
        const newIcon = await asyncPrompt('Ícone Phosphor (ex: ph-folder):', currentIcon); 
        updateCategory(id, { name: newName, icon: newIcon || 'ph-folder' }); 
        renderList(); 
        if (refreshCallback) refreshCallback(); 
    };

    renderList();

    safeBindEvent(form, 'submit', (e) => { 
        e.preventDefault(); 
        const name = document.getElementById('cat-name').value; 
        const icon = document.getElementById('cat-icon').value; 
        const parentId = select.value || null; 
        const res = addCategory(parentId, name, icon); 
        if (res.success) { 
            document.getElementById('cat-name').value = ''; 
            document.getElementById('cat-icon').value = 'ph-folder'; 
            renderList(); 
            if (refreshCallback) refreshCallback(); 
        } else { 
            asyncAlert(res.message); 
        } 
    });
    
    if (btnClose) {
        safeBindEvent(btnClose, 'click', () => window.__kcs.closeModal('category-modal', false));
    }
}

export async function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const usersList = document.getElementById('users-list');
    const btnClose = document.getElementById('btn-close-settings-modal');
    
    if (!modal || !usersList) return;
    
    attachToOverlay(modal);
    modal.dataset.title = 'Administração';

    usersList.innerHTML = '<div class="loader-container"><div class="spinner-icon-large"></div></div>';

    const safeText = (str) => { 
        if(!str) return ''; 
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); 
    };

    try {
        const isSuperAdmin = hasRole('super_admin');
        const currentUser = getCurrentUser();
        const users = await getAllUsersFromCloud();
        const invites = await getAllInvitedUsers();
        
        let companies = [];
        if (isSuperAdmin) {
            companies = await getAllCompaniesFromCloud();
        }

        let companiesSelectOptions = '';
        if (isSuperAdmin) {
            companiesSelectOptions = companies.map(c => `<option value="${c.companyId}">${c.companyName}</option>`).join('');
        } else {
            companiesSelectOptions = `<option value="${currentUser.companyId}">${currentUser.companyName}</option>`;
        }
        
        const sectorsOptionsHtml = (userSector) => SECTORS.map(s => `<option value="${s.id}" ${userSector === s.id ? 'selected' : ''}>${s.name}</option>`).join('');

        let companiesHtml = '';
        if (isSuperAdmin) {
            companiesHtml = `
            <div class="settings-section">
                <h3 class="settings-title color-purple">
                    <i class="ph-fill ph-buildings"></i> Painel Master (Empresas Clientes)
                </h3>
                
                <div class="form-row">
                    <input type="text" id="new-company-name" placeholder="Nome da Empresa" class="form-input flex-2" />
                    <input type="text" id="new-company-domain" placeholder="Domínios (ex: nissei.com)" class="form-input flex-2 font-mono" />
                    <button class="btn-primary" data-action="create-company">Cadastrar Cliente</button>
                </div>
                
                <div class="table-wrapper">
                    <table class="table-default">
                        <thead>
                            <tr>
                                <th>Empresa / Tenant</th>
                                <th>Domínios</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${companies.map(c => {
                                const domainsArray = Array.isArray(c.domains) ? c.domains : (c.domains ? String(c.domains).split(',') : []);
                                const domainsLabel = domainsArray.join(', ') || 'Nenhum';
                                return `
                                <tr class="table-row">
                                    <td>
                                        <div class="cell-title">${safeText(c.companyName)} <span class="badge-purple">${c.plan || 'Starter'}</span></div>
                                        <div class="cell-subtitle font-mono">ID: ${c.companyId.toUpperCase()}</div>
                                    </td>
                                    <td><i class="ph ph-globe"></i> ${safeText(domainsLabel)}</td>
                                    <td class="actions-cell">
                                        <button class="btn-secondary btn-small" data-action="edit-company" data-id="${c.companyId}" data-name="${safeText(c.companyName)}" data-domains="${safeText(domainsLabel)}" data-plan="${c.plan || 'Starter'}">Editar</button>
                                        <button class="btn-danger btn-icon" data-action="delete-company" data-id="${c.companyId}"><i class="ph ph-trash"></i></button>
                                    </td>
                                </tr>`;
                            }).join('') || '<tr><td colspan="3" class="empty-cell">Nenhuma empresa cadastrada.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>`;
        }

        const invitesHtml = `
        <div class="settings-section">
            <h3 class="settings-title color-blue">
                <i class="ph-fill ph-envelope-simple"></i> Whitelist de Exceção (Convites)
            </h3>
            
            <form id="form-invite-user" class="form-row">
                <input type="email" id="invite-email" placeholder="E-mail (ex: nome@gmail.com)" class="form-input flex-2" required />
                ${isSuperAdmin ? `<select id="invite-company" class="form-select flex-1">${companiesSelectOptions}</select>` : `<input type="hidden" id="invite-company" value="${currentUser.companyId}" />`}
                <select id="invite-sector" class="form-select flex-1">${sectorsOptionsHtml('')}</select>
                <select id="invite-role" class="form-select flex-1">
                    ${isSuperAdmin ? `<option value="super_admin">Super Admin</option>` : ''}
                    <option value="admin">Admin</option>
                    <option value="analyst">Analista KCS</option>
                    <option value="user" selected>Usuário Base</option>
                </select>
                <button type="submit" class="btn-primary">Autorizar</button>
            </form>
            
            <div class="table-wrapper">
                <table class="table-default">
                    <tbody>
                        ${invites.map(inv => `
                            <tr class="table-row">
                                <td class="user-cell">
                                    <div class="avatar-mini"><i class="ph-fill ph-envelope"></i></div>
                                    <div>
                                        <p class="user-name">${safeText(inv.email)}</p>
                                        <p class="user-role">${inv.role} | Setor: ${inv.sectorId}</p>
                                    </div>
                                </td>
                                <td class="actions-cell">
                                    <button class="btn-danger btn-small" data-action="remove-invite" data-email="${inv.email}">Revogar</button>
                                </td>
                            </tr>
                        `).join('') || '<tr><td class="empty-cell">Nenhum convite pendente.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>`;

        const activeUsersHtml = `
        <div class="settings-section">
            <h3 class="settings-title">
                <i class="ph-fill ph-users"></i> Usuários Registrados
            </h3>
            <div class="table-wrapper">
                <table class="table-default">
                    <tbody>
                        ${users.map(u => {
                            const safeName = (u.displayName && String(u.displayName) !== 'undefined') ? u.displayName : 'Usuário KCS';
                            const safeEmail = (u.email && String(u.email) !== 'undefined') ? u.email : 'Sem e-mail';
                            return `
                            <tr class="table-row">
                                <td class="user-cell">
                                    <img src="${u.photoURL || 'https://via.placeholder.com/40'}" class="avatar-img" onerror="this.style.display='none'">
                                    <div>
                                        <p class="user-name">${safeText(safeName)}</p>
                                        <p class="user-email">${safeText(safeEmail)}</p>
                                    </div>
                                </td>
                                <td class="actions-cell">
                                    <div class="table-actions">
                                        ${isSuperAdmin ? `
                                        <select class="form-select select-small" data-action="update-company" data-id="${u.id}">
                                            <option value="LIMBO_TENANT" ${u.companyId === 'LIMBO_TENANT' ? 'selected' : ''}>⚠️ Pendente</option>
                                            ${companiesSelectOptions.replace(`value="${u.companyId}"`, `value="${u.companyId}" selected`)}
                                        </select>` : ''}
                                        <select class="form-select select-small" data-action="update-sector" data-id="${u.id}">
                                            ${sectorsOptionsHtml(u.sectorId || 'TI')}
                                        </select>
                                        <select class="form-select select-small" data-action="update-role" data-id="${u.id}">
                                            ${isSuperAdmin ? `<option value="super_admin" ${u.role === 'super_admin' ? 'selected' : ''}>Super Admin</option>` : ''}
                                            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                                            <option value="analyst" ${u.role === 'analyst' ? 'selected' : ''}>Analista</option>
                                            <option value="user" ${u.role === 'user' ? 'selected' : ''}>Usuário</option>
                                        </select>
                                        <button class="btn-danger btn-icon" data-action="delete-user" data-id="${u.id}"><i class="ph ph-trash"></i></button>
                                    </div>
                                </td>
                            </tr>`;
                        }).join('') || '<tr><td colspan="2" class="empty-cell">Nenhum usuário ativo.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>`;

        const backupHtml = isSuperAdmin ? `
        <div class="settings-section section-success">
            <h3 class="settings-title color-green">
                <i class="ph-fill ph-hard-drives"></i> Proteção de Dados e Backup
            </h3>
            <p class="settings-text">
                O backup exporta toda a base para o Bucket: <strong class="badge-neutral">gs://kcs-system-180db-backups</strong>.
            </p>
            <button class="btn-success" data-action="trigger-backup">
                <i class="ph-bold ph-cloud-arrow-down"></i> Disparar Backup
            </button>
        </div>` : '';

        usersList.innerHTML = companiesHtml + invitesHtml + activeUsersHtml + backupHtml;

        usersList.querySelectorAll('[data-action="create-company"]').forEach(btn => btn.addEventListener('click', () => window.__kcs.createNewCompany()));
        usersList.querySelectorAll('[data-action="edit-company"]').forEach(btn => btn.addEventListener('click', (e) => {
            const ds = e.currentTarget.dataset;
            window.__kcs.promptEditCompany(ds.id, ds.name, ds.domains, ds.plan);
        }));
        usersList.querySelectorAll('[data-action="delete-company"]').forEach(btn => btn.addEventListener('click', (e) => window.__kcs.deleteCompany(e.currentTarget.dataset.id)));
        usersList.querySelectorAll('[data-action="remove-invite"]').forEach(btn => btn.addEventListener('click', (e) => window.__kcs.removeInvite(e.currentTarget.dataset.email)));
        usersList.querySelectorAll('[data-action="update-company"]').forEach(sel => sel.addEventListener('change', (e) => window.__kcs.updateUserCompany(e.currentTarget.dataset.id, e.target.value)));
        usersList.querySelectorAll('[data-action="update-sector"]').forEach(sel => sel.addEventListener('change', (e) => window.__kcs.updateUserSector(e.currentTarget.dataset.id, e.target.value)));
        usersList.querySelectorAll('[data-action="update-role"]').forEach(sel => sel.addEventListener('change', (e) => window.__kcs.updateUserRole(e.currentTarget.dataset.id, e.target.value)));
        usersList.querySelectorAll('[data-action="delete-user"]').forEach(btn => btn.addEventListener('click', (e) => window.__kcs.deleteUser(e.currentTarget.dataset.id)));
        usersList.querySelectorAll('[data-action="trigger-backup"]').forEach(btn => btn.addEventListener('click', () => window.__kcs.triggerManualBackup()));

        const formInvite = document.getElementById('form-invite-user');
        if (formInvite) {
            safeBindEvent(formInvite, 'submit', async (e) => {
                e.preventDefault();
                const em = document.getElementById('invite-email').value;
                const cp = document.getElementById('invite-company')?.value || currentUser.companyId;
                const sc = document.getElementById('invite-sector').value;
                const rl = document.getElementById('invite-role').value;
                await window.__kcs.inviteUser(em, rl, cp, sc);
            });
        }

    } catch (e) { 
        usersList.innerHTML = `<p class="alert-text color-red">Erro: ${e.message}</p>`; 
    }
    
    if (btnClose) {
        safeBindEvent(btnClose, 'click', () => window.__kcs.closeModal('settings-modal', false));
    }
}

export function asyncAlert(message) {
    const modal = document.getElementById('alert-modal');
    const msgEl = document.getElementById('alert-message');
    const btnOk = document.getElementById('btn-alert-ok');
    
    if (!modal || !msgEl || !btnOk) { 
        alert(message); 
        return; 
    }
    
    attachToOverlay(modal);
    modal.dataset.title = 'Alerta';
    
    msgEl.innerHTML = message;
    
    safeBindEvent(btnOk, 'click', () => window.__kcs.closeModal('alert-modal', false));
}

export function asyncPrompt(message, defaultVal = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('prompt-modal');
        const msgEl = document.getElementById('prompt-message');
        const inputEl = document.getElementById('prompt-input');
        const btnCancel = document.getElementById('btn-prompt-cancel');
        const btnConfirm = document.getElementById('btn-prompt-confirm');
        
        if (!modal || !msgEl || !inputEl) { 
            resolve(prompt(message, defaultVal)); 
            return; 
        }
        
        attachToOverlay(modal);
        modal.dataset.title = 'Entrada Necessária';

        msgEl.textContent = message; 
        inputEl.value = defaultVal;
        inputEl.focus();
        
        const cleanup = () => window.__kcs.closeModal('prompt-modal', false);
        
        safeBindEvent(btnCancel, 'click', () => { cleanup(); resolve(null); });
        safeBindEvent(btnConfirm, 'click', () => { cleanup(); resolve(inputEl.value); });
    });
}

export function openConfirmModal(msg, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-message');
    const btnYes = document.getElementById('btn-confirm-yes');
    const btnNo = document.getElementById('btn-confirm-no');
    
    if (!modal || !msgEl) { 
        if (confirm(msg)) onConfirm(); 
        return; 
    }
    
    attachToOverlay(modal);
    modal.dataset.title = 'Confirmação';

    msgEl.textContent = msg; 
    
    const cleanup = () => window.__kcs.closeModal('confirm-modal', false);
    
    safeBindEvent(btnNo, 'click', () => cleanup());
    safeBindEvent(btnYes, 'click', async () => { cleanup(); await onConfirm(); });
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