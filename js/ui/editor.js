/**
 * editor.js — Motor de Rich Text, IA e Renderização Visual
 * Versão SRE Refatorada: Classes Semânticas & Workbench Integration (MDI / Tabs Support)
 */

import { showToast, showLoading } from './render.js';
import { uploadImageToCloud } from '../services/cloud.js';
import { reescreverTextoTecnico, corrigirGramaticaApenas, setArticleLock, releaseArticleLock, forceReleaseLock } from '../services/kcsCore.js';
import { getCurrentUser } from '../auth.js';

export function initEditor(editorId = 'article-body') {
    const editor = document.getElementById(editorId);
    if (!editor) return;
    
    const form = editor.closest('form');
    // MODIFICADO: Procura o botão de guardar apenas dentro deste formulário (Isolamento de abas)
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
                if (format === 'image') handleImageUpload(editor);
                else insertFormatting(format, editor);
            });
        });
    }

    // IA: REESCREVER TEXTO TÉCNICO (Isolado)
    // MODIFICADO: Procura o botão apenas dentro deste formulário
    const btnReescrever = form ? form.querySelector('.btn-ia-reescrever') : null;
    if (btnReescrever) {
        const newBtnR = btnReescrever.cloneNode(true);
        btnReescrever.parentNode.replaceChild(newBtnR, btnReescrever);
        
        newBtnR.addEventListener('click', async () => {
            if (editor.getAttribute('contenteditable') === 'false') return;
            const currentEditor = document.getElementById(editorId);
            if (!currentEditor) return;

            const rawHtml = currentEditor.innerHTML;
            const imagesMap = [];
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = rawHtml;
            
            tempDiv.querySelectorAll('img').forEach((img, index) => {
                imagesMap.push(img.outerHTML);
                const token = document.createTextNode(` __IMAGEM_${index}__ `);
                img.parentNode.replaceChild(token, img);
            });

            const textWithTokens = tempDiv.innerText.trim();
            if (textWithTokens.length < 10) return showToast('Despeje o relato no Passo a Passo.', 'warning');

            const fullContext = `RASCUNHO:\n${textWithTokens}\n\nREGRA: Mantenha __IMAGEM_X__.`;
            const originalHtml = newBtnR.innerHTML;
            newBtnR.innerHTML = `<i class="ph ph-spinner spinner-icon"></i> Processando...`;
            newBtnR.classList.add('u-disabled');
            
            try {
                const result = await reescreverTextoTecnico(fullContext);
                let finalSteps = (typeof result === 'object' ? result.passos : result) || "";
                finalSteps = finalSteps.replace(/\n/g, '<br><br>');

                imagesMap.forEach((imgHtml, index) => {
                    const token = `__IMAGEM_${index}__`;
                    finalSteps = finalSteps.includes(token) ? finalSteps.split(token).join(`<br>${imgHtml}<br>`) : finalSteps + `<br>${imgHtml}`;
                });

                currentEditor.innerHTML = finalSteps;
                showToast('IA finalizou o preenchimento!', 'success');
            } catch(e) { showToast('Erro na IA.', 'error'); } finally {
                newBtnR.innerHTML = originalHtml;
                newBtnR.classList.remove('u-disabled');
            }
        });
    }

    // EVENTOS DE DRAG, DROP E PASTE
    const newEditor = editor.cloneNode(true);
    editor.parentNode.replaceChild(newEditor, editor);

    newEditor.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (newEditor.getAttribute('contenteditable') !== 'false') newEditor.classList.add('editor-drag-active');
    });
    newEditor.addEventListener('dragleave', () => newEditor.classList.remove('editor-drag-active'));
    newEditor.addEventListener('drop', async (e) => {
        e.preventDefault();
        newEditor.classList.remove('editor-drag-active');
        if (newEditor.getAttribute('contenteditable') === 'false') return;
        if (e.dataTransfer.files?.length > 0) await processImageFile(e.dataTransfer.files[0], newEditor);
    });

    newEditor.addEventListener('paste', async (e) => {
        if (newEditor.getAttribute('contenteditable') === 'false') return;
        const items = (e.clipboardData || window.clipboardData).items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = items[i].getAsFile();
                if (file) await processImageFile(file, newEditor);
                break;
            }
        }
    });
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
    editor.focus();
    if (format === 'undo') document.execCommand('undo');
    else if (format === 'redo') document.execCommand('redo');
    else document.execCommand(format, false, null);
}

export function resetEditor(editorId = 'article-body') {
    const editor = document.getElementById(editorId);
    if (editor) editor.innerHTML = '';
}