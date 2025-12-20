/**
 * Transaction Service for fauxBank
 * Handles ACH, eChecks, wire transfers, and other transaction types
 */

const Transaction = require('../models/Transaction');
const dataStore = require('./dataStore');
const accountService = require('./accountService');
const { auditLog, detectFraud } = require('../middleware/securityGuardrails');
const crypto = require('crypto');

class TransactionService {
  /**
   * Process ACH transaction
   */
  processACH(fromAccountNumber, toAccountNumber, amount, description) {
    const transactionId = crypto.randomUUID();

    try {
      // Create pending transaction
      const transaction = new Transaction({
        transactionId,
        transactionType: 'ach',
        amount,
        fromAccount: fromAccountNumber,
        toAccount: toAccountNumber,
        status: 'pending',
        description,
        metadata: { processingDays: 1 } // ACH typically takes 1-3 business days
      });

      dataStore.createTransaction(transaction);

      // Simulate fraud detection
      const fraudCheck = detectFraud(transaction);
      if (fraudCheck.isSuspicious) {
        transaction.status = 'failed';
        transaction.failureReason = 'Flagged for fraud review';
        dataStore.updateTransaction(transactionId, transaction);
        
        auditLog('ACH_FRAUD_DETECTED', { transactionId, reasons: fraudCheck.reasons });
        throw new Error('Transaction flagged for fraud review');
      }

      // Process transfer
      accountService.transferFunds(fromAccountNumber, toAccountNumber, amount);

      // Mark as completed
      transaction.status = 'completed';
      transaction.completedAt = new Date();
      dataStore.createTransaction(transaction);

      auditLog('ACH_COMPLETED', { transactionId, fromAccountNumber, toAccountNumber, amount });

      return transaction;
    } catch (error) {
      const transaction = dataStore.getTransaction(transactionId);
      if (transaction) {
        transaction.status = 'failed';
        transaction.failureReason = error.message;
        dataStore.createTransaction(transaction);
      }

      auditLog('ACH_FAILED', { transactionId, error: error.message });
      throw error;
    }
  }

  /**
   * Process eCheck transaction
   */
  processECheck(fromAccountNumber, toAccountNumber, amount, checkNumber, description) {
    const transactionId = crypto.randomUUID();

    try {
      const transaction = new Transaction({
        transactionId,
        transactionType: 'echeck',
        amount,
        fromAccount: fromAccountNumber,
        toAccount: toAccountNumber,
        status: 'pending',
        description,
        metadata: { checkNumber }
      });

      dataStore.createTransaction(transaction);

      // Verify check hasn't been used before (prevent double-spending)
      const existingChecks = dataStore.getTransactionsByAccount(fromAccountNumber)
        .filter(t => t.metadata?.checkNumber === checkNumber && t.status === 'completed');

      if (existingChecks.length > 0) {
        transaction.status = 'failed';
        transaction.failureReason = 'Check number already used';
        dataStore.createTransaction(transaction);
        throw new Error('Check number already used');
      }

      // Process transfer
      accountService.transferFunds(fromAccountNumber, toAccountNumber, amount);

      transaction.status = 'completed';
      transaction.completedAt = new Date();
      dataStore.createTransaction(transaction);

      auditLog('ECHECK_COMPLETED', { transactionId, checkNumber, amount });

      return transaction;
    } catch (error) {
      const transaction = dataStore.getTransaction(transactionId);
      if (transaction) {
        transaction.status = 'failed';
        transaction.failureReason = error.message;
        dataStore.createTransaction(transaction);
      }

      auditLog('ECHECK_FAILED', { transactionId, error: error.message });
      throw error;
    }
  }

  /**
   * Process wire transfer (same-day, higher fees)
   */
  processWireTransfer(fromAccountNumber, toAccountNumber, amount, description) {
    const transactionId = crypto.randomUUID();

    try {
      const wireFee = 25.00; // Standard wire transfer fee
      const totalAmount = amount + wireFee;

      const transaction = new Transaction({
        transactionId,
        transactionType: 'wire',
        amount: totalAmount,
        fromAccount: fromAccountNumber,
        toAccount: toAccountNumber,
        status: 'pending',
        description,
        metadata: { wireFee, actualAmount: amount }
      });

      dataStore.createTransaction(transaction);

      // Process transfer (including fee)
      accountService.transferFunds(fromAccountNumber, toAccountNumber, amount);
      
      // Deduct wire fee
      accountService.updateBalance(fromAccountNumber, wireFee, 'debit');

      transaction.status = 'completed';
      transaction.completedAt = new Date();
      dataStore.createTransaction(transaction);

      auditLog('WIRE_COMPLETED', { transactionId, amount, wireFee });

      return transaction;
    } catch (error) {
      const transaction = dataStore.getTransaction(transactionId);
      if (transaction) {
        transaction.status = 'failed';
        transaction.failureReason = error.message;
        dataStore.createTransaction(transaction);
      }

      auditLog('WIRE_FAILED', { transactionId, error: error.message });
      throw error;
    }
  }

  /**
   * Process debit card transaction
   */
  processDebitCard(cardNumber, merchantId, amount, description) {
    const transactionId = crypto.randomUUID();

    try {
      const debitCard = dataStore.getDebitCard(cardNumber);
      
      if (!debitCard) {
        throw new Error('Card not found');
      }

      if (debitCard.status !== 'active') {
        throw new Error('Card is not active');
      }

      const transaction = new Transaction({
        transactionId,
        transactionType: 'card_payment',
        amount,
        fromAccount: debitCard.linkedAccountNumber,
        toAccount: merchantId,
        status: 'pending',
        description,
        customerId: debitCard.customerId,
        metadata: { cardNumber: cardNumber.substring(0, 4) + '****' + cardNumber.substring(cardNumber.length - 4) }
      });

      dataStore.createTransaction(transaction);

      // Process payment
      accountService.updateBalance(debitCard.linkedAccountNumber, amount, 'debit');

      transaction.status = 'completed';
      transaction.completedAt = new Date();
      dataStore.createTransaction(transaction);

      auditLog('DEBIT_CARD_TRANSACTION', { transactionId, amount, merchantId });

      return transaction;
    } catch (error) {
      const transaction = dataStore.getTransaction(transactionId);
      if (transaction) {
        transaction.status = 'failed';
        transaction.failureReason = error.message;
        dataStore.createTransaction(transaction);
      }

      auditLog('DEBIT_CARD_FAILED', { transactionId, error: error.message });
      throw error;
    }
  }

  /**
   * Get transaction by ID
   */
  getTransaction(transactionId) {
    return dataStore.getTransaction(transactionId);
  }

  /**
   * Get transactions for an account
   */
  getTransactionsByAccount(accountNumber) {
    return dataStore.getTransactionsByAccount(accountNumber);
  }

  /**
   * Get transactions for a customer
   */
  getTransactionsByCustomer(customerId) {
    return dataStore.getTransactionsByCustomer(customerId);
  }
}

module.exports = new TransactionService();
