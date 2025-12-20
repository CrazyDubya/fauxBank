/**
 * Transaction Controller for fauxBank API
 */

const transactionService = require('../services/transactionService');

class TransactionController {
  /**
   * Process ACH transaction
   */
  async processACH(req, res) {
    try {
      const { fromAccountNumber, toAccountNumber, amount, description } = req.body;

      if (!fromAccountNumber || !toAccountNumber || !amount) {
        return res.status(400).json({
          error: 'Missing required fields',
          code: 'MISSING_FIELDS'
        });
      }

      const transaction = transactionService.processACH(
        fromAccountNumber,
        toAccountNumber,
        amount,
        description
      );

      res.status(201).json({
        success: true,
        data: transaction.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'ACH_FAILED'
      });
    }
  }

  /**
   * Process eCheck transaction
   */
  async processECheck(req, res) {
    try {
      const { fromAccountNumber, toAccountNumber, amount, checkNumber, description } = req.body;

      if (!fromAccountNumber || !toAccountNumber || !amount || !checkNumber) {
        return res.status(400).json({
          error: 'Missing required fields',
          code: 'MISSING_FIELDS'
        });
      }

      const transaction = transactionService.processECheck(
        fromAccountNumber,
        toAccountNumber,
        amount,
        checkNumber,
        description
      );

      res.status(201).json({
        success: true,
        data: transaction.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'ECHECK_FAILED'
      });
    }
  }

  /**
   * Process wire transfer
   */
  async processWire(req, res) {
    try {
      const { fromAccountNumber, toAccountNumber, amount, description } = req.body;

      if (!fromAccountNumber || !toAccountNumber || !amount) {
        return res.status(400).json({
          error: 'Missing required fields',
          code: 'MISSING_FIELDS'
        });
      }

      const transaction = transactionService.processWireTransfer(
        fromAccountNumber,
        toAccountNumber,
        amount,
        description
      );

      res.status(201).json({
        success: true,
        data: transaction.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'WIRE_FAILED'
      });
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(req, res) {
    try {
      const { transactionId } = req.params;
      const transaction = transactionService.getTransaction(transactionId);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found',
          code: 'TRANSACTION_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: transaction.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get transactions by account
   */
  async getTransactionsByAccount(req, res) {
    try {
      const { accountNumber } = req.params;
      const transactions = transactionService.getTransactionsByAccount(accountNumber);

      res.json({
        success: true,
        data: transactions.map(t => t.toJSON())
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new TransactionController();
