// js/services/visibility.js

import { ROLES, VISIBILITY } from '../config.js';

// ======================
// Helpers de Role
// ======================

export function isSuperAdmin(user) {
  return user?.role === ROLES.SUPER_ADMIN;
}

export function isAdminLike(user) {
  return [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(user?.role);
}

// ======================
// Escopo do usuário
// ======================

export function getUserVisibilityScope(user) {
  return {
    companyId: user?.companyId || null,
    sectorId: user?.sectorId || null,
    groupIds: user?.group_ids || [],
    role: user?.role || null
  };
}

// ======================
// Normalização
// ======================

export function normalizeGroupIds(entity) {
  if (!entity) return [];

  if (Array.isArray(entity.group_ids)) return entity.group_ids;

  if (entity.group_id) return [entity.group_id];

  return [];
}

// ======================
// Regras base
// ======================

export function hasSameCompany(user, entity) {
  return user?.companyId && entity?.companyId && user.companyId === entity.companyId;
}

export function hasSectorAccess(user, entity) {
  if (!user || !entity) return false;

  if (isSuperAdmin(user)) return true;

  const userSector = user.sectorId || user.sector_id || user.sector || null;
  const entitySector = entity.sectorId || entity.sector_id || entity.sector || null;

  // Compatibilidade com dados antigos
  if (!entitySector) return true;

  if (!userSector) return false;

  return String(userSector).trim().toLowerCase() === String(entitySector).trim().toLowerCase();
}

export function hasGroupAccess(user, entity) {
  if (!user || !entity) return false;

  if (isSuperAdmin(user)) return true;

  const entityGroups = normalizeGroupIds(entity);

  // Compatibilidade com artigos antigos sem grupo
  if (!entityGroups.length) return true;

  const userGroups = user.group_ids || user.groupIds || [];

  // Se o usuário ainda não tem grupo definido, não bloquear nesta fase
  // para evitar sumir com todos os artigos durante a migração.
  if (!userGroups.length) return true;

  return entityGroups.some(groupId => userGroups.includes(groupId));
}

export function isOwner(user, entity) {
  return user?.id && entity?.created_by === user.id;
}

// ======================
// VISUALIZAÇÃO DE ARTIGO
// ======================

export function canViewArticle(user, article) {
    if (!user || !article) return false;

    if (isSuperAdmin(user)) return true;

    if (!hasSameCompany(user, article)) return false;

    if (isOwner(user, article)) return true;

    const status = String(article.status || '').trim().toLowerCase();
    const visibility = String(article.visibility || 'public').trim().toLowerCase();

    const isPublished =
        status === 'approved' ||
        status === 'publicado' ||
        status === 'published';

    const isPrivate =
        visibility === 'private' ||
        visibility === 'privado';

    const sameSector = hasSectorAccess(user, article);
    const sameGroup = hasGroupAccess(user, article);

    // Público aprovado: qualquer usuário da mesma empresa vê
    if (!isPrivate && isPublished) {
        return true;
    }

    // Privado aprovado: qualquer usuário do mesmo setor/grupo vê
    if (isPrivate && isPublished) {
        return sameSector && sameGroup;
    }

    // Não aprovado: autor já passou acima.
    // Analista/Admin só veem fila/rascunho do próprio escopo.
    if ([ROLES.ADMIN, ROLES.ANALYST].includes(user.role)) {
        return sameSector && sameGroup;
    }

    // Usuário comum não vê pendente/draft de outras pessoas
    return false;
}

// ======================
// EDIÇÃO
// ======================

export function canEditArticle(user, article) {
  if (!user || !article) return false;

  // super_admin edita tudo
  if (isSuperAdmin(user)) return true;

  // todos os outros precisam estar na mesma empresa
  if (!hasSameCompany(user, article)) return false;

  // dono edita o próprio procedimento
  if (isOwner(user, article)) return true;

  // admin/analyst editam apenas dentro do setor/grupo
  if ([ROLES.ADMIN, ROLES.ANALYST].includes(user.role)) {
    return hasSectorAccess(user, article) && hasGroupAccess(user, article);
  }

  return false;
}

// ======================
// APROVAÇÃO
// ======================

export function canApproveArticle(user, article) {
  if (!user || !article) return false;

  // super_admin aprova tudo
  if (isSuperAdmin(user)) return true;

  // todos os outros precisam estar na mesma empresa
  if (!hasSameCompany(user, article)) return false;

  // apenas admin e analyst aprovam
  if (![ROLES.ADMIN, ROLES.ANALYST].includes(user.role)) return false;

  // admin e analyst aprovam apenas dentro do próprio setor/grupo
  return hasSectorAccess(user, article) && hasGroupAccess(user, article);
}

// ======================
// FILTRO DE LISTAGEM
// ======================

export function filterArticlesByUserScope(articles, user) {
  if (!Array.isArray(articles)) return [];

  return articles.filter(article => canViewArticle(user, article));
}

// ======================
// SQL LIBRARY
// ======================

export function canViewSqlScript(user, script) {
  if (!user || !script) return false;

  if (isSuperAdmin(user)) return true;

  if (!hasSameCompany(user, script)) return false;

  if (script.visibility === VISIBILITY.PRIVATE) {
    return isOwner(user, script) || isAdminLike(user);
  }

  return hasSectorAccess(user, script) && hasGroupAccess(user, script);
}

export function canEditSqlScript(user, script) {
  return canEditArticle(user, script);
}

export function filterSqlScriptsByUserScope(scripts, user) {
  if (!Array.isArray(scripts)) return [];

  return scripts.filter(script => canViewSqlScript(user, script));
}