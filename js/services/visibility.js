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

export function normalizeVisibility(value) {
  return String(value || 'public').trim().toLowerCase();
}

export function canUserAccessKnowledge(user, knowledge) {
  if (!user || !knowledge) return false;

  if (isSuperAdmin(user)) return true;

  if (!hasSameCompany(user, knowledge)) return false;

  const visibility = normalizeVisibility(knowledge.visibility);
  if (visibility === VISIBILITY.PUBLIC) return true;

  const sameSector = hasSectorAccess(user, knowledge);
  const sameGroup = hasGroupAccess(user, knowledge);
  return sameSector && sameGroup;
}

export function buildKnowledgeAccessFilter(user) {
  return (knowledge) => canUserAccessKnowledge(user, knowledge);
}

export function filterKnowledgeByAccess(items, user) {
  if (!Array.isArray(items)) return [];
  const matcher = buildKnowledgeAccessFilter(user);
  return items.filter(matcher);
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

    const normalizeSector = (value) => {
        if (!value) return null;

        const normalized = String(value)
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/_/g, ' ');

        const aliases = {
            'ti': 'tecnologia da informacao',
            'tecnologia': 'tecnologia da informacao',
            'tecnologia da informacao': 'tecnologia da informacao'
        };

        return aliases[normalized] || normalized;
    };

    const userSector = normalizeSector(user.sectorId || user.sector_id || user.sector);
    const entitySector = normalizeSector(entity.sectorId || entity.sector_id || entity.sector);

    // Conteúdo sem setor só é legado.
    // Para private, não deve abrir para qualquer setor.
    if (!entitySector) {
        return false;
    }

    if (!userSector) {
        return false;
    }

    return userSector === entitySector;
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
    const sameScope = sameSector && sameGroup;

    // Público aprovado: qualquer usuário da mesma empresa vê
    if (!isPrivate && isPublished) {
        return true;
    }

    // Privado aprovado: somente mesmo setor/grupo
    if (isPrivate && isPublished) {
        return sameScope;
    }

    // Rascunho / revisão:
    // Autor só vê se ainda estiver no mesmo setor/grupo
    if (isOwner(user, article)) {
        return sameScope;
    }

    // Analista/Admin só veem pendentes/rascunhos do próprio escopo
    if ([ROLES.ADMIN, ROLES.ANALYST].includes(user.role)) {
        return sameScope;
    }

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

    if (isSuperAdmin(user)) return true;

    if (!hasSameCompany(user, article)) return false;

    if (![ROLES.ADMIN, ROLES.ANALYST].includes(user.role)) return false;

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
