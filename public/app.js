const supabase = window.supabase.createClient(
  "https://siatsmslhjzqttdxfshe.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpYXRzbXNsaGp6cXR0ZHhmc2hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODUyMjgsImV4cCI6MjA3NDk2MTIyOH0.OSNl7pwyVnta3QSJPA93lZtC5kHKlhNq87bC9tUKqu0"
);

let currentUser = null;
let balance = 0;
let transactions = [];
window.charts = {};

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
    if (t.type === "income") {
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
  const recent = transactions.slice(0, 5);

  if (recent.length === 0) {
    list.innerHTML = '<p class="text-muted">Keine Transaktionen</p>';
    return;
  }

  let html = '<table class="table table-sm"><tbody>';
  for (let i = 0; i < recent.length; i++) {
    const t = recent[i];
    const date = new Date(t.created_at).toLocaleDateString();
    const amount = parseFloat(t.amount);

    let cls = "income";
    let sign = "+";

    if (t.type === "expense") {
      cls = "expense";
      sign = "-";
    }

    html += "<tr><td>" + date + "</td><td>" + t.description + "</td>";
    html +=
      '<td class="' +
      cls +
      '">' +
      sign +
      "€" +
      amount.toFixed(2) +
      "</td></tr>";
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
    const date = new Date(t.created_at).toLocaleDateString();
    const amount = parseFloat(t.amount);

    let cls = "income";
    let sign = "+";
    let typeText = "Einnahme";

    if (t.type === "expense") {
      cls = "expense";
      sign = "-";
      typeText = "Ausgabe";
    }

    html +=
      "<tr><td>" +
      date +
      "</td><td>" +
      t.description +
      "</td><td>" +
      typeText +
      "</td>";
    html +=
      '<td class="' +
      cls +
      '">' +
      sign +
      "€" +
      amount.toFixed(2) +
      "</td></tr>";
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
}

async function resetAll() {
  if (!confirm("Wirklich alle Transaktionen löschen?")) return;

  await supabase.from("transactions").delete().eq("user_id", currentUser.id);

  await loadData();
  alert("Alle Transaktionen wurden gelöscht");
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
        setTimeout(() => loadCharts(transactions), 100);
      }
    });
  }
}

function exportCSV() {
  if (transactions.length === 0) {
    alert("Keine Daten zum Exportieren");
    return;
  }

  let csv = "Datum,Beschreibung,Typ,Betrag\n";

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    csv += new Date(t.created_at).toLocaleDateString() + ",";
    csv += t.description + ",";
    csv += t.type + ",";
    csv += t.amount + "\n";
  }

  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + csv;
  a.download = "moneytrack.csv";
  a.click();
}

function exportTXT() {
  if (transactions.length === 0) {
    alert("Keine Daten zum Exportieren");
    return;
  }

  let text = "MoneyTrack Export\n\n";
  text += "Kontostand: €" + balance.toFixed(2) + "\n\n";

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    text += new Date(t.created_at).toLocaleDateString() + " - ";
    text += t.description + " - ";

    let sign = "+";
    if (t.type === "expense") {
      sign = "-";
    }

    text += sign + "€" + t.amount + "\n";
  }

  const a = document.createElement("a");
  a.href = "data:text/plain;charset=utf-8," + text;
  a.download = "moneytrack.txt";
  a.click();
}

function setupEventListeners() {
  document.querySelector("#addBtn").addEventListener("click", addTransaction);
  document.querySelector("#resetBtn").addEventListener("click", resetAll);
  document.querySelector("#exportCsvBtn").addEventListener("click", exportCSV);
  document.querySelector("#exportTxtBtn").addEventListener("click", exportTXT);
  document
    .querySelector("#logoutBtn")
    .addEventListener("click", async function () {
      await supabase.auth.signOut();
      window.location.href = "auth.html";
    });
}
