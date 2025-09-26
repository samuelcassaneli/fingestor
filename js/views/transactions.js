import { db } from '../db.js';
import { formatCurrency, formatDate, showToast } from '../main.js';

// --- ESTADO LOCAL E MAPAS DE DADOS ---
let transacoesCache = [], categoriasMap = new Map(), contasMap = new Map(), cartoesMap = new Map(), currentSort = { key: 'dataVencimento', order: 'desc' };

/**
 * Função auxiliar para recarregar a view atual após uma operação.
 */
async function refreshCurrentView() {
    const activeLink = document.querySelector('#sidebar .components li.active a');
    const section = activeLink ? activeLink.dataset.section : 'dashboard';
    // Importação dinâmica para evitar dependência circular
    const { renderView } = await import('../main.js');
    await renderView(section);
}

// --- RENDERIZAÇÃO DA PÁGINA DE TRANSAÇÕES ---
export async function renderTransactions() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="card">
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead id="transacoes-table-head">
                            <tr>
                                <th class="sortable" data-sort="descricao">Descrição</th>
                                <th class="sortable" data-sort="valor">Valor</th>
                                <th class="sortable" data-sort="dataVencimento">Vencimento</th>
                                <th class="sortable" data-sort="status">Status</th>
                                <th>Categoria</th>
                                <th>Conta/Cartão</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody id="transacoes-table-body">
                            <tr><td colspan="7" class="text-center p-5"><div class="spinner-border"></div></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
    await loadAndDisplayTransactions();
}

async function loadAndDisplayTransactions() {
    const [transacoes, categorias, contas, cartoes] = await Promise.all([db.transacoes.toArray(), db.categorias.toArray(), db.contas.toArray(), db.cartoes.toArray()]);
    transacoesCache = transacoes;
    categoriasMap = new Map(categorias.map(c => [c.id, c]));
    contasMap = new Map(contas.map(c => [c.id, c]));
    cartoesMap = new Map(cartoes.map(c => [c.id, c]));
    
    document.getElementById('transacoes-table-head').addEventListener('click', (e) => {
        const header = e.target.closest('th'); if (!header || !header.classList.contains('sortable')) return;
        const key = header.dataset.sort;
        if (currentSort.key === key) currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
        else { currentSort.key = key; currentSort.order = 'asc'; }
        applyFiltersAndRenderTable();
    });
    applyFiltersAndRenderTable();
}

function applyFiltersAndRenderTable() {
    let filtered = [...transacoesCache];
    filtered.sort((a, b) => {
        let valA = a[currentSort.key], valB = b[currentSort.key];
        if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }
        if (valA < valB) return currentSort.order === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.order === 'asc' ? 1 : -1;
        return 0;
    });
    document.querySelectorAll('#transacoes-table-head th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === currentSort.key) th.classList.add(currentSort.order === 'asc' ? 'sort-asc' : 'sort-desc');
    });
    const tbody = document.getElementById('transacoes-table-body');
    if (filtered.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="text-center p-4">Nenhuma transação encontrada.</td></tr>'; return; }
    tbody.innerHTML = filtered.map(t => {
        const categoria = categoriasMap.get(t.categoriaId);
        let contaNome = '';
        if (t.contaId) contaNome = contasMap.get(t.contaId)?.nome || '';
        else if (t.cartaoId) contaNome = `💳 ${cartoesMap.get(t.cartaoId)?.nome || ''}`;
        return `
            <tr>
                <td>${t.descricao}</td><td class="fw-bold ${t.tipo === 'receita' ? 'text-success' : 'text-danger'}">${formatCurrency(t.valor)}</td>
                <td>${formatDate(t.dataVencimento)}</td><td><span class="badge ${t.status === 'pago' ? 'bg-success-subtle text-success-emphasis' : 'bg-warning-subtle text-warning-emphasis'}">${t.status}</span></td>
                <td>${categoria ? `<i class="bi ${categoria.icone || 'bi-tag'}"></i> ${categoria.nome}` : (t.categoriaId === -1 ? '<i>Pag. Fatura</i>' : 'N/A')}</td>
                <td>${contaNome || 'N/A'}</td>
                <td>
                    ${t.status === 'pendente' ? `<button class="btn btn-sm btn-outline-success action-btn" data-id="${t.id}" data-action="pay" title="Marcar como Pago"><i class="bi bi-check-lg"></i></button>` : ''}
                    <button class="btn btn-sm btn-outline-danger action-btn" data-id="${t.id}" data-action="delete" title="Excluir"><i class="bi bi-trash-fill"></i></button>
                </td>
            </tr>`;
    }).join('');
    tbody.addEventListener('click', handleTransactionActionClick);
}

async function handleTransactionActionClick(e) {
    const button = e.target.closest('.action-btn'); if (!button) return;
    const id = parseInt(button.dataset.id), action = button.dataset.action;
    if (action === 'pay') {
        if (confirm('Deseja marcar esta transação como paga?')) { await db.transacoes.update(id, { status: 'pago' }); showToast('Sucesso', 'Transação paga!'); await refreshCurrentView(); }
    } else if (action === 'delete') {
        const transacao = await db.transacoes.get(id); let confirmed = false;
        if (transacao.parcelaGroupId) {
            confirmed = confirm('Esta é uma transação parcelada. Pressione "OK" para excluir TODAS as parcelas futuras relacionadas.');
            if (confirmed) { const allRelated = await db.transacoes.where({ parcelaGroupId: transacao.parcelaGroupId }).filter(t => t.dataVencimento >= transacao.dataVencimento).toArray(); await db.transacoes.bulkDelete(allRelated.map(t => t.id)); showToast('Sucesso', `Todas as ${allRelated.length} parcelas futuras foram excluídas!`); }
        } else {
            confirmed = confirm('Tem certeza que deseja excluir esta transação?');
            if (confirmed) { await db.transacoes.delete(id); showToast('Sucesso', 'Transação excluída!'); }
        }
        if (confirmed) await refreshCurrentView();
    }
}

// --- LÓGICA DE MODAIS DE OPERAÇÃO (CENTRALIZADA E CORRIGIDA) ---

/**
 * Exibe o modal inicial de escolha de operação.
 * A lógica foi reescrita para evitar a "race condition".
 */
export function showOperacaoModal() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `<div class="modal fade" id="operacaoChoiceModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header border-0"><h5 class="modal-title">Registrar</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body d-grid gap-3"><button id="btn-receita-despesa" class="btn btn-outline-primary btn-lg p-3"><i class="bi bi-cash-coin me-2"></i> Receita/Despesa</button><button id="btn-compra-cartao" class="btn btn-outline-info btn-lg p-3"><i class="bi bi-credit-card-2-front-fill me-2"></i> Compra no Cartão</button><button id="btn-pagar-fatura" class="btn btn-outline-success btn-lg p-3"><i class="bi bi-receipt-cutoff me-2"></i> Pagar Fatura</button></div></div></div></div>`;
    
    const modalEl = document.getElementById('operacaoChoiceModal');
    const modal = new bootstrap.Modal(modalEl);

    // *** CORREÇÃO APLICADA AQUI ***
    // O 'ouvinte' agora só executa a próxima ação UMA VEZ, depois que o modal fecha.
    modalEl.addEventListener('hidden.bs.modal', (event) => {
        const nextAction = modalEl.dataset.nextAction;
        if (nextAction === 'despesaReceita') showDespesaReceitaModal();
        else if (nextAction === 'compraCartao') showCompraCartaoModal();
        else if (nextAction === 'pagarFatura') showPagarFaturaModal();
        
        // Limpa o container DEPOIS que a ação foi decidida.
        modalContainer.innerHTML = '';
    }, { once: true }); // A opção { once: true } é crucial, garante que o evento só dispare uma vez.

    // Os botões agora apenas definem qual será a próxima ação e fecham o modal.
    document.getElementById('btn-receita-despesa').addEventListener('click', () => {
        modalEl.dataset.nextAction = 'despesaReceita';
        modal.hide();
    });
    document.getElementById('btn-compra-cartao').addEventListener('click', () => {
        modalEl.dataset.nextAction = 'compraCartao';
        modal.hide();
    });
    document.getElementById('btn-pagar-fatura').addEventListener('click', () => {
        modalEl.dataset.nextAction = 'pagarFatura';
        modal.hide();
    });
    
    modal.show();
}

export async function showDespesaReceitaModal() {
    const [categorias, contas] = await Promise.all([db.categorias.toArray(), db.contas.where('tipo').notEqual('credito').toArray()]);
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `<div class="modal fade" id="drModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Nova Receita/Despesa</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="drForm"><div class="mb-3"><label class="form-label">Tipo</label><div class="btn-group w-100"><input type="radio" class="btn-check" name="drTipo" id="drTipoDespesa" value="despesa" checked><label class="btn btn-outline-danger w-50" for="drTipoDespesa">Despesa</label><input type="radio" class="btn-check" name="drTipo" id="drTipoReceita" value="receita"><label class="btn btn-outline-success w-50" for="drTipoReceita">Receita</label></div></div><div class="mb-3"><label for="drDescricao">Descrição</label><input type="text" class="form-control" id="drDescricao" required></div><div class="row"><div class="col-6"><label for="drValor">Valor</label><input type="number" class="form-control" id="drValor" step="0.01" required></div><div class="col-6"><label for="drData">Data</label><input type="date" class="form-control" id="drData" value="${dayjs().format('YYYY-MM-DD')}" required></div></div><div class="row mt-3"><div class="col-6"><label for="drCategoria">Categoria</label><select class="form-select" id="drCategoria" required></select></div><div class="col-6"><label for="drConta">Conta</label><select class="form-select" id="drConta" required>${contas.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}</select></div></div></form></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button><button type="button" class="btn btn-primary" id="save-dr-btn">Salvar</button></div></div></div></div>`;
    const modalEl = document.getElementById('drModal'), modal = new bootstrap.Modal(modalEl);
    const updateCategorias = () => { document.getElementById('drCategoria').innerHTML = categorias.filter(c => c.tipo === document.querySelector('input[name="drTipo"]:checked').value).map(c => `<option value="${c.id}">${c.nome}</option>`).join(''); };
    document.querySelectorAll('input[name="drTipo"]').forEach(r => r.addEventListener('change', updateCategorias)); updateCategorias();
    document.getElementById('save-dr-btn').addEventListener('click', async () => {
        const data = {
            descricao: document.getElementById('drDescricao').value, valor: parseFloat(document.getElementById('drValor').value),
            dataVencimento: dayjs(document.getElementById('drData').value).valueOf(), tipo: document.querySelector('input[name="drTipo"]:checked').value,
            categoriaId: parseInt(document.getElementById('drCategoria').value), contaId: parseInt(document.getElementById('drConta').value),
            status: 'pago', data: dayjs(document.getElementById('drData').value).valueOf()
        };
        if (!data.descricao || isNaN(data.valor) || isNaN(data.categoriaId) || isNaN(data.contaId)) { showToast('Erro', 'Preencha todos os campos.', 'error'); return; }
        await db.transacoes.add(data); showToast('Sucesso', 'Operação salva!'); modal.hide();
    });
    modalEl.addEventListener('hidden.bs.modal', () => { modalContainer.innerHTML = ''; refreshCurrentView(); });
    modal.show();
}

export async function showCompraCartaoModal() {
    const [categorias, cartoes] = await Promise.all([db.categorias.where('tipo').equals('despesa').toArray(), db.cartoes.toArray()]);
    if (cartoes.length === 0) { showToast('Aviso', 'Cadastre um cartão de crédito primeiro!', 'warning'); return; }
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `<div class="modal fade" id="ccModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Nova Compra no Cartão</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="ccForm"><div class="mb-3"><label for="ccDescricao">Descrição</label><input type="text" class="form-control" id="ccDescricao" required></div><div class="row"><div class="col-6"><label for="ccValor">Valor Total</label><input type="number" class="form-control" id="ccValor" step="0.01" required></div><div class="col-6"><label for="ccParcelas">Nº Parcelas</label><input type="number" class="form-control" id="ccParcelas" value="1" min="1" required></div></div><div class="row mt-3"><div class="col-6"><label for="ccData">Data da Compra</label><input type="date" class="form-control" id="ccData" value="${dayjs().format('YYYY-MM-DD')}" required></div><div class="col-6"><label for="ccCategoria">Categoria</label><select class="form-select" id="ccCategoria" required>${categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}</select></div></div><div class="mt-3"><label for="ccCartao">Cartão</label><select class="form-select" id="ccCartao" required>${cartoes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}</select></div></form></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button><button type="button" class="btn btn-primary" id="save-cc-btn">Salvar</button></div></div></div></div>`;
    const modalEl = document.getElementById('ccModal'), modal = new bootstrap.Modal(modalEl);
    document.getElementById('save-cc-btn').addEventListener('click', async () => {
        const data = {
            descricao: document.getElementById('ccDescricao').value, valorTotal: parseFloat(document.getElementById('ccValor').value),
            parcelas: parseInt(document.getElementById('ccParcelas').value), dataCompra: dayjs(document.getElementById('ccData').value),
            categoriaId: parseInt(document.getElementById('ccCategoria').value), cartaoId: parseInt(document.getElementById('ccCartao').value)
        };
        if (!data.descricao || isNaN(data.valorTotal) || isNaN(data.parcelas)) { showToast('Erro', 'Preencha os campos.', 'error'); return; }
        const cartao = cartoes.find(c => c.id === data.cartaoId);
        const transacoesParaAdd = [], parcelaGroupId = Date.now();
        for (let i = 1; i <= data.parcelas; i++) {
            let dataVencimento = data.dataCompra.date(cartao.diaVencimento);
            if(data.dataCompra.date() > cartao.diaFechamento) dataVencimento = dataVencimento.add(1, 'month');
            dataVencimento = dataVencimento.add(i-1, 'month');
            transacoesParaAdd.push({
                descricao: data.parcelas > 1 ? `${data.descricao} (${i}/${data.parcelas})` : data.descricao,
                valor: parseFloat((data.valorTotal / data.parcelas).toFixed(2)), tipo: 'despesa', status: 'pendente',
                data: data.dataCompra.valueOf(), dataVencimento: dataVencimento.valueOf(),
                categoriaId: data.categoriaId, cartaoId: data.cartaoId, parcelaGroupId: data.parcelas > 1 ? parcelaGroupId : null,
            });
        }
        await db.transacoes.bulkAdd(transacoesParaAdd); showToast('Sucesso', 'Compra registrada!'); modal.hide();
    });
    modalEl.addEventListener('hidden.bs.modal', () => { modalContainer.innerHTML = ''; refreshCurrentView(); });
    modal.show();
}

export async function showPagarFaturaModal() {
    const [cartoes, transacoes, contas] = await Promise.all([db.cartoes.toArray(), db.transacoes.toArray(), db.contas.where('tipo').notEqual('credito').toArray()]);
    if (contas.length === 0) { showToast('Aviso', 'Cadastre uma conta para pagar a fatura!', 'warning'); return; }
    const faturas = cartoes.map(cartao => {
        let dataVencimentoFechada = dayjs().date(cartao.diaVencimento);
        if (dayjs().date() > cartao.diaVencimento) dataVencimentoFechada = dataVencimentoFechada.add(1, 'month');
        const dataFechamentoPassado = dataVencimentoFechada.subtract(1, 'month').date(cartao.diaFechamento);
        const inicioFaturaFechada = dataFechamentoPassado.subtract(1, 'month').add(1, 'day').startOf('day');
        const fimFaturaFechada = dataFechamentoPassado.endOf('day');
        const transacoesDaFatura = transacoes.filter(t => t.cartaoId === cartao.id && t.status === 'pendente' && dayjs(t.data).isBetween(inicioFaturaFechada, fimFaturaFechada, null, '[]'));
        return { cartaoId: cartao.id, nome: cartao.nome, valor: transacoesDaFatura.reduce((sum, t) => sum + t.valor, 0), transacoesIds: transacoesDaFatura.map(t => t.id) };
    }).filter(f => f.valor > 0);
    if (faturas.length === 0) { showToast('Info', 'Nenhuma fatura fechada para pagar.', 'info'); return; }
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `<div class="modal fade" id="pfModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Pagar Fatura</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><form id="pfForm"><div class="mb-3"><label for="pfFatura">Fatura a Pagar</label><select class="form-select" id="pfFatura" required>${faturas.map(f => `<option value="${f.cartaoId}">${f.nome} - ${formatCurrency(f.valor)}</option>`).join('')}</select></div><div class="mb-3"><label for="pfConta">Pagar com a conta</label><select class="form-select" id="pfConta" required>${contas.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}</select></div><div class="mb-3"><label for="pfData">Data do Pagamento</label><input type="date" class="form-control" id="pfData" value="${dayjs().format('YYYY-MM-DD')}" required></div></form></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button><button type="button" class="btn btn-primary" id="save-pf-btn">Confirmar</button></div></div></div></div>`;
    const modalEl = document.getElementById('pfModal'), modal = new bootstrap.Modal(modalEl);
    document.getElementById('save-pf-btn').addEventListener('click', async () => {
        const cartaoId = parseInt(document.getElementById('pfFatura').value);
        const contaId = parseInt(document.getElementById('pfConta').value);
        const dataPagamento = dayjs(document.getElementById('pfData').value).valueOf();
        const fatura = faturas.find(f => f.cartaoId === cartaoId); if (!fatura) return;
        await db.transaction('rw', db.transacoes, async () => {
            await db.transacoes.add({
                descricao: `Pagamento Fatura ${fatura.nome}`, valor: fatura.valor, tipo: 'despesa', status: 'pago',
                categoriaId: -1, data: dataPagamento, dataVencimento: dataPagamento, contaId: contaId
            });
            await db.transacoes.where('id').anyOf(fatura.transacoesIds).modify({ status: 'pago' });
        });
        showToast('Sucesso', 'Pagamento de fatura registrado!'); modal.hide();
    });
    modalEl.addEventListener('hidden.bs.modal', () => { modalContainer.innerHTML = ''; refreshCurrentView(); });
    modal.show();
}
