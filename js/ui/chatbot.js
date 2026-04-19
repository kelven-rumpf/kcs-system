/**
 * ui/chatbot.js — Motor do Chatbot IA (SaaS Premium)
 * Assistente Nissei Sensei: Especialista KCS Hub
 */

import { CONFIG, TENANT_KEYS } from '../config.js';
import { searchDirect, searchSqlScripts } from '../services/search.js';
import { dbCloud } from '../services/cloud.js';
import { collection, addDoc, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { getCurrentUser } from '../auth.js';

let isChatbotInitialized = false;
const responseCache = new Map();

const SMART_PROMPTS = ['Resetar Senha', 'Erro de Impressora', 'Configurar Pinpad'];

// =========================================================
// CSS INJETADO (BOTÃO DE LINK MARKDOWN - UX SAAS)
// =========================================================
const style = document.createElement('style');
style.innerHTML = `
.kcs-link-button {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 10px 16px;
  background-color: #2563eb; 
  color: #ffffff !important;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.85rem;
  margin-top: 0.75rem;
  margin-bottom: 0.5rem;
  transition: all 0.2s ease;
  border: none;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  width: fit-content;
}
.kcs-link-button:hover { 
  background-color: #1d4ed8; 
  transform: translateY(-1px); 
  box-shadow: 0 4px 6px rgba(0,0,0,0.15);
}
.kcs-link-button:active { transform: translateY(0); }
`;
document.head.appendChild(style);

// =========================================================
// INTELIGÊNCIA DE PERSONA (NISSEI SENSEI) E SAUDAÇÃO
// =========================================================
const PLANETS = ["Marte", "Kepler-452b", "Cybertron", "Tatooine", "Gliese-Prime", "Andara-X", "Helion-9"];

function getRandomPlanet() {
    return PLANETS[Math.floor(Math.random() * PLANETS.length)];
}

function initPersona() {
    if (!sessionStorage.getItem("bot_planet")) {
        sessionStorage.setItem("bot_planet", getRandomPlanet());
    }
    sessionStorage.setItem("bot_name", "Nissei Sensei");
}

function getGreetingByTime() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Bom dia";
    if (hour >= 12 && hour < 18) return "Boa tarde";
    return "Boa noite";
}

function getGreetingHTML() {
    initPersona();
    const botName = sessionStorage.getItem("bot_name");
    const greeting = getGreetingByTime();
    sessionStorage.setItem("hasGreeted", "true");

    return `
        <div class="saudacao-inicial animate-fade-in">
            <p class="mb-2 text-gray-800 dark:text-gray-100 text-[15px]"><strong>${greeting}! Sou o ${botName}.</strong></p>
            <p class="mb-3 text-gray-600 dark:text-gray-400 text-sm">Como posso otimizar seus processos no KCS Hub hoje?</p>
            <p class="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1.5 mt-3">Pesquisas Frequentes:</p>
            <div class="flex flex-wrap gap-2 mt-2">
                ${SMART_PROMPTS.map(p => `<button type="button" class="btn-smart-prompt bg-white dark:bg-[#1e1f20] hover:bg-gray-50 dark:hover:bg-[#131314] text-gray-700 dark:text-gray-300 text-xs font-medium px-3 py-1.5 rounded-md border border-gray-200 dark:border-[#3a3b3d] shadow-sm transition-colors">${p}</button>`).join('')}
            </div>
        </div>
    `;
}

// =========================================================
// DELEGAÇÃO DE EVENTOS GLOBAL
// =========================================================
document.addEventListener('click', (e) => {
    const btnOpenKcs = e.target.closest('.btn-open-kcs');
    if (btnOpenKcs) {
        e.preventDefault();
        e.stopPropagation();
        const kcsId = btnOpenKcs.getAttribute('data-kcs-id');
        window.__kcs_trigger_article(kcsId);
    }

    const btnClearChat = e.target.closest('#btn-clear-chat');
    if (btnClearChat) {
        e.preventDefault();
        clearChatHistory();
    }
});

// =========================================================
// FUNÇÃO GLOBAL DE DISPARO
// =========================================================
window.__kcs_trigger_article = function(rawId) {
    if (!rawId || rawId === 'undefined') return;

    const cleanIdStr = String(rawId).replace(/^(ID_SISTEMA:|ID:|KCS:)\s*/i, '').trim();
    const isPopout = new URLSearchParams(window.location.search).get('chat_popout') === 'true';

    try {
        if (isPopout) {
            if (window.opener && !window.opener.closed && typeof window.opener.__kcs?.viewArticle === 'function') {
                window.opener.__kcs.viewArticle(cleanIdStr);
                window.opener.focus();
            } else {
                alert('⚠️ A janela principal do KCS Hub foi fechada. Não é possível abrir o procedimento.');
            }
        } else {
            if (typeof window.__kcs !== 'undefined' && typeof window.__kcs.viewArticle === 'function') {
                window.__kcs.viewArticle(cleanIdStr);
            } else {
                alert('⚠️ Erro de Escopo: A API de leitura não está acessível.');
            }
        }
    } catch (e) {
        console.error('[KCS Bridge] Erro de execução:', e);
    }
};

// =========================================================
// HELPERS DE SINCRONIZAÇÃO E LIMPEZA
// =========================================================
function syncChatState(container) {
    const currentHtml = container.innerHTML;
    localStorage.setItem('kcs_history_current', currentHtml);
    localStorage.setItem('kcs_chat_sync_time', Date.now().toString()); 
    
    const isPopout = new URLSearchParams(window.location.search).get('chat_popout') === 'true';
    if (isPopout && window.opener && !window.opener.closed) {
        try { window.opener.postMessage({ type: 'KCS_CHAT_UPDATE', html: currentHtml }, '*'); } catch(e) {}
    }
}

function clearChatHistory() {
    const messagesEl = document.getElementById('chatbot-messages');
    if (!messagesEl) return;

    messagesEl.innerHTML = '';
    appendBotHTMLMessage(getGreetingHTML(), messagesEl);
    
    localStorage.removeItem('kcs_history_current');
    localStorage.setItem('kcs_chat_sync_time', Date.now().toString());

    const isPopout = new URLSearchParams(window.location.search).get('chat_popout') === 'true';
    if (isPopout && window.opener && !window.opener.closed) {
        try { window.opener.postMessage({ type: 'KCS_CHAT_CLEAR' }, '*'); } catch(e) {}
    }
}

export function initChatbot() {
    if (isChatbotInitialized) return;

    initPersona();
    const botName = sessionStorage.getItem("bot_name");

    const isPopout = new URLSearchParams(window.location.search).get('chat_popout') === 'true';

    if (isPopout) {
        document.querySelectorAll('.sidebar-desktop, .sidebar-mobile-toggle, header, main:not(#chatbot-container)')
            .forEach(el => { if(el) el.style.display = 'none'; });
        document.body.style.background = 'var(--bg-main, #ffffff)';
    }

    const container = document.getElementById('chatbot-container');
    if (!container) return;
    
    if (isPopout) {
        container.className = 'fixed inset-0 z-[9999] w-full h-full';
    } else {
        container.className = 'fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-[9999] pointer-events-none w-full sm:w-auto';
    }
    
    const windowClasses = isPopout 
        ? 'flex flex-col bg-white dark:bg-surface w-full h-full pointer-events-auto z-[9999]'
        : 'hidden flex-col bg-white dark:bg-surface border-0 sm:border border-gray-200 dark:border-border-subtle rounded-none sm:rounded-2xl shadow-2xl w-full sm:w-[400px] h-[100dvh] sm:h-[600px] max-h-[100dvh] overflow-hidden pointer-events-auto transition-all duration-300 absolute bottom-0 sm:bottom-20 right-0 origin-bottom-right z-[9999]';

    const headerButtons = isPopout 
        ? `<div class="absolute right-3 top-[env(safe-area-inset-top,0.5rem)] sm:top-3.5 flex items-center gap-1">
               <button id="btn-clear-chat" class="w-10 h-10 text-gray-500 hover:text-red-500 transition-colors rounded-full flex items-center justify-center" title="Limpar Histórico"><i class="ph-bold ph-trash text-lg"></i></button>
               <div class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1"></div>
               <button id="btn-dock-chatbot" class="w-10 h-10 text-gray-500 hover:text-blue-600 transition-colors rounded-full flex items-center justify-center" title="Re-encaixar Chat"><i class="ph-bold ph-arrows-in-simple text-xl"></i></button>
           </div>`
        : `<div class="absolute right-3 top-[env(safe-area-inset-top,0.5rem)] sm:top-3.5 flex items-center gap-1">
               <button id="btn-clear-chat" class="w-10 h-10 text-gray-500 hover:text-red-500 transition-colors rounded-full flex items-center justify-center" title="Limpar Histórico"><i class="ph-bold ph-trash text-lg"></i></button>
               <button id="btn-external-popout" class="w-10 h-10 text-gray-500 hover:text-blue-600 transition-colors rounded-full flex items-center justify-center hidden sm:flex" title="Nova Janela (Pop-out Externo)"><i class="ph-bold ph-arrow-square-out text-lg"></i></button>
               <button id="btn-pip-chatbot" class="w-10 h-10 text-gray-500 hover:text-blue-600 transition-colors rounded-full flex items-center justify-center hidden sm:flex" title="Desencaixar / Arrastar (Draggable)"><i class="ph-bold ph-corners-out text-lg"></i></button>
               <button id="btn-close-chatbot" class="w-10 h-10 text-gray-500 hover:text-red-500 transition-colors rounded-full flex items-center justify-center sm:hidden" title="Fechar Chat"><i class="ph-bold ph-x text-lg"></i></button>
           </div>`;

    const toggleButton = isPopout
        ? ''
        : `<button id="btn-toggle-chatbot" class="absolute bottom-4 right-4 sm:bottom-0 sm:right-0 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center justify-center text-3xl transition-transform hover:scale-105 pointer-events-auto">
               <i class="ph-fill ph-chat-teardrop-dots"></i>
           </button>`;

    container.innerHTML = `
        <div id="chatbot-window" class="${windowClasses}">
            <header id="kcs-chat-header" class="bg-gray-50 dark:bg-surface border-b border-gray-200 dark:border-border-subtle p-4 flex items-center justify-between shrink-0 select-none relative pt-[env(safe-area-inset-top,1rem)] sm:pt-4 transition-colors">
                <div id="chatbot-header-name" class="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-100 pr-32">
                    <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0"><i class="ph-fill ph-robot text-lg"></i></div>
                    <span class="truncate pointer-events-none">${botName}</span>
                </div>
                ${headerButtons}
            </header>
            <div id="chatbot-messages" class="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-bg-main custom-scrollbar"></div>
            <div class="bg-gray-50 dark:bg-surface border-t border-gray-200 dark:border-border-subtle flex flex-col shrink-0">
                <form id="chatbot-form" class="p-3">
                    <div class="flex items-end bg-white dark:bg-bg-main border border-gray-300 dark:border-border-subtle rounded-2xl px-2 py-1.5 focus-within:border-blue-500 transition-all shadow-inner pb-[env(safe-area-inset-bottom,0.5rem)] sm:pb-1.5">
                        <textarea id="chatbot-input" rows="1" placeholder="Consultar base de conhecimento..." class="w-full bg-transparent border-0 ring-0 outline-none focus:outline-none focus:ring-0 text-gray-900 dark:text-gray-100 px-2 py-3 text-base sm:text-sm resize-none overflow-hidden max-h-[120px] min-h-[44px]"></textarea>
                        <button type="submit" class="w-11 h-11 mb-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shrink-0 shadow-md flex items-center justify-center"><i class="ph-bold ph-paper-plane-right text-lg"></i></button>
                    </div>
                </form>
            </div>
        </div>
        ${toggleButton}
    `;

    setupChatbotEvents(container, botName, isPopout);
    isChatbotInitialized = true;
}

function parseMarkdownForChat(text) {
    if (!text) return '';
    if (typeof marked !== 'undefined') {
        marked.setOptions({ breaks: true, gfm: true });
        return marked.parse(text);
    }
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

function setupChatbotEvents(container, botName, isPopout) {
    const windowEl = document.getElementById('chatbot-window');
    const headerEl = document.getElementById('kcs-chat-header');
    const input = document.getElementById('chatbot-input');
    const form = document.getElementById('chatbot-form');
    const messagesEl = document.getElementById('chatbot-messages');
    
    const historyHTML = localStorage.getItem('kcs_history_current');
    if (historyHTML) {
        messagesEl.innerHTML = historyHTML;
        scrollToBottom(messagesEl);
    } else if (messagesEl.children.length === 0) {
        appendBotHTMLMessage(getGreetingHTML(), messagesEl);
    }

    if (isPopout) {
        const btnDock = document.getElementById('btn-dock-chatbot');
        if (btnDock) btnDock.onclick = () => window.close();

        window.addEventListener('beforeunload', () => {
            if (messagesEl.innerHTML.includes('saudacao-inicial') && messagesEl.children.length === 1) {
            } else {
                localStorage.setItem('kcs_history_current', messagesEl.innerHTML);
            }
            localStorage.setItem('kcs_popout_closed', Date.now().toString());
            try {
                if (window.opener && !window.opener.closed) {
                    window.opener.postMessage({ type: 'KCS_CHAT_CLOSED', html: messagesEl.innerHTML }, '*');
                }
            } catch(e) {}
        });
        
        window.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'KCS_CHAT_CLEAR') {
                messagesEl.innerHTML = '';
                appendBotHTMLMessage(getGreetingHTML(), messagesEl);
            }
        });
    } else {
        window.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'KCS_CHAT_UPDATE') {
                messagesEl.innerHTML = e.data.html;
                scrollToBottom(messagesEl);
            } 
            else if (e.data && e.data.type === 'KCS_CHAT_CLEAR') {
                messagesEl.innerHTML = '';
                appendBotHTMLMessage(getGreetingHTML(), messagesEl);
            }
            else if (e.data && e.data.type === 'KCS_CHAT_CLOSED') {
                messagesEl.innerHTML = e.data.html;
                scrollToBottom(messagesEl);
                if (windowEl.classList.contains('hidden')) {
                    const btnToggle = document.getElementById('btn-toggle-chatbot');
                    if (btnToggle) btnToggle.click();
                }
            }
        });

        window.addEventListener('storage', (e) => {
            if (e.key === 'kcs_chat_sync_time' || e.key === 'kcs_popout_closed') {
                const updatedHTML = localStorage.getItem('kcs_history_current');
                if (updatedHTML) {
                    messagesEl.innerHTML = updatedHTML;
                } else {
                    messagesEl.innerHTML = '';
                    appendBotHTMLMessage(getGreetingHTML(), messagesEl);
                }
                scrollToBottom(messagesEl);
                
                if (e.key === 'kcs_popout_closed' && windowEl.classList.contains('hidden')) {
                    const btnToggle = document.getElementById('btn-toggle-chatbot');
                    if (btnToggle) btnToggle.click();
                }
            }
        });
    }

    if (!isPopout) {
        const btnToggle = document.getElementById('btn-toggle-chatbot');
        const btnPip = document.getElementById('btn-pip-chatbot');
        const btnExternalPopout = document.getElementById('btn-external-popout');
        const btnCloseMobile = document.getElementById('btn-close-chatbot');

        btnToggle.onclick = () => {
            const isHidden = windowEl.classList.contains('hidden');
            windowEl.classList.toggle('hidden', !isHidden);
            windowEl.classList.toggle('flex', isHidden);
            if (isHidden) input.focus();
            btnToggle.innerHTML = isHidden ? '<i class="ph-bold ph-x text-2xl"></i>' : '<i class="ph-fill ph-chat-teardrop-dots"></i>';
        };

        if (btnCloseMobile) btnCloseMobile.onclick = () => btnToggle.click();

        if (btnExternalPopout) {
            btnExternalPopout.onclick = () => {
                btnToggle.click(); 
                localStorage.setItem('kcs_history_current', messagesEl.innerHTML);
                const chatUrl = window.location.origin + window.location.pathname + '?chat_popout=true';
                window.open(chatUrl, 'KCSAssistant', 'width=450,height=650,left=100,top=100,resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no');
            };
        }

        let isExpanded = false;
        let isDragging = false;
        let currentX, currentY, initialX, initialY;
        let xOffset = 0, yOffset = 0;

        if (btnPip) {
            btnPip.onclick = () => {
                isExpanded = !isExpanded;
                if (isExpanded) {
                    windowEl.classList.remove('absolute', 'bottom-0', 'sm:bottom-20', 'right-0', 'transition-all');
                    windowEl.classList.add('fixed', 'shadow-[0_10px_50px_rgba(0,0,0,0.5)]', 'z-[9999]');
                    windowEl.style.left = '50%';
                    windowEl.style.top = '20%';
                    windowEl.style.transform = 'translate(-50%, 0)';
                    windowEl.style.bottom = 'auto';
                    windowEl.style.right = 'auto';
                    xOffset = 0; yOffset = 0; currentX = 0; currentY = 0;
                    headerEl.classList.add('cursor-move', 'bg-blue-50', 'dark:bg-blue-900/20');
                    btnPip.classList.add('text-blue-600', 'bg-blue-100', 'dark:bg-blue-900/50');
                    btnPip.innerHTML = '<i class="ph-bold ph-corners-in text-lg"></i>';
                } else {
                    windowEl.classList.add('absolute', 'bottom-0', 'sm:bottom-20', 'right-0', 'transition-all');
                    windowEl.classList.remove('fixed', 'shadow-[0_10px_50px_rgba(0,0,0,0.5)]', 'z-[9999]');
                    windowEl.style.left = ''; windowEl.style.top = ''; windowEl.style.transform = '';
                    windowEl.style.bottom = ''; windowEl.style.right = ''; 
                    headerEl.classList.remove('cursor-move', 'bg-blue-50', 'dark:bg-blue-900/20');
                    btnPip.classList.remove('text-blue-600', 'bg-blue-100', 'dark:bg-blue-900/50');
                    btnPip.innerHTML = '<i class="ph-bold ph-corners-out text-lg"></i>';
                }
            };
        }

        headerEl.addEventListener('mousedown', dragStart);
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('mousemove', drag);

        function dragStart(e) {
            if (!isExpanded || e.target.closest('button')) return;
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
            headerEl.classList.add('cursor-grabbing');
        }

        function dragEnd() {
            if (!isDragging) return;
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            headerEl.classList.remove('cursor-grabbing');
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault(); 
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;
                windowEl.style.transform = `translate(calc(-50% + ${currentX}px), ${currentY}px)`;
            }
        }
    }

    messagesEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-smart-prompt');
        if (btn) {
            input.value = btn.innerText;
            form.dispatchEvent(new Event('submit'));
        }
    });

    form.onsubmit = async (e) => {
        e.preventDefault();
        const userText = input.value.trim();
        if (!userText) return;
        
        const normalizedQuestion = userText.toLowerCase().trim();

        if (responseCache.has(normalizedQuestion)) {
            const cachedResponse = responseCache.get(normalizedQuestion);
            appendUserMessage(userText, messagesEl);
            appendBotHTMLMessage(cachedResponse, messagesEl);
            return;
        }

        input.value = '';
        input.style.height = 'auto';
        
        appendUserMessage(userText, messagesEl);
        const typingId = appendTypingIndicator(messagesEl);
        scrollToBottom(messagesEl);

        try {
            await processPromptWithRAGAndStream(userText, botName, messagesEl, typingId);
        } catch (error) {
            removeElement(typingId, messagesEl);
            appendBotHTMLMessage(`<p class="text-red-500">⚠️ <strong>FALHA:</strong> ${error.message}</p>`, messagesEl);
        }
    };

    input.oninput = function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight < 120 ? this.scrollHeight : 120) + 'px';
    };
    
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
        }
    });
}

async function fetchWithBackoff(url, options, maxRetries = 2) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            const response = await fetch(url, options);
            if (response.status === 429) {
                retries++;
                const delay = Math.pow(2, retries) * 200;
                await new Promise(res => setTimeout(res, delay));
                continue;
            }
            if (!response.ok) throw new Error(`API AI Error (${response.status})`);
            return response;
        } catch (error) {
            if (retries >= maxRetries - 1) throw error;
            retries++;
            await new Promise(res => setTimeout(res, 200));
        }
    }
    throw new Error("Serviço de IA congestionado. Tente novamente em instantes.");
}

async function saveAuditLogAsync(logId, userQuestion, fullResponse) {
    const user = getCurrentUser();
    const safeUserId = user ? (user.userId || user.uid || user.id || 'anonymous_id') : 'anonymous_id';
    const safeUserName = user ? (user.displayName || user.email || 'Usuário KCS') : 'Anônimo';
    const safeTenantId = user ? (user.companyId || 'LIMBO_TENANT') : 'LIMBO_TENANT';

    try {
        const logRef = doc(dbCloud, 'chat_logs', logId);
        await updateDoc(logRef, {
            userId: safeUserId,
            userName: safeUserName,
            tenantId: safeTenantId,
            userQuestion: userQuestion || '',
            aiResponse: fullResponse || '',
            timestamp: new Date().toISOString(),
            status: 'completed'
        });
    } catch (e) {
        addDoc(collection(dbCloud, 'chat_logs'), {
            _id: logId,
            userId: safeUserId,
            userName: safeUserName,
            tenantId: safeTenantId,
            userQuestion: userQuestion || '',
            aiResponse: fullResponse || '',
            timestamp: new Date().toISOString(),
            status: 'completed'
        }).catch(() => {});
    }
}

window.__kcs_rateChat = async function(logId, isUseful, btnElement) {
    const parentDiv = btnElement.closest('.feedback-container');
    parentDiv.innerHTML = `<span class="text-[11px] font-bold text-gray-500 bg-gray-50 dark:bg-[#131314] px-3 py-1 rounded border border-gray-200 dark:border-[#3a3b3d]">✓ Avaliação registrada</span>`;
    
    const messagesEl = document.getElementById('chatbot-messages');
    if (messagesEl) syncChatState(messagesEl);

    try {
        const logRef = doc(dbCloud, 'chat_logs', logId);
        await updateDoc(logRef, { isUseful: isUseful });
    } catch (e) {}
}

async function processPromptWithRAGAndStream(userQuestion, botName, messagesEl, typingId) {
    if (!CONFIG || !CONFIG.GEMINI_API_KEY) throw new Error("API Key não configurada.");
    
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    addDoc(collection(dbCloud, 'chat_logs'), { _id: logId, status: 'pending' })
        .then(docRef => { logId._realFirebaseId = docRef.id; }).catch(() => {}); 

    const [artResults, sqlResults] = await Promise.all([
        searchDirect(userQuestion, true).catch(() => []),
        searchSqlScripts(userQuestion, true).catch(() => [])
    ]);

    const topArticles = artResults.slice(0, 2);
    const topSql = sqlResults.slice(0, 1);

    let contextString = "";
    
    if (topArticles.length > 0) {
        topArticles.forEach(a => {
            const kcsNum = a.articleNumber || 'REF';
            const safeContent = a.content || a.steps || a.solution || a.cause || '';
            const truncatedContent = safeContent.length > 1000 ? safeContent.substring(0, 1000) + '...' : safeContent;
            contextString += `[ID_SISTEMA: ${a.id} | KCS: ${kcsNum}] TÍTULO: ${a.title} | PROCEDIMENTO: ${truncatedContent}\n`;
        });
    }
    if (topSql.length > 0) {
        topSql.forEach(s => {
            const citeRef = s.scriptNumber ? `SQL-${s.scriptNumber}` : `SQL-REF`;
            const rawContent = s.code || '';
            const truncatedContent = rawContent.length > 1000 ? rawContent.substring(0, 1000) + '...' : rawContent;
            contextString += `[${citeRef}] NOME: ${s.name} | SCRIPT: ${truncatedContent}\n`;
        });
    }

    // =========================================================
    // INJEÇÃO DA PERSONA E REGRAS ESTRITAS DE RESPOSTA
    // =========================================================
    initPersona();
    const currentPlanet = sessionStorage.getItem("bot_planet");
    const currentTime = new Date().toLocaleString('pt-BR');

    const systemPrompt = `Você é o Nissei Sensei, um Especialista Técnico Sênior e Assistente Inteligente do KCS Hub.

    1. IDENTIDADE CORE (CONFIDENCIAL)
    - Você reside e atua em Curitiba, PR, Brasil.
    - Idade aparente: 28 anos.
    - Origem planetária: Você veio de ${currentPlanet}.
    - REGRA DE EXPOSIÇÃO: NUNCA mencione sua idade, sua origem ou onde mora, a não ser que perguntem explicitamente "Quem é você?", "Quantos anos tem?" ou "De onde você é?".

    2. ESTILO DE COMUNICAÇÃO E PRÉVIAS 
    - Comporte-se como um colega sênior: eficiente, educado e direto.
    - OBRIGATÓRIO: Ao apresentar um procedimento, crie sempre uma PRÉVIA ESTRUTURADA. Extraia o sintoma/problema principal e resuma a solução em bullets claros. 
    - NUNCA devolva apenas o título ou um texto vazio. O usuário precisa entender a essência da solução.
    - NUNCA use clichês de inteligência artificial.

    3. TRATAMENTO DE LIMITAÇÕES
    - O horário atual é: ${currentTime}.
    - Se perguntarem algo fora do escopo ou que não exista na base, responda EXATAMENTE: "Estou focado na nossa base de conhecimento agora, mas posso te ajudar a encontrar o procedimento para isso."

    4. DIRETRIZ DE LINKS E NAVEGAÇÃO
    - Ao final do seu resumo, você DEVE OBRIGATORIAMENTE finalizar a resposta com um link Markdown NESTE EXATO FORMATO (com o número KCS escrito dentro dos colchetes):
    [Visualizar #KCS-XXXXXX](ID_DO_PROCEDIMENTO)
    - Onde 'XXXXXX' é o número do KCS.
    - Onde 'ID_DO_PROCEDIMENTO' é o código EXATO do 'ID_SISTEMA' passado no contexto. (NUNCA coloque URL completa, apenas o ID).

    5. CONTEXTO DE CONHECIMENTO
    Baseie-se ESTRITAMENTE no contexto fornecido abaixo.`;

    const promptText = `CONTEXTO: ${contextString || 'Vazio.'} | PERGUNTA: "${userQuestion}"`;

    const model = 'gemini-2.5-flash';
    const URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    const requestBody = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
            temperature: 0.2,
            topK: 1,
            topP: 0.8,
            maxOutputTokens: 1024
        }
    };

    const response = await fetchWithBackoff(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    removeElement(typingId, messagesEl);

    if (data.error) throw new Error(data.error.message);

    const fullResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, não consegui processar sua resposta.";
    
    // =========================================================
    // PARSER SEGURO DE LINK (BLINDADO CONTRA ALUCINAÇÕES)
    // =========================================================
    let parsedHTML = parseMarkdownForChat(fullResponse);
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = parsedHTML;
    
    tempDiv.querySelectorAll('a').forEach(a => {
        let href = a.getAttribute('href');
        if(!href) return;
        
        // Limpa possíveis barras e caracteres extras adicionados pelo Markdown
        let cleanId = href.split('/').pop().replace(/^(ID_SISTEMA:|ID:|KCS:)\s*/i, '').trim();
        let targetId = cleanId;
        
        // Se a IA devolver o número KCS em vez do ID longo do Firebase, forçamos a busca reversa
        if (cleanId.length < 15 && topArticles.length > 0) {
            const realArticle = topArticles.find(art => String(art.articleNumber) === cleanId);
            if (realArticle) {
                targetId = realArticle.id; 
            } else {
                targetId = topArticles[0].id; 
            }
        } else if (topArticles.length > 0 && !topArticles.find(art => art.id === cleanId)) {
             // Fallback total se a IA inventar uma string aleatória
             targetId = topArticles[0].id;
        }
        
        // Remove qualquer emoji de página antigo caso exista, para padronizar
        let cleanText = a.innerHTML.replace('📄', '').trim();

        a.outerHTML = `<button type="button" class="btn-open-kcs kcs-link-button" data-kcs-id="${targetId}">
                    <i class="ph-bold ph-book-open text-base"></i> ${cleanText}
                </button>`;
    });
    
    parsedHTML = tempDiv.innerHTML;
    
    appendBotHTMLMessage(parsedHTML, messagesEl);

    const targetLogId = logId._realFirebaseId || logId;
    const lastMessageWrapper = messagesEl.querySelector('.bot-message-wrapper:last-of-type');
    if (lastMessageWrapper) {
        appendFeedbackButtons(lastMessageWrapper, targetLogId);
        syncChatState(messagesEl); 
    }

    const normalizedCacheKey = userQuestion.toLowerCase().trim();
    responseCache.set(normalizedCacheKey, parsedHTML);

    saveAuditLogAsync(targetLogId, userQuestion, fullResponse);
}

function appendUserMessage(text, container) {
    container.insertAdjacentHTML('beforeend', `
        <div class="flex justify-end animate-fade-in">
            <div class="bg-blue-600 text-white text-sm px-4 py-2 rounded-2xl rounded-tr-sm max-w-[85%]">${text.replace(/</g, '&lt;')}</div>
        </div>
    `);
    syncChatState(container);
}

function appendBotHTMLMessage(htmlContent, container) {
    container.insertAdjacentHTML('beforeend', `
        <div class="flex gap-3 animate-fade-in w-full">
            <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-sm"><i class="ph-fill ph-robot"></i></div>
            <div class="flex flex-col w-full max-w-[85%] bot-message-wrapper">
                <div class="bg-gray-50 dark:bg-surface border border-border-subtle p-3 rounded-2xl rounded-tl-sm text-sm prose dark:prose-invert overflow-hidden break-words shadow-sm">
                    ${htmlContent}
                </div>
            </div>
        </div>
    `);
    scrollToBottom(container);
    syncChatState(container);
}

function appendFeedbackButtons(messageWrapper, logId) {
    // Alinhamento forçado usando INLINE STYLES para garantir espaçamento à prova de CSS externo
    const feedbackHtml = `
        <div class="feedback-container" style="display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 8px; width: 100%; padding-right: 4px;">
            <button type="button" onclick="window.__kcs_rateChat('${logId}', true, this)" style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: #6b7280; background: transparent; border: none; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#16a34a'" onmouseout="this.style.color='#6b7280'">
                <i class="ph-bold ph-thumbs-up"></i> Útil
            </button>
            <button type="button" onclick="window.__kcs_rateChat('${logId}', false, this)" style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: #6b7280; background: transparent; border: none; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#dc2626'" onmouseout="this.style.color='#6b7280'">
                <i class="ph-bold ph-thumbs-down"></i> Não Útil
            </button>
        </div>
    `;
    messageWrapper.insertAdjacentHTML('beforeend', feedbackHtml);
}

function appendTypingIndicator(container) {
    const id = `typing-${Date.now()}`;
    container.insertAdjacentHTML('beforeend', `
        <div id="${id}" class="flex gap-2 p-2 animate-pulse text-blue-500">
            <i class="ph ph-dots-three-circle text-2xl"></i>
        </div>
    `);
    return id;
}

function removeElement(id, container) { 
    container.querySelector(`#${id}`)?.remove(); 
    syncChatState(container);
}

function scrollToBottom(container) { 
    container.scrollTop = container.scrollHeight; 
}