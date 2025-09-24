const API_URL = "/api";
let allTransactions = [];
let currentCapital = 0;
let todayIncome = 0;
let todayExpense = 0;

document.addEventListener("DOMContentLoaded", function () {
  loadData();
  setupEventListeners();
});

function setupEventListeners() {
  // Navigation
  document.querySelectorAll(".nav-pill").forEach((pill) => {
    pill.addEventListener("click", function () {
      const page = this.dataset.page;
      showPage(page);

      document
        .querySelectorAll(".nav-pill")
        .forEach((p) => p.classList.remove("active"));
      this.classList.add("active");
    });
  });

  const addBtn = document.getElementById("addMoneyBtn");
  const subtractBtn = document.getElementById("subtractMoneyBtn");
  const setCapitalBtn = document.getElementById("setCapitalBtn");
  const exportTxtBtn = document.getElementById("exportTxtBtn");
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  const filterSelect = document.getElementById("filterPeriod");

  if (addBtn) addBtn.addEventListener("click", () => addMoney());
  if (subtractBtn) subtractBtn.addEventListener("click", () => subtractMoney());
  if (setCapitalBtn)
    setCapitalBtn.addEventListener("click", () => setInitialCapital());
  if (exportTxtBtn)
    exportTxtBtn.addEventListener("click", () => exportData("txt"));
  if (exportCsvBtn)
    exportCsvBtn.addEventListener("click", () => exportData("csv"));
  if (filterSelect)
    filterSelect.addEventListener("change", () => filterTransactions());
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });
  document.getElementById(pageId).classList.add("active");
}

async function loadData() {
  try {
    const response = await axios.get(`${API_URL}/data`);
    allTransactions = response.data.transactions || [];
    currentCapital = response.data.capital;
    updateUI(response.data);
    updateBubble(response.data.capital);
    updateAnalytics(response.data.transactions || []);
    calculateTodayStats(response.data.transactions || []);
  } catch (error) {
    console.error("Error loading data:", error);
    showNotification("Failed to load data", "error");
  }
}

function updateUI(data) {
  updateTransactionHistory(data.transactions || []);
}

function calculateTodayStats(transactions) {
  const today = new Date().toDateString();
  todayIncome = 0;
  todayExpense = 0;

  transactions.forEach((t) => {
    if (new Date(t.date).toDateString() === today) {
      if (t.type === "add") {
        todayIncome += t.amount;
      } else if (t.type === "subtract") {
        todayExpense += t.amount;
      }
    }
  });

  updateTodayDisplay();
}

function updateTodayDisplay() {
  document.getElementById("todayIncome").textContent =
    todayIncome > 0 ? `+$${todayIncome.toFixed(2)}` : "$0.00";
  document.getElementById("todayExpense").textContent =
    todayExpense > 0 ? `-$${todayExpense.toFixed(2)}` : "$0.00";
}

function updateBubble(capital) {
  const bubble = document.getElementById("moneyBubble");
  const bubbleAmount = document.getElementById("bubbleAmount");
  const bubbleLiquid = bubble.querySelector(".bubble-liquid");

  bubbleAmount.textContent = `$${Math.abs(capital).toFixed(2)}`;

  // Update liquid level based on capital (0-100% of bubble)
  const maxCapital = 10000; // Adjust this based on expected range
  const percentage = Math.min((Math.abs(capital) / maxCapital) * 100, 100);
  bubbleLiquid.style.height = `${Math.max(percentage, 10)}%`;

  // Change color for negative
  if (capital < 0) {
    bubble.classList.add("negative");
  } else {
    bubble.classList.remove("negative");
  }
}

function updateAnalytics(transactions) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlyTransactions = transactions.filter((t) => {
    const transDate = new Date(t.date);
    return (
      transDate.getMonth() === currentMonth &&
      transDate.getFullYear() === currentYear
    );
  });

  let monthlyIncome = 0;
  let monthlyExpenses = 0;

  monthlyTransactions.forEach((t) => {
    if (t.type === "add" || t.type === "set") {
      monthlyIncome += t.amount;
    } else {
      monthlyExpenses += t.amount;
    }
  });

  const monthlyNet = monthlyIncome - monthlyExpenses;

  document.getElementById(
    "monthlyIncome"
  ).textContent = `$${monthlyIncome.toFixed(2)}`;
  document.getElementById(
    "monthlyExpenses"
  ).textContent = `$${monthlyExpenses.toFixed(2)}`;
  document.getElementById("monthlyNet").textContent = `$${monthlyNet.toFixed(
    2
  )}`;

  const totalTransactions = transactions.length;
  const avgTransaction =
    totalTransactions > 0
      ? transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) /
        totalTransactions
      : 0;

  const incomeTransactions = transactions.filter(
    (t) => t.type === "add" || t.type === "set"
  );
  const expenseTransactions = transactions.filter((t) => t.type === "subtract");

  const biggestIncome =
    incomeTransactions.length > 0
      ? Math.max(...incomeTransactions.map((t) => t.amount))
      : 0;
  const biggestExpense =
    expenseTransactions.length > 0
      ? Math.max(...expenseTransactions.map((t) => t.amount))
      : 0;

  document.getElementById("totalTransactions").textContent = totalTransactions;
  document.getElementById(
    "avgTransaction"
  ).textContent = `$${avgTransaction.toFixed(2)}`;
  document.getElementById(
    "biggestIncome"
  ).textContent = `$${biggestIncome.toFixed(2)}`;
  document.getElementById(
    "biggestExpense"
  ).textContent = `$${biggestExpense.toFixed(2)}`;
}

function updateTransactionHistory(transactions) {
  const filter = document.getElementById("filterPeriod").value;
  const filteredTransactions = filterTransactionsByPeriod(transactions, filter);

  const historyDiv = document.getElementById("transactionHistory");
  historyDiv.innerHTML = "";

  if (filteredTransactions.length === 0) {
    historyDiv.innerHTML =
      '<p style="text-align: center; color: #64748b; padding: 40px;">No transactions found</p>';
    return;
  }

  filteredTransactions
    .slice()
    .reverse()
    .forEach((transaction) => {
      const transactionDiv = document.createElement("div");
      transactionDiv.className = `transaction-item ${transaction.type}`;

      const date = new Date(transaction.date).toLocaleString();
      const sign =
        transaction.type === "add" || transaction.type === "set" ? "+" : "-";
      const color =
        transaction.type === "add" || transaction.type === "set"
          ? "#10b981"
          : "#ef4444";

      transactionDiv.innerHTML = `
            <div>
                <strong style="color: #1e293b;">${
                  transaction.description
                }</strong><br>
                <small style="color: #64748b;">${date}</small>
            </div>
            <div style="text-align: right;">
                <span style="color: ${color}; font-weight: 700; font-size: 1.1rem;">
                    ${sign}$${Math.abs(transaction.amount).toFixed(2)}
                </span><br>
                <small style="color: #64748b;">Balance: $${transaction.balance.toFixed(
                  2
                )}</small>
            </div>
        `;

      historyDiv.appendChild(transactionDiv);
    });
}

function filterTransactionsByPeriod(transactions, period) {
  const now = new Date();

  switch (period) {
    case "today":
      return transactions.filter((t) => {
        const transDate = new Date(t.date);
        return transDate.toDateString() === now.toDateString();
      });
    case "week":
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return transactions.filter((t) => new Date(t.date) >= weekAgo);
    case "month":
      return transactions.filter((t) => {
        const transDate = new Date(t.date);
        return (
          transDate.getMonth() === now.getMonth() &&
          transDate.getFullYear() === now.getFullYear()
        );
      });
    default:
      return transactions;
  }
}

function filterTransactions() {
  updateTransactionHistory(allTransactions);
}

async function setInitialCapital() {
  const amount = parseFloat(document.getElementById("initialCapital").value);

  if (isNaN(amount)) {
    showNotification("Please enter a valid amount", "error");
    return;
  }

  try {
    const response = await axios.post(`${API_URL}/capital/set`, { amount });
    allTransactions = response.data.transactions || [];
    currentCapital = response.data.capital;
    updateUI(response.data);
    updateBubble(response.data.capital);
    updateAnalytics(response.data.transactions || []);
    calculateTodayStats(response.data.transactions || []);
    document.getElementById("initialCapital").value = "";
    showNotification("Capital set successfully!", "success");
  } catch (error) {
    console.error("Error:", error);
    showNotification("Failed to set capital", "error");
  }
}

async function addMoney() {
  await updateCapital("add");
}

async function subtractMoney() {
  await updateCapital("subtract");
}

async function updateCapital(type) {
  const amount = parseFloat(document.getElementById("amount").value);
  const description = document.getElementById("description").value.trim();

  if (isNaN(amount) || amount <= 0) {
    showNotification("Please enter a valid amount", "error");
    return;
  }

  if (!description) {
    showNotification("Please enter a description", "error");
    return;
  }

  try {
    const response = await axios.post(`${API_URL}/capital`, {
      amount,
      description,
      type,
    });

    allTransactions = response.data.transactions || [];
    currentCapital = response.data.capital;

    // Update today's stats immediately
    const today = new Date().toDateString();
    const transactionDate = new Date().toDateString();

    if (today === transactionDate) {
      if (type === "add") {
        todayIncome += amount;
      } else {
        todayExpense += amount;
      }
      updateTodayDisplay();
    }

    updateUI(response.data);
    updateBubble(response.data.capital);
    updateAnalytics(response.data.transactions || []);

    document.getElementById("amount").value = "";
    document.getElementById("description").value = "";

    showNotification(
      `Successfully ${
        type === "add" ? "added" : "subtracted"
      } $${amount.toFixed(2)}`,
      "success"
    );
  } catch (error) {
    console.error("Error:", error);
    showNotification("Failed to update capital", "error");
  }
}

function exportData(format) {
  if (allTransactions.length === 0) {
    showNotification("No transactions to export", "error");
    return;
  }

  let content = "";
  let filename = "";

  if (format === "txt") {
    content = "MONEYTRACK TRANSACTION HISTORY\n";
    content += "================================\n\n";
    content += `Current Balance: $${currentCapital.toFixed(2)}\n\n`;
    content += "TRANSACTIONS:\n";
    content += "-------------\n";

    allTransactions.forEach((t) => {
      const sign = t.type === "subtract" ? "-" : "+";
      const date = new Date(t.date).toLocaleDateString();
      content += `${date}: ${sign}$${t.amount.toFixed(2)} - ${t.description}\n`;
    });

    filename = "moneytrack-transactions.txt";
  } else {
    content = "Date,Description,Amount,Balance\n";
    allTransactions.forEach((t) => {
      const amount =
        t.type === "subtract" ? `-${t.amount.toFixed(2)}` : t.amount.toFixed(2);
      content += `"${new Date(t.date).toLocaleString()}","${
        t.description
      }",${amount},${t.balance.toFixed(2)}\n`;
    });
    filename = "moneytrack-transactions.csv";
  }

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  showNotification("Data exported successfully!", "success");
}

function showNotification(message, type = "info") {
  const container = document.getElementById("notification-container");
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  container.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
