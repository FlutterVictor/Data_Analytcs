/*****************************************
 * URLs dos CSVs
 *****************************************/
const URL_STD = 'https://raw.githubusercontent.com/FlutterVictor/Data_Analytcs/main/CSV/STD_Geral.csv';
const URL_PINTURA = 'https://raw.githubusercontent.com/FlutterVictor/Data_Analytcs/main/CSV/consumo_horas.csv';
const URL_SGE = 'https://raw.githubusercontent.com/FlutterVictor/Data_Analytcs/main/CSV/sge_horas.csv';

/*****************************************
 * Função para carregar CSV via PapaParse
 *****************************************/
async function loadCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        console.log('CSV carregado:', url, results.data.length, 'linhas');
        resolve(results.data);
      },
      error: function(err) {
        console.error('Erro ao carregar CSV:', url, err);
        alert('Erro ao carregar CSV: ' + url);
        reject(err);
      }
    });
  });
}

/*****************************************
 * Normalizadores de dados
 *****************************************/
function getField(row, variants) {
  for(const v of variants){
    if(row.hasOwnProperty(v)) return row[v];
  }
  const keys = Object.keys(row);
  for(const k of keys){
    if(k && variants.some(v=>k.toLowerCase().includes(v.toLowerCase()))) return row[k];
  }
  return '';
}

function normalizePintura(rows){
  return rows.map(r=>{
    return {
      ref: getField(r,['REF','Ref']) || '',
      descricao: getField(r,['DESCRIÇÃO DO PRODUTO','Descrição do produto','Descricao']) || '',
      data: getField(r,['DATA SAÍDA','Data','Data Saida']) || '',
      diaSemana: getField(r,['Dia','Dia da semana']) || '',
      os: getField(r,['O.S','OS','os']) || '',
      area: getField(r,['ÁREA DE APLICAÇÃO','Area de aplicação','Área','Area']) || '',
      quantidade: parseFloat(getField(r,['Qtd','Quantidade','QTD'])||0) || 0,
      m2: parseFloat(getField(r,['m²','M²','M2'])||0) || 0,
      ubm: getField(r,['UNID','Unidade'])||'',
      tipo: getField(r,['TIPO DE APLICAÇÃO','Tipo'])||'',
      encarregado: getField(r,['RETIRADO POR','Encarregado'])||''
    };
  });
}

function normalizeSTD(rows){
  return rows.map(r=>{
    return {
      semana: getField(r,['Semanas','Semana'])||'',
      os: getField(r,['OS','O.S'])||'',
      matricula: getField(r,['Matricula','Matrícula'])||'',
      encarregado: getField(r,['Encarregado Responsavel','Encarregado'])||'',
      area: getField(r,['ÁREA','Area'])||'',
      montPresente: parseFloat(getField(r,['Mont.Presente','Montadores'])||0)||0,
      hhTotal: parseFloat(getField(r,['HH Total','HH_Total'])||0)||0,
      mlMontados: parseFloat(getField(r,['ML Montados','ML'])||0)||0,
      mlPrevisto: parseFloat(getField(r,['ML PREVISTO','ML Previsto'])||0)||0,
      stdMontado: parseFloat(getField(r,['STD Montado'])||0)||0
    };
  });
}

function normalizeSGE(rows){
  return rows.map(r=>{
    return {
      dataRef: getField(r,['Data Ref.','Data','Data Ref'])||'',
      matricula: getField(r,['Matricula','Matrícula'])||'',
      recurso: getField(r,['Recurso'])||'',
      cargo: getField(r,['Cargo'])||'',
      totalHoras: parseFloat(getField(r,['Total Horas','TotalHoras','Total_Horas'])||0)||0,
      os: getField(r,['OS / Entregável','OS','Entregável','OS/Entregavel'])||''
    };
  });
}

/*****************************************
 * Calcula STD por OS
 *****************************************/
function calcStdPintura(pinturaRows, sgeRows){
  const m2ByOS = {};
  pinturaRows.forEach(r=>{ const os=r.os||'__SEM_OS__'; m2ByOS[os]=(m2ByOS[os]||0)+ (Number(r.m2)||0); });
  const hhByOS = {};
  sgeRows.forEach(r=>{ const os=r.os||'__SEM_OS__'; hhByOS[os]=(hhByOS[os]||0)+ (Number(r.totalHoras)||0); });

  const osList = Array.from(new Set([...Object.keys(m2ByOS), ...Object.keys(hhByOS)])).filter(o=>o!=='');
  return osList.map(os=>{
    const m2 = m2ByOS[os]||0;
    const hh = hhByOS[os]||0;
    const std = m2>0 ? hh/m2 : null;
    return { os, m2, hh, std };
  });
}

function calcStdAndaime(stdRows, sgeRows){
  const mlByOS = {};
  stdRows.forEach(r=>{ const os=r.os||'__SEM_OS__'; mlByOS[os]=(mlByOS[os]||0)+ (Number(r.mlMontados)||0); });
  const hhByOS = {};
  sgeRows.forEach(r=>{ const os=r.os||'__SEM_OS__'; hhByOS[os]=(hhByOS[os]||0)+ (Number(r.totalHoras)||0); });

  const osList = Array.from(new Set([...Object.keys(mlByOS), ...Object.keys(hhByOS)])).filter(o=>o!=='');
  return osList.map(os=>{
    const ml = mlByOS[os]||0;
    const hh = hhByOS[os]||0;
    const std = ml>0 ? hh/ml : null;
    return { os, ml, hh, std };
  });
}

/*****************************************
 * Atualiza KPIs e listas
 *****************************************/
function updateKPIs(stdPintArr, stdAndaArr, sgeRows){
  // Média STD
  const avgPint = stdPintArr.filter(r=>r.std!==null).reduce((a,b)=>a+b.std,0)/ (stdPintArr.filter(r=>r.std!==null).length || 1);
  const avgAnda = stdAndaArr.filter(r=>r.std!==null).reduce((a,b)=>a+b.std,0)/ (stdAndaArr.filter(r=>r.std!==null).length || 1);

  document.getElementById('kpiStdPintura').textContent = avgPint.toFixed(3);
  document.getElementById('kpiStdAndaime').textContent = avgAnda.toFixed(3);

  // HH Previsto x Real
  const hhReal = sgeRows.reduce((s,r)=>s+r.totalHoras,0);
  const hhPrevistoPintura = 43430;
  const hhPrevistoAndaime = 158368;
  document.getElementById('kpiHHPrevReal').textContent = 
      `${hhReal.toFixed(1)} / ${ (hhPrevistoPintura+hhPrevistoAndaime).toFixed(1) }`;

  // Global STD
  const hhTotal = stdPintArr.reduce((s,r)=>s+r.hh,0) + stdAndaArr.reduce((s,r)=>s+r.hh,0);
  const denom = stdPintArr.reduce((s,r)=>s+r.m2,0) + stdAndaArr.reduce((s,r)=>s+r.ml,0);
  const stdGlobal = denom>0 ? hhTotal/denom : 0;
  document.getElementById('kpiStdGlobal').textContent = stdGlobal.toFixed(3);

  // Listas de produtividade
  const listPint = document.getElementById('listPintura');
  listPint.innerHTML = '';
  stdPintArr.sort((a,b)=>(b.std||0)-(a.std||0)).forEach(r=>{
    const li = document.createElement('li');
    li.textContent = `${r.os} — STD: ${r.std.toFixed(3)} (m²)`;
    listPint.appendChild(li);
  });

  const listAnda = document.getElementById('listAndaime');
  listAnda.innerHTML = '';
  stdAndaArr.sort((a,b)=>(b.std||0)-(a.std||0)).forEach(r=>{
    const li = document.createElement('li');
    li.textContent = `${r.os} — STD: ${r.std.toFixed(3)} (m.l.)`;
    listAnda.appendChild(li);
  });
}

/*****************************************
 * Função principal para carregar e processar todos os arquivos
 *****************************************/
async function processAll(){
  try{
    const [pinturaRaw,stdRaw,sgeRaw] = await Promise.all([
      loadCSV(URL_PINTURA),
      loadCSV(URL_STD),
      loadCSV(URL_SGE)
    ]);

    const pintura = normalizePintura(pinturaRaw);
    const std = normalizeSTD(stdRaw);
    const sge = normalizeSGE(sgeRaw);

    const stdPintArr = calcStdPintura(pintura,sge);
    const stdAndaArr = calcStdAndaime(std,sge);

    updateKPIs(stdPintArr,stdAndaArr,sge);

  }catch(err){
    console.error('Erro no processamento dos CSVs',err);
  }
}

/*****************************************
 * Botão Mockup
 *****************************************/
document.getElementById('btnLoadExample').addEventListener('click', ()=>{
  const pinturaEx = [{"REF":"TINTA","DESCRIÇÃO DO PRODUTO":"Tinta X","DATA SAÍDA":"2025-08-01","O.S":"OS001","m²":120,"Qtd.":50,"RETIRADO POR":"João"}];
  const stdEx = [{"OS":"OS001","ML Montados":30,"HH Total":40,"Encarregado Responsavel":"Carlos"}];
  const sgeEx = [{"OS / Entregável":"OS001","Total Horas":40,"dataRef":"2025-08-01"}];
  const stdPintArr = calcStdPintura(normalizePintura(pinturaEx), normalizeSGE(sgeEx));
  const stdAndaArr = calcStdAndaime(normalizeSTD(stdEx), normalizeSGE(sgeEx));
  updateKPIs(stdPintArr,stdAndaArr,normalizeSGE(sgeEx));
});

/*****************************************
 * Inicializa carregamento
 *****************************************/
processAll();
