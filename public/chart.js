function loadCharts(transactions) {
  let income = 0;
  let expenses = 0;

  for (let i = 0; i < transactions.length; i++) {
    const amount = parseFloat(transactions[i].amount);
    if (transactions[i].type === "income") {
      income += amount;
    } else if (transactions[i].type === "expense") {
      expenses += amount;
    }
  }

  const months = Math.max(1, getMonthsDifference(transactions));
  const netBalance = income - expenses;

  document.querySelector("#totalIncome").textContent = "€" + income.toFixed(2);
  document.querySelector("#totalExpenses").textContent = "€" + expenses.toFixed(2);
  document.querySelector("#monthlyAvg").textContent = "€" + (netBalance / months).toFixed(2);
  document.querySelector("#yearlyTotal").textContent = "€" + netBalance.toFixed(2);
  document.querySelector("#avgMonthlyIncome").textContent = "€" + (income / months).toFixed(2);
  document.querySelector("#avgMonthlyExpense").textContent = "€" + (expenses / months).toFixed(2);

  createPieChart(income, expenses);
  createWaterfallChart(income, expenses);
  createMonthlyChart(transactions);
}

function createPieChart(income, expenses) {
  const pieCanvas = document.querySelector("#pieChart");
  if (window.charts.pie) window.charts.pie.destroy();

  window.charts.pie = new Chart(pieCanvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: ["Einnahmen", "Ausgaben"],
      datasets: [{
        data: [income, expenses],
        backgroundColor: ["#10b981", "#ef4444"],
        borderWidth: 0,
      }],
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
}

function createWaterfallChart(income, expenses) {
  const waterfallCanvas = document.querySelector("#waterfallChart");
  if (window.charts.waterfall) window.charts.waterfall.destroy();

  window.charts.waterfall = new Chart(waterfallCanvas.getContext("2d"), {
    type: "line",
    data: {
      labels: ["Start", "Einnahmen", "Ausgaben", "Ende"],
      datasets: [{
        label: "Geldfluss",
        data: [0, income, income - expenses, income - expenses],
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderWidth: 3,
        stepped: "middle",
        fill: true,
        tension: 0,
      }],
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

function createMonthlyChart(transactions) {
  const avgCanvas = document.querySelector("#avgChart");
  if (window.charts.avg) window.charts.avg.destroy();

  window.charts.avg = new Chart(avgCanvas.getContext("2d"), {
    type: "line",
    data: {
      labels: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
      datasets: [{
        label: "Monatsbilanz",
        data: getMonthlyData(transactions),
        borderColor: "#6366f1",
        backgroundColor: "rgba(99, 102, 241, 0.1)",
        borderWidth: 2,
        fill: true,
        tension: 0.3,
      }],
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

function getMonthlyData(transactions) {
  const monthlyBalance = new Array(12).fill(0);
  const currentYear = new Date().getFullYear();

  for (let i = 0; i < transactions.length; i++) {
    const date = new Date(transactions[i].created_at);

    if (date.getFullYear() === currentYear) {
      const month = date.getMonth();
      const amount = parseFloat(transactions[i].amount);

      if (transactions[i].type === "expense") {
        monthlyBalance[month] -= amount;
      } else {
        monthlyBalance[month] += amount;
      }
    }
  }

  return monthlyBalance;
}

function getMonthsDifference(transactions) {
  if (transactions.length === 0) return 1;

  const dates = [];
  for (let i = 0; i < transactions.length; i++) {
    dates.push(new Date(transactions[i].created_at).getTime());
  }

  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));

  let months = (maxDate.getFullYear() - minDate.getFullYear()) * 12;
  months += maxDate.getMonth() - minDate.getMonth();

  return Math.max(1, months + 1);
}