// Dados fictícios (mockup)
const dadosMockup = {
    efetivo: { presente: 45, falta: 5 },
    hhPorOS: [
        { os: 'OS001', hh: 120 },
        { os: 'OS002', hh: 95 },
        { os: 'OS003', hh: 150 }
    ],
    litrosMes: [
        { mes: 'Jan', litros: 300 },
        { mes: 'Fev', litros: 280 },
        { mes: 'Mar', litros: 350 }
    ],
    litrosPorOS: [
        { os: 'OS001', litros: 120 },
        { os: 'OS002', litros: 100 },
        { os: 'OS003', litros: 150 }
    ],
    tintas: [
        { cor: 'Vermelho', qtd: 10 },
        { cor: 'Azul', qtd: 15 },
        { cor: 'Verde', qtd: 8 },
        { cor: 'Amarelo', qtd: 5 }
    ],
    m2Mes: [
        { mes: 'Jan', m2: 500 },
        { mes: 'Fev', m2: 480 },
        { mes: 'Mar', m2: 520 }
    ],
    m2PorOS: [
        { os: 'OS001', m2: 200 },
        { os: 'OS002', m2: 180 },
        { os: 'OS003', m2: 220 }
    ]
};

let charts = {};

// Função para criar gráficos Chart.js
function criarGrafico(id, tipo, labels, dados, cores){
    if(charts[id]) charts[id].destroy(); // destrói gráfico antigo
    const ctx = document.getElementById(id).getContext('2d');
    charts[id] = new Chart(ctx, {
        type: tipo,
        data: {
            labels: labels,
            datasets: [{
                label: '',
                data: dados,
                backgroundColor: coloresAleatorias(dados.length, cores),
                borderColor: 'rgba(0,0,0,0.1)',
                borderWidth:1
            }]
        },
        options: {
            responsive:true,
            maintainAspectRatio:false,
            plugins:{
                legend:{ display:true }
            }
        }
    });
}

// Gera cores repetindo ou usando cores padrão
function coloresAleatorias(qtd, cores){
    const result = [];
    for(let i=0;i<qtd;i++){
        result.push(cores[i % cores.length]);
    }
    return result;
}

// Atualiza todos os gráficos com mockup
function atualizarDashboardMockup(){
    // Efetivo Presente/Falta
    criarGrafico('efetivoChart','doughnut',['Presente','Falta'],
        [dadosMockup.efetivo.presente, dadosMockup.efetivo.falta],
        ['#0b63d6','#f87171']);

    // HH Trabalhado por OS
    criarGrafico('hhChart','bar',
        dadosMockup.hhPorOS.map(d=>d.os),
        dadosMockup.hhPorOS.map(d=>d.hh),
        ['#0b63d6']);

    // Litros Utilizados no Mês
    criarGrafico('litrosMesChart','bar',
        dadosMockup.litrosMes.map(d=>d.mes),
        dadosMockup.litrosMes.map(d=>d.litros),
        ['#0b63d6']);

    // Total de Litros por OS
    criarGrafico('litrosOSChart','bar',
        dadosMockup.litrosPorOS.map(d=>d.os),
        dadosMockup.litrosPorOS.map(d=>d.litros),
        ['#f59e0b']);

    // Cores e Tipos de Tintas
    criarGrafico('tintasChart','doughnut',
        dadosMockup.tintas.map(d=>d.cor),
        dadosMockup.tintas.map(d=>d.qtd),
        ['#0b63d6','#f87171','#fbbf24','#10b981','#8b5cf6']);

    // M² Pintados por Mês
    criarGrafico('m2MesChart','bar',
        dadosMockup.m2Mes.map(d=>d.mes),
        dadosMockup.m2Mes.map(d=>d.m2),
        ['#6366f1']);

    // M² Pintados por OS
    criarGrafico('m2OSChart','bar',
        dadosMockup.m2PorOS.map(d=>d.os),
        dadosMockup.m2PorOS.map(d=>d.m2),
        ['#f97316']);
}

// Exportar PDF simples
document.getElementById('exportarPDF').addEventListener('click',()=>{
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    pdf.text("Dashboard Pintura - Mockup", 10, 10);
    pdf.save("dashboard_pintura_mockup.pdf");
});

// Botão Filtrar (aqui não faz nada, só visual)
document.getElementById('filtrar').addEventListener('click', atualizarDashboardMockup);

// Inicializa com mockup
window.addEventListener('load', atualizarDashboardMockup);
