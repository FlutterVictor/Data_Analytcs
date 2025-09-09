/* ========================
   Dashboard Integrado JS
   ======================== */

// Função auxiliar para carregar CSV
async function loadCSV(path) {
    const response = await fetch(path);
    const data = await response.text();
    const rows = data.trim().split("\n").map(r => r.split(";"));
    const headers = rows.shift();
    return rows.map(row => {
        let obj = {};
        row.forEach((val, i) => obj[headers[i].trim()] = val.trim());
        return obj;
    });
}

// Função para converter hora string em decimal
function horaParaDecimal(horaStr) {
    if (!horaStr) return 0;
    const [h, m] = horaStr.split(":").map(Number);
    return h + (m / 60);
}

// Inicialização
async function initDashboard() {
    // Carregar dados
    const consumoPintura = await loadCSV("CSV/consumo_pintura.csv");
    const stdAndaime = await loadCSV("CSV/std_andaime.csv");
    const sgeHoras = await loadCSV("CSV/sge_horas.csv");

    /* ========================
       Cálculos - Pintura
       ======================== */
    let totalM2 = 0, totalHHpintura = 0;
    consumoPintura.forEach(row => {
        totalM2 += parseFloat(row["M²"] || 0);
        totalHHpintura += parseFloat(row["Quantidade"] || 0); // Ajustar se tiver coluna específica de HH
    });
    const stdPintura = (totalHHpintura / totalM2).toFixed(2);

    /* ========================
       Cálculos - Andaime
       ======================== */
    let totalML = 0, totalHHandaime = 0;
    stdAndaime.forEach(row => {
        totalML += parseFloat(row["Metro Linear Real"] || 0);
        totalHHandaime += parseFloat(row["Qtd Montadores"] || 0) * 8; // suposição: 8h/dia
    });
    const stdAndaimeCalc = (totalHHandaime / totalML).toFixed(2);

    /* ========================
       Cálculos - SGE (Previsto vs Real)
       ======================== */
    let horasReais = 0;
    sgeHoras.forEach(row => {
        horasReais += parseFloat(row["Total Horas"] || 0);
    });
    const horasPrevistas = (totalHHandaime + totalHHpintura); // suposição de previsto
    const percentual = ((horasReais / horasPrevistas) * 100).toFixed(1);

    /* ========================
       Atualiza KPIs
       ======================== */
    document.getElementById("kpiPintura").textContent = stdPintura + " HH/m²";
    document.getElementById("kpiAndaime").textContent = stdAndaimeCalc + " HH/ml";
    document.getElementById("kpiSGE").textContent = percentual + "% realizado";

    /* ========================
       Gráficos
       ======================== */
    // Chart 1 - Pintura
    new Chart(document.getElementById("chartPintura"), {
        type: "bar",
        data: {
            labels: ["STD Pintura"],
            datasets: [{
                label: "HH/m²",
                data: [stdPintura],
                backgroundColor: "#0b63d6"
            }]
        }
    });

    // Chart 2 - Andaime
    new Chart(document.getElementById("chartAndaime"), {
        type: "bar",
        data: {
            labels: ["STD Andaime"],
            datasets: [{
                label: "HH/ml",
                data: [stdAndaimeCalc],
                backgroundColor: "#ff6600"
            }]
        }
    });

    // Chart 3 - SGE
    new Chart(document.getElementById("chartSGE"), {
        type: "doughnut",
        data: {
            labels: ["Realizado", "Restante"],
            datasets: [{
                data: [horasReais, horasPrevistas - horasReais],
                backgroundColor: ["#28a745", "#ccc"]
            }]
        }
    });
}

// Inicializa
window.addEventListener("load", initDashboard);
