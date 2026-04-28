/**
 * featureAccess.js
 * Controle centralizado de funcionalidades habilitadas por setor.
 *
 * Regra:
 * - super_admin sempre pode tudo.
 * - ausência de configuração = tudo liberado para evitar regressão.
 * - feature flag complementa role/permission, não substitui.
 */

import {
    collection,
    doc,
    getDocs,
    query,
    where,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

import { dbCloud, safeSetDoc } from './cloud.js';
import { COLLECTION_SECTOR_FEATURES } from '../config.js';
import { getCurrentUser } from '../auth.js';

export const FEATURE_FLAGS = Object.freeze({
    SQL_LIBRARY: 'sqlLibrary',
    SQL_CREATE: 'sqlCreate',
    CHATBOT: 'chatbot',
    AI_REFINE: 'aiRefine',
    OCR: 'ocr',
    SQL_MENTION: 'sqlMention',
    PROC_MENTION: 'procMention',
    DASHBOARD: 'dashboard'
});

export const FEATURE_CATALOG = Object.freeze([
    {
        key: FEATURE_FLAGS.SQL_LIBRARY,
        label: 'Ver Biblioteca SQL',
        description: 'Permite acessar a seção Biblioteca SQL e visualizar scripts.',
        icon: 'ph-database'
    },
    {
        key: FEATURE_FLAGS.SQL_CREATE,
        label: 'Criar Código SQL',
        description: 'Permite cadastrar, editar e gerenciar scripts SQL.',
        icon: 'ph-file-sql'
    },
    {
        key: FEATURE_FLAGS.CHATBOT,
        label: 'Usar Assistente',
        description: 'Permite abrir e utilizar o assistente/chatbot do sistema.',
        icon: 'ph-robot'
    },
    {
        key: FEATURE_FLAGS.AI_REFINE,
        label: 'Usar Refinar com IA',
        description: 'Permite usar o botão Refinar no formulário de procedimentos.',
        icon: 'ph-magic-wand'
    },
    {
        key: FEATURE_FLAGS.OCR,
        label: 'Usar OCR',
        description: 'Permite extrair texto de imagens no editor.',
        icon: 'ph-scan'
    },
    {
        key: FEATURE_FLAGS.SQL_MENTION,
        label: 'Usar @SQL',
        description: 'Permite mencionar scripts SQL dentro de procedimentos.',
        icon: 'ph-at'
    },
    {
        key: FEATURE_FLAGS.PROC_MENTION,
        label: 'Usar @Procedimento',
        description: 'Permite mencionar outros procedimentos dentro do editor.',
        icon: 'ph-link'
    },
    {
        key: FEATURE_FLAGS.DASHBOARD,
        label: 'Ver Dashboard',
        description: 'Permite acessar indicadores e visão executiva.',
        icon: 'ph-chart-bar'
    }
]);

let featureMatrixCache = {};
let featureAccessReady = false;

function normalizeSectorId(value) {
    return String(value || '').trim();
}

function getUserSectorId(user = getCurrentUser()) {
    return normalizeSectorId(
        user?.sectorId ||
        user?.sector_id ||
        user?.sector ||
        sessionStorage.getItem('kcs_sector_id')
    );
}

function getUserCompanyId(user = getCurrentUser()) {
    return String(user?.companyId || sessionStorage.getItem('kcs_company_id') || '').trim();
}

function buildDefaultFeatures() {
    return FEATURE_CATALOG.reduce((acc, feature) => {
        acc[feature.key] = true;
        return acc;
    }, {});
}

function mergeWithDefaults(features = {}) {
    return {
        ...buildDefaultFeatures(),
        ...(features || {})
    };
}

function buildDocId(companyId, sectorId) {
    return `${companyId}_${sectorId}`;
}

export function getFeatureCatalog() {
    return FEATURE_CATALOG;
}

export async function initFeatureAccess(user = getCurrentUser()) {
    const companyId = getUserCompanyId(user);

    featureMatrixCache = {};
    featureAccessReady = false;

    if (!companyId) {
        console.warn('[featureAccess] companyId ausente. Usando fallback permissivo.');
        featureAccessReady = true;
        return {};
    }

    try {
        const q = query(
            collection(dbCloud, COLLECTION_SECTOR_FEATURES),
            where('companyId', '==', companyId)
        );

        const snap = await getDocs(q);

        snap.forEach(documentSnapshot => {
            const data = documentSnapshot.data();
            const sectorId = normalizeSectorId(data.sectorId);

            if (!sectorId) return;

            featureMatrixCache[sectorId] = mergeWithDefaults(data.features || {});
        });

        featureAccessReady = true;
        return featureMatrixCache;

    } catch (error) {
        console.error('[featureAccess] Falha ao carregar feature flags:', error);
        featureAccessReady = true;
        return {};
    }
}

export function isFeatureAccessReady() {
    return featureAccessReady;
}

export function canUseFeature(featureKey, user = getCurrentUser()) {
    if (!featureKey) return false;

    if (user?.role === 'super_admin') return true;

    const sectorId = getUserSectorId(user);

    if (!sectorId) return true;

    const sectorFeatures = featureMatrixCache[sectorId];

    if (!sectorFeatures) {
        return true;
    }

    return sectorFeatures[featureKey] !== false;
}

export function getCachedSectorFeatures(sectorId) {
    const normalizedSectorId = normalizeSectorId(sectorId);
    return mergeWithDefaults(featureMatrixCache[normalizedSectorId] || {});
}

export async function getSectorFeatureMatrix(companyId, sectors = []) {
    if (!companyId) {
        const fallback = {};
        sectors.forEach(sector => {
            fallback[sector.id] = buildDefaultFeatures();
        });
        return fallback;
    }

    if (!featureAccessReady) {
        await initFeatureAccess({ companyId });
    }

    const matrix = {};

    sectors.forEach(sector => {
        matrix[sector.id] = mergeWithDefaults(featureMatrixCache[sector.id] || {});
    });

    return matrix;
}

export async function updateSectorFeature(companyId, sectorId, featureKey, enabled) {
    if (!companyId) throw new Error('Empresa não encontrada para salvar funcionalidades.');
    if (!sectorId) throw new Error('Setor inválido.');
    if (!featureKey) throw new Error('Funcionalidade inválida.');

    const currentUser = getCurrentUser();

    if (!currentUser || !['super_admin', 'admin'].includes(currentUser.role)) {
        throw new Error('Sem permissão para alterar funcionalidades por setor.');
    }

    const currentFeatures = getCachedSectorFeatures(sectorId);

    const nextFeatures = {
        ...currentFeatures,
        [featureKey]: Boolean(enabled)
    };

    const payload = {
        id: buildDocId(companyId, sectorId),
        companyId,
        sectorId,
        features: nextFeatures,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.id || currentUser.uid || null,
        updatedByName: currentUser.name || currentUser.email || 'Administrador'
    };

    await safeSetDoc(
        doc(dbCloud, COLLECTION_SECTOR_FEATURES, payload.id),
        payload,
        { merge: true }
    );

    featureMatrixCache[sectorId] = mergeWithDefaults(nextFeatures);

    window.dispatchEvent(new CustomEvent('kcs-feature-access-updated', {
        detail: { companyId, sectorId, featureKey, enabled }
    }));

    return payload;
}

export function clearFeatureAccessCache() {
    featureMatrixCache = {};
    featureAccessReady = false;
}