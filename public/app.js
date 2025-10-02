const SUPABASE_URL = "https://siatsmslhjzqttdxfshe.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpYXRzbXNsaGp6cXR0ZHhmc2hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODUyMjgsImV4cCI6MjA3NDk2MTIyOH0.OSNl7pwyVnta3QSJPA93lZtC5kHKlhNq87bC9tUKqu0";
// Add environment detection at the top
const isLocal = window.location.hostname === 'localhost';
const APP_URL = isLocal ? 'http://localhost:3000' : 'https://money-track-eta.vercel.app/';
// Global variables
let supabase;
let currentUser = null;
let balance = 0;
let maxBalance = 10000;
let transactions = [];
let currentType = "income";
let charts = {};
let useSupabaseStorage = true; // Toggle between Supabase and local API

// Initialize Supabase
async function initSupabase() {
  const { createClient } = await import(
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
  );
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Check authentication
async function checkAuth() {
  if (!supabase) await initSupabase();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "/auth.html";
    return false;
  }

  currentUser = session.user;
  return true;
}

// Initialize app
document.addEventListener("DOMContentLoaded", async function () {
  // Check if we're on auth page
  if (window.location.pathname.includes("auth.html")) return;

  // Check authentication
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  // Add user info to UI
  addUserInfo();

  // Load data
  if (useSupabaseStorage) {
    await loadUserDataFromSupabase();
  } else {
    await loadDataFromAPI();
  }

  // Setup app
  updateUI();
  setupNavigation();
  initCharts();
  updateCapacityDisplay();
});

// Add user info to navigation
function addUserInfo() {
  const navContainer = document.querySelector(".nav-container");
  if (navContainer && currentUser) {
    const userName =
      currentUser.user_metadata.full_name || currentUser.email.split("@")[0];

    // Add user info before nav menu
    const userInfo = document.createElement("div");
    userInfo.className = "user-info";
    userInfo.style.cssText =
      "display: flex; align-items: center; gap: 1rem; margin-left: auto; margin-right: 1rem;";
    userInfo.innerHTML = `
            <span style="color: var(--text-secondary); font-size: 0.875rem;">
                <i class="bi bi-person-circle"></i> ${userName}
            </span>
        `;

    navContainer.insertBefore(
      userInfo,
      navContainer.querySelector(".nav-menu")
    );
  }

  // Add sign out button
  const navMenu = document.querySelector(".nav-menu");
  if (navMenu) {
    const signOutBtn = document.createElement("button");
    signOutBtn.className = "nav-link";
    signOutBtn.innerHTML =
      '<i class="bi bi-box-arrow-right"></i><span class="nav-text">Sign Out</span>';
    signOutBtn.onclick = signOut;
    navMenu.appendChild(signOutBtn);
  }
}

// Sign out
async function signOut() {
  if (confirm("Are you sure you want to sign out?")) {
    await supabase.auth.signOut();
    window.location.href = "/auth.html";
  }
}

// Load from Supabase
async function loadUserDataFromSupabase() {
  try {
    // Load settings
    const { data: settings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", currentUser.id)
      .single();

    if (settings) {
      balance = parseFloat(settings.balance) || 0;
      maxBalance = parseFloat(settings.max_balance) || 10000;
      if (settings.theme === "light") {
        document.body.classList.add("light-theme");
      }
    }

    // Load transactions
    const { data: transactionData } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (transactionData) {
      transactions = transactionData.map((t) => ({
        id: t.id,
        type: t.type,
        amount: parseFloat(t.amount),
        description: t.description,
        date: t.created_at,
      }));
    }
  } catch (error) {
    console.error("Error loading from Supabase:", error);
    // Fallback to API
    await loadDataFromAPI();
  }
}

// Load from your Express API (fallback)
async function loadDataFromAPI() {
  try {
    const response = await fetch("/api/data");
    const data = await response.json();

    if (data.capital !== undefined) {
      balance = data.capital;
    }

    if (data.transactions) {
      transactions = data.transactions;
    }
  } catch (error) {
    console.error("Error loading from API:", error);
  }
}

// Save to Supabase
async function saveToSupabase() {
  try {
    await supabase.from("user_settings").upsert({
      user_id: currentUser.id,
      balance: balance,
      max_balance: maxBalance,
      theme: document.body.classList.contains("light-theme") ? "light" : "dark",
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error saving to Supabase:", error);
  }
}

// Modified addTransaction to work with both systems
async function addTransaction() {
  const amount = parseFloat(document.getElementById("amount").value);
  const description = document.getElementById("description").value;

  if (!amount || amount <= 0) {
    showToast("Please enter a valid amount");
    return;
  }

  try {
    if (useSupabaseStorage) {
      // Save to Supabase
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          user_id: currentUser.id,
          type: currentType,
          amount: amount,
          description: description || currentType,
        })
        .select()
        .single();

      if (error) throw error;

      transactions.unshift({
        id: data.id,
        type: currentType,
        amount: amount,
        description: description || currentType,
        date: data.created_at,
      });
    } else {
      // Save to Express API
      const response = await fetch("/api/capital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount,
          description: description || currentType,
          type: currentType === "income" ? "add" : "subtract",
        }),
      });

      const data = await response.json();
      balance = data.capital;
      transactions = data.transactions;
    }

    // Update balance
    if (currentType === "income") {
      balance += amount;
    } else {
      balance -= amount;
    }

    // Save settings
    if (useSupabaseStorage) {
      await saveToSupabase();
    }

    // Clear form
    document.getElementById("amount").value = "";
    document.getElementById("description").value = "";

    updateUI();
    showToast(
      `${currentType === "income" ? "Income" : "Expense"} added successfully`
    );
  } catch (error) {
    console.error("Error:", error);
    showToast("Error adding transaction");
  }
}

// Update UI
function updateUI() {
  // Update balance display
  document.getElementById("balanceAmount").textContent = `$${balance.toFixed(
    2
  )}`;

  // Update liquid fill animation
  updateLiquidFill();

  // Calculate totals
  let totalIncome = 0;
  let totalExpenses = 0;

  transactions.forEach((t) => {
    if (t.type === "income" || t.type === "initial") {
      totalIncome += t.amount;
    } else if (t.type === "expense") {
      totalExpenses += t.amount;
    }
  });

  document.getElementById("totalIncome").textContent = `+$${totalIncome.toFixed(
    2
  )}`;
  document.getElementById(
    "totalExpenses"
  ).textContent = `-$${totalExpenses.toFixed(2)}`;

  // Update recent transactions
  updateRecent();

  // Update analytics if visible
  if (document.getElementById("analytics").classList.contains("active")) {
    updateCharts();
  }
}

// Dynamic Liquid Fill Animation
function updateLiquidFill() {
  const liquid = document.getElementById("liquidFill");
  const percentEl = document.getElementById("balancePercent");

  // Calculate fill percentage based on user-defined capacity
  let fillPercent = (balance / maxBalance) * 100;
  fillPercent = Math.max(0, Math.min(100, fillPercent)); // Clamp between 0-100

  // Update liquid height
  liquid.style.height = `${fillPercent}%`;

  // Update percentage text
  percentEl.textContent = `${fillPercent.toFixed(1)}% capacity`;

  // Change color based on balance
  if (balance < 0) {
    liquid.style.filter = "hue-rotate(-60deg)"; // Red for negative
  } else if (fillPercent > 80) {
    liquid.style.filter = "hue-rotate(60deg)"; // Green for high balance
  } else {
    liquid.style.filter = "none"; // Default blue
  }
}

function updateRecent() {
  const recentList = document.getElementById("recentList");
  const recent = transactions.slice(-5).reverse();

  if (recent.length === 0) {
    recentList.innerHTML = '<p class="empty-message">No transactions yet</p>';
    return;
  }

  recentList.innerHTML = recent
    .map((t) => {
      const sign = t.type === "expense" ? "-" : "+";
      const className = t.type === "expense" ? "expense" : "income";

      return `
            <div class="transaction-item ${className}">
                <div class="transaction-info">
                    <span class="transaction-desc">${t.description}</span>
                    <span class="transaction-date">${new Date(
                      t.date
                    ).toLocaleDateString()}</span>
                </div>
                <span class="transaction-amount ${className}">
                    ${sign}$${t.amount.toFixed(2)}
                </span>
            </div>
        `;
    })
    .join("");
}

// History
function updateHistory() {
  const historyList = document.getElementById("historyList");

  if (transactions.length === 0) {
    historyList.innerHTML = '<p class="empty-message">No transactions yet</p>';
    return;
  }

  const sorted = [...transactions].reverse();

  historyList.innerHTML = sorted
    .map((t) => {
      const sign = t.type === "expense" ? "-" : "+";
      const className = t.type === "expense" ? "expense" : "income";

      return `
            <div class="transaction-item ${className}">
                <div class="transaction-info">
                    <span class="transaction-desc">${t.description}</span>
                    <span class="transaction-date">${new Date(
                      t.date
                    ).toLocaleDateString()} ${new Date(
        t.date
      ).toLocaleTimeString()}</span>
                </div>
                <span class="transaction-amount ${className}">
                    ${sign}$${t.amount.toFixed(2)}
                </span>
            </div>
        `;
    })
    .join("");
}

function searchHistory(term) {
  const items = document.querySelectorAll("#historyList .transaction-item");
  items.forEach((item) => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(term.toLowerCase()) ? "flex" : "none";
  });
}

// Charts
function initCharts() {
  Chart.defaults.color = getComputedStyle(document.body).getPropertyValue(
    "--text-secondary"
  );
  Chart.defaults.borderColor = getComputedStyle(document.body).getPropertyValue(
    "--border"
  );
}

function updateCharts() {
  updateWaterfallChart();
  updateComparisonChart();
  updateTrendChart();
  updateSummary();
}

// Waterfall Chart
function updateWaterfallChart() {
  const ctx = document.getElementById("waterfallChart");
  if (!ctx) return;

  // Prepare waterfall data
  const waterfallData = [];
  const waterfallLabels = ["Start"];
  const waterfallColors = ["#6366f1"];
  let runningTotal = 0;

  // Group transactions by type for waterfall
  let incomeTotal = 0;
  let expenseTotal = 0;

  transactions.forEach((t) => {
    if (t.type === "income" || t.type === "initial") {
      incomeTotal += t.amount;
    } else if (t.type === "expense") {
      expenseTotal += t.amount;
    }
  });

  // Start value
  waterfallData.push([0, 0]);

  // Income bar
  if (incomeTotal > 0) {
    waterfallLabels.push("Income");
    waterfallData.push([runningTotal, runningTotal + incomeTotal]);
    waterfallColors.push("#22c55e");
    runningTotal += incomeTotal;
  }

  // Expense bar
  if (expenseTotal > 0) {
    waterfallLabels.push("Expenses");
    waterfallData.push([runningTotal, runningTotal - expenseTotal]);
    waterfallColors.push("#ef4444");
    runningTotal -= expenseTotal;
  }

  // End balance
  waterfallLabels.push("Balance");
  waterfallData.push([0, runningTotal]);
  waterfallColors.push(runningTotal >= 0 ? "#6366f1" : "#ef4444");

  if (charts.waterfall) {
    charts.waterfall.destroy();
  }

  charts.waterfall = new Chart(ctx, {
    type: "bar",
    data: {
      labels: waterfallLabels,
      datasets: [
        {
          data: waterfallData,
          backgroundColor: waterfallColors,
          barPercentage: 0.7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label;
              const value = context.raw;
              if (Array.isArray(value)) {
                const diff = value[1] - value[0];
                return `${label}: $${Math.abs(diff).toFixed(2)}`;
              }
              return `${label}: $${value.toFixed(2)}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return "$" + value.toFixed(0);
            },
          },
        },
      },
    },
  });
}

function updateComparisonChart() {
  const ctx = document.getElementById("comparisonChart");
  if (!ctx) return;

  let income = 0;
  let expenses = 0;

  transactions.forEach((t) => {
    if (t.type === "income" || t.type === "initial") {
      income += t.amount;
    } else if (t.type === "expense") {
      expenses += t.amount;
    }
  });

  if (charts.comparison) {
    charts.comparison.destroy();
  }

  charts.comparison = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Income", "Expenses"],
      datasets: [
        {
          data: [income, expenses],
          backgroundColor: ["#22c55e", "#ef4444"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });
}

function updateTrendChart() {
  const ctx = document.getElementById("trendChart");
  if (!ctx) return;

  // Get last 7 days
  const days = [];
  const balances = [];
  let runningBalance = balance;

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push(date.toLocaleDateString("en", { weekday: "short" }));

    // Calculate balance for that day
    let dayBalance = runningBalance;
    transactions.forEach((t) => {
      const tDate = new Date(t.date);
      if (tDate > date) {
        if (t.type === "income" || t.type === "initial") {
          dayBalance -= t.amount;
        } else if (t.type === "expense") {
          dayBalance += t.amount;
        }
      }
    });
    balances.push(dayBalance);
  }

  if (charts.trend) {
    charts.trend.destroy();
  }

  charts.trend = new Chart(ctx, {
    type: "line",
    data: {
      labels: days,
      datasets: [
        {
          label: "Balance",
          data: balances,
          borderColor: "#6366f1",
          backgroundColor: "rgba(99, 102, 241, 0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: function (value) {
              return "$" + value.toFixed(0);
            },
          },
        },
      },
    },
  });
}

function updateSummary() {
  // This month total
  const now = new Date();
  const monthTransactions = transactions.filter((t) => {
    const tDate = new Date(t.date);
    return (
      tDate.getMonth() === now.getMonth() &&
      tDate.getFullYear() === now.getFullYear()
    );
  });

  let monthTotal = 0;
  monthTransactions.forEach((t) => {
    if (t.type === "income" || t.type === "initial") {
      monthTotal += t.amount;
    } else if (t.type === "expense") {
      monthTotal -= t.amount;
    }
  });

  document.getElementById("monthTotal").textContent = `$${monthTotal.toFixed(
    2
  )}`;

  // Daily average
  const daysInMonth = now.getDate();
  const dailyAvg = Math.abs(monthTotal) / daysInMonth;
  document.getElementById("dailyAvg").textContent = `$${dailyAvg.toFixed(2)}`;

  // Transaction count
  document.getElementById("transCount").textContent = transactions.length;
}

// Settings
function setTheme(theme) {
  document.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  event.target.classList.add("active");

  if (theme === "light") {
    document.body.classList.add("light-theme");
  } else {
    document.body.classList.remove("light-theme");
  }

  localStorage.setItem("theme", theme);
  showToast(`Theme changed to ${theme}`);

  // Reinit charts with new colors
  initCharts();
  if (document.getElementById("analytics").classList.contains("active")) {
    updateCharts();
  }
}

// Export as CSV
function exportAsCSV() {
  if (transactions.length === 0) {
    showToast("No data to export");
    return;
  }

  let csv = "Date,Time,Type,Description,Amount,Balance\n";

  let runningBalance = 0;
  transactions.forEach((t) => {
    const date = new Date(t.date);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString();

    if (t.type === "income" || t.type === "initial") {
      runningBalance += t.amount;
    } else {
      runningBalance -= t.amount;
    }

    const amount = t.type === "expense" ? `-${t.amount}` : t.amount;
    csv += `"${dateStr}","${timeStr}","${t.type}","${t.description}",${amount},${runningBalance}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `moneytrack-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();

  showToast("Data exported as CSV");
}

// Export as Text
function exportAsText() {
  if (transactions.length === 0) {
    showToast("No data to export");
    return;
  }

  let text = "MONEYTRACK TRANSACTION REPORT\n";
  text += "================================\n\n";
  text += `Generated: ${new Date().toLocaleString()}\n`;
  text += `Current Balance: $${balance.toFixed(2)}\n`;
  text += `Bubble Capacity: $${maxBalance.toFixed(2)}\n`;
  text += `Fill Percentage: ${((balance / maxBalance) * 100).toFixed(1)}%\n\n`;
  text += "TRANSACTIONS:\n";
  text += "-------------\n\n";

  transactions.forEach((t) => {
    const date = new Date(t.date);
    const sign = t.type === "expense" ? "-" : "+";
    text += `${date.toLocaleDateString()} ${date.toLocaleTimeString()}\n`;
    text += `  ${t.description}\n`;
    text += `  ${sign}$${t.amount.toFixed(2)}\n\n`;
  });

  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `moneytrack-${new Date().toISOString().split("T")[0]}.txt`;
  a.click();

  showToast("Data exported as text file");
}

function clearData() {
  if (
    confirm("Are you sure you want to clear all data? This cannot be undone.")
  ) {
    balance = 0;
    transactions = [];
    saveData();
    updateUI();
    showToast("All data cleared");
  }
}

// Storage
function saveData() {
  localStorage.setItem("balance", balance);
  localStorage.setItem("maxBalance", maxBalance);
  localStorage.setItem("transactions", JSON.stringify(transactions));
}

function loadData() {
  const savedBalance = localStorage.getItem("balance");
  const savedMaxBalance = localStorage.getItem("maxBalance");
  const savedTransactions = localStorage.getItem("transactions");
  const savedTheme = localStorage.getItem("theme");

  if (savedBalance) {
    balance = parseFloat(savedBalance);
  }

  if (savedMaxBalance) {
    maxBalance = parseFloat(savedMaxBalance);
  }

  if (savedTransactions) {
    transactions = JSON.parse(savedTransactions);
  }

  if (savedTheme === "light") {
    document.body.classList.add("light-theme");
    // Update theme button
    document.querySelectorAll(".theme-btn").forEach((btn) => {
      btn.classList.remove("active");
      if (btn.textContent.trim() === "Light") {
        btn.classList.add("active");
      }
    });
  }
}

// Toast
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}
// Ensure navigation works even if other parts fail
document.addEventListener("DOMContentLoaded", function () {
  // Setup navigation immediately
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const page = this.dataset.page;

      // Update active states
      document
        .querySelectorAll(".nav-link")
        .forEach((l) => l.classList.remove("active"));
      this.classList.add("active");

      // Switch pages
      document
        .querySelectorAll(".page")
        .forEach((p) => p.classList.remove("active"));
      const targetPage = document.getElementById(page);
      if (targetPage) {
        targetPage.classList.add("active");
      }
    });
  });
});
