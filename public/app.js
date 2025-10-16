const supabase = window.supabase.createClient(
  "https://siatsmslhjzqttdxfshe.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpYXRzbXNsaGp6cXR0ZHhmc2hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODUyMjgsImV4cCI6MjA3NDk2MTIyOH0.OSNl7pwyVnta3QSJPA93lZtC5kHKlhNq87bC9tUKqu0"
);

let currentUser = null;
let balance = 0;
let transactions = [];
let charts = {};

window.addEventListener("DOMContentLoaded", async function () {
  const session = await supabase.auth.getSession();

  if (!session.data.session) {
    window.location.href = "auth.html";
    return;
  }

  currentUser = session.data.session.user;
  document.querySelector("#userEmail").textContent =
    currentUser.email.split("@")[0];

  await loadData();
  setupEventListeners();
  setupTabs();
});

async function loadData() {
  let settingsResult = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", currentUser.id)
    .single();

  if (settingsResult.error) {
    await supabase.from("user_settings").insert({
      user_id: currentUser.id,
      balance: 0,
    });
    balance = 0;
  } else {
    balance = parseFloat(settingsResult.data.balance) || 0;
  }

  const transResult = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  transactions = transResult.data || [];

  calculateBalance();
  updateUI();
}

function calculateBalance() {
  balance = 0;
  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    if (t.type === "income" || t.type === "initial") {
      balance += parseFloat(t.amount);
    } else if (t.type === "expense") {
      balance -= parseFloat(t.amount);
    }
  }
}

function updateUI() {
  document.querySelector("#balance").textContent = balance.toFixed(2);
  updateRecentList();
  updateHistoryList();
}

function updateRecentList() {
  const list = document.querySelector("#recentList");
  if (!list) return;

  const recent = transactions.slice(0, 5);

  if (recent.length === 0) {
    list.innerHTML = '<p class="text-muted">Keine Transaktionen</p>';
    return;
  }

  let html = '<table class="table table-sm"><tbody>';

  for (let i = 0; i < recent.length; i++) {
    const t = recent[i];
    const date = new Date(t.created_at).toLocaleDateString("de-DE");
    const amount = parseFloat(t.amount);

    let cls = "income";
    let sign = "+";

    if (t.type === "expense") {
      cls = "expense";
      sign = "-";
    } else if (t.type === "initial") {
      cls = "initial";
      sign = "";
    }

    html += "<tr>";
    html += "<td>" + date + "</td>";
    html += "<td>" + t.description + "</td>";
    html +=
      '<td class="' + cls + '">' + sign + "€" + amount.toFixed(2) + "</td>";
    html += "</tr>";
  }

  html += "</tbody></table>";
  list.innerHTML = html;
}

function updateHistoryList() {
  const list = document.querySelector("#historyList");
  if (!list) return;

  if (transactions.length === 0) {
    list.innerHTML = '<p class="text-muted">Keine Transaktionen</p>';
    return;
  }

  let html =
    '<table class="table"><thead><tr><th>Datum</th><th>Beschreibung</th><th>Typ</th><th>Betrag</th></tr></thead><tbody>';

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    const date = new Date(t.created_at).toLocaleDateString("de-DE");
    const amount = parseFloat(t.amount);

    let cls = "income";
    let sign = "+";
    let typeText = "Einnahme";

    if (t.type === "expense") {
      cls = "expense";
      sign = "-";
      typeText = "Ausgabe";
    } else if (t.type === "initial") {
      cls = "initial";
      sign = "";
      typeText = "Startkapital";
    }

    html += "<tr>";
    html += "<td>" + date + "</td>";
    html += "<td>" + t.description + "</td>";
    html += "<td>" + typeText + "</td>";
    html +=
      '<td class="' + cls + '">' + sign + "€" + amount.toFixed(2) + "</td>";
    html += "</tr>";
  }

  html += "</tbody></table>";
  list.innerHTML = html;
}

async function addTransaction() {
  const type = document.querySelector("#type").value;
  const amount = parseFloat(document.querySelector("#amount").value);
  const description = document.querySelector("#description").value || type;

  if (!amount || amount <= 0) {
    alert("Bitte gültigen Betrag eingeben");
    return;
  }

  await supabase.from("transactions").insert({
    user_id: currentUser.id,
    type: type,
    amount: amount,
    description: description,
  });

  document.querySelector("#amount").value = "";
  document.querySelector("#description").value = "";

  await loadData();
  await supabase
    .from("user_settings")
    .upsert({ user_id: currentUser.id, balance: balance });
  alert("Transaktion erfolgreich hinzugefügt");
}

async function setCapital() {
  const amount = parseFloat(document.querySelector("#capital").value);

  if (!amount || amount <= 0) {
    alert("Bitte gültigen Betrag eingeben");
    return;
  }

  await supabase.from("transactions").insert({
    user_id: currentUser.id,
    type: "initial",
    amount: amount,
    description: "Startkapital",
  });

  document.querySelector("#capital").value = "";

  await loadData();
  await supabase
    .from("user_settings")
    .upsert({ user_id: currentUser.id, balance: balance });
  alert("Startkapital erfolgreich gesetzt");
}

function setupTabs() {
  const tabs = document.querySelectorAll(".nav-link[data-tab]");

  for (let i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener("click", function (e) {
      e.preventDefault();

      document.querySelector(".nav-link.active").classList.remove("active");
      this.classList.add("active");

      const contents = document.querySelectorAll(".tab-content");
      for (let j = 0; j < contents.length; j++) {
        contents[j].classList.add("d-none");
      }

      document.querySelector("#" + this.dataset.tab).classList.remove("d-none");

      if (this.dataset.tab === "charts") {
        setTimeout(loadCharts, 100);
      }
    });
  }
}

function loadCharts() {
  let income = 0;
  let expenses = 0;
  let monthlyIncome = 0;
  let monthlyExpense = 0;

  for (let i = 0; i < transactions.length; i++) {
    const amount = parseFloat(transactions[i].amount);
    if (
      transactions[i].type === "income" ||
      transactions[i].type === "initial"
    ) {
      income += amount;
      if (transactions[i].type === "income") {
        monthlyIncome += amount;
      }
    } else {
      expenses += amount;
      monthlyExpense += amount;
    }
  }

  const months = Math.max(1, getMonthsDifference());

  document.querySelector("#totalIncome").textContent = "€" + income.toFixed(2);
  document.querySelector("#totalExpenses").textContent =
    "€" + expenses.toFixed(2);
  document.querySelector("#monthlyAvg").textContent =
    "€" + Math.abs((income - expenses) / months).toFixed(2);
  document.querySelector("#yearlyTotal").textContent =
    "€" + (income - expenses).toFixed(2);
  document.querySelector("#avgMonthlyIncome").textContent =
    "€" + (monthlyIncome / months).toFixed(2);
  document.querySelector("#avgMonthlyExpense").textContent =
    "€" + (monthlyExpense / months).toFixed(2);

  const pieCanvas = document.querySelector("#pieChart");
  if (charts.pie) charts.pie.destroy();

  charts.pie = new Chart(pieCanvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: ["Einnahmen", "Ausgaben"],
      datasets: [
        {
          data: [income, expenses],
          backgroundColor: ["#10b981", "#ef4444"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 20,
            usePointStyle: true,
            font: { size: 14 },
          },
        },
      },
    },
  });

  const waterfallCanvas = document.querySelector("#waterfallChart");
  if (charts.waterfall) charts.waterfall.destroy();

  charts.waterfall = new Chart(waterfallCanvas.getContext("2d"), {
    type: "line",
    data: {
      labels: ["Start", "Einnahmen", "Ausgaben", "Ende"],
      datasets: [
        {
          label: "Geldfluss",
          data: [0, income, income - expenses, income - expenses],
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderWidth: 3,
          stepped: "middle",
          fill: true,
          tension: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(0, 0, 0, 0.05)",
          },
        },
      },
    },
  });

  const avgCanvas = document.querySelector("#avgChart");
  if (charts.avg) charts.avg.destroy();

  charts.avg = new Chart(avgCanvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: ["Einnahmen/Monat", "Ausgaben/Monat"],
      datasets: [
        {
          data: [monthlyIncome / months, monthlyExpense / months],
          backgroundColor: ["#10b981", "#ef4444"],
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(0, 0, 0, 0.05)",
          },
        },
      },
    },
  });
}

function getMonthsDifference() {
  if (transactions.length === 0) return 0;

  const dates = [];
  for (let i = 0; i < transactions.length; i++) {
    dates.push(new Date(transactions[i].created_at).getTime());
  }

  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));

  return (
    (maxDate.getFullYear() - minDate.getFullYear()) * 12 +
    (maxDate.getMonth() - minDate.getMonth())
  );
}

function exportCSV() {
  if (transactions.length === 0) {
    alert("Keine Daten zum Exportieren");
    return;
  }

  let csv = "Datum,Beschreibung,Typ,Betrag,Kontostand\n";
  let runningBalance = 0;
  const reversed = [...transactions].reverse();

  for (let i = 0; i < reversed.length; i++) {
    const t = reversed[i];
    const amount = parseFloat(t.amount);

    if (t.type === "expense") {
      runningBalance -= amount;
    } else {
      runningBalance += amount;
    }

    csv +=
      new Date(t.created_at).toLocaleDateString("de-DE") +
      ',"' +
      t.description +
      '",' +
      t.type +
      "," +
      amount +
      "," +
      runningBalance.toFixed(2) +
      "\n";
  }

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "moneytrack.csv";
  a.click();
}

function exportTXT() {
  if (transactions.length === 0) {
    alert("Keine Daten zum Exportieren");
    return;
  }

  let text = "MONEYTRACK BERICHT\n==================\n\n";
  text += "Erstellt: " + new Date().toLocaleString("de-DE") + "\n";
  text += "Kontostand: €" + balance.toFixed(2) + "\n\n";
  text += "TRANSAKTIONEN:\n--------------\n\n";

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    let sign = "+";

    if (t.type === "expense") {
      sign = "-";
    }

    text += new Date(t.created_at).toLocaleDateString("de-DE") + "\n";
    text += "  " + t.description + "\n";
    text += "  " + sign + "€" + parseFloat(t.amount).toFixed(2) + "\n\n";
  }

  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "moneytrack.txt";
  a.click();
}

function setupEventListeners() {
  document.querySelector("#addBtn").addEventListener("click", addTransaction);
  document.querySelector("#capitalBtn").addEventListener("click", setCapital);
  document.querySelector("#exportCsvBtn").addEventListener("click", exportCSV);
  document.querySelector("#exportTxtBtn").addEventListener("click", exportTXT);
  document
    .querySelector("#logoutBtn")
    .addEventListener("click", async function () {
      await supabase.auth.signOut();
      window.location.href = "auth.html";
    });
}
