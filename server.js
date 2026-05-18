const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        city TEXT,
        tariff TEXT,
        rating TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("DATABASE READY");
  } catch (err) {
    console.error("DB INIT ERROR:", err);
  }
}

initDB();

app.get("/", (req, res) => {
  res.send("BUSTER BACKEND ONLINE");
});

app.post("/save-user", async (req, res) => {
  try {
    const { telegram_id, city, tariff, rating } = req.body;

    if (!telegram_id) {
      return res.status(400).json({
        success: false,
        error: "telegram_id required",
      });
    }

    await pool.query(
      `
      INSERT INTO users (
        telegram_id,
        city,
        tariff,
        rating
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (telegram_id)
      DO UPDATE SET
        city = EXCLUDED.city,
        tariff = EXCLUDED.tariff,
        rating = EXCLUDED.rating
    `,
      [telegram_id, city, tariff, rating]
    );

    res.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

app.get("/users", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM users
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("SERVER STARTED:", PORT);
});