/**
 * In-Memory Data Store for fauxBank
 * This serves as a simple database replacement for the mock system
 */

class DataStore {
  constructor() {
    this.customers = new Map();
    this.accounts = new Map();
    this.loans = new Map();
    this.creditCards = new Map();
    this.certificatesOfDeposit = new Map();
    this.investmentAccounts = new Map();
    this.transactions = new Map();
    this.debitCards = new Map();
    
    // Index maps for quick lookups
    this.customersByEmail = new Map();
    this.accountsByCustomer = new Map();
    this.loansByCustomer = new Map();
    this.creditCardsByCustomer = new Map();
  }

  // Customer operations
  createCustomer(customer) {
    this.customers.set(customer.customerId, customer);
    this.customersByEmail.set(customer.email, customer.customerId);
    return customer;
  }

  getCustomer(customerId) {
    return this.customers.get(customerId);
  }

  getCustomerByEmail(email) {
    const customerId = this.customersByEmail.get(email);
    return customerId ? this.customers.get(customerId) : null;
  }

  updateCustomer(customerId, updates) {
    const customer = this.customers.get(customerId);
    if (customer) {
      Object.assign(customer, updates);
      customer.updatedAt = new Date();
      return customer;
    }
    return null;
  }

  // Account operations
  createAccount(account) {
    this.accounts.set(account.accountNumber, account);
    
    // Add to customer index
    if (!this.accountsByCustomer.has(account.customerId)) {
      this.accountsByCustomer.set(account.customerId, []);
    }
    this.accountsByCustomer.get(account.customerId).push(account.accountNumber);
    
    return account;
  }

  getAccount(accountNumber) {
    return this.accounts.get(accountNumber);
  }

  getAccountsByCustomer(customerId) {
    const accountNumbers = this.accountsByCustomer.get(customerId) || [];
    return accountNumbers.map(num => this.accounts.get(num)).filter(acc => acc);
  }

  updateAccount(accountNumber, updates) {
    const account = this.accounts.get(accountNumber);
    if (account) {
      Object.assign(account, updates);
      account.updatedAt = new Date();
      return account;
    }
    return null;
  }

  // Loan operations
  createLoan(loan) {
    this.loans.set(loan.loanNumber, loan);
    
    if (!this.loansByCustomer.has(loan.customerId)) {
      this.loansByCustomer.set(loan.customerId, []);
    }
    this.loansByCustomer.get(loan.customerId).push(loan.loanNumber);
    
    return loan;
  }

  getLoan(loanNumber) {
    return this.loans.get(loanNumber);
  }

  getLoansByCustomer(customerId) {
    const loanNumbers = this.loansByCustomer.get(customerId) || [];
    return loanNumbers.map(num => this.loans.get(num)).filter(loan => loan);
  }

  updateLoan(loanNumber, updates) {
    const loan = this.loans.get(loanNumber);
    if (loan) {
      Object.assign(loan, updates);
      loan.updatedAt = new Date();
      return loan;
    }
    return null;
  }

  // Credit Card operations
  createCreditCard(card) {
    this.creditCards.set(card.cardNumber, card);
    
    if (!this.creditCardsByCustomer.has(card.customerId)) {
      this.creditCardsByCustomer.set(card.customerId, []);
    }
    this.creditCardsByCustomer.get(card.customerId).push(card.cardNumber);
    
    return card;
  }

  getCreditCard(cardNumber) {
    return this.creditCards.get(cardNumber);
  }

  getCreditCardsByCustomer(customerId) {
    const cardNumbers = this.creditCardsByCustomer.get(customerId) || [];
    return cardNumbers.map(num => this.creditCards.get(num)).filter(card => card);
  }

  updateCreditCard(cardNumber, updates) {
    const card = this.creditCards.get(cardNumber);
    if (card) {
      Object.assign(card, updates);
      card.updatedAt = new Date();
      return card;
    }
    return null;
  }

  // Certificate of Deposit operations
  createCD(cd) {
    this.certificatesOfDeposit.set(cd.cdNumber, cd);
    return cd;
  }

  getCD(cdNumber) {
    return this.certificatesOfDeposit.get(cdNumber);
  }

  getCDsByCustomer(customerId) {
    return Array.from(this.certificatesOfDeposit.values())
      .filter(cd => cd.customerId === customerId);
  }

  updateCD(cdNumber, updates) {
    const cd = this.certificatesOfDeposit.get(cdNumber);
    if (cd) {
      Object.assign(cd, updates);
      cd.updatedAt = new Date();
      return cd;
    }
    return null;
  }

  // Investment Account operations
  createInvestmentAccount(investmentAccount) {
    this.investmentAccounts.set(investmentAccount.investmentNumber, investmentAccount);
    return investmentAccount;
  }

  getInvestmentAccount(investmentNumber) {
    return this.investmentAccounts.get(investmentNumber);
  }

  getInvestmentAccountsByCustomer(customerId) {
    return Array.from(this.investmentAccounts.values())
      .filter(inv => inv.customerId === customerId);
  }

  updateInvestmentAccount(investmentNumber, updates) {
    const investmentAccount = this.investmentAccounts.get(investmentNumber);
    if (investmentAccount) {
      Object.assign(investmentAccount, updates);
      investmentAccount.updatedAt = new Date();
      return investmentAccount;
    }
    return null;
  }

  // Transaction operations
  createTransaction(transaction) {
    this.transactions.set(transaction.transactionId, transaction);
    return transaction;
  }

  getTransaction(transactionId) {
    return this.transactions.get(transactionId);
  }

  getTransactionsByAccount(accountNumber) {
    return Array.from(this.transactions.values())
      .filter(txn => txn.fromAccount === accountNumber || txn.toAccount === accountNumber)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getTransactionsByCustomer(customerId) {
    return Array.from(this.transactions.values())
      .filter(txn => txn.customerId === customerId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  // Debit Card operations
  createDebitCard(debitCard) {
    this.debitCards.set(debitCard.cardNumber, debitCard);
    return debitCard;
  }

  getDebitCard(cardNumber) {
    return this.debitCards.get(cardNumber);
  }

  getDebitCardsByCustomer(customerId) {
    return Array.from(this.debitCards.values())
      .filter(card => card.customerId === customerId);
  }

  updateDebitCard(cardNumber, updates) {
    const card = this.debitCards.get(cardNumber);
    if (card) {
      Object.assign(card, updates);
      card.updatedAt = new Date();
      return card;
    }
    return null;
  }

  // Utility methods
  reset() {
    this.customers.clear();
    this.accounts.clear();
    this.loans.clear();
    this.creditCards.clear();
    this.certificatesOfDeposit.clear();
    this.investmentAccounts.clear();
    this.transactions.clear();
    this.debitCards.clear();
    this.customersByEmail.clear();
    this.accountsByCustomer.clear();
    this.loansByCustomer.clear();
    this.creditCardsByCustomer.clear();
  }
}

// Create singleton instance
const dataStore = new DataStore();

module.exports = dataStore;
