/**
 * Authentication Middleware for fauxBank
 * Implements JWT-based authentication
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// In a real system, this would be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRATION = '24h';

/**
 * Generate JWT token
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Authentication middleware
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN'
    });
  }

  // Attach user info to request
  req.user = decoded;
  next();
}

/**
 * Optional authentication middleware
 * Allows public access but attaches user info if authenticated
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (decoded) {
      req.user = decoded;
    }
  }

  next();
}

/**
 * Customer ownership verification
 * Ensures the authenticated user owns the resource
 */
function verifyOwnership(req, res, next) {
  const customerId = req.params.customerId || req.body.customerId;

  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  }

  if (req.user.customerId !== customerId && req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied',
      code: 'FORBIDDEN'
    });
  }

  next();
}

/**
 * Admin role verification
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required',
      code: 'FORBIDDEN'
    });
  }

  next();
}

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
  optionalAuth,
  verifyOwnership,
  requireAdmin
};
