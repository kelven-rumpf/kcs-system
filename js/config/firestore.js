const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '']);

/**
 * 🔧 PONTO DE TROCA DE AMBIENTE (DEV/PROD)
 *
 * Defina no seu ambiente de execução:
 *   VITE_FIREBASE_ENV=dev   -> usa dados DEV
 *   VITE_FIREBASE_ENV=prod  -> usa dados PROD
 *
 * Exemplos:
 *   .env.local: VITE_FIREBASE_ENV=dev
 *   .env.local: VITE_FIREBASE_ENV=prod
 */
const rawEnv = (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_FIREBASE_ENV)
    || (typeof window !== 'undefined' ? window?.VITE_FIREBASE_ENV : 'prod')
    || 'prod';

// Qualquer valor diferente de 'prod' cai para 'dev' por segurança.
const normalizedEnv = String(rawEnv).trim().toLowerCase() === 'prod' ? 'prod' : 'dev';

export const FIREBASE_ENV = normalizedEnv;
export const IS_LOCAL = LOCAL_HOSTNAMES.has(window.location.hostname);
export const IS_PROD_DATA = FIREBASE_ENV === 'prod';
// Segurança: local + dados PROD = SOMENTE LEITURA (bloqueio de escrita).
export const READ_ONLY_PROD_FROM_LOCAL = IS_LOCAL && IS_PROD_DATA;

/**
 * Mapeamento central das collections por ambiente.
 * Ao alterar VITE_FIREBASE_ENV, os nomes abaixo são alternados automaticamente.
 */
export const FIRESTORE_COLLECTIONS = Object.freeze({
    articles: Object.freeze({ dev: 'kcs_dev_articles', prod: 'kcs_prod_articles' }),
    sqlScripts: Object.freeze({ dev: 'kcs_dev_sqlScripts', prod: 'kcs_prod_sqlScripts' }),
    chatLogs: Object.freeze({ dev: 'chat_logs', prod: 'kcs_chat_logs' }),
    sectorFeatures: Object.freeze({ dev: 'kcs_dev_sectorFeatures', prod: 'kcs_prod_sectorFeatures' })
});

export function getCollectionName(key) {
    const mapping = FIRESTORE_COLLECTIONS[key];
    if (!mapping) {
        throw new Error(`[FirestoreConfig] Collection key inválida: ${key}`);
    }
    return mapping[FIREBASE_ENV];
}

export const COLLECTION_ARTICLES = getCollectionName('articles');
export const COLLECTION_SQL = getCollectionName('sqlScripts');
export const COLLECTION_CHAT_LOGS = getCollectionName('chatLogs');
export const COLLECTION_SECTOR_FEATURES = getCollectionName('sectorFeatures');

export function getEnvironmentInfo() {
    return {
        FIREBASE_ENV,
        IS_LOCAL,
        IS_PROD_DATA,
        READ_ONLY_PROD_FROM_LOCAL,
        modeLabel: READ_ONLY_PROD_FROM_LOCAL ? 'READ-ONLY' : 'NORMAL'
    };
}

if (READ_ONLY_PROD_FROM_LOCAL) {
    console.warn('⚠️ Você está usando dados de PRODUÇÃO em ambiente local (somente leitura).');
}
