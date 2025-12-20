/**
 * Account Service for fauxBank
 * Handles all account-related business logic
 */

const Account = require('../models/Account');
const dataStore = require('./dataStore');
const { generateAccountNumber, generateRoutingNumber } = require('../utils/accountNumberGenerator');
const { validateAccountStatus, validateSufficientFunds, auditLog } = require('../middleware/securityGuardrails');
const crypto = require('crypto');

class AccountService {
  /**
   * Create a new account
   */
  createAccount(customerId, accountType, initialDeposit = 0, options = {}) {
    // Validate customer exists
    const customer = dataStore.getCustomer(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Validate account type
    const validTypes = ['checking', 'savings', 'money_market'];
    if (!validTypes.includes(accountType)) {
      throw new Error('Invalid account type');
    }

    // Generate account number
    const accountNumber = generateAccountNumber();
    const routingNumber = generateRoutingNumber();

    const accountData = {
      accountNumber,
      accountType,
      balance: initialDeposit,
      customerId,
      routingNumber,
      interestRate: options.interestRate || (accountType === 'savings' ? 0.02 : 0),
      minimumBalance: options.minimumBalance || (accountType === 'savings' ? 100 : 0),
      overdraftProtection: options.overdraftProtection || false,
      overdraftLimit: options.overdraftLimit || 0,
    };

    const account = new Account(accountData);
    dataStore.createAccount(account);

    auditLog('ACCOUNT_CREATED', { accountNumber, customerId, accountType });

    return account;
  }

  /**
   * Get account by account number
   */
  getAccount(accountNumber) {
    return dataStore.getAccount(accountNumber);
  }

  /**
   * Get all accounts for a customer
   */
  getAccountsByCustomer(customerId) {
    return dataStore.getAccountsByCustomer(customerId);
  }

  /**
   * Update account balance
   */
  updateBalance(accountNumber, amount, transactionType) {
    const account = dataStore.getAccount(accountNumber);
    
    if (!account) {
      throw new Error('Account not found');
    }

    const statusCheck = validateAccountStatus(account);
    if (!statusCheck.valid) {
      throw new Error(statusCheck.error);
    }

    if (transactionType === 'debit') {
      const fundsCheck = validateSufficientFunds(account, Math.abs(amount));
      if (!fundsCheck.valid) {
        throw new Error(fundsCheck.error);
      }
      account.balance -= Math.abs(amount);
    } else {
      account.balance += Math.abs(amount);
    }

    account.updatedAt = new Date();
    dataStore.updateAccount(accountNumber, account);

    auditLog('BALANCE_UPDATED', { accountNumber, amount, transactionType, newBalance: account.balance });

    return account;
  }

  /**
   * Transfer funds between accounts
   */
  transferFunds(fromAccountNumber, toAccountNumber, amount) {
    const fromAccount = dataStore.getAccount(fromAccountNumber);
    const toAccount = dataStore.getAccount(toAccountNumber);

    if (!fromAccount || !toAccount) {
      throw new Error('Account not found');
    }

    // Validate from account
    const fromStatusCheck = validateAccountStatus(fromAccount);
    if (!fromStatusCheck.valid) {
      throw new Error(`Source account: ${fromStatusCheck.error}`);
    }

    // Validate to account
    const toStatusCheck = validateAccountStatus(toAccount);
    if (!toStatusCheck.valid) {
      throw new Error(`Destination account: ${toStatusCheck.error}`);
    }

    // Check sufficient funds
    const fundsCheck = validateSufficientFunds(fromAccount, amount);
    if (!fundsCheck.valid) {
      throw new Error(fundsCheck.error);
    }

    // Perform transfer
    fromAccount.balance -= amount;
    toAccount.balance += amount;
    fromAccount.updatedAt = new Date();
    toAccount.updatedAt = new Date();

    dataStore.updateAccount(fromAccountNumber, fromAccount);
    dataStore.updateAccount(toAccountNumber, toAccount);

    auditLog('TRANSFER', { fromAccountNumber, toAccountNumber, amount });

    return { fromAccount, toAccount };
  }

  /**
   * Close account
   */
  closeAccount(accountNumber) {
    const account = dataStore.getAccount(accountNumber);
    
    if (!account) {
      throw new Error('Account not found');
    }

    if (account.balance !== 0) {
      throw new Error('Cannot close account with non-zero balance');
    }

    account.status = 'closed';
    account.updatedAt = new Date();
    dataStore.updateAccount(accountNumber, account);

    auditLog('ACCOUNT_CLOSED', { accountNumber });

    return account;
  }

  /**
   * Freeze account
   */
  freezeAccount(accountNumber, reason) {
    const account = dataStore.getAccount(accountNumber);
    
    if (!account) {
      throw new Error('Account not found');
    }

    account.status = 'frozen';
    account.updatedAt = new Date();
    dataStore.updateAccount(accountNumber, account);

    auditLog('ACCOUNT_FROZEN', { accountNumber, reason });

    return account;
  }

  /**
   * Unfreeze account
   */
  unfreezeAccount(accountNumber) {
    const account = dataStore.getAccount(accountNumber);
    
    if (!account) {
      throw new Error('Account not found');
    }

    account.status = 'active';
    account.updatedAt = new Date();
    dataStore.updateAccount(accountNumber, account);

    auditLog('ACCOUNT_UNFROZEN', { accountNumber });

    return account;
  }
}

module.exports = new AccountService();
