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
