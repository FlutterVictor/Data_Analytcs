/*****************************************
 * URLs dos CSVs (raw GitHub)
 *****************************************/
const URL_STD = 'https://raw.githubusercontent.com/FlutterVictor/Data_Analytcs/main/CSV/STD_Geral.csv';
const URL_PINTURA = 'https://raw.githubusercontent.com/FlutterVictor/Data_Analytcs/main/CSV/consumo_horas.csv';
const URL_SGE = 'https://raw.githubusercontent.com/FlutterVictor/Data_Analytcs/main/CSV/sge_horas.csv';

/*****************************************
 * Função para ler CSV via PapaParse
 *****************************************/
function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: results => resolve(results.data),
      error: err => reject(err)
    });
  });
}

/*****************************************
 * Função para avisar se CSV falhar
 *****************************************/
function checkData(data, name) {
  if (!data || !data.length) {
    console.warn(`CSV ${name} não carregou ou está vazio.`);
    return false;
  }
  return true;
}

/*****************************************
 * Funções de normalização
 *****************************************/
function getField(row, variants) {
  for (const v of variants) {
    if (row.hasOwnProperty(v)) return row[v];
  }
  // case insensitive
  const keys = Object.keys(row);
  for (const k of keys) {
    if (k && variants.some(v => k.toLowerCase().includes(v.toLowerCase()))) return row[k];
  }
  return '';
}

function normalizeSTD(rows) {
  return rows.map(r => ({
    semana: getField(r, ['Semanas', 'Semana']),
    os: getField(r, ['OS', 'O.S']),
    matricula: getField(r, ['Matricula', 'Matrícula']),
    encarregado: getField(r, ['Encarregado Responsavel', 'Encarregado']),
    area: getField(r, ['ÁREA', 'Área', 'Area']),
    montPresente: parseFloat(getField(r, ['Mont.Presente']) || 0),
    hhTotal: parseFloat(getField(r, ['HH Total']) || 0),
    mlMontados: parseFloat(getField(r, ['ML Montados']) || 0),
    mlPrevisto: parseFloat(getField(r, ['ML PREVISTO']) || 0),
    stdMontado: parseFloat(getField(r, ['STD Montado']) || 0),
    data: getField(r, ['Data'])
  }));
}

function normalizePintura(rows) {
  return rows.map(r => ({
    ref: getField(r, ['REF']),
    descricao: getField(r, ['DESCRIÇÃO DO PRODUTO', 'DESCRICAO DO PRODUTO']),
    data: getField(r, ['DATA SAÍDA', 'DATA']),
    diaSemana: getField(r, ['Dia']),
    os: getField(r, ['O.S', 'OS']),
    area: getField(r, ['ÁREA DE APLICAÇÃO', 'AREA DE APLICACAO']),
    quantidade: parseFloat(getField(r, ['Qtd.', 'QTD']) || 0),
    m2: parseFloat(getField(r, ['m²', 'm2']) || 0),
    ubm: getField(r, ['UNID', 'Unidade']),
    tipo: getField(r, ['TIPO DE APLICAÇÃO', 'TIPO']),
    encarregado: getField(r, ['RETIRADO POR'])
  }));
}

function normalizeSGE(rows) {
  return rows.map(r => ({
    dataRef: getField(r, ['Data Ref.', 'Data', 'Data Ref']),
    matricula: getField(r, ['Matricula', 'Matrícula']),
    recurso: getField(r, ['Recurso']),
    cargo: getField(r, ['Cargo']),
    entrada: getField(r, ['Entrada Catraca', 'Entrada']),
    inicio: getField(r, ['Início', 'Inicio']),
    fim: getField(r, ['Fim']),
    saida: getField(r, ['Saida Catraca', 'Saida', 'Saída']),
    totalHoras: parseFloat(getField(r, ['Total Horas', 'TotalHoras', 'Total_Horas']) || 0),
    os: getField(r, ['OS / Entregável', 'OS', 'Entregável', 'OS/Entregavel'])
  }));
}

/*****************************************
 * Cálculos STD
 *****************************************/
function calcStdPintura(pinturaRows, sgeRows) {
  const m2ByOS = {};
  pinturaRows.forEach(r => { const os = r.os || '__SEM_OS__'; m2ByOS[os] = (m2ByOS[os] || 0) + (Number(r.m2) || 0); });
  const hhByOS = {};
  sgeRows.forEach(r => { const os = r.os || '__SEM_OS__'; hhByOS[os] = (hhByOS[os] || 0) + (Number(r.totalHoras) || 0); });

  const osList = Array.from(new Set([...Object.keys(m2ByOS), ...Object.keys(hhByOS)])).filter(o => o !== '');
  return osList.map(os => {
    const m2 = m2ByOS[os] || 0;
    const hh = hhByOS[os] || 0;
    const std = m2 > 0 ? (hh / m2) : null;
    return { os, m2, hh, std };
  });
}

function calcStdAndaime(stdRows, sgeRows) {
  const mlByOS = {};
  stdRows.forEach(r => { const os = r.os || '__SEM_OS__'; mlByOS[os] = (mlByOS[os] || 0) + (Number(r.mlMontados) || 0); });
  const hhByOS = {};
  sgeRows.forEach(r => { const os = r.os || '__SEM_OS__'; hhByOS[os] = (hhByOS[os] || 0) + (Number(r.totalHoras) || 0); });

  const osList = Array.from(new Set([...Object.keys(mlByOS), ...Object.keys(hhByOS)])).filter(o => o !== '');
  return osList.map(os => {
    const ml = mlByOS[os] || 0;
    const hh = hhByOS[os] || 0;
    const std = ml > 0 ? (hh / ml) : null;
    return { os, ml, hh, std };
  });
}

/*****************************************
 * Render KPIs
 *****************************************/
function updateKPIs(stdPintArr, stdAndaArr, sgeRows) {
  const avgPint = stdPintArr.filter(r => r.std !== null).reduce((a, b) => a + b.std, 0) / (stdPintArr.length || 1);
  const avgAnda = stdAndaArr.filter(r => r.std !== null).reduce((a, b) => a + b.std, 0) / (stdAndaArr.length || 1);

  document.getElementById('kpiStdPintura').textContent = avgPint.toFixed(3);
  document.getElementById('kpiStdAndaime').textContent = avgAnda.toFixed(3);

  const hhReal = sgeRows.reduce((s, x) => s + Number(x.totalHoras || 0), 0);
  document.getElementById('kpiHHPrevReal').textContent = hhReal.toFixed(1);

  const globalStd = (avgPint + avgAnda) / 2;
  document.getElementById('kpiStdGlobal').textContent = globalStd.toFixed(3);
}

/*****************************************
 * Inicialização
 *****************************************/
async function initDashboard() {
  let stdData = [], pinturaData = [], sgeData = [];

  try {
    stdData = normalizeSTD(await fetchCSV(URL_STD));
  } catch (err) { console.warn('STD_Geral.csv falhou:', err); }
  try {
    pinturaData = normalizePintura(await fetchCSV(URL_PINTURA));
  } catch (err) { console.warn('consumo_horas.csv falhou:', err); }
  try {
    sgeData = normalizeSGE(await fetchCSV(URL_SGE));
  } catch (err) { console.warn('sge_horas.csv falhou:', err); }

  if (!stdData.length || !pinturaData.length || !sgeData.length) {
    console.warn('Algum CSV não carregou, use o botão Mockup.');
  }

  // Calcular STD
  const stdPintArr = calcStdPintura(pinturaData, sgeData);
  const stdAndaArr = calcStdAndaime(stdData, sgeData);

  // Atualizar KPIs
  updateKPIs(stdPintArr, stdAndaArr, sgeData);
}

// Botão Mockup
document.getElementById('btnLoadExample').addEventListener('click', () => {
  const pinturaEx = [{"Ref":"TINTA","DESCRIÇÃO DO PRODUTO":"Tinta X","DATA SAÍDA":"2025-08-01","O.S":"OS001","m²":120,"Qtd.":50,"RETIRADO POR":"João"}];
  const stdEx = [{"OS":"OS001","ML Montados":30,"HH Total":40,"Data":"2025-08-01","Encarregado":"Carlos"}];
  const sgeEx = [{"OS / Entregável":"OS001","Total Horas":40,"Data Ref.":"2025-08-01"}];
  const stdPintArr = calcStdPintura(normalizePintura(pinturaEx), normalizeSGE(sgeEx));
  const stdAndaArr = calcStdAndaime(normalizeSTD(stdEx), normalizeSGE(sgeEx));
  updateKPIs(stdPintArr, stdAndaArr, normalizeSGE(sgeEx));
});

// Inicializa dashboard
initDashboard();
