// Helpers puros para parcelamento (datas + sugestão de parcelas).
// Usados por QuickFinancialModal e pelo modal Novo Lançamento do FinancialModule.

export const getTodayISO = () => {
  const d = new Date();
  const z = (n) => ('0' + n).slice(-2);
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

export const addMonths = (dateStr, months) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d, 0, 0, 0);
  date.setMonth(date.getMonth() + parseInt(months || 0));
  const z = (n) => ('0' + n).slice(-2);
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}`;
};

// Soma N meses respeitando um dia forçado de vencimento. Se o dia não existir
// no mês alvo (ex: 31/fev), volta pro último dia do mês.
export const addMonthsRespeitandoDia = (dataBaseISO, n, diaForcado = null) => {
  const [y, m, d] = dataBaseISO.split('-').map(Number);
  const date = new Date(y, m - 1, diaForcado || d, 0, 0, 0);
  date.setMonth(date.getMonth() + n);
  if (diaForcado && date.getDate() !== diaForcado) {
    date.setDate(0);
  }
  const z = (x) => ('0' + x).slice(-2);
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}`;
};

// Distribui valorTotal em N parcelas, com sobra de centavos na última.
// Retorna [{numero_parcela, data_vencimento, valor_parcela, data_pagamento}].
export const sugerirParcelasLocal = (qtdParcelas, valorTotal, dataBaseISO, diaVencimento = null) => {
  if (!qtdParcelas || qtdParcelas < 1) return [];
  if (!valorTotal || valorTotal <= 0) return [];
  if (!dataBaseISO) return [];

  const total = parseFloat(valorTotal);
  const valorBase = Math.floor((total / qtdParcelas) * 100) / 100;
  const sobra = +(total - valorBase * qtdParcelas).toFixed(2);

  const parcelas = [];
  for (let i = 0; i < qtdParcelas; i++) {
    const venc = addMonthsRespeitandoDia(dataBaseISO, i, diaVencimento);
    const valor = i === qtdParcelas - 1 ? +(valorBase + sobra).toFixed(2) : valorBase;
    parcelas.push({
      numero_parcela: i + 1,
      data_vencimento: venc,
      valor_parcela: valor,
      data_pagamento: '',
    });
  }
  return parcelas;
};

export const formatCurrencyBRL = (val) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
