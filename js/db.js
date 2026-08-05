const db = new Dexie('FinGestorDB');

db.version(1).stores({
    contas: '++id, nome, tipo',
    cartoes: '++id, nome', // Simplificado
    categorias: '++id, nome, tipo',
    transacoes: '++id, descricao, tipo, data, dataVencimento, status, categoriaId, contaId, cartaoId, parcelaGroupId',
    metas: '++id, descricao'
});

export { db };