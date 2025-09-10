const githubFiles = {
  pintura: "https://raw.githubusercontent.com/FlutterVictor/Data_Analytcs/main/CSV/consumo_horas.csv",
  std: "https://raw.githubusercontent.com/FlutterVictor/Data_Analytcs/main/CSV/STD_Geral.csv",
  sge: "https://raw.githubusercontent.com/FlutterVictor/Data_Analytcs/main/CSV/sge_horas.csv"
};

let upload = {pintura:[], std:[], sge:[]};
let charts = {};

// --- Funções de leitura CSV ---
async function loadCSV(url){
  const res = await fetch(url);
  const text = await res.text();
  return Papa.parse(text,{header:true,skipEmptyLines:true}).data;
}

// --- Normalizadores ---
function normalizePintura(rows){
  return rows.map(r=>({
    ref: r['Ref']||'',
    descricao: r['Descrição do produto']||'',
    data: r['Data Saída']||'',
    os: r['OS']||'',
    m2: parseFloat(r['M²']||0),
    quantidade: parseFloat(r['Quantidade']||0),
    encarregado: r['Encarregado']||''
  }));
}

function normalizeSTD(rows){
  return rows.map(r=>({
    os: r['OS']||'',
    mlMontados: parseFloat(r['ML Montados']||0),
    hhTotal: parseFloat(r['HH Total']||0),
    data: r['Data']||'',
    encarregado: r['Encarregado']||''
  }));
}

function normalizeSGE(rows){
  return rows.map(r=>({
    os: r['OS / Entregável']||'',
    totalHoras: parseFloat(r['Total Horas']||0),
    dataRef: r['Data Ref.']||''
  }));
}

// --- Cálculo STD ---
function calcStdPintura(pinturaRows,sgeRows){
  const m2ByOS = {};
  const hhByOS = {};
  pinturaRows.forEach(r=>{const os=r.os||'__SEM_OS__'; m2ByOS[os]=(m2ByOS[os]||0)+r.m2;});
  sgeRows.forEach(r=>{const os=r.os||'__SEM_OS__'; hhByOS[os]=(hhByOS[os]||0)+r.totalHoras;});
  return Object.keys({...m2ByOS,...hhByOS}).map(os=>{
    const m2 = m2ByOS[os]||0;
    const hh = hhByOS[os]||0;
    return {os,m2,hh,std:m2>0?hh/m2:null};
  });
}

function calcStdAndaime(stdRows,sgeRows){
  const mlByOS = {};
  const hhByOS = {};
  stdRows.forEach(r=>{const os=r.os||'__SEM_OS__'; mlByOS[os]=(mlByOS[os]||0)+r.mlMontados;});
  sgeRows.forEach(r=>{const os=r.os||'__SEM_OS__'; hhByOS[os]=(hhByOS[os]||0)+r.totalHoras;});
  return Object.keys({...mlByOS,...hhByOS}).map(os=>{
    const ml = mlByOS[os]||0;
    const hh = hhByOS[os]||0;
    return {os,ml,hh,std:ml>0?hh/ml:null};
  });
}

// --- Agregações globais ---
function aggregateGlobal(stdPintArr,stdAndaArr){
  let hhTotal=0, denom=0;
  stdPintArr.forEach(r=>{hhTotal+=r.hh; denom+=r.m2;});
  stdAndaArr.forEach(r=>{hhTotal+=r.hh; denom+=r.ml;});
  const stdGlobal = denom>0?hhTotal/denom:null;
  return {hhTotal,denom,stdGlobal};
}

// --- Atualiza KPIs ---
function updateKPIs(stdPintArr,stdAndaArr,sgeRows){
  const pintValid = stdPintArr.filter(r=>r.std!==null);
  const andaValid = stdAndaArr.filter(r=>r.std!==null);
  const avgPint = pintValid.length? pintValid.reduce((a,b)=>a+b.std,0)/pintValid.length : null;
  const avgAnda = andaValid.length? andaValid.reduce((a,b)=>a+b.std,0)/andaValid.length : null;
  document.getElementById('kpiStdPintura').textContent = avgPint!==null?avgPint.toFixed(3):'-';
  document.getElementById('kpiStdAndaime').textContent = avgAnda!==null?avgAnda.toFixed(3):'-';

  const hhPrev = 0; // placeholder
  const hhReal = sgeRows.reduce((s,r)=>s+r.totalHoras,0);
  document.getElementById('kpiHHPrevReal').textContent = hhPrev>0? hhReal+' / '+hhPrev : hhReal+' / -';

  const global = aggregateGlobal(stdPintArr,stdAndaArr);
  document.getElementById('kpiStdGlobal').textContent = global.stdGlobal!==null?global.stdGlobal.toFixed(3):'-';
}

// --- Atualiza listas de produtividade ---
function updateProdLists(stdPintArr,stdAndaArr){
  const byEncP = {};
  stdPintArr.forEach(r=>{ const enc=r.os||'Sem'; byEncP[enc]=byEncP[enc]||{m2:0,hh:0}; byEncP[enc].m2+=r.m2; byEncP[enc].hh+=r.hh;});
  const arrP = Object.entries(byEncP).map(([k,v])=>({enc:k,std:v.m2>0?v.hh/v.m2:null})).sort((a,b)=>(b.std||0)-(a.std||0)).slice(0,8);
  const ulP = document.getElementById('prodPintura'); ulP.innerHTML=''; arrP.forEach(r=>{const li=document.createElement('li'); li.textContent=`${r.enc}: ${r.std!==null?r.std.toFixed(3):'-'}`; ulP.appendChild(li);});

  const byEncA = {};
  stdAndaArr.forEach(r=>{ const enc=r.os||'Sem'; byEncA[enc]=byEncA[enc]||{ml:0,hh:0}; byEncA[enc].ml+=r.ml; byEncA[enc].hh+=r.hh;});
  const arrA = Object.entries(byEncA).map(([k,v])=>({enc:k,std:v.ml>0?v.hh/v.ml:null})).sort((a,b)=>(b.std||0)-(a.std||0)).slice(0,8);
  const ulA = document.getElementById('prodAndaime'); ulA.innerHTML=''; arrA.forEach(r=>{const li=document.createElement('li'); li.textContent=`${r.enc}: ${r.std!==null?r.std.toFixed(3):'-'}`; ulA.appendChild(li);});
}

// --- Atualiza amostras ---
function updateSamples(pintura,std){
  const tableP = document.getElementById('samplePintura'); tableP.innerHTML='';
  if(pintura.length>0){
    const ths = Object.keys(pintura[0]);
    let tr = '<tr>'+ths.map(h=>`<th>${h}</th>`).join('')+'</tr>';
    pintura.slice(0,5).forEach(r=>{tr+='<tr>'+ths.map(h=>`<td>${r[h]}</td>`).join('')+'</tr>';});
    tableP.innerHTML=tr;
  }
  const tableA = document.getElementById('sampleAndaime'); tableA.innerHTML='';
  if(std.length>0){
    const ths = Object.keys(std[0]);
    let tr = '<tr>'+ths.map(h=>`<th>${h}</th>`).join('')+'</tr>';
    std.slice(0,5).forEach(r=>{tr+='<tr>'+ths.map(h=>`<td>${r[h]}</td>`).join('')+'</tr>';});
    tableA.innerHTML=tr;
  }
}

// --- Charts ---
function destroyChart(id){ if(charts[id]){ charts[id].destroy(); charts[id]=null;} }
function chartTrend(trendData){
  destroyChart('trendChart');
  const ctx = document.getElementById('trendChart').getContext('2d');
  const labels = trendData.map(d=>d.label);
  const pintura = trendData.map(d=>d.stdPintura);
  const andaime = trendData.map(d=>d.stdAndaime);
  charts['trendChart']=new Chart(ctx,{
    type:'line',
    data:{labels,datasets:[{label:'STD Pintura',data:pintura,borderColor:'#0b63d6',tension:0.2,spanGaps:true},{label:'STD Andaime',data:andaime,borderColor:'#f59e0b',tension:0.2,spanGaps:true}]},
    options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:false}}}
  });
}

function chartHHCompare(data){
  destroyChart('hhCompareChart');
  const ctx = document.getElementById('hhCompareChart').getContext('2d');
  charts['hhCompareChart']=new Chart(ctx,{
    type:'bar',
    data:{
      labels:data.map(d=>d.label),
      datasets:[{label:'Previsto',data:data.map(d=>d.prev||0),backgroundColor:'#0b63d6'},{label:'Real',data:data.map(d=>d.real||0),backgroundColor:'#10b981'}]
    },
    options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}}}
  });
}

// --- Pipeline ---
async function processAll(){
  upload.pintura = normalizePintura(await loadCSV(githubFiles.pintura));
  upload.std = normalizeSTD(await loadCSV(githubFiles.std));
  upload.sge = normalizeSGE(await loadCSV(githubFiles.sge));

  const stdPintArr = calcStdPintura(upload.pintura,upload.sge);
  const stdAndaArr = calcStdAndaime(upload.std,upload.sge);

  updateKPIs(stdPintArr,stdAndaArr,upload.sge);
  updateProdLists(stdPintArr,stdAndaArr);
  updateSamples(upload.pintura,upload.std);

  // tendência mensal
  const dates = Array.from(new Set([...upload.pintura.map(r=>r.data), ...upload.std.map(r=>r.data)])).sort();
  const trend = dates.map(d=>{
    const sp = stdPintArr.filter(r=>r.os && upload.pintura.find(p=>p.os===r.os)).reduce((a,b)=>a+b.std,0)/Math.max(1,stdPintArr.length);
    const sa = stdAndaArr.filter(r=>r.os && upload.std.find(p=>p.os===r.os)).reduce((a,b)=>a+b.std,0)/Math.max(1,stdAndaArr.length);
    return {label:d,stdPintura:sp,stdAndaime:sa};
  });
  chartTrend(trend);

  // HH compare (placeholder)
  chartHHCompare([{label:'Total',prev:0,real:upload.sge.reduce((s,r)=>s+r.totalHoras,0)}]);
}

// --- Botões ---
document.getElementById('btnLoadExample').addEventListener('click',()=>processAll());
document.getElementById('btnExportPDF').addEventListener('click',()=>{ alert('Função Exportar PDF ainda não implementada');});
