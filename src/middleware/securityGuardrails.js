/**
 * Security Guardrails Middleware for fauxBank
 * Implements zero-trust security principles and banking-standard validations
 */

const crypto = require('crypto');

/**
 * Rate limiting store (in-memory for simplicity)
 */
const rateLimitStore = new Map();

/**
 * Request validation middleware
 */
function validateRequest(req, res, next) {
  // Check for required headers
  if (!req.headers['content-type'] && req.method !== 'GET') {
    return res.status(400).json({
      error: 'Missing Content-Type header',
      code: 'INVALID_REQUEST'
    });
  }

  // Validate Content-Type for POST/PUT/PATCH
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    if (!req.headers['content-type']?.includes('application/json')) {
      return res.status(400).json({
        error: 'Content-Type must be application/json',
        code: 'INVALID_CONTENT_TYPE'
      });
    }
  }

  next();
}

/**
 * Rate limiting middleware
 * Prevents abuse by limiting requests per IP
 */
function rateLimit(options = {}) {
  const maxRequests = options.maxRequests || 100;
  const windowMs = options.windowMs || 60000; // 1 minute

  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const rateData = rateLimitStore.get(key);

    if (now > rateData.resetTime) {
      rateData.count = 1;
      rateData.resetTime = now + windowMs;
      return next();
    }

    if (rateData.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((rateData.resetTime - now) / 1000)
      });
    }

    rateData.count++;
    next();
  };
}

/**
 * Input sanitization middleware
 * Prevents injection attacks
 */
function sanitizeInput(req, res, next) {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Remove potential script tags and SQL injection attempts
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/[';"]|--|\b(OR|AND|UNION|SELECT|INSERT|UPDATE|DELETE|DROP)\b/gi, '');
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }
    
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }

  if (req.query) {
    req.query = sanitize(req.query);
  }

  next();
}

/**
 * Transaction amount validation
 * Prevents unrealistic transactions
 */
function validateTransactionAmount(req, res, next) {
  if (req.body.amount !== undefined) {
    const amount = parseFloat(req.body.amount);
    
    if (isNaN(amount)) {
      return res.status(400).json({
        error: 'Invalid amount format',
        code: 'INVALID_AMOUNT'
      });
    }

    if (amount < 0) {
      return res.status(400).json({
        error: 'Amount must be positive',
        code: 'NEGATIVE_AMOUNT'
      });
    }

    if (amount > 1000000) {
      return res.status(400).json({
        error: 'Amount exceeds maximum transaction limit',
        code: 'AMOUNT_TOO_LARGE'
      });
    }

    // Ensure proper decimal places (cents)
    if (!/^\d+(\.\d{1,2})?$/.test(amount.toString())) {
      return res.status(400).json({
        error: 'Amount must have at most 2 decimal places',
        code: 'INVALID_DECIMAL_PLACES'
      });
    }
  }

  next();
}

/**
 * Account status validation
 * Ensures operations are only performed on active accounts
 */
function validateAccountStatus(account) {
  if (!account) {
    return { valid: false, error: 'Account not found', code: 'ACCOUNT_NOT_FOUND' };
  }

  if (account.status === 'closed') {
    return { valid: false, error: 'Account is closed', code: 'ACCOUNT_CLOSED' };
  }

  if (account.status === 'frozen') {
    return { valid: false, error: 'Account is frozen', code: 'ACCOUNT_FROZEN' };
  }

  return { valid: true };
}

/**
 * Sufficient funds validation
 */
function validateSufficientFunds(account, amount) {
  const availableBalance = account.overdraftProtection 
    ? account.balance + account.overdraftLimit 
    : account.balance;

  if (amount > availableBalance) {
    return {
      valid: false,
      error: 'Insufficient funds',
      code: 'INSUFFICIENT_FUNDS',
      available: availableBalance
    };
  }

  return { valid: true };
}

/**
 * Credit limit validation
 */
function validateCreditLimit(creditCard, amount) {
  if (!creditCard) {
    return { valid: false, error: 'Credit card not found', code: 'CARD_NOT_FOUND' };
  }

  if (creditCard.status !== 'active') {
    return { valid: false, error: 'Card is not active', code: 'CARD_INACTIVE' };
  }

  if (amount > creditCard.availableCredit) {
    return {
      valid: false,
      error: 'Exceeds credit limit',
      code: 'CREDIT_LIMIT_EXCEEDED',
      availableCredit: creditCard.availableCredit
    };
  }

  return { valid: true };
}

/**
 * Audit logging
 */
function auditLog(action, data) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    data,
    requestId: crypto.randomUUID()
  };
  
  // In a real system, this would write to a secure audit log
  console.log('[AUDIT]', JSON.stringify(logEntry));
}

/**
 * Fraud detection (basic simulation)
 */
function detectFraud(transaction) {
  const fraudScores = {
    largeAmount: transaction.amount > 50000 ? 30 : 0,
    unusualTime: new Date().getHours() < 6 || new Date().getHours() > 22 ? 10 : 0,
    // In a real system, this would check against historical patterns
  };

  const totalScore = Object.values(fraudScores).reduce((sum, score) => sum + score, 0);

  return {
    isSuspicious: totalScore > 25,
    score: totalScore,
    reasons: Object.entries(fraudScores)
      .filter(([_, score]) => score > 0)
      .map(([reason, _]) => reason)
  };
}

module.exports = {
  validateRequest,
  rateLimit,
  sanitizeInput,
  validateTransactionAmount,
  validateAccountStatus,
  validateSufficientFunds,
  validateCreditLimit,
  auditLog,
  detectFraud
};
