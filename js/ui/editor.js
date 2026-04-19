/**
 * editor.js — Motor de Rich Text, IA e Renderização Visual
 * Versão SRE: Transações Atômicas, Zero-Trust UI & Hard Block
 */

import { showToast, showLoading } from './render.js';
import { uploadImageToCloud } from '../services/cloud.js';
import { reescreverTextoTecnico, corrigirGramaticaApenas, setArticleLock, releaseArticleLock, forceReleaseLock } from '../services/kcsCore.js';
import { getCurrentUser } from '../auth.js';

export function initEditor(editorId = 'article-body') {
    const editor = document.getElementById(editorId);
    if (!editor) return;
    
    const form = editor.closest('form');
    const btnSave = document.getElementById('btn-save-article') || document.querySelector('form button[type="submit"]');
    const toolbar = editor.previousElementSibling;

    // 1. BLINDAGEM VISUAL: Esconde e paralisa os dados do artigo IMEDIATAMENTE
    if (form) {
        form.style.opacity = '0';
        form.style.pointerEvents = 'none';
        form.style.transition = 'opacity 0.2s ease-in-out';
    }
    // ==========================================
    // CAPTURA DO ID DO PROCEDIMENTO
    // ==========================================
    let articleId = null;
    const idInput = document.getElementById('article-id') || document.querySelector('input[name="id"]') || document.querySelector('input[name="articleId"]');
    
    if (idInput && idInput.value) {
        articleId = idInput.value;
    } else {
        const hiddenInputs = Array.from(document.querySelectorAll('input[type="hidden"]'));
        const possibleId = hiddenInputs.find(i => i.value && (i.value.startsWith('kcs_') || i.value.length > 15));
        if (possibleId) articleId = possibleId.value;
    }

    // ==========================================
    // TRAVA DE CONCORRÊNCIA (TRANSAÇÃO ATÔMICA)
    // ==========================================
    if (articleId && articleId !== 'drafts') {
        
        setArticleLock(articleId).then(result => {
            
            if (result.status === 'LOCKED') {
                // HARD BLOCK: Limpa todos os dados inseridos e avisa o bloqueio
                console.warn(`[SRE Lock] Acesso barrado pela Transação. Documento em uso por ${result.lockedBy}.`);
                showToast(`🔒 Documento bloqueado por ${result.lockedBy}`, 'error');
                
                // Exibe bloqueio gigante no lugar do texto
                editor.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-16 text-red-500 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-900/50">
                        <i class="ph-fill ph-lock-key text-5xl mb-3"></i>
                        <p class="font-bold text-lg">Procedimento em Edição</p>
                        <p class="text-sm mt-1 text-gray-500">Este documento está sendo alterado no momento por <strong>${result.lockedBy}</strong>.</p>
                    </div>`;
                
                if (form) {
                    // LIMPEZA DA SUJEIRA VISUAL
                    form.querySelectorAll('input, textarea, select').forEach(el => {
                        if (el.type !== 'hidden') {
                            el.value = ''; // Apaga o conteúdo
                            el.readOnly = true;
                            el.disabled = true;
                            el.style.opacity = '0.5';
                        }
                    });
                    // Traz o form de volta à visão, mas agora higienizado
                    form.style.opacity = '1';
                    form.style.pointerEvents = 'none';
                }

                if (btnSave) {
                    btnSave.disabled = true;
                    btnSave.innerText = "Bloqueado";
                    btnSave.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-500');
                    btnSave.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                }
                if (toolbar) toolbar.style.display = 'none';

                // DROP-SWITCH: Botão 'Forçar Liberação' para Admins
                const currentUser = getCurrentUser();
                if (currentUser && currentUser.role === 'super_admin') {
                    const adminTool = document.createElement('div');
                    adminTool.className = 'mt-6 flex justify-center w-full pointer-events-auto';
                    adminTool.innerHTML = `
                        <button type="button" class="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-2 transition-all">
                            <i class="ph-bold ph-warning"></i> Forçar Liberação (Admin)
                        </button>
                    `;
                    
                    adminTool.querySelector('button').onclick = async () => {
                        if(confirm(`ATENÇÃO: Você irá ejetar ${result.lockedBy} e ele perderá dados não salvos. Confirma?`)) {
                            await forceReleaseLock(articleId);
                            showToast('Trava de banco removida. Feche e abra o procedimento novamente.', 'success');
                            const btnCancel = document.getElementById('btn-cancel-article') || document.querySelector('[data-modal-close]');
                            if(btnCancel) {
                                btnCancel.pointerEvents = 'auto';
                                btnCancel.click();
                            }
                        }
                    };
                    editor.appendChild(adminTool);
                }

            } else if (result.status === 'SUCCESS') {
                // Acesso Concedido: Renderiza os dados livremente
                console.log(`[SRE Lock] Acesso validado no servidor.`);
                if (form) {
                    form.style.opacity = '1';
                    form.style.pointerEvents = 'auto';
                }
                
                const unlockFn = () => releaseArticleLock(articleId);
                const btnCancel = document.getElementById('btn-cancel-article') || document.querySelector('[data-modal-close]');
                if (btnCancel && !btnCancel._lockListener) {
                    btnCancel.addEventListener('click', unlockFn);
                    btnCancel._lockListener = true;
                }
                window.addEventListener('beforeunload', unlockFn);
            } else {
                // Erro de Rede ou Interno
                showToast('Falha na validação de segurança. Tente novamente.', 'error');
                const btnCancel = document.getElementById('btn-cancel-article');
                if(btnCancel) btnCancel.click();
            }
        });

        // 2. ESCUTA REAL-TIME (Caso alguém force a trava enquanto o analista estiver dentro)
        const reactToRealTimeLock = (e) => {
            if (e.detail.articleId === articleId) {
                console.warn(`[SRE Lock] ATENÇÃO: Sua edição foi ejetada por ${e.detail.lockedByName}`);
                showToast(`⚠️ Você foi desconectado: ${e.detail.lockedByName} assumiu a edição.`, 'error');
                
                if (btnSave) {
                    btnSave.disabled = true;
                    btnSave.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-500');
                    btnSave.innerText = "Sessão Ejetada";
                }
                
                editor.setAttribute('contenteditable', 'false');
                editor.style.opacity = '0.5';
                editor.style.pointerEvents = 'none';
                
                if (form) {
                    form.querySelectorAll('input, textarea, select').forEach(el => {
                        if (el.type !== 'hidden') {
                            el.readOnly = true;
                            el.disabled = true;
                            el.style.opacity = '0.5';
                            el.style.cursor = 'not-allowed';
                        }
                    });
                }
                
                if (toolbar) toolbar.style.display = 'none';
            }
        };

        if (window._kcsActiveLockListener) {
            document.removeEventListener('kcs-article-lock-active', window._kcsActiveLockListener);
        }
        window._kcsActiveLockListener = reactToRealTimeLock;
        document.addEventListener('kcs-article-lock-active', reactToRealTimeLock);

    } else {
        // NOVO PROCEDIMENTO: Libera a interface instantaneamente
        if (form) {
            form.style.opacity = '1';
            form.style.pointerEvents = 'auto';
        }
    }

    // ==========================================
    // LÓGICA DE UPLOAD E BOTÕES
    // ==========================================
    if (form && !form._imageInterceptorAdded) {
        form.addEventListener('submit', (e) => {
            if (editor.querySelector('img[data-uploading="true"]') || editor.value?.includes('[Enviando imagem...]')) {
                e.preventDefault();
                showToast('Aguarde o upload das imagens finalizar antes de salvar.', 'warning');
                return;
            }
        }, true);
        form._imageInterceptorAdded = true;
    }

    const toolbarBtns = document.querySelectorAll('[data-format]');
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

   // ==========================================
    // BOTÃO: REESCREVER COM IA
    // ==========================================
    const btnReescrever = document.getElementById('btn-ia-reescrever');
    if (btnReescrever) {
        const newBtnR = btnReescrever.cloneNode(true);
        btnReescrever.parentNode.replaceChild(newBtnR, btnReescrever);
        
        newBtnR.addEventListener('click', async () => {
            if (editor.getAttribute('contenteditable') === 'false') return;

            const currentEditor = document.getElementById(editorId);
            if (!currentEditor) return;

            const currentTitle = document.getElementById('article-title')?.value || '';
            const currentSymptom = document.getElementById('article-symptom')?.value || '';
            const currentEnvironment = document.getElementById('article-environment')?.value || '';
            const currentCause = document.getElementById('article-cause')?.value || '';
            const currentSolution = document.getElementById('article-solution')?.value || '';
            
            const rawHtml = currentEditor.innerHTML;
            const imagesMap = [];
            
            // 1. MÁSCARA DE PROTEÇÃO 100% SEGURA (VIA DOM)
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = rawHtml;
            
            // Busca todas as tags de imagem reais e troca por um Token forte
            const imgs = tempDiv.querySelectorAll('img');
            imgs.forEach((img, index) => {
                imagesMap.push(img.outerHTML); // Salva o HTML perfeito da imagem
                const token = document.createTextNode(` __IMAGEM_${index}__ `);
                img.parentNode.replaceChild(token, img); // Coloca a ficha no lugar
            });

            const textWithTokens = tempDiv.innerText.trim();

            const fullContext = `TÍTULO ATUAL: ${currentTitle}\nSINTOMA: ${currentSymptom}\nAMBIENTE: ${currentEnvironment}\nCAUSA: ${currentCause}\nSOLUÇÃO: ${currentSolution}\nRASCUNHO/RELATO PRINCIPAL:\n${textWithTokens}\n\nREGRA CRÍTICA: O texto contém marcações como __IMAGEM_0__. Você DEVE manter essas marcações exatas na sua resposta final, nos mesmos locais. Não as remova!`;

            if (textWithTokens.replace(/[^a-zA-Z0-9]/g, '').length < 10) {
                return showToast('Despeje o conhecimento na caixa de "Passo a Passo" para a IA processar!', 'warning');
            }
            
            const originalHtml = newBtnR.innerHTML;
            newBtnR.innerHTML = `<i class="ph ph-spinner animate-spin mr-1"></i> Preenchendo...`;
            newBtnR.disabled = true;
            newBtnR.classList.add('opacity-70', 'cursor-not-allowed');
            
            try {
                const result = await reescreverTextoTecnico(fullContext);
                
                let textoEstruturado = "";
                
                if (typeof result === 'object' && result !== null) {
                    if (result.titulo) document.getElementById('article-title').value = result.titulo;
                    if (result.sintoma) document.getElementById('article-symptom').value = result.sintoma;
                    if (result.ambiente) document.getElementById('article-environment').value = result.ambiente;
                    if (result.causa) document.getElementById('article-cause').value = result.causa;
                    if (result.solucao) document.getElementById('article-solution').value = result.solucao;
                    textoEstruturado = result.passos || "";
                } else if (typeof result === 'string') {
                    try {
                        const parsed = JSON.parse(result);
                        if (parsed.titulo) document.getElementById('article-title').value = parsed.titulo;
                        if (parsed.sintoma) document.getElementById('article-symptom').value = parsed.sintoma;
                        if (parsed.ambiente) document.getElementById('article-environment').value = parsed.ambiente;
                        if (parsed.causa) document.getElementById('article-cause').value = parsed.causa;
                        if (parsed.solucao) document.getElementById('article-solution').value = parsed.solucao;
                        textoEstruturado = parsed.passos || "";
                    } catch(e) {
                        textoEstruturado = result;
                    }
                }

                if (!textoEstruturado) throw new Error("A IA devolveu os passos vazios.");

                textoEstruturado = textoEstruturado.replace(/\n/g, '<br><br>');

                // 2. RESTAURAÇÃO DAS IMAGENS (COM FALLBACK ANTI-PERDA)
                imagesMap.forEach((imgHtml, index) => {
                    const token = `__IMAGEM_${index}__`;
                    if (textoEstruturado.includes(token)) {
                        // Se a IA obedeceu e manteve o token, coloca a imagem no lugar certo
                        textoEstruturado = textoEstruturado.split(token).join(`<br>${imgHtml}<br>`);
                    } else {
                        // PLANO B: Se a IA apagou o token, cola a imagem no final do texto!
                        textoEstruturado += `<br><br>${imgHtml}`;
                    }
                });

                currentEditor.innerHTML = textoEstruturado;
                
                showToast('Piloto Automático: Campos preenchidos e Imagens alinhadas!', 'success');
            } catch(e) {
                console.error("[KCS-IA Erro]", e);
                showToast('Ocorreu um erro ao formatar. A IA pode estar sobrecarregada.', 'error');
            } finally {
                newBtnR.innerHTML = originalHtml;
                newBtnR.disabled = false;
                newBtnR.classList.remove('opacity-70', 'cursor-not-allowed');
            }
        });
    }

    // ==========================================
    // BOTÃO: CORRIGIR GRAMÁTICA
    // ==========================================
    const btnCorrigir = document.getElementById('btn-ia-corrigir');
    if (btnCorrigir) {
        const newBtnC = btnCorrigir.cloneNode(true);
        btnCorrigir.parentNode.replaceChild(newBtnC, btnCorrigir);
        
        newBtnC.addEventListener('click', async () => {
            if (editor.getAttribute('contenteditable') === 'false') return;

            const currentEditor = document.getElementById(editorId);
            if (!currentEditor) return;

            const rawHtml = currentEditor.innerHTML;
            const imagesMap = [];
            
            // 1. MÁSCARA DE PROTEÇÃO 100% SEGURA
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = rawHtml;
            const imgs = tempDiv.querySelectorAll('img');
            imgs.forEach((img, index) => {
                imagesMap.push(img.outerHTML);
                const token = document.createTextNode(` __IMAGEM_${index}__ `);
                img.parentNode.replaceChild(token, img);
            });

            const textWithTokens = tempDiv.innerText.trim();

            if (textWithTokens.length < 5) return showToast('Escreva algo na caixa.', 'warning');
            
            const promptCorrigir = `${textWithTokens}\n\nREGRA CRÍTICA: O texto acima contém marcações como __IMAGEM_0__. Você DEVE manter essas marcações exatas na sua resposta final, nos mesmos locais. Não as remova!`;
            
            const originalHtml = newBtnC.innerHTML;
            newBtnC.innerHTML = `<i class="ph ph-spinner animate-spin mr-1"></i> Corrigindo...`;
            newBtnC.disabled = true;
            newBtnC.classList.add('opacity-70', 'cursor-not-allowed');
            
            try {
                let result = await corrigirGramaticaApenas(promptCorrigir);
                result = result.replace(/\n/g, '<br>');

                // 2. RESTAURAÇÃO DAS IMAGENS (COM FALLBACK)
                imagesMap.forEach((imgHtml, index) => {
                    const token = `__IMAGEM_${index}__`;
                    if (result.includes(token)) {
                        result = result.split(token).join(`<br>${imgHtml}<br>`);
                    } else {
                        result += `<br><br>${imgHtml}`; // Fallback salvador
                    }
                });
                
                currentEditor.innerHTML = result;
                showToast('Ortografia corrigida!', 'success');
            } catch(e) {
                console.error("[KCS-IA Erro]", e);
                showToast(e.message, 'error');
            } finally {
                newBtnC.innerHTML = originalHtml;
                newBtnC.disabled = false;
                newBtnC.classList.remove('opacity-70', 'cursor-not-allowed');
            }
        });
    }
    
    // ==========================================
    // EVENTOS DE ARRASTAR E SOLTAR IMAGENS
    // ==========================================
    const newEditor = editor.cloneNode(true);
    editor.parentNode.replaceChild(newEditor, editor);

    newEditor.addEventListener('dragover', (e) => {
        if (newEditor.getAttribute('contenteditable') === 'false') return;
        e.preventDefault();
        newEditor.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
    });

    newEditor.addEventListener('dragleave', (e) => {
        if (newEditor.getAttribute('contenteditable') === 'false') return;
        e.preventDefault();
        newEditor.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
    });

    newEditor.addEventListener('drop', async (e) => {
        if (newEditor.getAttribute('contenteditable') === 'false') return;
        e.preventDefault();
        newEditor.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) await processImageFile(file, newEditor);
            else showToast('Apenas arquivos de imagem são suportados.', 'warning');
        }
    });

    newEditor.addEventListener('paste', async (e) => {
        if (newEditor.getAttribute('contenteditable') === 'false') return;
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) return;

        const items = clipboardData.items;
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

// ==========================================
// UPLOAD E COMPRESSÃO DA IMAGEM VIA CANVAS
// ==========================================
async function handleImageUpload(editor) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png, image/jpeg, image/webp, image/gif';
    input.style.display = 'none';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await processImageFile(file, editor);
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
}

function compressImageLocal(file, maxWidth = 1024, quality = 0.75) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => resolve(blob), 'image/webp', quality);
            };
            img.onerror = () => reject(new Error("Erro no Canvas"));
        };
        reader.onerror = (err) => reject(err);
    });
}

async function processImageFile(file, editor) {
    let localPreviewUrl = null;
    let tempId = `upload_${Date.now()}`;

    try {
        showLoading(true); 
        const compressedBlob = await compressImageLocal(file, 1024, 0.75);
        localPreviewUrl = URL.createObjectURL(compressedBlob);
        
        const imgHtml = `<br><img id="${tempId}" src="${localPreviewUrl}" data-uploading="true" style="max-height: 240px; width: auto; max-width: 100%; border-radius: 6px; margin: 10px 0; border: 2px dashed #3b82f6; opacity: 0.6; display: block;" contenteditable="false" /><br>`;
        insertHtmlAtCursor(imgHtml, editor);

        const articleIdInput = document.getElementById('article-id') || document.querySelector('input[name="id"]');
        const articleId = (articleIdInput && articleIdInput.value) ? articleIdInput.value : 'drafts';

        const publicUrl = await uploadImageToCloud(compressedBlob, articleId);

        const imgEl = document.getElementById(tempId);
        if (imgEl) {
            imgEl.src = publicUrl;
            imgEl.removeAttribute('data-uploading');
            imgEl.removeAttribute('id');
            imgEl.style.opacity = '1';
            imgEl.style.border = '1px solid #d1d5db';
        }
        showToast('Imagem salva e embutida!', 'success');
    } catch (error) {
        console.error("Erro upload:", error);
        showToast('Falha ao processar.', 'error');
        const imgEl = document.getElementById(tempId);
        if (imgEl) imgEl.remove();
    } finally {
        if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
        showLoading(false); 
    }
}

function insertHtmlAtCursor(html, editor) {
    editor.focus();
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents(); 
        const el = document.createElement('div');
        el.innerHTML = html;
        const frag = document.createDocumentFragment();
        let node, lastNode;
        while ((node = el.firstChild)) lastNode = frag.appendChild(node);
        range.insertNode(frag);
        if (lastNode) {
            range.setStartAfter(lastNode);
            range.setEndAfter(lastNode);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    } else {
        editor.innerHTML += html;
    }
}

export function insertFormatting(format, editor, rawValue = '') {
    editor.focus();
    const selection = window.getSelection();
    let selectedText = selection && selection.rangeCount > 0 ? selection.toString() : '';
    let replacement = '';

    switch(format) {
        case 'bold': replacement = `<b>${selectedText || 'texto'}</b>`; break;
        case 'italic': replacement = `<i>${selectedText || 'texto'}</i>`; break;
        case 'underline': replacement = `<u>${selectedText || 'texto'}</u>`; break;
        case 'h3': replacement = `<br><h3><strong>${selectedText || 'Título'}</strong></h3><br>`; break;
        case 'insertUnorderedList': replacement = `<br>• ${selectedText || 'Item'}<br>`; break;
        case 'insertOrderedList': replacement = `<br>1. ${selectedText || 'Item'}<br>`; break;
        case 'codeBlock': replacement = `<br><pre style="background:#f3f4f6; padding:10px; border-radius:5px;"><code>${selectedText || 'código'}</code></pre><br>`; break;
        case 'undo': document.execCommand('undo'); return;
        case 'redo': document.execCommand('redo'); return;
        default: return;
    }

    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const el = document.createElement('span');
        el.innerHTML = replacement;
        range.insertNode(el);
        range.setStartAfter(el);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        editor.innerHTML += replacement;
    }
}

export function resetEditor(editorId = 'article-body') {
    const editor = document.getElementById(editorId);
    if (editor) {
        editor.innerHTML = '';
        editor.focus();
        document.body.classList.remove('editor-focus-mode'); // Garante que volta ao normal
    }
}

export function renderImagesVisually(editor) {}
export { formatContentForView } from './render.js';