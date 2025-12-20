/**
 * Credit Service for fauxBank
 * Handles credit checks, credit cards, and loans
 */

const Loan = require('../models/Loan');
const CreditCard = require('../models/CreditCard');
const dataStore = require('./dataStore');
const { generateLoanNumber, generateCardNumber } = require('../utils/accountNumberGenerator');
const { auditLog } = require('../middleware/securityGuardrails');
const crypto = require('crypto');

class CreditService {
  /**
   * Perform credit check
   */
  performCreditCheck(customerId) {
    const customer = dataStore.getCustomer(customerId);
    
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Simulate credit score calculation based on various factors
    let creditScore = 650; // Base score

    // Factor in existing accounts
    const accounts = dataStore.getAccountsByCustomer(customerId);
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    if (totalBalance > 10000) creditScore += 50;

    // Factor in existing loans
    const loans = dataStore.getLoansByCustomer(customerId);
    const activeLoanCount = loans.filter(l => l.status === 'active').length;
    if (activeLoanCount === 0) creditScore += 30;
    if (activeLoanCount > 3) creditScore -= 40;

    // Factor in credit cards
    const creditCards = dataStore.getCreditCardsByCustomer(customerId);
    const totalCreditUsed = creditCards.reduce((sum, card) => sum + card.currentBalance, 0);
    const totalCreditLimit = creditCards.reduce((sum, card) => sum + card.creditLimit, 0);
    
    if (totalCreditLimit > 0) {
      const utilizationRate = totalCreditUsed / totalCreditLimit;
      if (utilizationRate < 0.3) creditScore += 40;
      if (utilizationRate > 0.7) creditScore -= 30;
    }

    // Ensure score is within valid range
    creditScore = Math.max(300, Math.min(850, creditScore));

    // Update customer credit score
    customer.creditScore = creditScore;
    dataStore.updateCustomer(customerId, customer);

    auditLog('CREDIT_CHECK', { customerId, creditScore });

    return {
      customerId,
      creditScore,
      rating: this.getCreditRating(creditScore),
      timestamp: new Date()
    };
  }

  /**
   * Get credit rating from score
   */
  getCreditRating(score) {
    if (score >= 800) return 'Excellent';
    if (score >= 740) return 'Very Good';
    if (score >= 670) return 'Good';
    if (score >= 580) return 'Fair';
    return 'Poor';
  }

  /**
   * Apply for loan
   */
  applyForLoan(customerId, loanType, principal, termMonths, interestRate) {
    const customer = dataStore.getCustomer(customerId);
    
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Perform credit check
    const creditCheck = this.performCreditCheck(customerId);

    // Determine loan approval based on credit score
    const minScoreRequired = {
      'personal': 620,
      'auto': 600,
      'home': 680,
      'student': 580,
      'business': 700
    };

    if (creditCheck.creditScore < minScoreRequired[loanType]) {
      auditLog('LOAN_DENIED', { customerId, loanType, reason: 'Low credit score' });
      throw new Error('Loan application denied due to insufficient credit score');
    }

    // Calculate monthly payment
    const monthlyInterestRate = interestRate / 12 / 100;
    const monthlyPayment = principal * 
      (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, termMonths)) / 
      (Math.pow(1 + monthlyInterestRate, termMonths) - 1);

    const loanNumber = generateLoanNumber();
    const nextPaymentDate = new Date();
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

    const loan = new Loan({
      loanNumber,
      loanType,
      principal,
      interestRate,
      termMonths,
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      currentBalance: principal,
      customerId,
      status: 'active',
      nextPaymentDate
    });

    dataStore.createLoan(loan);

    auditLog('LOAN_APPROVED', { loanNumber, customerId, principal, loanType });

    return loan;
  }

  /**
   * Make loan payment
   */
  makeLoanPayment(loanNumber, amount) {
    const loan = dataStore.getLoan(loanNumber);
    
    if (!loan) {
      throw new Error('Loan not found');
    }

    if (loan.status !== 'active') {
      throw new Error('Loan is not active');
    }

    // Apply payment to loan balance
    loan.currentBalance -= amount;

    if (loan.currentBalance <= 0) {
      loan.currentBalance = 0;
      loan.status = 'paid_off';
      auditLog('LOAN_PAID_OFF', { loanNumber });
    } else {
      // Update next payment date
      loan.nextPaymentDate = new Date(loan.nextPaymentDate);
      loan.nextPaymentDate.setMonth(loan.nextPaymentDate.getMonth() + 1);
    }

    loan.updatedAt = new Date();
    dataStore.updateLoan(loanNumber, loan);

    auditLog('LOAN_PAYMENT', { loanNumber, amount, remainingBalance: loan.currentBalance });

    return loan;
  }

  /**
   * Apply for credit card
   */
  applyForCreditCard(customerId, cardType, requestedLimit) {
    const customer = dataStore.getCustomer(customerId);
    
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Perform credit check
    const creditCheck = this.performCreditCheck(customerId);

    // Determine approval and credit limit based on credit score
    let approvedLimit = 0;
    if (creditCheck.creditScore >= 750) {
      approvedLimit = Math.min(requestedLimit, 20000);
    } else if (creditCheck.creditScore >= 670) {
      approvedLimit = Math.min(requestedLimit, 10000);
    } else if (creditCheck.creditScore >= 600) {
      approvedLimit = Math.min(requestedLimit, 5000);
    } else {
      auditLog('CREDIT_CARD_DENIED', { customerId, reason: 'Low credit score' });
      throw new Error('Credit card application denied due to insufficient credit score');
    }

    // Generate card details
    const cardNumber = generateCardNumber();
    const cvv = Math.floor(Math.random() * 900) + 100;
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 3);

    // Determine interest rate based on credit score
    let interestRate = 24.99; // Default APR
    if (creditCheck.creditScore >= 750) interestRate = 14.99;
    else if (creditCheck.creditScore >= 670) interestRate = 19.99;

    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + 1);
    dueDate.setDate(15); // Due on the 15th of each month

    const creditCard = new CreditCard({
      cardNumber,
      cardType,
      customerId,
      creditLimit: approvedLimit,
      availableCredit: approvedLimit,
      interestRate,
      cvv: cvv.toString(),
      expirationDate,
      dueDate,
      status: 'active'
    });

    dataStore.createCreditCard(creditCard);

    auditLog('CREDIT_CARD_APPROVED', { cardNumber, customerId, creditLimit: approvedLimit });

    return creditCard;
  }

  /**
   * Make credit card payment
   */
  makeCreditCardPayment(cardNumber, amount) {
    const card = dataStore.getCreditCard(cardNumber);
    
    if (!card) {
      throw new Error('Credit card not found');
    }

    if (card.status !== 'active') {
      throw new Error('Card is not active');
    }

    if (amount > card.currentBalance) {
      throw new Error('Payment amount exceeds current balance');
    }

    card.currentBalance -= amount;
    card.availableCredit += amount;
    card.minimumPayment = Math.max(0, card.minimumPayment - amount);
    card.updatedAt = new Date();

    dataStore.updateCreditCard(cardNumber, card);

    auditLog('CREDIT_CARD_PAYMENT', { cardNumber, amount, newBalance: card.currentBalance });

    return card;
  }

  /**
   * Process credit card charge
   */
  chargeCreditCard(cardNumber, amount, merchantId, description) {
    const card = dataStore.getCreditCard(cardNumber);
    
    if (!card) {
      throw new Error('Credit card not found');
    }

    if (card.status !== 'active') {
      throw new Error('Card is not active');
    }

    if (amount > card.availableCredit) {
      throw new Error('Transaction exceeds available credit');
    }

    card.currentBalance += amount;
    card.availableCredit -= amount;
    card.minimumPayment = Math.max(card.minimumPayment, card.currentBalance * 0.02); // 2% minimum
    card.rewardsPoints += Math.floor(amount); // 1 point per dollar
    card.updatedAt = new Date();

    dataStore.updateCreditCard(cardNumber, card);

    auditLog('CREDIT_CARD_CHARGE', { cardNumber, amount, merchantId });

    return card;
  }
}

module.exports = new CreditService();
