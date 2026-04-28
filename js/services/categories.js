/**
 * categories.js — Gerenciamento de categorias hierárquicas (árvore)
 * CRUD completo com subcategorias ilimitadas, persistido no localStorage.
 */

import { DEFAULT_CATEGORY_TREE, CATEGORIES_STORAGE_KEY, TENANT_KEYS } from '../config.js';

/** Cache em memória da árvore de categorias */
let categoryTree = [];
let loadedScopeKey = null;

function cloneDefaultTree() {
  return JSON.parse(JSON.stringify(DEFAULT_CATEGORY_TREE));
}

function getCurrentScopeKey() {
  const companyId = sessionStorage.getItem(TENANT_KEYS.COMPANY_ID) || 'GLOBAL';
  const sectorId = sessionStorage.getItem(TENANT_KEYS.SECTOR_ID) || 'GLOBAL';
  return `${companyId}::${sectorId}`;
}

function parseStoredCategories() {
  const stored = localStorage.getItem(CATEGORIES_STORAGE_KEY);
  if (!stored) return {};

  const parsed = JSON.parse(stored);

  // Migração retrocompatível: versões antigas salvavam apenas um array global.
  if (Array.isArray(parsed)) {
    return { LEGACY_GLOBAL: parsed };
  }

  return parsed && typeof parsed === 'object' ? parsed : {};
}

function saveScopedTree(scopeKey, tree) {
  const allScopedCategories = parseStoredCategories();
  allScopedCategories[scopeKey] = tree;
  localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(allScopedCategories));
}

function ensureScopeLoaded() {
  const scopeKey = getCurrentScopeKey();
  if (scopeKey === loadedScopeKey) return;

  const allScopedCategories = parseStoredCategories();

  if (Array.isArray(allScopedCategories[scopeKey])) {
    categoryTree = allScopedCategories[scopeKey];
  } else if (Array.isArray(allScopedCategories.LEGACY_GLOBAL)) {
    categoryTree = allScopedCategories.LEGACY_GLOBAL;
    saveScopedTree(scopeKey, categoryTree);
    delete allScopedCategories.LEGACY_GLOBAL;
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(allScopedCategories));
  } else {
    categoryTree = cloneDefaultTree();
    saveScopedTree(scopeKey, categoryTree);
  }

  loadedScopeKey = scopeKey;
}

/**
 * Inicializa a árvore de categorias a partir do localStorage ou padrão.
 */
export function initCategories() {
  try {
    ensureScopeLoaded();
    console.log('[Categories] Árvore de categorias carregada.');
  } catch (error) {
    console.error('[Categories] Erro ao carregar categorias:', error);
    categoryTree = cloneDefaultTree();
    loadedScopeKey = getCurrentScopeKey();
    saveCategories();
  }
}

/**
 * Persiste a árvore de categorias no localStorage.
 */
function saveCategories() {
  try {
    ensureScopeLoaded();
    saveScopedTree(loadedScopeKey, categoryTree);
  } catch (error) {
    console.error('[Categories] Erro ao salvar categorias:', error);
  }
}

/**
 * Retorna a árvore completa de categorias.
 * @returns {Array}
 */
export function getCategoryTree() {
  ensureScopeLoaded();
  return categoryTree;
}

/**
 * Retorna uma lista flat de todas as categorias (id, name, path).
 * @returns {Array<{id: string, name: string, path: string, depth: number}>}
 */
export function getFlatCategories() {
  ensureScopeLoaded();
  const result = [];
  function walk(nodes, parentPath = '', depth = 0) {
    for (const node of nodes) {
      const path = parentPath ? `${parentPath} > ${node.name}` : node.name;
      result.push({ id: node.id, name: node.name, path, depth, icon: node.icon || '' });
      if (node.children && node.children.length > 0) {
        walk(node.children, path, depth + 1);
      }
    }
  }
  walk(categoryTree);
  return result;
}

/**
 * Busca uma categoria pelo ID em toda a árvore.
 * @param {string} id
 * @returns {object|null}
 */
export function findCategoryById(id) {
  ensureScopeLoaded();
  function search(nodes) {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = search(node.children);
        if (found) return found;
      }
    }
    return null;
  }
  return search(categoryTree);
}

/**
 * Retorna o caminho completo (breadcrumb) de uma categoria.
 * @param {string} id
 * @returns {string}
 */
export function getCategoryPath(id) {
  const flat = getFlatCategories();
  const cat = flat.find((c) => c.id === id);
  return cat ? cat.path : '';
}

/**
 * Retorna o nome de uma categoria pelo ID.
 * @param {string} id
 * @returns {string}
 */
export function getCategoryName(id) {
  const cat = findCategoryById(id);
  return cat ? cat.name : id || 'Sem categoria';
}

/**
 * Adiciona uma nova categoria.
 * @param {string} parentId — ID do pai (null para raiz)
 * @param {string} name — Nome da categoria
 * @param {string} icon — Ícone (emoji)
 * @returns {{success: boolean, message: string, id?: string}}
 */
export function addCategory(parentId, name, icon = '📁') {
  if (!name || !name.trim()) {
    return { success: false, message: 'O nome da categoria é obrigatório.' };
  }

  const id = 'cat-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const newCat = { id, name: name.trim(), icon, children: [] };

  if (!parentId) {
    categoryTree.push(newCat);
  } else {
    const parent = findCategoryById(parentId);
    if (!parent) {
      return { success: false, message: 'Categoria pai não encontrada.' };
    }
    if (!parent.children) parent.children = [];
    parent.children.push(newCat);
  }

  saveCategories();
  return { success: true, message: `Categoria "${name}" criada com sucesso.`, id };
}

/**
 * Atualiza uma categoria existente.
 * @param {string} id
 * @param {object} updates — { name?, icon? }
 * @returns {{success: boolean, message: string}}
 */
export function updateCategory(id, updates) {
  const cat = findCategoryById(id);
  if (!cat) {
    return { success: false, message: 'Categoria não encontrada.' };
  }

  if (updates.name) cat.name = updates.name.trim();
  if (updates.icon !== undefined) cat.icon = updates.icon;

  saveCategories();
  return { success: true, message: 'Categoria atualizada com sucesso.' };
}

/**
 * Remove uma categoria e todas as suas subcategorias.
 * @param {string} id
 * @returns {{success: boolean, message: string}}
 */
export function removeCategory(id) {
  function removeFromArray(nodes) {
    const index = nodes.findIndex((n) => n.id === id);
    if (index !== -1) {
      nodes.splice(index, 1);
      return true;
    }
    for (const node of nodes) {
      if (node.children && removeFromArray(node.children)) return true;
    }
    return false;
  }

  const removed = removeFromArray(categoryTree);
  if (!removed) {
    return { success: false, message: 'Categoria não encontrada.' };
  }

  saveCategories();
  return { success: true, message: 'Categoria removida com sucesso.' };
}

/**
 * Retorna todos os IDs de uma categoria e suas subcategorias (para filtro).
 * @param {string} id
 * @returns {Array<string>}
 */
export function getCategoryAndChildrenIds(id) {
  ensureScopeLoaded();
  const ids = [];
  const cat = findCategoryById(id);
  if (!cat) return ids;

  function collect(node) {
    ids.push(node.id);
    if (node.children) {
      node.children.forEach(collect);
    }
  }
  collect(cat);
  return ids;
}

/**
 * Reseta as categorias para o padrão.
 */
export function resetCategoriesToDefault() {
  ensureScopeLoaded();
  categoryTree = cloneDefaultTree();
  saveCategories();
}
