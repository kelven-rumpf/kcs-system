/**
 * services/dashboard.js — Consultas de Governança KCS no Firestore
 * Versão sem índice composto obrigatório: busca usuários e ordena no client.
 */

import { dbCloud } from './cloud.js';

async function getUsersSafely() {
    try {
        const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js');

        const snap = await getDocs(collection(dbCloud, 'users'));
        return snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.warn('[Dashboard] Não foi possível carregar usuários:', error.message);
        return [];
    }
}

export async function getTopAnalysts() {
    const users = await getUsersSafely();

    return users
        .filter(user => ['analyst', 'admin', 'super_admin'].includes(user.role))
        .sort((a, b) => (b.articlesApproved || 0) - (a.articlesApproved || 0))
        .slice(0, 5);
}

export async function getTopCollaborators() {
    const users = await getUsersSafely();

    return users
        .filter(user => user.role === 'user' || user.draftsSubmitted > 0)
        .sort((a, b) => (b.draftsSubmitted || 0) - (a.draftsSubmitted || 0))
        .slice(0, 5);
}