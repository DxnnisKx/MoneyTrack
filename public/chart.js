function loadCharts(transactions) {
  let income = 0;
  let expenses = 0;

  for (let i = 0; i < transactions.length; i++) {
    const amount = parseFloat(transactions[i].amount);
    if (transactions[i].type === "income") {
      income += amount;
    } else {
      expenses += amount;
    }
  }

  const months = getMonthsCount(transactions);
  const netBalance = income - expenses;

  document.querySelector("#totalIncome").textContent = "€" + income.toFixed(2);
  document.querySelector("#totalExpenses").textContent =
    "€" + expenses.toFixed(2);
  document.querySelector("#monthlyAvg").textContent =
    "€" + (netBalance / months).toFixed(2);
  document.querySelector("#yearlyTotal").textContent =
    "€" + netBalance.toFixed(2);
  document.querySelector("#avgMonthlyIncome").textContent =
    "€" + (income / months).toFixed(2);
  document.querySelector("#avgMonthlyExpense").textContent =
    "€" + (expenses / months).toFixed(2);

  createPieChart(income, expenses);
  createWaterfallChart(income, expenses);
}

function createPieChart(income, expenses) {
  const pieCanvas = document.querySelector("#pieChart");

  if (window.charts.pie) window.charts.pie.destroy();

  window.charts.pie = new Chart(pieCanvas.getContext("2d"), {
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
      cutout: "30%",
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              return "€" + context.parsed.toFixed(2);
            },
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
    type: "bar",
    data: {
      labels: ["Einnahmen", "Ausgaben", "Bilanz"],
      datasets: [
        {
          data: [
            [0, income],
            [income - expenses, income],
            [0, income - expenses],
          ],
          backgroundColor: ["#10b981", "#ef4444", "#3b82f6"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label;

              if (label === "Einnahmen") {
                return "€" + income.toFixed(2);
              } else if (label === "Ausgaben") {
                return "€" + expenses.toFixed(2);
              } else if (label === "Bilanz") {
                return "€" + (income - expenses).toFixed(2);
              }
            },
          },
        },
      },
    },
  });
}

function getMonthsCount(transactions) {
  if (transactions.length === 0) return 1;
  const firstDate = new Date(transactions[transactions.length - 1].created_at);
  const lastDate = new Date(transactions[0].created_at);
  const yearDiff = lastDate.getFullYear() - firstDate.getFullYear();
  const monthDiff = lastDate.getMonth() - firstDate.getMonth();
  const totalMonths = yearDiff * 12 + monthDiff + 1;
  return Math.max(1, totalMonths);
}
