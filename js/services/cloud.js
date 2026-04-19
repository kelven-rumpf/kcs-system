/**
 * cloud.js — Single Source of Truth para conexão com o Firebase (Cloud-Only)
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { 
    initializeFirestore, 
    memoryLocalCache, 
    collection, 
    doc, 
    getDoc, 
    setDoc, 
    deleteDoc, 
    getDocs, 
    query, 
    where,
    getCountFromServer,
    onSnapshot,
    serverTimestamp,
    orderBy,      
    limit,        
    startAfter,   
    endBefore,    
    limitToLast
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-functions.js';
import { PLANS } from '../config.js'; 

export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC_S8IW_iuTrKHRv76DQ3ve-pZCHqNVimA",
    authDomain: "kcs-system-180db.firebaseapp.com",
    projectId: "kcs-system-180db",
    storageBucket: "kcs-system-180db.firebasestorage.app",
    appId: "1:57579884453:web:62c4f94cc5b4fe60a9624c"
};

export const appCloud = initializeApp(FIREBASE_CONFIG);

export const dbCloud = initializeFirestore(appCloud, {
  localCache: memoryLocalCache()
});

export const storageCloud = getStorage(appCloud);
export const functionsCloud = getFunctions(appCloud, "us-central1");

export { onSnapshot, serverTimestamp };

// ==========================================
// OPERAÇÕES DIRETAS (FIRESTORE-FIRST)
// ==========================================
export async function setDocInCloud(collectionName, docId, data) {
    await setDoc(doc(dbCloud, collectionName, docId), data);
}

export async function deleteDocFromCloud(collectionName, docId) {
    await deleteDoc(doc(dbCloud, collectionName, docId));
}

export async function fetchAllFromCloud(collectionName, companyId) {
    if (!companyId) throw new Error("Company ID não encontrado na sessão.");
    const q = query(collection(dbCloud, collectionName), where("companyId", "==", companyId));
    const snap = await getDocs(q);
    const results = [];
    snap.forEach(d => results.push(d.data()));
    return results;
}

export async function uploadImageToCloud(blob, articleId = 'drafts') {
    try {
        const randomId = Math.random().toString(36).substring(2, 10);
        const imageName = `${Date.now()}_${randomId}.webp`;
        const imagePath = `procedimentos/${articleId}/steps/${imageName}`;
        const imageRef = ref(storageCloud, imagePath);
        
        await uploadBytes(imageRef, blob);
        const publicUrl = await getDownloadURL(imageRef);
        return publicUrl;
    } catch (e) {
        console.error("Erro ao enviar imagem:", e);
        throw e;
    }
}

// ==========================================
// VALIDAÇÃO DE PLANO SAAS
// ==========================================
export async function checkTenantUserLimit(companyId) {
    if (!companyId || companyId === 'LIMBO_TENANT') return { allowed: true };

    try {
        let tenantRef = doc(dbCloud, "tenants", companyId);
        let tenantSnap = await getDoc(tenantRef);
        
        if (!tenantSnap.exists()) {
            tenantRef = doc(dbCloud, "companies", companyId);
            tenantSnap = await getDoc(tenantRef);
        }

        if (!tenantSnap.exists()) {
            return { allowed: false, message: "Empresa vinculada não encontrada no banco de dados." };
        }

        const tenantData = tenantSnap.data();
        const maxUsers = tenantData.maxUsers || PLANS.STARTER.maxUsers; 

        const usersRef = collection(dbCloud, "users");
        const q = query(usersRef, where("companyId", "==", companyId));
        
        const snapshot = await getCountFromServer(q);
        const currentUserCount = snapshot.data().count;

       if (currentUserCount >= maxUsers) {
            // UX Writing: Celebra o crescimento em vez de soar como uma punição
            return { allowed: false, message: `A equipe KCS está crescendo! O limite de ${maxUsers} colaboradores do pacote atual foi atingido.` };
        }

        return { allowed: true };
    } catch (error) {
        console.error("Erro ao validar limite de usuários:", error);
        return { allowed: false, message: 'Erro de comunicação ao validar o plano da empresa.' };
    }
}

// ==========================================
// TRIGGER DA CLOUD FUNCTION DE BACKUP
// ==========================================
export async function triggerCloudBackup() {
    try {
        const backupFunction = httpsCallable(functionsCloud, 'backupFirestore');
        const result = await backupFunction();
        return result.data;
    } catch (error) {
        console.error("Falha ao invocar a Cloud Function de backup:", error);
        throw new Error(error.message || "Erro desconhecido ao chamar o servidor.");
    }
}



// ==========================================
// PAGINAÇÃO ENTERPRISE (PROCEDIMENTOS)
// ==========================================
export async function fetchPaginatedArticles(companyId, pageSize = 10, cursorDoc = null, direction = 'next', statusFilter = 'all') {
    if (!companyId) throw new Error("Company ID não encontrado.");
    
    const articlesRef = collection(dbCloud, "articles");
    let queryConstraints = [where("companyId", "==", companyId)];

    if (statusFilter !== 'all') {
        queryConstraints.push(where("status", "==", statusFilter));
    }

    queryConstraints.push(orderBy("updatedAt", "desc"));

    if (cursorDoc) {
        if (direction === 'next') {
            queryConstraints.push(startAfter(cursorDoc));
            queryConstraints.push(limit(pageSize));
        } else if (direction === 'prev') {
            queryConstraints.push(endBefore(cursorDoc));
            queryConstraints.push(limitToLast(pageSize));
        }
    } else {
        queryConstraints.push(limit(pageSize)); // Primeira página
    }

    const q = query(articlesRef, ...queryConstraints);
    const snap = await getDocs(q);
    
    const results = [];
    snap.forEach(d => results.push({ id: d.id, ...d.data(), _docRef: d }));
    
    return {
        articles: results,
        firstDoc: snap.docs.length > 0 ? snap.docs[0] : null,
        lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
        hasResults: !snap.empty
    };
}