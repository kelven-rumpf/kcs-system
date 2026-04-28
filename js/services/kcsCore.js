/**
 * kcsCore.js — Core de Inteligência Artificial e Gestão KCS
 * Refatoração SRE: Cache-First (Dexie), Segurança de Tipos JSON e Firebase Reads Optimization
 */

import { dbCloud, safeAddDoc, safeSetDoc, safeUpdateDoc, safeDeleteDoc } from './cloud.js';
import { doc, getDoc, getDocs, collection, query, where, getCountFromServer, orderBy, limit, onSnapshot, increment, runTransaction } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { getCurrentUser } from '../auth.js';
import { CONFIG, COLLECTION_ARTICLES } from '../config.js';
import { COLLECTION_CHAT_LOGS, FIREBASE_ENV } from '../config/firestore.js';
import { canUseFeature, FEATURE_FLAGS } from './featureAccess.js';

import {
    filterArticlesByUserScope,
    canViewArticle,
    canEditArticle,
    canApproveArticle
} from './visibility.js';

// ID de Sessão Único (Protege contra o mesmo usuário abrindo 2 abas)
export const SESSION_ID = Math.random().toString(36).substring(2, 15);
const ARTICLE_READS_COLLECTION = `article_reads_${FIREBASE_ENV}`;

// ==========================================
// INICIALIZAÇÃO DO CACHE LOCAL (DEXIE.JS)
// Economia de 90% das leituras do Firebase
// ==========================================
export const dbLocal = new Dexie(`KCS_CacheDB_${FIREBASE_ENV}`);
dbLocal.version(1).stores({
    articles: 'id, companyId, status, categoryId, updatedAt'
});

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

function extractJsonObject(text) {
    const firstBrace = text.indexOf('{');
    if (firstBrace === -1) return null;

    let depth = 0;
    for (let i = firstBrace; i < text.length; i++) {
        if (text[i] === '{') depth++;
        if (text[i] === '}') depth--;
        if (depth === 0) return text.substring(firstBrace, i + 1);
    }
    return null;
}

function validateStructuredResponse(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('A resposta da IA não é um objeto JSON válido.');
    }

    const requiredKeys = ['titulo', 'sintoma', 'ambiente', 'causa', 'solucao', 'passos'];
    const missingKeys = requiredKeys.filter(key => {
        const value = payload[key];
        return typeof value !== 'string' || value.trim().length === 0;
    });

    if (missingKeys.length > 0) {
        throw new Error(`Resposta JSON inválida ou incompleta. Faltando: ${missingKeys.join(', ')}`);
    }

    return {
        titulo: payload.titulo.trim(),
        sintoma: payload.sintoma.trim(),
        ambiente: payload.ambiente.trim(),
        causa: payload.causa.trim(),
        solucao: payload.solucao.trim(),
        passos: payload.passos.trim(),
        tags: Array.isArray(payload.tags) ? payload.tags.filter(tag => typeof tag === 'string' && tag.trim().length > 0) : []
    };
}

function parseJsonStructuredResponse(cleanedText) {
    const candidateStrings = [cleanedText];
    const extracted = extractJsonObject(cleanedText);
    if (extracted && extracted !== cleanedText) {
        candidateStrings.push(extracted);
    }

    let lastError = null;
    for (const candidate of candidateStrings) {
        try {
            const parsed = JSON.parse(candidate);
            return validateStructuredResponse(parsed);
        } catch (error) {
            lastError = error;
        }
    }

    console.error('[IA Parser] Não foi possível parsear JSON válido. Texto recebido:', cleanedText);
    throw lastError || new Error('A IA devolveu JSON inválido.');
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
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '').trim();
    }

    // Auditoria Assíncrona
    try {
        safeAddDoc(collection(dbCloud, COLLECTION_CHAT_LOGS), {
            userId: user?.uid || user?.id || 'system',
            userName: user?.displayName || 'Usuário Editor',
            action: actionType,
            input: userOriginalText,
            output: cleanedText,
            timestamp: new Date().toISOString()
        }).catch(() => {}); // Fire and forget
    } catch (e) {
        console.warn("Falha ao gravar log de auditoria IA:", e);
    }

    // FALLBACK ROBUSTO PARA JSON (SRE)
    if (isJson) {
        return parseJsonStructuredResponse(cleanedText);
    }

    return cleanedText;
}

function assertFeature(featureKey, message) {
    if (!canUseFeature(featureKey)) {
        throw new Error(message || 'Funcionalidade indisponível para o seu setor.');
    }
}

function assertAiRefineAccess() {
    assertFeature(FEATURE_FLAGS.AI_REFINE, 'Refinar com IA indisponível para o seu setor.');
}

function assertOcrAccess() {
    assertFeature(FEATURE_FLAGS.OCR, 'OCR indisponível para o seu setor.');
}

export async function reescreverTextoTecnico(promptText) {
    assertAiRefineAccess();
    const systemPrompt = `Atue como um especialista em documentação técnica seguindo práticas KCS.
    
Analise o rascunho fornecido. Estruture o procedimento e extraia informações para preencher os campos automaticamente.

OBJETIVOS DE EXTRAÇÃO:
1. Criar um 'titulo' claro e pesquisável (se estiver vazio).
2. Identificar o 'sintoma' (o que o cliente relatou).
3. Identificar o 'ambiente' (sistema, versão).
4. Identificar a 'causa' (raiz técnica).
5. Identificar a 'solucao' (resumo de como resolver).
6. Estruturar os 'passos' (o guia prático detalhado).
7. Gerar 'tags' relevantes (array de strings) para categorização e busca.

REGRAS PARA A CHAVE 'passos':
- Escreva de forma limpa, direta, com verbos no infinitivo (ex: Acessar, Clicar).
- Se houver tags como [IMAGEM_0], [IMAGEM_1] ou __IMAGEM_0__ no texto, MANTENHA-AS no meio do texto, exatamente na posição lógica onde a imagem ilustra o passo correspondente. NUNCA as remova.
- Use quebras de linha normais para separar as ações. Não crie listas numeradas automaticamente.

RETORNO OBRIGATÓRIO (JSON STRICT):
{
    "titulo": "...",
    "sintoma": "...",
    "ambiente": "...",
    "causa": "...",
    "solucao": "...",
    "passos": "...",
    "tags": ["tag1", "tag2", "tag3"]
}

RASCUNHO DO USUÁRIO:
${promptText}`;
    
    return await callGeminiIA(systemPrompt, promptText, 'reescrever_completo', true); 
}

export async function corrigirGramaticaApenas(promptText) {
    assertAiRefineAccess();
    const systemPrompt = `Atue como um revisor gramatical. Corrija exclusivamente erros de ortografia e acentuação.
NÃO remova marcadores como __IMAGEM_0__. Retorne APENAS o texto corrigido, sem adicionar nenhum comentário adicional.
TEXTO ORIGINAL:
${promptText}`;
    return await callGeminiIA(systemPrompt, promptText, 'corrigir', false);
}

// ==========================================
// CACHE-FIRST CRUD OPERATIONS
// ==========================================

async function syncFirebaseToLocal(companyId) {
    try {
        const q = query(collection(dbCloud, COLLECTION_ARTICLES), where("companyId", "==", companyId));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => doc.data());
        
        // Atualização em massa no Dexie
        await dbLocal.articles.bulkPut(data);
        return data;
    } catch (e) {
        console.warn("[Dexie] Falha ao sincronizar do Firebase:", e);
        return [];
    }
}




export async function listArticles(forceSync = false) { 
    const user = getCurrentUser();

    if (!user || !user.companyId) return [];

    if (!forceSync) {
        try {
            const cached = await dbLocal.articles
                .where('companyId')
                .equals(user.companyId)
                .toArray();

            if (cached.length > 0) {
                syncFirebaseToLocal(user.companyId).catch(() => {});
                return filterArticlesByUserScope(cached, user);
            }
        } catch (e) {
            console.warn("[Dexie] Falha ao ler cache, recorrendo à nuvem:", e);
        }
    }

    const articles = await syncFirebaseToLocal(user.companyId);
    return filterArticlesByUserScope(articles, user);
}


export async function getArticle(articleId) {
  try {
    const user = getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');

    const ref = doc(dbCloud, COLLECTION_ARTICLES, articleId);
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
      throw new Error('Procedimento não encontrado');
    }

    const article = {
      id: snapshot.id,
      ...snapshot.data()
    };

    if (!canViewArticle(user, article)) {
      throw new Error('Sem permissão para visualizar este procedimento.');
    }

    return article;

  } catch (error) {
    console.error('Erro ao buscar artigo:', error);
    throw error;
  }
}


export async function createArticle(data) {
    try {
        const user = getCurrentUser();
        if (!user) throw new Error('Usuário não autenticado');

        const now = new Date().toISOString();

        const userId = user.id || user.uid;

        const isInvalidName = (value) => {
            if (!value || typeof value !== 'string') return true;

            const normalized = value.trim();

            if (!normalized) return true;
            if (normalized === userId) return true;
            if (normalized.length > 28 && !normalized.includes(' ') && !normalized.includes('@')) return true;

            return false;
        };

        const candidates = [
            user.displayName,
            user.name,
            user.fullName,
            user.nome,
            user.email
        ];

        const validName = candidates.find(value => !isInvalidName(value));

        const authorName = validName
            ? validName.trim()
            : 'Usuário KCS';

        const requestedStatus =
            data.status ||
            data.statusRequest ||
            data.workflowStatus ||
            'pendente_revisao';

        const normalizedStatus = String(requestedStatus || '').toLowerCase();

        const cleanArticleNumber = data.articleNumber
            ? String(data.articleNumber).replace(/^#KCS-/i, '')
            : Date.now().toString().slice(-6);

        const article = {
            ...data,

            companyId: user.companyId,
            sectorId: data.sectorId || user.sectorId || null,

            group_ids: Array.isArray(data.group_ids)
                ? data.group_ids
                : Array.isArray(user.group_ids)
                    ? user.group_ids
                    : [],

            articleNumber: cleanArticleNumber,

            createdBy: authorName,
            updatedBy: authorName,

            createdById: userId,
            authorId: userId,
            updatedById: userId,
            created_by: userId,

            authorName: authorName,
            author: authorName,
            createdByName: authorName,
            updatedByName: authorName,
            created_by_name: authorName,

            createdAt: now,
            updatedAt: now,
            created_at: now,
            updated_at: now,

            visibility: data.visibility || 'public',

            views: data.views || 0,
            likes: Array.isArray(data.likes) ? data.likes : [],
            favorites: Array.isArray(data.favorites) ? data.favorites : [],
            comments: Array.isArray(data.comments) ? data.comments : []
        };

        if (
            normalizedStatus === 'approved' ||
            normalizedStatus === 'publicado' ||
            normalizedStatus === 'published'
        ) {
            article.status = canApproveArticle(user, article)
                ? 'approved'
                : 'pendente_revisao';

            if (article.status === 'approved') {
                article.approvedBy = authorName;
                article.approvedById = userId;
                article.reviewedBy = authorName;
                article.reviewedById = userId;
                article.validatedBy = authorName;
                article.validatedById = userId;
                article.approvedAt = now;
            }
        } else {
            article.status = requestedStatus || 'pendente_revisao';
        }

        const docRef = await safeAddDoc(
            collection(dbCloud, COLLECTION_ARTICLES),
            article
        );

        article.id = docRef.id;

        await safeSetDoc(
            doc(dbCloud, COLLECTION_ARTICLES, docRef.id),
            {
                id: docRef.id
            },
            { merge: true }
        );

        try {
            await dbLocal.articles.put(article);
        } catch (cacheError) {
            console.warn('[Dexie] Falha ao salvar artigo no cache local:', cacheError);
        }

        return article;

    } catch (error) {
        console.error('Erro ao criar artigo:', error);
        throw error;
    }
}


export async function updateArticle(articleId, updates) {
    try {
        const user = getCurrentUser();
        if (!user) throw new Error('Usuário não autenticado');

        const ref = doc(dbCloud, COLLECTION_ARTICLES, articleId);
        const snapshot = await getDoc(ref);

        if (!snapshot.exists()) {
            throw new Error('Procedimento não encontrado');
        }

        const existingArticle = {
            id: snapshot.id,
            ...snapshot.data()
        };

        const requestedStatus =
            updates.statusRequest ||
            updates.status ||
            existingArticle.status;

        const normalizedRequestedStatus = String(requestedStatus || '').trim().toLowerCase();

        const isApprovalRequest =
            normalizedRequestedStatus === 'approved' ||
            normalizedRequestedStatus === 'publicado' ||
            normalizedRequestedStatus === 'published';

        const now = new Date().toISOString();

        const userId = user.id || user.uid;
        const userName =
            user.name ||
            user.displayName ||
            user.fullName ||
            user.email ||
            'Sistema';

        // Aprovação: valida pela regra de aprovação, não pela regra comum de edição
        if (isApprovalRequest) {
            if (!canApproveArticle(user, existingArticle)) {
                throw new Error('Sem permissão para aprovar este procedimento');
            }
        } else {
            if (!canEditArticle(user, existingArticle)) {
                throw new Error('Sem permissão para editar este procedimento');
            }
        }

        const history = Array.isArray(existingArticle.history)
            ? [...existingArticle.history]
            : [];

        history.push({
            ...existingArticle,
            historyAt: now,
            historyBy: userName,
            historyById: userId
        });

        const payload = {
            ...updates,
            updatedAt: now,
            updated_at: now,
            updatedBy: userName,
            updatedById: userId,
            updaterId: userId,
            history
        };

        if (isApprovalRequest) {
            payload.status = 'approved';
            payload.statusRequest = 'approved';
            payload.approvedBy = userName;
            payload.approvedById = userId;
            payload.reviewedBy = userName;
            payload.reviewedById = userId;
            payload.validatedBy = userName;
            payload.validatedById = userId;
            payload.reviewerId = userId;
            payload.approvedAt = now;
        }

        delete payload.id;

        await safeUpdateDoc(ref, payload);

        const updatedArticle = {
            ...existingArticle,
            ...payload
        };

        try {
            await dbLocal.articles.put(updatedArticle);
        } catch (cacheError) {
            console.warn('[Dexie] Falha ao atualizar cache local:', cacheError);
        }

        return updatedArticle;

    } catch (error) {
        console.error('Erro ao atualizar artigo:', error);
        throw error;
    }
}

export async function removeArticle(id) { 
    await safeDeleteDoc(doc(dbCloud, COLLECTION_ARTICLES, id));
    await dbLocal.articles.delete(id).catch(() => {}); // Remove do cache
}

// ==========================================
// INTERAÇÕES SOCIAIS (BLINDADAS E CACHEADAS)
// ==========================================
export async function flagArticle(id, reason) {
    const user = getCurrentUser();
    const userId = user?.uid || user?.id || 'unknown_user_id';
    const existing = await getArticle(id);
    if (!existing) return;
    const comments = Array.isArray(existing.comments) ? existing.comments.filter(val => val != null) : [];
    comments.push({ id: `cmt_${Date.now()}`, userId: userId, userName: user.displayName || user.email || 'Usuário', text: `⚠️ [SINALIZADO]: ${reason}`, date: new Date().toISOString() });
    
    await safeUpdateDoc(doc(dbCloud, COLLECTION_ARTICLES, id), { status: 'pendente_revisao', comments: comments });
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
    
    await safeUpdateDoc(docRef, { likes });
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
    
    await safeUpdateDoc(docRef, { favorites });
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
    
    await safeUpdateDoc(docRef, { comments });
}

// ==========================================
// MÉTRICAS DO DASHBOARD KCS
// ==========================================
export async function getDashboardMetrics() {
    try {
        const readsColl = collection(dbCloud, ARTICLE_READS_COLLECTION);
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
            const now = Date.now(); 
            const lockTimeout = 5 * 60 * 1000;

            const lastHeartbeatMs = data.lastEditHeartbeat || 0;
            const currentUserId = user.uid || user.id;

            const isLockedByOtherUser = data.currentEditorId && data.currentEditorId !== currentUserId;
            const isLockedByOtherSession = data.currentEditorId === currentUserId && data.currentEditorSession !== SESSION_ID;

            if ((isLockedByOtherUser || isLockedByOtherSession) && (now - lastHeartbeatMs) < lockTimeout) {
                return { 
                    status: 'LOCKED',
                    lockedBy: data.currentEditorName || 'Outro Editor'
                }; 
            }

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
    await safeUpdateDoc(docRef, {
        currentEditorId: null,
        currentEditorName: null,
        currentEditorSession: null,
        lastEditHeartbeat: null
    });
}

// ==========================================
// NOTIFICAÇÕES, AUDITORIA DE LEITURA E SYNC DE CACHE
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

    // O Snapshot agora atua como um Web Worker de Sincronismo do Dexie
    notificationsUnsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const docId = change.doc.id;
            const data = change.doc.data();
            const currentStatus = data.status; 
            const articleTitle = data.title || 'Procedimento atualizado';

            // MANUTENÇÃO REATIVA DO DEXIE CACHE
            if (change.type === "added" || change.type === "modified") {
                dbLocal.articles.put(data).catch(() => {});
            } else if (change.type === "removed") {
                dbLocal.articles.delete(docId).catch(() => {});
            }

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
        await safeUpdateDoc(articleRef, {
            views: increment(1)
        });

        safeAddDoc(collection(dbCloud, ARTICLE_READS_COLLECTION), {
            articleId: articleId,
            articleTitle: articleTitle,
            userId: userId,
            userName: user?.displayName || 'Usuário',
            readAt: new Date().toISOString()
        }).catch(() => {});
        
    } catch (error) {
        console.error("Falha ao registrar auditoria de leitura KCS:", error);
    }
}

export async function extrairTextoImagemGemini(file) {
    assertOcrAccess();
    if (!CONFIG || !CONFIG.GEMINI_API_KEY) {
        throw new Error("Chave da API Gemini não configurada.");
    }

    if (!file || !file.type?.startsWith('image/')) {
        throw new Error("Arquivo inválido para OCR.");
    }

    const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const model = 'gemini-2.5-flash';
    const URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

    const payload = {
        contents: [{
            parts: [
                {
                    text: `Extraia TODO o texto visível desta imagem em português.
Retorne apenas o texto limpo, sem comentários, sem markdown e sem explicações.
Preserve quebras de linha úteis para documentação técnica KCS.`
                },
                {
                    inline_data: {
                        mime_type: file.type,
                        data: base64
                    }
                }
            ]
        }],
        generationConfig: {
            temperature: 0.1
        }
    };

    const response = await fetchWithBackoff(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    return String(data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}