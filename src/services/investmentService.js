/**
 * Investment Service for fauxBank
 * Handles CDs and Investment Accounts
 */

const CertificateOfDeposit = require('../models/CertificateOfDeposit');
const InvestmentAccount = require('../models/InvestmentAccount');
const dataStore = require('./dataStore');
const accountService = require('./accountService');
const { generateCDNumber, generateInvestmentNumber } = require('../utils/accountNumberGenerator');
const { auditLog } = require('../middleware/securityGuardrails');

class InvestmentService {
  /**
   * Open Certificate of Deposit
   */
  openCD(customerId, principal, termMonths, sourceAccountNumber) {
    const customer = dataStore.getCustomer(customerId);
    
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Verify source account and sufficient funds
    const sourceAccount = dataStore.getAccount(sourceAccountNumber);
    if (!sourceAccount || sourceAccount.customerId !== customerId) {
      throw new Error('Invalid source account');
    }

    if (sourceAccount.balance < principal) {
      throw new Error('Insufficient funds in source account');
    }

    // Minimum CD requirements
    if (principal < 500) {
      throw new Error('Minimum CD amount is $500');
    }

    const validTerms = [3, 6, 12, 24, 36, 60];
    if (!validTerms.includes(termMonths)) {
      throw new Error('Invalid CD term. Valid terms: 3, 6, 12, 24, 36, 60 months');
    }

    // Calculate interest rate based on term
    const interestRates = {
      3: 1.5,
      6: 2.0,
      12: 2.5,
      24: 3.0,
      36: 3.5,
      60: 4.0
    };
    const interestRate = interestRates[termMonths];

    // Calculate maturity date
    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + termMonths);

    // Calculate early withdrawal penalty (3 months of interest)
    const earlyWithdrawalPenalty = (principal * (interestRate / 100) * 3) / 12;

    const cdNumber = generateCDNumber();

    const cd = new CertificateOfDeposit({
      cdNumber,
      customerId,
      principal,
      interestRate,
      termMonths,
      maturityDate,
      earlyWithdrawalPenalty,
      autoRenew: false
    });

    dataStore.createCD(cd);

    // Deduct from source account
    accountService.updateBalance(sourceAccountNumber, principal, 'debit');

    auditLog('CD_OPENED', { cdNumber, customerId, principal, termMonths });

    return cd;
  }

  /**
   * Close CD (with or without maturity)
   */
  closeCD(cdNumber, destinationAccountNumber) {
    const cd = dataStore.getCD(cdNumber);
    
    if (!cd) {
      throw new Error('CD not found');
    }

    if (cd.status !== 'active') {
      throw new Error('CD is not active');
    }

    // Calculate current value
    const now = new Date();
    // Calculate months elapsed using actual month difference
    const yearsDiff = now.getFullYear() - cd.createdAt.getFullYear();
    const monthsDiff = now.getMonth() - cd.createdAt.getMonth();
    const monthsElapsed = yearsDiff * 12 + monthsDiff;
    let currentValue = cd.principal;

    if (now >= cd.maturityDate) {
      // CD has matured - full interest
      const totalInterest = (cd.principal * cd.interestRate * cd.termMonths) / (100 * 12);
      currentValue = cd.principal + totalInterest;
      cd.status = 'matured';
    } else {
      // Early withdrawal - apply penalty
      currentValue = cd.principal - cd.earlyWithdrawalPenalty;
      auditLog('CD_EARLY_WITHDRAWAL', { cdNumber, penalty: cd.earlyWithdrawalPenalty });
    }

    cd.currentValue = currentValue;
    cd.status = 'closed';
    cd.updatedAt = new Date();
    dataStore.updateCD(cdNumber, cd);

    // Credit destination account
    accountService.updateBalance(destinationAccountNumber, currentValue, 'credit');

    auditLog('CD_CLOSED', { cdNumber, currentValue, matured: cd.status === 'matured' });

    return cd;
  }

  /**
   * Open investment account
   */
  openInvestmentAccount(customerId, accountType, initialDeposit, riskProfile) {
    const customer = dataStore.getCustomer(customerId);
    
    if (!customer) {
      throw new Error('Customer not found');
    }

    const validTypes = ['brokerage', 'ira', 'roth_ira', '401k'];
    if (!validTypes.includes(accountType)) {
      throw new Error('Invalid investment account type');
    }

    const validRiskProfiles = ['conservative', 'moderate', 'aggressive'];
    if (!validRiskProfiles.includes(riskProfile)) {
      throw new Error('Invalid risk profile');
    }

    const investmentNumber = generateInvestmentNumber();

    const investmentAccount = new InvestmentAccount({
      investmentNumber,
      accountType,
      customerId,
      cashBalance: initialDeposit,
      totalValue: initialDeposit,
      riskProfile,
      holdings: []
    });

    dataStore.createInvestmentAccount(investmentAccount);

    auditLog('INVESTMENT_ACCOUNT_OPENED', { investmentNumber, customerId, accountType });

    return investmentAccount;
  }

  /**
   * Buy investment (stock/fund)
   */
  buyInvestment(investmentNumber, symbol, shares, pricePerShare) {
    const account = dataStore.getInvestmentAccount(investmentNumber);
    
    if (!account) {
      throw new Error('Investment account not found');
    }

    const totalCost = shares * pricePerShare;

    if (totalCost > account.cashBalance) {
      throw new Error('Insufficient cash balance');
    }

    // Update cash balance
    account.cashBalance -= totalCost;

    // Add or update holding
    const existingHolding = account.holdings.find(h => h.symbol === symbol);
    if (existingHolding) {
      existingHolding.shares += shares;
      existingHolding.averageCost = 
        ((existingHolding.averageCost * (existingHolding.shares - shares)) + (pricePerShare * shares)) / 
        existingHolding.shares;
    } else {
      account.holdings.push({
        symbol,
        shares,
        averageCost: pricePerShare,
        currentPrice: pricePerShare
      });
    }

    // Update invested value and total value
    account.investedValue += totalCost;
    account.totalValue = account.cashBalance + account.investedValue;
    account.updatedAt = new Date();

    dataStore.updateInvestmentAccount(investmentNumber, account);

    auditLog('INVESTMENT_BUY', { investmentNumber, symbol, shares, pricePerShare });

    return account;
  }

  /**
   * Sell investment (stock/fund)
   */
  sellInvestment(investmentNumber, symbol, shares, pricePerShare) {
    const account = dataStore.getInvestmentAccount(investmentNumber);
    
    if (!account) {
      throw new Error('Investment account not found');
    }

    const holding = account.holdings.find(h => h.symbol === symbol);
    if (!holding || holding.shares < shares) {
      throw new Error('Insufficient shares to sell');
    }

    const totalProceeds = shares * pricePerShare;

    // Update holding
    holding.shares -= shares;
    if (holding.shares === 0) {
      account.holdings = account.holdings.filter(h => h.symbol !== symbol);
    }

    // Update cash balance
    account.cashBalance += totalProceeds;

    // Update invested value and total value
    account.investedValue -= (shares * holding.averageCost);
    account.totalValue = account.cashBalance + account.investedValue;
    account.updatedAt = new Date();

    dataStore.updateInvestmentAccount(investmentNumber, account);

    auditLog('INVESTMENT_SELL', { investmentNumber, symbol, shares, pricePerShare });

    return account;
  }

  /**
   * Get investment account details
   */
  getInvestmentAccount(investmentNumber) {
    return dataStore.getInvestmentAccount(investmentNumber);
  }

  /**
   * Get CD details
   */
  getCD(cdNumber) {
    return dataStore.getCD(cdNumber);
  }
}

module.exports = new InvestmentService();
