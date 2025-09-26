import { db } from '../db.js';
import { showToast } from '../main.js';

/**
 * Renderiza a estrutura principal da página de Categorias.
 */
export async function renderCategories() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="card">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="card-title mb-0">Minhas Categorias</h5>
                    <button class="uiverse-button" id="nova-categoria-btn">
                        <i class="bi bi-plus-circle-fill me-2"></i> Nova Categoria
                    </button>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-4 mb-md-0">
                        <div class="card h-100">
                            <div class="card-header fw-bold">
                                <i class="bi bi-arrow-up-circle-fill text-success"></i> Receitas
                            </div>
                            <ul class="list-group list-group-flush" id="categorias-receitas">
                                <li class="list-group-item text-center p-3"><div class="spinner-border spinner-border-sm"></div></li>
                            </ul>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card h-100">
                             <div class="card-header fw-bold">
                                <i class="bi bi-arrow-down-circle-fill text-danger"></i> Despesas
                            </div>
                            <ul class="list-group list-group-flush" id="categorias-despesas">
                                 <li class="list-group-item text-center p-3"><div class="spinner-border spinner-border-sm"></div></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    
    document.getElementById('nova-categoria-btn').addEventListener('click', () => showCategoriaModal());
    await loadCategories();
}

/**
 * Carrega as categorias do banco de dados e as renderiza nas listas apropriadas.
 */
async function loadCategories() {
    const categorias = await db.categorias.toArray();
    const receitasList = document.getElementById('categorias-receitas');
    const despesasList = document.getElementById('categorias-despesas');
    
    // Função auxiliar para renderizar uma lista de categorias
    const renderList = (listEl, items) => {
        if (items.length === 0) {
            listEl.innerHTML = '<li class="list-group-item text-center text-muted p-3">Nenhuma categoria cadastrada.</li>';
            return;
        }
        listEl.innerHTML = items.map(cat => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <span><i class="bi ${cat.icone || 'bi-tag'} me-3"></i> ${cat.nome}</span>
                <div>
                    <button class="btn btn-sm btn-outline-primary action-btn" data-id="${cat.id}" data-action="edit" title="Editar"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger action-btn" data-id="${cat.id}" data-action="delete" title="Excluir"><i class="bi bi-trash"></i></button>
                </div>
            </li>`).join('');
    };

    renderList(receitasList, categorias.filter(c => c.tipo === 'receita'));
    renderList(despesasList, categorias.filter(c => c.tipo === 'despesa'));
    
    // Adiciona event listeners de forma delegada para as duas listas
    receitasList.addEventListener('click', handleCategoryActionClick);
    despesasList.addEventListener('click', handleCategoryActionClick);
}

/**
 * Manipula os cliques nos botões de ação das listas de categorias.
 * @param {Event} e - O evento de clique.
 */
function handleCategoryActionClick(e) {
    const button = e.target.closest('.action-btn');
    if (!button) return;

    const id = parseInt(button.dataset.id);
    const action = button.dataset.action;

    if (action === 'edit') {
        showCategoriaModal(id);
    } else if (action === 'delete') {
        deleteCategoria(id);
    }
}

/**
 * Exibe o modal para adicionar ou editar uma categoria.
 * @param {number|null} id - O ID da categoria para editar, ou null para criar uma nova.
 */
async function showCategoriaModal(id = null) {
    const categoria = id ? await db.categorias.get(id) : {};
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
        <div class="modal fade" id="categoriaModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${id ? 'Editar' : 'Nova'} Categoria</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="categoriaForm">
                            <input type="hidden" id="categoriaId" value="${categoria.id || ''}">
                            <div class="mb-3">
                                <label for="categoriaNome" class="form-label">Nome da Categoria</label>
                                <input type="text" class="form-control" id="categoriaNome" value="${categoria.nome || ''}" required>
                            </div>
                            <div class="mb-3">
                                <label for="categoriaTipo" class="form-label">Tipo</label>
                                <select class="form-select" id="categoriaTipo" required>
                                    <option value="despesa" ${categoria.tipo === 'despesa' ? 'selected' : ''}>Despesa</option>
                                    <option value="receita" ${categoria.tipo === 'receita' ? 'selected' : ''}>Receita</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label for="categoriaIcone" class="form-label">Ícone (Bootstrap Icons)</label>
                                <input type="text" class="form-control" id="categoriaIcone" value="${categoria.icone || ''}" placeholder="ex: bi-house-fill">
                                <div class="form-text">
                                    Veja os nomes dos ícones em <a href="https://icons.getbootstrap.com/" target="_blank">Bootstrap Icons</a>.
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="save-categoria-btn">Salvar</button>
                    </div>
                </div>
            </div>
        </div>`;
    
    const modalEl = document.getElementById('categoriaModal');
    const modal = new bootstrap.Modal(modalEl);

    document.getElementById('save-categoria-btn').addEventListener('click', async () => {
        const id = document.getElementById('categoriaId').value;
        const data = {
            nome: document.getElementById('categoriaNome').value.trim(),
            tipo: document.getElementById('categoriaTipo').value,
            icone: document.getElementById('categoriaIcone').value.trim()
        };

        if (!data.nome) {
            showToast('Erro', 'O nome da categoria é obrigatório.', 'error');
            return;
        }

        if (id) {
            await db.categorias.update(parseInt(id), data);
        } else {
            await db.categorias.add(data);
        }
        showToast('Sucesso', `Categoria ${id ? 'atualizada' : 'criada'}!`);
        modal.hide();
        await loadCategories();
    });

    modalEl.addEventListener('hidden.bs.modal', () => modalContainer.innerHTML = '');
    modal.show();
}

/**
 * Exclui uma categoria do banco de dados após confirmação.
 * @param {number} id - O ID da categoria a ser excluída.
 */
async function deleteCategoria(id) {
    const count = await db.transacoes.where('categoriaId').equals(id).count();
    if (count > 0) {
        alert(`Não é possível excluir esta categoria, pois ela está sendo usada por ${count} transação(ões).`);
        return;
    }
    if (confirm('Tem certeza que deseja excluir esta categoria?')) {
        await db.categorias.delete(id);
        showToast('Sucesso', 'Categoria excluída!');
        await loadCategories();
    }
}