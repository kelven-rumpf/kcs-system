/**
 * mentionPanel.js - Gerencia o painel lateral de detalhes de SQL
 */

import { getSqlScript } from '../services/sqlLibrary.js';
import { getArticle } from '../services/kcsCore.js';
import { showToast } from './render.js';

let panelInstance = null;
let currentSqlId = null;
let currentMentionType = null;
let currentMentionId = null;

function createPanel() {
    if (panelInstance) return panelInstance;

    const panel = document.createElement('div');
    panel.id = 'sql-detail-panel';
    panel.className = 'sql-detail-panel';
    panel.innerHTML = `
        <div class="sql-panel-header">
            <h3 id="mention-panel-title">
                <i class="ph-bold ph-database text-blue-500"></i> Detalhes da Menção
            </h3>
            <button class="sql-panel-close-btn" id="sql-panel-close-btn">
                <i class="ph-bold ph-x"></i>
            </button>
        </div>

        <div class="sql-panel-content custom-scrollbar">
            <div class="sql-panel-section">
                <div class="sql-panel-section-title">Nome</div>
                <p id="panel-sql-name"></p>
            </div>

            <div class="sql-panel-section">
                <div class="sql-panel-section-title">Descrição</div>
                <p id="panel-sql-description"></p>
            </div>

            <div class="sql-panel-section" id="panel-category-section">
                <div class="sql-panel-section-title">Categoria</div>
                <p id="panel-sql-category"></p>
            </div>

            <div class="sql-panel-section" id="panel-code-section">
                <div class="sql-panel-section-title">Código SQL</div>
                <div class="sql-panel-code-header">
                    <span class="sql-panel-code-title">
                        <i class="ph-fill ph-file-code"></i> Script
                    </span>
                    <button class="btn-copy-code" id="btn-copy-sql-code" title="Copiar Código SQL">
                        <i class="ph-bold ph-copy-simple"></i>
                    </button>
                </div>
                <div class="sql-panel-code-container">
                    <pre><code id="panel-sql-code" class="language-sql"></code></pre>
                </div>
            </div>

            <div class="sql-panel-section hidden" id="panel-proc-section">
                <div class="sql-panel-section-title">Resumo do Procedimento</div>
                <div id="panel-proc-preview" class="text-sm leading-relaxed"></div>

                <button type="button" id="btn-open-procedure-mention" class="btn-primary mt-4 w-full">
                    <i class="ph-bold ph-book-open"></i> Abrir Procedimento
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    panel.querySelector('#sql-panel-close-btn').addEventListener('click', closePanel);

    panel.querySelector('#btn-copy-sql-code').addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const copyButton = e.currentTarget;
        const originalIcon = copyButton.innerHTML;

        try {
            const codeElement = panel.querySelector('#panel-sql-code');
            const code = codeElement.textContent || '';

            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(code);
            } else {
                copyToClipboardFallback(code);
            }

            showToast('Código copiado!', 'success');
            copyButton.innerHTML = '<i class="ph-bold ph-check"></i>';
            copyButton.setAttribute('title', 'Copiado!');

            setTimeout(() => {
                copyButton.innerHTML = originalIcon;
                copyButton.setAttribute('title', 'Copiar Código SQL');
            }, 2000);

        } catch (err) {
            console.error('[MENTION PANEL] Erro ao copiar:', err);
            showToast('Falha ao copiar o código.', 'error');
        }
    });

    function copyToClipboardFallback(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        const success = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (!success) {
            throw new Error('execCommand copy failed');
        }
    }

    document.addEventListener('mousedown', (event) => {
        const isMentionChip =
            event.target.closest('.sql-mention-chip') ||
            event.target.closest('.proc-mention-chip') ||
            event.target.closest('.kcs-mention-chip');

        if (
            panelInstance &&
            panelInstance.classList.contains('active') &&
            !panelInstance.contains(event.target) &&
            !isMentionChip
        ) {
            closePanel();
        }
    });

    panelInstance = panel;
    return panel;
}

export async function openPanel(sqlId) {
    return openSqlPanel(sqlId);
}

export async function openSqlPanel(sqlId) {
    const panel = createPanel();

    currentSqlId = sqlId;
    currentMentionType = 'sql';
    currentMentionId = sqlId;

    panel.classList.add('active');
    document.body.classList.add('sql-panel-open');

    panel.querySelector('#mention-panel-title').innerHTML =
        '<i class="ph-bold ph-database text-blue-500"></i> Detalhes do SQL';

    panel.querySelector('#panel-category-section').classList.remove('hidden');
    panel.querySelector('#panel-code-section').classList.remove('hidden');
    panel.querySelector('#panel-proc-section').classList.add('hidden');

    try {
        const sqlScript = await getSqlScript(sqlId);

        if (!sqlScript) {
            showToast('SQL não encontrado.', 'error');
            closePanel();
            return;
        }

        panel.querySelector('#panel-sql-name').textContent = sqlScript.name || 'N/A';
        panel.querySelector('#panel-sql-description').textContent = sqlScript.description || 'Nenhuma descrição fornecida.';
        panel.querySelector('#panel-sql-category').textContent = sqlScript.sqlCategory || 'N/A';

        const codeElement = panel.querySelector('#panel-sql-code');
        const sqlCode = sqlScript.code || '-- Código SQL não disponível';
        codeElement.textContent = sqlCode;

    } catch (error) {
        console.error('[MENTION PANEL] Erro ao carregar SQL:', error);
        showToast('Erro ao carregar detalhes do SQL.', 'error');
        closePanel();
    }
}

export async function openProcedurePanel(articleId) {
    const panel = createPanel();

    currentSqlId = null;
    currentMentionType = 'procedure';
    currentMentionId = articleId;

    panel.classList.add('active');
    document.body.classList.add('sql-panel-open');

    panel.querySelector('#mention-panel-title').innerHTML =
        '<i class="ph-bold ph-book-open text-emerald-500"></i> Detalhes do Procedimento';

    panel.querySelector('#panel-category-section').classList.remove('hidden');
    panel.querySelector('#panel-code-section').classList.add('hidden');
    panel.querySelector('#panel-proc-section').classList.remove('hidden');

    try {
        const article = await getArticle(articleId);

        if (!article) {
            showToast('Procedimento não encontrado.', 'error');
            closePanel();
            return;
        }

        panel.querySelector('#panel-sql-name').textContent = article.title || 'N/A';
        panel.querySelector('#panel-sql-description').textContent = article.symptom || article.solution || 'Nenhuma descrição fornecida.';
        panel.querySelector('#panel-sql-category').textContent = article.categoryId || article.category || 'N/A';

        const preview = [
            article.symptom ? `<p><strong>Sintoma:</strong> ${escapeHtml(article.symptom)}</p>` : '',
            article.cause ? `<p><strong>Causa:</strong> ${escapeHtml(article.cause)}</p>` : '',
            article.solution ? `<p><strong>Solução:</strong> ${escapeHtml(article.solution)}</p>` : ''
        ].filter(Boolean).join('');

        panel.querySelector('#panel-proc-preview').innerHTML =
            preview || '<p>Sem resumo estruturado disponível.</p>';

        const btnOpen = panel.querySelector('#btn-open-procedure-mention');
        btnOpen.onclick = () => {
            closePanel();

            if (window.__kcs?.viewArticle) {
                window.__kcs.viewArticle(article.id);
            } else {
                showToast('Não foi possível abrir o procedimento.', 'error');
            }
        };

    } catch (error) {
        console.error('[MENTION PANEL] Erro ao carregar procedimento:', error);
        showToast('Erro ao carregar procedimento mencionado.', 'error');
        closePanel();
    }
}

export function setupMentionClickBehavior(root = document) {
    if (!root || root._kcsMentionClickReady) return;

    root.addEventListener('click', (event) => {
        const sqlChip = event.target.closest('.sql-mention-chip');
        const procChip = event.target.closest('.proc-mention-chip');

        if (sqlChip?.dataset?.sqlId) {
            event.preventDefault();
            event.stopPropagation();
            openSqlPanel(sqlChip.dataset.sqlId);
            return;
        }

        if (procChip?.dataset?.articleId) {
            event.preventDefault();
            event.stopPropagation();
            openProcedurePanel(procChip.dataset.articleId);
            return;
        }
    }, true);

    root._kcsMentionClickReady = true;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function closePanel() {
    if (panelInstance) {
        panelInstance.classList.remove('active');
        document.body.classList.remove('sql-panel-open');

        currentSqlId = null;
        currentMentionType = null;
        currentMentionId = null;
    }
}

export function isPanelOpen() {
    return panelInstance && panelInstance.classList.contains('active');
}

export function getCurrentPanelSqlId() {
    return currentSqlId;
}

