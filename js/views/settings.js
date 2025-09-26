import { db } from '../db.js';
import { showToast } from '../main.js';

/**
 * Renderiza a estrutura principal da página de Backup/Configurações.
 */
export function renderSettings() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="card">
            <div class="card-body">
                <h3 class="card-title">Backup e Restauração</h3>
                <p class="card-text text-muted">Exporte todos os seus dados para um arquivo de segurança ou importe um backup para restaurar suas informações.</p>
                
                <div class="mt-4 p-3 border rounded">
                    <h6><i class="bi bi-download me-2"></i>Salvar Backup</h6>
                    <p>Clique no botão abaixo para baixar um arquivo JSON com todos os seus dados. Guarde este arquivo em um local seguro.</p>
                    <button class="btn btn-success" id="backup-btn">
                        <i class="bi bi-archive-fill me-2"></i>Criar e Baixar Backup
                    </button>
                </div>
                
                <hr class="my-4">
                
                <div class="mt-4 p-3 border border-danger rounded">
                    <h6 class="text-danger"><i class="bi bi-upload me-2"></i>Restaurar Backup</h6>
                    <p class="text-danger"><strong>Atenção:</strong> Restaurar um backup substituirá TODOS os dados atuais no aplicativo. Esta ação não pode ser desfeita.</p>
                    <div class="input-group">
                        <input type="file" class="form-control" id="restore-file-input" accept=".json">
                        <button class="btn btn-danger" id="restore-btn">
                            <i class="bi bi-exclamation-triangle-fill me-2"></i>Restaurar Dados
                        </button>
                    </div>
                </div>
            </div>
        </div>`;

    // Adiciona os event listeners aos botões
    document.getElementById('backup-btn').addEventListener('click', createBackup);
    document.getElementById('restore-btn').addEventListener('click', restoreBackup);
}

/**
 * Coleta todos os dados de todas as tabelas do Dexie e os exporta para um arquivo JSON.
 */
async function createBackup() {
    try {
        showToast('Aguarde', 'Preparando o arquivo de backup...', 'info');
        
        const allData = {};
        // Itera sobre todas as tabelas definidas no schema do Dexie
        for (const table of db.tables) {
            allData[table.name] = await table.toArray();
        }

        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss');
        a.download = `${timestamp}_Backup_FINGESTOR.json`;
        a.href = url;
        
        document.body.appendChild(a); // Necessário para Firefox
        a.click();
        
        // Limpeza
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('Sucesso!', 'Backup criado e baixado com sucesso!');
    } catch (error) {
        console.error("Erro ao criar backup:", error);
        showToast('Erro Crítico', 'Não foi possível criar o backup. Verifique o console.', 'error');
    }
}

/**
 * Lê um arquivo JSON de backup e substitui todos os dados atuais no Dexie.
 */
async function restoreBackup() {
    const fileInput = document.getElementById('restore-file-input');
    if (fileInput.files.length === 0) {
        showToast('Atenção', 'Por favor, selecione um arquivo de backup para restaurar.', 'warning');
        return;
    }

    // Confirmação dupla para uma ação destrutiva
    if (!confirm('TEM CERTEZA ABSOLUTA?\n\nTodos os seus dados atuais serão permanentemente apagados e substituídos pelos dados do arquivo de backup.')) {
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async (event) => {
        try {
            const backupData = JSON.parse(event.target.result);
            
            // Usa uma transação para garantir que a operação seja atômica (tudo ou nada)
            await db.transaction('rw', db.tables, async () => {
                for (const table of db.tables) {
                    // Limpa a tabela atual
                    await table.clear();
                    
                    // Verifica se o backup contém dados para esta tabela antes de adicionar
                    if (backupData[table.name]) {
                        await table.bulkAdd(backupData[table.name]);
                    }
                }
            });
            
            showToast('Sucesso!', 'Dados restaurados com sucesso. A aplicação será recarregada.');
            // Recarrega a página para garantir que o estado da aplicação seja atualizado
            setTimeout(() => window.location.reload(), 2500);

        } catch (error) {
            console.error("Erro ao restaurar backup:", error);
            showToast('Erro Crítico', 'O arquivo de backup é inválido ou está corrompido.', 'error');
        }
    };

    reader.onerror = () => {
         showToast('Erro', 'Não foi possível ler o arquivo selecionado.', 'error');
    }

    reader.readAsText(file);
}