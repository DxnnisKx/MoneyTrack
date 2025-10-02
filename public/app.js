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
  document.getElementById(pageName).classList.add("active");

  // Update page-specific content
  if (pageName === "analytics") {
    updateCharts();
  } else if (pageName === "history") {
    updateHistory();
  } else if (pageName === "settings") {
    updateCapacityDisplay();
  }
}

// Add user info to navigation
function addUserInfo() {
  const navContainer = document.querySelector(".nav-container");
  if (navContainer && currentUser) {
    const userName =
      currentUser.user_metadata.full_name || currentUser.email.split("@")[0];

    // Check if user info already exists
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

  // Add sign out button if not exists
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
    // Load settings
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
      // Create initial settings for new user
      await saveSettings();
    }

    // Load transactions
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
    const { error } = await supabase.from("user_settings").upsert({
      user_id: currentUser.id,
      balance: balance,
      max_balance: maxBalance,
      theme: document.body.classList.contains("light-theme") ? "light" : "dark",
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;
  } catch (error) {
    console.error("Error saving settings:", error);
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
  submitBtn.textContent = type === "income" ? "+ Add Income" : "- Add Expense";
  submitBtn.style.background =
    type === "income" ? "var(--success)" : "var(--danger)";
};

// Add Transaction - MAKE GLOBAL
window.addTransaction = async function () {
  const amount = parseFloat(document.getElementById("amount").value);
  const description = document.getElementById("description").value;

  if (!amount || amount <= 0) {
    showToast("Please enter a valid amount");
    return;
  }

  try {
    // Add to Supabase
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

    // Update local data
    const transaction = {
      id: data.id,
      type: currentType,
      amount: amount,
      description: description || currentType,
      date: data.created_at,
    };

    transactions.unshift(transaction);

    if (currentType === "income") {
      balance += amount;
    } else {
      balance -= amount;
    }

    // Save updated balance
    await saveSettings();

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
};

// Set Initial Capital - MAKE GLOBAL
window.setInitialCapital = async function () {
  const amount = parseFloat(document.getElementById("initialCapital").value);

  if (!amount || amount <= 0) {
    showToast("Please enter a valid amount");
    return;
  }

  try {
    // Add transaction to Supabase
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

    // Update local data
    transactions.unshift({
      id: data.id,
      type: "initial",
      amount: amount,
      description: "Initial Capital",
      date: data.created_at,
    });

    balance = amount;

    // Save settings
    await saveSettings();

    // Clear input
    document.getElementById("initialCapital").value = "";

    updateUI();
    showToast(`Initial capital set to $${amount.toFixed(2)}`);
  } catch (error) {
    console.error("Error:", error);
    showToast("Error setting initial capital");
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
    showToast(`Quick expense: ${description} -$${amount}`);
  } catch (error) {
    console.error("Error:", error);
    showToast("Error adding quick expense");
  }
};

// Set Bubble Capacity - MAKE GLOBAL
window.setBubbleCapacity = async function () {
  const capacity = parseFloat(document.getElementById("bubbleCapacity").value);

  if (!capacity || capacity <= 0) {
    showToast("Please enter a valid capacity amount");
    return;
  }

  maxBalance = capacity;

  // Clear input
  document.getElementById("bubbleCapacity").value = "";

  // Update display
  updateCapacityDisplay();

  // Save to Supabase
  await saveSettings();

  // Update UI to reflect new capacity
  updateUI();

  showToast(`Bubble capacity set to $${capacity.toFixed(2)}`);
};

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

  // History
  function updateHistory() {
    const historyList = document.getElementById("historyList");

    if (transactions.length === 0) {
      historyList.innerHTML =
        '<p class="empty-message">No transactions yet</p>';
      return;
    }

    historyList.innerHTML = transactions
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

  // Search History - MAKE GLOBAL
  window.searchHistory = function (term) {
    const items = document.querySelectorAll("#historyList .transaction-item");
    items.forEach((item) => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(term.toLowerCase()) ? "flex" : "none";
    });
  };

  // Charts
  function initCharts() {
    Chart.defaults.color = getComputedStyle(document.body).getPropertyValue(
      "--text-secondary"
    );
    Chart.defaults.borderColor = getComputedStyle(
      document.body
    ).getPropertyValue("--border");
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
    showToast(`Theme changed to ${theme}`);

    // Reinit charts with new colors
    initCharts();
    if (document.getElementById("analytics").classList.contains("active")) {
      updateCharts();
    }
  };

  // Export Functions - MAKE GLOBAL
  window.exportAsCSV = function () {
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
  };

  window.exportAsText = function () {
    if (transactions.length === 0) {
      showToast("No data to export");
      return;
    }

    let text = "MONEYTRACK TRANSACTION REPORT\n";
    text += "================================\n\n";
    text += `Generated: ${new Date().toLocaleString()}\n`;
    text += `Current Balance: $${balance.toFixed(2)}\n`;
    text += `Bubble Capacity: $${maxBalance.toFixed(2)}\n`;
    text += `Fill Percentage: ${((balance / maxBalance) * 100).toFixed(
      1
    )}%\n\n`;
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
  };

  window.clearData = async function () {
    if (
      confirm("Are you sure you want to clear all data? This cannot be undone.")
    ) {
      try {
        // Delete all transactions from Supabase
        const { error } = await supabase
          .from("transactions")
          .delete()
          .eq("user_id", currentUser.id);

        if (error) throw error;

        // Reset local data
        balance = 0;
        transactions = [];

        // Save settings
        await saveSettings();

        updateUI();
        showToast("All data cleared");
      } catch (error) {
        console.error("Error:", error);
        showToast("Error clearing data");
      }
    }
  };

  // Update capacity display
  function updateCapacityDisplay() {
    const capacityEl = document.getElementById("currentCapacity");
    if (capacityEl) {
      capacityEl.textContent = `$${maxBalance.toLocaleString()}`;
    }

    // Update the input placeholder
    const capacityInput = document.getElementById("bubbleCapacity");
    if (capacityInput) {
      capacityInput.placeholder = maxBalance.toString();
    }
  }

  // Toast notification
  function showToast(message) {
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = message;
      toast.classList.add("show");

      setTimeout(() => {
        toast.classList.remove("show");
      }, 3000);
    }
  }

  // Format date helper
  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
}
