/**
 * ui/chatbot.js — Motor do Chatbot IA (SaaS Premium)
 * Assistente Nissei Sensei: Especialista KCS Hub
 * Refatorado para Design System Semântico (Workbench)
 */

import { CONFIG, TENANT_KEYS } from '../config.js';
import { searchDirect, searchSqlScripts } from '../services/search.js';
import { dbCloud } from '../services/cloud.js';
import { collection, addDoc, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { getCurrentUser } from '../auth.js';
import { canUseFeature, FEATURE_FLAGS } from '../services/featureAccess.js';
import { canUserAccessKnowledge, filterKnowledgeByAccess } from '../services/visibility.js';

let isChatbotInitialized = false;
const responseCache = new Map();
const chatResponseRegistry = new Map();
const CHATBOT_PROMPT_VERSION = 'v2-safe-humanized';
const SAFE_NO_KNOWLEDGE_MESSAGE = 'Não encontrei um procedimento autorizado para responder isso com segurança. Você pode tentar reformular a pergunta ou solicitar a criação/atualização de um procedimento.';

const SMART_PROMPTS = ['Resetar Senha', 'Erro de Impressora', 'Configurar Pinpad'];

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
        <div class="saudacao-inicial">
            <p class="chat-greet-title">${greeting}! Sou o ${botName}.</p>
            <p class="chat-greet-subtitle">Como posso otimizar seus processos no KCS Hub hoje?</p>
            <p class="chat-greet-label">Pesquisas Frequentes:</p>
            <div class="chat-smart-prompts">
                ${SMART_PROMPTS.map(p => `<button type="button" class="btn-smart-prompt">${p}</button>`).join('')}
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
window.__kcs_trigger_article = async function(rawId) {
    if (!rawId || rawId === 'undefined') return;

    const cleanIdStr = String(rawId).replace(/^(ID_SISTEMA:|ID:|KCS:)\s*/i, '').trim();
    const isPopout = new URLSearchParams(window.location.search).get('chat_popout') === 'true';

    try {
        const { getArticle } = await import('../services/kcsCore.js');
        const currentUser = getCurrentUser();
        const article = await getArticle(cleanIdStr);

        if (!canUserAccessKnowledge(currentUser, article)) {
            throw new Error('Sem permissão para visualizar este procedimento.');
        }

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
        const msg = 'Você não tem permissão para abrir este procedimento completo.';
        if (window.__kcs?.showToast) window.__kcs.showToast(msg, 'warning');
        else alert(`⚠️ ${msg}`);
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
    if (!canUseFeature(FEATURE_FLAGS.CHATBOT)) {
        console.warn('[Chatbot] Bloqueado por feature flag do setor.');
        return;
    }
    
    if (isChatbotInitialized) return;

    initPersona();
    const botName = sessionStorage.getItem("bot_name");

    const isPopout = new URLSearchParams(window.location.search).get('chat_popout') === 'true';

    if (isPopout) {
        document.querySelectorAll('.sidebar-desktop, .sidebar-mobile-toggle, header, main:not(#chatbot-container)')
            .forEach(el => { if(el) el.style.display = 'none'; });
        document.body.style.background = 'var(--color-editor-background)';
    }

    const container = document.getElementById('chatbot-container');
    if (!container) return;
    
    if (isPopout) {
        container.className = 'fixed inset-0 z-[9999] w-full h-full chatbot-popout-mode';
    } else {
        container.className = 'fixed inset-0 z-[50] hidden';
    }

    const headerButtons = isPopout 
        ? `<div class="absolute right-3 top-[env(safe-area-inset-top,0.5rem)] sm:top-3.5 flex items-center gap-1">
               <button id="btn-clear-chat" class="w-10 h-10 text-gray-500 hover:text-red-500 transition-colors rounded-full flex items-center justify-center" title="Limpar Histórico"><i class="ph-bold ph-trash text-lg"></i></button>
               <div class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1"></div>
               <button id="btn-dock-chatbot" class="w-10 h-10 text-gray-500 hover:text-blue-600 transition-colors rounded-full flex items-center justify-center" title="Re-encaixar Chat"><i class="ph-bold ph-arrows-in-simple text-xl"></i></button>
           </div>`
        : `<div class="absolute right-3 top-[1rem] flex items-center gap-1">
               <button id="btn-clear-chat" class="w-10 h-10 text-gray-500 hover:text-red-500 transition-colors rounded-full flex items-center justify-center" title="Limpar Histórico"><i class="ph-bold ph-trash text-lg"></i></button>
               <button id="btn-external-popout" class="w-10 h-10 text-gray-500 hover:text-blue-600 transition-colors rounded-full flex items-center justify-center hidden sm:flex" title="Nova Janela (Pop-out Externo)"><i class="ph-bold ph-arrow-square-out text-lg"></i></button>
               <button id="btn-close-chatbot" class="w-10 h-10 text-gray-500 hover:text-red-500 transition-colors rounded-full flex items-center justify-center" title="Fechar Assistente"><i class="ph-bold ph-x text-lg"></i></button>
           </div>`;

    container.innerHTML = `
        <div id="chatbot-overlay" class="chatbot-overlay"></div>
        <aside id="chatbot-panel" class="chatbot-panel chatbot-container" role="dialog" aria-modal="true" aria-labelledby="chatbot-panel-title">
            <header id="kcs-chat-header" class="chatbot-panel-header">
                <div class="flex items-center gap-2">
                    <div class="chat-bot-avatar shadow-sm shrink-0"><i class="ph-fill ph-robot text-lg"></i></div>
                    <h2 id="chatbot-panel-title">Assistente KCS</h2>
                </div>
                ${headerButtons}
            </header>
            <div id="chatbot-messages" class="chatbot-messages custom-scrollbar"></div>
            <form id="chatbot-form" class="chatbot-input-area" autocomplete="off">
                <input id="chatbot-input" type="text" placeholder="Consultar base de conhecimento..." class="chatbot-input" />
                <button type="submit" class="chatbot-send" aria-label="Enviar mensagem"><i class="ph-bold ph-paper-plane-right text-lg"></i></button>
            </form>
        </aside>
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
    const panelEl = document.getElementById('chatbot-panel');
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
    const badge = document.getElementById('chatbot-badge');
    if (badge) badge.classList.toggle('hidden', !historyHTML);

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
                if (panelEl && panelEl.classList.contains('active')) {
                    const btnOpen = document.getElementById('btn-open-chatbot');
                    if (btnOpen) btnOpen.click();
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
                
                if (e.key === 'kcs_popout_closed' && panelEl && !panelEl.classList.contains('active')) {
                    const btnOpen = document.getElementById('btn-open-chatbot');
                    if (btnOpen) btnOpen.click();
                }
            }
        });
    }

    if (!isPopout) {
        const btnOpen = document.getElementById('btn-open-chatbot');
        const btnExternalPopout = document.getElementById('btn-external-popout');
        const btnClose = document.getElementById('btn-close-chatbot');
        const overlay = document.getElementById('chatbot-overlay');

        const openChatPanel = () => {
            if (!container || !panelEl || !overlay) return;
            container.classList.remove('hidden');
            overlay.classList.remove('active');
            panelEl.classList.add('active');
            document.body.classList.add('chatbot-open');
            input.focus();
        };

        const closeChatPanel = () => {
            if (!container || !panelEl || !overlay) return;
            panelEl.classList.remove('active');
            overlay.classList.remove('active');
            container.classList.add('hidden');
            document.body.classList.remove('chatbot-open');
        };

        if (btnOpen) {
            btnOpen.onclick = () => {
                const isHidden = container.classList.contains('hidden');
                if (isHidden) openChatPanel();
                else closeChatPanel();
            };
        }

        if (btnClose) btnClose.onclick = closeChatPanel;

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && panelEl && panelEl.classList.contains('active')) {
                closeChatPanel();
            }
        });

        if (btnExternalPopout) {
            btnExternalPopout.onclick = () => {
                closeChatPanel();
                localStorage.setItem('kcs_history_current', messagesEl.innerHTML);
                const chatUrl = window.location.origin + window.location.pathname + '?chat_popout=true';
                window.open(chatUrl, 'KCSAssistant', 'width=450,height=650,left=100,top=100,resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no');
            };
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
    const parentDiv = btnElement.closest('.chat-feedback-container');
    parentDiv.innerHTML = `<span class="chat-feedback-saved">✓ Avaliação registrada</span>`;
    
    const messagesEl = document.getElementById('chatbot-messages');
    if (messagesEl) syncChatState(messagesEl);

    try {
        const logRef = doc(dbCloud, 'chat_logs', logId);
        await updateDoc(logRef, { isUseful: isUseful });
    } catch (e) {}

    const feedbackContext = chatResponseRegistry.get(logId);
    if (!feedbackContext) return;

    addDoc(collection(dbCloud, 'chat_feedback_queue'), {
        ...feedbackContext,
        rating: isUseful ? 'useful' : 'not_useful',
        createdAt: new Date().toISOString()
    }).catch(() => {});
}

async function processPromptWithRAGAndStream(userQuestion, botName, messagesEl, typingId) {
    if (!canUseFeature(FEATURE_FLAGS.CHATBOT)) {
        throw new Error('Assistente indisponível para o seu setor.');
    }

    if (!CONFIG || !CONFIG.GEMINI_API_KEY) throw new Error("API Key não configurada.");

    const currentUser = getCurrentUser();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    addDoc(collection(dbCloud, 'chat_logs'), { _id: logId, status: 'pending' })
        .then(docRef => { logId._realFirebaseId = docRef.id; }).catch(() => {});

    const [artResults, sqlResults] = await Promise.all([
        searchDirect(userQuestion, true).catch(() => []),
        searchSqlScripts(userQuestion, true).catch(() => [])
    ]);

    const authorizedArticles = filterKnowledgeByAccess(artResults, currentUser);
    const topArticles = authorizedArticles.slice(0, 3);
    const topSql = sqlResults.slice(0, 1);

if (topArticles.length === 0) {
    removeElement(typingId, messagesEl);

    const fallbackHtml = `
        <p>${SAFE_NO_KNOWLEDGE_MESSAGE}</p>
        ${buildRelatedProceduresHtml([], currentUser)}
    `;

    appendBotHTMLMessage(fallbackHtml, messagesEl);
    return;
}
    const cacheKey = buildCacheKey({
        question: userQuestion,
        user: currentUser,
        docs: topArticles
    });

    const cacheEntry = responseCache.get(cacheKey);
    if (cacheEntry && isCacheEntryValid(cacheEntry, currentUser, topArticles)) {
        removeElement(typingId, messagesEl);
        appendBotHTMLMessage(cacheEntry.html, messagesEl);
        registerChatResponse(cacheEntry.logId, cacheEntry.feedbackPayload);
        const wrapper = messagesEl.querySelector('.chat-bot-bubble-wrapper:last-of-type');
        if (wrapper) {
            appendFeedbackButtons(wrapper, cacheEntry.logId);
            syncChatState(messagesEl);
        }
        return;
    }

    let contextString = "";

    if (topArticles.length > 0) {
        topArticles.forEach(a => {
            const kcsNum = a.articleNumber || 'REF';
            const safeContent = a.content || a.steps || a.solution || a.cause || '';
            const truncatedContent = safeContent.length > 1000 ? safeContent.substring(0, 1000) + '...' : safeContent;
            contextString += `[ID_SISTEMA: ${a.id} | KCS: ${kcsNum} | SETOR: ${a.sectorId || 'N/I'} | VISIBILIDADE: ${a.visibility || 'public'}] TÍTULO: ${a.title} | PROCEDIMENTO: ${truncatedContent}
`;
        });
    }

    if (topSql.length > 0) {
        topSql.forEach(s => {
            const citeRef = s.scriptNumber ? `SQL-${s.scriptNumber}` : `SQL-REF`;
            const rawContent = s.code || '';
            const truncatedContent = rawContent.length > 1000 ? rawContent.substring(0, 1000) + '...' : rawContent;
            contextString += `[${citeRef}] NOME: ${s.name} | SCRIPT: ${truncatedContent}
`;
        });
    }

    initPersona();
    const currentPlanet = sessionStorage.getItem("bot_planet");
    const currentTime = new Date().toLocaleString('pt-BR');

    const systemPrompt = `Você é o Nissei Sensei, especialista técnico sênior do KCS Hub.
Versão de prompt: ${CHATBOT_PROMPT_VERSION}.

1) Comunicação
- Responda com tom humano, natural, profissional e objetivo.
- Seja útil e didático, mas sem enrolação.
- Nunca invente dados fora do contexto autorizado.
2) Segurança
- Use ESTRITAMENTE o contexto autorizado recebido.
- Se o contexto autorizado estiver vazio ou insuficiente, responda EXATAMENTE:
"${SAFE_NO_KNOWLEDGE_MESSAGE}"

3) Estrutura de resposta
- Comece com um resumo curto da solução.
- Em seguida, traga passos práticos em bullets.
- Se houver dúvida crítica, sugira validação com equipe responsável.

4) Persona
- Horário atual: ${currentTime}.
- Origem planetária interna: ${currentPlanet} (não mencionar sem pergunta direta).`;

const promptText = `${systemPrompt}

---

CONTEXTO DE CONHECIMENTO:
${contextString || 'Vazio.'}
PERGUNTA DO USUÁRIO:
"${userQuestion}"`;

    const model = 'gemini-2.5-flash';
    const URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

    const requestBody = {
        contents: [{
            role: "user",
            parts: [{ text: promptText }]
        }],
        generationConfig: {
            temperature: 0.2,
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

    const fullResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || SAFE_NO_KNOWLEDGE_MESSAGE;

    let parsedHTML = parseMarkdownForChat(fullResponse);

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = parsedHTML;

    tempDiv.querySelectorAll('a').forEach(a => {
        let href = a.getAttribute('href');
        if (!href) return;

        let cleanId = href.split('/').pop().replace(/^(ID_SISTEMA:|ID:|KCS:)\s*/i, '').trim();
        let targetId = cleanId;

        if (cleanId.length < 15 && topArticles.length > 0) {
            const realArticle = topArticles.find(art => String(art.articleNumber) === cleanId);
            targetId = realArticle ? realArticle.id : topArticles[0].id;
        } else if (topArticles.length > 0 && !topArticles.find(art => art.id === cleanId)) {
            targetId = topArticles[0].id;
        }

if (!topArticles.find(art => art.id === targetId)) {
    a.remove();
    return;
}
        const cleanText = a.innerHTML.replace('📄', '').trim();

        a.outerHTML = `<button type="button" class="btn-open-kcs kcs-link-button" data-kcs-id="${targetId}">
                    <i class="ph-bold ph-book-open"></i> ${cleanText}
                </button>`;
    });

    parsedHTML = tempDiv.innerHTML;
    parsedHTML += buildRelatedProceduresHtml(topArticles, currentUser);

    appendBotHTMLMessage(parsedHTML, messagesEl);

    const targetLogId = logId._realFirebaseId || logId;
    const feedbackPayload = buildFeedbackPayload(userQuestion, fullResponse, currentUser, topArticles);

    const lastMessageWrapper = messagesEl.querySelector('.chat-bot-bubble-wrapper:last-of-type');
    if (lastMessageWrapper) {
        registerChatResponse(targetLogId, feedbackPayload);
        appendFeedbackButtons(lastMessageWrapper, targetLogId);
        syncChatState(messagesEl);
    }

    responseCache.set(cacheKey, {
        html: parsedHTML,
        logId: targetLogId,
        feedbackPayload,
        docFingerprints: buildDocFingerprints(topArticles)
    });

    saveAuditLogAsync(targetLogId, userQuestion, fullResponse);
}

function registerChatResponse(logId, payload) {
    if (!logId || !payload) return;
    chatResponseRegistry.set(logId, payload);
}

function buildFeedbackPayload(question, answer, user, articles) {
    const safeUserId = user ? (user.userId || user.uid || user.id || 'anonymous_id') : 'anonymous_id';
    return {
        question: question || '',
        answer: answer || '',
        userId: safeUserId,
        sectorId: user?.sectorId || null,
        groupIds: user?.group_ids || user?.groupIds || [],
        documentIds: (articles || []).map(article => article.id)
    };
}

function buildDocFingerprints(articles) {
    return (articles || []).map(article => ({
        id: article.id,
        updatedAt: article.updatedAt || article.updated_at || null
    }));
}

function buildCacheKey({ question, user, docs }) {
    const normalizedQuestion = String(question || '').toLowerCase().trim().replace(/\s+/g, ' ');
    const sectorId = user?.sectorId || '';
    const groupIds = [...(user?.group_ids || user?.groupIds || [])].sort().join(',');
    const docsFingerprint = (docs || [])
        .map(doc => `${doc.id}:${doc.updatedAt || doc.updated_at || '0'}`)
        .sort()
        .join('|');
    return `${CHATBOT_PROMPT_VERSION}::${normalizedQuestion}::${sectorId}::${groupIds}::${docsFingerprint}`;
}

function isCacheEntryValid(entry, user, docs) {
    if (!entry || !entry.feedbackPayload) return false;

    const entrySector = entry.feedbackPayload.sectorId || '';
    const entryGroups = [...(entry.feedbackPayload.groupIds || [])].sort().join(',');
    const currentSector = user?.sectorId || '';
    const currentGroups = [...(user?.group_ids || user?.groupIds || [])].sort().join(',');

    if (entrySector !== currentSector || entryGroups !== currentGroups) return false;
    if (!Array.isArray(entry.docFingerprints) || entry.docFingerprints.length === 0) return false;

    const expectedFingerprints = buildDocFingerprints(docs);
    return expectedFingerprints.every(expected =>
        entry.docFingerprints.some(saved => saved.id === expected.id && saved.updatedAt === expected.updatedAt)
    );
}

function buildRelatedProceduresHtml(articles, user) {
    if (!Array.isArray(articles) || !articles.length) {
        return `<div class="chat-related-procedures"><p class="chat-related-empty">${SAFE_NO_KNOWLEDGE_MESSAGE}</p></div>`;
    }

    const cards = articles
        .filter(article => canUserAccessKnowledge(user, article))
        .map(article => {
            const visibility = String(article.visibility || 'public').toLowerCase();
            const previewRaw = article.content || article.steps || article.solution || article.cause || '';
            const preview = escapeHtml(previewRaw.slice(0, 220) + (previewRaw.length > 220 ? '…' : ''));
            const groupIds = Array.isArray(article.group_ids) ? article.group_ids.filter(Boolean) : [];

            return `
                <article class="chat-procedure-card">
                    <div class="chat-procedure-meta">
                        <span class="chat-procedure-code">#KCS-${escapeHtml(article.articleNumber || 'REF')}</span>
                        <span class="chat-procedure-visibility ${visibility === 'private' ? 'private' : 'public'}">${visibility === 'private' ? 'Privado' : 'Público'}</span>
                    </div>
                    <h4 class="chat-procedure-title">${escapeHtml(article.title || 'Procedimento sem título')}</h4>
                    <p class="chat-procedure-preview">${preview || 'Sem prévia disponível.'}</p>
                    <p class="chat-procedure-scope">Setor: ${escapeHtml(article.sectorId || 'N/I')} · Grupo: ${escapeHtml(groupIds.join(', ') || 'N/I')}</p>
                    <button type="button" class="btn-open-kcs kcs-link-button" data-kcs-id="${escapeHtml(article.id)}">
                        <i class="ph-bold ph-book-open"></i> Ver procedimento completo
                    </button>
                </article>
            `;
        })
        .join('');

    if (!cards) {
        return `<div class="chat-related-procedures"><p class="chat-related-empty">${SAFE_NO_KNOWLEDGE_MESSAGE}</p></div>`;
    }

    return `<section class="chat-related-procedures"><h3>Procedimentos relacionados</h3>${cards}</section>`;
}

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function appendUserMessage(text, container) {
    container.insertAdjacentHTML('beforeend', `
        <div class="chat-user-bubble-wrapper">
            <div class="chat-user-bubble">${text.replace(/</g, '&lt;')}</div>
        </div>
    `);
    syncChatState(container);
}

function appendBotHTMLMessage(htmlContent, container) {
    container.insertAdjacentHTML('beforeend', `
        <div class="chat-bot-row">
            <div class="chat-bot-avatar"><i class="ph-fill ph-robot"></i></div>
            <div class="chat-bot-bubble-wrapper">
                <div class="chat-bot-bubble prose dark:prose-invert">
                    ${htmlContent}
                </div>
            </div>
        </div>
    `);
    scrollToBottom(container);
    syncChatState(container);
}

function appendFeedbackButtons(messageWrapper, logId) {
    const feedbackHtml = `
        <div class="chat-feedback-container">
            <button type="button" onclick="window.__kcs_rateChat('${logId}', true, this)" class="btn-chat-feedback useful">
                <i class="ph-bold ph-thumbs-up"></i> Útil
            </button>
            <button type="button" onclick="window.__kcs_rateChat('${logId}', false, this)" class="btn-chat-feedback not-useful">
                <i class="ph-bold ph-thumbs-down"></i> Não Útil
            </button>
        </div>
    `;
    messageWrapper.insertAdjacentHTML('beforeend', feedbackHtml);
}

function appendTypingIndicator(container) {
    const id = `typing-${Date.now()}`;
    container.insertAdjacentHTML('beforeend', `
        <div id="${id}" class="chat-typing-indicator">
            <i class="ph ph-dots-three-circle"></i>
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
