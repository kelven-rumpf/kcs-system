/**
 * auth.js — Módulo de Autenticação (Cloud-Only) e Multi-Auth SaaS
 */
import { appCloud, dbCloud, checkTenantUserLimit, safeSetDoc, safeUpdateDoc, safeDeleteDoc, safeAddDoc } from './services/cloud.js';
import { TENANT_KEYS, ROLES, SECTORS } from './config.js';

let currentUser = null;
let authInstance = null;
let onAuthChangeCallback = null;

function normalizeApprovalStatus(user) {
    const raw = String(user?.approvalStatus || user?.status || '').trim().toLowerCase();
    if (raw === 'active') return 'approved';
    if (raw === 'pending_approval') return 'pending';
    return raw;
}

export function isUserApproved(user = currentUser) {
    const status = normalizeApprovalStatus(user);
    return status === 'approved';
}

export function initAuth(callback) {
    return new Promise(async (resolve) => {
        onAuthChangeCallback = callback;
        
        const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js');
        const { doc, getDoc, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
        
        authInstance = getAuth(appCloud);
        
        onAuthStateChanged(authInstance, async (user) => {
            if (user) {
                const userRef = doc(dbCloud, "users", user.uid);
                const userSnap = await getDoc(userRef);
                
                let userData;

                if (userSnap.exists()) {
                    // 1º Prioridade: O usuário já existe no banco de dados. Login direto.
                    userData = userSnap.data();
                    let needsUpdate = false;
                    
                    // PATCH CORRETIVO: Garante que usuários legados ganhem o ID no documento
                    if (!userData.id) {
                        userData.id = user.uid;
                        needsUpdate = true;
                    }
                    
                    if (!userData.displayName || String(userData.displayName) === 'undefined') {
                        userData.displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário KCS');
                        needsUpdate = true;
                    }
                    if (!userData.email || String(userData.email) === 'undefined') {
                        userData.email = user.email || '';
                        needsUpdate = true;
                    }
                    if (!userData.approvalStatus && !userData.status) {
                        userData.approvalStatus = 'approved';
                        userData.status = 'approved';
                        needsUpdate = true;
                    }
                    if (needsUpdate) {
                        await safeSetDoc(userRef, userData, { merge: true });
                    }
                } else {
                    // Novo usuário. Vamos verificar a governança.
                    const usersSnap = await getDocs(collection(dbCloud, "users"));
                    const isFirstUser = usersSnap.empty;
                    
                    let role = ROLES.USER;
                    let companyId = 'LIMBO_TENANT';
                    let sectorId = null;
                    
                    if (isFirstUser) {
                        role = ROLES.SUPER_ADMIN; 
                    } else {
                        const safeEmail = user.email ? user.email.toLowerCase().trim() : '';
                        const userDomain = safeEmail.includes('@') ? safeEmail.split('@')[1] : '';
                        
                        // 2º Prioridade: Existe convite pendente na collection 'invites'?
                        const inviteRef = doc(dbCloud, "invites", safeEmail);
                        const inviteSnap = await getDoc(inviteRef);
                        
                        if (inviteSnap.exists()) {
                            const inviteData = inviteSnap.data();
                            companyId = inviteData.tenantId || 'LIMBO_TENANT';
                        } else {
                            // 3º Prioridade: Não tem convite? Tenta Auto-Provisionamento pelo Domínio
                            const companiesSnap = await getDocs(collection(dbCloud, "companies"));
                            let matchedCompanyId = null;
                            
                            companiesSnap.forEach(doc => {
                                const cData = doc.data();
                                const domains = cData.domains || [];
                                if (domains.includes(userDomain)) {
                                    matchedCompanyId = cData.companyId;
                                }
                            });

                            if (matchedCompanyId) {
                                companyId = matchedCompanyId;
                            } else {
                                // BLOQUEIO IMEDIATO! Sem convite e sem domínio válido.
                                const { signOut } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js');
                                await signOut(authInstance);
                                
                                alert(`ACESSO NEGADO 🛑\n\nO domínio corporativo (@${userDomain}) não está cadastrado e você não possui um convite direto pendente.\n\nContate o administrador da empresa.`);
                                
                                if (onAuthChangeCallback) onAuthChangeCallback(null);
                                resolve(null);
                                return; 
                            }
                        }
                    }

                  // --- VALIDAÇÃO DE LIMITE SAAS ---
                    if (!isFirstUser && companyId !== 'LIMBO_TENANT') {
                        const limitCheck = await checkTenantUserLimit(companyId);
                        
                        if (!limitCheck.allowed) {
                            const { signOut } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js');
                            await signOut(authInstance);
                            
                            // UX Writing: Alerta mais suave e acolhedor
                            alert(`Ops, casa cheia! 🏠\n\n${limitCheck.message}\n\nPor favor, avise o Administrador do sistema para liberar mais espaço para você entrar no time.`);
                            
                            if (onAuthChangeCallback) onAuthChangeCallback(null);
                            resolve(null);
                            return;
                        }
                    }
                    
                    // Se passou por tudo, cria o usuário na collection.
                    userData = { 
                        id: user.uid, 
                        email: user.email || '', 
                        displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário KCS'), 
                        photoURL: user.photoURL || '', 
                        role: role,
                        companyId: companyId,
                        sectorId: isFirstUser ? SECTORS[0].id : null,
                        group_id: null,
                        group_ids: [],
                        approvalStatus: isFirstUser ? 'approved' : 'pending',
                        status: isFirstUser ? 'approved' : 'pending',
                        approvalRequestedAt: new Date().toISOString()
                    };
                    await safeSetDoc(userRef, userData); 
                }

                // Configura as variáveis de sessão para o Front-end
                const companyId = userData.companyId || 'LIMBO_TENANT';
                const sectorId = userData.sectorId || '';
                let companyName = "Empresa Pendente";
                let botName = "Assistente KCS";
                let tenantMaxUsers = 5;
                let tenantPlan = 'Bronze';

                if (companyId !== 'LIMBO_TENANT') {
                    let tenantRef = doc(dbCloud, "tenants", companyId);
                    let tenantSnap = await getDoc(tenantRef);
                    
                    if (!tenantSnap.exists()) {
                        tenantRef = doc(dbCloud, "companies", companyId);
                        tenantSnap = await getDoc(tenantRef);
                    }

                    if (tenantSnap.exists()) {
                        const tData = tenantSnap.data();
                        companyName = tData.companyName || companyName;
                        botName = tData.botName || botName;
                        
                        // Lendo os dados reais salvos no Firestore
                        tenantMaxUsers = tData.maxUsers || 5;
                        tenantPlan = tData.plan || 'Bronze';
                    }
                }

                sessionStorage.setItem(TENANT_KEYS.USER_ID, user.uid);
                sessionStorage.setItem(TENANT_KEYS.COMPANY_ID, companyId);
                sessionStorage.setItem(TENANT_KEYS.SECTOR_ID, sectorId);
                sessionStorage.setItem(TENANT_KEYS.COMPANY_NAME, companyName);
                sessionStorage.setItem(TENANT_KEYS.BOT_NAME, botName);
                
                // NOVO: Salvando na sessão para o render.js puxar e colorir o Badge corretamente
                sessionStorage.setItem('tenant_max_users', tenantMaxUsers);
                sessionStorage.setItem('tenant_plan', tenantPlan);

                // INJEÇÃO DIRETA: Garante que as chaves id e uid estejam sempre presentes no estado global
                currentUser = { 
                    ...userData, 
                    companyName, 
                    botName,
                    uid: user.uid,
                    id: user.uid
                };
                
                if (onAuthChangeCallback) onAuthChangeCallback(currentUser);
                resolve(currentUser);
            } else {
                sessionStorage.clear();
                currentUser = null;
                if (onAuthChangeCallback) onAuthChangeCallback(null);
                resolve(null);
            }
        });
    });
}

// ==========================================
// MÉTODOS DE AUTENTICAÇÃO (MULTI-AUTH)
// ==========================================
export async function loginWithGoogle() {
    try {
        const { GoogleAuthProvider, signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js');
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(authInstance, provider);
        return { success: true };
    } catch(e) {
        return { success: false, message: e.message };
    }
}

export async function loginWithMicrosoft() {
    try {
        const { OAuthProvider, signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js');
        const provider = new OAuthProvider('microsoft.com');
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(authInstance, provider);
        return { success: true };
    } catch(e) {
        return { success: false, message: e.message };
    }
}

export async function loginWithEmail(email, password) {
    try {
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js');
        await signInWithEmailAndPassword(authInstance, email, password);
        return { success: true };
    } catch(e) {
        return { success: false, message: 'Dados incorretos ou usuário inexistente.' };
    }
}

export async function registerWithEmail(email, password) {
    try {
        const { createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js');
        await createUserWithEmailAndPassword(authInstance, email, password);
        return { success: true };
    } catch(e) {
        return { success: false, message: 'Falha no cadastro. O e-mail pode já estar em uso.' };
    }
}

export async function logout() {
    if(authInstance) {
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js');
        await signOut(authInstance);
    }
}

// ==========================================
// UTILITÁRIOS E PERMISSÕES
// ==========================================
export function isAuthenticated() { return currentUser !== null; }
export function getCurrentUser() { return currentUser; }
export function hasRole(role) { return currentUser && currentUser.role === role; }
export function hasPermission(action) {
    if (!currentUser) return false;
    if (!isUserApproved(currentUser)) return false;
    const r = currentUser.role;
    if (r === ROLES.SUPER_ADMIN) return true; 
    if (r === ROLES.ADMIN) return true; 
    if (r === ROLES.ANALYST) return ['create_article', 'edit_article', 'delete_article', 'validate_article', 'read_article', 'search', 'manage_sql'].includes(action);
    if (r === ROLES.USER) return ['read_article', 'like_article', 'comment_article', 'search'].includes(action);
    return false;
}

// ==========================================
// GESTÃO DE USUÁRIOS E CONVITES (SAAS)
// ==========================================
export async function getAllUsersFromCloud() {
    const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    let usersQuery;
    if (currentUser.role === ROLES.SUPER_ADMIN) {
        usersQuery = collection(dbCloud, "users");
    } else {
        const currentCompanyId = sessionStorage.getItem(TENANT_KEYS.COMPANY_ID);
        usersQuery = query(collection(dbCloud, "users"), where("companyId", "==", currentCompanyId));
    }
    const snap = await getDocs(usersQuery);
    const users = [];
    snap.forEach(d => users.push(d.data()));
    return users; 
}

export async function updateUserApprovalStatusInCloud(uid, approvalStatus = 'approved') {
    const { doc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    await safeUpdateDoc(doc(dbCloud, "users", uid), {
        approvalStatus,
        status: approvalStatus,
        approvedAt: approvalStatus === 'approved' ? new Date().toISOString() : null
    });
    return { success: true };
}

export async function updateUserRoleInCloud(uid, newRole) {
    const { doc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    await safeUpdateDoc(doc(dbCloud, "users", uid), { role: newRole });
    return { success: true };
}

export async function updateUserCompanyInCloud(uid, newCompanyId) {
    const { doc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    await safeUpdateDoc(doc(dbCloud, "users", uid), { companyId: newCompanyId });
    return { success: true };
}

export async function updateUserGroupsInCloud(userId, groupIds) {
    const { doc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');

    if (!userId) throw new Error('userId não informado.');

    const normalizedGroupIds = Array.isArray(groupIds)
        ? groupIds.filter(Boolean)
        : [];

    const userRef = doc(dbCloud, 'users', userId);

    await safeUpdateDoc(userRef, {
        group_ids: normalizedGroupIds,
        group_id: null,
        updatedAt: new Date().toISOString()
    });

    return {
        success: true,
        userId,
        group_ids: normalizedGroupIds
    };
}

export async function deleteGroupFromCloud(groupId) {
    const { 
        doc, 
        collection, 
        query, 
        where, 
        getDocs 
    } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');

    if (!groupId) throw new Error('groupId não informado.');

    const usersQuery = query(
        collection(dbCloud, 'users'),
        where('group_ids', 'array-contains', groupId)
    );

    const usersSnap = await getDocs(usersQuery);

    const updates = usersSnap.docs.map(userDoc => {
        const userData = userDoc.data();
        const currentGroupIds = Array.isArray(userData.group_ids) ? userData.group_ids : [];

        return safeUpdateDoc(doc(dbCloud, 'users', userDoc.id), {
            group_ids: currentGroupIds.filter(id => id !== groupId),
            updatedAt: new Date().toISOString()
        });
    });

    await Promise.all(updates);

    await safeDeleteDoc(doc(dbCloud, 'groups', groupId));

    return {
        success: true,
        groupId
    };
}

export async function updateUserSectorInCloud(uid, newSectorId) {
    const { doc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    await safeUpdateDoc(doc(dbCloud, "users", uid), { sectorId: newSectorId });
    return { success: true };
}

export async function deleteUserInCloud(uid) {
    const { doc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    await safeDeleteDoc(doc(dbCloud, "users", uid));
    return { success: true };
}

export async function createCompanyInCloud(companyName, domainStr) {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    
    if (!companyName || companyName.trim().length < 3) throw new Error("Nome da empresa inválido.");
    if (!domainStr) throw new Error("É necessário fornecer ao menos um domínio.");

    // 1. Múltiplos Domínios: Transforma a string separada por vírgula em array e limpa os dados
    const domains = domainStr.split(',')
                             .map(d => d.trim().toLowerCase().replace('@',''))
                             .filter(Boolean);

    if (domains.length === 0) throw new Error("Domínio inválido.");

    // Corta no primeiro ponto (ex: kcshub.com.br vira kcshub) e limpa sobras
    const companyId = domains[0].split('.')[0].replace(/[^a-z0-9]/g, '');
    if (!companyId) throw new Error("Domínio principal inválido para gerar o ID do tenant.");

    const companyRef = doc(dbCloud, "companies", companyId);
    
    // 3. Validação de Duplicidade: Verifica se o ID gerado já existe no banco para não sobrescrever
    const docSnap = await getDoc(companyRef);
    if (docSnap.exists()) throw new Error("Já existe uma empresa cadastrada com este domínio principal.");

    // 4. Criação do Documento no Firestore
    await safeSetDoc(companyRef, {
        companyId,
        companyName: companyName.trim(),
        domains,
        botName: `IA - ${companyName.trim().split(' ')[0]}`,
        plan: 'Starter', // Define o plano básico como padrão
        maxUsers: 5,     // Define o limite padrão
        createdAt: new Date().toISOString()
    });
    
    return { success: true, companyId };
}

export async function getAllCompaniesFromCloud() {
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    const snap = await getDocs(collection(dbCloud, "companies"));
    const companies = [];
    snap.forEach(d => companies.push(d.data()));
    return companies;
}

export async function inviteUserToSystem(email, role, tenantId, sectorId) {
    const { doc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    const safeEmail = email.toLowerCase().trim();
    await safeSetDoc(doc(dbCloud, "invites", safeEmail), {
        email: safeEmail,
        role: role,
        tenantId: tenantId,
        sectorId: sectorId,
        invitedBy: currentUser.email || 'Admin',
        invitedAt: new Date().toISOString()
    });
    return { success: true };
}

export async function getAllInvitedUsers() {
    const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    let inviteQuery;
    if (currentUser.role === ROLES.SUPER_ADMIN) {
        inviteQuery = collection(dbCloud, "invites");
    } else {
        const currentCompanyId = sessionStorage.getItem(TENANT_KEYS.COMPANY_ID);
        inviteQuery = query(collection(dbCloud, "invites"), where("tenantId", "==", currentCompanyId));
    }
    const snap = await getDocs(inviteQuery);
    const invites = [];
    snap.forEach(d => invites.push(d.data()));
    return invites;
}

export async function removeInvitedUser(email) {
    const { doc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    await safeDeleteDoc(doc(dbCloud, "invites", email.toLowerCase().trim()));
    return { success: true };
}

// NOVA FUNÇÃO: ATUALIZAR PLANO E LIMITES DA EMPRESA (Sincronizado com maxUsers) 10/04/2026
export async function updateCompanyPlanInCloud(companyId, planName, maxUsers) {
    const { doc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    await safeUpdateDoc(doc(dbCloud, "companies", companyId), {
        plan: planName,
        maxUsers: Number(maxUsers)
    });
    return { success: true };
}

// NOVA FUNÇÃO: BUSCA VISÃO GERAL DE EMPRESAS PARA O ADMIN E MASTER
export async function fetchCompaniesOverview() {
    const { collection, getDocs, query, where, getCountFromServer } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    
    // Trazemos todas as empresas
    const companiesSnap = await getDocs(collection(dbCloud, "companies"));
    const overview = [];

    // Otimização: Promise.all para buscar as contagens em paralelo
    const countPromises = companiesSnap.docs.map(async (doc) => {
        const data = doc.data();
        const q = query(collection(dbCloud, "users"), where("companyId", "==", data.companyId));
        const countSnap = await getCountFromServer(q);
        
        return {
            ...data,
            userCount: countSnap.data().count,
            plan: data.plan || 'Starter', // Fallback seguro
            maxUsers: data.maxUsers || 5
        };
    });

    return await Promise.all(countPromises);
}

export async function updateCompanyDetailsInCloud(companyId, newName, domainsStr, newPlan) {
    const { doc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    
    const domains = domainsStr.split(',')
                              .map(d => d.trim().toLowerCase().replace('@',''))
                              .filter(Boolean);

    const companyRef = doc(dbCloud, "companies", companyId);
    
    let maxUsers = 5;
    if (newPlan === 'Teams') maxUsers = 20;
    if (newPlan === 'Unlimited') maxUsers = 9999;

    await safeUpdateDoc(companyRef, {
        companyName: newName.trim(),
        domains: domains,
        plan: newPlan,
        maxUsers: maxUsers,
        botName: `IA - ${newName.trim().split(' ')[0]}`
    });
    
    return { success: true };
}

export async function deleteCompanyInCloud(companyId) {
    const { doc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
    await safeDeleteDoc(doc(dbCloud, "companies", companyId));
    return { success: true };
}

export async function createGroup(groupData) {
    const { collection } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');

    const companyId = groupData.company_id || sessionStorage.getItem(TENANT_KEYS.COMPANY_ID);

    if (!companyId) throw new Error('company_id não encontrado.');
    if (!groupData.name || groupData.name.trim().length < 2) throw new Error('Nome do grupo inválido.');

    const payload = {
        name: groupData.name.trim(),
        company_id: companyId,
        sector_id: groupData.sector_id || null,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.email || 'system'
    };

    const ref = await safeAddDoc(collection(dbCloud, 'groups'), payload);

    return {
        success: true,
        id: ref.id,
        ...payload
    };
}

export async function getGroupsFromCloud() {
    const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');

    const companyId = sessionStorage.getItem(TENANT_KEYS.COMPANY_ID);
    if (!companyId) return [];

    const q = query(
        collection(dbCloud, 'groups'),
        where('company_id', '==', companyId)
    );

    const snap = await getDocs(q);
    const groups = [];

    snap.forEach(docSnap => {
        groups.push({
            id: docSnap.id,
            ...docSnap.data()
        });
    });

    return groups;
}

// ==========================================
// SECTOR MANAGEMENT (CUSTOM SECTORS)
// ==========================================

export async function getCustomSectorsFromCloud() {
    const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');

    const companyId = sessionStorage.getItem(TENANT_KEYS.COMPANY_ID);
    if (!companyId) return [];

    const q = query(
        collection(dbCloud, 'sectors'),
        where('company_id', '==', companyId)
    );

    const snap = await getDocs(q);
    const sectors = [];

    snap.forEach(docSnap => {
        sectors.push({
            id: docSnap.id,
            ...docSnap.data()
        });
    });

    return sectors;
}

export async function createSectorInCloud(name) {
    const { doc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');

    const companyId = sessionStorage.getItem(TENANT_KEYS.COMPANY_ID);

    if (!companyId) throw new Error('company_id não encontrado.');
    if (!name || name.trim().length < 2) throw new Error('Nome do setor inválido.');

    const cleanName = name.trim();

    const normalizeSectorId = (value) => {
        return String(value || '')
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    };

    const sectorId = normalizeSectorId(cleanName);

    if (!sectorId || sectorId.length < 2) {
        throw new Error('Não foi possível gerar um ID válido para o setor.');
    }

    const customSectors = await getCustomSectorsFromCloud();
    const allSectors = [...SECTORS, ...customSectors];

    const alreadyExists = allSectors.some(s =>
        String(s.id).toLowerCase() === sectorId.toLowerCase() ||
        String(s.name).trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (alreadyExists) {
        throw new Error(`Setor "${cleanName}" já existe.`);
    }

    const payload = {
        id: sectorId,
        name: cleanName,
        company_id: companyId,
        isCustom: true,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.email || currentUser?.displayName || 'system'
    };

    await safeSetDoc(
        doc(dbCloud, 'sectors', `${companyId}_${sectorId}`),
        payload,
        { merge: true }
    );

    return {
        success: true,
        ...payload
    };
}

export async function deleteSectorFromCloud(sectorId) {
    const { collection, query, where, getDocs, doc } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');

    const companyId = sessionStorage.getItem(TENANT_KEYS.COMPANY_ID);
    if (!companyId) throw new Error('company_id não encontrado.');

    // Verificar se é setor personalizado (não pode deletar SECTORS fixos)
    const isCustom = !SECTORS.find(s => s.id === sectorId);
    if (!isCustom) {
        throw new Error('Não é possível excluir setores padrão do sistema.');
    }

    // Verificar se há grupos usando este setor
    const groupsQuery = query(
        collection(dbCloud, 'groups'),
        where('company_id', '==', companyId),
        where('sector_id', '==', sectorId)
    );

    const groupsSnap = await getDocs(groupsQuery);

    if (groupsSnap.size > 0) {
        throw new Error(`Não é possível excluir setor com ${groupsSnap.size} grupo(s) vinculado(s).`);
    }

    // Verificar se há usuários usando este setor
    const usersQuery = query(
        collection(dbCloud, 'users'),
        where('company_id', '==', companyId),
        where('sectorId', '==', sectorId)
    );

    const usersSnap = await getDocs(usersQuery);

    if (usersSnap.size > 0) {
        throw new Error(`Não é possível excluir setor com ${usersSnap.size} usuário(s) vinculado(s).`);
    }

    // Se passou nas verificações, buscar o documento e deletar
    const sectorsQuery = query(
        collection(dbCloud, 'sectors'),
        where('id', '==', sectorId),
        where('company_id', '==', companyId)
    );

    const sectorsSnap = await getDocs(sectorsQuery);

    if (sectorsSnap.size === 0) {
        throw new Error('Setor não encontrado.');
    }

    const sectorDoc = sectorsSnap.docs[0];
    await safeDeleteDoc(sectorDoc.ref);

    return { success: true, message: 'Setor excluído com sucesso.' };
}
