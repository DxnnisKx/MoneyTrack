// api/index.js
const express = require("express");
const fs = require("fs").promises;
const path = require("path");

const app = express();

app.use(express.json());

// In Vercel, we'll use /tmp for temporary storage
// Note: This will reset on each deployment
const DATA_FILE = path.join("/tmp", "data.json");

async function initializeDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(
      DATA_FILE,
      JSON.stringify({ capital: 0, transactions: [] })
    );
  }
}

// Initialize data file for each request
app.use(async (req, res, next) => {
  await initializeDataFile();
  next();
});

app.get("/api/data", async (req, res) => {
  try {
    const data = await fs.readFile(DATA_FILE, "utf8");
    res.json(JSON.parse(data));
  } catch (error) {
    console.error("Error reading data:", error);
    res.status(500).json({ error: "Failed to read data" });
  }
});

app.post("/api/capital", async (req, res) => {
  try {
    const { amount, description, type } = req.body;

    if (!amount || !description || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const data = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    if (type === "add") {
      data.capital += numAmount;
    } else if (type === "subtract") {
      data.capital -= numAmount;
    } else {
      return res.status(400).json({ error: "Invalid type" });
    }

    data.transactions.push({
      id: Date.now(),
      amount: numAmount,
      description: description.trim(),
      type,
      date: new Date().toISOString(),
      balance: data.capital,
    });

    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    res.json(data);
  } catch (error) {
    console.error("Error updating capital:", error);
    res.status(500).json({ error: "Failed to update capital" });
  }
});

app.post("/api/capital/set", async (req, res) => {
  try {
    const { amount } = req.body;

    if (amount === undefined || amount === null) {
      return res.status(400).json({ error: "Amount is required" });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const data = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));

    data.capital = numAmount;
    data.transactions.push({
      id: Date.now(),
      amount: numAmount,
      description: "Initial capital set",
      type: "set",
      date: new Date().toISOString(),
      balance: numAmount,
    });

    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    res.json(data);
  } catch (error) {
    console.error("Error setting capital:", error);
    res.status(500).json({ error: "Failed to set capital" });
  }
});

// Export for Vercel
module.exports = app;
