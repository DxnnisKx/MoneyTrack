// Enhanced MoneyTrack App with Supabase Integration

// Supabase configuration - ONLY DECLARE ONCE
const SUPABASE_URL = "https://siatsmslhjzqttdxfshe.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpYXRzbXNsaGp6cXR0ZHhmc2hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODUyMjgsImV4cCI6MjA3NDk2MTIyOH0.OSNl7pwyVnta3QSJPA93lZtC5kHKlhNq87bC9tUKqu0";

// Global variables
let supabase;
let currentUser = null;
let balance = 0;
let maxBalance = 10000;
let transactions = [];
let currentType = "income";
let charts = {};

// Initialize Supabase client
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

  // Load data from Supabase
  await loadUserData();

  // Setup app
  updateUI();
  setupNavigation();
  initCharts();
  updateCapacityDisplay();
});

// Navigation setup
function setupNavigation() {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", function () {
      const page = this.dataset.page;
      if (page) switchPage(page);
    });
  });
}

// Switch pages
function switchPage(pageName) {
  console.log("Switching to page:", pageName);

  // Update nav
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("active");
    if (link.dataset.page === pageName) {
      link.classList.add("active");
    }
  });

  // Update pages
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  const targetPage = document.getElementById(pageName);
  if (targetPage) {
    targetPage.classList.add("active");

    // Update page-specific content
    if (pageName === "analytics") {
      console.log("Loading analytics...");
      setTimeout(() => {
        updateCharts();
      }, 100);
    } else if (pageName === "history") {
      console.log("Loading history...");
      updateHistory();
    } else if (pageName === "settings") {
      console.log("Loading settings...");
      updateCapacityDisplay();
    }
  } else {
    console.error("Page not found:", pageName);
  }
}

// Add user info to navigation
function addUserInfo() {
  const navContainer = document.querySelector(".nav-container");
  if (navContainer && currentUser) {
    const userName =
      currentUser.user_metadata.full_name || currentUser.email.split("@")[0];

    if (!document.querySelector(".user-info")) {
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
  }

  const navMenu = document.querySelector(".nav-menu");
  if (navMenu && !document.querySelector(".sign-out-btn")) {
    const signOutBtn = document.createElement("button");
    signOutBtn.className = "nav-link sign-out-btn";
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

// Load user data from Supabase
async function loadUserData() {
  try {
    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", currentUser.id)
      .single();

    if (settingsError && settingsError.code !== "PGRST116") {
      console.error("Settings error:", settingsError);
    }

    if (settings) {
      balance = parseFloat(settings.balance) || 0;
      maxBalance = parseFloat(settings.max_balance) || 10000;
      if (settings.theme === "light") {
        document.body.classList.add("light-theme");
      }
    } else {
      await saveSettings();
    }

    const { data: transactionData, error: transError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (transError) {
      console.error("Transactions error:", transError);
    }

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
    console.error("Error loading data:", error);
    showToast("Error loading data");
  }
}

// Save settings to Supabase
async function saveSettings() {
  try {
    const { data: existing } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", currentUser.id)
      .single();
    
    if (existing) {
      // Update existing settings
      const { error } = await supabase
        .from("user_settings")
        .update({
          balance: balance,
          max_balance: maxBalance,
          theme: document.body.classList.contains("light-theme") ? "light" : "dark",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", currentUser.id);
      
      if (error) throw error;
    } else {
      // Insert new settings
      const { error } = await supabase
        .from("user_settings")
        .insert({
          user_id: currentUser.id,
          balance: balance,
          max_balance: maxBalance,
          theme: document.body.classList.contains("light-theme") ? "light" : "dark",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      
      if (error) throw error;
    }
  } catch (error) {
    // Only log error if it's not a duplicate key error
    if (error.code !== "23505") {
      console.error("Error saving settings:", error);
    }
  }
}

// Transaction Type - MAKE GLOBAL
window.setType = function (type) {
  currentType = type;

  document.querySelectorAll(".type-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  event.target.classList.add("active");

  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn) {
    submitBtn.textContent =
      type === "income" ? "+ Add Income" : "- Add Expense";
    submitBtn.style.background =
      type === "income" ? "var(--success)" : "var(--danger)";
  }
};

// Add Transaction - MAKE GLOBAL
window.addTransaction = async function () {
  const amount = parseFloat(document.getElementById("amount").value);
  const description = document.getElementById("description").value;
  
  if (!amount || amount <= 0) {
    showToast("Please enter a valid amount", "error");
    return;
  }
  
  // Show immediate feedback
  showToast("Adding transaction...", "info");
  
  // Optimistically update UI first
  const tempTransaction = {
    id: 'temp-' + Date.now(),
    type: currentType,
    amount: amount,
    description: description || currentType,
    date: new Date().toISOString(),
  };
  
  transactions.unshift(tempTransaction);
  
  if (currentType === "income") {
    balance += amount;
  } else {
    balance -= amount;
  }
  
  // Clear form immediately
  document.getElementById("amount").value = "";
  document.getElementById("description").value = "";
  
  // Update UI immediately
  updateUI();
  
  try {
    // Then save to database
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
    
    // Replace temp transaction with real one
    const index = transactions.findIndex(t => t.id === tempTransaction.id);
    if (index !== -1) {
      transactions[index] = {
        id: data.id,
        type: currentType,
        amount: amount,
        description: description || currentType,
        date: data.created_at,
      };
    }
    
    await saveSettings();
    showToast(`✓ ${currentType === "income" ? "Income" : "Expense"} of $${amount.toFixed(2)} added`, "success");
  } catch (error) {
    // Rollback on error
    console.error("Error:", error);
    
    // Remove temp transaction
    transactions = transactions.filter(t => t.id !== tempTransaction.id);
    
    // Rollback balance
    if (currentType === "income") {
      balance -= amount;
    } else {
      balance += amount;
    }
    
    updateUI();
    showToast("Error adding transaction", "error");
  }
};

// Set Initial Capital - MAKE GLOBAL
window.setInitialCapital = async function () {
  const amount = parseFloat(document.getElementById("initialCapital").value);

  if (!amount || amount <= 0) {
    showToast("Please enter a valid amount", "error");
    return;
  }

  try {
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: currentUser.id,
        type: "initial",
        amount: amount,
        description: "Initial Capital",
      })
      .select()
      .single();

    if (error) throw error;

    transactions.unshift({
      id: data.id,
      type: "initial",
      amount: amount,
      description: "Initial Capital",
      date: data.created_at,
    });

    balance = amount;

    await saveSettings();

    document.getElementById("initialCapital").value = "";

    updateUI();
    showToast(`✓ Initial capital set to $${amount.toFixed(2)}`, "success");
  } catch (error) {
    console.error("Error:", error);
    showToast("Error setting initial capital", "error");
  }
};

// Quick Add - MAKE GLOBAL
window.quickAdd = async function (amount, description) {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: currentUser.id,
        type: "expense",
        amount: amount,
        description: description,
      })
      .select()
      .single();

    if (error) throw error;

    transactions.unshift({
      id: data.id,
      type: "expense",
      amount: amount,
      description: description,
      date: data.created_at,
    });

    balance -= amount;

    await saveSettings();
    updateUI();
    showToast(`✓ Quick expense: ${description} -$${amount}`, "success");
  } catch (error) {
    console.error("Error:", error);
    showToast("Error adding quick expense", "error");
  }
};

// Set Bubble Capacity - MAKE GLOBAL
window.setBubbleCapacity = async function () {
  console.log("setBubbleCapacity called");

  const capacityInput = document.getElementById("bubbleCapacity");
  if (!capacityInput) {
    console.error("Capacity input not found");
    return;
  }

  const capacity = parseFloat(capacityInput.value);

  if (!capacity || capacity <= 0) {
    showToast("Please enter a valid capacity amount", "error");
    return;
  }

  maxBalance = capacity;
  capacityInput.value = "";

  updateCapacityDisplay();

  if (currentUser) {
    await saveSettings();
  }

  updateUI();
  showToast(`✓ Bubble capacity set to $${capacity.toFixed(2)}`, "success");
};

// Update UI
function updateUI() {
  document.getElementById("balanceAmount").textContent = `$${balance.toFixed(
    2
  )}`;
  updateLiquidFill();

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

  updateRecent();

  if (document.getElementById("analytics").classList.contains("active")) {
    updateCharts();
  }
}

// Dynamic Liquid Fill Animation
function updateLiquidFill() {
  const liquid = document.getElementById("liquidFill");
  const percentEl = document.getElementById("balancePercent");

  if (!liquid || !percentEl) return;

  let fillPercent = (balance / maxBalance) * 100;
  fillPercent = Math.max(0, Math.min(100, fillPercent));

  liquid.style.height = `${fillPercent}%`;
  percentEl.textContent = `${fillPercent.toFixed(1)}% capacity`;

  if (balance < 0) {
    liquid.style.filter = "hue-rotate(-60deg)";
  } else if (fillPercent > 80) {
    liquid.style.filter = "hue-rotate(60deg)";
  } else {
    liquid.style.filter = "none";
  }
}

// Update Recent Transactions
function updateRecent() {
  const recentList = document.getElementById("recentList");
  if (!recentList) return;

  const recent = transactions.slice(0, 5);

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

// Update History
function updateHistory() {
  console.log("Updating history with", transactions.length, "transactions");

  const historyList = document.getElementById("historyList");
  if (!historyList) {
    console.error("History list element not found");
    return;
  }

  if (transactions.length === 0) {
    historyList.innerHTML = '<p class="empty-message">No transactions yet</p>';
    return;
  }

  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  historyList.innerHTML = sortedTransactions
    .map((t) => {
      const sign = t.type === "expense" ? "-" : "+";
      const className = t.type === "expense" ? "expense" : "income";
      const date = new Date(t.date);

      return `
      <div class="transaction-item ${className}">
        <div class="transaction-info">
          <span class="transaction-desc">${t.description}</span>
          <span class="transaction-date">
            ${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}
          </span>
        </div>
        <span class="transaction-amount ${className}">
          ${sign}$${t.amount.toFixed(2)}
        </span>
      </div>
    `;
    })
    .join("");
}

// Search History - MAKE GLOBAL
window.searchHistory = function (term) {
  const items = document.querySelectorAll("#historyList .transaction-item");
  items.forEach((item) => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(term.toLowerCase()) ? "flex" : "none";
  });
};

// Initialize Charts
function initCharts() {
  if (typeof Chart !== "undefined") {
    Chart.defaults.color = "#94a3b8";
    Chart.defaults.borderColor = "rgba(255, 255, 255, 0.1)";
    Chart.defaults.font.family = "Inter, sans-serif";
  } else {
    console.error("Chart.js not loaded");
  }
}

// Update Charts
function updateCharts() {
  try {
    updateWaterfallChart();
    updateComparisonChart();
    updateTrendChart();
    updateSummary();
  } catch (error) {
    console.error("Error updating charts:", error);
  }
}

// Waterfall Chart
function updateWaterfallChart() {
  const ctx = document.getElementById("waterfallChart");
  if (!ctx) {
    console.error("Waterfall chart canvas not found");
    return;
  }

  if (charts.waterfall) {
    charts.waterfall.destroy();
  }

  let incomeTotal = 0;
  let expenseTotal = 0;

  transactions.forEach((t) => {
    if (t.type === "income" || t.type === "initial") {
      incomeTotal += t.amount;
    } else if (t.type === "expense") {
      expenseTotal += t.amount;
    }
  });

  try {
    charts.waterfall = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Start", "Income", "Expenses", "End"],
        datasets: [
          {
            label: "Cash Flow",
            data: [0, incomeTotal, -expenseTotal, incomeTotal - expenseTotal],
            backgroundColor: [
              "#6366f1",
              "#22c55e",
              "#ef4444",
              incomeTotal - expenseTotal >= 0 ? "#6366f1" : "#ef4444",
            ],
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
            beginAtZero: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("Error creating waterfall chart:", error);
  }
}

// Comparison Chart
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

// Trend Chart
function updateTrendChart() {
  const ctx = document.getElementById("trendChart");
  if (!ctx) return;

  const days = [];
  const balances = [];
  let runningBalance = balance;

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push(date.toLocaleDateString("en", { weekday: "short" }));

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

// Update Summary
function updateSummary() {
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

  const monthTotalEl = document.getElementById("monthTotal");
  if (monthTotalEl) monthTotalEl.textContent = `$${monthTotal.toFixed(2)}`;

  const daysInMonth = now.getDate();
  const dailyAvg = Math.abs(monthTotal) / daysInMonth;
  const dailyAvgEl = document.getElementById("dailyAvg");
  if (dailyAvgEl) dailyAvgEl.textContent = `$${dailyAvg.toFixed(2)}`;

  const transCountEl = document.getElementById("transCount");
  if (transCountEl) transCountEl.textContent = transactions.length;
}

// Settings Functions - MAKE GLOBAL
window.setTheme = function (theme) {
  document.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  event.target.classList.add("active");

  if (theme === "light") {
    document.body.classList.add("light-theme");
  } else {
    document.body.classList.remove("light-theme");
  }

  saveSettings();
  showToast(`✓ Theme changed to ${theme}`, "success");

  initCharts();
  if (document.getElementById("analytics").classList.contains("active")) {
    updateCharts();
  }
};

// Export Functions - MAKE GLOBAL
window.exportAsCSV = function () {
  if (transactions.length === 0) {
    showToast("No data to export", "error");
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

  showToast("✓ Data exported as CSV", "success");
};

window.exportAsText = function () {
  if (transactions.length === 0) {
    showToast("No data to export", "error");
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

  showToast("✓ Data exported as text file", "success");
};

window.clearData = async function () {
  if (
    confirm("Are you sure you want to clear all data? This cannot be undone.")
  ) {
    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("user_id", currentUser.id);

      if (error) throw error;

      balance = 0;
      transactions = [];

      await saveSettings();
      updateUI();
      showToast("✓ All data cleared", "success");
    } catch (error) {
      console.error("Error:", error);
      showToast("Error clearing data", "error");
    }
  }
};

// Update capacity display
function updateCapacityDisplay() {
  const capacityEl = document.getElementById("currentCapacity");
  if (capacityEl) {
    capacityEl.textContent = `$${maxBalance.toLocaleString()}`;
  }

  const capacityInput = document.getElementById("bubbleCapacity");
  if (capacityInput) {
    capacityInput.placeholder = maxBalance.toString();
  }
}

// Toast notification
// Toast notification - FASTER VERSION
function showToast(message, type = "info") {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  
  // Clear any existing timeout
  if (window.toastTimeout) {
    clearTimeout(window.toastTimeout);
  }
  
  toast.textContent = message;
  toast.className = "toast"; // Reset classes
  
  if (type === "success") {
    toast.style.borderLeft = "4px solid var(--success)";
  } else if (type === "error") {
    toast.style.borderLeft = "4px solid var(--danger)";
  } else {
    toast.style.borderLeft = "4px solid var(--primary)";
  }
  
  // Force reflow to ensure animation works
  void toast.offsetWidth;
  
  // Show immediately
  toast.classList.add("show");
  
  // Hide after 2 seconds (faster than 3)
  window.toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}
