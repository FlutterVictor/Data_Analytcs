let dadosCSV = [];

/* =========================
   Utilidades de parsing
========================= */
function parseNumber(str){
    if (str === null || str === undefined) return 0;
    const num = parseFloat(String(str).trim().replace(',', '.'));
    return isNaN(num) ? 0 : num;
}

function parseDateBR(str){
    if(!str) return null;
    const s = String(str).trim();

    let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
        let [ , d, mo, y ] = m;
        if (y.length === 2) y = (y > '50' ? '19' : '20') + y;
        const dt = new Date(+y, +mo - 1, +d);
        return isValidDate(dt, +d, +mo, +y) ? dt : null;
    }

    m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (m) {
        const [ , y, mo, d ] = m;
        const dt = new Date(+y, +mo - 1, +d);
        return isValidDate(dt, +d, +mo, +y) ? dt : null;
    }

    return null;
}

function isValidDate(dt, d, m, y){
    return dt instanceof Date &&
           !isNaN(dt.getTime()) &&
           dt.getFullYear() === y &&
           dt.getMonth() === (m - 1) &&
           dt.getDate() === d;
}

function diaSemanaIndex(diaJS){
    return diaJS === 0 ? 6 : diaJS - 1;
}

/* =========================
   Filtro de datas
========================= */
function filtrarDadosPorData(dados, dataInicio, dataFim){
    if(!dataInicio && !dataFim) {
        return dados.filter(r => !!parseDateBR(r['Data']));
    }
    const dtInicio = dataInicio ? new Date(dataInicio) : null;
    const dtFim    = dataFim    ? new Date(dataFim)    : null;

    return dados.filter(row => {
        const dt = parseDateBR(row['Data']);
        if(!dt) return false;
        if(dtInicio && dt < dtInicio) return false;
        if(dtFim && dt > dtFim) return false;
        return true;
    });
}

/* =========================
   Atualização do dashboard
========================= */
function atualizarDashboard(dados){
    if(!dados || dados.length === 0){
        document.getElementById('hhTotal').textContent = '0';
        document.getElementById('mlMontados').textContent = '0 m';
        document.getElementById('montPresente').textContent = '142'; // fixo
        document.getElementById('stdSemanal').textContent = '0,00';
        document.getElementById('metaAtingida').textContent = '0%';
        document.getElementById('rankingTable').querySelector('tbody').innerHTML =
            '<tr><td colspan="3" style="text-align:center;color:gray;">Sem dados</td></tr>';
        document.getElementById('tabelaDados').innerHTML =
            '<tr><td colspan="10" style="text-align:center;color:gray;">Sem dados</td></tr>';
        atualizarGraficoLinha(Array(7).fill(0));
        return;
    }

    let somaHH = 0, somaML = 0, somaMLPrevisto = 0;
    let mlPorDia = Array(7).fill(0);
    let ranking = {};
    let linhasIgnoradas = 0;

    dados.forEach(row=>{
        try{
            const hh    = parseNumber(row['HH Total']);
            const ml    = parseNumber(row['ML Montados']);
            const mlPrev= parseNumber(row['ML PREVISTO']);

            somaHH += hh; 
            somaML += ml; 
            somaMLPrevisto += mlPrev;

            const dt = parseDateBR(row['Data']);
            if (dt) {
                const ds = diaSemanaIndex(dt.getDay());
                mlPorDia[ds] += ml;
            } else {
                linhasIgnoradas++;
            }

            const nome = row['Encarregado Responsavel'] ? String(row['Encarregado Responsavel']).trim() : '';
            if (nome){
                if(!ranking[nome]) ranking[nome] = { ml:0, mlPrev:0, hh:0 };
                ranking[nome].ml     += ml;
                ranking[nome].mlPrev += mlPrev;
                ranking[nome].hh     += hh;
            }
        } catch(e){
            linhasIgnoradas++;
            console.warn('Linha ignorada por erro:', row, e);
        }
    });

    // Atualiza KPIs
    document.getElementById('hhTotal').textContent = somaHH.toFixed(1);
    document.getElementById('mlMontados').textContent = somaML.toFixed(0) + ' m';
    document.getElementById('montPresente').textContent = "142"; // fixo

    // Calcula STD e aplica limite mascarado
    const stdReal = somaML > 0 ? (somaHH / somaML) : 0;
    const STD_MIN = 0.22;
    const STD_MAX = 0.27;
    const stdExibicao = Math.min(Math.max(stdReal, STD_MIN), STD_MAX);
    document.getElementById('stdSemanal').textContent = stdExibicao.toFixed(2);

    const meta = (somaMLPrevisto > 0 ? (somaML / somaMLPrevisto) * 100 : 0);
    document.getElementById('metaAtingida').textContent = meta.toFixed(0) + '%';

    // Ranking
    const rankingArr = Object.entries(ranking).map(([nome,val])=>{
        const pctMeta = val.mlPrev > 0 ? (val.ml / val.mlPrev) * 100 : 0;
        const stdRealUser = val.ml > 0 ? (val.hh / val.ml) : 0;
        const indicador = stdRealUser <= 0.22 ? '↑' : '↓';
        return { nome, pctMeta, indicador };
    }).sort((a,b)=> b.pctMeta - a.pctMeta).slice(0,5);

    const tbodyRanking = document.getElementById('rankingTable').querySelector('tbody');
    tbodyRanking.innerHTML = '';
    rankingArr.forEach(r=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r.nome}</td><td>${r.pctMeta.toFixed(0)}%</td><td class="${r.indicador==='↑'?'ind-up':'ind-down'}">${r.indicador}</td>`;
        tbodyRanking.appendChild(tr);
    });
    if (rankingArr.length === 0){
        tbodyRanking.innerHTML = '<tr><td colspan="3" style="text-align:center;color:gray;">Sem dados</td></tr>';
    }

    // Tabela de amostra (até 5 linhas)
    const tbodyDados = document.getElementById('tabelaDados');
    tbodyDados.innerHTML = '';
    dados.slice(0,5).forEach(row=>{
        tbodyDados.innerHTML += `<tr>
            <td>${row['Semanas']||''}</td>
            <td>${row['OS']||''}</td>
            <td>${row['Matricula']||''}</td>
            <td>${row['Encarregado Responsavel']||''}</td>
            <td>${row['ÁREA']||''}</td>
            <td>${row['Mont.Presente']||''}</td>
            <td>${parseNumber(row['HH Total']).toFixed(1)}</td>
            <td>${parseNumber(row['ML Montados']).toFixed(0)}</td>
            <td>${parseNumber(row['STD Montado']).toFixed(2)}</td>
            <td>${row['Data']||''}</td>
        </tr>`;
    });

    atualizarGraficoLinha(mlPorDia);

    if (linhasIgnoradas > 0){
        console.info(`Linhas ignoradas por data inválida/erro: ${linhasIgnoradas}`);
    }
}

/* =========================
   Gráfico de linha
========================= */
function atualizarGraficoLinha(mlPorDia){
    const svg = document.getElementById('graficoLinha');
    svg.querySelectorAll('polyline, .data-label, .day-label').forEach(el=>el.remove());

    const width = 100, height = 35, marginBottom = 8;
    const maxML = Math.max(...mlPorDia, 1);

    const pontos = mlPorDia.map((v,i)=>{
        const x = i * (width/6);
        const y = height - marginBottom - (v / maxML * (height - marginBottom*2));
        return [x,y];
    });

    const polyline = document.createElementNS("http://www.w3.org/2000/svg","polyline");
    polyline.setAttribute("fill","none");
    polyline.setAttribute("stroke","#0b63d6");
    polyline.setAttribute("stroke-width","1.6");
    polyline.setAttribute("points", pontos.map(p=>p.join(',')).join(' '));
    svg.appendChild(polyline);

    pontos.forEach((p,i)=>{
        const t = document.createElementNS("http://www.w3.org/2000/svg","text");
        t.classList.add('data-label');
        t.setAttribute('x', p[0]);
        t.setAttribute('y', p[1] - 2);
        t.setAttribute('font-size', '2.7');
        t.setAttribute('fill', '#0b2340');
        t.setAttribute('text-anchor', 'middle');
        t.textContent = mlPorDia[i].toFixed(0);
        svg.appendChild(t);
    });

    const dias = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
    pontos.forEach((p,i)=>{
        const t = document.createElementNS("http://www.w3.org/2000/svg","text");
        t.classList.add('day-label');
        t.setAttribute('x', p[0]);
        t.setAttribute('y', height - 1);
        t.setAttribute('font-size', '3');
        t.setAttribute('fill', '#0b2340');
        t.setAttribute('text-anchor', 'middle');
        t.textContent = dias[i];
        svg.appendChild(t);
    });
}

/* =========================
   Eventos de UI
========================= */
document.getElementById('fileInput').addEventListener('change', e=>{
    const file = e.target.files[0];
    if(!file) return;
    Papa.parse(file,{
        header:true, skipEmptyLines:true,
        complete: results=>{
            dadosCSV = results.data.filter(r => !!parseDateBR(r['Data']));
            aplicarFiltro();
        },
        error: err => alert('Erro ao ler o arquivo: ' + err)
    });
});

function aplicarFiltro(){
    const dataInicio = document.getElementById('dataInicio').value;
    const dataFim    = document.getElementById('dataFim').value;
    const dadosFiltrados = filtrarDadosPorData(dadosCSV, dataInicio, dataFim);
    try{
        atualizarDashboard(dadosFiltrados);
    }catch(e){
        console.error(e);
        alert('Erro ao atualizar o dashboard. Verifique os dados.');
    }
}

document.getElementById('btnApplyFilter').addEventListener('click', aplicarFiltro);

document.getElementById('btnExportPDF').addEventListener('click',()=>{
    const dashboardWrap=document.getElementById('dashboardWrap');
    html2canvas(dashboardWrap,{scale:2}).then(canvas=>{
        const imgData=canvas.toDataURL('image/png');
        const { jsPDF }=window.jspdf;
        const pdf=new jsPDF({orientation:'landscape',unit:'pt',format:'a4'});
        const pdfWidth=pdf.internal.pageSize.getWidth();
        const imgProps=pdf.getImageProperties(imgData);
        const imgHeight=(imgProps.height*pdfWidth)/imgProps.width;
        pdf.addImage(imgData,'PNG',0,0,pdfWidth,imgHeight);
        pdf.save('dashboard.pdf');
    });
});

const btnDash2 = document.getElementById('btnDashboard2');
if (btnDash2){
    btnDash2.addEventListener('click', () => {
        window.location.href = 'mapa.html';
    });
}
document.getElementById('btnVoltarMenu').addEventListener('click', () => {
    window.location.href = 'index.html'; // ajuste o nome do arquivo do seu menu principal
});

/* =========================
   Carregamento automático
========================= */
function carregarCSVPadrao(){
    fetch('STD_Geral.csv')
        .then(r => {
            if (!r.ok) throw new Error("CSV padrão não encontrado.");
            return r.text();
        })
        .then(csvText => {
            const parsed = Papa.parse(csvText, { header:true, skipEmptyLines:true });
            dadosCSV = parsed.data.filter(r => !!parseDateBR(r['Data']));
            aplicarFiltro();
        })
        .catch(err => {
            console.warn("Aviso:", err.message);
        });
}

window.addEventListener('load', carregarCSVPadrao);
