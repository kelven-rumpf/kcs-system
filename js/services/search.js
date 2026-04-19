/**
 * search.js — Serviço de busca instantânea (Cloud-First e Governança)
 */

let cachedArticles = null;
let cacheTimestamp = null;

const CACHE_TTL = 60 * 1000; // 1 minuto

async function getCachedArticles() {
  const now = Date.now();

  if (
      !cachedArticles || 
      !cacheTimestamp ||
      (now - cacheTimestamp) > CACHE_TTL
  ) {
      cachedArticles = await listArticles();
      cacheTimestamp = now;
  }

  return cachedArticles;
}

import { listArticles } from './kcsCore.js';
import { listSqlScripts } from './sqlLibrary.js';
import { getCurrentUser, hasPermission } from '../auth.js';
import { CONFIG, ARTICLE_STATUS } from '../config.js';

let debounceTimer = null;
const DEBOUNCE_DELAY = 300;

// OTIMIZAÇÃO ADICIONAL: Função para normalizar strings (remove acentos e capitalização)
export function normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export async function optimizeQueryWithAI(query) {
    if (!CONFIG || !CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === 'SUA_CHAVE_AQUI') return query;
    if (query.length < 5) return query;

    try {
        const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
        const response = await fetch(URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Traduza a busca informal do utilizador para um termo técnico curto de TI/PDV (ex: 'onde vejo nota' vira 'Consulta NF-e', 'pc não liga' vira 'Falha Hardware'). Retorne APENAS o termo técnico limpo, sem aspas ou explicações. Busca: "${query}"` }] }]
            })
        });
        const data = await response.json();
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            return data.candidates[0].content.parts[0].text.trim();
        }
    } catch(e) { console.error("Erro no filtro semântico:", e); }
    return query; 
}

// OTIMIZAÇÃO: Busca em memória agora usa a normalização (NFD) para ignorar acentos
function performMemorySearch(items, queryStr) {
    if (!queryStr) return items;
    const lowerQuery = normalizeText(queryStr);
    const terms = lowerQuery.split(/\s+/).filter(Boolean);
    
    return items.filter(item => {
        const searchable = [
            item.title, item.symptom, item.cause, item.solution, item.steps, 
            item.tags?.join(' '), item.articleNumber, item.name, item.description, item.code
        ].filter(Boolean).join(' ');
        
        const normalizedSearchable = normalizeText(searchable);
        return terms.every(term => normalizedSearchable.includes(term));
    });
}

// Função utilitária para mapear e padronizar os itens retornados (Truncamento e URL)
function formatSearchResult(item) {
    const rawContent = item.steps || item.solution || item.cause || '';
    return {
        ...item,
        id: item.articleNumber || item.id,
        content: rawContent.length > 1000 ? rawContent.substring(0, 1000) + '...' : (rawContent || 'Procedimento não detalhado.'),
        url: item.url || null
    };
}

export function instantSearch(query, callback) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(async () => {
    try {
      const optimizedQuery = await optimizeQueryWithAI(query);
      const allArticles = await getCachedArticles(); 
      
      let results = performMemorySearch(allArticles, optimizedQuery);
      
      // Fallback para a query original se a IA não achar nada
      if (results.length === 0 && optimizedQuery !== query) {
          results = performMemorySearch(allArticles, query);
      }

      // REGRA DE GOVERNANÇA: Usuário final só vê o que está PUBLICADO (approved)
      if (!hasPermission('edit_article')) {
        results = results.filter((a) => a.status === ARTICLE_STATUS.APPROVED);
      }

      const lowerQuery = normalizeText(optimizedQuery);
      if (lowerQuery) {
        results.sort((a, b) => {
          const aTitle = normalizeText(a.title).includes(lowerQuery) ? 0 : 1;
          const bTitle = normalizeText(b.title).includes(lowerQuery) ? 0 : 1;
          if (aTitle !== bTitle) return aTitle - bTitle;
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        });
      } else {
        results.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      }

      // OBRIGATÓRIO: Retornar com payload padronizado, truncado e contendo URL
      results = results.map(formatSearchResult);

      callback(results, null);
    } catch (error) {
      console.error('[Search] Erro na busca:', error);
      callback([], error);
    }
  }, DEBOUNCE_DELAY);
}

export async function searchDirect(query, skipAI = false) {
  try {
    const optimizedQuery = skipAI 
        ? query 
        : await optimizeQueryWithAI(query);

    const allArticles = await listArticles();

    let results = performMemorySearch(
        allArticles, 
        optimizedQuery
    );

    if (results.length === 0 && optimizedQuery !== query) {
        results = performMemorySearch(allArticles, query);
    }

    if (!hasPermission('edit_article')) {
      results = results.filter(
        (a) => a.status === ARTICLE_STATUS.APPROVED
      );
    }

    results.sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );

    // OBRIGATÓRIO: Retornar com payload padronizado, truncado e contendo URL
    return results.map(formatSearchResult);

  } catch (error) {
    console.error('[Search] Erro na busca direta:', error);
    throw error;
  }
}

export async function searchSqlScripts(query, skipAI = false) {
  try {
    const scripts = await listSqlScripts();

    if (!query || !query.trim()) return scripts;

    const optimizedQuery = skipAI
        ? query
        : await optimizeQueryWithAI(query);

    return performMemorySearch(
        scripts,
        optimizedQuery
    );

  } catch (error) {
    console.error('[Search] Erro na busca de scripts SQL:', error);
    return [];
  }
}

export function filterByStatus(articles, status) {
  if (!status || status === 'all') return articles;
  return articles.filter((a) => a.status === status);
}

export function filterByCategory(articles, categoryId) {
  if (!categoryId || categoryId === 'all') return articles;
  return articles.filter((a) => a.categoryId === categoryId || a.category === categoryId);
}

export function filterByTag(articles, tag) {
  if (!tag) return articles;
  const lowerTag = normalizeText(tag);
  return articles.filter((a) => (a.tags || []).some((t) => normalizeText(t) === lowerTag));
}

export function applyFilters(articles, filters = {}) {
  let result = [...articles];
  if (filters.status) result = filterByStatus(result, filters.status);
  if (filters.category) result = filterByCategory(result, filters.category);
  if (filters.tag) result = filterByTag(result, filters.tag);
  return result;
}