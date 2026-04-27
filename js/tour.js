/**
 * js/tour.js — Onboarding Guiado KCS Hub
 * Tour premium dark/VSCode com Shepherd.js
 */

import { TENANT_KEYS } from './config.js';
import { showToast } from './ui/render.js';

const TOUR_STORAGE_KEY = 'kcs_tour_v5_completed';
const LEGACY_TOUR_STORAGE_KEY = 'kcs_tour_v4_completed';
const WELCOME_MODAL_ID = 'kcs-welcome-modal';
const TOUR_STYLE_ID = 'kcs-tour-premium-styles';
const ACTIVE_TARGET_CLASS = 'kcs-tour-active-target';

export function initTour(force = false) {
    injectTourStyles();

    const alreadyCompleted =
        localStorage.getItem(TOUR_STORAGE_KEY) === 'true' ||
        localStorage.getItem(LEGACY_TOUR_STORAGE_KEY) === 'true';

    if (!force && alreadyCompleted) return;
    if (document.getElementById(WELCOME_MODAL_ID)) return;

    showWelcomeModal();
}

function showWelcomeModal() {
    const companyName =
        (typeof TENANT_KEYS !== 'undefined' && sessionStorage.getItem(TENANT_KEYS.COMPANY_NAME)) ||
        'sua operação';

    const welcomeModalHtml = `
        <div id="${WELCOME_MODAL_ID}" class="kcs-tour-welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="kcs-tour-title">
            <div class="kcs-tour-welcome-card">
                <div class="kcs-tour-orb kcs-tour-orb-blue"></div>
                <div class="kcs-tour-orb kcs-tour-orb-soft"></div>

                <div class="kcs-tour-welcome-header">
                    <div class="kcs-tour-icon-shell">
                        <i class="ph-fill ph-lightbulb-filament"></i>
                    </div>

                    <div>
                        <span class="kcs-tour-eyebrow">Onboarding KCS</span>
                        <h2 id="kcs-tour-title">Bem-vindo ao KCS Hub</h2>
                        <p>
                            Resolva mais rápido, documente sem atrito e transforme atendimento em conhecimento reutilizável para ${escapeHtml(companyName)}.
                        </p>
                    </div>
                </div>

                <div class="kcs-tour-principle">
                    <i class="ph-fill ph-target"></i>
                    <span>Princípio central: <strong>capture enquanto resolve.</strong></span>
                </div>

                <div class="kcs-tour-pillars" aria-label="Pilares da metodologia KCS">
                    <div class="kcs-tour-pillar">
                        <div class="kcs-tour-pillar-icon blue"><i class="ph ph-note-pencil"></i></div>
                        <div>
                            <strong>Capturar</strong>
                            <span>Registre o problema com a linguagem real do usuário.</span>
                        </div>
                    </div>

                    <div class="kcs-tour-pillar">
                        <div class="kcs-tour-pillar-icon purple"><i class="ph ph-flow-arrow"></i></div>
                        <div>
                            <strong>Estruturar</strong>
                            <span>Transforme solução em procedimento claro e revisável.</span>
                        </div>
                    </div>

                    <div class="kcs-tour-pillar">
                        <div class="kcs-tour-pillar-icon green"><i class="ph ph-recycle"></i></div>
                        <div>
                            <strong>Reutilizar</strong>
                            <span>Pesquise antes de criar e reduza retrabalho.</span>
                        </div>
                    </div>

                    <div class="kcs-tour-pillar">
                        <div class="kcs-tour-pillar-icon amber"><i class="ph ph-trend-up"></i></div>
                        <div>
                            <strong>Melhorar</strong>
                            <span>Atualize, aprove e eleve a qualidade da base.</span>
                        </div>
                    </div>
                </div>

                <div class="kcs-tour-welcome-actions">
                    <button id="btn-skip-tour" type="button" class="kcs-tour-btn kcs-tour-btn-ghost">
                        Pular
                    </button>
                    <button id="btn-start-tour" type="button" class="kcs-tour-btn kcs-tour-btn-primary">
                        <i class="ph-fill ph-play"></i>
                        Iniciar Tour
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', welcomeModalHtml);

    document.getElementById('btn-skip-tour')?.addEventListener('click', completeTourSilently);
    document.getElementById('btn-start-tour')?.addEventListener('click', startGuidedTour);
}

function startGuidedTour() {
    document.getElementById(WELCOME_MODAL_ID)?.remove();

    if (window.__kcs?.switchToDashboard) {
        try {
            window.__kcs.switchToDashboard();
        } catch (error) {
            console.warn('[KCS Tour] Não foi possível abrir o dashboard antes do tour:', error);
        }
    }

    setTimeout(async () => {
        await waitForTourTargets();
        executePremiumTour();
    }, 900);
}

async function waitForTourTargets(timeoutMs = 4000) {
    const selectors = getTourSelectors();
    const startedAt = Date.now();

    return new Promise((resolve) => {
        const interval = setInterval(() => {
            const hasAnyTarget = selectors.some((selector) => {
                const element = document.querySelector(selector);
                return element && isElementTourAvailable(element);
            });

            const timedOut = Date.now() - startedAt >= timeoutMs;

            if (hasAnyTarget || timedOut) {
                clearInterval(interval);
                resolve();
            }
        }, 150);
    });
}

function executePremiumTour() {
    injectTourStyles();

    if (typeof Shepherd === 'undefined') {
        console.warn('[KCS Tour] Shepherd.js não está disponível.');
        showSafeToast('Tour indisponível no momento.', 'error');
        return;
    }

    const steps = buildTourSteps();

    if (!steps.length) {
        console.warn('[KCS Tour] Nenhum alvo encontrado para o tour.', getTourSelectors());
        showSafeToast('Tour indisponível: nenhum item da tela foi encontrado.', 'warning');
        return;
    }

    document.body.classList.add('kcs-tour-active');

    const tour = new Shepherd.Tour({
        useModalOverlay: false,
        defaultStepOptions: {
            classes: 'kcs-shepherd-theme',
            cancelIcon: {
                enabled: true,
                label: 'Fechar tour'
            },
            scrollTo: false,
            popperOptions: {
                modifiers: [
                    {
                        name: 'offset',
                        options: {
                            offset: [0, 16]
                        }
                    },
                    {
                        name: 'preventOverflow',
                        options: {
                            boundary: 'viewport',
                            padding: 16
                        }
                    },
                    {
                        name: 'flip',
                        options: {
                            fallbackPlacements: ['bottom', 'top', 'right', 'left']
                        }
                    }
                ]
            }
        }
    });

    steps.forEach((step, index) => {
        tour.addStep({
            id: step.id,
            title: step.title,
            text: renderStepText(step.text, index + 1, steps.length),
            attachTo: {
                element: step.element,
                on: step.position
            },
            beforeShowPromise: () => {
                return new Promise((resolve) => {
                    clearActiveTourTargets();

                    try {
                        step.element.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                            inline: 'center'
                        });
                    } catch (_) {}

                    setTimeout(() => {
                        markActiveTarget(step.element);
                        resolve();
                    }, 220);
                });
            },
            when: {
                hide() {
                    clearActiveTourTargets();
                }
            },
            buttons: buildStepButtons(tour, index, steps.length)
        });
    });

    tour.on('cancel', () => {
        markTourCompleted();
        cleanupTourState();
        showSafeToast('Tour pulado. Você pode rever quando quiser.', 'info');
    });

    tour.on('complete', () => {
        markTourCompleted();
        cleanupTourState();
        showSafeToast('Tour concluído. Pronto para decolar!', 'success');
    });

    tour.on('inactive', cleanupTourState);

    tour.start();
}

function getTourSelectors() {
    return [
        '#search-input',
        '#btn-new-article',
        '#tour-base-conhecimento',
        '#tour-categorias',
        '#tour-sql',
        '#dashboard-container',
        '#btn-notif',
        '#btn-profile',
        '#btn-open-chatbot'
    ];
}

function buildTourSteps() {
    const candidates = [
        {
            id: 'step-search',
            selectors: ['#search-input'],
            position: 'bottom',
            title: '<i class="ph-fill ph-magnifying-glass"></i> Busca Inteligente',
            text: 'Pesquise antes de criar. O KCS começa encontrando conhecimento existente e evitando retrabalho.'
        },
        {
            id: 'step-new-kcs',
            selectors: ['#btn-new-article'],
            position: 'bottom',
            title: '<i class="ph-fill ph-note-pencil"></i> Novo Procedimento KCS',
            text: 'Quando não existir resposta, capture o conhecimento em rascunho e siga o fluxo de revisão até publicação.'
        },
        {
            id: 'step-base',
            selectors: ['#tour-base-conhecimento'],
            position: 'right',
            title: '<i class="ph-fill ph-books"></i> Base de Conhecimento',
            text: 'Acompanhe todos os artigos, favoritos, rascunhos, itens em revisão e conteúdos publicados.'
        },
        {
            id: 'step-categories',
            selectors: ['#tour-categorias'],
            position: 'right',
            title: '<i class="ph-fill ph-folders"></i> Categorias e Setores',
            text: 'Organize o conhecimento por área para manter contexto, governança e visibilidade correta.'
        },
        {
            id: 'step-sql',
            selectors: ['#tour-sql', '#btn-new-sql', '[data-view="sql"]'],
            position: 'right',
            title: '<i class="ph-fill ph-database"></i> Biblioteca SQL',
            text: 'Centralize scripts SQL com favoritos, histórico, tipos de operação e controle por setor quando aplicável.'
        },
        {
            id: 'step-dashboard',
            selectors: ['#dashboard-container'],
            position: 'top',
            title: '<i class="ph-fill ph-chart-line-up"></i> Dashboard de Governança',
            text: 'Monitore aprovação, acessos, revisão, qualidade da base e alertas críticos para gestão contínua.'
        },
        {
            id: 'step-account',
            selectors: ['#btn-profile', '[data-view="account"]'],
            position: 'right',
            title: '<i class="ph-fill ph-user-circle"></i> Perfil',
            text: 'Acesse dados do perfil, setor, cargo e preferências da conta.'
        },
        {
            id: 'step-settings',
            selectors: ['[data-view="settings"]'],
            position: 'right',
            title: '<i class="ph-fill ph-gear"></i> Administração',
            text: 'Gerencie usuários, setores, grupos e permissões conforme seu nível de acesso.'
        },
        {
            id: 'step-assistant',
            selectors: ['#btn-open-chatbot'],
            position: 'top',
            title: '<i class="ph-fill ph-robot"></i> Assistente IA',
            text: 'Use o assistente para acelerar dúvidas, localizar conhecimento e apoiar a operação diária.'
        }
    ];

    return candidates
        .map((step) => {
            const element = findFirstAvailableElement(step.selectors);
            if (!element) return null;

            return {
                ...step,
                selector: step.selectors[0],
                element
            };
        })
        .filter(Boolean);
}

function findFirstAvailableElement(selectors = []) {
    for (const selector of selectors) {
        const element = document.querySelector(selector);

        if (isElementTourAvailable(element)) {
            return element;
        }
    }

    return null;
}

function isElementTourAvailable(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    const isHidden =
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        element.hidden;

    const isDisabled =
        element.disabled ||
        element.getAttribute('aria-disabled') === 'true' ||
        element.classList.contains('disabled');

    const hasSize = rect.width > 0 && rect.height > 0;

    return !isHidden && !isDisabled && hasSize;
}

function buildStepButtons(tour, index, total) {
    const buttons = [];

    buttons.push({
        text: 'Pular',
        classes: 'kcs-tour-shepherd-btn kcs-tour-shepherd-btn-ghost',
        action: () => safeCancelTour(tour)
    });

    if (index > 0) {
        buttons.push({
            text: 'Voltar',
            classes: 'kcs-tour-shepherd-btn kcs-tour-shepherd-btn-secondary',
            action: () => safeBackTour(tour)
        });
    }

    buttons.push({
        text: index === total - 1 ? 'Finalizar' : 'Próximo',
        classes: 'kcs-tour-shepherd-btn kcs-tour-shepherd-btn-primary',
        action: () => {
            if (index === total - 1) {
                safeCompleteTour(tour);
            } else {
                safeNextTour(tour);
            }
        }
    });

    return buttons;
}

function safeNextTour(tour) {
    try {
        clearActiveTourTargets();
        tour.next();
    } catch (error) {
        console.warn('[KCS Tour] Erro ao avançar etapa:', error);
        safeCompleteTour(tour);
    }
}

function safeBackTour(tour) {
    try {
        clearActiveTourTargets();
        tour.back();
    } catch (error) {
        console.warn('[KCS Tour] Erro ao voltar etapa:', error);
    }
}

function safeCancelTour(tour) {
    try {
        clearActiveTourTargets();
        tour.cancel();
    } catch (error) {
        console.warn('[KCS Tour] Erro ao cancelar tour:', error);
        cleanupTourState();
        markTourCompleted();
    }
}

function safeCompleteTour(tour) {
    try {
        clearActiveTourTargets();
        tour.complete();
    } catch (error) {
        console.warn('[KCS Tour] Erro ao concluir tour:', error);
        cleanupTourState();
        markTourCompleted();
    }
}

function renderStepText(text, current, total) {
    return `
        <div class="kcs-tour-step-body">
            <p>${text}</p>
            <div class="kcs-tour-progress-row">
                <span>Etapa ${current} de ${total}</span>
                <div class="kcs-tour-progress-track">
                    <div class="kcs-tour-progress-fill" style="width: ${(current / total) * 100}%"></div>
                </div>
            </div>
        </div>
    `;
}

function markActiveTarget(element) {
    if (!element) return;

    element.classList.add(ACTIVE_TARGET_CLASS);

    const parentTarget = element.closest('button, a, [role="button"], input, textarea, select');
    if (parentTarget && parentTarget !== element) {
        parentTarget.classList.add(ACTIVE_TARGET_CLASS);
    }
}

function clearActiveTourTargets() {
    document
        .querySelectorAll(`.${ACTIVE_TARGET_CLASS}`)
        .forEach((element) => element.classList.remove(ACTIVE_TARGET_CLASS));
}

function cleanupTourState() {
    document.body.classList.remove('kcs-tour-active');
    clearActiveTourTargets();
}

function completeTourSilently() {
    markTourCompleted();
    document.getElementById(WELCOME_MODAL_ID)?.remove();
    cleanupTourState();
}

function markTourCompleted() {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    localStorage.setItem(LEGACY_TOUR_STORAGE_KEY, 'true');
}

function showSafeToast(message, type = 'success') {
    if (typeof showToast === 'function') {
        showToast(message, type);
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function injectTourStyles() {
    if (document.getElementById(TOUR_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = TOUR_STYLE_ID;
    style.textContent = `
        :root {
            --kcs-tour-bg: #1e1e1e;
            --kcs-tour-surface: #252526;
            --kcs-tour-surface-2: #2d2d30;
            --kcs-tour-border: rgba(255,255,255,.10);
            --kcs-tour-border-strong: rgba(0,122,204,.70);
            --kcs-tour-text: #f3f4f6;
            --kcs-tour-muted: #9ca3af;
            --kcs-tour-blue: #007acc;
            --kcs-tour-blue-2: #1f8ad8;
            --kcs-tour-green: #10b981;
            --kcs-tour-purple: #8b5cf6;
            --kcs-tour-amber: #f59e0b;
            --kcs-tour-red: #ef4444;
        }

        .kcs-tour-welcome-overlay {
            position: fixed !important;
            inset: 0 !important;
            z-index: 2147483000 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 24px !important;
            background:
                radial-gradient(circle at 50% 20%, rgba(0,122,204,.18), transparent 34%),
                rgba(9, 14, 22, .90) !important;
            backdrop-filter: blur(8px) !important;
            -webkit-backdrop-filter: blur(8px) !important;
            animation: kcsTourFadeIn .18s ease-out both;
        }

        .kcs-tour-welcome-card {
            position: relative;
            z-index: 2147483001 !important;
            width: min(760px, 100%);
            overflow: hidden;
            border-radius: 18px;
            border: 1px solid var(--kcs-tour-border);
            background:
                linear-gradient(145deg, rgba(37,37,38,.98), rgba(30,30,30,.98)),
                var(--kcs-tour-surface);
            box-shadow:
                0 28px 90px rgba(0,0,0,.58),
                inset 0 1px 0 rgba(255,255,255,.06);
            padding: 28px;
            color: var(--kcs-tour-text);
            animation: kcsTourScaleIn .22s ease-out both;
        }

        .kcs-tour-orb {
            position: absolute;
            pointer-events: none;
            border-radius: 999px;
            filter: blur(42px);
            opacity: .55;
        }

        .kcs-tour-orb-blue {
            width: 220px;
            height: 220px;
            top: -120px;
            right: -80px;
            background: rgba(0,122,204,.48);
        }

        .kcs-tour-orb-soft {
            width: 190px;
            height: 190px;
            left: -90px;
            bottom: -90px;
            background: rgba(16,185,129,.16);
        }

        .kcs-tour-welcome-header {
            position: relative;
            display: grid;
            grid-template-columns: 72px 1fr;
            gap: 18px;
            align-items: center;
        }

        .kcs-tour-icon-shell {
            width: 64px;
            height: 64px;
            display: grid;
            place-items: center;
            border-radius: 16px;
            background:
                linear-gradient(180deg, rgba(0,122,204,.22), rgba(0,122,204,.08));
            border: 1px solid rgba(0,122,204,.38);
            box-shadow: 0 0 32px rgba(0,122,204,.18);
        }

        .kcs-tour-icon-shell i {
            font-size: 34px;
            color: #4db2ff;
        }

        .kcs-tour-eyebrow {
            display: inline-flex;
            align-items: center;
            margin-bottom: 6px;
            color: #7cc7ff;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: .12em;
            text-transform: uppercase;
        }

        .kcs-tour-welcome-header h2 {
            margin: 0;
            color: #ffffff;
            font-size: clamp(24px, 4vw, 34px);
            font-weight: 850;
            letter-spacing: -.04em;
            line-height: 1.05;
        }

        .kcs-tour-welcome-header p {
            max-width: 570px;
            margin: 10px 0 0;
            color: #cbd5e1;
            font-size: 14px;
            line-height: 1.65;
        }

        .kcs-tour-principle {
            position: relative;
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 22px;
            padding: 12px 14px;
            border-radius: 12px;
            border: 1px solid rgba(0,122,204,.25);
            background: rgba(0,122,204,.08);
            color: #dbeafe;
            font-size: 13px;
        }

        .kcs-tour-principle i {
            color: #4db2ff;
            font-size: 18px;
        }

        .kcs-tour-pillars {
            position: relative;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin-top: 18px;
        }

        .kcs-tour-pillar {
            display: grid;
            grid-template-columns: 40px 1fr;
            gap: 12px;
            align-items: flex-start;
            padding: 14px;
            border-radius: 14px;
            border: 1px solid rgba(255,255,255,.08);
            background: rgba(255,255,255,.035);
        }

        .kcs-tour-pillar strong {
            display: block;
            color: #f8fafc;
            font-size: 13px;
            margin-bottom: 4px;
        }

        .kcs-tour-pillar span {
            display: block;
            color: #aeb7c4;
            font-size: 12px;
            line-height: 1.45;
        }

        .kcs-tour-pillar-icon {
            width: 34px;
            height: 34px;
            display: grid;
            place-items: center;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,.08);
            background: rgba(255,255,255,.04);
        }

        .kcs-tour-pillar-icon i {
            font-size: 18px;
        }

        .kcs-tour-pillar-icon.blue i { color: #4db2ff; }
        .kcs-tour-pillar-icon.purple i { color: var(--kcs-tour-purple); }
        .kcs-tour-pillar-icon.green i { color: var(--kcs-tour-green); }
        .kcs-tour-pillar-icon.amber i { color: var(--kcs-tour-amber); }

        .kcs-tour-welcome-actions {
            position: relative;
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            margin-top: 24px;
        }

        .kcs-tour-btn {
            height: 42px;
            border-radius: 10px;
            padding: 0 18px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 800;
            cursor: pointer;
            transition:
                transform .16s ease,
                background .16s ease,
                border-color .16s ease,
                box-shadow .16s ease;
        }

        .kcs-tour-btn:hover {
            transform: translateY(-1px);
        }

        .kcs-tour-btn-primary {
            min-width: 170px;
            border: 1px solid rgba(77,178,255,.55);
            background: linear-gradient(180deg, var(--kcs-tour-blue-2), var(--kcs-tour-blue));
            color: white;
            box-shadow: 0 10px 26px rgba(0,122,204,.28);
        }

        .kcs-tour-btn-primary:hover {
            box-shadow: 0 14px 34px rgba(0,122,204,.36);
        }

        .kcs-tour-btn-ghost {
            min-width: 110px;
            border: 1px solid rgba(255,255,255,.10);
            background: rgba(255,255,255,.035);
            color: #cbd5e1;
        }

        .kcs-tour-btn-ghost:hover {
            background: rgba(255,255,255,.065);
            color: white;
        }

        body.kcs-tour-active::before {
            content: "";
            position: fixed;
            inset: 0;
            z-index: 2147482000;
            background: rgba(8, 12, 18, .38);
            pointer-events: none;
        }

        body.kcs-tour-active .shepherd-element {
            z-index: 2147483000 !important;
        }

        .${ACTIVE_TARGET_CLASS} {
            position: relative !important;
            z-index: 2147482500 !important;
            outline: 2px solid rgba(0,122,204,.98) !important;
            outline-offset: 4px !important;
            border-radius: 8px !important;
            box-shadow:
                0 0 0 5px rgba(0,122,204,.22),
                0 0 26px rgba(0,122,204,.58),
                0 0 64px rgba(0,122,204,.28) !important;
            filter: none !important;
            opacity: 1 !important;
        }

        .shepherd-element.kcs-shepherd-theme {
            max-width: min(390px, calc(100vw - 32px));
            border-radius: 14px;
            border: 1px solid var(--kcs-tour-border);
            background:
                linear-gradient(145deg, rgba(45,45,48,.98), rgba(30,30,30,.98));
            color: var(--kcs-tour-text);
            box-shadow:
                0 22px 70px rgba(0,0,0,.56),
                0 0 0 1px rgba(0,122,204,.08),
                inset 0 1px 0 rgba(255,255,255,.05);
            overflow: hidden;
        }

        .shepherd-element.kcs-shepherd-theme .shepherd-content {
            background: transparent;
            border-radius: 14px;
        }

        .shepherd-element.kcs-shepherd-theme .shepherd-header {
            display: flex;
            align-items: center;
            padding: 16px 16px 6px;
            background: transparent;
        }

        .shepherd-element.kcs-shepherd-theme .shepherd-title {
            display: flex;
            align-items: center;
            gap: 9px;
            color: #ffffff;
            font-size: 14px;
            font-weight: 850;
            letter-spacing: -.01em;
        }

        .shepherd-element.kcs-shepherd-theme .shepherd-title i {
            color: #4db2ff;
            font-size: 18px;
        }

        .shepherd-element.kcs-shepherd-theme .shepherd-cancel-icon {
            color: #94a3b8;
            font-size: 20px;
            transition: color .15s ease, transform .15s ease;
        }

        .shepherd-element.kcs-shepherd-theme .shepherd-cancel-icon:hover {
            color: #ffffff;
            transform: scale(1.06);
        }

        .shepherd-element.kcs-shepherd-theme .shepherd-text {
            padding: 8px 16px 0;
            color: #cbd5e1;
            font-size: 13px;
            line-height: 1.6;
        }

        .kcs-tour-step-body p {
            margin: 0;
        }

        .kcs-tour-step-body strong {
            color: #ffffff;
        }

        .kcs-tour-progress-row {
            margin-top: 14px;
            display: grid;
            gap: 7px;
        }

        .kcs-tour-progress-row span {
            color: #8fa3b8;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: .02em;
        }

        .kcs-tour-progress-track {
            width: 100%;
            height: 5px;
            border-radius: 999px;
            overflow: hidden;
            background: rgba(255,255,255,.08);
        }

        .kcs-tour-progress-fill {
            height: 100%;
            border-radius: inherit;
            background: linear-gradient(90deg, var(--kcs-tour-blue), #4db2ff);
            box-shadow: 0 0 14px rgba(0,122,204,.45);
        }

        .shepherd-element.kcs-shepherd-theme .shepherd-footer {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            padding: 16px;
        }

        .kcs-tour-shepherd-btn {
            height: 34px;
            border-radius: 8px;
            padding: 0 12px;
            border: 1px solid transparent;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
            transition: transform .15s ease, background .15s ease, border-color .15s ease, color .15s ease;
        }

        .kcs-tour-shepherd-btn:hover {
            transform: translateY(-1px);
        }

        .kcs-tour-shepherd-btn-primary {
            background: var(--kcs-tour-blue);
            border-color: rgba(77,178,255,.45);
            color: white;
            box-shadow: 0 8px 18px rgba(0,122,204,.24);
        }

        .kcs-tour-shepherd-btn-primary:hover {
            background: var(--kcs-tour-blue-2);
        }

        .kcs-tour-shepherd-btn-secondary {
            background: rgba(255,255,255,.06);
            border-color: rgba(255,255,255,.10);
            color: #e5e7eb;
        }

        .kcs-tour-shepherd-btn-secondary:hover {
            background: rgba(255,255,255,.09);
        }

        .kcs-tour-shepherd-btn-ghost {
            margin-right: auto;
            background: transparent;
            color: #94a3b8;
            border-color: transparent;
        }

        .kcs-tour-shepherd-btn-ghost:hover {
            color: white;
            background: rgba(255,255,255,.05);
        }

        .shepherd-arrow::before {
            background: #252526 !important;
            border: 1px solid rgba(255,255,255,.08);
        }

        @keyframes kcsTourFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes kcsTourScaleIn {
            from {
                opacity: 0;
                transform: translateY(10px) scale(.98);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        @media (max-width: 720px) {
            .kcs-tour-welcome-card {
                padding: 22px;
                border-radius: 16px;
            }

            .kcs-tour-welcome-header {
                grid-template-columns: 1fr;
                gap: 14px;
            }

            .kcs-tour-pillars {
                grid-template-columns: 1fr;
            }

            .kcs-tour-welcome-actions {
                flex-direction: column-reverse;
            }

            .kcs-tour-btn {
                width: 100%;
            }

            .shepherd-element.kcs-shepherd-theme .shepherd-footer {
                flex-wrap: wrap;
            }

            .kcs-tour-shepherd-btn {
                flex: 1;
            }

            .kcs-tour-shepherd-btn-ghost {
                flex-basis: 100%;
                margin-right: 0;
            }
        }
    `;

    document.head.appendChild(style);
}