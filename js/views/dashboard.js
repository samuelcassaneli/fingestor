import { db } from '../db.js';
import { formatCurrency, formatDate } from '../main.js';
// CORREÇÃO: A função agora é importada, não mais definida aqui.
import { showOperacaoModal } from './transactions.js';

export async function renderDashboard() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="row">
            <div class="col-xl-3 col-lg-6 col-md-6 mb-4"><div class="card card-dashboard h-100 border-start-primary"><div class="card-body"><div class="card-content"><div class="text-xs fw-bold text-primary text-uppercase mb-1">Saldo Total</div><div id="saldo-total" class="h5 mb-0 fw-bold text-body-secondary">...</div></div><div class="card-icon"><i class="bi bi-safe-fill"></i></div></div></div></div>
            <div class="col-xl-3 col-lg-6 col-md-6 mb-4"><div class="card card-dashboard h-100 border-start-success"><div class="card-body"><div class="card-content"><div class="text-xs fw-bold text-success text-uppercase mb-1">Receitas (Mês)</div><div id="receitas-mes" class="h5 mb-0 fw-bold text-body-secondary">...</div></div><div class="card-icon"><i class="bi bi-graph-up-arrow"></i></div></div></div></div>
            <div class="col-xl-3 col-lg-6 col-md-6 mb-4"><div class="card card-dashboard h-100 border-start-danger"><div class="card-body"><div class="card-content"><div class="text-xs fw-bold text-danger text-uppercase mb-1">Despesas (Mês)</div><div id="despesas-mes" class="h5 mb-0 fw-bold text-body-secondary">...</div></div><div class="card-icon"><i class="bi bi-graph-down-arrow"></i></div></div></div></div>
            <div class="col-xl-3 col-lg-6 col-md-6 mb-4"><div class="card card-dashboard h-100 border-start-info"><div class="card-body"><div class="card-content"><div class="text-xs fw-bold text-info text-uppercase mb-1">Faturas Abertas</div><div id="faturas-abertas" class="h5 mb-0 fw-bold text-body-secondary">...</div></div><div class="card-icon"><i class="bi bi-credit-card-fill"></i></div></div></div></div>
        </div>
        <div class="row"><div class="col-12"><div class="card"><div class="card-header fw-bold"><i class="bi bi-calendar-range me-2"></i>Próximos 30 Dias</div><div class="card-body p-0"><div id="contas-futuras-list" class="list-group list-group-flush"></div></div></div></div></div>`;
    
    await loadDashboardData();
}

async function loadDashboardData() {
    const now = dayjs();
    const startOfMonth = now.startOf('month').valueOf();
    const endOfMonth = now.endOf('month').valueOf();
    
    const [contas, transacoes, cartoes] = await Promise.all([
        db.contas.toArray(), db.transacoes.toArray(), db.cartoes.toArray()
    ]);
    
    let saldoTotal = 0;
    const contasReais = contas.filter(c => c.tipo !== 'credito');
    for (const conta of contasReais) {
        const receitas = transacoes.filter(t => t.contaId === conta.id && t.tipo === 'receita' && t.status === 'pago').reduce((sum, t) => sum + t.valor, 0);
        const despesas = transacoes.filter(t => t.contaId === conta.id && t.tipo === 'despesa' && t.status === 'pago').reduce((sum, t) => sum + t.valor, 0);
        saldoTotal += conta.saldoInicial + receitas - despesas;
    }
    document.getElementById('saldo-total').textContent = formatCurrency(saldoTotal);

    const receitasMes = transacoes.filter(t => t.tipo === 'receita' && t.status === 'pago' && t.dataVencimento >= startOfMonth && t.dataVencimento <= endOfMonth).reduce((sum, t) => sum + t.valor, 0);
    document.getElementById('receitas-mes').textContent = formatCurrency(receitasMes);

    const despesasMes = transacoes.filter(t => t.tipo === 'despesa' && t.status === 'pago' && t.categoriaId !== -1 && t.dataVencimento >= startOfMonth && t.dataVencimento <= endOfMonth).reduce((sum, t) => sum + t.valor, 0);
    document.getElementById('despesas-mes').textContent = formatCurrency(despesasMes);

    let totalFaturasAbertas = 0;
    for (const cartao of cartoes) {
        let dataFechamento = now.date(cartao.diaFechamento);
        if (now.date() > cartao.diaFechamento) dataFechamento = dataFechamento.add(1, 'month');
        const inicioFatura = dataFechamento.subtract(1, 'month').add(1, 'day').startOf('day');
        const fimFatura = dataFechamento.endOf('day');
        totalFaturasAbertas += transacoes.filter(t => t.cartaoId === cartao.id && dayjs(t.data).isBetween(inicioFatura, fimFatura, null, '[]')).reduce((sum, t) => sum + t.valor, 0);
    }
    document.getElementById('faturas-abertas').textContent = formatCurrency(totalFaturasAbertas);
    
    const end30days = now.add(30, 'days').endOf('day').valueOf();
    const contasFuturas = transacoes.filter(t => t.status === 'pendente' && t.dataVencimento >= now.startOf('day').valueOf() && t.dataVencimento <= end30days).sort((a, b) => a.dataVencimento - b.dataVencimento);
    const listEl = document.getElementById('contas-futuras-list');
    if (contasFuturas.length > 0) {
        listEl.innerHTML = contasFuturas.map(t => `<div class="list-group-item d-flex justify-content-between align-items-center"><div><span class="fw-bold">${t.descricao}</span><small class="d-block text-muted">Vence em: ${formatDate(t.dataVencimento)}</small></div><span class="fw-bold fs-6 ${t.tipo === 'despesa' ? 'text-danger' : 'text-success'}">${t.tipo === 'despesa' ? '-' : '+'} ${formatCurrency(t.valor)}</span></div>`).join('');
    } else {
        listEl.innerHTML = '<div class="list-group-item text-center text-muted p-4">Nenhuma conta pendente para os próximos 30 dias.</div>';
    }
}