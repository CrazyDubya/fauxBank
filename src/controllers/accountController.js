/**
 * Account Controller for fauxBank API
 */

const accountService = require('../services/accountService');

class AccountController {
  /**
   * Create new account
   */
  async createAccount(req, res) {
    try {
      const { customerId, accountType, initialDeposit, options } = req.body;

      if (!customerId || !accountType) {
        return res.status(400).json({
          error: 'Missing required fields: customerId, accountType',
          code: 'MISSING_FIELDS'
        });
      }

      const account = accountService.createAccount(
        customerId,
        accountType,
        initialDeposit || 0,
        options || {}
      );

      res.status(201).json({
        success: true,
        data: account.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'ACCOUNT_CREATION_FAILED'
      });
    }
  }

  /**
   * Get account details
   */
  async getAccount(req, res) {
    try {
      const { accountNumber } = req.params;
      const account = accountService.getAccount(accountNumber);

      if (!account) {
        return res.status(404).json({
          success: false,
          error: 'Account not found',
          code: 'ACCOUNT_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: account.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get accounts by customer
   */
  async getAccountsByCustomer(req, res) {
    try {
      const { customerId } = req.params;
      const accounts = accountService.getAccountsByCustomer(customerId);

      res.json({
        success: true,
        data: accounts.map(acc => acc.toJSON())
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Transfer funds
   */
  async transferFunds(req, res) {
    try {
      const { fromAccountNumber, toAccountNumber, amount } = req.body;

      if (!fromAccountNumber || !toAccountNumber || !amount) {
        return res.status(400).json({
          error: 'Missing required fields: fromAccountNumber, toAccountNumber, amount',
          code: 'MISSING_FIELDS'
        });
      }

      const result = accountService.transferFunds(fromAccountNumber, toAccountNumber, amount);

      res.json({
        success: true,
        data: {
          fromAccount: result.fromAccount.toJSON(),
          toAccount: result.toAccount.toJSON()
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'TRANSFER_FAILED'
      });
    }
  }

  /**
   * Close account
   */
  async closeAccount(req, res) {
    try {
      const { accountNumber } = req.params;
      const account = accountService.closeAccount(accountNumber);

      res.json({
        success: true,
        data: account.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'ACCOUNT_CLOSURE_FAILED'
      });
    }
  }

  /**
   * Freeze account
   */
  async freezeAccount(req, res) {
    try {
      const { accountNumber } = req.params;
      const { reason } = req.body;
      
      const account = accountService.freezeAccount(accountNumber, reason);

      res.json({
        success: true,
        data: account.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'ACCOUNT_FREEZE_FAILED'
      });
    }
  }

  /**
   * Unfreeze account
   */
  async unfreezeAccount(req, res) {
    try {
      const { accountNumber } = req.params;
      const account = accountService.unfreezeAccount(accountNumber);

      res.json({
        success: true,
        data: account.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'ACCOUNT_UNFREEZE_FAILED'
      });
    }
  }
}

module.exports = new AccountController();
