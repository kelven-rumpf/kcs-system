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

let isChatbotInitialized = false;
const responseCache = new Map();

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
        document.body.style.background = 'var(--color-editor-background)';
    }

    const container = document.getElementById('chatbot-container');
    if (!container) return;
    
    if (isPopout) {
        container.className = 'fixed inset-0 z-[9999] w-full h-full';
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
    const parentDiv = btnElement.closest('.chat-feedback-container');
    parentDiv.innerHTML = `<span class="chat-feedback-saved">✓ Avaliação registrada</span>`;
    
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

    const promptText = `${systemPrompt}\n\n---\n\nCONTEXTO DE CONHECIMENTO:\n${contextString || 'Vazio.'}\n\nPERGUNTA DO USUÁRIO:\n"${userQuestion}"`;

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

    const fullResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, não consegui processar sua resposta.";
    
    let parsedHTML = parseMarkdownForChat(fullResponse);
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = parsedHTML;
    
    tempDiv.querySelectorAll('a').forEach(a => {
        let href = a.getAttribute('href');
        if(!href) return;
        
        let cleanId = href.split('/').pop().replace(/^(ID_SISTEMA:|ID:|KCS:)\s*/i, '').trim();
        let targetId = cleanId;
        
        if (cleanId.length < 15 && topArticles.length > 0) {
            const realArticle = topArticles.find(art => String(art.articleNumber) === cleanId);
            if (realArticle) {
                targetId = realArticle.id; 
            } else {
                targetId = topArticles[0].id; 
            }
        } else if (topArticles.length > 0 && !topArticles.find(art => art.id === cleanId)) {
             targetId = topArticles[0].id;
        }
        
        let cleanText = a.innerHTML.replace('📄', '').trim();

        a.outerHTML = `<button type="button" class="btn-open-kcs kcs-link-button" data-kcs-id="${targetId}">
                    <i class="ph-bold ph-book-open"></i> ${cleanText}
                </button>`;
    });
    
    parsedHTML = tempDiv.innerHTML;
    
    appendBotHTMLMessage(parsedHTML, messagesEl);

    const targetLogId = logId._realFirebaseId || logId;
    const lastMessageWrapper = messagesEl.querySelector('.chat-bot-bubble-wrapper:last-of-type');
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