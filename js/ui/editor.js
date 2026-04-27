/**
 * editor.js — Motor de Rich Text, IA e Renderização Visual
 * Correções visuais do Chatbot: Rodapé 'Assistente' (borda transparente) e Painel (tema dark). (v1.0.1, UTF-8)
 */

import { canUseFeature, FEATURE_FLAGS } from '../services/featureAccess.js';
import { showToast, showLoading } from './render.js';
import { uploadImageToCloud } from '../services/cloud.js';
import { 
    reescreverTextoTecnico, 
    corrigirGramaticaApenas, 
    setArticleLock, 
    releaseArticleLock, 
    forceReleaseLock,
    listArticles,
    extrairTextoImagemGemini
} from '../services/kcsCore.js';
import { getCurrentUser } from '../auth.js';
import { listSqlScripts } from '../services/sqlLibrary.js'; // Import SQL service
import { openPanel, openProcedurePanel, closePanel, setupMentionClickBehavior } from './mentionPanel.js';

function setupImagePreviewBehavior(editorElement) {
    if (!editorElement || editorElement._kcsImagePreviewReady) return;

    let activeOverlay = null;

    function closePreview() {
        if (!activeOverlay) return;

        document.removeEventListener('keydown', handleEsc);
        activeOverlay.remove();
        activeOverlay = null;
    }

    function handleEsc(event) {
        if (event.key === 'Escape') closePreview();
    }

    function openPreview(img) {
        closePreview();

        activeOverlay = document.createElement('div');
        activeOverlay.className = 'kcs-image-preview-overlay';
        activeOverlay.innerHTML = `
            <div class="kcs-image-preview-shell">
                <button type="button" class="kcs-image-preview-close" aria-label="Fechar imagem">
                    <i class="ph-bold ph-x"></i>
                </button>
                <img src="${img.src}" alt="${img.alt || 'Imagem do procedimento'}" class="kcs-image-preview-img">
            </div>
        `;

        activeOverlay.addEventListener('click', (event) => {
            if (
                event.target === activeOverlay ||
                event.target.closest('.kcs-image-preview-close')
            ) {
                closePreview();
            }
        });

        document.addEventListener('keydown', handleEsc);
        document.body.appendChild(activeOverlay);
    }

    editorElement.addEventListener('click', (event) => {
        const img = event.target.closest('img');

        if (!img || !editorElement.contains(img)) return;

        event.preventDefault();
        event.stopPropagation();

        openPreview(img);
    });

    editorElement._kcsImagePreviewReady = true;
}


export function initEditor(editorId = 'article-body') {
    const editor = document.getElementById(editorId);
    if (!editor) {
        console.error(`Editor element with ID '${editorId}' not found. Mention system will not be active.`);
        return;
    }

    // Make editor contenteditable
    editor.setAttribute('contenteditable', 'true');
    editor.classList.add('editor-content'); // Apply base editor styles
    setupImagePreviewBehavior(editor);
        const form = editor.closest('form');
    const idUnico = editorId.startsWith('article-body-') ? editorId.slice('article-body-'.length) : '';
    const btnSave = form ? form.querySelector('button[type="submit"]') : null;
    const toolbar = editor.previousElementSibling;

    // 1. BLINDAGEM VISUAL INICIAL
    if (form) {
        form.classList.add('u-disabled');
        form.style.opacity = '0';
        form.style.transition = 'opacity 0.2s ease-in-out';
    }

    // CAPTURA DO ID DO PROCEDIMENTO (Adaptado para procurar no formulário atual)
    let articleId = null;
        const idInput = form ? (form.querySelector('input[name="id"]') || form.querySelector('input[name="articleId"]')) : null;

    if (idInput && idInput.value) {
        articleId = idInput.value;
    } else {
        const hiddenInputs = Array.from((form || document).querySelectorAll('input[type="hidden"]'));
        const possibleId = hiddenInputs.find(i => i.value && (i.value.startsWith('kcs_') || i.value.length > 15));
        if (possibleId) articleId = possibleId.value;
    }
        
    // TRAVA DE CONCORRÊNCIA (TRANSAÇÃO ATÔMICA)
    if (articleId && articleId !== 'drafts') {
        setArticleLock(articleId).then(result => {
            if (result.status === 'LOCKED') {
                showToast(`🔒 Documento bloqueado por ${result.lockedBy}`, 'error');

                // Exibe bloqueio via classe semântica
                editor.innerHTML = `
                    <div class="editor-lock-screen">
                        <i class="ph-fill ph-lock-key lock-icon-large"></i>
                        <p class="lock-title">Procedimento em Edição</p>
                        <p class="lock-message">Este documento está sendo alterado no momento por <strong>${result.lockedBy}</strong>.</p>
                    </div>`;

                if (form) {
                    form.querySelectorAll('input, textarea, select').forEach(el => {
                        if (el.type !== 'hidden') {
                            el.value = '';
                            el.readOnly = true;
                            el.disabled = true;
                        }
                    });
                    form.style.opacity = '1';
                }

                if (btnSave) {
                    btnSave.disabled = true;
                    btnSave.innerText = "Bloqueado";
                    btnSave.classList.add('u-disabled');
                }
                if (toolbar) toolbar.style.display = 'none';

                const currentUser = getCurrentUser();
                if (currentUser && currentUser.role === 'super_admin') {
                    const adminTool = document.createElement('div');
                    adminTool.className = 'mt-6 flex justify-center w-full';
                    adminTool.innerHTML = `
                        <button type="button" class="btn-danger">
                            <i class="ph-bold ph-warning"></i> Forçar Liberação (Admin)
                        </button>
                    `;

                    adminTool.querySelector('button').onclick = async () => {
                        if(confirm(`ATENÇÃO: Você irá ejetar ${result.lockedBy}. Confirma?`)) {
                            await forceReleaseLock(articleId);
                            showToast('Trava removida. Recarregue o procedimento.', 'success');
                        }
            };
                    editor.appendChild(adminTool);
}

            } else if (result.status === 'SUCCESS') {
                if (form) {
                    form.classList.remove('u-disabled');
                    form.style.opacity = '1';
                }

                const unlockFn = () => releaseArticleLock(articleId);
                const btnCancel = form ? form.querySelector('.btn-cancel-tab') : document.querySelector('[data-modal-close]');

                if (btnCancel && !btnCancel._lockListener) {
                    btnCancel.addEventListener('click', unlockFn);
                    btnCancel._lockListener = true;
                }
                window.addEventListener('beforeunload', unlockFn);
            }
        });

        // ESCUTA REAL-TIME DE EJEÇÃO
        const reactToRealTimeLock = (e) => {
            if (e.detail.articleId === articleId) {
                showToast(`⚠️ Sessão ejetada por ${e.detail.lockedByName}.`, 'error');
                if (btnSave) {
                    btnSave.disabled = true;
                    btnSave.classList.add('u-disabled');
                    btnSave.innerText = "Sessão Ejetada";
                }
                editor.setAttribute('contenteditable', 'false');
                editor.classList.add('u-disabled');
                if (toolbar) toolbar.style.display = 'none';
            }
        };

        if (window._kcsActiveLockListener) {
            document.removeEventListener('kcs-article-lock-active', window._kcsActiveLockListener);
        }
        window._kcsActiveLockListener = reactToRealTimeLock;
        document.addEventListener('kcs-article-lock-active', reactToRealTimeLock);

    } else {
        if (form) {
            form.classList.remove('u-disabled');
            form.style.opacity = '1';
        }
    }

    // INTERCEPTADOR DE SUBMIT PARA UPLOADS PENDENTES
    if (form && !form._imageInterceptorAdded) {
        form.addEventListener('submit', (e) => {
            if (editor.querySelector('img[data-uploading="true"]')) {
                e.preventDefault();
                showToast('Aguarde o upload das imagens.', 'warning');
            }
        }, true);
        form._imageInterceptorAdded = true;
    }

    // INICIALIZAÇÃO DA TOOLBAR (Isolada)
    if (toolbar) {
        // MODIFICADO: querySelectorAll restrito apenas à barra de ferramentas deste editor
        const toolbarBtns = toolbar.querySelectorAll('[data-format]');
        toolbarBtns.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (editor.getAttribute('contenteditable') === 'false') return;
                const format = newBtn.getAttribute('data-format');
                if (format === 'ocr' && !canUseFeature(FEATURE_FLAGS.OCR)) {
    newBtn.style.display = 'none';
    return;
}
            if (format === 'image') {
    handleImageUpload(editor);
} else if (format === 'ocr') {
    if (!canUseFeature(FEATURE_FLAGS.OCR)) {
        showToast('OCR indisponível para o seu setor.', 'warning');
        return;
    }

    handleOcrImageSelect(editor);
} else {
    insertFormatting(format, editor);
}
            });
        });
    }

    // IA: REESCREVER TEXTO TÉCNICO (Isolado)
    // MODIFICADO: Procura o botão apenas dentro deste formulário
    const btnReescrever = form ? form.querySelector('.btn-ia-reescrever') : null;

if (btnReescrever && !canUseFeature(FEATURE_FLAGS.AI_REFINE)) {
    btnReescrever.style.display = 'none';
}

if (btnReescrever && canUseFeature(FEATURE_FLAGS.AI_REFINE)) {
        const newBtnR = btnReescrever.cloneNode(true);
        btnReescrever.parentNode.replaceChild(newBtnR, btnReescrever);

        newBtnR.addEventListener('click', async () => {
            if (editor.getAttribute('contenteditable') === 'false') return;
            const currentEditor = document.getElementById(editorId);
            if (!currentEditor) return;

            const { cleanedText, mentions } = extractMentionsAndReplaceWithPlaceholders(currentEditor);

            if (cleanedText.length < 10) return showToast('Despeje o relato no Passo a Passo.', 'warning');

            const fullContext = `RASCUNHO:\n${cleanedText}\n\nREGRA: Mantenha __IMAGEM_X__.`;
            const originalHtml = newBtnR.innerHTML;
            newBtnR.innerHTML = `<i class="ph ph-spinner spinner-icon"></i> Processando...`;
            newBtnR.classList.add('u-disabled');

    try {
                const result = await reescreverTextoTecnico(fullContext);
                if (!result || typeof result !== 'object') {
                    throw new Error('A resposta da IA não retornou os campos esperados.');
                }

                const titleInput = document.getElementById(`article-title-${idUnico}`);
                const symptomInput = document.getElementById(`article-symptom-${idUnico}`);
                const environmentInput = document.getElementById(`article-environment-${idUnico}`);
                const causeInput = document.getElementById(`article-cause-${idUnico}`);
                const solutionInput = document.getElementById(`article-solution-${idUnico}`);
                const tagsInput = document.getElementById(`article-tags-${idUnico}`);

                if (titleInput) titleInput.value = result.titulo || '';
                if (symptomInput) symptomInput.value = result.sintoma || '';
                if (environmentInput) environmentInput.value = result.ambiente || '';
                if (causeInput) causeInput.value = result.causa || '';
                if (solutionInput) solutionInput.value = result.solucao || '';
                if (tagsInput && result.tags && Array.isArray(result.tags)) {
                    tagsInput.value = result.tags.join(', ');
                }

                let finalSteps = String(result.passos || '');
                finalSteps = finalSteps.replace(/\n/g, '<br><br>');

                // Restore images and mentions
                finalSteps = restorePlaceholders(finalSteps, currentEditor, mentions);

                currentEditor.innerHTML = finalSteps;
                showToast('IA finalizou o preenchimento!', 'success');
            } catch(e) {
                console.error('[Refinar] Falha ao aplicar resposta da IA:', e);
                showToast('Erro na IA. Veja o console para detalhes.', 'error');
    } finally {
                newBtnR.innerHTML = originalHtml;
                newBtnR.classList.remove('u-disabled');
    }
        });
}

    // EVENTOS DE DRAG, DROP E PASTE
    editor.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (editor.getAttribute('contenteditable') !== 'false') editor.classList.add('editor-drag-active');
    });
    editor.addEventListener('dragleave', () => editor.classList.remove('editor-drag-active'));
    editor.addEventListener('drop', async (e) => {
        e.preventDefault();
        editor.classList.remove('editor-drag-active');
        if (editor.getAttribute('contenteditable') === 'false') return;
        if (e.dataTransfer.files?.length > 0) await processImageFile(e.dataTransfer.files[0], editor);
    });

    editor.addEventListener('paste', async (e) => {
        if (editor.getAttribute('contenteditable') === 'false') return;
        const items = (e.clipboardData || window.clipboardData).items;
        let hasImage = false;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = items[i].getAsFile();
                if (file) await processImageFile(file, editor); // OCR is run inside processImageFile
                hasImage = true;
                break;
}
        }
        if (!hasImage) {
            // Allow normal paste for text, but prevent mention trigger
            // The mention logic below will handle manual typing, not pasted text
        }
    });

    // MENTION SYSTEM LOGIC
    let mentionDropdown = null;
    let mentionQuery = '';
    let mentionStartIndex = -1;
    let availableSqls = [];
    let availableProcedures = [];
    let availableMentions = [];
    let selectedMentionIndex = -1;

    // Function to get the current cursor position
    function getCaretCoordinates() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return { x: 0, y: 0 };

        const range = selection.getRangeAt(0).cloneRange();
        range.collapse(true);
        const rect = range.getClientRects()[0];

        if (rect) {
            return {
                x: rect.left + window.scrollX,
                y: rect.top + window.scrollY,
                height: rect.height
            };
        }
        return { x: 0, y: 0, height: 0 };
    }

    // Modified to return the fetched scripts
async function fetchMentionSources() {
    try {
        const canMentionSql = canUseFeature(FEATURE_FLAGS.SQL_MENTION);
        const canMentionProc = canUseFeature(FEATURE_FLAGS.PROC_MENTION);

        const [sqls, procedures] = await Promise.all([
            canMentionSql ? listSqlScripts() : Promise.resolve([]),
            canMentionProc ? listArticles(true) : Promise.resolve([])
        ]);

        availableSqls = (sqls || []).map(sql => ({
            ...sql,
            mentionType: 'sql',
            mentionId: sql.id,
            mentionName: sql.name,
            mentionDescription: sql.description || 'Script SQL'
        }));

        availableProcedures = (procedures || [])
            .filter(article => {
                const status = article.status || article.workflowStatus || '';
                return status === 'approved' || status === 'published' || status === 'validated' || !status;
            })
            .map(article => ({
                ...article,
                mentionType: 'proc',
                mentionId: article.id,
                mentionName: article.title,
                mentionDescription: article.articleNumber
                    ? `#KCS-${article.articleNumber} · Procedimento`
                    : 'Procedimento'
            }));

        availableMentions = [
            ...availableSqls,
            ...availableProcedures
        ];

    } catch (error) {
        console.error('[MENTION DEBUG] Error fetching mention sources:', error);
        showToast('Erro ao carregar menções.', 'error');
    }
}

function showMentionDropdown(items, coords) {
    if (!mentionDropdown) {
        mentionDropdown = document.createElement('div');
        mentionDropdown.className = 'mention-dropdown';
        document.body.appendChild(mentionDropdown);
    }

    mentionDropdown.innerHTML = '';

    if (items.length === 0) {
        mentionDropdown.innerHTML = '<div class="mention-empty">Nenhuma menção encontrada.</div>';
    } else {
        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'mention-item';
            div.dataset.mentionType = item.mentionType;
            div.dataset.mentionId = item.mentionId;

            if (index === selectedMentionIndex) {
                div.classList.add('selected');
            }

            const icon = item.mentionType === 'proc'
                ? 'ph-book-open'
                : 'ph-database';

            const label = item.mentionType === 'proc'
                ? 'Procedimento'
                : 'SQL';

            div.innerHTML = `
                <div class="mention-item-name">
                    <i class="ph-bold ${icon}"></i>
                    ${item.mentionName}
                    <span class="mention-type-badge">${label}</span>
                </div>
                <div class="mention-item-description">
                    ${item.mentionDescription || 'Sem descrição'}
                </div>
            `;

            div.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                selectMentionItem(item);
            });

            mentionDropdown.appendChild(div);
        });
    }

    mentionDropdown.style.left = `${coords.x}px`;
    mentionDropdown.style.top = `${coords.y + coords.height}px`;
    mentionDropdown.style.display = 'block';

    const rect = mentionDropdown.getBoundingClientRect();

    if (rect.right > window.innerWidth) {
        mentionDropdown.style.left = `${window.innerWidth - rect.width - 10}px`;
    }

    if (rect.bottom > window.innerHeight) {
        mentionDropdown.style.top = `${coords.y - rect.height}px`;
    }
}

    function hideMentionDropdown() {
        if (mentionDropdown) {
            console.log('[MENTION DEBUG] Hiding dropdown.');
            mentionDropdown.style.display = 'none';
            selectedMentionIndex = -1;
        }
    }

    // Shared function for selecting mention - used by both Enter key and Click event
 function selectMentionItem(item) {
    if (!item || !item.mentionId || !item.mentionName || !item.mentionType) {
        console.error('[MENTION DEBUG] Invalid mention object:', item);
        showToast('Erro: menção inválida.', 'error');
        return;
    }

    editor.focus();
    selectMention(item);
}

function selectMention(item) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let textNode = range.startContainer;

    if (textNode.nodeType !== Node.TEXT_NODE) {
        if (textNode.lastChild && textNode.lastChild.nodeType === Node.TEXT_NODE) {
            textNode = textNode.lastChild;

            if (range.startContainer !== textNode) {
                range.setStart(textNode, textNode.length);
                range.collapse(true);
            }
        } else {
            hideMentionDropdown();
            return;
        }
    }

    const textBeforeCaret = textNode.textContent.substring(0, range.startOffset);
    const match = textBeforeCaret.match(/(?:^|\s|\n)(@)([a-zA-Z0-9_\-]*)$/);

    if (!match) {
        hideMentionDropdown();
        return;
    }

    const actualMentionQuery = match[2];
    const actualMentionStartIndex = range.startOffset - actualMentionQuery.length - 1;

    range.setStart(textNode, actualMentionStartIndex);
    range.deleteContents();

    const mentionChip = document.createElement('span');
    mentionChip.contentEditable = 'false';

    if (item.mentionType === 'proc') {
        mentionChip.className = 'proc-mention-chip';
        mentionChip.dataset.procId = item.mentionId;
        mentionChip.dataset.procName = item.mentionName;
        mentionChip.innerHTML = `@${item.mentionName} <i class="ph-bold ph-book-open" style="font-size:1em;"></i>`;
    } else {
        mentionChip.className = 'sql-mention-chip';
        mentionChip.dataset.sqlId = item.mentionId;
        mentionChip.dataset.sqlName = item.mentionName;
        mentionChip.innerHTML = `@${item.mentionName} <i class="ph-bold ph-database" style="font-size:1em;"></i>`;
    }

    range.insertNode(mentionChip);
    range.setStartAfter(mentionChip);
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);

    insertHtmlAtCursor('&nbsp;', editor);

    hideMentionDropdown();
    mentionQuery = '';
    mentionStartIndex = -1;
}

    editor.addEventListener('input', async (e) => {
        console.log('[MENTION DEBUG] Input event fired.');
        if (window._kcsOcrActive) { hideMentionDropdown(); return; } // Ignore input during OCR
        if (editor.getAttribute('contenteditable') === 'false') return;
        const selection = window.getSelection();
        if (selection.rangeCount === 0) { hideMentionDropdown(); return; }

        const range = selection.getRangeAt(0);
        const textNode = range.startContainer;
        console.log('[MENTION DEBUG] textNode:', textNode, 'parentNode:', textNode.parentNode);
        // Ensure we are in a text node and not inside a mention chip
        if (textNode.nodeType !== Node.TEXT_NODE || textNode.parentNode.classList.contains('sql-mention-chip')) {
            console.log('[MENTION DEBUG] Not in a valid text node or inside a mention chip. Hiding dropdown.');
            hideMentionDropdown();
            return;
        }

        const text = textNode.textContent;
        const caretPos = range.startOffset;
        console.log('[MENTION DEBUG] Current text in node:', text, 'Caret position:', caretPos);

        const textBeforeCaret = text.substring(0, caretPos);
        console.log('[MENTION DEBUG] Text before caret:', `'${textBeforeCaret}'`);
        const match = textBeforeCaret.match(/(?:^|\s|\n)(@)([a-zA-Z0-9_]*)$/);
        console.log('[MENTION DEBUG] Regex match result:', match);

        if (match) {
            const triggerChar = match[1]; // @
            mentionQuery = match[2];
            mentionStartIndex = caretPos - mentionQuery.length - triggerChar.length;
            console.log('[MENTION DEBUG] Trigger detected. Mention query:', `'${mentionQuery}'`, 'Mention start index:', mentionStartIndex);

          const query = mentionQuery.toLowerCase();

const filteredMentions = availableMentions.filter(item => {
    const name = String(item.mentionName || '').toLowerCase();
    const description = String(item.mentionDescription || '').toLowerCase();

    return name.includes(query) || description.includes(query);
});

selectedMentionIndex = filteredMentions.length > 0 ? 0 : -1;
showMentionDropdown(filteredMentions, getCaretCoordinates());
        } else {
            console.log('[MENTION DEBUG] No trigger match. Hiding dropdown.');
            hideMentionDropdown();
            mentionQuery = '';
            mentionStartIndex = -1;
        }
    });

    editor.addEventListener('keydown', (e) => {
        if (window._kcsOcrActive) { return; } // Ignore keydown during OCR
        if (mentionDropdown && mentionDropdown.style.display === 'block') {
            const items = Array.from(mentionDropdown.querySelectorAll('.mention-item'));
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedMentionIndex = (selectedMentionIndex + 1) % items.length;
                updateMentionDropdownSelection(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedMentionIndex = (selectedMentionIndex - 1 + items.length) % items.length;
                updateMentionDropdownSelection(items);
            } else if (e.key === 'Enter') { // Changed from Enter || Tab
                e.preventDefault();
                if (selectedMentionIndex !== -1) {
                    const selectedType = items[selectedMentionIndex].dataset.mentionType;
const selectedId = items[selectedMentionIndex].dataset.mentionId;

const selectedMention = availableMentions.find(item =>
    item.mentionType === selectedType &&
    item.mentionId === selectedId
);

if (selectedMention) {
    selectMentionItem(selectedMention);
}
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                hideMentionDropdown();
            }
        }
    });

    function updateMentionDropdownSelection(items) {
        items.forEach((item, index) => {
            if (index === selectedMentionIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    // Handle clicks on mention chips to open the panel
    editor.addEventListener('click', (e) => {
    const sqlChip = e.target.closest('.sql-mention-chip');
    const procChip = e.target.closest('.proc-mention-chip');

    if (sqlChip && sqlChip.dataset.sqlId) {
        e.preventDefault();
        e.stopPropagation();
        openPanel(sqlChip.dataset.sqlId);
        return;
    }

    if (procChip && procChip.dataset.procId) {
        e.preventDefault();
        e.stopPropagation();
        openProcedurePanel(procChip.dataset.procId);
        return;
    }

    closePanel();
});

    // Initial fetch of SQL scripts
    fetchMentionSources();
}

// Helper to extract mentions and replace them with placeholders
function extractMentionsAndReplaceWithPlaceholders(editorElement) {
    const rawHtml = editorElement.innerHTML;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawHtml;
    const mentions = [];
    let mentionCounter = 0;

    // Process SQL mention chips
    // Process SQL mention chips
tempDiv.querySelectorAll('.sql-mention-chip').forEach((chip) => {
    const placeholder = `[SQL_REF_${mentionCounter}]`;

    mentions.push({
        type: 'sql',
        id: chip.dataset.sqlId,
        name: chip.dataset.sqlName,
        placeholder,
        originalHtml: chip.outerHTML
    });

    chip.replaceWith(document.createTextNode(placeholder));
    mentionCounter++;
});

// Process Procedure mention chips
tempDiv.querySelectorAll('.proc-mention-chip').forEach((chip) => {
    const placeholder = `[PROC_REF_${mentionCounter}]`;

    mentions.push({
        type: 'proc',
        id: chip.dataset.procId,
        name: chip.dataset.procName,
        placeholder,
        originalHtml: chip.outerHTML
    });

    chip.replaceWith(document.createTextNode(placeholder));
    mentionCounter++;
});

    // Process images (existing logic)
    tempDiv.querySelectorAll('img').forEach((img, index) => {
        const placeholder = `__IMAGEM_${index}__`;
        // Store original HTML of image, might need to re-evaluate how images are handled after AI processing
        mentions.push({ type: 'image', placeholder: placeholder, originalHtml: img.outerHTML });
        img.replaceWith(document.createTextNode(placeholder));
    });

    return { cleanedText: tempDiv.innerText.trim(), mentions: mentions };
}

// Helper to restore placeholders with original HTML
function restorePlaceholders(textWithPlaceholders, editorElement, mentions) {
    let restoredHtml = textWithPlaceholders;

    // Sort mentions by placeholder length in descending order to avoid partial replacements
    mentions.sort((a, b) => b.placeholder.length - a.placeholder.length);

    mentions.forEach(mention => {
        const regex = new RegExp(escapeRegExp(mention.placeholder), 'g');
        if (mention.type === 'image') {
            restoredHtml = restoredHtml.replace(regex, `<br>${mention.originalHtml}<br>`);
        } else if (mention.type === 'sql' || mention.type === 'proc') {
    restoredHtml = restoredHtml.replace(regex, mention.originalHtml);
}
    });

    return restoredHtml;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


async function handleOcrImageSelect(editor) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = SUPPORTED_OCR_TYPES.join(',');

    input.onchange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        await runOcrOnImageFile(file, editor);
    };

    input.click();
}

// UPLOAD E PROCESSAMENTO
async function handleImageUpload(editor) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => { if (e.target.files[0]) await processImageFile(e.target.files[0], editor); };
    input.click();
}

async function processImageFile(file, editor) {
    let localPreviewUrl = null;
    let tempId = `up_${Date.now()}`;
    try {
        showLoading(true);
        // OCR antes do upload
        // Ensure OCR does not trigger mention dropdown
        window._kcsOcrActive = true; // Flag to disable mention trigger during OCR
        await runOcrOnImageFile(file, editor);
        window._kcsOcrActive = false; // Reset flag

        const compressedBlob = await compressImageLocal(file);
        localPreviewUrl = URL.createObjectURL(compressedBlob);
        const imgHtml = `<br><img id="${tempId}" src="${localPreviewUrl}" class="img-uploading" data-uploading="true" style="max-height:240px; display:block;" contenteditable="false" /><br>`;
        insertHtmlAtCursor(imgHtml, editor);

        // MODIFICADO: Procura o ID apenas neste editor
        const form = editor.closest('form');
        const idInput = form ? (form.querySelector('input[name="id"]') || form.querySelector('input[name="articleId"]')) : null;
        const articleId = idInput?.value || 'drafts';

        const publicUrl = await uploadImageToCloud(compressedBlob, articleId);

        const imgEl = document.getElementById(tempId);
        if (imgEl) {
            imgEl.src = publicUrl;
            imgEl.classList.remove('img-uploading');
            imgEl.removeAttribute('data-uploading');
            imgEl.removeAttribute('id');
        }
    } catch (e) { showToast('Falha no upload.', 'error'); } finally {
        if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
        showLoading(false);
        window._kcsOcrActive = false; // Ensure flag is reset even on error
    }
}

function compressImageLocal(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const scale = Math.min(1024 / img.width, 1);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.8);
            };
        };
    });
}

function insertHtmlAtCursor(html, editor) {
    editor.focus();
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const div = document.createElement('div');
        div.innerHTML = html;
        const frag = document.createDocumentFragment();
        let node, lastNode;
        while ((node = div.firstChild)) lastNode = frag.appendChild(node);
        range.insertNode(frag);
        if (lastNode) {
            range.setStartAfter(lastNode);
            sel.removeAllRanges();
            sel.addRange(range);
}
    } else editor.innerHTML += html;
}

export function insertFormatting(format, editor) {
    if (!editor) return;

    editor.focus();

    if (format === 'undo') {
        document.execCommand('undo');
        return;
    }

    if (format === 'redo') {
        document.execCommand('redo');
        return;
    }

    if (format === 'h3') {
        document.execCommand('formatBlock', false, 'H3');
        return;
    }

    document.execCommand(format, false, null);
}

export function resetEditor(editorId = 'article-body') {
    const editor = document.getElementById(editorId);
    if (editor) editor.innerHTML = '';
}

// --- OCR Helpers ---
const SUPPORTED_OCR_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_OCR_SIZE_MB = 5;

async function runOcrOnImageFile(file, editor) {
    if (!SUPPORTED_OCR_TYPES.includes(file.type)) {
        showToast('Tipo de imagem não suportado para OCR.', 'error');
        return;
    }

    if (file.size > MAX_OCR_SIZE_MB * 1024 * 1024) {
        showToast('Imagem excede o limite de 5MB.', 'error');
        return;
    }

    showLoading(true, 'Processando OCR com IA...');

    try {
        window._kcsOcrActive = true;

        const text = cleanOcrText(await extrairTextoImagemGemini(file));

        if (!text || text.length === 0) {
            showToast('Nenhum texto detectado na imagem.', 'warning');
            return;
        }

        insertOcrTextAtEnd(editor, text);
        showToast('Texto extraído com sucesso!', 'success');

    } catch (err) {
        console.error('[OCR Gemini] Falha ao processar imagem:', err);
        showToast('Falha ao processar imagem com OCR.', 'error');
    } finally {
        window._kcsOcrActive = false;
        showLoading(false);
    }
}

function cleanOcrText(text) {
    // Remove palavras isoladas suspeitas no final (ex: cosov, f, traços, etc)
    return text.replace(/([\s\S]*?)(\b(cosov|f|—|–|\-|\*|\.|,|\'|\"|\?|\!|\:|\;|\_|\~|\^|\`|\|)\b)?\s*$/i, '$1').trim();
}

function insertOcrTextAtEnd(editor, text) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ocr-inserted-text';
    wrapper.innerHTML = `
        <p><strong>Texto extraído da imagem:</strong></p>
        <p>${String(text).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>
    `;

    editor.appendChild(wrapper);
    editor.scrollTop = editor.scrollHeight;
}

