/**
 * API Routes for fauxBank
 */

const express = require('express');
const router = express.Router();

// Import controllers
const customerController = require('../controllers/customerController');
const accountController = require('../controllers/accountController');
const transactionController = require('../controllers/transactionController');
const creditController = require('../controllers/creditController');

// Import middleware
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validateRequest, validateTransactionAmount } = require('../middleware/securityGuardrails');

// Public routes
router.post('/customers/register', validateRequest, customerController.register);
router.post('/customers/login', validateRequest, customerController.login);

// Customer routes (authenticated)
router.get('/customers/:customerId/profile', authenticate, customerController.getProfile);
router.put('/customers/:customerId', authenticate, validateRequest, customerController.updateCustomer);

// Account routes
router.post('/accounts', authenticate, validateRequest, accountController.createAccount);
router.get('/accounts/:accountNumber', authenticate, accountController.getAccount);
router.get('/customers/:customerId/accounts', authenticate, accountController.getAccountsByCustomer);
router.post('/accounts/transfer', authenticate, validateRequest, validateTransactionAmount, accountController.transferFunds);
router.post('/accounts/:accountNumber/close', authenticate, accountController.closeAccount);
router.post('/accounts/:accountNumber/freeze', authenticate, validateRequest, accountController.freezeAccount);
router.post('/accounts/:accountNumber/unfreeze', authenticate, accountController.unfreezeAccount);

// Transaction routes
router.post('/transactions/ach', authenticate, validateRequest, validateTransactionAmount, transactionController.processACH);
router.post('/transactions/echeck', authenticate, validateRequest, validateTransactionAmount, transactionController.processECheck);
router.post('/transactions/wire', authenticate, validateRequest, validateTransactionAmount, transactionController.processWire);
router.get('/transactions/:transactionId', authenticate, transactionController.getTransaction);
router.get('/accounts/:accountNumber/transactions', authenticate, transactionController.getTransactionsByAccount);

// Credit routes
router.get('/customers/:customerId/credit-check', authenticate, creditController.performCreditCheck);
router.post('/loans/apply', authenticate, validateRequest, creditController.applyForLoan);
router.post('/loans/:loanNumber/payment', authenticate, validateRequest, validateTransactionAmount, creditController.makeLoanPayment);
router.post('/credit-cards/apply', authenticate, validateRequest, creditController.applyForCreditCard);
router.post('/credit-cards/:cardNumber/payment', authenticate, validateRequest, validateTransactionAmount, creditController.makeCreditCardPayment);
router.post('/credit-cards/charge', authenticate, validateRequest, validateTransactionAmount, creditController.chargeCreditCard);

// Health check route
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'fauxBank API'
  });
});

module.exports = router;
