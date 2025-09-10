/*****************************************
 * Bibliotecas de leitura CSV
 *****************************************/
async function fetchCSV(url) {
  const res = await fetch(url);
  const text = await res.text();
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
}

/*****************************************
 * Funções auxiliares
 *****************************************/
function getField(row, variants) {
  for (const v of variants) if (row.hasOwnProperty(v)) return row[v];
  const keys = Object.keys(row);
  for (const k of keys) {
    const nk = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (variants.some(v => nk.toLowerCase().includes(v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) return row[k];
  }
  return "";
}

function parseFloatSafe(val) {
  return parseFloat(val || 0) || 0;
}

/*****************************************
 * Normalizadores
 *****************************************/
function normalizeSTD(rows) {
  return rows.map(r => ({
    semana: getField(r, ["Semanas","Semana"]),
    os: getField(r, ["OS"]),
    matricula: getField(r, ["Matricula","Matrícula"]),
    encarregado: getField(r, ["Encarregado Responsavel","Encarregado"]),
    mlMontados: parseFloatSafe(getField(r, ["ML Montados","ML_Montados"])),
    mlDesmontados: parseFloatSafe(getField(r, ["ML Desmontados","ML_Desmontados"])),
    hhTotal: parseFloatSafe(getField(r, ["HH Total","HH_Total"])),
    stdMontado: parseFloatSafe(getField(r, ["STD Montado","STD_Montado"]))
  }));
}

function normalizePintura(rows) {
  return rows.map(r => ({
    ref: getField(r, ["REF"]),
    descricao: getField(r, ["DESCRIÇÃO DO PRODUTO","DESCRICAO DO PRODUTO"]),
    data: getField(r, ["DATA SAÍDA","DATA SAIDA"]),
    os: getField(r, ["O.S","OS"]),
    area: getField(r, ["ÁREA DE APLICAÇÃO","AREA DE APLICACAO"]),
    quantidade: parseFloatSafe(getField(r, ["Qtd","QUANTIDADE"])),
    m2: parseFloatSafe(getField(r, ["m²","M2"])),
    tipo: getField(r, ["TIPO DE APLICAÇÃO","TIPO"]),
    encarregado: getField(r, ["RETIRADO POR","Encarregado"])
  }));
}

function normalizeSGE(rows) {
  return rows.map(r => ({
    os: getField(r, ["OS / Entregável","OS","Entregável"]),
    totalHoras: parseFloatSafe(getField(r, ["Total Horas","TotalHoras"])),
    dataRef: getField(r, ["Data Ref.","Data Ref","Data"])
  }));
}

/*****************************************
 * Cálculos
 *****************************************/
function calcStdPintura(pinturaRows, sgeRows) {
  const m2ByOS = {}, hhByOS = {};
  pinturaRows.forEach(r => { const os = r.os||'__SEM_OS__'; m2ByOS[os]=(m2ByOS[os]||0)+r.m2; });
  sgeRows.forEach(r => { const os = r.os||'__SEM_OS__'; hhByOS[os]=(hhByOS[os]||0)+r.totalHoras; });

  return Object.keys({...m2ByOS,...hhByOS}).map(os=>{
    const m2 = m2ByOS[os]||0;
    const hh = hhByOS[os]||0;
    const std = m2>0 ? hh/m2 : null;
    return { os, m2, hh, std };
  });
}

function calcStdAndaime(stdRows, sgeRows) {
  const mlByOS = {}, hhByOS = {};
  stdRows.forEach(r => { const os=r.os||'__SEM_OS__'; mlByOS[os]=(mlByOS[os]||0)+r.mlMontados; });
  sgeRows.forEach(r => { const os=r.os||'__SEM_OS__'; hhByOS[os]=(hhByOS[os]||0)+r.totalHoras; });

  return Object.keys({...mlByOS,...hhByOS}).map(os=>{
    const ml = mlByOS[os]||0;
    const hh = hhByOS[os]||0;
    const std = ml>0 ? hh/ml : null;
    return { os, ml, hh, std };
  });
}

function aggregateGlobal(stdPintArr, stdAndaArr) {
  let hhTotal=0, denom=0;
  stdPintArr.forEach(r=>{ hhTotal+=r.hh; denom+=r.m2; });
  stdAndaArr.forEach(r=>{ hhTotal+=r.hh; denom+=r.ml; });
  const stdGlobal = denom>0 ? hhTotal/denom : null;
  return { hhTotal, denom, stdGlobal };
}

/*****************************************
 * Renderização KPIs, listas e gráficos
 *****************************************/
function updateKPIs(stdPintArr, stdAndaArr, sgeRows) {
  // STD Pintura e Andaime
  const avgPint = stdPintArr.filter(r=>r.std!==null).reduce((a,b)=>a+b.std,0)/Math.max(1,stdPintArr.filter(r=>r.std!==null).length);
  const avgAnda = stdAndaArr.filter(r=>r.std!==null).reduce((a,b)=>a+b.std,0)/Math.max(1,stdAndaArr.filter(r=>r.std!==null).length);
  document.getElementById('kpiStdPintura').textContent = avgPint.toFixed(3);
  document.getElementById('kpiStdAndaime').textContent = avgAnda.toFixed(3);

  // HH Previsto vs Real
  const hhPrevPint = 43430; // informado por você
  const hhPrevAnda = 158368;
  const hhReal = sgeRows.reduce((s,r)=>s+r.totalHoras,0);
  document.getElementById('kpiHHPrevReal').textContent = `${hhReal.toFixed(1)} / ${hhPrevPint+hhPrevAnda}`;

  // Eficiência Global
  const global = aggregateGlobal(stdPintArr,stdAndaArr);
  document.getElementById('kpiStdGlobal').textContent = global.stdGlobal!==null?global.stdGlobal.toFixed(3):'-';

  // Listas de produtividade (substituindo gráficos de barras)
  renderList('stdPinturaList', stdPintArr, 'm2');
  renderList('stdAndaimeList', stdAndaArr, 'ml');

  // TrendChart
  renderTrendChart(stdPintArr,stdAndaArr);

  // Comparativo HH
  renderHHCompare(sgeRows);
}

function renderList(id, arr, keyQty){
  const el = document.getElementById(id);
  el.innerHTML = '';
  arr.sort((a,b)=>(b.std||0)-(a.std||0)).slice(0,8).forEach(r=>{
    const li = document.createElement('li');
    li.textContent = `${r.os} — ${r.std? r.std.toFixed(3) : '-'} (${keyQty==='m2'?r.m2:r.ml})`;
    el.appendChild(li);
  });
}

function renderTrendChart(stdPintArr,stdAndaArr){
  destroyChart('trendChart');
  const dates = Array.from(new Set([...stdPintArr.map(r=>r.os),...stdAndaArr.map(r=>r.os)]));
  const labels = dates;
  const pintura = dates.map(d=>stdPintArr.find(r=>r.os===d)?.std||null);
  const andaime = dates.map(d=>stdAndaArr.find(r=>r.os===d)?.std||null);

  const ctx = document.getElementById('trendChart').getContext('2d');
  charts['trendChart'] = new Chart(ctx,{
    type:'line',
    data:{
      labels,
      datasets:[
        {label:'STD Pintura', data:pintura, borderColor:'#0b63d6', tension:0.2, spanGaps:true},
        {label:'STD Andaime', data:andaime, borderColor:'#f59e0b', tension:0.2, spanGaps:true}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:false}}}
  });
}

function renderHHCompare(sgeRows){
  destroyChart('hhCompareChart');
  const ctx = document.getElementById('hhCompareChart').getContext('2d');
  const labels = Array.from(new Set(sgeRows.map(r=>r.dataRef)));
  const dataReal = labels.map(l=>sgeRows.filter(r=>r.dataRef===l).reduce((s,r)=>s+r.totalHoras,0));
  const dataPrev = labels.map(l=>0);
  charts['hhCompareChart'] = new Chart(ctx,{
    type:'bar',
    data:{labels,datasets:[
      {label:'Previsto',data:dataPrev,backgroundColor:'#0b63d6'},
      {label:'Real',data:dataReal,backgroundColor:'#10b981'}
    ]},
    options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}}}
  });
}

/*****************************************
 * Charts helpers
 *****************************************/
let charts = {};
function destroyChart(id){ if(charts[id]){ charts[id].destroy(); charts[id]=null; } }

/*****************************************
 * Pipeline principal
 *****************************************/
function processAll(pintura,std,sge){
  const stdPintArr = calcStdPintura(pintura,sge);
  const stdAndaArr = calcStdAndaime(std,sge);
  updateKPIs(stdPintArr,stdAndaArr,sge);

  // Amostras de arquivos
  renderSample('samplePintura',pintura);
  renderSample('sampleAndaime',std);
}

function renderSample(id,arr){
  const el = document.getElementById(id);
  el.innerHTML = '';
  arr.slice(0,5).forEach(r=>{
    const div = document.createElement('div');
    div.textContent = JSON.stringify(r);
    el.appendChild(div);
  });
}

/*****************************************
 * Inicialização: GitHub CSVs
 *****************************************/
async function initDashboard(){
  try{
    const pinturaRaw = await fetchCSV("https://raw.githubusercontent.com/FlutterVictor/Data_Analytcs/main/CSV/consumo_horas.csv");
    const stdRaw = await fetchCSV("https://raw.githubusercontent.com/FlutterVictor/Data_Analytcs/main/CSV/STD_Geral.csv");
    const sgeRaw = await fetchCSV("https://raw.githubusercontent.com/FlutterVictor/Data_Analytcs/main/CSV/sge_horas.csv");

    const pintura = normalizePintura(pinturaRaw);
    const std = normalizeSTD(stdRaw);
    const sge = normalizeSGE(sgeRaw);

    processAll(pintura,std,sge);
  } catch(err){
    console.error("Erro ao carregar CSVs do GitHub:",err);
  }
}

/*****************************************
 * Executar dashboard
 *****************************************/
initDashboard();
