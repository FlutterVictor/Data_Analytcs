// dashboard_integrado.js

// URLs dos arquivos CSV no GitHub
const URL_STD = 'https://raw.githubusercontent.com/FlutterVictor/Data_Analytcs/main/CSV/STD_Geral.csv';
const URL_PINTURA = 'https://raw.githubusercontent.com/FlutterVictor/Data_Analytcs/main/CSV/consumo_horas.csv';
const URL_SGE = 'https://raw.githubusercontent.com/FlutterVictor/Data_Analytcs/main/CSV/sge_horas.csv';

// Total de horas previstas
const TOTAL_HH = { pintura: 43430, andaime: 158368 };

// Armazenamento dos dados
let dataSTD = [], dataPintura = [], dataSGE = [];

// Carregar CSV do GitHub via PapaParse
async function loadCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: function(results) { resolve(results.data); },
      error: function(err) { reject(err); }
    });
  });
}

// Normalizadores
function normalizeSTD(rows){
  return rows.map(r=>({
    semana: r['Semanas'] || '',
    os: r['OS'] || '',
    matricula: r['Matricula'] || '',
    encarregado: r['Encarregado Responsavel'] || '',
    area: r['ÁREA'] || '',
    atividade: r['ATIVIDADE'] || '',
    data: r['Data'] || '',
    montPresente: parseFloat(r['Mont.Presente']||0),
    hhTotal: parseFloat(r['HH Total']||0),
    mlMontados: parseFloat(r['ML Montados']||0),
    mlDesmontados: parseFloat(r['ML Desmontados']||0),
    mlPrevisto: parseFloat(r['ML PREVISTO']||0),
    metaPMont: parseFloat(r['Meta P/Mont']||0),
    stdMontado: parseFloat(r['STD Montado']||0),
    stdPadrao: parseFloat(r['STD PADRÃO']||0)
  }));
}

function normalizePintura(rows){
  return rows.map(r=>({
    ref: r['REF'] || '',
    descricao: r['DESCRIÇÃO DO PRODUTO'] || '',
    data: r['DATA SAÍDA'] || '',
    dia: r['Dia'] || '',
    os: r['O.S'] || '',
    area: r['ÁREA DE APLICAÇÃO'] || '',
    qtd: parseFloat(r['Qtd.']||0),
    m2: parseFloat(r['m²']||0),
    unid: r['UNID'] || '',
    tipo: r['TIPO DE APLICAÇÃO'] || '',
    retiradoPor: r['RETIRADO POR'] || ''
  }));
}

function normalizeSGE(rows){
  return rows.map(r=>({
    dataRef: r['Data Ref.'] || '',
    matricula: r['Matricula'] || '',
    recurso: r['Recurso (Nome do colaborador)'] || '',
    cargo: r['Cargo'] || '',
    entrada: r['Entrada Catraca'] || '',
    inicio: r['Início'] || '',
    fim: r['Fim'] || '',
    saida: r['Saida Catraca'] || '',
    totalHoras: parseFloat(r['Total Horas']||0),
    os: r['OS / Entregável'] || ''
  }));
}

// Cálculos
function calcStdPintura(pintura, sge){
  const byOS = {};
  pintura.forEach(p=>{
    const os = p.os || '__SEM_OS__';
    if(!byOS[os]) byOS[os] = { m2:0, hh:0 };
    byOS[os].m2 += p.m2;
  });
  sge.forEach(s=>{
    const os = s.os || '__SEM_OS__';
    if(!byOS[os]) byOS[os] = { m2:0, hh:0 };
    byOS[os].hh += s.totalHoras || 0;
  });
  return Object.entries(byOS).map(([os, v])=>({
    os,
    m2: v.m2,
    hh: v.hh,
    std: v.m2>0 ? v.hh/v.m2 : null
  }));
}

function calcStdAndaime(stdRows, sge){
  const byOS = {};
  stdRows.forEach(r=>{
    const os = r.os || '__SEM_OS__';
    if(!byOS[os]) byOS[os] = { ml:0, hh:0 };
    byOS[os].ml += r.mlMontados;
  });
  sge.forEach(s=>{
    const os = s.os || '__SEM_OS__';
    if(!byOS[os]) byOS[os] = { ml:0, hh:0 };
    byOS[os].hh += s.totalHoras || 0;
  });
  return Object.entries(byOS).map(([os,v])=>({
    os,
    ml: v.ml,
    hh: v.hh,
    std: v.ml>0 ? v.hh/v.ml : null
  }));
}

function aggregateGlobal(stdPintArr, stdAndaArr){
  let hhTotal=0, denom=0;
  stdPintArr.forEach(r=>{ hhTotal+=r.hh; denom+=r.m2; });
  stdAndaArr.forEach(r=>{ hhTotal+=r.hh; denom+=r.ml; });
  return { hhTotal, denom, stdGlobal: denom>0? hhTotal/denom:null };
}

// Render KPIs
function updateKPIs(stdPintArr, stdAndaArr, sgeRows){
  const avgPint = stdPintArr.filter(r=>r.std!==null).reduce((a,b)=>a+b.std,0)/Math.max(1,stdPintArr.filter(r=>r.std!==null).length);
  const avgAnda = stdAndaArr.filter(r=>r.std!==null).reduce((a,b)=>a+b.std,0)/Math.max(1,stdAndaArr.filter(r=>r.std!==null).length);

  document.getElementById('kpiStdPintura').textContent = avgPint.toFixed(3);
  document.getElementById('kpiStdAndaime').textContent = avgAnda.toFixed(3);

  const hhPrev = TOTAL_HH.pintura + TOTAL_HH.andaime;
  const hhReal = sgeRows.reduce((a,b)=>a+b.totalHoras,0);
  document.getElementById('kpiHHPrevReal').textContent = hhReal.toFixed(1)+' / '+hhPrev.toFixed(1);

  const global = aggregateGlobal(stdPintArr, stdAndaArr);
  document.getElementById('kpiStdGlobal').textContent = global.stdGlobal.toFixed(3);
}

// Render listas de tendência
function renderTrendList(id, arr, keyLabel='label', keyValue='std'){
  const ul = document.getElementById(id);
  ul.innerHTML = '';
  arr.sort((a,b)=>b[keyValue]-a[keyValue]).forEach(item=>{
    const li = document.createElement('li');
    li.textContent = `${item[keyLabel]} : ${item[keyValue]!==null?item[keyValue].toFixed(3):'-'}`;
    ul.appendChild(li);
  });
}

// Render tabelas de amostra
function renderSampleTable(id, arr, cols){
  const table = document.getElementById(id);
  let html = '<thead><tr>';
  cols.forEach(c=>{ html+=`<th>${c}</th>`; });
  html+='</tr></thead><tbody>';
  arr.slice(0,8).forEach(r=>{
    html+='<tr>';
    cols.forEach(c=>{
      html+=`<td>${r[c]!==undefined?r[c]:''}</td>`;
    });
    html+='</tr>';
  });
  html+='</tbody>';
  table.innerHTML = html;
}

// Inicialização
async function initDashboard(){
  try {
    const [stdRaw, pinturaRaw, sgeRaw] = await Promise.all([
      loadCSV(URL_STD),
      loadCSV(URL_PINTURA),
      loadCSV(URL_SGE)
    ]);
    dataSTD = normalizeSTD(stdRaw);
    dataPintura = normalizePintura(pinturaRaw);
    dataSGE = normalizeSGE(sgeRaw);

    const stdPintArr = calcStdPintura(dataPintura, dataSGE);
    const stdAndaArr = calcStdAndaime(dataSTD, dataSGE);

    updateKPIs(stdPintArr, stdAndaArr, dataSGE);

    // Tendência - Listas
    renderTrendList('trendPinturaList', stdPintArr, 'os', 'std');
    renderTrendList('trendAndaimeList', stdAndaArr, 'os', 'std');

    // Amostras - tabelas
    renderSampleTable('samplePintura', dataPintura, ['ref','descricao','data','os','m2','qtd']);
    renderSampleTable('sampleAndaime', dataSTD, ['os','data','mlMontados','hhTotal','stdMontado']);
  } catch(err){
    console.error('Erro carregando dashboard:', err);
  }
}

// Mockup button
document.getElementById('btnLoadExample').addEventListener('click', async ()=>{
  dataSTD = [{"OS":"OS001","ML Montados":30,"HH Total":40,"Data":"2025-08-01","Encarregado Responsavel":"Carlos"}];
  dataPintura = [{"REF":"TINTA","DESCRIÇÃO DO PRODUTO":"Tinta X","DATA SAÍDA":"2025-08-01","O.S":"OS001","m²":120,"Qtd.":50,"RETIRADO POR":"João"}];
  dataSGE = [{"OS / Entregável":"OS001","Total Horas":40,"Data Ref.":"2025-08-01"}];
  initDashboard();
});

// Inicializa dashboard
initDashboard();
