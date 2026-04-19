/**
 * js/tour.js — Módulo de Onboarding Guiado (Premium UX)
 */
import { TENANT_KEYS } from './config.js';
import { showToast } from './ui/render.js';

export function initTour(force = false) {
    if (!force && localStorage.getItem('kcs_tour_v4_completed') === 'true') return;
    if (document.getElementById('kcs-welcome-modal')) return;
    
    const companyName = (typeof TENANT_KEYS !== 'undefined' && sessionStorage.getItem(TENANT_KEYS.COMPANY_NAME)) || 'nossa empresa';
    
    const welcomeModalHtml = `
    <div id="kcs-welcome-modal" class="fixed inset-0 bg-gray-900/60 dark:bg-black/80 backdrop-blur-sm z-[5000] flex items-center justify-center p-4 animate-fade-in">
        <div class="bg-white dark:bg-[#14161b]/95 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-3xl max-w-lg p-8 sm:p-10 shadow-2xl dark:shadow-[0_0_50px_rgba(0,0,0,0.5)] text-center relative overflow-hidden">
            <div class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-blue-500/10 dark:bg-blue-500/20 blur-[60px] pointer-events-none"></div>
            
            <div class="text-5xl mb-4 relative z-10 animate-bounce-slight">💡</div>
            <h2 class="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mb-3 tracking-tight relative z-10">Bem-vindo ao KCS Hub</h2>
            
            <div class="text-gray-600 dark:text-gray-300 text-sm mb-6 leading-relaxed relative z-10">
                <p>O <strong>Knowledge-Centered Service (KCS)</strong> é a metodologia que transforma a forma como resolvemos problemas. Integramos a criação de conhecimento ao nosso fluxo de atendimento diário.</p>
                <p class="mt-4 text-[15px] text-gray-900 dark:text-white font-bold bg-gray-100 dark:bg-white/5 py-2 px-4 rounded-lg inline-block border border-gray-200 dark:border-white/10">Nosso princípio: "Capture enquanto resolve."</p>
            </div>
            
            <div class="text-left bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5 p-5 rounded-2xl mt-6 shadow-inner text-[13px] sm:text-sm relative z-10">
                <div class="grid grid-cols-[auto_1fr] gap-x-3 sm:gap-x-4 gap-y-4 items-start">
                    <strong class="text-blue-600 dark:text-blue-400 whitespace-nowrap">1. Capturar:</strong> 
                    <span class="text-gray-700 dark:text-gray-300">Registre o problema com as exatas palavras do usuário.</span>
                    
                    <strong class="text-purple-600 dark:text-purple-400 whitespace-nowrap">2. Estruturar:</strong> 
                    <span class="text-gray-700 dark:text-gray-300">Foque na solução; a IA estrutura o texto para você.</span>
                    
                    <strong class="text-green-600 dark:text-green-400 whitespace-nowrap">3. Reutilizar:</strong> 
                    <span class="text-gray-700 dark:text-gray-300">Pesquise sempre na base antes de criar algo novo.</span>
                    
                    <strong class="text-yellow-600 dark:text-yellow-400 whitespace-nowrap">4. Melhorar:</strong> 
                    <span class="text-gray-700 dark:text-gray-300">Achou um erro ou desatualização? Corrija ou reporte!</span>
                </div>
            </div>
            
            <div class="flex gap-3 sm:gap-4 relative z-10 mt-8">
                <button id="btn-skip-tour" class="flex-1 bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-semibold py-3 rounded-xl border border-gray-300 dark:border-white/10 transition-all text-sm shadow-sm dark:shadow-none">Pular</button>
                <button id="btn-start-tour" class="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] border border-blue-600 transition-all transform hover:-translate-y-0.5 text-sm">Iniciar Tour Guiado</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', welcomeModalHtml);
    
    document.getElementById('btn-skip-tour')?.addEventListener('click', () => { 
        localStorage.setItem('kcs_tour_v4_completed', 'true'); 
        document.getElementById('kcs-welcome-modal')?.remove(); 
    });
    
    document.getElementById('btn-start-tour')?.addEventListener('click', async () => { 
        document.getElementById('kcs-welcome-modal')?.remove(); 
        if(window.__kcs && window.__kcs.switchToDashboard) { window.__kcs.switchToDashboard(); }
        setTimeout(executePremiumTour, 600); 
    });
}

function executePremiumTour() {
    if (typeof Shepherd === 'undefined') return;
    
    const tour = new Shepherd.Tour({ 
        useModalOverlay: true, 
        defaultStepOptions: { 
            cancelIcon: { enabled: true },
            scrollTo: { behavior: 'smooth', block: 'center' } 
        } 
    });
    
    tour.addStep({ 
        id: 'step-search', 
        title: '<i class="ph-fill ph-magnifying-glass text-blue-400"></i> Busca Inteligente (IA)', 
        text: 'Busque <strong>antes</strong> de criar! Nossa IA varre a base para trazer respostas contextuais instantaneamente.', 
        attachTo: { element: '#search-input', on: 'bottom' }, 
        buttons: [{ action: () => tour.cancel(), text: 'Pular', classes: 'tour-btn-back' }, { action: () => tour.next(), text: 'Próximo ➔', classes: 'tour-btn-next' }] 
    });
    
    tour.addStep({ 
        id: 'step-new', 
        title: '<i class="ph-fill ph-pencil-line text-purple-400"></i> Capture Enquanto Resolve', 
        text: 'Não encontrou? Crie um registro rápido focado em <strong>Sintoma, Causa e Solução</strong>.', 
        attachTo: { element: '#btn-new-article', on: 'right' }, 
        buttons: [{ action: () => tour.back(), text: '⬅ Voltar', classes: 'tour-btn-back' }, { action: () => tour.next(), text: 'Próximo ➔', classes: 'tour-btn-next' }] 
    });

    tour.addStep({ 
        id: 'step-governance', 
        title: '<i class="ph-fill ph-shield-check text-green-400"></i> Ciclo do Conhecimento', 
        text: 'Acompanhe seus artigos desde o <strong>Rascunho</strong> até serem <strong>Publicados</strong> oficialmente.', 
        attachTo: { element: '#tour-base-conhecimento', on: 'right' }, 
        buttons: [{ action: () => tour.back(), text: '⬅ Voltar', classes: 'tour-btn-back' }, { action: () => tour.next(), text: 'Próximo ➔', classes: 'tour-btn-next' }] 
    });

    tour.addStep({ 
        id: 'step-categories', 
        title: '<i class="ph-fill ph-folders text-orange-400"></i> Categorias', 
        text: 'Navegue pelos departamentos e áreas para encontrar o que precisa rapidamente.', 
        attachTo: { element: '#tour-categorias', on: 'right' }, 
        buttons: [{ action: () => tour.back(), text: '⬅ Voltar', classes: 'tour-btn-back' }, { action: () => tour.next(), text: 'Próximo ➔', classes: 'tour-btn-next' }] 
    });

    tour.addStep({ 
        id: 'step-sql', 
        title: '<i class="ph-fill ph-database text-blue-500"></i> Biblioteca SQL', 
        text: 'Gerencie scripts de banco com segurança e use a IA para explicar códigos complexos.', 
        attachTo: { element: '#tour-sql', on: 'right' }, 
        buttons: [{ action: () => tour.back(), text: '⬅ Voltar', classes: 'tour-btn-back' }, { action: () => tour.next(), text: 'Próximo ➔', classes: 'tour-btn-next' }] 
    });
    
    tour.addStep({ 
        id: 'step-dashboard', 
        title: '<i class="ph-fill ph-chart-line-up text-yellow-400"></i> O Seu Impacto Real', 
        text: 'Veja estatísticas de acessos, qualidade e seu ranking de contribuição na base.', 
        attachTo: { element: '#dashboard-container', on: 'top' }, 
        buttons: [{ action: () => tour.back(), text: '⬅ Voltar', classes: 'tour-btn-back' }, { action: () => tour.next(), text: 'Próximo ➔', classes: 'tour-btn-next' }] 
    });

    tour.addStep({ 
        id: 'step-notifications', 
        title: '<i class="ph-fill ph-bell-ringing text-red-400"></i> Notificações', 
        text: 'Receba alertas em tempo real sobre aprovações e atualizações importantes.', 
        attachTo: { element: '#btn-notif', on: 'bottom' }, 
        buttons: [{ action: () => tour.back(), text: '⬅ Voltar', classes: 'tour-btn-back' }, { action: () => tour.next(), text: 'Próximo ➔', classes: 'tour-btn-next' }] 
    });

    tour.addStep({ 
        id: 'step-profile', 
        title: '<i class="ph-fill ph-user-circle text-gray-500"></i> Perfil e Temas', 
        text: 'Alterne entre os Temas Claro e Escuro e acesse as configurações de administração.', 
        attachTo: { element: '#btn-profile', on: 'bottom' }, 
        buttons: [{ action: () => tour.back(), text: '⬅ Voltar', classes: 'tour-btn-back' }, { action: () => tour.next(), text: 'Próximo ➔', classes: 'tour-btn-next' }] 
    });

    tour.addStep({ 
        id: 'step-chatbot', 
        title: '<i class="ph-fill ph-robot text-indigo-400"></i> Assistente IA Especialista', 
        text: 'Dúvidas rápidas? O Chatbot entrega a solução pronta baseada em toda a nossa base.', 
        attachTo: { element: '#btn-toggle-chatbot', on: 'top' }, // ID ATUALIZADO E POSIÇÃO TOP
        buttons: [{ action: () => tour.back(), text: '⬅ Voltar', classes: 'tour-btn-back' }, { action: () => tour.complete(), text: 'Finalizar 🎉', classes: 'tour-btn-finish' }] 
    });
    
    tour.on('complete', () => { localStorage.setItem('kcs_tour_v4_completed', 'true'); showToast('Pronto para decolar!', 'success'); });
    tour.start();
}