import { db } from '../db.js';
import { formatCurrency, addChart } from '../main.js';

/**
 * Renderiza a estrutura principal da página de Relatórios.
 */
export async function renderReports() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="row">
            <div class="col-lg-7 mb-4">
                <div class="card h-100">
                    <div class="card-header fw-bold">
                        <i class="bi bi-bar-chart-steps me-2"></i>Fluxo de Caixa (Últimos 6 Meses)
                    </div>
                    <div class="card-body">
                        <canvas id="fluxoCaixaChart"></canvas>
                    </div>
                </div>
            </div>
            <div class="col-lg-5 mb-4">
                <div class="card h-100">
                    <div class="card-header fw-bold">
                        <i class="bi bi-pie-chart-fill me-2"></i>Despesas por Categoria (Mês Atual)
                    </div>
                    <div class="card-body">
                        <canvas id="despesasCategoriaChart"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <div class="row mt-4">
            <div class="col-12">
                <div class="card">
                    <div class="card-header fw-bold">
                        <i class="bi bi-calendar3-range me-2"></i>Projeção de Quitação de Dívidas Parceladas
                    </div>
                    <div class="card-body">
                        <div id="projecao-dividas-list"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Carrega os dados e renderiza os gráficos
    await loadReportData();
}

/**
 * Busca os dados necessários e chama as funções para renderizar cada gráfico e relatório.
 */
async function loadReportData() {
    const [transacoes, categorias] = await Promise.all([
        db.transacoes.toArray(),
        db.categorias.toArray()
    ]);

    renderFluxoCaixaChart(transacoes.filter(t => t.status === 'pago'));
    renderDespesasCategoriaChart(transacoes.filter(t => t.status === 'pago'), categorias);
    loadProjecaoDividas(transacoes.filter(t => t.parcelaGroupId != null && t.status === 'pendente'));
}

/**
 * Renderiza o gráfico de barras de Fluxo de Caixa.
 * @param {Array} transacoesPagas - A lista de todas as transações pagas.
 */
function renderFluxoCaixaChart(transacoesPagas) {
    const ctx = document.getElementById('fluxoCaixaChart').getContext('2d');
    const labels = [];
    const receitasData = [];
    const despesasData = [];

    for (let i = 5; i >= 0; i--) {
        const month = dayjs().subtract(i, 'month');
        labels.push(month.format('MMM/YY'));
        
        const startOfMonth = month.startOf('month').valueOf();
        const endOfMonth = month.endOf('month').valueOf();

        const transacoesDoMes = transacoesPagas.filter(t => t.dataVencimento >= startOfMonth && t.dataVencimento <= endOfMonth);
        
        const receitas = transacoesDoMes
            .filter(t => t.tipo === 'receita')
            .reduce((sum, t) => sum + t.valor, 0);
        receitasData.push(receitas);

        // Despesas aqui não incluem pagamento de fatura, para não contar dobrado
        const despesas = transacoesDoMes
            .filter(t => t.tipo === 'despesa' && t.categoriaId !== -1) // categoriaId -1 é pagamento de fatura
            .reduce((sum, t) => sum + t.valor, 0);
        despesasData.push(despesas);
    }

    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Receitas',
                data: receitasData,
                backgroundColor: 'rgba(25, 135, 84, 0.7)',
                borderColor: 'rgba(25, 135, 84, 1)',
                borderWidth: 1
            }, {
                label: 'Despesas',
                data: despesasData,
                backgroundColor: 'rgba(220, 53, 69, 0.7)',
                borderColor: 'rgba(220, 53, 69, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
    addChart('fluxoCaixa', chart); // Adiciona ao gerenciador de gráficos
}

/**
 * Renderiza o gráfico de pizza de Despesas por Categoria.
 * @param {Array} transacoesPagas - A lista de todas as transações pagas.
 * @param {Array} categorias - A lista de todas as categorias.
 */
function renderDespesasCategoriaChart(transacoesPagas, categorias) {
    const ctx = document.getElementById('despesasCategoriaChart').getContext('2d');
    const startOfMonth = dayjs().startOf('month').valueOf();
    const endOfMonth = dayjs().endOf('month').valueOf();

    const despesasDoMes = transacoesPagas.filter(t =>
        t.tipo === 'despesa' &&
        t.categoriaId !== -1 && // Exclui pagamento de fatura
        t.dataVencimento >= startOfMonth &&
        t.dataVencimento <= endOfMonth
    );

    if (despesasDoMes.length === 0) {
        document.getElementById('despesasCategoriaChart').parentElement.innerHTML = '<p class="text-center text-muted mt-5">Nenhuma despesa registrada este mês.</p>';
        return;
    }

    const gastoPorCategoria = {};
    despesasDoMes.forEach(d => {
        gastoPorCategoria[d.categoriaId] = (gastoPorCategoria[d.categoriaId] || 0) + d.valor;
    });

    const categoriasMap = new Map(categorias.map(c => [c.id, c.nome]));
    const labels = Object.keys(gastoPorCategoria).map(id => categoriasMap.get(parseInt(id)) || 'Sem Categoria');
    const data = Object.values(gastoPorCategoria);

    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gasto',
                data: data,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)', 'rgba(255, 159, 64, 0.8)',
                    'rgba(201, 203, 207, 0.8)', 'rgba(21, 145, 12, 0.8)'
                ],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
        }
    });
    addChart('despesasCategoria', chart); // Adiciona ao gerenciador de gráficos
}

/**
 * Carrega e exibe a projeção de quitação de dívidas parceladas.
 * @param {Array} transacoesParceladas - A lista de transações pendentes com `parcelaGroupId`.
 */
function loadProjecaoDividas(transacoesParceladas) {
    const listEl = document.getElementById('projecao-dividas-list');
    if (transacoesParceladas.length === 0) {
        listEl.innerHTML = '<p class="text-center text-muted p-3">Nenhuma dívida parcelada ativa no momento.</p>';
        return;
    }

    // Agrupa as parcelas pela descrição base
    const dividas = {};
    transacoesParceladas.forEach(t => {
        // Remove o sufixo " (1/12)" da descrição para agrupar
        const baseDesc = t.descricao.replace(/\s\(\d+\/\d+\)$/, '');
        if (!dividas[baseDesc]) {
            dividas[baseDesc] = [];
        }
        dividas[baseDesc].push(t);
    });

    listEl.innerHTML = Object.entries(dividas).map(([desc, parcelas]) => {
        // Encontra a última parcela pela maior data de vencimento
        const ultimaParcela = parcelas.sort((a, b) => b.dataVencimento - a.dataVencimento)[0];
        const valorTotalRestante = parcelas.reduce((sum, p) => sum + p.valor, 0);

        return `
            <div class="mb-3 p-2 border-bottom">
                <h6>${desc}</h6>
                <div class="d-flex justify-content-between">
                    <span>Última parcela em: <strong>${dayjs(ultimaParcela.dataVencimento).format('MMM/YYYY')}</strong></span>
                    <span>Total restante: <strong>${formatCurrency(valorTotalRestante)}</strong></span>
                </div>
            </div>`;
    }).join('');
}