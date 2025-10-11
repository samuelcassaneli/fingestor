// Mocking db and other dependencies if necessary
const db = {
    transacoes: {
        bulkAdd: async (transacoes) => {
            console.log('Mocked bulkAdd called with:', transacoes);
            return Promise.resolve();
        }
    }
};

const showToast = (title, message, type) => {
    console.log(`Mocked showToast: ${title}, ${message}, ${type}`);
};

// A simplified version of dayjs for testing purposes
const dayjs = (dateStr) => {
    const date = dateStr ? new Date(dateStr) : new Date();
    return {
        date: (day) => {
            const newDate = new Date(date);
            newDate.setDate(day);
            return dayjs(newDate.toISOString());
        },
        add: (value, unit) => {
            const newDate = new Date(date);
            if (unit === 'month') {
                newDate.setMonth(newDate.getMonth() + value);
            }
            return dayjs(newDate.toISOString());
        },
        valueOf: () => date.getTime(),
        format: (formatStr) => {
            // Basic formatter for 'YYYY-MM-DD'
            if (formatStr === 'YYYY-MM-DD') {
                return date.toISOString().split('T')[0];
            }
            return date.toISOString();
        },
        _date: date
    };
};

// The function to be tested, extracted and adapted for a test environment
async function showCompraCartaoModalLogic(data, cartoes) {
    const cartao = cartoes.find(c => c.id === data.cartaoId);
    if (!cartao) {
        showToast('Erro', 'Cartão não encontrado.', 'error');
        return;
    }

    const transacoesParaAdd = [];
    const parcelaGroupId = Date.now();
    let primeiraDataVencimento = data.dataCompra.date(cartao.diaVencimento);

    if (data.dataCompra._date.getDate() > cartao.diaFechamento) {
        primeiraDataVencimento = primeiraDataVencimento.add(1, 'month');
    }

    for (let i = 0; i < data.parcelas; i++) {
        const dataVencimento = primeiraDataVencimento.add(i, 'month');
        transacoesParaAdd.push({
            descricao: data.parcelas > 1 ? `${data.descricao} (${i + 1}/${data.parcelas})` : data.descricao,
            valor: parseFloat((data.valorTotal / data.parcelas).toFixed(2)),
            tipo: 'despesa',
            status: 'pendente',
            data: data.dataCompra.valueOf(),
            dataVencimento: dataVencimento.valueOf(),
            categoriaId: data.categoriaId,
            cartaoId: data.cartaoId,
            parcelaGroupId: data.parcelas > 1 ? parcelaGroupId : null,
        });
    }

    await db.transacoes.bulkAdd(transacoesParaAdd);
    showToast('Sucesso', 'Compra registrada!');
    return transacoesParaAdd;
}

// Test case
async function testDueDateCalculation() {
    console.log('Running test: Due Date Calculation');

    const cartoes = [{ id: 1, nome: 'Test Card', diaFechamento: 20, diaVencimento: 28 }];
    const data = {
        descricao: 'Test Purchase',
        valorTotal: 1200,
        parcelas: 3,
        dataCompra: dayjs('2023-10-25'), // Purchase after closing date
        categoriaId: 1,
        cartaoId: 1
    };

    const result = await showCompraCartaoModalLogic(data, cartoes);

    const expectedFirstDueDate = dayjs('2023-11-28').valueOf();
    const firstInstallment = result[0];

    if (firstInstallment.dataVencimento === expectedFirstDueDate) {
        console.log('Test PASSED');
    } else {
        console.error(`Test FAILED: Expected ${new Date(expectedFirstDueDate)}, but got ${new Date(firstInstallment.dataVencimento)}`);
    }
}

testDueDateCalculation();