// A importação de 'showOperacaoModal' de dashboard.js foi REMOVIDA
import { renderDashboard } from './views/dashboard.js';
// A importação de 'showOperacaoModal' foi MOVIDA para transactions.js
import { renderTransactions, showOperacaoModal } from './views/transactions.js';
import { renderCards } from './views/cards.js';
import { renderReports } from './views/reports.js';
import { renderAccounts } from './views/accounts.js';
import { renderCategories } from './views/categories.js';
import { renderGoals } from './views/goals.js';
import { renderSettings } from './views/settings.js';

// --- ESTADO DA APLICAÇÃO ---
let currentChartInstances = {};

// --- FUNÇÕES UTILITÁRIAS GLOBAIS (EXPORTADAS) ---
export const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
export const formatDate = (timestamp) => dayjs(timestamp).format('DD/MM/YYYY');

export const showToast = (title, message, type = 'success') => {
    const toastEl = document.getElementById('appToast');
    const toastTitle = document.getElementById('toast-title');
    const toastBody = document.getElementById('toast-body');
    toastEl.className = 'toast';
    const header = toastEl.querySelector('.toast-header');
    header.className = 'toast-header';
    if (type === 'success') { toastEl.classList.add('text-bg-success'); header.classList.add('text-bg-success'); }
    else if (type === 'error') { toastEl.classList.add('text-bg-danger'); header.classList.add('text-bg-danger'); }
    else if (type === 'warning') { toastEl.classList.add('text-bg-warning', 'text-dark'); header.classList.add('text-bg-warning', 'text-dark'); }
    toastTitle.textContent = title;
    toastBody.textContent = message;
    new bootstrap.Toast(toastEl).show();
};

export const clearCharts = () => {
    Object.values(currentChartInstances).forEach(chart => chart.destroy());
    currentChartInstances = {};
};

export const addChart = (name, instance) => {
    if (currentChartInstances[name]) currentChartInstances[name].destroy();
    currentChartInstances[name] = instance;
};

// --- ROTEADOR PRINCIPAL (RENDER VIEW) ---
export const renderView = async (section) => {
    try {
        const mainContent = document.getElementById('main-content');
        document.getElementById('section-title').textContent = section.charAt(0).toUpperCase() + section.slice(1);
        clearCharts();
        mainContent.innerHTML = `<div class="d-flex justify-content-center align-items-center" style="height: 80vh;"><div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"><span class="visually-hidden">Carregando...</span></div></div>`;
        document.querySelectorAll('.nav-link').forEach(link => {
            link.parentElement.classList.remove('active');
            if (link.dataset.section === section) link.parentElement.classList.add('active');
        });
        const renderMap = {
            dashboard: renderDashboard, transactions: renderTransactions, cards: renderCards,
            reports: renderReports, accounts: renderAccounts, categories: renderCategories,
            goals: renderGoals, settings: renderSettings
        };
        if (renderMap[section]) await renderMap[section]();
        else await renderMap.dashboard();
    } catch (error) {
        console.error(`Erro ao renderizar a seção ${section}:`, error);
        document.getElementById('main-content').innerHTML = `<div class="alert alert-danger"><h4 class="alert-heading">Ocorreu um Erro!</h4><p>Não foi possível carregar a seção "${section}".</p></div>`;
        showToast('Erro Crítico', `Falha ao carregar a seção: ${section}`, 'error');
    }
};

// --- GERENCIAMENTO DE TEMA ---
const setupTheme = () => {
    const themeSwitcher = document.getElementById('theme-switcher');
    const htmlEl = document.documentElement;
    const setTheme = (theme) => {
        htmlEl.setAttribute('data-bs-theme', theme);
        localStorage.setItem('theme', theme);
        themeSwitcher.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', btn.dataset.theme === theme));
    };
    themeSwitcher.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (button && button.dataset.theme) setTheme(button.dataset.theme);
    });
    setTheme(localStorage.getItem('theme') || 'dark');
};

// --- LÓGICA DA SIDEBAR RESPONSIVA ---
const setupSidebar = () => {
    const sidebar = document.getElementById('sidebar');
    const content = document.getElementById('content');
    const overlay = document.getElementById('sidebar-overlay');
    const collapseBtn = document.getElementById('sidebarCollapse');
    const setSidebarState = (isCollapsed) => {
        sidebar.classList.toggle('collapsed', isCollapsed);
        content.classList.toggle('collapsed', isCollapsed);
    };
    const toggleMobileSidebar = (show) => {
        sidebar.classList.toggle('toggled', show);
        overlay.classList.toggle('active', show);
    };
    const adjustSidebarOnResize = () => {
        const screenWidth = window.innerWidth;
        if (screenWidth <= 767.98) {
            setSidebarState(false);
        } else if (screenWidth <= 1399.98) {
            setSidebarState(true);
        } else {
            setSidebarState(false);
        }
    };
    collapseBtn.addEventListener('click', () => {
        if (window.innerWidth <= 767.98) toggleMobileSidebar(true);
        else setSidebarState(!sidebar.classList.contains('collapsed'));
    });
    overlay.addEventListener('click', () => toggleMobileSidebar(false));
    document.querySelectorAll('#sidebar .nav-link').forEach(link => {
        link.addEventListener('click', () => { if (window.innerWidth <= 767.98) toggleMobileSidebar(false); });
    });
    window.addEventListener('resize', adjustSidebarOnResize);
    adjustSidebarOnResize();
};

// --- EVENTOS GLOBAIS DA UI ---
const setupGlobalUIEvents = () => {
    document.getElementById('nova-operacao-btn-desktop').addEventListener('click', showOperacaoModal);
    document.getElementById('nova-operacao-btn-mobile').addEventListener('click', showOperacaoModal);
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => { e.preventDefault(); renderView(e.currentTarget.dataset.section); });
    });
};

// --- REGISTRO DO SERVICE WORKER (PWA) ---
const registerServiceWorker = () => {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('ServiceWorker registrado:', reg.scope))
                .catch(err => console.log('Falha no registro do ServiceWorker:', err));
        });
    }
};

// --- PONTO DE ENTRADA DA APLICAÇÃO ---
function initializeApp() {
    setupTheme();
    setupSidebar();
    setupGlobalUIEvents();
    registerServiceWorker();
    renderView('dashboard');
}
initializeApp();