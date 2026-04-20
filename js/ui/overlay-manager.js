/**
 * overlay-manager.js — Sistema de Modais, Docking e Focus Trap (VS Code Architecture)
 */

const OverlayManager = (() => {
    let activeModalId = null;
    
    // MAPA INTERNO DE MODAIS (Rastreia as abas minimizadas)
    const dockedModals = new Map(); 

    // Utilitário para capturar elementos focáveis
    const FOCUSABLE_SELECTORS = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    /**
     * Inicializa os listeners globais de teclado
     */
    function initGlobalListeners() {
        document.addEventListener('keydown', handleGlobalKeydown);
    }

    /**
     * VISIBILIDADE DINÂMICA DO DOCK
     */
    function updateDockVisibility() {
        const dockRoot = document.getElementById('kcs-dock');
        if (!dockRoot) return;

        if (dockedModals.size === 0) {
            dockRoot.classList.remove('dock-visible');
        } else {
            dockRoot.classList.add('dock-visible');
        }
    }

    /**
     * REMOÇÃO SEGURA DE DOCK TAB
     */
    function removeDockTab(modalId) {
        if (dockedModals.has(modalId)) {
            const tabNode = dockedModals.get(modalId);
            tabNode.remove(); // Remove da DOM
            dockedModals.delete(modalId); // Remove do Map
            updateDockVisibility();
        }
    }

    /**
     * CRIAÇÃO AUTOMÁTICA DE DOCK TAB
     */
    function createDockTab(modalNode) {
        const modalId = modalNode.id;

        // GARANTIR NÃO DUPLICAÇÃO DE ABAS
        if (dockedModals.has(modalId)) return;

        const dockRoot = document.getElementById('kcs-dock');
        
        // 2 - WARNING QUANDO KCS-DOCK NÃO EXISTIR
        if (!dockRoot) {
            console.warn('kcs-dock não encontrado');
            return;
        }

        // Cria o elemento visual da aba
        const tabNode = document.createElement('div');
        tabNode.className = 'dock-tab kcs-minimized';
        tabNode.dataset.modal = modalId;

        // O título deve vir do dataset.title ou do próprio ID
        const title = modalNode.dataset.title || modalId;

        tabNode.innerHTML = `
            <span class="dock-tab-title" title="${title}">${title}</span>
            <div class="dock-tab-actions">
                <button type="button" class="btn-restore" title="Restaurar">⤢</button>
                <button type="button" class="btn-close" title="Fechar">✕</button>
            </div>
        `;

        // Eventos dos botões internos da aba
        const btnRestore = tabNode.querySelector('.btn-restore');
        const btnClose = tabNode.querySelector('.btn-close');

        // Clicar em qualquer lugar da aba também restaura
        tabNode.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                restoreOverlay(modalId);
            }
        });

        btnRestore.addEventListener('click', (e) => {
            e.stopPropagation();
            restoreOverlay(modalId);
        });

        btnClose.addEventListener('click', (e) => {
            e.stopPropagation();
            closeOverlay(modalId);
        });

        // Adiciona à DOM e registra no Map
        dockRoot.appendChild(tabNode);
        dockedModals.set(modalId, tabNode);
        updateDockVisibility();
    }

    /**
     * Abre um novo modal ou move um já existente para a Overlay Layer
     */
    function openOverlay(modalNode) {
        if (!modalNode || !modalNode.id) return;

        const overlayRoot = document.getElementById('overlay-root');
        
        // VERIFICAÇÃO DE SEGURANÇA
        if (!overlayRoot) {
            console.warn('overlay-root não encontrado');
            return;
        }
        
        // Se houver outro modal aberto, ele é minimizado automaticamente
        if (activeModalId && activeModalId !== modalNode.id) {
            minimizeOverlay(activeModalId);
        }

        // Mover o nó fisicamente para o centro da tela
        overlayRoot.appendChild(modalNode);
        
        // Define as classes para exibir o modal e ativa o ponteiro
        modalNode.classList.remove('hidden', 'kcs-minimized');
        modalNode.classList.add('kcs-active-overlay');
        
        activeModalId = modalNode.id;

        // Remove a aba do dock caso o modal estivesse minimizado
        removeDockTab(modalNode.id);

        trapFocus(modalNode);
    }

    /**
     * Minimize usa kcs-minimized em vez de hidden
     */
    function minimizeOverlay(modalId) {
        const modalNode = document.getElementById(modalId);
        const dockRoot = document.getElementById('kcs-dock');

        if (!modalNode || !dockRoot) return;

        // Move fisicamente o modal para o Dock
        dockRoot.appendChild(modalNode);
        modalNode.classList.remove('kcs-active-overlay');
        
        // Mantém a estrutura na DOM viva, o CSS controlará o que esconder
        modalNode.classList.add('kcs-minimized');

        if (activeModalId === modalId) {
            activeModalId = null;
        }

        // Cria a aba visual correspondente
        createDockTab(modalNode);
    }

    /**
     * Restaura uma aba do Dock de volta para o Overlay Layer.
     */
    function restoreOverlay(modalId) {
        const modalNode = document.getElementById(modalId);
        if (!modalNode) return;

        // openOverlay já cuida de remover a aba e minimizar o atual
        openOverlay(modalNode);
    }

    /**
     * Preserva o modal vivo na DOM ao fechar
     */
    function closeOverlay(modalId) {
        // Antes de lidar com o modal, removemos a aba (se existir)
        removeDockTab(modalId);

        const modalNode = document.getElementById(modalId);
        if (modalNode) {
            // Remove estados ativos/minimizados
            modalNode.classList.remove('kcs-active-overlay', 'kcs-minimized');
            
            // Oculta visualmente em vez de destruir
            modalNode.classList.add('hidden');
            
            // Movemos de volta para o body para liberar o #overlay-root (Garante CSS :empty)
            document.body.appendChild(modalNode);
        }

        if (activeModalId === modalId) {
            activeModalId = null;
        }
    }

    /**
     * Gerenciamento de Foco e Atalhos de Teclado
     */
    function handleGlobalKeydown(e) {
        if (!activeModalId) return;

        const activeModal = document.getElementById(activeModalId);
        if (!activeModal) return;

        // Regra ESC
        if (e.key === 'Escape') {
            const activeEl = document.activeElement;
            const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
            
            if (isInputFocused) {
                activeEl.blur(); // Desfoca o input primeiro
            } else {
                closeOverlay(activeModalId); // Se não houver input focado, fecha o modal
            }
            e.preventDefault();
            return;
        }

        // Regra TAB (Focus Trap)
        if (e.key === 'Tab') {
            const focusableElements = activeModal.querySelectorAll(FOCUSABLE_SELECTORS);
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) { // Shift + Tab
                if (document.activeElement === firstElement) {
                    lastElement.focus();
                    e.preventDefault();
                }
            } else { // Tab apenas
                if (document.activeElement === lastElement) {
                    firstElement.focus();
                    e.preventDefault();
                }
            }
        }
    }

    function trapFocus(modalNode) {
        const focusableElements = modalNode.querySelectorAll(FOCUSABLE_SELECTORS);
        if (focusableElements.length > 0) {
            requestAnimationFrame(() => {
                focusableElements[0].focus();
            });
        }
    }

    return {
        init: initGlobalListeners,
        open: openOverlay,
        minimize: minimizeOverlay,
        restore: restoreOverlay,
        close: closeOverlay
    };
})();

// Expõe para o escopo global do projeto
window.OverlayManager = OverlayManager;

// 1 - PROTEÇÃO CONTRA MÚLTIPLOS LISTENERS
document.addEventListener('DOMContentLoaded', () => {
    if (!window.__overlayInitialized) {
        OverlayManager.init();
        window.__overlayInitialized = true;
    }
});