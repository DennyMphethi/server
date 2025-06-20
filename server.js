// ======================
// Voucher Cash-Out Backend
// ======================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Replace your Pool setup with:
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render
  }
});

// Initialize tables (run once)
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      phone VARCHAR(20),
      name VARCHAR(255)
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      provider VARCHAR(100) NOT NULL,
      serial VARCHAR(100) NOT NULL,
      pin VARCHAR(100) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending'
    );
  `);
  console.log("Database tables ready!");
}
initDB();

// JWT secret (use a long random string in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

// Mock voucher providers (replace with real APIs)
const MOCK_PROVIDERS = {
  'Shoprite': { fee: 5, min: 50, max: 5000 },
  'Capitec': { fee: 3, min: 100, max: 10000 },
};

// Express app
const app = express();
app.use(cors());
app.use(express.json());

// ======== API ENDPOINTS ========

// 1. Register a new user
app.post('/api/register', async (req, res) => {
  const { email, password, name, phone } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name, phone) VALUES ($1, $2, $3, $4) RETURNING id, email, name',
      [email, hashedPassword, name, phone]
    );
    const token = jwt.sign({ userId: result.rows[0].id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ user: result.rows[0], token });
  } catch (err) {
    res.status(400).json({ error: "Email already exists" });
  }
});

// 2. Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!user.rows[0] || !(await bcrypt.compare(password, user.rows[0].password_hash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ userId: user.rows[0].id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ 
      user: { id: user.rows[0].id, email: user.rows[0].email, name: user.rows[0].name }, 
      token 
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// 3. Verify a voucher (mock)
app.post('/api/verify-voucher', async (req, res) => {
  const { provider, serial, pin } = req.body;
  if (!MOCK_PROVIDERS[provider]) {
    return res.status(400).json({ error: "Invalid provider" });
  }
  // Mock verification (replace with real API call)
  const amount = Math.floor(Math.random() * 500) + 50; // Random amount for demo
  const fee = MOCK_PROVIDERS[provider].fee;
  res.json({ 
    success: true, 
    amount, 
    fee,
    total: amount - fee 
  });
});

// 4. Redeem to bank (mock)
app.post('/api/redeem', async (req, res) => {
  const { provider, serial, pin, amount, userId } = req.body;
  try {
    await pool.query(
      'INSERT INTO transactions (user_id, provider, serial, pin, amount, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, provider, serial, pin, amount, 'completed']
    );
    res.json({ success: true, message: "Redeemed successfully!" });
  } catch (err) {
    res.status(500).json({ error: "Failed to process transaction" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
