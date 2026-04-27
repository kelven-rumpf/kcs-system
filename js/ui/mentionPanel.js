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
        const sqlCode = sqlScript.code || '// Código SQL não disponível';

        codeElement.textContent = formatSqlForDisplay(sqlCode);
        highlightSqlSyntax(codeElement);

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

// Enhanced SQL syntax highlighting for SQL Server
function highlightSqlSyntax(codeElement) {
    const text = codeElement.textContent;
    let highlightedText = text;

    // SQL Server Keywords (common ones, case-insensitive match)
    const keywords = [
        'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
        'DELETE', 'TRUNCATE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'ON',
        'GROUP BY', 'ORDER BY', 'HAVING', 'TOP', 'DISTINCT', 'COUNT', 'SUM', 'AVG',
        'MIN', 'MAX', 'AS', 'CREATE', 'TABLE', 'ALTER', 'ADD', 'DROP', 'INDEX',
        'VIEW', 'DATABASE', 'USE', 'EXEC', 'DECLARE', 'BEGIN', 'END', 'CASE',
        'WHEN', 'THEN', 'ELSE', 'GO', 'NOLOCK', 'WITH', 'AS', 'BEGIN TRANSACTION',
        'COMMIT TRANSACTION', 'ROLLBACK TRANSACTION', 'PRIMARY KEY', 'FOREIGN KEY',
        'CONSTRAINT', 'DEFAULT', 'NULL', 'NOT NULL', 'IDENTITY', 'EXISTS', 'NOT EXISTS',
        'UNION', 'UNION ALL', 'EXCEPT', 'INTERSECT', 'MERGE', 'OUTPUT', 'PIVOT', 'UNPIVOT',
        'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'OVER', 'PARTITION BY', 'IS',
        'COALESCE', 'IIF', 'CHOOSE', 'CAST', 'CONVERT', 'GETDATE', 'SYSDATETIME', 'DATEADD', 'DATEDIFF',
        'DATEPART', 'DATENAME', 'FORMAT', 'LIKE', 'IN', 'BETWEEN', 'AND', 'OR', 'NOT',
        'OPENROWSET', 'OPENQUERY', 'OPENDATASOURCE', 'DBCC', 'WAITFOR', 'PRINT', 'RAISERROR'
    ];
    const operators = [
        '=', '!=', '<', '>', '<=', '>=', '<>', 'LIKE', 'IN', 'NOT IN', 'IS NULL',
        'IS NOT NULL', '+', '-', '*', '/', '%', '&', '|', '^', '~', '!',
        '||', 'AND', 'OR'
    ]; // AND/OR added to operators for distinct color if not matched as keyword
    const functions = [
        'AVG', 'COUNT', 'MAX', 'MIN', 'SUM', 'CONCAT', 'SUBSTRING', 'LEN', 'GETDATE',
        'DATEADD', 'DATEDIFF', 'DATEPART', 'DATENAME', 'CAST', 'CONVERT', 'COALESCE',
        'IIF', 'CHOOSE', 'FORMAT', 'REPLACE', 'UPPER', 'LOWER', 'LTRIM', 'RTRIM',
        'TRIM', 'ROUND', 'FLOOR', 'CEILING', 'ABS', 'ISNULL', 'DB_NAME', 'SUSER_SNAME',
        'SCHEMA_NAME', 'OBJECT_NAME', 'COL_NAME', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE'
    ];

    // Regular expressions for different tokens
    const patterns = [
        { regex: /(--.*?)(?=\n|$)/g, class: 'sql-comment' }, // Single-line comments
        { regex: /(\/\*[\s\S]*?\*\/)/g, class: 'sql-comment' }, // Multi-line comments
        { regex: /(\'.*?\')/g, class: 'sql-string' }, // Strings
        { regex: /\b\d+(\.\d+)?\b/g, class: 'sql-number' }, // Numbers
        { regex: /@[a-zA-Z_][a-zA-Z0-9_]*/g, class: 'sql-variable' }, // Variables (e.g., @variable)
    ];

    // Apply patterns first to protect their content from keyword matching
    patterns.forEach(p => {
        highlightedText = highlightedText.replace(p.regex, (match) => {
            return `<span class="${p.class}">${match}</span>`;
        });
    });

    // Apply keywords (case-insensitive, ensuring whole word match and not inside already highlighted spans)
    keywords.forEach(kw => {
        // Use a negative lookbehind/lookahead to prevent matching inside other spans
        const keywordRegex = new RegExp(`(?<!<span[^>]*>)\\b(${escapeRegExp(kw)})\\b(?!<\/span>)`, 'gi');
        highlightedText = highlightedText.replace(keywordRegex, '<span class="sql-keyword">$&</span>');
    });

    // Apply functions
    functions.forEach(func => {
        const functionRegex = new RegExp(`(?<!<span[^>]*>)\\b(${escapeRegExp(func)})\\b(?=\\()`, 'gi');
        highlightedText = highlightedText.replace(functionRegex, '<span class="sql-function">$&</span>');
    });

    // Apply operators
    operators.forEach(op => {
        // Only highlight if not already part of a keyword or other highlighted span
        const operatorRegex = new RegExp(`(?<!<span[^>]*>)(?<![a-zA-Z0-9_])(${escapeRegExp(op)})(?![a-zA-Z0-9_])(?!<\/span>)`, 'g');
        highlightedText = highlightedText.replace(operatorRegex, '<span class="sql-operator">$&</span>');
    });

    codeElement.innerHTML = highlightedText;
}

// Helper to format SQL code for display (e.g., uppercase keywords)
function formatSqlForDisplay(sqlCode) {
    // Preserve original indentation and line breaks
    // Optionally, convert keywords to uppercase for better readability, but not the entire code.
    const keywordsToUppercase = [
        'select', 'from', 'where', 'and', 'or', 'insert', 'into', 'values', 'update', 'set',
        'delete', 'truncate', 'join', 'left join', 'right join', 'inner join', 'on',
        'group by', 'order by', 'having', 'top', 'distinct', 'count', 'sum', 'avg',
        'min', 'max', 'as', 'create', 'table', 'alter', 'add', 'drop', 'index',
        'view', 'database', 'use', 'exec', 'declare', 'begin', 'end', 'case',
        'when', 'then', 'else', 'go', 'nolock', 'with', 'begin transaction',
        'commit transaction', 'rollback transaction', 'primary key', 'foreign key',
        'constraint', 'default', 'null', 'not null', 'identity', 'exists', 'not exists',
        'union', 'union all', 'except', 'intersect', 'merge', 'output', 'pivot', 'unpivot',
        'row_number', 'rank', 'dense_rank', 'ntile', 'over', 'partition by', 'is',
        'coalesce', 'iif', 'choose', 'cast', 'convert', 'getdate', 'sysdatetime', 'dateadd', 'datediff',
        'datepart', 'datename', 'format', 'like', 'in', 'between', 'not',
        'openrowset', 'openquery', 'opendatasource', 'dbcc', 'waitfor', 'print', 'raiserror'
    ];

    let formattedCode = sqlCode;
    keywordsToUppercase.forEach(kw => {
        // Use regex to find whole words and convert only them to uppercase
        // Ensure it doesn't affect strings or comments already
        formattedCode = formattedCode.replace(new RegExp(`\\b${kw}\\b`, 'gi'), (match) => match.toUpperCase());
    });

    return formattedCode;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

