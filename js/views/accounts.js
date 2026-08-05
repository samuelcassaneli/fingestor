import { db } from '../db.js';
import { formatCurrency, showToast } from '../main.js';

export async function renderAccounts() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="mb-0">Minhas Contas</h3>
            <button class="uiverse-button" id="nova-conta-btn"><i class="bi bi-plus-circle-fill me-2"></i> Nova Conta</button>
        </div>
        <div id="contas-list" class="row"><div class="text-center p-5"><div class="spinner-border"></div></div></div>`;
    document.getElementById('nova-conta-btn').addEventListener('click', () => showContaModal());
    await loadAccounts();
}

async function loadAccounts() {
    const listEl = document.getElementById('contas-list');
    const [contas, transacoes] = await Promise.all([db.contas.toArray(), db.transacoes.where('status').equals('pago').toArray()]);
    const contasVisiveis = contas.filter(c => c.tipo !== 'credito');
    if (contasVisiveis.length === 0) {
        listEl.innerHTML = `<div class="col-12"><div class="card text-center p-4"><div class="card-body"><h5 class="card-title">Nenhuma conta cadastrada</h5><p class="card-text">Adicione suas contas para começar.</p><button class="btn btn-primary" id="add-first-conta-btn">Adicionar Conta</button></div></div></div>`;
        document.getElementById('add-first-conta-btn').addEventListener('click', () => showContaModal());
        return;
    }
    let content = '';
    for (const conta of contasVisiveis) {
        const receitas = transacoes.filter(t => t.contaId === conta.id && t.tipo === 'receita').reduce((sum, t) => sum + t.valor, 0);
        const despesas = transacoes.filter(t => t.contaId === conta.id && t.tipo === 'despesa').reduce((sum, t) => sum + t.valor, 0);
        const saldoAtual = conta.saldoInicial + receitas - despesas;
        content += `
            <div class="col-md-6 col-lg-4 mb-3">
                <div class="card h-100"><div class="card-body">
                    <div class="d-flex justify-content-between"><h5 class="card-title">${conta.nome}</h5><span class="badge text-bg-secondary">${conta.tipo}</span></div>
                    <h6 class="card-subtitle mb-2 text-muted">Saldo Atual</h6>
                    <p class="card-text fs-4 fw-bold ${saldoAtual < 0 ? 'text-danger' : ''}">${formatCurrency(saldoAtual)}</p>
                    <div class="mt-3">
                        <button class="btn btn-sm btn-outline-primary action-btn" data-id="${conta.id}" data-action="edit"><i class="bi bi-pencil"></i> Editar</button>
                        <button class="btn btn-sm btn-outline-danger action-btn" data-id="${conta.id}" data-action="delete"><i class="bi bi-trash"></i> Excluir</button>
                    </div>
                </div></div>
            </div>`;
    }
    listEl.innerHTML = content;
    listEl.addEventListener('click', handleAccountActionClick);
}

function handleAccountActionClick(e) {
    const button = e.target.closest('.action-btn');
    if (!button) return;
    const id = parseInt(button.dataset.id);
    const action = button.dataset.action;
    if (action === 'edit') showContaModal(id);
    else if (action === 'delete') deleteConta(id);
}

async function showContaModal(id = null) {
    const conta = id ? await db.contas.get(id) : {};
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
        <div class="modal fade" id="contaModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">${id ? 'Editar' : 'Nova'} Conta</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="contaForm"><input type="hidden" id="contaId" value="${conta.id || ''}"><div class="mb-3"><label for="contaNome" class="form-label">Nome da Conta</label><input type="text" class="form-control" id="contaNome" value="${conta.nome || ''}" required></div><div class="mb-3"><label for="contaSaldoInicial" class="form-label">Saldo Inicial</label><input type="number" class="form-control" id="contaSaldoInicial" step="0.01" value="${conta.saldoInicial != null ? conta.saldoInicial : ''}" required></div><div class="mb-3"><label for="contaTipo" class="form-label">Tipo de Conta</label><select class="form-select" id="contaTipo" required><option value="corrente" ${conta.tipo === 'corrente' ? 'selected' : ''}>Conta Corrente</option><option value="poupanca" ${conta.tipo === 'poupanca' ? 'selected' : ''}>Poupança</option><option value="investimento" ${conta.tipo === 'investimento' ? 'selected' : ''}>Investimento</option><option value="carteira" ${conta.tipo === 'carteira' ? 'selected' : ''}>Carteira (Dinheiro)</option><option value="divida" ${conta.tipo === 'divida' ? 'selected' : ''}>Dívida/Empréstimo</option></select></div></form></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button><button type="button" class="btn btn-primary" id="save-conta-btn">Salvar</button></div></div></div></div>`;
    const modalEl = document.getElementById('contaModal');
    const modal = new bootstrap.Modal(modalEl);
    document.getElementById('save-conta-btn').addEventListener('click', async () => {
        const id = document.getElementById('contaId').value;
        const data = {
            nome: document.getElementById('contaNome').value, saldoInicial: parseFloat(document.getElementById('contaSaldoInicial').value),
            tipo: document.getElementById('contaTipo').value,
        };
        if (!data.nome || isNaN(data.saldoInicial)) { showToast('Erro', 'Nome e Saldo Inicial são obrigatórios.', 'error'); return; }
        if (id) await db.contas.update(parseInt(id), data);
        else await db.contas.add(data);
        showToast('Sucesso', `Conta ${id ? 'atualizada' : 'criada'}!`);
        modal.hide();
        await loadAccounts();
    });
    modalEl.addEventListener('hidden.bs.modal', () => modalContainer.innerHTML = '');
    modal.show();
}

async function deleteConta(id) {
    const count = await db.transacoes.where('contaId').equals(id).count();
    if (count > 0) { alert(`Não é possível excluir esta conta, pois ela possui ${count} transação(ões) associada(s).`); return; }
    if (confirm('Tem certeza que deseja excluir esta conta?')) {
        await db.contas.delete(id);
        showToast('Sucesso', 'Conta excluída!');
        await loadAccounts();
    }
}