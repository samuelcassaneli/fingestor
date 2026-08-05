import { db } from '../db.js';
import { formatCurrency, formatDate, showToast } from '../main.js';

export async function renderCards() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="mb-0">Meus Cartões de Crédito</h3>
            <button class="uiverse-button" id="novo-cartao-btn"><i class="bi bi-plus-circle-fill me-2"></i> Novo Cartão</button>
        </div>
        <div id="cartoes-list" class="row"><div class="text-center p-5"><div class="spinner-border"></div></div></div>`;
    document.getElementById('novo-cartao-btn').addEventListener('click', () => showCartaoModal());
    await loadCards();
}

async function loadCards() {
    const listEl = document.getElementById('cartoes-list');
    const [cartoes, transacoes] = await Promise.all([db.cartoes.toArray(), db.transacoes.where('cartaoId').above(0).toArray()]);

    if (cartoes.length === 0) {
        listEl.innerHTML = `<div class="col-12"><div class="card text-center p-4"><div class="card-body"><h5 class="card-title">Nenhum cartão cadastrado</h5><p class="card-text">Adicione seu primeiro cartão de crédito.</p><button class="btn btn-primary" id="add-first-cartao-btn">Adicionar Cartão</button></div></div></div>`;
        document.getElementById('add-first-cartao-btn').addEventListener('click', () => showCartaoModal());
        return;
    }

    // Otimização: Agrupar transações por cartão
    const transacoesPorCartao = new Map();
    for (const t of transacoes) {
        if (!transacoesPorCartao.has(t.cartaoId)) {
            transacoesPorCartao.set(t.cartaoId, []);
        }
        transacoesPorCartao.get(t.cartaoId).push(t);
    }

    let content = '';
    for (const cartao of cartoes) {
        const hoje = dayjs();
        const transacoesDoCartao = transacoesPorCartao.get(cartao.id) || [];

        // Lógica de datas da fatura
        let dataVencimentoFechada = hoje.date(cartao.diaVencimento);
        if (hoje.date() > cartao.diaVencimento) dataVencimentoFechada = dataVencimentoFechada.add(1, 'month');
        const dataFechamentoPassado = dataVencimentoFechada.subtract(1, 'month').date(cartao.diaFechamento);
        const inicioFaturaFechada = dataFechamentoPassado.subtract(1, 'month').add(1, 'day').startOf('day');
        const fimFaturaFechada = dataFechamentoPassado.endOf('day');
        const dataFechamentoAtual = dataFechamentoPassado.add(1, 'month');
        const inicioFaturaAberta = dataFechamentoPassado.add(1, 'day').startOf('day');
        const fimFaturaAberta = dataFechamentoAtual.endOf('day');

        // Cálculos otimizados
        let gastosFaturaFechada = 0;
        let gastosFaturaAberta = 0;
        let totalParcelasFuturas = 0;

        for (const t of transacoesDoCartao) {
            const dataTransacao = dayjs(t.data);
            if (t.status === 'pendente' && dataTransacao.isBetween(inicioFaturaFechada, fimFaturaFechada, null, '[]')) {
                gastosFaturaFechada += t.valor;
            }
            if (dataTransacao.isBetween(inicioFaturaAberta, fimFaturaAberta, null, '[]')) {
                gastosFaturaAberta += t.valor;
            }
            if (t.parcelaGroupId && dayjs(t.dataVencimento).isAfter(fimFaturaAberta)) {
                totalParcelasFuturas += t.valor;
            }
        }

        const limiteComprometido = gastosFaturaAberta + totalParcelasFuturas;
        const limiteDisponivel = cartao.limite - limiteComprometido;

        content += `
            <div class="col-lg-6 col-md-12 mb-4">
                <div class="card h-100"><div class="card-body d-flex flex-column">
                    <div class="d-flex justify-content-between align-items-start">
                        <div><h5 class="card-title mb-0">${cartao.nome}</h5><small class="text-muted">Fecha dia ${cartao.diaFechamento} | Vence dia ${cartao.diaVencimento}</small></div>
                        <div>
                            <button class="btn btn-sm btn-outline-primary action-btn" data-id="${cartao.id}" data-action="edit" title="Editar"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger action-btn" data-id="${cartao.id}" data-action="delete" title="Excluir"><i class="bi bi-trash"></i></button>
                        </div>
                    </div><hr>
                    <div class="mb-3">
                        <div class="d-flex justify-content-between align-items-center"><span class="fw-bold">Fatura Fechada</span><strong class="text-danger fs-5">${formatCurrency(gastosFaturaFechada)}</strong></div>
                        <div class="d-flex justify-content-between align-items-center text-muted"><span>Fatura Aberta</span><strong class="fs-6">${formatCurrency(gastosFaturaAberta)}</strong></div>
                    </div>
                    <div class="mt-auto">
                        <div class="progress mb-2" style="height: 10px;"><div class="progress-bar bg-danger" role="progressbar" style="width: ${(limiteComprometido / cartao.limite * 100).toFixed(2)}%;" title="Limite Comprometido"></div></div>
                        <div class="d-flex justify-content-between small"><span>Disponível: <strong>${formatCurrency(limiteDisponivel)}</strong></span><span>Total: ${formatCurrency(cartao.limite)}</span></div>
                    </div>
                </div></div>
            </div>`;
    }
    listEl.innerHTML = content;
    listEl.addEventListener('click', handleCardActionClick);
}

function handleCardActionClick(e) {
    const button = e.target.closest('.action-btn');
    if (!button) return;
    const id = parseInt(button.dataset.id);
    const action = button.dataset.action;
    if (action === 'edit') showCartaoModal(id);
    else if (action === 'delete') deleteCartao(id);
}

async function showCartaoModal(id = null) {
    const cartao = id ? await db.cartoes.get(id) : {};
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
        <div class="modal fade" id="cartaoModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">${id ? 'Editar' : 'Novo'} Cartão</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="cartaoForm"><input type="hidden" id="cartaoId" value="${cartao.id || ''}"><div class="mb-3"><label for="cartaoNome" class="form-label">Nome do Cartão</label><input type="text" class="form-control" id="cartaoNome" value="${cartao.nome || ''}" required></div><div class="mb-3"><label for="cartaoLimite" class="form-label">Limite Total</label><input type="number" step="0.01" class="form-control" id="cartaoLimite" value="${cartao.limite || ''}" required></div><div class="row"><div class="col-6"><label for="cartaoDiaFechamento" class="form-label">Dia do Fechamento</label><input type="number" class="form-control" id="cartaoDiaFechamento" value="${cartao.diaFechamento || ''}" min="1" max="31" required></div><div class="col-6"><label for="cartaoDiaVencimento" class="form-label">Dia do Vencimento</label><input type="number" class="form-control" id="cartaoDiaVencimento" value="${cartao.diaVencimento || ''}" min="1" max="31" required></div></div></form></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button><button type="button" class="btn btn-primary" id="save-cartao-btn">Salvar</button></div></div></div></div>`;
    const modalEl = document.getElementById('cartaoModal');
    const modal = new bootstrap.Modal(modalEl);
    document.getElementById('save-cartao-btn').addEventListener('click', async () => {
        const id = document.getElementById('cartaoId').value;
        const data = {
            nome: document.getElementById('cartaoNome').value, limite: parseFloat(document.getElementById('cartaoLimite').value),
            diaFechamento: parseInt(document.getElementById('cartaoDiaFechamento').value), diaVencimento: parseInt(document.getElementById('cartaoDiaVencimento').value)
        };
        if (!data.nome || !data.limite || !data.diaFechamento || !data.diaVencimento) { showToast('Erro', 'Todos os campos são obrigatórios.', 'error'); return; }
        if (id) await db.cartoes.update(parseInt(id), data);
        else await db.cartoes.add(data);
        showToast('Sucesso', `Cartão ${id ? 'atualizado' : 'criado'}!`);
        modal.hide();
        await loadCards();
    });
    modalEl.addEventListener('hidden.bs.modal', () => modalContainer.innerHTML = '');
    modal.show();
}

async function deleteCartao(id) {
    const count = await db.transacoes.where('cartaoId').equals(id).count();
    if (count > 0) { alert(`Não é possível excluir este cartão, pois ele possui ${count} transação(ões) associada(s).`); return; }
    if (confirm('Tem certeza que deseja excluir este cartão?')) {
        await db.cartoes.delete(id);
        showToast('Sucesso', 'Cartão excluído!');
        await loadCards();
    }
}