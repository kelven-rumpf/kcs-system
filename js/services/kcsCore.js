/**
 * kcsCore.js — Core de Inteligência Artificial e Gestão KCS
 */

import { dbCloud } from './cloud.js';
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, query, where, updateDoc, addDoc, getCountFromServer, orderBy, limit, onSnapshot, increment, runTransaction } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { getCurrentUser } from '../auth.js';
import { CONFIG, COLLECTION_ARTICLES } from '../config.js';

// ID de Sessão Único (Protege contra o mesmo usuário abrindo 2 abas)
export const SESSION_ID = Math.random().toString(36).substring(2, 15);

async function fetchWithBackoff(url, options, maxRetries = 4) {
    let retries = 0;
    while (retries < maxRetries) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        options.signal = controller.signal;

        try {
            const response = await fetch(url, options);
            clearTimeout(timeoutId);

            if (response.status === 429) {
                retries++;
                const delay = Math.pow(2, retries - 1) * 500 + Math.random() * 200;
                console.warn(`[API Gemini] Erro 429. Tentativa ${retries}/${maxRetries}...`);
                await new Promise(res => setTimeout(res, delay));
                continue;
            }
            
            if (!response.ok) throw new Error(`Erro da API (${response.status})`);
            return response;

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError' && retries < maxRetries) {
                retries++;
                await new Promise(res => setTimeout(res, 1000));
                continue;
            }
            throw error;
        }
    }
    throw new Error("Limite de requisições excedido. Tente novamente em instantes.");
}

async function callGeminiIA(systemPrompt, userOriginalText, actionType, isJson = false) {
    if (!CONFIG || !CONFIG.GEMINI_API_KEY) throw new Error("Chave da API não configurada.");
    
    const user = getCurrentUser();
    const model = 'gemini-2.5-flash'; 
    const URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    const generationConfig = { temperature: 0.1 };
    if (isJson) generationConfig.responseMimeType = "application/json";
    
    const payload = { contents: [{ parts: [{ text: systemPrompt }] }], generationConfig };
    
    const response = await fetchWithBackoff(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;
    
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '').trim();
    }

    try {
        const envPrefix = COLLECTION_ARTICLES.split('_')[0];
        await addDoc(collection(dbCloud, `${envPrefix}_chat_logs`), {
            userId: user?.uid || user?.id || 'system',
            userName: user?.displayName || 'Usuário Editor',
            action: actionType,
            input: userOriginalText,
            output: cleanedText,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.warn("Falha ao gravar log de auditoria IA:", e);
    }

    return isJson ? JSON.parse(cleanedText) : cleanedText;
}

export async function reescreverTextoTecnico(promptText) {
    const systemPrompt = `Atue como um especialista em documentação técnica seguindo práticas KCS.
    
Analise o rascunho fornecido. Estruture o procedimento e extraia informações para preencher os campos automaticamente.

OBJETIVOS DE EXTRAÇÃO:
1. Criar um 'titulo' claro e pesquisável (se estiver vazio).
2. Identificar o 'sintoma' (o que o cliente relatou).
3. Identificar o 'ambiente' (sistema, versão).
4. Identificar a 'causa' (raiz técnica).
5. Identificar a 'solucao' (resumo de como resolver).
6. Estruturar os 'passos' (o guia prático detalhado).

REGRAS PARA A CHAVE 'passos':
- Escreva de forma limpa, direta, com verbos no infinitivo (ex: Acessar, Clicar).
- Se houver tags como [IMAGEM_0], [IMAGEM_1] no texto, MANTENHA-AS no meio do texto, exatamente na posição lógica onde a imagem ilustra o passo correspondente. NUNCA as remova.
- Use quebras de linha normais para separar as ações. Não crie listas numeradas automaticamente.

RETORNO OBRIGATÓRIO (JSON STRICT):
{
    "titulo": "...",
    "sintoma": "...",
    "ambiente": "...",
    "causa": "...",
    "solucao": "...",
    "passos": "..."
}

RASCUNHO DO USUÁRIO:
${promptText}`;
    
    return await callGeminiIA(systemPrompt, promptText, 'reescrever_completo', true); 
}

export async function corrigirGramaticaApenas(promptText) {
    const systemPrompt = `Atue como um revisor gramatical. Corrija exclusivamente erros de ortografia e acentuação.
NÃO remova marcadores como [IMAGEM_0]. Retorne APENAS o texto corrigido.
TEXTO ORIGINAL:
    ${promptText}`;
    return await callGeminiIA(systemPrompt, promptText, 'corrigir', false);
}

export async function listArticles() { 
    const user = getCurrentUser();
    if (!user || !user.companyId) return [];
    const q = query(collection(dbCloud, COLLECTION_ARTICLES), where("companyId", "==", user.companyId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data());
}

export async function getArticle(id) { 
    const docRef = doc(dbCloud, COLLECTION_ARTICLES, id);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
}

export async function createArticle(data) {
    try {
        const user = getCurrentUser();
        if (!user) throw new Error("Sessão expirada.");
        const userId = user.uid || user.id || 'unknown_user_id'; 
        const authorName = user.displayName || user.name || user.email || 'Usuário KCS';
        const newId = `kcs_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const newArticle = {
            id: newId,
            articleNumber: Math.floor(Math.random() * 900000) + 100000, 
            title: data.title || '',
            symptom: data.symptom || '',
            environment: data.environment || '',
            cause: data.cause || '',
            solution: data.solution || '',
            steps: data.steps || '', 
            categoryId: data.categoryId || '',
            visibility: data.visibility || 'public',
            tags: Array.isArray(data.tags) ? data.tags : [],
            createdBy: authorName,
            authorId: userId,
            reviewerId: null,
            status: data.statusRequest === 'approved' ? 'approved' : 'pendente_revisao', 
            companyId: user.companyId || 'LIMBO_TENANT',
            sectorId: user.sectorId || 'TI',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            likes: [], favorites: [], comments: [], history: [],
            currentEditorId: null,
            currentEditorName: null,
            currentEditorSession: null,
            lastEditHeartbeat: null
        };
        await setDoc(doc(dbCloud, COLLECTION_ARTICLES, newId), newArticle);
        return newArticle;
    } catch (error) {
        console.error("Erro ao salvar procedimento:", error);
        throw error;
    }
}

export async function updateArticle(id, data) {
    try {
        const user = getCurrentUser();
        if (!user) throw new Error("Usuário não autenticado.");
        const userId = user.uid || user.id || 'unknown_user_id';
        const authorName = user.displayName || user.name || user.email || 'Usuário KCS';
        const existing = await getArticle(id);
        if (!existing) throw new Error("Artigo não encontrado.");

        const snapshot = { ...existing };
        delete snapshot.history; 
        const newHistory = existing.history || [];
        newHistory.push(snapshot);

        let statusFinal = data.statusRequest === 'approved' ? 'approved' : (data.status || existing.status);
        let reviewerFinal = existing.reviewerId || null;
        if (statusFinal === 'approved' && existing.status !== 'approved') reviewerFinal = userId;

        const updatedArticle = {
            ...existing,
            ...data,
            steps: data.steps !== undefined ? data.steps : existing.steps,
            updatedBy: authorName,
            updaterId: userId,
            updatedAt: new Date().toISOString(),
            history: newHistory,
            status: statusFinal,
            reviewerId: reviewerFinal,
            // GARANTIR QUE A TRAVA SEJA LIBERADA AO SALVAR
            currentEditorId: null,
            currentEditorName: null,
            currentEditorSession: null,
            lastEditHeartbeat: null
        };
        
        await updateDoc(doc(dbCloud, COLLECTION_ARTICLES, id), updatedArticle);
        return updatedArticle;
    } catch (error) {
        console.error("Erro ao salvar procedimento:", error);
        throw error;
    }
}

export async function removeArticle(id) { 
    await deleteDoc(doc(dbCloud, COLLECTION_ARTICLES, id));
}

// ==========================================
// INTERAÇÕES SOCIAIS (BLINDADAS)
// ==========================================
export async function flagArticle(id, reason) {
    const user = getCurrentUser();
    const userId = user?.uid || user?.id || 'unknown_user_id';
    const existing = await getArticle(id);
    if (!existing) return;
    const comments = Array.isArray(existing.comments) ? existing.comments.filter(val => val != null) : [];
    comments.push({ id: `cmt_${Date.now()}`, userId: userId, userName: user.displayName || user.email || 'Usuário', text: `⚠️ [SINALIZADO]: ${reason}`, date: new Date().toISOString() });
    await updateDoc(doc(dbCloud, COLLECTION_ARTICLES, id), { status: 'pendente_revisao', comments: comments });
}

export async function toggleLike(id) {
    const user = getCurrentUser();
    const userId = user?.uid || user?.id;
    if (!userId) throw new Error("Falha de autenticação ao curtir.");
    
    const docRef = doc(dbCloud, COLLECTION_ARTICLES, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("Artigo não encontrado.");

    const data = snap.data();
    let likes = Array.isArray(data.likes) ? [...data.likes] : [];
    
    const idx = likes.indexOf(userId);
    if (idx > -1) likes.splice(idx, 1);
    else likes.push(userId);
    
    await updateDoc(docRef, { likes });
}

export async function toggleFavorite(id) {
    const user = getCurrentUser();
    const userId = user?.uid || user?.id;
    if (!userId) throw new Error("Falha de autenticação ao favoritar.");
    
    const docRef = doc(dbCloud, COLLECTION_ARTICLES, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("Artigo não encontrado no servidor.");

    const data = snap.data();
    let favorites = Array.isArray(data.favorites) ? [...data.favorites] : [];
    
    const idx = favorites.indexOf(userId);
    if (idx > -1) {
        favorites.splice(idx, 1);
    } else {
        favorites.push(userId);
    }
    
    await updateDoc(docRef, { favorites });
}

export async function addComment(id, text) {
    const user = getCurrentUser();
    const userId = user?.uid || user?.id || 'unknown';
    const docRef = doc(dbCloud, COLLECTION_ARTICLES, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    
    const data = snap.data();
    let comments = Array.isArray(data.comments) ? [...data.comments] : [];
    comments.push({ id: `cmt_${Date.now()}`, userId: userId, userName: user.displayName || 'Usuário', text: text, date: new Date().toISOString() });
    
    await updateDoc(docRef, { comments });
}

// ==========================================
// MÉTRICAS DO DASHBOARD KCS
// ==========================================
export async function getDashboardMetrics() {
    try {
        const readsColl = collection(dbCloud, 'article_reads');
        const readsSnap = await getCountFromServer(readsColl);
        const totalAcessos = readsSnap.data().count;

        const topQ = query(collection(dbCloud, COLLECTION_ARTICLES), orderBy('views', 'desc'), limit(5));
        const topSnap = await getDocs(topQ);
        const topArticles = topSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const alertQ = query(collection(dbCloud, COLLECTION_ARTICLES), where('negativeFeedbacks', '>=', 3));
        const alertSnap = await getDocs(alertQ);
        const alertArticles = alertSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        return { totalAcessos, topArticles, alertArticles };
    } catch (error) {
        console.error("Erro interno no getDashboardMetrics:", error);
        throw error;
    }
}

// ==========================================
// PREVENÇÃO DE CONCORRÊNCIA: TRANSAÇÕES ATÔMICAS
// ==========================================

export async function setArticleLock(articleId) {
    if (!articleId || articleId === 'drafts') return { status: 'SUCCESS' };

    const user = getCurrentUser();
    if (!user) return { status: 'ERROR' };

    const docRef = doc(dbCloud, COLLECTION_ARTICLES, articleId);
    
    try {
        const result = await runTransaction(dbCloud, async (transaction) => {
            const snap = await transaction.get(docRef);
            if (!snap.exists()) throw new Error("Documento não encontrado");

            const data = snap.data();
            const now = Date.now(); // Data bruta inteira para não quebrar matemática
            const lockTimeout = 5 * 60 * 1000;

            const lastHeartbeatMs = data.lastEditHeartbeat || 0;
            const currentUserId = user.uid || user.id;

            const isLockedByOtherUser = data.currentEditorId && data.currentEditorId !== currentUserId;
            const isLockedByOtherSession = data.currentEditorId === currentUserId && data.currentEditorSession !== SESSION_ID;

            // Se for OUTRO usuário, ou MESMO usuário em ABA DIFERENTE
            if ((isLockedByOtherUser || isLockedByOtherSession) && (now - lastHeartbeatMs) < lockTimeout) {
                // A TRANSAÇÃO É INTERROMPIDA AQUI. Retorna como 'LOCKED'.
                return { 
                    status: 'LOCKED',
                    lockedBy: data.currentEditorName || 'Outro Editor'
                }; 
            }

            // GRAVA O LOCK: Ambiente seguro, sem concorrentes.
            transaction.update(docRef, {
                currentEditorId: currentUserId,
                currentEditorName: user.displayName || user.email || 'Usuário KCS',
                currentEditorSession: SESSION_ID,
                lastEditHeartbeat: now
            });

            return { status: 'SUCCESS' }; 
        });

        return result;
    } catch (e) {
        console.error("[Lock System] Transação falhou:", e);
        return { status: 'ERROR' };
    }
}

export async function releaseArticleLock(articleId) {
    if (!articleId || articleId === 'drafts') return;

    const docRef = doc(dbCloud, COLLECTION_ARTICLES, articleId);
    try {
        await runTransaction(dbCloud, async (transaction) => {
            const snap = await transaction.get(docRef);
            if (!snap.exists()) return;
            const data = snap.data();
            
            // Apenas o dono da sessão ativa pode liberar o lock via onUnload
            if (data.currentEditorSession === SESSION_ID) {
                transaction.update(docRef, {
                    currentEditorId: null,
                    currentEditorName: null,
                    currentEditorSession: null,
                    lastEditHeartbeat: null
                });
            }
        });
    } catch (e) {
        console.warn("[Lock System] Erro ao liberar trava:", e);
    }
}

export async function forceReleaseLock(articleId) {
    const user = getCurrentUser();
    if (!user || user.role !== 'super_admin') throw new Error("Acesso Negado. Apenas super administradores podem ejetar editores.");
    
    const docRef = doc(dbCloud, COLLECTION_ARTICLES, articleId);
    await updateDoc(docRef, {
        currentEditorId: null,
        currentEditorName: null,
        currentEditorSession: null,
        lastEditHeartbeat: null
    });
}

// ==========================================
// NOTIFICAÇÕES E AUDITORIA DE LEITURA
// ==========================================

const articleStatusCache = new Map();
let notificationsUnsubscribe = null;
let isInitialSnapshot = true; 

export function initArticleNotifications(callback) {
    const user = getCurrentUser();
    if (!user || !user.companyId) return;

    if (notificationsUnsubscribe) {
        notificationsUnsubscribe();
        articleStatusCache.clear(); 
    }
    isInitialSnapshot = true; 

    const q = query(
        collection(dbCloud, COLLECTION_ARTICLES),
        where("companyId", "==", user.companyId)
    );

    notificationsUnsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const docId = change.doc.id;
            const data = change.doc.data();
            const currentStatus = data.status; 
            const articleTitle = data.title || 'Procedimento atualizado';

            if (isInitialSnapshot) {
                articleStatusCache.set(docId, currentStatus);
                articleStatusCache.set(docId + '_session', data.currentEditorSession); 
                return; 
            }

            const isMyOwnAction = (data.updaterId === (user.uid || user.id)) || (data.authorId === (user.uid || user.id));

            // BYPASS REAL-TIME PARA ALERTA DE ROUBO DE TRAVA
            const previousSession = articleStatusCache.get(docId + '_session');
            const currentSession = data.currentEditorSession;

            if (change.type === "modified" && previousSession !== currentSession) {
                articleStatusCache.set(docId + '_session', currentSession);

                if (currentSession && currentSession !== SESSION_ID) {
                    document.dispatchEvent(new CustomEvent('kcs-article-lock-active', {
                        detail: {
                            articleId: docId,
                            lockedByName: data.currentEditorName || 'Outro Analista'
                        }
                    }));
                }
            }

            // NOTIFICAÇÕES DE CICLO DE VIDA (SINO)
            if (change.type === "added") {
                articleStatusCache.set(docId, currentStatus);
                articleStatusCache.set(docId + '_session', data.currentEditorSession);
                
                if (!isMyOwnAction && (currentStatus === 'approved' || currentStatus === 'publicado')) {
                    callback(`Novo Procedimento: #${data.articleNumber || ''}`, `"${articleTitle}" acabou de ser publicado!`, docId);
                }
            } 
            else if (change.type === "modified") {
                const previousStatus = articleStatusCache.get(docId) || 'desconhecido';

                if (previousStatus !== currentStatus) {
                    articleStatusCache.set(docId, currentStatus); 
                    
                    if (isMyOwnAction) return; 

                    if (currentStatus === 'pendente_revisao' || currentStatus === 'em_revisao') {
                        const allowedRoles = ['super_admin', 'admin', 'analyst'];
                        if (allowedRoles.includes(user.role)) {
                            callback(`Revisão Pendente: #${data.articleNumber || ''}`, `"${articleTitle}" aguarda sua aprovação.`, docId);
                        }
                    } 
                    else if (currentStatus === 'approved' || currentStatus === 'publicado') {
                        callback(`Procedimento Aprovado: #${data.articleNumber || ''}`, `"${articleTitle}" acabou de ser publicado!`, docId);
                    }
                }
            } 
            else if (change.type === "removed") {
                articleStatusCache.delete(docId);
                articleStatusCache.delete(docId + '_session');
            }
        });

        if (isInitialSnapshot) isInitialSnapshot = false;
    });
}

export async function logArticleRead(articleId, articleTitle) {
    const user = getCurrentUser();
    const userId = user?.uid || user?.id || 'anonymous';
    
    try {
        const articleRef = doc(dbCloud, COLLECTION_ARTICLES, articleId);
        await updateDoc(articleRef, {
            views: increment(1)
        });

        await addDoc(collection(dbCloud, 'article_reads'), {
            articleId: articleId,
            articleTitle: articleTitle,
            userId: userId,
            userName: user?.displayName || 'Usuário',
            readAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("Falha ao registrar auditoria de leitura KCS:", error);
    }
}