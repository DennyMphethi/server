require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection pool with proper configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { 
    rejectUnauthorized: false 
  } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection not established
});

// Verify database connection immediately
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error acquiring client', err.stack);
    process.exit(1);
  }
  console.log('Successfully connected to database');
  release();
});

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');
const JWT_EXPIRES_IN = '1h';

// Initialize database tables (run once)
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        phone VARCHAR(20) UNIQUE,
        balance DECIMAL(12, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS company_account (
        id SERIAL PRIMARY KEY,
        balance DECIMAL(12, 2) DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    await client.query(`
      INSERT INTO company_account (id, balance)
      VALUES (1, 0)
      ON CONFLICT (id) DO NOTHING`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bank_details (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        bank_name VARCHAR(100) NOT NULL,
        account_number VARCHAR(50) NOT NULL,
        branch_code VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        type VARCHAR(20) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        fee DECIMAL(12, 2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'completed',
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    await client.query('COMMIT');
    console.log('Database tables initialized');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

// Initialize database on startup
initializeDatabase();

// Helper functions
const generateAuthToken = (userId) => {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Routes
app.get('/', (req, res) => {
  res.send('Voucher Cash-Out API is running');
});

// User registration
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, phone, balance`,
      [email, hashedPassword, name, phone]
    );
    
    const token = generateAuthToken(result.rows[0].id);
    res.status(201).json({ user: result.rows[0], token });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Email or phone already exists' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      'SELECT id, email, name, phone, balance, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0 || !await bcrypt.compare(password, result.rows[0].password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    delete user.password_hash;
    const token = generateAuthToken(user.id);
    res.json({ user, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Voucher verification and redemption
app.post('/api/vouchers/verify', authenticateJWT, async (req, res) => {
  try {
    const { provider, serial, pin } = req.body;
    const userId = req.user.sub;
    
    // In a real app, you would call the provider's API here
    // This is a mock implementation
    const amount = Math.floor(Math.random() * 500) + 50; // Random amount between 50-550
    const fee = amount * 0.03; // 3% service fee
    const netAmount = amount - fee;

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Add to user balance
      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [netAmount, userId]
      );

      // Add fee to company account
      await client.query(
        'UPDATE company_account SET balance = balance + $1 WHERE id = 1',
        [fee]
      );

      // Record transaction
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, fee, details)
         VALUES ($1, 'voucher', $2, $3, $4)`,
        [userId, amount, fee, { provider, serial }]
      );

      // Get updated balance
      const balanceResult = await client.query(
        'SELECT balance FROM users WHERE id = $1',
        [userId]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        amount,
        fee,
        netAmount,
        newBalance: balanceResult.rows[0].balance
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Voucher verification error:', error);
    res.status(500).json({ error: 'Voucher verification failed' });
  }
});

// Bank transfer
app.post('/api/transfers/bank', authenticateJWT, async (req, res) => {
  try {
    const { amount, bankDetails } = req.body;
    const userId = req.user.sub;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify sufficient balance
      const userResult = await client.query(
        'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );
      
      if (userResult.rows[0].balance < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // Deduct from user balance
      await client.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2',
        [amount, userId]
      );

      // Record transaction
      await client.query(
        `INSERT INTO transactions (user_id, type, amount, details)
         VALUES ($1, 'bank_transfer', $2, $3)`,
        [userId, amount, { bankDetails }]
      );

      // Get updated balance
      const newBalanceResult = await client.query(
        'SELECT balance FROM users WHERE id = $1',
        [userId]
      );

      await client.query('COMMIT');

      // In a real app, you would initiate a bank transfer here
      res.json({
        success: true,
        newBalance: newBalanceResult.rows[0].balance,
        message: 'Bank transfer initiated'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Bank transfer error:', error);
    res.status(500).json({ error: 'Bank transfer failed' });
  }
});

// User-to-user transfer
app.post('/api/transfers/user', authenticateJWT, async (req, res) => {
  try {
    const { recipientPhone, amount } = req.body;
    const senderId = req.user.sub;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify sender balance
      const senderResult = await client.query(
        'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
        [senderId]
      );
      
      if (senderResult.rows[0].balance < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // Get recipient
      const recipientResult = await client.query(
        'SELECT id FROM users WHERE phone = $1 FOR UPDATE',
        [recipientPhone]
      );
      
      if (recipientResult.rows.length === 0) {
        return res.status(404).json({ error: 'Recipient not found' });
      }

      const recipientId = recipientResult.rows[0].id;

      // Transfer funds
      await client.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2',
        [amount, senderId]
      );
      
      await client.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2',
        [amount, recipientId]
      );

      // Record transactions
      const transferFee = amount * 0.01; // 1% transfer fee
      const netAmount = amount - transferFee;

      await client.query(
        `INSERT INTO transactions (user_id, type, amount, fee, details)
         VALUES ($1, 'transfer_out', $2, $3, $4)`,
        [senderId, amount, transferFee, { recipientPhone, netAmount }]
      );

      await client.query(
        `INSERT INTO transactions (user_id, type, amount, details)
         VALUES ($1, 'transfer_in', $2, $3)`,
        [recipientId, netAmount, { senderPhone: senderResult.rows[0].phone }]
      );

      // Add fee to company account
      await client.query(
        'UPDATE company_account SET balance = balance + $1 WHERE id = 1',
        [transferFee]
      );

      // Get updated sender balance
      const senderBalanceResult = await client.query(
        'SELECT balance FROM users WHERE id = $1',
        [senderId]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        newBalance: senderBalanceResult.rows[0].balance,
        message: `R${netAmount.toFixed(2)} sent to ${recipientPhone} (Fee: R${transferFee.toFixed(2)})`
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('User transfer error:', error);
    res.status(500).json({ error: 'Transfer failed' });
  }
});

// Bank details management
app.post('/api/bank-details', authenticateJWT, async (req, res) => {
  try {
    const { bankName, accountNumber, branchCode } = req.body;
    const userId = req.user.sub;

    const result = await pool.query(
      `INSERT INTO bank_details (user_id, bank_name, account_number, branch_code)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id)
       DO UPDATE SET
         bank_name = EXCLUDED.bank_name,
         account_number = EXCLUDED.account_number,
         branch_code = EXCLUDED.branch_code,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, bankName, accountNumber, branchCode]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Bank details error:', error);
    res.status(500).json({ error: 'Failed to save bank details' });
  }
});

// Get user bank details
app.get('/api/bank-details', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.sub;
    const result = await pool.query(
      'SELECT * FROM bank_details WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bank details not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get bank details error:', error);
    res.status(500).json({ error: 'Failed to get bank details' });
  }
});

// Get user transactions
app.get('/api/transactions', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { limit = 10, offset = 0 } = req.query;
    
    const result = await pool.query(
      `SELECT * FROM transactions 
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// Get user balance
app.get('/api/balance', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.sub;
    const result = await pool.query(
      'SELECT balance FROM users WHERE id = $1',
      [userId]
    );
    
    res.json({ balance: result.rows[0].balance });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});
