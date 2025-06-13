const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const supabase = require('./supabase');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8081; // 🚀 Уникальный порт для backend

// Middleware
app.use(cors());
app.use(express.json());

// Mock data for hackathon (keeping as fallback)
const mockProducts = [
  {
    id: 1,
    name: "Sacred Meditation App",
    description: "Find inner peace with guided meditation",
    price: "10 TON",
    category: "Wellness",
    developer: "ZenCoder",
    rating: 4.8,
    image: "/api/placeholder/300/200"
  },
  {
    id: 2,
    name: "Crypto Trading Bot",
    description: "Automated trading for TON ecosystem",
    price: "25 TON",
    category: "Finance",
    developer: "TradeMaster",
    rating: 4.5,
    image: "/api/placeholder/300/200"
  }
];

const mockUsers = [
  {
    id: 1,
    wallet: "EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N", 
    role: "admin",
    name: "Admin User"
  }
];

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET || 'hackathon-secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'TON Web Store API is running with Supabase!' });
});

// Authentication
app.post('/api/auth/login', (req, res) => {
  const { wallet, signature } = req.body;
  
  // Mock authentication for hackathon
  if (wallet && signature) {
    const user = mockUsers.find(u => u.wallet === wallet) || {
      id: Date.now(),
      wallet,
      role: 'user',
      name: 'Demo User'
    };
    
    const token = jwt.sign(
      { userId: user.id, wallet: user.wallet, role: user.role },
      process.env.JWT_SECRET || 'hackathon-secret',
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        wallet: user.wallet,
        role: user.role,
        name: user.name
      }
    });
  } else {
    res.status(400).json({ success: false, message: 'Invalid credentials' });
  }
});

// Developers (Supabase powered)
app.get('/api/developers', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('developers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching developers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch developers' });
  }
});

app.post('/api/developers', authenticateToken, async (req, res) => {
  try {
    const { name, email, description, ton_address } = req.body;
    
    const { data, error } = await supabase
      .from('developers')
      .insert([{
        name,
        email,
        description,
        ton_address
      }])
      .select();

    if (error) throw error;

    res.json({
      success: true,
      data: data[0]
    });
  } catch (error) {
    console.error('Error creating developer:', error);
    res.status(500).json({ success: false, message: 'Failed to create developer' });
  }
});

// Products (keeping mock for now, can extend to Supabase later)
app.get('/api/products', (req, res) => {
  res.json({
    success: true,
    data: mockProducts
  });
});

app.get('/api/products/:id', (req, res) => {
  const product = mockProducts.find(p => p.id === parseInt(req.params.id));
  if (product) {
    res.json({ success: true, data: product });
  } else {
    res.status(404).json({ success: false, message: 'Product not found' });
  }
});

// Transactions (Mock TON integration)
app.post('/api/transactions', authenticateToken, (req, res) => {
  const { productId, amount, walletAddress } = req.body;
  
  // Mock transaction for hackathon
  const transaction = {
    id: `tx_${Date.now()}`,
    productId,
    amount,
    walletAddress,
    status: 'completed',
    timestamp: new Date().toISOString(),
    hash: `0x${Math.random().toString(16).substr(2, 64)}`
  };
  
  res.json({
    success: true,
    transaction
  });
});

// Audit logs (Enhanced with Supabase potential)
app.post('/api/audit-logs', async (req, res) => {
  try {
    console.log('Audit log:', req.body);
    
    // Could store in Supabase audit table in the future
    // For now just acknowledge
    res.json({ success: true });
  } catch (error) {
    console.error('Error storing audit log:', error);
    res.status(500).json({ success: false, message: 'Failed to store audit log' });
  }
});

app.get('/api/audit-logs', authenticateToken, (req, res) => {
  // Mock audit logs for demo (could fetch from Supabase)
  const mockLogs = [
    {
      _id: '1',
      userId: req.user.userId,
      action: 'login',
      resource: 'auth',
      timestamp: new Date().toISOString(),
      ipAddress: req.ip,
      result: 'success'
    },
    {
      _id: '2',
      userId: req.user.userId,
      action: 'view_developers',
      resource: 'developers',
      timestamp: new Date().toISOString(),
      ipAddress: req.ip,
      result: 'success'
    }
  ];
  
  res.json(mockLogs);
});

// Supabase connection test
app.get('/api/supabase-test', async (req, res) => {
  try {
    const { data, error, count } = await supabase
      .from('developers')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    res.json({
      success: true,
      message: 'Supabase connection successful!',
      developer_count: count || 0
    });
  } catch (error) {
    console.error('Supabase test error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Supabase connection failed',
      error: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 TON Web Store API running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🗄️ Supabase integration: ACTIVE`);
  console.log(`💎 Ready for Startup Challenge!`);
}); 