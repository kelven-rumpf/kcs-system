/**
 * config.js — Configurações globais do sistema KCS e Controle de Ambiente
 */

export const CONFIG = {
  GEMINI_API_KEY: "AIzaSyB9cqCAXOaCzaVUKfPc49r-mhVzehCZYQw", 
};

export const INACTIVITY_TIMEOUT = 10 * 60 * 1000;

// NOVO: PLANOS SAAS COMERCIAIS
export const PLANS = Object.freeze({
    STARTER: { name: 'Starter', maxUsers: 5, features: { ai: false, logs: false } },
    PROFESSIONAL: { name: 'Professional', maxUsers: 20, features: { ai: true, logs: true } },
    ENTERPRISE: { name: 'Enterprise', maxUsers: 999, features: { ai: true, logs: true } }
});

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  ANALYST: 'analyst',
  USER: 'user',
});

export const PERMISSIONS = Object.freeze({
  [ROLES.SUPER_ADMIN]: [
    'create_article', 'edit_article', 'delete_article', 'validate_article',
    'manage_users', 'manage_companies', 'sync_file', 'read_article', 'search', 'manage_categories', 'manage_sql', 'manage_backups'
  ],
  [ROLES.ADMIN]: [
    'create_article', 'edit_article', 'delete_article', 'validate_article',
    'manage_users', 'sync_file', 'read_article', 'search', 'manage_categories', 'manage_sql',
  ],
  [ROLES.ANALYST]: [
    'create_article', 'edit_article', 'delete_article', 'validate_article',
    'read_article', 'search', 'manage_sql',
  ],
  [ROLES.USER]: [
    'read_article', 'search',
  ],
});

export const ARTICLE_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING: 'pendente_revisao', 
  APPROVED: 'approved',        
  OBSOLETE: 'obsolete',
});

export const STATUS_TRANSITIONS = Object.freeze({
  [ARTICLE_STATUS.DRAFT]: [ARTICLE_STATUS.PENDING],
  [ARTICLE_STATUS.PENDING]: [ARTICLE_STATUS.DRAFT, ARTICLE_STATUS.APPROVED],
  [ARTICLE_STATUS.APPROVED]: [ARTICLE_STATUS.PENDING, ARTICLE_STATUS.OBSOLETE],
  [ARTICLE_STATUS.OBSOLETE]: [ARTICLE_STATUS.DRAFT],
});

export const STATUS_LABELS = Object.freeze({
  [ARTICLE_STATUS.DRAFT]: 'Rascunho',
  [ARTICLE_STATUS.PENDING]: 'Em Revisão',
  [ARTICLE_STATUS.APPROVED]: 'Publicado',
  [ARTICLE_STATUS.OBSOLETE]: 'Obsoleto',
});

export const STATUS_COLORS = Object.freeze({
  [ARTICLE_STATUS.DRAFT]: 'bg-gray-600 text-gray-300',
  [ARTICLE_STATUS.PENDING]: 'bg-yellow-600 text-yellow-100',
  [ARTICLE_STATUS.APPROVED]: 'bg-green-600 text-green-100',
  [ARTICLE_STATUS.OBSOLETE]: 'bg-red-600 text-red-100',
});

export const DEFAULT_CATEGORY_TREE = [
  { id: 'cat-tecnologia', name: 'Tecnologia', icon: 'ph-desktop', children: [ { id: 'cat-infra', name: 'Infraestrutura', icon: 'ph-hard-drives', children: [] }, { id: 'cat-software', name: 'Software', icon: 'ph-code', children: [] } ] },
  { id: 'cat-pdv', name: 'PDV', icon: 'ph-storefront', children: [ { id: 'cat-pdv-config', name: 'Configuração', icon: 'ph-gear', children: [] }, { id: 'cat-pdv-erros', name: 'Erros Comuns', icon: 'ph-warning', children: [] } ] }
];

export const SQL_DB_TYPES = Object.freeze([
  { value: 'mysql', label: 'MySQL', color: 'bg-blue-600/30 text-blue-300' },
  { value: 'postgres', label: 'PostgreSQL', color: 'bg-indigo-600/30 text-indigo-300' },
  { value: 'sqlserver', label: 'SQL Server', color: 'bg-red-600/30 text-red-300' },
  { value: 'oracle', label: 'Oracle DB', color: 'bg-orange-600/30 text-orange-300' }
]);

export const SESSION_KEY = 'kcs_session';
export const CATEGORIES_STORAGE_KEY = 'kcs_categories';

export const TENANT_KEYS = Object.freeze({
  USER_ID: 'kcs_user_id',
  COMPANY_ID: 'kcs_company_id',
  COMPANY_NAME: 'kcs_company_name',
  BOT_NAME: 'kcs_bot_name',
  SECTOR_ID: 'kcs_sector_id'
});

export const VISIBILITY = Object.freeze({
    PUBLIC: 'public',
    PRIVATE: 'private'
});

export const SECTORS = Object.freeze([
    { id: 'TI', name: 'Tecnologia da Informação' },
    { id: 'RH', name: 'Recursos Humanos' },
    { id: 'FIN', name: 'Financeiro' },
    { id: 'COM', name: 'Comercial' },
    { id: 'OPE', name: 'Operações' }
]);

export const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '';
const ENV_PREFIX = isDev ? 'kcs_dev' : 'kcs_prod';

export const COLLECTION_ARTICLES = `${ENV_PREFIX}_articles`;
export const COLLECTION_SQL = `${ENV_PREFIX}_sqlScripts`;

console.log(`[Config] Ambiente Inicializado: ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'} (Prefixo: ${ENV_PREFIX})`);
