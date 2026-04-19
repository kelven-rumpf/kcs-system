/**
 * services/dashboard.js — Consultas de Governança KCS no Firestore
 */
import { dbCloud } from './cloud.js'; // Importa a conexão do mesmo diretório

export async function getTopAnalysts() {
    try {
        const { collection, query, where, orderBy, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
        
        const q = query(
            collection(dbCloud, 'users'),
            where('role', 'in', ['analyst', 'admin', 'super_admin']),
            orderBy('articlesApproved', 'desc'), 
            limit(5)
        );
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.warn("Aviso (Analistas):", error.message);
        return []; // Retorna vazio em caso de erro (ex: falta de índice) para ativar o fallback do render.js
    }
}

export async function getTopCollaborators() {
    try {
        const { collection, query, where, orderBy, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');
        
        const q = query(
            collection(dbCloud, 'users'),
            where('role', '==', 'user'),
            orderBy('draftsSubmitted', 'desc'), 
            limit(5)
        );
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.warn("Aviso (Colaboradores):", error.message);
        return []; // Retorna vazio em caso de erro para ativar o fallback do render.js
    }
}