import { db } from '../db.js';
import { formatCurrency, formatDate, showToast } from '../main.js';

/**
 * Renderiza a estrutura principal da página de Metas.
 */
export async function renderGoals() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="mb-0">Minhas Metas de Economia</h3>
            <button class="uiverse-button" id="nova-meta-btn">
                <i class="bi bi-plus-circle-fill me-2"></i> Nova Meta
            </button>
        </div>
        <div id="metas-list" class="row">
            <div class="text-center p-5"><div class="spinner-border"></div></div>
        </div>`;

    document.getElementById('nova-meta-btn').addEventListener('click', () => showMetaModal());
    await loadGoals();
}

/**
 * Carrega as metas do banco de dados e as renderiza na tela.
 */
async function loadGoals() {
    const listEl = document.getElementById('metas-list');
    const metas = await db.metas.toArray();

    if (metas.length === 0) {
        listEl.innerHTML = `
            <div class="col-12">
                <div class="card text-center p-4">
                    <div class="card-body">
                        <h5 class="card-title">Nenhuma meta criada</h5>
                        <p class="card-text">Defina suas metas de economia para começar a planejar seu futuro financeiro.</p>
                        <button class="btn btn-primary" id="add-first-meta-btn">Criar Primeira Meta</button>
                    </div>
                </div>
            </div>`;
        document.getElementById('add-first-meta-btn').addEventListener('click', () => showMetaModal());
        return;
    }

    listEl.innerHTML = metas.map(meta => {
        const progresso = meta.valorAlvo > 0 ? (meta.valorAtual / meta.valorAlvo) * 100 : 0;
        const progressoCor = progresso < 33 ? 'danger' : progresso < 66 ? 'warning' : 'success';
        const diasRestantes = dayjs(meta.dataFinal).diff(dayjs(), 'day');

        return `
            <div class="col-lg-6 col-md-12 mb-4">
                <div class="card h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between">
                            <h5 class="card-title">${meta.descricao}</h5>
                            <span class="text-muted small"><i class="bi bi-calendar-check"></i> ${formatDate(meta.dataFinal)}</span>
                        </div>
                        <p class="card-text text-muted">
                            ${diasRestantes > 0 ? `${diasRestantes} dias restantes` : (diasRestantes === 0 ? 'O prazo termina hoje!' : 'Prazo finalizado!')}
                        </p>
                        <div class="progress mb-2" role="progressbar" style="height: 20px;">
                            <div class="progress-bar bg-${progressoCor} progress-bar-striped progress-bar-animated" style="width: ${progresso.toFixed(2)}%;" title="${progresso.toFixed(1)}%">${progresso.toFixed(1)}%</div>
                        </div>
                        <div class="d-flex justify-content-between">
                            <span>${formatCurrency(meta.valorAtual)}</span>
                            <strong>${formatCurrency(meta.valorAlvo)}</strong>
                        </div>
                        <hr>
                        <div class="text-end">
                            <button class="btn btn-sm btn-outline-success action-btn" data-id="${meta.id}" data-action="progress" title="Adicionar Progresso"><i class="bi bi-plus-lg"></i> Adicionar</button>
                            <button class="btn btn-sm btn-outline-primary action-btn" data-id="${meta.id}" data-action="edit" title="Editar Meta"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger action-btn" data-id="${meta.id}" data-action="delete" title="Excluir Meta"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');
    listEl.addEventListener('click', handleGoalActionClick);
}

/**
 * Manipula os cliques nos botões de ação dos cards de metas.
 * @param {Event} e - O evento de clique.
 */
function handleGoalActionClick(e) {
    const button = e.target.closest('.action-btn');
    if (!button) return;

    const id = parseInt(button.dataset.id);
    const action = button.dataset.action;

    if (action === 'edit') {
        showMetaModal(id);
    } else if (action === 'delete') {
        deleteMeta(id);
    } else if (action === 'progress') {
        showProgressoModal(id);
    }
}

/**
 * Exibe o modal para adicionar ou editar uma meta.
 * @param {number|null} id - O ID da meta para editar, ou null para criar uma nova.
 */
async function showMetaModal(id = null) {
    const meta = id ? await db.metas.get(id) : {};
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
        <div class="modal fade" id="metaModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${id ? 'Editar' : 'Nova'} Meta</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="metaForm">
                            <input type="hidden" id="metaId" value="${meta.id || ''}">
                            <input type="hidden" id="metaValorAtual" value="${meta.valorAtual || 0}">
                            <div class="mb-3">
                                <label for="metaDescricao" class="form-label">Descrição da Meta</label>
                                <input type="text" class="form-control" id="metaDescricao" value="${meta.descricao || ''}" required>
                            </div>
                            <div class="mb-3">
                                <label for="metaValorAlvo" class="form-label">Valor Alvo</label>
                                <input type="number" step="0.01" min="0.01" class="form-control" id="metaValorAlvo" value="${meta.valorAlvo || ''}" required>
                            </div>
                            <div class="mb-3">
                                <label for="metaDataFinal" class="form-label">Data Final</label>
                                <input type="date" class="form-control" id="metaDataFinal" value="${meta.dataFinal ? dayjs(meta.dataFinal).format('YYYY-MM-DD') : ''}" required>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="save-meta-btn">Salvar</button>
                    </div>
                </div>
            </div>
        </div>`;
    
    const modalEl = document.getElementById('metaModal');
    const modal = new bootstrap.Modal(modalEl);

    document.getElementById('save-meta-btn').addEventListener('click', async () => {
        const id = document.getElementById('metaId').value;
        const data = {
            descricao: document.getElementById('metaDescricao').value,
            valorAlvo: parseFloat(document.getElementById('metaValorAlvo').value),
            dataFinal: dayjs(document.getElementById('metaDataFinal').value).valueOf(),
            valorAtual: parseFloat(document.getElementById('metaValorAtual').value || 0)
        };

        if (!data.descricao || isNaN(data.valorAlvo) || !data.dataFinal) {
            showToast('Erro', 'Todos os campos são obrigatórios.', 'error');
            return;
        }

        if (id) {
            await db.metas.update(parseInt(id), data);
        } else {
            await db.metas.add(data);
        }
        showToast('Sucesso', `Meta ${id ? 'atualizada' : 'criada'}!`);
        modal.hide();
        await loadGoals();
    });

    modalEl.addEventListener('hidden.bs.modal', () => modalContainer.innerHTML = '');
    modal.show();
}

/**
 * Exclui uma meta do banco de dados após confirmação.
 * @param {number} id - O ID da meta a ser excluída.
 */
async function deleteMeta(id) {
    if (confirm('Tem certeza que deseja excluir esta meta?')) {
        await db.metas.delete(id);
        showToast('Sucesso', 'Meta excluída!');
        await loadGoals();
    }
}

/**
 * Exibe o modal para adicionar progresso a uma meta.
 * @param {number} id - O ID da meta.
 */
async function showProgressoModal(id) {
    const meta = await db.metas.get(id);
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
        <div class="modal fade" id="progressoModal" tabindex="-1">
            <div class="modal-dialog modal-sm modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Adicionar Progresso</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Meta:</strong> ${meta.descricao}</p>
                        <div class="mb-3">
                            <label for="progressoValor" class="form-label">Valor a Adicionar</label>
                            <input type="number" step="0.01" min="0" class="form-control" id="progressoValor" required>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" id="save-progresso-btn">Adicionar</button>
                    </div>
                </div>
            </div>
        </div>`;

    const modalEl = document.getElementById('progressoModal');
    const modal = new bootstrap.Modal(modalEl);

    document.getElementById('save-progresso-btn').addEventListener('click', async () => {
        const valor = parseFloat(document.getElementById('progressoValor').value);
        if (isNaN(valor) || valor <= 0) {
            showToast('Erro', 'Por favor, insira um valor válido.', 'error');
            return;
        }

        await db.metas.update(id, { valorAtual: meta.valorAtual + valor });
        showToast('Sucesso', 'Progresso adicionado!');
        modal.hide();
        await loadGoals();
    });

    modalEl.addEventListener('hidden.bs.modal', () => modalContainer.innerHTML = '');
    modal.show();
}