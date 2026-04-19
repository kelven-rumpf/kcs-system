import { getCurrentUser, hasPermission, hasRole, getAllUsersFromCloud, getAllCompaniesFromCloud, getAllInvitedUsers } from '../auth.js';
import { initEditor } from './editor.js'; 
import { formatContentForView } from './render.js'; 
import { getFlatCategories, addCategory, removeCategory, updateCategory } from '../services/categories.js';
import { VISIBILITY, SECTORS } from '../config.js';

window.__kcs = window.__kcs || {};

const SQL_DB_TYPES = [
    { value: 'mysql', label: 'MySQL', color: 'bg-blue-600/30 text-blue-300' },
    { value: 'postgres', label: 'PostgreSQL', color: 'bg-indigo-600/30 text-indigo-300' },
    { value: 'sqlserver', label: 'SQL Server', color: 'bg-red-600/30 text-red-300' },
    { value: 'oracle', label: 'Oracle DB', color: 'bg-orange-600/30 text-orange-300' }
];

// ==========================================
// UNIFIED DOCK MANAGER (GMAIL STYLE)
// ==========================================
window.__kcs.rearrangeDocks = () => {
    let dock = document.getElementById('kcs-dock');
    if (!dock) {
        dock = document.createElement('div');
        dock.id = 'kcs-dock';
        // Injeta o contêiner invisível para empilhar as abas da direita para a esquerda
        dock.className = 'fixed bottom-0 right-[80px] flex flex-row-reverse items-end gap-3 z-[99999] pointer-events-none max-w-[calc(100vw-90px)] overflow-x-auto pt-4';
        document.body.appendChild(dock);
    }

    const minimizedModals = document.querySelectorAll('.kcs-minimized:not(.hidden)');
    minimizedModals.forEach((modal) => {
        if (modal.parentElement !== dock) {
            dock.appendChild(modal);
        }
    });
};

window.__kcs.toggleMinimize = (modalId) => {
    window.__kcs.rearrangeDocks();
    const dock = document.getElementById('kcs-dock');
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    const isMinimized = modal.classList.contains('kcs-minimized');
    const contentBox = modal.querySelector('.modal-content-box') || modal.firstElementChild;
    // Pega as áreas de conteúdo que devem sumir quando a aba encolher
    const bodyElements = modal.querySelectorAll('.modal-body-box, #article-form-body, #article-form-footer');
    
    if (isMinimized) {
        // RESTAURAR MODAL
        modal.classList.remove('kcs-minimized');
        document.body.appendChild(modal); // Tira da Doca e volta pro centro da tela
        
        // Recupera o estado original salvo
        modal.className = modal.dataset.originalClasses || '';
        if (contentBox) {
            contentBox.className = contentBox.dataset.originalClasses || '';
            contentBox.style.cssText = contentBox.dataset.originalStyles || '';
            const header = contentBox.firstElementChild;
            if (header) header.style.cssText = header.dataset.originalStyles || '';
        }
        
        bodyElements.forEach(el => { el.style.display = ''; });
    } else {
        // MINIMIZAR MODAL
        if (modal.classList.contains('kcs-maximized')) window.__kcs.toggleMaximize(modalId);
        
        // Salva o estado atual antes de espremer o modal
        modal.dataset.originalClasses = modal.className;
        if (contentBox) {
            contentBox.dataset.originalClasses = contentBox.className;
            contentBox.dataset.originalStyles = contentBox.style.cssText;
            const header = contentBox.firstElementChild;
            if (header) header.dataset.originalStyles = header.style.cssText;
        }
        
        // Converte o modal numa aba fixa
        modal.className = 'kcs-minimized pointer-events-auto shrink-0 transition-transform hover:-translate-y-1 w-[220px] sm:w-[280px] h-[40px] sm:h-[48px] shadow-[0_-4px_15px_rgba(0,0,0,0.15)] rounded-t-xl overflow-hidden';
        
        if (contentBox) {
            contentBox.className = 'bg-white dark:bg-[#15171b] border border-gray-300 dark:border-[#3a3b3d] w-full h-full flex flex-col overflow-hidden border-b-0';
            contentBox.style.cssText = 'border-radius: 12px 12px 0 0 !important; margin: 0 !important; max-height: none !important;';
            const header = contentBox.firstElementChild;
            if (header) header.style.cssText = 'height: 100%; padding: 0 12px; border-bottom: none;';
        }
        
        bodyElements.forEach(el => { el.style.display = 'none'; });
        dock.appendChild(modal);
    }
    window.__kcs.rearrangeDocks();
};

window.__kcs.toggleMaximize = (modalId) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Se tentar maximizar enquanto estiver minimizado, restaura primeiro
    if (modal.classList.contains('kcs-minimized')) window.__kcs.toggleMinimize(modalId);
    
    const contentBox = modal.querySelector('.modal-content-box') || modal.firstElementChild;
    const maxBtnIcon = modal.querySelector('.btn-max i') || document.getElementById(`icon-max-${modalId}`);
    
    if (modal.classList.contains('kcs-maximized')) {
        // DESMAXIMIZAR
        modal.classList.remove('kcs-maximized');
        modal.classList.add('p-2', 'sm:p-6');
        if (contentBox) {
            contentBox.className = contentBox.dataset.preMaxClasses || contentBox.className;
            contentBox.style.cssText = contentBox.dataset.preMaxStyles || '';
        }
        if (maxBtnIcon) maxBtnIcon.className = 'ph-bold ph-arrows-out-simple';
    } else {
        // MAXIMIZAR TELA CHEIA
        modal.classList.add('kcs-maximized');
        modal.classList.remove('p-2', 'sm:p-6');
        
        if (contentBox) {
            contentBox.dataset.preMaxClasses = contentBox.className;
            contentBox.dataset.preMaxStyles = contentBox.style.cssText;
            contentBox.className = 'modal-content-box bg-white dark:bg-[#15171b] border-0 flex flex-col w-full h-[100dvh] shadow-none transition-all duration-300';
            contentBox.style.cssText = 'max-width: 100vw !important; border-radius: 0 !important; max-height: 100dvh !important; margin: 0 !important;';
        }
        if (maxBtnIcon) maxBtnIcon.className = 'ph-bold ph-arrows-in-simple';
    }
};

window.__kcs.closeModal = (modalId, isDynamic = false) => {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Se for fechado via "X" enquanto estiver no rodapé, ele restaura os dados estruturais silenciosamente antes de sumir
    if (modal.classList.contains('kcs-minimized')) window.__kcs.toggleMinimize(modalId);
    if (modal.classList.contains('kcs-maximized')) window.__kcs.toggleMaximize(modalId);
    
    if (isDynamic) {
        modal.remove(); // Destrói procedimetos dinâmicos do DOM
    } else {
        modal.classList.add('hidden'); // Oculta formulários fixos (Novo KCS, etc)
        modal.classList.remove('flex');
    }
    window.__kcs.rearrangeDocks();
};

// Mapeamento legado para garantir que botões antigos não quebrem
window.toggleMinimizeArticle = () => window.__kcs.toggleMinimize('article-modal');
window.toggleMaximizeArticle = () => window.__kcs.toggleMaximize('article-modal');
window.toggleMinimizeView = (id) => window.__kcs.toggleMinimize(id);
window.toggleMaximizeView = (id) => window.__kcs.toggleMaximize(id);
window.__kcs.closeDynamicView = (id) => window.__kcs.closeModal(id, true);


// ==========================================
// FUNÇÃO AUXILIAR: COPIAR CONTEÚDO DOS BLOCOS
// ==========================================
window.copyFieldText = function(btn) {
    const container = btn.closest('.group');
    const contentDiv = container.querySelector('.field-content');
    if (!contentDiv) return;

    let textToCopy = contentDiv.innerText.trim();
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<i class="ph-fill ph-check-circle text-green-500 text-[16px]"></i>';
        if (window.__kcs && window.__kcs.showToast) window.__kcs.showToast('Texto copiado!', 'success');
        setTimeout(() => { btn.innerHTML = originalIcon; }, 2000);
    }).catch(err => console.error('Erro ao copiar', err));
};

// ==========================================
// MÓDULO: LIGHTBOX (ZOOM DE IMAGENS)
// ==========================================
if (!window.__kcsZoomInit) {
    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG' && e.target.closest('.modal-zoomable')) {
            const src = e.target.src;
            const lb = document.createElement('div');
            lb.className = 'fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center p-4 animate-fade-in cursor-zoom-out backdrop-blur-sm';
            lb.innerHTML = `<img src="${src}" class="max-w-full max-h-full object-contain rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-transform transform scale-95 hover:scale-100 duration-300">
                            <button class="absolute top-6 right-6 text-white/50 hover:text-white bg-black/50 hover:bg-black p-2 rounded-full transition-colors"><i class="ph-bold ph-x text-2xl"></i></button>`;
            lb.onclick = () => lb.remove();
            document.body.appendChild(lb);
        }
    });
    window.__kcsZoomInit = true;
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

    // Hard Reset via unificação
    if (modal.classList.contains('kcs-minimized')) window.__kcs.toggleMinimize('article-modal');
    if (modal.classList.contains('kcs-maximized')) window.__kcs.toggleMaximize('article-modal');

    const innerBox = modal.firstElementChild;
    if (innerBox && !innerBox.classList.contains('modal-content-box')) {
        innerBox.classList.add('modal-content-box');
    }

    if (title && !document.getElementById('btn-controls-article')) {
        const headerDiv = title.parentElement;
        if (headerDiv) {
            headerDiv.className = 'flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-300 dark:border-[#3a3b3d] shrink-0 bg-gray-50 dark:bg-[#1e1f20] cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2a2b2f] transition-colors w-full select-none'; 
            headerDiv.onclick = (e) => {
                if (e.target.closest('button')) return;
                if (modal.classList.contains('kcs-minimized')) window.__kcs.toggleMinimize('article-modal');
            };

            title.className = 'text-sm font-bold text-gray-900 dark:text-white truncate flex-1 pr-2 sm:pr-4 flex items-center gap-2';
            if (!title.querySelector('i')) {
                const originalText = title.textContent || 'Nova Documentação KCS';
                title.innerHTML = `<i class="ph-fill ph-pencil-simple text-blue-500 text-lg"></i> <span class="truncate">${originalText}</span>`;
            }

            const closeBtn = headerDiv.querySelector('button'); 
            const controlsDiv = document.createElement('div');
            controlsDiv.id = 'btn-controls-article';
            controlsDiv.className = 'flex items-center gap-2 sm:gap-3 shrink-0 ml-auto';

            const minBtn = document.createElement('button');
            minBtn.innerHTML = '<i class="ph-bold ph-minus"></i>';
            minBtn.className = 'text-gray-500 hover:text-gray-900 dark:hover:text-white text-lg transition-colors p-1';
            minBtn.title = "Minimizar";
            minBtn.type = 'button';
            minBtn.onclick = (e) => { e.stopPropagation(); window.__kcs.toggleMinimize('article-modal'); };
            
            const maxBtn = document.createElement('button');
            maxBtn.innerHTML = '<i class="ph-bold ph-arrows-out-simple"></i>';
            maxBtn.className = 'btn-max text-gray-500 hover:text-gray-900 dark:hover:text-white text-lg transition-colors p-1 hidden sm:block';
            maxBtn.title = "Expandir";
            maxBtn.type = 'button';
            maxBtn.onclick = (e) => { e.stopPropagation(); window.__kcs.toggleMaximize('article-modal'); };

            if (closeBtn) {
                closeBtn.className = 'text-gray-500 hover:text-red-500 dark:hover:text-red-400 text-lg transition-colors p-1';
                closeBtn.innerHTML = '<i class="ph-bold ph-x"></i>';
                closeBtn.onclick = (e) => { e.stopPropagation(); window.__kcs.closeModal('article-modal', false); };
                
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

   formBody.innerHTML = `
        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-gray-50 dark:bg-[#131314] p-3 rounded-lg border border-gray-300 dark:border-[#3a3b3d]">
            <div class="flex-1">
                <p class="text-[10px] text-gray-500 uppercase">Número do Procedimento</p>
                <p class="text-sm font-bold text-blue-500 dark:text-blue-400">${kcsNum}</p>
            </div>
            <div class="flex-1 sm:border-l border-t sm:border-t-0 border-gray-300 dark:border-[#3a3b3d] pt-2 sm:pt-0 sm:pl-4 w-full">
                <p class="text-[10px] text-gray-500 uppercase">Autor Original</p>
                <p class="text-sm text-gray-700 dark:text-gray-300 truncate">${authorName}</p>
            </div>
        </div>

        <div class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-3 rounded-lg flex items-start gap-3 shadow-sm mt-3">
            <div class="mt-0.5 text-indigo-600 dark:text-indigo-400 text-lg"><i class="ph-fill ph-magic-wand"></i></div>
            <div>
                <h4 class="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider mb-1">Piloto Automático KCS</h4>
                <p class="text-[11px] sm:text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed">Não perca tempo preenchendo caixas. Descreva o problema, a causa, a solução e as imagens na caixa de <strong>Passo a Passo</strong> e clique em <strong class="bg-indigo-100 dark:bg-indigo-900/50 px-1 py-0.5 rounded text-indigo-800 dark:text-indigo-200">✨ Refinar Conteúdo</strong>.</p>
            </div>
        </div>
        
        <div class="mt-3">
            <label class="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Título *</label>
            <input type="text" id="article-title" placeholder="Deixe em branco e a IA deduzirá para você..." class="w-full bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" value="${article?.title || ''}" />
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div>
                <label class="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sintoma / Problema</label>
                <textarea id="article-symptom" rows="2" placeholder="Auto-preenchido via IA..." class="w-full bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:outline-none">${article?.symptom || ''}</textarea>
            </div>
            <div>
                <label class="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ambiente</label>
                <textarea id="article-environment" rows="2" placeholder="Auto-preenchido via IA..." class="w-full bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:outline-none">${article?.environment || ''}</textarea>
            </div>
        </div>
        
        <div class="mt-3">
            <label class="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Causa</label>
            <textarea id="article-cause" rows="2" placeholder="Auto-preenchido via IA..." class="w-full bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:outline-none">${article?.cause || ''}</textarea>
        </div>
        <div class="mt-3">
            <label class="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Solução</label>
            <textarea id="article-solution" rows="2" placeholder="Auto-preenchido via IA..." class="w-full bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:outline-none">${article?.solution || ''}</textarea>
        </div>
        
        <div class="mt-4">
            <label class="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Procedimento Detalhado / Captura de Rascunho</label>
            <div class="flex flex-wrap items-center justify-between bg-gray-50 dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-t-lg px-3 py-1.5 w-full gap-y-2 border-b-0">
                <div class="flex flex-wrap items-center gap-1">
                    <button type="button" data-format="undo" class="text-gray-500 hover:text-gray-900 dark:hover:text-white p-1.5 rounded transition-colors"><i class="ph ph-arrow-u-up-left text-lg"></i></button>
                    <button type="button" data-format="redo" class="text-gray-500 hover:text-gray-900 dark:hover:text-white p-1.5 rounded transition-colors"><i class="ph ph-arrow-u-up-right text-lg"></i></button>
                    <div class="w-px h-5 bg-gray-300 dark:bg-[#3a3b3d] mx-1 hidden sm:block"></div>
                    <button type="button" data-format="bold" class="text-gray-600 dark:text-gray-400 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-[#131314] font-bold">B</button>
                    <button type="button" data-format="italic" class="text-gray-600 dark:text-gray-400 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-[#131314] italic">I</button>
                    <button type="button" data-format="underline" class="text-gray-600 dark:text-gray-400 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-[#131314] underline">U</button>
                    <div class="w-px h-5 bg-gray-300 dark:bg-[#3a3b3d] mx-1 hidden sm:block"></div>
                    <button type="button" data-format="h3" class="text-xs text-gray-600 dark:text-gray-400 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-[#131314] font-semibold">H3</button>
                    <button type="button" data-format="insertUnorderedList" class="text-gray-600 dark:text-gray-400 p-1 rounded hover:bg-gray-100 dark:hover:bg-[#131314]"><i class="ph ph-list-bullets text-lg"></i></button>
                    <button type="button" data-format="insertOrderedList" class="text-gray-600 dark:text-gray-400 p-1 rounded hover:bg-gray-100 dark:hover:bg-[#131314]"><i class="ph ph-list-numbers text-lg"></i></button>
                    <div class="w-px h-5 bg-gray-300 dark:bg-[#3a3b3d] mx-1"></div>
                    <button type="button" data-format="image" class="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 p-1.5 rounded hover:bg-gray-200 dark:hover:bg-[#2a2b2f] transition-colors" title="Anexar Imagem"><i class="ph ph-camera text-lg"></i></button>
                </div>
                <div class="flex flex-wrap items-center gap-2 justify-end">
                    <button id="btn-ia-reescrever" type="button" class="btn-ia btn-ia-reescrever"><i class="ph-fill ph-magic-wand"></i> Refinar</button>
                    <button id="btn-ia-corrigir" type="button" class="btn-ia btn-ia-corrigir hidden sm:flex"><i class="ph-fill ph-text-aa"></i> Gramática</button>
                </div>
            </div>
            <div id="article-body" contenteditable="true" class="modal-zoomable w-full bg-white dark:bg-[#15171b] border border-gray-300 dark:border-[#3a3b3d] rounded-b-lg px-3 sm:px-5 py-4 text-gray-900 dark:text-gray-200 text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[300px] max-h-[60vh] overflow-y-auto leading-relaxed shadow-inner"></div>
        </div>
        
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-[#3a3b3d]">
            <div>
                <label class="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Categoria</label>
                <select id="article-category" class="w-full bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-sm">${categoryOptions}</select>
            </div>
            <div>
                <label class="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Visibilidade</label>
                <select id="article-visibility" class="w-full bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-sm">
                    <option value="${VISIBILITY.PUBLIC}" ${article?.visibility === VISIBILITY.PUBLIC ? 'selected' : ''}>🌍 Público</option>
                    <option value="${VISIBILITY.PRIVATE}" ${article?.visibility === VISIBILITY.PRIVATE ? 'selected' : ''}>🔒 Privado</option>
                </select>
            </div>
            <div>
                <label class="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tags (Vírgula)</label>
                <input type="text" id="article-tags" class="w-full bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-sm" value="${(article?.tags || []).join(', ')}" />
            </div>
        </div>
    `;

    const editorCorpo = document.getElementById('article-body');
    if (editorCorpo) {
        let htmlParaCarregar = article?.steps || article?.body || '';
        if (Array.isArray(htmlParaCarregar)) {
            htmlParaCarregar = htmlParaCarregar.map(step => {
                let txt = step.description ? `<p>${step.description}</p>` : '';
                if(step.images) txt += step.images.map(img => `<br><img src="${img}" style="max-height: 240px; border-radius: 6px;" /><br>`).join('');
                return txt;
            }).join('');
        }
        editorCorpo.innerHTML = htmlParaCarregar;
    }
    
    initEditor('article-body');

    const canPublish = hasPermission('validate_article');
    footer.innerHTML = `
        <button type="button" id="btn-cancel-article-footer" class="text-sm text-gray-500 hover:text-gray-900 px-4 py-2 border border-gray-300 rounded-lg w-full sm:w-auto">Cancelar</button>
        <button type="submit" id="btn-draft-direct" class="text-sm bg-gray-500 hover:bg-gray-600 text-white font-medium px-4 py-2 rounded-lg w-full sm:w-auto">Salvar Rascunho</button>
        ${canPublish ? `<button type="submit" id="btn-publish-direct" class="text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg w-full sm:w-auto mt-2 sm:mt-0">Salvar e Aprovar</button>` : ''}
    `;

    let submitAction = 'draft';
    document.getElementById('btn-draft-direct').onclick = () => { submitAction = 'draft'; };
    if (canPublish) document.getElementById('btn-publish-direct').onclick = () => { submitAction = 'approved'; };

    form.onsubmit = (e) => {
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
        closeArticleModal();
    };

    modal.classList.remove('hidden'); 
    modal.classList.add('flex');
    if (rebindToolbar) rebindToolbar();
    document.getElementById('btn-cancel-article').onclick = closeArticleModal;
    document.getElementById('btn-cancel-article-footer').onclick = closeArticleModal;
}

export function closeArticleModal() { 
    window.__kcs.closeModal('article-modal', false);
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
    modal.className = 'dynamic-view-modal fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-2 sm:p-6 animate-fade-in transition-all duration-300';
    
    modal.innerHTML = `
        <div class="modal-content-box bg-white dark:bg-[#15171b] border border-gray-300 dark:border-[#3a3b3d] rounded-2xl w-full max-w-[95vw] xl:max-w-5xl flex flex-col shadow-2xl relative transition-all duration-300 max-h-[95vh]">
            
            <div class="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-300 dark:border-[#3a3b3d] shrink-0 bg-gray-50 dark:bg-[#1e1f20] rounded-t-2xl cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2a2b2f] transition-colors w-full select-none" onclick="window.__kcs.toggleMinimize('${modalId}')">
                <h2 class="text-sm font-bold text-gray-900 dark:text-white truncate flex-1 pr-2 sm:pr-4 flex items-center gap-2">
                    <i class="ph-fill ph-file-text text-blue-500 text-lg"></i>
                    ${article.articleNumber ? `<span class="text-blue-500 hidden sm:inline">#${article.articleNumber}</span>` : ''} 
                    <span class="truncate text-xs sm:text-sm font-semibold">${safeText(article.title)}</span>
                </h2>
                
                <div class="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
                    <button onclick="event.stopPropagation(); window.__kcs.toggleMinimize('${modalId}')" class="text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors text-lg p-1" title="Minimizar"><i class="ph-bold ph-minus"></i></button>
                    <button onclick="event.stopPropagation(); window.__kcs.toggleMaximize('${modalId}')" class="btn-max text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors text-lg p-1 hidden sm:block" title="Expandir/Restaurar"><i id="icon-max-${modalId}" class="ph-bold ph-arrows-out-simple"></i></button>
                    <button onclick="event.stopPropagation(); window.__kcs.closeModal('${modalId}', true)" class="text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors text-lg p-1" title="Fechar"><i class="ph-bold ph-x"></i></button>
                </div>
            </div>

            <div class="modal-body-box flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar modal-zoomable">
                
                ${article.status === 'review' || article.status === 'pendente_revisao' ? `
                <div class="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-500/50 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-xl mb-6 flex items-start gap-3 shadow-sm" data-html2pdf-ignore>
                    <i class="ph-fill ph-warning-circle text-[24px]"></i>
                    <span class="text-sm font-medium mt-0.5"><strong>Atenção:</strong> Este procedimento está em revisão.</span>
                </div>` : ''}

                <div id="kcs-print-area-${article.id}" class="pb-2">
                    <div class="mb-6">
                        <h2 class="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3 leading-tight">${safeText(article.title)}</h2>
                        <div class="flex flex-wrap gap-2">
                            ${article.tags ? article.tags.map(t => `<span class="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs px-2.5 py-1 rounded-full font-medium">${safeText(t)}</span>`).join('') : ''}
                            ${article.categoryId || article.category ? `<span class="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs px-2.5 py-1 rounded-full font-medium">${safeText(article.categoryId || article.category)}</span>` : ''}
                            ${article.visibility === VISIBILITY.PRIVATE ? `<span class="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-medium"><i class="ph-bold ph-lock"></i> Privado</span>` : `<span class="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-medium"><i class="ph-bold ph-globe"></i> Público</span>`}
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        ${article.symptom ? `
                        <div class="bg-gray-50 dark:bg-[#1e1f20] p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-[#3a3b3d] shadow-sm relative group">
                            <div class="flex items-center justify-between mb-2">
                                <h4 class="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><i class="ph-fill ph-warning-circle text-red-400 text-lg"></i> Sintoma</h4>
                                <button onclick="window.copyFieldText(this)" class="text-gray-400 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100" title="Copiar conteúdo"><i class="ph ph-copy text-[16px]"></i></button>
                            </div>
                            <div class="field-content text-sm text-gray-700 dark:text-gray-300 leading-relaxed">${safeText(article.symptom)}</div>
                        </div>` : ''}
                        
                        ${article.environment ? `
                        <div class="bg-gray-50 dark:bg-[#1e1f20] p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-[#3a3b3d] shadow-sm relative group">
                            <div class="flex items-center justify-between mb-2">
                                <h4 class="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><i class="ph-fill ph-desktop text-blue-400 text-lg"></i> Ambiente</h4>
                                <button onclick="window.copyFieldText(this)" class="text-gray-400 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100" title="Copiar conteúdo"><i class="ph ph-copy text-[16px]"></i></button>
                            </div>
                            <div class="field-content text-sm text-gray-700 dark:text-gray-300 leading-relaxed">${safeText(article.environment)}</div>
                        </div>` : ''}
                        
                        ${article.cause ? `
                        <div class="bg-gray-50 dark:bg-[#1e1f20] p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-[#3a3b3d] shadow-sm relative group">
                            <div class="flex items-center justify-between mb-2">
                                <h4 class="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><i class="ph-fill ph-magnifying-glass text-yellow-500 text-lg"></i> Causa</h4>
                                <button onclick="window.copyFieldText(this)" class="text-gray-400 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100" title="Copiar conteúdo"><i class="ph ph-copy text-[16px]"></i></button>
                            </div>
                            <div class="field-content text-sm text-gray-700 dark:text-gray-300 leading-relaxed">${safeText(article.cause)}</div>
                        </div>` : ''}
                        
                        ${article.solution ? `
                        <div class="bg-gray-50 dark:bg-[#1e1f20] p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-[#3a3b3d] shadow-sm relative group">
                            <div class="flex items-center justify-between mb-2">
                                <h4 class="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><i class="ph-fill ph-check-circle text-green-500 text-lg"></i> Solução</h4>
                                <button onclick="window.copyFieldText(this)" class="text-gray-400 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100" title="Copiar conteúdo"><i class="ph ph-copy text-[16px]"></i></button>
                            </div>
                            <div class="field-content text-sm text-gray-700 dark:text-gray-300 leading-relaxed">${safeText(article.solution)}</div>
                        </div>` : ''}
                    </div>

                    ${article.steps || article.body ? `<div class="mb-4"><h4 class="text-[11px] font-bold text-gray-500 uppercase mb-3 tracking-wider flex items-center gap-2"><i class="ph-fill ph-list-numbers text-gray-400 text-lg"></i> Procedimento Detalhado</h4><div class="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#131314] border border-gray-200 dark:border-[#3a3b3d] p-4 sm:p-6 rounded-xl shadow-inner overflow-x-auto markdown-body">${formatContentForView(article.steps || article.body)}</div></div>` : ''}
                </div>

                <div class="mt-8 pt-6 border-t border-gray-200 dark:border-[#3a3b3d] flex flex-wrap items-center justify-between gap-4" data-html2pdf-ignore>
                    <div class="flex flex-wrap items-center gap-2">
                        <button onclick="window.__kcs.toggleLike('${article.id}')" class="text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 flex items-center justify-center gap-1.5 text-xs bg-pink-100 dark:bg-pink-900/20 px-3 py-2 rounded-lg border border-pink-200 dark:border-pink-900/50 font-bold transition-colors">
                            <i class="ph-fill ph-heart text-[18px]"></i> Curtiu (${(article.likes || []).length})
                        </button>
                        <button onclick="window.__kcs.promptComment('${article.id}')" class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center gap-1.5 text-xs bg-blue-100 dark:bg-blue-900/20 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-900/50 font-bold transition-colors">
                            <i class="ph-fill ph-chat-circle text-[18px]"></i> Comentar (${(article.comments || []).length})
                        </button>
                        <button onclick="window.__kcs.toggleFavorite('${article.id}')" class="text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 flex items-center justify-center gap-1.5 text-xs bg-yellow-100 dark:bg-yellow-900/20 px-3 py-2 rounded-lg border border-yellow-200 dark:border-yellow-900/50 font-bold transition-colors">
                            <i class="${isFav ? 'ph-fill' : 'ph'} ph-star text-[18px]"></i> ${isFav ? 'Desfavoritar' : 'Favoritar'}
                        </button>
                        <button onclick="window.exportArticleToPDF('${article.articleNumber || 'DOC'}', '${safeText(article.title).replace(/'/g, "\\'")}', this, '${article.id}')" class="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center justify-center gap-1.5 text-xs bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 font-bold transition-colors">
                            <i class="ph-fill ph-download-simple text-[18px]"></i> PDF
                        </button>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                        <button onclick="window.__kcs.openHistory('${article.id}', 'articles')" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center gap-1.5 text-xs bg-white dark:bg-[#1e1f20] px-3 py-2 rounded-lg border border-gray-300 dark:border-[#3a3b3d] font-bold transition-colors">
                            <i class="ph-bold ph-clock-counter-clockwise text-[18px]"></i> Histórico
                        </button>
                        <button onclick="window.__kcs.flagArticle('${article.id}')" class="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center justify-center gap-1.5 text-xs bg-red-50 dark:bg-red-900/10 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/30 font-bold transition-colors">
                            <i class="ph-bold ph-warning-circle text-[18px]"></i> Reportar
                        </button>
                    </div>
                </div>

                ${article.comments && article.comments.length > 0 ? `
                <div class="space-y-3 mt-8 pt-6 border-t border-gray-200 dark:border-[#3a3b3d]" data-html2pdf-ignore>
                    <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4"><i class="ph-fill ph-chats mr-1"></i> Comentários da Equipe</h4>
                    ${article.comments.map(c => `
                        <div class="bg-gray-50 dark:bg-[#1e1f20] p-4 rounded-xl border border-gray-200 dark:border-[#3a3b3d] shadow-sm">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-xs font-bold text-gray-800 dark:text-gray-200">${safeText(c.userName)}</span>
                                <span class="text-[10px] text-gray-500 font-medium">${new Date(c.date).toLocaleDateString()}</span>
                            </div>
                            <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">${safeText(c.text)}</p>
                        </div>
                    `).join('')}
                </div>` : ''}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

export function closeViewModal() { 
    const modals = document.querySelectorAll('.dynamic-view-modal');
    modals.forEach(m => window.__kcs.closeModal(m.id, true));
}

// ==========================================
// FUNÇÃO GERADORA DE PDF 
// ==========================================
window.exportArticleToPDF = async function(articleNumber, title, btnElement, articleId = '') {
    const originalHtml = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="ph ph-spinner animate-spin text-[18px]"></i> Exportando...';
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
    const modalHtml = `
    <div id="duplicity-modal" class="fixed inset-0 bg-black/80 z-[500] flex items-center justify-center p-4 animate-fade-in">
        <div class="bg-white dark:bg-[#1e1f20] border border-yellow-500/50 rounded-2xl max-w-md p-6 shadow-2xl text-center">
            <div class="text-4xl mb-3">⚠️</div>
            <h2 class="text-xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">Aviso de Governança</h2>
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-6">Já existe um artigo similar a este (ID: <strong>#${dupArticle.articleNumber}</strong>). Por favor, verifique se não é melhor editar o existente.</p>
            <div class="flex justify-center gap-3">
                <button id="btn-dup-view" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">[Ver Existente]</button>
                <button id="btn-dup-continue" class="bg-gray-100 dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] hover:bg-gray-200 text-gray-700 dark:text-white px-4 py-2 rounded-lg text-sm transition-colors">[Continuar Criando]</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    document.getElementById('btn-dup-view').onclick = () => { 
        document.getElementById('duplicity-modal').remove(); 
        closeArticleModal(); 
        if(window.__kcs) window.__kcs.viewArticle(dupArticle.id); 
    };
    
    document.getElementById('btn-dup-continue').onclick = () => { 
        document.getElementById('duplicity-modal').remove(); 
        if(onContinue) onContinue(); 
    };
}

export function openReadmeModal(readmeMarkdown) {
    const modalHtml = `
    <div id="readme-modal" class="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4">
        <div class="bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl relative">
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-300 dark:border-[#3a3b3d] shrink-0">
                <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">📖 Documentação (README)</h2>
                <button onclick="document.getElementById('readme-modal').remove()" class="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white text-2xl font-bold transition-colors leading-none"><i class="ph ph-x"></i></button>
            </div>
            <div class="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-[#131314] text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap font-mono">${readmeMarkdown}</div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// ==========================================
// FUNÇÕES LEGADAS INTACTAS
// ==========================================

export function openSqlModal(script = null, onSave) {
    const modal = document.getElementById('sql-modal');
    const form = document.getElementById('sql-form');
    const title = document.getElementById('sql-modal-title');
    const formBody = document.getElementById('sql-form-body');
    
    if (!modal || !form || !formBody) return;
    
    title.textContent = script ? 'Editar Script SQL' : 'Novo Script SQL';
    const typeOptions = SQL_DB_TYPES.map(t => `<option value="${t.value}" ${script?.dbType === t.value ? 'selected' : ''}>${t.label}</option>`).join('');

    formBody.innerHTML = `
        <div>
            <label class="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Nome do Script *
            </label>
            <input type="text" id="sql-name" placeholder="Ex: Corrige CFOP Nulo na Tabela Produtos" class="w-full bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" required value="${script?.name || ''}" />
        </div>
        
        <div class="grid grid-cols-2 gap-4 mt-3">
            <div>
                <label class="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Banco de Dados</label>
                <select id="sql-db-type" class="w-full bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">${typeOptions}</select>
            </div>
            <div>
                <label class="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Operação</label>
                <select id="sql-category" class="w-full bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    <option value="SELECT" ${script?.sqlCategory === 'SELECT'?'selected':''}>Consulta (SELECT)</option>
                    <option value="UPDATE" ${script?.sqlCategory === 'UPDATE'?'selected':''}>Alteração (UPDATE/INSERT)</option>
                    <option value="DELETE" ${script?.sqlCategory === 'DELETE'?'selected':''}>Exclusão (DELETE/DROP)</option>
                </select>
            </div>
        </div>
        
        <div class="mt-3">
            <label class="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Descrição</label>
            <input type="text" id="sql-desc" placeholder="O que esse script resolve na prática?" class="w-full bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" value="${script?.description || ''}" />
        </div>
        
        <div class="mt-3">
            <label class="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Código SQL *</label>
            <textarea id="sql-code" rows="6" placeholder="SELECT * FROM table..." class="w-full bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-green-600 dark:text-green-400 font-mono text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:outline-none" required>${script?.code || ''}</textarea>
        </div>
        
        <div class="mt-3">
            <label class="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Visibilidade</label>
            <select id="sql-visibility" class="w-full bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="${VISIBILITY.PUBLIC}" ${script?.visibility === VISIBILITY.PUBLIC ? 'selected' : ''}>🌍 Público (Empresa)</option>
                <option value="${VISIBILITY.PRIVATE}" ${script?.visibility === VISIBILITY.PRIVATE ? 'selected' : ''}>🔒 Privado (Setor)</option>
            </select>
        </div>
    `;

    const footer = document.getElementById('sql-form-footer');
    if(footer) {
        footer.innerHTML = `
            <button type="button" id="btn-cancel-sql-footer" class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-4 py-2 rounded-lg border border-gray-300 dark:border-[#3a3b3d] hover:bg-gray-100 dark:hover:bg-[#131314]">Cancelar</button>
            <button type="submit" class="text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm">Salvar Script</button>
        `;
        document.getElementById('btn-cancel-sql-footer').onclick = closeSqlModal;
    }
    
    document.getElementById('btn-cancel-sql').onclick = closeSqlModal;
    
    form.onsubmit = (e) => { 
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
        closeSqlModal(); 
    };
    
    modal.classList.remove('hidden'); 
    modal.classList.add('flex');
}

export function closeSqlModal() { 
    window.__kcs.closeModal('sql-modal', false); 
}

export function openSqlViewModal(script) {
    const modal = document.getElementById('view-modal');
    if (!modal) return;
    
    const content = document.getElementById('view-modal-content');
    const safeText = (str) => { 
        if(!str) return ''; 
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); 
    };
    
    const currentUser = getCurrentUser();
    const userId = currentUser?.uid || currentUser?.id;
    const isFav = (script.favorites || []).includes(userId);

    if (content) {
        content.classList.add('relative');
        content.innerHTML = `
            <button onclick="window.__kcs.closeModal('view-modal', false)" title="Fechar" class="absolute top-2 right-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white text-2xl font-bold z-50 leading-none transition-colors"><i class="ph ph-x"></i></button>
            
            ${script.status === 'review' || script.status === 'pendente_revisao' ? `
            <div class="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-500/50 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-xl mb-4 flex items-start gap-3 shadow-sm mr-8">
                <i class="ph-fill ph-warning-circle text-[24px]"></i>
                <span class="text-sm font-medium mt-0.5"><strong>Atenção:</strong> Este script foi sinalizado ou está em revisão.</span>
            </div>` : ''}

            <div class="mb-4 pr-8">
                ${script.scriptNumber ? `<div class="text-purple-600 dark:text-purple-500 text-sm font-extrabold tracking-widest mb-1 uppercase">#SQL-${script.scriptNumber}</div>` : ''}
                <div class="flex items-center justify-between">
                    <h2 class="text-xl font-bold text-gray-900 dark:text-white">${safeText(script.name)}</h2>
                    <button onclick="window.__kcs.explainSql('${script.id}')" class="bg-yellow-100 dark:bg-yellow-600/20 text-yellow-600 dark:text-yellow-400 px-3 py-1 rounded text-xs font-bold hover:bg-yellow-200 dark:hover:bg-yellow-600/40"><i class="ph-fill ph-lightbulb mr-1"></i>Explicar IA</button>
                </div>
                <div class="mt-2">
                    ${script.visibility === VISIBILITY.PRIVATE ? `<span class="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs px-2 py-0.5 rounded-full flex w-max items-center gap-1"><i class="ph ph-lock"></i> Setor: ${safeText(script.sectorId)}</span>` : `<span class="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs px-2 py-0.5 rounded-full flex w-max items-center gap-1"><i class="ph ph-globe"></i> Público</span>`}
                </div>
            </div>
            
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">${safeText(script.description)}</p>
            
            <div class="relative mt-2">
                <button onclick="window.__kcs.copyCode(this)" class="absolute top-2 right-2 bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] hover:bg-gray-100 dark:hover:bg-[#131314] text-gray-700 dark:text-white text-xs px-2 py-1 rounded shadow transition-colors">Copiar</button>
                <pre class="bg-gray-50 dark:bg-[#131314] border border-gray-200 dark:border-[#3a3b3d] rounded-lg p-4 text-green-600 dark:text-green-400 font-mono text-sm overflow-x-auto shadow-inner"><code>${script.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
            </div>
            
            <div class="mt-6 pt-4 border-t border-gray-200 dark:border-[#3a3b3d] flex flex-col sm:flex-row gap-3 flex-wrap">
                <button onclick="window.__kcs.toggleSqlLike('${script.id}')" class="text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 flex items-center justify-center gap-2 text-sm bg-pink-100 dark:bg-pink-900/20 px-4 py-2 rounded-lg border border-pink-200 dark:border-pink-900/50 font-medium"><i class="ph-fill ph-heart text-[18px]"></i> Curtiu (${(script.likes || []).length})</button>
                <button onclick="window.__kcs.promptSqlComment('${script.id}')" class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center gap-2 text-sm bg-blue-100 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-900/50 font-medium"><i class="ph-fill ph-chat-circle text-[18px]"></i> Comentar (${(script.comments || []).length})</button>
                <button onclick="window.__kcs.toggleSqlFavorite('${script.id}')" class="text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 flex items-center justify-center gap-2 text-sm bg-yellow-100 dark:bg-yellow-900/20 px-4 py-2 rounded-lg border border-yellow-200 dark:border-yellow-900/50 font-medium"><i class="${isFav ? 'ph-fill' : 'ph'} ph-star text-[18px]"></i> ${isFav ? 'Desfavoritar' : 'Favoritar'}</button>
                <button onclick="window.__kcs.openHistory('${script.id}', 'sql')" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center gap-2 text-sm bg-white dark:bg-[#1e1f20] px-4 py-2 rounded-lg border border-gray-300 dark:border-[#3a3b3d] font-medium sm:ml-auto"><i class="ph-fill ph-clock-counter-clockwise text-[18px]"></i> Histórico</button>
                <button onclick="window.__kcs.flagSqlScript('${script.id}')" class="text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 flex items-center justify-center gap-2 text-sm bg-yellow-100 dark:bg-yellow-900/20 px-4 py-2 rounded-lg border border-yellow-200 dark:border-yellow-900/50 font-medium"><i class="ph-fill ph-warning-circle text-[18px]"></i> Reportar Erro</button>
            </div>
            
            ${script.comments && script.comments.length > 0 ? `
            <div class="space-y-3 mt-4">
                <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Comentários da Comunidade</h4>
                ${script.comments.map(c => `
                    <div class="bg-gray-50 dark:bg-[#131314] p-4 rounded-xl border border-gray-200 dark:border-[#3a3b3d] shadow-sm">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-xs font-bold text-gray-800 dark:text-gray-300">${safeText(c.userName)}</span>
                            <span class="text-[10px] text-gray-500">${new Date(c.date).toLocaleDateString()}</span>
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">${safeText(c.text)}</p>
                    </div>
                `).join('')}
            </div>` : '<p class="text-xs text-gray-500 mt-4 italic">Seja o primeiro a adicionar uma observação!</p>'}
        `;
    }
    
    modal.classList.remove('hidden'); 
    modal.classList.add('flex');
}

export function openHistoryModal(item, type) {
    const modal = document.getElementById('history-modal');
    const content = document.getElementById('history-list');
    if (!modal || !content) return;
    
    const safeText = (str) => { 
        if(!str) return ''; 
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); 
    };
    
    if (!item.history || item.history.length === 0) {
        content.innerHTML = '<p class="text-gray-400 text-sm italic text-center mt-10">Nenhum histórico de versões disponível.</p>';
    } else {
        const reversedHistory = [...item.history].reverse();
        const totalVersions = item.history.length;
        
        content.innerHTML = reversedHistory.map((h, reversedIndex) => {
            const originalIndex = totalVersions - 1 - reversedIndex;
            return `
            <details class="bg-white dark:bg-[#1e1f20] border border-gray-200 dark:border-[#3a3b3d] rounded-xl mb-3 shadow-sm group overflow-hidden">
                <summary class="p-4 flex justify-between items-center cursor-pointer list-none hover:bg-gray-50 dark:hover:bg-[#131314] transition-colors select-none focus:outline-none">
                    <div class="flex items-center gap-3">
                        <i class="ph ph-caret-right text-gray-500 transition-transform group-open:rotate-90"></i>
                        <div>
                            <p class="text-sm font-bold text-gray-800 dark:text-white">Versão ${originalIndex + 1}</p>
                            <p class="text-[10px] text-gray-500 mt-0.5">Salvo por <span class="font-medium">${safeText(h.updatedBy || 'Sistema')}</span> em ${new Date(h.updatedAt).toLocaleString()}</p>
                        </div>
                    </div>
                    <button onclick="window.__kcs.restoreVersion('${item.id}', '${type}', ${originalIndex})" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md text-xs font-bold transition-colors shadow-sm">Restaurar</button>
                </summary>
                <div class="p-5 border-t border-gray-200 dark:border-[#3a3b3d] bg-gray-50 dark:bg-[#131314] text-sm">
                    <div class="mb-4">
                        <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Título Registrado:</span>
                        <p class="mt-1 font-semibold text-gray-800 dark:text-white">${safeText(h.title || h.name)}</p>
                    </div>
                    <div>
                        <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Conteúdo Principal:</span>
                        <div class="mt-2 bg-white dark:bg-[#1e1f20] border border-gray-200 dark:border-[#3a3b3d] p-4 rounded-lg markdown-body overflow-x-auto text-xs text-gray-700 dark:text-gray-300 shadow-inner">
                            ${formatContentForView(h.steps || h.body || h.code)}
                        </div>
                    </div>
                </div>
            </details>
        `}).join('');
    }
    
    modal.classList.remove('hidden'); 
    modal.classList.add('flex');
}

export function openCategoryModal(refreshCallback) {
    const modal = document.getElementById('category-modal');
    const list = document.getElementById('category-list');
    const select = document.getElementById('cat-parent');
    const form = document.getElementById('category-form');
    const btnClose = document.getElementById('btn-close-category-modal');
    
    if (!modal || !list || !form) return;

    function renderList() {
        const categories = getFlatCategories();
        select.innerHTML = '<option value="">Raiz (Sem Pai)</option>' + categories.map(c => `<option value="${c.id}">${c.path}</option>`).join('');
        
        list.innerHTML = categories.map(c => `
            <div class="flex items-center justify-between bg-gray-50 dark:bg-[#131314] p-2 rounded border border-gray-200 dark:border-[#3a3b3d] mb-1">
                <span class="text-sm text-gray-800 dark:text-gray-300 font-medium"><i class="ph ${c.icon || 'ph-folder'} text-[16px] mr-1 align-text-bottom"></i> ${c.path}</span>
                <div class="flex gap-2">
                    <button onclick="window.__kcs.editCategory('${c.id}', '${c.name}', '${c.icon || ''}')" class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/20 rounded font-medium">Editar</button>
                    <button onclick="window.__kcs.deleteCategory('${c.id}')" class="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs px-2 py-1 bg-red-100 dark:bg-red-900/20 rounded font-medium">Excluir</button>
                </div>
            </div>
        `).join('') || '<p class="text-xs text-gray-500">Nenhuma categoria cadastrada.</p>';
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

    form.onsubmit = (e) => { 
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
    };
    
    if (btnClose) {
        btnClose.onclick = () => { 
            window.__kcs.closeModal('category-modal', false); 
        };
    }

    modal.classList.remove('hidden'); 
    modal.classList.add('flex');
}

export async function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const usersList = document.getElementById('users-list');
    const btnClose = document.getElementById('btn-close-settings-modal');
    
    if (!modal || !usersList) return;
    
    usersList.innerHTML = '<div class="flex justify-center p-10"><div class="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>';
    modal.classList.remove('hidden');
    modal.classList.add('flex');

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
            <div class="mb-8 border border-purple-200 dark:border-purple-900/30 bg-purple-50/50 dark:bg-purple-900/10 rounded-xl p-5">
                <h3 class="text-sm font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <i class="ph-fill ph-buildings text-[18px]"></i> Painel Master (Empresas Clientes)
                </h3>
                
                <div class="flex flex-col sm:flex-row gap-2 mb-6">
                    <input type="text" id="new-company-name" placeholder="Nome da Empresa" class="flex-[2] bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
                    <input type="text" id="new-company-domain" placeholder="Domínios (ex: nissei.com, nisseisa.com)" class="flex-[2] bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none font-mono" />
                    <button onclick="window.__kcs.createNewCompany()" class="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg text-sm font-bold transition-all shadow-md active:scale-95 shrink-0">Cadastrar Cliente</button>
                </div>
                
                <div class="hidden sm:flex items-center text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-3 mt-4">
                    <div class="flex-[2]">Empresa</div>
                    <div class="flex-[2]">Domínios</div>
                    <div class="w-24 text-right pr-2">Ações</div>
                </div>

                <div class="flex flex-col border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto custom-scrollbar bg-white dark:bg-[#15171b]">
                    ${companies.map(c => {
                        const domainsArray = Array.isArray(c.domains) ? c.domains : (c.domains ? String(c.domains).split(',') : []);
                        const domainsLabel = domainsArray.join(', ') || 'Nenhum';
                        
                        return `
                        <div class="flex flex-col sm:flex-row sm:items-center p-3 border-b last:border-b-0 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors gap-3 group">
                            
                            <div class="flex-[2] min-w-0">
                                <div class="flex items-center gap-2 mb-0.5">
                                    <span class="font-bold text-sm text-gray-900 dark:text-white truncate">${safeText(c.companyName)}</span>
                                    <span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50 uppercase tracking-tighter shrink-0">${c.plan || 'Starter'}</span>
                                </div>
                                <div class="company-id-display" style="font-size: 11px !important;">ID: ${c.companyId.toUpperCase()}</div>
                            </div>

                            <div class="flex-[2] min-w-0 flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                                <i class="ph ph-globe text-gray-400 dark:text-gray-500"></i>
                                <span class="truncate" title="${safeText(domainsLabel)}">${safeText(domainsLabel)}</span>
                            </div>

                            <div class="flex items-center justify-end gap-1.5 w-full sm:w-auto mt-2 sm:mt-0 shrink-0 opacity-100 sm:opacity-50 group-hover:opacity-100 transition-opacity">
                                <button onclick="window.__kcs.promptEditCompany('${c.companyId}', '${safeText(c.companyName)}', '${safeText(domainsLabel)}', '${c.plan || 'Starter'}')" 
                                        class="flex-1 sm:flex-none bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors">
                                    Editar
                                </button>
                                <button onclick="window.__kcs.deleteCompany('${c.companyId}')" 
                                        class="px-2.5 py-1.5 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-500 rounded-md text-[14px] transition-colors">
                                    <i class="ph ph-trash"></i>
                                </button>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>`;
        }

        const invitesHtml = `
        <div class="mb-8 border border-blue-200 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-5">
            <h3 class="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <i class="ph-fill ph-envelope-simple text-[18px]"></i> Whitelist de Exceção (Convites)
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">Use este painel para liberar e-mails que não possuam o domínio oficial da empresa.</p>
            
            <form id="form-invite-user" class="flex flex-wrap lg:flex-nowrap gap-2 mb-4">
                <input type="email" id="invite-email" placeholder="E-mail (ex: nome@gmail.com)" class="flex-[2] min-w-[200px] bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" required />
                
                ${isSuperAdmin ? `
                <select id="invite-company" class="flex-1 min-w-[150px] bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    ${companiesSelectOptions}
                </select>
                ` : `<input type="hidden" id="invite-company" value="${currentUser.companyId}" />`}
                
                <select id="invite-sector" class="flex-1 min-w-[150px] bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    ${sectorsOptionsHtml('')}
                </select>
                
                <select id="invite-role" class="flex-1 min-w-[120px] bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-[#3a3b3d] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    ${isSuperAdmin ? `<option value="super_admin">Super Admin</option>` : ''}
                    <option value="admin">Admin</option>
                    <option value="analyst">Analista KCS</option>
                    <option value="user" selected>Usuário Base</option>
                </select>
                
                <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors shadow-md">Autorizar</button>
            </form>
            
            <div class="space-y-2 max-h-40 overflow-y-auto">
                ${invites.map(inv => `
                    <div class="flex items-center justify-between bg-white dark:bg-[#1e1f20] p-3 rounded-lg border border-gray-200 dark:border-[#3a3b3d] shadow-sm">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center"><i class="ph-fill ph-envelope"></i></div>
                            <div>
                                <p class="text-sm font-bold text-gray-900 dark:text-white">${safeText(inv.email)}</p>
                                <p class="text-[10px] text-gray-500 uppercase font-bold tracking-tight">${inv.role} | Setor: ${inv.sectorId} ${isSuperAdmin ? `| Empresa: ${inv.tenantId || inv.companyId}` : ''}</p>
                            </div>
                        </div>
                        <button onclick="window.__kcs.removeInvite('${inv.email}')" class="text-red-600 dark:text-red-400 font-bold px-3 py-1.5 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md transition-colors text-xs">Revogar</button>
                    </div>
                `).join('') || '<p class="text-xs text-gray-500 text-center py-2 italic">Nenhum convite pendente.</p>'}
            </div>
        </div>`;

        const activeUsersHtml = `
        <div class="mb-8 border border-gray-200 dark:border-[#3a3b3d] bg-gray-50 dark:bg-[#131314] rounded-xl p-5">
            <h3 class="text-sm font-bold text-gray-800 dark:text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <i class="ph-fill ph-users text-[18px]"></i> Usuários Registrados
            </h3>
            <div class="space-y-2">
                ${users.map(u => {
                    const safeName = (u.displayName && String(u.displayName) !== 'undefined') ? u.displayName : 'Usuário KCS';
                    const safeEmail = (u.email && String(u.email) !== 'undefined') ? u.email : 'Sem e-mail';
                    return `
                    <div class="flex flex-col lg:flex-row lg:items-center justify-between bg-white dark:bg-[#1e1f20] p-3 rounded-lg border border-gray-200 dark:border-[#3a3b3d] shadow-sm gap-3 transition-colors hover:border-gray-300 dark:hover:border-gray-700">
                        <div class="flex items-center gap-3">
                            <img src="${u.photoURL || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded-full border border-gray-300 dark:border-gray-600 object-cover" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 100 100\\'><circle cx=\\'50\\' cy=\\'50\\' r=\\'50\\' fill=\\'%23CBD5E1\\'/></svg>'">
                            <div>
                                <p class="text-sm font-bold text-gray-900 dark:text-white">${safeText(safeName)}</p>
                                <p class="text-[10px] text-gray-500 font-mono">${safeText(safeEmail)}</p>
                            </div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                            ${isSuperAdmin ? `
                            <select onchange="window.__kcs.updateUserCompany('${u.id}', this.value)" class="bg-gray-50 dark:bg-[#131314] border border-gray-300 dark:border-[#3a3b3d] rounded-md px-2 py-1.5 text-xs text-purple-700 dark:text-purple-300 font-bold cursor-pointer shadow-sm focus:ring-1 focus:ring-purple-500 focus:outline-none">
                                <option value="LIMBO_TENANT" ${u.companyId === 'LIMBO_TENANT' ? 'selected' : ''}>⚠️ Pendente</option>
                                ${companiesSelectOptions.replace(`value="${u.companyId}"`, `value="${u.companyId}" selected`)}
                            </select>` : ''}

                            <select onchange="window.__kcs.updateUserSector('${u.id}', this.value)" class="bg-gray-50 dark:bg-[#131314] border border-gray-300 dark:border-[#3a3b3d] rounded-md px-2 py-1.5 text-xs text-green-700 dark:text-green-300 font-bold cursor-pointer focus:ring-1 focus:ring-green-500 focus:outline-none">
                                ${sectorsOptionsHtml(u.sectorId || 'TI')}
                            </select>

                            <select onchange="window.__kcs.updateUserRole('${u.id}', this.value)" class="bg-gray-50 dark:bg-[#131314] border border-gray-300 dark:border-[#3a3b3d] rounded-md px-2 py-1.5 text-xs text-blue-700 dark:text-blue-300 font-bold cursor-pointer focus:ring-1 focus:ring-blue-500 focus:outline-none">
                                ${isSuperAdmin ? `<option value="super_admin" ${u.role === 'super_admin' ? 'selected' : ''}>Super Admin</option>` : ''}
                                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                                <option value="analyst" ${u.role === 'analyst' ? 'selected' : ''}>Analista</option>
                                <option value="user" ${u.role === 'user' ? 'selected' : ''}>Usuário</option>
                            </select>
                            
                            <button onclick="window.__kcs.deleteUser('${u.id}')" class="text-red-600 dark:text-red-400 font-bold bg-red-100 dark:bg-red-900/20 px-3 py-1.5 rounded-md text-xs transition-colors hover:bg-red-200 dark:hover:bg-red-900/40">
                                <i class="ph ph-trash"></i>
                            </button>
                        </div>
                    </div>`;
                }).join('') || '<p class="text-xs text-gray-500 text-center py-4">Nenhum usuário ativo.</p>'}
            </div>
        </div>`;

        const backupHtml = isSuperAdmin ? `
            <div class="border border-green-200 dark:border-green-900/30 bg-green-50/50 dark:bg-green-900/10 rounded-xl p-5 mb-4 shadow-sm">
                <h3 class="text-sm font-bold text-green-700 dark:text-green-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <i class="ph-fill ph-hard-drives text-[18px]"></i> Proteção de Dados e Backup
                </h3>
                <p class="text-xs text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                    O backup é executado na arquitetura Cloud do Google (Firestore). 
                    Ao disparar o backup manualmente, todo o banco de dados será condensado em um arquivo seguro depositado no Bucket: 
                    <strong class="font-mono text-[11px] bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded text-green-800 dark:text-green-300">gs://kcs-system-180db-backups</strong>.
                </p>
                <button onclick="window.__kcs.triggerManualBackup()" class="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-95">
                    <i class="ph-bold ph-cloud-arrow-down text-lg"></i>
                    Disparar Backup na Nuvem
                </button>
            </div>` : '';

        usersList.innerHTML = companiesHtml + invitesHtml + activeUsersHtml + backupHtml;

        const formInvite = document.getElementById('form-invite-user');
        if (formInvite) {
            formInvite.onsubmit = async (e) => {
                e.preventDefault();
                const em = document.getElementById('invite-email').value;
                const cp = document.getElementById('invite-company')?.value || currentUser.companyId;
                const sc = document.getElementById('invite-sector').value;
                const rl = document.getElementById('invite-role').value;
                await window.__kcs.inviteUser(em, rl, cp, sc);
            };
        }

    } catch (e) { 
        usersList.innerHTML = `<p class="text-xs text-red-600 dark:text-red-400">Erro: ${e.message}</p>`; 
    }
    
    if (btnClose) {
        btnClose.onclick = () => { 
            window.__kcs.closeModal('settings-modal', false); 
        };
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
    
    msgEl.innerHTML = message;
    modal.classList.remove('hidden'); 
    modal.classList.add('flex');
    
    btnOk.onclick = () => { 
        modal.classList.add('hidden'); 
        modal.classList.remove('flex'); 
    };
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
        
        msgEl.textContent = message; 
        inputEl.value = defaultVal;
        modal.classList.remove('hidden'); 
        modal.classList.add('flex'); 
        inputEl.focus();
        
        const cleanup = () => { 
            modal.classList.add('hidden'); 
            modal.classList.remove('flex'); 
        };
        
        btnCancel.onclick = () => { 
            cleanup(); 
            resolve(null); 
        };
        
        btnConfirm.onclick = () => { 
            cleanup(); 
            resolve(inputEl.value); 
        };
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
    
    msgEl.textContent = msg; 
    modal.classList.remove('hidden'); 
    modal.classList.add('flex');
    
    const cleanup = () => { 
        modal.classList.add('hidden'); 
        modal.classList.remove('flex'); 
    };
    
    btnNo.onclick = () => cleanup();
    btnYes.onclick = async () => { 
        cleanup(); 
        await onConfirm(); 
    };
}