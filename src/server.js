/**
 * fauxBank API Server
 * Mock banking system with full functionality and zero-trust security
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const routes = require('./routes');
const { rateLimit, sanitizeInput } = require('./middleware/securityGuardrails');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Security middleware
app.use(sanitizeInput);
app.use(rateLimit({
  maxRequests: 100,
  windowMs: 60000 // 1 minute
}));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API routes
app.use('/api', routes);

// Root route
app.get('/', (req, res) => {
  res.json({
    service: 'fauxBank',
    version: '1.0.0',
    description: 'Mock banking system with full functionality',
    features: [
      'Accounts (Checking, Savings, Money Market)',
      'Loans (Personal, Auto, Home, Student, Business)',
      'Credit Cards',
      'ACH Transfers',
      'eChecks',
      'Wire Transfers',
      'Debit Cards',
      'Credit Checks',
      'Investment Accounts (Brokerage, IRA, Roth IRA, 401k)',
      'Certificates of Deposit (CDs)',
      'Zero-trust security with banking-standard guardrails',
      'Alphanumeric account numbers for differentiation from real banks'
    ],
    documentation: '/api/health',
    endpoints: {
      customers: '/api/customers',
      accounts: '/api/accounts',
      transactions: '/api/transactions',
      loans: '/api/loans',
      creditCards: '/api/credit-cards'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND'
  });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('fauxBank API Server');
    console.log('='.repeat(60));
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API endpoint: http://localhost:${PORT}/api`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log('='.repeat(60));
    console.log('Features:');
    console.log('  ✓ Alphanumeric account numbers');
    console.log('  ✓ Zero-trust security guardrails');
    console.log('  ✓ Full banking functionality');
    console.log('  ✓ ACH, eCheck, Wire transfers');
    console.log('  ✓ Credit checks and loans');
    console.log('  ✓ Investment accounts and CDs');
    console.log('='.repeat(60));
  });
}

module.exports = app;
