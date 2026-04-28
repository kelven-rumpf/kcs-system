/**
 * sqlLibrary.js — Módulo Biblioteca SQL (Cloud-Only)
 */

import { CONFIG, COLLECTION_SQL } from '../config.js';
import { getCurrentUser, hasPermission, isUserApproved } from '../auth.js';
import { dbCloud, safeSetDoc, safeUpdateDoc, safeDeleteDoc } from './cloud.js';
import { doc, getDoc, getDocs, collection, query, where } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { canUseFeature, FEATURE_FLAGS } from './featureAccess.js';

function generateId() { return `sql-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`; }
function now() { return new Date().toISOString(); }

function assertSqlLibraryAccess() {
    if (!canUseFeature(FEATURE_FLAGS.SQL_LIBRARY)) {
        throw new Error('Biblioteca SQL indisponível para o seu setor.');
    }
}

function assertSqlCreateAccess() {
    assertSqlLibraryAccess();
    if (!canUseFeature(FEATURE_FLAGS.SQL_CREATE)) {
        throw new Error('Criação ou alteração de SQL indisponível para o seu setor.');
    }
}

function assertAiAccessForSql() {
    if (!canUseFeature(FEATURE_FLAGS.AI_REFINE)) {
        throw new Error('Recursos de IA indisponíveis para o seu setor.');
    }
}

export async function createSqlScript(data) {
  assertSqlCreateAccess();
  if (!hasPermission('manage_sql') && !hasPermission('create_sql')) throw new Error('Sem permissão para criar scripts SQL.');
  const user = getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado.');
  if (!data.name || !data.name.trim()) throw new Error('O nome do script é obrigatório.');

  const sqlNumber = Math.floor(Math.random() * 90000) + 10000;
  const authorName = user.displayName || user.name || user.email || 'Usuário KCS';
  
  // Consolidado para preferir uid
  const userId = user?.uid || user?.id || 'unknown';

  let initialStatus = 'draft';
  if (data.statusRequest === 'approved' && hasPermission('manage_sql')) {
    initialStatus = 'approved';
  }

  const script = {
    id: generateId(),
    scriptNumber: sqlNumber,
    name: data.name.trim(),
    description: data.description || '',
    code: data.code,
    dbType: data.dbType || 'mysql',
    sqlCategory: data.sqlCategory || 'Outros',
    visibility: data.visibility || 'public',
    tags: Array.isArray(data.tags) ? data.tags.map((t) => t.trim()).filter(Boolean) : [],
    status: initialStatus,
    companyId: user.companyId || 'unknown_company', 
    
    likes: [], comments: [], favorites: [], history: [], 
    createdBy: authorName,
    createdById: userId,
    createdAt: now(),
    updatedAt: now(),
    updatedBy: authorName,
    version: 1,
  };

  await safeSetDoc(doc(dbCloud, COLLECTION_SQL, script.id), script);
  return script;
}

export async function updateSqlScript(id, data) {
  assertSqlCreateAccess();
  const script = await getSqlScript(id);
  if (!script) throw new Error('Script não encontrado.');
  
  const user = getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado.');
  
  const userId = user?.uid || user?.id || 'unknown';
  
  if (!hasPermission('manage_sql') && script.createdById !== userId) {
      throw new Error('Você só pode editar os seus próprios rascunhos.');
  }

  const authorName = user.displayName || user.name || user.email || 'Usuário KCS';

  script.history = script.history || [];
  const snapshot = { ...script };
  delete snapshot.history; 
  script.history.push(snapshot);

  if (data.name !== undefined) script.name = data.name.trim();
  if (data.description !== undefined) script.description = data.description;
  if (data.code !== undefined) script.code = data.code;
  if (data.dbType !== undefined) script.dbType = data.dbType;
  if (data.sqlCategory !== undefined) script.sqlCategory = data.sqlCategory;
  if (data.visibility !== undefined) script.visibility = data.visibility;
  if (data.tags !== undefined) script.tags = data.tags.map((t) => t.trim()).filter(Boolean);
  
  if (data.statusRequest && hasPermission('manage_sql')) {
      script.status = data.statusRequest;
  }

  script.updatedAt = now();
  script.version = (script.version || 1) + 1;
  script.updatedBy = authorName;

  await safeUpdateDoc(doc(dbCloud, COLLECTION_SQL, id), script);
  return script;
}

export async function toggleSqlLike(id) {
  assertSqlLibraryAccess();
  const user = getCurrentUser();
  if (!user) throw new Error('Falha: Usuário não está logado.'); 
  
  // OBRIGATÓRIO: Parar a execução se o ID estiver ausente para evitar a contaminação com 'unknown'
  const userId = user?.uid || user?.id;
  if (!userId) throw new Error("Falha de autenticação ao curtir."); 
  
  const script = await getSqlScript(id);
  if (!script) throw new Error('Script não encontrado.');
  
  let likes = (Array.isArray(script.likes) ? script.likes : []).filter(val => val != null);
  const idx = likes.indexOf(userId);
  
  if (idx > -1) {
      likes.splice(idx, 1);
  } else {
      likes.push(userId);
  }
  
  await safeUpdateDoc(doc(dbCloud, COLLECTION_SQL, id), { likes });
  return likes; 
}

export async function toggleSqlFavorite(id) {
  assertSqlLibraryAccess();
  const user = getCurrentUser();
  if (!user) throw new Error('Falha: Usuário não está logado.');
  
  // OBRIGATÓRIO: Parar a execução se o ID estiver ausente
  const userId = user?.uid || user?.id;
  if (!userId) throw new Error("Falha de autenticação ao favoritar.");

  const script = await getSqlScript(id);
  if (!script) throw new Error('Script não encontrado.');
  
  let favorites = (Array.isArray(script.favorites) ? script.favorites : []).filter(val => val != null);
  const idx = favorites.indexOf(userId);
  
  if (idx > -1) {
      favorites.splice(idx, 1);
  } else {
      favorites.push(userId);
  }
  
  await safeUpdateDoc(doc(dbCloud, COLLECTION_SQL, id), { favorites });
  return favorites;
}

export async function addSqlComment(id, text) {
  assertSqlLibraryAccess();
  const user = getCurrentUser();
  const script = await getSqlScript(id);
  if (!script || !user || !text.trim()) return;
  const authorName = user.displayName || user.name || user.email || 'Usuário KCS';
  const userId = user?.uid || user?.id || 'unknown';

  const comments = (script.comments || []).filter(val => val != null);
  const safeText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  comments.push({ userId: userId, userName: authorName, date: now(), text: safeText.trim() });
  
  await safeUpdateDoc(doc(dbCloud, COLLECTION_SQL, id), { comments });
}

export async function flagSqlScript(id, reason) {
  assertSqlLibraryAccess();
  const user = getCurrentUser();
  const script = await getSqlScript(id);
  if (!script || !user) return;
  const authorName = user.displayName || user.name || user.email || 'Usuário KCS';
  
  const comments = (script.comments || []).filter(val => val != null);
  const safeReason = reason.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  comments.push({ 
      userId: 'system', 
      userName: '🤖 Sistema (Flag SQL)', 
      date: now(), 
      text: `O utilizador ${authorName} relatou um erro ou melhoria neste script. Motivo: "${safeReason}"` 
  });
  
  await safeUpdateDoc(doc(dbCloud, COLLECTION_SQL, id), {
      status: 'review',
      updatedAt: now(),
      comments: comments
  });
}

export async function removeSqlScript(id) {
  assertSqlCreateAccess();
  if (!hasPermission('manage_sql')) throw new Error('Apenas analistas e administradores podem excluir.');
  await safeDeleteDoc(doc(dbCloud, COLLECTION_SQL, id));
}

export async function getSqlScript(id) {
  assertSqlLibraryAccess();
  if (!isUserApproved(getCurrentUser())) throw new Error('Acesso pendente de aprovação.');
  const docRef = doc(dbCloud, COLLECTION_SQL, id);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : null;
}

export async function listSqlScripts() {
  assertSqlLibraryAccess();
  const user = getCurrentUser();
  if (!user || !user.companyId) return [];
  if (!isUserApproved(user)) return [];
  
  // Busca apenas os scripts da empresa atual
  const q = query(collection(dbCloud, COLLECTION_SQL), where("companyId", "==", user.companyId));
  const snap = await getDocs(q);
  const scripts = snap.docs.map(doc => doc.data());

  scripts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  
  if (!hasPermission('manage_sql')) {
      const userId = user?.uid || user?.id || 'unknown';
      return scripts.filter(s => 
          s.status === 'approved' || 
          s.status === 'validated' || 
          !s.status || 
          s.createdById === userId
      );
  }
  return scripts;
}

export async function explicarScriptSQL(codigo) {
    assertSqlLibraryAccess();
    assertAiAccessForSql();
    if (!CONFIG || !CONFIG.GEMINI_API_KEY) {
        throw new Error("A chave da API do Gemini não foi encontrada no config.js.");
    }

    const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

    const response = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: `Explique de forma resumida e didática, em no máximo 2 linhas, o que o seguinte script SQL faz, em português:\n\n${codigo}` }]
            }]
        })
    });

    const data = await response.json();
    if (data.error) throw new Error(`${data.error.code}: ${data.error.message}`);
    
    if (data.candidates && data.candidates[0].content.parts[0].text) {
        return data.candidates[0].content.parts[0].text.trim();
    }
    throw new Error("A IA não retornou uma explicação válida.");
}
