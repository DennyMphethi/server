// ======================
// Voucher Cash-Out Backend
// ======================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Database setup (PostgreSQL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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
{
  "name": "voucher-backend",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.11.3",
    "dotenv": "^16.3.1"
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
  }
// Add these endpoints to your Node.js backend

// Get user balance
app.get('/api/balance', async (req, res) => {
  const { userId } = req.query;
  // Query database for user's balance
  const result = await pool.query('SELECT balance FROM users WHERE id = $1', [userId]);
  res.json({ balance: result.rows[0]?.balance || 0 });
});

// Get company balance
app.get('/api/company-balance', async (req, res) => {
  // Query database for company balance
  const result = await pool.query('SELECT balance FROM company_account WHERE id = 1');
  res.json({ balance: result.rows[0]?.balance || 0 });
});

// Save to wallet (with fee deduction)
app.post('/api/save-to-wallet', async (req, res) => {
  const { userId, amount, fee } = req.body;
  
  // Start transaction
  await pool.query('BEGIN');
  
  try {
    // Update user balance
    await pool.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2',
      [amount, userId]
    );
    
    // Update company balance with fee
    await pool.query(
      'UPDATE company_account SET balance = balance + $1 WHERE id = 1',
      [fee]
    );
    
    // Get updated balances
    const userBalance = await pool.query(
      'SELECT balance FROM users WHERE id = $1', [userId]
    );
    const companyBalance = await pool.query(
      'SELECT balance FROM company_account WHERE id = 1'
    );
    
    await pool.query('COMMIT');
    
    res.json({
      userBalance: userBalance.rows[0].balance,
      companyBalance: companyBalance.rows[0].balance
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: "Transaction failed" });
  }
});

// Transfer to bank
app.post('/api/transfer-to-bank', async (req, res) => {
  const { userId, amount, bankDetails } = req.body;
  
  // Verify user has sufficient balance
  const user = await pool.query('SELECT balance FROM users WHERE id = $1', [userId]);
  if (user.rows[0].balance < amount) {
    return res.status(400).json({ error: "Insufficient balance" });
  }
  
  // Deduct from user balance
  await pool.query(
    'UPDATE users SET balance = balance - $1 WHERE id = $2',
    [amount, userId]
  );
  
  // In a real app, you would initiate a bank transfer here
  // For now, just return success
  res.json({ newBalance: user.rows[0].balance - amount });
});

// Transfer to user
app.post('/api/transfer-to-user', async (req, res) => {
  const { senderId, recipientPhone, amount } = req.body;
  
  // Start transaction
  await pool.query('BEGIN');
  
  try {
    // Verify sender has sufficient balance
    const sender = await pool.query('SELECT balance FROM users WHERE id = $1', [senderId]);
    if (sender.rows[0].balance < amount) {
      throw new Error("Insufficient balance");
    }
    
    // Get recipient
    const recipient = await pool.query('SELECT id FROM users WHERE phone = $1', [recipientPhone]);
    if (!recipient.rows[0]) {
      throw new Error("Recipient not found");
    }
    
    // Deduct from sender
    await pool.query(
      'UPDATE users SET balance = balance - $1 WHERE id = $2',
      [amount, senderId]
    );
    
    // Add to recipient
    await pool.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2',
      [amount, recipient.rows[0].id]
    );
    
    // Get updated sender balance
    const senderBalance = await pool.query(
      'SELECT balance FROM users WHERE id = $1', [senderId]
    );
    
    await pool.query('COMMIT');
    
    res.json({
      senderBalance: senderBalance.rows[0].balance
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    res.status(400).json({ error: error.message });
  }
});

// Save bank details
app.post('/api/save-bank-details', async (req, res) => {
  const { userId, bankName, accountNumber, branchCode } = req.body;
  
  // Save or update bank details
  await pool.query(
    `INSERT INTO user_bank_details (user_id, bank_name, account_number, branch_code)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) 
     DO UPDATE SET 
       bank_name = EXCLUDED.bank_name,
       account_number = EXCLUDED.account_number,
       branch_code = EXCLUDED.branch_code`,
    [userId, bankName, accountNumber, branchCode]
  );
  
  res.json({ success: true });
});
